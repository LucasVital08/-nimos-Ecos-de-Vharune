// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  InsumosDeVinculo — selos, elixires, alimentos e itens de cuidado (ERC-1155).

  ESPECIFICAÇÃO. NÃO IMPLANTADO. NÃO AUDITADO.

  Ciclo de vida, que É o sumidouro:

      cunhar  → queima ETR/AMB do jogador, entrega o insumo
      usar    → queima o insumo, para sempre

  É por isso que a saciedade existe no jogo desde o primeiro dia: ela força
  consumo recorrente, e consumo recorrente é queima recorrente. Sem isso, a
  economia só teria o sumidouro da captura, que satura junto com a oferta.

  Faixas de id:
      1..99     selos de captura
      100..199  cura
      200..299  alimentos
      300..399  cuidado
*/

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IQueimavel {
    function burn(uint256 valor) external;
}

interface IPolitica {
    function registrarFluxo(uint256 emitido, uint256 queimado) external;
}

contract InsumosDeVinculo is ERC1155, ERC1155Burnable, ERC1155Supply, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BP = 10_000;
    uint256 public constant LOTE_MAXIMO = 50;

    enum Moeda { ETER, AMBAR }

    struct Insumo {
        uint128 custo;      // custo unitário, na moeda indicada
        uint16 queimaBP;    // fração queimada (o resto vai à tesouraria)
        Moeda moeda;
        bool ativo;
        bool duravel;       // true = não some ao usar (ex.: Escova de Seda)
        string rotulo;
    }

    IERC20 public immutable eter;
    IERC20 public immutable ambar;
    address public tesouraria;
    IPolitica public politica;

    mapping(uint256 id => Insumo) public insumos;
    mapping(address conta => bool) public operador; // contratos que podem consumir em nome do jogador

    string private _uriBase;
    bool public catalogoCongelado;

    event InsumoDefinido(uint256 indexed id, uint128 custo, uint16 queimaBP, Moeda moeda, string rotulo);
    event InsumoCunhado(address indexed para, uint256 indexed id, uint256 qtd, uint256 pago, uint256 queimado);
    event InsumoConsumido(address indexed de, uint256 indexed id, uint256 qtd);
    event OperadorDefinido(address indexed conta, bool autorizado);
    event CatalogoCongelado();

    error InsumoInativo(uint256 id);
    error LoteInvalido();
    error NaoAutorizado();
    error DestinoInvalido();
    error CatalogoJaCongelado();
    error OperacaoDesabilitada();

    constructor(
        address donoInicial,
        address eter_,
        address ambar_,
        address tesouraria_,
        string memory uriBase_
    ) ERC1155(uriBase_) Ownable(donoInicial) {
        if (eter_ == address(0) || ambar_ == address(0) || tesouraria_ == address(0)) revert DestinoInvalido();
        eter = IERC20(eter_);
        ambar = IERC20(ambar_);
        tesouraria = tesouraria_;
        _uriBase = uriBase_;
    }

    // ------------------------------------------------------------------ //
    //  Catálogo                                                           //
    // ------------------------------------------------------------------ //

    function definirInsumo(
        uint256 id,
        uint128 custo,
        uint16 queimaBP,
        Moeda moeda,
        bool duravel,
        string calldata rotulo
    ) external onlyOwner {
        if (catalogoCongelado) revert CatalogoJaCongelado();
        if (id == 0 || queimaBP > BP) revert LoteInvalido();
        insumos[id] = Insumo(custo, queimaBP, moeda, true, duravel, rotulo);
        emit InsumoDefinido(id, custo, queimaBP, moeda, rotulo);
    }

    /// @notice Trava o catálogo em definitivo. Depois disso, nem o dono muda preço.
    function congelarCatalogo() external onlyOwner {
        if (catalogoCongelado) revert CatalogoJaCongelado();
        catalogoCongelado = true;
        emit CatalogoCongelado();
    }

    // ------------------------------------------------------------------ //
    //  Cunhagem: entra token, sai insumo                                  //
    // ------------------------------------------------------------------ //

    function cunhar(uint256 id, uint256 qtd) external nonReentrant {
        Insumo memory ins = insumos[id];
        if (!ins.ativo) revert InsumoInativo(id);
        if (qtd == 0 || qtd > LOTE_MAXIMO) revert LoteInvalido();

        uint256 total = uint256(ins.custo) * qtd;
        uint256 queima = (total * ins.queimaBP) / BP;
        uint256 aoTesouro = total - queima;

        IERC20 moeda = ins.moeda == Moeda.ETER ? eter : ambar;

        // Interação antes do efeito é inevitável aqui (precisamos receber o
        // pagamento), por isso a função é nonReentrant e usa SafeERC20.
        if (queima != 0) {
            moeda.safeTransferFrom(msg.sender, address(this), queima);
            IQueimavel(address(moeda)).burn(queima);
        }
        if (aoTesouro != 0) {
            moeda.safeTransferFrom(msg.sender, tesouraria, aoTesouro);
        }

        _mint(msg.sender, id, qtd, "");

        if (address(politica) != address(0) && ins.moeda == Moeda.ETER) {
            politica.registrarFluxo(0, queima);
        }
        emit InsumoCunhado(msg.sender, id, qtd, total, queima);
    }

    // ------------------------------------------------------------------ //
    //  Consumo: some do mundo                                             //
    // ------------------------------------------------------------------ //

    /// @notice O jogador consome o próprio insumo (cuidar, curar, alimentar).
    function consumir(uint256 id, uint256 qtd) external {
        _consumir(msg.sender, id, qtd);
    }

    /// @notice Um contrato autorizado consome em nome do jogador (ex.: o
    ///         contrato de captura queimando o selo no arremesso).
    function consumirDe(address de, uint256 id, uint256 qtd) external {
        if (!operador[msg.sender]) revert NaoAutorizado();
        _consumir(de, id, qtd);
    }

    function _consumir(address de, uint256 id, uint256 qtd) private {
        Insumo memory ins = insumos[id];
        if (!ins.ativo) revert InsumoInativo(id);
        if (qtd == 0 || qtd > LOTE_MAXIMO) revert LoteInvalido();
        if (ins.duravel) revert OperacaoDesabilitada(); // duráveis não se gastam
        _burn(de, id, qtd);
        emit InsumoConsumido(de, id, qtd);
    }

    // ------------------------------------------------------------------ //
    //  Administração                                                      //
    // ------------------------------------------------------------------ //

    function definirOperador(address conta, bool autorizado) external onlyOwner {
        operador[conta] = autorizado;
        emit OperadorDefinido(conta, autorizado);
    }

    function definirPolitica(address p) external onlyOwner {
        politica = IPolitica(p);
    }

    function definirTesouraria(address t) external onlyOwner {
        if (t == address(0)) revert DestinoInvalido();
        tesouraria = t;
    }

    function uri(uint256 id) public view override returns (string memory) {
        return string.concat(_uriBase, _paraTexto(id), ".json");
    }

    function renounceOwnership() public view override onlyOwner {
        revert OperacaoDesabilitada();
    }

    // ------------------------------------------------------------------ //

    function _update(address de, address para, uint256[] memory ids, uint256[] memory valores)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(de, para, ids, valores);
    }

    function _paraTexto(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 tam;
        for (uint256 t = v; t != 0; t /= 10) ++tam;
        bytes memory buf = new bytes(tam);
        while (v != 0) { buf[--tam] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}
