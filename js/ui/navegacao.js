/* =========================================================================
   ui/navegacao.js — Navegação por teclado em todas as telas.

   O jogo inteiro tem que ser jogável sem mouse: setas ou WASD movem a
   seleção, Enter/Espaço confirmam, Esc volta.

   A escolha do alvo é GEOMÉTRICA: em vez de cada tela declarar a ordem dos
   seus botões, olhamos onde eles estão na tela e escolhemos o vizinho mais
   plausível na direção apertada. Isso funciona em lista, em grade e em
   layout misto sem configuração — e continua funcionando quando a tela muda.
   ========================================================================= */
(function (G) {
  'use strict';

  var N = G.Nav = {};

  var SELETOR = 'button, [tabindex]:not([tabindex="-1"]), .selecionavel';
  var atual = null;      /* elemento em foco */
  var raizAtual = null;  /* container onde estamos navegando */

  /* ------------------------------------------------------------------ */
  /*  Coleta de alvos                                                    */
  /* ------------------------------------------------------------------ */

  function visivel(el) {
    if (el.disabled || el.hidden) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    var r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    var s = window.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.pointerEvents !== 'none';
  }

  function alvos(raiz) {
    if (!raiz) return [];
    var lista = [];
    var todos = raiz.querySelectorAll(SELETOR);
    for (var i = 0; i < todos.length; i++) {
      if (visivel(todos[i])) lista.push(todos[i]);
    }
    return lista;
  }

  function centro(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r };
  }

  /* ------------------------------------------------------------------ */
  /*  Escolha do vizinho                                                 */
  /* ------------------------------------------------------------------ */

  /* Pontua candidatos na direção pedida: quem está mais alinhado no eixo
     perpendicular e mais perto no eixo do movimento ganha. */
  function vizinho(de, lista, dir) {
    if (!de) return lista[0] || null;
    var c = centro(de);
    var melhor = null, melhorNota = Infinity;

    for (var i = 0; i < lista.length; i++) {
      if (lista[i] === de) continue;
      var o = centro(lista[i]);
      var dx = o.x - c.x, dy = o.y - c.y;

      var frente, lado;
      if (dir === 'esquerda') { frente = -dx; lado = Math.abs(dy); }
      else if (dir === 'direita') { frente = dx; lado = Math.abs(dy); }
      else if (dir === 'cima') { frente = -dy; lado = Math.abs(dx); }
      else { frente = dy; lado = Math.abs(dx); }

      /* precisa estar de fato à frente, com folga para arredondamento */
      if (frente < 4) continue;

      /* Sobreposição no eixo perpendicular vale muito: é o que faz uma
         coluna de botões de larguras diferentes navegar como coluna. */
      var sobrepoe;
      if (dir === 'cima' || dir === 'baixo') {
        sobrepoe = Math.min(c.r.right, o.r.right) - Math.max(c.r.left, o.r.left);
      } else {
        sobrepoe = Math.min(c.r.bottom, o.r.bottom) - Math.max(c.r.top, o.r.top);
      }
      var bonus = sobrepoe > 0 ? 0 : lado * 2.2;

      var nota = frente + lado * 0.6 + bonus;
      if (nota < melhorNota) { melhorNota = nota; melhor = lista[i]; }
    }

    /* Sem ninguém na direção: dá a volta pela borda oposta. */
    if (!melhor && lista.length) {
      var ordenado = lista.slice().sort(function (a, b) {
        var ca = centro(a), cb = centro(b);
        return (dir === 'cima' || dir === 'baixo') ? ca.y - cb.y : ca.x - cb.x;
      });
      melhor = (dir === 'cima' || dir === 'esquerda')
        ? ordenado[ordenado.length - 1] : ordenado[0];
      if (melhor === de) melhor = null;
    }
    return melhor;
  }

  /* ------------------------------------------------------------------ */
  /*  Foco                                                               */
  /* ------------------------------------------------------------------ */

  function marcar(el) {
    if (atual && atual !== el) atual.classList.remove('nav-foco');
    atual = el || null;
    if (!atual) return;
    atual.classList.add('nav-foco');
    if (atual.scrollIntoView) {
      atual.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  N.limpar = function () { marcar(null); raizAtual = null; };

  N.focoAtual = function () { return atual; };

  /* Aponta a navegação para um container e seleciona o primeiro alvo.
     Chamado sempre que uma tela nova aparece. */
  N.entrar = function (raiz, preferido) {
    raizAtual = raiz || null;
    var lista = alvos(raizAtual);
    if (!lista.length) { marcar(null); return; }
    var alvo = null;
    if (preferido) {
      alvo = typeof preferido === 'string' ? raizAtual.querySelector(preferido) : preferido;
      if (alvo && lista.indexOf(alvo) < 0) alvo = null;
    }
    marcar(alvo || lista[0]);
  };

  /* Revalida depois de a tela mudar: se o foco sumiu, pega o equivalente. */
  N.revalidar = function (raiz) {
    if (raiz) raizAtual = raiz;
    var lista = alvos(raizAtual);
    if (!lista.length) { marcar(null); return; }
    if (!atual || lista.indexOf(atual) < 0 || !visivel(atual)) marcar(lista[0]);
    else marcar(atual);
  };

  /* ------------------------------------------------------------------ */
  /*  Tratamento de tecla                                                */
  /* ------------------------------------------------------------------ */

  var DIRECOES = {
    arrowup: 'cima', w: 'cima',
    arrowdown: 'baixo', s: 'baixo',
    arrowleft: 'esquerda', a: 'esquerda',
    arrowright: 'direita', d: 'direita'
  };

  N.direcaoDe = function (k) { return DIRECOES[k] || null; };

  /* Trata a tecla dentro do container informado.
     Devolve true se consumiu. */
  N.tecla = function (ev, raiz) {
    var k = ev.key.toLowerCase();
    var lista = alvos(raiz);
    if (!lista.length) return false;

    /* O foco pode ter sido invalidado por um render (menu remontado). Nesse
       caso recuperamos AQUI e seguimos tratando a mesma tecla — senão o
       primeiro Enter depois de trocar de menu seria engolido, e o jogador
       sente isso como uma tecla morta. */
    if (!atual || lista.indexOf(atual) < 0) marcar(lista[0]);

    var dir = DIRECOES[k];
    if (dir) {
      ev.preventDefault();
      var alvo = vizinho(atual, lista, dir);
      if (alvo) marcar(alvo);
      return true;
    }

    if (k === 'enter' || k === ' ') {
      ev.preventDefault();
      var el = atual;
      /* o clique costuma trocar a tela — o foco é revalidado depois */
      el.click();
      return true;
    }

    if (k === 'tab') {
      ev.preventDefault();
      var i = lista.indexOf(atual);
      marcar(lista[(i + (ev.shiftKey ? -1 : 1) + lista.length) % lista.length]);
      return true;
    }

    return false;
  };

  /* Perder o foco por clique do mouse não deve deixar rastro visual. */
  document.addEventListener('mousedown', function () {
    if (atual) { atual.classList.remove('nav-foco'); atual = null; }
  });

})(window.ANIMOS);
