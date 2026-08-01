# Contratos de Ânimos

> **Nada aqui está implantado, compilado, auditado ou conectado ao jogo.**
> São contratos de **referência**, escritos junto com `../docs/ECONOMIA.md`.
> O jogo em `../js/` roda 100% offline e não fala com nenhum destes.

## O conjunto

| Contrato | Padrão | O que faz |
|---|---|---|
| `Eter.sol` | ERC-20 | Moeda de giro (ETR). Emissão por ciclo decai 1,5% e é travada no próprio contrato |
| `Ambar.sol` | ERC-20 | Moeda dura (AMB). 100M cunhados na gênese, **sem função de mint** |
| `PoliticaEconomica.sol` | — | O termostato: saturação, ciclos de Orva, dificuldade e custo |
| `InsumosDeVinculo.sol` | ERC-1155 | Selos, elixires e alimentos. Cunhar queima token; usar queima o insumo |
| `VinculoEtereo.sol` | ERC-721 | Os Ânimos, o batismo e a certidão de nascimento |
| `Tesouraria.sol` | — | Cofre com fila de saída de 48h e teto por janela |

## Ordem de implantação

```
1. Ambar        (fatias da gênese no construtor)
2. Eter
3. Tesouraria
4. PoliticaEconomica
5. InsumosDeVinculo  (eter, ambar, tesouraria)
6. VinculoEtereo     (eter, ambar, tesouraria, assinante)

Depois:
  politica.registrarEspecies([...], [...])        ← as 28 espécies e seus caps
  politica.definirRelator(vinculoEtereo, true)
  politica.definirRelator(insumos, true)
  insumos.definirOperador(vinculoEtereo, true)    ← para queimar o selo no arremesso
  insumos.definirPolitica(politica)
  vinculoEtereo.definirContratos(politica, insumos)
  vinculoEtereo.definirCustoDeSelo(id, custoBase) ← por selo
  eter.definirDistribuidor(distribuidorDeRecompensas)
  eter.definirPolitica(politica)                  ← senão o termostato nunca liga
  politica.definirRelator(eter, true)
  tesouraria.definirTeto(eter, X) e (ambar, Y)
```

## Dependências

```bash
npm i -D hardhat @openzeppelin/contracts
```

Usa OpenZeppelin v5 (`ERC721`, `ERC1155`, `ERC20Permit`, `Ownable2Step`,
`ReentrancyGuard`, `EIP712`, `ECDSA`, `SafeERC20`, `Math`). Nenhuma dependência
está incluída neste repositório.

## Decisões de segurança

1. **Nenhuma função é `payable`.** Nenhum contrato aceita ETH: não há `receive`
   nem `fallback` em lugar nenhum.
2. **`Ambar` não tem `mint`.** O suprimento só anda para baixo, por queima.
3. **`Eter` trava o teto do ciclo no próprio contrato.** Se a chave do
   distribuidor vazar, o dano máximo é a emissão de um ciclo.
4. **Cunhagem de NFT só com voucher EIP-712** — com nonce, prazo e checagem de
   ciclo. Nem o dono cunha sem assinatura válida.
5. **Teto absoluto por espécie** (`3×` a meta) no contrato de política. Nem a
   política monetária passa dele.
6. **Teto de capturas por carteira por ciclo**, contra fazenda de bots.
7. **Efeito antes da interação** em todo caminho que chama `_safeMint` ou
   `transfer`, mais `ReentrancyGuard` onde há entrada de token.
8. **`renounceOwnership` desabilitado** em todos: contrato órfão não conserta.
9. **Tesouraria com espera de 48h** e teto por janela de 30 dias. Só a queima é
   imediata — reduzir suprimento não prejudica ninguém.
10. **Metadados e catálogo congeláveis** em definitivo.

## O que falta antes de qualquer rede principal

- [ ] Testes unitários (Foundry ou Hardhat), incluindo fuzzing da matemática WAD
- [ ] Teste de que `_pow11_8`, `_pow5_8` e `_pow9_4` batem com `economia/modelo.js`
- [ ] Implantação e uso real em rede de testes
- [ ] Auditoria externa
- [ ] Parecer jurídico por jurisdição (ver seção 12 de `../docs/ECONOMIA.md`)
