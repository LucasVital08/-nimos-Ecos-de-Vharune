# CRISÁLIDA — Ecos de Vharune

Um RPG de exploração e captura de criaturas que roda **direto no navegador**, sem
instalação, sem build, sem dependências e sem conexão com a internet.

Universo, criaturas, tipos elementais, mapa, narrativa, itens, interface e toda a
arte são **originais e autorais**. Nenhum asset, nome, personagem, mapa, som ou
elemento de qualquer franquia existente foi usado ou referenciado.

> Trezentos anos atrás a lua **Orva** se partiu. Pela fenda escorre o éter cru que
> o Véu segurava, e onde a luz de Orva toca o chão nascem os **Ânimos**. Eles ainda
> descem, a cada ciclo. Quem aprende a caminhar ao lado deles é chamado de
> **Vinculista**.

---

## Como jogar

### Opção 1 — abrir o arquivo (mais simples)

Dê um duplo clique em **`index.html`**, ou arraste o arquivo para uma janela do
navegador. Só isso. O jogo usa scripts clássicos (sem módulos ES), então funciona
pelo protocolo `file://` sem qualquer servidor.

### Opção 2 — servidor local (recomendado para desenvolvimento)

Alguns navegadores restringem `localStorage` em `file://`. Se o salvamento não
funcionar, sirva a pasta por HTTP:

```bash
python3 -m http.server 8931
```

Depois abra <http://localhost:8931>. Com Node instalado, uma alternativa é:

```bash
npx serve -l 8931 .
```

**Requisitos:** qualquer navegador moderno com `<canvas>` e `localStorage`
(Chrome, Firefox, Safari, Edge). Desktop e celular.

---

## Controles

| Ação | Teclado | Celular |
|---|---|---|
| Andar | Setas ou `W` `A` `S` `D` | Direcional na esquerda |
| Interagir / confirmar / avançar diálogo | `Espaço`, `Enter` ou `E` | Botão **A** |
| Menu principal | `M` ou `Esc` | Botão **MENU** |
| Equipe | `P` | Menu → Equipe |
| Bestiário | `B` | Menu → Bestiário |
| Mochila | `I` | Menu → Mochila |
| Escolher opção em combate | `1` a `4` | Toque |
| Voltar em combate | `Esc` | Botão “← Voltar” |

Os controles de toque aparecem automaticamente em telas pequenas e em
dispositivos sem mouse.

---

## O mundo

Seis regiões conectadas, todas exploráveis a pé:

| Região | O que tem |
|---|---|
| **Vila Cinzalva** | Ponto de partida. Empório Âmbar (loja), Santuário (cura), sua casa, ateliê da Mestra Oriel, praça com fonte, canteiro de grama alta para treino |
| **Campo de Névoa** | Rota principal, grama alta por toda parte, lagoas, encruzilhada para as demais regiões |
| **Bosque Solene** | Floresta densa, clareiras com Ânimos de Verdejo, arbustos, cristais ao sul |
| **Lago Miravel** | Lago navegável, praia de areia, ponte, casa de repouso e **pesca** (com a Vara de Junco) |
| **Passo Ferrugem** | Montanha com desfiladeiros, oficina/forja, minas, Ânimos de Ferro e Gélido |
| **Ruínas de Aldherin** | Área final selada por um amuleto. Névoa de éter no lugar da grama, pilares quebrados, as espécies mais raras — inclusive o lendário **Vharuneth** |

O mapa é desenhado **proceduralmente em canvas**: não existe tileset de imagem.
Grama, terra, calçada, água animada, árvores, telhados, rochas, penhascos,
pilares, cristais e flores são pintados por código com ruído determinístico —
o mesmo mapa é sempre idêntico, mas nenhum tile fica igual ao vizinho.

---

## Sistemas

### Criaturas — 28 espécies originais

Cada Ânimo tem **Vigor (HP), Ataque, Defesa, Atq. Especial, Def. Especial,
Velocidade, nível, XP e até 4 técnicas**, além de:

- **Atributos ocultos** (0–31 por atributo), sorteados no nascimento;
- **Natureza** (10 possíveis), que sobe um atributo em 10% e baixa outro;
- **Marca individual**: padrão visual, porte, desvio de matiz e semente própria.

