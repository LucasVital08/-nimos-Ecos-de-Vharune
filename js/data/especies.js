/* =========================================================================
   especies.js — As 28 espécies de Ânimos de Vharune
   ---------------------------------------------------------------------
   base : atributos base {hp, atk, def, atkEsp, defEsp, vel}
   cap  : taxa de captura (3 = quase impossível, 200 = fácil)
   xpB  : rendimento de experiência
   evo  : { para:'id', nivel:n }
   apr  : lista [nivel, idTecnica] — técnicas aprendidas por nível
   art  : arquétipo + paleta + opções de desenho procedural
   ========================================================================= */
(function (G) {
  'use strict';

  function e(o) { return o; }

  var LISTA = [

    /* ======================= LINHA DO BROTO (Verdejo) ================== */
    e({
      num: 1, id: 'verdil', nome: 'Verdil', tipos: ['verdejo'],
      categoria: 'Ânimo do Broto',
      base: { hp: 45, atk: 49, def: 49, atkEsp: 55, defEsp: 55, vel: 45 },
      cap: 45, xpB: 62, altura: 0.4, peso: 6.2,
      desc: 'Nasce sob raízes queimadas pela primeira chuva de Orva. O broto nas costas endurece quando o Verdil sente medo — e floresce quando ele confia em alguém.',
      evo: { para: 'frondor', nivel: 16 },
      apr: [[1, 'investida'], [1, 'folha_cortante'], [5, 'postura_firme'], [9, 'raiz_sugadora'], [14, 'lanca_de_cipo'], [18, 'tempestade_esporos'], [24, 'florescer'], [30, 'ira_da_floresta']],
      art: {
        arch: 'quadrupede', c1: [104, 42, 44], c2: [96, 38, 33], c3: [78, 62, 62], olho: [40, 90, 58],
        o: { escala: 0.78, corpoRX: 24, corpoRY: 18, cabecaR: 16, crista: 'folha', orelhas: 'pontuda', cauda: 'folha', olhos: 'redondo', boca: 'sorriso', patas: 4 }
      }
    }),
    e({
      num: 2, id: 'frondor', nome: 'Frondor', tipos: ['verdejo'],
      categoria: 'Ânimo da Fronde',
      base: { hp: 60, atk: 62, def: 63, atkEsp: 70, defEsp: 70, vel: 60 },
      cap: 90, xpB: 142, altura: 1.0, peso: 28.5,
      desc: 'A folhagem do dorso funciona como um pequeno pulmão de éter. Frondores dormem em pé, apoiados em árvores que eles mesmos plantaram.',
      evo: { para: 'silvarion', nivel: 32 },
      apr: [[1, 'investida'], [1, 'folha_cortante'], [1, 'postura_firme'], [12, 'raiz_sugadora'], [17, 'lanca_de_cipo'], [22, 'tempestade_esporos'], [28, 'florescer'], [35, 'colapso_telurico'], [40, 'ira_da_floresta']],
      art: {
        arch: 'quadrupede', c1: [110, 45, 38], c2: [100, 42, 28], c3: [64, 68, 58], olho: [40, 92, 56],
        o: { escala: 0.95, corpoRX: 28, corpoRY: 21, cabecaR: 17, crista: 'folha', orelhas: 'longa', cauda: 'folha', olhos: 'felino', boca: 'presas', patas: 4, placas: true }
      }
    }),
    e({
      num: 3, id: 'silvarion', nome: 'Silvárion', tipos: ['verdejo', 'terra'],
      categoria: 'Ânimo Ancestral',
      base: { hp: 82, atk: 85, def: 88, atkEsp: 95, defEsp: 92, vel: 78 },
      cap: 45, xpB: 236, altura: 2.1, peso: 168.0,
      desc: 'Carrega um bosque inteiro no lombo. Diz a tradição de Cinzalva que, onde um Silvárion se deita para descansar, uma clareira nasce em uma noite.',
      evo: null,
      apr: [[1, 'folha_cortante'], [1, 'pedrada'], [1, 'postura_firme'], [1, 'lanca_de_cipo'], [26, 'muralha_de_seixos'], [32, 'raiz_sugadora'], [38, 'florescer'], [44, 'colapso_telurico'], [52, 'ira_da_floresta']],
      art: {
        arch: 'quadrupede', c1: [116, 40, 33], c2: [30, 30, 26], c3: [58, 72, 55], olho: [45, 95, 60],
        o: { escala: 1.12, corpoRX: 32, corpoRY: 24, cabecaR: 18, crista: 'chifres', orelhas: 'longa', cauda: 'folha', olhos: 'felino', boca: 'presas', patas: 4, placas: true, dorso: 'arvore' }
      }
    }),

    /* ======================= LINHA DA BRASA (Brasa) ==================== */
    e({
      num: 4, id: 'fagulho', nome: 'Fagulho', tipos: ['brasa'],
      categoria: 'Ânimo da Centelha',
      base: { hp: 44, atk: 54, def: 44, atkEsp: 58, defEsp: 50, vel: 58 },
      cap: 45, xpB: 62, altura: 0.5, peso: 7.8,
      desc: 'Solta faíscas quando espirra. Vinculistas experientes dizem que a cor da chama da cauda revela o humor do Fagulho melhor que qualquer palavra.',
      evo: { para: 'brasavo', nivel: 16 },
      apr: [[1, 'investida'], [1, 'fagulha'], [6, 'olhar_perfurante'], [10, 'garra_ignea'], [15, 'golpe_veloz'], [20, 'fornalha_interna'], [26, 'explosao_brasas'], [33, 'cometa_incandescente']],
      art: {
        arch: 'quadrupede', c1: [22, 82, 55], c2: [10, 78, 42], c3: [45, 96, 62], olho: [200, 70, 55],
        o: { escala: 0.78, corpoRX: 23, corpoRY: 17, cabecaR: 16, crista: 'chama', orelhas: 'pontuda', cauda: 'chama', olhos: 'felino', boca: 'presas', patas: 4 }
      }
    }),
    e({
      num: 5, id: 'brasavo', nome: 'Brasavo', tipos: ['brasa'],
      categoria: 'Ânimo da Fornalha',
      base: { hp: 58, atk: 68, def: 56, atkEsp: 74, defEsp: 62, vel: 76 },
      cap: 90, xpB: 142, altura: 1.1, peso: 34.0,
      desc: 'O peito abre pequenas fendas por onde o calor escapa. Um Brasavo em corrida deixa rastros de vidro derretido na areia do Lago Miravel.',
      evo: { para: 'ignareth', nivel: 32 },
      apr: [[1, 'investida'], [1, 'fagulha'], [1, 'olhar_perfurante'], [13, 'garra_ignea'], [18, 'golpe_veloz'], [24, 'fornalha_interna'], [30, 'explosao_brasas'], [37, 'impacto_atordoante'], [42, 'cometa_incandescente']],
      art: {
        arch: 'bipede', c1: [16, 85, 50], c2: [4, 72, 38], c3: [42, 98, 60], olho: [195, 75, 55],
        o: { escala: 0.95, corpoRX: 22, corpoRY: 26, cabecaR: 16, crista: 'chama', orelhas: 'pontuda', cauda: 'chama', olhos: 'felino', boca: 'presas', garras: true }
      }
    }),
    e({
      num: 6, id: 'ignareth', nome: 'Ignareth', tipos: ['brasa', 'umbra'],
      categoria: 'Ânimo do Fogo-Fátuo',
      base: { hp: 78, atk: 92, def: 74, atkEsp: 104, defEsp: 82, vel: 100 },
      cap: 45, xpB: 240, altura: 1.8, peso: 76.4,
      desc: 'Sua chama não ilumina: consome a luz ao redor e devolve calor. Foi visto pela primeira vez nas Ruínas de Aldherin, guardando um portal apagado.',
      evo: null,
      apr: [[1, 'garra_ignea'], [1, 'toque_sombrio'], [1, 'golpe_veloz'], [1, 'fornalha_interna'], [28, 'explosao_brasas'], [34, 'ceifa_de_ecos'], [40, 'abraco_da_penumbra'], [47, 'cometa_incandescente']],
      art: {
        arch: 'bipede', c1: [8, 78, 42], c2: [280, 35, 22], c3: [40, 100, 62], olho: [190, 85, 60],
        o: { escala: 1.08, corpoRX: 23, corpoRY: 28, cabecaR: 16, crista: 'chifres', orelhas: 'pontuda', cauda: 'chama', olhos: 'fenda', boca: 'presas', garras: true, capa: true }
      }
    }),

    /* ====================== LINHA DA MARÉ (Torrente) =================== */
    e({
      num: 7, id: 'gotil', nome: 'Gotil', tipos: ['torrente'],
      categoria: 'Ânimo da Gota',
      base: { hp: 48, atk: 48, def: 52, atkEsp: 56, defEsp: 56, vel: 44 },
      cap: 45, xpB: 62, altura: 0.4, peso: 9.1,
      desc: 'Metade do corpo é água etérea contida por uma membrana finíssima. Quando ri, pequenas bolhas escapam pelas laterais da cabeça.',
      evo: { para: 'marulo', nivel: 16 },
      apr: [[1, 'investida'], [1, 'jato_orvalho'], [6, 'neblina_salgada'], [11, 'presa_da_mare'], [16, 'pulso_vazio'], [21, 'descanso_astral'], [27, 'vagalhao'], [34, 'espiral_abissal']],
      art: {
        arch: 'ameba', c1: [200, 68, 55], c2: [212, 62, 42], c3: [186, 70, 72], olho: [30, 20, 22],
        o: { escala: 0.8, corpoRX: 25, corpoRY: 23, cabecaR: 0, crista: 'nenhuma', orelhas: 'barbatana', cauda: 'gota', olhos: 'redondo', boca: 'sorriso', bolhas: true }
      }
    }),
    e({
      num: 8, id: 'marulo', nome: 'Marulo', tipos: ['torrente'],
      categoria: 'Ânimo da Ressaca',
      base: { hp: 62, atk: 62, def: 68, atkEsp: 72, defEsp: 72, vel: 58 },
      cap: 90, xpB: 142, altura: 1.0, peso: 42.0,
      desc: 'A crista de água nas costas nunca para de se mover, mesmo em terra firme. Marulos guiam barcos perdidos por pura teimosia.',
      evo: { para: 'abyssaro', nivel: 32 },
      apr: [[1, 'investida'], [1, 'jato_orvalho'], [1, 'neblina_salgada'], [13, 'presa_da_mare'], [19, 'pulso_vazio'], [25, 'descanso_astral'], [31, 'vagalhao'], [38, 'sopro_gelado'], [43, 'espiral_abissal']],
      art: {
        arch: 'quadrupede', c1: [204, 62, 48], c2: [216, 58, 36], c3: [180, 72, 70], olho: [30, 25, 20],
        o: { escala: 0.96, corpoRX: 28, corpoRY: 20, cabecaR: 17, crista: 'onda', orelhas: 'barbatana', cauda: 'leque', olhos: 'redondo', boca: 'presas', patas: 4 }
      }
    }),
    e({
      num: 9, id: 'abyssaro', nome: 'Abyssaro', tipos: ['torrente', 'umbra'],
      categoria: 'Ânimo do Abismo',
      base: { hp: 88, atk: 86, def: 94, atkEsp: 96, defEsp: 94, vel: 70 },
      cap: 45, xpB: 238, altura: 2.4, peso: 210.0,
      desc: 'Vive no fundo do Lago Miravel, onde a luz do Véu não chega. Seus olhos guardam a única imagem conhecida de Orva inteira, antes da fenda.',
      evo: null,
      apr: [[1, 'presa_da_mare'], [1, 'toque_sombrio'], [1, 'neblina_salgada'], [1, 'pulso_vazio'], [30, 'vagalhao'], [36, 'ceifa_de_ecos'], [42, 'abraco_da_penumbra'], [50, 'espiral_abissal']],
      art: {
        arch: 'aquatico', c1: [214, 58, 34], c2: [258, 40, 24], c3: [176, 78, 62], olho: [48, 95, 62],
        o: { escala: 1.14, corpoRX: 33, corpoRY: 22, cabecaR: 18, crista: 'espinhos', orelhas: 'barbatana', cauda: 'leque', olhos: 'brilho', boca: 'presas', tentaculos: true }
      }
    }),

    /* ============================ TERRA / FERRO ======================== */
    e({
      num: 10, id: 'terrino', nome: 'Terrino', tipos: ['terra'],
      categoria: 'Ânimo do Seixo',
      base: { hp: 55, atk: 62, def: 70, atkEsp: 32, defEsp: 38, vel: 32 },
      cap: 150, xpB: 60, altura: 0.5, peso: 48.0,
      desc: 'Um punhado de cascalho que decidiu andar. Come pedras pequenas e cospe areia fina quando está satisfeito.',
      evo: { para: 'geodante', nivel: 22 },
      apr: [[1, 'investida'], [1, 'pedrada'], [7, 'postura_firme'], [12, 'fissura_menor'], [18, 'muralha_de_seixos'], [25, 'impacto_atordoante'], [31, 'colapso_telurico']],
      art: {
        arch: 'golem', c1: [28, 32, 44], c2: [24, 28, 32], c3: [40, 55, 60], olho: [45, 90, 62],
        o: { escala: 0.82, corpoRX: 26, corpoRY: 22, cabecaR: 0, crista: 'espinhos', orelhas: 'nenhuma', cauda: 'nenhuma', olhos: 'brilho', boca: 'nenhuma', blocos: true }
      }
    }),
    e({
      num: 11, id: 'geodante', nome: 'Geodante', tipos: ['terra', 'ferro'],
      categoria: 'Ânimo do Alicerce',
      base: { hp: 85, atk: 105, def: 125, atkEsp: 45, defEsp: 62, vel: 38 },
      cap: 60, xpB: 198, altura: 1.9, peso: 340.0,
      desc: 'Cristais de liga étera crescem entre suas placas. Um único Geodante já segurou sozinho o desmoronamento do Passo Ferrugem por três dias.',
      evo: null,
      apr: [[1, 'pedrada'], [1, 'ferrao_metalico'], [1, 'postura_firme'], [1, 'fissura_menor'], [24, 'muralha_de_seixos'], [30, 'prensa_de_aco'], [36, 'polir_a_lamina'], [43, 'colapso_telurico']],
      art: {
        arch: 'golem', c1: [26, 26, 38], c2: [212, 12, 46], c3: [186, 60, 62], olho: [48, 95, 62],
        o: { escala: 1.1, corpoRX: 30, corpoRY: 28, cabecaR: 0, crista: 'cristal', orelhas: 'nenhuma', cauda: 'nenhuma', olhos: 'brilho', boca: 'nenhuma', blocos: true, bracos: true }
      }
    }),

    /* ============================== ZÉFIRO ============================= */
    e({
      num: 12, id: 'pardalume', nome: 'Pardalume', tipos: ['zefiro'],
      categoria: 'Ânimo do Sopro',
      base: { hp: 42, atk: 48, def: 38, atkEsp: 40, defEsp: 40, vel: 68 },
      cap: 190, xpB: 52, altura: 0.3, peso: 1.9,
      desc: 'Cabe na palma da mão e nunca fica quieto. É o primeiro Ânimo que quase todo vinculista de Cinzalva captura.',
      evo: { para: 'falceu', nivel: 20 },
      apr: [[1, 'investida'], [1, 'lamina_de_vento'], [5, 'golpe_veloz'], [10, 'bico_perfurante'], [15, 'correnteza_ascendente'], [21, 'mergulho_veloz'], [28, 'ciclone_do_passo']],
      art: {
        arch: 'ave', c1: [174, 38, 58], c2: [190, 34, 44], c3: [40, 78, 62], olho: [30, 30, 20],
        o: { escala: 0.7, corpoRX: 18, corpoRY: 16, cabecaR: 13, crista: 'pena', orelhas: 'nenhuma', cauda: 'leque', asas: 'pena', olhos: 'redondo', boca: 'bico', patas: 2 }
      }
    }),
    e({
      num: 13, id: 'falceu', nome: 'Falcéu', tipos: ['zefiro', 'aurora'],
      categoria: 'Ânimo do Horizonte',
      base: { hp: 72, atk: 82, def: 66, atkEsp: 78, defEsp: 72, vel: 108 },
      cap: 75, xpB: 205, altura: 1.5, peso: 26.0,
      desc: 'Voa alto o bastante para tocar as bordas do Véu, e volta com penas mornas de luz. Enxerga um Ânimo escondido a três colinas de distância.',
      evo: null,
      apr: [[1, 'lamina_de_vento'], [1, 'faisca_solar'], [1, 'golpe_veloz'], [1, 'bico_perfurante'], [24, 'correnteza_ascendente'], [30, 'mergulho_veloz'], [36, 'lamina_radiante'], [42, 'ciclone_do_passo'], [48, 'juizo_da_alvorada']],
      art: {
        arch: 'ave', c1: [186, 42, 52], c2: [206, 38, 38], c3: [44, 92, 64], olho: [48, 92, 58],
        o: { escala: 1.02, corpoRX: 22, corpoRY: 19, cabecaR: 14, crista: 'pena', orelhas: 'nenhuma', cauda: 'leque', asas: 'pena', olhos: 'fenda', boca: 'bico', patas: 2, asaGrande: true, halo: true }
      }
    }),

    /* =============================== UMBRA ============================= */
    e({
      num: 14, id: 'noctun', nome: 'Noctun', tipos: ['umbra'],
      categoria: 'Ânimo da Vela Apagada',
      base: { hp: 45, atk: 45, def: 40, atkEsp: 62, defEsp: 55, vel: 58 },
      cap: 120, xpB: 68, altura: 0.6, peso: 0.9,
      desc: 'Não tem peso mensurável. Aparece em casas onde alguém acabou de apagar a última luz — e some assim que a lamparina volta a acender.',
      evo: { para: 'umbrafex', nivel: 24 },
      apr: [[1, 'toque_sombrio'], [1, 'olhar_perfurante'], [8, 'pulso_vazio'], [13, 'veu_de_temor'], [19, 'ceifa_de_ecos'], [26, 'concentrar'], [32, 'abraco_da_penumbra']],
      art: {
        arch: 'espectro', c1: [268, 38, 40], c2: [252, 32, 26], c3: [286, 60, 66], olho: [52, 96, 66],
        o: { escala: 0.78, corpoRX: 20, corpoRY: 22, cabecaR: 15, crista: 'nenhuma', orelhas: 'pontuda', cauda: 'nevoa', olhos: 'brilho', boca: 'sorriso' }
      }
    }),
    e({
      num: 15, id: 'umbrafex', nome: 'Umbrafex', tipos: ['umbra', 'zefiro'],
      categoria: 'Ânimo do Eclipse',
      base: { hp: 70, atk: 72, def: 62, atkEsp: 95, defEsp: 82, vel: 92 },
      cap: 60, xpB: 202, altura: 1.6, peso: 4.2,
      desc: 'Desliza pelo ar como tinta caindo na água. Os anciãos de Cinzalva juram que um Umbrafex nunca ataca quem está genuinamente perdido.',
      evo: null,
      apr: [[1, 'toque_sombrio'], [1, 'lamina_de_vento'], [1, 'veu_de_temor'], [1, 'pulso_vazio'], [28, 'ceifa_de_ecos'], [34, 'concentrar'], [40, 'ciclone_do_passo'], [46, 'abraco_da_penumbra']],
      art: {
        arch: 'espectro', c1: [272, 44, 30], c2: [200, 30, 20], c3: [292, 72, 62], olho: [56, 98, 68],
        o: { escala: 1.04, corpoRX: 23, corpoRY: 26, cabecaR: 16, crista: 'chifres', orelhas: 'longa', cauda: 'nevoa', olhos: 'fenda', boca: 'presas', asas: 'eterea', capa: true }
      }
    }),

    /* =============================== FULGOR ============================ */
    e({
      num: 16, id: 'faisco', nome: 'Faísco', tipos: ['fulgor'],
      categoria: 'Ânimo da Estática',
      base: { hp: 40, atk: 45, def: 38, atkEsp: 65, defEsp: 50, vel: 72 },
      cap: 140, xpB: 66, altura: 0.3, peso: 3.4,
      desc: 'Arrepia todo pelo num raio de dois passos. Adora dormir sobre telhados de metal, o que raramente termina bem para o telhado.',
      evo: { para: 'trovanel', nivel: 22 },
      apr: [[1, 'investida'], [1, 'centelha'], [6, 'teia_estatica'], [11, 'golpe_veloz'], [17, 'chicote_voltaico'], [23, 'concentrar'], [29, 'descarga_prismatica'], [36, 'lanca_de_raio']],
      art: {
        arch: 'inseto', c1: [50, 88, 58], c2: [38, 80, 44], c3: [200, 20, 92], olho: [220, 40, 22],
        o: { escala: 0.72, corpoRX: 19, corpoRY: 16, cabecaR: 13, crista: 'antena', orelhas: 'nenhuma', cauda: 'espinho', asas: 'inseto', olhos: 'composto', boca: 'nenhuma', patas: 4, raios: true }
      }
    }),
    e({
      num: 17, id: 'trovanel', nome: 'Trovanel', tipos: ['fulgor'],
      categoria: 'Ânimo do Trovão',
      base: { hp: 68, atk: 72, def: 62, atkEsp: 104, defEsp: 78, vel: 104 },
      cap: 60, xpB: 210, altura: 1.3, peso: 39.5,
      desc: 'Quando corre, o ar atrás dele estala por vários segundos. Vinculistas medem a força de um Trovanel pelo tempo que o eco demora a sumir.',
      evo: null,
      apr: [[1, 'centelha'], [1, 'teia_estatica'], [1, 'golpe_veloz'], [1, 'chicote_voltaico'], [26, 'concentrar'], [32, 'descarga_prismatica'], [39, 'correnteza_ascendente'], [45, 'lanca_de_raio']],
      art: {
        arch: 'quadrupede', c1: [46, 92, 55], c2: [32, 84, 40], c3: [198, 25, 94], olho: [212, 50, 26],
        o: { escala: 1.0, corpoRX: 27, corpoRY: 18, cabecaR: 16, crista: 'espinhos', orelhas: 'pontuda', cauda: 'raio', olhos: 'fenda', boca: 'presas', patas: 4, raios: true }
      }
    }),

    /* =============================== GÉLIDO ============================ */
    e({
      num: 18, id: 'gelim', nome: 'Gelim', tipos: ['gelido'],
      categoria: 'Ânimo do Orvalho Frio',
      base: { hp: 52, atk: 40, def: 58, atkEsp: 60, defEsp: 62, vel: 40 },
      cap: 130, xpB: 70, altura: 0.4, peso: 12.0,
      desc: 'Deixa um rastro de geada por onde passa. Se ficar feliz demais, congela acidentalmente o próprio alimento.',
      evo: { para: 'nevarco', nivel: 26 },
      apr: [[1, 'investida'], [1, 'sopro_gelado'], [7, 'armadura_de_geada'], [12, 'estilhaco_de_gelo'], [18, 'neblina_salgada'], [25, 'descanso_astral'], [32, 'nevasca_do_veu']],
      art: {
        arch: 'ameba', c1: [190, 58, 68], c2: [204, 52, 54], c3: [200, 30, 92], olho: [220, 45, 26],
        o: { escala: 0.8, corpoRX: 24, corpoRY: 22, cabecaR: 0, crista: 'cristal', orelhas: 'nenhuma', cauda: 'nenhuma', olhos: 'redondo', boca: 'sorriso', cristais: true }
      }
    }),
    e({
      num: 19, id: 'nevarco', nome: 'Nevarco', tipos: ['gelido', 'ferro'],
      categoria: 'Ânimo da Nevasca',
      base: { hp: 82, atk: 68, def: 106, atkEsp: 88, defEsp: 96, vel: 48 },
      cap: 55, xpB: 208, altura: 2.0, peso: 186.0,
      desc: 'Sua carapaça é gelo comprimido até virar liga. Nevarcos vagam pelo Passo Ferrugem carregando ninhos inteiros de Ânimos menores nas costas.',
      evo: null,
      apr: [[1, 'sopro_gelado'], [1, 'ferrao_metalico'], [1, 'armadura_de_geada'], [1, 'estilhaco_de_gelo'], [28, 'muralha_de_seixos'], [34, 'prensa_de_aco'], [40, 'descanso_astral'], [47, 'nevasca_do_veu']],
      art: {
        arch: 'golem', c1: [196, 42, 58], c2: [210, 20, 46], c3: [186, 70, 82], olho: [220, 55, 30],
        o: { escala: 1.12, corpoRX: 30, corpoRY: 27, cabecaR: 0, crista: 'cristal', orelhas: 'nenhuma', cauda: 'nenhuma', olhos: 'brilho', boca: 'nenhuma', blocos: true, bracos: true, cristais: true }
      }
    }),

    /* =============================== TOXINA ============================ */
    e({
      num: 20, id: 'chorumel', nome: 'Chorumel', tipos: ['toxina'],
      categoria: 'Ânimo do Resíduo',
      base: { hp: 60, atk: 45, def: 48, atkEsp: 58, defEsp: 52, vel: 38 },
      cap: 160, xpB: 64, altura: 0.6, peso: 22.0,
      desc: 'Formou-se em poças de éter estragado. Apesar do cheiro, é dócil, curioso e absurdamente leal a quem lhe dá comida limpa.',
      evo: { para: 'miasmor', nivel: 24 },
      apr: [[1, 'investida'], [1, 'respingo_acido'], [8, 'miasma'], [13, 'grito_agudo'], [19, 'presa_venenosa'], [26, 'descanso_astral'], [33, 'corrosao_total']],
      art: {
        arch: 'ameba', c1: [290, 42, 46], c2: [278, 36, 32], c3: [96, 70, 55], olho: [60, 90, 62],
        o: { escala: 0.86, corpoRX: 26, corpoRY: 21, cabecaR: 0, crista: 'nenhuma', orelhas: 'nenhuma', cauda: 'nenhuma', olhos: 'brilho', boca: 'sorriso', gotejo: true, bolhas: true }
      }
    }),
    e({
      num: 21, id: 'miasmor', nome: 'Miasmor', tipos: ['toxina', 'umbra'],
      categoria: 'Ânimo do Pântano Fundo',
      base: { hp: 92, atk: 62, def: 70, atkEsp: 98, defEsp: 86, vel: 56 },
      cap: 50, xpB: 200, altura: 1.7, peso: 88.0,
      desc: 'Um corpo de névoa densa com dezenas de olhos que raramente piscam ao mesmo tempo. Purifica água ao dormir — ninguém sabe explicar por quê.',
      evo: null,
      apr: [[1, 'respingo_acido'], [1, 'toque_sombrio'], [1, 'miasma'], [1, 'presa_venenosa'], [28, 'veu_de_temor'], [34, 'ceifa_de_ecos'], [41, 'abraco_da_penumbra'], [47, 'corrosao_total']],
      art: {
        arch: 'espectro', c1: [296, 46, 34], c2: [270, 38, 24], c3: [104, 78, 52], olho: [64, 96, 64],
        o: { escala: 1.06, corpoRX: 26, corpoRY: 25, cabecaR: 17, crista: 'espinhos', orelhas: 'nenhuma', cauda: 'nevoa', olhos: 'multiplos', boca: 'presas', gotejo: true }
      }
    }),

    /* ================================ FERRO ============================ */
    e({
      num: 22, id: 'ferrusco', nome: 'Ferrusco', tipos: ['ferro'],
      categoria: 'Ânimo da Lasca',
      base: { hp: 50, atk: 62, def: 78, atkEsp: 35, defEsp: 45, vel: 40 },
      cap: 140, xpB: 66, altura: 0.4, peso: 40.0,
      desc: 'Nasce de pregos e dobradiças abandonadas nas minas. Rola pelo chão para se limpar e range quando está com fome.',
      evo: { para: 'aciarno', nivel: 28 },
      apr: [[1, 'investida'], [1, 'ferrao_metalico'], [7, 'postura_firme'], [13, 'salva_de_estilhacos'], [19, 'polir_a_lamina'], [26, 'pedrada'], [33, 'prensa_de_aco']],
      art: {
        arch: 'inseto', c1: [212, 16, 52], c2: [206, 14, 38], c3: [24, 55, 48], olho: [16, 80, 55],
        o: { escala: 0.78, corpoRX: 22, corpoRY: 18, cabecaR: 13, crista: 'espinhos', orelhas: 'nenhuma', cauda: 'espinho', olhos: 'composto', boca: 'presas', patas: 4, placas: true }
      }
    }),
    e({
      num: 23, id: 'aciarno', nome: 'Aciarno', tipos: ['ferro', 'terra'],
      categoria: 'Ânimo da Bigorna',
      base: { hp: 80, atk: 108, def: 118, atkEsp: 48, defEsp: 66, vel: 48 },
      cap: 50, xpB: 214, altura: 2.2, peso: 402.0,
      desc: 'Cada passo dele registra nos sismógrafos improvisados de Passo Ferrugem. Aceita ser montado — mas só por quem já provou não ter pressa.',
      evo: null,
      apr: [[1, 'ferrao_metalico'], [1, 'pedrada'], [1, 'polir_a_lamina'], [1, 'salva_de_estilhacos'], [30, 'fissura_menor'], [36, 'prensa_de_aco'], [42, 'impacto_atordoante'], [49, 'colapso_telurico']],
      art: {
        arch: 'quadrupede', c1: [210, 14, 44], c2: [28, 40, 34], c3: [20, 70, 52], olho: [14, 85, 58],
        o: { escala: 1.14, corpoRX: 32, corpoRY: 22, cabecaR: 18, crista: 'chifres', orelhas: 'nenhuma', cauda: 'espinho', olhos: 'fenda', boca: 'presas', patas: 4, placas: true }
      }
    }),

    /* =============================== AURORA ============================ */
    e({
      num: 24, id: 'luminel', nome: 'Luminel', tipos: ['aurora'],
      categoria: 'Ânimo do Lampejo',
      base: { hp: 48, atk: 40, def: 45, atkEsp: 70, defEsp: 62, vel: 60 },
      cap: 110, xpB: 74, altura: 0.5, peso: 5.0,
      desc: 'Brilha mais forte quando alguém olha diretamente para ele — o que o deixa profundamente sem graça.',
      evo: { para: 'auroreth', nivel: 30 },
      apr: [[1, 'faisca_solar'], [1, 'olhar_perfurante'], [8, 'concentrar'], [14, 'lamina_radiante'], [20, 'bencao_tenue'], [27, 'pulso_vazio'], [34, 'juizo_da_alvorada']],
      art: {
        arch: 'espectro', c1: [48, 88, 66], c2: [36, 82, 54], c3: [186, 40, 88], olho: [30, 40, 30],
        o: { escala: 0.8, corpoRX: 20, corpoRY: 20, cabecaR: 15, crista: 'halo', orelhas: 'longa', cauda: 'nevoa', olhos: 'redondo', boca: 'sorriso', halo: true }
      }
    }),
    e({
      num: 25, id: 'auroreth', nome: 'Auroreth', tipos: ['aurora'],
      categoria: 'Ânimo da Primeira Luz',
      base: { hp: 78, atk: 62, def: 72, atkEsp: 112, defEsp: 98, vel: 76 },
      cap: 45, xpB: 220, altura: 1.7, peso: 31.0,
      desc: 'Dizem que a luz de um Auroreth desceu de Orva na primeira noite da Fratura e nunca mais mudou de tom.',
      evo: null,
      apr: [[1, 'faisca_solar'], [1, 'lamina_radiante'], [1, 'concentrar'], [1, 'bencao_tenue'], [32, 'pulso_vazio'], [38, 'rajada_etera'], [44, 'foco_agudo'], [50, 'juizo_da_alvorada']],
      art: {
        arch: 'bipede', c1: [46, 92, 62], c2: [32, 86, 48], c3: [190, 45, 92], olho: [28, 45, 32],
        o: { escala: 1.05, corpoRX: 20, corpoRY: 25, cabecaR: 16, crista: 'halo', orelhas: 'longa', cauda: 'leque', olhos: 'brilho', boca: 'sorriso', asas: 'eterea', halo: true, capa: true }
      }
    }),

    /* ========================= ESPÉCIES SOLITÁRIAS ===================== */
    e({
      num: 26, id: 'fungor', nome: 'Fungor', tipos: ['verdejo', 'toxina'],
      categoria: 'Ânimo do Fungo Antigo',
      base: { hp: 78, atk: 72, def: 78, atkEsp: 72, defEsp: 78, vel: 32 },
      cap: 70, xpB: 172, altura: 1.2, peso: 64.0,
      desc: 'Cresceu sobre uma ruína e nunca mais saiu de lá. Seu chapéu solta esporos que só fazem mal a quem chega com má intenção.',
      evo: null,
      apr: [[1, 'investida'], [1, 'respingo_acido'], [1, 'folha_cortante'], [12, 'tempestade_esporos'], [20, 'raiz_sugadora'], [27, 'miasma'], [34, 'lanca_de_cipo'], [41, 'corrosao_total']],
      art: {
        arch: 'ameba', c1: [100, 38, 42], c2: [286, 40, 40], c3: [46, 60, 70], olho: [30, 25, 18],
        o: { escala: 0.95, corpoRX: 24, corpoRY: 22, cabecaR: 0, crista: 'chapeu', orelhas: 'nenhuma', cauda: 'nenhuma', olhos: 'brilho', boca: 'nenhuma', gotejo: true, patas: 2 }
      }
    }),
    e({
      num: 27, id: 'escamiro', nome: 'Escamiro', tipos: ['torrente', 'gelido'],
      categoria: 'Ânimo da Correnteza Fria',
      base: { hp: 70, atk: 80, def: 68, atkEsp: 72, defEsp: 68, vel: 82 },
      cap: 80, xpB: 178, altura: 1.4, peso: 55.0,
      desc: 'Sobe corredeiras congeladas contra a corrente por puro orgulho. Escamas afiadas o suficiente para cortar a linha de um pescador desatento.',
      evo: null,
      apr: [[1, 'jato_orvalho'], [1, 'sopro_gelado'], [1, 'golpe_veloz'], [14, 'presa_da_mare'], [21, 'estilhaco_de_gelo'], [28, 'armadura_de_geada'], [35, 'vagalhao'], [42, 'nevasca_do_veu']],
      art: {
        arch: 'aquatico', c1: [192, 55, 50], c2: [206, 48, 38], c3: [176, 65, 76], olho: [40, 85, 58],
        o: { escala: 0.98, corpoRX: 30, corpoRY: 18, cabecaR: 16, crista: 'barbatana', orelhas: 'barbatana', cauda: 'leque', olhos: 'fenda', boca: 'presas' }
      }
    }),
    e({
      num: 28, id: 'vharuneth', nome: 'Vharuneth', tipos: ['aurora', 'umbra'],
      categoria: 'Eco do Véu',
      base: { hp: 100, atk: 95, def: 90, atkEsp: 125, defEsp: 110, vel: 95 },
      cap: 4, xpB: 320, altura: 3.4, peso: 0.0,
      desc: 'Não é bem um Ânimo: é o que sobrou do Véu quando ele se rasgou. Aparece a um vinculista por geração, e ninguém concorda sobre o que ele quer.',
      evo: null,
      apr: [[1, 'juizo_da_alvorada'], [1, 'abraco_da_penumbra'], [1, 'concentrar'], [1, 'rajada_etera'], [50, 'foco_agudo'], [55, 'descanso_astral'], [60, 'pulso_vazio'], [65, 'lanca_de_raio']],
      art: {
        arch: 'espectro', c1: [268, 55, 34], c2: [48, 95, 62], c3: [186, 80, 78], olho: [0, 0, 100],
        o: { escala: 1.2, corpoRX: 24, corpoRY: 28, cabecaR: 17, crista: 'halo', orelhas: 'longa', cauda: 'nevoa', olhos: 'multiplos', boca: 'nenhuma', asas: 'eterea', halo: true, capa: true, aneis: true }
      }
    })
  ];

  G.ESPECIES = {};
  LISTA.forEach(function (s) { G.ESPECIES[s.id] = s; });
  G.LISTA_ESPECIES = LISTA;
  G.TOTAL_ESPECIES = LISTA.length;

  G.especie = function (id) { return G.ESPECIES[id] || null; };

  G.porNumero = function (n) {
    for (var i = 0; i < LISTA.length; i++) if (LISTA[i].num === n) return LISTA[i];
    return null;
  };

  /* Naturezas: cada uma sobe um atributo em 10% e baixa outro em 10%. */
  G.NATUREZAS = [
    { id: 'destemida',  nome: 'Destemida',  sobe: 'atk',    desce: 'atkEsp' },
    { id: 'serena',     nome: 'Serena',     sobe: 'atkEsp', desce: 'atk' },
    { id: 'teimosa',    nome: 'Teimosa',    sobe: 'def',    desce: 'vel' },
    { id: 'ligeira',    nome: 'Ligeira',    sobe: 'vel',    desce: 'def' },
    { id: 'zelosa',     nome: 'Zelosa',     sobe: 'defEsp', desce: 'atk' },
    { id: 'impetuosa',  nome: 'Impetuosa',  sobe: 'atk',    desce: 'def' },
    { id: 'calculista', nome: 'Calculista', sobe: 'atkEsp', desce: 'vel' },
    { id: 'paciente',   nome: 'Paciente',   sobe: 'defEsp', desce: 'vel' },
    { id: 'arisca',     nome: 'Arisca',     sobe: 'vel',    desce: 'defEsp' },
    { id: 'equilibrada', nome: 'Equilibrada', sobe: null,   desce: null }
  ];

  /* Padrões visuais individuais (variação entre indivíduos da mesma espécie) */
  G.PADROES = [
    { id: 'liso',      nome: 'Liso' },
    { id: 'malhado',   nome: 'Malhado' },
    { id: 'listrado',  nome: 'Listrado' },
    { id: 'salpicado', nome: 'Salpicado' },
    { id: 'faixado',   nome: 'Faixado' },
    { id: 'marmore',   nome: 'Mármore' },
    { id: 'gradiente', nome: 'Degradê' },
    { id: 'estelar',   nome: 'Estelar' }
  ];

})(window.CRISALIDA);
