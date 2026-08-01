// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  Ambar (AMB) — a moeda dura de Ânimos.

  ESPECIFICAÇÃO. NÃO IMPLANTADO. NÃO AUDITADO.

  Desenho:
    • 100.000.000 cunhados UMA ÚNICA VEZ, no construtor. Não existe função de
      cunhagem. Nem o dono consegue criar mais um centavo depois da gênese.
    • O suprimento só pode diminuir, via queima.
    • A distribuição da gênese é fixada no construtor e emitida em evento, então
      qualquer pessoa audita as fatias lendo a transação de criação.
*/

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Ambar is ERC20, ERC20Burnable, ERC20Permit {
    /// @notice Suprimento total, imutável, cunhado na gênese.
    uint256 public constant SUPRIMENTO_GENESE = 100_000_000 ether;

    struct Fatia {
        address destino;
        uint96 partesPorDezMil; // soma tem que dar exatamente 10.000
        string rotulo;
    }

    event GeneseDistribuida(address indexed destino, uint256 valor, string rotulo);

    error SomaDasFatiasInvalida(uint256 soma);
    error DestinoInvalido();
    error SemFatias();

    /// @param fatias Distribuição da gênese. A soma de partesPorDezMil deve ser 10.000.
    constructor(Fatia[] memory fatias) ERC20("Ambar", "AMB") ERC20Permit("Ambar") {
        uint256 n = fatias.length;
        if (n == 0 || n > 20) revert SemFatias();

        uint256 soma;
        for (uint256 i = 0; i < n; ++i) {
            if (fatias[i].destino == address(0)) revert DestinoInvalido();
            soma += fatias[i].partesPorDezMil;
        }
        if (soma != 10_000) revert SomaDasFatiasInvalida(soma);

        // Distribui tudo menos a última fatia por proporção, e joga o resto de
        // arredondamento na última — assim o total bate EXATAMENTE.
        uint256 distribuido;
        for (uint256 i = 0; i < n - 1; ++i) {
            uint256 valor = (SUPRIMENTO_GENESE * fatias[i].partesPorDezMil) / 10_000;
            distribuido += valor;
            _mint(fatias[i].destino, valor);
            emit GeneseDistribuida(fatias[i].destino, valor, fatias[i].rotulo);
        }
        uint256 resto = SUPRIMENTO_GENESE - distribuido;
        _mint(fatias[n - 1].destino, resto);
        emit GeneseDistribuida(fatias[n - 1].destino, resto, fatias[n - 1].rotulo);
    }

    // Não existe mint(). Não existe owner. Não existe upgrade.
    // O suprimento de Âmbar só anda para baixo.
}