São 10 linhas evolutivas (3 estágios nas iniciais) e 3 espécies solitárias, mais
o lendário. Todas são obteníveis — há um teste automatizado que verifica isso.

### Variação individual

Dois indivíduos da mesma espécie **nunca saem iguais**. Cada um combina:

- **8 padrões visuais** — Liso, Malhado, Listrado, Salpicado, Faixado, Mármore,
  Degradê e Estelar, aplicados só sobre a silhueta da criatura;
- **desvio de matiz** de ±17°;
- **porte** entre 90% e 112%;
- variante **Prismática** rara (≈1 em 480), com paleta deslocada e brilho.

Em uma amostra de 400 Pardalumes gerados, 397 aparências distintas.

### Aspectos do éter (tipos)

Onze aspectos — Brasa, Torrente, Verdejo, Fulgor, Gélido, Terra, Zéfiro, Umbra,
Aurora, Ferro e Toxina — mais **Éter**, neutro contra tudo. A tabela tem
resistências, fraquezas e três imunidades (Fulgor→Terra, Terra→Zéfiro,
Toxina→Ferro). Ela pode ser consultada dentro do jogo em Bestiário → Aspectos.

### Combate por turnos

- 62 técnicas, divididas em **físicas, especiais e de apoio**;
- efetividade de tipo com multiplicadores de ×0 a ×4 e mensagem de retorno;
- **bônus de afinidade** (+50% quando a técnica é do tipo do Ânimo);
- **golpes críticos**, **precisão e esquiva**, prioridade de golpe, golpes
  múltiplos, dreno, recuo e alteração de atributos em 12 estágios;
- **condições**: Queimadura, Veneno (progressivo), Paralisia, Congelamento e
  Sono, com imunidades temáticas por tipo;
- **captura** com chance calculada a partir de vigor restante, condição, espécie,
  nível e selo usado — a *Lente do Véu* mostra a porcentagem estimada;
- **troca de Ânimo** durante a batalha (voluntária ou forçada após desmaio),
  **itens de cura** e **fuga** com chance baseada em velocidade e tentativas.

### Equipe e Santuário

Até **6 Ânimos** na equipe; o primeiro da lista é o **líder** e é quem inicia o
combate. Dá para reordenar, promover a líder, ver detalhes, cuidar, apelidar,
evoluir manualmente, reensinar técnicas e enviar ao Santuário — que guarda
quantos Ânimos você quiser, sem gastar energia nem passar fome.

### Cuidado

Cada Ânimo tem três medidores que mudam o desempenho em combate:

| Medidor | Cai com | Efeito quando baixo | Efeito quando alto |
|---|---|---|---|
| **Energia** | Passos e turnos de combate | −20% de dano, −30% de velocidade | — |
| **Saciedade** | Tempo de caminhada | Vínculo começa a cair | Regeneração lenta de vigor |
| **Vínculo** | Desmaios e fome | −4% de dano | +10% dano, +6% crítico, +20% XP |

Alimentos, escova, cristal de descanso, incenso e o Sino do Vínculo atuam sobre
esses medidores. Dormir em casa ou visitar um Santuário restaura tudo.

### Bestiário

Registra três estados por espécie: **desconhecida** (silhueta escura),
**vista** (encontrada em batalha) e **capturada** (vínculo firmado). A ficha
completa — atributos base, altura, peso, evolução, dificuldade de captura e
técnicas por nível — só abre para espécies capturadas.

### Mochila e economia

23 itens em cinco categorias: **selos** de captura (incluindo dois temáticos, que
funcionam muito melhor contra tipos específicos), **cura**, **alimentos**,
**cuidado** e **chaves**. A moeda é a **Ambra**; vitórias rendem Ambras e o
Empório compra e vende.

### Salvamento automático

Tudo é gravado no `localStorage` (`crisalida.save.v1`) ao trocar de mapa, capturar,
comprar, curar, a cada 40 passos, ao esconder a aba e ao fechar a página. Em
**Menu → Opções** dá para salvar na hora, **exportar/importar** o save em texto e
apagar tudo.

---

## Como testar rápido

