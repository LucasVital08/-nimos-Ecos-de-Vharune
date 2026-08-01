/* =========================================================================
   tecnicas.js — Técnicas (golpes) de Crisálida
   ---------------------------------------------------------------------
   cat : 'fisico' | 'especial' | 'apoio'
   pot : potência base (0 para apoio)
   prec: precisão 0-100 (null = nunca erra)
   pri : prioridade (maior age antes)
   ef  : efeitos opcionais
         st    {s:'queimadura', c:0.1}  aplica condição no alvo
         mod   {alvo:'alvo'|'eu', stats:{atk:-1}, c:1}  estágios de atributo
         dreno 0..1   cura fração do dano causado
         recuo 0..1   dano de recuo sobre o dano causado
         cura  0..1   cura fração do HP máximo (apoio)
         multi [min,max]  golpes múltiplos
         crit  n      estágios extras de crítico
         atordoar 0..1  chance de o alvo perder o turno
   ========================================================================= */
(function (G) {
  'use strict';

  function t(id, nome, tipo, cat, pot, prec, pp, desc, ef, pri) {
    return { id: id, nome: nome, tipo: tipo, cat: cat, pot: pot, prec: prec, pp: pp, desc: desc, ef: ef || null, pri: pri || 0 };
  }

  var L = [
    /* ------------------------------ ÉTER ------------------------------ */
    t('investida', 'Investida', 'eter', 'fisico', 40, 100, 35, 'Um choque direto de corpo carregado de éter cru.'),
    t('golpe_veloz', 'Golpe Veloz', 'eter', 'fisico', 40, 100, 30, 'Ataque tão rápido que quase sempre acerta primeiro.', null, 1),
    t('pancada_etera', 'Pancada Étera', 'eter', 'fisico', 80, 100, 15, 'Concentra éter no impacto para um golpe pesado.'),
    t('rajada_etera', 'Rajada Étera', 'eter', 'especial', 75, 100, 15, 'Dispara um feixe de éter não refinado.'),
    t('pulso_vazio', 'Pulso do Vazio', 'eter', 'especial', 60, 100, 20, 'Onda silenciosa que abala a guarda etérea do alvo.', { mod: { alvo: 'alvo', stats: { defEsp: -1 }, c: 0.3 } }),
    t('impacto_atordoante', 'Impacto Atordoante', 'eter', 'fisico', 65, 100, 15, 'Golpe seco que pode fazer o alvo perder a ação.', { atordoar: 0.3 }),
    t('grito_agudo', 'Grito Agudo', 'eter', 'apoio', 0, 100, 20, 'Um berro que faz o adversário encolher a guarda.', { mod: { alvo: 'alvo', stats: { def: -2 }, c: 1 } }),
    t('olhar_perfurante', 'Olhar Perfurante', 'eter', 'apoio', 0, 100, 20, 'Encara o alvo até desestabilizar sua mira.', { mod: { alvo: 'alvo', stats: { prec: -1 }, c: 1 } }),
    t('concentrar', 'Concentrar', 'eter', 'apoio', 0, null, 20, 'Reúne éter interno, elevando o poder e a guarda especial.', { mod: { alvo: 'eu', stats: { atkEsp: 1, defEsp: 1 }, c: 1 } }),
    t('postura_firme', 'Postura Firme', 'eter', 'apoio', 0, null, 20, 'Enraíza as patas e endurece o corpo.', { mod: { alvo: 'eu', stats: { def: 2 }, c: 1 } }),
    t('foco_agudo', 'Foco Agudo', 'eter', 'apoio', 0, null, 15, 'Afia os sentidos: os próximos golpes tendem a ser críticos.', { mod: { alvo: 'eu', stats: { critF: 2 }, c: 1 } }),
    t('descanso_astral', 'Descanso Astral', 'eter', 'apoio', 0, null, 10, 'Absorve éter do ambiente e recupera metade do vigor.', { cura: 0.5 }),

    /* ------------------------------ BRASA ----------------------------- */
    t('fagulha', 'Fagulha', 'brasa', 'especial', 45, 100, 25, 'Cospe uma centelha quente.', { st: { s: 'queimadura', c: 0.1 } }),
    t('garra_ignea', 'Garra Ígnea', 'brasa', 'fisico', 70, 100, 20, 'Garras envoltas em brasa viva.', { st: { s: 'queimadura', c: 0.12 } }),
    t('explosao_brasas', 'Explosão de Brasas', 'brasa', 'especial', 90, 95, 10, 'Libera uma nuvem de carvão incandescente.', { st: { s: 'queimadura', c: 0.2 } }),
    t('fornalha_interna', 'Fornalha Interna', 'brasa', 'apoio', 0, null, 15, 'Acende o núcleo e amplia o poder especial.', { mod: { alvo: 'eu', stats: { atkEsp: 2 }, c: 1 } }),
    t('cometa_incandescente', 'Cometa Incandescente', 'brasa', 'especial', 120, 85, 5, 'Mergulha em chamas; o próprio corpo sofre com o impacto.', { recuo: 0.25, st: { s: 'queimadura', c: 0.15 } }),

    /* ---------------------------- TORRENTE ---------------------------- */
    t('jato_orvalho', 'Jato de Orvalho', 'torrente', 'especial', 45, 100, 25, 'Um esguicho preciso de água etérea.'),
    t('presa_da_mare', 'Presa da Maré', 'torrente', 'fisico', 75, 100, 15, 'Morde com a força de uma onda que quebra.'),
    t('vagalhao', 'Vagalhão', 'torrente', 'especial', 95, 90, 10, 'Ergue uma parede de água e a despeja no alvo.'),
    t('neblina_salgada', 'Neblina Salgada', 'torrente', 'apoio', 0, 100, 20, 'Cobre o campo de bruma e atrapalha a mira inimiga.', { mod: { alvo: 'alvo', stats: { prec: -1 }, c: 1 } }),
    t('espiral_abissal', 'Espiral Abissal', 'torrente', 'especial', 110, 85, 5, 'Um redemoinho vindo das profundezas do Lago Miravel.', { mod: { alvo: 'alvo', stats: { defEsp: -1 }, c: 0.2 } }),

    /* ----------------------------- VERDEJO ---------------------------- */
    t('folha_cortante', 'Folha Cortante', 'verdejo', 'fisico', 55, 95, 25, 'Lâminas vegetais afiadas; acerta pontos vitais com facilidade.', { crit: 1 }),
    t('raiz_sugadora', 'Raiz Sugadora', 'verdejo', 'especial', 65, 100, 15, 'Enraíza no alvo e drena sua seiva astral.', { dreno: 0.5 }),
    t('tempestade_esporos', 'Tempestade de Esporos', 'verdejo', 'apoio', 0, 75, 10, 'Nuvem de esporos que faz o alvo adormecer.', { st: { s: 'sono', c: 1 } }),
    t('lanca_de_cipo', 'Lança de Cipó', 'verdejo', 'fisico', 85, 100, 15, 'Um cipó rígido atravessa o ar como uma lança.'),
    t('florescer', 'Florescer', 'verdejo', 'apoio', 0, null, 10, 'Faz brotar flores curativas sobre o próprio corpo.', { cura: 0.5 }),
    t('ira_da_floresta', 'Ira da Floresta', 'verdejo', 'especial', 115, 85, 5, 'Convoca a fúria do Bosque Solene, ao custo do próprio foco.', { mod: { alvo: 'eu', stats: { atkEsp: -1 }, c: 1 } }),

    /* ----------------------------- FULGOR ----------------------------- */
    t('centelha', 'Centelha', 'fulgor', 'especial', 45, 100, 25, 'Uma faísca curta e certeira.', { st: { s: 'paralisia', c: 0.1 } }),
    t('chicote_voltaico', 'Chicote Voltaico', 'fulgor', 'fisico', 70, 100, 15, 'Um açoite de energia crepitante.', { st: { s: 'paralisia', c: 0.12 } }),
    t('descarga_prismatica', 'Descarga Prismática', 'fulgor', 'especial', 95, 90, 10, 'Fulgor refratado em vários feixes.', { st: { s: 'paralisia', c: 0.2 } }),
    t('teia_estatica', 'Teia Estática', 'fulgor', 'apoio', 0, 90, 20, 'Prende o alvo numa malha de estática.', { st: { s: 'paralisia', c: 1 } }),
    t('lanca_de_raio', 'Lança de Raio', 'fulgor', 'especial', 120, 80, 5, 'Um relâmpago solidificado atravessa o campo.'),

    /* ----------------------------- GÉLIDO ----------------------------- */
    t('sopro_gelado', 'Sopro Gelado', 'gelido', 'especial', 50, 100, 25, 'Um sopro que cristaliza a umidade do ar.', { st: { s: 'congelamento', c: 0.08 } }),
    t('estilhaco_de_gelo', 'Estilhaço de Gelo', 'gelido', 'fisico', 60, 100, 20, 'Lasca de gelo lançada antes que o alvo reaja.', null, 1),
    t('armadura_de_geada', 'Armadura de Geada', 'gelido', 'apoio', 0, null, 15, 'Cobre-se de uma casca espessa de geada.', { mod: { alvo: 'eu', stats: { def: 2 }, c: 1 } }),
    t('nevasca_do_veu', 'Nevasca do Véu', 'gelido', 'especial', 100, 80, 5, 'A tempestade branca que desce do Véu rasgado.', { st: { s: 'congelamento', c: 0.15 } }),

    /* ------------------------------ TERRA ----------------------------- */
    t('pedrada', 'Pedrada', 'terra', 'fisico', 50, 100, 25, 'Arremessa uma pedra bem escolhida.'),
    t('fissura_menor', 'Fissura Menor', 'terra', 'fisico', 80, 95, 15, 'Abre uma greta sob as patas do alvo.'),
    t('muralha_de_seixos', 'Muralha de Seixos', 'terra', 'apoio', 0, null, 20, 'Ergue uma barreira de cascalho flutuante.', { mod: { alvo: 'eu', stats: { def: 1, defEsp: 1 }, c: 1 } }),
    t('colapso_telurico', 'Colapso Telúrico', 'terra', 'fisico', 100, 95, 10, 'Faz o solo inteiro ceder de uma vez.'),

    /* ----------------------------- ZÉFIRO ----------------------------- */
    t('lamina_de_vento', 'Lâmina de Vento', 'zefiro', 'especial', 55, 100, 25, 'Corta o ar em um arco fino e veloz.', { crit: 1 }),
    t('mergulho_veloz', 'Mergulho Veloz', 'zefiro', 'fisico', 75, 100, 20, 'Investida em queda livre.'),
    t('bico_perfurante', 'Bico Perfurante', 'zefiro', 'fisico', 60, 100, 20, 'Bicada seca que pode deixar o alvo sem reação.', { atordoar: 0.3 }),
    t('correnteza_ascendente', 'Correnteza Ascendente', 'zefiro', 'apoio', 0, null, 20, 'Pega uma térmica e ganha velocidade.', { mod: { alvo: 'eu', stats: { vel: 2 }, c: 1 } }),
    t('ciclone_do_passo', 'Ciclone do Passo', 'zefiro', 'especial', 95, 90, 10, 'Um vórtice que arranca o alvo do chão.', { mod: { alvo: 'alvo', stats: { vel: -1 }, c: 0.25 } }),

    /* ------------------------------ UMBRA ----------------------------- */
    t('toque_sombrio', 'Toque Sombrio', 'umbra', 'fisico', 55, 100, 25, 'Um toque frio que apaga a luz ao redor.'),
    t('ceifa_de_ecos', 'Ceifa de Ecos', 'umbra', 'especial', 70, 100, 15, 'Colhe os ecos do alvo e os transforma em vigor.', { dreno: 0.5 }),
    t('veu_de_temor', 'Véu de Temor', 'umbra', 'apoio', 0, 100, 20, 'Envolve o alvo em medo e enfraquece seus golpes.', { mod: { alvo: 'alvo', stats: { atk: -2 }, c: 1 } }),
    t('abraco_da_penumbra', 'Abraço da Penumbra', 'umbra', 'especial', 95, 90, 10, 'A sombra se fecha como um casulo.', { mod: { alvo: 'alvo', stats: { atkEsp: -1 }, c: 0.25 } }),

    /* ----------------------------- AURORA ----------------------------- */
    t('faisca_solar', 'Faísca Solar', 'aurora', 'especial', 50, 100, 25, 'Um ponto de luz primordial.'),
    t('lamina_radiante', 'Lâmina Radiante', 'aurora', 'fisico', 75, 100, 15, 'Luz condensada em fio de corte.'),
    t('bencao_tenue', 'Bênção Tênue', 'aurora', 'apoio', 0, null, 10, 'Um halo morno reconstitui o corpo.', { cura: 0.5 }),
    t('juizo_da_alvorada', 'Juízo da Alvorada', 'aurora', 'especial', 100, 90, 10, 'A primeira luz do dia cai como sentença.', { mod: { alvo: 'alvo', stats: { defEsp: -1 }, c: 0.2 } }),

    /* ------------------------------ FERRO ----------------------------- */
    t('ferrao_metalico', 'Ferrão Metálico', 'ferro', 'fisico', 55, 100, 25, 'Uma ponta de liga etérea perfura a guarda.'),
    t('salva_de_estilhacos', 'Salva de Estilhaços', 'ferro', 'fisico', 25, 95, 20, 'Dispara de 2 a 5 lascas de metal.', { multi: [2, 5] }),
    t('prensa_de_aco', 'Prensa de Aço', 'ferro', 'fisico', 85, 95, 15, 'Comprime o alvo entre placas de metal vivo.', { mod: { alvo: 'alvo', stats: { def: -1 }, c: 0.25 } }),
    t('polir_a_lamina', 'Polir a Lâmina', 'ferro', 'apoio', 0, null, 20, 'Afia e endurece as próprias placas.', { mod: { alvo: 'eu', stats: { atk: 1, def: 1 }, c: 1 } }),

    /* ----------------------------- TOXINA ----------------------------- */
    t('respingo_acido', 'Respingo Ácido', 'toxina', 'especial', 45, 100, 25, 'Espirra um fluido corrosivo.', { st: { s: 'veneno', c: 0.15 } }),
    t('presa_venenosa', 'Presa Venenosa', 'toxina', 'fisico', 70, 100, 15, 'Uma mordida que injeta éter apodrecido.', { st: { s: 'veneno', c: 0.2 } }),
    t('miasma', 'Miasma', 'toxina', 'apoio', 0, 90, 15, 'Espalha uma névoa que intoxica quem respira.', { st: { s: 'veneno', c: 1 } }),
    t('corrosao_total', 'Corrosão Total', 'toxina', 'especial', 95, 90, 10, 'Dissolve tudo que toca, inclusive defesas.', { mod: { alvo: 'alvo', stats: { def: -1 }, c: 0.3 } })
  ];

  G.TECNICAS = {};
  L.forEach(function (m) { G.TECNICAS[m.id] = m; });
  G.LISTA_TECNICAS = L;

  G.tecnica = function (id) { return G.TECNICAS[id] || null; };

  /* ------------------------- Condições de estado ------------------------ */
  G.CONDICOES = {
    queimadura:   { nome: 'Queimadura',   sigla: 'QMD', cor: '#e2653a', desc: 'Perde vigor a cada turno e ataca com metade da força física.' },
    veneno:       { nome: 'Envenenado',   sigla: 'VEN', cor: '#a45bd4', desc: 'Perde vigor a cada turno, cada vez mais.' },
    paralisia:    { nome: 'Paralisia',    sigla: 'PAR', cor: '#e0c03a', desc: 'Velocidade reduzida; pode travar e perder o turno.' },
    congelamento: { nome: 'Congelado',    sigla: 'CNG', cor: '#6fc4e8', desc: 'Não age até se libertar do gelo.' },
    sono:         { nome: 'Adormecido',   sigla: 'SON', cor: '#8f8fd0', desc: 'Não age por alguns turnos.' }
  };

})(window.CRISALIDA);
