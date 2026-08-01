#!/usr/bin/env node
/* =========================================================================
   economia/simulador.js — Simula a economia de Ânimos fora da cadeia.

   Roda ciclos de Orva com uma população de jogadores e mede se a economia
   fica estável, inflaciona ou deflaciona. Serve para calibrar os números de
   economia/parametros.json ANTES de escrever qualquer transação real.

   Uso:
     node economia/simulador.js
     node economia/simulador.js --ciclos 36 --jogadores 5000
     node economia/simulador.js --detalhe
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'parametros.json'), 'utf8'));
const M = require('./modelo.js');

/* ---------- carrega as espécies do jogo (sem DOM, sem navegador) -------- */
function carregarEspecies() {
  const caixa = { window: {}, console };
  caixa.window.ANIMOS = {};
  caixa.globalThis = caixa;
  vm.createContext(caixa);
  ['js/core.js', 'js/data/tipos.js', 'js/data/tecnicas.js', 'js/data/especies.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, f), 'utf8'), caixa, { filename: f });
  });
  return caixa.window.ANIMOS.LISTA_ESPECIES.map(e => ({
    id: e.id, nome: e.nome, cap: e.cap, num: e.num
  }));
}

/* ------------------------------ argumentos ----------------------------- */
function arg(nome, padrao) {
  const i = process.argv.indexOf('--' + nome);
  if (i < 0) return padrao;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? Number(v) : true;
}
const N_CICLOS = Number(arg('ciclos', 24));
const N_JOGADORES = Number(arg('jogadores', 3000));
const DETALHE = !!arg('detalhe', false);

/* --------------------------- perfis de jogador ------------------------- */
/* proporção, batalhas/ciclo, arremessos/ciclo, itens de cuidado/ciclo      */
const PERFIS = [
  { id: 'casual',   fatia: 0.55, batalhas: 40,  arremessos: 6,  cuidados: 10, vinculo: 55 },
  { id: 'regular',  fatia: 0.35, batalhas: 180, arremessos: 30, cuidados: 55, vinculo: 82 },
  { id: 'dedicado', fatia: 0.09, batalhas: 600, arremessos: 90, cuidados: 170, vinculo: 92 },
  { id: 'fazenda',  fatia: 0.01, batalhas: 2200, arremessos: 300, cuidados: 40, vinculo: 30 }
];

/* Insumos consumidos por "cuidado": mistura realista de itens baratos e caros */
const CESTA_CUIDADO = [
  { id: 'fruta_doce', peso: 0.30 },
  { id: 'racao_etera', peso: 0.25 },
  { id: 'elixir_menor', peso: 0.18 },
  { id: 'bolo_de_mel', peso: 0.12 },
  { id: 'elixir', peso: 0.08 },
  { id: 'cristal_descanso', peso: 0.04 },
  { id: 'elixir_maior', peso: 0.02 },
  { id: 'nectar_pleno', peso: 0.01 }
];
const CUSTO_MEDIO_CUIDADO = CESTA_CUIDADO.reduce(
  (s, c) => s + c.peso * P.sumidouros.insumos[c.id].custo, 0);

/* Mistura de selos usada pela população */
const CESTA_SELOS = [
  { id: 'selo_simples', peso: 0.62 },
  { id: 'selo_reforcado', peso: 0.26 },
  { id: 'selo_do_lago', peso: 0.05 },
  { id: 'selo_da_brasa', peso: 0.04 },
  { id: 'selo_aureo', peso: 0.03 }
];

/* --------------------------------- estado ------------------------------ */
const especies = carregarEspecies();
const oferta = {};      /* NFTs cunhados por espécie */
const meta = {};
especies.forEach(e => { oferta[e.id] = 0; meta[e.id] = M.metaDaEspecie(e.cap, P); });

let queimadoTotal = 0;
let emitidoTotal = 0;
let nftsTotal = 0;
let ambarQueimado = 0;
let ambarEmTesouraria = 0;
let reprimidoTotal = 0;

/* Saldo de ETR por grupo de jogadores. Ninguém queima o que não tem:
   é isso que impede o suprimento de ficar negativo e revela quando os custos
   passaram do que a população consegue pagar jogando. */
