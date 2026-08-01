/* =========================================================================
   itens.js — Mochila do vinculista
   ---------------------------------------------------------------------
   cat : 'selo' | 'cura' | 'comida' | 'cuidado' | 'chave'
   uso  : 'batalha' | 'campo' | 'ambos'
   ========================================================================= */
(function (G) {
  'use strict';

  var L = [
    /* --------------------------- SELOS (captura) --------------------------- */
    { id: 'selo_simples', nome: 'Selo Simples', cat: 'selo', uso: 'batalha', preco: 200, venda: 100,
      taxa: 1.0, icone: 'selo1',
      desc: 'Âmbar comum gravado com a runa do vínculo. Prende Ânimos enfraquecidos.' },
    { id: 'selo_reforcado', nome: 'Selo Reforçado', cat: 'selo', uso: 'batalha', preco: 600, venda: 300,
      taxa: 1.6, icone: 'selo2',
      desc: 'Âmbar denso com fio de liga étera. Bem mais confiável que o Simples.' },
    { id: 'selo_aureo', nome: 'Selo Áureo', cat: 'selo', uso: 'batalha', preco: 1200, venda: 600,
      taxa: 2.4, icone: 'selo3',
      desc: 'Feito nas oficinas do Passo Ferrugem. Raramente falha com um Ânimo cansado.' },
    { id: 'selo_da_crisalida', nome: 'Selo da Crisálida', cat: 'selo', uso: 'batalha', preco: 0, venda: 0,
      taxa: 4.0, icone: 'selo4',
      desc: 'Âmbar tirado do fragmento que caiu com o Primeiro Eco. Diz-se que ele não captura: ele convida.' },
    { id: 'selo_do_lago', nome: 'Selo do Lago', cat: 'selo', uso: 'batalha', preco: 800, venda: 400,
      taxa: 1.2, bonusTipo: ['torrente', 'gelido'], bonusMult: 3.2, icone: 'selo5',
      desc: 'Água de Miravel selada em âmbar. Extremamente eficaz com Ânimos de Torrente e Gélido.' },
    { id: 'selo_da_brasa', nome: 'Selo da Brasa', cat: 'selo', uso: 'batalha', preco: 800, venda: 400,
      taxa: 1.2, bonusTipo: ['brasa', 'ferro'], bonusMult: 3.2, icone: 'selo6',
      desc: 'Âmbar cozido em forja viva. Feito sob medida para Brasa e Ferro.' },

    /* ------------------------------- CURA --------------------------------- */
    { id: 'elixir_menor', nome: 'Elixir Menor', cat: 'cura', uso: 'ambos', preco: 150, venda: 75,
      cura: 30, icone: 'frasco1',
      desc: 'Restaura 30 de vigor. Gosto de casca de árvore, mas funciona.' },
    { id: 'elixir', nome: 'Elixir de Seiva', cat: 'cura', uso: 'ambos', preco: 400, venda: 200,
      cura: 80, icone: 'frasco2',
      desc: 'Restaura 80 de vigor. Feito com seiva astral filtrada.' },
    { id: 'elixir_maior', nome: 'Elixir Maior', cat: 'cura', uso: 'ambos', preco: 900, venda: 450,
      cura: 180, icone: 'frasco3',
      desc: 'Restaura 180 de vigor. Reserva de emergência de todo vinculista sério.' },
    { id: 'nectar_pleno', nome: 'Néctar Pleno', cat: 'cura', uso: 'ambos', preco: 1800, venda: 900,
      cura: 9999, icone: 'frasco4',
      desc: 'Restaura todo o vigor. Uma gota só já é um exagero.' },
    { id: 'erva_purificante', nome: 'Erva Purificante', cat: 'cura', uso: 'ambos', preco: 250, venda: 125,
      curaStatus: 'todos', icone: 'erva',
      desc: 'Remove qualquer condição adversa: queimadura, veneno, paralisia, gelo ou sono.' },
    { id: 'semente_alvorada', nome: 'Semente da Alvorada', cat: 'cura', uso: 'ambos', preco: 1500, venda: 750,
      reviver: 0.5, icone: 'semente',
      desc: 'Reanima um Ânimo desmaiado com metade do vigor. Só germina uma vez.' },

    /* ----------------------------- ALIMENTAÇÃO ---------------------------- */
    { id: 'fruta_doce', nome: 'Fruta Doce', cat: 'comida', uso: 'campo', preco: 60, venda: 30,
      fome: 30, vinculo: 3, cura: 10, icone: 'fruta',
      desc: 'Colhida no Bosque Solene. Mata a fome e melhora o humor.' },
    { id: 'bolo_de_mel', nome: 'Bolo de Mel', cat: 'comida', uso: 'campo', preco: 180, venda: 90,
      fome: 65, vinculo: 8, cura: 25, icone: 'bolo',
      desc: 'Receita de Cinzalva. Nenhum Ânimo conhecido recusa.' },
    { id: 'racao_etera', nome: 'Ração Étera', cat: 'comida', uso: 'campo', preco: 120, venda: 60,
      fome: 100, vinculo: 1, energia: 15, icone: 'racao',
      desc: 'Balanceada, nutritiva e sem graça nenhuma. Enche por completo.' },
    { id: 'geleia_astral', nome: 'Geleia Astral', cat: 'comida', uso: 'campo', preco: 350, venda: 175,
      fome: 50, vinculo: 15, energia: 20, cura: 40, icone: 'geleia',
      desc: 'Luxo raro. Fortalece o vínculo de forma notável.' },

    /* ------------------------------ CUIDADO ------------------------------- */
    { id: 'escova_seda', nome: 'Escova de Seda', cat: 'cuidado', uso: 'campo', preco: 400, venda: 200,
      vinculo: 12, reutilizavel: true, icone: 'escova',
      desc: 'Nunca acaba. Escovar um Ânimo todo dia faz mais pelo vínculo que qualquer item caro.' },
    { id: 'cristal_descanso', nome: 'Cristal de Descanso', cat: 'cuidado', uso: 'campo', preco: 300, venda: 150,
      energia: 60, vinculo: 4, icone: 'cristal',
      desc: 'Emite um zumbido baixo que devolve energia a um Ânimo exausto.' },
    { id: 'incenso_lavanda', nome: 'Incenso de Lavanda', cat: 'cuidado', uso: 'campo', preco: 220, venda: 110,
      energia: 25, vinculo: 8, curaStatus: 'sono', icone: 'incenso',
      desc: 'Acalma Ânimos agitados e desfaz sonos forçados.' },
    { id: 'sino_do_vinculo', nome: 'Sino do Vínculo', cat: 'cuidado', uso: 'campo', preco: 1200, venda: 600,
      vinculo: 30, reutilizavel: false, icone: 'sino',
      desc: 'Toca uma nota que só o seu Ânimo escuta. O vínculo dá um salto.' },

    /* ------------------------------- CHAVE -------------------------------- */
    { id: 'lente_de_orva', nome: 'Lente de Orva', cat: 'chave', uso: 'campo', preco: 0, venda: 0,
      icone: 'lente', unico: true,
      desc: 'Presente da Mestra Oriel. Revela a chance de captura e os atributos ocultos de um Ânimo selvagem.' },
    { id: 'amuleto_ambar', nome: 'Amuleto de Âmbar', cat: 'chave', uso: 'campo', preco: 0, venda: 0,
      icone: 'amuleto', unico: true,
      desc: 'Abre a passagem selada das Ruínas de Aldherin.' },
    { id: 'vara_de_junco', nome: 'Vara de Junco', cat: 'chave', uso: 'campo', preco: 0, venda: 0,
      icone: 'vara', unico: true,
      desc: 'Permite pescar Ânimos nas margens do Lago Miravel.' }
  ];

  G.ITENS = {};
  L.forEach(function (i) { G.ITENS[i.id] = i; });
  G.LISTA_ITENS = L;

  G.item = function (id) { return G.ITENS[id] || null; };

  G.CATEGORIAS_ITEM = [
    { id: 'selo', nome: 'Selos', icone: '◈' },
    { id: 'cura', nome: 'Cura', icone: '✚' },
    { id: 'comida', nome: 'Alimentos', icone: '❁' },
    { id: 'cuidado', nome: 'Cuidado', icone: '❀' },
    { id: 'chave', nome: 'Chaves', icone: '⚿' }
  ];

})(window.ANIMOS);
