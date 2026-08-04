/* =========================================================================
   ÂNIMOS — Ecos de Vharune
   luz.js — sombreamento por normal map, aplicado sobre a arte procedural

   O problema: desenho vetorial produz forma, não volume. Gradiente pintado à
   mão é um chute de onde a luz bateria; ele não sabe da curvatura real da
   silhueta, então escama, dobra e quina não respondem à luz.

   O que este módulo faz, em cima do canvas já desenhado:

     1. lê o canal alfa                → máscara da silhueta
     2. borra a máscara                → campo de altura (a FORMA, baixa
                                          frequência: o bicho vira um domo)
     3. passa-alta da luminância       → o DETALHE (alta frequência: escama,
                                          placa, veio — o que já foi pintado)
     4. altura = forma + detalhe
     5. normal = normalize(-∂h/∂x, -∂h/∂y, 1)
     6. sombreia por pixel: ambiente + difusa + oclusão + rim lunar + especular

   É a mesma ideia que jogo 2D usa para sprite parecer esculpido, só que a
   altura é derivada da própria arte em vez de vir de um mapa pintado à parte.
   Continua sem nenhum arquivo de imagem no projeto.
   ========================================================================= */
(function (G) {
  'use strict';

  var L = G.Luz = {};

  /* ------------------------------------------------------------------ */
  /*  Desfoque separável                                                 */
  /* ------------------------------------------------------------------ */

  /* Box blur em duas passadas (horizontal e vertical). Repetido 3x fica
     visualmente indistinguível de gaussiana e custa O(n) por passada,
     independente do raio — que é o que permite raio grande sem pesar. */
  function borrarEixo(src, dst, larg, alt, raio, vertical) {
    var norm = 1 / (raio * 2 + 1);
    var linhas = vertical ? larg : alt;
    var cols = vertical ? alt : larg;
    var passo = vertical ? larg : 1;
    var salto = vertical ? 1 : larg;

    for (var l = 0; l < linhas; l++) {
      var base = l * salto;
      var soma = 0, i;

      /* janela inicial, com as bordas repetidas */
      for (i = -raio; i <= raio; i++) {
        soma += src[base + Math.min(cols - 1, Math.max(0, i)) * passo];
      }
      for (i = 0; i < cols; i++) {
        dst[base + i * passo] = soma * norm;
        var sai = Math.min(cols - 1, Math.max(0, i - raio));
        var entra = Math.min(cols - 1, Math.max(0, i + raio + 1));
        soma += src[base + entra * passo] - src[base + sai * passo];
      }
    }
  }

  function borrar(campo, larg, alt, raio, passes) {
    var a = campo, b = new Float32Array(campo.length), t;
    for (var p = 0; p < (passes || 1); p++) {
      borrarEixo(a, b, larg, alt, raio, false);
      t = a; a = b; b = t;
      borrarEixo(a, b, larg, alt, raio, true);
      t = a; a = b; b = t;
    }
    return a;
  }

  /* ------------------------------------------------------------------ */
  /*  Sombreamento                                                       */
  /* ------------------------------------------------------------------ */

  var PADRAO = {
    /* Luz de Orva: vem de cima, da esquerda, e um pouco de trás. O z baixo
       deixa a difusa rasante, que é o que revela relevo. */
    luz: [-0.42, -0.76, 0.50],
    corLuz: [255, 250, 238],
    ambiente: 0.84,          /* quanto do albedo sobrevive sem luz direta */
    forcaDifusa: 0.40,
    /* rebote frio do chão, preenchendo a sombra por baixo */
    corRebote: [96, 132, 190],
    forcaRebote: 0.13,
    /* Luz de borda: a assinatura lunar. Expoente ALTO de propósito — com
       expoente baixo o termo vaza para o corpo inteiro e o bicho fica
       leitoso, em vez de ter a quina acesa. */
    corRim: [176, 224, 255],
    forcaRim: 0.52,
    /* De onde vem a luz de borda. Precisa ser DIRECIONAL: só com o termo de
       Fresnel o rim aparece em toda a volta e o bicho fica com contorno de
       adesivo. Orva está atrás e à direita, oposta à luz principal. */
    dirRim: [0.62, -0.66, -0.42],
    /* expoenteRim e brilhoSpec estão fixos em 5 e 32 dentro do laço, por
       multiplicação. Mudá-los aqui não tem efeito — é o preço de trocar
       pow() por multiplicação, e vale: o laço ficou ~3x mais rápido. */
    /* especular: úmido/escamoso */
    forcaSpec: 0.17,
    /* oclusão nas quinas e dobras */
    forcaAO: 0.44,
    /* relevo */
    escalaForma: 2.3,        /* quanto a silhueta abaula */
    escalaDetalhe: 2.6,      /* quanto escama e placa saltam */
    raioForma: 5,
    detalhe: 0.5
  };

  /**
   * Aplica iluminação no conteúdo já desenhado do contexto.
   * @param {CanvasRenderingContext2D} ctx  canvas com a criatura pronta
   * @param {number} larg  largura em pixels reais
   * @param {number} alt   altura em pixels reais
   * @param {Object} [op]  sobrescreve PADRAO
   */
  L.aplicar = function (ctx, larg, alt, op) {
    var o = op || {};
    var cfg = {};
    var k;
    for (k in PADRAO) cfg[k] = (o[k] === undefined ? PADRAO[k] : o[k]);

    var img;
    try {
      img = ctx.getImageData(0, 0, larg, alt);
    } catch (e) {
      return false;   /* canvas contaminado: segue sem iluminação */
    }
    var d = img.data;
    var n = larg * alt;
    var i, p, x, y;

    /* ---------- 1. máscara e luminância ---------- */
    var mascara = new Float32Array(n);
    var lum = new Float32Array(n);
    /* Caixa da silhueta: a criatura ocupa pouco mais da metade do quadro, e
       sombrear pixel transparente é trabalho jogado fora. */
    var x0 = larg, x1 = -1, y0b = alt, y1 = -1;
    for (y = 0; y < alt; y++) {
      for (x = 0; x < larg; x++) {
        i = y * larg + x;
        p = i * 4;
        var a = d[p + 3] / 255;
        mascara[i] = a;
        lum[i] = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255 * a;
        if (a > 0.02) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0b) y0b = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return false;
    /* margem para o desfoque não cortar o campo de forma */
    var mg = cfg.raioForma * 4 + 4;
    x0 = Math.max(0, x0 - mg); x1 = Math.min(larg - 1, x1 + mg);
    y0b = Math.max(0, y0b - mg); y1 = Math.min(alt - 1, y1 + mg);

    /* ---------- 2. forma: máscara borrada vira domo ----------
       Calculada em MEIA resolução. A forma é de baixa frequência por
       definição, então metade da resolução é indistinguível — e custa 4x
       menos, que era o gargalo (borrar a máscara dominava o tempo). */
    var lm = larg >> 1, am = alt >> 1;
    var meia = new Float32Array(lm * am);
    for (y = 0; y < am; y++) {
      for (x = 0; x < lm; x++) {
        var s = y * 2 * larg + x * 2;
        meia[y * lm + x] = (mascara[s] + mascara[s + 1] +
                            mascara[s + larg] + mascara[s + larg + 1]) * 0.25;
      }
    }
    var formaMeia = borrar(meia, lm, am, cfg.raioForma, 3);
    /* devolve para resolução cheia por amostragem bilinear */
    var forma = new Float32Array(n);
    for (y = 0; y < alt; y++) {
      var fy = y * 0.5, y0 = fy | 0, ty = fy - y0;
      if (y0 >= am - 1) { y0 = am - 2; ty = 1; }
      if (y0 < 0) { y0 = 0; ty = 0; }
      for (x = 0; x < larg; x++) {
        var fx = x * 0.5, x0 = fx | 0, tx = fx - x0;
        if (x0 >= lm - 1) { x0 = lm - 2; tx = 1; }
        if (x0 < 0) { x0 = 0; tx = 0; }
        var i00 = y0 * lm + x0;
        var a0 = formaMeia[i00] + (formaMeia[i00 + 1] - formaMeia[i00]) * tx;
        var a1 = formaMeia[i00 + lm] + (formaMeia[i00 + lm + 1] - formaMeia[i00 + lm]) * tx;
        forma[y * larg + x] = a0 + (a1 - a0) * ty;
      }
    }

    /* ---------- 3. detalhe: passa-alta da luminância ---------- */
    var lumSuave = borrar(Float32Array.from(lum), larg, alt, 2, 1);

    /* ---------- 4. altura combinada ---------- */
    var h = new Float32Array(n);
    for (i = 0; i < n; i++) {
      h[i] = forma[i] + (lum[i] - lumSuave[i]) * cfg.detalhe;
    }

    /* ---------- 5. normais + sombreamento ---------- */
    var lx = cfg.luz[0], ly = cfg.luz[1], lz = cfg.luz[2];
    var ml = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ml; ly /= ml; lz /= ml;

    var rx0 = cfg.dirRim[0], ry0 = cfg.dirRim[1], rz0 = cfg.dirRim[2];
    var mr = Math.sqrt(rx0 * rx0 + ry0 * ry0 + rz0 * rz0);
    rx0 /= mr; ry0 /= mr; rz0 /= mr;

    /* meio-vetor para o especular (visão em (0,0,1)) */
    var hx = lx, hy = ly, hz = lz + 1;
    var mh = Math.sqrt(hx * hx + hy * hy + hz * hz);
    hx /= mh; hy /= mh; hz /= mh;

    var idx;
    for (y = y0b; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        idx = y * larg + x;
        if (mascara[idx] <= 0.02) continue;

        /* gradiente central; nas bordas repete a amostra */
        var xe = x > 0 ? idx - 1 : idx;
        var xd = x < larg - 1 ? idx + 1 : idx;
        var yc = y > 0 ? idx - larg : idx;
        var yb = y < alt - 1 ? idx + larg : idx;

        var dhx = (h[xd] - h[xe]) * cfg.escalaForma * 8;
        var dhy = (h[yb] - h[yc]) * cfg.escalaForma * 8;
        /* o detalhe entra com escala própria, senão escama some no domo */
        dhx += (lum[xd] - lum[xe]) * cfg.escalaDetalhe;
        dhy += (lum[yb] - lum[yc]) * cfg.escalaDetalhe;

        var nx = -dhx, ny = -dhy, nz = 1;
        var mn = Math.sqrt(nx * nx + ny * ny + 1);
        nx /= mn; ny /= mn; nz /= mn;

        /* difusa */
        var nl = nx * lx + ny * ly + nz * lz;
        if (nl < 0) nl = 0;

        /* oclusão: perto da borda o campo de forma é baixo */
        var ao = forma[idx] / 0.55;
        if (ao > 1) ao = 1;
        ao = 1 - cfg.forcaAO * (1 - ao * ao);

        /* Rim: normal olhando para fora da tela.
           pow() é o custo dominante deste laço — são dois por pixel, 131 mil
           chamadas num retrato de 256². Como os expoentes são inteiros
           conhecidos (5 e 32), sai por multiplicação, exato e muito mais
           barato. */
        var faces = nz;
        if (faces < 0) faces = 0;
        var tr = 1 - faces;
        var tr2 = tr * tr;
        var rim = tr2 * tr2 * tr;               /* ^5 */
        /* ...e só do lado virado para Orva */
        var nr = nx * rx0 + ny * ry0 + nz * rz0;
        rim *= nr > 0 ? nr : 0;

        /* rebote frio, vindo de baixo */
        var reb = -ny;
        if (reb < 0) reb = 0;

        /* especular */
        var nh = nx * hx + ny * hy + nz * hz;
        if (nh < 0) nh = 0;
        var s2 = nh * nh, s4 = s2 * s2, s8 = s4 * s4, s16 = s8 * s8;
        var spec = s16 * s16 * cfg.forcaSpec;   /* ^32 */

        var ganho = (cfg.ambiente + cfg.forcaDifusa * nl) * ao;

        p = idx * 4;
        var alfa = mascara[idx];
        var r = d[p] * ganho + cfg.corLuz[0] * spec * alfa
              + cfg.corRim[0] * rim * cfg.forcaRim * alfa
              + cfg.corRebote[0] * reb * cfg.forcaRebote * ao * alfa;
        var g = d[p + 1] * ganho + cfg.corLuz[1] * spec * alfa
              + cfg.corRim[1] * rim * cfg.forcaRim * alfa
              + cfg.corRebote[1] * reb * cfg.forcaRebote * ao * alfa;
        var b = d[p + 2] * ganho + cfg.corLuz[2] * spec * alfa
              + cfg.corRim[2] * rim * cfg.forcaRim * alfa
              + cfg.corRebote[2] * reb * cfg.forcaRebote * ao * alfa;

        d[p] = r > 255 ? 255 : (r < 0 ? 0 : r);
        d[p + 1] = g > 255 ? 255 : (g < 0 ? 0 : g);
        d[p + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
      }
    }

    ctx.putImageData(img, 0, 0);
    return true;
  };

})(window.ANIMOS);
