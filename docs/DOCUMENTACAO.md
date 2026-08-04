# Documentação técnica — Ânimos: Ecos de Vharune

Documentação completa do projeto: como o jogo está montado, por que cada decisão
foi tomada, e o desenho Web3 inteiro.

**A Parte I documenta o jogo do zero**, sem assumir familiaridade com o código.
**A Parte II documenta a camada Web3 em nível técnico** — não explica o que é um
ERC-721; explica por que *estes* contratos são assim, onde estão os trade-offs e
quais são os vetores de ataque conhecidos.

Leia com o repositório aberto do lado. Todo trecho citado tem o arquivo e a linha.

Para a história e o mundo, veja [HISTORIA.md](HISTORIA.md).
Para a economia, veja [ECONOMIA.md](ECONOMIA.md).

---

## Índice

**Parte I — O jogo**
1. [A arquitetura em uma página](#1-a-arquitetura-em-uma-página)
2. [O namespace único e a ordem de carregamento](#2-o-namespace-único-e-a-ordem-de-carregamento)
3. [As cinco camadas](#3-as-cinco-camadas)
4. [O núcleo: aleatoriedade que se repete](#4-o-núcleo-aleatoriedade-que-se-repete)
5. [Os dados](#5-os-dados)
6. [Anatomia de um indivíduo](#6-anatomia-de-um-indivíduo)
7. [O motor de batalha](#7-o-motor-de-batalha)
8. [O loop do mundo](#8-o-loop-do-mundo)
9. [Arte procedural](#9-arte-procedural)
10. [Estado e salvamento](#10-estado-e-salvamento)

**Parte II — Web3**
11. [A tese econômica](#11-a-tese-econômica)
12. [Por que dois tokens](#12-por-que-dois-tokens)
13. [A regra de ouro: mint só na captura](#13-a-regra-de-ouro-mint-só-na-captura)
14. [Dificuldade como política monetária](#14-dificuldade-como-política-monetária)
15. [Matemática WAD sem ponto flutuante](#15-matemática-wad-sem-ponto-flutuante)
16. [O voucher EIP-712 e o modelo de confiança](#16-o-voucher-eip-712-e-o-modelo-de-confiança)
17. [O batismo e o espaço de nomes](#17-o-batismo-e-o-espaço-de-nomes)
18. [Superfície de ataque](#18-superfície-de-ataque)
19. [Dois bugs corrigidos e por que importam](#19-dois-bugs-corrigidos-e-por-que-importam)
20. [O que falta](#20-o-que-falta)

**Parte III** — [Exercícios de fixação](#parte-iii--exercícios-de-fixação)

---
---

# PARTE I — O JOGO

## 1. A arquitetura em uma página

Crisálida não tem build, não tem `npm install`, não tem framework e não faz uma
única requisição de rede. `index.html` carrega 18 arquivos `.js` na ordem certa e
o jogo roda.

Isso foi decisão, não preguiça. Três consequências:

- **Abre com duplo clique.** Funciona em `file://` porque não usa módulos ES
  (que exigem CORS e portanto um servidor).
- **Não apodrece.** Sem dependências, não há atualização que quebre o jogo em
  2030.
- **É auditável inteiro.** São ~9.000 linhas que uma pessoa lê num fim de semana.

O preço: o namespace é global e a ordem de carregamento importa. As duas próximas
seções tratam exatamente disso.

```
index.html
  └─ carrega 18 scripts clássicos, em ordem
       └─ todos escrevem em window.CRISALIDA
            └─ principal.js dispara o jogo quando o DOM está pronto
```

---

## 2. O namespace único e a ordem de carregamento

Existe **um** objeto global: `window.CRISALIDA`. Todo arquivo é uma IIFE que
recebe esse objeto e pendura coisas nele.

```js
/* js/data/tipos.js */
(function (G) {
  'use strict';
  G.TIPOS = { ... };
  G.multiplicadorTipo = function (tipoAtaque, tiposDefesa) { ... };
})(window.CRISALIDA);
```

Por que a IIFE:

1. **Não vaza variável.** Tudo que não for `G.alguma coisa` morre no fim do
   arquivo. Sem isso, um `var i` em um arquivo colidiria com outro.
2. **`'use strict'` por arquivo.** Erros silenciosos viram exceções.
3. **Dependência explícita.** O arquivo declara no topo o que precisa.

**A ordem em `index.html` é a ordem de dependência:**

```
core.js          → utilidades, ruído, cor. Não depende de nada.
data/tipos.js    → precisa de core (usa G.utils.css)
data/tecnicas.js → precisa de tipos
data/especies.js → precisa de tecnicas e tipos
data/itens.js
data/mundo.js
motor/criatura.js → precisa de todos os data/
motor/batalha.js  → precisa de criatura
motor/estado.js
arte/*.js
jogo/mundo.js
ui/*.js
jogo/principal.js → precisa de tudo. É o último.
```

> **Regra prática:** se você criar um arquivo novo, coloque-o em `index.html`
> depois de tudo que ele usa e antes de tudo que o usa. Errar isso dá
> `undefined is not a function` no carregamento — sempre.

---

## 3. As cinco camadas

O código está em cinco camadas, e **uma camada nunca conhece a de cima**:

| Camada | Pasta | O que é | Conhece |
|---|---|---|---|
| **Dados** | `js/data/` | Tabelas puras. Nenhuma lógica. | nada |
| **Motor** | `js/motor/` | As regras: atributos, dano, captura, XP, save | dados |
| **Mundo** | `js/jogo/` | Loop, movimento, câmera, encontros | motor, dados |
| **Arte** | `js/arte/` | Desenha em canvas. Nunca decide regra. | dados |
| **UI** | `js/ui/` | DOM, painéis, telas, animação de combate | tudo abaixo |

Isso é o que permite rodar o jogo **sem navegador**. O simulador de batalhas
carrega só `core + data + motor` no Node e joga 600 partidas sem existir um
`<canvas>`. Se as regras estivessem espalhadas na UI, isso seria impossível.

```
data ──▶ motor ──▶ jogo ──▶ ui
  │                          ▲
  └──────────▶ arte ─────────┘
```

**Onde botar código novo:**
uma nova técnica → `data/tecnicas.js`; um novo efeito de técnica → `motor/batalha.js`;
uma nova tela → `ui/telas.js`; um novo tipo de tile → `data/mundo.js` + `arte/mapa.js`.

---

## 4. O núcleo: aleatoriedade que se repete

`js/core.js` tem a peça mais importante do jogo inteiro: **ruído determinístico**.

```js
function hash32(str) { ... }              // FNV-1a
function noise2(x, y, seed) { ... }       // ruído de valor 2D, interpolado
G.fbm = function (x, y, seed, oitavas) {} // soma de oitavas
```

`noise2(x, y, seed)` devolve sempre o mesmo número para as mesmas entradas. É
isso que faz Vila Cinzalva ser idêntica toda vez que você abre o jogo, sem
guardar um único pixel em lugar nenhum.

**`fbm` (fractional Brownian motion) é a soma de várias oitavas de ruído:**

```
fbm(x,y) = noise(x,y)·1 + noise(2x,2y)·0.5 + noise(4x,4y)·0.25 + ...
```

Cada oitava tem o dobro da frequência e metade da amplitude. O resultado tem
detalhe grosso *e* fino ao mesmo tempo — que é como manchas de grama funcionam
na natureza.

> **Por que isso importa muito:** a primeira versão do mapa usava
> `noise2(tileX, tileY)`, um valor por tile. Resultado: xadrez visível, porque
> tiles vizinhos sorteavam valores independentes. Trocar para
> `fbm(x * 0.28, y * 0.28)` fez as manchas atravessarem vários tiles. **A escala
> de entrada é o que decide o tamanho da mancha.** Multiplicador pequeno = mancha
> grande.

Também no core: conversão HSL→CSS (`G.utils.css([h,s,l])`). Toda cor do jogo é
HSL, não hex. Isso permite girar matiz de uma criatura inteira mudando um número —
que é exatamente como a variação individual funciona.

---

## 5. Os dados

### `data/tipos.js` — matriz esparsa

```js
G.EFETIVIDADE = {
  brasa: { verdejo: 2, gelido: 2, ferro: 2, brasa: 0.5, torrente: 0.5, terra: 0.5 },
  ...
};
```

Só entram valores **diferentes de 1**. Quem não está na tabela é neutro. Isso
troca 144 células por ~60 entradas e torna a tabela legível.

```js
G.multiplicadorTipo = function (tipoAtaque, tiposDefesa) {
  var m = 1;
  for (var i = 0; i < tiposDefesa.length; i++) {
    var v = G.EFETIVIDADE[tipoAtaque][tiposDefesa[i]];
    m *= (v === undefined ? 1 : v);
  }
  return m;
};
```

Tipos duplos **multiplicam**: Verdejo contra Torrente/Terra dá `2 × 2 = 4`.
E qualquer `0` na cadeia zera tudo — é assim que imunidade funciona.

### `data/especies.js` — anatomia de uma espécie

```js
{
  num: 1, id: 'verdil', nome: 'Verdil', tipos: ['verdejo'],
  base: { hp: 45, atk: 49, def: 49, atkEsp: 55, defEsp: 55, vel: 45 },
  cap: 45,        // taxa de captura, 1..255 — quanto maior, mais fácil
  xpB: 62,        // rendimento de XP
  evo: { para: 'frondor', nivel: 16 },
  apr: [[1,'investida'], [5,'postura_firme'], [9,'raiz_sugadora'], ...],
  art: { arch: 'quadrupede', c1: [104,42,44], c2: ..., o: { ... } }
}
```

O campo `art` é a instrução de construção: arquétipo (`quadrupede`, `bipede`,
`ameba`, `aquatico`, `ave`, `golem`, `inseto`, `espectro`), três cores HSL e
opções (crista, cauda, orelhas, patas, placas). É dele que sai a malha 3D do
Ânimo, em `arte/especies3d.js`. **Não existe imagem nem modelo em arquivo.** Guarde esse campo — na Parte II ele vira
o `semente` da certidão de nascimento on-chain.

`cap` também reaparece na Parte II: é dele que sai a meta de oferta de cada
espécie no contrato de política.

---

## 6. Anatomia de um indivíduo

Um Ânimo capturado não é a espécie. É uma instância com identidade própria.

### A fórmula de atributos (`js/motor/criatura.js:85`)

```js
r.hp = Math.floor((2 * esp.base.hp + c.ivs.hp) * c.nivel / 100) + c.nivel + 10;

// demais atributos
var v = Math.floor((2 * esp.base[k] + c.ivs[k]) * c.nivel / 100) + 5;
if (nat.sobe  === k) v = Math.floor(v * 1.1);
if (nat.desce === k) v = Math.floor(v * 0.9);
```

Três fontes de variação:

1. **Base da espécie** — igual para todos os Verdil.
2. **IVs** (atributos ocultos), 0 a 31 por atributo, sorteados no nascimento.
   Dois Verdil de nível 50 podem ter ~15 pontos de diferença no mesmo atributo.
3. **Natureza** — uma de 10, sobe um atributo em 10% e baixa outro em 10%.

O `Math.floor` em cada etapa é intencional: mantém tudo inteiro e evita que
diferenças de ponto flutuante apareçam na interface.

### O que faz cada um ser visualmente único

```js
{ semente, padrao, matiz, porte, prismatico }
```

- `semente` — inteiro que alimenta todo o desenho procedural
- `padrao` — 1 de 8 (Liso, Malhado, Listrado, Salpicado, Faixado, Mármore, Degradê, Estelar)
- `matiz` — desvio de ±17° aplicado em cima das cores da espécie
- `porte` — 90% a 112%
- `prismatico` — ~1 em 480, paleta deslocada e brilho

Em 400 Pardalumes gerados: **397 aparências distintas**.

### Cuidado (`criatura.js:104`)

```js
if (c.energia < 15)   { m.dano *= 0.80; m.vel *= 0.70; }
if (c.saciedade < 10) { m.dano *= 0.88; m.vel *= 0.90; }
if (c.vinculo >= 80)  { m.dano *= 1.10; m.crit += 0.06; m.xp *= 1.20; }
```

Cuidar não é enfeite: é ±30% de desempenho. **Guarde isto — é o alicerce
econômico da Parte II.** O sumidouro de tokens mais forte do desenho inteiro é o
consumo recorrente de comida e elixir, e ele só funciona porque a mecânica de
fome já existe e já importa no jogo sem blockchain nenhuma.

---

## 7. O motor de batalha

### Ordem do turno

Velocidade efetiva decide quem age primeiro, mas a **prioridade da técnica** vem
antes da velocidade (um golpe de prioridade +1 sempre sai na frente).

```js
var v = atrib(lado, 'vel') * modsCuidado.vel;
if (lado.c.status === 'paralisia') v *= 0.5;
```

### A fórmula de dano (`js/motor/batalha.js:200`)

```js
base = floor(floor(floor(2*nivel/5 + 2) * tec.pot * A / D) / 50) + 2;

d = base
  * stab                       // 1.5 se a técnica é do tipo do atacante
  * mult                       // efetividade: 0, 0.25, 0.5, 1, 2 ou 4
  * (crit ? 1.5 : 1)
  * (0.85 + Math.random()*0.15) // variação de 15%
  * modsCuidado.dano;
```

Onde `A`/`D` são Ataque/Defesa (físico) ou Atq./Def. Especial (especial), já com
os estágios de modificação aplicados.

Detalhes que importam:

- **STAB = 1,5.** Usar técnica do próprio tipo vale mais que 4 pontos de potência.
- **A variação de 15% impede empates determinísticos** — sem ela, o mesmo confronto
  sempre daria o mesmo número de turnos.
- **Crítico:** `1/16 + bônus`, limitado entre 2% e 55%.

```js
critChance = 1/16 + modsCuidado.crit + (tec.ef.crit * 0.10) + (mod.critF * 0.10);
critChance = clamp(critChance, 0.02, 0.55);
```

### Estágios de modificação

Atributos vão de −6 a +6 estágios. Cada estágio é um multiplicador tabelado
(não linear): +1 ≈ 1,5×, +2 = 2×, −1 ≈ 0,67×. É por isso que "Defesa caiu muito!"
dói tanto: dois estágios negativos dobram o dano recebido.

### A fórmula de captura (`js/motor/batalha.js:319`)

Esta é a mais importante da Parte II inteira. Leia com atenção.

```js
a = ((3*max - 2*hpAtual) * esp.cap * taxaDoSelo * bStatus) / (3*max);
a *= clamp(1.15 - nivel*0.006, 0.55, 1.1);   // nível alto resiste
a  = clamp(a, 1, 255);

p     = (a/255)^0.25;   // chance de UM tremor
total = p^4;            // são quatro tremores
```

Lendo em português:

- `(3·max − 2·hp) / (3·max)` vai de **1/3** (vida cheia) a **1** (1 de vida).
  Enfraquecer o alvo triplica a chance.
- `bStatus`: sono ou congelamento = **2,5×**; qualquer outro status = 1,5×.
- `esp.cap` é a taxa da espécie. Pardalume tem 190; Vharuneth tem 4.
- O truque de `p^4`: quatro tremores independentes, cada um com chance `p`.
  Serve para a **tensão** — você vê o selo balançar e quase escapar.

> **Este é o ponto de acoplamento entre o jogo e a economia.** Na Parte II,
> `esp.cap` não é mais constante: ele passa por `capturaEfetiva()`, que divide
> pela dificuldade calculada a partir da saturação da espécie e da razão de
> queima global. Toda a política monetária entra por essa única variável.

### IA do inimigo (`batalha.js:309`)

```js
nota = tec.pot * mult * stab * (tec.prec / 100);
```

Escolhe a técnica de maior nota esperada, com uma pitada de aleatório para não
ficar previsível. Simples e suficiente.

---

## 8. O loop do mundo

`js/jogo/mundo.js` roda um `requestAnimationFrame` com delta time:

```js
function quadro(t) {
  var dt = Math.min(t - ultimo, 50);   // trava em 50ms
  ultimo = t;
  if (!pausado) { atualizar(dt); }
  desenhar();
  requestAnimationFrame(quadro);
}
```

O `Math.min(dt, 50)` evita que, ao voltar de uma aba em segundo plano, o jogador
atravesse meio mapa num quadro só.

### Movimento em grade com interpolação

O jogador está sempre num tile inteiro logicamente, mas desenhado interpolado
entre o tile antigo e o novo. Isso dá colisão simples (é só checar
`G.ANDAVEL[tile]`) com movimento visualmente suave.

### Encontros

A cada tile de grama alta pisado, sorteia contra uma taxa. A tabela de encontros
é por mapa e por tipo de tile:

```js
encontros: {
  grama: [ { id:'pardalume', min:2, max:4, peso:55 }, ... ]
}
```

`peso` é sorteio ponderado. **Guarde este ponto:** na Parte II, uma espécie só
entra nesse sorteio se estiver *descendo de Orva* naquele ciclo.

### Câmera e culling

Só desenha os tiles visíveis, com uma margem. Em mapas de 40×30 isso não faz
diferença, mas mantém o custo constante se o mapa crescer.

---

## 9. Arte procedural

Nenhum arquivo de imagem no repositório inteiro. Tudo é `<canvas>`.

### Criaturas — malha 3D em tempo de execução

Os Ânimos **não são desenho**: são modelo. Cada retrato constrói uma malha
(vértices, triângulos, normais) e a rasteriza num rasterizador escrito à mão em
JavaScript — sem WebGL, sem build, sem asset. Quatro arquivos:

| Arquivo | Papel |
|---|---|
| `arte/malha3d.js` | geometria: loft por spline, retalho paramétrico, faceta, esfera, ponta curva |
| `arte/render3d.js` | rasterizador: câmera, z-buffer, mapa de sombra, G-buffer, AO, materiais |
| `arte/anatomia3d.js` | vocabulário anatômico: coluna, crânio, olho, membro, asa, crista |
| `arte/especies3d.js` | oito arquétipos corporais e o perfil 3D das 28 espécies |

**Por que um rasterizador próprio e não WebGL.** O jogo precisa entregar um
**PNG por indivíduo** — para o bestiário, para a ficha e para o token da
carteira. Canvas 2D já dá isso de graça (`toDataURL`), sem contexto de GPU para
criar, perder e restaurar, e sem risco de o navegador negar o contexto.

**O pipeline, na ordem.**

1. **Transformação** — vértice para espaço de vista e para tela, guardando
   `1/w` para interpolação com correção de perspectiva.
2. **Mapa de sombra** — passada só de profundidade a partir da luz principal,
   ortográfica. É o que faz a asa escurecer o dorso de verdade.
3. **G-buffer** — normal, uv, material e profundidade por pixel. Sombreamento
   diferido: nenhum pixel é sombreado duas vezes, mesmo com muita sobreposição.
4. **Oclusão em espaço de tela** — lida do próprio buffer de profundidade;
   fecha dobra, vão sob a mandíbula e espaço entre as pernas.
5. **Sombreamento** — relevo procedural perturba a normal, e só então entram
   difusa, especular, luar de borda e rebote frio do chão.
6. **Translúcidos** — membrana, geleia, névoa e véu, ordenados de trás para a
   frente, testando profundidade sem gravá-la.
7. **Resolução** — renderiza em 2× e reduz por caixa; cai para 1× sozinho se o
   primeiro retrato passar de 320 ms.
8. **Florescer** — difunde só o canal emissivo, a 1/4 da resolução.

**Relevo sem geometria.** Escama, placa ventral, pena, quitina, rocha, cristal,
metal e couro são **funções de altura** avaliadas por pixel em coordenadas de
superfície, com derivada analítica; a derivada perturba a normal no plano
tangente. Modelar escama vértice a vértice custaria centenas de milhares de
triângulos por bicho; assim custa uma dúzia de multiplicações — e responde
certo à luz, porque a normal é realmente perturbada.

**As coordenadas de textura estão em distância de superfície**, não em [0,1]:
`u` é o comprimento de arco ao longo da peça, `v` o perímetro percorrido. É o
que faz a escama ter o mesmo tamanho no pescoço fino e no quadril largo, em vez
de esticar junto com a peça.

**A coluna é uma varredura só.** Da ponta da cauda até a nuca, sem emenda entre
cauda, quadril, dorso e pescoço. Os marcos anatômicos caem em `t` previsível —
quadril em 0.375, peito em 0.625, nuca em 1.0 — e é por isso que perna, asa e
crista sabem onde se plantar sem coordenada mágica. Arquétipos com outra
postura (bípede ereto, ave compacta, serpente marinha) trocam só a lista de
pontos de controle; todo o resto continua valendo.

> **Erro que isso custou:** a primeira versão dos quadros de referência
> recalculava o "up" a cada estação. Em curva fechada — o S do pescoço — a
> seção torcia, e a torção aparecia como fileira de escamas girando em volta
> do pescoço. A correção foi transporte paralelo por dupla reflexão.

> **Segundo erro, visível de longe:** as rêmiges da asa emplumada apontavam
> para a frente, porque o ângulo de varredura foi escrito com o cosseno do lado
> errado. O Falcéu virou um leque de espetos em volta do corpo. Asa de pena só
> fecha superfície se a pena varre para TRÁS.

**Escala entre espécies.** A câmera fica à mesma distância para todo o elenco e
o fator de ampliação tem teto (`alturaRef`). Sem isso, o enquadramento
automático encheria o quadro com qualquer bicho e o Pardalume de 30 cm sairia do
tamanho do Vharuneth de 3,4 m — a diferença de porte que a arte 2D guardava na
escala do desenho precisa sobreviver à mudança para 3D.

**Efeitos.** Chama, raio, halo, névoa e faísca continuam em 2D, pintados por
cima com as âncoras do modelo já projetadas na tela. Não é atalho: fogo e névoa
não têm superfície, então modelá-los como malha custaria caro e ficaria pior.

**Reserva.** `arte/criaturas.js` mantém o desenho 2D completo por camadas
(sombra → corpo → padrão → membros → cabeça → detalhes → olhos) com a
iluminação por normal map de `arte/luz.js`. Qualquer exceção no caminho 3D cai
para ele — um bicho renderizado do jeito antigo é aceitável, um bicho a menos
não é.

O padrão individual é aplicado **só dentro da silhueta**, usando um canvas
auxiliar:

> **Bug que isso corrigiu:** a primeira versão usava
> `ctx.globalCompositeOperation = 'source-atop'` direto no canvas de destino.
> Como o destino já tinha o cenário desenhado, o "atop" pegava o cenário inteiro
> como máscara e pintava um retângulo sólido por cima da criatura. A correção foi
> desenhar o padrão num canvas separado, recortá-lo contra a silhueta lá, e só
> então compor o resultado.

### Tiles

Cada tipo de tile é uma função que pinta 32×32 px usando `fbm` para variar cor e
detalhe. Grama tem lâminas desenhadas individualmente; pedra tem juntas; areia
tem grãos.

### Duas otimizações que valem entender

**1. Camada estática em resolução dobrada.**

O mapa inteiro é pintado uma vez num canvas fora de tela e depois só copiado.
Mas ele é pintado em **2×** e reduzido na hora de desenhar:

```js
// arte/mapa.js
A.SUPER = 2;
cv.width  = mapa.larg * TS * A.SUPER;
ctx.scale(A.SUPER, A.SUPER);

// jogo/mundo.js — reduz na cópia
ctx.drawImage(estatico, 0, 0, estatico.width, estatico.height,
              0, 0, mapa.larg * TS, mapa.alt * TS);
```

Motivo: no celular o mapa é ampliado ~2×, e ampliar um bitmap 1× borra. Pintar
em 2× e reduzir mantém tudo nítido.

**2. Cache LRU de dois mapas.**

A camada estática em 2× de um mapa 40×26 ocupa ~17 MB. Seis mapas em cache seriam
100 MB — inviável no celular. A solução guarda só os **dois últimos**: ir e voltar
por um portal continua instantâneo, e a memória fica limitada.

### Água

A água é desenhada **viva a cada quadro** (não entra na camada estática), com
ondulações senoidais. A espuma de margem usa uma máscara de vizinhança calculada
uma vez, na geração do mapa:

```js
var m = 0;
if (!ehAgua(mapa, x, y-1)) m |= 1;  // cima
if (!ehAgua(mapa, x, y+1)) m |= 2;  // baixo
if (!ehAgua(mapa, x-1, y)) m |= 4;  // esquerda
if (!ehAgua(mapa, x+1, y)) m |= 8;  // direita
aguas.push([x, y, tipo, m]);
```

Bitmask de 4 bits, calculada uma vez, usada 60 vezes por segundo. Sem ela, a
borda entre água e areia fica em escada.

---

## 10. Estado e salvamento

`js/motor/estado.js` guarda tudo num objeto só (`E.s`) e serializa em JSON no
`localStorage`, chave `crisalida.save.v1`.

Três decisões:

1. **Versão na chave.** Se o formato mudar, a chave muda e saves velhos não
   corrompem o jogo novo.
2. **Tudo em `try/catch`.** `localStorage` lança exceção em `file://` em alguns
   navegadores, em modo privado do Safari e com cota estourada. O jogo continua
   jogável sem salvar em vez de morrer na tela branca.
3. **Salva em eventos, não por timer.** Trocar de mapa, capturar, comprar, curar,
   a cada 40 passos, ao esconder a aba (`visibilitychange`) e ao fechar.

Exportar/importar é o mesmo JSON em Base64 — é o que permite levar o save de um
navegador para outro sem servidor nenhum.

---
---

# PARTE II — WEB3

> Daqui em diante assumo seu domínio de Solidity, EVM, ERC-20/721/1155 e
> tokenomics. O foco é **por que estas escolhas**, e onde elas quebram.

## 11. A tese econômica

A premissa que ordena todo o resto:

> **O jogo tem que ser bom sem token nenhum.**

Isso não é postura moral, é estrutura. Uma economia sustentada apenas por entrada
de capital novo precisa de entrada de capital novo para sempre; quando ela para,
o preço cai, quem jogava por rendimento sai, o preço cai mais. Foi o fim de
praticamente todo P2E de primeira geração.

A regra derivada, que dá para verificar em qualquer linha do desenho:

> Toda recompensa nasce de uma ação que **já seria divertida** sem recompensa.
> Todo custo compra algo que o jogador **queria de qualquer jeito**.

Por isso o maior sumidouro é *cuidar* — que já é o coração do jogo — e não uma
taxa inventada. E por isso a Fase 0 (jogo completo, sem cadeia) está pronta e as
Fases 1–7 podem nunca acontecer sem que nada quebre.

### A lore é a política monetária

Não é tema decorativo. Cada elemento narrativo é um parâmetro:

| Lore | Função |
|---|---|
| Ciclo de Orva (29,5 dias) | Época contábil: apura queima, decai emissão, resorteia oferta |
| Quais espécies descem | Válvula de oferta por espécie |
| Ânimo selvagem é éter solto | Não é NFT, não custa nada existir |
| O Selo cristaliza o éter | O ato de capturar é o que cunha |
| O batismo | Registro de nascimento imutável |
| Ânimo com fome perde vínculo | Consumo recorrente = queima recorrente |

Quando o jogador pergunta "por que o Vharuneth quase nunca aparece?", a resposta
é a mesma no jogo e na planilha: **Orva só o deixa descer 1 vez a cada 12 ciclos.**

---

## 12. Por que dois tokens

Um token só não consegue ser reserva de valor e moeda de giro ao mesmo tempo.
Quem tenta, ou infla e corrói quem segura, ou defla e impede o jogador novo de
comprar uma poção.

| | **ÉTER (ETR)** | **ÂMBAR (AMB)** |
|---|---|---|
| Papel | giro | reserva |
| Suprimento | sem teto rígido | **100M fixos** |
| Emissão | `40M × 0,985^ciclo` | **nenhuma após a gênese** |
| Ganha-se | jogando | por conquista |
| Gasta-se | consumo diário | atos permanentes |

O ÉTER não tem parede de suprimento, mas a soma infinita converge:

```
Σ 40M × 0,985ⁿ  =  40M / 0,015  ≈  2,67 bilhões
```

Limite assintótico em vez de teto arbitrário. E o teto **por ciclo** é apurado
dentro do próprio contrato:

```solidity
// contratos/Eter.sol
function tetoDoCiclo(uint256 ciclo) public pure returns (uint256) {
    if (ciclo > 400) return 0;
    uint256 v = EMISSAO_BASE_CICLO;
    for (uint256 i = 0; i < ciclo; ++i) v = (v * DECAIMENTO_BP) / BP;
    return v;
}
```

**Consequência de segurança que vale destacar:** se a chave do distribuidor de
recompensas vazar, o atacante não consegue cunhar infinito — o dano máximo é a
emissão de **um ciclo**, porque o teto é verificado no `emitirRecompensa`, não
confiado ao chamador.

O laço é memoizado (`_tetoComMemo`), então só a primeira emissão de cada ciclo
paga o custo; as demais leem um slot quente.

`Ambar.sol` não tem `mint`. Nem `owner`. A distribuição da gênese acontece no
construtor, com a soma das fatias verificada em `10.000` pontos-base e o resto de
arredondamento indo para a última fatia — o total bate exatamente.

---

## 13. A regra de ouro: mint só na captura

Um Ânimo selvagem **não é NFT**. Não tem token, não tem dono, não custa nada
existir, e some quando a batalha acaba.

```
encontro selvagem   → fora da cadeia, grátis, efêmero
arremesso do selo   → ON-CHAIN: queima aqui, dando certo ou não
captura             → ON-CHAIN: cunha o ERC-721 + certidão
```

Isso resolve três problemas de uma vez:

1. **Custo zero de oferta latente.** Podem existir bilhões de encontros por dia
   sem inflar nada. O gargalo não é quantos aparecem — é quantos são capturados.
2. **O gargalo é pago.** Cunhar exige queimar. Quem quer aumentar a oferta do
   mercado destrói valor para isso.
3. **A falha também custa.** O selo queima no **arremesso**. É disso que sai a
   próxima seção.

---

## 14. Dificuldade como política monetária

Este é o núcleo do desenho e a parte que mais vale seu escrutínio.

```
saturação(e)   = ofertaAtual(e) / meta(e)
razãoQueima    = queimadoNoCiclo / emitidoNoCiclo
fatorPolítica  = clamp( metaQueima / max(razãoQueima; 0,05) ; 0,60 ; 2,50 )

dificuldade(e) = (1 + saturação(e))^1,375  ×  fatorPolítica
custoDoSelo    = base × (1 + saturação(e))^0,625 × √fatorPolítica
capturaEfetiva = capturaBase(e) / dificuldade(e)
```

Com `meta(e) = 200.000 × (cap(e)/255)^2,25`, piso 20.

### Por que queimar no arremesso e não no sucesso

Porque isso desacopla **preço de tabela** de **custo real por NFT**.

Se o selo queimasse só quando a captura desse certo, o custo por NFT seria fixo e
a única alavanca seria mexer no preço — visível, impopular, lento. Queimando no
arremesso, subir a dificuldade multiplica o número de tentativas e portanto o
**custo médio por NFT cunhado**, sem tocar em nenhuma tabela.

É a diferença entre mudar a taxa de juros e mudar o preço do pão.

### Os dois eixos

**Eixo 1 — saturação por espécie.** Quanto mais Pardalumes existem, mais difícil
e mais caro capturar outro. A oferta se auto-limita perto da meta.

**Eixo 2 — razão de queima global.** Se o mundo queima menos do que emite, o
`fatorPolítica` sobe, tudo endurece, e mais queima acontece por NFT cunhado. Se
queima demais, o fator cai, a captura fica fácil, gente nova entra.

Termostato de duas vias, e dá para vê-lo funcionando:

```
ciclo  emitido  queimado  razão  fatorPolítica  saturação máx
    0    5,55M     3,99M   0,72           1,00          —
    2    5,38M     4,36M   0,81           1,50   ← endureceu
    8    4,92M     4,35M   0,89           1,17
   16    4,36M     4,30M   0,99           0,97   ← equilibrou
   23    3,92M     3,90M   0,99           1,06          ×1,29
```

Rode você mesmo:

```bash
node economia/simulador.js --ciclos 36 --jogadores 5000 --detalhe
```

### Metas que a curva de raridade produz

| Espécie | cap | Meta |
|---|---|---|
| Pardalume | 190 | ~103.000 |
| Geodante | 60 | ~8.300 |
| Verdil | 45 | ~4.400 |
| **Vharuneth** | 4 | **~20** |

Vinte Vharuneth. E há um **teto absoluto de 3× a meta** travado no contrato,
acima do qual `registrarCunhagem` reverte — nem a política monetária passa dele.

### Quem desce de Orva

Antes de qualquer conta de dificuldade vem uma pergunta binária: a espécie está
descendo? Se não, não é capturável a nenhum preço.

```solidity
function desceNoCiclo(uint256 ciclo, uint16 especie) public view returns (bool) {
    (uint256 num, uint256 den) = frequenciaDeDescida(capturaBase[especie]);
    if (den == 1) return true;
    uint256 sorteio = uint256(keccak256(abi.encodePacked(ciclo, especie))) % den;
    return sorteio < num;
}
```

Sem entropia de bloco, sem oráculo, sem VRF. **Puramente determinístico** — e isso
é deliberado: o calendário de Orva é público e verificável para qualquer ciclo
futuro, e nenhum minerador ou validador pode manipulá-lo. Uma lua de verdade
também é previsível.

---

## 15. Matemática WAD sem ponto flutuante

Expoentes fracionários em Solidity normalmente pedem `exp`/`ln` em ponto fixo
(PRBMath, solmate). Eu evitei a dependência escolhendo **expoentes que são
frações exatas de denominador 8 ou 4**:

```
x^(11/8) = x · ⁸√(x³)     → 1,375
x^(5/8)  =     ⁸√(x⁵)     → 0,625
x^(9/4)  = x² · ⁴√x       → 2,25
```

`⁸√` é `sqrt` três vezes; `⁴√` é `sqrt` duas vezes. Só precisa de `Math.sqrt` da
OpenZeppelin.

```solidity
function _sqrtWad(uint256 x) private pure returns (uint256) {
    return Math.sqrt(x * WAD);
}
function _pow11_8(uint256 x) private pure returns (uint256) {
    uint256 x3 = _mulWad(_mulWad(x, x), x);
    return _mulWad(x, _raiz8(x3));
}
```

Conferindo à mão para `x = 4e18`:
`x³ = 64e18` → `⁸√ = 1,6818e18` → `× 4 = 6,727e18`. E `4^1,375 = 6,7272`. ✓

**Foi por isso que `economia/parametros.json` mudou de 1,35/0,60/2,2 para
1,375/0,625/2,25.** Não é cosmético: com os valores originais, o JS e a cadeia
divergiriam, e o simulador estaria calibrando uma economia que o contrato não
executa.

### O ponto fraco honesto

`Math.sqrt` trunca. Três raízes aninhadas compõem o erro de truncamento. Para
`x ∈ [1, 4]` o desvio fica em torno de alguns wei — irrelevante para o resultado
econômico, mas **não verificado por teste**. Item obrigatório antes de qualquer
implantação:

```
fuzz: para x aleatório em [1e18, 4e18],
      |_pow11_8(x) − Math.pow(x/1e18, 1.375)*1e18| < ε
```

Um teste de diferencial contra `economia/modelo.js` é a forma mais barata de
garantir que as duas implementações não separaram.

---

## 16. O voucher EIP-712 e o modelo de confiança

O combate roda no navegador. Navegador é território hostil. Nada que o cliente
afirma pode virar mint.

```solidity
struct Arremesso {
    address vinculista;
    uint16  especie;  uint16 idSelo;
    uint32  semente;  uint32 ciclo;
    uint16  porte;    int16  matiz;
    uint8   nivel;    uint8  padrao;
    bool    prismatico;
    bool    sucesso;      // ← quem decide o resultado
    uint256 nonce;  uint256 prazo;
}
```

### A decisão de desenho mais discutível do repositório

O servidor assina **um voucher por arremesso, inclusive os que falharam**. O
contrato sempre queima o selo; só cunha se `sucesso == true`.

Alternativas que descartei, e por quê:

| Alternativa | Problema |
|---|---|
| Servidor só assina sucesso | Falhas nunca tocam a cadeia → o selo não queima no arremesso → some a alavanca de política monetária |
| Duas transações (arremessar, depois reivindicar) | UX inaceitável para a ação mais frequente do jogo |
| Commit-reveal on-chain | Duas transações de novo, mais complexidade |
| Chainlink VRF | Move a aleatoriedade para a cadeia, mas **não resolve nada aqui**: o combate inteiro é off-chain, então o servidor ainda decide o HP restante, o status e se o selo era aplicável. Trocaria um ponto de confiança por dois |

Fica registrado explicitamente: **o assinante é ponto único de confiança para o
resultado da captura.** Não dá para esconder isso atrás de VRF. A mitigação
honesta é: chave rotativa, teto de emissão por ciclo, teto de capturas por
carteira, e todo arremesso emitindo evento — auditável a posteriori.

### O que o voucher protege bem

```solidity
if (block.timestamp > v.prazo)   revert VoucherVencido(v.prazo);
if (nonceUsado[v.nonce])         revert NonceJaUsado(v.nonce);
if (v.vinculista != msg.sender)  revert AssinaturaInvalida();
if (v.ciclo != politica.cicloAtual()) revert CicloIncorreto(...);
if (!politica.desceNoCiclo(ciclo, v.especie)) revert EspecieNaoDesceNesteCiclo(...);
```

- **Replay:** nonce consumido antes de qualquer efeito.
- **Front-running / roubo de voucher:** `v.vinculista == msg.sender` amarra o
  voucher ao remetente. Um searcher que veja o voucher no mempool não consegue
  usá-lo.
- **Voucher guardado para o ciclo certo:** a checagem de ciclo impede estocar
  vouchers de uma janela em que a lendária descia.
- **Prazo:** limita a janela de um voucher vazado.

O `nonce` é global, não por usuário. Funciona porque o servidor emite nonces
únicos, mas é um acoplamento: dois servidores assinando em paralelo precisam
coordenar o espaço de nonce. Um `mapping(address => uint256)` sequencial seria
mais robusto ao custo de ordenação estrita por usuário.

---

## 17. O batismo e o espaço de nomes

```solidity
struct Nascimento {
    string  nome;             // imutável
    bytes32 nomeNormalizado;  // unicidade global
    address batizante;
    uint64  blocoNascimento;  uint64 tempoNascimento;
    uint32  cicloDeOrva;      uint32 semente;
    uint16  especie;  uint16 porte;  int16 matiz;
    uint8   nivelDeCaptura;  uint8 padrao;  bool prismatico;
}
```

Três decisões que fazem isso valer algo:

**1. O nome é único no mundo.** Existe um só "Brasa da Manhã". Primeiro que
batiza, leva.

**2. O nome de nascimento é imutável.** Dá para apelidar depois pagando
rebatismo, mas a certidão continua mostrando o nome original e quem o deu. Um
Ânimo revendido dez vezes ainda diz quem o encontrou. **Isso é proveniência
social**, e é mais difícil de falsificar que qualquer selo de raridade.

**3. A aparência nasce com ele.** A `semente` é a mesma de
`js/motor/criatura.js`. O NFT não aponta para uma imagem num servidor — ele
*contém* a instrução de como se desenhar. Se a infraestrutura sumir, a arte
continua reconstruível a partir da cadeia, rodando `arte/criaturas.js` com aquela
semente. Poucas coleções conseguem dizer isso.

**Normalização fica fora da cadeia.** O contrato guarda o `bytes32` e só verifica
unicidade sobre ele. Normalizar Unicode em Solidity seria caro e frágil; a
responsabilidade é do cliente e do assinante — com a consequência de que um
assinante malicioso poderia registrar duas grafias do "mesmo" nome. Trade-off
consciente.

---

## 18. Superfície de ataque

O que eu tentaria, se quisesse quebrar isto:

**1. Comprometer o assinante.** Maior prêmio do sistema. Permite cunhar qualquer
espécie com qualquer semente (inclusive Prismático) até o teto por carteira e por
espécie. *Contido por:* teto de 3× a meta por espécie, teto de capturas por
carteira por ciclo, chave rotativa. *Não contido:* escolha de traços — um
assinante comprometido cunha Prismáticos à vontade dentro dos tetos.

**2. Corrida de gás pela última lendária.** Perto do teto de 20 Vharuneth, os
últimos mints viram leilão de prioridade. Pior: as transações perdedoras
**revertem** em `registrarCunhagem`, e o jogador paga gás por nada. Melhoria
concreta: expor `vagasRestantes(especie)` e checar cedo no fluxo, e considerar
uma fila ou lote por ciclo em vez de corrida aberta.

**3. Squat de nomes.** Nomes são recurso escasso e não renovável. Um bot pode
registrar os melhores por 5 AMB cada. *Mitigação atual:* só o custo. Provavelmente
insuficiente — vale considerar limite de nomes por carteira por ciclo, ou leilão
para nomes curtos.

**4. Griefing de saturação.** Cunhar em massa uma espécie barata para elevar a
saturação e encarecer para os outros. Mas quem faz isso paga a conta inteira e
fica com os NFTs desvalorizados. **O ataque é autopunitivo** — este eu considero
bem defendido.

**5. Manipulação da razão de queima.** O `fatorPolítica` lê o ciclo anterior. Uma
baleia poderia queimar muito no fim de um ciclo para amolecer a política do ciclo
seguinte. Custo real, benefício difuso e compartilhado com todos os outros
jogadores. Ataque caro e pouco lucrativo, mas **real** — mereceria uma média móvel
de N ciclos em vez de um só.

**6. Reentrância.** `nonReentrant` em toda entrada de token; efeito antes de
interação; `_safeMint` por último. Considero coberto.

**7. Griefing por `registrarCunhagem`.** Se a política for reapontada para um
contrato malicioso, ele pode reverter tudo. *Mitigação:* `definirContratos` é
`onlyOwner` — o que empurra o risco para a chave do dono. Um timelock no owner
seria a evolução natural.

**8. Precisão do WAD.** Já discutido: sem teste. É o item que eu resolveria
primeiro.

---

## 19. Dois bugs corrigidos e por que importam

Encontrados em revisão dos contratos. Ambos já corrigidos, e
os dois são de classes que valem reconhecer.

### Bug 1 — hash errado libera o nome antigo

```solidity
// ANTES — errado
bytes32 anterior = keccak256(bytes(_apelido[tokenId]));
if (anterior != keccak256("")) delete tokenPorNome[anterior];
```

`tokenPorNome` é indexado pelo hash **normalizado**, que o chamador fornece. Mas
aqui eu calculava `keccak256` do **texto cru**. São valores diferentes. O `delete`
apagava uma chave inexistente, e o apelido antigo ficava **reservado para
sempre** — vazamento permanente no espaço de nomes.

```solidity
// DEPOIS — guarda o hash normalizado
mapping(uint256 tokenId => bytes32) private _apelidoNormalizado;

bytes32 anterior = _apelidoNormalizado[tokenId];
if (anterior != bytes32(0)) delete tokenPorNome[anterior];
```

**A classe:** quando uma chave de índice é *derivada* em um lugar e *fornecida* em
outro, elas divergem em silêncio. Se um mapping é indexado por um valor calculado
fora da cadeia, guarde esse valor — não tente recalculá-lo.

### Bug 2 — o termostato nunca ligava

`PoliticaEconomica.razaoQueima()` divide `queimadoNoCiclo` por `emitidoNoCiclo`.
Os sumidouros chamavam `registrarFluxo(0, queima)` corretamente. Mas **nada
chamava `registrarFluxo(emitido, 0)`** — `Eter.emitirRecompensa` não conhecia a
política.

Resultado: `emitido` sempre 0 → `razaoQueima` retorna `WAD` (neutro) → o
`fatorPolítica` fica travado em 1,00 **para sempre**. Todo o mecanismo de
autorregulação — o coração do desenho — seria código morto em produção.

```solidity
// Eter.sol, agora
_mint(para, valor);
if (address(politica) != address(0)) politica.registrarFluxo(valor, 0);
```

**A classe:** o mais perigoso não é o que reverte — é o que retorna um valor
plausível. Uma divisão por zero protegida que devolve "neutro" esconde uma
integração faltando. Nenhum teste unitário de contrato isolado pegaria isso; só
um teste de integração que verifique que `fatorPolítica` de fato **muda**.

> Repare que o simulador em JS não pegou nenhum dos dois, porque ele modela as
> *fórmulas*, não a *fiação entre contratos*. São ferramentas para camadas
> diferentes, e você precisa das duas.

---

## 20. O que falta

Em ordem de prioridade real:

| # | Item | Por quê |
|---|---|---|
| 1 | Testes (Foundry), com fuzz do WAD e diferencial contra `modelo.js` | Sem isso, tudo acima é hipótese |
| 2 | Teste de integração provando que `fatorPolítica` muda | Foi exatamente o bug 2 |
| 3 | Timelock no owner dos contratos | Hoje o dono reaponta a política num bloco |
| 4 | Média móvel de N ciclos na razão de queima | Reduz manipulação de fim de ciclo |
| 5 | Repensar a corrida pela última lendária | Jogador paga gás para reverter |
| 6 | Rede de testes com uso real | Números de gás, UX de carteira |
| 7 | Auditoria externa | — |
| 8 | Parecer jurídico | Ver abaixo |

### O que precisa de advogado, não de programador

Fora da minha competência, e com consequência real:

- **Pagar valor real por resultado aleatório** é tratado como loot box, e como
  jogo de azar, em várias jurisdições. Bélgica e Holanda já proibiram formatos
  parecidos.
- **Token com expectativa de lucro pelo esforço de terceiros** pode ser
  classificado como valor mobiliário. Distribuição da gênese, vesting e o texto
  de marketing entram nessa análise.
- **KYC/AML e tributação** do jogador variam por país e podem recair sobre o
  operador.
- **Público infantil.** Um jogo de colecionar criaturas atrai menores, e isso
  muda publicidade, consentimento e a legalidade de mecânica paga aleatória.

---
---

# PARTE III — Exercícios de fixação

Do mais fácil ao mais difícil. Todos verificáveis. Servem para quem for
pegar o projeto e precisar entendê-lo de verdade antes de mexer.

**1. Uma espécie nova.** Adicione a 29ª em `js/data/especies.js`, com linha
evolutiva e técnicas por nível. Coloque-a numa tabela de encontro em
`js/data/mundo.js`. *Verificação:* apareça na grama e no bestiário.

**2. Um aspecto novo.** Adicione um 13º tipo em `js/data/tipos.js` com suas
relações. *Pense:* a matriz é esparsa — quantas entradas você precisa escrever de
verdade?

**3. Mude o clima.** Faça a chuva reduzir dano de Brasa em 50%. *Onde:* a fórmula
em `js/motor/batalha.js:200`. *Cuidado:* não coloque isso na UI.

**4. Quebre e conserte o carregamento.** Mova `data/especies.js` para antes de
`data/tecnicas.js` no `index.html`. Observe o erro exato. Entenda por quê.

**5. Calibre a economia.** Dobre o custo dos elixires em
`economia/parametros.json` e rode `node economia/simulador.js`. Qual alerta
aparece? Agora ajuste as recompensas até fechar. *Isto é o trabalho real de
tokenomics.*

**6. Estresse o termostato.** Rode com `--jogadores 50000 --ciclos 60`. O
`fatorPolítica` ainda converge? Em quantos ciclos?

**7. Escreva o teste que faltava.** Em Foundry, prove que `fatorPolítica()` muda
quando `registrarFluxo` recebe queima diferente de emissão. Esse é literalmente o
teste que teria pego o bug 2.

**8. Fuzz do WAD.** Prove que `_pow11_8` bate com `Math.pow(x, 1.375)` dentro de
uma tolerância. Ache a tolerância real por experimento, não por chute.

**9. Resolva a corrida da lendária.** Proponha e implemente um mecanismo em que a
transação perdedora não desperdice gás. *Dica:* pense em janela de compromisso
por ciclo em vez de corrida contínua.

**10. Ataque o próprio sistema.** Escolha um dos oito vetores da seção 18 e
escreva a prova de conceito em Foundry. Se conseguir, você achou o item 0 da
lista de prioridades.

---

## Mapa de arquivos

```
index.html                    ordem de carregamento — comece por aqui
js/core.js                    ruído, cor, utilidades
js/data/tipos.js              matriz esparsa de efetividade
js/data/especies.js           as 28 espécies e sua arte
js/motor/criatura.js:85       fórmula de atributos
js/motor/criatura.js:104      modificadores de cuidado
js/motor/batalha.js:200       fórmula de dano
js/motor/batalha.js:319       fórmula de captura  ← acopla com a Parte II
js/jogo/mundo.js              loop, câmera, encontros
js/arte/mapa.js               tiles, água, camada 2×
js/motor/estado.js            save em localStorage

docs/ECONOMIA.md              a ideologia econômica completa
economia/parametros.json      todos os números
economia/modelo.js            as fórmulas em JS
economia/simulador.js         simulação de ciclos
contratos/Eter.sol            teto por ciclo, memoizado
contratos/Ambar.sol           sem mint, sem owner
contratos/PoliticaEconomica.sol  o termostato e a matemática WAD
contratos/VinculoEtereo.sol   captura, batismo, certidão
contratos/InsumosDeVinculo.sol   ERC-1155 consumível
contratos/Tesouraria.sol      cofre com espera de 48h
```
