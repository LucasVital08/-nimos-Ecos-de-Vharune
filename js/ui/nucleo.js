/* =========================================================================
   ui/nucleo.js — Diálogo, avisos, painéis e componentes compartilhados
   ========================================================================= */
(function (G) {
  'use strict';

  var U = G.utils;
  var E = G.Estado;
  var C = G.Criatura;
  var UI = G.UI = {};

  var elDialogo, elDialogoTexto, elDialogoQuem;
  var elPainel, elPainelTitulo, elPainelAbas, elPainelCorpo, elPainelRodape;
  var filaDialogo = [];
  var dialogoAtual = null;
  var linhaAtual = 0;
  var painelAberto = null;
  var modalAberto = null;

  UI.iniciar = function () {
    elDialogo = G.el('#caixa-dialogo');
    elDialogoTexto = G.el('#dialogo-texto');
    elDialogoQuem = G.el('#dialogo-quem');
    elPainel = G.el('#painel');
    elPainelTitulo = G.el('#painel-titulo');
    elPainelAbas = G.el('#painel-abas');
    elPainelCorpo = G.el('#painel-corpo');
    elPainelRodape = G.el('#painel-rodape');

    elDialogo.addEventListener('click', UI.avancarDialogo);
    G.el('#painel-fechar').addEventListener('click', function () { UI.fecharPainel(); });

    G.bus.on('dialogo', function (d) { UI.dialogo(d); });
  };

  /* ============================== AVISOS ============================== */
  UI.toast = function (texto, tipo, ms) {
    var caixa = G.el('#toasts');
    var t = G.criar('div', 'toast ' + (tipo || ''), texto);
    caixa.appendChild(t);
    setTimeout(function () {
      t.classList.add('saindo');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, ms || 2400);
  };

  /* ============================== DIÁLOGO ============================= */
  UI.dialogo = function (d) {
    filaDialogo.push(d);
    if (!dialogoAtual) proximoDialogo();
  };

  function proximoDialogo() {
    dialogoAtual = filaDialogo.shift();
    if (!dialogoAtual) {
      elDialogo.classList.add('oculto');
      G.Mundo.retomar();
      G.bus.emit('dialogo_fim');
      return;
    }
    G.Mundo.pausar();
    linhaAtual = 0;
    elDialogo.classList.remove('oculto');
    mostrarLinha();
  }

  function mostrarLinha() {
    elDialogoQuem.textContent = dialogoAtual.nome || '';
    elDialogoTexto.textContent = dialogoAtual.linhas[linhaAtual] || '';
  }

  UI.avancarDialogo = function () {
    if (!dialogoAtual) return;
    linhaAtual++;
    if (linhaAtual < dialogoAtual.linhas.length) {
      mostrarLinha();
    } else {
      var fim = dialogoAtual.aoFim;
      dialogoAtual = null;
      if (fim) fim();
      proximoDialogo();
    }
  };

  UI.dialogoAberto = function () { return !!dialogoAtual; };

  /* =============================== PAINEL ============================= */
  /* cfg = { titulo, abas:[{id,nome,render(corpo)}], aba, rodape(el), aoFechar } */
  UI.abrirPainel = function (cfg) {
    painelAberto = cfg;
    G.Mundo.pausar();
    elPainel.classList.remove('oculto');
    elPainelTitulo.textContent = cfg.titulo || '';
    elPainelAbas.innerHTML = '';
    elPainelRodape.innerHTML = '';

    var abas = cfg.abas || [];
    var atual = cfg.aba || (abas[0] && abas[0].id);

    function render(id) {
      atual = id;
      cfg.aba = id;
      G.els('.aba', elPainelAbas).forEach(function (b) {
        b.classList.toggle('ativa', b.dataset.aba === id);
      });
      elPainelCorpo.innerHTML = '';
      elPainelCorpo.scrollTop = 0;
      elPainelRodape.innerHTML = '';
      var aba = abas.find(function (a) { return a.id === id; });
      if (aba && aba.render) aba.render(elPainelCorpo, elPainelRodape);
    }

    if (abas.length > 1) {
      abas.forEach(function (a) {
        var b = G.criar('button', 'aba', a.nome);
        b.dataset.aba = a.id;
        b.addEventListener('click', function () { render(a.id); });
        elPainelAbas.appendChild(b);
      });
    }
    painelAberto.render = render;
    render(atual);
  };

  UI.recarregarPainel = function () {
    if (painelAberto && painelAberto.render) painelAberto.render(painelAberto.aba);
  };

  UI.fecharPainel = function () {
    if (!painelAberto) return;
    var cb = painelAberto.aoFechar;
    painelAberto = null;
    elPainel.classList.add('oculto');
    elPainelCorpo.innerHTML = '';
    if (!UI.dialogoAberto() && !G.UIBatalha.ativa()) G.Mundo.retomar();
    if (cb) cb();
  };

  UI.painelAberto = function () { return !!painelAberto; };

  /* =============================== MODAL ============================== */
  /* opcoes = [{rotulo, classe, acao}] */
  UI.escolher = function (titulo, texto, opcoes) {
    UI.fecharModal();
    var fundo = G.criar('div', 'modalzinho');
    var caixa = G.criar('div', 'modalzinho-caixa');
    caixa.appendChild(G.criar('h3', null, titulo));
    if (texto) caixa.appendChild(G.criar('p', null, texto));
    var linha = G.criar('div', 'modalzinho-acoes');
    opcoes.forEach(function (o) {
      var b = G.criar('button', 'btn ' + (o.classe || ''), o.rotulo);
      b.addEventListener('click', function () {
        UI.fecharModal();
        if (o.acao) o.acao();
      });
      linha.appendChild(b);
    });
    caixa.appendChild(linha);
    fundo.appendChild(caixa);
    document.getElementById('app').appendChild(fundo);
    modalAberto = fundo;
  };

  UI.fecharModal = function () {
    if (modalAberto && modalAberto.parentNode) modalAberto.parentNode.removeChild(modalAberto);
    modalAberto = null;
  };

  /* ========================== COMPONENTES ============================= */
  UI.chipTipo = function (tipo) {
    var d = G.TIPOS[tipo];
    var s = G.criar('span', 'tag', d ? d.nome : tipo);
    if (d) {
      s.style.background = U.css(d.cor);
      s.style.color = d.cor[2] > 58 ? '#241a0a' : '#fff';
    }
    return s;
  };

  UI.imgCriatura = function (c, tam) {
    var img = new Image();
    img.src = G.Arte.dataURL(c.esp, G.variacaoDe(c));
    img.alt = C.nome(c);
    if (tam) { img.width = tam; img.height = tam; }
    return img;
  };

  UI.imgEspecie = function (especieId, variacao, tam) {
    var img = new Image();
    img.src = G.Arte.dataURL(especieId, variacao || { seed: 1, matiz: 0, padrao: 'liso', porte: 1 });
    if (tam) { img.width = tam; img.height = tam; }
    return img;
  };

  UI.imgItem = function (item, tam) {
    var img = new Image();
    img.src = G.Arte.iconeItemURL(item.icone);
    img.alt = item.nome;
    if (tam) { img.width = tam; img.height = tam; }
    return img;
  };

  UI.classeBarra = function (frac) {
    if (frac <= 0.22) return 'baixo';
    if (frac <= 0.5) return 'medio';
    return '';
  };

  UI.barra = function (frac, extraClasse) {
    var b = G.criar('div', 'barra ' + UI.classeBarra(frac) + ' ' + (extraClasse || ''));
    var i = G.criar('i');
    i.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
    b.appendChild(i);
    return b;
  };

  /* Cartão compacto de uma criatura (usado em equipe/reserva/batalha) */
  UI.cartaoCriatura = function (c, opts) {
    opts = opts || {};
    var esp = G.especie(c.esp);
    var at = C.atributos(c);
    var frac = C.fracaoHP(c);

    var card = G.criar('div', 'cartao' + (opts.lider ? ' lider' : '') + (c.hpAtual <= 0 ? ' ko' : ''));
    if (opts.lider) {
      var fita = G.criar('div', 'cartao-fita', 'LÍDER');
      card.appendChild(fita);
    }

    var arte = G.criar('div', 'cartao-arte');
    arte.appendChild(UI.imgCriatura(c, 78));
    card.appendChild(arte);

    var info = G.criar('div', 'cartao-info');
    var l1 = G.criar('div', 'cartao-linha');
    l1.appendChild(G.criar('span', 'cartao-nome', C.nome(c)));
    l1.appendChild(G.criar('span', 'cartao-nv', 'Nv ' + c.nivel));
    info.appendChild(l1);

    var tipos = G.criar('div', 'cartao-tipos');
    esp.tipos.forEach(function (t) { tipos.appendChild(UI.chipTipo(t)); });
    if (c.prismatico) {
      var pr = G.criar('span', 'tag tag-prisma', 'PRISMÁTICO');
      tipos.appendChild(pr);
    }
    info.appendChild(tipos);

    info.appendChild(UI.barra(frac));
    var hp = G.criar('div', 'cartao-hp');
    hp.appendChild(G.criar('span', null, Math.ceil(c.hpAtual) + ' / ' + at.hp));
    if (c.status) {
      var st = G.criar('span', null, G.CONDICOES[c.status].sigla);
      st.style.color = G.CONDICOES[c.status].cor;
      st.style.fontWeight = '700';
      hp.appendChild(st);
    }
    info.appendChild(hp);

    var cuid = G.criar('div', 'cartao-cuidado');
    [['energia', 'Energia', c.energia], ['fome', 'Saciedade', c.saciedade], ['vinculo', 'Vínculo', c.vinculo]]
      .forEach(function (m) {
        var d = G.criar('div', 'medidor ' + m[0]);
        d.appendChild(G.criar('span', null, m[1]));
        var b = G.criar('div', 'barra');
        var i = G.criar('i');
        i.style.width = U.clamp(m[2], 0, 100).toFixed(0) + '%';
        b.appendChild(i);
        d.appendChild(b);
        cuid.appendChild(d);
      });
    info.appendChild(cuid);
    card.appendChild(info);

    if (opts.aoClicar) card.addEventListener('click', function () { opts.aoClicar(c); });
    return card;
  };

  /* ================================ HUD =============================== */
  UI.atualizarHUD = function () {
    if (!E.s) return;
    var m = G.Mundo.mapaAtual();
    var local = G.el('#hud-local');
    if (local) local.textContent = m ? m.nome : '';
    var coord = G.el('#hud-coord');
    if (coord) coord.textContent = E.s.jogador.nome + ' · ' + E.s.jogador.passos + ' passos';
    var amb = G.el('#hud-ambras');
    if (amb) amb.textContent = E.s.jogador.ambras.toLocaleString('pt-BR');
    UI.atualizarFilaEquipe();
  };

  UI.atualizarFilaEquipe = function () {
    var fila = G.el('#fila-equipe');
    if (!fila || !E.s) return;
    fila.innerHTML = '';
    E.s.equipe.forEach(function (c) {
      var f = C.fracaoHP(c);
      var cls = 'pip';
      if (c.hpAtual <= 0) cls += ' ko';
      else if (f <= 0.25) cls += ' mal';
      else if (f <= 0.55) cls += ' ferido';
      var p = G.criar('span', cls);
      p.title = C.nome(c) + ' — ' + Math.ceil(c.hpAtual) + ' de vigor';
      fila.appendChild(p);
    });
  };

  /* ============================= TECLADO ============================== */
  /* Devolve true se a UI consumiu a tecla (o mapa então ignora). */
  UI.capturaTeclado = function (ev) {
    var k = ev.key.toLowerCase();
    if (modalAberto) {
      if (k === 'escape') { UI.fecharModal(); return true; }
      return true;
    }
    if (G.UIBatalha && G.UIBatalha.ativa()) {
      return G.UIBatalha.tecla(ev);
    }
    if (dialogoAtual) {
      if (k === 'enter' || k === ' ' || k === 'e' || k === 'escape') {
        ev.preventDefault();
        UI.avancarDialogo();
      }
      return true;
    }
    if (painelAberto) {
      if (k === 'escape' || k === 'm' || k === 'backspace') { ev.preventDefault(); UI.fecharPainel(); return true; }
      return true;
    }
    if (k === 'm' || k === 'escape') { ev.preventDefault(); G.Telas.menuPrincipal(); return true; }
    if (k === 'p') { ev.preventDefault(); G.Telas.equipe(); return true; }
    if (k === 'b') { ev.preventDefault(); G.Telas.bestiario(); return true; }
    if (k === 'i') { ev.preventDefault(); G.Telas.mochila(); return true; }
    return false;
  };

})(window.ANIMOS);
