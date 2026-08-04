/* =========================================================================
   ÂNIMOS — Ecos de Vharune
   render3d.js — rasterizador por software para os retratos dos Ânimos

   Não há WebGL aqui de propósito: o jogo roda offline, sem build, sem
   dependência, e precisa produzir um PNG por indivíduo para o bestiário, a
   ficha e o token da carteira. Um rasterizador próprio entrega exatamente
   isso — uma imagem, em canvas 2D, sem contexto de GPU para gerenciar.

   Pipeline, na ordem:

     1. transformação     vértice -> espaço de vista -> tela, com 1/w guardado
                          para interpolação com correção de perspectiva
     2. mapa de sombra    passada só de profundidade a partir da luz principal
                          (é o que faz a asa escurecer o dorso de verdade)
     3. G-buffer          rasteriza normal, uv, material e profundidade; nada
                          é sombreado duas vezes, mesmo com muita sobreposição
     4. oclusão           AO em espaço de tela, lida do próprio buffer de
                          profundidade — fecha as dobras e o vão sob o queixo
     5. sombreamento      por pixel: relevo procedural perturba a normal, e só
                          então entram difusa, especular, luar de borda e
                          rebote frio do chão
     6. translúcidos      membrana de asa, geleia, névoa e véu, ordenados de
                          trás para a frente, testando profundidade sem gravar
     7. resolução         renderiza em 2x e reduz por caixa — antisserrilhado
                          honesto, inclusive na borda alfa
     8. florescer         brilho difundido só do que é emissivo, para chama,
                          cristal e olho aceso "vazarem" luz

   O relevo (escama, placa, pena, quitina, veio de rocha) não é geometria: é
   uma função de altura avaliada por pixel em coordenadas de superfície, com
   derivada analítica. Modelar escama vértice a vértice custaria centenas de
   milhares de triângulos por bicho; assim custa uma dúzia de multiplicações
   e ainda responde certo à luz, porque a normal é realmente perturbada.
   ========================================================================= */
