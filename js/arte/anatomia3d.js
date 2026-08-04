/* =========================================================================
   ÂNIMOS — Ecos de Vharune
   anatomia3d.js — os corpos das 28 espécies, construídos em malha

   Aqui mora o que o jogo tem de mais autoral: cada Ânimo já tinha um
   estereótipo — arquétipo, paleta, crista, cauda, olhos, porte — descrito em
   `data/especies.js`. Este módulo lê exatamente essa ficha e a transforma em
   um bicho tridimensional, sem inventar um segundo cadastro paralelo.

   A gramática é dracônica, como as referências: uma coluna contínua da ponta
   da cauda até a nuca, peito fundo, quadril mais estreito, pescoço em S,
   crânio com arcada e focinho, membro digitígrado com garra e — quando a
   espécie pede — asa de dedos e membrana. O que muda de espécie para espécie
   é como essa gramática é conjugada:

     Verdil   broto e casca vegetal, corpo curto de filhote
     Fagulho  fendas quentes entre as escamas, crista de chama
     Gotil    membrana translúcida com água etérea suspensa por dentro
     Terrino  não tem coluna: é cascalho empilhado que decidiu andar
     Noctun   não tem pele: densidade que some na borda
     Falcéu   pena de verdade, com raque e barbas
     Aciarno  chapa sobre chapa, e o peso disso na altura do dorso
     Vharuneth  a gramática inteira, mas feita de éter

   Convenção: o bicho olha para +X, +Y é cima, o plano sagital é Z = 0. Metade
   do corpo é construída e depois espelhada — a simetria sai exata e o custo
   de modelagem cai pela metade.
   ========================================================================= */
