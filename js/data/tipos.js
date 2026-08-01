/* =========================================================================
   tipos.js — Os 11 Aspectos do Éter (tipos elementais originais de Vharune)
   ========================================================================= */
(function (G) {
  'use strict';

  /* Cada aspecto tem cor própria (usada na UI e na paleta das criaturas).
     "Éter" é o aspecto neutro: não tem vantagem nem fraqueza contra nada. */
  G.TIPOS = {
    eter:     { nome: 'Éter',     cor: [260, 12, 66], icone: '◇', desc: 'Éter cru, sem aspecto definido. Neutro contra tudo.' },
    brasa:    { nome: 'Brasa',    cor: [14, 88, 55],  icone: '🜂', desc: 'Éter incandescente que arde no núcleo das criaturas vulcânicas.' },
    torrente: { nome: 'Torrente', cor: [205, 78, 52], icone: '🜄', desc: 'Correntes vivas de água etérea, fluidas e implacáveis.' },
    verdejo:  { nome: 'Verdejo',  cor: [122, 55, 42], icone: '🜃', desc: 'Seiva astral que faz brotar florestas sobre a rocha morta.' },
    fulgor:   { nome: 'Fulgor',   cor: [48, 92, 55],  icone: '⚡', desc: 'Descargas do éter que Orva despeja nas nuvens a cada ciclo.' },
    gelido:   { nome: 'Gélido',   cor: [188, 65, 66], icone: '❈', desc: 'Silêncio congelado das alturas por onde o éter desce antes de tocar o chão.' },
    terra:    { nome: 'Terra',    cor: [30, 42, 42],  icone: '⛰', desc: 'A memória mineral do continente, de quando a lua ainda era inteira.' },
    zefiro:   { nome: 'Zéfiro',   cor: [168, 45, 62], icone: '༄', desc: 'Ventos que carregam ecos de vozes antigas.' },
    umbra:    { nome: 'Umbra',    cor: [268, 40, 42], icone: '☾', desc: 'Sombra que se desprendeu de quem já foi.' },
    aurora:   { nome: 'Aurora',   cor: [46, 96, 62],  icone: '☀', desc: 'Luz primordial, do primeiro éter que escorreu pela trinca de Orva.' },
    ferro:    { nome: 'Ferro',    cor: [212, 14, 55], icone: '⚙', desc: 'Éter cristalizado em ligas impossíveis.' },
    toxina:   { nome: 'Toxina',   cor: [292, 48, 45], icone: '☣', desc: 'Éter lunar que apodreceu nas poças onde ninguém foi buscar.' }
  };

  G.LISTA_TIPOS = Object.keys(G.TIPOS);

  /* -----------------------------------------------------------------------
     Matriz de efetividade (esparsa). Só entram valores diferentes de 1.
     ataque -> { defesa: multiplicador }
     0    = imune       0.5 = resistente
     2    = super eficaz
     ----------------------------------------------------------------------- */
  G.EFETIVIDADE = {
    brasa:    { verdejo: 2, gelido: 2, ferro: 2, toxina: 1, brasa: 0.5, torrente: 0.5, terra: 0.5 },
    torrente: { brasa: 2, terra: 2, ferro: 1, torrente: 0.5, verdejo: 0.5, fulgor: 0.5 },
    verdejo:  { torrente: 2, terra: 2, verdejo: 0.5, brasa: 0.5, zefiro: 0.5, toxina: 0.5, ferro: 0.5 },
    fulgor:   { torrente: 2, zefiro: 2, fulgor: 0.5, verdejo: 0.5, terra: 0 },
    gelido:   { verdejo: 2, terra: 2, zefiro: 2, gelido: 0.5, brasa: 0.5, torrente: 0.5, ferro: 0.5 },
    terra:    { brasa: 2, fulgor: 2, toxina: 2, ferro: 2, verdejo: 0.5, gelido: 0.5, zefiro: 0 },
    zefiro:   { verdejo: 2, toxina: 2, umbra: 1, fulgor: 0.5, gelido: 0.5, ferro: 0.5 },
    umbra:    { aurora: 2, gelido: 2, umbra: 0.5, brasa: 0.5, ferro: 0.5 },
    aurora:   { umbra: 2, toxina: 2, aurora: 0.5, verdejo: 0.5, ferro: 0.5 },
    ferro:    { gelido: 2, aurora: 2, terra: 1, brasa: 0.5, torrente: 0.5, fulgor: 0.5, ferro: 0.5 },
    toxina:   { verdejo: 2, aurora: 2, toxina: 0.5, terra: 0.5, ferro: 0 }
  };

  /* Multiplicador total de um tipo de ataque contra 1 ou 2 tipos de defesa. */
  G.multiplicadorTipo = function (tipoAtaque, tiposDefesa) {
    var tabela = G.EFETIVIDADE[tipoAtaque] || {};
    var m = 1;
    for (var i = 0; i < tiposDefesa.length; i++) {
      var v = tabela[tiposDefesa[i]];
      m *= (v === undefined ? 1 : v);
    }
    return m;
  };

  G.textoEfetividade = function (m) {
    if (m === 0) return 'Não teve efeito algum...';
    if (m >= 4) return 'Devastador! O éter rachou no ar!';
    if (m >= 2) return 'Muito eficaz!';
    if (m > 0 && m < 0.3) return 'Mal arranhou...';
    if (m < 1) return 'Pouco eficaz...';
    return '';
  };

  G.corTipo = function (t) {
    var d = G.TIPOS[t];
    return d ? G.utils.css(d.cor) : '#888';
  };

  G.nomeTipo = function (t) {
    var d = G.TIPOS[t];
    return d ? d.nome : t;
  };

})(window.ANIMOS);