const saldo = {};
PERFIS.forEach(p => { saldo[p.id] = 0; });
const suprimentoTotal = () => PERFIS.reduce((s, p) => s + saldo[p.id], 0);

/* Fator de política começa neutro; o primeiro ciclo ainda não tem histórico. */
let fatorPol = 1.0;

const linhas = [];

/* ------------------------------- simulação ----------------------------- */
for (let ciclo = 0; ciclo < N_CICLOS; ciclo++) {
  let emitido = 0, queimado = 0, cunhadosNoCiclo = 0, arremessosNoCiclo = 0;
  const fEmissao = M.fatorEmissao(ciclo, P);

  /* quais espécies descem de Orva neste ciclo */
  const descendo = especies.filter(e => M.desceNoCiclo(ciclo, e.id, e.cap, P));
  const pesoTotal = descendo.reduce((s, e) => s + e.cap, 0);

  let reprimidoNoCiclo = 0;

  PERFIS.forEach(perfil => {
    const n = Math.round(N_JOGADORES * perfil.fatia);
    if (!n) return;

    /* ---------------- ganho: entra no saldo do grupo ---------------- */
    const porBatalha = M.recompensaVitoria(22, perfil.vinculo, ciclo, P);
    let ganho = n * perfil.batalhas * porBatalha * 0.55; /* 55% de vitórias */

    const f = P.fontes.eter;
    if (perfil.vinculo >= f.limiteVinculoParaPremio) {
      ganho += n * Math.min(f.maxAnimosPremiadosPorCiclo, 3) * f.cicloBemCuidado * fEmissao;
    }
    emitido += ganho;
    saldo[perfil.id] += ganho;

    /* Gasta em ordem de prioridade, e só até onde o saldo alcança.
       O que não coube vira demanda reprimida — o sinal de que os custos
       passaram do que se consegue pagar jogando. */
    function gastar(desejado) {
      const pago = Math.min(desejado, Math.max(0, saldo[perfil.id]));
      saldo[perfil.id] -= pago;
      reprimidoNoCiclo += desejado - pago;
      return pago;
    }

    /* --- 1º: cuidado (obrigatório, senão o Ânimo entra em Letargia) --- */
    queimado += gastar(n * perfil.cuidados * CUSTO_MEDIO_CUIDADO);

    /* --- 2º: cura no santuário (1 a cada 12 batalhas) --- */
    queimado += gastar(n * (perfil.batalhas / 12) * P.sumidouros.servicos.cura_santuario.custo);

    /* --- 3º: arremessos de selo, com o que sobrou --- */
    for (let a = 0; a < perfil.arremessos; a++) {
      /* escolhe a espécie-alvo proporcional à facilidade (o comum aparece mais) */
      let r = Math.random() * pesoTotal, alvo = descendo[0];
      for (const e of descendo) { r -= e.cap; if (r <= 0) { alvo = e; break; } }
      if (!alvo) continue;

      const sat = M.saturacao(oferta[alvo.id], meta[alvo.id]);

      /* escolhe o selo */
      let rs = Math.random(), selo = CESTA_SELOS[0];
      for (const s of CESTA_SELOS) { rs -= s.peso; if (rs <= 0) { selo = s; break; } }
      const regra = P.sumidouros.selos[selo.id];

      const custo = M.custoSelo(regra.custo, sat, fatorPol, P);

      /* quantos jogadores do grupo conseguem pagar este arremesso */
      let participantes = n;
      if (regra.moeda === 'AMB') {
        ambarQueimado += n * custo * regra.queima;
        ambarEmTesouraria += n * custo * (1 - regra.queima);
      } else {
        const desejado = n * custo;
        const pago = gastar(desejado);
        queimado += pago * regra.queima;
        participantes = desejado > 0 ? Math.floor(n * (pago / desejado)) : 0;
      }
      arremessosNoCiclo += participantes;
      if (!participantes) continue;

      /* sucesso da captura, com a dificuldade econômica aplicada */
      const dific = M.dificuldade(sat, fatorPol, P);
      const capEfetiva = M.capturaEfetiva(alvo.cap, dific, P);
      const chance = Math.min(0.92, capEfetiva / 255 * 1.9); /* alvo enfraquecido */
      const sucessos = Math.round(participantes * chance);

      const teto = meta[alvo.id] * 3;
      const cabem = Math.max(0, teto - oferta[alvo.id]);
      const efetivos = Math.min(sucessos, cabem);

      oferta[alvo.id] += efetivos;
      cunhadosNoCiclo += efetivos;

      /* batismo: cada NFT cunhado queima Âmbar */
      const bat = P.sumidouros.servicos.batismo;
      ambarQueimado += efetivos * bat.custo * bat.queima;
      ambarEmTesouraria += efetivos * bat.custo * (1 - bat.queima);
    }
  });

  reprimidoTotal += reprimidoNoCiclo;
  const suprimentoEter = suprimentoTotal();
  emitidoTotal += emitido;
  queimadoTotal += queimado;
  nftsTotal += cunhadosNoCiclo;

  const diag = M.diagnostico({
    ciclo, emitidoNoCiclo: emitido, queimadoNoCiclo: queimado,
    suprimentoEter, nftsCunhados: nftsTotal
  }, P);

  linhas.push({
    ciclo,
    especiesDescendo: descendo.length,
    emitido, queimado,
    razao: diag.razaoQueima,
    fatorPol,
    suprimento: suprimentoEter,
    cunhados: cunhadosNoCiclo,
    reprimido: reprimidoNoCiclo,
    veredito: diag.veredito
  });
  void arremessosNoCiclo;

  /* a política do próximo ciclo reage ao que aconteceu neste */
  fatorPol = M.fatorPolitica(queimado, emitido, P);
}

