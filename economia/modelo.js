/* =========================================================================
   economia/modelo.js — As fórmulas da economia de Crisálida, em JS puro.

   ESTE ARQUIVO NÃO É CARREGADO PELO JOGO. Ele existe para (a) simular o
   balanceamento fora da cadeia e (b) servir de referência executável para a
   implementação em Solidity. Nenhuma função aqui toca em rede, carteira,
   localStorage ou DOM.

   Roda em Node (module.exports) e no navegador (window.CrisalidaEconomia).
   ========================================================================= */
(function (raiz, fabrica) {
  'use strict';
  var api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.CrisalidaEconomia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var M = {};

  function limitar(v, min, max) { return v < min ? min : (v > max ? max : v); }
  M.limitar = limitar;

  /* ------------------------------------------------------------------ */
  /*  CICLOS DE ORVA                                                     */
  /* ------------------------------------------------------------------ */

  /* Hash determinístico (FNV-1a 32 bits).
     ATENÇÃO: em Solidity o sorteio usa keccak256(ciclo, especie). A REGRA é a
     mesma; só a função de hash difere. Para simulação de balanceamento isso é
     irrelevante — o que importa é a frequência, não o sorteio específico. */
  function hash32(texto) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  M.hash32 = hash32;

  M.cicloEm = function (tempoSegundos, genese, p) {
    return Math.floor((tempoSegundos - genese) / p.ciclo.duracaoSegundos);
  };

  /* Faixa de raridade a partir da taxa de captura base da espécie. */
  M.faixaDeRaridade = function (cap, p) {
    var faixas = p.raridade.faixas;
    for (var i = 0; i < faixas.length; i++) {
      if (cap >= faixas[i].capMin && cap <= faixas[i].capMax) return faixas[i];
    }
    return faixas[faixas.length - 1];
  };

  /* "1/12" -> 12 */
  function denominador(fracao) {
    var partes = String(fracao).split('/');
    return parseInt(partes[1], 10) || 1;
  }
  function numerador(fracao) {
    var partes = String(fracao).split('/');
    return parseInt(partes[0], 10) || 1;
  }

  /* A espécie desce de Orva neste ciclo? Determinístico e verificável. */
  M.desceNoCiclo = function (ciclo, especieId, cap, p) {
    var faixa = M.faixaDeRaridade(cap, p);
    var den = denominador(faixa.descePorCiclo);
    var num = numerador(faixa.descePorCiclo);
    if (den <= 1) return true;
    var sorteio = hash32(ciclo + ':' + especieId) % den;
    return sorteio < num;
  };

  /* ------------------------------------------------------------------ */
  /*  OFERTA E SATURAÇÃO                                                 */
  /* ------------------------------------------------------------------ */

  /* Meta de oferta de uma espécie: quanto mais fácil de capturar, maior a meta. */
  M.metaDaEspecie = function (cap, p) {
    var pol = p.politica;
    var bruto = pol.metaBaseEspecie * Math.pow(cap / 255, pol.expoenteRaridade);
    return Math.max(pol.metaMinima, Math.round(bruto));
  };

  M.saturacao = function (ofertaAtual, meta) {
    if (meta <= 0) return 0;
    return ofertaAtual / meta;
  };

  /* ------------------------------------------------------------------ */
  /*  POLÍTICA MONETÁRIA                                                 */
  /* ------------------------------------------------------------------ */

  /* Termostato global: se queimamos menos do que emitimos, tudo endurece. */
  M.fatorPolitica = function (queimadoNoCiclo, emitidoNoCiclo, p) {
    var pol = p.politica;
    if (emitidoNoCiclo <= 0) return pol.fatorPoliticaMin;
    var razao = Math.max(queimadoNoCiclo / emitidoNoCiclo, pol.razaoQueimaMinima);
    return limitar(pol.metaQueima / razao, pol.fatorPoliticaMin, pol.fatorPoliticaMax);
  };

  M.razaoQueima = function (queimadoNoCiclo, emitidoNoCiclo) {
    if (emitidoNoCiclo <= 0) return 0;
    return queimadoNoCiclo / emitidoNoCiclo;
  };

  M.dificuldade = function (saturacao, fatorPolitica, p) {
    return Math.pow(1 + saturacao, p.politica.expoenteSaturacao) * fatorPolitica;
  };

  /* Taxa de captura efetiva, no mesmo espaço 1..255 que o jogo já usa. */
  M.capturaEfetiva = function (capturaBase, dificuldade, p) {
    var pol = p.politica;
    return limitar(capturaBase / dificuldade, pol.capturaEfetivaMin, pol.capturaEfetivaMax);
  };

  M.custoSelo = function (custoBase, saturacao, fatorPolitica, p) {
    return custoBase
      * Math.pow(1 + saturacao, p.politica.expoenteCusto)
      * Math.sqrt(fatorPolitica);
  };

  /* ------------------------------------------------------------------ */
  /*  EMISSÃO                                                            */
  /* ------------------------------------------------------------------ */

  M.emissaoDoCiclo = function (ciclo, p) {
    var e = p.tokens.eter;
    return e.emissaoBaseCiclo * Math.pow(e.decaimentoPorCiclo, ciclo);
  };

  M.fatorEmissao = function (ciclo, p) {
    return Math.pow(p.tokens.eter.decaimentoPorCiclo, ciclo);
  };

  M.emissaoAcumulada = function (ateCiclo, p) {
    var e = p.tokens.eter;
    var r = e.decaimentoPorCiclo;
    return e.emissaoBaseCiclo * (1 - Math.pow(r, ateCiclo + 1)) / (1 - r);
  };

  /* ------------------------------------------------------------------ */
  /*  RECOMPENSAS                                                        */
  /* ------------------------------------------------------------------ */

  M.recompensaVitoria = function (nivelInimigo, vinculo, ciclo, p) {
    var f = p.fontes.eter;
    var base = f.vitoriaBase + f.vitoriaPorNivelInimigo * nivelInimigo;
    var bonus = 1 + (limitar(vinculo, 0, 100) / 100) * f.bonusVinculoMaximo;
    return base * bonus * M.fatorEmissao(ciclo, p);
  };

  M.recompensaCuidadoDoCiclo = function (animos, ciclo, p) {
    var f = p.fontes.eter;
    var aptos = animos.filter(function (a) {
      return a.vinculo >= f.limiteVinculoParaPremio &&
             a.saciedadeMedia >= f.limiteSaciedadeMediaParaPremio;
    });
    var premiados = Math.min(aptos.length, f.maxAnimosPremiadosPorCiclo);
    return premiados * f.cicloBemCuidado * M.fatorEmissao(ciclo, p);
  };

  /* ------------------------------------------------------------------ */
  /*  SUMIDOUROS                                                         */
  /* ------------------------------------------------------------------ */

  /* Divide um custo entre queima e tesouraria conforme a tabela. */
  M.dividirCusto = function (valor, regra) {
    var queima = valor * (regra.queima || 0);
    return {
      total: valor,
      queimado: queima,
      tesouraria: valor - queima,
      moeda: regra.moeda
    };
  };

  M.regraDeSumidouro = function (id, p) {
    var s = p.sumidouros;
    return (s.selos && s.selos[id]) || (s.insumos && s.insumos[id]) ||
           (s.servicos && s.servicos[id]) || null;
  };

  /* Custo real de um arremesso de selo, já com saturação e política aplicadas. */
  M.custoDeArremesso = function (idSelo, saturacaoEspecie, fatorPol, p) {
    var regra = M.regraDeSumidouro(idSelo, p);
    if (!regra) return null;
    var custo = M.custoSelo(regra.custo, saturacaoEspecie, fatorPol, p);
    return M.dividirCusto(custo, regra);
  };

  /* ------------------------------------------------------------------ */
  /*  BATISMO                                                            */
  /* ------------------------------------------------------------------ */

  /* Normalização de nome usada para garantir unicidade global.
     O contrato guarda apenas o hash disto; a normalização é responsabilidade
     do cliente e do servidor assinante. */
  M.normalizarNome = function (nome) {
    return String(nome)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')   /* tira acentos */
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  M.nomeValido = function (nome) {
    var n = String(nome).trim();
    if (n.length < 2 || n.length > 24) return false;
    /* letras, números, espaço, hífen e apóstrofo */
    return /^[\p{L}\p{N} '\-]+$/u.test(n);
  };

  /* ------------------------------------------------------------------ */
  /*  RESUMO DE UM ESTADO                                                */
  /* ------------------------------------------------------------------ */

  /* Fotografia legível do estado econômico — usada pelo simulador. */
  M.diagnostico = function (estado, p) {
    var razao = M.razaoQueima(estado.queimadoNoCiclo, estado.emitidoNoCiclo);
    var fator = M.fatorPolitica(estado.queimadoNoCiclo, estado.emitidoNoCiclo, p);
    var saudavel = razao >= p.politica.metaQueima * 0.85;
    return {
      ciclo: estado.ciclo,
      emitido: estado.emitidoNoCiclo,
      queimado: estado.queimadoNoCiclo,
      razaoQueima: razao,
      fatorPolitica: fator,
      suprimentoEter: estado.suprimentoEter,
      nftsCunhados: estado.nftsCunhados,
      veredito: saudavel
        ? (razao > 1.25 ? 'deflacionário forte' : 'saudável')
        : (razao < 0.6 ? 'inflacionário — política endurecendo' : 'levemente inflacionário')
    };
  };

  return M;
});
