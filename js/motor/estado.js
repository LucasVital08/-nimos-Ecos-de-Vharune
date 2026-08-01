/* =========================================================================
   motor/estado.js — Estado do jogo, bestiário, mochila e salvamento
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var C = G.Criatura;
  var E = G.Estado = {};

  var CHAVE = 'animos.save.v1';
  var CHAVE_CFG = 'animos.cfg.v1';
  /* Chaves antigas, de quando o jogo se chamava Crisálida. Só são lidas, nunca
     escritas: quem já estava testando não perde o progresso na renomeação. */
  var CHAVE_ANTIGA = 'crisalida.save.v1';
  var CHAVE_CFG_ANTIGA = 'crisalida.cfg.v1';

  function ler(chave, chaveAntiga) {
    try {
      return localStorage.getItem(chave) || localStorage.getItem(chaveAntiga);
    } catch (e) { return null; }
  }

  E.MAX_EQUIPE = 6;

  E.novo = function (nomeJogador) {
    var s = {
      versao: G.VERSION,
      criadoEm: Date.now(),
      atualizadoEm: Date.now(),
      jogador: {
        nome: nomeJogador || 'Vinculista',
        ambras: 3000,
        mapa: G.MAPA_INICIAL,
        x: G.POS_INICIAL.x,
        y: G.POS_INICIAL.y,
        dir: G.POS_INICIAL.dir,
        passos: 0,
        capturas: 0,
        vitorias: 0,
        tempoJogo: 0
      },
      equipe: [],
      reserva: [],
      mochila: {
        selo_simples: 8,
        elixir_menor: 4,
        fruta_doce: 3,
        racao_etera: 2,
        erva_purificante: 1,
        lente_de_orva: 1
      },
      bestiario: {},
      flags: {},
      presentes: {}
    };
    return s;
  };

  E.s = null;

  /* ----------------------------- bestiário ---------------------------- */
  E.registrarVisto = function (especieId) {
    var b = E.s.bestiario[especieId];
    if (!b) { E.s.bestiario[especieId] = { visto: 1, capturado: 0 }; return true; }
    b.visto++;
    return false;
  };

  E.registrarCaptura = function (especieId) {
    var b = E.s.bestiario[especieId] || (E.s.bestiario[especieId] = { visto: 1, capturado: 0 });
    b.capturado++;
    E.s.jogador.capturas++;
  };

  E.statusBestiario = function (especieId) {
    var b = E.s.bestiario[especieId];
    if (!b) return 'desconhecido';
    if (b.capturado > 0) return 'capturado';
    return 'visto';
  };

  E.contagemBestiario = function () {
    var vistos = 0, capturados = 0;
    Object.keys(E.s.bestiario).forEach(function (k) {
      var b = E.s.bestiario[k];
      if (b.visto > 0) vistos++;
      if (b.capturado > 0) capturados++;
    });
    return { vistos: vistos, capturados: capturados, total: G.TOTAL_ESPECIES };
  };

  /* ------------------------------ equipe ------------------------------ */
  E.adicionarCriatura = function (c) {
    if (E.s.equipe.length < E.MAX_EQUIPE) {
      E.s.equipe.push(c);
      return 'equipe';
    }
    E.s.reserva.push(c);
    return 'reserva';
  };

  E.lider = function () { return E.s.equipe[0] || null; };

  E.definirLider = function (uid) {
    var i = E.s.equipe.findIndex(function (c) { return c.uid === uid; });
    if (i <= 0) return false;
    var c = E.s.equipe.splice(i, 1)[0];
    E.s.equipe.unshift(c);
    return true;
  };

  E.moverNaEquipe = function (uid, delta) {
    var i = E.s.equipe.findIndex(function (c) { return c.uid === uid; });
    var j = i + delta;
    if (i < 0 || j < 0 || j >= E.s.equipe.length) return false;
    var t = E.s.equipe[i]; E.s.equipe[i] = E.s.equipe[j]; E.s.equipe[j] = t;
    return true;
  };

  E.primeiroApto = function () {
    for (var i = 0; i < E.s.equipe.length; i++) if (E.s.equipe[i].hpAtual > 0) return E.s.equipe[i];
    return null;
  };

  E.equipeApta = function () {
    return E.s.equipe.some(function (c) { return c.hpAtual > 0; });
  };

  E.curarEquipe = function () {
    E.s.equipe.forEach(function (c) {
      C.restaurarTudo(c);
      c.saciedade = U.clamp(c.saciedade + 20, 0, 100);
      c.vinculo = U.clamp(c.vinculo + 1, 0, 100);
    });
  };

  E.enviarParaReserva = function (uid) {
    if (E.s.equipe.length <= 1) return false;
    var i = E.s.equipe.findIndex(function (c) { return c.uid === uid; });
    if (i < 0) return false;
    E.s.reserva.push(E.s.equipe.splice(i, 1)[0]);
    return true;
  };

  E.trazerDaReserva = function (uid) {
    if (E.s.equipe.length >= E.MAX_EQUIPE) return false;
    var i = E.s.reserva.findIndex(function (c) { return c.uid === uid; });
    if (i < 0) return false;
    E.s.equipe.push(E.s.reserva.splice(i, 1)[0]);
    return true;
  };

  E.buscarCriatura = function (uid) {
    var c = E.s.equipe.find(function (x) { return x.uid === uid; });
    if (c) return c;
    return E.s.reserva.find(function (x) { return x.uid === uid; }) || null;
  };

  /* ------------------------------ mochila ----------------------------- */
  E.temItem = function (id, qtd) { return (E.s.mochila[id] || 0) >= (qtd || 1); };

  E.darItem = function (id, qtd) {
    E.s.mochila[id] = (E.s.mochila[id] || 0) + (qtd || 1);
  };

  E.gastarItem = function (id, qtd) {
    qtd = qtd || 1;
    if (!E.temItem(id, qtd)) return false;
    E.s.mochila[id] -= qtd;
    if (E.s.mochila[id] <= 0) delete E.s.mochila[id];
    return true;
  };

  E.itensDaCategoria = function (cat) {
    return Object.keys(E.s.mochila)
      .filter(function (id) {
        var it = G.item(id);
        return it && it.cat === cat && E.s.mochila[id] > 0;
      })
      .map(function (id) { return { item: G.item(id), qtd: E.s.mochila[id] }; })
      .sort(function (a, b) { return (a.item.preco || 0) - (b.item.preco || 0); });
  };

  E.selosDisponiveis = function () { return E.itensDaCategoria('selo'); };

  /* ------------------------------ ambras ------------------------------ */
  E.pagar = function (valor) {
    if (E.s.jogador.ambras < valor) return false;
    E.s.jogador.ambras -= valor;
    return true;
  };
  E.receber = function (valor) { E.s.jogador.ambras += valor; };

  /* ------------------------------ flags ------------------------------- */
  E.flag = function (k) { return !!E.s.flags[k]; };
  E.setFlag = function (k, v) { E.s.flags[k] = v === undefined ? true : v; };

  /* --------------------------- salvamento ----------------------------- */
  var timerAuto = null;
  var ultimoSalvo = 0;

  E.salvar = function (silencioso) {
    if (!E.s) return false;
    try {
      E.s.atualizadoEm = Date.now();
      localStorage.setItem(CHAVE, JSON.stringify(E.s));
      ultimoSalvo = Date.now();
      if (!silencioso) G.bus.emit('salvou');
      return true;
    } catch (e) {
      console.warn('Não foi possível salvar:', e);
      G.bus.emit('erro_salvar', e);
      return false;
    }
  };

  E.autoSalvar = function () {
    if (timerAuto) clearTimeout(timerAuto);
    timerAuto = setTimeout(function () { E.salvar(true); }, 1200);
  };

  E.existeSave = function () {
    return !!ler(CHAVE, CHAVE_ANTIGA);
  };

  E.carregar = function () {
    try {
      var bruto = ler(CHAVE, CHAVE_ANTIGA);
      if (!bruto) return false;
      var s = JSON.parse(bruto);
      if (!s || !s.jogador) return false;
      /* migração defensiva */
      s.equipe = s.equipe || [];
      s.reserva = s.reserva || [];
      s.mochila = s.mochila || {};
      s.bestiario = s.bestiario || {};
      s.flags = s.flags || {};
      s.presentes = s.presentes || {};
      s.equipe.concat(s.reserva).forEach(function (c) {
        if (c.energia === undefined) c.energia = 100;
        if (c.saciedade === undefined) c.saciedade = 80;
        if (c.vinculo === undefined) c.vinculo = 25;
        if (!c.tecnicas) c.tecnicas = C.tecnicasNoNivel(G.especie(c.esp), c.nivel);
      });
      E.s = s;
      return true;
    } catch (e) {
      console.warn('Save corrompido:', e);
      return false;
    }
  };

  E.apagar = function () {
    try { localStorage.removeItem(CHAVE); } catch (e) { /* ignora */ }
    E.s = null;
  };

  E.exportar = function () {
    return JSON.stringify(E.s, null, 2);
  };

  E.importar = function (texto) {
    try {
      var s = JSON.parse(texto);
      if (!s || !s.jogador) throw new Error('formato inválido');
      E.s = s;
      E.salvar(true);
      return true;
    } catch (e) {
      return false;
    }
  };

  E.ultimoSalvo = function () { return ultimoSalvo; };

  /* ---------------------------- configuração --------------------------- */
  E.cfg = { som: true, animacoes: true, gradeDebug: false };

  E.salvarCfg = function () {
    try { localStorage.setItem(CHAVE_CFG, JSON.stringify(E.cfg)); } catch (e) { /* ignora */ }
  };
  E.carregarCfg = function () {
    try {
      var b = ler(CHAVE_CFG, CHAVE_CFG_ANTIGA);
      if (b) E.cfg = Object.assign(E.cfg, JSON.parse(b));
    } catch (e) { /* ignora */ }
  };

})(window.ANIMOS);
