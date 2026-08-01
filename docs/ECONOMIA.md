# ÂNIMOS — Fundação econômica play-to-earn

> **Estado: especificação. Nada aqui está implantado, conectado ao jogo ou vivo.**
> O jogo em `js/` não lê uma linha deste diretório. Isso é intencional: a economia
> amadurece em paralelo, sem travar o desenvolvimento e os testes de gameplay.

---

## 0. O princípio que manda em todos os outros

**O jogo tem que ser bom sem token nenhum.**

Se a única razão para jogar Ânimos for extrair valor, a economia morre — e leva o
jogo junto. Isso não é opinião moral, é mecânica: uma economia sustentada só por
entrada de capital novo precisa de entrada de capital novo para sempre. Quando ela
para, o preço cai, quem jogava por dinheiro sai, o preço cai mais. Foi assim em
todos os P2E de primeira geração.

Então a regra que ordena o resto:

> Toda recompensa nasce de uma ação que **já seria divertida** sem recompensa.
> Nenhum sumidouro existe só para queimar: todo custo compra algo que o jogador
> queria de qualquer jeito.

Cuidar de um Ânimo é o coração do jogo *e* o maior sumidouro. Capturar é a
fantasia central *e* o controle de oferta. Não é coincidência — é o desenho.

---

## 1. A lore é a política monetária

Trezentos anos atrás a lua **Orva** se partiu. Pela fenda escorre o éter cru que o
Crisálida derrama, e é dele que os Ânimos nascem. Eles não existem "no mundo": eles
**descem de Orva**, em ciclos.

Isso não é enfeite. É o mecanismo:

| Lore | Função econômica |
|---|---|
| Ciclo de Orva (29,5 dias) | Época contábil: apura queima, decai emissão, resorteia oferta |
| Quais espécies descem no ciclo | Válvula de oferta por espécie |
| Ânimo selvagem é feito de éter solto | Não é NFT, não tem custo, não tem dono |
| O Selo cristaliza o éter em âmbar | O ato de capturar é o que cunha o NFT |
| O batismo dá nome ao que era anônimo | Registro de nascimento imutável on-chain |
| Ânimo com fome perde vínculo | Consumo recorrente obrigatório = queima recorrente |

Quando um jogador pergunta "por que o Vharuneth quase nunca aparece?", a resposta
é a mesma no jogo e na planilha: **Orva só o deixa descer uma vez a cada doze
ciclos.**

---

## 2. Dois tokens, dois trabalhos

Um token só não consegue ser ao mesmo tempo reserva de valor e moeda de giro.
Quem tenta, ou tem inflação que corrói o investidor, ou tem deflação que impede
o jogador novo de comprar uma poção.

### ÉTER (ETR) — a moeda de giro

- Sem teto rígido, mas a **emissão por ciclo decai 1,5% para sempre**.
- Emissão do ciclo *n*: `40.000.000 × 0,985ⁿ`
- Soma infinita ≈ **2,67 bilhões**. O teto existe, só não é uma parede.
- Ganha-se jogando. Queima-se consumindo. É para gastar, não para guardar.

### ÂMBAR (AMB) — a moeda dura

- **100.000.000, cunhados uma única vez na gênese. Nunca mais.**
- Usado no que é permanente: Selo da Crisálida, batismo, rebatismo, taxa de mercado.
- Só entra em circulação por conquista (primeira captura de espécie, marcos de
  bestiário, ranking de cuidado) e volta por queima.

Distribuição da gênese:

| Fatia | % | Liberação |
|---|---|---|
| Recompensas de jogo | 30% | linear, 96 meses |
| Tesouraria e desenvolvimento | 20% | linear, 48 meses |
| Liquidez | 15% | na gênese |
| Comunidade e eventos | 15% | por governança |
| Equipe | 12% | cliff 12 meses, linear 48 |
| Reserva de emergência | 8% | travada, só por governança |

---

## 3. A regra de ouro: Ânimo selvagem não é NFT

Um Ânimo selvagem é **éter solto**. Ele não tem token, não tem dono, não tem
custo de existir e some quando a batalha acaba.

