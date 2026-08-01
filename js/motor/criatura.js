/* =========================================================================
   motor/criatura.js — Criação, atributos, evolução e cuidado dos Ânimos
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var C = G.Criatura = {};

  C.NIVEL_MAX = 100;
  C.CHANCE_PRISMATICO = 1 / 480;

  /* --------------------------- curva de nível -------------------------- */
  C.xpTotalPara = function (nivel) { return Math.floor(Math.pow(nivel, 3)); };
  C.xpDoNivel = function (nivel) { return C.xpTotalPara(nivel + 1) - C.xpTotalPara(nivel); };
  C.xpNoNivel = function (c) { return c.xp - C.xpTotalPara(c.nivel); };
  C.progressoNivel = function (c) {
    if (c.nivel >= C.NIVEL_MAX) return 1;
    return U.clamp(C.xpNoNivel(c) / C.xpDoNivel(c.nivel), 0, 1);
  };

  /* ----------------------------- criação ------------------------------- */
  C.criar = function (especieId, nivel, opts) {
    opts = opts || {};
    var esp = G.especie(especieId);
    if (!esp) throw new Error('Espécie desconhecida: ' + especieId);
    nivel = U.clamp(nivel || 5, 1, C.NIVEL_MAX);

    var seed = opts.seed !== undefined ? opts.seed : Math.floor(Math.random() * 2147483647);
    var rnd = G.mulberry32(seed);

    var ivs = {};
    ['hp', 'atk', 'def', 'atkEsp', 'defEsp', 'vel'].forEach(function (k) {
      ivs[k] = Math.floor(rnd() * 32);
    });

    var c = {
      uid: U.uid(),
      esp: especieId,
      apelido: null,
      nivel: nivel,
      xp: C.xpTotalPara(nivel),
      ivs: ivs,
      natureza: (opts.natureza || U.choice(G.NATUREZAS, rnd).id),
      /* variação visual individual */
      seed: seed,
      matiz: Math.round((rnd() - 0.5) * 34),
      padrao: U.choice(G.PADROES, rnd).id,
      porte: +(0.90 + rnd() * 0.22).toFixed(3),
      prismatico: opts.prismatico !== undefined ? opts.prismatico : (rnd() < C.CHANCE_PRISMATICO),
      /* estado */
      hpAtual: 0,
      status: null,
      statusTurnos: 0,
      tecnicas: [],
      /* cuidado */
      energia: 100,
      saciedade: 85,
      vinculo: opts.vinculo !== undefined ? opts.vinculo : 25,
      /* metadados */
      capturadoEm: opts.local || null,
      capturadoNivel: nivel,
      selvagem: !!opts.selvagem,
      data: Date.now()
    };

    c.tecnicas = C.tecnicasNoNivel(esp, nivel);
    c.hpAtual = C.atributos(c).hp;
    return c;
  };

  /* Últimas 4 técnicas disponíveis até o nível informado */
  C.tecnicasNoNivel = function (esp, nivel) {
    var ids = [];
    esp.apr.forEach(function (p) {
      if (p[0] <= nivel && ids.indexOf(p[1]) === -1) ids.push(p[1]);
    });
    ids = ids.slice(-4);
    return ids.map(function (id) {
      var t = G.tecnica(id);
      return { id: id, pp: t ? t.pp : 10, ppMax: t ? t.pp : 10 };
    });
  };

  /* ---------------------------- atributos ------------------------------ */
  C.atributos = function (c) {
    var esp = G.especie(c.esp);
    var nat = null, i;
    for (i = 0; i < G.NATUREZAS.length; i++) if (G.NATUREZAS[i].id === c.natureza) nat = G.NATUREZAS[i];

    var r = {};
    r.hp = Math.floor((2 * esp.base.hp + c.ivs.hp) * c.nivel / 100) + c.nivel + 10;
    ['atk', 'def', 'atkEsp', 'defEsp', 'vel'].forEach(function (k) {
      var v = Math.floor((2 * esp.base[k] + c.ivs[k]) * c.nivel / 100) + 5;
      if (nat) {
        if (nat.sobe === k) v = Math.floor(v * 1.1);
        else if (nat.desce === k) v = Math.floor(v * 0.9);
      }
      r[k] = v;
    });
    return r;
  };

  /* Modificadores vindos do sistema de cuidado (energia/fome/vínculo) */
  C.modsCuidado = function (c) {
    var m = { dano: 1, vel: 1, crit: 0, xp: 1 };
    if (c.energia < 15) { m.dano *= 0.80; m.vel *= 0.70; }
    else if (c.energia < 35) { m.dano *= 0.92; m.vel *= 0.88; }
    if (c.saciedade < 10) { m.dano *= 0.88; m.vel *= 0.90; }
    else if (c.saciedade < 30) { m.dano *= 0.96; }
    if (c.vinculo >= 80) { m.dano *= 1.10; m.crit += 0.06; m.xp *= 1.20; }
    else if (c.vinculo >= 55) { m.dano *= 1.05; m.crit += 0.03; m.xp *= 1.10; }
    else if (c.vinculo < 20) { m.dano *= 0.96; }
    return m;
  };

  C.nome = function (c) {
    if (!c) return '???';
    return c.apelido || G.especie(c.esp).nome;
  };

  C.desmaiado = function (c) { return c.hpAtual <= 0; };

  C.fracaoHP = function (c) {
    var m = C.atributos(c).hp;
    return m > 0 ? U.clamp(c.hpAtual / m, 0, 1) : 0;
  };

  C.curar = function (c, qtd) {
    var max = C.atributos(c).hp;
    var antes = c.hpAtual;
    c.hpAtual = U.clamp(c.hpAtual + qtd, 0, max);
    return c.hpAtual - antes;
  };

  C.restaurarTudo = function (c) {
    c.hpAtual = C.atributos(c).hp;
    c.status = null;
    c.statusTurnos = 0;
    c.energia = 100;
    c.tecnicas.forEach(function (t) { t.pp = t.ppMax; });
  };

  /* ------------------------------- XP ---------------------------------- */
  /* Devolve lista de eventos: {tipo:'nivel'|'tecnica'|'evolucao', ...}     */
  C.ganharXP = function (c, xp) {
    var eventos = [];
    if (c.nivel >= C.NIVEL_MAX) return eventos;
    var mods = C.modsCuidado(c);
    xp = Math.max(1, Math.floor(xp * mods.xp));
    eventos.push({ tipo: 'xp', valor: xp });
    c.xp += xp;

    var esp = G.especie(c.esp);
    while (c.nivel < C.NIVEL_MAX && c.xp >= C.xpTotalPara(c.nivel + 1)) {
      var hpAntes = C.atributos(c).hp;
      c.nivel++;
      var hpDepois = C.atributos(c).hp;
      c.hpAtual = Math.min(hpDepois, c.hpAtual + (hpDepois - hpAntes));
      eventos.push({ tipo: 'nivel', nivel: c.nivel });
      c.vinculo = U.clamp(c.vinculo + 2, 0, 100);

      /* novas técnicas */
      esp.apr.forEach(function (p) {
        if (p[0] === c.nivel) {
          var jaTem = c.tecnicas.some(function (t) { return t.id === p[1]; });
          if (jaTem) return;
          var tec = G.tecnica(p[1]);
          if (!tec) return;
          if (c.tecnicas.length < 4) {
            c.tecnicas.push({ id: p[1], pp: tec.pp, ppMax: tec.pp });
            eventos.push({ tipo: 'tecnica', id: p[1] });
          } else {
            eventos.push({ tipo: 'tecnica_cheia', id: p[1] });
          }
        }
      });

      if (esp.evo && c.nivel >= esp.evo.nivel) {
        eventos.push({ tipo: 'evolucao', para: esp.evo.para });
      }
    }
    return eventos;
  };

  C.podeEvoluir = function (c) {
    var esp = G.especie(c.esp);
    return !!(esp.evo && c.nivel >= esp.evo.nivel);
  };

  C.evoluir = function (c) {
    var esp = G.especie(c.esp);
    if (!esp.evo) return null;
    var antes = esp.nome;
    var fracao = C.fracaoHP(c);
    c.esp = esp.evo.para;
    var novoMax = C.atributos(c).hp;
    c.hpAtual = Math.max(1, Math.round(novoMax * fracao));
    c.vinculo = U.clamp(c.vinculo + 6, 0, 100);
    /* aprende técnicas de nível 1 da nova forma se houver espaço */
    var nova = G.especie(c.esp);
    nova.apr.forEach(function (p) {
      if (p[0] <= c.nivel && c.tecnicas.length < 4) {
        if (!c.tecnicas.some(function (t) { return t.id === p[1]; })) {
          var tec = G.tecnica(p[1]);
          if (tec) c.tecnicas.push({ id: p[1], pp: tec.pp, ppMax: tec.pp });
        }
      }
    });
    return { de: antes, para: nova.nome };
  };

  C.trocarTecnica = function (c, indice, novaId) {
    var tec = G.tecnica(novaId);
    if (!tec) return false;
    c.tecnicas[indice] = { id: novaId, pp: tec.pp, ppMax: tec.pp };
    return true;
  };

  /* ---------------------------- cuidado -------------------------------- */
  /* Chamado a cada N passos no mapa. */
  C.tickCuidado = function (c, unidades) {
    unidades = unidades || 1;
    var antesFome = c.saciedade;
    c.saciedade = U.clamp(c.saciedade - 0.55 * unidades, 0, 100);
    c.energia = U.clamp(c.energia - (c.saciedade <= 0 ? 0.8 : 0.28) * unidades, 0, 100);
    if (c.saciedade <= 0 && antesFome > 0) {
      c.vinculo = U.clamp(c.vinculo - 1, 0, 100);
    } else if (c.saciedade <= 0) {
      c.vinculo = U.clamp(c.vinculo - 0.12 * unidades, 0, 100);
    }
    /* regeneração lenta se bem cuidado */
    if (c.saciedade > 60 && c.energia > 50 && c.hpAtual > 0) {
      var max = C.atributos(c).hp;
      if (c.hpAtual < max) c.hpAtual = Math.min(max, c.hpAtual + 0.06 * unidades);
    }
  };

  C.alimentar = function (c, item) {
    var r = { fome: 0, vinculo: 0, energia: 0, hp: 0 };
    if (item.fome) { var a = c.saciedade; c.saciedade = U.clamp(c.saciedade + item.fome, 0, 100); r.fome = Math.round(c.saciedade - a); }
    if (item.energia) { var e = c.energia; c.energia = U.clamp(c.energia + item.energia, 0, 100); r.energia = Math.round(c.energia - e); }
    if (item.vinculo) { var v = c.vinculo; c.vinculo = U.clamp(c.vinculo + item.vinculo, 0, 100); r.vinculo = Math.round(c.vinculo - v); }
    if (item.cura) r.hp = C.curar(c, item.cura);
    return r;
  };

  C.estadoCuidado = function (c) {
    var s = [];
    if (c.saciedade <= 0) s.push({ t: 'Faminto', cor: '#e2653a' });
    else if (c.saciedade < 30) s.push({ t: 'Com fome', cor: '#e0a03a' });
    if (c.energia < 15) s.push({ t: 'Exausto', cor: '#e2653a' });
    else if (c.energia < 35) s.push({ t: 'Cansado', cor: '#e0a03a' });
    if (c.vinculo >= 80) s.push({ t: 'Devotado', cor: '#7ad4a0' });
    else if (c.vinculo >= 55) s.push({ t: 'Afeiçoado', cor: '#8fd6c0' });
    else if (c.vinculo < 20) s.push({ t: 'Arredio', cor: '#b0a8c0' });
    if (!s.length) s.push({ t: 'Bem', cor: '#9fd6a8' });
    return s;
  };

  /* Rótulo qualitativo dos atributos ocultos (IVs) */
  C.avaliacao = function (c) {
    var soma = c.ivs.hp + c.ivs.atk + c.ivs.def + c.ivs.atkEsp + c.ivs.defEsp + c.ivs.vel;
    if (soma >= 170) return { t: 'Excepcional', cor: '#f0c14b' };
    if (soma >= 140) return { t: 'Notável', cor: '#8fd6c0' };
    if (soma >= 105) return { t: 'Promissor', cor: '#9fb8e0' };
    if (soma >= 70) return { t: 'Comum', cor: '#b0a8c0' };
    return { t: 'Frágil', cor: '#c09090' };
  };

  C.melhorAtributo = function (c) {
    var nomes = { hp: 'Vigor', atk: 'Ataque', def: 'Defesa', atkEsp: 'Atq. Especial', defEsp: 'Def. Especial', vel: 'Velocidade' };
    var melhor = 'hp', k;
    for (k in c.ivs) if (c.ivs[k] > c.ivs[melhor]) melhor = k;
    return nomes[melhor];
  };

  C.natureza = function (c) {
    for (var i = 0; i < G.NATUREZAS.length; i++) if (G.NATUREZAS[i].id === c.natureza) return G.NATUREZAS[i];
    return G.NATUREZAS[G.NATUREZAS.length - 1];
  };

  C.padraoNome = function (c) {
    for (var i = 0; i < G.PADROES.length; i++) if (G.PADROES[i].id === c.padrao) return G.PADROES[i].nome;
    return 'Liso';
  };

  C.porteNome = function (c) {
    if (c.porte >= 1.07) return 'Avantajado';
    if (c.porte >= 1.02) return 'Grande';
    if (c.porte <= 0.93) return 'Miúdo';
    if (c.porte <= 0.97) return 'Pequeno';
    return 'Mediano';
  };

  /* Descrição curta da variação individual — dois indivíduos nunca batem */
  C.marcaIndividual = function (c) {
    var m = [];
    m.push(C.padraoNome(c));
    m.push(C.porteNome(c));
    if (c.matiz > 8) m.push('tom quente');
    else if (c.matiz < -8) m.push('tom frio');
    if (c.prismatico) m.push('PRISMÁTICO');
    return m.join(' · ');
  };

  G.variacaoDe = function (c) {
    return { seed: c.seed, matiz: c.matiz, padrao: c.padrao, porte: c.porte, prismatico: c.prismatico };
  };

})(window.ANIMOS);
