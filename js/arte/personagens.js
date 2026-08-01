/* =========================================================================
   arte/personagens.js — Sprites procedurais de personagens e ícones de itens
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var A = G.Arte = G.Arte || {};
  var CACHE = {};

  var PALETAS = {
    jogador:     { pele: [28, 45, 72], cabelo: [22, 45, 26], roupa: [200, 45, 42], roupa2: [40, 60, 52], det: [45, 88, 60] },
    mestra:      { pele: [30, 40, 74], cabelo: [0, 0, 82],  roupa: [270, 32, 38], roupa2: [270, 20, 28], det: [48, 85, 62] },
    lojista:     { pele: [26, 42, 62], cabelo: [20, 50, 20], roupa: [24, 55, 40], roupa2: [30, 35, 28], det: [40, 70, 55] },
    curandeira:  { pele: [30, 44, 76], cabelo: [120, 30, 32], roupa: [150, 35, 50], roupa2: [0, 0, 92], det: [350, 60, 60] },
    aldeao:      { pele: [28, 38, 66], cabelo: [28, 30, 32], roupa: [92, 22, 42], roupa2: [30, 25, 32], det: [200, 30, 50] },
    rival:       { pele: [26, 40, 68], cabelo: [355, 55, 42], roupa: [352, 40, 36], roupa2: [220, 15, 26], det: [50, 80, 58] },
    guarda:      { pele: [27, 40, 60], cabelo: [30, 25, 22], roupa: [215, 25, 34], roupa2: [212, 12, 50], det: [45, 75, 58] },
    crianca:     { pele: [30, 48, 78], cabelo: [40, 55, 40], roupa: [190, 50, 55], roupa2: [50, 60, 60], det: [340, 60, 66] }
  };

  var LADO = 48;
  var UN = LADO / 32;

  function el(ctx, x, y, rx, ry, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832);
  }

  function corpo(ctx, p, dir, frame, tipo) {
    var passo = frame === 1 ? 1 : (frame === 3 ? -1 : 0);
    var LN = 'rgba(24,20,32,0.85)';
    var cx = 16, base = 30;
    var alto = tipo === 'crianca' ? 0.82 : 1;
    var esc = alto;

    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(esc, esc);
    ctx.translate(-cx, -base);

    /* sombra */
    el(ctx, cx, base + 0.5, 7.5, 2.6, 0);
    ctx.fillStyle = 'rgba(15,12,22,0.30)'; ctx.fill();

    /* pernas */
    ctx.fillStyle = U.css(p.roupa2);
    ctx.fillRect(cx - 4.6 + passo * 1.1, base - 8, 3.6, 8);
    ctx.fillRect(cx + 1.0 - passo * 1.1, base - 8, 3.6, 8);
    ctx.fillStyle = U.css(U.tom(p.roupa2, -14));
    ctx.fillRect(cx - 4.8 + passo * 1.1, base - 1.8, 4.0, 2.2);
    ctx.fillRect(cx + 0.8 - passo * 1.1, base - 1.8, 4.0, 2.2);

    /* tronco / manto */
    ctx.beginPath();
    ctx.moveTo(cx - 6, base - 8);
    ctx.lineTo(cx - 5, base - 18);
    ctx.quadraticCurveTo(cx, base - 20.5, cx + 5, base - 18);
    ctx.lineTo(cx + 6, base - 8);
    ctx.closePath();
    ctx.fillStyle = U.css(p.roupa); ctx.fill();
    ctx.strokeStyle = LN; ctx.lineWidth = 0.8; ctx.stroke();

    /* detalhe do peito */
    if (dir !== 'cima') {
      ctx.fillStyle = U.css(p.det);
      ctx.fillRect(cx - 1.2, base - 17.5, 2.4, 8);
      el(ctx, cx, base - 17.8, 1.9, 1.9, 0);
      ctx.fillStyle = U.css(p.det); ctx.fill();
    }

    /* braços */
    ctx.fillStyle = U.css(U.tom(p.roupa, -8));
    ctx.fillRect(cx - 7.6, base - 17 + passo * 0.8, 2.6, 8);
    ctx.fillRect(cx + 5.0, base - 17 - passo * 0.8, 2.6, 8);
    ctx.fillStyle = U.css(p.pele);
    el(ctx, cx - 6.3, base - 9 + passo * 0.8, 1.7, 1.7, 0); ctx.fill();
    el(ctx, cx + 6.3, base - 9 - passo * 0.8, 1.7, 1.7, 0); ctx.fill();

    /* cabeça */
    var hy = base - 23.5;
    el(ctx, cx, hy, 6.0, 6.2, 0);
    ctx.fillStyle = U.css(p.pele); ctx.fill();
    ctx.strokeStyle = LN; ctx.lineWidth = 0.8; ctx.stroke();

    /* cabelo */
    ctx.beginPath();
    if (dir === 'cima') {
      el(ctx, cx, hy, 6.2, 6.3, 0);
      ctx.fillStyle = U.css(p.cabelo); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, hy, 6.2, Math.PI * 1.02, Math.PI * 2.02);
      ctx.lineTo(cx + 6.2, hy + 1.2);
      ctx.quadraticCurveTo(cx, hy - 2.2, cx - 6.2, hy + 1.2);
      ctx.closePath();
      ctx.fillStyle = U.css(p.cabelo); ctx.fill();
      /* franja lateral */
      el(ctx, cx - 5.4, hy + 1.4, 1.5, 2.6, 0.2);
      ctx.fillStyle = U.css(p.cabelo); ctx.fill();
      el(ctx, cx + 5.4, hy + 1.4, 1.5, 2.6, -0.2);
      ctx.fillStyle = U.css(p.cabelo); ctx.fill();
    }

    /* rosto */
    if (dir !== 'cima') {
      var ox = dir === 'esquerda' ? -1.5 : (dir === 'direita' ? 1.5 : 0);
      ctx.fillStyle = '#1a1626';
      if (dir === 'baixo') {
        el(ctx, cx - 2.1, hy + 1.2, 0.95, 1.15, 0); ctx.fill();
        el(ctx, cx + 2.1, hy + 1.2, 0.95, 1.15, 0); ctx.fill();
      } else {
        el(ctx, cx + ox * 1.3, hy + 1.2, 0.95, 1.15, 0); ctx.fill();
        el(ctx, cx + ox * 0.35, hy + 1.2, 0.8, 1.0, 0); ctx.fill();
      }
      ctx.fillStyle = 'rgba(220,120,110,0.35)';
      el(ctx, cx - 3.6, hy + 2.6, 1.3, 0.8, 0); ctx.fill();
      el(ctx, cx + 3.6, hy + 2.6, 1.3, 0.8, 0); ctx.fill();
    }

    /* acessório por tipo */
    if (tipo === 'jogador') {
      ctx.beginPath();
      ctx.moveTo(cx - 7, hy - 2.6);
      ctx.quadraticCurveTo(cx, hy - 8.4, cx + 7, hy - 2.6);
      ctx.lineTo(cx + 8.4, hy - 1.4);
      ctx.quadraticCurveTo(cx, hy - 4.2, cx - 8.4, hy - 1.4);
      ctx.closePath();
      ctx.fillStyle = U.css(p.det); ctx.fill();
      ctx.strokeStyle = LN; ctx.lineWidth = 0.7; ctx.stroke();
    } else if (tipo === 'mestra') {
      ctx.beginPath();
      ctx.moveTo(cx - 8.6, hy - 1.2); ctx.lineTo(cx + 8.6, hy - 1.2);
      ctx.lineTo(cx + 4.6, hy - 3.0);
      ctx.quadraticCurveTo(cx, hy - 9.5, cx - 4.6, hy - 3.0);
      ctx.closePath();
      ctx.fillStyle = U.css(U.tom(p.roupa, -10)); ctx.fill();
      ctx.strokeStyle = LN; ctx.lineWidth = 0.7; ctx.stroke();
    } else if (tipo === 'guarda') {
      ctx.beginPath();
      ctx.arc(cx, hy - 0.5, 6.4, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = U.css(p.roupa2); ctx.fill();
      ctx.strokeStyle = LN; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = U.css(p.det);
      ctx.fillRect(cx - 0.9, hy - 7.6, 1.8, 3.4);
    } else if (tipo === 'curandeira') {
      ctx.fillStyle = U.css(p.roupa2);
      ctx.fillRect(cx - 6.4, hy - 5.2, 12.8, 2.6);
      ctx.fillStyle = U.css(p.det);
      ctx.fillRect(cx - 1.6, hy - 4.9, 3.2, 1.0);
      ctx.fillRect(cx - 0.5, hy - 6.0, 1.0, 3.2);
    } else if (tipo === 'lojista') {
      ctx.fillStyle = U.css(U.tom(p.roupa2, 10));
      ctx.fillRect(cx - 5.4, base - 15, 10.8, 7);
      ctx.strokeStyle = LN; ctx.lineWidth = 0.6;
      ctx.strokeRect(cx - 5.4, base - 15, 10.8, 7);
    } else if (tipo === 'rival') {
      ctx.beginPath();
      ctx.moveTo(cx + 4.5, hy - 4.5);
      ctx.quadraticCurveTo(cx + 9.5, hy - 7.5, cx + 7.5, hy - 1.5);
      ctx.closePath();
      ctx.fillStyle = U.css(p.cabelo); ctx.fill();
    }
    ctx.restore();
  }

  A.canvasPersonagem = function (tipo, dir, frame) {
    var chave = tipo + '|' + dir + '|' + frame;
    if (CACHE[chave]) return CACHE[chave];
    var p = PALETAS[tipo] || PALETAS.aldeao;
    var cv = document.createElement('canvas');
    cv.width = LADO; cv.height = LADO;
    var ctx = cv.getContext('2d');
    ctx.scale(UN, UN);
    ctx.translate(0, 1);
    ctx.save();
    if (dir === 'esquerda') { ctx.translate(32, 0); ctx.scale(-1, 1); }
    corpo(ctx, p, dir === 'esquerda' ? 'direita' : dir, frame, tipo);
    ctx.restore();
    CACHE[chave] = cv;
    return cv;
  };

  /* x,y = centro do tile; o sprite fica com os pés na base do tile */
  A.desenharPersonagem = function (ctx, tipo, dir, frame, x, y, tam) {
    var cv = A.canvasPersonagem(tipo, dir, frame);
    var t = tam || 48;
    ctx.drawImage(cv, x - t / 2, y - t * 0.72, t, t);
  };

  /* ==================================================================== */
  /*  ÍCONES DE ITEM                                                      */
  /* ==================================================================== */
  var ICACHE = {};

  /* Selo de Âmbar: um sigilo hexagonal facetado, pendurado por uma argola,
     com a "runa do vínculo" gravada no centro. Desenho original do jogo. */
  A.desenharSigilo = function (ctx, R, c1, c2, marca) {
    var i, a, pts = [];
    for (i = 0; i < 6; i++) {
      a = -Math.PI / 2 + i * Math.PI / 3;
      pts.push([Math.cos(a) * R, Math.sin(a) * R]);
    }

    /* argola */
    ctx.strokeStyle = U.css(U.tom(c2, -12));
    ctx.lineWidth = R * 0.17;
    ctx.beginPath();
    ctx.arc(0, -R - R * 0.24, R * 0.22, Math.PI * 0.12, Math.PI * 0.88, true);
    ctx.stroke();

    /* corpo de âmbar */
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    var g = ctx.createLinearGradient(-R, -R, R, R);
    g.addColorStop(0, U.css(U.tom(c1, 22)));
    g.addColorStop(0.55, U.css(c1));
    g.addColorStop(1, U.css(U.tom(c1, -15)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = U.css(U.tom(c2, -18));
    ctx.lineWidth = R * 0.16;
    ctx.stroke();

    /* facetas */
    ctx.beginPath();
    ctx.moveTo(pts[5][0], pts[5][1]); ctx.lineTo(pts[0][0], pts[0][1]); ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.24)'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.17)'; ctx.fill();

    /* runa do vínculo */
    var rc = marca ? U.css(marca) : 'rgba(32,22,8,0.72)';
    ctx.strokeStyle = rc;
    ctx.lineWidth = R * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -R * 0.55); ctx.lineTo(0, R * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -R * 0.19, R * 0.27, Math.PI * 0.16, Math.PI * 0.84); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, R * 0.19, R * 0.27, Math.PI * 1.16, Math.PI * 1.84); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.13, 0, 6.3); ctx.fillStyle = rc; ctx.fill();
  };

  function selo(ctx, c1, c2, marca) {
    ctx.save();
    ctx.translate(16, 17.5);
    A.desenharSigilo(ctx, 11.5, c1, c2, marca);
    ctx.restore();
  }

  function frasco(ctx, cor, nivel) {
    ctx.save(); ctx.translate(16, 16);
    ctx.fillStyle = 'rgba(220,225,235,0.30)';
    ctx.beginPath();
    ctx.moveTo(-4, -11); ctx.lineTo(4, -11); ctx.lineTo(4, -5);
    ctx.quadraticCurveTo(9, -1, 9, 5);
    ctx.quadraticCurveTo(9, 12, 0, 12);
    ctx.quadraticCurveTo(-9, 12, -9, 5);
    ctx.quadraticCurveTo(-9, -1, -4, -5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,245,255,0.75)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = U.css(cor);
    ctx.fillRect(-10, 12 - nivel * 18, 20, 20);
    ctx.fillStyle = U.css(U.tom(cor, 16), 0.8);
    ctx.fillRect(-10, 12 - nivel * 18, 20, 2.4);
    ctx.restore();
    ctx.fillStyle = '#8a6b47';
    ctx.fillRect(-4.6, -14, 9.2, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-4.5, 3, 1.6, 4.5, 0.2, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  var DESENHOS = {
    selo1: function (c) { selo(c, [40, 55, 60], [24, 40, 40], null); },
    selo2: function (c) { selo(c, [200, 55, 55], [212, 45, 38], [190, 60, 80]); },
    selo3: function (c) { selo(c, [45, 85, 58], [38, 70, 40], [50, 95, 78]); },
    selo4: function (c) { selo(c, [278, 55, 58], [268, 45, 36], [190, 90, 85]); },
    selo5: function (c) { selo(c, [195, 70, 55], [205, 55, 36], [180, 80, 82]); },
    selo6: function (c) { selo(c, [14, 80, 52], [4, 65, 34], [45, 95, 72]); },
    frasco1: function (c) { frasco(c, [345, 65, 58], 0.55); },
    frasco2: function (c) { frasco(c, [125, 55, 48], 0.72); },
    frasco3: function (c) { frasco(c, [200, 65, 55], 0.88); },
    frasco4: function (c) { frasco(c, [48, 85, 62], 1.0); },
    erva: function (c) {
      c.save(); c.translate(16, 17);
      c.strokeStyle = U.css([110, 40, 30]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 11); c.lineTo(0, -4); c.stroke();
      for (var i = -1; i <= 1; i += 2) {
        c.save(); c.rotate(i * 0.7);
        c.beginPath(); c.ellipse(i * 4, -4, 4.5, 7.5, i * 0.4, 0, 6.3);
        c.fillStyle = U.css([120, 50, 44]); c.fill();
        c.strokeStyle = U.css([120, 45, 28]); c.lineWidth = 1; c.stroke();
        c.restore();
      }
      c.beginPath(); c.ellipse(0, -9, 3.6, 6.4, 0, 0, 6.3);
      c.fillStyle = U.css([130, 55, 52]); c.fill(); c.restore();
    },
    semente: function (c) {
      c.save(); c.translate(16, 16);
      c.beginPath(); c.ellipse(0, 2, 8, 10, 0, 0, 6.3);
      c.fillStyle = U.css([32, 55, 45]); c.fill();
      c.strokeStyle = U.css([28, 50, 28]); c.lineWidth = 1.3; c.stroke();
      c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(6, -13, 2, -14);
      c.quadraticCurveTo(-1, -12, 0, -8);
      c.fillStyle = U.css([48, 85, 62]); c.fill();
      c.beginPath(); c.ellipse(-3, -1, 2.4, 3.4, 0.3, 0, 6.3);
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.fill(); c.restore();
    },
    fruta: function (c) {
      c.save(); c.translate(16, 17);
      c.beginPath(); c.arc(0, 2, 9.5, 0, 6.3);
      var g = c.createRadialGradient(-3, -2, 1, 0, 2, 11);
      g.addColorStop(0, U.css([8, 78, 65])); g.addColorStop(1, U.css([2, 68, 48]));
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(60,20,20,0.5)'; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = U.css([100, 45, 30]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -7); c.lineTo(1, -12); c.stroke();
      c.beginPath(); c.ellipse(5, -11, 4.5, 2.6, -0.4, 0, 6.3);
      c.fillStyle = U.css([120, 50, 42]); c.fill(); c.restore();
    },
    bolo: function (c) {
      c.save(); c.translate(16, 18);
      c.fillStyle = U.css([32, 45, 42]); c.fillRect(-9, -2, 18, 10);
      c.fillStyle = U.css([36, 60, 55]); c.fillRect(-9, -6, 18, 5);
      c.beginPath(); c.moveTo(-9, -6);
      for (var i = 0; i <= 6; i++) c.lineTo(-9 + i * 3, -6 + (i % 2 ? 2.5 : 0));
      c.lineTo(9, -1); c.lineTo(-9, -1); c.closePath();
      c.fillStyle = U.css([42, 78, 62]); c.fill();
      c.strokeStyle = 'rgba(60,40,20,0.45)'; c.lineWidth = 1; c.strokeRect(-9, -6, 18, 14);
      c.beginPath(); c.arc(0, -7, 2.2, 0, 6.3); c.fillStyle = U.css([350, 70, 62]); c.fill();
      c.restore();
    },
    racao: function (c) {
      c.save(); c.translate(16, 16);
      c.fillStyle = U.css([30, 30, 38]);
      c.beginPath(); c.moveTo(-8, -9); c.lineTo(8, -9); c.lineTo(9, 11); c.lineTo(-9, 11); c.closePath(); c.fill();
      c.fillStyle = U.css([32, 40, 50]); c.fillRect(-7, -6, 14, 7);
      c.fillStyle = U.css([25, 45, 30]);
      for (var i = 0; i < 5; i++) {
        c.beginPath(); c.arc(-5 + (i % 3) * 5, 5 + Math.floor(i / 3) * 4, 2, 0, 6.3); c.fill();
      }
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
      c.strokeRect(-8, -9, 16, 20); c.restore();
    },
    geleia: function (c) {
      c.save(); c.translate(16, 17);
      c.beginPath();
      c.moveTo(-9, 8); c.quadraticCurveTo(-10, -6, 0, -9);
      c.quadraticCurveTo(10, -6, 9, 8); c.closePath();
      var g = c.createLinearGradient(0, -9, 0, 8);
      g.addColorStop(0, U.css([280, 70, 68, 1])); g.addColorStop(1, U.css([200, 70, 55]));
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.2; c.stroke();
      for (var i = 0; i < 4; i++) {
        c.beginPath(); c.arc(-5 + i * 3.4, -2 + (i % 2) * 4, 1.4, 0, 6.3);
        c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill();
      }
      c.restore();
    },
    escova: function (c) {
      c.save(); c.translate(16, 16); c.rotate(-0.35);
      c.fillStyle = U.css([28, 45, 40]);
      c.beginPath(); c.roundRect ? c.roundRect(-11, -4, 22, 8, 3) : c.rect(-11, -4, 22, 8);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1; c.stroke();
      c.strokeStyle = U.css([40, 30, 72]); c.lineWidth = 1.6;
      for (var i = 0; i < 7; i++) {
        c.beginPath(); c.moveTo(-9 + i * 3, 4); c.lineTo(-9 + i * 3, 10); c.stroke();
      }
      c.restore();
    },
    cristal: function (c) {
      c.save(); c.translate(16, 16);
      c.shadowColor = U.css([200, 80, 65]); c.shadowBlur = 8;
      c.beginPath(); c.moveTo(0, -12); c.lineTo(7, -2); c.lineTo(0, 12); c.lineTo(-7, -2); c.closePath();
      c.fillStyle = U.css([198, 65, 60], 0.92); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2; c.stroke();
      c.shadowBlur = 0;
      c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 12); c.lineTo(-7, -2); c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.fill();
      c.restore();
    },
    incenso: function (c) {
      c.save(); c.translate(16, 16);
      c.fillStyle = U.css([28, 35, 38]); c.fillRect(-8, 6, 16, 5);
      c.strokeStyle = U.css([30, 25, 55]); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -4); c.stroke();
      c.beginPath(); c.arc(0, -5, 1.6, 0, 6.3);
      c.fillStyle = U.css([15, 85, 60]); c.fill();
      c.strokeStyle = 'rgba(200,190,220,0.55)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(0, -7);
      c.bezierCurveTo(5, -10, -5, -12, 1, -15);
      c.bezierCurveTo(5, -17, -3, -18, 0, -20);
      c.stroke(); c.restore();
    },
    sino: function (c) {
      c.save(); c.translate(16, 15);
      c.beginPath();
      c.moveTo(-9, 7); c.quadraticCurveTo(-9, -8, 0, -9);
      c.quadraticCurveTo(9, -8, 9, 7); c.closePath();
      var g = c.createLinearGradient(-9, -9, 9, 7);
      g.addColorStop(0, U.css([45, 75, 62])); g.addColorStop(1, U.css([38, 60, 40]));
      c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(60,45,10,0.55)'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = U.css([40, 60, 48]); c.fillRect(-10, 7, 20, 3);
      c.beginPath(); c.arc(0, 12, 2.2, 0, 6.3); c.fillStyle = U.css([40, 50, 38]); c.fill();
      c.beginPath(); c.arc(0, -11, 2, 0, 6.3);
      c.strokeStyle = U.css([40, 55, 45]); c.lineWidth = 1.6; c.stroke();
      c.restore();
    },
    lente: function (c) {
      c.save(); c.translate(16, 16);
      c.strokeStyle = U.css([40, 45, 45]); c.lineWidth = 3;
      c.beginPath(); c.moveTo(4, 4); c.lineTo(11, 11); c.stroke();
      c.beginPath(); c.arc(-2, -2, 8.5, 0, 6.3);
      c.fillStyle = 'rgba(160,210,255,0.35)'; c.fill();
      c.strokeStyle = U.css([44, 60, 52]); c.lineWidth = 2.4; c.stroke();
      c.beginPath(); c.arc(-4.5, -5, 3, 0, 6.3);
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
      c.restore();
    },
    amuleto: function (c) {
      c.save(); c.translate(16, 16);
      c.strokeStyle = U.css([40, 30, 55]); c.lineWidth = 1.6;
      c.beginPath(); c.arc(0, -6, 7, Math.PI * 1.15, Math.PI * 1.85, true); c.stroke();
      c.shadowColor = U.css([38, 85, 58]); c.shadowBlur = 9;
      c.beginPath();
      c.moveTo(0, -4); c.lineTo(7, 2); c.lineTo(3, 11); c.lineTo(-3, 11); c.lineTo(-7, 2); c.closePath();
      c.fillStyle = U.css([36, 82, 55], 0.95); c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = 'rgba(255,240,180,0.7)'; c.lineWidth = 1.2; c.stroke();
      c.restore();
    },
    vara: function (c) {
      c.save(); c.translate(16, 16); c.rotate(-0.5);
      c.strokeStyle = U.css([32, 40, 42]); c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-10, 11); c.lineTo(8, -10); c.stroke();
      c.strokeStyle = 'rgba(230,235,245,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(8, -10); c.quadraticCurveTo(12, -2, 9, 5); c.stroke();
      c.beginPath(); c.arc(9, 6.5, 1.8, 0, 6.3);
      c.fillStyle = U.css([200, 60, 60]); c.fill();
      c.restore();
    }
  };

  A.canvasItem = function (icone) {
    if (ICACHE[icone]) return ICACHE[icone];
    var cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    var ctx = cv.getContext('2d');
    ctx.scale(2, 2);
    var fn = DESENHOS[icone] || DESENHOS.frasco1;
    try { fn(ctx); } catch (e) { /* ícone opcional */ }
    ICACHE[icone] = cv;
    return cv;
  };

  A.iconeItemURL = function (icone) {
    return A.canvasItem(icone).toDataURL();
  };

})(window.CRISALIDA);