Ele só vira NFT **no instante da captura** — e isso resolve três problemas de uma vez:

1. **Custo zero de oferta latente.** Podem existir bilhões de encontros por dia
   sem inflar nada. O gargalo não é quantos aparecem, é quantos são capturados.
2. **O gargalo é pago.** Cunhar exige queimar um Selo. Quem quer aumentar a oferta
   do mercado precisa destruir valor para isso.
3. **Falha também custa.** O Selo é queimado no **arremesso**, não no sucesso.
   É isso que faz a dificuldade virar instrumento de política monetária: subir a
   dificuldade aumenta o custo médio por NFT cunhado **sem** mexer no preço de tabela.

```
encontro selvagem   → off-chain, grátis, efêmero
arremesso do selo   → ON-CHAIN: queima acontece aqui, dando certo ou não
captura bem-sucedida→ ON-CHAIN: cunha o ERC-721 + batismo
```

---

## 4. O batismo: a certidão de nascimento

No instante em que o vínculo se firma, o jogador **dá um nome** ao Ânimo. Esse é o
batismo, e ele é gravado na blockchain junto com tudo que aquele indivíduo é:

```solidity
struct Nascimento {
    string  nome;            // escolhido no batismo
    bytes32 nomeNormalizado; // garante unicidade global
    address batizante;       // quem estava lá
    uint64  blocoNascimento;
    uint64  tempoNascimento;
    uint32  cicloDeOrva;     // sob qual lua ele desceu
    uint16  especie;
    uint32  semente;         // semente da arte procedural — a aparência
    uint8   nivelDeCaptura;
    uint8   padrao;
    int16   matiz;
    uint16  porte;
    bool    prismatico;
}
```

Três decisões que fazem isso valer alguma coisa:

- **O nome é único no mundo inteiro.** Existe um só "Brasa da Manhã". O primeiro
  que batizar leva.
- **O nome de nascimento é imutável.** Dá para *apelidar* depois pagando rebatismo,
  mas a certidão continua mostrando o nome original e quem o deu. Um Ânimo
  revendido dez vezes ainda diz quem o encontrou.
- **A aparência nasce com ele.** A `semente` é a mesma que o jogo já usa para
  desenhar padrão, matiz e porte. Ou seja: o NFT não aponta para uma imagem num
  servidor — ele **contém** a instrução de como se desenhar. Se o servidor sumir,
  a arte continua reconstruível a partir da cadeia.

---

## 5. Insumos são NFT consumível (ERC-1155)

Selos, elixires, alimentos e itens de cuidado viram **ERC-1155**: fungíveis entre si,
mas com id próprio por tipo.

O ciclo de vida é o sumidouro:

```
cunhar insumo  →  queima ETR    (entra no inventário on-chain)
usar insumo    →  queima o NFT  (sai de circulação para sempre)
```

E aqui está a razão de a **saciedade** existir no jogo desde o primeiro dia: ela
força consumo recorrente. Um Ânimo com saciedade zerada por um ciclo inteiro entra
em **Letargia** — não batalha e não gera recompensa até ser alimentado.

> **Letargia é reversível e nunca destrói o NFT.** Um ativo que o dono pode perder
> por não pagar manutenção é uma armadilha, não um jogo. O Ânimo dorme; ele não
> morre. Basta alimentar para acordar.

A sincronia do cuidado com a cadeia é **preguiçosa**: você só assina o estado de
cuidado quando quer resgatar recompensa. Cuidar todo dia on-chain seria insuportável
em gás.

---

## 6. Os sumidouros, e por que cada um existe

