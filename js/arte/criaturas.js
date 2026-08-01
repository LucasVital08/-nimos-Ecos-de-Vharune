/* =========================================================================
   arte/criaturas.js — Renderizador procedural de Ânimos
   ---------------------------------------------------------------------
   Nenhum asset externo: cada criatura é desenhada em tempo de execução a
   partir do seu arquétipo + paleta + variação individual (matiz, padrão,
   porte, prismático). Dois indivíduos da mesma espécie NUNCA saem iguais.
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var A = G.Arte = G.Arte || {};
  var CACHE = {};
  var CACHE_ORDEM = [];
  var CACHE_MAX = 220;

  var LADO = 132;      /* px do canvas offscreen */
  var ESC = LADO / 100; /* espaço lógico 100x100 */

  /* ------------------------------ helpers ----------------------------- */
  function el(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2);
  }
  function pintar(ctx, cor, contorno, lw) {
    ctx.fillStyle = cor;
    ctx.fill();
    if (contorno) { ctx.strokeStyle = contorno; ctx.lineWidth = lw || 2.2; ctx.stroke(); }
  }
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function pata(ctx, x, y, w, h, cor, cont) {
    ctx.beginPath();
    var r = w * 0.5;
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y + h - r);
    ctx.quadraticCurveTo(x - w / 2, y + h, x - w / 2 + r, y + h);
    ctx.lineTo(x + w / 2 - r, y + h);
    ctx.quadraticCurveTo(x + w / 2, y + h, x + w / 2, y + h - r);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    pintar(ctx, cor, cont, 2);
  }

  /* Blob orgânico com ondulação determinística */
  function blob(ctx, cx, cy, rx, ry, ondas, amp, rnd) {
    var n = 22, i, ang, r1, r2, x, y;
    ctx.beginPath();
    for (i = 0; i <= n; i++) {
      ang = (i / n) * Math.PI * 2;
      r1 = rx * (1 + Math.sin(ang * ondas + amp) * 0.09);
      r2 = ry * (1 + Math.cos(ang * (ondas + 1) + amp * 1.7) * 0.09);
      x = cx + Math.cos(ang) * r1;
      y = cy + Math.sin(ang) * r2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* --------------------------- paleta individual ----------------------- */
  function montarPaleta(art, v) {
    var dh = v.matiz || 0, ds = 0, dl = 0;
    if (v.prismatico) { dh += 168; ds += 18; dl += 6; }
    function c(base, extraL) {
      return [base[0] + dh, U.clamp(base[1] + ds, 0, 100), U.clamp(base[2] + dl + (extraL || 0), 0, 100)];
    }
    var p = {
      c1: c(art.c1),
      c2: c(art.c2),
      c3: c(art.c3),
      olho: art.olho.slice()
    };
    p.claro = U.tom(p.c1, 16, -4);
    p.escuro = U.tom(p.c1, -16, 4);
    p.linha = [p.c1[0], U.clamp(p.c1[1] * 0.75, 0, 100), 13];
    p.CL = U.css(p.claro);
    p.C1 = U.css(p.c1);
    p.C2 = U.css(p.c2);
    p.C3 = U.css(p.c3);
    p.CE = U.css(p.escuro);
    p.LN = U.css(p.linha);
    p.OL = U.css(p.olho);
    return p;
  }

  /* ============================= PARTES ================================ */

  function desenharOlhos(ctx, P, o, cab, rnd) {
    var tipo = o.olhos || 'redondo';
    var r = cab.r;
    var ox = cab.x + r * 0.34, oy = cab.y - r * 0.10;
    var ox2 = cab.x - r * 0.32, oy2 = cab.y - r * 0.04;

    function globo(x, y, rr, forma) {
      if (forma === 'fenda') {
        el(ctx, x, y, rr * 1.05, rr * 1.15, 0); pintar(ctx, P.OL, P.LN, 1.6);
        el(ctx, x, y, rr * 0.30, rr * 0.95, 0); pintar(ctx, '#12101a', null);
      } else if (forma === 'brilho') {
        ctx.save();
        ctx.shadowColor = P.OL; ctx.shadowBlur = 8;
        el(ctx, x, y, rr * 1.05, rr * 1.05, 0); pintar(ctx, P.OL, null);
        ctx.restore();
        el(ctx, x, y, rr * 0.45, rr * 0.45, 0); pintar(ctx, '#ffffff', null);
      } else if (forma === 'composto') {
        el(ctx, x, y, rr * 1.25, rr * 1.05, -0.25); pintar(ctx, U.css(P.olho, 0.95), P.LN, 1.6);
        ctx.save(); ctx.globalAlpha = 0.35;
        for (var i = -1; i <= 1; i++) {
          el(ctx, x + i * rr * 0.5, y, rr * 0.22, rr * 0.85, -0.25); pintar(ctx, '#ffffff', null);
        }
        ctx.restore();
      } else if (forma === 'felino') {
        el(ctx, x, y, rr * 1.1, rr * 1.0, -0.18); pintar(ctx, '#f7f4ee', P.LN, 1.6);
        el(ctx, x + rr * 0.08, y, rr * 0.32, rr * 0.82, 0); pintar(ctx, '#151220', null);
        el(ctx, x - rr * 0.2, y - rr * 0.3, rr * 0.2, rr * 0.2, 0); pintar(ctx, '#ffffff', null);
      } else {
        el(ctx, x, y, rr, rr * 1.06, 0); pintar(ctx, '#f7f4ee', P.LN, 1.6);
        el(ctx, x + rr * 0.12, y + rr * 0.05, rr * 0.5, rr * 0.5, 0); pintar(ctx, '#151220', null);
        el(ctx, x - rr * 0.15, y - rr * 0.3, rr * 0.22, rr * 0.22, 0); pintar(ctx, '#ffffff', null);
      }
    }

    if (tipo === 'multiplos') {
      var n = 4 + Math.floor(rnd() * 3), i;
      for (i = 0; i < n; i++) {
        var a = rnd() * Math.PI * 2, d = r * (0.15 + rnd() * 0.55);
        globo(cab.x + Math.cos(a) * d, cab.y + Math.sin(a) * d * 0.8, r * (0.13 + rnd() * 0.1), 'brilho');
      }
      return;
    }
    if (tipo === 'vazio') return;
    globo(ox, oy, r * 0.26, tipo);
    globo(ox2, oy2, r * 0.22, tipo);
  }

  function desenharBoca(ctx, P, o, cab) {
    var t = o.boca || 'nenhuma';
    var bx = cab.x + cab.r * 0.42, by = cab.y + cab.r * 0.48;
    ctx.lineCap = 'round';
    if (t === 'sorriso') {
      ctx.beginPath();
      ctx.moveTo(bx - cab.r * 0.22, by);
      ctx.quadraticCurveTo(bx, by + cab.r * 0.28, bx + cab.r * 0.24, by - cab.r * 0.02);
      ctx.strokeStyle = P.LN; ctx.lineWidth = 1.8; ctx.stroke();
    } else if (t === 'presas') {
      ctx.beginPath();
      ctx.moveTo(bx - cab.r * 0.28, by);
      ctx.lineTo(bx + cab.r * 0.34, by);
      ctx.strokeStyle = P.LN; ctx.lineWidth = 2; ctx.stroke();
      poly(ctx, [[bx - cab.r * 0.14, by], [bx - cab.r * 0.02, by], [bx - cab.r * 0.08, by + cab.r * 0.24]]);
      pintar(ctx, '#fdfbf5', null);
      poly(ctx, [[bx + cab.r * 0.14, by], [bx + cab.r * 0.26, by], [bx + cab.r * 0.20, by + cab.r * 0.24]]);
      pintar(ctx, '#fdfbf5', null);
    } else if (t === 'bico') {
      poly(ctx, [[cab.x + cab.r * 0.62, cab.y + cab.r * 0.02],
                 [cab.x + cab.r * 1.55, cab.y + cab.r * 0.30],
                 [cab.x + cab.r * 0.60, cab.y + cab.r * 0.52]]);
      pintar(ctx, P.C3, P.LN, 1.8);
    }
  }

  function desenharCrista(ctx, P, o, cab, rnd) {
    var t = o.crista || 'nenhuma', i, a;
    if (t === 'nenhuma') return;
    if (t === 'folha') {
      for (i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(cab.x - cab.r * 0.15, cab.y - cab.r * 0.78);
        ctx.rotate(i * 0.55 - 0.15);
        el(ctx, 0, -cab.r * 0.62, cab.r * 0.26, cab.r * 0.72, 0);
        pintar(ctx, i === 0 ? P.C3 : U.css(U.tom(P.c3, -6)), P.LN, 1.8);
        ctx.beginPath(); ctx.moveTo(0, -cab.r * 0.05); ctx.lineTo(0, -cab.r * 1.22);
        ctx.strokeStyle = P.LN; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.restore();
      }
    } else if (t === 'chama') {
      ctx.save();
      ctx.shadowColor = P.C3; ctx.shadowBlur = 12;
      for (i = 0; i < 3; i++) {
        var h = cab.r * (1.5 - i * 0.32), w = cab.r * (0.42 - i * 0.09);
        poly(ctx, [[cab.x - w, cab.y - cab.r * 0.55],
                   [cab.x + w * 0.4, cab.y - cab.r * 0.62],
                   [cab.x - w * 0.15 + i * 2, cab.y - cab.r * 0.55 - h]]);
        pintar(ctx, i === 0 ? P.C1 : (i === 1 ? P.C3 : '#fff6d0'), null);
      }
      ctx.restore();
    } else if (t === 'espinhos') {
      for (i = 0; i < 4; i++) {
        var px = cab.x - cab.r * 0.75 + i * cab.r * 0.42;
        poly(ctx, [[px - cab.r * 0.14, cab.y - cab.r * 0.72],
                   [px + cab.r * 0.14, cab.y - cab.r * 0.72],
                   [px, cab.y - cab.r * (1.05 + (i % 2) * 0.28)]]);
        pintar(ctx, P.C3, P.LN, 1.6);
      }
    } else if (t === 'cristal') {
      for (i = 0; i < 3; i++) {
        a = -0.5 + i * 0.5;
        ctx.save();
        ctx.translate(cab.x - cab.r * 0.1 + i * cab.r * 0.35 - cab.r * 0.35, cab.y - cab.r * 0.6);
        ctx.rotate(a * 0.4);
        poly(ctx, [[-cab.r * 0.16, 0], [0, -cab.r * (1.0 - i * 0.16)], [cab.r * 0.16, 0], [0, cab.r * 0.12]]);
        ctx.save(); ctx.shadowColor = P.C3; ctx.shadowBlur = 9;
        pintar(ctx, U.css(P.c3, 0.9), P.LN, 1.5);
        ctx.restore();
        ctx.restore();
      }
    } else if (t === 'chifres') {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(cab.x + i * cab.r * 0.52, cab.y - cab.r * 0.62);
        ctx.quadraticCurveTo(cab.x + i * cab.r * 1.15, cab.y - cab.r * 1.15,
                             cab.x + i * cab.r * 0.72, cab.y - cab.r * 1.55);
        ctx.quadraticCurveTo(cab.x + i * cab.r * 0.62, cab.y - cab.r * 1.0,
                             cab.x + i * cab.r * 0.28, cab.y - cab.r * 0.66);
        ctx.closePath();
        pintar(ctx, P.C3, P.LN, 1.8);
      }
    } else if (t === 'pena') {
      for (i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(cab.x - cab.r * 0.2, cab.y - cab.r * 0.7);
        ctx.rotate(-0.9 + i * 0.42);
        el(ctx, 0, -cab.r * 0.5, cab.r * 0.15, cab.r * 0.62, 0);
        pintar(ctx, P.C3, P.LN, 1.5);
        ctx.restore();
      }
    } else if (t === 'halo') {
      ctx.save();
      ctx.shadowColor = P.C3; ctx.shadowBlur = 14;
      el(ctx, cab.x, cab.y - cab.r * 1.25, cab.r * 0.92, cab.r * 0.26, 0);
      ctx.strokeStyle = U.css(P.c3, 0.95); ctx.lineWidth = 2.6; ctx.stroke();
      ctx.restore();
    } else if (t === 'onda') {
      ctx.beginPath();
      ctx.moveTo(cab.x - cab.r * 1.0, cab.y - cab.r * 0.4);
      ctx.quadraticCurveTo(cab.x - cab.r * 0.4, cab.y - cab.r * 1.5, cab.x + cab.r * 0.2, cab.y - cab.r * 0.55);
      ctx.quadraticCurveTo(cab.x + cab.r * 0.5, cab.y - cab.r * 1.1, cab.x + cab.r * 0.85, cab.y - cab.r * 0.35);
      ctx.closePath();
      pintar(ctx, U.css(P.c3, 0.85), P.LN, 1.8);
    } else if (t === 'antena') {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(cab.x + i * cab.r * 0.35, cab.y - cab.r * 0.7);
        ctx.quadraticCurveTo(cab.x + i * cab.r * 1.0, cab.y - cab.r * 1.6, cab.x + i * cab.r * 0.7, cab.y - cab.r * 2.0);
        ctx.strokeStyle = P.LN; ctx.lineWidth = 2; ctx.stroke();
        el(ctx, cab.x + i * cab.r * 0.7, cab.y - cab.r * 2.05, cab.r * 0.17, cab.r * 0.17, 0);
        pintar(ctx, P.C3, P.LN, 1.4);
      }
    } else if (t === 'chapeu') {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      el(ctx, cab.x, cab.y - cab.r * 0.15, cab.r * 1.75, cab.r * 1.0, 0);
      ctx.beginPath();
      ctx.ellipse(cab.x, cab.y - cab.r * 0.15, cab.r * 1.75, cab.r * 1.0, 0, Math.PI, Math.PI * 2);
      pintar(ctx, P.C2, P.LN, 2.2);
      ctx.restore();
      for (i = 0; i < 5; i++) {
        var sx = cab.x - cab.r * 1.2 + i * cab.r * 0.6;
        el(ctx, sx, cab.y - cab.r * (0.5 + (i % 2) * 0.2), cab.r * 0.2, cab.r * 0.14, 0);
        pintar(ctx, P.C3, null);
      }
    } else if (t === 'barbatana') {
      poly(ctx, [[cab.x - cab.r * 0.8, cab.y - cab.r * 0.4],
                 [cab.x + cab.r * 0.4, cab.y - cab.r * 0.5],
                 [cab.x - cab.r * 0.1, cab.y - cab.r * 1.5]]);
      pintar(ctx, U.css(P.c3, 0.85), P.LN, 1.8);
    }
  }

  function desenharCauda(ctx, P, o, ancora, rnd) {
    var t = o.cauda || 'nenhuma';
    if (t === 'nenhuma') return;
    var x = ancora.x, y = ancora.y;
    if (t === 'felpuda' || t === 'folha') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.5);
      el(ctx, -8, -6, 12, 8, -0.5);
      pintar(ctx, t === 'folha' ? P.C3 : P.C2, P.LN, 2);
      ctx.restore();
      if (t === 'folha') {
        el(ctx, x - 14, y - 12, 8, 5, -0.9); pintar(ctx, U.css(U.tom(P.c3, 8)), P.LN, 1.5);
      }
    } else if (t === 'fina') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 16, y - 4, x - 18, y - 16);
      ctx.strokeStyle = P.C2; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = P.LN; ctx.lineWidth = 1; ctx.stroke();
    } else if (t === 'chama') {
      ctx.save();
      ctx.shadowColor = P.C3; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.quadraticCurveTo(x - 14, y - 2, x - 15, y - 16);
      ctx.quadraticCurveTo(x - 6, y - 8, x - 2, y - 4);
      ctx.closePath();
      pintar(ctx, P.C1, null);
      poly(ctx, [[x - 13, y - 12], [x - 6, y - 8], [x - 12, y - 22]]);
      pintar(ctx, P.C3, null);
      poly(ctx, [[x - 11, y - 14], [x - 8, y - 11], [x - 11, y - 20]]);
      pintar(ctx, '#fff3c8', null);
      ctx.restore();
    } else if (t === 'leque') {
      var i;
      for (i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(i * 0.28 - 0.1);
        el(ctx, -13, 0, 14, 4.2, 0);
        pintar(ctx, i % 2 ? P.C2 : P.C3, P.LN, 1.5);
        ctx.restore();
      }
    } else if (t === 'espinho') {
      poly(ctx, [[x + 2, y - 5], [x + 2, y + 5], [x - 18, y - 2]]);
      pintar(ctx, P.C3, P.LN, 2);
    } else if (t === 'gota') {
      el(ctx, x - 10, y - 2, 8, 9, 0); pintar(ctx, U.css(P.c1, 0.85), P.LN, 1.8);
    } else if (t === 'raio') {
      poly(ctx, [[x + 2, y - 3], [x - 8, y - 6], [x - 4, y - 12], [x - 20, y - 8],
                 [x - 10, y - 2], [x - 14, y + 4], [x - 2, y + 4]]);
      ctx.save(); ctx.shadowColor = P.C1; ctx.shadowBlur = 10;
      pintar(ctx, P.C3, P.LN, 1.6);
      ctx.restore();
    } else if (t === 'nevoa') {
      ctx.save();
      ctx.globalAlpha = 0.75;
      for (var k = 0; k < 4; k++) {
        el(ctx, x + 3 - k * 1.5, y + k * 5, 12 - k * 2.2, 5 - k * 0.8, 0);
        pintar(ctx, U.css(U.tom(P.c1, -4 - k * 2), 0.8), null);
      }
      ctx.restore();
    }
  }

  function desenharOrelhas(ctx, P, o, cab) {
    var t = o.orelhas || 'nenhuma', i;
    if (t === 'nenhuma') return;
    for (i = -1; i <= 1; i += 2) {
      var bx = cab.x + i * cab.r * 0.62, by = cab.y - cab.r * 0.56;
      if (t === 'pontuda') {
        poly(ctx, [[bx - cab.r * 0.22, by + cab.r * 0.12],
                   [bx + cab.r * 0.22, by + cab.r * 0.05],
                   [bx + i * cab.r * 0.22, by - cab.r * 0.72]]);
        pintar(ctx, P.C1, P.LN, 2);
        poly(ctx, [[bx - cab.r * 0.1, by + cab.r * 0.06],
                   [bx + cab.r * 0.11, by + cab.r * 0.02],
                   [bx + i * cab.r * 0.13, by - cab.r * 0.46]]);
        pintar(ctx, P.C3, null);
      } else if (t === 'redonda') {
        el(ctx, bx, by - cab.r * 0.18, cab.r * 0.30, cab.r * 0.32, 0);
        pintar(ctx, P.C1, P.LN, 2);
        el(ctx, bx, by - cab.r * 0.18, cab.r * 0.16, cab.r * 0.17, 0);
        pintar(ctx, P.C3, null);
      } else if (t === 'longa') {
        ctx.save();
        ctx.translate(bx, by); ctx.rotate(i * 0.42);
        el(ctx, 0, -cab.r * 0.62, cab.r * 0.19, cab.r * 0.72, 0);
        pintar(ctx, P.C1, P.LN, 2);
        el(ctx, 0, -cab.r * 0.6, cab.r * 0.09, cab.r * 0.48, 0);
        pintar(ctx, P.C3, null);
        ctx.restore();
      } else if (t === 'barbatana') {
        ctx.save();
        ctx.translate(bx, by + cab.r * 0.25); ctx.rotate(i * 0.5);
        poly(ctx, [[0, cab.r * 0.2], [i * cab.r * 0.7, -cab.r * 0.34], [i * cab.r * 0.16, -cab.r * 0.6]]);
        pintar(ctx, U.css(P.c3, 0.9), P.LN, 1.6);
        ctx.restore();
      }
    }
  }

  function desenharAsas(ctx, P, o, corpo, atras) {
    var t = o.asas || 'nenhuma';
    if (t === 'nenhuma') return;
    var g = o.asaGrande ? 1.35 : 1;
    var i;
    if (t === 'pena') {
      for (i = 0; i < (atras ? 1 : 1); i++) {
        ctx.save();
        ctx.translate(corpo.x - corpo.rx * 0.15, corpo.y - corpo.ry * 0.25);
        ctx.rotate(atras ? 0.5 : -0.32);
        for (var k = 0; k < 4; k++) {
          el(ctx, -k * 3.2, k * 2.0, corpo.rx * (1.15 - k * 0.13) * g, corpo.ry * (0.4 - k * 0.05) * g, 0.18);
          pintar(ctx, k % 2 ? P.C2 : P.C1, P.LN, 1.6);
        }
        ctx.restore();
      }
    } else if (t === 'membrana') {
      ctx.save();
      ctx.translate(corpo.x - corpo.rx * 0.2, corpo.y - corpo.ry * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-corpo.rx * 1.2, -corpo.ry * 1.5, -corpo.rx * 1.7, -corpo.ry * 0.2);
      ctx.quadraticCurveTo(-corpo.rx * 1.0, corpo.ry * 0.1, 0, corpo.ry * 0.5);
      ctx.closePath();
      pintar(ctx, U.css(P.c2, 0.92), P.LN, 2);
      ctx.restore();
    } else if (t === 'inseto') {
      ctx.save();
      ctx.globalAlpha = 0.55;
      for (i = -1; i <= 1; i += 2) {
        ctx.save();
        ctx.translate(corpo.x - corpo.rx * 0.1, corpo.y - corpo.ry * 0.5);
        ctx.rotate(i * 0.4 - 0.4);
        el(ctx, -corpo.rx * 0.5, -corpo.ry * 0.5, corpo.rx * 1.0, corpo.ry * 0.4, 0);
        pintar(ctx, U.css(P.c3, 0.75), U.css(P.linha, 0.7), 1.4);
        ctx.restore();
      }
      ctx.restore();
    } else if (t === 'eterea') {
      ctx.save();
      ctx.shadowColor = P.C3; ctx.shadowBlur = 14;
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(corpo.x, corpo.y - corpo.ry * 0.2);
        ctx.quadraticCurveTo(corpo.x + i * corpo.rx * 1.7, corpo.y - corpo.ry * 1.9,
                             corpo.x + i * corpo.rx * 2.0, corpo.y - corpo.ry * 0.1);
        ctx.quadraticCurveTo(corpo.x + i * corpo.rx * 1.1, corpo.y + corpo.ry * 0.3,
                             corpo.x, corpo.y + corpo.ry * 0.2);
        ctx.closePath();
        ctx.fillStyle = U.css(P.c3, 0.42);
        ctx.fill();
        ctx.strokeStyle = U.css(P.c3, 0.8); ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ============================ ARQUÉTIPOS ============================= */

  function sombra(ctx, cx, cy, rx) {
    el(ctx, cx, cy, rx, rx * 0.26, 0);
    ctx.fillStyle = 'rgba(20,16,30,0.22)';
    ctx.fill();
  }

  function corpoBase(ctx, P, x, y, rx, ry, rnd, ondas) {
    blob(ctx, x, y, rx, ry, ondas || 3, rnd() * 6, rnd);
    pintar(ctx, P.C1, P.LN, 2.4);
    ctx.save();
    ctx.clip();
    el(ctx, x - rx * 0.3, y - ry * 0.45, rx * 0.7, ry * 0.45, -0.3);
    pintar(ctx, U.css(P.claro, 0.55), null);
    el(ctx, x + rx * 0.15, y + ry * 0.55, rx * 0.85, ry * 0.5, 0);
    pintar(ctx, U.css(P.escuro, 0.4), null);
    ctx.restore();
  }

  var ARQ = {};

  ARQ.quadrupede = function (ctx, P, o, rnd) {
    var cx = 44, cy = 60, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx + rx * 0.92, y: cy - ry * 1.02, r: o.cabecaR };
    sombra(ctx, 50, 92, rx * 1.15);
    desenharCauda(ctx, P, o, { x: cx - rx * 0.92, y: cy - ry * 0.1 }, rnd);
    /* patas traseiras */
    pata(ctx, cx - rx * 0.55, cy + ry * 0.5, 8, 26, P.C2, P.LN);
    pata(ctx, cx + rx * 0.42, cy + ry * 0.5, 8, 26, P.C2, P.LN);
    corpoBase(ctx, P, cx, cy, rx, ry, rnd, 3);
    if (o.placas) {
      for (var i = -1; i <= 1; i++) {
        el(ctx, cx + i * rx * 0.45, cy - ry * 0.55, rx * 0.22, ry * 0.30, 0);
        pintar(ctx, P.C2, P.LN, 1.5);
      }
    }
    if (o.dorso === 'arvore') {
      ctx.save();
      el(ctx, cx - rx * 0.15, cy - ry * 1.35, rx * 0.62, ry * 0.55, 0);
      pintar(ctx, P.C3, P.LN, 2);
      el(ctx, cx + rx * 0.35, cy - ry * 1.15, rx * 0.4, ry * 0.36, 0);
      pintar(ctx, U.css(U.tom(P.c3, 8)), P.LN, 1.8);
      ctx.restore();
    }
    if (o.raios) {
      ctx.save(); ctx.shadowColor = P.C1; ctx.shadowBlur = 10;
      for (var k = 0; k < 3; k++) {
        var a = -2.4 + k * 0.5;
        poly(ctx, [[cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9],
                   [cx + Math.cos(a + 0.16) * rx * 1.5, cy + Math.sin(a + 0.16) * ry * 1.5],
                   [cx + Math.cos(a + 0.32) * rx * 0.9, cy + Math.sin(a + 0.32) * ry * 0.9]]);
        pintar(ctx, P.C3, null);
      }
      ctx.restore();
    }
    /* patas dianteiras */
    pata(ctx, cx - rx * 0.18, cy + ry * 0.62, 9, 26, P.C1, P.LN);
    pata(ctx, cx + rx * 0.72, cy + ry * 0.58, 9, 26, P.C1, P.LN);
    desenharOrelhas(ctx, P, o, cab);
    el(ctx, cab.x, cab.y, cab.r, cab.r * 0.95, 0);
    pintar(ctx, P.C1, P.LN, 2.4);
    ctx.save(); el(ctx, cab.x, cab.y, cab.r, cab.r * 0.95, 0); ctx.clip();
    el(ctx, cab.x - cab.r * 0.3, cab.y - cab.r * 0.4, cab.r * 0.7, cab.r * 0.5, -0.3);
    pintar(ctx, U.css(P.claro, 0.5), null);
    ctx.restore();
    el(ctx, cab.x + cab.r * 0.72, cab.y + cab.r * 0.3, cab.r * 0.42, cab.r * 0.32, 0);
    pintar(ctx, P.CL, P.LN, 2);
    desenharCrista(ctx, P, o, cab, rnd);
    desenharOlhos(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, { x: cab.x + cab.r * 0.5, y: cab.y + cab.r * 0.2, r: cab.r });
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.bipede = function (ctx, P, o, rnd) {
    var cx = 48, cy = 58, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx + 5, y: cy - ry - o.cabecaR * 0.75, r: o.cabecaR };
    sombra(ctx, 50, 93, rx * 1.25);
    desenharCauda(ctx, P, o, { x: cx - rx * 0.85, y: cy + ry * 0.55 }, rnd);
    if (o.capa) {
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.9, cy - ry * 0.7);
      ctx.quadraticCurveTo(cx - rx * 2.0, cy + ry * 0.4, cx - rx * 1.1, cy + ry * 1.25);
      ctx.lineTo(cx + rx * 0.6, cy + ry * 1.1);
      ctx.quadraticCurveTo(cx + rx * 0.2, cy - ry * 0.2, cx + rx * 0.1, cy - ry * 0.8);
      ctx.closePath();
      pintar(ctx, U.css(P.c2, 0.95), P.LN, 2.2);
    }
    desenharAsas(ctx, P, o, { x: cx, y: cy - ry * 0.2, rx: rx, ry: ry * 0.7 }, true);
    pata(ctx, cx - rx * 0.45, cy + ry * 0.75, 10, 22, P.C2, P.LN);
    pata(ctx, cx + rx * 0.45, cy + ry * 0.75, 10, 22, P.C2, P.LN);
    corpoBase(ctx, P, cx, cy, rx, ry, rnd, 2);
    el(ctx, cx + 1, cy + ry * 0.25, rx * 0.55, ry * 0.5, 0);
    pintar(ctx, U.css(P.claro, 0.7), null);
    /* braços */
    var i;
    for (i = -1; i <= 1; i += 2) {
      ctx.save();
      ctx.translate(cx + i * rx * 0.92, cy - ry * 0.25);
      ctx.rotate(i * 0.45);
      el(ctx, 0, ry * 0.42, 5.4, ry * 0.52, 0);
      pintar(ctx, P.C1, P.LN, 2);
      if (o.garras) {
        for (var k = -1; k <= 1; k++) {
          poly(ctx, [[k * 2.4, ry * 0.86], [k * 2.4 + 1.6, ry * 0.86], [k * 2.4 + 0.8, ry * 1.16]]);
          pintar(ctx, P.C3, P.LN, 1.2);
        }
      }
      ctx.restore();
    }
    desenharOrelhas(ctx, P, o, cab);
    el(ctx, cab.x, cab.y, cab.r, cab.r, 0);
    pintar(ctx, P.C1, P.LN, 2.4);
    ctx.save(); el(ctx, cab.x, cab.y, cab.r, cab.r, 0); ctx.clip();
    el(ctx, cab.x - cab.r * 0.3, cab.y - cab.r * 0.4, cab.r * 0.7, cab.r * 0.5, -0.3);
    pintar(ctx, U.css(P.claro, 0.5), null);
    ctx.restore();
    desenharCrista(ctx, P, o, cab, rnd);
    desenharOlhos(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, cab);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.ave = function (ctx, P, o, rnd) {
    var cx = 46, cy = 56, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx + rx * 1.0, y: cy - ry * 0.95, r: o.cabecaR };
    sombra(ctx, 50, 92, rx * 1.3);
    desenharCauda(ctx, P, o, { x: cx - rx * 0.9, y: cy + ry * 0.15 }, rnd);
    desenharAsas(ctx, P, o, { x: cx, y: cy, rx: rx, ry: ry }, true);
    ctx.save(); ctx.strokeStyle = P.C3; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 3, cy + ry * 0.7); ctx.lineTo(cx - 5, 88); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 7, cy + ry * 0.7); ctx.lineTo(cx + 8, 88); ctx.stroke();
    ctx.restore();
    poly(ctx, [[cx - 10, 88], [cx + 0, 88], [cx - 4, 91]]); pintar(ctx, P.C3, P.LN, 1.2);
    poly(ctx, [[cx + 3, 88], [cx + 13, 88], [cx + 9, 91]]); pintar(ctx, P.C3, P.LN, 1.2);
    corpoBase(ctx, P, cx, cy, rx, ry * 1.12, rnd, 2);
    el(ctx, cx + rx * 0.25, cy + ry * 0.3, rx * 0.6, ry * 0.62, 0);
    pintar(ctx, U.css(P.claro, 0.7), null);
    desenharAsas(ctx, P, o, { x: cx + 4, y: cy, rx: rx, ry: ry }, false);
    el(ctx, cab.x, cab.y, cab.r, cab.r, 0);
    pintar(ctx, P.C1, P.LN, 2.4);
    if (o.halo) { desenharCrista(ctx, P, { crista: 'halo' }, cab, rnd); }
    desenharCrista(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, cab);
    desenharOlhos(ctx, P, o, cab, rnd);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.aquatico = function (ctx, P, o, rnd) {
    var cx = 46, cy = 58, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx + rx * 0.72, y: cy - ry * 0.30, r: o.cabecaR };
    sombra(ctx, 50, 92, rx * 1.1);
    desenharCauda(ctx, P, o, { x: cx - rx * 0.95, y: cy }, rnd);
    if (o.tentaculos) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = P.C2; ctx.lineWidth = 4;
      for (var i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.2 + i * 6, cy + ry * 0.8);
        ctx.quadraticCurveTo(cx - rx * 0.4 + i * 7, cy + ry * 1.6, cx - rx * 0.7 + i * 9, cy + ry * 2.0);
        ctx.stroke();
      }
      ctx.restore();
    }
    desenharCrista(ctx, P, { crista: o.crista === 'espinhos' ? 'espinhos' : 'nenhuma' },
                   { x: cx, y: cy - ry * 0.85, r: ry * 0.9 }, rnd);
    corpoBase(ctx, P, cx, cy, rx, ry, rnd, 2);
    el(ctx, cx + rx * 0.1, cy + ry * 0.42, rx * 0.72, ry * 0.46, 0);
    pintar(ctx, U.css(P.claro, 0.65), null);
    /* barbatana dorsal */
    if (o.crista === 'barbatana') {
      poly(ctx, [[cx - rx * 0.4, cy - ry * 0.9], [cx + rx * 0.3, cy - ry * 0.95], [cx - rx * 0.05, cy - ry * 1.95]]);
      pintar(ctx, U.css(P.c3, 0.9), P.LN, 1.8);
    }
    /* barbatanas laterais */
    ctx.save();
    ctx.translate(cx + rx * 0.1, cy + ry * 0.5); ctx.rotate(0.5);
    el(ctx, 0, 0, rx * 0.34, ry * 0.2, 0); pintar(ctx, U.css(P.c3, 0.9), P.LN, 1.5);
    ctx.restore();
    el(ctx, cab.x, cab.y, cab.r, cab.r * 0.94, 0);
    pintar(ctx, P.C1, P.LN, 2.2);
    desenharOrelhas(ctx, P, o, cab);
    desenharOlhos(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, cab);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.ameba = function (ctx, P, o, rnd) {
    var cx = 50, cy = 64, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx + 2, y: cy - ry * 0.25, r: ry * 0.85 };
    sombra(ctx, 50, 92, rx * 1.05);
    /* corpo gelatinoso */
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + ry * 0.85);
    ctx.bezierCurveTo(cx - rx * 1.15, cy - ry * 0.7, cx - rx * 0.5, cy - ry * 1.3, cx, cy - ry * 1.25);
    ctx.bezierCurveTo(cx + rx * 0.55, cy - ry * 1.3, cx + rx * 1.15, cy - ry * 0.6, cx + rx, cy + ry * 0.85);
    ctx.quadraticCurveTo(cx, cy + ry * 1.2, cx - rx, cy + ry * 0.85);
    ctx.closePath();
    pintar(ctx, U.css(P.c1, 0.95), P.LN, 2.4);
    ctx.save(); ctx.clip();
    el(ctx, cx - rx * 0.35, cy - ry * 0.55, rx * 0.55, ry * 0.45, -0.35);
    pintar(ctx, U.css(P.claro, 0.6), null);
    el(ctx, cx + rx * 0.2, cy + ry * 0.6, rx * 0.8, ry * 0.5, 0);
    pintar(ctx, U.css(P.c2, 0.5), null);
    if (o.bolhas) {
      for (var i = 0; i < 5; i++) {
        el(ctx, cx - rx * 0.7 + rnd() * rx * 1.4, cy - ry * 0.6 + rnd() * ry * 1.4, 2 + rnd() * 3, 2 + rnd() * 3, 0);
        pintar(ctx, 'rgba(255,255,255,0.35)', null);
      }
    }
    ctx.restore();
    if (o.cristais) {
      for (var k = -1; k <= 1; k++) {
        ctx.save(); ctx.translate(cx + k * rx * 0.55, cy - ry * 0.9); ctx.rotate(k * 0.35);
        poly(ctx, [[-3, 0], [0, -10 - Math.abs(k) * -3], [3, 0], [0, 3]]);
        ctx.shadowColor = P.C3; ctx.shadowBlur = 8;
        pintar(ctx, U.css(P.c3, 0.9), P.LN, 1.4);
        ctx.restore();
      }
    }
    if (o.gotejo) {
      for (var g = 0; g < 3; g++) {
        var gx = cx - rx * 0.6 + g * rx * 0.6;
        ctx.beginPath();
        ctx.moveTo(gx - 3, cy + ry * 0.8);
        ctx.quadraticCurveTo(gx, cy + ry * 1.35, gx + 3, cy + ry * 0.8);
        ctx.closePath();
        pintar(ctx, U.css(P.c2, 0.9), null);
      }
    }
    if (o.patas === 2) {
      pata(ctx, cx - rx * 0.4, cy + ry * 0.75, 8, 14, P.C2, P.LN);
      pata(ctx, cx + rx * 0.4, cy + ry * 0.75, 8, 14, P.C2, P.LN);
    }
    desenharCrista(ctx, P, o, { x: cx, y: cy - ry * 0.55, r: ry * 0.8 }, rnd);
    desenharOrelhas(ctx, P, o, cab);
    desenharCauda(ctx, P, o, { x: cx - rx * 0.9, y: cy + ry * 0.2 }, rnd);
    desenharOlhos(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, cab);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.golem = function (ctx, P, o, rnd) {
    var cx = 50, cy = 62, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx, y: cy - ry * 0.3, r: ry * 0.7 };
    sombra(ctx, 50, 93, rx * 1.1);
    function bloco(x, y, w, h, cor, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      poly(ctx, [[-w / 2, -h / 2], [w / 2 - 3, -h / 2 - 2], [w / 2, h / 2], [-w / 2 + 2, h / 2 + 2]]);
      pintar(ctx, cor, P.LN, 2.2);
      ctx.restore();
    }
    if (o.bracos) {
      bloco(cx - rx * 1.15, cy + ry * 0.15, rx * 0.5, ry * 0.95, P.C2, -0.15);
      bloco(cx + rx * 1.15, cy + ry * 0.15, rx * 0.5, ry * 0.95, P.C2, 0.15);
    }
    bloco(cx, cy, rx * 1.85, ry * 1.7, P.C1, 0);
    ctx.save();
    poly(ctx, [[cx - rx * 0.92, cy - ry * 0.85], [cx + rx * 0.92 - 3, cy - ry * 0.85 - 2],
               [cx + rx * 0.92, cy + ry * 0.85], [cx - rx * 0.92 + 2, cy + ry * 0.85 + 2]]);
    ctx.clip();
    el(ctx, cx - rx * 0.5, cy - ry * 0.6, rx * 0.7, ry * 0.4, -0.2);
    pintar(ctx, U.css(P.claro, 0.5), null);
    el(ctx, cx + rx * 0.4, cy + ry * 0.7, rx * 0.9, ry * 0.55, 0);
    pintar(ctx, U.css(P.escuro, 0.45), null);
    ctx.restore();
    /* blocos secundários */
    if (o.blocos) {
      bloco(cx - rx * 0.72, cy - ry * 1.1, rx * 0.55, ry * 0.5, P.C2, -0.2);
      bloco(cx + rx * 0.68, cy - ry * 0.95, rx * 0.48, ry * 0.45, P.C2, 0.25);
      bloco(cx + rx * 0.2, cy + ry * 1.05, rx * 0.7, ry * 0.4, P.C2, 0.06);
    }
    if (o.cristais) {
      for (var k = -1; k <= 1; k += 2) {
        ctx.save(); ctx.translate(cx + k * rx * 0.6, cy - ry * 1.1); ctx.rotate(k * 0.4);
        poly(ctx, [[-3.5, 0], [0, -13], [3.5, 0], [0, 4]]);
        ctx.shadowColor = P.C3; ctx.shadowBlur = 10;
        pintar(ctx, U.css(P.c3, 0.92), P.LN, 1.4);
        ctx.restore();
      }
    }
    desenharCrista(ctx, P, o, { x: cx, y: cy - ry * 0.9, r: ry * 0.75 }, rnd);
    desenharOlhos(ctx, P, o, cab, rnd);
    /* pernas curtas */
    pata(ctx, cx - rx * 0.5, cy + ry * 0.85, 11, 12, P.C2, P.LN);
    pata(ctx, cx + rx * 0.5, cy + ry * 0.85, 11, 12, P.C2, P.LN);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.inseto = function (ctx, P, o, rnd) {
    var cx = 46, cy = 62, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx + rx * 1.15, y: cy - ry * 0.25, r: o.cabecaR };
    sombra(ctx, 50, 92, rx * 1.2);
    desenharCauda(ctx, P, o, { x: cx - rx * 1.0, y: cy }, rnd);
    /* pernas */
    ctx.save(); ctx.strokeStyle = P.LN; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (var i = 0; i < (o.patas || 4); i++) {
      var px = cx - rx * 0.7 + i * (rx * 1.5 / Math.max(1, (o.patas || 4) - 1));
      ctx.beginPath();
      ctx.moveTo(px, cy + ry * 0.55);
      ctx.lineTo(px - 4 + i * 2, cy + ry * 1.25);
      ctx.lineTo(px - 8 + i * 3, 90);
      ctx.stroke();
    }
    ctx.restore();
    desenharAsas(ctx, P, o, { x: cx, y: cy - ry * 0.3, rx: rx, ry: ry }, true);
    /* segmentos */
    el(ctx, cx - rx * 0.55, cy, rx * 0.62, ry * 0.92, 0); pintar(ctx, P.C2, P.LN, 2.2);
    corpoBase(ctx, P, cx + rx * 0.25, cy, rx * 0.85, ry, rnd, 2);
    if (o.placas) {
      for (var k = 0; k < 3; k++) {
        el(ctx, cx - rx * 0.2 + k * rx * 0.42, cy - ry * 0.25, rx * 0.2, ry * 0.5, 0);
        pintar(ctx, U.css(P.c2, 0.85), P.LN, 1.4);
      }
    }
    if (o.raios) {
      ctx.save(); ctx.shadowColor = P.C3; ctx.shadowBlur = 10;
      poly(ctx, [[cx - rx * 0.1, cy - ry * 0.9], [cx + rx * 0.2, cy - ry * 1.7],
                 [cx + rx * 0.05, cy - ry * 1.0], [cx + rx * 0.4, cy - ry * 1.8]]);
      ctx.strokeStyle = P.C3; ctx.lineWidth = 2.4; ctx.stroke();
      ctx.restore();
    }
    el(ctx, cab.x, cab.y, cab.r, cab.r * 0.92, 0);
    pintar(ctx, P.C1, P.LN, 2.2);
    desenharCrista(ctx, P, o, cab, rnd);
    desenharOlhos(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, cab);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  ARQ.espectro = function (ctx, P, o, rnd) {
    var cx = 50, cy = 54, rx = o.corpoRX, ry = o.corpoRY;
    var cab = { x: cx, y: cy - ry * 0.42, r: o.cabecaR };
    /* aura */
    ctx.save();
    var gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx * 2.3);
    gr.addColorStop(0, U.css(P.c3, 0.28));
    gr.addColorStop(1, U.css(P.c3, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    el(ctx, 50, 93, rx * 0.8, rx * 0.16, 0);
    ctx.fillStyle = 'rgba(20,16,30,0.14)'; ctx.fill();
    desenharAsas(ctx, P, o, { x: cx, y: cy, rx: rx, ry: ry * 0.8 }, true);
    if (o.capa) {
      ctx.beginPath();
      ctx.moveTo(cx - rx * 1.05, cy - ry * 0.2);
      ctx.quadraticCurveTo(cx - rx * 1.6, cy + ry * 0.9, cx - rx * 0.8, cy + ry * 1.4);
      ctx.lineTo(cx + rx * 0.8, cy + ry * 1.4);
      ctx.quadraticCurveTo(cx + rx * 1.6, cy + ry * 0.9, cx + rx * 1.05, cy - ry * 0.2);
      ctx.closePath();
      pintar(ctx, U.css(P.c2, 0.85), P.LN, 2);
    }
    /* corpo em gota com cauda de névoa */
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + ry * 0.35);
    ctx.bezierCurveTo(cx - rx * 1.1, cy - ry * 1.0, cx + rx * 1.1, cy - ry * 1.0, cx + rx, cy + ry * 0.35);
    ctx.bezierCurveTo(cx + rx * 0.8, cy + ry * 1.1, cx + rx * 0.35, cy + ry * 0.85, cx + rx * 0.1, cy + ry * 1.35);
    ctx.bezierCurveTo(cx - rx * 0.2, cy + ry * 0.85, cx - rx * 0.7, cy + ry * 1.2, cx - rx, cy + ry * 0.35);
    ctx.closePath();
    pintar(ctx, U.css(P.c1, 0.92), P.LN, 2.4);
    ctx.save(); ctx.clip();
    el(ctx, cx - rx * 0.35, cy - ry * 0.5, rx * 0.6, ry * 0.5, -0.3);
    pintar(ctx, U.css(P.claro, 0.5), null);
    ctx.restore();
    if (o.aneis) {
      ctx.save();
      ctx.strokeStyle = U.css(P.c3, 0.75); ctx.lineWidth = 1.8;
      for (var a = 0; a < 3; a++) {
        el(ctx, cx, cy + a * 6 - 6, rx * (1.5 - a * 0.18), ry * 0.20, a * 0.25 - 0.25);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (o.gotejo) {
      for (var g = 0; g < 3; g++) {
        el(ctx, cx - rx * 0.6 + g * rx * 0.6, cy + ry * 1.15 + (g % 2) * 4, 3, 4.5, 0);
        pintar(ctx, U.css(P.c2, 0.8), null);
      }
    }
    desenharOrelhas(ctx, P, o, cab);
    desenharCrista(ctx, P, o, cab, rnd);
    desenharOlhos(ctx, P, o, cab, rnd);
    desenharBoca(ctx, P, o, cab);
    return { cab: cab, corpo: { x: cx, y: cy, rx: rx, ry: ry } };
  };

  /* =========================== PADRÕES INDIVIDUAIS ===================== */
  function aplicarPadrao(ctx, padrao, P, rnd) {
    if (!padrao || padrao === 'liso') return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    var cor = U.css(P.escuro, 0.35), cor2 = U.css(P.c3, 0.30), i;
    if (padrao === 'malhado') {
      ctx.fillStyle = cor;
      for (i = 0; i < 9; i++) {
        el(ctx, 15 + rnd() * 70, 25 + rnd() * 55, 4 + rnd() * 7, 3 + rnd() * 6, rnd() * 3);
        ctx.fill();
      }
    } else if (padrao === 'listrado') {
      ctx.strokeStyle = cor; ctx.lineWidth = 3.5;
      for (i = 0; i < 7; i++) {
        ctx.beginPath();
        var x0 = 8 + i * 13;
        ctx.moveTo(x0, 18); ctx.quadraticCurveTo(x0 + 6, 55, x0 - 4, 95);
        ctx.stroke();
      }
    } else if (padrao === 'salpicado') {
      ctx.fillStyle = cor2;
      for (i = 0; i < 34; i++) {
        el(ctx, 10 + rnd() * 80, 18 + rnd() * 72, 1.2 + rnd() * 2.2, 1.2 + rnd() * 2.2, 0);
        ctx.fill();
      }
    } else if (padrao === 'faixado') {
      ctx.fillStyle = cor;
      for (i = 0; i < 4; i++) ctx.fillRect(0, 30 + i * 15, 100, 5.5);
    } else if (padrao === 'marmore') {
      ctx.strokeStyle = cor2; ctx.lineWidth = 2.2;
      for (i = 0; i < 6; i++) {
        ctx.beginPath();
        var sx = rnd() * 100, sy = 20 + rnd() * 70;
        ctx.moveTo(sx, sy);
        for (var k = 0; k < 4; k++) {
          sx += (rnd() - 0.5) * 30; sy += (rnd() - 0.5) * 26;
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    } else if (padrao === 'gradiente') {
      var g = ctx.createLinearGradient(0, 20, 0, 95);
      g.addColorStop(0, U.css(P.c3, 0));
      g.addColorStop(1, U.css(P.c3, 0.45));
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    } else if (padrao === 'estelar') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (i = 0; i < 16; i++) {
        var px = 12 + rnd() * 76, py = 20 + rnd() * 70, r = 0.8 + rnd() * 1.6;
        poly(ctx, [[px, py - r * 2.4], [px + r, py], [px, py + r * 2.4], [px - r, py]]);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function brilhoPrismatico(ctx, rnd) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    var g = ctx.createLinearGradient(0, 10, 100, 95);
    g.addColorStop(0, 'rgba(255,120,220,0.20)');
    g.addColorStop(0.5, 'rgba(120,240,255,0.16)');
    g.addColorStop(1, 'rgba(255,240,120,0.20)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    ctx.restore();
    ctx.save();
    for (var i = 0; i < 7; i++) {
      var x = 10 + rnd() * 80, y = 12 + rnd() * 76, s = 1.6 + rnd() * 2.6;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      poly(ctx, [[x, y - s * 2.6], [x + s * 0.7, y], [x, y + s * 2.6], [x - s * 0.7, y]]);
      ctx.fill();
      poly(ctx, [[x - s * 2.6, y], [x, y - s * 0.7], [x + s * 2.6, y], [x, y + s * 0.7]]);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ============================== API ================================= */

  /* Constrói (ou recupera do cache) o canvas de um indivíduo. */
  A.canvasCriatura = function (especieId, v) {
    v = v || {};
    var chave = especieId + '|' + (v.matiz | 0) + '|' + (v.padrao || 'liso') + '|' +
                (v.porte || 1).toFixed(2) + '|' + (v.prismatico ? 1 : 0) + '|' + (v.seed | 0);
    if (CACHE[chave]) return CACHE[chave];

    var esp = G.especie(especieId);
    if (!esp) return null;
    var art = esp.art, o = art.o;

    var cv = document.createElement('canvas');
    cv.width = LADO; cv.height = LADO;
    var ctx = cv.getContext('2d');
    ctx.scale(ESC, ESC);
    ctx.lineJoin = 'round';

    var P = montarPaleta(art, v);
    var rnd = G.mulberry32((v.seed | 0) + G.hash32(especieId));

    /* porte individual */
    var esc = (o.escala || 1) * (v.porte || 1);
    ctx.save();
    ctx.translate(50, 96);
    ctx.scale(esc, esc);
    ctx.translate(-50, -96);

    var fn = ARQ[art.arch] || ARQ.quadrupede;
    fn(ctx, P, o, rnd);
    ctx.restore();

    /* padrão individual + prismático (aplicados sobre a silhueta) */
    var rnd2 = G.mulberry32((v.seed | 0) * 7 + 13);
    aplicarPadrao(ctx, v.padrao, P, rnd2);
    if (v.prismatico) brilhoPrismatico(ctx, G.mulberry32((v.seed | 0) * 31 + 5));

    CACHE[chave] = cv;
    CACHE_ORDEM.push(chave);
    if (CACHE_ORDEM.length > CACHE_MAX) delete CACHE[CACHE_ORDEM.shift()];
    return cv;
  };

  /* Canvas auxiliar para tingir a silhueta sem contaminar o destino.
     (source-atop aplicado direto no destino pintaria o retângulo inteiro.) */
  var cvTinta = null, ctxTinta = null;

  function canvasTingido(cv, cor) {
    if (!cvTinta) {
      cvTinta = document.createElement('canvas');
      cvTinta.width = LADO; cvTinta.height = LADO;
      ctxTinta = cvTinta.getContext('2d');
    }
    ctxTinta.setTransform(1, 0, 0, 1, 0, 0);
    ctxTinta.globalCompositeOperation = 'source-over';
    ctxTinta.clearRect(0, 0, LADO, LADO);
    ctxTinta.drawImage(cv, 0, 0);
    ctxTinta.globalCompositeOperation = 'source-atop';
    ctxTinta.fillStyle = cor;
    ctxTinta.fillRect(0, 0, LADO, LADO);
    ctxTinta.globalCompositeOperation = 'source-over';
    return cvTinta;
  }

  /* Desenha um indivíduo. opts: {virado, alpha, silhueta} */
  A.desenhar = function (ctx, especieId, v, x, y, tam, opts) {
    opts = opts || {};
    var cv = A.canvasCriatura(especieId, v);
    if (!cv) return;
    if (opts.silhueta) {
      cv = canvasTingido(cv, opts.silhueta === true ? '#1c1826' : opts.silhueta);
    }
    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.translate(x, y);
    if (opts.virado) ctx.scale(-1, 1);
    ctx.drawImage(cv, -tam / 2, -tam / 2, tam, tam);
    ctx.restore();
  };

  /* Devolve um data-URL (usado em <img> nas telas de UI) */
  A.dataURL = function (especieId, v) {
    var cv = A.canvasCriatura(especieId, v);
    return cv ? cv.toDataURL() : '';
  };

  A.limparCache = function () { CACHE = {}; CACHE_ORDEM = []; };

})(window.ANIMOS);