1. Abra `index.html` e clique em **Novo vínculo**.
2. Escolha um dos três Ânimos iniciais e confirme o nome.
3. Ande para o **sul** com as setas até a grama alta da praça — os encontros
   começam ali mesmo, com Ânimos de nível 2 a 4.
4. Em combate: **Lutar** mostra a efetividade de cada técnica antes de você
   escolher. Enfraqueça o alvo e use **Selo**.
5. Abra a **Equipe** (`P`): toque num Ânimo → **Cuidar** para alimentar e
   escovar, e veja os medidores subirem.
6. Volte ao **Santuário** (prédio à direita da praça, porta à frente) para curar
   de graça, e ao **Empório** (prédio à esquerda) para comprar selos.
7. Siga ao sul para o **Campo de Névoa** e adiante.
8. Recarregue a página: o botão **Continuar** retoma exatamente de onde parou.

### Verificação de sintaxe

```bash
find js -name '*.js' -exec node --check {} \;
```

Todos os 18 arquivos passam sem erro. O projeto não tem dependências de execução.

---

## Estrutura

```
index.html                 página única, scripts clássicos em ordem
css/estilo.css             identidade visual (âmbar sobre ameixa noturna)
js/core.js                 utilidades, RNG determinístico, ruído, barramento
js/data/tipos.js           os 12 aspectos e a matriz de efetividade
js/data/tecnicas.js        62 técnicas e as 5 condições de estado
js/data/especies.js        as 28 espécies (atributos, evolução, arte, aprendizado)
js/data/itens.js           23 itens em 5 categorias
js/data/mundo.js           os 6 mapas, NPCs, portais, placas e encontros
js/arte/criaturas.js       desenho procedural das criaturas (9 arquétipos)
js/arte/mapa.js            desenho procedural dos tiles e da água animada
js/arte/personagens.js     sprites de personagens e ícones de item
js/motor/criatura.js       atributos, XP, evolução, cuidado
js/motor/batalha.js        combate por turnos (devolve uma fila de eventos)
js/motor/estado.js         estado do jogo, bestiário, mochila, salvamento
js/jogo/mundo.js           câmera, movimento, encontros, interação
js/jogo/principal.js       título, introdução, escolha inicial, amarração
js/ui/nucleo.js            diálogo, avisos, painéis, componentes
js/ui/telas.js             equipe, bestiário, mochila, loja, opções
js/ui/batalha.js           cena de combate e reprodução dos eventos
js/web3/carteira.js        camada Web3 opcional, somente leitura

docs/ECONOMIA.md           a ideologia econômica play-to-earn (especificação)
economia/parametros.json   todos os números da economia, fonte única
economia/modelo.js         as fórmulas em JS (não carregado pelo jogo)
economia/simulador.js      simulação headless de ciclos de Orva
contratos/                 ERC-20, ERC-721 e ERC-1155 de referência
```

O motor de batalha não desenha nada: ele devolve uma **fila de eventos**
(`msg`, `dano`, `status`, `troca`, `capturado`…) que a interface reproduz em
sequência. Isso permitiu simular 600 batalhas completas fora do navegador durante
o desenvolvimento, sem nenhum DOM.

---

## Economia play-to-earn — projetada, **não implementada**

A fundação econômica vive em `docs/ECONOMIA.md`, `economia/` e `contratos/`.
**O jogo não carrega uma linha desses diretórios** — de propósito, para a economia
amadurecer sem travar o desenvolvimento e os testes de gameplay.

Resumo do desenho:

- **Dois tokens.** *Éter* (ETR) é a moeda de giro, com emissão por ciclo caindo
  1,5% para sempre. *Âmbar* (AMB) é escassa: 100M na gênese, sem função de mint.
- **Ânimo selvagem não é NFT.** Ele é éter solto — não tem token, não tem dono e
  some quando a batalha acaba. Só vira NFT no instante da captura.
- **O selo queima no arremesso, dando certo ou não.** É isso que transforma
  dificuldade em política monetária.
- **O batismo.** Ao capturar, você dá o nome. Ele é único no mundo, imutável, e
  fica gravado numa certidão de nascimento junto com a semente que desenha aquele
  indivíduo — o NFT não aponta para uma imagem, ele *contém* como se desenhar.
