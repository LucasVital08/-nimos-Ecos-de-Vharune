/* =========================================================================
   ui/telas.js — Equipe, bestiário, mochila, loja, santuário e opções
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var E = G.Estado;
  var C = G.Criatura;
  var UI = G.UI;
  var T = G.Telas = {};

  var ROTULOS = {
    hp: 'Vigor (HP)', atk: 'Ataque', def: 'Defesa',
    atkEsp: 'Atq. Especial', defEsp: 'Def. Especial', vel: 'Velocidade'
  };

  /* ==================================================================== */
  /*  MENU PRINCIPAL                                                      */
  /* ==================================================================== */
  T.menuPrincipal = function () {
    UI.abrirPainel({
      titulo: 'Menu',
      abas: [{
        id: 'menu',
        nome: 'Menu',
        render: function (corpo) {
          var grade = G.criar('div', 'grade-menu');
          var itens = [
            { n: 'Equipe', d: 'Atributos, técnicas, líder e cuidado', f: T.equipe, tecla: 'P' },
            { n: 'Mapa de Vharune', d: 'Todas as regiões e por onde se liga', f: T.mapaMundi, tecla: 'T' },
            { n: 'Bestiário', d: 'Ânimos vistos e capturados', f: T.bestiario, tecla: 'B' },
            { n: 'Mochila', d: 'Selos, elixires, alimentos e cuidado', f: T.mochila, tecla: 'I' },
            { n: 'Vinculista', d: 'Seu progresso em Vharune', f: T.perfil, tecla: '' },
            { n: 'Vínculo Étereo', d: 'Carteira Web3 opcional (sem transações)', f: T.web3, tecla: '' },
            { n: 'Opções', d: 'Salvar, exportar e recomeçar', f: T.opcoes, tecla: '' }
          ];
          itens.forEach(function (it) {
            var b = G.criar('button', 'item-menu');
            b.appendChild(G.criar('strong', null, it.n));
            b.appendChild(G.criar('small', null, it.d));
            if (it.tecla) b.appendChild(G.criar('kbd', null, it.tecla));
            b.addEventListener('click', it.f);
            grade.appendChild(b);
          });
          corpo.appendChild(grade);
        }
      }]
    });
  };

  /* ==================================================================== */
  /*  EQUIPE                                                              */
  /* ==================================================================== */
  T.equipe = function (aba) {
    UI.abrirPainel({
      titulo: 'Equipe de vínculo',
      aba: aba || 'equipe',
      abas: [
        { id: 'equipe', nome: 'Equipe (' + E.s.equipe.length + '/6)', render: renderEquipe },
        { id: 'reserva', nome: 'Santuário (' + E.s.reserva.length + ')', render: renderReserva }
      ]
    });
  };

  function renderEquipe(corpo, rodape) {
    if (!E.s.equipe.length) {
      corpo.appendChild(G.criar('p', 'vazio', 'Sua equipe está vazia.'));
      return;
    }
    var aviso = G.criar('p', 'mini', 'O primeiro da lista é o LÍDER: é ele quem entra em combate. Toque em um Ânimo para agir sobre ele.');
    aviso.style.marginBottom = '12px';
    corpo.appendChild(aviso);

    var grade = G.criar('div', 'grade-equipe');
    E.s.equipe.forEach(function (c, i) {
      grade.appendChild(UI.cartaoCriatura(c, {
        lider: i === 0,
        aoClicar: function () { acoesCriatura(c, i); }
      }));
    });
    corpo.appendChild(grade);

    var b1 = G.criar('button', 'btn btn-peq', 'Curar equipe no acampamento');
    b1.addEventListener('click', function () {
      UI.escolher('Acampar?', 'Descansar aqui gasta 1 Ração Étera por Ânimo ferido e recupera parte do vigor.', [
        { rotulo: 'Cancelar', classe: 'btn-fantasma' },
        { rotulo: 'Acampar', classe: 'btn-primario', acao: acampar }
      ]);
    });
    rodape.appendChild(b1);
  }

  function acampar() {
    var feridos = E.s.equipe.filter(function (c) { return c.hpAtual < C.atributos(c).hp || c.status; });
    if (!feridos.length) { UI.toast('Todos já estão em plena forma.', 'ok'); return; }
    var custo = feridos.length;
    if ((E.s.mochila.racao_etera || 0) < custo) {
      UI.toast('Faltam Rações Éteras (precisa de ' + custo + ').', 'aviso');
      return;
    }
    E.gastarItem('racao_etera', custo);
    feridos.forEach(function (c) {
      C.curar(c, Math.floor(C.atributos(c).hp * 0.45));
      c.saciedade = U.clamp(c.saciedade + 55, 0, 100);
      c.energia = U.clamp(c.energia + 30, 0, 100);
      c.status = null;
    });
    UI.toast('A equipe descansou.', 'ok');
    E.autoSalvar();
    UI.recarregarPainel();
    UI.atualizarHUD();
  }

  function renderReserva(corpo) {
    var p = G.criar('p', 'mini', 'Ânimos além dos 6 ficam no Santuário. Eles não perdem energia nem passam fome aqui.');
    p.style.marginBottom = '12px';
    corpo.appendChild(p);
    if (!E.s.reserva.length) {
      corpo.appendChild(G.criar('p', 'vazio', 'O Santuário está vazio.\nCapture mais Ânimos e eles aparecerão aqui.'));
      return;
    }
    var grade = G.criar('div', 'grade-equipe');
    E.s.reserva.forEach(function (c) {
      grade.appendChild(UI.cartaoCriatura(c, {
        aoClicar: function () {
          UI.escolher(C.nome(c), 'Nv ' + c.nivel + ' · ' + C.marcaIndividual(c), [
            { rotulo: 'Ver detalhes', acao: function () { T.detalhe(c, 'reserva'); } },
            {
              rotulo: 'Levar na equipe', classe: 'btn-primario', acao: function () {
                if (E.trazerDaReserva(c.uid)) { UI.toast(C.nome(c) + ' entrou na equipe.', 'ok'); E.autoSalvar(); T.equipe('reserva'); }
                else UI.toast('A equipe já tem 6 Ânimos.', 'aviso');
              }
            },
            { rotulo: 'Voltar', classe: 'btn-fantasma' }
          ]);
        }
      }));
    });
    corpo.appendChild(grade);
  }

  function acoesCriatura(c, indice) {
    var ops = [
      { rotulo: 'Ver detalhes', acao: function () { T.detalhe(c, 'equipe'); } },
      { rotulo: 'Cuidar', classe: 'btn-primario', acao: function () { T.cuidar(c); } }
    ];
    if (indice > 0) {
      ops.push({
        rotulo: 'Tornar líder', acao: function () {
          E.definirLider(c.uid);
          UI.toast(C.nome(c) + ' agora lidera a equipe.', 'ambar');
          E.autoSalvar(); T.equipe('equipe'); UI.atualizarHUD();
        }
      });
      ops.push({
        rotulo: 'Subir na ordem', acao: function () {
          E.moverNaEquipe(c.uid, -1); E.autoSalvar(); T.equipe('equipe');
        }
      });
    }
    if (indice < E.s.equipe.length - 1) {
      ops.push({
        rotulo: 'Descer na ordem', acao: function () {
          E.moverNaEquipe(c.uid, 1); E.autoSalvar(); T.equipe('equipe');
        }
      });
    }
    if (E.s.equipe.length > 1) {
      ops.push({
        rotulo: 'Enviar ao Santuário', classe: 'btn-fantasma', acao: function () {
          E.enviarParaReserva(c.uid); E.autoSalvar(); T.equipe('equipe'); UI.atualizarHUD();
        }
      });
    }
    ops.push({ rotulo: 'Fechar', classe: 'btn-fantasma' });
    UI.escolher(C.nome(c), 'Nv ' + c.nivel + ' · ' + C.marcaIndividual(c), ops);
  }

  /* ==================================================================== */
  /*  DETALHE DA CRIATURA                                                 */
  /* ==================================================================== */
  T.detalhe = function (c, voltarPara) {
    UI.abrirPainel({
      titulo: C.nome(c),
      abas: [
        { id: 'geral', nome: 'Visão geral', render: function (corpo, rod) { detGeral(c, corpo, rod, voltarPara); } },
        { id: 'tecnicas', nome: 'Técnicas', render: function (corpo) { detTecnicas(c, corpo); } },
        { id: 'ficha', nome: 'Ficha', render: function (corpo) { detFicha(c, corpo); } }
      ]
    });
  };

  function blocoArte(c) {
    var esp = G.especie(c.esp);
    var arte = G.criar('div', 'det-arte');
    arte.appendChild(UI.imgCriatura(c, 210));
    arte.appendChild(G.criar('div', 'det-nome', C.nome(c)));
    arte.appendChild(G.criar('div', 'det-cat', 'Nº' + U.pad(esp.num, 3) + ' · ' + esp.categoria));
    var tipos = G.criar('div', 'det-tipos');
    esp.tipos.forEach(function (t) { tipos.appendChild(UI.chipTipo(t)); });
    arte.appendChild(tipos);
    if (c.prismatico) {
      var pr = G.criar('div');
      pr.appendChild(G.criar('span', 'tag tag-prisma', 'PRISMÁTICO'));
      arte.appendChild(pr);
    }
    arte.appendChild(G.criar('div', 'det-marca', 'Marca individual: ' + C.marcaIndividual(c)));
    return arte;
  }

  function detGeral(c, corpo, rodape, voltarPara) {
    var esp = G.especie(c.esp);
    var at = C.atributos(c);
    var nat = C.natureza(c);

    var grade = G.criar('div', 'detalhe');
    grade.appendChild(blocoArte(c));

    var col = G.criar('div');

    /* vigor */
    var s1 = G.criar('div', 'det-secao');
    s1.appendChild(G.criar('h4', null, 'Condição'));
    var linhaHP = G.criar('div', 'atr');
    linhaHP.appendChild(G.criar('span', 'atr-nome', 'Vigor'));
    linhaHP.appendChild(G.criar('b', null, Math.ceil(c.hpAtual) + '/' + at.hp));
    linhaHP.appendChild(UI.barra(C.fracaoHP(c)));
    s1.appendChild(linhaHP);

    var tags = G.criar('div');
    tags.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:9px';
    if (c.status) {
      var st = G.criar('span', 'tag tag-status', G.CONDICOES[c.status].nome);
      st.style.borderColor = G.CONDICOES[c.status].cor;
      st.title = G.CONDICOES[c.status].desc;
      tags.appendChild(st);
    }
    C.estadoCuidado(c).forEach(function (e2) {
      var t = G.criar('span', 'tag', e2.t);
      t.style.background = e2.cor;
      tags.appendChild(t);
    });
    s1.appendChild(tags);

    var cuid = G.criar('div', 'cartao-cuidado');
    cuid.style.marginTop = '12px';
    [['energia', 'Energia', c.energia], ['fome', 'Saciedade', c.saciedade], ['vinculo', 'Vínculo', c.vinculo]]
      .forEach(function (m) {
        var d = G.criar('div', 'medidor ' + m[0]);
        d.appendChild(G.criar('span', null, m[1] + ' ' + Math.round(m[2]) + '%'));
        var b = G.criar('div', 'barra');
        var i = G.criar('i'); i.style.width = U.clamp(m[2], 0, 100) + '%';
        b.appendChild(i); d.appendChild(b); cuid.appendChild(d);
      });
    s1.appendChild(cuid);
    col.appendChild(s1);

    /* atributos */
    var s2 = G.criar('div', 'det-secao');
    s2.appendChild(G.criar('h4', null, 'Atributos'));
    var box = G.criar('div', 'atributos');
    ['hp', 'atk', 'def', 'atkEsp', 'defEsp', 'vel'].forEach(function (k) {
      var l = G.criar('div', 'atr' + (nat.sobe === k ? ' sobe' : (nat.desce === k ? ' desce' : '')));
      var nome = ROTULOS[k] + (nat.sobe === k ? ' ▲' : (nat.desce === k ? ' ▼' : ''));
      l.appendChild(G.criar('span', 'atr-nome', nome));
      l.appendChild(G.criar('b', null, String(at[k])));
      var frac = U.clamp(at[k] / (k === 'hp' ? 340 : 220), 0.04, 1);
      var b = G.criar('div', 'barra');
      var i = G.criar('i');
      i.style.width = (frac * 100).toFixed(0) + '%';
      i.style.background = 'linear-gradient(180deg,#c9a6ff,#7d5fd0)';
      b.appendChild(i); l.appendChild(b);
      box.appendChild(l);
    });
    s2.appendChild(box);
    col.appendChild(s2);

    /* xp */
    var s3 = G.criar('div', 'det-secao');
    s3.appendChild(G.criar('h4', null, 'Progresso'));
    var info = G.criar('div', 'linhas-info');
    info.appendChild(linha('Nível', String(c.nivel)));
    info.appendChild(linha('Experiência total', c.xp.toLocaleString('pt-BR')));
    if (c.nivel < C.NIVEL_MAX) {
      info.appendChild(linha('Falta para o próximo nível',
        (C.xpTotalPara(c.nivel + 1) - c.xp).toLocaleString('pt-BR') + ' XP'));
    }
    s3.appendChild(info);
    s3.appendChild(UI.barra(C.progressoNivel(c), 'barra-xp'));
    col.appendChild(s3);

    grade.appendChild(col);
    corpo.appendChild(grade);

    /* rodapé */
    var bCuidar = G.criar('button', 'btn btn-primario btn-peq', 'Cuidar');
    bCuidar.addEventListener('click', function () { T.cuidar(c); });
    rodape.appendChild(bCuidar);

    var bNome = G.criar('button', 'btn btn-peq', 'Dar apelido');
    bNome.addEventListener('click', function () { apelidar(c); });
    rodape.appendChild(bNome);

    if (C.podeEvoluir(c)) {
      var bEvo = G.criar('button', 'btn btn-peq', 'Evoluir agora');
      bEvo.style.borderColor = 'var(--ambar)';
      bEvo.addEventListener('click', function () {
        var r = C.evoluir(c);
        UI.toast(r.de + ' evoluiu para ' + r.para + '!', 'ambar', 3400);
        E.registrarVisto(c.esp); E.registrarCaptura(c.esp);
        E.autoSalvar();
        T.detalhe(c, voltarPara);
      });
      rodape.appendChild(bEvo);
    }

    rodape.appendChild(G.criar('span', 'espaco'));
    var bVoltar = G.criar('button', 'btn btn-fantasma btn-peq', 'Voltar à equipe');
    bVoltar.addEventListener('click', function () { T.equipe(voltarPara); });
    rodape.appendChild(bVoltar);
  }

  function linha(rot, val) {
    var l = G.criar('div', 'linha-info');
    l.appendChild(G.criar('span', null, rot));
    l.appendChild(G.criar('b', null, val));
    return l;
  }

  function apelidar(c) {
    var atual = c.apelido || '';
    var nome = window.prompt('Apelido para ' + G.especie(c.esp).nome + ' (deixe vazio para usar o nome da espécie):', atual);
    if (nome === null) return;
    nome = nome.trim().slice(0, 14);
    c.apelido = nome || null;
    c.vinculo = U.clamp(c.vinculo + 2, 0, 100);
    E.autoSalvar();
    UI.toast('Nome registrado.', 'ok');
    T.detalhe(c);
  }

  function detTecnicas(c, corpo) {
    var esp = G.especie(c.esp);
    var s = G.criar('div', 'det-secao');
    s.appendChild(G.criar('h4', null, 'Técnicas conhecidas (' + c.tecnicas.length + '/4)'));
    var box = G.criar('div', 'tecnicas');
    c.tecnicas.forEach(function (slot) {
      var t = G.tecnica(slot.id);
      var d = G.criar('div', 'tec');
      d.appendChild(UI.chipTipo(t.tipo));
      d.appendChild(G.criar('span', 'tec-nome', t.nome));
      var cat = G.criar('span', 'tag');
      cat.textContent = t.cat === 'fisico' ? 'Físico' : (t.cat === 'especial' ? 'Especial' : 'Apoio');
      cat.style.background = t.cat === 'fisico' ? '#c2703f' : (t.cat === 'especial' ? '#5f8fd0' : '#6f7f9a');
      d.appendChild(cat);
      d.appendChild(G.criar('span', 'tec-num',
        (t.pot ? 'Pot ' + t.pot + ' · ' : '') + 'Prec ' + (t.prec === null ? '—' : t.prec) + ' · ' + slot.pp + '/' + slot.ppMax));
      d.appendChild(G.criar('p', 'tec-desc', t.desc));
      box.appendChild(d);
    });
    s.appendChild(box);
    corpo.appendChild(s);

    /* aprendizado futuro */
    var futuras = esp.apr.filter(function (p) {
      return p[0] > c.nivel;
    });
    if (futuras.length) {
      var s2 = G.criar('div', 'det-secao');
      s2.appendChild(G.criar('h4', null, 'Ainda por aprender'));
      var info = G.criar('div', 'linhas-info');
      futuras.forEach(function (p) {
        var t = G.tecnica(p[1]);
        if (t) info.appendChild(linha('Nv ' + p[0], t.nome + ' (' + G.nomeTipo(t.tipo) + ')'));
      });
      s2.appendChild(info);
      corpo.appendChild(s2);
    }

    /* substituição de técnica */
    var conhecidas = {};
    c.tecnicas.forEach(function (s3) { conhecidas[s3.id] = true; });
    var disponiveis = esp.apr.filter(function (p) { return p[0] <= c.nivel && !conhecidas[p[1]]; });
    if (disponiveis.length && c.tecnicas.length) {
      var s4 = G.criar('div', 'det-secao');
      s4.appendChild(G.criar('h4', null, 'Reensinar'));
      s4.appendChild(G.criar('p', 'mini', 'Um Ânimo carrega no máximo 4 técnicas. Escolha uma antiga para substituir.'));
      var box2 = G.criar('div', 'tecnicas');
      disponiveis.forEach(function (p) {
        var t = G.tecnica(p[1]);
        if (!t) return;
        var d = G.criar('div', 'tec');
        d.appendChild(UI.chipTipo(t.tipo));
        d.appendChild(G.criar('span', 'tec-nome', t.nome));
        var b = G.criar('button', 'btn btn-peq', 'Ensinar');
        b.addEventListener('click', function () {
          var ops = c.tecnicas.map(function (slot, i) {
            return {
              rotulo: 'Esquecer ' + G.tecnica(slot.id).nome,
              acao: function () {
                C.trocarTecnica(c, i, t.id);
                UI.toast(C.nome(c) + ' aprendeu ' + t.nome + '.', 'ok');
                E.autoSalvar();
                T.detalhe(c);
              }
            };
          });
          ops.push({ rotulo: 'Cancelar', classe: 'btn-fantasma' });
          UI.escolher('Ensinar ' + t.nome, 'Qual técnica deve ser esquecida?', ops);
        });
        d.appendChild(b);
        box2.appendChild(d);
      });
      s4.appendChild(box2);
      corpo.appendChild(s4);
    }
  }

  function detFicha(c, corpo) {
    var esp = G.especie(c.esp);
    var nat = C.natureza(c);
    var av = C.avaliacao(c);

    var s = G.criar('div', 'det-secao');
    s.appendChild(G.criar('h4', null, 'Sobre a espécie'));
    var p = G.criar('p', 'carta-desc', esp.desc);
    p.style.lineHeight = '1.75';
    s.appendChild(p);
    corpo.appendChild(s);

    var s2 = G.criar('div', 'det-secao');
    s2.appendChild(G.criar('h4', null, 'Identidade individual'));
    var info = G.criar('div', 'linhas-info');
    info.appendChild(linha('Natureza', nat.nome + (nat.sobe ? ' (+' + ROTULOS[nat.sobe] + ' / −' + ROTULOS[nat.desce] + ')' : ' (equilibrada)')));
    var av2 = G.criar('div', 'linha-info');
    av2.appendChild(G.criar('span', null, 'Potencial oculto'));
    var bav = G.criar('b', null, av.t);
    bav.style.color = av.cor;
    av2.appendChild(bav);
    info.appendChild(av2);
    info.appendChild(linha('Melhor aptidão', C.melhorAtributo(c)));
    info.appendChild(linha('Padrão', C.padraoNome(c)));
    info.appendChild(linha('Porte', C.porteNome(c) + ' (' + (c.porte * 100).toFixed(0) + '%)'));
    info.appendChild(linha('Desvio de matiz', (c.matiz > 0 ? '+' : '') + c.matiz + '°'));
    info.appendChild(linha('Prismático', c.prismatico ? 'Sim — 1 em ~480' : 'Não'));
    info.appendChild(linha('Semente visual', '#' + (c.seed >>> 0).toString(16).toUpperCase()));
    s2.appendChild(info);
    corpo.appendChild(s2);

    var s3 = G.criar('div', 'det-secao');
    s3.appendChild(G.criar('h4', null, 'Registro'));
    var info2 = G.criar('div', 'linhas-info');
    info2.appendChild(linha('Altura', esp.altura.toFixed(1) + ' m'));
    info2.appendChild(linha('Peso', esp.peso > 0 ? esp.peso.toFixed(1) + ' kg' : 'imponderável'));
    info2.appendChild(linha('Onde foi encontrado', c.capturadoEm || 'Ateliê da Mestra Oriel'));
    info2.appendChild(linha('Nível de encontro', 'Nv ' + (c.capturadoNivel || c.nivel)));
    if (esp.evo) {
      var alvo = G.especie(esp.evo.para);
      info2.appendChild(linha('Evolução', alvo.nome + ' a partir do Nv ' + esp.evo.nivel));
    } else {
      info2.appendChild(linha('Evolução', 'Forma final'));
    }
    s3.appendChild(info2);
    corpo.appendChild(s3);

    /* fraquezas */
    var s4 = G.criar('div', 'det-secao');
    s4.appendChild(G.criar('h4', null, 'Resistências e fraquezas'));
    var lista = G.criar('div');
    lista.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    G.LISTA_TIPOS.forEach(function (t) {
      var m = G.multiplicadorTipo(t, esp.tipos);
      if (m === 1) return;
      var chip = UI.chipTipo(t);
      chip.textContent = G.nomeTipo(t) + ' ×' + (m === 0.25 ? '¼' : (m === 0.5 ? '½' : m));
      chip.style.opacity = m > 1 ? '1' : '.62';
      chip.style.outline = m > 1 ? '2px solid rgba(226,101,58,.8)' : 'none';
      lista.appendChild(chip);
    });
    s4.appendChild(lista);
    s4.appendChild(G.criar('p', 'mini', 'Multiplicador de dano recebido por aspecto do éter.'));
    corpo.appendChild(s4);
  }

  /* ==================================================================== */
  /*  CUIDADO                                                             */
  /* ==================================================================== */
  T.cuidar = function (c) {
    UI.abrirPainel({
      titulo: 'Cuidar de ' + C.nome(c),
      abas: [{
        id: 'cuidar',
        nome: 'Cuidar',
        render: function (corpo, rodape) {
          var topo = G.criar('div', 'detalhe');
          topo.appendChild(blocoArte(c));

          var col = G.criar('div');
          var s = G.criar('div', 'det-secao');
          s.appendChild(G.criar('h4', null, 'Estado atual'));
          var cuid = G.criar('div');
          [['energia', 'Energia', c.energia, 'Cai com passos e turnos de combate. Baixa demais reduz dano e velocidade.'],
           ['fome', 'Saciedade', c.saciedade, 'Cai com o tempo. Faminto, o Ânimo perde vínculo aos poucos.'],
           ['vinculo', 'Vínculo', c.vinculo, 'Sobe com cuidado e vitórias. Alto, aumenta dano, crítico e XP.']]
            .forEach(function (m) {
              var d = G.criar('div', 'medidor ' + m[0]);
              d.style.marginBottom = '12px';
              d.appendChild(G.criar('span', null, m[1] + ' — ' + Math.round(m[2]) + '%'));
              var b = G.criar('div', 'barra');
              var i = G.criar('i'); i.style.width = U.clamp(m[2], 0, 100) + '%';
              b.appendChild(i); d.appendChild(b);
              d.appendChild(G.criar('p', 'mini', m[3]));
              cuid.appendChild(d);
            });
          s.appendChild(cuid);
          col.appendChild(s);
          topo.appendChild(col);
          corpo.appendChild(topo);

          var itens = E.itensDaCategoria('comida').concat(E.itensDaCategoria('cuidado'));
          var s2 = G.criar('div', 'det-secao');
          s2.appendChild(G.criar('h4', null, 'Alimentos e cuidados na mochila'));
          if (!itens.length) {
            s2.appendChild(G.criar('p', 'vazio', 'Nenhum alimento ou item de cuidado.\nCompre no Empório Âmbar em Cinzalva.'));
          } else {
            var lista = G.criar('div', 'lista-itens');
            itens.forEach(function (par) {
              lista.appendChild(linhaItem(par.item, par.qtd, function () {
                usarItemEmCriatura(par.item, c, function () { T.cuidar(c); });
              }));
            });
            s2.appendChild(lista);
          }
          corpo.appendChild(s2);

          var v = G.criar('button', 'btn btn-fantasma btn-peq', 'Voltar');
          v.addEventListener('click', function () { T.detalhe(c); });
          rodape.appendChild(v);
        }
      }]
    });
  };

  function usarItemEmCriatura(item, c, aoFim) {
    var antes = { hp: c.hpAtual, v: c.vinculo, e: c.energia, f: c.saciedade };
    if (item.cat === 'cura') {
      if (item.reviver) {
        if (c.hpAtual > 0) { UI.toast(C.nome(c) + ' não está desmaiado.', 'aviso'); return; }
        c.hpAtual = Math.max(1, Math.floor(C.atributos(c).hp * item.reviver));
      } else if (item.cura) {
        if (c.hpAtual <= 0) { UI.toast('Use uma Semente da Alvorada primeiro.', 'aviso'); return; }
        if (c.hpAtual >= C.atributos(c).hp) { UI.toast(C.nome(c) + ' já está em plena forma.', 'aviso'); return; }
        C.curar(c, item.cura);
      }
      if (item.curaStatus) {
        if (!c.status && !item.cura && !item.reviver) { UI.toast('Nenhuma condição adversa para tratar.', 'aviso'); return; }
        if (item.curaStatus === 'todos' || item.curaStatus === c.status) { c.status = null; c.statusTurnos = 0; }
      }
    } else {
      if (item.cat === 'comida' && c.saciedade >= 100 && !item.cura) {
        UI.toast(C.nome(c) + ' está saciado demais para comer.', 'aviso');
        return;
      }
      if (item.cat === 'cuidado' && item.vinculo && c.vinculo >= 100 && !item.energia) {
        UI.toast('O vínculo já está no máximo.', 'aviso');
        return;
      }
      C.alimentar(c, item);
    }

    if (!item.reutilizavel) E.gastarItem(item.id, 1);

    var ganhos = [];
    if (c.hpAtual - antes.hp >= 1) ganhos.push('+' + Math.round(c.hpAtual - antes.hp) + ' vigor');
    if (c.saciedade - antes.f >= 1) ganhos.push('+' + Math.round(c.saciedade - antes.f) + ' saciedade');
    if (c.energia - antes.e >= 1) ganhos.push('+' + Math.round(c.energia - antes.e) + ' energia');
    if (c.vinculo - antes.v >= 1) ganhos.push('+' + Math.round(c.vinculo - antes.v) + ' vínculo');
    UI.toast(C.nome(c) + ': ' + (ganhos.join(', ') || 'nada mudou'), 'ok');

    E.autoSalvar();
    UI.atualizarHUD();
    if (aoFim) aoFim();
  }
  T.usarItemEmCriatura = usarItemEmCriatura;

  /* ==================================================================== */
  /*  BESTIÁRIO                                                           */
  /* ==================================================================== */

  /* ==================================================================== */
  /*  MAPA DE VHARUNE                                                     */
  /* ==================================================================== */

  /* Posição de cada região na rosa dos ventos, tirada das saídas reais dos
     mapas: Cinzalva ao norte do Campo de Névoa, Bosque a oeste, Passo a
     leste, Lago ao sul, e Aldherin depois do Passo. */
  var GRADE_MUNDO = [
    { id: 'cinzalva',        col: 1, lin: 0 },
    { id: 'bosque_solene',   col: 0, lin: 1 },
    { id: 'campo_nevoa',     col: 1, lin: 1 },
    { id: 'passo_ferrugem',  col: 2, lin: 1 },
    { id: 'lago_miravel',    col: 1, lin: 2 },
    { id: 'ruinas_aldherin', col: 2, lin: 2 }
  ];

  /* Cor de cada tile na miniatura. O mapa pequeno é o mapa de verdade,
     reduzido — não um desenho à parte que sairia do lugar. */
  var COR_MINI = {
    '.': '#4a8c46', ',': '#3d7a3a', 'F': '#5c9c50',
    '-': '#8a6d43', '=': '#8b8697', 's': '#c8b083',
    '~': '#2f6ea8', 'w': '#4d92c4', 'W': '#6fb0da',
    'T': '#2c5c2e', 'Y': '#356b34', 'n': '#6b5535',
    'R': '#77737f', 'M': '#5d5a67',
    '#': '#9a8f83', 'B': '#b4675e', 'b': '#7d4a52', 'D': '#6b4a2c',
    'P': '#8878b0', 't': '#6b5f8a', ':': '#7a68a8', 'x': '#6fe0d0',
    'p': '#9c7645', 'G': '#a08050', 'f': '#8a7550', 'L': '#77707f',
    'c': '#8a6a45', '_': '#14121c'
  };

  function miniaturaMapa(mapa, larguraAlvo) {
    var esc = Math.max(2, Math.round(larguraAlvo / mapa.grade[0].length));
    var cv = document.createElement('canvas');
    cv.width = mapa.grade[0].length * esc;
    cv.height = mapa.grade.length * esc;
    var c = cv.getContext('2d');
    for (var y = 0; y < mapa.grade.length; y++) {
      var linha = mapa.grade[y];
      for (var x = 0; x < linha.length; x++) {
        c.fillStyle = COR_MINI[linha[x]] || '#3f7a3d';
        c.fillRect(x * esc, y * esc, esc, esc);
      }
    }
    return cv;
  }

  T.mapaMundi = function () {
    UI.abrirPainel({
      titulo: 'Mapa de Vharune',
      abas: [{
        id: 'mapa',
        nome: 'Mapa',
        render: function (corpo) {
          var atual = E.s.jogador.mapa;
          var vistos = E.s.regioes || {};

          var nota = G.criar('p', 'mapa-nota',
            'Regiões que você ainda não pisou aparecem apagadas. ' +
            'As linhas mostram por onde dá para passar.');
          corpo.appendChild(nota);

          var tabuleiro = G.criar('div', 'mapa-tabuleiro');

          /* ligações desenhadas atrás das cartas */
          var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'mapa-linhas');
          svg.setAttribute('viewBox', '0 0 300 300');
          svg.setAttribute('preserveAspectRatio', 'none');
          var ligacoes = [
            [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 2, 1], [1, 1, 1, 2], [2, 1, 2, 2]
          ];
          ligacoes.forEach(function (l) {
            var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            ln.setAttribute('x1', l[0] * 100 + 50); ln.setAttribute('y1', l[1] * 100 + 50);
            ln.setAttribute('x2', l[2] * 100 + 50); ln.setAttribute('y2', l[3] * 100 + 50);
            svg.appendChild(ln);
          });
          tabuleiro.appendChild(svg);

          GRADE_MUNDO.forEach(function (g) {
            var mapa = G.mapa(g.id);
            if (!mapa) return;
            var visto = !!vistos[g.id];
            var aqui = g.id === atual;

            var carta = G.criar('button', 'mapa-regiao' +
              (aqui ? ' aqui' : '') + (visto ? '' : ' desconhecida'));
            carta.style.gridColumn = (g.col + 1);
            carta.style.gridRow = (g.lin + 1);

            var moldura = G.criar('div', 'mapa-mini');
            if (visto) {
              moldura.appendChild(miniaturaMapa(mapa, 132));
            } else {
              moldura.appendChild(G.criar('span', 'mapa-interrog', '?'));
            }
            carta.appendChild(moldura);

            carta.appendChild(G.criar('strong', null, visto ? mapa.nome : 'Região desconhecida'));
            carta.appendChild(G.criar('small', null, aqui ? 'Você está aqui'
              : (visto ? rotuloAmbiente(mapa.ambiente) : 'Ainda não visitada')));

            if (aqui) carta.appendChild(G.criar('span', 'mapa-pino', '◈'));

            carta.addEventListener('click', function () {
              if (!visto) { UI.toast('Você ainda não esteve lá.', 'aviso'); return; }
              UI.toast(mapa.nome + ' — ' + rotuloAmbiente(mapa.ambiente), 'info');
            });
            tabuleiro.appendChild(carta);
          });

          corpo.appendChild(tabuleiro);

          var conta = Object.keys(vistos).length;
          corpo.appendChild(G.criar('p', 'mapa-progresso',
            conta + ' de ' + GRADE_MUNDO.length + ' regiões descobertas'));
        }
      }]
    });
  };

  function rotuloAmbiente(a) {
    return ({
      vila: 'Vila', campo: 'Campo aberto', floresta: 'Mata fechada',
      lago: 'Lago', montanha: 'Montanha', ruinas: 'Ruínas'
    })[a] || a;
  }

  T.bestiario = function () {
    UI.abrirPainel({
      titulo: 'Bestiário de Vharune',
      abas: [
        { id: 'todos', nome: 'Todos', render: function (c) { renderBestiario(c, 'todos'); } },
        { id: 'capturados', nome: 'Capturados', render: function (c) { renderBestiario(c, 'capturados'); } },
        { id: 'vistos', nome: 'Só vistos', render: function (c) { renderBestiario(c, 'vistos'); } },
        { id: 'tipos', nome: 'Aspectos', render: renderTipos }
      ]
    });
  };

  function renderBestiario(corpo, filtro) {
    var cont = E.contagemBestiario();
    var resumo = G.criar('div', 'bestiario-resumo');
    resumo.appendChild(txt('Capturados: ', cont.capturados + '/' + cont.total));
    resumo.appendChild(txt('Registrados: ', cont.vistos + '/' + cont.total));
    resumo.appendChild(txt('Conclusão: ', Math.round(cont.capturados / cont.total * 100) + '%'));
    corpo.appendChild(resumo);

    var grade = G.criar('div', 'grade-bestiario');
    var algum = false;
    G.LISTA_ESPECIES.forEach(function (esp) {
      var st = E.statusBestiario(esp.id);
      if (filtro === 'capturados' && st !== 'capturado') return;
      if (filtro === 'vistos' && st !== 'visto') return;
      algum = true;

      var d = G.criar('div', 'besta ' + st);
      var v = { seed: esp.num * 977, matiz: 0, padrao: 'liso', porte: 1, prismatico: false };
      if (st === 'desconhecido') {
        var img = UI.imgEspecie(esp.id, v, 86);
        img.style.filter = 'brightness(0) opacity(.30)';
        d.appendChild(img);
        d.appendChild(G.criar('div', 'besta-num', 'Nº' + U.pad(esp.num, 3)));
        d.appendChild(G.criar('div', 'besta-nome', '— — —'));
      } else {
        d.appendChild(UI.imgEspecie(esp.id, v, 86));
        d.appendChild(G.criar('div', 'besta-num', 'Nº' + U.pad(esp.num, 3)));
        d.appendChild(G.criar('div', 'besta-nome', esp.nome));
        d.appendChild(G.criar('div', 'besta-marca', st === 'capturado' ? '◈' : '👁'));
        d.addEventListener('click', function () { T.fichaEspecie(esp.id); });
      }
      grade.appendChild(d);
    });
    if (!algum) {
      corpo.appendChild(G.criar('p', 'vazio', 'Nada aqui ainda.\nExplore a grama alta para encontrar Ânimos.'));
      return;
    }
    corpo.appendChild(grade);
  }

  function txt(rot, val) {
    var s = G.criar('span');
    s.appendChild(document.createTextNode(rot));
    s.appendChild(G.criar('b', null, val));
    return s;
  }

  function renderTipos(corpo) {
    corpo.appendChild(G.criar('p', 'mini', 'Os 11 aspectos do éter mais o Éter neutro. A tabela mostra o multiplicador ao atacar.'));
    var lista = G.criar('div');
    lista.style.cssText = 'display:grid;gap:10px;margin-top:12px';
    G.LISTA_TIPOS.forEach(function (t) {
      var d = G.criar('div', 'op-bloco');
      var cab = G.criar('div');
      cab.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
      cab.appendChild(UI.chipTipo(t));
      cab.appendChild(G.criar('span', 'mini', G.TIPOS[t].desc));
      d.appendChild(cab);

      var tab = G.EFETIVIDADE[t] || {};
      var linhaChips = G.criar('div');
      linhaChips.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap';
      var algum = false;
      Object.keys(tab).forEach(function (alvo) {
        if (tab[alvo] === 1) return;
        algum = true;
        var chip = UI.chipTipo(alvo);
        chip.textContent = G.nomeTipo(alvo) + ' ×' + (tab[alvo] === 0.5 ? '½' : tab[alvo]);
        chip.style.opacity = tab[alvo] > 1 ? '1' : '.55';
        linhaChips.appendChild(chip);
      });
      if (!algum) linhaChips.appendChild(G.criar('span', 'mini', 'Neutro contra todos os aspectos.'));
      d.appendChild(linhaChips);
      lista.appendChild(d);
    });
    corpo.appendChild(lista);
  }

  T.fichaEspecie = function (id) {
    var esp = G.especie(id);
    var st = E.statusBestiario(id);
    UI.abrirPainel({
      titulo: 'Nº' + U.pad(esp.num, 3) + ' · ' + esp.nome,
      abas: [{
        id: 'ficha', nome: 'Ficha', render: function (corpo, rodape) {
          var grade = G.criar('div', 'detalhe');
          var arte = G.criar('div', 'det-arte');
          arte.appendChild(UI.imgEspecie(id, { seed: esp.num * 977, matiz: 0, padrao: 'liso', porte: 1 }, 210));
          arte.appendChild(G.criar('div', 'det-nome', esp.nome));
          arte.appendChild(G.criar('div', 'det-cat', esp.categoria));
          var tipos = G.criar('div', 'det-tipos');
          esp.tipos.forEach(function (t) { tipos.appendChild(UI.chipTipo(t)); });
          arte.appendChild(tipos);
          grade.appendChild(arte);

          var col = G.criar('div');
          var s0 = G.criar('div', 'det-secao');
          s0.appendChild(G.criar('h4', null, 'Registro de campo'));
          var p = G.criar('p', 'carta-desc', esp.desc);
          p.style.lineHeight = '1.75';
          s0.appendChild(p);
          col.appendChild(s0);

          var s1 = G.criar('div', 'det-secao');
          s1.appendChild(G.criar('h4', null, 'Atributos base'));
          var box = G.criar('div', 'atributos');
          ['hp', 'atk', 'def', 'atkEsp', 'defEsp', 'vel'].forEach(function (k) {
            var l = G.criar('div', 'atr');
            l.appendChild(G.criar('span', 'atr-nome', ROTULOS[k]));
            l.appendChild(G.criar('b', null, String(esp.base[k])));
            var b = G.criar('div', 'barra');
            var i = G.criar('i');
            i.style.width = (U.clamp(esp.base[k] / 130, 0.05, 1) * 100).toFixed(0) + '%';
            i.style.background = 'linear-gradient(180deg,#ffd88a,#e8a33d)';
            b.appendChild(i); l.appendChild(b);
            box.appendChild(l);
          });
          s1.appendChild(box);
          var total = ['hp', 'atk', 'def', 'atkEsp', 'defEsp', 'vel'].reduce(function (a, k) { return a + esp.base[k]; }, 0);
          s1.appendChild(G.criar('p', 'mini', 'Soma dos atributos base: ' + total));
          col.appendChild(s1);

          var s2 = G.criar('div', 'det-secao');
          s2.appendChild(G.criar('h4', null, 'Dados'));
          var info = G.criar('div', 'linhas-info');
          info.appendChild(linha('Altura', esp.altura.toFixed(1) + ' m'));
          info.appendChild(linha('Peso', esp.peso > 0 ? esp.peso.toFixed(1) + ' kg' : 'imponderável'));
          info.appendChild(linha('Facilidade de captura', esp.cap >= 140 ? 'Alta' : (esp.cap >= 60 ? 'Média' : (esp.cap >= 20 ? 'Baixa' : 'Lendária'))));
          info.appendChild(linha('Evolução', esp.evo ? G.especie(esp.evo.para).nome + ' (Nv ' + esp.evo.nivel + ')' : 'Forma final'));
          var b = E.s.bestiario[id] || { visto: 0, capturado: 0 };
          info.appendChild(linha('Encontros registrados', String(b.visto)));
          info.appendChild(linha('Vínculos firmados', String(b.capturado)));
          s2.appendChild(info);
          col.appendChild(s2);

          if (st === 'capturado') {
            var s3 = G.criar('div', 'det-secao');
            s3.appendChild(G.criar('h4', null, 'Técnicas por nível'));
            var info2 = G.criar('div', 'linhas-info');
            esp.apr.forEach(function (par) {
              var t = G.tecnica(par[1]);
              if (t) info2.appendChild(linha('Nv ' + par[0], t.nome));
            });
            s3.appendChild(info2);
            col.appendChild(s3);
          }

          grade.appendChild(col);
          corpo.appendChild(grade);

          var v = G.criar('button', 'btn btn-fantasma btn-peq', 'Voltar ao bestiário');
          v.addEventListener('click', T.bestiario);
          rodape.appendChild(v);
        }
      }]
    });
  };

  /* ==================================================================== */
  /*  MOCHILA                                                             */
  /* ==================================================================== */
  function linhaItem(item, qtd, aoClicar, extra) {
    var d = G.criar('div', 'item-linha');
    var ic = G.criar('div', 'item-icone');
    ic.appendChild(UI.imgItem(item, 40));
    d.appendChild(ic);
    var t = G.criar('div', 'item-txt');
    t.appendChild(G.criar('div', 'item-nome', item.nome));
    t.appendChild(G.criar('div', 'item-desc', item.desc));
    d.appendChild(t);
    if (extra !== undefined) d.appendChild(G.criar('span', 'item-preco', extra));
    if (qtd !== null && qtd !== undefined) d.appendChild(G.criar('span', 'item-qtd', '×' + qtd));
    if (aoClicar) d.addEventListener('click', aoClicar);
    return d;
  }
  T.linhaItem = linhaItem;

  T.mochila = function (aba) {
    UI.abrirPainel({
      titulo: 'Mochila',
      aba: aba || 'selo',
      abas: G.CATEGORIAS_ITEM.map(function (cat) {
        return {
          id: cat.id,
          nome: cat.icone + ' ' + cat.nome,
          render: function (corpo) {
            var lista = E.itensDaCategoria(cat.id);
            if (!lista.length) {
              corpo.appendChild(G.criar('p', 'vazio', 'Nada nesta seção.'));
              return;
            }
            var box = G.criar('div', 'lista-itens');
            lista.forEach(function (par) {
              box.appendChild(linhaItem(par.item, par.qtd, function () {
                acaoItemMochila(par.item, cat.id);
              }));
            });
            corpo.appendChild(box);
          }
        };
      })
    });
  };

  function acaoItemMochila(item, aba) {
    if (item.cat === 'selo') {
      UI.escolher(item.nome, item.desc + '\n\nSelos só podem ser usados durante um encontro.', [
        { rotulo: 'Entendi', classe: 'btn-primario' }
      ]);
      return;
    }
    if (item.cat === 'chave') {
      UI.escolher(item.nome, item.desc, [{ rotulo: 'Fechar', classe: 'btn-primario' }]);
      return;
    }
    if (!E.s.equipe.length) { UI.toast('Você não tem Ânimos na equipe.', 'aviso'); return; }
    var ops = E.s.equipe.map(function (c) {
      return {
        rotulo: C.nome(c) + ' (Nv ' + c.nivel + ')',
        acao: function () { usarItemEmCriatura(item, c, function () { T.mochila(aba); }); }
      };
    });
    ops.push({ rotulo: 'Cancelar', classe: 'btn-fantasma' });
    UI.escolher('Usar ' + item.nome, 'Em qual Ânimo?', ops);
  }

  /* ==================================================================== */
  /*  LOJA                                                                */
  /* ==================================================================== */
  T.loja = function (nome) {
    UI.abrirPainel({
      titulo: nome || 'Empório Âmbar',
      abas: [
        { id: 'comprar', nome: 'Comprar', render: renderComprar },
        { id: 'vender', nome: 'Vender', render: renderVender }
      ]
    });
  };

  function catalogo() {
    return G.LISTA_ITENS.filter(function (i) { return i.preco > 0; });
  }

  function renderComprar(corpo, rodape) {
    var saldo = G.criar('div', 'bestiario-resumo');
    saldo.appendChild(txt('Ambras: ', E.s.jogador.ambras.toLocaleString('pt-BR')));
    corpo.appendChild(saldo);

    G.CATEGORIAS_ITEM.forEach(function (cat) {
      var itens = catalogo().filter(function (i) { return i.cat === cat.id; });
      if (!itens.length) return;
      var s = G.criar('div', 'det-secao');
      s.appendChild(G.criar('h4', null, cat.nome));
      var box = G.criar('div', 'lista-itens');
      itens.forEach(function (item) {
        box.appendChild(linhaItem(item, E.s.mochila[item.id] || 0, function () {
          comprar(item);
        }, item.preco.toLocaleString('pt-BR') + ' ⓐ'));
      });
      s.appendChild(box);
      corpo.appendChild(s);
    });
    rodape.appendChild(G.criar('span', 'mini', 'Toque em um item para comprar. ⓐ = Ambras.'));
  }

  function comprar(item) {
    var ops = [1, 5, 10].map(function (q) {
      return {
        rotulo: q + '× (' + (item.preco * q).toLocaleString('pt-BR') + ' ⓐ)',
        acao: function () {
          if (!E.pagar(item.preco * q)) { UI.toast('Ambras insuficientes.', 'aviso'); return; }
          E.darItem(item.id, q);
          UI.toast('Comprou ' + q + '× ' + item.nome + '.', 'ok');
          E.autoSalvar(); UI.atualizarHUD(); UI.recarregarPainel();
        }
      };
    });
    ops.push({ rotulo: 'Cancelar', classe: 'btn-fantasma' });
    UI.escolher('Comprar ' + item.nome, item.desc + '\n\nPreço unitário: ' + item.preco + ' Ambras.', ops);
  }

  function renderVender(corpo) {
    var vendaveis = Object.keys(E.s.mochila).filter(function (id) {
      var it = G.item(id);
      return it && it.venda > 0 && E.s.mochila[id] > 0;
    });
    if (!vendaveis.length) {
      corpo.appendChild(G.criar('p', 'vazio', 'Nada que valha a pena vender.'));
      return;
    }
    var box = G.criar('div', 'lista-itens');
    vendaveis.forEach(function (id) {
      var item = G.item(id);
      box.appendChild(linhaItem(item, E.s.mochila[id], function () {
        var max = E.s.mochila[id];
        var ops = [1, Math.min(5, max), max].filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; })
          .map(function (q) {
            return {
              rotulo: 'Vender ' + q + '× (+' + (item.venda * q).toLocaleString('pt-BR') + ' ⓐ)',
              acao: function () {
                E.gastarItem(id, q);
                E.receber(item.venda * q);
                UI.toast('Vendeu ' + q + '× ' + item.nome + '.', 'ok');
                E.autoSalvar(); UI.atualizarHUD(); UI.recarregarPainel();
              }
            };
          });
        ops.push({ rotulo: 'Cancelar', classe: 'btn-fantasma' });
        UI.escolher('Vender ' + item.nome, 'Valor unitário: ' + item.venda + ' Ambras.', ops);
      }, item.venda.toLocaleString('pt-BR') + ' ⓐ'));
    });
    corpo.appendChild(box);
  }

  /* ==================================================================== */
  /*  PERFIL / OPÇÕES / WEB3                                              */
  /* ==================================================================== */
  T.perfil = function () {
    UI.abrirPainel({
      titulo: 'Vinculista',
      abas: [{
        id: 'perfil', nome: 'Perfil', render: function (corpo) {
          var cont = E.contagemBestiario();
          var s = G.criar('div', 'det-secao');
          s.appendChild(G.criar('h4', null, E.s.jogador.nome));
          var info = G.criar('div', 'linhas-info');
          info.appendChild(linha('Região atual', (G.Mundo.mapaAtual() || {}).nome || '—'));
          info.appendChild(linha('Passos dados', E.s.jogador.passos.toLocaleString('pt-BR')));
          info.appendChild(linha('Vínculos firmados', String(E.s.jogador.capturas)));
          info.appendChild(linha('Combates vencidos', String(E.s.jogador.vitorias)));
          info.appendChild(linha('Ânimos na equipe', E.s.equipe.length + '/6'));
          info.appendChild(linha('Ânimos no Santuário', String(E.s.reserva.length)));
          info.appendChild(linha('Bestiário', cont.capturados + ' de ' + cont.total + ' espécies'));
          info.appendChild(linha('Ambras', E.s.jogador.ambras.toLocaleString('pt-BR')));
          info.appendChild(linha('Início da jornada', new Date(E.s.criadoEm).toLocaleString('pt-BR')));
          s.appendChild(info);
          corpo.appendChild(s);

          var s2 = G.criar('div', 'det-secao');
          s2.appendChild(G.criar('h4', null, 'Controles'));
          var i2 = G.criar('div', 'linhas-info');
          i2.appendChild(linha('Mover', 'Setas ou W A S D'));
          i2.appendChild(linha('Interagir / confirmar', 'Espaço, Enter ou E'));
          i2.appendChild(linha('Menu', 'M ou Esc'));
          i2.appendChild(linha('Equipe / Bestiário / Mochila', 'P / B / I'));
          i2.appendChild(linha('No celular', 'Direcional na esquerda, botão A na direita'));
          s2.appendChild(i2);
          corpo.appendChild(s2);
        }
      }]
    });
  };

  T.opcoes = function () {
    UI.abrirPainel({
      titulo: 'Opções',
      abas: [{
        id: 'op', nome: 'Opções', render: function (corpo) {
          var box = G.criar('div', 'opcoes');

          var b1 = G.criar('div', 'op-bloco');
          b1.appendChild(G.criar('h4', null, 'Salvamento'));
          b1.appendChild(G.criar('p', null, 'O jogo salva sozinho no localStorage do navegador a cada troca de mapa, captura, compra e a cada 40 passos.'));
          var a1 = G.criar('div', 'op-acoes');
          var bs = G.criar('button', 'btn btn-primario btn-peq', 'Salvar agora');
          bs.addEventListener('click', function () {
            if (E.salvar()) UI.toast('Progresso salvo.', 'ok');
            else UI.toast('Não foi possível salvar (localStorage bloqueado).', 'aviso');
          });
          a1.appendChild(bs);
          b1.appendChild(a1);
          box.appendChild(b1);

          var b2 = G.criar('div', 'op-bloco');
          b2.appendChild(G.criar('h4', null, 'Exportar / importar'));
          b2.appendChild(G.criar('p', null, 'Copie o texto abaixo para guardar seu save, ou cole um save e importe.'));
          var ta = G.criar('textarea', 'saida');
          ta.value = E.exportar();
          b2.appendChild(ta);
          var a2 = G.criar('div', 'op-acoes');
          a2.style.marginTop = '9px';
          var bc = G.criar('button', 'btn btn-peq', 'Copiar');
          bc.addEventListener('click', function () {
            ta.select();
            try { document.execCommand('copy'); UI.toast('Save copiado.', 'ok'); }
            catch (e) { UI.toast('Copie manualmente (Ctrl+C).', 'aviso'); }
          });
          var bi = G.criar('button', 'btn btn-peq', 'Importar o texto acima');
          bi.addEventListener('click', function () {
            UI.escolher('Importar save?', 'Isso substitui o progresso atual.', [
              { rotulo: 'Cancelar', classe: 'btn-fantasma' },
              {
                rotulo: 'Importar', classe: 'btn-perigo', acao: function () {
                  if (E.importar(ta.value)) { UI.toast('Save importado. Recarregando...', 'ok'); setTimeout(function () { location.reload(); }, 700); }
                  else UI.toast('Texto inválido.', 'aviso');
                }
              }
            ]);
          });
          a2.appendChild(bc); a2.appendChild(bi);
          b2.appendChild(a2);
          box.appendChild(b2);

          var b3 = G.criar('div', 'op-bloco');
          b3.appendChild(G.criar('h4', null, 'Recomeçar'));
          b3.appendChild(G.criar('p', null, 'Apaga o save e volta à tela de título. Não há como desfazer.'));
          var a3 = G.criar('div', 'op-acoes');
          var br = G.criar('button', 'btn btn-perigo btn-peq', 'Apagar tudo');
          br.addEventListener('click', function () {
            UI.escolher('Apagar o save?', 'Todo o progresso será perdido definitivamente.', [
              { rotulo: 'Cancelar', classe: 'btn-fantasma' },
              {
                rotulo: 'Apagar', classe: 'btn-perigo', acao: function () {
                  E.apagar(); location.reload();
                }
              }
            ]);
          });
          a3.appendChild(br);
          b3.appendChild(a3);
          box.appendChild(b3);

          corpo.appendChild(box);
        }
      }]
    });
  };

  T.web3 = function () {
    UI.abrirPainel({
      titulo: 'Vínculo Étereo (Web3 opcional)',
      abas: [{ id: 'w3', nome: 'Carteira', render: function (corpo) { G.Carteira.renderPainel(corpo); } }]
    });
  };

})(window.ANIMOS);
