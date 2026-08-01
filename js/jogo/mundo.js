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

  var cv, ctx, mapa, estatico, objetos, aguas, larguraCSS, alturaCSS, dpr = 1;
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
    objetos = cacheMapas[id].objetos;
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
    /* poeira/folhas no ponto exato onde o pé encostou */
    soltarPoeira(p.x * TS + TS / 2, p.y * TS + TS - 3, tileEm(p.x, p.y));
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
      /* Fora da tela de jogo (título, intro, escolha) quem manda é a
         navegação por teclado, não o andar. */
      var telaJogo = document.getElementById('tela-jogo');
      if (!telaJogo || !telaJogo.classList.contains('ativa')) {
        if (G.Nav && G.Nav.tecla(ev, document.querySelector('.tela.ativa'))) return;
        return;
      }
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

    /* --------- 1. chão (resolução dobrada, reduzida aqui) --------- */
    ctx.drawImage(estatico, 0, 0, estatico.width, estatico.height,
                  0, 0, mapa.larg * TS, mapa.alt * TS);

    /* --------- 2. água animada (só o que está visível) --------- */
    var x0 = Math.floor(camX / TS) - 1, x1 = Math.ceil((camX + pw) / TS) + 1;
    var y0 = Math.floor(camY / TS) - 1, y1 = Math.ceil((camY + ph) / TS) + 1;
    for (var i = 0; i < aguas.length; i++) {
      var a = aguas[i];
      if (a[0] < x0 || a[0] > x1 || a[1] < y0 || a[1] > y1) continue;
      A.desenharAgua(ctx, a[0], a[1], a[2], tempo, a[3]);
    }

    /* --------- 3. passada ordenada por profundidade ---------
       Personagens e objetos do cenário são intercalados pela linha em que os
       pés tocam o chão. É isso que faz o jogador sumir ATRÁS de uma árvore
       que está à frente dele, e a grama alta cobrir só os pés de quem passa. */
    var atores = [];
    if (mapa.npcs) {
      mapa.npcs.forEach(function (n) {
        if (n.x < x0 - 1 || n.x > x1 + 1 || n.y < y0 - 1 || n.y > y1 + 1) return;
        var bob = Math.sin(tempo / 620 + n.x * 1.7 + n.y) * 0.6;
        atores.push({
          pe: n.y * TS + TS - 2,
          desenhar: function () {
            sombra(n.x * TS + TS / 2, n.y * TS + TS - 3, 13);
            A.desenharPersonagem(ctx, n.sprite, n.dir || 'baixo', 0,
              n.x * TS + TS / 2, n.y * TS + TS - 2 + bob, 44);
          }
        });
      });
    }
    var peJogador = py + TS / 2 - 2;
    atores.push({
      pe: peJogador,
      desenhar: function () {
        sombra(px, peJogador - 1, 14 - Math.abs(saltoPasso()) * 0.5);
        A.desenharPersonagem(ctx, 'jogador', p.dir, quadroCaminhada(),
          px, peJogador + saltoPasso(), 46);
      }
    });
    atores.sort(function (a, b) { return a.pe - b.pe; });

    /* poeira dos passos fica abaixo de tudo que é sólido */
    desenharPoeira();

    var linhaDesenhada = Math.max(0, y0);
    var fimLinha = Math.min(mapa.alt, y1 + 2);
    atores.forEach(function (ator) {
      var linhaAtor = Math.floor(ator.pe / TS);
      if (linhaAtor > linhaDesenhada) {
        faixaObjetos(linhaDesenhada, Math.min(linhaAtor, fimLinha));
        linhaDesenhada = Math.min(linhaAtor, fimLinha);
      }
      ator.desenhar();
    });
    faixaObjetos(linhaDesenhada, fimLinha);

    /* --------- 3b. a grama reage a quem passa por ela --------- */
    desenharRoçado(px, peJogador);

    /* --------- 4. partículas de ambiente --------- */
    desenharAmbiente(camX, camY, pw, ph);

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

  /* ------------------------------------------------------------------ */
  /*  APOIO DE RENDERIZAÇÃO                                              */
  /* ------------------------------------------------------------------ */

  /* Desenha a camada de objetos entre duas linhas de tiles. Como as faixas
     não se sobrepõem, nada é composto duas vezes. */
  function faixaObjetos(de, ate) {
    if (!objetos || ate <= de) return;
    var S = A.SUPER;
    var oy = de * TS, alt = (ate - de) * TS;
    ctx.drawImage(objetos,
      0, oy * S, objetos.width, alt * S,
      0, oy, mapa.larg * TS, alt);
  }

  /* Sombra de contato: separa o personagem do chão e dá peso à silhueta. */
  function sombra(cx, cy, raio) {
    ctx.save();
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
    g.addColorStop(0, 'rgba(8,6,16,0.42)');
    g.addColorStop(0.65, 'rgba(8,6,16,0.20)');
    g.addColorStop(1, 'rgba(8,6,16,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, raio, raio * 0.42, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  /* Ciclo de caminhada de 4 tempos: contato, passagem, contato oposto,
     passagem. O índice avança com o progresso do passo. */
  function quadroCaminhada() {
    if (!p.movendo) return 0;
    return [1, 0, 3, 0][Math.floor(p.prog * 4) & 3];
  }

  /* Pequeno salto vertical no meio do passo — tira o deslize do movimento. */
  function saltoPasso() {
    if (!p.movendo) return 0;
    return -Math.abs(Math.sin(p.prog * Math.PI)) * 1.7;
  }

  /* ------------------------------ poeira ------------------------------ */
  var poeira = [];

  function soltarPoeira(cx, cy, tipoTile) {
    var qtd = tipoTile === ',' ? 3 : 2;
    for (var i = 0; i < qtd; i++) {
      poeira.push({
        x: cx + (Math.random() - 0.5) * 9,
        y: cy - Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.22,
        vy: -0.06 - Math.random() * 0.1,
        vida: 1,
        r: 1.1 + Math.random() * 1.7,
        folha: tipoTile === ','
      });
    }
    if (poeira.length > 90) poeira.splice(0, poeira.length - 90);
  }

  function desenharPoeira() {
    for (var i = poeira.length - 1; i >= 0; i--) {
      var d = poeira[i];
      d.x += d.vx; d.y += d.vy; d.vida -= 0.028;
      if (d.vida <= 0) { poeira.splice(i, 1); continue; }
      ctx.globalAlpha = d.vida * (d.folha ? 0.5 : 0.34);
      ctx.fillStyle = d.folha ? '#8fd07a' : '#c9b48c';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r * d.vida, d.r * d.vida * 0.75, 0, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* Lâminas extras balançando no tile onde o jogador está pisando: dá a
     leitura de estar ATRAVESSANDO o mato, não passando por cima dele. */
  function desenharRoçado(cx, pe) {
    var tx = Math.floor(cx / TS), ty = Math.floor(pe / TS);
    if (ty < 0 || ty >= mapa.alt || tx < 0 || tx >= mapa.larg) return;
    if (mapa.grade[ty][tx] !== ',') return;

    var forca = p.movendo ? 1 : 0.32;
    var base = ty * TS + TS;
    ctx.save();
    ctx.strokeStyle = 'rgba(150,215,130,0.75)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (var i = 0; i < 7; i++) {
      var ang = (i / 7) * 6.2832 + tempo * 0.004;
      var raio = 7 + (i % 3) * 3.5;
      var bx = cx + Math.cos(ang) * raio;
      var by = base - 3 - (i % 2) * 2;
      var incl = Math.sin(tempo * 0.011 + i * 1.7) * 3.4 * forca;
      var h = 7 + (i % 3) * 3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + incl * 0.4, by - h * 0.6, bx + incl, by - h);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* --------------------------- ambiente ------------------------------- */
  /* Partículas lentas que dão vida ao quadro parado. Cada ambiente tem as
     suas: vaga-lumes na floresta, faíscas nas ruínas, pólen no campo. */
  var AMBIENTE = {
    floresta: { n: 26, cor: '#ffe9a0', r: 1.5, vel: 0.10, brilho: true },
    ruinas:   { n: 30, cor: '#c9a6ff', r: 1.3, vel: 0.16, brilho: true },
    campo:    { n: 18, cor: '#e8f0c0', r: 1.1, vel: 0.07, brilho: false },
    lago:     { n: 16, cor: '#bfe4ff', r: 1.2, vel: 0.08, brilho: true },
    montanha: { n: 20, cor: '#d8d8e8', r: 1.0, vel: 0.13, brilho: false },
    vila:     { n: 12, cor: '#f0e0b8', r: 1.0, vel: 0.06, brilho: false }
  };

  function desenharAmbiente(camX, camY, pw, ph) {
    var cfg = AMBIENTE[mapa.ambiente];
    if (!cfg) return;
    ctx.save();
    if (cfg.brilho) ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < cfg.n; i++) {
      /* movimento pseudoaleatório estável, derivado do índice e do tempo */
      var f = i * 2.399;
      var t1 = tempo * cfg.vel * 0.01;
      var ax = ((Math.sin(f * 1.7 + t1 * 0.6) * 0.5 + 0.5) * 1.35 - 0.17) * pw;
      var ay = ((Math.cos(f * 2.3 + t1 * 0.45) * 0.5 + 0.5) * 1.35 - 0.17) * ph;
      var cintila = 0.35 + Math.abs(Math.sin(t1 * 2.2 + f)) * 0.65;
      ctx.globalAlpha = cintila * 0.55;
      ctx.fillStyle = cfg.cor;
      ctx.beginPath();
      ctx.arc(camX + ax, camY + ay, cfg.r * cintila, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
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
