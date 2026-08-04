/* =========================================================================
   ui/batalha.js — Cena de combate, menus e reprodução dos eventos
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var E = G.Estado;
  var C = G.Criatura;
  var B = G.Batalha;
  var UI = G.UI;
  var A = G.Arte;

  var UB = G.UIBatalha = {};

  var raiz, cv, ctx, elLog, elMenu;
  var b = null, ativo = false, aoTerminar = null;
  var larg = 0, alt = 0, dpr = 1, tempo = 0, loopId = null;
  var fila = [], processando = false, esperandoToque = false;
  var menuEstado = 'raiz';
  var pendentes = { evolucoes: [], tecnicas: [] };
  var selo = { ativo: false, prog: 0, tremores: 0, fase: '' };

  var atores = {
    aliado: { dx: 0, dy: 0, esc: 1, alpha: 1, tremor: 0, flash: 0, entrada: 0 },
    inimigo: { dx: 0, dy: 0, esc: 1, alpha: 1, tremor: 0, flash: 0, entrada: 0 }
  };

  /* O motor aplica TODO o dano do turno de uma vez, ao montar a fila de
     eventos. Se a barra lesse hpAtual direto do modelo, ela já mostraria o
     resultado final antes de a animação tocar — inclusive o dano que o
     adversário ainda vai causar. Por isso a barra tem um valor próprio:
     `alvo` avança só quando o evento de dano é reproduzido, e `vis` corre
     atrás dele suavemente no laço de animação. */
  var hpBarra = {
    aliado:  { vis: 0, alvo: 0, max: 1 },
    inimigo: { vis: 0, alvo: 0, max: 1 }
  };

  /* Sincroniza a barra com o modelo — início de batalha, troca, cura fora
     de turno. Sem transição: aqui o valor É o do modelo. */
  function sincronizarHP(lado, imediato) {
    var l = b && (lado === 'aliado' ? b.aliado : b.inimigo);
    var c = l && l.c;
    if (!c) return;               /* batalha ainda montando: nada a sincronizar */
    var h = hpBarra[lado];
    h.max = C.atributos(c).hp;
    h.alvo = c.hpAtual;
    if (imediato) h.vis = c.hpAtual;
  }

  function sincronizarTudo(imediato) {
    if (!b) return;
    sincronizarHP('aliado', imediato);
    sincronizarHP('inimigo', imediato);
  }

  UB.ativa = function () { return ativo; };

  /* ==================================================================== */
  UB.iniciar = function (cfg) {
    raiz = G.el('#batalha');
    cv = G.el('#canvas-batalha');
    ctx = cv.getContext('2d');
    elLog = G.el('#bt-log');
    elMenu = G.el('#bt-menu');
    /* O menu é remontado por vários caminhos (raiz, técnicas, itens, troca).
       Observar o container cobre todos eles sem depender de cada um lembrar
       de reposicionar a seleção. */
    if (G.Nav && !elMenu._observado) {
      elMenu._observado = true;
      new MutationObserver(function () {
        if (ativo && !processando) G.Nav.revalidar(elMenu);
      }).observe(elMenu, { childList: true, subtree: true });
    }

    var aliado = E.primeiroApto();
    if (!aliado) { UI.toast('Nenhum Ânimo consegue lutar.', 'aviso'); return; }

    b = B.criar({
      aliado: aliado,
      inimigo: cfg.criatura,
      selvagem: true,
      local: cfg.local,
      equipe: E.s.equipe,
      mochila: E.s.mochila
    });

    aoTerminar = cfg.aoTerminar || null;
    ativo = true;
    sincronizarTudo(true);   /* a barra parte do valor real do modelo */
    pendentes = { evolucoes: [], tecnicas: [] };
    selo = { ativo: false, prog: 0, tremores: 0, fase: '' };
    atores.aliado = { dx: 0, dy: 0, esc: 1, alpha: 1, tremor: 0, flash: 0, entrada: 0 };
    atores.inimigo = { dx: 0, dy: 0, esc: 1, alpha: 1, tremor: 0, flash: 0, entrada: 0 };

    var novo = E.registrarVisto(cfg.criatura.esp);

    raiz.classList.remove('oculto');
    G.Mundo.pausar();
    redimensionar();
    window.addEventListener('resize', redimensionar);
    if (!loopId) loopId = requestAnimationFrame(quadro);

    atualizarPlacas();
    menuEstado = 'raiz';
    elMenu.innerHTML = '';

    var frase = 'Um ' + C.nome(b.inimigo.c) + ' selvagem apareceu!';
    if (cfg.criatura.prismatico) frase = 'Impossível! Um ' + C.nome(b.inimigo.c) + ' PRISMÁTICO apareceu!';
    else if (novo) frase = 'Um Ânimo desconhecido! ' + C.nome(b.inimigo.c) + ' apareceu!';

    reproduzir([
      { t: 'msg', texto: frase },
      { t: 'msg', texto: 'Vá, ' + C.nome(b.aliado.c) + '!' }
    ], mostrarMenuRaiz);

    E.autoSalvar();
  };

  function redimensionar() {
    if (!cv) return;
    var cena = G.el('#bt-cena');
    var r = cena.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    larg = Math.max(1, r.width);
    alt = Math.max(1, r.height);
    cv.width = Math.round(larg * dpr);
    cv.height = Math.round(alt * dpr);
  }

  /* ==================================================================== */
  /*  CENA                                                                */
  /* ==================================================================== */
  function paletaCena() {
    var amb = (G.Mundo.mapaAtual() || {}).ambiente || 'campo';
    var mapa = {
      vila: ['#2b3d5e', '#4d6f6a', '#3d5c46'],
      campo: ['#2e4a6e', '#5a8069', '#3f6247'],
      floresta: ['#1e3327', '#2f5238', '#24402c'],
      lago: ['#26496e', '#3f7fa5', '#2f5f74'],
      montanha: ['#3a3550', '#5a5064', '#413b52'],
      ruinas: ['#241a3d', '#40305e', '#2c2148']
    };
    return mapa[amb] || mapa.campo;
  }

  /* A área útil da cena vai de 0 até ~64% da altura: abaixo disso fica o
     painel de log/menu. Tudo é posicionado dentro dessa faixa. */
  function desenharCena() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var pal = paletaCena();
    var linhaHorizonte = alt * 0.30;

    var g = ctx.createLinearGradient(0, 0, 0, linhaHorizonte);
    g.addColorStop(0, pal[0]);
    g.addColorStop(1, pal[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, larg, linhaHorizonte);

    /* brumas altas — suaves, só para dar profundidade ao céu */
    ctx.save();
    for (var i = 0; i < 5; i++) {
      var bx = (larg * (0.1 + i * 0.21) + Math.sin(tempo / 6400 + i * 1.7) * 26);
      var by = linhaHorizonte * (0.22 + ((i * 7) % 3) * 0.2);
      var rx = larg * (0.10 + (i % 3) * 0.04);
      var ry = linhaHorizonte * 0.075;
      var gb = ctx.createRadialGradient(bx, by, 1, bx, by, rx);
      gb.addColorStop(0, 'rgba(255,255,255,0.13)');
      gb.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gb;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, ry / rx);
      ctx.translate(-bx, -by);
      ctx.fillRect(bx - rx, by - rx, rx * 2, rx * 2);
      ctx.restore();
    }
    ctx.restore();

    var g2 = ctx.createLinearGradient(0, linhaHorizonte, 0, alt);
    g2.addColorStop(0, pal[2]);
    g2.addColorStop(1, '#141024');
    ctx.fillStyle = g2;
    ctx.fillRect(0, linhaHorizonte, larg, alt - linhaHorizonte);

    /* Plataformas e criaturas ancoradas pelos PÉS (não pelo centro), para
       nunca serem cortadas independentemente da proporção da tela. */
    var pos = posicoes();
    plataforma(pos.inimigo.x, pos.inimigo.chao, larg * 0.24, alt * 0.045, pal[2]);
    plataforma(pos.aliado.x, pos.aliado.chao, larg * 0.30, alt * 0.055, pal[2]);

    if (b) {
      desenharAtor('inimigo', b.inimigo.c, pos.inimigo.x, pos.inimigo.cy, pos.inimigo.tam, true);
      desenharAtor('aliado', b.aliado.c, pos.aliado.x, pos.aliado.cy, pos.aliado.tam, false);
    }

    if (selo.ativo) desenharSelo();

    /* vinheta */
    var v = ctx.createRadialGradient(larg / 2, alt * 0.4, Math.min(larg, alt) * 0.3,
                                     larg / 2, alt * 0.4, Math.max(larg, alt) * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(5,4,12,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, larg, alt);
  }

  /* No canvas da criatura os pés ficam a 96% da caixa; como o desenho é
     centrado, o deslocamento do centro até o chão é 0,46 × tamanho. */
  var PE = 0.46;

  function posicoes() {
    var tamI = Math.min(alt * 0.34, larg * 0.30);
    var tamA = Math.min(alt * 0.40, larg * 0.36);
    var chaoI = alt * 0.46;
    var chaoA = alt * 0.965;
    return {
      inimigo: { x: larg * 0.70, chao: chaoI, tam: tamI, cy: chaoI - PE * tamI },
      aliado: { x: larg * 0.28, chao: chaoA, tam: tamA, cy: chaoA - PE * tamA }
    };
  }

  function plataforma(cx, cy, rx, ry, cor) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.3);
    var g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function desenharAtor(lado, criatura, cx, cy, tam, virado) {
    var a = atores[lado];
    if (a.alpha <= 0.01) return;
    var bob = Math.sin(tempo / 720 + (lado === 'aliado' ? 0 : 1.6)) * tam * 0.018;
    var tremorX = a.tremor > 0 ? (Math.random() - 0.5) * a.tremor * 14 : 0;
    var entrada = 1 - U.clamp(a.entrada, 0, 1);

    ctx.save();
    ctx.globalAlpha = a.alpha;
    /* sombra no chão */
    ctx.beginPath();
    ctx.ellipse(cx + a.dx, cy + PE * tam, tam * 0.26 * a.esc, tam * 0.058 * a.esc, 0, 0, 6.3);
    ctx.fillStyle = 'rgba(8,6,16,0.34)';
    ctx.fill();

    var px = cx + a.dx + tremorX + (virado ? entrada * 140 : -entrada * 140);
    var py = cy + a.dy + bob;

    A.desenhar(ctx, criatura.esp, G.variacaoDe(criatura), px, py, tam * a.esc, { virado: virado });

    if (a.flash > 0) {
      ctx.globalAlpha = a.flash * a.alpha * 0.75;
      A.desenhar(ctx, criatura.esp, G.variacaoDe(criatura), px, py, tam * a.esc,
        { virado: virado, silhueta: '#ffffff' });
    }
    ctx.restore();
  }

  function desenharSelo() {
    var pos = posicoes();
    var alvoX = pos.inimigo.x, alvoY = pos.inimigo.cy;
    var origemX = larg * 0.10, origemY = pos.aliado.cy;
    var t = U.clamp(selo.prog, 0, 1);
    var x, y, r = Math.min(larg, alt) * 0.045;

    if (selo.fase === 'voo') {
      x = U.lerp(origemX, alvoX, t);
      y = U.lerp(origemY, alvoY, t) - Math.sin(t * Math.PI) * alt * 0.22;
    } else {
      x = alvoX;
      y = alvoY + Math.min(alt * 0.05, 26);
      if (selo.fase === 'tremor') {
        x += Math.sin(selo.prog * 22) * 12 * Math.max(0, 1 - selo.prog / 3);
      }
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(selo.fase === 'voo' ? t * 9 : Math.sin(selo.prog * 22) * 0.24);
    ctx.shadowColor = 'rgba(255,200,110,0.55)';
    ctx.shadowBlur = r * 0.7;
    A.desenharSigilo(ctx, r, [38, 82, 58], [30, 60, 40], null);
    ctx.restore();
  }

  function quadro(t) {
    var dt = Math.min(50, t - (tempo || t));
    tempo = t;
    if (ativo) {
      atualizarAnim(dt);
      desenharCena();
    }
    loopId = requestAnimationFrame(quadro);
  }

  function atualizarAnim(dt) {
    ['aliado', 'inimigo'].forEach(function (k) {
      var a = atores[k];
      a.dx *= 0.86; a.dy *= 0.86;
      if (Math.abs(a.dx) < 0.3) a.dx = 0;
      if (Math.abs(a.dy) < 0.3) a.dy = 0;
      a.tremor = Math.max(0, a.tremor - dt / 260);
      a.flash = Math.max(0, a.flash - dt / 210);
      a.entrada = Math.min(1, a.entrada + dt / 300);
    });
    if (selo.ativo) {
      selo.prog += dt / (selo.fase === 'voo' ? 620 : 900);
    }

    /* A barra desce/sobe suave até o alvo. A velocidade é proporcional ao
       máximo para que um golpe pesado não leve o mesmo tempo que um arranhão. */
    var mudou = false;
    ['aliado', 'inimigo'].forEach(function (k) {
      var h = hpBarra[k];
      if (Math.abs(h.vis - h.alvo) < 0.05) {
        if (h.vis !== h.alvo) { h.vis = h.alvo; mudou = true; }
        return;
      }
      var vel = Math.max(h.max * 0.9, 14) * (dt / 1000);
      h.vis += U.clamp(h.alvo - h.vis, -vel, vel);
      mudou = true;
    });
    if (mudou) atualizarPlacas();
  }

  /* ==================================================================== */
  /*  PLACAS                                                              */
  /* ==================================================================== */
  function atualizarPlacas() {
    if (!b) return;
    var ai = b.inimigo.c, aa = b.aliado.c;
    var atI = C.atributos(ai), atA = C.atributos(aa);

    G.el('#bti-nome').textContent = C.nome(ai) + (ai.prismatico ? ' ✦' : '');
    G.el('#bti-nivel').textContent = 'Nv ' + ai.nivel;
    barra('#bti-barra', hpBarra.inimigo.vis / Math.max(1, hpBarra.inimigo.max));
    tags('#bti-tags', ai);

    G.el('#bta-nome').textContent = C.nome(aa);
    G.el('#bta-nivel').textContent = 'Nv ' + aa.nivel;
    barra('#bta-barra', hpBarra.aliado.vis / Math.max(1, hpBarra.aliado.max));
    G.el('#bta-hp').textContent = Math.ceil(Math.max(0, hpBarra.aliado.vis)) + ' / ' + atA.hp;
    G.el('#bta-xp').style.width = (C.progressoNivel(aa) * 100).toFixed(1) + '%';
    tags('#bta-tags', aa);

    void atI;
    UI.atualizarFilaEquipe();
  }

  function barra(sel, frac) {
    var i = G.el(sel);
    i.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
    var pai = i.parentNode;
    pai.classList.remove('medio', 'baixo');
    var cls = UI.classeBarra(frac);
    if (cls) pai.classList.add(cls);
  }

  function tags(sel, c) {
    var el = G.el(sel);
    el.innerHTML = '';
    if (c.status) {
      var s = G.criar('span', 'tag tag-status', G.CONDICOES[c.status].sigla);
      s.style.background = G.CONDICOES[c.status].cor;
      s.style.color = '#1a1220';
      el.appendChild(s);
    }
    if (c.prismatico) el.appendChild(G.criar('span', 'tag tag-prisma', 'PRISMA'));
  }

  /* ==================================================================== */
  /*  REPRODUÇÃO DE EVENTOS                                               */
  /* ==================================================================== */
  function reproduzir(eventos, aoFim) {
    fila = fila.concat(eventos);
    if (processando) return;
    processando = true;
    elMenu.innerHTML = '';
    proximo(aoFim);
  }

  function proximo(aoFim) {
    if (!fila.length) {
      processando = false;
      elLog.classList.remove('aguardando');
      if (aoFim) aoFim();
      return;
    }
    var ev = fila.shift();
    var espera = tratarEvento(ev);
    setTimeout(function () { proximo(aoFim); }, espera);
  }

  function tratarEvento(ev) {
    switch (ev.t) {
      case 'msg':
        elLog.textContent = ev.texto;
        elLog.classList.add('aguardando');
        return Math.min(2000, 760 + ev.texto.length * 16);

      case 'ataque': {
        var a = atores[ev.lado];
        var dir = ev.lado === 'aliado' ? 1 : -1;
        a.dx = 46 * dir;
        a.dy = -14;
        return 240;
      }

      case 'dano': {
        var alvo = atores[ev.lado];
        alvo.tremor = 1;
        alvo.flash = 1;
        /* só AQUI a barra recebe o golpe — junto com o tremor e o número */
        var hd = hpBarra[ev.lado];
        hd.alvo = Math.max(0, hd.alvo - ev.valor);
        flutuarNumero(ev.lado, '-' + ev.valor, '#ff8a6a');
        return 380;
      }

      case 'cura': {
        var hc = hpBarra[ev.lado];
        hc.alvo = Math.min(hc.max, hc.alvo + ev.valor);
        flutuarNumero(ev.lado, '+' + ev.valor, '#8ee6a4');
        return 340;
      }

      case 'errou':
        return 260;

      case 'status':
      case 'mod':
        atualizarPlacas();
        return 260;

      case 'troca':
        atores.aliado.entrada = 0;
        atores.aliado.alpha = 1;
        sincronizarTudo(true);
        atualizarPlacas();
        return 420;

      case 'desmaio': {
        var d = atores[ev.lado];
        d.alpha = 0;
        d.dy = 26;
        atualizarPlacas();
        return 620;
      }

      case 'selo_lancado':
        selo.ativo = true; selo.prog = 0; selo.fase = 'voo';
        return 640;

      case 'tremores':
        selo.fase = 'tremor'; selo.prog = 0;
        atores.inimigo.alpha = 0;
        return 500 + ev.n * 620;

      case 'capturado':
        selo.ativo = false;
        registrarCaptura();
        return 500;

      case 'escapou':
        selo.ativo = false;
        atores.inimigo.alpha = 1;
        atores.inimigo.entrada = 0.6;
        return 320;

      case 'ganhar_xp':
        return aplicarXP(ev.xp);

      case 'troca_forcada':
        setTimeout(abrirTrocaForcada, 200);
        return 260;

      case 'fim':
        setTimeout(function () { encerrar(ev.resultado); }, 260);
        return 300;

      default:
        return 120;
    }
  }

  function flutuarNumero(lado, texto, cor) {
    var pos = posicoes()[lado];
    var x = pos.x;
    var y = pos.cy - pos.tam * 0.18;
    var d = G.criar('div', 'dano-flutua', texto);
    d.style.left = (x - 18) + 'px';
    d.style.top = y + 'px';
    d.style.color = cor;
    raiz.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1050);
  }

  /* ------------------------------ XP ---------------------------------- */
  function aplicarXP(xpBase) {
    var c = b.aliado.c;
    var eventos = C.ganharXP(c, xpBase);
    var msgs = [];
    E.s.jogador.vitorias++;
    c.vinculo = U.clamp(c.vinculo + 2, 0, 100);

    eventos.forEach(function (ev) {
      if (ev.tipo === 'xp') msgs.push({ t: 'msg', texto: C.nome(c) + ' ganhou ' + ev.valor + ' de experiência!' });
      else if (ev.tipo === 'nivel') msgs.push({ t: 'msg', texto: C.nome(c) + ' alcançou o nível ' + ev.nivel + '!' });
      else if (ev.tipo === 'tecnica') msgs.push({ t: 'msg', texto: C.nome(c) + ' aprendeu ' + G.tecnica(ev.id).nome + '!' });
      else if (ev.tipo === 'tecnica_cheia') pendentes.tecnicas.push({ criatura: c, id: ev.id });
      else if (ev.tipo === 'evolucao') {
        if (!pendentes.evolucoes.some(function (p) { return p.criatura === c; })) {
          pendentes.evolucoes.push({ criatura: c });
        }
      }
    });

    /* companheiros ganham metade */
    E.s.equipe.forEach(function (o) {
      if (o === c || o.hpAtual <= 0) return;
      C.ganharXP(o, Math.floor(xpBase * 0.4));
    });

    atualizarPlacas();
    fila = msgs.concat(fila);
    return 200;
  }

  function registrarCaptura() {
    var c = b.inimigo.c;
    c.selvagem = false;
    c.vinculo = U.clamp(c.vinculo + 10, 0, 100);
    E.registrarCaptura(c.esp);
    var destino = E.adicionarCriatura(c);
    fila.unshift({
      t: 'msg',
      texto: destino === 'equipe'
        ? C.nome(c) + ' entrou na sua equipe!'
        : C.nome(c) + ' foi enviado ao Santuário (equipe cheia).'
    });
    E.autoSalvar();
  }

  /* ==================================================================== */
  /*  MENUS                                                               */
  /* ==================================================================== */
  function botao(rotulo, sub, aoClicar, extraClasse, efeito) {
    var btn = G.criar('button', 'btn ' + (extraClasse || ''));
    var box = G.criar('div', 'bt-op');
    box.appendChild(G.criar('strong', null, rotulo));
    if (sub) box.appendChild(G.criar('small', null, sub));
    if (efeito) {
      var e = G.criar('span', 'ef ' + efeito.classe, efeito.texto);
      box.appendChild(e);
    }
    btn.appendChild(box);
    btn.addEventListener('click', aoClicar);
    return btn;
  }

  function limparMenu(col1) {
    elMenu.innerHTML = '';
    elMenu.classList.toggle('col1', !!col1);
  }

  function mostrarMenuRaiz() {
    if (!ativo || processando) return;
    menuEstado = 'raiz';
    limparMenu(false);
    elLog.textContent = 'O que ' + C.nome(b.aliado.c) + ' vai fazer?';
    elLog.classList.remove('aguardando');

    elMenu.appendChild(botao('Lutar', 'Usar uma técnica', menuTecnicas, 'btn-primario'));
    elMenu.appendChild(botao('Selo', 'Tentar firmar vínculo', menuSelos));
    elMenu.appendChild(botao('Mochila', 'Curar e tratar', menuItens));
    elMenu.appendChild(botao('Trocar', 'Chamar outro Ânimo', menuTroca));
    var f = botao('Fugir', 'Sair do encontro', function () {
      executar({ tipo: 'fugir' });
    }, 'btn-fantasma bt-voltar');
    elMenu.appendChild(f);
  }

  function menuTecnicas() {
    menuEstado = 'tecnicas';
    limparMenu(false);
    elLog.textContent = 'Escolha a técnica.';
    b.aliado.c.tecnicas.forEach(function (slot, i) {
      var t = G.tecnica(slot.id);
      var prev = B.previsao(b, slot.id);
      var ef = null;
      if (prev.rotulo) {
        ef = { texto: prev.rotulo, classe: prev.mult >= 2 ? 'bom' : 'ruim' };
      }
      var sub = G.nomeTipo(t.tipo) + ' · ' +
        (t.cat === 'apoio' ? 'Apoio' : (t.cat === 'fisico' ? 'Físico' : 'Especial')) +
        ' · ' + slot.pp + '/' + slot.ppMax;
      var btn = botao(t.nome, sub, function () {
        if (slot.pp <= 0) { UI.toast('Sem usos restantes.', 'aviso'); return; }
        executar({ tipo: 'tecnica', indice: i });
      }, slot.pp <= 0 ? 'btn-fantasma' : '', ef);
      if (slot.pp <= 0) btn.style.opacity = '.5';
      btn.style.borderLeft = '4px solid ' + G.corTipo(t.tipo);
      elMenu.appendChild(btn);
    });
    for (var k = b.aliado.c.tecnicas.length; k < 4; k++) {
      var vazio = G.criar('button', 'btn btn-fantasma');
      vazio.textContent = '—';
      vazio.disabled = true;
      elMenu.appendChild(vazio);
    }
    elMenu.appendChild(voltar());
  }

  function menuSelos() {
    menuEstado = 'selos';
    limparMenu(true);
    var selos = E.selosDisponiveis();
    var temLente = E.temItem('lente_de_orva');
    if (!selos.length) {
      elLog.textContent = 'Você não tem nenhum selo na mochila.';
      elMenu.appendChild(voltar());
      return;
    }
    elLog.textContent = temLente
      ? 'A Lente de Orva estima a chance de vínculo.'
      : 'Enfraqueça o Ânimo antes de arremessar.';
    selos.forEach(function (par) {
      var sub = 'Restam ' + par.qtd;
      if (temLente) {
        var ch = B.chanceCaptura(b, par.item.id);
        sub += ' · chance ~' + Math.round(ch.total * 100) + '%';
      }
      elMenu.appendChild(botao(par.item.nome, sub, function () {
        executar({ tipo: 'selo', item: par.item.id });
      }));
    });
    elMenu.appendChild(voltar());
  }

  function menuItens() {
    menuEstado = 'itens';
    limparMenu(true);
    var lista = E.itensDaCategoria('cura');
    if (!lista.length) {
      elLog.textContent = 'Nenhum item de cura na mochila.';
      elMenu.appendChild(voltar());
      return;
    }
    elLog.textContent = 'Usar em quem?';
    lista.forEach(function (par) {
      elMenu.appendChild(botao(par.item.nome, par.item.desc + ' · Restam ' + par.qtd, function () {
        escolherAlvoItem(par.item);
      }));
    });
    elMenu.appendChild(voltar());
  }

  function escolherAlvoItem(item) {
    var ops = E.s.equipe.map(function (c) {
      var at = C.atributos(c);
      return {
        rotulo: C.nome(c) + ' — ' + Math.ceil(c.hpAtual) + '/' + at.hp + (c.status ? ' (' + G.CONDICOES[c.status].sigla + ')' : ''),
        acao: function () { executar({ tipo: 'item', item: item.id, alvo: c.uid }); }
      };
    });
    ops.push({ rotulo: 'Cancelar', classe: 'btn-fantasma' });
    UI.escolher('Usar ' + item.nome, null, ops);
  }

  function menuTroca(forcada) {
    menuEstado = 'troca';
    limparMenu(true);
    elLog.textContent = forcada === true
      ? 'Quem entra no lugar?'
      : 'Chamar qual Ânimo?';
    var algum = false;
    E.s.equipe.forEach(function (c) {
      if (c === b.aliado.c) return;
      var at = C.atributos(c);
      var apto = c.hpAtual > 0;
      if (apto) algum = true;
      var btn = botao(C.nome(c),
        'Nv ' + c.nivel + ' · ' + Math.ceil(c.hpAtual) + '/' + at.hp + (c.status ? ' · ' + G.CONDICOES[c.status].sigla : ''),
        function () {
          if (!apto) { UI.toast(C.nome(c) + ' não pode lutar.', 'aviso'); return; }
          if (forcada === true) {
            var evs = B.acaoJogador(b, { tipo: 'trocar', uid: c.uid, forcada: true });
            reproduzir(evs, mostrarMenuRaiz);
          } else {
            executar({ tipo: 'trocar', uid: c.uid });
          }
        }, apto ? '' : 'btn-fantasma');
      if (!apto) btn.style.opacity = '.5';
      elMenu.appendChild(btn);
    });
    if (!algum && forcada !== true) {
      elLog.textContent = 'Não há outro Ânimo apto para lutar.';
    }
    if (forcada !== true) elMenu.appendChild(voltar());
  }

  function abrirTrocaForcada() {
    menuTroca(true);
  }

  function voltar() {
    var v = G.criar('button', 'btn btn-fantasma bt-voltar', '← Voltar');
    v.addEventListener('click', mostrarMenuRaiz);
    return v;
  }

  function executar(acao) {
    if (processando) return;
    var evs = B.acaoJogador(b, acao);
    if (!evs.length) { mostrarMenuRaiz(); return; }
    reproduzir(evs, function () {
      if (b.acabou) return;
      mostrarMenuRaiz();
    });
  }

  /* ==================================================================== */
  /*  ENCERRAMENTO                                                        */
  /* ==================================================================== */
  function encerrar(resultado) {
    if (!ativo) return;
    ativo = false;
    if (G.Nav) G.Nav.limpar();
    limparMenu(true);

    function sair() {
      raiz.classList.add('oculto');
      window.removeEventListener('resize', redimensionar);
      G.Mundo.retomar();
      UI.atualizarHUD();
      E.autoSalvar();
      if (aoTerminar) aoTerminar(resultado);
    }

    function tratarPendencias(depois) {
      if (pendentes.evolucoes.length) {
        var p = pendentes.evolucoes.shift();
        var esp = G.especie(p.criatura.esp);
        UI.escolher('Algo está acontecendo...',
          C.nome(p.criatura) + ' está envolto em luz. Deixar que evolua para ' + G.especie(esp.evo.para).nome + '?',
          [
            {
              rotulo: 'Deixar evoluir', classe: 'btn-primario', acao: function () {
                var r = C.evoluir(p.criatura);
                E.registrarVisto(p.criatura.esp);
                E.registrarCaptura(p.criatura.esp);
                UI.toast(r.de + ' evoluiu para ' + r.para + '!', 'ambar', 3600);
                E.autoSalvar();
                tratarPendencias(depois);
              }
            },
            {
              rotulo: 'Agora não', classe: 'btn-fantasma', acao: function () {
                tratarPendencias(depois);
              }
            }
          ]);
        return;
      }
      if (pendentes.tecnicas.length) {
        var q = pendentes.tecnicas.shift();
        var nova = G.tecnica(q.id);
        var ops = q.criatura.tecnicas.map(function (slot, i) {
          return {
            rotulo: 'Esquecer ' + G.tecnica(slot.id).nome,
            acao: function () {
              C.trocarTecnica(q.criatura, i, q.id);
              UI.toast(C.nome(q.criatura) + ' aprendeu ' + nova.nome + '.', 'ok');
              E.autoSalvar();
              tratarPendencias(depois);
            }
          };
        });
        ops.push({
          rotulo: 'Não aprender', classe: 'btn-fantasma',
          acao: function () { tratarPendencias(depois); }
        });
        UI.escolher(C.nome(q.criatura) + ' quer aprender ' + nova.nome,
          'Mas já conhece 4 técnicas. Qual esquecer?', ops);
        return;
      }
      depois();
    }

    if (resultado === 'derrota') {
      elLog.textContent = 'Todos os seus Ânimos caíram...';
      var ambrasPerdidas = Math.min(E.s.jogador.ambras, Math.floor(E.s.jogador.ambras * 0.12));
      E.s.jogador.ambras -= ambrasPerdidas;
      setTimeout(function () {
        UI.escolher('Você desmaiou',
          'A Mestra Oriel encontrou você e levou todos ao Santuário de Cinzalva.' +
          (ambrasPerdidas > 0 ? '\n\nCusto do socorro: ' + ambrasPerdidas + ' Ambras.' : ''),
          [{
            rotulo: 'Acordar em Cinzalva', classe: 'btn-primario', acao: function () {
              E.curarEquipe();
              sair();
              G.Mundo.carregarMapa('cinzalva', 29, 18, 'baixo');
              UI.toast('Todos os Ânimos foram restaurados.', 'ok');
            }
          }]);
      }, 700);
      return;
    }

    if (resultado === 'captura') {
      elLog.textContent = 'Vínculo firmado!';
    } else if (resultado === 'vitoria') {
      var premio = U.randInt(40, 90) + b.inimigo.c.nivel * 8;
      E.receber(premio);
      elLog.textContent = 'Você encontrou ' + premio + ' Ambras no lugar do combate.';
    } else if (resultado === 'fuga') {
      elLog.textContent = 'Vocês se afastaram em segurança.';
    }
    setTimeout(function () { tratarPendencias(sair); }, 900);
  }

  /* ==================================================================== */
  UB.tecla = function (ev) {
    if (!ativo) return false;
    var k = ev.key.toLowerCase();

    /* Enquanto a animação do turno roda, avançar texto é o único comando. */
    if (processando) {
      if (k === 'enter' || k === ' ' || k === 'e') ev.preventDefault();
      return true;
    }

    /* Atalho numérico continua valendo para quem já decorou. */
    var botoes = G.els('button:not(:disabled)', elMenu);
    if (k >= '1' && k <= '9') {
      var i = parseInt(k, 10) - 1;
      if (botoes[i]) { ev.preventDefault(); botoes[i].click(); }
      return true;
    }

    if (k === 'escape' || k === 'backspace') {
      ev.preventDefault();
      if (menuEstado !== 'raiz') mostrarMenuRaiz();
      return true;
    }

    /* Setas e WASD movem a seleção; Enter e Espaço confirmam. */
    if (G.Nav && G.Nav.tecla(ev, elMenu)) return true;
    return true;
  };

  /* Reaponta a seleção sempre que o menu de batalha é redesenhado. */
  UB.focar = function () {
    if (G.Nav) setTimeout(function () { G.Nav.revalidar(elMenu); }, 0);
  };

})(window.ANIMOS);