| Sumidouro | Moeda | Custo base | Queima | Por que existe |
|---|---|---|---|---|
| Selo Simples | ETR | 12 | 100% | Válvula principal de oferta de NFT |
| Selo Reforçado | ETR | 40 | 100% | Idem, para quem quer menos tentativas |
| Selo do Lago / da Brasa | ETR | 80 | 85% | Especialização por tipo |
| Selo Áureo | ETR | 120 | 70% | Alto valor, parte financia o tesouro |
| Selo da Crisálida | AMB | 25 | 60% | Único capaz de lendário — em moeda dura |
| Elixires e alimentos | ETR | 4–95 | 100% | Consumo recorrente do cuidado |
| Cura no Santuário | ETR | 6 | 100% | Sumidouro de alta frequência e valor baixo |
| **Batismo** | AMB | 5 | 50% | Cobra pelo registro permanente |
| **Rebatismo** | AMB | 25 | 80% | Torna caro poluir o espaço de nomes |
| Taxa de mercado | qualquer | 5% | 40% | Captura valor da especulação |

Percentual que não queima vai para a **Tesouraria**, que financia recompensas
futuras, liquidez e desenvolvimento — nunca para o bolso de ninguém sem governança.

---

## 7. A fórmula: dificuldade como política monetária

É aqui que os pedidos "queimar para gerar rotatividade" e "dificuldade ligada ao
custo intrínseco" viram uma equação só.

```
saturação(e)     = ofertaAtual(e) / meta(e)
razãoQueima      = queimadoNoCiclo / emitidoNoCiclo
fatorPolítica    = clamp( metaQueima / max(razãoQueima; 0,05) ; 0,60 ; 2,50 )

dificuldade(e)   = (1 + saturação(e)) ^ 1,35  ×  fatorPolítica
capturaEfetiva(e)= capturaBase(e) / dificuldade(e)
custoDoSelo      = custoBase × (1 + saturação(e)) ^ 0,60 × √fatorPolítica
```

Onde `meta(e) = 200.000 × (capturaBase(e)/255) ^ 2,2`, com piso de 20.

### Lendo isso em português

**Eixo 1 — saturação por espécie.** Quanto mais Pardalumes já existem, mais difícil
capturar outro *e* mais caro tentar. A oferta se auto-limita perto da meta sem
ninguém apertar botão.

**Eixo 2 — razão de queima global.** Se o mundo está queimando menos do que emite
(`razãoQueima < 1,05`), o `fatorPolítica` sobe: tudo fica mais difícil e mais caro,
o que **obriga mais queima por NFT cunhado**. Se está queimando demais, o fator cai,
captura fica fácil, gente nova entra. É um termostato de duas vias.

Metas de oferta que essas contas produzem:

| Espécie | cap | Faixa | Meta de oferta |
|---|---|---|---|
| Pardalume | 190 | comum | ~104.700 |
| Terrino | 150 | comum | ~62.000 |
| Geodante | 60 | incomum | ~8.300 |
| Verdil | 45 | raro | ~4.400 |
| Miasmor | 50 | raro | ~5.500 |
| **Vharuneth** | 4 | lendário | **~21** |

Vinte e um Vharuneth no mundo, para sempre. E um teto absoluto por espécie é
travado no contrato, acima do qual nem a política pode passar.

### Isso funciona mesmo? A simulação diz que sim

`economia/simulador.js` roda a economia inteira fora da cadeia — 3.000 jogadores
em quatro perfis (casual, regular, dedicado e fazenda de bots), 24 ciclos de Orva
(~2 anos). Resultado com os parâmetros atuais:

```
ciclo  emitido  queimado  razão  fatorPolítica  circulação  cunhados
    0    5,55M     3,99M   0,72           1,00       1,28M     54,6k
    2    5,38M     4,36M   0,81           1,50       3,45M     34,4k   ← endureceu
    8    4,92M     4,35M   0,89           1,17       7,35M     32,9k
   16    4,36M     4,30M   0,99           0,97       7,68M     28,9k   ← equilibrou
   23    3,92M     3,90M   0,99           1,06       5,61M     15,9k
```

O termostato funciona: no ciclo 2 a queima estava baixa, o `fatorPolítica` subiu
para 1,50 e endureceu tudo; por volta do ciclo 16 a razão chegou em 0,99 e o fator
voltou para perto de 1,00 sozinho. A saturação por espécie estabiliza entre ×1,1 e
×1,3 — nenhuma encosta no teto absoluto de ×3. E no fim de dois anos existem **12
Vharuneth** no mundo inteiro.

