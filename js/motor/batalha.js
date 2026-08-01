/* =========================================================================
   motor/batalha.js — Combate por turnos
   ---------------------------------------------------------------------
   O motor não desenha nada: ele devolve uma fila de EVENTOS que a
   interface reproduz em sequência (mensagem, dano, status, captura...).
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var C = G.Criatura;
  var B = G.Batalha = {};

  var ESTAGIOS = [0.25, 0.28, 0.33, 0.40, 0.50, 0.66, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  var ESTAGIOS_PREC = [0.33, 0.36, 0.43, 0.50, 0.60, 0.75, 1, 1.33, 1.66, 2, 2.33, 2.66, 3];

  function multEstagio(n, precisao) {
    n = U.clamp(n, -6, 6);
    return (precisao ? ESTAGIOS_PREC : ESTAGIOS)[n + 6];
  }

  function novoLado(criatura) {
    return {
      c: criatura,
      mod: { atk: 0, def: 0, atkEsp: 0, defEsp: 0, vel: 0, prec: 0, esq: 0, critF: 0 },
      atordoado: false,
      turnos: 0
    };
  }

  /* ------------------------------------------------------------------ */
  B.criar = function (cfg) {
    var b = {
      aliado: novoLado(cfg.aliado),
      inimigo: novoLado(cfg.inimigo),
      selvagem: cfg.selvagem !== false,
      local: cfg.local || '',
      equipe: cfg.equipe || [cfg.aliado],
      mochila: cfg.mochila || {},
      tentativasFuga: 0,
      turno: 0,
      acabou: false,
      resultado: null,
      capturado: null,
      seloUsado: 0
    };
    return b;
  };

  /* --------------------------- utilidades ---------------------------- */
  function atrib(lado, chave) {
    var base = C.atributos(lado.c)[chave];
    return Math.max(1, Math.floor(base * multEstagio(lado.mod[chave] || 0)));
  }

  function velocidadeEfetiva(lado) {
    var v = atrib(lado, 'vel');
    var m = C.modsCuidado(lado.c);
    v = v * m.vel;
    if (lado.c.status === 'paralisia') v *= 0.5;
    return Math.max(1, Math.floor(v));
  }

  B.nomeLado = function (b, qual) {
    var l = qual === 'aliado' ? b.aliado : b.inimigo;
    var n = C.nome(l.c);
    return qual === 'inimigo' && b.selvagem ? (n + ' selvagem') : n;
  };

  /* ----------------------------- eventos ------------------------------ */
  function msg(fila, texto) { fila.push({ t: 'msg', texto: texto }); }

  /* ---------------------------- execução ------------------------------ */

  function aplicarModificadores(fila, b, atacante, alvoLado, ef, qualAlvo) {
    if (!ef || !ef.mod) return;
    if (ef.mod.c !== undefined && Math.random() > ef.mod.c) return;
    var destino = ef.mod.alvo === 'eu' ? atacante : alvoLado;
    var nomeDest = destino === b.aliado ? B.nomeLado(b, 'aliado') : B.nomeLado(b, 'inimigo');
    var k;
    for (k in ef.mod.stats) {
      var d = ef.mod.stats[k];
      var antes = destino.mod[k] || 0;
      destino.mod[k] = U.clamp(antes + d, -6, 6);
      var rotulos = { atk: 'Ataque', def: 'Defesa', atkEsp: 'Atq. Especial', defEsp: 'Def. Especial', vel: 'Velocidade', prec: 'Precisão', esq: 'Esquiva', critF: 'foco' };
      if (destino.mod[k] === antes) {
        msg(fila, nomeDest + ': ' + rotulos[k] + ' não pode ' + (d > 0 ? 'subir' : 'cair') + ' mais.');
      } else if (k === 'critF') {
        msg(fila, nomeDest + ' afiou os sentidos!');
      } else {
        msg(fila, nomeDest + ': ' + rotulos[k] + (d > 0 ? (Math.abs(d) > 1 ? ' subiu muito!' : ' subiu!') : (Math.abs(d) > 1 ? ' caiu muito!' : ' caiu!')));
      }
      fila.push({ t: 'mod', lado: destino === b.aliado ? 'aliado' : 'inimigo' });
    }
  }

  function aplicarStatus(fila, b, alvoLado, status, chance) {
    if (Math.random() > (chance === undefined ? 1 : chance)) return false;
    if (alvoLado.c.status) return false;
    var esp = G.especie(alvoLado.c.esp);
    /* imunidades temáticas */
    if (status === 'queimadura' && esp.tipos.indexOf('brasa') >= 0) return false;
    if (status === 'congelamento' && esp.tipos.indexOf('gelido') >= 0) return false;
    if (status === 'veneno' && (esp.tipos.indexOf('toxina') >= 0 || esp.tipos.indexOf('ferro') >= 0)) return false;
    if (status === 'paralisia' && esp.tipos.indexOf('fulgor') >= 0) return false;

    alvoLado.c.status = status;
    alvoLado.c.statusTurnos = status === 'sono' ? U.randInt(1, 3) : 0;
    var nome = alvoLado === b.aliado ? B.nomeLado(b, 'aliado') : B.nomeLado(b, 'inimigo');
    var frases = {
      queimadura: ' se queimou!',
      veneno: ' foi envenenado!',
      paralisia: ' ficou paralisado!',
      congelamento: ' congelou por completo!',
      sono: ' caiu no sono!'
    };
    msg(fila, nome + frases[status]);
    fila.push({ t: 'status', lado: alvoLado === b.aliado ? 'aliado' : 'inimigo', status: status });
    return true;
  }

  function causarDano(fila, b, alvoLado, dano) {
    dano = Math.max(0, Math.floor(dano));
    alvoLado.c.hpAtual = Math.max(0, alvoLado.c.hpAtual - dano);
    fila.push({ t: 'dano', lado: alvoLado === b.aliado ? 'aliado' : 'inimigo', valor: dano });
    return dano;
  }

  /* Executa uma técnica. Devolve o dano causado. */
  function usarTecnica(fila, b, atacanteLado, defensorLado, tecId) {
    var tec = G.tecnica(tecId);
    var nomeA = atacanteLado === b.aliado ? B.nomeLado(b, 'aliado') : B.nomeLado(b, 'inimigo');
    var ladoA = atacanteLado === b.aliado ? 'aliado' : 'inimigo';
    var ladoD = defensorLado === b.aliado ? 'aliado' : 'inimigo';

    msg(fila, nomeA + ' usou ' + tec.nome + '!');
    fila.push({ t: 'ataque', lado: ladoA, tecnica: tecId, cat: tec.cat });

    /* precisão */
    if (tec.prec !== null) {
      var precisao = tec.prec *
        multEstagio(atacanteLado.mod.prec || 0, true) /
        multEstagio(defensorLado.mod.esq || 0, true);
      if (Math.random() * 100 > precisao) {
        msg(fila, 'O golpe passou longe!');
        fila.push({ t: 'errou', lado: ladoD });
        return 0;
      }
    }

    var esp = G.especie(atacanteLado.c.esp);
    var espD = G.especie(defensorLado.c.esp);
    var totalDano = 0;

    if (tec.cat === 'apoio') {
      if (tec.ef && tec.ef.cura) {
        var max = C.atributos(atacanteLado.c).hp;
        if (atacanteLado.c.hpAtual >= max) {
          msg(fila, nomeA + ' já está em plena forma.');
        } else {
          var cur = C.curar(atacanteLado.c, Math.floor(max * tec.ef.cura));
          msg(fila, nomeA + ' recuperou ' + cur + ' de vigor.');
          fila.push({ t: 'cura', lado: ladoA, valor: cur });
        }
      }
      if (tec.ef && tec.ef.st) {
        var ok = aplicarStatus(fila, b, defensorLado, tec.ef.st.s, tec.ef.st.c);
        if (!ok && !(tec.ef && tec.ef.mod)) msg(fila, 'Mas não surtiu efeito.');
      }
      aplicarModificadores(fila, b, atacanteLado, defensorLado, tec.ef);
      return 0;
    }

    /* efetividade */
    var mult = G.multiplicadorTipo(tec.tipo, espD.tipos);
    if (mult === 0) {
      msg(fila, 'Não teve efeito algum em ' + C.nome(defensorLado.c) + '...');
      return 0;
    }

    var golpes = 1;
    if (tec.ef && tec.ef.multi) golpes = U.randInt(tec.ef.multi[0], tec.ef.multi[1]);

    var fisico = tec.cat === 'fisico';
    var A = atrib(atacanteLado, fisico ? 'atk' : 'atkEsp');
    var D = atrib(defensorLado, fisico ? 'def' : 'defEsp');
    var modsA = C.modsCuidado(atacanteLado.c);
    var nivel = atacanteLado.c.nivel;
    var stab = esp.tipos.indexOf(tec.tipo) >= 0 ? 1.5 : 1;

    var critChance = 1 / 16 + (modsA.crit || 0) + (tec.ef && tec.ef.crit ? tec.ef.crit * 0.10 : 0) +
                     (atacanteLado.mod.critF ? atacanteLado.mod.critF * 0.10 : 0);
    critChance = U.clamp(critChance, 0.02, 0.55);

    var g, houveCrit = false;
    for (g = 0; g < golpes; g++) {
      if (defensorLado.c.hpAtual <= 0) break;
      var crit = Math.random() < critChance;
      if (crit) houveCrit = true;
      var base = Math.floor(Math.floor(Math.floor(2 * nivel / 5 + 2) * tec.pot * A / D) / 50) + 2;
      var d = base * stab * mult * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15) * modsA.dano;
      if (fisico && atacanteLado.c.status === 'queimadura') d *= 0.5;
      totalDano += causarDano(fila, b, defensorLado, d);
    }

    if (golpes > 1) msg(fila, 'Acertou ' + golpes + ' vez(es)!');
    if (houveCrit) msg(fila, 'Golpe crítico!');
    var texto = G.textoEfetividade(mult);
    if (texto) msg(fila, texto);

    /* efeitos pós-dano */
    if (tec.ef && totalDano > 0) {
      if (tec.ef.dreno) {
        var cura = Math.max(1, Math.floor(totalDano * tec.ef.dreno));
        var real = C.curar(atacanteLado.c, cura);
        if (real > 0) {
          msg(fila, nomeA + ' absorveu ' + real + ' de vigor.');
          fila.push({ t: 'cura', lado: ladoA, valor: real });
        }
      }
      if (tec.ef.recuo) {
        var rec = Math.max(1, Math.floor(totalDano * tec.ef.recuo));
        causarDano(fila, b, atacanteLado, rec);
        msg(fila, nomeA + ' sofreu ' + rec + ' de recuo.');
      }
      if (tec.ef.st) aplicarStatus(fila, b, defensorLado, tec.ef.st.s, tec.ef.st.c);
      if (tec.ef.atordoar && Math.random() < tec.ef.atordoar && defensorLado.c.hpAtual > 0) {
        defensorLado.atordoado = true;
      }
      aplicarModificadores(fila, b, atacanteLado, defensorLado, tec.ef);
    }
    return totalDano;
  }

  /* Impedimentos antes de agir (sono, gelo, paralisia, atordoamento) */
  function podeAgir(fila, b, lado) {
    var c = lado.c;
    var nome = lado === b.aliado ? B.nomeLado(b, 'aliado') : B.nomeLado(b, 'inimigo');
    if (lado.atordoado) {
      lado.atordoado = false;
      msg(fila, nome + ' recuou e perdeu a ação!');
      return false;
    }
    if (c.status === 'sono') {
      if (c.statusTurnos > 0) {
        c.statusTurnos--;
        msg(fila, nome + ' está dormindo profundamente.');
        return false;
      }
      c.status = null;
      msg(fila, nome + ' acordou!');
      fila.push({ t: 'status', lado: lado === b.aliado ? 'aliado' : 'inimigo', status: null });
    }
    if (c.status === 'congelamento') {
      if (Math.random() < 0.25) {
        c.status = null;
        msg(fila, nome + ' quebrou o gelo!');
        fila.push({ t: 'status', lado: lado === b.aliado ? 'aliado' : 'inimigo', status: null });
      } else {
        msg(fila, nome + ' está preso no gelo!');
        return false;
      }
    }
    if (c.status === 'paralisia' && Math.random() < 0.25) {
      msg(fila, nome + ' travou de paralisia!');
      return false;
    }
    return true;
  }

  /* Dano de fim de turno */
  function fimDeTurno(fila, b, lado) {
    var c = lado.c;
    if (c.hpAtual <= 0) return;
    var nome = lado === b.aliado ? B.nomeLado(b, 'aliado') : B.nomeLado(b, 'inimigo');
    var max = C.atributos(c).hp;
    if (c.status === 'queimadura') {
      var d = Math.max(1, Math.floor(max / 16));
      causarDano(fila, b, lado, d);
      msg(fila, nome + ' sofre com a queimadura.');
    } else if (c.status === 'veneno') {
      c.statusTurnos = (c.statusTurnos || 0) + 1;
      var dv = Math.max(1, Math.floor(max * (0.0625 + 0.0313 * Math.min(c.statusTurnos, 4))));
      causarDano(fila, b, lado, dv);
      msg(fila, nome + ' sofre com o veneno.');
    }
    /* combate cansa */
    c.energia = U.clamp(c.energia - 1.1, 0, 100);
  }

  /* --------------------------- IA do inimigo -------------------------- */
  function escolhaIA(b) {
    var eu = b.inimigo, alvo = b.aliado;
    var disponiveis = eu.c.tecnicas.filter(function (t) { return t.pp > 0; });
    if (!disponiveis.length) return null;
    var espAlvo = G.especie(alvo.c.esp);
    var espEu = G.especie(eu.c.esp);
    var melhor = null, melhorNota = -1;

    disponiveis.forEach(function (t) {
      var tec = G.tecnica(t.id);
      var nota;
      if (tec.cat === 'apoio') {
        nota = 12 + Math.random() * 18;
        if (tec.ef && tec.ef.cura && C.fracaoHP(eu.c) < 0.4) nota += 55;
        if (tec.ef && tec.ef.st && alvo.c.status) nota = 2;
      } else {
        var mult = G.multiplicadorTipo(tec.tipo, espAlvo.tipos);
        var stab = espEu.tipos.indexOf(tec.tipo) >= 0 ? 1.5 : 1;
        nota = tec.pot * mult * stab * (tec.prec === null ? 1 : tec.prec / 100);
        nota *= 0.85 + Math.random() * 0.3;
      }
      if (nota > melhorNota) { melhorNota = nota; melhor = t; }
    });
    return melhor;
  }

  /* ---------------------------- captura ------------------------------- */
  B.chanceCaptura = function (b, itemId) {
    var item = G.item(itemId);
    var alvo = b.inimigo.c;
    var esp = G.especie(alvo.esp);
    var max = C.atributos(alvo).hp;
    var taxa = item.taxa || 1;
    if (item.bonusTipo) {
      for (var i = 0; i < item.bonusTipo.length; i++) {
        if (esp.tipos.indexOf(item.bonusTipo[i]) >= 0) { taxa = item.bonusMult; break; }
      }
    }
    var bStatus = 1;
    if (alvo.status === 'sono' || alvo.status === 'congelamento') bStatus = 2.5;
    else if (alvo.status) bStatus = 1.5;

    var a = ((3 * max - 2 * alvo.hpAtual) * esp.cap * taxa * bStatus) / (3 * max);
    /* níveis altos resistem um pouco mais */
    a *= U.clamp(1.15 - alvo.nivel * 0.006, 0.55, 1.1);
    a = U.clamp(a, 1, 255);
    var p = Math.pow(a / 255, 0.25);
    return { a: a, porTremor: p, total: Math.pow(p, 4) };
  };

  B.tentarCaptura = function (b, itemId) {
    var fila = [];
    var item = G.item(itemId);
    if (!b.selvagem) {
      msg(fila, 'Não se sela o Ânimo de outro vinculista!');
      return fila;
    }
    b.mochila[itemId] = Math.max(0, (b.mochila[itemId] || 0) - 1);
    b.seloUsado++;
    msg(fila, 'Você arremessou um ' + item.nome + '!');
    fila.push({ t: 'selo_lancado', item: itemId });

    var ch = B.chanceCaptura(b, itemId);
    var tremores = 0, i;
    for (i = 0; i < 4; i++) {
      if (Math.random() < ch.porTremor) tremores++;
      else break;
    }
    fila.push({ t: 'tremores', n: Math.min(tremores, 3) });

    if (tremores >= 4) {
      b.capturado = b.inimigo.c;
      b.acabou = true;
      b.resultado = 'captura';
      msg(fila, C.nome(b.inimigo.c) + ' aceitou o vínculo!');
      fila.push({ t: 'capturado' });
      fila.push({ t: 'fim', resultado: 'captura' });
    } else {
      var frases = [
        'O selo nem chegou a fechar!',
        'Quase! O selo balançou uma vez.',
        'Faltou tão pouco...',
        'Ah! Escapou bem no fim!'
      ];
      msg(fila, frases[Math.min(tremores, 3)]);
      fila.push({ t: 'escapou' });
      /* o inimigo age em seguida */
      turnoInimigo(fila, b);
    }
    return fila;
  };

  /* ---------------------------- ações --------------------------------- */
  function turnoInimigo(fila, b) {
    if (b.acabou) return;
    if (b.inimigo.c.hpAtual <= 0 || b.aliado.c.hpAtual <= 0) { checarFim(fila, b); return; }
    b.inimigo.turnos++;
    if (podeAgir(fila, b, b.inimigo)) {
      var esc = escolhaIA(b);
      if (esc) {
        esc.pp--;
        usarTecnica(fila, b, b.inimigo, b.aliado, esc.id);
      } else {
        msg(fila, B.nomeLado(b, 'inimigo') + ' está sem forças para atacar.');
      }
    }
    fimDeTurno(fila, b, b.inimigo);
    fimDeTurno(fila, b, b.aliado);
    checarFim(fila, b);
  }

  function checarFim(fila, b) {
    if (b.acabou) return;
    if (b.inimigo.c.hpAtual <= 0) {
      msg(fila, B.nomeLado(b, 'inimigo') + ' foi derrotado!');
      fila.push({ t: 'desmaio', lado: 'inimigo' });
      b.acabou = true;
      b.resultado = 'vitoria';
      var esp = G.especie(b.inimigo.c.esp);
      var xp = Math.max(1, Math.floor(esp.xpB * b.inimigo.c.nivel / 7));
      fila.push({ t: 'ganhar_xp', xp: xp });
      fila.push({ t: 'fim', resultado: 'vitoria' });
      return;
    }
    if (b.aliado.c.hpAtual <= 0) {
      msg(fila, B.nomeLado(b, 'aliado') + ' não consegue continuar!');
      fila.push({ t: 'desmaio', lado: 'aliado' });
      b.aliado.c.vinculo = U.clamp(b.aliado.c.vinculo - 3, 0, 100);
      var vivos = b.equipe.filter(function (c) { return c.hpAtual > 0; });
      if (vivos.length === 0) {
        b.acabou = true;
        b.resultado = 'derrota';
        fila.push({ t: 'fim', resultado: 'derrota' });
      } else {
        fila.push({ t: 'troca_forcada' });
      }
    }
  }

  /* Ação do jogador. acao = {tipo, ...} */
  B.acaoJogador = function (b, acao) {
    var fila = [];
    if (b.acabou) return fila;

    /* ações que não consomem prioridade de velocidade */
    if (acao.tipo === 'fugir') {
      b.tentativasFuga++;
      var va = velocidadeEfetiva(b.aliado), vi = velocidadeEfetiva(b.inimigo);
      var chance = U.clamp(0.32 + 0.30 * (va / vi - 1) + 0.14 * b.tentativasFuga, 0.15, 0.95);
      if (!b.selvagem) {
        msg(fila, 'Não dá para fugir de um duelo!');
        return fila;
      }
      if (Math.random() < chance) {
        msg(fila, 'Você escapou em segurança!');
        b.acabou = true;
        b.resultado = 'fuga';
        fila.push({ t: 'fim', resultado: 'fuga' });
      } else {
        msg(fila, 'Não deu para escapar!');
        turnoInimigo(fila, b);
      }
      return fila;
    }

    if (acao.tipo === 'selo') {
      return B.tentarCaptura(b, acao.item);
    }

    if (acao.tipo === 'item') {
      var item = G.item(acao.item);
      var alvo = acao.alvo ? buscarNaEquipe(b, acao.alvo) : b.aliado.c;
      if (!item || !alvo) return fila;
      b.mochila[acao.item] = Math.max(0, (b.mochila[acao.item] || 0) - 1);
      msg(fila, 'Você usou ' + item.nome + '.');
      if (item.cura) {
        var q = C.curar(alvo, item.cura);
        msg(fila, C.nome(alvo) + ' recuperou ' + q + ' de vigor.');
        if (alvo === b.aliado.c) fila.push({ t: 'cura', lado: 'aliado', valor: q });
      }
      if (item.curaStatus && alvo.status) {
        if (item.curaStatus === 'todos' || item.curaStatus === alvo.status) {
          alvo.status = null; alvo.statusTurnos = 0;
          msg(fila, C.nome(alvo) + ' se livrou da condição adversa.');
          if (alvo === b.aliado.c) fila.push({ t: 'status', lado: 'aliado', status: null });
        }
      }
      if (item.reviver && alvo.hpAtual <= 0) {
        alvo.hpAtual = Math.max(1, Math.floor(C.atributos(alvo).hp * item.reviver));
        msg(fila, C.nome(alvo) + ' voltou a si!');
      }
      turnoInimigo(fila, b);
      return fila;
    }

    if (acao.tipo === 'trocar') {
      var novo = buscarNaEquipe(b, acao.uid);
      if (!novo || novo.hpAtual <= 0 || novo === b.aliado.c) return fila;
      msg(fila, 'Volte, ' + C.nome(b.aliado.c) + '!');
      b.aliado = novoLado(novo);
      msg(fila, 'Vá, ' + C.nome(novo) + '!');
      fila.push({ t: 'troca', lado: 'aliado', uid: novo.uid });
      if (!acao.forcada) turnoInimigo(fila, b);
      return fila;
    }

    /* técnica: resolve ordem por prioridade/velocidade */
    if (acao.tipo === 'tecnica') {
      var slot = b.aliado.c.tecnicas[acao.indice];
      if (!slot || slot.pp <= 0) {
        msg(fila, 'Sem usos restantes nessa técnica.');
        return fila;
      }
      var tecA = G.tecnica(slot.id);
      var escolhaIn = escolhaIA(b);
      var tecI = escolhaIn ? G.tecnica(escolhaIn.id) : null;

      var prioA = tecA.pri || 0, prioI = tecI ? (tecI.pri || 0) : 0;
      var aliadoPrimeiro;
      if (prioA !== prioI) aliadoPrimeiro = prioA > prioI;
      else {
        var va2 = velocidadeEfetiva(b.aliado), vi2 = velocidadeEfetiva(b.inimigo);
        aliadoPrimeiro = va2 === vi2 ? Math.random() < 0.5 : va2 > vi2;
      }

      b.turno++;
      function agirAliado() {
        if (b.acabou || b.aliado.c.hpAtual <= 0) return;
        if (podeAgir(fila, b, b.aliado)) {
          slot.pp--;
          usarTecnica(fila, b, b.aliado, b.inimigo, slot.id);
        }
      }
      function agirInimigo() {
        if (b.acabou || b.inimigo.c.hpAtual <= 0 || b.aliado.c.hpAtual <= 0) return;
        if (podeAgir(fila, b, b.inimigo)) {
          if (escolhaIn) {
            escolhaIn.pp--;
            usarTecnica(fila, b, b.inimigo, b.aliado, escolhaIn.id);
          } else {
            msg(fila, B.nomeLado(b, 'inimigo') + ' está sem forças para atacar.');
          }
        }
      }

      if (aliadoPrimeiro) { agirAliado(); agirInimigo(); }
      else { agirInimigo(); agirAliado(); }

      if (!b.acabou) {
        fimDeTurno(fila, b, aliadoPrimeiro ? b.aliado : b.inimigo);
        fimDeTurno(fila, b, aliadoPrimeiro ? b.inimigo : b.aliado);
      }
      checarFim(fila, b);
      return fila;
    }

    return fila;
  };

  function buscarNaEquipe(b, uid) {
    for (var i = 0; i < b.equipe.length; i++) if (b.equipe[i].uid === uid) return b.equipe[i];
    return null;
  }

  /* Previsão de efetividade mostrada na interface */
  B.previsao = function (b, tecId) {
    var tec = G.tecnica(tecId);
    if (!tec || tec.cat === 'apoio') return { mult: 1, rotulo: '' };
    var m = G.multiplicadorTipo(tec.tipo, G.especie(b.inimigo.c.esp).tipos);
    var rot = '';
    if (m === 0) rot = 'Sem efeito';
    else if (m >= 2) rot = 'Muito eficaz';
    else if (m < 1) rot = 'Pouco eficaz';
    return { mult: m, rotulo: rot };
  };

  B.velocidadeEfetiva = velocidadeEfetiva;
  B.atributoEfetivo = atrib;

})(window.ANIMOS);