/* ------------------------------- relatório ----------------------------- */
const fmt = n => {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toFixed(1);
};

console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║  ÂNIMOS — simulação econômica (fora da cadeia, nada implantado)      ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝');
console.log(`\nJogadores: ${N_JOGADORES.toLocaleString('pt-BR')}   Ciclos de Orva: ${N_CICLOS}   (~${(N_CICLOS * 29.5 / 365).toFixed(1)} anos)`);
console.log(`Custo médio de um cuidado: ${CUSTO_MEDIO_CUIDADO.toFixed(2)} ETR\n`);

console.log('ciclo  desc  emitido    queimado   razão  fatorPol  circulação  cunhados  reprimido  veredito');
console.log('─────  ────  ─────────  ─────────  ─────  ────────  ──────────  ────────  ─────────  ──────────────');
linhas.forEach(l => {
  if (!DETALHE && l.ciclo % Math.max(1, Math.floor(N_CICLOS / 12)) !== 0 && l.ciclo !== N_CICLOS - 1) return;
  console.log(
    String(l.ciclo).padStart(5) + '  ' +
    String(l.especiesDescendo).padStart(4) + '  ' +
    fmt(l.emitido).padStart(9) + '  ' +
    fmt(l.queimado).padStart(9) + '  ' +
    l.razao.toFixed(2).padStart(5) + '  ' +
    l.fatorPol.toFixed(2).padStart(8) + '  ' +
    fmt(l.suprimento).padStart(10) + '  ' +
    fmt(l.cunhados).padStart(8) + '  ' +
    fmt(l.reprimido).padStart(9) + '  ' +
    l.veredito);
});

const suprimentoFinal = suprimentoTotal();
console.log('\n── Totais ──────────────────────────────────────────────────────────────────');
console.log(`ETR emitido .......... ${fmt(emitidoTotal)}`);
console.log(`ETR queimado ......... ${fmt(queimadoTotal)}  (${(queimadoTotal / emitidoTotal * 100).toFixed(1)}% do emitido)`);
console.log(`ETR em circulação .... ${fmt(suprimentoFinal)}`);
console.log(`Demanda reprimida .... ${fmt(reprimidoTotal)}  (${(reprimidoTotal / emitidoTotal * 100).toFixed(0)}% do emitido)`);
console.log('   ↑ o que os jogadores quiseram gastar e não tinham saldo. Em produção isso');
console.log('     vira ou compra de token no mercado, ou jogador que simplesmente joga menos.');
console.log(`AMB queimado ......... ${fmt(ambarQueimado)}`);
console.log(`AMB em tesouraria .... ${fmt(ambarEmTesouraria)}`);
console.log(`NFTs cunhados ........ ${fmt(nftsTotal)}`);