(function (G) {
  'use strict';

  var R = G.Render3D = {};

  /* ============================ ruído 3D =============================== */

  function hash3(x, y, z) {
    var n = (x * 374761393 + y * 668265263 + z * 1442695041) | 0;
    n = (n ^ (n >>> 13)) | 0;
    n = Math.imul(n, 1274126177) | 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function suave(t) { return t * t * (3 - 2 * t); }

  function ruido3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = suave(x - xi), yf = suave(y - yi), zf = suave(z - zi);
    var c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi);
    var c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
    var c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
    var c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
    var x00 = c000 + (c100 - c000) * xf, x10 = c010 + (c110 - c010) * xf;
    var x01 = c001 + (c101 - c001) * xf, x11 = c011 + (c111 - c011) * xf;
    var y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf;
    return y0 + (y1 - y0) * zf;
  }
  function fbm3(x, y, z, oit) {
    var s = 0, a = 0.5, f = 1, n = 0;
    for (var i = 0; i < (oit || 3); i++) {
      s += ruido3(x * f, y * f, z * f) * a;
      n += a; a *= 0.5; f *= 2.03;
    }
    return s / n;
  }
  R.ruido3 = ruido3;
  R.fbm3 = fbm3;

  /* ====================== superfícies procedurais ======================
     Cada função devolve, na saída compartilhada SUP:
       h    altura (não usada direta, fica para depuração)
       du   derivada em u   -> inclina a normal ao longo da peça
       dv   derivada em v   -> inclina a normal ao redor da peça
       t    0..1  mistura para a cor secundária (fundo de sulco, veio)
       g    ganho de brilho especular local (aresta molhada de escama)
     u e v chegam em distância real de superfície, então a mesma frequência
     dá o mesmo tamanho de escama no pescoço fino e no quadril largo.        */

  var SUP = { h: 0, du: 0, dv: 0, t: 0, g: 0 };

  function fract(x) { return x - Math.floor(x); }

  var TEX = {};

  /* Escama de réptil: fileiras alternadas, cada uma uma cúpula com a aresta
     dianteira levantada. É a aresta que o olho lê como escama; a cúpula
     sozinha vira bolha. */
  TEX.escama = function (u, v, s, amp) {
    var fu = u / s, fv = v / s;
    var linha = Math.floor(fv);
    fu += (linha & 1) ? 0.5 : 0;
    var cu = fract(fu) - 0.5;
    var cv = fract(fv) - 0.5;
    /* alongada ao longo do corpo e deslocada: a metade de trás fica sob a
       escama seguinte, como telha */
    var au = cu * 1.62, av = cv * 2.20;
    var r2 = au * au + av * av;
    if (r2 >= 1) { SUP.du = 0; SUP.dv = 0; SUP.t = 1; SUP.g = 0; SUP.h = 0; return SUP; }
    var h = 1 - r2;
    var borda = cu < -0.18 ? (1 + (cu + 0.18) * 2.4) : 1;   /* lábio da frente */
    SUP.h = h * amp;
    SUP.du = (-2 * au * 1.72 / s) * amp * borda;
    SUP.dv = (-2 * av * 2.05 / s) * amp;
    /* contraste contido de propósito: a escama tem de aparecer no relevo, não
       no albedo. Com sulco muito escuro o bicho ficava com aspecto de bolinha
       costurada em vez de pele. */
    SUP.t = 1 - h * 0.38;
    SUP.g = h * 0.16;
    return SUP;
  };

  /* Placa ventral: faixas largas atravessando a barriga, quase sem relevo em
     u e com degrau marcado em v. */
  TEX.placa = function (u, v, s, amp) {
    var fu = fract(u / (s * 2.6));
    var d = fu - 0.5;
    var h = 1 - 4 * d * d;
    SUP.h = h * amp;
    SUP.du = (-8 * d / (s * 2.6)) * amp;
    SUP.dv = 0;
    SUP.t = 1 - h * 0.6;
    SUP.g = h * 0.35;
    void v;
    return SUP;
  };

  /* Couro fino de membrana: rugas em ângulo mais veias grossas. */
  TEX.couro = function (u, v, s, amp) {
    var n1 = fbm3(u / s * 0.9, v / s * 0.9, 3.1, 3);
    var n2 = fbm3(u / s * 0.9 + 0.13, v / s * 0.9, 3.1, 3);
    var n3 = fbm3(u / s * 0.9, v / s * 0.9 + 0.13, 3.1, 3);
    var veia = Math.exp(-40 * Math.pow(fract(v / (s * 5.5)) - 0.5, 2));
    SUP.h = n1 * amp;
    SUP.du = (n2 - n1) / (0.13 * s / 0.9) * amp;
    SUP.dv = (n3 - n1) / (0.13 * s / 0.9) * amp + veia * amp * 1.4;
    SUP.t = 0.55 + n1 * 0.45 - veia * 0.35;
    SUP.g = 0.15;
    return SUP;
  };

  /* Pena: fileiras sobrepostas, cada uma com raque e barbas estriadas. */
  TEX.pena = function (u, v, s, amp) {
    var fu = u / (s * 2.2), fv = v / (s * 1.15);
    var linha = Math.floor(fu);
    fv += (linha & 1) ? 0.5 : 0;
    var cu = fract(fu), cv = fract(fv) - 0.5;
    var largura = 1 - 4 * cv * cv;
    if (largura <= 0) { SUP.du = 0; SUP.dv = 0; SUP.t = 1; SUP.g = 0; return SUP; }
    var borda = 1 - cu;                       /* ponta da pena por cima */
    var h = largura * borda;
    var barba = Math.sin((cv * 26 + cu * 5)) * 0.12;
    SUP.h = (h + barba) * amp;
    SUP.du = (-largura / (s * 2.2)) * amp * 1.2;
    SUP.dv = (-8 * cv * borda / (s * 1.15)) * amp + Math.cos(cv * 26 + cu * 5) * 26 * 0.12 / (s * 1.15) * amp * 0.25;
    SUP.t = 1 - h * 0.7;
    SUP.g = h * 0.2;
    return SUP;
  };

  /* Rocha: fbm de alto contraste, com fendas nos vales. */
  TEX.rocha = function (u, v, s, amp) {
    var e = s * 0.35;
    var n = fbm3(u / s, v / s, 7.3, 4);
    var nu = fbm3((u + e) / s, v / s, 7.3, 4);
    var nv = fbm3(u / s, (v + e) / s, 7.3, 4);
    SUP.h = n * amp;
    SUP.du = (nu - n) / e * amp;
    SUP.dv = (nv - n) / e * amp;
    /* rocha vive de relevo, não de mancha: sulco muito escuro apagava o
       golem inteiro contra o fundo noturno */
    SUP.t = (1 - n) * 0.7;
    SUP.g = 0.06;
    return SUP;
  };

  /* Quitina: anéis segmentados e brilho alto de casca. */
  TEX.quitina = function (u, v, s, amp) {
    var fu = fract(u / (s * 2.0));
    var d = fu - 0.5;
    var h = 1 - 4 * d * d;
    var gr = fbm3(u / s * 3, v / s * 3, 1.7, 2) * 0.25;
    SUP.h = (h + gr) * amp;
    SUP.du = (-8 * d / (s * 2.0)) * amp;
    SUP.dv = 0;
    SUP.t = 1 - h * 0.5;
    SUP.g = h * 0.8 + 0.2;
    return SUP;
  };

  /* Geleia: quase liso, com ondulação lenta por dentro. */
  TEX.gel = function (u, v, s, amp) {
    var e = s * 0.4;
    var n = fbm3(u / (s * 3), v / (s * 3), 2.9, 2);
    var nu = fbm3((u + e) / (s * 3), v / (s * 3), 2.9, 2);
    var nv = fbm3(u / (s * 3), (v + e) / (s * 3), 2.9, 2);
    SUP.h = n * amp;
    SUP.du = (nu - n) / e * amp * 0.5;
    SUP.dv = (nv - n) / e * amp * 0.5;
    SUP.t = n;
    SUP.g = 0.9;
    return SUP;
  };

  /* Queratina: anéis de crescimento atravessando o chifre. */
  TEX.chifre = function (u, v, s, amp) {
    var fu = fract(u / (s * 1.5));
    var d = fu - 0.5;
    var h = 1 - 4 * d * d;
    SUP.h = h * amp;
    SUP.du = (-8 * d / (s * 1.5)) * amp * 0.8;
    SUP.dv = Math.sin(v / s * 7) * amp * 0.25 / s;
    SUP.t = 1 - h * 0.45;
    SUP.g = 0.35;
    return SUP;
  };

  /* Metal: escovado ao longo da peça. */
  TEX.metal = function (u, v, s, amp) {
    var n = ruido3(u / (s * 0.25), v / (s * 4), 5.5);
    SUP.h = n * amp;
    SUP.du = 0;
    SUP.dv = (ruido3(u / (s * 0.25), (v + s * 0.4) / (s * 4), 5.5) - n) / (s * 0.4) * amp;
    SUP.t = n * 0.6;
    SUP.g = 0.95;
    return SUP;
  };

  /* Cristal / gelo: facetas finas e muito brilho. */
  TEX.cristal = function (u, v, s, amp) {
    var e = s * 0.5;
    var n = Math.abs(fbm3(u / (s * 1.6), v / (s * 1.6), 11.2, 2) - 0.5) * 2;
    var nu = Math.abs(fbm3((u + e) / (s * 1.6), v / (s * 1.6), 11.2, 2) - 0.5) * 2;
    var nv = Math.abs(fbm3(u / (s * 1.6), (v + e) / (s * 1.6), 11.2, 2) - 0.5) * 2;
    SUP.h = n * amp;
    SUP.du = (nu - n) / e * amp;
    SUP.dv = (nv - n) / e * amp;
    SUP.t = 1 - n;
    SUP.g = 1;
    return SUP;
  };

  /* Folha / casca vegetal: nervuras em espinha. */
  TEX.folha = function (u, v, s, amp) {
    var central = Math.exp(-90 * Math.pow(fract(v / (s * 8)) - 0.5, 2));
    var lateral = Math.exp(-30 * Math.pow(fract((u + Math.abs(v) * 0.6) / (s * 2.2)) - 0.5, 2));
    SUP.h = (central + lateral * 0.5) * amp;
    SUP.du = -lateral * 0.5 * amp * 2 / s;
    SUP.dv = central * amp * 2 / s;
    SUP.t = 1 - (central * 0.5 + lateral * 0.3);
    SUP.g = 0.25;
    return SUP;
  };

  /* Névoa / corpo espectral: turbulência lenta, sem relevo duro. */
  TEX.nevoa = function (u, v, s, amp) {
    var n = fbm3(u / (s * 2.2), v / (s * 2.2), 13.7, 3);
    SUP.h = n * amp;
    SUP.du = 0; SUP.dv = 0;
    SUP.t = n;
    SUP.g = 0.1;
    return SUP;
  };

  TEX.liso = function () {
    SUP.h = 0; SUP.du = 0; SUP.dv = 0; SUP.t = 0; SUP.g = 0.3;
    return SUP;
  };

  R.TEX = TEX;

  /* ============================== buffers ============================== */

  var B = null;   /* buffers do G-buffer, alocados sob demanda e reciclados */

  function garantir(lado) {
    if (B && B.lado === lado) return B;
    var n = lado * lado;
    B = {
      lado: lado,
      n: n,
      iw: new Float32Array(n),      /* 1/w — maior = mais perto */
      nx: new Float32Array(n),
      ny: new Float32Array(n),
      nz: new Float32Array(n),
      u: new Float32Array(n),
      v: new Float32Array(n),
      lx: new Float32Array(n),      /* posição em espaço de luz */
      ly: new Float32Array(n),
      lz: new Float32Array(n),
      tri: new Int32Array(n),
      mat: new Uint8Array(n),
      ao: new Float32Array(n),
      cr: new Float32Array(n),
      cg: new Float32Array(n),
      cb: new Float32Array(n),
      ca: new Float32Array(n),
      er: new Float32Array(n),      /* canal emissivo, para o florescer */
      eg: new Float32Array(n),
      eb: new Float32Array(n)
    };
    return B;
  }

  /* Buffers de vértice transformado, também reciclados. */
  var V = null;
  function garantirV(nv) {
    if (V && V.cap >= nv) return V;
    var cap = Math.max(1024, nv * 2);
    V = {
      cap: cap,
      sx: new Float32Array(cap), sy: new Float32Array(cap),
      iw: new Float32Array(cap),
      nx: new Float32Array(cap), ny: new Float32Array(cap), nz: new Float32Array(cap),
      lx: new Float32Array(cap), ly: new Float32Array(cap), lz: new Float32Array(cap),
      vz: new Float32Array(cap),
      dentro: new Uint8Array(cap)
    };
    return V;
  }

  var SM = null;   /* mapa de sombra */
  function garantirSM(lado) {
    if (SM && SM.lado === lado) return SM;
    SM = { lado: lado, z: new Float32Array(lado * lado) };
    return SM;
  }

  R.liberar = function () { B = null; V = null; SM = null; };

  /* ============================== câmera =============================== */

  function baseVista(olho, alvo) {
    var f = [alvo[0] - olho[0], alvo[1] - olho[1], alvo[2] - olho[2]];
    var m = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]) || 1;
    f = [f[0] / m, f[1] / m, f[2] / m];
    var up = [0, 1, 0];
    var r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
    m = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]);
    if (m < 1e-6) { r = [0, 0, 1]; m = 1; }
    r = [r[0] / m, r[1] / m, r[2] / m];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    /* u = cross(r, f) já sai unitário; a base de normais usa -f para que
       superfície virada para a câmera dê nz positivo */
    return { r: r, u: u, f: f, olho: olho };
  }

  /* ============================ rasterização =========================== */

  /* Passada só de profundidade, do ponto de vista da luz. Ortográfica: a
     fonte é distante (Orva), e ortográfica não tem o problema de precisão
     perto do plano próximo. */
  function mapaSombra(malha, dirLuz, min, max, lado) {
    var sm = garantirSM(lado);
    var z = sm.z, i;
    for (i = 0; i < z.length; i++) z[i] = 1e9;

    /* base ortonormal com o eixo Z na direção da luz */
    var d = dirLuz;
    var m = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    var fz = [d[0] / m, d[1] / m, d[2] / m];
    var aux = Math.abs(fz[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    var fx = [fz[1] * aux[2] - fz[2] * aux[1], fz[2] * aux[0] - fz[0] * aux[2], fz[0] * aux[1] - fz[1] * aux[0]];
    m = Math.sqrt(fx[0] * fx[0] + fx[1] * fx[1] + fx[2] * fx[2]) || 1;
    fx = [fx[0] / m, fx[1] / m, fx[2] / m];
    var fy = [fz[1] * fx[2] - fz[2] * fx[1], fz[2] * fx[0] - fz[0] * fx[2], fz[0] * fx[1] - fz[1] * fx[0]];

    var c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    var raio = 0.5 * Math.sqrt(Math.pow(max[0] - min[0], 2) + Math.pow(max[1] - min[1], 2) +
                               Math.pow(max[2] - min[2], 2)) * 1.06 + 1e-4;

    var esc = lado / (raio * 2);
    var pos = malha.pos, idx = malha.idx;
    var nv = malha.nVerts;
    var px = new Float32Array(nv), py = new Float32Array(nv), pz = new Float32Array(nv);
    for (i = 0; i < nv; i++) {
      var dx = pos[i * 3] - c[0], dy = pos[i * 3 + 1] - c[1], dz = pos[i * 3 + 2] - c[2];
      px[i] = (dx * fx[0] + dy * fx[1] + dz * fx[2] + raio) * esc;
      py[i] = (dx * fy[0] + dy * fy[1] + dz * fy[2] + raio) * esc;
      pz[i] = dx * fz[0] + dy * fz[1] + dz * fz[2];
    }

    for (i = 0; i < malha.nTris; i++) {
      rasterZ(px, py, pz, idx[i * 3], idx[i * 3 + 1], idx[i * 3 + 2], z, lado);
    }

    return {
      z: z, lado: lado, esc: esc, raio: raio, c: c,
      fx: fx, fy: fy, fz: fz
    };
  }

  function rasterZ(px, py, pz, a, b, c, z, lado) {
    var x0 = px[a], y0 = py[a], x1 = px[b], y1 = py[b], x2 = px[c], y2 = py[c];
    var area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) return;
    if (area < 0) {
      var t = x1; x1 = x2; x2 = t; t = y1; y1 = y2; y2 = t;
      t = b; b = c; c = t; area = -area;
    }
    var minx = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    var maxx = Math.min(lado - 1, Math.ceil(Math.max(x0, x1, x2)));
    var miny = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    var maxy = Math.min(lado - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minx > maxx || miny > maxy) return;
    var inv = 1 / area;
    var za = pz[a], zb = pz[b], zc = pz[c];
    for (var y = miny; y <= maxy; y++) {
      var fy = y + 0.5;
      for (var x = minx; x <= maxx; x++) {
        var fx = x + 0.5;
        var w0 = (x1 - x0) * (fy - y0) - (fx - x0) * (y1 - y0);
        var w1 = (x2 - x1) * (fy - y1) - (fx - x1) * (y2 - y1);
        var w2 = (x0 - x2) * (fy - y2) - (fx - x2) * (y0 - y2);
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        var zz = (w1 * za + w2 * zb + w0 * zc) * inv;
        var k = y * lado + x;
        if (zz < z[k]) z[k] = zz;
      }
    }
  }

  /* ============================== render =============================== */

  var LUZ_PADRAO = {
    /* principal: alta, pela esquerda e um pouco à frente. Quase branca e
       levemente quente, para a escama fria do luar ter contra o que brigar. */
    dir: [-0.46, 0.66, 0.60],
    cor: [255, 248, 232],
    forca: 0.92,
    /* Orva por trás e à direita: é a assinatura do jogo. Entra por Fresnel
       vezes N·L, senão vira contorno de adesivo em volta do bicho inteiro. */
    dirRim: [0.72, 0.28, -0.62],
    corRim: [172, 218, 255],
    forcaRim: 1.05,
    /* ambiente hemisférico: céu frio por cima, chão violeta por baixo */
    corCeu: [96, 116, 168],
    corChao: [64, 50, 82],
    ambiente: 0.62,
    forcaAO: 0.52,
    expoenteRim: 3
  };
  R.LUZ_PADRAO = LUZ_PADRAO;

  /**
   * Renderiza uma cena num canvas quadrado.
   * cena = {
   *   malha      resultado de Malha.finalizar()
   *   materiais  [{cor, cor2, rug, spec, emis, alfa, tex, escala, subsup}]
   *   camera     {giro, inclina, fov, alvoY, margem, base}
   *   luz        sobrescreve LUZ_PADRAO
   *   ancoras    {nome: [x,y,z]} devolvidas projetadas no espaço lógico 100x100
   * }
   * opts = { lado, super, sombra, florescer }
   */
  R.render = function (cena, opts) {
    opts = opts || {};
    var LADO = opts.lado || 256;
    var SS = opts.super || 2;
    var W = LADO * SS;
    var malha = cena.malha;
    var mats = cena.materiais;
    var luz = {};
    var k;
    for (k in LUZ_PADRAO) luz[k] = LUZ_PADRAO[k];
    if (cena.luz) for (k in cena.luz) luz[k] = cena.luz[k];

    var buf = garantir(W);
    var nv = malha.nVerts, nt = malha.nTris;
    var vb = garantirV(nv);

    /* ---------- câmera ---------- */
    var cam = cena.camera || {};
    var giro = cam.giro === undefined ? 0.62 : cam.giro;        /* radianos, em torno de Y */
    var incl = cam.inclina === undefined ? 0.20 : cam.inclina;  /* elevação */
    var fov = cam.fov === undefined ? 0.55 : cam.fov;
    var min = malha.min, max = malha.max;
    var centro = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    var raio = 0.5 * Math.sqrt(Math.pow(max[0] - min[0], 2) + Math.pow(max[1] - min[1], 2) +
                               Math.pow(max[2] - min[2], 2)) + 1e-4;
    /* Quando a cena informa alturaRef, a câmera fica à MESMA distância para
       todas as espécies. Sem isso, o enquadramento automático encheria o
       quadro com qualquer bicho e o Pardalume de 30 cm sairia do tamanho do
       Vharuneth de 3,4 m — a arte anterior guardava essa diferença na escala
       do desenho, e ela precisa sobreviver à mudança para 3D. */
    var distancia = cam.alturaRef
      ? cam.alturaRef / Math.sin(fov * 0.5) * (cam.recuo || 0.98)
      : raio / Math.sin(fov * 0.5) * 0.92;
    var olho = [
      centro[0] + Math.cos(incl) * Math.cos(giro) * distancia,
      centro[1] + Math.sin(incl) * distancia,
      centro[2] + Math.cos(incl) * Math.sin(giro) * distancia
    ];
    var base = baseVista(olho, centro);
    var foco = 1 / Math.tan(fov * 0.5);

    /* ---------- transformação ---------- */
    var pos = malha.pos, nor = malha.nor;
    var sombraInfo = (opts.sombra === false) ? null
      : mapaSombra(malha, luz.dir, min, max, opts.ladoSombra || 320);

    var rx = base.r[0], ry = base.r[1], rz = base.r[2];
    var ux = base.u[0], uy = base.u[1], uz = base.u[2];
    var fx = base.f[0], fy = base.f[1], fz = base.f[2];
    var ox = olho[0], oy = olho[1], oz = olho[2];

    var i, dx, dy, dz, vzz;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    var pxs = new Float32Array(nv), pys = new Float32Array(nv);

    for (i = 0; i < nv; i++) {
      dx = pos[i * 3] - ox; dy = pos[i * 3 + 1] - oy; dz = pos[i * 3 + 2] - oz;
      var a = dx * rx + dy * ry + dz * rz;
      var b = dx * ux + dy * uy + dz * uz;
      var c = dx * fx + dy * fy + dz * fz;      /* profundidade, positiva à frente */
      if (c < 1e-3) c = 1e-3;
      vb.vz[i] = c;
      vb.iw[i] = 1 / c;
      pxs[i] = foco * a / c;
      pys[i] = foco * b / c;
      if (pxs[i] < minX) minX = pxs[i];
      if (pxs[i] > maxX) maxX = pxs[i];
      if (pys[i] < minY) minY = pys[i];
      if (pys[i] > maxY) maxY = pys[i];
      /* normal em espaço de vista, com Z para o observador */
      var na = nor[i * 3], nb = nor[i * 3 + 1], nc = nor[i * 3 + 2];
      vb.nx[i] = na * rx + nb * ry + nc * rz;
      vb.ny[i] = na * ux + nb * uy + nc * uz;
      vb.nz[i] = -(na * fx + nb * fy + nc * fz);
    }

    /* Enquadramento: escala para caber com margem e assenta a base do bicho
       na mesma altura em que a arte anterior o punha, para nada mudar de
       lugar no mapa e na batalha. */
    var margem = cam.margem === undefined ? 0.90 : cam.margem;
    var basePx = (cam.base === undefined ? 0.955 : cam.base);
    var escX = (maxX - minX) > 1e-6 ? (2 * margem) / (maxX - minX) : 1;
    var escY = (maxY - minY) > 1e-6 ? (2 * margem) / (maxY - minY) : 1;
    /* teto de ampliação: o bicho de referência preenche o quadro, os menores
       ficam proporcionalmente menores, e quem passa do quadro ainda encolhe */
    var escTeto = cam.alturaRef
      ? (2 * margem) / (foco * cam.alturaRef / distancia)
      : Infinity;
    var esc = Math.min(escX, escY, escTeto);
    var cxProj = (minX + maxX) / 2;
    /* o topo do quadro fica reservado: crista e chifre não podem encostar */
    var alvoBase = (basePx * 2 - 1);
    var deslY = -alvoBase - minY * esc;

    var meio = W / 2, escala = W / 2;
    for (i = 0; i < nv; i++) {
      vb.sx[i] = meio + (pxs[i] - cxProj) * esc * escala;
      vb.sy[i] = meio - (pys[i] * esc + deslY) * escala;
    }

    /* posição em espaço de luz, por vértice */
    if (sombraInfo) {
      var sfx = sombraInfo.fx, sfy = sombraInfo.fy, sfz = sombraInfo.fz;
      var sc = sombraInfo.c, sr = sombraInfo.raio, se = sombraInfo.esc;
      for (i = 0; i < nv; i++) {
        dx = pos[i * 3] - sc[0]; dy = pos[i * 3 + 1] - sc[1]; dz = pos[i * 3 + 2] - sc[2];
        vb.lx[i] = (dx * sfx[0] + dy * sfx[1] + dz * sfx[2] + sr) * se;
        vb.ly[i] = (dx * sfy[0] + dy * sfy[1] + dz * sfy[2] + sr) * se;
        vb.lz[i] = dx * sfz[0] + dy * sfz[1] + dz * sfz[2];
      }
    }

    /* ---------- tangentes por triângulo ---------- */
    var uvA = malha.uv, idx = malha.idx, matT = malha.mat, dupla = malha.dupla;
    var tanT = new Float32Array(nt * 3), tanB = new Float32Array(nt * 3);
    for (i = 0; i < nt; i++) {
      var a0 = idx[i * 3], b0 = idx[i * 3 + 1], c0 = idx[i * 3 + 2];
      /* arestas em espaço de vista */
      var e1x = (pos[b0 * 3] - pos[a0 * 3]), e1y = (pos[b0 * 3 + 1] - pos[a0 * 3 + 1]), e1z = (pos[b0 * 3 + 2] - pos[a0 * 3 + 2]);
      var e2x = (pos[c0 * 3] - pos[a0 * 3]), e2y = (pos[c0 * 3 + 1] - pos[a0 * 3 + 1]), e2z = (pos[c0 * 3 + 2] - pos[a0 * 3 + 2]);
      var du1 = uvA[b0 * 2] - uvA[a0 * 2], dv1 = uvA[b0 * 2 + 1] - uvA[a0 * 2 + 1];
      var du2 = uvA[c0 * 2] - uvA[a0 * 2], dv2 = uvA[c0 * 2 + 1] - uvA[a0 * 2 + 1];
      var det = du1 * dv2 - du2 * dv1;
      var tx, ty, tz, bx, by, bz;
      if (Math.abs(det) < 1e-12) {
        tx = e1x; ty = e1y; tz = e1z; bx = e2x; by = e2y; bz = e2z;
      } else {
        var id2 = 1 / det;
        tx = (e1x * dv2 - e2x * dv1) * id2;
        ty = (e1y * dv2 - e2y * dv1) * id2;
        tz = (e1z * dv2 - e2z * dv1) * id2;
        bx = (e2x * du1 - e1x * du2) * id2;
        by = (e2y * du1 - e1y * du2) * id2;
        bz = (e2z * du1 - e1z * du2) * id2;
      }
      /* leva para espaço de vista e normaliza */
      var Tx = tx * rx + ty * ry + tz * rz, Ty = tx * ux + ty * uy + tz * uz, Tz = -(tx * fx + ty * fy + tz * fz);
      var Bx = bx * rx + by * ry + bz * rz, By = bx * ux + by * uy + bz * uz, Bz = -(bx * fx + by * fy + bz * fz);
      var mT = Math.sqrt(Tx * Tx + Ty * Ty + Tz * Tz) || 1;
      var mB = Math.sqrt(Bx * Bx + By * By + Bz * Bz) || 1;
      tanT[i * 3] = Tx / mT; tanT[i * 3 + 1] = Ty / mT; tanT[i * 3 + 2] = Tz / mT;
      tanB[i * 3] = Bx / mB; tanB[i * 3 + 1] = By / mB; tanB[i * 3 + 2] = Bz / mB;
    }

    /* ---------- limpeza dos buffers ---------- */
    var n = buf.n;
    buf.iw.fill(0);
    buf.tri.fill(-1);
    buf.cr.fill(0); buf.cg.fill(0); buf.cb.fill(0); buf.ca.fill(0);
    buf.er.fill(0); buf.eg.fill(0); buf.eb.fill(0);

    /* ---------- G-buffer: opacos ---------- */
    var transl = [];
    for (i = 0; i < nt; i++) {
      var m = mats[matT[i]] || mats[0];
      if (m.alfa !== undefined && m.alfa < 0.995) {
        var ia = idx[i * 3], ib = idx[i * 3 + 1], ic = idx[i * 3 + 2];
        transl.push([i, (vb.vz[ia] + vb.vz[ib] + vb.vz[ic]) / 3]);
        continue;
      }
      rasterGB(vb, idx[i * 3], idx[i * 3 + 1], idx[i * 3 + 2], i, matT[i], dupla[i], buf, W,
               uvA, malha);
    }

    /* ---------- oclusão em espaço de tela ---------- */
    calcularAO(buf, W, luz.forcaAO, SS, raio);

    /* ---------- sombreamento ---------- */
    sombrear(buf, W, mats, luz, sombraInfo, tanT, tanB, opts, raio);

    /* ---------- translúcidos ---------- */
    transl.sort(function (a, b) { return b[1] - a[1]; });
    for (i = 0; i < transl.length; i++) {
      var ti = transl[i][0];
      rasterTransl(vb, idx[ti * 3], idx[ti * 3 + 1], idx[ti * 3 + 2], ti, mats[matT[ti]],
                   buf, W, uvA, malha, luz, sombraInfo, tanT, tanB);
    }

    /* ---------- florescer ---------- */
    if (opts.florescer !== false) florescer(buf, W);

    /* ---------- resolução para o canvas final ---------- */
    var cv = opts.canvas || document.createElement('canvas');
    cv.width = LADO; cv.height = LADO;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(LADO, LADO);
    var d = img.data;
    var inv = 1 / (SS * SS);
    for (var y = 0; y < LADO; y++) {
      for (var x = 0; x < LADO; x++) {
        var sr = 0, sg = 0, sb = 0, sa = 0;
        for (var oy = 0; oy < SS; oy++) {
          var row = (y * SS + oy) * W + x * SS;
          for (var ox = 0; ox < SS; ox++) {
            var q = row + ox;
            sr += buf.cr[q]; sg += buf.cg[q]; sb += buf.cb[q]; sa += buf.ca[q];
          }
        }
        var p = (y * LADO + x) * 4;
        sa *= inv;
        if (sa > 0.0015) {
          /* as cores foram acumuladas já multiplicadas por alfa */
          d[p] = Math.min(255, (sr * inv) / sa);
          d[p + 1] = Math.min(255, (sg * inv) / sa);
          d[p + 2] = Math.min(255, (sb * inv) / sa);
          d[p + 3] = Math.min(255, sa * 255);
        } else {
          d[p + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    /* ---------- âncoras projetadas ---------- */
    var anc = {};
    if (cena.ancoras) {
      for (k in cena.ancoras) {
        var pA = cena.ancoras[k];
        dx = pA[0] - ox; dy = pA[1] - oy; dz = pA[2] - oz;
        var ca2 = dx * fx + dy * fy + dz * fz;
        if (ca2 < 1e-3) ca2 = 1e-3;
        var aa = foco * (dx * rx + dy * ry + dz * rz) / ca2;
        var bb = foco * (dx * ux + dy * uy + dz * uz) / ca2;
        anc[k] = {
          x: (0.5 + (aa - cxProj) * esc * 0.5) * 100,
          y: (0.5 - (bb * esc + deslY) * 0.5) * 100,
          z: ca2,
          /* tamanho aparente de uma unidade do modelo, em unidades lógicas */
          k: foco / ca2 * esc * 50
        };
      }
    }

    /* caixa da criatura no espaço lógico 100x100, para quem compõe por cima
       (sombra de contato, chama, raio) saber onde ela está */
    var caixa = {
      x0: (0.5 + (minX - cxProj) * esc * 0.5) * 100,
      x1: (0.5 + (maxX - cxProj) * esc * 0.5) * 100,
      y0: (0.5 - (maxY * esc + deslY) * 0.5) * 100,
      y1: (0.5 - (minY * esc + deslY) * 0.5) * 100
    };

    return { canvas: cv, ancoras: anc, caixa: caixa, escala: esc, foco: foco };
  };

  /* ---------------------- rasterizador do G-buffer --------------------- */

  function rasterGB(vb, a, b, c, tri, mat, dupla, buf, W, uvA, malha) {
    var x0 = vb.sx[a], y0 = vb.sy[a], x1 = vb.sx[b], y1 = vb.sy[b], x2 = vb.sx[c], y2 = vb.sy[c];
    var area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0 || area !== area) return;
    if (area > 0) {
      /* de costas: só entra se a peça for de dupla face (membrana, véu) */
      if (!dupla) return;
      var t = x1; x1 = x2; x2 = t; t = y1; y1 = y2; y2 = t;
      t = b; b = c; c = t; area = -area;
    }
    area = -area;
    var minx = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    var maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    var miny = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    var maxy = Math.min(W - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minx > maxx || miny > maxy) return;

    var inv = 1 / area;
    var iwa = vb.iw[a], iwb = vb.iw[b], iwc = vb.iw[c];
    var ua = uvA[a * 2] * iwa, ub = uvA[b * 2] * iwb, uc = uvA[c * 2] * iwc;
    var va = uvA[a * 2 + 1] * iwa, vv = uvA[b * 2 + 1] * iwb, vc = uvA[c * 2 + 1] * iwc;
    var nxa = vb.nx[a] * iwa, nxb = vb.nx[b] * iwb, nxc = vb.nx[c] * iwc;
    var nya = vb.ny[a] * iwa, nyb = vb.ny[b] * iwb, nyc = vb.ny[c] * iwc;
    var nza = vb.nz[a] * iwa, nzb = vb.nz[b] * iwb, nzc = vb.nz[c] * iwc;
    var lxa = vb.lx[a] * iwa, lxb = vb.lx[b] * iwb, lxc = vb.lx[c] * iwc;
    var lya = vb.ly[a] * iwa, lyb = vb.ly[b] * iwb, lyc = vb.ly[c] * iwc;
    var lza = vb.lz[a] * iwa, lzb = vb.lz[b] * iwb, lzc = vb.lz[c] * iwc;

    for (var y = miny; y <= maxy; y++) {
      var fy = y + 0.5;
      var linha = y * W;
      for (var x = minx; x <= maxx; x++) {
        var fx = x + 0.5;
        var w0 = ((x1 - x0) * (fy - y0) - (fx - x0) * (y1 - y0)) * -1;
        var w1 = ((x2 - x1) * (fy - y1) - (fx - x1) * (y2 - y1)) * -1;
        var w2 = ((x0 - x2) * (fy - y2) - (fx - x2) * (y0 - y2)) * -1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        var ba = w1 * inv, bb = w2 * inv, bc = w0 * inv;
        var iw = ba * iwa + bb * iwb + bc * iwc;
        var q = linha + x;
        if (iw <= buf.iw[q]) continue;
        buf.iw[q] = iw;
        var wq = 1 / iw;
        buf.u[q] = (ba * ua + bb * ub + bc * uc) * wq;
        buf.v[q] = (ba * va + bb * vv + bc * vc) * wq;
        buf.nx[q] = (ba * nxa + bb * nxb + bc * nxc) * wq;
        buf.ny[q] = (ba * nya + bb * nyb + bc * nyc) * wq;
        buf.nz[q] = (ba * nza + bb * nzb + bc * nzc) * wq;
        buf.lx[q] = (ba * lxa + bb * lxb + bc * lxc) * wq;
        buf.ly[q] = (ba * lya + bb * lyb + bc * lyc) * wq;
        buf.lz[q] = (ba * lza + bb * lzb + bc * lzc) * wq;
        buf.tri[q] = tri;
        buf.mat[q] = mat;
      }
    }
    void malha;
  }

  /* ------------------------------- AO --------------------------------- */

  /* Oclusão lida do próprio buffer de profundidade. Não é ray tracing: é a
     comparação com oito vizinhos, que basta para fechar o vão sob o queixo,
     entre as pernas e nas dobras da asa — que é onde a falta de sombra
     denuncia que a imagem é plana. */
  var DIRS_AO = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7],
                 [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]];

  function calcularAO(buf, W, forca, SS, escalaCena) {
    var ao = buf.ao, iw = buf.iw;
    var raio = 9 * SS;
    var i, k;
    for (i = 0; i < buf.n; i++) ao[i] = 1;
    if (forca <= 0) return;
    /* os limiares vivem em unidades do modelo; sem normalizar pelo tamanho da
       cena, bicho grande ficaria sem AO e bicho pequeno ficaria encardido */
    var perto = 0.004 * escalaCena;
    var alcance = 0.20 * escalaCena;

    for (var y = 0; y < W; y++) {
      for (var x = 0; x < W; x++) {
        var q = y * W + x;
        if (iw[q] === 0) continue;
        var zc = 1 / iw[q];
        var occ = 0, cnt = 0;
        for (k = 0; k < 8; k++) {
          for (var passo = 1; passo <= 2; passo++) {
            var sx = x + (DIRS_AO[k][0] * raio * passo * 0.5) | 0;
            var sy = y + (DIRS_AO[k][1] * raio * passo * 0.5) | 0;
            if (sx < 0 || sy < 0 || sx >= W || sy >= W) continue;
            var qs = sy * W + sx;
            cnt++;
            if (iw[qs] === 0) continue;
            var zs = 1 / iw[qs];
            var dif = zc - zs;                      /* vizinho mais perto ocluí */
            if (dif > perto) {
              var atenua = dif > alcance ? 0 : (1 - dif / alcance);
              occ += atenua;
            }
          }
        }
        if (cnt > 0) {
          var f = 1 - forca * (occ / cnt) * 1.1;
          ao[q] = f < 0.34 ? 0.34 : f;
        }
      }
    }
  }

  /* --------------------------- sombreamento ---------------------------- */

  function amostraSombra(sm, lx, ly, lz, vies) {
    if (!sm) return 1;
    var lado = sm.lado, z = sm.z;
    var xi = lx | 0, yi = ly | 0;
    if (xi < 1 || yi < 1 || xi >= lado - 1 || yi >= lado - 1) return 1;
    var s = 0, cnt = 0;
    for (var oy = -1; oy <= 1; oy++) {
      for (var ox = -1; ox <= 1; ox++) {
        var zm = z[(yi + oy) * lado + xi + ox];
        s += (lz - vies <= zm) ? 1 : 0;
        cnt++;
      }
    }
    return s / cnt;
  }

  function sombrear(buf, W, mats, luz, sm, tanT, tanB, opts, escalaCena) {
    var i;
    var viesBase = 0.010 * escalaCena, viesRasante = 0.020 * escalaCena;
    var lx = luz.dir[0], ly = luz.dir[1], lz = luz.dir[2];
    var ml = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
    lx /= ml; ly /= ml; lz /= ml;
    var rx = luz.dirRim[0], ry = luz.dirRim[1], rz = luz.dirRim[2];
    var mr = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= mr; ry /= mr; rz /= mr;
    /* meio-vetor, com a vista fixa em (0,0,1) — o erro contra a vista real em
       perspectiva é invisível num retrato deste tamanho */
    var hx = lx, hy = ly, hz = lz + 1;
    var mh = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
    hx /= mh; hy /= mh; hz /= mh;

    var amb = luz.ambiente;
    var ceuR = luz.corCeu[0] / 255, ceuG = luz.corCeu[1] / 255, ceuB = luz.corCeu[2] / 255;
    var chR = luz.corChao[0] / 255, chG = luz.corChao[1] / 255, chB = luz.corChao[2] / 255;
    var lR = luz.cor[0] / 255 * luz.forca, lG = luz.cor[1] / 255 * luz.forca, lB = luz.cor[2] / 255 * luz.forca;
    var rimR = luz.corRim[0], rimG = luz.corRim[1], rimB = luz.corRim[2];
    var fRim = luz.forcaRim;

    var forcaRelevo = opts.relevo === undefined ? 1 : opts.relevo;

    for (i = 0; i < buf.n; i++) {
      if (buf.iw[i] === 0) continue;
      var mat = mats[buf.mat[i]] || mats[0];
      var nx = buf.nx[i], ny = buf.ny[i], nz = buf.nz[i];
      var mn = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= mn; ny /= mn; nz /= mn;
      /* peça de dupla face vista pelo avesso (membrana, véu): a normal
         interpolada aponta para longe da câmera e precisa ser virada */
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }

      /* relevo procedural: perturba a normal no plano tangente */
      var tex = TEX[mat.tex] || TEX.liso;
      var s = tex(buf.u[i], buf.v[i], mat.escala || 0.05, mat.relevo === undefined ? 0.9 : mat.relevo);
      var mistura = s.t, ganho = s.g;
      if (forcaRelevo > 0 && (s.du !== 0 || s.dv !== 0)) {
        var tri = buf.tri[i];
        var Tx = tanT[tri * 3], Ty = tanT[tri * 3 + 1], Tz = tanT[tri * 3 + 2];
        var Bx = tanB[tri * 3], By = tanB[tri * 3 + 1], Bz = tanB[tri * 3 + 2];
        var ku = -s.du * 0.032 * forcaRelevo, kv = -s.dv * 0.032 * forcaRelevo;
        nx += Tx * ku + Bx * kv;
        ny += Ty * ku + By * kv;
        nz += Tz * ku + Bz * kv;
        mn = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= mn; ny /= mn; nz /= mn;
      }

      /* albedo, misturando a cor secundária pelo sulco da textura */
      var c1 = mat.cor, c2 = mat.cor2 || mat.cor;
      var ar = c1[0] + (c2[0] - c1[0]) * mistura;
      var ag = c1[1] + (c2[1] - c1[1]) * mistura;
      var ab = c1[2] + (c2[2] - c1[2]) * mistura;

      var ao = buf.ao[i];

      /* difusa + sombra projetada */
      var nl = nx * lx + ny * ly + nz * lz;
      if (nl < 0) nl = 0;
      var som = 1;
      if (sm && nl > 0) {
        som = amostraSombra(sm, buf.lx[i], buf.ly[i], buf.lz[i], viesBase + (1 - nl) * viesRasante);
        som = 0.36 + 0.64 * som;
      }

      /* ambiente hemisférico: o eixo é a vertical da tela */
      var cima = ny * 0.5 + 0.5;
      var ambR = (chR + (ceuR - chR) * cima) * amb * ao;
      var ambG = (chG + (ceuG - chG) * cima) * amb * ao;
      var ambB = (chB + (ceuB - chB) * cima) * amb * ao;

      var difR = lR * nl * som, difG = lG * nl * som, difB = lB * nl * som;

      /* especular */
      var nh = nx * hx + ny * hy + nz * hz;
      if (nh < 0) nh = 0;
      var rug = mat.rug === undefined ? 0.5 : mat.rug;
      var e2 = nh * nh, e4 = e2 * e2, e8 = e4 * e4, e16 = e8 * e8;
      var pot = rug < 0.25 ? e16 * e16 : (rug < 0.55 ? e16 : e8);
      var spec = pot * (mat.spec === undefined ? 0.3 : mat.spec) * (0.45 + ganho) * som;

      /* luar de Orva na quina virada para a lua */
      var face = nz < 0 ? 0 : nz;
      var fr = 1 - face;
      var fr2 = fr * fr;
      var rimT = luz.expoenteRim >= 4 ? fr2 * fr2 : fr2 * fr;
      var nr = nx * rx + ny * ry + nz * rz;
      rimT *= nr > 0 ? nr : 0;
      rimT *= fRim * (0.35 + 0.65 * ao);

      /* translucidez: luz que atravessa peça fina (asa, barbatana, geleia) */
      var sss = mat.subsup || 0;
      if (sss > 0) {
        var back = -(nx * lx + ny * ly + nz * lz);
        if (back < 0) back = 0;
        var t2 = back * back;
        difR += lR * t2 * sss * 1.5;
        difG += lG * t2 * sss * 1.5;
        difB += lB * t2 * sss * 1.5;
      }

      var er = 0, eg = 0, eb = 0;
      if (mat.emis) {
        var ke = mat.emis;
        var ce = mat.corEmis || mat.cor;
        /* o miolo do que emite brilha mais de frente, a borda menos: dá a
           impressão de fonte com volume, não de adesivo aceso */
        var ie = ke * (0.55 + 0.45 * face);
        er = ce[0] * ie; eg = ce[1] * ie; eb = ce[2] * ie;
      }

      var R2 = ar * (ambR + difR) + 255 * spec + rimR * rimT + er;
      var G2 = ag * (ambG + difG) + 255 * spec + rimG * rimT + eg;
      var B2 = ab * (ambB + difB) + 255 * spec + rimB * rimT + eb;

      buf.cr[i] = R2; buf.cg[i] = G2; buf.cb[i] = B2; buf.ca[i] = 1;
      if (er + eg + eb > 0) { buf.er[i] = er; buf.eg[i] = eg; buf.eb[i] = eb; }
    }
  }

  /* --------------------- translúcidos, um a um ------------------------- */

  function rasterTransl(vb, a, b, c, tri, mat, buf, W, uvA, malha, luz, sm, tanT, tanB) {
    var x0 = vb.sx[a], y0 = vb.sy[a], x1 = vb.sx[b], y1 = vb.sy[b], x2 = vb.sx[c], y2 = vb.sy[c];
    var area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0 || area !== area) return;
    var invNor = 1;
    if (area > 0) {
      var t = x1; x1 = x2; x2 = t; t = y1; y1 = y2; y2 = t;
      t = b; b = c; c = t; area = -area; invNor = -1;
    }
    area = -area;
    var minx = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    var maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    var miny = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    var maxy = Math.min(W - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minx > maxx || miny > maxy) return;

    var inv = 1 / area;
    var iwa = vb.iw[a], iwb = vb.iw[b], iwc = vb.iw[c];
    var lxD = luz.dir, mlD = Math.sqrt(lxD[0] * lxD[0] + lxD[1] * lxD[1] + lxD[2] * lxD[2]) || 1;
    var Lx = lxD[0] / mlD, Ly = lxD[1] / mlD, Lz = lxD[2] / mlD;
    var rD = luz.dirRim, mrD = Math.sqrt(rD[0] * rD[0] + rD[1] * rD[1] + rD[2] * rD[2]) || 1;
    var Rx = rD[0] / mrD, Ry = rD[1] / mrD, Rz = rD[2] / mrD;
    var tex = TEX[mat.tex] || TEX.liso;
    var alfaBase = mat.alfa === undefined ? 1 : mat.alfa;

    var Tx = tanT[tri * 3], Ty = tanT[tri * 3 + 1], Tz = tanT[tri * 3 + 2];
    var Bx = tanB[tri * 3], By = tanB[tri * 3 + 1], Bz = tanB[tri * 3 + 2];

    for (var y = miny; y <= maxy; y++) {
      var fy = y + 0.5;
      for (var x = minx; x <= maxx; x++) {
        var fx = x + 0.5;
        var w0 = -((x1 - x0) * (fy - y0) - (fx - x0) * (y1 - y0));
        var w1 = -((x2 - x1) * (fy - y1) - (fx - x1) * (y2 - y1));
        var w2 = -((x0 - x2) * (fy - y2) - (fx - x2) * (y0 - y2));
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        var ba = w1 * inv, bb = w2 * inv, bc = w0 * inv;
        var iw = ba * iwa + bb * iwb + bc * iwc;
        var q = y * W + x;
        if (iw <= buf.iw[q]) continue;          /* atrás de algo opaco */
        var wq = 1 / iw;

        var nx = (ba * vb.nx[a] * iwa + bb * vb.nx[b] * iwb + bc * vb.nx[c] * iwc) * wq * invNor;
        var ny = (ba * vb.ny[a] * iwa + bb * vb.ny[b] * iwb + bc * vb.ny[c] * iwc) * wq * invNor;
        var nz = (ba * vb.nz[a] * iwa + bb * vb.nz[b] * iwb + bc * vb.nz[c] * iwc) * wq * invNor;
        var mn = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= mn; ny /= mn; nz /= mn;
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }   /* face vista por trás */

        var uu = (ba * uvA[a * 2] * iwa + bb * uvA[b * 2] * iwb + bc * uvA[c * 2] * iwc) * wq;
        var vv = (ba * uvA[a * 2 + 1] * iwa + bb * uvA[b * 2 + 1] * iwb + bc * uvA[c * 2 + 1] * iwc) * wq;

        var s = tex(uu, vv, mat.escala || 0.05, mat.relevo === undefined ? 0.9 : mat.relevo);
        if (s.du !== 0 || s.dv !== 0) {
          var ku = -s.du * 0.05, kv = -s.dv * 0.05;
          nx += Tx * ku + Bx * kv; ny += Ty * ku + By * kv; nz += Tz * ku + Bz * kv;
          mn = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= mn; ny /= mn; nz /= mn;
        }

        var nl = nx * Lx + ny * Ly + nz * Lz;
        var frente = nl > 0 ? nl : 0;
        var atras = nl < 0 ? -nl : 0;
        var som = 1;
        if (sm) {
          var slx = (ba * vb.lx[a] * iwa + bb * vb.lx[b] * iwb + bc * vb.lx[c] * iwc) * wq;
          var sly = (ba * vb.ly[a] * iwa + bb * vb.ly[b] * iwb + bc * vb.ly[c] * iwc) * wq;
          var slz = (ba * vb.lz[a] * iwa + bb * vb.lz[b] * iwb + bc * vb.lz[c] * iwc) * wq;
          som = 0.35 + 0.65 * amostraSombra(sm, slx, sly, slz, 0.02 * sm.raio);
        }

        var c1 = mat.cor, c2 = mat.cor2 || mat.cor;
        var mist = s.t;
        var ar = c1[0] + (c2[0] - c1[0]) * mist;
        var ag = c1[1] + (c2[1] - c1[1]) * mist;
        var ab = c1[2] + (c2[2] - c1[2]) * mist;

        var sss = mat.subsup === undefined ? 0.8 : mat.subsup;
        var ganho = luz.ambiente * 0.9 + luz.forca * (frente * 0.55 + atras * sss) * som;

        var face = nz < 0 ? 0 : nz;
        var fr = 1 - face, fr2 = fr * fr;
        var rimT = fr2 * fr;
        var nr = nx * Rx + ny * Ry + nz * Rz;
        rimT *= (nr > 0 ? nr : 0) * luz.forcaRim * 0.8;

        var eR = 0, eG = 0, eB = 0;
        if (mat.emis) {
          var ce = mat.corEmis || mat.cor;
          var ie = mat.emis * (0.5 + 0.5 * face);
          eR = ce[0] * ie; eG = ce[1] * ie; eB = ce[2] * ie;
        }

        /* borda da membrana pega mais luz: couro fino acende no contorno */
        var alfa = alfaBase * (0.72 + 0.28 * (1 - face));
        if (alfa > 1) alfa = 1;

        var cr = ar * ganho + luz.corRim[0] * rimT + eR;
        var cg = ag * ganho + luz.corRim[1] * rimT + eG;
        var cb = ab * ganho + luz.corRim[2] * rimT + eB;

        var inv2 = 1 - alfa;
        buf.cr[q] = buf.cr[q] * inv2 + cr * alfa;
        buf.cg[q] = buf.cg[q] * inv2 + cg * alfa;
        buf.cb[q] = buf.cb[q] * inv2 + cb * alfa;
        buf.ca[q] = buf.ca[q] * inv2 + alfa;
        if (eR + eG + eB > 0) {
          buf.er[q] += eR * alfa; buf.eg[q] += eG * alfa; buf.eb[q] += eB * alfa;
        }
      }
    }
    void malha;
  }

  /* ----------------------------- florescer ----------------------------- */

  /* Difunde só o canal emissivo e soma de volta. É o que faz chama, cristal
     e olho aceso parecerem fonte de luz em vez de mancha clara.

     O borrão acontece a 1/4 da resolução: florescimento é, por definição,
     baixa frequência, e borrar em resolução cheia custava mais que sombrear
     a cena inteira — 16x mais amostras para um resultado indistinguível. */
  var flA = null, flB = null, flLado = 0;

  function florescer(buf, W) {
    var n = buf.n, i;
    var soma = 0;
    for (i = 0; i < n; i += 7) soma += buf.er[i] + buf.eg[i] + buf.eb[i];
    if (soma < 1) return;

    var P = Math.max(32, W >> 2);          /* lado do buffer reduzido */
    var f = W / P;
    var np = P * P;
    if (flLado !== P) {
      flA = new Float32Array(np * 3);
      flB = new Float32Array(np * 3);
      flLado = P;
    } else {
      flA.fill(0);
    }

    /* redução por soma de blocos */
    var invF2 = 1 / (f * f);
    for (var y = 0; y < W; y++) {
      var py = (y / f) | 0;
      var linha = py * P;
      for (var x = 0; x < W; x++) {
        var q = y * W + x;
        var e = buf.er[q] + buf.eg[q] + buf.eb[q];
        if (e === 0) continue;
        var k = (linha + ((x / f) | 0)) * 3;
        flA[k] += buf.er[q] * invF2;
        flA[k + 1] += buf.eg[q] * invF2;
        flA[k + 2] += buf.eb[q] * invF2;
      }
    }

    borrarRGB(flA, flB, P, Math.max(2, P >> 5));
    borrarRGB(flA, flB, P, Math.max(3, P >> 4));

    /* devolve para a resolução cheia, com amostragem bilinear */
    for (y = 0; y < W; y++) {
      var fy = y / f - 0.5, y0 = Math.floor(fy), ty = fy - y0;
      if (y0 < 0) { y0 = 0; ty = 0; }
      if (y0 > P - 2) { y0 = P - 2; ty = 1; }
      for (x = 0; x < W; x++) {
        var fx = x / f - 0.5, x0 = Math.floor(fx), tx = fx - x0;
        if (x0 < 0) { x0 = 0; tx = 0; }
        if (x0 > P - 2) { x0 = P - 2; tx = 1; }
        var i00 = (y0 * P + x0) * 3, i10 = i00 + 3;
        var i01 = i00 + P * 3, i11 = i01 + 3;
        var r = ((flA[i00] * (1 - tx) + flA[i10] * tx) * (1 - ty) +
                 (flA[i01] * (1 - tx) + flA[i11] * tx) * ty) * 1.45;
        var g = ((flA[i00 + 1] * (1 - tx) + flA[i10 + 1] * tx) * (1 - ty) +
                 (flA[i01 + 1] * (1 - tx) + flA[i11 + 1] * tx) * ty) * 1.45;
        var b = ((flA[i00 + 2] * (1 - tx) + flA[i10 + 2] * tx) * (1 - ty) +
                 (flA[i01 + 2] * (1 - tx) + flA[i11 + 2] * tx) * ty) * 0.80;
        if (r + g + b < 0.6) continue;
        var q2 = y * W + x;
        var a = buf.ca[q2];
        /* o halo também escreve alfa: o brilho pode passar da silhueta */
        buf.cr[q2] += r; buf.cg[q2] += g; buf.cb[q2] += b;
        buf.ca[q2] = a + (1 - a) * Math.min(0.62, (r + g + b) / 340);
      }
    }
  }

  /* Box blur separável, duas passadas, resultado de volta em src. */
  function borrarRGB(src, aux, P, raio) {
    var i, c, x, y;
    var norm = 1 / (raio * 2 + 1);
    for (y = 0; y < P; y++) {
      var base = y * P;
      for (c = 0; c < 3; c++) {
        var s = 0;
        for (i = -raio; i <= raio; i++) s += src[(base + Math.min(P - 1, Math.max(0, i))) * 3 + c];
        for (i = 0; i < P; i++) {
          aux[(base + i) * 3 + c] = s * norm;
          s += src[(base + Math.min(P - 1, i + raio + 1)) * 3 + c] -
               src[(base + Math.max(0, i - raio)) * 3 + c];
        }
      }
    }
    for (x = 0; x < P; x++) {
      for (c = 0; c < 3; c++) {
        var s2 = 0;
        for (i = -raio; i <= raio; i++) s2 += aux[(Math.min(P - 1, Math.max(0, i)) * P + x) * 3 + c];
        for (i = 0; i < P; i++) {
          src[(i * P + x) * 3 + c] = s2 * norm;
          s2 += aux[(Math.min(P - 1, i + raio + 1) * P + x) * 3 + c] -
                aux[(Math.max(0, i - raio) * P + x) * 3 + c];
        }
      }
    }
  }

})(window.ANIMOS);
