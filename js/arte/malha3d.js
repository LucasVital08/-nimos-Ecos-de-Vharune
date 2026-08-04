/* =========================================================================
   ÂNIMOS — Ecos de Vharune
   malha3d.js — construção procedural de geometria 3D

   O desenho vetorial anterior produzia forma; volume era encenado com
   gradiente e um normal map deduzido da silhueta. Isso tem teto: a luz nunca
   soube da curvatura real, escama não virava relevo de verdade e nada podia
   se auto-ocluir — a asa não escurecia o dorso porque a asa não estava na
   frente de nada, estava só pintada por cima.

   Aqui os Ânimos passam a ser MALHA: vértices, triângulos e normais reais,
   construídos em tempo de execução. Continua sem um único arquivo de imagem
   ou modelo no projeto — o bicho é uma função, não um asset.

   Vocabulário do módulo:
     loft      — varre uma seção transversal ao longo de uma spline. É a peça
                 central: tronco, pescoço, cauda, membro e focinho são todos
                 lofts com raio e achatamento variáveis.
     quadros   — o referencial que acompanha a spline. Usa transporte paralelo
                 (dupla reflexão) porque o método ingênuo — recalcular o "up"
                 a cada estação — torce a malha em curva fechada, e a torção
                 aparece como escama girando no pescoço.
     retalho   — superfície paramétrica genérica: membrana de asa, barbatana,
                 folha, capa, véu.
     faceta    — bloco de aresta viva, com vértice próprio por face, para
                 rocha e cristal não saírem com aparência de balão.

   Sistema de coordenadas: X para a frente (o bicho olha para +X), Y para
   cima, Z para o lado. O plano sagital é Z = 0, então simetria bilateral é
   simplesmente espelhar Z.

   As coordenadas de textura (u, v) são gravadas em DISTÂNCIA de superfície,
   não em [0,1]: u é o comprimento de arco ao longo da peça, v o perímetro
   percorrido. É o que faz a escama ter o mesmo tamanho no pescoço fino e no
   quadril largo, em vez de esticar junto com a peça.
   ========================================================================= */