Duas descobertas que só apareceram porque simulamos antes de escrever contrato:

1. **A primeira versão queimava token que não existia.** O modelo deixava o jogador
   gastar sem saldo e a circulação ia a −16M. Corrigido: agora o gasto é limitado ao
   saldo, e o que não coube vira **demanda reprimida** — que é uma métrica, não um bug.
2. **Com a recompensa original, jogar não pagava o custo de jogar.** 31% da demanda
   ficava reprimida. Subimos a vitória de `3 + 0,4×nível` para `4,2 + 0,55×nível` e o
   prêmio de ciclo de 15 para 22 ETR. Caiu para 1%.

Alguma demanda reprimida é *saudável* — é ela que cria pressão de compra do token no
mercado. Zero seria sinal de que estamos imprimindo demais.

---

## 8. Quem desce de Orva neste ciclo

Antes de qualquer conta de dificuldade, vem uma pergunta binária: **essa espécie
está descendo agora?** Se não está, ela não aparece, não é capturável, não é
cunhável — a nenhum preço.

| Faixa | cap | Desce |
|---|---|---|
| Comum | 120–255 | todo ciclo |
| Incomum | 60–119 | 3 de cada 4 |
| Raro | 20–59 | 1 de cada 2 |
| Muito raro | 5–19 | 1 de cada 4 |
| Lendário | 0–4 | **1 de cada 12** (≈ uma vez por ano) |

O sorteio é determinístico — `keccak256(ciclo, espécie)` — então qualquer um pode
verificar o calendário de ciclos futuros e ninguém pode manipulá-lo. O calendário
de Orva é público e previsível, como uma lua de verdade.

---

## 9. Como se ganha

Sempre multiplicado pelo fator de emissão do ciclo (`0,985ⁿ`):

**Éter**
- Vitória em batalha: `4,2 + 0,55 × nível do adversário`, com até **+35% por vínculo alto**
- Ciclo inteiro com um Ânimo bem cuidado (vínculo ≥ 80 e saciedade média ≥ 60): **22 ETR**, até 6 Ânimos
- Primeira visita a uma região: 40 ETR

**Âmbar** (finito, sai da fatia de 30%)
- Primeira captura de uma espécie que você nunca teve: 2 AMB
- Bestiário 25% / 50% / 75% / 100%: 50 / 150 / 400 / 1.200 AMB
- Ranking de cuidado do ciclo, 1.000 primeiros: divide 25.000 AMB

Repare que **capturar não paga**. Capturar *custa*. O que paga é jogar bem e cuidar
bem. Quem quer lucrar vendendo Ânimos precisa capturar com o próprio dinheiro e
convencer alguém de que aquele indivíduo — aquele padrão, aquele porte, aquele nome
— vale mais do que custou.

---

## 10. Antifraude

O jogo roda no navegador, e navegador é território hostil. Nada que o cliente diz
pode virar mint sozinho.

- Toda cunhagem exige um **voucher EIP-712** assinado pelo servidor do jogo,
  contendo espécie, semente, nível, ciclo, destinatário, **nonce** e prazo.
- O contrato valida assinatura, nonce não usado e prazo não vencido.
- Nem o dono do contrato consegue cunhar sem voucher válido.
- Teto de capturas por carteira por ciclo, contra fazenda de bots.
- A `semente` vai dentro do voucher: o jogador não escolhe a aparência do que
  capturou, e não dá para "rolar de novo" até sair um Prismático.

O servidor assinante é ponto único de confiança — e isso está declarado aqui de
propósito. Descentralizar a validação de gameplay exigiria rodar o combate on-chain,
o que é caro e lento. A alternativa honesta é: **assinante conhecido, chave rotativa,
tudo auditável no evento.**

---

## 11. O que pode dar errado

Escrito antes de implantar, porque depois vira desculpa.