(function (G) {
  'use strict';

  var M3 = G.Malha3D;
  var A3 = G.Anatomia3D = {};
  var U = G.utils;

  /* ============================== cores ================================ */

  function h2c(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function rgb(cor) {
    var h = (((cor[0] % 360) + 360) % 360) / 360;
    var s = U.clamp(cor[1], 0, 100) / 100;
    var l = U.clamp(cor[2], 0, 100) / 100;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = h2c(p, q, h + 1 / 3); g = h2c(p, q, h); b = h2c(p, q, h - 1 / 3);
    }
    return [r * 255, g * 255, b * 255];
  }
  A3.rgb = rgb;

  /* Interpolação suave entre pontos-chave [t, valor]. Toda proporção que
     varia ao longo de uma peça (raio do tronco, achatamento do focinho)
     é descrita assim, em vez de fórmula fechada. */
  function chaves(ks) {
    return function (t) {
      if (t <= ks[0][0]) return ks[0][1];
      for (var i = 0; i < ks.length - 1; i++) {
        if (t <= ks[i + 1][0]) {
          var a = ks[i], b = ks[i + 1];
          var u = (t - a[0]) / ((b[0] - a[0]) || 1);
          u = u * u * (3 - 2 * u);
          return a[1] + (b[1] - a[1]) * u;
        }
      }
      return ks[ks.length - 1][1];
    };
  }

  function simetrico(M, fn) {
    var mk = M.marca();
    fn();
    M.espelharDesde(mk);
  }

  /* ============================= materiais ============================= */

  /* Constrói a lista de materiais de um indivíduo. A paleta continua sendo a
     da espécie; o que o indivíduo muda é matiz e, se for prismático, tudo. */
  function materiais(art, v, cfg) {
    var dh = v.matiz || 0, ds = 0, dl = 0;
    if (v.prismatico) { dh += 168; ds += 18; dl += 6; }
    function c(base, dL, dS) {
      return [base[0] + dh + 0, U.clamp(base[1] + ds + (dS || 0), 0, 100),
              U.clamp(base[2] + dl + (dL || 0), 0, 100)];
    }
    var c1 = c(art.c1), c2 = c(art.c2), c3 = c(art.c3);
    var olho = art.olho.slice();

    var lista = [];
    var id = {};
    function add(nome, def) { id[nome] = lista.length; lista.push(def); return id[nome]; }

    var pele = cfg.pele || 'escama';
    var escP = cfg.escalaPele || 0.030;

    add('pele', {
      cor: rgb(c1), cor2: rgb(U.tom(c1, -13, 4)),
      tex: pele, escala: escP, relevo: cfg.relevo === undefined ? 1.0 : cfg.relevo,
      rug: cfg.rugPele === undefined ? 0.45 : cfg.rugPele,
      spec: cfg.specPele === undefined ? 0.26 : cfg.specPele
    });
    add('dorso', {
      cor: rgb(U.tom(c1, -9, 6)), cor2: rgb(U.tom(c1, -20, 8)),
      tex: pele, escala: escP * 1.18, relevo: 1.05, rug: 0.42, spec: 0.26
    });
    add('ventre', {
      cor: rgb(U.tom(c1, 16, -14)), cor2: rgb(U.tom(c1, 6, -16)),
      tex: pele === 'escama' ? 'placa' : pele, escala: escP * 1.5,
      relevo: 0.85, rug: 0.6, spec: 0.16
    });
    add('membro', {
      cor: rgb(U.tom(c1, -7, 2)), cor2: rgb(U.tom(c1, -19, 5)),
      tex: pele, escala: escP * 0.82, relevo: 1.0, rug: 0.45, spec: 0.24
    });
    add('secund', {
      cor: rgb(c2), cor2: rgb(U.tom(c2, -12, 4)),
      tex: cfg.peleSec || pele, escala: escP * 1.1, relevo: 0.9, rug: 0.5, spec: 0.24
    });
    add('realce', {
      cor: rgb(c3), cor2: rgb(U.tom(c3, -14, 6)),
      tex: cfg.texRealce || 'liso', escala: escP, relevo: 0.7, rug: 0.3, spec: 0.42
    });
    add('chifre', {
      /* queratina: puxa a cor terciária para osso e guarda os anéis */
      cor: rgb(U.tom(c3, 8, -34)), cor2: rgb(U.tom(c3, -14, -30)),
      tex: 'chifre', escala: 0.030, relevo: 0.85, rug: 0.42, spec: 0.34
    });
    add('garra', {
      cor: rgb(U.tom(c3, -26, -18)), cor2: rgb(U.tom(c3, 22, -30)),
      tex: 'chifre', escala: 0.016, relevo: 0.5, rug: 0.22, spec: 0.6
    });
    add('dente', {
      cor: [244, 238, 224], cor2: [206, 198, 190],
      tex: 'liso', escala: 0.02, rug: 0.24, spec: 0.55
    });
    add('esclera', {
      cor: cfg.escleraEscura ? [46, 40, 58] : [238, 234, 244], cor2: [196, 190, 210],
      tex: 'liso', rug: 0.14, spec: 0.7
    });
    add('iris', {
      cor: rgb(olho), cor2: rgb(U.tom(olho, -24, 8)),
      tex: 'liso', rug: 0.10, spec: 0.85,
      /* Emissão é somada em cima do resultado já iluminado, então valor perto
         de 1 satura para branco e a cor do olho some. Todo emissivo aqui fica
         numa faixa baixa e deixa o florescer fazer a leitura de "aceso". */
      emis: 0.13 * (cfg.olhoAceso === undefined ? 1 : cfg.olhoAceso),
      corEmis: rgb(U.tom(olho, 12))
    });
    add('pupila', { cor: [14, 11, 22], cor2: [8, 6, 14], tex: 'liso', rug: 0.08, spec: 0.9 });
    add('membrana', {
      cor: rgb(U.tom(c2, 6, -6)), cor2: rgb(U.tom(c2, -14, 6)),
      tex: 'couro', escala: 0.036, relevo: 0.7,
      rug: 0.7, spec: 0.14, alfa: cfg.alfaAsa === undefined ? 0.90 : cfg.alfaAsa, subsup: 0.95
    });
    add('osso', {
      cor: rgb(U.tom(c1, -16, -8)), cor2: rgb(U.tom(c1, 4, -14)),
      tex: 'chifre', escala: 0.026, relevo: 0.6, rug: 0.4, spec: 0.3
    });
    add('pena', {
      cor: rgb(c2), cor2: rgb(U.tom(c2, -16, 4)),
      tex: 'pena', escala: 0.020, relevo: 1.0, rug: 0.62, spec: 0.18
    });
    add('penaCl', {
      cor: rgb(U.tom(c1, 12, -8)), cor2: rgb(U.tom(c1, -6, -4)),
      tex: 'pena', escala: 0.017, relevo: 1.0, rug: 0.62, spec: 0.18
    });
    var kAceso = cfg.forcaAceso === undefined ? 1 : cfg.forcaAceso;
    add('aceso', {
      cor: rgb(U.tom(c3, 8)), cor2: rgb(c3),
      tex: 'liso', rug: 0.12, spec: 0.5,
      emis: 0.34 * kAceso, corEmis: rgb(U.tom(c3, 10, 6))
    });
    add('chama', {
      /* lâmina de fogo: translúcida, quente no miolo, quase sumindo na ponta */
      cor: rgb(U.tom(c3, 12, 6)), cor2: rgb(U.tom(c1, 16, 10)),
      tex: 'nevoa', escala: 0.05, relevo: 0.4, rug: 0.4, spec: 0.1,
      alfa: 0.62, subsup: 1.0, emis: 0.52 * kAceso, corEmis: rgb(U.tom(c3, 16, 8))
    });
    add('etereo', {
      /* asa e véu de éter: forma sem matéria — quase toda translucidez */
      cor: rgb(U.tom(c3, 6)), cor2: rgb(U.tom(c3, -14, -8)),
      tex: 'nevoa', escala: 0.06, relevo: 0.3, rug: 0.5, spec: 0.12,
      alfa: 0.40, subsup: 1.0, emis: 0.26 * kAceso, corEmis: rgb(U.tom(c3, 12))
    });
    add('brasa', {
      /* fenda quente entre placas: não tem albedo que importe, é só emissão */
      cor: rgb(U.tom(c3, -10)), cor2: rgb(c1),
      tex: 'liso', rug: 0.3, spec: 0.2,
      emis: 0.62 * kAceso, corEmis: rgb(U.tom(c3, 18, 10))
    });
    add('cristal', {
      cor: rgb(U.tom(c3, 8, -6)), cor2: rgb(U.tom(c3, 26, -18)),
      tex: 'cristal', escala: 0.020, relevo: 0.9, rug: 0.06, spec: 0.95,
      alfa: 0.82, subsup: 1.0, emis: 0.13, corEmis: rgb(U.tom(c3, 16))
    });
    add('gelo', {
      cor: rgb(U.tom(c1, 18, -10)), cor2: rgb(U.tom(c1, 2, 8)),
      tex: 'cristal', escala: 0.028, relevo: 0.7, rug: 0.08, spec: 0.9,
      alfa: 0.88, subsup: 0.9
    });
    add('gel', {
      cor: rgb(U.tom(c1, 6, -4)), cor2: rgb(U.tom(c1, -10, 6)),
      tex: 'gel', escala: 0.05, relevo: 0.5, rug: 0.07, spec: 0.9,
      alfa: cfg.alfaGel === undefined ? 0.74 : cfg.alfaGel, subsup: 1.0
    });
    add('nucleo', {
      cor: rgb(U.tom(c2, -6, 8)), cor2: rgb(U.tom(c2, -16, 4)),
      tex: 'gel', escala: 0.04, relevo: 0.6, rug: 0.2, spec: 0.5,
      emis: 0.10, corEmis: rgb(U.tom(c3, 10))
    });
    add('espectro', {
      cor: rgb(U.tom(c1, 4, 2)), cor2: rgb(U.tom(c1, -22, -10)),
      tex: 'nevoa', escala: 0.05, relevo: 0.4, rug: 0.6, spec: 0.1,
      alfa: cfg.alfaEspectro === undefined ? 0.80 : cfg.alfaEspectro,
      subsup: 1.0, emis: 0.07, corEmis: rgb(U.tom(c3, 6))
    });
    add('veu', {
      /* Manto e véu: pano de éter. Alfa baixo e saturação puxada para baixo —
         opaco demais, o manto lia como cunha de papel colorido colada atrás. */
      cor: rgb(U.tom(c2, -2, -22)), cor2: rgb(U.tom(c2, -20, -26)),
      tex: 'nevoa', escala: 0.06, relevo: 0.3, rug: 0.7, spec: 0.08,
      alfa: 0.38, subsup: 1.0
    });
    add('rocha', {
      cor: rgb(c1), cor2: rgb(U.tom(c1, -22, 4)),
      tex: 'rocha', escala: 0.055, relevo: 1.5, rug: 0.85, spec: 0.10
    });
    add('rochaEsc', {
      cor: rgb(U.tom(c2, -6)), cor2: rgb(U.tom(c2, -24, 4)),
      tex: 'rocha', escala: 0.045, relevo: 1.5, rug: 0.85, spec: 0.10
    });
    add('metal', {
      cor: rgb(U.tom(c1, 4, -6)), cor2: rgb(U.tom(c1, -16, -10)),
      tex: 'metal', escala: 0.05, relevo: 0.5, rug: 0.14, spec: 0.85
    });
    add('quitina', {
      cor: rgb(c1), cor2: rgb(U.tom(c1, -18, 6)),
      tex: 'quitina', escala: 0.028, relevo: 1.0, rug: 0.16, spec: 0.75
    });
    add('folha', {
      cor: rgb(c3), cor2: rgb(U.tom(c3, -16, 10)),
      tex: 'folha', escala: 0.030, relevo: 1.1, rug: 0.62, spec: 0.2,
      alfa: 0.97, subsup: 0.75
    });
    add('casca', {
      cor: rgb(U.tom(c2, -6, -4)), cor2: rgb(U.tom(c2, -20, 2)),
      tex: 'rocha', escala: 0.020, relevo: 1.3, rug: 0.9, spec: 0.06
    });
    add('barbatana', {
      cor: rgb(U.tom(c3, 4, -4)), cor2: rgb(U.tom(c3, -16, 6)),
      tex: 'couro', escala: 0.026, relevo: 0.8, rug: 0.4, spec: 0.35,
      alfa: 0.88, subsup: 0.95
    });

    return { lista: lista, id: id, c1: c1, c2: c2, c3: c3, olho: olho };
  }

  /* ============================= a coluna ============================== */

  /* Uma única varredura da ponta da cauda até a nuca. É o que separa um
     dragão de um boneco montado: nenhuma emenda entre cauda, quadril, dorso e
     pescoço, e a linha do dorso lida de uma vez só. */
  function coluna(ctx) {
    var c = ctx.cfg, p = ctx.pose, ID = ctx.ID;
    var comp = c.comp, alt = c.alturaOmbro, altQ = c.alturaQuadril;
    var rT = c.raioTorso;

    /* ponta da cauda -> cauda -> quadril -> lombo -> peito -> pescoço -> nuca
       (9 pontos: cada marco anatômico cai num t previsível — quadril em
       0.375, peito em 0.625, nuca em 1.0. É por isso que perna, asa e crista
       sabem onde se plantar sem coordenada mágica.)
       Arquétipos com outra postura — bípede ereto, ave compacta, serpente
       marinha — trocam só a lista de pontos, e todo o resto continua valendo. */
    var balanco = p.caudaBal, ergue = p.caudaErgue;
    var pts = c.pontos ? c.pontos(c, p) : [
      [-comp * 1.00, altQ * (0.42 + ergue * 0.55), balanco * comp * 0.34],
      [-comp * 0.76, altQ * (0.62 + ergue * 0.40), balanco * comp * 0.22],
      [-comp * 0.50, altQ * (0.86 + ergue * 0.16), balanco * comp * 0.07],
      [-comp * 0.28, altQ, 0],                                    /* quadril */
      [-comp * 0.05, altQ * 0.52 + alt * 0.50 + c.arcoDorso, 0],  /* lombo */
      [comp * 0.22, alt, 0],                                      /* peito  */
      [comp * 0.38, alt + c.pescoco.subida * 0.34, 0],
      [comp * 0.38 + c.pescoco.comp * 0.52, alt + c.pescoco.subida * 0.86, 0],
      [comp * 0.38 + c.pescoco.comp * (0.72 + p.pescocoEstica * 0.2),
       alt + c.pescoco.subida * (1 + p.pescocoErgue), 0]          /* nuca   */
    ];

    var raio = chaves([
      [0.00, rT * 0.055], [0.10, rT * 0.20], [0.22, rT * 0.44],
      [0.375, rT * 0.94], [0.50, rT * 1.0], [0.625, rT * (1.02 + c.peito)],
      [0.70, rT * c.pescoco.raio * 1.24], [0.86, rT * c.pescoco.raio],
      [1.00, rT * c.pescoco.raio * 0.94]
    ]);
    /* mais alto que largo no peito (caixa torácica comprimida dos lados),
       redondo na cauda: é a proporção que dá porte em vez de salsicha */
    var achatar = chaves([
      [0.00, 1.0], [0.30, 1.05], [0.50, c.achatarTorso],
      [0.65, c.achatarTorso * 1.06], [0.80, 1.05], [1.00, 1.0]
    ]);
    var secao = function (t) {
      return {
        ventre: t > 0.30 && t < 0.72 ? 0.88 : 1.0,
        dorso: 1.0,
        quadrado: t > 0.30 && t < 0.72 ? 0.30 : 0.12,
        quilha: t > 0.52 && t < 0.70 ? 0.35 : 0
      };
    };

    var faixaVentre = c.faixaVentre === undefined ? 0.10 : c.faixaVentre;
    var res = ctx.M.loft({
      pontos: pts, n: c.segColuna || 46, lados: c.ladosColuna || 18,
      raio: raio, achatar: achatar, secao: secao,
      mat: function (t, a) {
        if (t > 0.24 && t < 0.95 && a > 0.75 - faixaVentre && a < 0.75 + faixaVentre) return ID.ventre;
        if (a > 0.15 && a < 0.35) return ID.dorso;
        return ID.pele;
      },
      tampaA: true, tampaB: true
    });
    res.raioFn = raio;
    return res;
  }

  /* ============================== crânio =============================== */

  /* Crânio dracônico completo, em espaço próprio: origem no occipital,
     focinho para +X. Volta como sub-malha para ser plantada no fim do
     pescoço com a orientação que a pose pedir. */
  function cranio(ctx, tam) {
    var c = ctx.cfg, ID = ctx.ID, o = ctx.o, p = ctx.pose;
    var H = M3.malha();
    var foc = c.focinho;                    /* 0 = achatado, 1.4 = lagarto */
    var bico = o.boca === 'bico';

    var compFoc = tam * (0.62 + 0.70 * foc);
    var pts = [
      [-tam * 0.42, tam * 0.02, 0],
      [-tam * 0.16, tam * 0.20, 0],
      [tam * 0.16, tam * 0.20, 0],
      [tam * 0.16 + compFoc * 0.45, tam * (0.06 - 0.04 * foc), 0],
      [tam * 0.16 + compFoc * 0.95, tam * (-0.06 - 0.06 * foc), 0]
    ];
    var largura = chaves([
      [0.00, tam * 0.30], [0.18, tam * 0.40], [0.36, tam * 0.42],
      [0.52, tam * (0.30 - 0.05 * foc)], [0.78, tam * (0.23 - 0.05 * foc)],
      [1.00, tam * (0.15 - 0.03 * foc)]
    ]);
    var perfilH = chaves([
      [0.00, 1.02], [0.20, 0.94], [0.40, 1.00],
      [0.60, 1.10], [0.85, 1.12], [1.00, 0.95]
    ]);
    H.loft({
      pontos: pts, n: 24, lados: 16,
      raio: largura, achatar: perfilH,
      secao: function (t) {
        return {
          /* palato reto: o maxilar superior tem fundo chato, é o que faz a
             linha da boca existir mesmo de longe */
          ventre: t > 0.34 ? 0.60 : 0.92,
          dorso: t < 0.30 ? 1.06 : 1.0,
          quadrado: 0.22 + t * 0.55
        };
      },
      desloc: function (t) { return [0, t > 0.3 ? -tam * 0.02 * (t - 0.3) : 0]; },
      mat: function (t, a) {
        return (a > 0.66 && a < 0.84) ? ID.ventre : (a > 0.15 && a < 0.35 ? ID.dorso : ID.pele);
      },
      tampaA: true, tampaB: true
    });

    /* arcada superciliar: a saliência acima do olho. Sem ela o bicho fica com
       cara de brinquedo, por mais focinho que tenha. */
    simetrico(H, function () {
      H.esfera([tam * 0.10, tam * 0.20, tam * 0.26], tam * 0.20, tam * 0.10, tam * 0.13,
               ID.dorso, 10, 6);
      /* massa do masseter, onde a mandíbula articula */
      H.esfera([-tam * 0.16, -tam * 0.02, tam * 0.26], tam * 0.24, tam * 0.20, tam * 0.14,
               ID.pele, 10, 7);
    });

    /* mandíbula, articulada pela abertura da pose */
    var ab = p.boca * (c.bocaMax === undefined ? 1 : c.bocaMax);
    var J = M3.malha();
    var jpts = [
      [-tam * 0.30, -tam * 0.16, 0],
      [-tam * 0.02, -tam * 0.30, 0],
      [tam * 0.16 + compFoc * 0.42, -tam * 0.28, 0],
      [tam * 0.16 + compFoc * 0.90, -tam * 0.16, 0]
    ];
    J.loft({
      pontos: jpts, n: 16, lados: 12,
      raio: chaves([[0, tam * 0.24], [0.3, tam * 0.22], [0.7, tam * 0.15], [1, tam * 0.08]]),
      achatar: chaves([[0, 0.72], [1, 0.80]]),
      secao: function () { return { dorso: 0.55, quadrado: 0.55 }; },
      mat: function (t, a) { return (a > 0.6 && a < 0.9) ? ID.ventre : ID.pele; },
      tampaA: true, tampaB: true
    });
    /* barbela / papo, que dá volume sob o queixo */
    if (c.papo) {
      J.esfera([tam * 0.02, -tam * 0.34, 0], tam * 0.28, tam * 0.16, tam * 0.20, ID.ventre, 12, 7);
    }
    var eixo = [-tam * 0.30, -tam * 0.14, 0];
    H.juntar(J, M3.mat.compor(
      M3.mat.transl(eixo[0], eixo[1], eixo[2]),
      M3.mat.rotZ(-ab),
      M3.mat.transl(-eixo[0], -eixo[1], -eixo[2])
    ));

    /* dentes: só onde a espécie tem presa. Cônicos, alternando tamanho — a
       fileira toda igual lê como pente. */
    if (!bico && c.dentes !== false) {
      var nd = c.nDentes || 6;
      simetrico(H, function () {
        for (var i = 0; i < nd; i++) {
          var t = 0.14 + (i / (nd - 1)) * 0.80;
          var x = tam * 0.16 + compFoc * (t - 0.16) / 0.84 * 0.95 - tam * 0.02;
          var lg = largura(t) * 0.80;
          var yTopo = -tam * 0.10 - t * tam * 0.10;
          var tamD = tam * (0.10 - t * 0.035) * ((i % 2) ? 0.72 : 1);
          H.ponta({
            base: [x, yTopo, lg], dir: [0.12, -1, 0.05], comp: tamD,
            raio: tamD * 0.30, curva: [-0.10, 0, 0], mat: ID.dente, n: 4, lados: 5
          });
          if (ab > 0.08 && i < nd - 1) {
            H.ponta({
              base: [x, -tam * 0.30 + ab * (x + tam * 0.30) * 0.55, lg * 0.86],
              dir: [0.10, 1, 0.05], comp: tamD * 0.8,
              raio: tamD * 0.26, curva: [0.06, 0, 0], mat: ID.dente, n: 4, lados: 5
            });
          }
        }
      });
    }

    /* bico de ave: o focinho vira queratina, com gancho na ponta */
    if (bico) {
      var bx = tam * 0.16 + compFoc * 0.35;
      H.ponta({
        base: [bx, tam * 0.02, 0], dir: [1, -0.12, 0], comp: compFoc * 0.92,
        raio: tam * 0.20, curva: [0, -tam * 0.34, 0], mat: ID.chifre,
        n: 10, lados: 10,
        achatar: chaves([[0, 1.05], [1, 1.25]])
      });
      H.ponta({
        base: [bx - tam * 0.02, -tam * 0.16, 0], dir: [1, 0.02, 0], comp: compFoc * 0.72,
        raio: tam * 0.15, curva: [0, tam * 0.06, 0], mat: ID.chifre, n: 8, lados: 9,
        achatar: chaves([[0, 0.8], [1, 0.9]])
      });
    }

    /* narina: cavidade escura na ponta do focinho */
    simetrico(H, function () {
      var xn = tam * 0.16 + compFoc * 0.80;
      H.esfera([xn, tam * (0.02 - 0.05 * foc), largura(0.86) * 0.55],
               tam * 0.058, tam * 0.040, tam * 0.048, ID.pupila, 8, 5);
    });

    /* olhos */
    olhos(H, ctx, tam, largura, foc);

    /* orelhas / membranas auriculares */
    orelhas(H, ctx, tam);

    return H;
  }

  /* Olho montado como peça: esclera, íris em calota saliente e pupila. A
     calota é o que produz o reflexo especular sozinha — não há brilho
     pintado em lugar nenhum. */
  function olhos(H, ctx, tam, largura, foc) {
    var ID = ctx.ID, o = ctx.o, c = ctx.cfg, rnd = ctx.rnd;
    var tipo = o.olhos || 'redondo';
    if (tipo === 'vazio') return;

    var r = tam * (c.olhoR || 0.135);
    var dir = M3.nrm([0.34, 0.16, 1]);

    function um(cx, cy, cz, rr, forma) {
      H.esfera([cx, cy, cz], rr, rr, rr, ID.esclera, 14, 9);
      var irisR = forma === 'redondo' ? rr * 0.80 : rr * 0.66;
      var irisD = forma === 'redondo' ? rr * 0.30 : rr * 0.46;
      H.esfera([cx + dir[0] * irisD, cy + dir[1] * irisD, cz + dir[2] * irisD],
               irisR, irisR, irisR, ID.iris, 14, 9);
      var pupD = irisD + rr * 0.30;
      if (forma === 'fenda') {
        H.esfera([cx + dir[0] * pupD, cy + dir[1] * pupD, cz + dir[2] * pupD],
                 rr * 0.42, rr * 0.62, rr * 0.42, ID.pupila, 10, 8);
      } else if (forma === 'composto') {
        /* olho de artrópode: a própria facetação da malha é o desenho */
        H.esfera([cx + dir[0] * rr * 0.12, cy + dir[1] * rr * 0.12, cz + dir[2] * rr * 0.12],
                 rr * 1.02, rr * 0.88, rr * 0.96, ID.iris, 12, 7);
      } else if (forma === 'brilho') {
        H.esfera([cx + dir[0] * rr * 0.16, cy + dir[1] * rr * 0.16, cz + dir[2] * rr * 0.16],
                 rr * 0.98, rr * 0.98, rr * 0.98, ID.aceso, 12, 8);
      } else {
        H.esfera([cx + dir[0] * pupD, cy + dir[1] * pupD, cz + dir[2] * pupD],
                 rr * 0.40, rr * 0.40, rr * 0.40, ID.pupila, 10, 7);
      }
    }

    simetrico(H, function () {
      if (tipo === 'multiplos') {
        var n = 3 + Math.floor(rnd() * 3);
        for (var i = 0; i < n; i++) {
          var ang = rnd() * Math.PI * 2;
          var d = tam * (0.10 + rnd() * 0.26);
          um(tam * (0.02 + Math.cos(ang) * 0.3) + d * 0.2,
             tam * 0.10 + Math.sin(ang) * d,
             largura(0.34) * (0.62 + rnd() * 0.25),
             r * (0.44 + rnd() * 0.42), 'brilho');
        }
        return;
      }
      um(tam * (0.16 + 0.05 * foc), tam * 0.11, largura(0.36) * 0.80, r, tipo);
    });
  }

  function orelhas(H, ctx, tam) {
    var ID = ctx.ID, t = ctx.o.orelhas || 'nenhuma';
    if (t === 'nenhuma') return;
    simetrico(H, function () {
      var bx = -tam * 0.14, by = tam * 0.18, bz = tam * 0.30;
      if (t === 'pontuda') {
        H.ponta({
          base: [bx, by, bz], dir: M3.nrm([-0.30, 0.86, 0.42]), comp: tam * 0.62,
          raio: tam * 0.14, curva: [-tam * 0.06, 0, tam * 0.10], mat: ID.pele,
          n: 6, lados: 6, achatar: chaves([[0, 0.55], [1, 0.42]])
        });
      } else if (t === 'longa') {
        H.ponta({
          base: [bx, by, bz], dir: M3.nrm([-0.42, 0.72, 0.56]), comp: tam * 1.05,
          raio: tam * 0.13, curva: [-tam * 0.16, -tam * 0.14, tam * 0.16], mat: ID.pele,
          n: 8, lados: 7, achatar: chaves([[0, 0.5], [1, 0.4]])
        });
      } else if (t === 'redonda') {
        H.esfera([bx - tam * 0.02, by + tam * 0.16, bz + tam * 0.12],
                 tam * 0.20, tam * 0.24, tam * 0.09, ID.pele, 12, 7);
      } else if (t === 'barbatana') {
        var base = [bx, by * 0.4, bz];
        H.retalho(function (a, b) {
          var esp = Math.sin(b * Math.PI) * tam * 0.05 * (1 - a);
          return [base[0] - a * tam * 0.42 + b * tam * 0.10,
                  base[1] + a * tam * 0.34 + Math.sin(b * Math.PI) * tam * 0.06,
                  base[2] + a * tam * 0.44 + esp];
        }, 5, 5, ID.barbatana, {});
      }
    });
  }

  /* ============================== membro =============================== */

  /* Perna digitígrada: ombro, cotovelo, punho alto e o peso apoiado nos
     dedos. É o desenho que a asa de morcego e a pata de dragão têm em comum,
     e o que faz o bicho parecer capaz de correr. */
  function perna(ctx, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var o = cfg.origem, dir = cfg.dir || 1;
    var comp = cfg.comp, esp = cfg.esp;
    var tras = cfg.traseira;

    var joelho = [o[0] + comp * (tras ? 0.24 : -0.10), o[1] - comp * 0.36, o[2] + comp * 0.06 * dir];
    var torn = [o[0] + comp * (tras ? -0.14 : 0.14), o[1] - comp * 0.68, o[2] + comp * 0.10 * dir];
    var pe = [o[0] + comp * (tras ? 0.10 : 0.06), o[1] - comp * 0.99, o[2] + comp * 0.12 * dir];

    M.loft({
      pontos: [o, joelho, torn, pe], n: 20, lados: 11,
      raio: chaves([[0, esp * 1.30], [0.22, esp * 1.02], [0.52, esp * 0.78],
                    [0.78, esp * 0.66], [1, esp * 0.62]]),
      achatar: chaves([[0, 1.18], [0.5, 1.06], [1, 1.0]]),
      secao: function () { return { quadrado: 0.25 }; },
      mat: ID.membro, tampaA: true, tampaB: false
    });

    /* Pé: metatarso curto e três dedos abertos, cada um com garra curta e
       grossa. Dedo fino demais some no retrato e a pata vira um tufo de
       arame — o dedo é que precisa ler, a garra é só a ponta dele. */
    var frente = [pe[0] + comp * 0.15, pe[1] - comp * 0.02, pe[2]];
    var nd = cfg.dedos || 3;
    for (var i = 0; i < nd; i++) {
      var f = nd === 1 ? 0 : (i / (nd - 1) - 0.5);
      var ponta = [frente[0] + comp * 0.11 * Math.cos(f * 1.1),
                   pe[1] - comp * 0.045,
                   pe[2] + f * comp * 0.17 * dir + comp * 0.02 * dir];
      M.loft({
        pontos: [pe, [(pe[0] + ponta[0]) / 2, pe[1] + comp * 0.025, (pe[2] + ponta[2]) / 2], ponta],
        n: 7, lados: 7,
        raio: chaves([[0, esp * 0.62], [1, esp * 0.34]]),
        achatar: chaves([[0, 0.86], [1, 0.80]]),
        mat: ID.membro, tampaA: true, tampaB: true
      });
      M.ponta({
        base: ponta, dir: M3.nrm([0.90, -0.30, f * 0.5]), comp: comp * 0.10,
        raio: esp * 0.32, curva: [0, -comp * 0.05, 0], mat: ID.garra, n: 6, lados: 6
      });
    }
    /* esporão traseiro: fecha a leitura de pata de predador */
    if (cfg.esporao !== false) {
      M.ponta({
        base: [pe[0] - comp * 0.05, pe[1] + comp * 0.05, pe[2]],
        dir: M3.nrm([-0.8, -0.5, 0]), comp: comp * 0.08,
        raio: esp * 0.24, curva: [0, -comp * 0.03, 0], mat: ID.garra, n: 5, lados: 5
      });
    }
    return { pe: pe, joelho: joelho };
  }

  /* Braço curto de bípede, com mão de três garras. */
  function braco(ctx, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var o = cfg.origem, comp = cfg.comp, esp = cfg.esp;
    var cot = [o[0] + comp * 0.24, o[1] - comp * 0.44, o[2] + comp * 0.22];
    var mao = [o[0] + comp * 0.62, o[1] - comp * 0.62, o[2] + comp * 0.30];
    M.loft({
      pontos: [o, cot, mao], n: 14, lados: 9,
      raio: chaves([[0, esp * 1.1], [0.45, esp * 0.72], [1, esp * 0.5]]),
      mat: ID.membro, tampaA: true, tampaB: true
    });
    for (var i = -1; i <= 1; i++) {
      M.ponta({
        base: [mao[0] + comp * 0.04, mao[1] - comp * 0.04, mao[2] + i * esp * 0.7],
        dir: M3.nrm([0.7, -0.68, i * 0.24]), comp: comp * 0.26,
        raio: esp * 0.20, curva: [comp * 0.05, -comp * 0.06, 0], mat: ID.garra, n: 6, lados: 6
      });
    }
    return mao;
  }

  /* =============================== asas ================================ */

  /* Asa de dedos e membrana. O que faz ler como asa não é o pano: são as
     falanges, a barriga da membrana entre elas e o couro fino deixando a luz
     passar — os três, juntos. */
  function asaMembrana(ctx, cfg) {
    var M = ctx.M, ID = ctx.ID, p = ctx.pose;
    var ombro = cfg.ombro, env = cfg.env, abrir = cfg.abrir === undefined ? p.asaAbrir : cfg.abrir;
    var dobra = 1 - abrir;

    var cot = [ombro[0] - env * (0.18 + dobra * 0.20),
               ombro[1] + env * (0.34 - dobra * 0.16),
               ombro[2] + env * (0.34 * abrir + 0.10)];
    var pun = [cot[0] + env * (0.34 - dobra * 0.42),
               cot[1] + env * (0.28 - dobra * 0.10),
               cot[2] + env * (0.46 * abrir + 0.06)];

    /* pontas das falanges: a primeira segue o bordo de ataque, as demais
       abrem para trás e para baixo */
    var dedos = [
      [pun[0] + env * (0.42 * abrir + 0.06), pun[1] + env * (0.16 * abrir), pun[2] + env * 0.34 * abrir],
      [pun[0] + env * (0.14 * abrir), pun[1] - env * (0.18 + 0.10 * dobra), pun[2] + env * 0.60 * abrir],
      [pun[0] - env * (0.26 * abrir + 0.10), pun[1] - env * 0.46, pun[2] + env * 0.58 * abrir],
      [pun[0] - env * (0.62 * abrir + 0.18), pun[1] - env * 0.62, pun[2] + env * 0.36 * abrir]
    ];
    var ancora = cfg.ancoraCorpo;

    /* costelas da membrana, amostradas a partir do punho */
    function costela(fim, curvatura) {
      var meio = [
        (pun[0] + fim[0]) / 2 + (curvatura || 0) * env * 0.06,
        (pun[1] + fim[1]) / 2 + env * 0.07,
        (pun[2] + fim[2]) / 2
      ];
      return M3.amostrar([pun, meio, fim], 10);
    }
    var ribs = [];
    for (var i = 0; i < dedos.length; i++) ribs.push(costela(dedos[i], 0.4));
    ribs.push(M3.amostrar([pun, [(pun[0] + ancora[0]) / 2, (pun[1] + ancora[1]) / 2 - env * 0.10,
                                 (pun[2] + ancora[2]) / 2], ancora], 10));

    function amostra(rib, b) {
      var g = b * (rib.length - 1);
      var k = Math.min(rib.length - 2, Math.floor(g));
      var f = g - k;
      return M3.mistura(rib[k], rib[k + 1], f);
    }

    /* painéis entre costelas, com a barriga que o peso dá ao couro */
    for (i = 0; i < ribs.length - 1; i++) {
      (function (ri) {
        var queda = ri === ribs.length - 2 ? 0.10 : 0.17;
        M.retalho(function (a, b) {
          var A = amostra(ribs[ri], b), Bp = amostra(ribs[ri + 1], b);
          var q = M3.mistura(A, Bp, a);
          var sag = Math.sin(a * Math.PI) * b * queda * env;
          return [q[0] - sag * 0.22, q[1] - sag, q[2] - sag * 0.10];
        }, 6, 8, ID.membrana, {});
      })(i);
    }

    /* propatágio: a teia entre ombro e punho, no bordo de ataque */
    var arco = M3.amostrar([ombro, cot, pun], 8);
    M.retalho(function (a, b) {
      var A = amostra(arco, b);
      var Bp = M3.mistura(ombro, pun, b);
      var q = M3.mistura(Bp, A, a);
      return [q[0], q[1] - (1 - a) * Math.sin(b * Math.PI) * env * 0.05, q[2]];
    }, 4, 7, ID.membrana, {});

    /* ossos por cima: úmero e rádio grossos, falanges afinando */
    M.loft({
      pontos: [ombro, cot, pun], n: 14, lados: 8,
      raio: chaves([[0, env * 0.075], [0.5, env * 0.048], [1, env * 0.036]]),
      mat: ID.osso, tampaA: true, tampaB: false
    });
    for (i = 0; i < dedos.length; i++) {
      M.loft({
        pontos: ribs[i], n: 12, lados: 6,
        raio: chaves([[0, env * 0.034 - i * env * 0.003], [1, env * 0.008]]),
        mat: ID.osso, tampaA: false, tampaB: true
      });
    }
    /* garra no polegar da asa */
    M.ponta({
      base: pun, dir: M3.nrm([0.7, 0.55, 0.42]), comp: env * 0.14,
      raio: env * 0.026, curva: [env * 0.03, -env * 0.06, 0], mat: ID.garra, n: 6, lados: 6
    });
    return { pun: pun, dedos: dedos };
  }

  /* Asa emplumada: rêmiges primárias na mão, secundárias no antebraço e uma
     fileira de coberteiras cobrindo a emenda. */
  function asaPena(ctx, cfg) {
    var M = ctx.M, ID = ctx.ID, p = ctx.pose;
    var ombro = cfg.ombro, env = cfg.env;
    var abrir = cfg.abrir === undefined ? p.asaAbrir : cfg.abrir;
    var cot = [ombro[0] - env * 0.16, ombro[1] + env * 0.26, ombro[2] + env * (0.30 * abrir + 0.08)];
    var pun = [cot[0] + env * 0.20, cot[1] + env * 0.18, cot[2] + env * (0.52 * abrir + 0.06)];
    var arco = M3.amostrar([ombro, cot, pun], 12);

    function pluma(base, dir, comp, larg, mat, torcao) {
      var lado = M3.nrm(M3.cruz(dir, [0, 0, 1]));
      if (!isFinite(lado[0])) lado = [0, 1, 0];
      M.retalho(function (a, b) {
        var l = larg * Math.sin(Math.pow(b, 0.55) * Math.PI) * (1 - b * 0.25);
        var eixo = [base[0] + dir[0] * comp * b,
                    base[1] + dir[1] * comp * b - comp * b * b * 0.12,
                    base[2] + dir[2] * comp * b];
        var d = (a - 0.5) * 2;
        return [eixo[0] + lado[0] * l * d,
                eixo[1] + lado[1] * l * d + Math.abs(d) * l * torcao,
                eixo[2] + lado[2] * l * d];
      }, 3, 7, mat, {});
    }

    var n = cfg.n || 11;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var g = t * (arco.length - 1);
      var k = Math.min(arco.length - 2, Math.floor(g));
      var base = M3.mistura(arco[k], arco[k + 1], g - k);
      /* Rêmiges varrem para TRÁS e para fora — é o que fecha a superfície da
         asa. Apontadas para a frente elas viravam um leque de espetos em
         volta do bicho, que foi exatamente o que aconteceu na primeira
         tentativa. As primárias, na mão, são as longas. */
      var comp = env * (0.32 + 0.70 * Math.pow(t, 1.2));
      var dir = M3.nrm([-0.78 + t * 0.34, -0.26 + t * 0.14,
                        (0.42 + t * 0.85) * abrir + 0.14]);
      pluma(base, dir, comp, comp * (0.15 - t * 0.04),
            (i % 2) ? ID.pena : ID.penaCl, -0.08);
    }
    /* coberteiras: fileira curta cobrindo a raiz das rêmiges */
    for (i = 0; i < 7; i++) {
      var t2 = i / 6;
      var g2 = t2 * (arco.length - 1);
      var k2 = Math.min(arco.length - 2, Math.floor(g2));
      var b2 = M3.mistura(arco[k2], arco[k2 + 1], g2 - k2);
      pluma([b2[0], b2[1] + env * 0.012, b2[2] + env * 0.01],
            M3.nrm([-0.66, -0.42, 0.42 * abrir + 0.16]),
            env * (0.24 + t2 * 0.12), env * 0.048, ID.penaCl, 0.14);
    }
    /* osso do braço, discreto sob as penas */
    M.loft({
      pontos: [ombro, cot, pun], n: 10, lados: 7,
      raio: chaves([[0, env * 0.065], [1, env * 0.030]]),
      mat: ID.membro, tampaA: true, tampaB: true
    });
    return { pun: pun };
  }

  /* Asa de inseto: lâmina translúcida com nervuras em relevo. */
  function asaInseto(ctx, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var o = cfg.ombro, env = cfg.env;
    for (var par = 0; par < 2; par++) {
      var giro = par ? -0.30 : 0.12;
      var esc = par ? 0.78 : 1;
      M.retalho(function (a, b) {
        var l = Math.sin(Math.pow(b, 0.5) * Math.PI) * env * 0.24 * esc;
        var d = (a - 0.5) * 2;
        return [o[0] - b * env * 0.76 * esc + d * l * 0.30,
                o[1] + b * env * 0.30 * esc + Math.sin(giro) * b * env * 0.3 + d * l * 0.12,
                o[2] + b * env * 0.52 * esc + d * l];
      }, 4, 9, ID.membrana, {});
    }
  }

  /* Asa etérea: sem osso e sem couro — só luz com forma de asa. Três lâminas
     defasadas, cada uma quase transparente; a sobreposição é que dá densidade,
     como acontece com véu de verdade. */
  function asaEterea(ctx, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var o = cfg.ombro, env = cfg.env;
    for (var k = 0; k < 3; k++) {
      (function (k) {
        var ab = 0.94 - k * 0.20;
        M.retalho(function (a, b) {
          var l = Math.sin(Math.pow(b, 0.62) * Math.PI) * env * (0.17 - k * 0.035);
          var d = (a - 0.5) * 2;
          var arco = Math.sin(b * Math.PI) * env * 0.20;
          return [o[0] - b * env * (0.42 + k * 0.10) * ab + arco * 0.14 + d * l * 0.35,
                  o[1] + b * env * 0.80 * ab + d * l * 0.86,
                  o[2] + b * env * 0.34 * ab + k * env * 0.055 + d * l * 0.30];
        }, 3, 9, ID.etereo, {});
      })(k);
    }
  }

  /* ============================ decorações ============================= */

  /* Fileira de espinhos acompanhando a coluna. A altura segue um sino: alta
     no lombo, baixa na nuca e na cauda — é o que dá linha ao dorso. */
  function cristaDorsal(ctx, col, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var t0 = cfg.t0, t1 = cfg.t1, n = cfg.n || 12;
    var qs = col.quadros;
    for (var i = 0; i < n; i++) {
      var t = t0 + (t1 - t0) * (i / (n - 1));
      var qi = Math.min(qs.length - 1, Math.round(t * (qs.length - 1)));
      var q = qs[qi];
      var r = col.raios[qi];
      var alt = cfg.alt * (0.35 + Math.sin((i / (n - 1)) * Math.PI) * 0.85);
      var base = M3.som(q.c, M3.mul(q.up, r * 0.92));
      var dir = M3.nrm(M3.som(M3.mul(q.up, 1), M3.mul(q.t, -cfg.inclina || -0.30)));
      M.ponta({
        base: base, dir: dir, comp: alt, raio: alt * (cfg.grossura || 0.30),
        curva: M3.mul(q.t, -alt * 0.28), mat: cfg.mat === undefined ? ID.realce : cfg.mat,
        n: 5, lados: cfg.lados || 5,
        achatar: chaves([[0, cfg.achatar || 0.45], [1, (cfg.achatar || 0.45) * 0.8]])
      });
    }
  }

  /* Vela dorsal: membrana esticada sobre a coluna, no lugar dos espinhos. */
  function velaDorsal(ctx, col, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var qs = col.quadros, t0 = cfg.t0, t1 = cfg.t1;
    M.retalho(function (a, b) {
      var t = t0 + (t1 - t0) * b;
      var qi = Math.min(qs.length - 1, Math.round(t * (qs.length - 1)));
      var q = qs[qi];
      var r = col.raios[qi];
      var h = cfg.alt * Math.sin(Math.pow(b, 0.8) * Math.PI);
      var base = M3.som(q.c, M3.mul(q.up, r * 0.9));
      var d = (a - 0.5) * 2;
      return [base[0] + q.up[0] * h + q.lado[0] * d * cfg.alt * 0.05,
              base[1] + q.up[1] * h + q.lado[1] * d * cfg.alt * 0.05,
              base[2] + q.up[2] * h + q.lado[2] * d * cfg.alt * 0.05];
    }, 2, 16, cfg.mat === undefined ? ID.barbatana : cfg.mat, {});
  }

  /* Placas de armadura sobre o dorso e o flanco. */
  function placas(ctx, col, cfg) {
    var M = ctx.M, ID = ctx.ID;
    var qs = col.quadros, n = cfg.n || 6;
    for (var i = 0; i < n; i++) {
      var t = cfg.t0 + (cfg.t1 - cfg.t0) * (i / (n - 1));
      var qi = Math.min(qs.length - 1, Math.round(t * (qs.length - 1)));
      var q = qs[qi];
      var r = col.raios[qi];
      simetrico(M, function () {
        var ang = 0.55;
        var dirP = M3.nrm(M3.som(M3.mul(q.up, Math.cos(ang)), M3.mul(q.lado, Math.sin(ang))));
        var c = M3.som(q.c, M3.mul(dirP, r * 0.94));
        M.retalho(function (a, b) {
          var w = r * 0.62 * Math.sin(b * Math.PI) * (1 - a * 0.25);
          var alt = r * (0.16 + 0.16 * Math.sin(b * Math.PI)) * (1 - a);
          return [c[0] + q.t[0] * (b - 0.5) * r * 1.5 + dirP[0] * alt + q.lado[0] * (a - 0.5) * w,
                  c[1] + q.t[1] * (b - 0.5) * r * 1.5 + dirP[1] * alt + q.lado[1] * (a - 0.5) * w,
                  c[2] + q.t[2] * (b - 0.5) * r * 1.5 + dirP[2] * alt + q.lado[2] * (a - 0.5) * w];
        }, 3, 5, cfg.mat === undefined ? ID.secund : cfg.mat, { dupla: false });
      });
    }
  }

  /* Chifres, plantados no crânio e curvados para trás. */
  function chifres(H, ctx, tam, cfg) {
    var ID = ctx.ID;
    cfg = cfg || {};
    simetrico(H, function () {
      H.ponta({
        base: [-tam * 0.06, tam * 0.26, tam * 0.20],
        dir: M3.nrm([-0.42, 0.86, 0.30]),
        comp: tam * (cfg.comp || 1.05),
        raio: tam * (cfg.raio || 0.21),
        curva: [-tam * 0.42, -tam * 0.10, tam * 0.16],
        mat: cfg.mat === undefined ? ID.chifre : cfg.mat,
        n: 9, lados: 8
      });
      if (cfg.par2) {
        H.ponta({
          base: [-tam * 0.20, tam * 0.10, tam * 0.26],
          dir: M3.nrm([-0.66, 0.42, 0.62]), comp: tam * 0.52,
          raio: tam * 0.12, curva: [-tam * 0.18, -tam * 0.10, 0],
          mat: cfg.mat === undefined ? ID.chifre : cfg.mat, n: 6, lados: 6
        });
      }
    });
  }

  /* Lâmina de cristal, com facetas de verdade em vez de brilho pintado. */
  function cristais(M, ID, base, dir, comp, raio, rnd) {
    M.ponta({
      base: base, dir: M3.nrm(dir), comp: comp, raio: raio,
      curva: [0, 0, 0], mat: ID.cristal, n: 3, lados: 5,
      perfil: function (t) { return raio * (1 - t) * (0.7 + 0.3 * Math.cos(t * 9)); }
    });
    void rnd;
  }

  /* Folhagem: lâminas curvas de folha, para as espécies de Verdejo. */
  function folhas(M, ID, cfg) {
    var n = cfg.n || 5;
    for (var i = 0; i < n; i++) {
      var ang = cfg.ang0 + (cfg.ang1 - cfg.ang0) * (i / (n - 1 || 1));
      var giro = cfg.giro0 + (cfg.giro1 - cfg.giro0) * (i / (n - 1 || 1));
      (function (ang, giro, k) {
        var comp = cfg.comp * (0.7 + 0.5 * Math.sin((k / n) * Math.PI));
        M.retalho(function (a, b) {
          var l = cfg.larg * Math.sin(Math.pow(b, 0.6) * Math.PI) * (1 - b * 0.15);
          var d = (a - 0.5) * 2;
          var x = Math.cos(ang) * comp * b;
          var y = Math.sin(ang) * comp * b - b * b * comp * 0.22;
          var z = Math.sin(giro) * comp * b * 0.7;
          return [cfg.base[0] + x + d * l * Math.sin(giro) * 0.4,
                  cfg.base[1] + y + Math.abs(d) * l * 0.18,
                  cfg.base[2] + z + d * l * Math.cos(giro)];
        }, 3, 7, ID.folha, {});
      })(ang, giro, i);
    }
  }

  /* ============================== poses =============================== */

  /* Postura individual. A promessa da arte anterior — dois indivíduos da
     mesma espécie nunca saem iguais — continua valendo, e agora vale em
     articulação, não só em cor. */
  function pose(rnd, cfg) {
    var p = {
      cabecaPitch: (rnd() - 0.5) * 0.42,
      cabecaGiro: (rnd() - 0.5) * 0.52,
      cabecaRolo: (rnd() - 0.5) * 0.22,
      boca: rnd() < (cfg.chanceBoca === undefined ? 0.34 : cfg.chanceBoca)
        ? 0.22 + rnd() * 0.34 : 0.015,
      caudaBal: (rnd() - 0.5) * 1.5,
      caudaErgue: (rnd() - 0.5) * 0.8,
      pescocoErgue: (rnd() - 0.5) * 0.30,
      pescocoEstica: (rnd() - 0.5) * 0.5,
      asaAbrir: cfg.asaAbrir === undefined ? (0.52 + rnd() * 0.46) : cfg.asaAbrir,
      passo: (rnd() - 0.5) * 0.5
    };
    return p;
  }

  /* Matriz que planta o crânio no fim do pescoço, com a orientação da pose. */
  function matrizCabeca(col, p, extra) {
    var q = col.quadros[col.quadros.length - 1];
    var giro = p.cabecaGiro + (extra && extra.giro || 0);
    var pit = p.cabecaPitch + (extra && extra.pitch || 0);
    var fwd = M3.nrm(q.t);
    var up = M3.nrm(q.up);
    var lado = M3.nrm(M3.cruz(fwd, up));
    /* inclina */
    fwd = M3.nrm(M3.som(M3.mul(fwd, Math.cos(pit)), M3.mul(up, Math.sin(pit))));
    up = M3.nrm(M3.cruz(lado, fwd));
    /* vira */
    fwd = M3.nrm(M3.som(M3.mul(fwd, Math.cos(giro)), M3.mul(lado, Math.sin(giro))));
    lado = M3.nrm(M3.cruz(fwd, up));
    up = M3.nrm(M3.cruz(lado, fwd));
    var pos = M3.som(q.c, M3.mul(fwd, (extra && extra.avanco) || 0));
    return [fwd[0], up[0], lado[0], pos[0],
            fwd[1], up[1], lado[1], pos[1],
            fwd[2], up[2], lado[2], pos[2],
            0, 0, 0, 1];
  }

  /* Ponto no espaço do mundo a partir do espaço da cabeça. */
  function noMundo(m, p) { return M3.mat.aplicar(m, p); }

  A3.chaves = chaves;
  A3.materiais = materiais;
  A3.coluna = coluna;
  A3.cranio = cranio;
  A3.perna = perna;
  A3.braco = braco;
  A3.asaMembrana = asaMembrana;
  A3.asaPena = asaPena;
  A3.asaInseto = asaInseto;
  A3.asaEterea = asaEterea;
  A3.cristaDorsal = cristaDorsal;
  A3.velaDorsal = velaDorsal;
  A3.placas = placas;
  A3.chifres = chifres;
  A3.cristaisEm = cristais;
  A3.folhas = folhas;
  A3.simetrico = simetrico;
  A3.matrizCabeca = matrizCabeca;
  A3.noMundo = noMundo;
  A3.pose = pose;

})(window.ANIMOS);
