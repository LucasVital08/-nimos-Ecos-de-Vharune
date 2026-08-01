/* =========================================================================
   jogo/principal.js — Arranque, tela de título, introdução e amarração geral
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var E = G.Estado;
  var C = G.Criatura;
  var UI = G.UI;
  var T = G.Telas;

  var escolhido = null;
  var passoIntro = 0;

  /* ==================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    G.prepararMapas();
    E.carregarCfg();
    UI.iniciar();

    G.el('#versao').textContent = G.VERSION;

    telaTitulo();
    ligarBotoes();
    ligarEventos();
    ligarControles();
  });

  function mostrarTela(id) {
    G.els('.tela').forEach(function (t) { t.classList.toggle('ativa', t.id === id); });
  }

  /* ==================================================================== */
  /*  TELA DE TÍTULO                                                      */
  /* ==================================================================== */
  function telaTitulo() {
    mostrarTela('tela-titulo');
    animarFundoTitulo();

    var temSave = E.existeSave();
    var btnCont = G.el('#btn-continuar');
    btnCont.disabled = !temSave;

    var nota = G.el('#nota-save');
    if (temSave) {
      try {
        var s = JSON.parse(localStorage.getItem('crisalida.save.v1'));
        var d = new Date(s.atualizadoEm || s.criadoEm);
        nota.textContent = 'Última jornada: ' + s.jogador.nome + ' · ' +
          (s.equipe ? s.equipe.length : 0) + ' Ânimo(s) · ' + d.toLocaleString('pt-BR');
      } catch (e) {
        nota.textContent = 'Há um progresso salvo neste navegador.';
      }
    } else {
      nota.textContent = 'Nenhum progresso salvo ainda neste navegador.';
    }
  }

  var fundoAnim = null;
  function animarFundoTitulo() {
    var cv = G.el('#canvas-titulo');
    if (!cv || fundoAnim) return;
    var ctx = cv.getContext('2d');
    var w, h, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var flutuantes = [];
    var ids = G.LISTA_ESPECIES.map(function (e2) { return e2.id; });

    function medir() {
      var r = cv.parentElement.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    medir();
    window.addEventListener('resize', medir);

    for (var i = 0; i < 9; i++) {
      flutuantes.push({
        esp: U.choice(ids),
        v: { seed: Math.floor(Math.random() * 1e9), matiz: (Math.random() - 0.5) * 40, padrao: 'liso', porte: 1 },
        x: Math.random(), y: Math.random(),
        tam: 70 + Math.random() * 120,
        vel: 0.000012 + Math.random() * 0.000022,
        fase: Math.random() * 6.3,
        alpha: 0.07 + Math.random() * 0.12,
        virado: Math.random() < 0.5
      });
    }

    var particulas = [];
    for (var k = 0; k < 60; k++) {
      particulas.push({
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 2, vel: 0.00002 + Math.random() * 0.00006,
        fase: Math.random() * 6.3
      });
    }

    function quadro(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#170f2b');
      g.addColorStop(0.55, '#241539');
      g.addColorStop(1, '#0b0912');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      /* rasgo do Véu */
      ctx.save();
      ctx.globalAlpha = 0.5;
      var rg = ctx.createRadialGradient(w * 0.5, h * 0.2, 6, w * 0.5, h * 0.2, Math.max(w, h) * 0.55);
      rg.addColorStop(0, 'rgba(255,214,150,0.42)');
      rg.addColorStop(0.4, 'rgba(180,120,255,0.10)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      particulas.forEach(function (p) {
        var py = ((p.y - t * p.vel) % 1 + 1) % 1;
        var px = p.x + Math.sin(t * 0.0004 + p.fase) * 0.012;
        ctx.beginPath();
        ctx.arc(px * w, py * h, p.r, 0, 6.3);
        ctx.fillStyle = 'rgba(255,226,170,' + (0.14 + Math.sin(t * 0.001 + p.fase) * 0.10).toFixed(3) + ')';
        ctx.fill();
      });

      flutuantes.forEach(function (f) {
        var y = ((f.y - t * f.vel) % 1 + 1) % 1;
        var x = f.x + Math.sin(t * 0.00022 + f.fase) * 0.03;
        G.Arte.desenhar(ctx, f.esp, f.v, x * w, y * h, f.tam, {
          alpha: f.alpha, virado: f.virado, silhueta: 'rgba(255,220,170,1)'
        });
      });

      fundoAnim = requestAnimationFrame(quadro);
    }
    fundoAnim = requestAnimationFrame(quadro);
  }

  function pararFundoTitulo() {
    if (fundoAnim) { cancelAnimationFrame(fundoAnim); fundoAnim = null; }
  }

  /* ==================================================================== */
  /*  INTRODUÇÃO                                                          */
  /* ==================================================================== */
  function telaIntro() {
    passoIntro = 0;
    mostrarTela('tela-intro');
    atualizarIntro();
  }

  function atualizarIntro() {
    G.el('#intro-texto').textContent = G.INTRO[passoIntro] || '';
    G.el('#btn-intro-seguir').textContent = passoIntro >= G.INTRO.length - 1 ? 'Ir ao ateliê' : 'Continuar';
  }

  /* ==================================================================== */
  /*  ESCOLHA DO ÂNIMO INICIAL                                            */
  /* ==================================================================== */
  function telaEscolha() {
    mostrarTela('tela-escolha');
    var grade = G.el('#escolha-grade');
    grade.innerHTML = '';
    escolhido = null;
    G.el('#btn-comecar').disabled = true;

    G.ESCOLHA_INICIAL.forEach(function (id) {
      var esp = G.especie(id);
      var v = { seed: G.hash32(id) & 0xffff, matiz: 0, padrao: 'liso', porte: 1, prismatico: false };
      var carta = G.criar('div', 'carta-inicial');
      carta.dataset.id = id;
      carta.appendChild(UI.imgEspecie(id, v, 150));
      carta.appendChild(G.criar('h3', null, esp.nome));
      carta.appendChild(G.criar('div', 'carta-cat', esp.categoria));
      var tipos = G.criar('div', 'carta-tipos');
      esp.tipos.forEach(function (t) { tipos.appendChild(UI.chipTipo(t)); });
      carta.appendChild(tipos);
      carta.appendChild(G.criar('p', 'carta-desc', esp.desc));
      carta.addEventListener('click', function () {
        escolhido = id;
        G.els('.carta-inicial', grade).forEach(function (c) { c.classList.toggle('sel', c.dataset.id === id); });
        G.el('#btn-comecar').disabled = false;
      });
      grade.appendChild(carta);
    });
  }

  function comecarJogo() {
    if (!escolhido) return;
    var nome = (G.el('#campo-nome').value || '').trim().slice(0, 14) || 'Vinculista';
    E.s = E.novo(nome);

    var inicial = C.criar(escolhido, 5, { vinculo: 45, local: 'Ateliê da Mestra Oriel' });
    inicial.saciedade = 100;
    E.adicionarCriatura(inicial);
    E.registrarVisto(escolhido);
    E.registrarCaptura(escolhido);
    E.salvar(true);

    entrarNoMundo();

    UI.dialogo({
      nome: 'Mestra Oriel',
      linhas: [
        'Então é esse. Boa escolha — ou pelo menos uma escolha honesta.',
        C.nome(inicial) + ' vai depender de você para comer, descansar e confiar. Isso não é metáfora: olhe a tela de Equipe.',
        'Ao sul da vila fica o Campo de Névoa. Na grama alta você encontra Ânimos selvagens.',
        'Enfraqueça, depois arremesse um Selo. E volte ao Santuário quando alguém se machucar.'
      ]
    });
  }

  /* ==================================================================== */
  /*  ENTRAR NO MUNDO                                                     */
  /* ==================================================================== */
  function entrarNoMundo() {
    pararFundoTitulo();
    mostrarTela('tela-jogo');
    var cv = G.el('#canvas-mapa');
    G.Mundo.iniciar(cv);
    G.Mundo.carregarMapa(E.s.jogador.mapa, E.s.jogador.x, E.s.jogador.y, E.s.jogador.dir);
    setTimeout(function () { G.Mundo.redimensionar(); }, 60);
    UI.atualizarHUD();
  }

  function continuar() {
    if (!E.carregar()) {
      UI.toast('Não foi possível ler o save.', 'aviso');
      return;
    }
    entrarNoMundo();
    UI.toast('Bem-vindo de volta, ' + E.s.jogador.nome + '.', 'ambar');
  }

  /* ==================================================================== */
  /*  BOTÕES                                                              */
  /* ==================================================================== */
  function ligarBotoes() {
    G.el('#btn-novo').addEventListener('click', function () {
      if (E.existeSave()) {
        UI.escolher('Começar de novo?',
          'Já existe uma jornada salva neste navegador. Iniciar outra vai substituí-la quando o jogo salvar.',
          [
            { rotulo: 'Cancelar', classe: 'btn-fantasma' },
            { rotulo: 'Nova jornada', classe: 'btn-primario', acao: telaIntro }
          ]);
      } else {
        telaIntro();
      }
    });

    G.el('#btn-continuar').addEventListener('click', continuar);

    G.el('#btn-intro-seguir').addEventListener('click', function () {
      passoIntro++;
      if (passoIntro >= G.INTRO.length) telaEscolha();
      else atualizarIntro();
    });
    G.el('#btn-pular').addEventListener('click', telaEscolha);

    G.el('#btn-comecar').addEventListener('click', comecarJogo);
    G.el('#campo-nome').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && escolhido) comecarJogo();
    });

    G.el('#btn-menu').addEventListener('click', function () { T.menuPrincipal(); });
    G.el('#btn-b').addEventListener('click', function () { T.menuPrincipal(); });
    G.el('#btn-acao').addEventListener('click', function () {
      if (UI.dialogoAberto()) UI.avancarDialogo();
      else G.Mundo.interagir();
    });
  }

  /* ------------------------ controles de toque ------------------------- */
  function ligarControles() {
    var dpad = G.el('#dpad');
    var atual = null;

    function ativar(dir, alvo) {
      if (atual === dir) return;
      atual = dir;
      G.els('.dp', dpad).forEach(function (b) { b.classList.toggle('ativo', b.dataset.dir === dir); });
      if (dir) G.Mundo.pressionarDirecao(dir);
      else G.Mundo.soltarDirecao();
      void alvo;
    }

    function dirDoEvento(ev) {
      var toque = ev.touches ? ev.touches[0] : ev;
      if (!toque) return null;
      var el = document.elementFromPoint(toque.clientX, toque.clientY);
      if (el && el.dataset && el.dataset.dir) return el.dataset.dir;
      return null;
    }

    ['touchstart', 'touchmove'].forEach(function (nome) {
      dpad.addEventListener(nome, function (ev) {
        ev.preventDefault();
        ativar(dirDoEvento(ev));
      }, { passive: false });
    });
    ['touchend', 'touchcancel'].forEach(function (nome) {
      dpad.addEventListener(nome, function (ev) {
        ev.preventDefault();
        ativar(null);
      }, { passive: false });
    });

    dpad.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      ativar(dirDoEvento(ev));
    });
    window.addEventListener('mouseup', function () { if (atual) ativar(null); });
    dpad.addEventListener('mouseleave', function () { if (atual) ativar(null); });
    dpad.addEventListener('mousemove', function (ev) {
      if (atual && ev.buttons === 1) ativar(dirDoEvento(ev));
    });

    dpad.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  /* ==================================================================== */
  /*  EVENTOS DO JOGO                                                     */
  /* ==================================================================== */
  function ligarEventos() {
    G.bus.on('mapa_mudou', function () { UI.atualizarHUD(); });
    G.bus.on('cuidado_tick', function () { UI.atualizarFilaEquipe(); });

    G.bus.on('encontro', function (info) {
      G.UIBatalha.iniciar({
        criatura: info.criatura,
        local: info.local,
        aoTerminar: function () { UI.atualizarHUD(); }
      });
    });

    G.bus.on('servico', function (info) {
      var lista = info.lista;
      if (lista.length === 1) { abrirServico(lista[0]); return; }
      var ops = lista.map(function (s) {
        return { rotulo: s.nome, acao: function () { abrirServico(s); } };
      });
      ops.push({ rotulo: 'Sair', classe: 'btn-fantasma' });
      UI.escolher('Onde entrar?', null, ops);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && E.s) E.salvar(true);
    });
    window.addEventListener('beforeunload', function () {
      if (E.s) E.salvar(true);
    });
  }

  function abrirServico(s) {
    if (s.tipo === 'loja') {
      UI.dialogo({
        nome: s.nome,
        linhas: ['— Entre, entre. Selo, elixir, comida de Ânimo, tudo aqui.'],
        aoFim: function () { T.loja(s.nome); }
      });
      return;
    }

    if (s.tipo === 'santuario') {
      var precisa = E.s.equipe.some(function (c) {
        return c.hpAtual < C.atributos(c).hp || c.status || c.energia < 100;
      });
      UI.dialogo({
        nome: s.nome,
        linhas: precisa
          ? ['— Deixe seus Ânimos comigo por um instante.']
          : ['— Seus Ânimos estão inteiros. Volte quando precisar.'],
        aoFim: function () {
          if (!precisa) return;
          E.curarEquipe();
          E.autoSalvar();
          UI.atualizarHUD();
          UI.dialogo({
            nome: s.nome,
            linhas: ['— Pronto. Vigor, energia e condições restaurados. Vá com cuidado.']
          });
          UI.toast('Equipe totalmente restaurada.', 'ok');
        }
      });
      return;
    }

    if (s.tipo === 'casa') {
      UI.dialogo({
        nome: null,
        linhas: ['Sua casa. A cama é estreita e o teto range, mas é sua.'],
        aoFim: function () {
          UI.escolher('Descansar?', 'Dormir restaura toda a equipe e salva o progresso.', [
            { rotulo: 'Agora não', classe: 'btn-fantasma' },
            {
              rotulo: 'Dormir', classe: 'btn-primario', acao: function () {
                E.curarEquipe();
                E.s.equipe.forEach(function (c) { c.saciedade = U.clamp(c.saciedade + 35, 0, 100); });
                E.salvar();
                UI.atualizarHUD();
                UI.toast('Você dormiu bem. Tudo restaurado e salvo.', 'ok', 3000);
              }
            }
          ]);
        }
      });
      return;
    }

    if (s.tipo === 'estudo') {
      var cont = E.contagemBestiario();
      UI.dialogo({
        nome: 'Ateliê da Mestra Oriel',
        linhas: [
          'Prateleiras cheias de vidros, penas e cadernos encadernados com barbante.',
          'O bestiário registra ' + cont.vistos + ' espécie(s) vista(s) e ' +
            cont.capturados + ' vinculada(s), de ' + cont.total + ' conhecidas em Vharune.',
          'Uma anotação na parede: "Aspecto do éter não é elemento. É intenção."'
        ],
        aoFim: function () { T.bestiario(); }
      });
      return;
    }

    UI.dialogo({ nome: null, linhas: ['A porta está trancada.'] });
  }

})(window.CRISALIDA);
