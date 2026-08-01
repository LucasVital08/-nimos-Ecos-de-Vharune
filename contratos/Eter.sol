// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  Eter (ETR) — a moeda de giro de Crisálida.

  ESPECIFICAÇÃO. NÃO IMPLANTADO. NÃO AUDITADO.

  Desenho:
    • Sem teto rígido de suprimento, mas a emissão POR CICLO decai 1,5% para
      sempre. A soma infinita converge (~2,67 bilhões), então existe um limite
      assintótico sem precisar de uma parede arbitrária.
    • O teto do ciclo é apurado no próprio contrato, não confiado ao emissor.
      Mesmo que a chave do distribuidor vaze, o dano máximo é um ciclo.
    • Qualquer um queima o que é seu; o queimador autorizado (sumidouros do jogo)
      queima com allowance normal de ERC-20.
*/

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPolitica {
    function registrarFluxo(uint256 emitido, uint256 queimado) external;
}

contract Eter is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    // ------------------------------------------------------------------ //
    //  Emissão                                                            //
    // ------------------------------------------------------------------ //

    /// @notice Emissão do ciclo 0, em unidades inteiras (18 casas aplicadas depois).
    uint256 public constant EMISSAO_BASE_CICLO = 40_000_000 ether;

    /// @notice Decaimento por ciclo em base 10.000 (9850 = 98,50% = −1,5%).
    uint256 public constant DECAIMENTO_BP = 9850;
    uint256 private constant BP = 10_000;

    /// @notice Duração de um Ciclo de Orva.
    uint256 public constant DURACAO_CICLO = 29.5 days;

    /// @notice Instante da gênese; define a contagem de ciclos.
    uint256 public immutable genese;

    /// @notice Endereço autorizado a distribuir recompensas.
    address public distribuidor;

    /// @notice Contrato de política. Precisa saber quanto foi emitido para
    ///         calcular a razão de queima — sem isso o termostato nunca liga.
    IPolitica public politica;

    /// @dev Memo do teto por ciclo: o cálculo é um laço, e pagá-lo a cada
    ///      emissão do mesmo ciclo é desperdício de gás.
    mapping(uint256 ciclo => uint256 teto) private _memoTeto;

    /// @dev ciclo => quanto já foi emitido nele.
    mapping(uint256 ciclo => uint256 emitido) public emitidoNoCiclo;

    // ------------------------------------------------------------------ //
    //  Eventos e erros                                                    //
    // ------------------------------------------------------------------ //

    event DistribuidorDefinido(address indexed anterior, address indexed novo);
    event PoliticaDefinida(address indexed nova);
    event RecompensaEmitida(address indexed para, uint256 valor, uint256 ciclo);

    error NaoAutorizado();
    error TetoDoCicloExcedido(uint256 pedido, uint256 disponivel);
    error DestinoInvalido();
    error OperacaoDesabilitada();

    // ------------------------------------------------------------------ //

    constructor(address donoInicial)
        ERC20("Eter", "ETR")
        ERC20Permit("Eter")
        Ownable(donoInicial)
    {
        if (donoInicial == address(0)) revert DestinoInvalido();
        genese = block.timestamp;
    }

    // ------------------------------------------------------------------ //
    //  Ciclos                                                             //
    // ------------------------------------------------------------------ //

    /// @notice Ciclo de Orva corrente (0 na gênese).
    function cicloAtual() public view returns (uint256) {
        return (block.timestamp - genese) / DURACAO_CICLO;
    }

    /// @notice Teto de emissão de um ciclo: EMISSAO_BASE × 0,985^ciclo.
    /// @dev Iterativo e limitado a 400 voltas (~32 anos). Depois disso a emissão
    ///      é tão pequena que travamos em zero de propósito.
    function tetoDoCiclo(uint256 ciclo) public pure returns (uint256) {
        if (ciclo > 400) return 0;
        uint256 v = EMISSAO_BASE_CICLO;
        for (uint256 i = 0; i < ciclo; ++i) {
            v = (v * DECAIMENTO_BP) / BP;
        }
        return v;
    }

    /// @notice Quanto ainda pode ser emitido no ciclo corrente.
    function disponivelNoCicloAtual() external view returns (uint256) {
        uint256 c = cicloAtual();
        uint256 teto = tetoDoCiclo(c);
        uint256 usado = emitidoNoCiclo[c];
        return usado >= teto ? 0 : teto - usado;
    }

    // ------------------------------------------------------------------ //
    //  Distribuição                                                       //
    // ------------------------------------------------------------------ //

    function definirDistribuidor(address novo) external onlyOwner {
        emit DistribuidorDefinido(distribuidor, novo);
        distribuidor = novo;
    }

    function definirPolitica(address nova) external onlyOwner {
        politica = IPolitica(nova);
        emit PoliticaDefinida(nova);
    }

    /// @dev Primeira chamada do ciclo paga o laço; as seguintes leem o memo.
    function _tetoComMemo(uint256 ciclo) private returns (uint256) {
        uint256 memo = _memoTeto[ciclo];
        if (memo != 0) return memo;
        uint256 v = tetoDoCiclo(ciclo);
        _memoTeto[ciclo] = v;
        return v;
    }

    /// @notice Emite recompensa de jogo. Respeita o teto do ciclo mesmo para o dono.
    function emitirRecompensa(address para, uint256 valor) external {
        if (msg.sender != distribuidor && msg.sender != owner()) revert NaoAutorizado();
        if (para == address(0)) revert DestinoInvalido();

        uint256 c = cicloAtual();
        uint256 teto = _tetoComMemo(c);
        uint256 usado = emitidoNoCiclo[c];
        uint256 disponivel = usado >= teto ? 0 : teto - usado;
        if (valor > disponivel) revert TetoDoCicloExcedido(valor, disponivel);

        emitidoNoCiclo[c] = usado + valor;
        _mint(para, valor);
        if (address(politica) != address(0)) politica.registrarFluxo(valor, 0);
        emit RecompensaEmitida(para, valor, c);
    }

    /// @notice Emite um lote. Limitado para não criar laço sem fim.
    function emitirLote(address[] calldata destinos, uint256[] calldata valores) external {
        if (msg.sender != distribuidor && msg.sender != owner()) revert NaoAutorizado();
        uint256 n = destinos.length;
        if (n == 0 || n > 200 || n != valores.length) revert DestinoInvalido();

        uint256 c = cicloAtual();
        uint256 teto = _tetoComMemo(c);
        uint256 usado = emitidoNoCiclo[c];

        uint256 soma;
        for (uint256 i = 0; i < n; ++i) soma += valores[i];

        uint256 disponivel = usado >= teto ? 0 : teto - usado;
        if (soma > disponivel) revert TetoDoCicloExcedido(soma, disponivel);
        emitidoNoCiclo[c] = usado + soma;
        if (address(politica) != address(0)) politica.registrarFluxo(soma, 0);

        for (uint256 i = 0; i < n; ++i) {
            if (destinos[i] == address(0)) revert DestinoInvalido();
            _mint(destinos[i], valores[i]);
            emit RecompensaEmitida(destinos[i], valores[i], c);
        }
    }

    // ------------------------------------------------------------------ //

    /// @dev Desabilitado: um token sem dono não consegue trocar de distribuidor.
    function renounceOwnership() public view override onlyOwner {
        revert OperacaoDesabilitada();
    }
}
