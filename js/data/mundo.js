/* =========================================================================
   mundo.js — Vharune: mapas, rotas, NPCs, encontros e narrativa
   ---------------------------------------------------------------------
   Alfabeto de tiles:
     .  grama              ,  grama alta (encontros)
     -  trilha de terra    =  calçada de pedra
     ~  água funda         w  água rasa (pescaria)
     s  areia              F  flores
     T  árvore             Y  arbusto
     R  rocha              M  penhasco
     #  parede             B  telhado claro   b  telhado escuro
     D  porta              G  placa
     P  pilar de ruína     t  piso de ruína   :  névoa de éter (encontros)
     p  ponte              f  cerca           L  poste
     c  engradado          n  toco            W  cachoeira
     x  cristal étereo     _  vazio
   ========================================================================= */
(function (G) {
  'use strict';

  /* Tiles por onde se pode andar */
  G.ANDAVEL = { '.': 1, ',': 1, '-': 1, '=': 1, 's': 1, 'F': 1, 't': 1, 'p': 1, 'n': 1, ':': 1 };
  /* Tiles que geram encontros selvagens */
  G.TILE_ENCONTRO = { ',': 'grama', ':': 'nevoa' };
  /* Tiles de água (pescaria a partir da margem) */
  G.TILE_AGUA = { '~': 1, 'w': 1 };

  var MAPAS = {};

  /* ==================================================================== */
  /*  1. VILA CINZALVA                                                    */
  /* ==================================================================== */
  MAPAS.cinzalva = {
    id: 'cinzalva',
    nome: 'Vila Cinzalva',
    ambiente: 'vila',
    musicaCor: [140, 30, 40],
    borda: 'T',
    grade: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT....F...........................TT',
      'T...TT....######......####....F....T',
      'T..TT.....#BBBB#......#BB#.........T',
      'T.........#BBBB#......#BB#....TT...T',
      'T....F....##D###......#D##.....T...T',
      'T.........--=--........=--.....F...T',
      'T..........===============.........T',
      'T....TT.....=..........=......TT...T',
      'T....T......=...RRRR...=.......T...T',
      'T...........=..R~~~~R..=...........T',
      'T...........=..R~~~~R..=...........T',
      'T...........=..RRRRRR..=...........T',
      'T=================================.T',
      'T=..#####..G.F....F....=...#####..=T',
      'T=..#BBB#..............=...#bbb#..=T',
      'T=..#BBB#....===========...#bbb#..=T',
      'T=..##D##....=.............##D##..=T',
      'T=....=......=...............=....=T',
      'T=====-======-==============-======T',
      'T=.................................T',
      'T....F.......,,,,,,,,........F.....T',
      'T...........,,,,,,,,,,.............T',
      'T....TT......,,,,,,,,......TT......T',
      'TT..TTT.......----.........TTT....TT',
      'TTTTTTTTTTTTTT----TTTTTTTTTTTTTTTTTT'
    ],
    /* Serviços ligados a portas */
    servicos: [
      { x: 12, y: 5, tipo: 'casa', nome: 'Sua Casa' },
      { x: 23, y: 5, tipo: 'estudo', nome: 'Ateliê da Mestra Oriel' },
      { x: 6, y: 17, tipo: 'loja', nome: 'Empório Âmbar' },
      { x: 29, y: 17, tipo: 'santuario', nome: 'Santuário de Cinzalva' }
    ],
    placas: [
      { x: 11, y: 14, texto: 'VILA CINZALVA — "Onde a cinza virou lar."\nAo sul: Campo de Névoa. Cuidado com a grama alta.' }
    ],
    npcs: [
      { id: 'oriel', x: 22, y: 7, dir: 'baixo', sprite: 'mestra', nome: 'Mestra Oriel',
        falas: [
          'A Crisálida anda escorrendo mais este ano. Consegue sentir? O ar pinica na nuca.',
          'Seu Ânimo não é uma ferramenta. Alimente, descanse, escove — o vínculo faz mais pelos atributos do que qualquer treino forçado.',
          'Se algum dia chegar às Ruínas de Aldherin, não vá sozinho. E não confie no que a Ordem do Prisma Oco disser lá.'
        ] },
      { id: 'bram', x: 8, y: 18, dir: 'baixo', sprite: 'lojista', nome: 'Bram, do Empório',
        falas: [
          'Selo Simples é barato porque falha. Selo Reforçado é caro porque não falha. A escolha é sua, chefe.',
          'Regra de ouro da captura: enfraqueça primeiro, adormeça se puder, aí sim jogue o selo.'
        ] },
      { id: 'crianca_tolen', x: 17, y: 20, dir: 'cima', sprite: 'crianca', nome: 'Tolen',
        falas: [
          'Meu irmão diz que dois Ânimos da mesma espécie nunca têm a mesma marca. Eu já vi três Pardalumes e é verdade!',
          'Quando um Ânimo brilha esquisito, tipo vidro colorido... isso é um Prismático! Só um em muitos e muitos.'
        ] },
      { id: 'velho_hann', x: 30, y: 21, dir: 'esquerda', sprite: 'aldeao', nome: 'Velho Hann',
        falas: [
          'Trezentos e doze anos desde a Noite Partida e a gente ainda varre cinza da soleira. Vharune não esquece.',
          'No Santuário eles curam de graça. Aproveite enquanto for jovem e teimoso.'
        ] },
      { id: 'guarda_sul', x: 15, y: 23, dir: 'baixo', sprite: 'guarda', nome: 'Guarda Ilva',
        falas: [
          'Passagem livre. Só não entre na grama alta sem um Ânimo capaz de lutar.',
          'Campo de Névoa é tranquilo de dia. À noite, nem tanto — mas você não tem escolha, tem?'
        ] }
    ],
    warps: [
      { x: 14, y: 25, para: 'campo_nevoa', px: 17, py: 1, dir: 'baixo' },
      { x: 15, y: 25, para: 'campo_nevoa', px: 17, py: 1, dir: 'baixo' },
      { x: 16, y: 25, para: 'campo_nevoa', px: 18, py: 1, dir: 'baixo' },
      { x: 17, y: 25, para: 'campo_nevoa', px: 18, py: 1, dir: 'baixo' }
    ],
    /* O canteiro de grama alta da vila serve de treino inicial. */
    encontros: {
      grama: [
        { id: 'pardalume', min: 2, max: 4, peso: 55 },
        { id: 'terrino', min: 2, max: 4, peso: 30 },
        { id: 'chorumel', min: 2, max: 4, peso: 15 }
      ]
    }
  };

  /* ==================================================================== */
  /*  2. CAMPO DE NÉVOA                                                   */
  /* ==================================================================== */
  MAPAS.campo_nevoa = {
    id: 'campo_nevoa',
    nome: 'Campo de Névoa',
    ambiente: 'campo',
    musicaCor: [150, 25, 45],
    borda: 'T',
    grade: [
      'TTTTTTTTTTTTTTTT----TTTTTTTTTTTTTTTT',
      'TT.............,----,.............TT',
      'T....F........,,,--,,,..........F..T',
      'T.......TT....,,,--,,,.....TT......T',
      'T......TTT.....,,--,,......TTT.....T',
      'T.......T.......,--,........T......T',
      'T..............,,--,,..............T',
      'T....,,,,,,....,,--,,....,,,,,,....T',
      'T...,,,,,,,,....,--,....,,,,,,,,...T',
      'T...,,,,,,,,....,--,....,,,,,,,,...T',
      'T....,,,,,,.....,--,.....,,,,,,....T',
      'T...............,--,...............T',
      'T..RR...........,--,...........RR..T',
      'T.RR~~R.........,--,.........RR~~R.T',
      'T.R~~~R.........,--,.........R~~~~RT',
      'T.RR~~R.........,--,.........RR~~R.T',
      'T..RRR..........,--,..........RRR..T',
      'T...............,--,...............T',
      'T....G..........,--,...............T',
      'T-------------------------------..-T',
      'T-..............,--,..............-T',
      'T-...,,,,,......,--,......,,,,,...-T',
      'T-..,,,,,,,,....,--,....,,,,,,,,..-T',
      'T-...,,,,,......,--,......,,,,,...-T',
      'T-..............,--,..............-T',
      'T-.....TT.......,--,.......TT.....-T',
      'T-....TTTT......,--,......TTTT....-T',
      'T------.TT......,--,......TT.------T',
      'TTTTTT..........,--,..........TTTTTT',
      'TTTTTTTTTTTTTTTT----TTTTTTTTTTTTTTTT'
    ],
    placas: [
      { x: 5, y: 18, texto: 'CAMPO DE NÉVOA\nNorte: Vila Cinzalva\nSul: Lago Miravel\nLeste: Passo Ferrugem  ·  Oeste: Bosque Solene' }
    ],
    npcs: [
      { id: 'andarilha_sef', x: 20, y: 19, dir: 'esquerda', sprite: 'aldeao', nome: 'Andarilha Sef',
        falas: [
          'Já fugi de tudo que existe nesse campo. Fugir também é estratégia, viu?',
          'Se seu Ânimo está com fome, ele perde vigor mais rápido. Leve comida. Sempre.'
        ] },
      { id: 'kestren', x: 17, y: 12, dir: 'baixo', sprite: 'rival', nome: 'Kestren',
        falas: [
          'Você é o novo aprendiz da Oriel, né? Eu sou Kestren. Vou chegar em Aldherin antes de você.',
          'Ah — e a Ordem do Prisma Oco anda comprando Ânimos por peso de âmbar. Se te oferecerem isso, recuse.'
        ] }
    ],
    warps: [
      { x: 16, y: 0, para: 'cinzalva', px: 15, py: 24, dir: 'cima' },
      { x: 17, y: 0, para: 'cinzalva', px: 15, py: 24, dir: 'cima' },
      { x: 18, y: 0, para: 'cinzalva', px: 16, py: 24, dir: 'cima' },
      { x: 19, y: 0, para: 'cinzalva', px: 16, py: 24, dir: 'cima' },
      { x: 1, y: 19, para: 'bosque_solene', px: 29, py: 13, dir: 'esquerda' },
      { x: 1, y: 27, para: 'bosque_solene', px: 29, py: 13, dir: 'esquerda' },
      { x: 34, y: 19, para: 'passo_ferrugem', px: 2, py: 24, dir: 'direita' },
      { x: 34, y: 27, para: 'passo_ferrugem', px: 2, py: 24, dir: 'direita' },
      { x: 16, y: 29, para: 'lago_miravel', px: 8, py: 1, dir: 'baixo' },
      { x: 17, y: 29, para: 'lago_miravel', px: 8, py: 1, dir: 'baixo' },
      { x: 18, y: 29, para: 'lago_miravel', px: 9, py: 1, dir: 'baixo' },
      { x: 19, y: 29, para: 'lago_miravel', px: 9, py: 1, dir: 'baixo' }
    ],
    encontros: {
      grama: [
        { id: 'pardalume', min: 2, max: 5, peso: 34 },
        { id: 'terrino', min: 2, max: 5, peso: 20 },
        { id: 'faisco', min: 3, max: 6, peso: 15 },
        { id: 'chorumel', min: 3, max: 6, peso: 15 },
        { id: 'noctun', min: 3, max: 6, peso: 10 },
        { id: 'gelim', min: 4, max: 6, peso: 6 }
      ],
      agua: [
        { id: 'gotil', min: 3, max: 8, peso: 70 },
        { id: 'escamiro', min: 5, max: 10, peso: 30 }
      ]
    }
  };

  /* ==================================================================== */
  /*  3. BOSQUE SOLENE                                                    */
  /* ==================================================================== */
  MAPAS.bosque_solene = {
    id: 'bosque_solene',
    nome: 'Bosque Solene',
    ambiente: 'floresta',
    musicaCor: [128, 40, 30],
    borda: 'T',
    grade: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTT..TTT....TTT.....TTT......TTT',
      'TT,,,,,TT..TT,,TT..TT,,T...TTTTT',
      'T,,,,,,,,T.T,,,,T.T,,,,,T....TTT',
      'T,,,,,,,,,,,,,,,,,,,,,,,,,....TT',
      'TT,,,,,TT,,,,,,,,,,,,,,,T.....TT',
      'TTT,,,TT..TT,,,,,,,,TT,,,T.....T',
      'TTT...T....T,,,,,,,,T..T........',
      'TT.........,,,,nn,,,,..........T',
      'T..YY......,,,,nn,,,,......YY..T',
      'T.YYYY.....,,,,,,,,,,.....YYYY..',
      'T..YY......,,,,,,,,,,.......YY..',
      'T...........,,,,,,..............',
      'T-------------------------------',
      'T...........,,,,,,.............T',
      'T...TT......,,,,,,,,.......TT..T',
      'T..TTTT....,,,,,,,,,,.....TTTT.T',
      'T...TT....,,,,,,,,,,,,.....TT..T',
      'TT.......,,,,,,,,,,,,,,,.......T',
      'TTT.....,,,,,,,,,,,,,,,,......TT',
      'TT..G...,,,,,,,,,,,,,,,,......TT',
      'TT......,,,,,,,,,,,,,,,,......TT',
      'TTT......,,,,,,,,,,,,,,......TTT',
      'TTTT......,,,,,,,,,,,,.....TTTTT',
      'TTTTT......,,,,,,,,,,....TTTTTTT',
      'TTTTTT......,,,,,,,,...TTTTTTTTT',
      'TTTTTTTT.....xxxx......TTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    placas: [
      { x: 4, y: 20, texto: 'BOSQUE SOLENE\nNão corte, não queime, não grite.\nO bosque devolve o que recebe.' }
    ],
    npcs: [
      { id: 'guardia_naele', x: 16, y: 12, dir: 'baixo', sprite: 'curandeira', nome: 'Guardiã Naele',
        falas: [
          'Este bosque foi plantado por Silváriones. Cada clareira é o lugar onde um deles dormiu.',
          'Pegue: um Selo Reforçado. Use com sabedoria — ou com pressa, você que sabe.'
        ],
        presente: { item: 'selo_reforcado', qtd: 3 } },
      { id: 'herborista_wim', x: 26, y: 20, dir: 'esquerda', sprite: 'aldeao', nome: 'Herborista Wim',
        falas: [
          'Fruta Doce daqui vale mais que remédio de cidade. Pelo menos para os Ânimos.',
          'Toque a Erva Purificante num Ânimo envenenado e veja a diferença.'
        ],
        presente: { item: 'fruta_doce', qtd: 5 } }
    ],
    warps: [
      { x: 31, y: 11, para: 'campo_nevoa', px: 2, py: 20, dir: 'direita' },
      { x: 31, y: 12, para: 'campo_nevoa', px: 2, py: 20, dir: 'direita' },
      { x: 31, y: 13, para: 'campo_nevoa', px: 2, py: 20, dir: 'direita' }
    ],
    encontros: {
      grama: [
        { id: 'pardalume', min: 6, max: 10, peso: 20 },
        { id: 'verdil', min: 6, max: 10, peso: 10 },
        { id: 'noctun', min: 7, max: 11, peso: 15 },
        { id: 'chorumel', min: 6, max: 11, peso: 12 },
        { id: 'faisco', min: 7, max: 11, peso: 13 },
        { id: 'luminel', min: 8, max: 12, peso: 10 },
        { id: 'terrino', min: 6, max: 10, peso: 12 },
        { id: 'fungor', min: 9, max: 13, peso: 8 }
      ]
    }
  };

  /* ==================================================================== */
  /*  4. LAGO MIRAVEL                                                     */
  /* ==================================================================== */
  MAPAS.lago_miravel = {
    id: 'lago_miravel',
    nome: 'Lago Miravel',
    ambiente: 'lago',
    musicaCor: [200, 45, 45],
    borda: 'T',
    grade: [
      'TTTTTTTT----TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT.......--.....F........TT.....TT.....T',
      'T...,,,..--..,,,,,,,,....T.......T.....T',
      'T..,,,,,.--.,,,,,,,,,,.........,,,,,...T',
      'T..,,,,,.--..,,,,,,,,.........,,,,,,,..T',
      'T...,,,..--...,,,,,,..........,,,,,,,..T',
      'T........--...................,,,,,,...T',
      'T---------------------------.....,,....T',
      'T-.......--...ssssssss.................T',
      'T-...F...--.sssssssssssss.....TT.......T',
      'T-.......--.sswwwwwwwwwss....TTTT......T',
      'T-....G..--.sw~~~~~~~~~~ws....TT.......T',
      'T-.......--.sw~~~~~~~~~~~ws............T',
      'T-.......ppppp~~~~~~~~~~~~ws...........T',
      'T-.......--.sw~~~~~~~~~~~~~ws..........T',
      'T-.......--.sw~~~~~~~~~~~~~ws....F.....T',
      'T-.......--.ssw~~~~~~~~~~~ws...........T',
      'T-.......--..sswwwwwwwwwwss............T',
      'T-.......--...sssssssssss..............T',
      'T-.......--......ssss..................T',
      'T-.......--............................T',
      'T-..#####--....,,,,,,,,,......TT.......T',
      'T-..#BBB#--...,,,,,,,,,,,....TTTT......T',
      'T-..##D##--...,,,,,,,,,,,.....TT.......T',
      'T-...=====.....,,,,,,,,,...............T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    servicos: [
      { x: 6, y: 23, tipo: 'santuario', nome: 'Casa de Repouso do Lago' }
    ],
    placas: [
      { x: 6, y: 11, texto: 'LAGO MIRAVEL\nEm noite limpa, a água devolve Orva inteira — como era antes de rachar.\nCom uma Vara de Junco dá para pescar da margem.' }
    ],
    npcs: [
      { id: 'pescador_dulm', x: 12, y: 20, dir: 'direita', sprite: 'aldeao', nome: 'Pescador Dulm',
        falas: [
          'Trinta anos pescando aqui. Nunca vi o fundo. Dizem que tem um Abyssaro lá embaixo.',
          'Toma, fica com a minha Vara de Junco sobressalente. Encoste na água e tente a sorte.'
        ],
        presente: { item: 'vara_de_junco', qtd: 1 } },
      { id: 'irmas_lago', x: 33, y: 5, dir: 'esquerda', sprite: 'crianca', nome: 'Nia',
        falas: [
          'Minha irmã diz que Ânimos de Torrente odeiam Fulgor. Eu digo que ela é que odeia perder.',
          'Selo do Lago pega Torrente e Gélido quase toda vez. O Bram vende.'
        ] }
    ],
    warps: [
      { x: 8, y: 0, para: 'campo_nevoa', px: 17, py: 28, dir: 'cima' },
      { x: 9, y: 0, para: 'campo_nevoa', px: 17, py: 28, dir: 'cima' },
      { x: 10, y: 0, para: 'campo_nevoa', px: 18, py: 28, dir: 'cima' },
      { x: 11, y: 0, para: 'campo_nevoa', px: 18, py: 28, dir: 'cima' }
    ],
    encontros: {
      grama: [
        { id: 'gotil', min: 12, max: 16, peso: 16 },
        { id: 'pardalume', min: 12, max: 16, peso: 14 },
        { id: 'gelim', min: 13, max: 17, peso: 15 },
        { id: 'escamiro', min: 14, max: 18, peso: 10 },
        { id: 'chorumel', min: 12, max: 16, peso: 12 },
        { id: 'luminel', min: 13, max: 17, peso: 11 },
        { id: 'fungor', min: 14, max: 18, peso: 10 },
        { id: 'noctun', min: 13, max: 17, peso: 8 },
        { id: 'marulo', min: 16, max: 19, peso: 4 }
      ],
      agua: [
        { id: 'gotil', min: 10, max: 18, peso: 38 },
        { id: 'escamiro', min: 14, max: 22, peso: 26 },
        { id: 'marulo', min: 16, max: 24, peso: 20 },
        { id: 'gelim', min: 12, max: 18, peso: 14 },
        { id: 'abyssaro', min: 32, max: 38, peso: 2 }
      ]
    }
  };

  /* ==================================================================== */
  /*  5. PASSO FERRUGEM                                                   */
  /* ==================================================================== */
  MAPAS.passo_ferrugem = {
    id: 'passo_ferrugem',
    nome: 'Passo Ferrugem',
    ambiente: 'montanha',
    musicaCor: [24, 30, 38],
    borda: 'M',
    grade: [
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'MM......MM..........MM..........MM',
      'M...RR...M...,,,,...M....RR......M',
      'M..RRRR..M..,,,,,,..M...RRRR.....M',
      'M...RR...M..,,,,,,..M....RR......M',
      'M........M...,,,,...M...........MM',
      'M...,,,..M..........M....,,,....MM',
      'M..,,,,,.MM........MM...,,,,,...MM',
      'M..,,,,,..MM......MM....,,,,,...MM',
      'M...,,,....M......M......,,,.....M',
      'M..........M......M..............M',
      'M===================-------------M',
      'M=.........M......M.............=M',
      'M=..cc.....M......M....RR.......=M',
      'M=..cc.....M......M...RRRR......=M',
      'M=.........M......M....RR.......=M',
      'M=...,,,...M......M....,,,,.....=M',
      'M=..,,,,,..M......M...,,,,,,....=M',
      'M=..,,,,,..M......M...,,,,,,....=M',
      'M=...,,,...M......M....,,,,.....=M',
      'M=.........M......M.............=M',
      'M=....G....MM....MM.............=M',
      'M=..........M....M..............=M',
      'M=..........M....M..............=M',
      'M============----================M',
      'M..#####....,,,,....x.x....MMMMMMM',
      'M..#bbb#...,,,,,,...x-x....MMMMMMM',
      'M..##D##...,,,,,,...x-x....MMMMMMM',
      'M...--.....,,,,,,....-.....MMMMMMM',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM'
    ],
    servicos: [
      { x: 5, y: 27, tipo: 'santuario', nome: 'Posto da Forja' },
      { x: 5, y: 27, tipo: 'loja', nome: 'Oficina Ferrugem' }
    ],
    placas: [
      { x: 6, y: 21, texto: 'PASSO FERRUGEM\nMinas fechadas desde a Fratura de Orva.\nO cristal étereo ao sul indica a entrada de Aldherin.' }
    ],
    npcs: [
      { id: 'ferreira_dov', x: 8, y: 12, dir: 'baixo', sprite: 'lojista', nome: 'Ferreira Dov',
        falas: [
          'Liga étera é o único metal que aguenta um Ânimo de Ferro em fúria. E olhe lá.',
          'Leve isto: Selo Áureo. Aqui em cima você vai precisar.'
        ],
        presente: { item: 'selo_aureo', qtd: 2 } },
      { id: 'batedor_kar', x: 22, y: 24, dir: 'cima', sprite: 'guarda', nome: 'Batedor Kar',
        falas: [
          'Além dos cristais está Aldherin. Preciso de um Amuleto de Âmbar para deixar você passar.',
          'A Ordem do Prisma Oco já está lá dentro. Boa sorte com isso.'
        ] },
      { id: 'oriel_passo', x: 18, y: 28, dir: 'direita', sprite: 'mestra', nome: 'Mestra Oriel',
        falas: [
          'Cheguei antes de você. Eu tinha um palpite — e palpite de velha raramente erra.',
          'Tome o Amuleto de Âmbar. O selo das Ruínas responde a ele. E, aluno: volte inteiro.'
        ],
        presente: { item: 'amuleto_ambar', qtd: 1 },
        requerFlag: null }
    ],
    warps: [
      { x: 1, y: 24, para: 'campo_nevoa', px: 33, py: 20, dir: 'esquerda' },
      { x: 1, y: 11, para: 'campo_nevoa', px: 33, py: 20, dir: 'esquerda' },
      { x: 21, y: 28, para: 'ruinas_aldherin', px: 15, py: 23, dir: 'cima', requerItem: 'amuleto_ambar',
        bloqueio: 'Um selo de âmbar veda a entrada das Ruínas. Falta o Amuleto de Âmbar.' }
    ],
    encontros: {
      grama: [
        { id: 'ferrusco', min: 18, max: 23, peso: 24 },
        { id: 'terrino', min: 18, max: 22, peso: 15 },
        { id: 'gelim', min: 19, max: 23, peso: 14 },
        { id: 'fagulho', min: 18, max: 22, peso: 12 },
        { id: 'faisco', min: 19, max: 23, peso: 12 },
        { id: 'geodante', min: 23, max: 27, peso: 8 },
        { id: 'trovanel', min: 24, max: 28, peso: 5 },
        { id: 'nevarco', min: 26, max: 30, peso: 4 },
        { id: 'brasavo', min: 22, max: 26, peso: 4 },
        { id: 'aciarno', min: 28, max: 31, peso: 2 }
      ]
    }
  };

  /* ==================================================================== */
  /*  6. RUÍNAS DE ALDHERIN                                               */
  /* ==================================================================== */
  MAPAS.ruinas_aldherin = {
    id: 'ruinas_aldherin',
    nome: 'Ruínas de Aldherin',
    ambiente: 'ruinas',
    musicaCor: [275, 30, 30],
    borda: 'M',
    grade: [
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
      'MttttttttttttttttttttttttttttttM',
      'Mt::::tP::::::::::::::::Pt::::tM',
      'Mt:::::t::::::::::::::::t:::::tM',
      'Mtt::ttt::P::::::::P::ttt::::ttM',
      'MtPt::::::::::::::::::::::::tPtM',
      'Mt:t::::tttttttttttttt::::::t:tM',
      'Mt::::::t::::::::::::t::::::::tM',
      'Mt::P:::t:::PxxxxP:::t:::P::::tM',
      'Mt::::::t::::xxxx::::t::::::::tM',
      'Mtt:::::t::::xxxx::::t:::::::ttM',
      'Mt::::::t:::PxxxxP:::t::::::::tM',
      'Mt::::::t::::::::::::t::::::::tM',
      'Mt::::::tttttt::tttttt::::::::tM',
      'MtP::::::::::t::t:::::::::::PttM',
      'Mt:::::::::::t::t::::::::::::::M',
      'Mtt:::::::::tt::tt::::::::::::tM',
      'Mt::::::::::t::::t:::::::::::ttM',
      'MtP::::::::tt::::tt:::::::::PttM',
      'Mt::::::::tt::::::tt::::::::::tM',
      'Mtt::::::tt::::::::tt::::::::ttM',
      'Mt::::::tt:::G::::::tt::::::::tM',
      'MtP::::tt::::::::::::tt::::::PtM',
      'Mtttttttt::::::::::::ttttttttttM',
      'MMMMMMMMMMMMMttttMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM'
    ],
    placas: [
      { x: 13, y: 21, texto: 'ALDHERIN\n"Aqui caiu o primeiro fragmento. Aqui a cidade acabou numa noite."\nA névoa de éter esconde Ânimos que não deviam existir.' }
    ],
    npcs: [
      { id: 'vorik', x: 18, y: 10, dir: 'esquerda', sprite: 'rival', nome: 'Vorik, do Prisma Oco',
        falas: [
          'A Ordem não rouba Ânimos. Nós os libertamos do vínculo — que é uma coleira, quer você admita ou não.',
          'Você chegou tarde. O Eco já acordou. Boa sorte convencendo ELE de que vínculo é bondade.'
        ] },
      { id: 'kestren_ruinas', x: 15, y: 20, dir: 'cima', sprite: 'rival', nome: 'Kestren',
        falas: [
          'Cheguei primeiro, como prometi. E agora estou com medo, como não prometi.',
          'Tem algo no coração das ruínas. Grande. Antigo. Toma um Selo da Crisálida — é o único que talvez funcione.'
        ],
        presente: { item: 'selo_da_crisalida', qtd: 1 } }
    ],
    warps: [
      { x: 13, y: 24, para: 'passo_ferrugem', px: 21, py: 27, dir: 'cima' },
      { x: 14, y: 24, para: 'passo_ferrugem', px: 21, py: 27, dir: 'cima' },
      { x: 15, y: 24, para: 'passo_ferrugem', px: 21, py: 27, dir: 'cima' },
      { x: 16, y: 24, para: 'passo_ferrugem', px: 21, py: 27, dir: 'cima' }
    ],
    encontros: {
      nevoa: [
        { id: 'noctun', min: 24, max: 29, peso: 18 },
        { id: 'luminel', min: 24, max: 29, peso: 15 },
        { id: 'fungor', min: 25, max: 30, peso: 12 },
        { id: 'umbrafex', min: 28, max: 33, peso: 10 },
        { id: 'frondor', min: 26, max: 31, peso: 8 },
        { id: 'brasavo', min: 26, max: 31, peso: 8 },
        { id: 'marulo', min: 26, max: 31, peso: 8 },
        { id: 'miasmor', min: 29, max: 34, peso: 7 },
        { id: 'auroreth', min: 32, max: 36, peso: 4 },
        { id: 'ignareth', min: 33, max: 37, peso: 3 },
        { id: 'abyssaro', min: 33, max: 37, peso: 3 },
        { id: 'silvarion', min: 33, max: 37, peso: 3 },
        { id: 'vharuneth', min: 40, max: 44, peso: 1 }
      ]
    }
  };

  /* ==================================================================== */
  G.MAPAS = MAPAS;
  G.MAPA_INICIAL = 'cinzalva';
  G.POS_INICIAL = { x: 17, y: 20, dir: 'baixo' };

  /* Normaliza a grade: garante que toda linha tenha a mesma largura. */
  G.prepararMapas = function () {
    Object.keys(MAPAS).forEach(function (k) {
      var m = MAPAS[k];
      var larg = 0, i;
      for (i = 0; i < m.grade.length; i++) larg = Math.max(larg, m.grade[i].length);
      for (i = 0; i < m.grade.length; i++) {
        var l = m.grade[i];
        if (l.length < larg) {
          while (l.length < larg) l += (m.borda || 'T');
          m.grade[i] = l;
        }
      }
      m.larg = larg;
      m.alt = m.grade.length;
      /* índices auxiliares */
      m._warp = {};
      (m.warps || []).forEach(function (w) { m._warp[w.x + ',' + w.y] = w; });
      m._servico = {};
      (m.servicos || []).forEach(function (s) {
        var key = s.x + ',' + s.y;
        (m._servico[key] || (m._servico[key] = [])).push(s);
      });
      m._placa = {};
      (m.placas || []).forEach(function (p) { m._placa[p.x + ',' + p.y] = p; });
    });
  };

  G.mapa = function (id) { return MAPAS[id] || null; };

  /* ------------------------------ Narrativa --------------------------- */
  G.INTRO = [
    'Há trezentos e doze anos, uma pedra vinda do escuro acertou a lua.',
    'Orva não se despedaçou. Ela trincou — e a trinca ficou aberta, como uma casca esperando algo sair.',
    'Deram a ela o nome de Crisálida.',
    'E alguma coisa saiu. Desceram sobre Vharune por três anos, e o povo os chamou de Ecos, porque pareciam a lembrança de algo que morava lá dentro.',
    'Durante oitenta anos nós os caçamos. Até uma menina de uma vila de cinzas fazer o que ninguém tinha tentado: em vez de lutar, ela alimentou um.',
    'Hoje eles não são mais Ecos. São Ânimos — e quem caminha ao lado deles se chama Vinculista.',
    'A Crisálida continua aberta. A cada volta de Orva, desce gente nova.',
    'Hoje é o seu primeiro dia. A Mestra Oriel deixou um Ânimo esperando por você.'
  ];

  G.ESCOLHA_INICIAL = ['verdil', 'fagulho', 'gotil'];

})(window.ANIMOS);
