/* =========================================================================
   ÂNIMOS — Ecos de Vharune
   especies3d.js — arquétipos corporais e o perfil de cada uma das 28 espécies

   `anatomia3d.js` fornece o vocabulário (coluna, crânio, membro, asa, crista);
   aqui ele é conjugado. Cada arquétipo monta um corpo completo a partir da
   ficha que a espécie já tinha em `data/especies.js` — arch, paleta, escala,
   corpoRX/RY, cabecaR, crista, cauda, asas e as bandeirinhas (placas, blocos,
   cristais, raios, gotejo, tentáculos, capa, halo, anéis).

   Nada de cadastro novo: o estereótipo continua sendo o que já estava escrito.
   O que existe aqui de extra é a tabela PERFIL, que ajusta o que só faz
   sentido em três dimensões — quanto o Aciarno afunda no próprio peso, quanto
   o pescoço do Abyssaro serpenteia, quanto do Noctun ainda é corpo antes de
   virar névoa.
   ========================================================================= */
(function (G) {
  'use strict';

  var M3 = G.Malha3D;
  var A3 = G.Anatomia3D;
  var E3 = G.Especies3D = {};
  var U = G.utils;
  var chaves = A3.chaves;
  var simetrico = A3.simetrico;

  /* =========================== utilidades ============================== */

  /* Anel fechado (halo, argola de éter). Construído à mão porque a spline
     aberta do loft deixaria costura visível numa peça circular. */
  function toro(M, centro, R, r, mat, aneis, lados, achatado) {
    var i, j, grade = [];
    achatado = achatado === undefined ? 1 : achatado;
    for (i = 0; i < aneis; i++) {
      var a = (i / aneis) * Math.PI * 2;
      var cx = centro[0] + Math.cos(a) * R;
      var cz = centro[2] + Math.sin(a) * R;
      var linha = [];
      for (j = 0; j < lados; j++) {
        var b = (j / lados) * Math.PI * 2;
        var rr = r * Math.cos(b), yy = r * Math.sin(b) * achatado;
        linha.push(M.v(cx + Math.cos(a) * rr, centro[1] + yy, cz + Math.sin(a) * rr,
                       a * R, b * r));
      }
      grade.push(linha);
    }
    for (i = 0; i < aneis; i++) {
      var A = grade[i], B = grade[(i + 1) % aneis];
      for (j = 0; j < lados; j++) {
        var k = (j + 1) % lados;
        M.q(A[j], B[j], B[k], A[k], mat, false);
      }
    }
  }

  function quadroEm(col, t) {
    var qs = col.quadros;
    var i = Math.max(0, Math.min(qs.length - 1, Math.round(t * (qs.length - 1))));
    return { q: qs[i], r: col.raios[i], i: i };
  }

  /* ===================== decoração da cabeça ========================== */

  /* Tudo o que a espécie usa na cabeça, construído no espaço do crânio para
     acompanhar a pose sem gambiarra de coordenada. */
  function decorarCabeca(H, ctx, tam) {
    var ID = ctx.ID, o = ctx.o, c = ctx.cfg, rnd = ctx.rnd;
    var t = o.crista || 'nenhuma';

    if (t === 'chifres') {
      A3.chifres(H, ctx, tam, { comp: c.chifreComp || 1.20, raio: c.chifreRaio || 0.14, par2: c.chifrePar2 });
    } else if (t === 'espinhos') {
      simetrico(H, function () {
        for (var i = 0; i < 3; i++) {
          var f = i / 2;
          H.ponta({
            base: [-tam * 0.30 + f * tam * 0.34, tam * (0.22 - f * 0.02), tam * (0.10 + f * 0.13)],
            dir: M3.nrm([-0.34, 0.88, 0.30 + f * 0.2]),
            comp: tam * (0.62 - f * 0.14), raio: tam * 0.075,
            curva: [-tam * 0.22, -tam * 0.06, 0], mat: ID.realce, n: 6, lados: 5,
            achatar: chaves([[0, 0.55], [1, 0.45]])
          });
        }
      });
    } else if (t === 'cristal') {
      simetrico(H, function () {
        for (var i = 0; i < 3; i++) {
          var f = i / 2;
          A3.cristaisEm(H, ID,
            [-tam * 0.26 + f * tam * 0.30, tam * 0.22, tam * (0.06 + f * 0.16)],
            [-0.20 + f * 0.2, 1, 0.28 + f * 0.24],
            tam * (0.75 - f * 0.20), tam * (0.10 - f * 0.02), rnd);
        }
      });
    } else if (t === 'folha') {
      A3.folhas(H, ID, {
        base: [-tam * 0.10, tam * 0.24, 0], n: 5,
        ang0: 2.0, ang1: 1.00, giro0: -1.0, giro1: 1.0,
        comp: tam * 0.98, larg: tam * 0.46
      });
    } else if (t === 'pena') {
      simetrico(H, function () {
        for (var i = 0; i < 3; i++) {
          var f = i / 2;
          H.retalho(function (a, b) {
            var l = tam * 0.11 * Math.sin(Math.pow(b, 0.6) * Math.PI);
            var d = (a - 0.5) * 2;
            return [-tam * 0.14 - b * tam * (0.34 + f * 0.16) + d * l * 0.3,
                    tam * 0.22 + b * tam * (0.72 - f * 0.10) - b * b * tam * 0.12,
                    tam * (0.06 + f * 0.14) + d * l];
          }, 3, 6, i % 2 ? ID.pena : ID.penaCl, {});
        }
      });
    } else if (t === 'chama') {
      /* crista de fogo: lâminas emissivas em leque, a que mais brilha no meio */
      for (var i = 0; i < 5; i++) {
        var f = i / 4;
        var lat = (f - 0.5) * 2;
        (function (f, lat) {
          H.retalho(function (a, b) {
            var l = tam * 0.15 * Math.sin(Math.pow(b, 0.5) * Math.PI) * (1 - Math.abs(lat) * 0.4);
            var d = (a - 0.5) * 2;
            var alt = tam * (1.25 - Math.abs(lat) * 0.55);
            return [-tam * 0.16 - b * tam * 0.24 + Math.sin(b * 5 + lat) * tam * 0.07 + d * l * 0.4,
                    tam * 0.20 + b * alt,
                    lat * tam * 0.16 + d * l];
          }, 3, 8, ID.chama, {});
        })(f, lat);
      }
      ctx.vfx.push({ tipo: 'chama', anc: 'crista', r: 1.0 });
    } else if (t === 'onda') {
      H.retalho(function (a, b) {
        var d = (a - 0.5) * 2;
        var alt = Math.sin(Math.pow(b, 0.7) * Math.PI) * tam * 0.80;
        return [-tam * 0.34 + b * tam * 0.70 + Math.sin(b * 3.2) * tam * 0.10,
                tam * 0.18 + alt,
                d * tam * 0.06 * (1 - b * 0.5)];
      }, 2, 12, ID.barbatana, {});
    } else if (t === 'barbatana') {
      H.retalho(function (a, b) {
        var d = (a - 0.5) * 2;
        return [-tam * 0.34 + b * tam * 0.62,
                tam * 0.20 + Math.sin(Math.pow(b, 0.65) * Math.PI) * tam * 0.72,
                d * tam * 0.05];
      }, 2, 10, ID.barbatana, {});
    } else if (t === 'antena') {
      simetrico(H, function () {
        var base = [-tam * 0.10, tam * 0.24, tam * 0.14];
        H.loft({
          pontos: [base, [base[0] - tam * 0.20, base[1] + tam * 0.55, base[2] + tam * 0.22],
                   [base[0] - tam * 0.10, base[1] + tam * 1.05, base[2] + tam * 0.30]],
          n: 10, lados: 5,
          raio: chaves([[0, tam * 0.05], [1, tam * 0.025]]),
          mat: ID.realce, tampaA: true, tampaB: false
        });
        H.esfera([base[0] - tam * 0.10, base[1] + tam * 1.10, base[2] + tam * 0.30],
                 tam * 0.10, tam * 0.10, tam * 0.10, ID.aceso, 10, 6);
      });
    } else if (t === 'chapeu') {
      /* Píleo de fungo: precisa transbordar o corpo, senão fica um chapéu
         dentro da cabeça — o raio sai do CORPO, não do crânio. */
      var raioC = (c.raioTorso || tam) * 1.26;
      var yC = tam * 0.30;
      H.retalho(function (a, b) {
        var ang = b * Math.PI * 2;
        var rr = raioC * Math.pow(a, 0.62);
        return [-tam * 0.06 + Math.cos(ang) * rr,
                yC + (1 - a * a) * raioC * 0.62,
                Math.sin(ang) * rr];
      }, 7, 22, ID.secund, { dupla: true });
      /* lamelas por baixo, em raios */
      for (var k = 0; k < 16; k++) {
        (function (ang) {
          H.retalho(function (a, b) {
            var rr = raioC * (0.22 + b * 0.74);
            return [-tam * 0.06 + Math.cos(ang) * rr,
                    yC - a * raioC * 0.13 * Math.sin(b * Math.PI),
                    Math.sin(ang) * rr];
          }, 1, 4, ID.realce, { dupla: true });
        })((k / 16) * Math.PI * 2);
      }
      /* estipe: o pescoço curto que segura o píleo */
      H.loft({
        pontos: [[-tam * 0.06, -yC, 0], [-tam * 0.06, yC * 0.4, 0], [-tam * 0.06, yC, 0]],
        n: 8, lados: 10,
        raio: chaves([[0, raioC * 0.30], [1, raioC * 0.22]]),
        mat: ID.pele, tampaA: false, tampaB: true
      });
    }

    if (o.halo && t !== 'halo') haloAcima(H, ctx, tam);
    if (t === 'halo') haloAcima(H, ctx, tam);
  }

  function haloAcima(H, ctx, tam) {
    toro(H, [-tam * 0.05, tam * 1.05, 0], tam * 0.78, tam * 0.075, ctx.ID.aceso, 24, 8, 0.6);
    ctx.vfx.push({ tipo: 'halo', anc: 'crista', r: 1.0 });
  }

  /* ======================= decoração da cauda ========================= */

  function decorarCauda(ctx, col) {
    var M = ctx.M, ID = ctx.ID, o = ctx.o, c = ctx.cfg;
    var t = o.cauda || 'nenhuma';
    var e = quadroEm(col, 0.02);
    var q = e.q, tam = c.raioTorso;
    var dir = M3.mul(q.t, -1);          /* aponta para fora da ponta */
    var base = q.c;
    ctx.ancoras.cauda = base;

    if (t === 'chama') {
      for (var i = 0; i < 4; i++) {
        (function (f) {
          M.retalho(function (a, b) {
            var l = tam * 0.34 * Math.sin(Math.pow(b, 0.5) * Math.PI);
            var d = (a - 0.5) * 2;
            var up = [0, 1, 0];
            var comp = tam * (2.6 - f * 0.5);
            var lat = (f - 1.5) * 0.5;
            return [base[0] + dir[0] * tam * 0.4 + Math.sin(b * 4 + f) * tam * 0.22 + d * l * 0.4,
                    base[1] + b * comp + Math.sin(b * 3) * tam * 0.2,
                    base[2] + lat * tam * 0.32 + d * l + up[2]];
          }, 3, 8, ID.chama, {});
        })(i);
      }
      ctx.vfx.push({ tipo: 'chama', anc: 'cauda', r: 1.15 });
    } else if (t === 'folha') {
      A3.folhas(M, ID, {
        base: base, n: 5, ang0: 2.5, ang1: 0.7, giro0: -1.0, giro1: 1.0,
        comp: tam * 2.2, larg: tam * 0.92
      });
    } else if (t === 'leque') {
      /* Cauda em leque: nadadeira caudal. As aves têm retriz própria, então
         aqui só entram as espécies aquáticas — dois leques na mesma cauda
         ficavam um dentro do outro. */
      if (c.lequeProprio) return;
      M.retalho(function (a, b) {
        var d = (a - 0.5) * 2;
        /* varrida: a raiz quase não abre e a borda de trás recua, senão a
           nadadeira lia como remo de plástico grudado na ponta da cauda */
        var abre = Math.pow(b, 1.35);
        var recuo = Math.abs(d) * b * 0.42;
        return [base[0] + dir[0] * tam * (1.55 * b + recuo * 0.9) + d * tam * 0.06 * abre,
                base[1] + dir[1] * tam * 1.55 * b + d * tam * 1.30 * abre,
                base[2] + dir[2] * tam * 1.55 * b + d * tam * 0.30 * abre];
      }, 5, 9, ID.barbatana, {});
    } else if (t === 'espinho') {
      M.ponta({
        base: base, dir: dir, comp: tam * 2.0, raio: tam * 0.36,
        curva: [0, tam * 0.36, 0], mat: ID.chifre, n: 8, lados: 7
      });
      simetrico(M, function () {
        M.ponta({
          base: M3.som(base, M3.mul(dir, tam * 0.5)),
          dir: M3.nrm([dir[0] * 0.3, 0.5, 0.9]), comp: tam * 0.9,
          raio: tam * 0.17, curva: [0, 0, 0], mat: ID.chifre, n: 5, lados: 5
        });
      });
    } else if (t === 'gota') {
      M.esfera(M3.som(base, M3.mul(dir, tam * 0.7)), tam * 0.85, tam * 0.95, tam * 0.85,
               ID.gel, 14, 9);
    } else if (t === 'raio') {
      var p0 = base;
      var pts = [p0];
      for (var k = 1; k <= 4; k++) {
        pts.push([p0[0] + dir[0] * tam * 0.7 * k + ((k % 2) ? tam * 0.25 : -tam * 0.25),
                  p0[1] + tam * 0.45 * k * (k % 2 ? 1 : 0.55),
                  p0[2] + ((k % 2) ? tam * 0.30 : -tam * 0.20)]);
      }
      M.loft({
        pontos: pts, n: 20, lados: 5,
        raio: chaves([[0, tam * 0.34], [1, tam * 0.03]]),
        achatar: chaves([[0, 0.4], [1, 0.4]]),
        mat: ID.aceso, tampaA: true, tampaB: true
      });
      ctx.vfx.push({ tipo: 'raio', anc: 'cauda', r: 1.0 });
    } else if (t === 'nevoa') {
      for (var w = 0; w < 3; w++) {
        (function (f) {
          M.retalho(function (a, b) {
            var l = tam * 0.5 * Math.sin(b * Math.PI) * (1 - f * 0.2);
            var d = (a - 0.5) * 2;
            return [base[0] + dir[0] * tam * 2.4 * b + Math.sin(b * 4 + f * 2) * tam * 0.4 + d * l * 0.5,
                    base[1] + dir[1] * tam * 1.6 * b - tam * 0.2 * b + f * tam * 0.35,
                    base[2] + dir[2] * tam * 2.0 * b + (f - 1) * tam * 0.5 + d * l];
          }, 3, 8, ID.veu, {});
        })(w);
      }
      ctx.vfx.push({ tipo: 'nevoa', anc: 'cauda', r: 1.0 });
    } else if (t === 'felpuda') {
      M.esfera(M3.som(base, M3.mul(dir, tam * 0.6)), tam * 0.9, tam * 0.8, tam * 0.8,
               ID.secund, 12, 8);
    }
  }

  /* ============================== asas ================================ */

  function montarAsas(ctx, ombro, env) {
    var o = ctx.o;
    var t = o.asas || 'nenhuma';
    if (t === 'nenhuma') return;
    var e = env * (o.asaGrande ? 1.32 : 1);
    simetrico(ctx.M, function () {
      if (t === 'membrana') {
        A3.asaMembrana(ctx, { ombro: ombro, env: e, ancoraCorpo: ctx.cfg.ancoraAsa });
      } else if (t === 'pena') {
        A3.asaPena(ctx, { ombro: ombro, env: e, n: ctx.cfg.nPenas || 11 });
      } else if (t === 'inseto') {
        A3.asaInseto(ctx, { ombro: ombro, env: e });
      } else if (t === 'eterea') {
        A3.asaEterea(ctx, { ombro: ombro, env: e });
      }
    });
    ctx.ancoras.asa = ombro;
  }

  /* ============================ arquétipos ============================ */

  var CORPO = {};

  /* --------------------------- quadrúpede ----------------------------- */
  CORPO.quadrupede = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, p = ctx.pose;
    var col = A3.coluna(ctx);
    ctx.col = col;

    var eOmb = quadroEm(col, 0.625), eQua = quadroEm(col, 0.375);
    var rO = eOmb.r, rQ = eQua.r;

    /* patas traseiras primeiro no código, mas o z-buffer é que decide o que
       fica na frente — não há mais ordem de pintura para acertar */
    simetrico(M, function () {
      var quadril = [eQua.q.c[0] + c.comp * 0.02, eQua.q.c[1] - rQ * 0.20, rQ * 0.62];
      A3.perna(ctx, {
        origem: quadril, comp: quadril[1] * (1 + p.passo * 0.06),
        esp: c.pernaEsp * 1.10, traseira: true, dedos: 3
      });
      /* coxa: massa muscular que a perna sozinha não tem */
      M.esfera([quadril[0] - c.comp * 0.03, quadril[1] - c.alturaQuadril * 0.16, quadril[2] * 0.86],
               rQ * 0.62, rQ * 0.78, rQ * 0.52, ID.membro, 12, 8);

      var ombro = [eOmb.q.c[0] + c.comp * 0.04, eOmb.q.c[1] - rO * 0.24, rO * 0.60];
      A3.perna(ctx, {
        origem: ombro, comp: ombro[1] * (1 - p.passo * 0.06),
        esp: c.pernaEsp, traseira: false, dedos: 3
      });
      M.esfera([ombro[0] - c.comp * 0.01, ombro[1] - c.alturaOmbro * 0.10, ombro[2] * 0.88],
               rO * 0.50, rO * 0.62, rO * 0.44, ID.membro, 12, 8);
    });

    decoraDorso(ctx, col);
    decorarCauda(ctx, col);

    /* asas nascem logo atrás da escápula */
    if ((o.asas || 'nenhuma') !== 'nenhuma') {
      var asaO = [eOmb.q.c[0] - c.comp * 0.06, eOmb.q.c[1] + rO * 0.72, rO * 0.34];
      c.ancoraAsa = [eQua.q.c[0], eQua.q.c[1] + rQ * 0.30, rQ * 0.55];
      montarAsas(ctx, asaO, c.comp * 1.05);
    }

    plantarCabeca(ctx, col);
    extrasCorpo(ctx, col);
  };

  /* ----------------------------- bípede ------------------------------- */
  CORPO.bipede = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, p = ctx.pose;
    c.pontos = function (c2, p2) {
      var comp = c2.comp, alt = c2.alturaOmbro, altQ = c2.alturaQuadril;
      var bal = p2.caudaBal, erg = p2.caudaErgue;
      return [
        [-comp * 1.05, altQ * (0.22 + erg * 0.5), bal * comp * 0.30],
        [-comp * 0.76, altQ * (0.34 + erg * 0.35), bal * comp * 0.20],
        [-comp * 0.46, altQ * (0.62 + erg * 0.14), bal * comp * 0.07],
        [-comp * 0.18, altQ, 0],
        [-comp * 0.04, altQ + (alt - altQ) * 0.46, 0],
        [comp * 0.12, alt, 0],
        [comp * 0.15, alt + c2.pescoco.subida * 0.34, 0],
        [comp * 0.15 + c2.pescoco.comp * 0.34, alt + c2.pescoco.subida * 0.80, 0],
        [comp * 0.15 + c2.pescoco.comp * (0.52 + p2.pescocoEstica * 0.16),
         alt + c2.pescoco.subida * (1 + p2.pescocoErgue), 0]
      ];
    };
    var col = A3.coluna(ctx);
    ctx.col = col;
    var eQua = quadroEm(col, 0.375), eOmb = quadroEm(col, 0.625);
    var rQ = eQua.r, rO = eOmb.r;

    simetrico(M, function () {
      var quadril = [eQua.q.c[0], eQua.q.c[1] - rQ * 0.16, rQ * 0.60];
      A3.perna(ctx, {
        origem: quadril, comp: quadril[1], esp: c.pernaEsp * 1.2,
        traseira: true, dedos: 3
      });
      M.esfera([quadril[0] - c.comp * 0.02, quadril[1] - c.alturaQuadril * 0.18, quadril[2] * 0.86],
               rQ * 0.70, rQ * 0.92, rQ * 0.56, ID.membro, 12, 8);
      A3.braco(ctx, {
        origem: [eOmb.q.c[0] + rO * 0.10, eOmb.q.c[1] - rO * 0.18, rO * 0.80],
        comp: c.bracoComp, esp: c.pernaEsp * 0.62
      });
    });

    decoraDorso(ctx, col);
    decorarCauda(ctx, col);

    if ((o.asas || 'nenhuma') !== 'nenhuma') {
      var asaO = [eOmb.q.c[0] - rO * 0.34, eOmb.q.c[1] + rO * 0.56, rO * 0.40];
      c.ancoraAsa = [eQua.q.c[0], eQua.q.c[1] + rQ * 0.40, rQ * 0.50];
      montarAsas(ctx, asaO, c.comp * 1.35);
    }
    if (o.capa) capa(ctx, col, eOmb, rO);

    plantarCabeca(ctx, col);
    extrasCorpo(ctx, col);
    void p;
  };

  /* ------------------------------- ave -------------------------------- */
  CORPO.ave = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, p = ctx.pose;
    c.pontos = function (c2, p2) {
      var comp = c2.comp, alt = c2.alturaOmbro, altQ = c2.alturaQuadril;
      var bal = p2.caudaBal;
      return [
        [-comp * 1.15, altQ * 0.86, bal * comp * 0.20],
        [-comp * 0.86, altQ * 0.92, bal * comp * 0.12],
        [-comp * 0.56, altQ * 0.98, 0],
        [-comp * 0.26, altQ, 0],
        [-comp * 0.02, (altQ + alt) * 0.52, 0],
        [comp * 0.22, alt, 0],
        [comp * 0.30, alt + c2.pescoco.subida * 0.40, 0],
        [comp * 0.30 + c2.pescoco.comp * 0.34, alt + c2.pescoco.subida * 0.84, 0],
        [comp * 0.30 + c2.pescoco.comp * 0.52, alt + c2.pescoco.subida * (1 + p2.pescocoErgue), 0]
      ];
    };
    c.lequeProprio = true;
    var col = A3.coluna(ctx);
    ctx.col = col;
    var eQua = quadroEm(col, 0.375), eOmb = quadroEm(col, 0.60);
    var rQ = eQua.r, rO = eOmb.r;

    simetrico(M, function () {
      var quadril = [eQua.q.c[0] + c.comp * 0.10, eQua.q.c[1] - rQ * 0.42, rQ * 0.46];
      /* tarso de ave: fino, escamado, com três dedos à frente e um atrás */
      A3.perna(ctx, {
        origem: quadril, comp: quadril[1], esp: c.pernaEsp * 0.72,
        traseira: true, dedos: 3
      });
    });

    decoraDorso(ctx, col);
    decorarCauda(ctx, col);

    var asaO = [eOmb.q.c[0] - rO * 0.20, eOmb.q.c[1] + rO * 0.46, rO * 0.52];
    c.ancoraAsa = [eQua.q.c[0], eQua.q.c[1] + rQ * 0.30, rQ * 0.5];
    montarAsas(ctx, asaO, c.comp * 1.55);

    /* leque caudal: rêmiges retrizes abrindo atrás */
    if ((o.cauda || '') === 'leque') {
      var base = quadroEm(col, 0.05).q.c;
      simetrico(M, function () {
        for (var i = 0; i < 5; i++) {
          var f = i / 4;
          (function (f) {
            M.retalho(function (a, b) {
              var l = c.raioTorso * 0.30 * Math.sin(Math.pow(b, 0.6) * Math.PI);
              var d = (a - 0.5) * 2;
              return [base[0] - b * c.comp * (0.75 + f * 0.18) + d * l * 0.2,
                      base[1] - b * c.comp * 0.10 + f * c.raioTorso * 0.14 + Math.abs(d) * l * 0.2,
                      base[2] + f * c.comp * 0.24 * b + d * l];
            }, 3, 6, i % 2 ? ID.pena : ID.penaCl, {});
          })(f);
        }
      });
    }

    plantarCabeca(ctx, col);
    extrasCorpo(ctx, col);
    void p;
  };

  /* ---------------------------- aquático ------------------------------ */
  CORPO.aquatico = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, p = ctx.pose;
    /* serpente marinha: não pousa, ondula. A coluna sobe e desce em S e a
       barriga nunca toca o chão. */
    c.pontos = function (c2, p2) {
      var comp = c2.comp, alt = c2.alturaOmbro;
      var bal = p2.caudaBal;
      return [
        [-comp * 1.15, alt * 0.62, bal * comp * 0.40],
        [-comp * 0.86, alt * 0.44, bal * comp * 0.26],
        [-comp * 0.54, alt * 0.52, bal * comp * 0.06],
        [-comp * 0.24, alt * 0.78, -bal * comp * 0.10],
        [comp * 0.04, alt * 0.92, -bal * comp * 0.06],
        [comp * 0.32, alt * 0.86, 0],
        [comp * 0.52, alt * (0.92 + c2.pescoco.subida * 0.10), 0],
        [comp * 0.52 + c2.pescoco.comp * 0.44, alt * (1.02 + p2.pescocoErgue * 0.2), 0],
        [comp * 0.52 + c2.pescoco.comp * 0.72, alt * (1.06 + p2.pescocoErgue * 0.3), 0]
      ];
    };
    var col = A3.coluna(ctx);
    ctx.col = col;

    /* barbatanas peitorais e pélvicas, no lugar dos membros */
    simetrico(M, function () {
      [[0.60, 1.0], [0.34, 0.72]].forEach(function (par) {
        var e = quadroEm(col, par[0]);
        var base = M3.som(e.q.c, M3.mul(e.q.lado, e.r * 0.75));
        M.retalho(function (a, b) {
          var l = e.r * 0.9 * Math.sin(Math.pow(b, 0.6) * Math.PI) * par[1];
          var d = (a - 0.5) * 2;
          return [base[0] - b * e.r * 1.5 * par[1] + d * l * 0.2,
                  base[1] - b * e.r * 1.5 * par[1] + Math.abs(d) * l * 0.15,
                  base[2] + b * e.r * 2.4 * par[1] + d * l];
        }, 3, 7, ID.barbatana, {});
      });
    });

    decoraDorso(ctx, col);
    decorarCauda(ctx, col);

    if (o.tentaculos) {
      var eT = quadroEm(col, 0.60);
      simetrico(M, function () {
        for (var i = 0; i < 3; i++) {
          var f = i / 2;
          var base = [eT.q.c[0] - c.comp * (0.02 + f * 0.10),
                      eT.q.c[1] - eT.r * 0.72,
                      eT.r * (0.20 + f * 0.30)];
          M.loft({
            pontos: [base,
                     [base[0] - c.comp * 0.14, base[1] - c.comp * 0.24, base[2] + c.comp * 0.10],
                     [base[0] - c.comp * 0.30, base[1] - c.comp * 0.40, base[2] + c.comp * 0.04],
                     [base[0] - c.comp * 0.50, base[1] - c.comp * 0.44, base[2] - c.comp * 0.06]],
            n: 16, lados: 7,
            raio: chaves([[0, eT.r * 0.20], [1, eT.r * 0.03]]),
            mat: ID.secund, tampaA: false, tampaB: true
          });
        }
      });
    }

    plantarCabeca(ctx, col);
    extrasCorpo(ctx, col);
    void p;
  };

  /* ------------------------------ ameba ------------------------------- */
  /* Sem esqueleto: uma gota de éter contida por membrana. O que dá leitura
     é a translucidez com núcleo denso suspenso dentro, não o contorno. */
  CORPO.ameba = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, rnd = ctx.rnd, p = ctx.pose;
    var R = c.raioTorso, alt = c.altura;
    var cy = alt * 0.46;

    var corpo = M3.malha();
    corpo.loft({
      pontos: [[0, alt * 0.02, 0], [0, cy * 0.60, 0], [0, cy * 1.12, 0], [0, alt * 0.94, 0]],
      n: 26, lados: 20,
      raio: chaves([[0, R * 0.86], [0.16, R * 1.02], [0.42, R * 1.0],
                    [0.72, R * 0.80], [1, R * 0.30]]),
      achatar: chaves([[0, 1], [1, 1]]),
      secao: function (t) { return { ventre: 1, dorso: 1, quadrado: t < 0.2 ? 0.35 : 0 }; },
      up: [1, 0, 0],
      mat: ID.gel, tampaA: true, tampaB: true
    });
    M.juntar(corpo);

    /* núcleo denso, e as bolhas que sobem por dentro dele */
    M.esfera([R * 0.06, cy * 0.78, 0], R * 0.44, R * 0.40, R * 0.42, ID.nucleo, 14, 9);
    if (o.bolhas) {
      for (var i = 0; i < 7; i++) {
        var a = rnd() * Math.PI * 2, d = R * (0.20 + rnd() * 0.55);
        M.esfera([Math.cos(a) * d, cy * (0.4 + rnd() * 1.0), Math.sin(a) * d],
                 R * 0.09, R * 0.09, R * 0.09, ID.aceso, 8, 5);
      }
    }
    if (o.cristais) {
      simetrico(M, function () {
        for (var k = 0; k < 3; k++) {
          var f = k / 2;
          A3.cristaisEm(M, ID,
            [-R * 0.20 + f * R * 0.5, cy * (1.02 + f * 0.16), R * (0.30 + f * 0.24)],
            [-0.2 + f * 0.4, 1, 0.4], R * (1.0 - f * 0.25), R * 0.14, rnd);
        }
      });
    }
    if (o.gotejo) {
      for (var g = 0; g < 4; g++) {
        var ga = (g / 4) * Math.PI * 2 + 0.4;
        M.loft({
          pontos: [[Math.cos(ga) * R * 0.82, alt * 0.14, Math.sin(ga) * R * 0.82],
                   [Math.cos(ga) * R * 0.90, alt * 0.05, Math.sin(ga) * R * 0.90],
                   [Math.cos(ga) * R * 0.92, -alt * 0.005, Math.sin(ga) * R * 0.92]],
          n: 8, lados: 7,
          raio: chaves([[0, R * 0.10], [0.7, R * 0.07], [1, R * 0.11]]),
          mat: ID.gel, tampaA: true, tampaB: true
        });
      }
    }

    /* pés, quando a espécie anda em vez de escorrer */
    if (o.patas === 2) {
      simetrico(M, function () {
        A3.perna(ctx, {
          origem: [R * 0.05, alt * 0.20, R * 0.46], comp: alt * 0.20,
          esp: R * 0.20, traseira: true, dedos: 3, esporao: false
        });
      });
    }

    /* a cabeça é o próprio topo do corpo: o crânio fica embutido nele */
    var H = A3.cranio(ctx, c.cabecaTam);
    decorarCabeca(H, ctx, c.cabecaTam);
    var mat = [1, 0, 0, R * 0.30, 0, 1, 0, cy * 1.06, 0, 0, 1, 0, 0, 0, 0, 1];
    if (c.semCranio) {
      /* espécies sem cara definida (Chorumel, Gelim) ficam só com os olhos */
      /* Sem crânio: o rosto é só o par de olhos, e ele precisa estar NA
         superfície da geleia. Afundado, o corpo translúcido o engolia. */
      var H2 = M3.malha();
      A3.simetrico(H2, function () {
        var cxo = R * 0.56, cyo = cy * 1.06, czo = R * 0.64;
        H2.esfera([cxo, cyo, czo], R * 0.23, R * 0.23, R * 0.23, ID.esclera, 14, 9);
        H2.esfera([cxo + R * 0.10, cyo, czo + R * 0.11],
                  R * 0.15, R * 0.15, R * 0.15, ID.iris, 12, 8);
        H2.esfera([cxo + R * 0.16, cyo, czo + R * 0.17],
                  R * 0.075, R * 0.075, R * 0.075, ID.pupila, 10, 7);
      });
      M.juntar(H2);
      var Hc = M3.malha();
      decorarCabeca(Hc, ctx, c.cabecaTam);
      M.juntar(Hc, [1, 0, 0, 0, 0, 1, 0, cy * 0.86, 0, 0, 1, 0, 0, 0, 0, 1]);
      ctx.ancoras.crista = [0, cy * 0.86 + c.cabecaTam, 0];
    } else {
      M.juntar(H, mat);
      ctx.ancoras.crista = [R * 0.30, cy * 1.06 + c.cabecaTam, 0];
    }
    ctx.ancoras.cabeca = [R * 0.3, cy * 1.06, 0];
    ctx.ancoras.corpo = [0, cy, 0];
    void p;
  };

  /* ------------------------------ golem ------------------------------- */
  /* Não tem coluna nem pele: é mineral empilhado que aprendeu a se sustentar.
     Cada bloco é faceta viva — normal por face, sem suavização. */
  CORPO.golem = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, rnd = ctx.rnd;
    var R = c.raioTorso, alt = c.altura;
    var cy = alt * 0.52;
    var matRocha = c.metalico ? ID.metal : ID.rocha;
    var matSec = c.metalico ? ID.metal : ID.rochaEsc;

    M.pedra([0, cy, 0], R * 1.15, matRocha, rnd,
            { esc: [0.95, 1.0, 0.92], segs: 10, aneis: 7, rugosidade: 0.26 });

    if (o.blocos) {
      M.pedra([-R * 0.30, cy + R * 0.98, R * 0.18], R * 0.52, matSec, rnd,
              { esc: [1.1, 0.8, 1], segs: 8, aneis: 5, rugosidade: 0.4 });
      M.pedra([R * 0.44, cy + R * 0.86, -R * 0.26], R * 0.44, matSec, rnd,
              { esc: [1, 0.9, 1.1], segs: 8, aneis: 5, rugosidade: 0.4 });
      M.pedra([R * 0.10, cy - R * 0.92, R * 0.20], R * 0.60, matSec, rnd,
              { esc: [1.2, 0.7, 1], segs: 8, aneis: 5, rugosidade: 0.35 });
    }
    if (o.bracos) {
      simetrico(M, function () {
        M.pedra([R * 0.10, cy + R * 0.14, R * 1.24], R * 0.46, matSec, rnd,
                { esc: [0.9, 1.5, 0.9], segs: 8, aneis: 6, rugosidade: 0.3 });
        M.pedra([R * 0.14, cy - R * 0.78, R * 1.30], R * 0.36, matRocha, rnd,
                { esc: [1, 1.1, 1], segs: 7, aneis: 5, rugosidade: 0.42 });
      });
    }
    if (o.cristais) {
      simetrico(M, function () {
        for (var k = 0; k < 3; k++) {
          var f = k / 2;
          A3.cristaisEm(M, ID,
            [-R * 0.34 + f * R * 0.7, cy + R * (0.72 + f * 0.2), R * (0.36 + f * 0.3)],
            [-0.25 + f * 0.4, 1, 0.45], R * (1.15 - f * 0.3), R * 0.16, rnd);
        }
      });
      A3.cristaisEm(M, ID, [R * 0.30, cy + R * 0.30, R * 0.95], [0.5, 0.4, 1],
                    R * 0.85, R * 0.14, rnd);
    }

    /* olhos: fendas acesas no bloco central — o golem não tem cara, tem luz */
    simetrico(M, function () {
      M.esfera([R * 0.72, cy + R * 0.30, R * 0.42], R * 0.20, R * 0.16, R * 0.20,
               ID.pupila, 10, 7);
      M.esfera([R * 0.80, cy + R * 0.30, R * 0.46], R * 0.13, R * 0.10, R * 0.13,
               ID.aceso, 10, 7);
    });

    /* pernas curtas e grossas */
    simetrico(M, function () {
      A3.perna(ctx, {
        origem: [0, cy - R * 0.86, R * 0.56], comp: cy - R * 0.86,
        esp: R * 0.34, traseira: true, dedos: 3, esporao: false
      });
    });

    var Hc = M3.malha();
    decorarCabeca(Hc, ctx, R * 0.62);
    M.juntar(Hc, [1, 0, 0, 0, 0, 1, 0, cy + R * 0.60, 0, 0, 1, 0, 0, 0, 0, 1]);
    ctx.ancoras.crista = [0, cy + R * 1.5, 0];
    ctx.ancoras.cabeca = [R * 0.5, cy + R * 0.5, 0];
    ctx.ancoras.corpo = [0, cy, 0];
  };

  /* ------------------------------ inseto ------------------------------ */
  CORPO.inseto = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, p = ctx.pose;
    var R = c.raioTorso, alt = c.altura;
    var cy = alt * 0.58;
    var comp = c.comp;

    /* abdômen, tórax e cabeça, três peças com a cintura marcada entre elas */
    M.loft({
      pontos: [[-comp * 1.0, cy * 0.92, 0], [-comp * 0.62, cy * 1.02, 0],
               [-comp * 0.24, cy, 0], [comp * 0.10, cy, 0], [comp * 0.42, cy * 0.98, 0]],
      n: 30, lados: 16,
      raio: chaves([[0, R * 0.16], [0.14, R * 0.72], [0.30, R * 0.92],
                    [0.48, R * 0.44], [0.62, R * 0.86], [0.86, R * 0.70], [1, R * 0.34]]),
      achatar: chaves([[0, 0.86], [1, 0.92]]),
      secao: function () { return { ventre: 0.86, quadrado: 0.30 }; },
      mat: function (t, a) { return (a > 0.66 && a < 0.86) ? ID.ventre : ID.quitina; },
      tampaA: true, tampaB: true
    });

    /* seis pernas articuladas, em três pares defasados */
    /* Seis pernas em três pares, com o joelho ACIMA do dorso e a tíbia
       descendo para fora: é o desenho que faz um artrópode parecer capaz de
       se apoiar. Penduradas em linha reta viravam uma cortina de fios. */
    simetrico(M, function () {
      var n = 3;
      for (var i = 0; i < n; i++) {
        var f = i / (n - 1);
        var base = [comp * (0.26 - f * 0.58), cy - R * 0.34, R * 0.60];
        var joelho = [base[0] + comp * (0.16 - f * 0.30),
                      cy + R * (0.42 - f * 0.08), base[2] + R * 0.82];
        var pe = [base[0] + comp * (0.44 - f * 0.86), 0.01 * alt, base[2] + R * 1.16];
        M.loft({
          pontos: [base, joelho,
                   [(joelho[0] + pe[0]) / 2, (joelho[1] + pe[1]) / 2 + R * 0.10,
                    (joelho[2] + pe[2]) / 2 + R * 0.14],
                   pe],
          n: 16, lados: 7,
          raio: chaves([[0, R * 0.22], [0.30, R * 0.15], [0.72, R * 0.10], [1, R * 0.05]]),
          mat: ID.membro, tampaA: true, tampaB: true
        });
      }
    });

    if (o.placas) {
      for (var k = 0; k < 3; k++) {
        (function (f) {
          simetrico(M, function () {
            M.retalho(function (a, b) {
              var w = R * 0.70 * Math.sin(b * Math.PI);
              return [-comp * (0.10 + f * 0.26) + (b - 0.5) * R * 0.7,
                      cy + R * (0.86 - a * 0.16),
                      a * w * 0.9 + R * 0.1];
            }, 3, 5, ID.secund, { dupla: false });
          });
        })(k / 2);
      }
    }

    decorarCauda(ctx, { quadros: [{ c: [-comp * 1.02, cy * 0.92, 0], t: [-1, 0, 0], up: [0, 1, 0], lado: [0, 0, 1] }], raios: [R * 0.2] });

    if ((o.asas || 'nenhuma') !== 'nenhuma') {
      montarAsas(ctx, [-comp * 0.05, cy + R * 0.78, R * 0.18], comp * 1.5);
    }

    var H = A3.cranio(ctx, c.cabecaTam);
    decorarCabeca(H, ctx, c.cabecaTam);
    M.juntar(H, [1, 0, 0, comp * 0.44, 0, 1, 0, cy * 1.0, 0, 0, 1, 0, 0, 0, 0, 1]);
    ctx.ancoras.cabeca = [comp * 0.6, cy, 0];
    ctx.ancoras.crista = [comp * 0.42, cy + c.cabecaTam * 1.2, 0];
    ctx.ancoras.corpo = [0, cy, 0];
    if (o.raios) ctx.vfx.push({ tipo: 'raio', anc: 'corpo', r: 1.1 });
    void p;
  };

  /* ----------------------------- espectro ----------------------------- */
  /* Não tem pé nem pele. O corpo é uma coluna de densidade que some antes de
     chegar ao chão — a base é o lugar onde a névoa deixa de ser bicho. */
  CORPO.espectro = function (ctx) {
    var c = ctx.cfg, o = ctx.o, ID = ctx.ID, M = ctx.M, p = ctx.pose;
    var R = c.raioTorso, alt = c.altura;

    var pts = [
      [-R * 0.10 + p.caudaBal * R * 0.5, alt * 0.02, p.caudaBal * R * 0.7],
      [R * 0.04, alt * 0.20, p.caudaBal * R * 0.3],
      [0, alt * 0.42, 0],
      [0, alt * 0.62, 0],
      [R * 0.06, alt * 0.80, 0]
    ];
    M.loft({
      pontos: pts, n: 28, lados: 18,
      raio: chaves([[0, R * 0.12], [0.18, R * 0.42], [0.44, R * 0.86],
                    [0.72, R * 0.96], [1, R * 0.62]]),
      achatar: chaves([[0, 1], [1, 1]]),
      mat: ID.espectro, tampaA: true, tampaB: true
    });

    /* fiapos de névoa subindo por dentro e escapando do corpo */
    for (var w = 0; w < 5; w++) {
      (function (f) {
        var a0 = (f / 5) * Math.PI * 2 + 0.6;
        M.retalho(function (a, b) {
          var l = R * 0.28 * Math.sin(b * Math.PI);
          var d = (a - 0.5) * 2;
          var rr = R * (0.5 + b * 0.55);
          return [Math.cos(a0 + b * 1.2) * rr + d * l * 0.5,
                  alt * (0.10 + b * 0.66),
                  Math.sin(a0 + b * 1.2) * rr + d * l];
        }, 2, 8, ID.veu, {});
      })(w);
    }

    if (o.gotejo) {
      for (var g = 0; g < 4; g++) {
        var ga = (g / 4) * Math.PI * 2 + 0.9;
        M.esfera([Math.cos(ga) * R * 0.7, alt * (0.16 + (g % 2) * 0.08), Math.sin(ga) * R * 0.7],
                 R * 0.14, R * 0.18, R * 0.14, ID.secund, 10, 7);
      }
    }
    if (o.aneis) {
      for (var k = 0; k < 3; k++) {
        toro(M, [0, alt * (0.34 + k * 0.14), 0], R * (1.02 - k * 0.12), R * 0.026,
             ID.etereo, 26, 6, 0.5);
      }
    }
    if (o.capa) capaAtras(M, ID.veu, [-R * 0.30, alt * 0.76, 0], R * 0.80, alt * 0.46, 0.85);
    if ((o.asas || 'nenhuma') !== 'nenhuma') {
      montarAsas(ctx, [-R * 0.18, alt * 0.72, R * 0.34], alt * 0.62);
    }

    var H = A3.cranio(ctx, c.cabecaTam);
    decorarCabeca(H, ctx, c.cabecaTam);
    var yC = alt * 0.86;
    M.juntar(H, A3.matrizCabeca(
      { quadros: [{ c: [R * 0.10, yC, 0], t: [1, 0, 0], up: [0, 1, 0], lado: [0, 0, 1] }] },
      p, { avanco: c.cabecaTam * 0.10 }));
    ctx.ancoras.cabeca = [R * 0.10, yC, 0];
    ctx.ancoras.crista = [R * 0.10, yC + c.cabecaTam * 1.1, 0];
    ctx.ancoras.corpo = [0, alt * 0.55, 0];
    ctx.ancoras.cauda = [0, alt * 0.1, 0];
    if ((o.cauda || '') === 'nevoa') ctx.vfx.push({ tipo: 'nevoa', anc: 'cauda', r: 1.2 });
  };

  /* ======================== peças compartilhadas ====================== */

  function decoraDorso(ctx, col) {
    var o = ctx.o, c = ctx.cfg, ID = ctx.ID;
    if (c.vela) {
      A3.velaDorsal(ctx, col, { t0: 0.30, t1: 0.74, alt: c.raioTorso * 1.5, mat: ID.barbatana });
    } else if (c.espinhosDorso !== false) {
      A3.cristaDorsal(ctx, col, {
        t0: c.dorsoT0 === undefined ? 0.16 : c.dorsoT0,
        t1: c.dorsoT1 === undefined ? 0.80 : c.dorsoT1,
        n: c.dorsoN || 10,
        alt: c.raioTorso * (c.dorsoAlt || 0.50),
        mat: c.dorsoMat === undefined ? ID.realce : ctx.ID[c.dorsoMat],
        grossura: 0.44, inclina: 0.34
      });
    }
    if (o.placas) A3.placas(ctx, col, { t0: 0.34, t1: 0.70, n: 5 });
    if (o.dorso === 'arvore') {
      /* Silvárion carrega um bosque no lombo: tronco curto e copa em folhas */
      var e = quadroEm(col, 0.50);
      var base = M3.som(e.q.c, M3.mul(e.q.up, e.r * 0.92));
      ctx.M.loft({
        pontos: [base, [base[0] - c.comp * 0.04, base[1] + c.altura * 0.16, base[2]],
                 [base[0] - c.comp * 0.10, base[1] + c.altura * 0.28, base[2] + c.raioTorso * 0.1]],
        n: 10, lados: 8,
        raio: chaves([[0, c.raioTorso * 0.36], [1, c.raioTorso * 0.18]]),
        mat: ID.casca, tampaA: false, tampaB: true
      });
      A3.folhas(ctx.M, ID, {
        base: [base[0] - c.comp * 0.10, base[1] + c.altura * 0.28, base[2]],
        n: 7, ang0: 2.7, ang1: 0.5, giro0: -1.3, giro1: 1.3,
        comp: c.altura * 0.34, larg: c.altura * 0.10
      });
    }
  }

  /* Manto: arco por trás dos ombros, caindo e alargando. Fechado na frente
     virava saia cônica — foi o que aconteceu antes de o arco ser limitado à
     metade de trás. */
  function capaAtras(M, mat, topo, raio, queda, abertura) {
    M.retalho(function (a, b) {
      var ang = -abertura + a * abertura * 2;
      var rr = raio * (0.88 + b * 0.42);
      return [topo[0] - Math.cos(ang) * rr * 0.82,
              topo[1] - b * queda - b * b * queda * 0.06,
              topo[2] + Math.sin(ang) * rr];
    }, 12, 7, mat, { dupla: true });
  }

  function capa(ctx, col, eOmb, rO) {
    var M = ctx.M, ID = ctx.ID, c = ctx.cfg;
    var topo = M3.som(eOmb.q.c, M3.mul(eOmb.q.up, rO * 0.80));
    capaAtras(M, ID.veu, [topo[0] - c.comp * 0.04, topo[1], 0], rO * 1.15,
              c.alturaOmbro * 0.88, 1.0);
    void col;
  }

  function plantarCabeca(ctx, col) {
    var c = ctx.cfg, M = ctx.M, p = ctx.pose;
    var H = A3.cranio(ctx, c.cabecaTam);
    decorarCabeca(H, ctx, c.cabecaTam);
    var m = A3.matrizCabeca(col, p, { avanco: c.cabecaTam * (c.avancoCabeca || 0.26) });
    M.juntar(H, m);
    ctx.ancoras.cabeca = A3.noMundo(m, [0, 0, 0]);
    ctx.ancoras.crista = A3.noMundo(m, [-c.cabecaTam * 0.10, c.cabecaTam * 1.25, 0]);
    ctx.ancoras.focinho = A3.noMundo(m, [c.cabecaTam * (0.8 + 0.7 * c.focinho), 0, 0]);
    ctx.ancoras.corpo = quadroEm(col, 0.52).q.c;
  }

  function extrasCorpo(ctx, col) {
    var o = ctx.o, c = ctx.cfg, ID = ctx.ID, M = ctx.M, rnd = ctx.rnd;
    if (o.cristais && !c.jaCristais) {
      simetrico(M, function () {
        for (var k = 0; k < 3; k++) {
          var e = quadroEm(col, 0.42 + k * 0.10);
          var base = M3.som(e.q.c, M3.mul(M3.nrm(M3.som(e.q.up, M3.mul(e.q.lado, 0.7))), e.r * 0.9));
          A3.cristaisEm(M, ID, base, M3.som(e.q.up, M3.mul(e.q.lado, 0.8)),
                        e.r * (1.1 - k * 0.2), e.r * 0.16, rnd);
        }
      });
    }
    if (o.raios) ctx.vfx.push({ tipo: 'raio', anc: 'corpo', r: 1.0 });
    if (o.bolhas) ctx.vfx.push({ tipo: 'bolha', anc: 'corpo', r: 1.0 });
    if (c.fendasQuentes) {
      /* fendas por onde o calor escapa: Brasavo e Ignareth respiram por elas */
      simetrico(M, function () {
        for (var k = 0; k < 3; k++) {
          var e = quadroEm(col, 0.54 + k * 0.055);
          var dirF = M3.nrm(M3.som(e.q.lado, M3.mul(e.q.up, -0.25)));
          var base = M3.som(e.q.c, M3.mul(dirF, e.r * 0.90));
          M.retalho(function (a, b) {
            var w = e.r * 0.44 * Math.sin(b * Math.PI);
            return [base[0] + e.q.t[0] * (b - 0.5) * e.r * 0.9 + e.q.up[0] * (a - 0.5) * w,
                    base[1] + e.q.t[1] * (b - 0.5) * e.r * 0.9 + e.q.up[1] * (a - 0.5) * w,
                    base[2] + e.q.t[2] * (b - 0.5) * e.r * 0.9 + e.q.up[2] * (a - 0.5) * w];
          }, 2, 5, ID.brasa, { dupla: false });
        }
      });
      ctx.vfx.push({ tipo: 'faisca', anc: 'corpo', r: 1.0 });
    }
    if (o.gotejo && !c.gotejoFeito) ctx.vfx.push({ tipo: 'gota', anc: 'corpo', r: 1.0 });
  }

  /* ============================== perfis ============================== */

  /* Ajustes que só existem em três dimensões. Tudo o que já estava na ficha
     da espécie (paleta, crista, cauda, asas, porte) continua vindo de lá. */
  var PERFIL = {
    /* ---- Verdejo: casca por fora, folha por dentro ---- */
    verdil:    { altura: 0.82, pele: 'escama', escalaPele: 0.026, peito: 0.10,
                 focinho: 0.42, cabecaMult: 1.32, pescocoMult: 0.72, papo: true,
                 dorsoAlt: 0.42, chanceBoca: 0.5 },
    frondor:   { altura: 1.02, focinho: 0.62, cabecaMult: 1.08, pescocoMult: 1.0,
                 dorsoAlt: 0.55 },
    silvarion: { altura: 1.42, focinho: 0.70, cabecaMult: 1.0, pescocoMult: 1.24,
                 achatarTorso: 1.20, peito: 0.16, arcoDorso: 0.04, pernaEspMult: 1.30,
                 chifreComp: 1.5, chifreRaio: 0.16, chifrePar2: true, dorsoAlt: 0.5 },

    /* ---- Brasa: a fenda quente entre as escamas ---- */
    fagulho:   { altura: 0.84, focinho: 0.72, cabecaMult: 1.22, pescocoMult: 0.80,
                 escalaPele: 0.024, chanceBoca: 0.55, forcaAceso: 1.25 },
    brasavo:   { altura: 1.10, focinho: 0.86, pescocoMult: 1.0, fendasQuentes: true,
                 bracoComp: 0.30, forcaAceso: 1.3 },
    ignareth:  { altura: 1.30, focinho: 0.96, pescocoMult: 1.16, fendasQuentes: true,
                 bracoComp: 0.34, escleraEscura: true, olhoAceso: 0.75,
                 chifreComp: 1.35, forcaAceso: 1.45, dorsoAlt: 0.78 },

    /* ---- Torrente: pele lisa e barbatana translúcida ---- */
    gotil:     { altura: 0.80, alfaGel: 0.66, semCranio: true, escalaPele: 0.05 },
    marulo:    { altura: 1.02, focinho: 0.90, pescocoMult: 0.92, escalaPele: 0.026,
                 specPele: 0.42, rugPele: 0.28, vela: false, dorsoAlt: 0.40 },
    abyssaro:  { altura: 1.46, focinho: 1.18, pescocoMult: 1.34, achatarTorso: 1.06,
                 escalaPele: 0.030, olhoAceso: 1.1, dorsoAlt: 0.85, dorsoN: 18,
                 escleraEscura: true },

    /* ---- Terra e Ferro: mineral ---- */
    terrino:   { altura: 0.86, pele: 'rocha', escalaPele: 0.05 },
    geodante:  { altura: 1.34, pele: 'rocha', escalaPele: 0.055, jaCristais: true },
    ferrusco:  { altura: 0.84, pele: 'quitina', escalaPele: 0.026, specPele: 0.7,
                 rugPele: 0.18, focinho: 0.5, cabecaMult: 1.1 },
    aciarno:   { altura: 1.48, pele: 'metal', escalaPele: 0.05, specPele: 0.8,
                 rugPele: 0.16, focinho: 0.78, achatarTorso: 1.22, peito: 0.20,
                 pernaEspMult: 1.42, arcoDorso: -0.02, chifreComp: 1.4,
                 chifrePar2: true, dorsoAlt: 0.46, texRealce: 'metal' },

    /* ---- Zéfiro: pena de verdade ---- */
    pardalume: { altura: 0.74, pele: 'pena', escalaPele: 0.016, focinho: 1.05,
                 cabecaMult: 1.25, pescocoMult: 0.66, nPenas: 9,
                 espinhosDorso: false, dentes: false },
    falceu:    { altura: 1.24, pele: 'pena', escalaPele: 0.018, focinho: 1.20,
                 pescocoMult: 1.0, nPenas: 13, olhoAceso: 0.5,
                 espinhosDorso: false, dentes: false },

    /* ---- Umbra: densidade, não pele ---- */
    noctun:    { altura: 0.86, pele: 'nevoa', alfaEspectro: 0.72, alfaCorpo: 0.78,
                 focinho: 0.46, cabecaMult: 1.20, olhoAceso: 1.2, escleraEscura: true },
    umbrafex:  { altura: 1.26, pele: 'nevoa', alfaEspectro: 0.78, alfaCorpo: 0.82,
                 focinho: 0.72, olhoAceso: 1.0, escleraEscura: true, chifreComp: 1.3 },

    /* ---- Fulgor ---- */
    faisco:    { altura: 0.76, pele: 'quitina', escalaPele: 0.022, specPele: 0.8,
                 rugPele: 0.14, focinho: 0.30, cabecaMult: 1.30, forcaAceso: 1.4 },
    trovanel:  { altura: 1.10, escalaPele: 0.024, focinho: 0.80, pescocoMult: 0.92,
                 pernaEspMult: 0.86, dorsoAlt: 0.80, forcaAceso: 1.35 },

    /* ---- Gélido ---- */
    gelim:     { altura: 0.82, alfaGel: 0.72, semCranio: true, escalaPele: 0.05 },
    nevarco:   { altura: 1.42, pele: 'cristal', escalaPele: 0.035, specPele: 0.7,
                 rugPele: 0.14, metalico: false },
    escamiro:  { altura: 1.06, focinho: 1.30, pescocoMult: 0.86, escalaPele: 0.022,
                 specPele: 0.5, rugPele: 0.26, dorsoAlt: 0.70 },

    /* ---- Toxina ---- */
    chorumel:  { altura: 0.92, alfaGel: 0.80, semCranio: true, escalaPele: 0.055 },
    miasmor:   { altura: 1.30, pele: 'nevoa', alfaEspectro: 0.84, alfaCorpo: 0.86,
                 focinho: 0.62, olhoAceso: 0.9, escleraEscura: true },

    /* ---- Aurora ---- */
    luminel:   { altura: 0.84, pele: 'nevoa', alfaEspectro: 0.76, alfaCorpo: 0.80,
                 focinho: 0.36, cabecaMult: 1.28, olhoAceso: 0.35, forcaAceso: 1.5 },
    auroreth:  { altura: 1.30, focinho: 0.60, pescocoMult: 1.10, escalaPele: 0.024,
                 specPele: 0.42, olhoAceso: 0.9, forcaAceso: 1.45, bracoComp: 0.30 },

    /* ---- solitárias ---- */
    fungor:    { altura: 1.04, alfaGel: 0.92, semCranio: true, pele: 'gel',
                 escalaPele: 0.05 },
    vharuneth: { altura: 1.72, pele: 'nevoa', alfaEspectro: 0.74, alfaCorpo: 0.78,
                 focinho: 0.55, olhoAceso: 1.3, forcaAceso: 1.6, escleraEscura: true }
  };
  E3.PERFIL = PERFIL;

  /* Proporções padrão por arquétipo, derivadas da ficha 2D que já existia:
     corpoRX vira comprimento, corpoRY vira circunferência, cabecaR vira
     tamanho do crânio. Nada foi recadastrado. */
  var BASE = {
    quadrupede: { altura: 1.05, comp: 0.62, ombro: 0.50, quadril: 0.475, torso: 0.175,
                  achatar: 1.14, pescoco: [0.36, 0.22, 0.52], cabeca: 0.30,
                  perna: 0.36, focinho: 1.0, refRX: 28, refRY: 20, refCab: 17 },
    bipede:     { altura: 1.14, comp: 0.52, ombro: 0.74, quadril: 0.50, torso: 0.185,
                  achatar: 1.20, pescoco: [0.30, 0.24, 0.50], cabeca: 0.30,
                  perna: 0.40, focinho: 0.80, refRX: 22, refRY: 26, refCab: 16 },
    ave:        { altura: 0.98, comp: 0.44, ombro: 0.60, quadril: 0.56, torso: 0.185,
                  achatar: 1.10, pescoco: [0.24, 0.16, 0.52], cabeca: 0.26,
                  perna: 0.30, focinho: 1.15, refRX: 20, refRY: 17, refCab: 13 },
    aquatico:   { altura: 1.10, comp: 0.72, ombro: 0.52, quadril: 0.44, torso: 0.155,
                  achatar: 1.16, pescoco: [0.34, 0.10, 0.62], cabeca: 0.28,
                  perna: 0.30, focinho: 1.30, refRX: 31, refRY: 20, refCab: 17 },
    ameba:      { altura: 0.92, comp: 0.30, ombro: 0.50, quadril: 0.40, torso: 0.36,
                  achatar: 1.0, pescoco: [0.10, 0.05, 1.0], cabeca: 0.22,
                  perna: 0.24, focinho: 0.50, refRX: 25, refRY: 22, refCab: 16 },
    golem:      { altura: 1.10, comp: 0.34, ombro: 0.52, quadril: 0.42, torso: 0.34,
                  achatar: 1.0, pescoco: [0.10, 0.05, 1.0], cabeca: 0.22,
                  perna: 0.30, focinho: 0.40, refRX: 28, refRY: 25, refCab: 16 },
    inseto:     { altura: 0.90, comp: 0.42, ombro: 0.55, quadril: 0.45, torso: 0.20,
                  achatar: 0.92, pescoco: [0.12, 0.04, 0.7], cabeca: 0.22,
                  perna: 0.22, focinho: 0.35, refRX: 20, refRY: 17, refCab: 13 },
    espectro:   { altura: 1.05, comp: 0.34, ombro: 0.62, quadril: 0.42, torso: 0.205,
                  achatar: 1.0, pescoco: [0.14, 0.10, 0.8], cabeca: 0.26,
                  perna: 0.26, focinho: 0.55, refRX: 22, refRY: 24, refCab: 16 }
  };

  function montarCfg(esp, v) {
    var art = esp.art, o = art.o;
    var b = BASE[art.arch] || BASE.quadrupede;
    var pf = PERFIL[esp.id] || {};
    var esc = (o.escala || 1) * (v.porte || 1);
    var alturaBase = (pf.altura === undefined ? b.altura : pf.altura);
    var alt = alturaBase * (esc / (o.escala || 1)) * (o.escala || 1);
    /* o porte individual entra na altura, e é por isso que um indivíduo
       grande também parece grande ao lado de outro da mesma espécie */
    alt = alturaBase * (v.porte || 1);

    var kRX = (o.corpoRX || b.refRX) / b.refRX;
    var kRY = (o.corpoRY || b.refRY) / b.refRY;
    var kCab = (o.cabecaR || b.refCab) / b.refCab;

    var cfg = {
      altura: alt,
      comp: alt * b.comp * kRX,
      alturaOmbro: alt * b.ombro,
      alturaQuadril: alt * b.quadril,
      raioTorso: alt * b.torso * kRY,
      achatarTorso: pf.achatarTorso === undefined ? b.achatar : pf.achatarTorso,
      peito: pf.peito === undefined ? 0.08 : pf.peito,
      arcoDorso: (pf.arcoDorso || 0) * alt,
      pescoco: {
        comp: alt * b.pescoco[0] * (pf.pescocoMult || 1),
        subida: alt * b.pescoco[1] * (pf.pescocoMult || 1),
        raio: b.pescoco[2]
      },
      cabecaTam: alt * b.cabeca * kCab * (pf.cabecaMult || 1),
      pernaEsp: alt * 0.05 * (pf.pernaEspMult || 1) * kRY,
      bracoComp: alt * (pf.bracoComp || 0.28),
      focinho: pf.focinho === undefined ? (o.focinho === undefined ? b.focinho : o.focinho) : pf.focinho,
      pele: pf.pele || 'escama',
      escalaPele: pf.escalaPele || 0.028,
      olhoR: pf.olhoR || 0.135,
      chanceBoca: pf.chanceBoca,
      papo: pf.papo,
      nDentes: pf.nDentes,
      dentes: pf.dentes,
      semCranio: pf.semCranio,
      metalico: pf.metalico
    };
    /* repassa o restante do perfil sem sobrescrever o que já foi derivado */
    ['alfaGel', 'alfaAsa', 'alfaEspectro', 'alfaCorpo', 'olhoAceso', 'forcaAceso',
     'escleraEscura', 'specPele', 'rugPele', 'relevo', 'texRealce', 'peleSec',
     'fendasQuentes', 'vela', 'dorsoAlt', 'dorsoN', 'dorsoT0', 'dorsoT1', 'dorsoMat',
     'espinhosDorso', 'chifreComp', 'chifreRaio', 'chifrePar2', 'jaCristais',
     'nPenas', 'avancoCabeca', 'bocaMax', 'faixaVentre', 'segColuna', 'ladosColuna'
    ].forEach(function (k) { if (pf[k] !== undefined) cfg[k] = pf[k]; });

    return cfg;
  }

  /* ============================== câmera ============================== */

  var CAMERA = {
    quadrupede: { giro: 1.16, inclina: 0.20 },
    bipede: { giro: 1.10, inclina: 0.18 },
    ave: { giro: 1.14, inclina: 0.16 },
    aquatico: { giro: 1.22, inclina: 0.20 },
    ameba: { giro: 1.05, inclina: 0.16 },
    golem: { giro: 1.05, inclina: 0.18 },
    inseto: { giro: 1.20, inclina: 0.26 },
    espectro: { giro: 1.02, inclina: 0.14 }
  };

  /* ============================== API ================================= */

  E3.construir = function (esp, v) {
    v = v || {};
    var art = esp.art, o = art.o;
    var cfg = montarCfg(esp, v);
    var mats = G.Anatomia3D.materiais(art, v, cfg);

    /* corpos translúcidos: névoa e geleia contaminam pele, dorso e ventre */
    if (cfg.alfaCorpo) {
      ['pele', 'dorso', 'ventre', 'membro'].forEach(function (k) {
        var m = mats.lista[mats.id[k]];
        m.alfa = cfg.alfaCorpo;
        m.subsup = 1.0;
        m.emis = 0.12;
        m.corEmis = mats.lista[mats.id.aceso].corEmis;
      });
    }

    var rnd = G.mulberry32((v.seed | 0) + G.hash32(esp.id) + 17);
    var M = M3.malha();
    var ctx = {
      M: M, ID: mats.id, mats: mats, cfg: cfg, o: o, esp: esp, rnd: rnd,
      pose: A3.pose(rnd, cfg), ancoras: {}, vfx: []
    };

    (CORPO[art.arch] || CORPO.quadrupede)(ctx);

    var cam = CAMERA[art.arch] || CAMERA.quadrupede;
    return {
      malha: M.finalizar(),
      materiais: mats.lista,
      ancoras: ctx.ancoras,
      vfx: ctx.vfx,
      paleta: mats,
      camera: {
        giro: cam.giro, inclina: cam.inclina, fov: 0.52,
        alturaRef: 1.45, margem: 0.93, base: 0.955
      }
    };
  };

  E3.CORPO = CORPO;
  E3.BASE = BASE;
  void U;

})(window.ANIMOS);