const tetoAmbarRecompensa = P.tokens.ambar.suprimentoMaximo * P.tokens.ambar.distribuicaoGenese.recompensasDeJogo;
console.log(`\nAMB gasto pelos jogadores vs. fatia de recompensas (${fmt(tetoAmbarRecompensa)}): ` +
  `${((ambarQueimado + ambarEmTesouraria) / tetoAmbarRecompensa * 100).toFixed(1)}%`);

console.log('\n── Saturação por espécie (10 mais saturadas) ───────────────────────────────');
const satOrdenada = especies
  .map(e => ({ nome: e.nome, cap: e.cap, oferta: oferta[e.id], meta: meta[e.id], sat: oferta[e.id] / meta[e.id] }))
  .sort((a, b) => b.sat - a.sat)
  .slice(0, 10);
satOrdenada.forEach(s => {
  const barra = '█'.repeat(Math.min(28, Math.round(s.sat * 14)));
  console.log(
    s.nome.padEnd(12) + ' cap ' + String(s.cap).padStart(3) +
    '  ' + String(s.oferta).padStart(8) + ' / ' + String(s.meta).padStart(7) +
    '  ×' + s.sat.toFixed(2).padStart(5) + '  ' + barra);
});

console.log('\n── Espécies mais escassas ──────────────────────────────────────────────────');
especies
  .map(e => ({ nome: e.nome, cap: e.cap, oferta: oferta[e.id], meta: meta[e.id] }))
  .sort((a, b) => a.oferta - b.oferta)
  .slice(0, 5)
  .forEach(s => console.log(
    s.nome.padEnd(12) + ' cap ' + String(s.cap).padStart(3) +
    '  existem ' + String(s.oferta).padStart(7) + '  (meta ' + s.meta + ')'));

/* ----------------------------- veredito final -------------------------- */
const razaoFinal = queimadoTotal / emitidoTotal;
const ultimos = linhas.slice(-Math.max(3, Math.floor(N_CICLOS / 4)));
const razaoRecente = ultimos.reduce((s, l) => s + l.razao, 0) / ultimos.length;

console.log('\n── Veredito ────────────────────────────────────────────────────────────────');
let problemas = 0;
function checar(ok, textoOk, textoRuim) {
  console.log((ok ? '  ok    ' : '  ALERTA') + '  ' + (ok ? textoOk : textoRuim));
  if (!ok) problemas++;
}
checar(razaoFinal > 0.75, `razão de queima acumulada saudável (${razaoFinal.toFixed(2)})`,
  `queima acumulada baixa demais (${razaoFinal.toFixed(2)}) — inflação de ETR`);
checar(suprimentoFinal >= 0,
  'circulação nunca ficou negativa',
  'circulação negativa — o modelo está queimando token que não existe');
checar(suprimentoFinal < emitidoTotal * 0.55,
  `circulação contida em ${(suprimentoFinal / emitidoTotal * 100).toFixed(0)}% do emitido`,
  `circulação alta demais (${(suprimentoFinal / emitidoTotal * 100).toFixed(0)}% do emitido)`);
checar(reprimidoTotal < emitidoTotal * 0.30,
  `demanda reprimida sob controle (${(reprimidoTotal / emitidoTotal * 100).toFixed(0)}% do emitido)`,
  `demanda reprimida alta (${(reprimidoTotal / emitidoTotal * 100).toFixed(0)}% do emitido) — jogar não paga o custo de jogar`);
checar(razaoRecente > 0.6, `política estabilizou nos últimos ciclos (razão ${razaoRecente.toFixed(2)})`,
  `política não estabilizou (razão recente ${razaoRecente.toFixed(2)})`);
checar(satOrdenada[0].sat < 3.05, `nenhuma espécie estourou o teto de oferta (máx ×${satOrdenada[0].sat.toFixed(2)})`,
  `espécie no teto absoluto: ${satOrdenada[0].nome} ×${satOrdenada[0].sat.toFixed(2)}`);
checar((ambarQueimado + ambarEmTesouraria) < tetoAmbarRecompensa * 3,
  'consumo de Âmbar compatível com a gênese',
  'consumo de Âmbar excede o que a gênese suporta — rever custos em AMB');

console.log(problemas === 0
  ? '\n>>> Economia estável com estes parâmetros.\n'
  : `\n>>> ${problemas} ponto(s) a calibrar em economia/parametros.json.\n`);

process.exit(0);