(function (G) {
  'use strict';

  var M3 = G.Malha3D = {};

  /* ============================== vetores ============================== */

  function nrm(v) {
    var m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
  }
  function cruz(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]];
  }
  function pto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function som(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dist(a, b) {
    var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
    return Math.sqrt(x * x + y * y + z * z);
  }
  function mistura(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  M3.nrm = nrm; M3.cruz = cruz; M3.pto = pto; M3.som = som;
  M3.sub = sub; M3.mul = mul; M3.dist = dist; M3.mistura = mistura;

  /* ============================== splines ============================== */

  /* Catmull-Rom: passa pelos pontos de controle, que é o que se quer quando
     os pontos são articulações anatômicas (quadril, ombro, nuca). */
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t, r = [0, 0, 0], i;
    for (i = 0; i < 3; i++) {
      r[i] = 0.5 * ((2 * p1[i]) +
                    (-p0[i] + p2[i]) * t +
                    (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 +
                    (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    }
    return r;
  }

  /* Amostra a spline em n+1 pontos. Extremos duplicados para a curva começar
     e terminar exatamente no primeiro e no último ponto de controle. */
  M3.amostrar = function (pontos, n) {
    var pts = pontos.slice();
    if (pts.length < 2) return pts.slice();
    pts.unshift(som(pts[0], sub(pts[0], pts[1])));
    pts.push(som(pts[pts.length - 1], sub(pts[pts.length - 1], pts[pts.length - 2])));

    var segs = pts.length - 3;
    var saida = [], i;
    for (i = 0; i <= n; i++) {
      var g = (i / n) * segs;
      var s = Math.min(segs - 1, Math.floor(g));
      saida.push(catmull(pts[s], pts[s + 1], pts[s + 2], pts[s + 3], g - s));
    }
    return saida;
  };

  /* Quadros de referência ao longo de uma polilinha, por dupla reflexão.
     Devolve, por estação: centro, tangente, dorsal (up) e lateral. */
  M3.quadros = function (centros, upInicial) {
    var n = centros.length, i;
    var tang = [], quadros = [];

    for (i = 0; i < n; i++) {
      var a = centros[Math.max(0, i - 1)];
      var b = centros[Math.min(n - 1, i + 1)];
      var t = sub(b, a);
      if (t[0] === 0 && t[1] === 0 && t[2] === 0) t = [1, 0, 0];
      tang.push(nrm(t));
    }

    var up = upInicial || [0, 1, 0];
    /* dorsal precisa ser perpendicular à tangente; se for paralela, troca */
    var r = sub(up, mul(tang[0], pto(up, tang[0])));
    if (pto(r, r) < 1e-6) {
      up = [0, 0, 1];
      r = sub(up, mul(tang[0], pto(up, tang[0])));
    }
    r = nrm(r);

    for (i = 0; i < n; i++) {
      if (i > 0) {
        var v1 = sub(centros[i], centros[i - 1]);
        var c1 = pto(v1, v1);
        if (c1 > 1e-12) {
          var rL = sub(r, mul(v1, (2 / c1) * pto(v1, r)));
          var tL = sub(tang[i - 1], mul(v1, (2 / c1) * pto(v1, tang[i - 1])));
          var v2 = sub(tang[i], tL);
          var c2 = pto(v2, v2);
          r = c2 > 1e-12 ? sub(rL, mul(v2, (2 / c2) * pto(v2, rL))) : rL;
        }
        r = nrm(sub(r, mul(tang[i], pto(r, tang[i]))));
      }
      quadros.push({
        c: centros[i],
        t: tang[i],
        up: r,
        lado: nrm(cruz(tang[i], r))
      });
    }
    return quadros;
  };

  /* ============================== a malha ============================== */

  function Malha() {
    this.p = [];      /* x,y,z   por vértice */
    this.uv = [];     /* u,v     por vértice (em distância de superfície) */
    this.t = [];      /* a,b,c   por triângulo */
    this.mt = [];     /* material por triângulo */
    this.dl = [];     /* 1 = dupla face (membrana, barbatana, véu) */
  }
  M3.Malha = Malha;
  M3.malha = function () { return new Malha(); };

  Malha.prototype.v = function (x, y, z, u, vv) {
    var i = this.p.length / 3;
    this.p.push(x, y, z);
    this.uv.push(u || 0, vv || 0);
    return i;
  };
  Malha.prototype.vp = function (p, u, vv) { return this.v(p[0], p[1], p[2], u, vv); };

  Malha.prototype.f = function (a, b, c, mat, dupla) {
    if (a === b || b === c || a === c) return;
    this.t.push(a, b, c);
    this.mt.push(mat | 0);
    this.dl.push(dupla ? 1 : 0);
  };
  Malha.prototype.q = function (a, b, c, d, mat, dupla) {
    this.f(a, b, c, mat, dupla);
    this.f(a, c, d, mat, dupla);
  };

  Malha.prototype.nVerts = function () { return this.p.length / 3; };
  Malha.prototype.nTris = function () { return this.mt.length; };
  Malha.prototype.marca = function () { return { v: this.p.length / 3, t: this.mt.length }; };

  /* Espelha em Z tudo o que foi construído depois da marca. É como o bicho
     ganha o outro lado: constrói-se metade, espelha-se, e a simetria sai
     exata — inclusive nas asas e nos chifres. */
  Malha.prototype.espelharDesde = function (marca) {
    var v0 = marca.v, t0 = marca.t;
    var nV = this.p.length / 3, i;
    var desl = nV - v0;
    for (i = v0; i < nV; i++) {
      this.p.push(this.p[i * 3], this.p[i * 3 + 1], -this.p[i * 3 + 2]);
      this.uv.push(this.uv[i * 2], -this.uv[i * 2 + 1]);
    }
    var nT = this.mt.length;
    for (i = t0; i < nT; i++) {
      /* inverte a orientação, senão o lado espelhado fica com a normal ao
         contrário e o rasterizador o descarta como face de trás */
      this.f(this.t[i * 3] + desl, this.t[i * 3 + 2] + desl, this.t[i * 3 + 1] + desl,
             this.mt[i], this.dl[i]);
    }
    return this;
  };

  /* ============================== matrizes ============================= */
  /* 4x4 em ordem de linha; só rígidas + escala uniforme são usadas, então o
     mesmo bloco 3x3 serve para posição e direção. */

  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function multM(a, b) {
    var r = new Array(16), i, j, k, s;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
      s = 0;
      for (k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
      r[i * 4 + j] = s;
    }
    return r;
  }
  var MAT = M3.mat = {
    ident: ident,
    mult: multM,
    compor: function () {
      var m = ident();
      for (var i = 0; i < arguments.length; i++) m = multM(m, arguments[i]);
      return m;
    },
    transl: function (x, y, z) { var m = ident(); m[3] = x; m[7] = y; m[11] = z; return m; },
    escala: function (x, y, z) {
      var m = ident(); m[0] = x; m[5] = (y === undefined ? x : y); m[10] = (z === undefined ? x : z);
      return m;
    },
    rotX: function (a) {
      var c = Math.cos(a), s = Math.sin(a), m = ident();
      m[5] = c; m[6] = -s; m[9] = s; m[10] = c; return m;
    },
    rotY: function (a) {
      var c = Math.cos(a), s = Math.sin(a), m = ident();
      m[0] = c; m[2] = s; m[8] = -s; m[10] = c; return m;
    },
    rotZ: function (a) {
      var c = Math.cos(a), s = Math.sin(a), m = ident();
      m[0] = c; m[1] = -s; m[4] = s; m[5] = c; return m;
    },
    aplicar: function (m, p) {
      return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
              m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
              m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11]];
    }
  };

  /* Anexa outra malha, opcionalmente transformada. */
  Malha.prototype.juntar = function (o, m) {
    var desl = this.p.length / 3, i, n = o.p.length / 3;
    for (i = 0; i < n; i++) {
      var x = o.p[i * 3], y = o.p[i * 3 + 1], z = o.p[i * 3 + 2];
      if (m) {
        this.p.push(m[0] * x + m[1] * y + m[2] * z + m[3],
                    m[4] * x + m[5] * y + m[6] * z + m[7],
                    m[8] * x + m[9] * y + m[10] * z + m[11]);
      } else {
        this.p.push(x, y, z);
      }
      this.uv.push(o.uv[i * 2], o.uv[i * 2 + 1]);
    }
    for (i = 0; i < o.mt.length; i++) {
      this.f(o.t[i * 3] + desl, o.t[i * 3 + 1] + desl, o.t[i * 3 + 2] + desl,
             o.mt[i], o.dl[i]);
    }
    return this;
  };

  /* ============================ seções ================================= */

  /* Perfil da seção transversal. Um círculo puro lê como mangueira; o que dá
     leitura de bicho é a assimetria: barriga achatada, dorso mais alto e uma
     quilha opcional no peito.
       ang   — 0 = flanco, +PI/2 = dorso, -PI/2 = ventre
       op.ventre  — achatamento da metade de baixo (1 = redondo)
       op.dorso   — elevação da metade de cima
       op.quadrado— vai de elipse (0) a caixa arredondada (1) */
  function perfil(ang, rx, ry, op) {
    var c = Math.cos(ang), s = Math.sin(ang);
    var q = op && op.quadrado ? op.quadrado : 0;
    if (q > 0) {
      var e = 1 + q * 1.6;   /* expoente da superelipse */
      var ac = Math.abs(c), as = Math.abs(s);
      var k = Math.pow(Math.pow(ac, e) + Math.pow(as, e), -1 / e);
      c *= k; s *= k;
    }
    var a = c * rx, b = s * ry;
    if (op) {
      if (s < 0 && op.ventre !== undefined) b *= op.ventre;
      if (s > 0 && op.dorso !== undefined) b *= op.dorso;
      if (op.quilha) b -= op.quilha * ry * Math.max(0, -s) * Math.max(0, -s);
    }
    return [a, b];
  }
  M3.perfil = perfil;

  /* =============================== LOFT ================================ */

  /**
   * Varre uma seção ao longo de uma spline.
   * cfg:
   *   pontos    [[x,y,z]...]  controle da spline
   *   n         estações (padrão 20)
   *   lados     segmentos radiais (padrão 14)
   *   raio      fn(t, i) -> r  ou  [rInicio, rFim]
   *   achatar   fn(t) -> proporção altura/largura (padrão 1)
   *   secao     fn(t) -> {ventre, dorso, quadrado, quilha}
   *   desloc    fn(t) -> [lateral, dorsal]  desvio do centro
   *   mat       id de material, ou fn(t) -> id
   *   tampaA    fecha a ponta inicial (padrão false)
   *   tampaB    fecha a ponta final   (padrão false)
   *   u0        deslocamento inicial da coordenada u
   * Devolve {quadros, aneis, raios, u} para pendurar decoração no mesmo eixo.
   */
  Malha.prototype.loft = function (cfg) {
    var n = cfg.n || 20, lados = cfg.lados || 14, i, j;
    var centros = M3.amostrar(cfg.pontos, n);
    var qs = M3.quadros(centros, cfg.up);
    var raioFn = typeof cfg.raio === 'function'
      ? cfg.raio
      : (function (r) { return function (t) { return r[0] + (r[1] - r[0]) * t; }; })(cfg.raio || [0.1, 0.1]);
    var achatarFn = cfg.achatar || function () { return 1; };
    var secaoFn = cfg.secao || function () { return null; };
    var deslocFn = cfg.desloc || null;
    var matFn = typeof cfg.mat === 'function' ? cfg.mat : function () { return cfg.mat | 0; };

    var aneis = [], raios = [], us = [];
    var u = cfg.u0 || 0;

    for (i = 0; i <= n; i++) {
      var t = i / n;
      if (i > 0) u += dist(centros[i], centros[i - 1]);
      var r = raioFn(t, i);
      var ac = achatarFn(t);
      var rx = r, ry = r * ac;
      var sec = secaoFn(t);
      var q = qs[i];
      var c = q.c;
      if (deslocFn) {
        var d = deslocFn(t);
        c = som(som(c, mul(q.lado, d[0])), mul(q.up, d[1]));
      }
      var anel = [], perim = 0, ant = null;
      for (j = 0; j < lados; j++) {
        var ang = (j / lados) * Math.PI * 2;
        var ab = perfil(ang, rx, ry, sec);
        var p = som(som(c, mul(q.lado, ab[0])), mul(q.up, ab[1]));
        if (ant) perim += dist(p, ant);
        ant = p;
        anel.push(this.v(p[0], p[1], p[2], u, perim));
      }
      aneis.push(anel);
      raios.push(r);
      us.push(u);
      qs[i] = { c: c, t: q.t, up: q.up, lado: q.lado };
    }

    /* O material é escolhido por faixa E por ângulo: é assim que a barriga
       ganha placa clara sem precisar de uma peça separada costurada. */
    for (i = 0; i < n; i++) {
      var A = aneis[i], B = aneis[i + 1];
      var tt = (i + 0.5) / n;
      for (j = 0; j < lados; j++) {
        var k = (j + 1) % lados;
        this.q(A[j], B[j], B[k], A[k], matFn(tt, (j + 0.5) / lados), false);
      }
    }

    if (cfg.tampaA) this.tampar(aneis[0], qs[0].c, sub(qs[0].c, mul(qs[0].t, raios[0] * 0.9)), matFn(0), true);
    if (cfg.tampaB) this.tampar(aneis[n], qs[n].c, som(qs[n].c, mul(qs[n].t, raios[n] * 0.9)), matFn(1), false);

    return { quadros: qs, aneis: aneis, raios: raios, u: us, centros: centros };
  };

  /* Fecha um anel com uma calota cônica suave. */
  Malha.prototype.tampar = function (anel, centro, ponta, mat, inverter) {
    var i, n = anel.length;
    var uu = this.uv[anel[0] * 2];
    var c = this.v(ponta[0], ponta[1], ponta[2], uu, 0);
    for (i = 0; i < n; i++) {
      var k = (i + 1) % n;
      if (inverter) this.f(c, anel[k], anel[i], mat, false);
      else this.f(c, anel[i], anel[k], mat, false);
    }
    void centro;
  };

  /* Costura dois anéis do mesmo tamanho (usado para emendar peças). */
  Malha.prototype.costurar = function (A, B, mat) {
    for (var j = 0; j < A.length; j++) {
      var k = (j + 1) % A.length;
      this.q(A[j], B[j], B[k], A[k], mat, false);
    }
  };

  /* ============================ primitivas ============================= */

  /* Elipsoide. Usado para olho, bulbo, baga, esfera de éter. */
  Malha.prototype.esfera = function (c, rx, ry, rz, mat, segs, aneis) {
    segs = segs || 16; aneis = aneis || 10;
    var i, j, grade = [];
    for (i = 0; i <= aneis; i++) {
      var fi = (i / aneis) * Math.PI;
      var sy = Math.cos(fi), sr = Math.sin(fi);
      var linha = [];
      for (j = 0; j < segs; j++) {
        var te = (j / segs) * Math.PI * 2;
        var x = c[0] + Math.cos(te) * sr * rx;
        var y = c[1] + sy * ry;
        var z = c[2] + Math.sin(te) * sr * rz;
        linha.push(this.v(x, y, z, fi * ry, te * rx * sr + fi * 0.0));
      }
      grade.push(linha);
    }
    for (i = 0; i < aneis; i++) {
      for (j = 0; j < segs; j++) {
        var k = (j + 1) % segs;
        this.q(grade[i][j], grade[i + 1][j], grade[i + 1][k], grade[i][k], mat, false);
      }
    }
    return grade;
  };

  /* Ponta curva e afilada: chifre, espinho, garra, presa, estalactite.
     A curvatura é o que separa "chifre" de "cone espetado no crânio". */
  Malha.prototype.ponta = function (cfg) {
    var base = cfg.base, dir = nrm(cfg.dir), comp = cfg.comp;
    var curva = cfg.curva || [0, 0, 0];
    var n = cfg.n || 7, lados = cfg.lados || 7;
    var raio = cfg.raio, mat = cfg.mat | 0;
    var pontos = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n;
      var p = som(base, mul(dir, comp * t));
      /* a curva entra como deslocamento quadrático: reta na base, virada na
         ponta, que é como queratina cresce */
      p = som(p, mul(curva, comp * t * t));
      pontos.push(p);
    }
    var perfilRaio = cfg.perfil || function (t) { return raio * (1 - t) * (1 - t * 0.35); };
    return this.loft({
      pontos: pontos, n: n * 2, lados: lados,
      raio: function (t) { return Math.max(0.0012, perfilRaio(t)); },
      achatar: cfg.achatar, secao: cfg.secao,
      mat: mat, tampaA: cfg.tampaA !== false, tampaB: true
    });
  };

  /* Retalho paramétrico de dupla face. fn(a, b) -> [x,y,z], com a e b em
     [0,1]. Serve para membrana de asa, barbatana, folha, capa e véu. */
  Malha.prototype.retalho = function (fn, na, nb, mat, opts) {
    opts = opts || {};
    var grade = [], i, j, ant;
    for (i = 0; i <= na; i++) {
      var linha = [], u = 0;
      ant = null;
      for (j = 0; j <= nb; j++) {
        var p = fn(i / na, j / nb);
        if (ant) u += dist(p, ant);
        ant = p;
        linha.push({ i: this.v(p[0], p[1], p[2], 0, u), p: p });
      }
      grade.push(linha);
    }
    /* u corre ao longo de a, v ao longo de b — ambos em distância real */
    for (j = 0; j <= nb; j++) {
      var acc = 0;
      for (i = 0; i <= na; i++) {
        if (i > 0) acc += dist(grade[i][j].p, grade[i - 1][j].p);
        this.uv[grade[i][j].i * 2] = acc;
      }
    }
    for (i = 0; i < na; i++) {
      for (j = 0; j < nb; j++) {
        this.q(grade[i][j].i, grade[i + 1][j].i, grade[i + 1][j + 1].i, grade[i][j + 1].i,
               mat, opts.dupla !== false);
      }
    }
    return grade;
  };

  /* Bloco de aresta viva. Cada face ganha vértices próprios para as normais
     não serem suavizadas — rocha precisa de quina, não de domo. */
  Malha.prototype.faceta = function (verts, faces, mat) {
    var self = this;
    faces.forEach(function (f) {
      var ids = f.map(function (k) {
        var p = verts[k];
        return self.v(p[0], p[1], p[2], p[0] * 1 + p[1] * 0.7, p[2] * 1 + p[1] * 0.3);
      });
      for (var i = 2; i < ids.length; i++) self.f(ids[0], ids[i - 1], ids[i], mat, false);
    });
  };

  /* Poliedro irregular a partir de uma esfera deformada por ruído, com as
     faces planas. É a base de todo golem e de todo cristal. */
  Malha.prototype.pedra = function (c, r, mat, rnd, cfg) {
    cfg = cfg || {};
    var segs = cfg.segs || 8, aneis = cfg.aneis || 5;
    var rug = cfg.rugosidade === undefined ? 0.30 : cfg.rugosidade;
    var esc = cfg.esc || [1, 1, 1];
    var grade = [], i, j;
    for (i = 0; i <= aneis; i++) {
      var fi = (i / aneis) * Math.PI;
      var linha = [];
      for (j = 0; j < segs; j++) {
        var te = (j / segs) * Math.PI * 2;
        var k = 1 - rug * 0.5 + rnd() * rug;
        linha.push([
          c[0] + Math.cos(te) * Math.sin(fi) * r * esc[0] * k,
          c[1] + Math.cos(fi) * r * esc[1] * k,
          c[2] + Math.sin(te) * Math.sin(fi) * r * esc[2] * k
        ]);
      }
      grade.push(linha);
    }
    /* polos colapsados para não gerar tiras degeneradas */
    for (i = 0; i <= aneis; i += aneis) {
      var med = [0, 0, 0];
      for (j = 0; j < segs; j++) { med = som(med, grade[i][j]); }
      med = mul(med, 1 / segs);
      for (j = 0; j < segs; j++) grade[i][j] = med;
    }
    for (i = 0; i < aneis; i++) {
      for (j = 0; j < segs; j++) {
        var k2 = (j + 1) % segs;
        this.faceta([grade[i][j], grade[i + 1][j], grade[i + 1][k2], grade[i][k2]],
                    [[0, 1, 2, 3]], mat);
      }
    }
  };

  /* ============================= acabamento ============================ */

  /* Normais por acumulação ponderada pela área (o produto vetorial já traz o
     peso). Peças de aresta viva já vêm com vértice por face, então saem
     planas naturalmente — não é preciso detectar vinco. */
  Malha.prototype.finalizar = function () {
    var nv = this.p.length / 3, nt = this.mt.length, i;
    var pos = new Float32Array(this.p);
    var nor = new Float32Array(nv * 3);
    var idx = new Uint32Array(this.t);

    for (i = 0; i < nt; i++) {
      var a = idx[i * 3] * 3, b = idx[i * 3 + 1] * 3, c = idx[i * 3 + 2] * 3;
      var ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      var vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz;
      nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz;
      nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz;
    }
    for (i = 0; i < nv; i++) {
      var x = nor[i * 3], y = nor[i * 3 + 1], z = nor[i * 3 + 2];
      var m = Math.sqrt(x * x + y * y + z * z);
      if (m > 1e-9) { nor[i * 3] = x / m; nor[i * 3 + 1] = y / m; nor[i * 3 + 2] = z / m; }
      else { nor[i * 3 + 1] = 1; }
    }

    /* caixa envolvente: o enquadramento da câmera sai daqui */
    var min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (i = 0; i < nv; i++) {
      for (var k = 0; k < 3; k++) {
        var vlr = pos[i * 3 + k];
        if (vlr < min[k]) min[k] = vlr;
        if (vlr > max[k]) max[k] = vlr;
      }
    }

    return {
      pos: pos,
      nor: nor,
      uv: new Float32Array(this.uv),
      idx: idx,
      mat: new Uint8Array(this.mt),
      dupla: new Uint8Array(this.dl),
      nVerts: nv,
      nTris: nt,
      min: min,
      max: max
    };
  };

})(window.ANIMOS);