1. **Espiral de saída.** Se a demanda por Ânimos cair, o preço cai, a recompensa em
   valor real cai, mais gente sai. *Mitigação:* recompensa nasce de diversão, não
   de rendimento; emissão decai sozinha; sumidouros não dependem de novos entrantes.
2. **Fazenda de bots.** Bot não se diverte, mas ganha igual. *Mitigação:* teto por
   carteira, recompensa por cuidado contínuo (caro de simular), voucher assinado.
3. **Concentração de lendários.** 21 unidades é pouco o bastante para alguém
   comprar todos. *Mitigação:* Selo da Crisálida em moeda dura, teto por carteira por
   ciclo, e a janela de 1-em-12 ciclos que espalha a distribuição no tempo.
4. **Gás inviabilizar o dia a dia.** *Mitigação:* rede L2, sincronia preguiçosa de
   cuidado, ERC-1155 em lote.
5. **Chave do assinante vazar.** Cunhagem infinita. *Mitigação:* rotação de chave,
   teto global de cunhagem por ciclo travado no contrato — mesmo com a chave, o dano
   é limitado a um ciclo.
6. **Nós erramos os números.** Provavelmente erramos. *Mitigação:* `economia/simulador.js`
   roda a economia inteira fora da cadeia antes de qualquer implantação, e os
   parâmetros são ajustáveis por governança dentro de faixas travadas no contrato.

---

## 12. O que precisa de advogado, não de programador

Registrado aqui porque é decisão de negócio e tem consequência real:

- **Pagar valor real por resultado aleatório** (arremessar um selo comprado com token
  que custou dinheiro) é tratado como loot box — e como jogo de azar — em várias
  jurisdições. Bélgica e Holanda já proibiram formatos parecidos; Brasil, UE, Reino
  Unido e alguns estados dos EUA têm regras próprias em movimento.
- **Token com expectativa de lucro derivada do esforço de terceiros** pode ser
  classificado como valor mobiliário. A distribuição da gênese, o vesting e a
  comunicação de marketing importam nessa análise.
- **Coleta de dados, KYC/AML, imposto sobre ganho de capital** do jogador variam por
  país e podem recair sobre o operador.
- **Público infantil.** Um jogo de colecionar criaturas atrai menores. Isso muda
  tudo: publicidade, consentimento, e a legalidade de mecânicas pagas aleatórias.

Nada disso é impeditivo, e nada disso eu tenho competência para resolver. É o tipo
de item que precisa entrar no plano com nome de advogado ao lado, antes da implantação
em rede principal — não depois.

---

## 13. Fases

| Fase | O que entra | Status |
|---|---|---|
| **0** | Jogo completo, jogável, sem blockchain | ✅ pronto |
| **1** | Ideologia, parâmetros, contratos de referência, simulador | ✅ este documento |
| **2** | Simulação de balanceamento com milhares de jogadores | ✅ `economia/simulador.js` |
| **3** | Testes unitários dos contratos (Foundry/Hardhat) | ⬜ |
| **4** | Implantação em rede de testes + carteira de verdade no jogo | ⬜ |
| **5** | Auditoria externa dos contratos | ⬜ |
| **6** | Parecer jurídico por jurisdição | ⬜ |
| **7** | Rede principal | ⬜ |

**O jogo não depende de nenhuma fase acima da 0.** Se as fases 2 a 7 nunca
acontecerem, Ânimos continua sendo um jogo completo — e é assim que tem que ser.

---

## Arquivos

```
docs/ECONOMIA.md              este documento
economia/parametros.json      todos os números, fonte única
economia/modelo.js            as fórmulas em JS (Node e navegador)
economia/simulador.js         simulação headless de ciclos
contratos/Eter.sol            ERC-20 mole, emissão decrescente
contratos/Ambar.sol           ERC-20 duro, suprimento fixo
contratos/PoliticaEconomica.sol  saturação, ciclos de Orva, dificuldade
contratos/InsumosDeVinculo.sol   ERC-1155 de selos e elixires
contratos/VinculoEtereo.sol      ERC-721 dos Ânimos + batismo
contratos/Tesouraria.sol         cofre e divisão de taxas
```
