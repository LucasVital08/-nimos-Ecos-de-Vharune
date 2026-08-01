/* =========================================================================
   ÂNIMOS — Ecos de Vharune
   core.js — namespace global, RNG determinístico e utilitários
   ========================================================================= */
(function (global) {
  'use strict';

  var G = global.ANIMOS || (global.ANIMOS = {});

  G.VERSION = '1.0.0';
  G.TITULO = 'ÂNIMOS';
  G.SUBTITULO = 'Ecos de Vharune';

  /* ---------------------------------------------------------------------
     RNG determinístico (mulberry32) — usado para variação individual,
     texturas do mapa e qualquer coisa que precise ser reproduzível.
     --------------------------------------------------------------------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  G.mulberry32 = mulberry32;

  /* Hash de string -> inteiro 32 bits (para semear por nome/coordenada) */
  function hash32(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  G.hash32 = hash32;

  /* Ruído determinístico 2D em [0,1) */
  function noise2(x, y, seed) {
    var n = (x * 374761393 + y * 668265263 + (seed || 0) * 1442695040888963407) | 0;
    n = (n ^ (n >>> 13)) | 0;
    n = Math.imul(n, 1274126177) | 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  G.noise2 = noise2;

  /* ------------------------------ Utils ------------------------------- */
  var U = G.utils = {};

  U.clamp = function (v, min, max) { return v < min ? min : (v > max ? max : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };

  U.randInt = function (min, max, rnd) {
    var r = rnd || Math.random;
    return Math.floor(r() * (max - min + 1)) + min;
  };

  U.chance = function (p, rnd) { return (rnd || Math.random)() < p; };

  U.choice = function (arr, rnd) {
    return arr[Math.floor((rnd || Math.random)() * arr.length)];
  };

  /* Escolha ponderada: lista de {peso: n, ...} */
  U.weighted = function (list, rnd) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += (list[i].peso || 1);
    var roll = (rnd || Math.random)() * total;
    for (i = 0; i < list.length; i++) {
      roll -= (list[i].peso || 1);
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  };

  U.shuffle = function (arr, rnd) {
    var r = rnd || Math.random, a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  U.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  U.uid = function () {
    return 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  };

  U.pad = function (n, len) {
    var s = String(n);
    while (s.length < len) s = '0' + s;
    return s;
  };

  U.titulo = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ----------------------------- Cores -------------------------------- */
  /* Paletas são armazenadas como [h, s, l] para permitir deslocamento de
     matiz por indivíduo sem perder consistência de sombreamento.          */
  U.hsl = function (h, s, l, a) {
    h = ((h % 360) + 360) % 360;
    if (a === undefined || a === 1) return 'hsl(' + h.toFixed(1) + ',' + U.clamp(s, 0, 100).toFixed(1) + '%,' + U.clamp(l, 0, 100).toFixed(1) + '%)';
    return 'hsla(' + h.toFixed(1) + ',' + U.clamp(s, 0, 100).toFixed(1) + '%,' + U.clamp(l, 0, 100).toFixed(1) + '%,' + a + ')';
  };

  U.tom = function (cor, dl, ds, dh) {
    return [cor[0] + (dh || 0), U.clamp(cor[1] + (ds || 0), 0, 100), U.clamp(cor[2] + (dl || 0), 0, 100)];
  };

  U.css = function (cor, a) { return U.hsl(cor[0], cor[1], cor[2], a); };

  /* -------------------- Ruído suave (para o terreno) -------------------- */
  function suavizar(t) { return t * t * (3 - 2 * t); }

  /* Ruído de valor interpolado: varia de forma contínua entre tiles. */
  G.ruido = function (x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var u = suavizar(x - xi), v = suavizar(y - yi);
    var a = noise2(xi, yi, seed), b = noise2(xi + 1, yi, seed);
    var c = noise2(xi, yi + 1, seed), d = noise2(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
  };

  /* Soma de oitavas — dá manchas grandes com detalhe fino por cima. */
  G.fbm = function (x, y, seed, oitavas) {
    var soma = 0, amp = 0.5, freq = 1, norm = 0;
    for (var i = 0; i < (oitavas || 3); i++) {
      soma += G.ruido(x * freq, y * freq, seed + i * 101) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return soma / norm;
  };

  /* ------------------------- Barramento de eventos --------------------- */
  function EventBus() { this._h = {}; }
  EventBus.prototype.on = function (ev, fn) {
    (this._h[ev] || (this._h[ev] = [])).push(fn);
    return this;
  };
  EventBus.prototype.off = function (ev, fn) {
    if (!this._h[ev]) return this;
    this._h[ev] = this._h[ev].filter(function (f) { return f !== fn; });
    return this;
  };
  EventBus.prototype.emit = function (ev) {
    var args = Array.prototype.slice.call(arguments, 1);
    (this._h[ev] || []).slice().forEach(function (fn) {
      try { fn.apply(null, args); } catch (e) { console.error('[bus:' + ev + ']', e); }
    });
    return this;
  };
  G.EventBus = EventBus;
  G.bus = new EventBus();

  /* ----------------------------- DOM helper ---------------------------- */
  G.el = function (sel, root) { return (root || document).querySelector(sel); };
  G.els = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  G.criar = function (tag, cls, texto) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  };

})(typeof window !== 'undefined' ? window : globalThis);
