// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  Tesouraria — o cofre de Ânimos.

  ESPECIFICAÇÃO. NÃO IMPLANTADO. NÃO AUDITADO.

  Recebe a fatia dos sumidouros que não é queimada. Existe para financiar
  recompensa futura, liquidez e desenvolvimento — e para deixar isso auditável.

  Duas travas que importam:
    • Toda saída passa por uma FILA COM ESPERA. Nada sai no mesmo bloco em que
      foi proposto. Se a chave do dono for comprometida, há uma janela para
      reagir antes de o cofre esvaziar.
    • Existe um teto por saque e por janela de tempo. Nem o dono passa dele.
*/

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IQueimavel {
    function burn(uint256 valor) external;
}

contract Tesouraria is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Espera obrigatória entre propor e executar uma saída.
    uint256 public constant ESPERA = 48 hours;

    /// @notice Prazo para executar depois de liberado; passou disso, caduca.
    uint256 public constant VALIDADE = 14 days;

    struct Saida {
        address token;
        address destino;
        uint256 valor;
        uint64  liberaEm;
        bool    executada;
        bool    cancelada;
        string  motivo;
    }

    uint256 public proximaSaida = 1;
    mapping(uint256 id => Saida) public saidas;

    /// @notice Teto por janela de 30 dias, por token. 0 = sem teto definido (bloqueia).
    mapping(address token => uint256 teto) public tetoPorJanela;
    mapping(address token => uint256 janela) public janelaAtual;
    mapping(address token => uint256 gasto) public gastoNaJanela;

    event SaidaProposta(uint256 indexed id, address indexed token, address indexed destino, uint256 valor, uint64 liberaEm, string motivo);
    event SaidaExecutada(uint256 indexed id);
    event SaidaCancelada(uint256 indexed id);
    event TetoDefinido(address indexed token, uint256 teto);
    event Queimado(address indexed token, uint256 valor);

    error DestinoInvalido();
    error ValorInvalido();
    error AindaNaoLiberada(uint64 liberaEm);
    error SaidaCaducou();
    error SaidaJaResolvida();
    error TetoDaJanelaExcedido(uint256 pedido, uint256 disponivel);
    error SemTetoDefinido(address token);

    constructor(address donoInicial) Ownable(donoInicial) {
        if (donoInicial == address(0)) revert DestinoInvalido();
    }

    // ------------------------------------------------------------------ //
    //  Fila de saída                                                      //
    // ------------------------------------------------------------------ //

    function proporSaida(address token, address destino, uint256 valor, string calldata motivo)
        external
        onlyOwner
        returns (uint256 id)
    {
        if (token == address(0) || destino == address(0)) revert DestinoInvalido();
        if (valor == 0) revert ValorInvalido();
        if (tetoPorJanela[token] == 0) revert SemTetoDefinido(token);

        id = proximaSaida;
        unchecked { proximaSaida = id + 1; }

        uint64 liberaEm = uint64(block.timestamp + ESPERA);
        saidas[id] = Saida(token, destino, valor, liberaEm, false, false, motivo);
        emit SaidaProposta(id, token, destino, valor, liberaEm, motivo);
    }

    function executarSaida(uint256 id) external onlyOwner nonReentrant {
        Saida storage s = saidas[id];
        if (s.executada || s.cancelada) revert SaidaJaResolvida();
        if (block.timestamp < s.liberaEm) revert AindaNaoLiberada(s.liberaEm);
        if (block.timestamp > s.liberaEm + VALIDADE) revert SaidaCaducou();

        _consumirTeto(s.token, s.valor);
        s.executada = true;                       // efeito antes da interação
        emit SaidaExecutada(id);
        IERC20(s.token).safeTransfer(s.destino, s.valor);
    }

    function cancelarSaida(uint256 id) external onlyOwner {
        Saida storage s = saidas[id];
        if (s.executada || s.cancelada) revert SaidaJaResolvida();
        s.cancelada = true;
        emit SaidaCancelada(id);
    }

    // ------------------------------------------------------------------ //
    //  Queima voluntária: sempre permitida, sem espera                    //
    // ------------------------------------------------------------------ //

    /// @notice Queimar reduz o suprimento e não pode prejudicar ninguém, então
    ///         não passa pela fila. É a única saída imediata do cofre.
    function queimar(address token, uint256 valor) external onlyOwner {
        if (valor == 0) revert ValorInvalido();
        IQueimavel(token).burn(valor);
        emit Queimado(token, valor);
    }

    // ------------------------------------------------------------------ //
    //  Tetos                                                              //
    // ------------------------------------------------------------------ //

    function definirTeto(address token, uint256 teto) external onlyOwner {
        if (token == address(0)) revert DestinoInvalido();
        tetoPorJanela[token] = teto;
        emit TetoDefinido(token, teto);
    }

    function disponivelNaJanela(address token) external view returns (uint256) {
        uint256 j = block.timestamp / 30 days;
        uint256 gasto = janelaAtual[token] == j ? gastoNaJanela[token] : 0;
        uint256 teto = tetoPorJanela[token];
        return gasto >= teto ? 0 : teto - gasto;
    }

    function _consumirTeto(address token, uint256 valor) private {
        uint256 j = block.timestamp / 30 days;
        if (janelaAtual[token] != j) {
            janelaAtual[token] = j;
            gastoNaJanela[token] = 0;
        }
        uint256 teto = tetoPorJanela[token];
        uint256 gasto = gastoNaJanela[token];
        uint256 disponivel = gasto >= teto ? 0 : teto - gasto;
        if (valor > disponivel) revert TetoDaJanelaExcedido(valor, disponivel);
        gastoNaJanela[token] = gasto + valor;
    }

    // Sem receive() e sem fallback(): a tesouraria guarda tokens, não ETH.
}
