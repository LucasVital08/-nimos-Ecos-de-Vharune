/* =========================================================================
   jogo/mundo.js — Exploração top-down: câmera, movimento, encontros, NPCs
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var A = G.Arte;
  var E = G.Estado;
  var TS = A.TS;

  var M = G.Mundo = {};

  var cv, ctx, mapa, estatico, aguas, larguraCSS, alturaCSS, dpr = 1;
  var zoom = 2;
  var rodando = false, pausado = false;
  var ultimo = 0, tempo = 0;
  var cacheMapas = {};

  var DUR_PASSO = 165;

  var p = {
    x: 0, y: 0, dir: 'baixo',
    movendo: false, prog: 0, deX: 0, deY: 0,
    frame: 0, andouTiles: 0, animPasso: 0
  };

  var teclas = {};
  var passosDesdeEncontro = 0;
  var proximoEncontro = 4;
  var transicao = { ativa: false, prog: 0, modo: null, aoMeio: null };
  var flashEncontro = 0;

  /* ------------------------------------------------------------------ */
  M.iniciar = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    redimensionar();
    window.addEventListener('resize', redimensionar);
    ligarTeclado();
    rodando = true;
    requestAnimationFrame(quadro);
  };

  function redimensionar() {
    if (!cv) return;
    var r = cv.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    larguraCSS = Math.max(240, r.width);
    alturaCSS = Math.max(200, r.height);
    cv.width = Math.round(larguraCSS * dpr);
    cv.height = Math.round(alturaCSS * dpr);
    cv.style.width = larguraCSS + 'px';
    cv.style.height = alturaCSS + 'px';
    var alvoTiles = larguraCSS < 560 ? 12 : (larguraCSS < 900 ? 16 : 19);
    zoom = U.clamp(larguraCSS / (alvoTiles * TS), 1.1, 3.2);
  }
  M.redimensionar = redimensionar;

  /* ------------------------------ mapa -------------------------------- */
  /* A camada estática é pesada (resolução dobrada), então guardamos só os dois
     últimos mapas: ir e voltar por um portal continua instantâneo. */
  var ordemCache = [];
  var CACHE_MAPAS_MAX = 2;

  M.carregarMapa = function (id, px, py, dir) {
    mapa = G.mapa(id);
    if (!mapa) { console.error('Mapa inexistente: ' + id); return; }
    if (!cacheMapas[id]) {
      cacheMapas[id] = A.renderizarMapa(mapa);
      ordemCache.push(id);
      while (ordemCache.length > CACHE_MAPAS_MAX) {
        var velho = ordemCache.shift();
        if (velho !== id) delete cacheMapas[velho];
      }
    } else {
      ordemCache = ordemCache.filter(function (k) { return k !== id; });
      ordemCache.push(id);
    }
    estatico = cacheMapas[id].canvas;
    aguas = cacheMapas[id].aguas;
    p.x = px; p.y = py; p.dir = dir || 'baixo';
    p.movendo = false; p.prog = 0;
    E.s.jogador.mapa = id;
    E.s.jogador.x = px;
    E.s.jogador.y = py;
    E.s.jogador.dir = p.dir;
    proximoEncontro = U.randInt(3, 9);
    passosDesdeEncontro = 0;
    G.bus.emit('mapa_mudou', mapa);
    E.autoSalvar();
  };

  M.mapaAtual = function () { return mapa; };
  M.jogador = function () { return p; };

  /* --------------------------- colisões ------------------------------- */
  function tileEm(x, y) {
    if (!mapa || y < 0 || y >= mapa.alt || x < 0 || x >= mapa.larg) return '_';
    return mapa.grade[y][x];
  }

  function npcEm(x, y) {
    if (!mapa.npcs) return null;
    for (var i = 0; i < mapa.npcs.length; i++) {
      var n = mapa.npcs[i];
      if (n.x === x && n.y === y) return n;
    }
    return null;
  }

  function podeAndar(x, y) {
    if (!G.ANDAVEL[tileEm(x, y)]) return false;
    if (npcEm(x, y)) return false;
    return true;
  }

  /* --------------------------- movimento ------------------------------ */
  var DELTAS = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };

  function tentarAndar(dir) {
    if (p.movendo || pausado || transicao.ativa) return;
    p.dir = dir;
    var d = DELTAS[dir];
    var nx = p.x + d[0], ny = p.y + d[1];
    if (!podeAndar(nx, ny)) {
      p.animPasso = (p.animPasso + 1) % 4;
      return;
    }
    p.deX = p.x; p.deY = p.y;
    p.x = nx; p.y = ny;
    p.movendo = true;
    p.prog = 0;
  }

  function chegouNoTile() {
    E.s.jogador.x = p.x;
    E.s.jogador.y = p.y;
    E.s.jogador.dir = p.dir;
    E.s.jogador.passos++;

    /* cuidado das criaturas avança com os passos */
    if (E.s.jogador.passos % 12 === 0) {
      E.s.equipe.forEach(function (c) { G.Criatura.tickCuidado(c, 1); });
      G.bus.emit('cuidado_tick');
    }
    if (E.s.jogador.passos % 40 === 0) E.autoSalvar();

    /* portal */
    var w = mapa._warp[p.x + ',' + p.y];
    if (w) {
      if (w.requerItem && !E.temItem(w.requerItem)) {
        G.bus.emit('dialogo', { nome: null, linhas: [w.bloqueio || 'A passagem está selada.'] });
        /* empurra de volta */
        var d = DELTAS[p.dir];
        if (podeAndar(p.x - d[0], p.y - d[1])) { p.x -= d[0]; p.y -= d[1]; }
        return;
      }
      iniciarTransicao(function () {
        M.carregarMapa(w.para, w.px, w.py, w.dir || p.dir);
      });
      return;
    }

    /* encontro */
    var t = tileEm(p.x, p.y);
    var tipoEnc = G.TILE_ENCONTRO[t];
    if (tipoEnc) {
      passosDesdeEncontro++;
      if (passosDesdeEncontro >= proximoEncontro && Math.random() < 0.42) {
        passosDesdeEncontro = 0;
        proximoEncontro = U.randInt(3, 10);
        dispararEncontro(tipoEnc);
      }
    }
  }

  function dispararEncontro(categoria) {
    var tabela = (mapa.encontros || {})[categoria];
    if (!tabela || !tabela.length) return;
    if (!E.equipeApta()) return;
    var esc = U.weighted(tabela);
    var nivel = U.randInt(esc.min, esc.max);
    var selvagem = G.Criatura.criar(esc.id, nivel, { selvagem: true, local: mapa.nome });
    flashEncontro = 1;
    pausado = true;
    setTimeout(function () {
      G.bus.emit('encontro', { criatura: selvagem, local: mapa.nome });
    }, 480);
  }

  M.pescar = function () {
    if (!E.temItem('vara_de_junco')) {
      G.bus.emit('dialogo', { nome: null, linhas: ['A água está calma. Sem uma vara, não dá para tentar nada.'] });
      return;
    }
    var tabela = (mapa.encontros || {}).agua;
    if (!tabela || !tabela.length) {
      G.bus.emit('dialogo', { nome: null, linhas: ['Nada morde a linha por aqui.'] });
      return;
    }
    G.bus.emit('dialogo', {
      nome: null,
      linhas: ['Você lança a linha na água...'],
      aoFim: function () {
        if (Math.random() < 0.45) {
          G.bus.emit('dialogo', { nome: null, linhas: ['...e nada aparece. Paciência é meio caminho.'] });
          return;
        }
        var esc = U.weighted(tabela);
        var nivel = U.randInt(esc.min, esc.max);
        var selvagem = G.Criatura.criar(esc.id, nivel, { selvagem: true, local: mapa.nome });
        pausado = true;
        G.bus.emit('encontro', { criatura: selvagem, local: mapa.nome, pesca: true });
      }
    });
  };

  /* --------------------------- interação ------------------------------ */
  M.interagir = function () {
    if (p.movendo || pausado || transicao.ativa) return;
    var d = DELTAS[p.dir];
    var fx = p.x + d[0], fy = p.y + d[1];

    var n = npcEm(fx, fy);
    if (n) {
      n.dir = { cima: 'baixo', baixo: 'cima', esquerda: 'direita', direita: 'esquerda' }[p.dir];
      var linhas = n.falas.slice();
      var presente = null;
      if (n.presente && !E.s.presentes[mapa.id + ':' + n.id]) {
        presente = n.presente;
      }
      G.bus.emit('dialogo', {
        nome: n.nome,
        sprite: n.sprite,
        linhas: linhas,
        aoFim: function () {
          if (presente) {
            E.s.presentes[mapa.id + ':' + n.id] = true;
            E.darItem(presente.item, presente.qtd);
            var it = G.item(presente.item);
            G.bus.emit('dialogo', {
              nome: n.nome,
              sprite: n.sprite,
              linhas: ['Você recebeu ' + presente.qtd + '× ' + it.nome + '.']
            });
            E.autoSalvar();
          }
        }
      });
      return;
    }

    var placa = mapa._placa[fx + ',' + fy];
    if (placa) {
      G.bus.emit('dialogo', { nome: null, linhas: placa.texto.split('\n') });
      return;
    }

    var servicos = mapa._servico[fx + ',' + fy];
    if (servicos && servicos.length) {
      G.bus.emit('servico', { lista: servicos });
      return;
    }

    if (G.TILE_AGUA[tileEm(fx, fy)]) {
      M.pescar();
      return;
    }

    var t = tileEm(fx, fy);
    if (t === 'x') {
      G.bus.emit('dialogo', { nome: null, linhas: ['Um cristal étereo pulsa devagar. O ar em volta é morno e cheira a chuva.'] });
    } else if (t === 'T') {
      G.bus.emit('dialogo', { nome: null, linhas: ['Uma árvore antiga. Você ouve algo se mexer nos galhos e desiste de olhar.'] });
    } else if (t === 'P') {
      G.bus.emit('dialogo', { nome: null, linhas: ['Um pilar rachado. Há inscrições gastas: "...o que costura também rasga."'] });
    } else if (t === 'c') {
      G.bus.emit('dialogo', { nome: null, linhas: ['Engradados da oficina. Ferramentas, sucata e um cheiro forte de óleo.'] });
    }
  };

  /* -------------------------- entrada teclado -------------------------- */
  function ligarTeclado() {
    window.addEventListener('keydown', function (ev) {
      var k = ev.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].indexOf(k) >= 0) ev.preventDefault();
      if (G.UI && G.UI.capturaTeclado && G.UI.capturaTeclado(ev)) return;
      teclas[k] = true;
      if (k === 'enter' || k === ' ' || k === 'e') M.interagir();
    });
    window.addEventListener('keyup', function (ev) { teclas[ev.key.toLowerCase()] = false; });
    window.addEventListener('blur', function () { teclas = {}; });
  }

  M.direcaoTouch = null;
  M.pressionarDirecao = function (dir) { M.direcaoTouch = dir; };
  M.soltarDirecao = function () { M.direcaoTouch = null; };

  function direcaoAtual() {
    if (M.direcaoTouch) return M.direcaoTouch;
    if (teclas['arrowup'] || teclas['w']) return 'cima';
    if (teclas['arrowdown'] || teclas['s']) return 'baixo';
    if (teclas['arrowleft'] || teclas['a']) return 'esquerda';
    if (teclas['arrowright'] || teclas['d']) return 'direita';
    return null;
  }

  /* --------------------------- transição ------------------------------ */
  function iniciarTransicao(aoMeio) {
    transicao.ativa = true;
    transicao.prog = 0;
    transicao.aoMeio = aoMeio;
    transicao.feito = false;
  }

  /* ---------------------------- pausa --------------------------------- */
  M.pausar = function () { pausado = true; teclas = {}; M.direcaoTouch = null; };
  M.retomar = function () { pausado = false; };
  M.estaPausado = function () { return pausado; };

  /* ----------------------------- loop --------------------------------- */
  function quadro(t) {
    if (!rodando) return;
    var dt = Math.min(64, t - (ultimo || t));
    ultimo = t;
    tempo += dt;
    atualizar(dt);
    desenhar();
    requestAnimationFrame(quadro);
  }

  function atualizar(dt) {
    if (transicao.ativa) {
      transicao.prog += dt / 340;
      if (transicao.prog >= 0.5 && !transicao.feito) {
        transicao.feito = true;
        if (transicao.aoMeio) transicao.aoMeio();
      }
      if (transicao.prog >= 1) { transicao.ativa = false; transicao.prog = 0; }
      return;
    }
    if (flashEncontro > 0) flashEncontro = Math.max(0, flashEncontro - dt / 480);

    if (p.movendo) {
      p.prog += dt / DUR_PASSO;
      p.animPasso = Math.floor(p.prog * 2 + 0.5) % 4;
      if (p.prog >= 1) {
        p.prog = 0;
        p.movendo = false;
        p.animPasso = 0;
        chegouNoTile();
      }
    } else if (!pausado) {
      var d = direcaoAtual();
      if (d) tentarAndar(d);
    }
  }

  /* -------------------------- renderização ----------------------------- */
  function desenhar() {
    if (!ctx || !mapa) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, larguraCSS, alturaCSS);
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(0, 0, larguraCSS, alturaCSS);

    var pw = larguraCSS / zoom, ph = alturaCSS / zoom;

    /* posição interpolada do jogador */
    var px = (p.movendo ? U.lerp(p.deX, p.x, p.prog) : p.x) * TS + TS / 2;
    var py = (p.movendo ? U.lerp(p.deY, p.y, p.prog) : p.y) * TS + TS / 2;

    var camX = px - pw / 2, camY = py - ph / 2;
    var mw = mapa.larg * TS, mh = mapa.alt * TS;
    camX = mw <= pw ? (mw - pw) / 2 : U.clamp(camX, 0, mw - pw);
    camY = mh <= ph ? (mh - ph) / 2 : U.clamp(camY, 0, mh - ph);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(camX * zoom) / zoom, -Math.round(camY * zoom) / zoom);

    /* camada estática (pintada em resolução dobrada, reduzida aqui) */
    ctx.drawImage(estatico, 0, 0, estatico.width, estatico.height,
                  0, 0, mapa.larg * TS, mapa.alt * TS);

    /* água animada (só o que está visível) */
    var x0 = Math.floor(camX / TS) - 1, x1 = Math.ceil((camX + pw) / TS) + 1;
    var y0 = Math.floor(camY / TS) - 1, y1 = Math.ceil((camY + ph) / TS) + 1;
    for (var i = 0; i < aguas.length; i++) {
      var a = aguas[i];
      if (a[0] < x0 || a[0] > x1 || a[1] < y0 || a[1] > y1) continue;
      A.desenharAgua(ctx, a[0], a[1], a[2], tempo, a[3]);
    }

    /* NPCs */
    if (mapa.npcs) {
      mapa.npcs.forEach(function (n) {
        if (n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1) return;
        var bob = Math.sin(tempo / 620 + n.x * 1.7 + n.y) * 0.6;
        A.desenharPersonagem(ctx, n.sprite, n.dir || 'baixo', 0,
          n.x * TS + TS / 2, n.y * TS + TS - 2 + bob, 44);
      });
    }

    /* jogador */
    var frame = p.movendo ? [0, 1, 0, 3][p.animPasso] : 0;
    A.desenharPersonagem(ctx, 'jogador', p.dir, frame, px, py + TS / 2 - 2, 46);

    /* grama alta cobre os pés */
    coberturaGramaAlta(px, py);

    ctx.restore();

    /* interface sobre o mapa */
    desenharVinheta();
    if (flashEncontro > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (flashEncontro * 0.55).toFixed(3) + ')';
      ctx.fillRect(0, 0, larguraCSS, alturaCSS);
    }
    if (transicao.ativa) {
      var alfa = transicao.prog < 0.5 ? transicao.prog * 2 : (1 - transicao.prog) * 2;
      ctx.fillStyle = 'rgba(6,5,12,' + alfa.toFixed(3) + ')';
      ctx.fillRect(0, 0, larguraCSS, alturaCSS);
    }
  }

  function coberturaGramaAlta(px, py) {
    var tx = Math.round((px - TS / 2) / TS), ty = Math.round((py - TS / 2) / TS);
    for (var dy = 0; dy <= 1; dy++) {
      var y = ty + dy;
      if (y < 0 || y >= mapa.alt) continue;
      for (var dx = -1; dx <= 1; dx++) {
        var x = tx + dx;
        if (x < 0 || x >= mapa.larg) continue;
        if (mapa.grade[y][x] !== ',') continue;
        var recorte = TS * 0.55;
        var S = A.SUPER;
        ctx.drawImage(estatico,
          x * TS * S, (y * TS + TS - recorte) * S, TS * S, recorte * S,
          x * TS, y * TS + TS - recorte, TS, recorte);
      }
    }
  }

  function desenharVinheta() {
    var g = ctx.createRadialGradient(
      larguraCSS / 2, alturaCSS / 2, Math.min(larguraCSS, alturaCSS) * 0.35,
      larguraCSS / 2, alturaCSS / 2, Math.max(larguraCSS, alturaCSS) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(4,3,10,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, larguraCSS, alturaCSS);
  }

  M.limparCacheMapas = function () { cacheMapas = {}; ordemCache = []; };

})(window.ANIMOS);