- **Cuidar é o maior sumidouro.** Elixires e alimentos são ERC-1155 que queimam
  token ao serem cunhados e queimam a si mesmos ao serem usados.
- **Termostato.** Se o mundo queima menos do que emite, tudo fica mais difícil e
  mais caro até voltar ao equilíbrio. E cada espécie tem uma meta de oferta: quanto
  mais Pardalumes existem, mais difícil e mais caro capturar outro.
- **Ciclos de Orva.** A cada 29,5 dias a lua resorteia quais espécies descem.
  Lendário desce 1 vez a cada 12 ciclos — por isso só existirão ~21 Vharuneth.

Rodando a simulação de 3.000 jogadores por 24 ciclos:

```bash
node economia/simulador.js
```

O termostato converge sozinho (`fatorPolítica` sai de 1,50 e volta para ~1,00) e
nenhuma espécie encosta no teto. A simulação já pegou dois erros de calibração
antes de existir contrato — os dois estão documentados em `docs/ECONOMIA.md`.

> **Fase 0 é o que existe: o jogo, completo e jogável, sem blockchain nenhuma.**
> Se as fases seguintes nunca acontecerem, Crisálida continua sendo um jogo inteiro.

## Blockchain / NFT — opcional, desligado e sem transações

O jogo é **completo sem blockchain**. Nada em `js/web3/carteira.js` é necessário
para jogar, e o módulo segue regras rígidas:

- **nenhum deploy** é feito e **nenhum NFT real é criado**;
- **nenhuma transação** é montada, assinada ou enviada — não existe
  `eth_sendTransaction`, `personal_sign`, `approve` nem chamada que gaste gás em
  lugar nenhum do código;
- a conexão só acontece **quando a pessoa clica no botão**, e serve apenas para
  exibir o endereço público e a rede;
- o save continua no `localStorage`, como sempre;
- se nenhuma carteira existir no navegador, o painel apenas informa isso.

O painel também gera **localmente** o JSON de metadados no padrão ERC-721 de um
Ânimo da sua equipe, com a arte embutida como `data:` URI, e permite baixá-lo.
Nada é enviado para lugar nenhum.

### `contratos/`

Seis contratos de referência, **nenhum compilado ou implantado por este jogo**:
`Eter.sol` (ERC-20 mole), `Ambar.sol` (ERC-20 duro), `PoliticaEconomica.sol`
(o termostato), `InsumosDeVinculo.sol` (ERC-1155 consumível), `VinculoEtereo.sol`
(ERC-721 dos Ânimos + batismo) e `Tesouraria.sol` (cofre com espera).

Detalhes e ordem de implantação em `contratos/README.md`. Principais escolhas de
segurança:

1. **Nenhuma função é `payable`** em contrato nenhum: sem `receive`, sem `fallback`;
2. `Ambar` **não tem função de mint** — o suprimento só cai, por queima;
3. `Eter` trava o teto de emissão do ciclo no próprio contrato: chave de
   distribuidor vazada causa dano de no máximo um ciclo;
4. cunhagem de NFT só com **voucher EIP-712** (nonce, prazo, ciclo). Nem o dono
   cunha sem assinatura válida;
5. **teto absoluto por espécie** (3× a meta) — nem a política monetária passa dele;
6. teto de capturas por carteira por ciclo, contra fazenda de bots;
7. efeito antes da interação em todo caminho com `_safeMint`/`transfer`, mais
   `ReentrancyGuard` onde entra token;
8. `renounceOwnership` desabilitado em todos;
9. tesouraria com fila de saída de 48h e teto por janela de 30 dias — só a queima
   é imediata;
10. sem `selfdestruct`, sem `delegatecall`, sem proxy, sem upgrade.

Dependem de `@openzeppelin/contracts ^5.0.0`, que **não** está incluído aqui.
Se quiser experimentar por conta própria, use **apenas rede de testes**
(Sepolia, Amoy, Base Sepolia) e faça sua própria auditoria:

```bash
npm i -D hardhat @openzeppelin/contracts
```

---

## Créditos e licença

Criado do zero como projeto autoral: nomes, criaturas, mundo, narrativa,
personagens, tipos elementais, itens, técnicas, interface e toda a arte
(desenhada por código, sem imagens externas).

Uso livre para estudo e modificação.
