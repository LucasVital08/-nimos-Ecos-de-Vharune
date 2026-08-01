/* =========================================================================
   arte/mapa.js — Renderização procedural do mundo (tiles, água, ambiente)
   ---------------------------------------------------------------------
   Nenhum tileset externo. Cada tile é pintado com ruído determinístico,
   então o mesmo mapa é sempre idêntico, mas nenhum tile é igual ao vizinho.
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var A = G.Arte = G.Arte || {};
  var TS = A.TS = 32;

  /* Paletas de ambiente */
  var AMB = {
    vila:     { grama: [104, 34, 42], grama2: [96, 30, 36], terra: [34, 34, 52], pedra: [40, 10, 62] },
    campo:    { grama: [110, 36, 44], grama2: [100, 32, 37], terra: [34, 32, 50], pedra: [40, 10, 60] },
    floresta: { grama: [128, 34, 33], grama2: [136, 30, 27], terra: [28, 28, 40], pedra: [120, 8, 44] },
    lago:     { grama: [116, 34, 42], grama2: [106, 30, 36], terra: [36, 34, 52], pedra: [200, 10, 60] },
    montanha: { grama: [70, 18, 38], grama2: [60, 16, 32], terra: [24, 22, 40], pedra: [20, 12, 46] },
    ruinas:   { grama: [270, 12, 28], grama2: [262, 14, 24], terra: [268, 10, 32], pedra: [268, 10, 44] }
  };

  function n2(x, y, s) { return G.noise2(x, y, s); }

  /* ------------------------------------------------------------------ */
  /*  TERRENOS                                                           */
  /* ------------------------------------------------------------------ */

  function grama(ctx, px, py, x, y, pal, alta) {
    /* Cor de base vinda de ruído CONTÍNUO: manchas atravessam vários tiles
       em vez de criar um xadrez de quadrados. */
    var g1 = G.fbm(x * 0.16, y * 0.16, 11, 3);
    var g2 = G.fbm(x * 0.55, y * 0.55, 71, 2);
    var base = [
      pal.grama[0] + (g1 - 0.5) * 13,
      pal.grama[1] + (g2 - 0.5) * 12,
      pal.grama[2] + (g1 - 0.5) * 9 + (g2 - 0.5) * 4
    ];
    ctx.fillStyle = U.css(base);
    ctx.fillRect(px, py, TS, TS);

    /* gradiente interno para tirar a sensação de bloco chapado */
    var lg = ctx.createLinearGradient(px, py, px + TS, py + TS);
    lg.addColorStop(0, 'rgba(255,255,255,0.035)');
    lg.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = lg;
    ctx.fillRect(px, py, TS, TS);

    /* manchas suaves, também guiadas por ruído contínuo */
    var i, nx, ny, r;
    for (i = 0; i < 3; i++) {
      nx = px + n2(x, y, 20 + i) * TS;
      ny = py + n2(x, y, 40 + i) * TS;
      r = 5 + n2(x, y, 60 + i) * 9;
      ctx.beginPath(); ctx.ellipse(nx, ny, r, r * 0.66, 0, 0, 6.3);
      ctx.fillStyle = U.css(U.tom(pal.grama2, (G.fbm(x * 0.3 + i, y * 0.3, 80, 2) - 0.5) * 8), 0.22);
      ctx.fill();
    }
    /* tufos */
    ctx.strokeStyle = U.css(U.tom(pal.grama, -9), 0.65);
    ctx.lineWidth = 1.1;
    for (i = 0; i < 5; i++) {
      nx = px + n2(x, y, 100 + i) * TS;
      ny = py + 6 + n2(x, y, 120 + i) * (TS - 8);
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(nx + 1.5, ny - 3, nx + (n2(x, y, 140 + i) - 0.5) * 4, ny - 5.5);
      ctx.stroke();
    }
    if (alta) {
      /* lâminas altas: mais escuras na base, claras na ponta */
      for (i = 0; i < 11; i++) {
        nx = px + 1 + n2(x, y, 200 + i) * (TS - 2);
        ny = py + TS - 1;
        var h = 12 + n2(x, y, 220 + i) * 13;
        var curva = (n2(x, y, 240 + i) - 0.5) * 9;
        ctx.beginPath();
        ctx.moveTo(nx - 2.2, ny);
        ctx.quadraticCurveTo(nx + curva * 0.4, ny - h * 0.6, nx + curva, ny - h);
        ctx.quadraticCurveTo(nx + curva * 0.5, ny - h * 0.55, nx + 2.2, ny);
        ctx.closePath();
        var l = pal.grama2[2] + (i % 3) * 4;
        ctx.fillStyle = U.css([pal.grama2[0] + (n2(x, y, 260 + i) - 0.5) * 12, pal.grama2[1], l]);
        ctx.fill();
      }
    }
  }

  function terra(ctx, px, py, x, y, pal) {
    var v = G.fbm(x * 0.22, y * 0.22, 13, 3);
    ctx.fillStyle = U.css([pal.terra[0] + (v - 0.5) * 9, pal.terra[1] + (v - 0.5) * 10, pal.terra[2] + (v - 0.5) * 10]);
    ctx.fillRect(px, py, TS, TS);
    var lg = ctx.createLinearGradient(px, py, px + TS, py + TS);
    lg.addColorStop(0, 'rgba(255,255,255,0.03)');
    lg.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = lg;
    ctx.fillRect(px, py, TS, TS);
    var i;
    for (i = 0; i < 6; i++) {
      var nx = px + n2(x, y, 300 + i) * TS, ny = py + n2(x, y, 320 + i) * TS;
      var r = 0.9 + n2(x, y, 340 + i) * 2.1;
      ctx.beginPath(); ctx.ellipse(nx, ny, r, r * 0.8, 0, 0, 6.3);
      ctx.fillStyle = U.css(U.tom(pal.terra, n2(x, y, 360 + i) > 0.5 ? 8 : -8), 0.55);
      ctx.fill();
    }
  }

  function calcada(ctx, px, py, x, y, pal) {
    var v = G.fbm(x * 0.3, y * 0.3, 17, 2);
    ctx.fillStyle = U.css([pal.pedra[0], pal.pedra[1] + 3, pal.pedra[2] - 14 + (v - 0.5) * 11]);
    ctx.fillRect(px, py, TS, TS);
    /* musgo entre as lajes */
    if (v > 0.62) {
      ctx.fillStyle = U.css(U.tom(pal.grama, -6), 0.16);
      ctx.fillRect(px, py, TS, TS);
    }
    /* lajes 2x2 */
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.4;
    var meio = TS / 2, off = (x + y) % 2 ? 0 : meio * 0.5;
    ctx.beginPath();
    ctx.moveTo(px, py + meio); ctx.lineTo(px + TS, py + meio);
    ctx.moveTo(px + off + 0.5, py); ctx.lineTo(px + off + 0.5, py + meio);
    ctx.moveTo(px + meio - off + 0.5, py + meio); ctx.lineTo(px + meio - off + 0.5, py + TS);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(px, py, TS, 2);
  }

  function areia(ctx, px, py, x, y) {
    var v = n2(x, y, 19);
    ctx.fillStyle = U.css([44, 46, 76 + (v - 0.5) * 8]);
    ctx.fillRect(px, py, TS, TS);
    for (var i = 0; i < 14; i++) {
      var nx = px + n2(x, y, 400 + i) * TS, ny = py + n2(x, y, 430 + i) * TS;
      ctx.fillStyle = 'rgba(150,120,80,' + (0.10 + n2(x, y, 460 + i) * 0.16).toFixed(2) + ')';
      ctx.fillRect(nx, ny, 1.6, 1.6);
    }
  }

  function pisoRuina(ctx, px, py, x, y, pal) {
    var v = n2(x, y, 23);
    ctx.fillStyle = U.css([pal.pedra[0], pal.pedra[1], pal.pedra[2] + (v - 0.5) * 10]);
    ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
    /* rachaduras */
    if (v > 0.45) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath();
      var sx = px + n2(x, y, 500) * TS, sy = py;
      ctx.moveTo(sx, sy);
      for (var k = 1; k <= 3; k++) {
        sx += (n2(x, y, 510 + k) - 0.5) * 12;
        sy += TS / 3;
        ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fillRect(px + 1, py + 1, TS - 2, 2);
  }

  /* ------------------------------------------------------------------ */
  /*  OBJETOS                                                            */
  /* ------------------------------------------------------------------ */

  function arvore(ctx, px, py, x, y, pal, escura) {
    var v = n2(x, y, 29);
    var cx = px + TS / 2 + (v - 0.5) * 4, base = py + TS - 2;
    /* sombra */
    ctx.beginPath(); ctx.ellipse(cx, base - 1, TS * 0.42, TS * 0.14, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(15,20,15,0.28)'; ctx.fill();
    /* tronco */
    ctx.fillStyle = U.css([26, 30, 26]);
    ctx.beginPath();
    ctx.moveTo(cx - 3.5, base);
    ctx.lineTo(cx - 2.6, base - 13);
    ctx.lineTo(cx + 2.6, base - 13);
    ctx.lineTo(cx + 3.5, base);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx - 3.2, base - 13, 1.6, 13);
    /* copa em camadas */
    var hb = escura ? -6 : 0;
    var cores = [
      [pal.grama[0] - 4, pal.grama[1] + 8, pal.grama[2] - 14 + hb],
      [pal.grama[0], pal.grama[1] + 10, pal.grama[2] - 7 + hb],
      [pal.grama[0] + 6, pal.grama[1] + 12, pal.grama[2] + 1 + hb]
    ];
    var cy = base - 20;
    for (var i = 0; i < 3; i++) {
      var r = TS * (0.46 - i * 0.07);
      ctx.beginPath();
      for (var k = 0; k < 9; k++) {
        var a = (k / 9) * Math.PI * 2;
        var rr = r * (1 + (n2(x + k, y, 600 + i) - 0.5) * 0.30);
        var ax = cx + Math.cos(a) * rr, ay = cy - i * 5 + Math.sin(a) * rr * 0.82;
        if (k === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
      }
      ctx.closePath();
      ctx.fillStyle = U.css(cores[i]);
      ctx.fill();
    }
    /* brilho de folhas */
    ctx.fillStyle = 'rgba(255,255,200,0.13)';
    for (var j = 0; j < 4; j++) {
      var lx = cx - 8 + n2(x, y, 640 + j) * 16, ly = cy - 10 + n2(x, y, 660 + j) * 14;
      ctx.beginPath(); ctx.ellipse(lx, ly, 2.6, 1.8, 0.5, 0, 6.3); ctx.fill();
    }
  }

  function arbusto(ctx, px, py, x, y, pal) {
    var cx = px + TS / 2, cy = py + TS * 0.62;
    ctx.beginPath(); ctx.ellipse(cx, py + TS - 4, TS * 0.34, TS * 0.11, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(15,20,15,0.25)'; ctx.fill();
    for (var i = 0; i < 3; i++) {
      var ox = (i - 1) * 7, r = TS * (0.30 - Math.abs(i - 1) * 0.05);
      ctx.beginPath(); ctx.ellipse(cx + ox, cy - Math.abs(i - 1) * 2, r, r * 0.86, 0, 0, 6.3);
      ctx.fillStyle = U.css([pal.grama[0] + i * 3, pal.grama[1] + 10, pal.grama[2] - 10 + i * 3]);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,210,0.14)';
    ctx.beginPath(); ctx.ellipse(cx - 4, cy - 7, 4, 2.6, 0.4, 0, 6.3); ctx.fill();
  }

  function rocha(ctx, px, py, x, y) {
    var cx = px + TS / 2, base = py + TS - 3;
    ctx.beginPath(); ctx.ellipse(cx, base, TS * 0.36, TS * 0.12, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(15,15,20,0.26)'; ctx.fill();
    var pts = [], k;
    for (k = 0; k < 7; k++) {
      var a = (k / 7) * Math.PI * 2 - 1.6;
      var r = TS * 0.36 * (1 + (n2(x + k, y, 700) - 0.5) * 0.4);
      pts.push([cx + Math.cos(a) * r, base - 9 + Math.sin(a) * r * 0.85]);
    }
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fillStyle = U.css([220, 8, 44]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pts[5][0], pts[5][1]); ctx.lineTo(pts[6][0], pts[6][1]);
    ctx.lineTo(pts[0][0], pts[0][1]); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fill();
  }

  function penhasco(ctx, px, py, x, y, cimaLivre) {
    var v = n2(x, y, 31);
    ctx.fillStyle = U.css([24, 14, 28 + (v - 0.5) * 8]);
    ctx.fillRect(px, py, TS, TS);
    /* estrias verticais */
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 1.4;
    for (var i = 0; i < 4; i++) {
      var lx = px + 3 + n2(x, y, 720 + i) * (TS - 6);
      ctx.beginPath(); ctx.moveTo(lx, py); ctx.lineTo(lx + (n2(x, y, 740 + i) - 0.5) * 5, py + TS);
      ctx.stroke();
    }
    if (cimaLivre) {
      ctx.fillStyle = U.css([26, 18, 40]);
      ctx.fillRect(px, py, TS, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(px, py, TS, 3);
    }
  }

  function parede(ctx, px, py, x, y) {
    ctx.fillStyle = U.css([34, 16, 68]);
    ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = 'rgba(120,100,80,0.35)'; ctx.lineWidth = 1;
    var lh = TS / 3;
    for (var r = 0; r < 3; r++) {
      var yy = py + r * lh;
      ctx.beginPath(); ctx.moveTo(px, yy + lh); ctx.lineTo(px + TS, yy + lh); ctx.stroke();
      var off = (r % 2) * (TS / 2);
      ctx.beginPath(); ctx.moveTo(px + off, yy); ctx.lineTo(px + off, yy + lh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + off + TS / 2, yy); ctx.lineTo(px + off + TS / 2, yy + lh); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(px, py + TS - 4, TS, 4);
  }

  function telhado(ctx, px, py, x, y, escuro) {
    var c = escuro ? [352, 34, 32] : [8, 52, 44];
    ctx.fillStyle = U.css(c);
    ctx.fillRect(px, py, TS, TS);
    /* telhas */
    for (var r = 0; r < 4; r++) {
      var yy = py + r * (TS / 4);
      var off = (r % 2) * 8;
      for (var k = -1; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(px + off + k * 16 + 8, yy + 8, 8, Math.PI, 0);
        ctx.fillStyle = U.css(U.tom(c, r % 2 ? 4 : -3));
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.9; ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(px, py, TS, 3);
  }

  function porta(ctx, px, py) {
    parede(ctx, px, py, 0, 0);
    ctx.fillStyle = U.css([26, 40, 26]);
    ctx.fillRect(px + 5, py + 6, TS - 10, TS - 6);
    ctx.fillStyle = U.css([26, 34, 34]);
    ctx.fillRect(px + 7, py + 8, TS - 14, TS - 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(px + 5.5, py + 6.5, TS - 11, TS - 7);
    ctx.fillStyle = U.css([45, 70, 60]);
    ctx.beginPath(); ctx.arc(px + TS - 11, py + 20, 2, 0, 6.3); ctx.fill();
    /* lampião */
    ctx.fillStyle = 'rgba(255,220,140,0.85)';
    ctx.beginPath(); ctx.arc(px + 6, py + 5, 3, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,110,0.20)';
    ctx.beginPath(); ctx.arc(px + 6, py + 5, 8, 0, 6.3); ctx.fill();
  }

  function placa(ctx, px, py, pal) {
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 4, 9, 3.5, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(15,15,20,0.25)'; ctx.fill();
    ctx.fillStyle = U.css([28, 34, 30]);
    ctx.fillRect(px + TS / 2 - 2, py + 14, 4, TS - 18);
    ctx.fillStyle = U.css([32, 40, 44]);
    ctx.fillRect(px + 4, py + 6, TS - 8, 13);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(px + 4.5, py + 6.5, TS - 9, 12);
    ctx.strokeStyle = 'rgba(240,230,200,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 7, py + 11); ctx.lineTo(px + TS - 7, py + 11);
    ctx.moveTo(px + 7, py + 15); ctx.lineTo(px + TS - 10, py + 15);
    ctx.stroke();
  }

  function flores(ctx, px, py, x, y, pal) {
    grama(ctx, px, py, x, y, pal, false);
    var cores = [[350, 70, 68], [45, 85, 66], [280, 55, 68], [200, 60, 68]];
    for (var i = 0; i < 5; i++) {
      var fx = px + 5 + n2(x, y, 800 + i) * (TS - 10);
      var fy = py + 6 + n2(x, y, 820 + i) * (TS - 12);
      var c = cores[Math.floor(n2(x, y, 840 + i) * cores.length) % cores.length];
      ctx.strokeStyle = U.css([110, 40, 32]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx, fy + 5); ctx.lineTo(fx, fy); ctx.stroke();
      for (var k = 0; k < 5; k++) {
        var a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * 2.2, fy + Math.sin(a) * 2.2, 1.7, 1.7, 0, 0, 6.3);
        ctx.fillStyle = U.css(c); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(fx, fy, 1.3, 0, 6.3);
      ctx.fillStyle = U.css([48, 90, 70]); ctx.fill();
    }
  }

  function ponte(ctx, px, py, x, y) {
    ctx.fillStyle = U.css([28, 32, 40]);
    ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2;
    for (var i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(px + i * (TS / 4), py); ctx.lineTo(px + i * (TS / 4), py + TS); ctx.stroke();
    }
    ctx.fillStyle = U.css([28, 30, 48]);
    ctx.fillRect(px, py + 1, TS, 4);
    ctx.fillRect(px, py + TS - 5, TS, 4);
  }

  function cerca(ctx, px, py) {
    ctx.fillStyle = U.css([30, 30, 42]);
    ctx.fillRect(px + 4, py + 10, 4, TS - 12);
    ctx.fillRect(px + TS - 8, py + 10, 4, TS - 12);
    ctx.fillRect(px, py + 14, TS, 3.5);
    ctx.fillRect(px, py + 22, TS, 3.5);
  }

  function poste(ctx, px, py) {
    ctx.fillStyle = U.css([220, 8, 32]);
    ctx.fillRect(px + TS / 2 - 2, py + 10, 4, TS - 12);
    ctx.fillStyle = U.css([40, 30, 40]);
    ctx.beginPath(); ctx.arc(px + TS / 2, py + 8, 5.5, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,150,0.95)';
    ctx.beginPath(); ctx.arc(px + TS / 2, py + 8, 3.4, 0, 6.3); ctx.fill();
    var g = ctx.createRadialGradient(px + TS / 2, py + 8, 2, px + TS / 2, py + 8, 22);
    g.addColorStop(0, 'rgba(255,215,140,0.30)');
    g.addColorStop(1, 'rgba(255,215,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 12, py - 12, TS + 24, TS + 24);
  }

  function engradado(ctx, px, py) {
    ctx.fillStyle = U.css([30, 36, 40]);
    ctx.fillRect(px + 3, py + 5, TS - 6, TS - 8);
    ctx.strokeStyle = U.css([28, 30, 28]); ctx.lineWidth = 2;
    ctx.strokeRect(px + 3.5, py + 5.5, TS - 7, TS - 9);
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 6); ctx.lineTo(px + TS - 4, py + TS - 4);
    ctx.moveTo(px + TS - 4, py + 6); ctx.lineTo(px + 4, py + TS - 4);
    ctx.stroke();
  }

  function toco(ctx, px, py, pal) {
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 6, 10, 4, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(15,20,15,0.22)'; ctx.fill();
    ctx.fillStyle = U.css([28, 30, 28]);
    ctx.fillRect(px + TS / 2 - 8, py + TS - 16, 16, 11);
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 16, 8, 4, 0, 0, 6.3);
    ctx.fillStyle = U.css([30, 34, 44]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 16, 4.5, 2.2, 0, 0, 6.3); ctx.stroke();
  }

  function pilar(ctx, px, py, x, y) {
    var cx = px + TS / 2, base = py + TS - 3;
    ctx.beginPath(); ctx.ellipse(cx, base, 11, 4, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(10,8,18,0.32)'; ctx.fill();
    var h = 16 + n2(x, y, 900) * 12;
    ctx.fillStyle = U.css([268, 8, 52]);
    ctx.fillRect(cx - 8, base - h, 16, h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(cx - 8, base - h, 4, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(cx + 4, base - h, 4, h);
    ctx.fillStyle = U.css([268, 8, 58]);
    ctx.fillRect(cx - 11, base - 4, 22, 5);
    ctx.beginPath();
    ctx.moveTo(cx - 8, base - h);
    ctx.lineTo(cx + 8, base - h + 2);
    ctx.lineTo(cx + 6, base - h - 3);
    ctx.lineTo(cx - 5, base - h - 1);
    ctx.closePath();
    ctx.fillStyle = U.css([268, 8, 46]); ctx.fill();
  }

  function cristal(ctx, px, py, x, y) {
    var cx = px + TS / 2, base = py + TS - 4;
    var g = ctx.createRadialGradient(cx, base - 12, 2, cx, base - 12, 26);
    g.addColorStop(0, 'rgba(190,150,255,0.35)');
    g.addColorStop(1, 'rgba(190,150,255,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 14, py - 14, TS + 28, TS + 28);
    for (var i = -1; i <= 1; i++) {
      var h = 22 - Math.abs(i) * 8, w = 6 - Math.abs(i) * 1.6;
      var ox = i * 8;
      ctx.beginPath();
      ctx.moveTo(cx + ox - w, base);
      ctx.lineTo(cx + ox, base - h);
      ctx.lineTo(cx + ox + w, base);
      ctx.closePath();
      ctx.fillStyle = U.css([272, 60, 62 + Math.abs(i) * 6], 0.9); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + ox - w, base); ctx.lineTo(cx + ox, base - h); ctx.lineTo(cx + ox, base);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fill();
    }
  }

  function nevoaEter(ctx, px, py, x, y, pal) {
    pisoRuina(ctx, px, py, x, y, pal);
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var nx = px + n2(x, y, 950 + i) * TS, ny = py + n2(x, y, 970 + i) * TS;
      var r = 8 + n2(x, y, 990 + i) * 10;
      var g = ctx.createRadialGradient(nx, ny, 1, nx, ny, r);
      g.addColorStop(0, 'rgba(180,140,255,0.30)');
      g.addColorStop(1, 'rgba(180,140,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(nx - r, ny - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  MAPA ESTÁTICO                                                      */
  /* ------------------------------------------------------------------ */

  function base(ctx, px, py, x, y, pal, amb) {
    if (amb === 'ruinas') pisoRuina(ctx, px, py, x, y, pal);
    else if (amb === 'montanha') terra(ctx, px, py, x, y, pal);
    else grama(ctx, px, py, x, y, pal, false);
  }

  /* A camada estática é pintada no dobro da resolução: como o mapa é ampliado
     na tela (sobretudo no celular), isso mantém tudo nítido. */
  A.SUPER = 2;

  function ehAgua(mapa, x, y) {
    if (y < 0 || y >= mapa.alt || x < 0 || x >= mapa.larg) return true;
    var t = mapa.grade[y][x];
    return t === '~' || t === 'w' || t === 'W';
  }

  A.renderizarMapa = function (mapa) {
    var pal = AMB[mapa.ambiente] || AMB.campo;
    var S = A.SUPER;
    var cv = document.createElement('canvas');
    cv.width = mapa.larg * TS * S;
    cv.height = mapa.alt * TS * S;
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);
    ctx.imageSmoothingEnabled = true;

    var aguas = [];
    var x, y, t, px, py;

    /* passo 1 — chão */
    for (y = 0; y < mapa.alt; y++) {
      for (x = 0; x < mapa.larg; x++) {
        t = mapa.grade[y][x];
        px = x * TS; py = y * TS;
        switch (t) {
          case ',': grama(ctx, px, py, x, y, pal, false); break;
          case '.': grama(ctx, px, py, x, y, pal, false); break;
          case '-': terra(ctx, px, py, x, y, pal); break;
          case '=': calcada(ctx, px, py, x, y, pal); break;
          case 's': areia(ctx, px, py, x, y); break;
          case 'F': base(ctx, px, py, x, y, pal, mapa.ambiente); break;
          case 't': pisoRuina(ctx, px, py, x, y, pal); break;
          case ':': pisoRuina(ctx, px, py, x, y, pal); break;
          case 'p': base(ctx, px, py, x, y, pal, mapa.ambiente); break;
          case '~': case 'w': case 'W': {
            areia(ctx, px, py, x, y);
            /* máscara das margens: 1 cima, 2 baixo, 4 esquerda, 8 direita */
            var m = 0;
            if (!ehAgua(mapa, x, y - 1)) m |= 1;
            if (!ehAgua(mapa, x, y + 1)) m |= 2;
            if (!ehAgua(mapa, x - 1, y)) m |= 4;
            if (!ehAgua(mapa, x + 1, y)) m |= 8;
            aguas.push([x, y, t, m]);
            break;
          }
          case '_': ctx.fillStyle = '#0b0a10'; ctx.fillRect(px, py, TS, TS); break;
          default: base(ctx, px, py, x, y, pal, mapa.ambiente);
        }
      }
    }

    /* passo 2 — objetos e detalhes */
    for (y = 0; y < mapa.alt; y++) {
      for (x = 0; x < mapa.larg; x++) {
        t = mapa.grade[y][x];
        px = x * TS; py = y * TS;
        switch (t) {
          case ',': grama(ctx, px, py, x, y, pal, true); break;
          case ':': nevoaEter(ctx, px, py, x, y, pal); break;
          case 'F': flores(ctx, px, py, x, y, pal); break;
          case 'T': arvore(ctx, px, py, x, y, pal, mapa.ambiente === 'floresta'); break;
          case 'Y': arbusto(ctx, px, py, x, y, pal); break;
          case 'R': rocha(ctx, px, py, x, y); break;
          case 'M': penhasco(ctx, px, py, x, y, y > 0 && !!G.ANDAVEL[mapa.grade[y - 1][x]]); break;
          case '#': parede(ctx, px, py, x, y); break;
          case 'B': telhado(ctx, px, py, x, y, false); break;
          case 'b': telhado(ctx, px, py, x, y, true); break;
          case 'D': porta(ctx, px, py); break;
          case 'G': placa(ctx, px, py, pal); break;
          case 'P': pilar(ctx, px, py, x, y); break;
          case 'p': ponte(ctx, px, py, x, y); break;
          case 'f': cerca(ctx, px, py); break;
          case 'L': poste(ctx, px, py); break;
          case 'c': engradado(ctx, px, py); break;
          case 'n': toco(ctx, px, py, pal); break;
          case 'x': cristal(ctx, px, py, x, y); break;
        }
      }
    }

    /* passo 3 — sombras de contato nas bordas de blocos */
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (y = 1; y < mapa.alt; y++) {
      for (x = 0; x < mapa.larg; x++) {
        if (!G.ANDAVEL[mapa.grade[y][x]]) continue;
        var acima = mapa.grade[y - 1][x];
        if (!G.ANDAVEL[acima] && acima !== '~' && acima !== 'w') {
          var g = ctx.createLinearGradient(0, y * TS, 0, y * TS + 10);
          g.addColorStop(0, 'rgba(0,0,0,0.9)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x * TS, y * TS, TS, 10);
        }
      }
    }
    ctx.restore();

    /* passo 4 — clima do ambiente */
    var clima = {
      ruinas: 'rgba(120,90,190,0.16)',
      floresta: 'rgba(60,90,60,0.14)',
      montanha: 'rgba(120,120,150,0.12)'
    }[mapa.ambiente];
    if (clima) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = clima;
      ctx.fillRect(0, 0, mapa.larg * TS, mapa.alt * TS);
      ctx.restore();
    }

    return { canvas: cv, aguas: aguas, pal: pal, escala: S };
  };

  /* ------------------------- água animada --------------------------- */
  A.desenharAgua = function (ctx, x, y, tipo, t, bordas) {
    var px = x * TS, py = y * TS;
    var raso = tipo === 'w';
    var fundo = raso ? [194, 58, 54] : [209, 64, 34];
    /* variação contínua: nada de xadrez entre tiles vizinhos */
    var v = G.fbm(x * 0.28, y * 0.28, 37, 2);
    ctx.fillStyle = U.css([fundo[0] + (v - 0.5) * 8, fundo[1], fundo[2] + (v - 0.5) * 8]);
    ctx.fillRect(px, py, TS, TS);

    /* profundidade */
    var g = ctx.createLinearGradient(px, py, px, py + TS);
    g.addColorStop(0, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(0,20,50,0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, TS, TS);

    /* ondulações */
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (var i = 0; i < 2; i++) {
      var fase = t * 0.0016 + (x * 0.7 + y * 1.3) + i * 2.1;
      var oy = py + 8 + i * 13 + Math.sin(fase) * 2.4;
      var ox = px + 4 + ((Math.sin(fase * 0.8) + 1) * 0.5) * 10;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(ox + 5, oy - 2.2, ox + 10, oy);
      ctx.stroke();
    }

    /* espuma na margem: uma faixa clara suave que desfaz a borda reta */
    if (bordas) {
      var pulso = 0.8 + (Math.sin(t * 0.0021 + x * 0.9 + y * 0.6) * 0.5 + 0.5) * 1.4;
      var faixa = 7;
      ctx.save();
      var lados = [
        [1, 0, -1], /* cima */
        [2, 0, 1],  /* baixo */
        [4, -1, 0], /* esquerda */
        [8, 1, 0]   /* direita */
      ];
      lados.forEach(function (l) {
        if (!(bordas & l[0])) return;
        var dx = l[1], dy = l[2];
        var x0 = px + (dx > 0 ? TS - faixa : 0);
        var y0 = py + (dy > 0 ? TS - faixa : 0);
        var w = dx ? faixa : TS;
        var h = dy ? faixa : TS;
        var gg = dx
          ? ctx.createLinearGradient(px + (dx > 0 ? TS : 0), 0, px + (dx > 0 ? TS - faixa : faixa), 0)
          : ctx.createLinearGradient(0, py + (dy > 0 ? TS : 0), 0, py + (dy > 0 ? TS - faixa : faixa));
        gg.addColorStop(0, 'rgba(255,255,255,0.34)');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(x0, y0, w, h);

        /* leve linha de arrebentação, quase transparente */
        ctx.strokeStyle = 'rgba(255,255,255,0.26)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (var k = 0; k <= 5; k++) {
          var f = k / 5;
          var cx = dx ? px + (dx > 0 ? TS : 0) : px + TS * f;
          var cy = dy ? py + (dy > 0 ? TS : 0) : py + TS * f;
          var d = (Math.sin(f * 6.2 + t * 0.0026 + x + y) * 0.5 + 0.5) * pulso + 1.4;
          if (dx) { cx -= d * dx; cy = py + TS * f; }
          else { cy -= d * dy; }
          if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      });
      ctx.restore();
    }

    if (raso) {
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(px, py, TS, TS);
    }
  };

  A.AMBIENTES = AMB;

})(window.CRISALIDA);
