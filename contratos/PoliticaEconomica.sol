// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  PoliticaEconomica — o termostato de Ânimos.

  ESPECIFICAÇÃO. NÃO IMPLANTADO. NÃO AUDITADO.

  Responde a três perguntas, e só a essas:
    1. Esta espécie está descendo de Orva neste ciclo?
    2. Quão difícil está capturá-la agora?
    3. Quanto custa arremessar um selo nela agora?

  As respostas saem de dois eixos:
    • saturação da espécie  = oferta / meta
    • razão de queima global = queimado / emitido no ciclo

  ────────────────────────────────────────────────────────────────────────────
  MATEMÁTICA SEM PONTO FLUTUANTE

  Solidity não tem float. Os expoentes foram escolhidos como frações exatas de
  denominador 8 ou 4, então saem só com multiplicação e raiz quadrada:

      x^(11/8) = x · ⁸√(x³)      → 1,375  (saturação → dificuldade)
      x^(5/8)  =     ⁸√(x⁵)      → 0,625  (saturação → custo)
      x^(9/4)  = x² · ⁴√x        → 2,25   (raridade → meta de oferta)
      x^(1/2)  =     √x          → 0,5    (política → custo)

  ⁸√ é sqrt três vezes; ⁴√ é sqrt duas vezes. É por isso que economia/modelo.js
  usa exatamente 1.375, 0.625 e 2.25: para o JS e a cadeia nunca discordarem.
  ────────────────────────────────────────────────────────────────────────────
*/

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract PoliticaEconomica is Ownable {
    uint256 private constant WAD = 1e18;

    // ------------------------------------------------------------------ //
    //  Constantes de política                                             //
    // ------------------------------------------------------------------ //

    uint256 public constant DURACAO_CICLO = 29.5 days;
    uint256 public constant META_QUEIMA_WAD = 1.05e18;
    uint256 public constant FATOR_MIN_WAD = 0.60e18;
    uint256 public constant FATOR_MAX_WAD = 2.50e18;
    uint256 public constant RAZAO_QUEIMA_MIN_WAD = 0.05e18;

    uint256 public constant META_BASE_ESPECIE = 200_000;
    uint256 public constant META_MINIMA = 20;

    /// @notice Nenhuma espécie passa de 3× a própria meta. Nem a política muda isso.
    uint256 public constant TETO_ABSOLUTO_MULT = 3;

    uint256 public immutable genese;

    // ------------------------------------------------------------------ //
    //  Estado                                                             //
    // ------------------------------------------------------------------ //

    /// @dev espécie (1..28) => taxa de captura base do jogo (1..255).
    mapping(uint16 especie => uint8 capBase) public capturaBase;

    /// @dev espécie => quantos NFTs já existem.
    mapping(uint16 especie => uint256 oferta) public ofertaPorEspecie;

    /// @dev ciclo => ETR emitido / queimado, alimentado pelos contratos do jogo.
    mapping(uint256 ciclo => uint256 valor) public emitidoNoCiclo;
    mapping(uint256 ciclo => uint256 valor) public queimadoNoCiclo;

    /// @notice Contratos autorizados a reportar oferta e fluxo (NFT, insumos, tesouraria).
    mapping(address conta => bool autorizado) public relator;

    // ------------------------------------------------------------------ //
    //  Eventos e erros                                                    //
    // ------------------------------------------------------------------ //

    event RelatorDefinido(address indexed conta, bool autorizado);
    event EspecieRegistrada(uint16 indexed especie, uint8 capBase, uint256 meta);
    event OfertaAtualizada(uint16 indexed especie, uint256 novaOferta);
    event FluxoRegistrado(uint256 indexed ciclo, uint256 emitido, uint256 queimado);

    error NaoAutorizado();
    error EspecieInvalida();
    error TetoDaEspecieAtingido(uint16 especie, uint256 oferta, uint256 teto);
    error OperacaoDesabilitada();

    modifier apenasRelator() {
        if (!relator[msg.sender] && msg.sender != owner()) revert NaoAutorizado();
        _;
    }

    constructor(address donoInicial) Ownable(donoInicial) {
        genese = block.timestamp;
    }

    // ------------------------------------------------------------------ //
    //  Ciclos de Orva                                                     //
    // ------------------------------------------------------------------ //

    function cicloAtual() public view returns (uint256) {
        return (block.timestamp - genese) / DURACAO_CICLO;
    }

    /// @notice Em quantos ciclos de cada N a espécie desce, pela raridade.
    /// @return num numerador, den denominador (ex.: 1 e 12 = uma vez a cada doze)
    function frequenciaDeDescida(uint8 cap) public pure returns (uint256 num, uint256 den) {
        if (cap >= 120) return (1, 1);    // comum
        if (cap >= 60) return (3, 4);     // incomum
        if (cap >= 20) return (1, 2);     // raro
        if (cap >= 5) return (1, 4);      // muito raro
        return (1, 12);                   // lendário
    }

    /// @notice A espécie desce de Orva neste ciclo? Determinístico e verificável
    ///         para qualquer ciclo futuro — o calendário da lua é público.
    function desceNoCiclo(uint256 ciclo, uint16 especie) public view returns (bool) {
        uint8 cap = capturaBase[especie];
        if (cap == 0) revert EspecieInvalida();
        (uint256 num, uint256 den) = frequenciaDeDescida(cap);
        if (den == 1) return true;
        uint256 sorteio = uint256(keccak256(abi.encodePacked(ciclo, especie))) % den;
        return sorteio < num;
    }

    function desceAgora(uint16 especie) external view returns (bool) {
        return desceNoCiclo(cicloAtual(), especie);
    }

    // ------------------------------------------------------------------ //
    //  Metas e saturação                                                  //
    // ------------------------------------------------------------------ //

    /// @notice meta = 200.000 × (cap/255)^2,25, com piso de 20.
    function metaDaEspecie(uint16 especie) public view returns (uint256) {
        uint8 cap = capturaBase[especie];
        if (cap == 0) revert EspecieInvalida();
        uint256 x = (uint256(cap) * WAD) / 255;        // 0..1 em WAD
        uint256 p = _pow9_4(x);                        // x^2,25
        uint256 meta = (META_BASE_ESPECIE * p) / WAD;
        return meta < META_MINIMA ? META_MINIMA : meta;
    }

    /// @notice Saturação em WAD (1e18 = exatamente na meta).
    function saturacao(uint16 especie) public view returns (uint256) {
        uint256 meta = metaDaEspecie(especie);
        return (ofertaPorEspecie[especie] * WAD) / meta;
    }

    function tetoDaEspecie(uint16 especie) public view returns (uint256) {
        return metaDaEspecie(especie) * TETO_ABSOLUTO_MULT;
    }

    // ------------------------------------------------------------------ //
    //  Termostato global                                                  //
    // ------------------------------------------------------------------ //

    /// @notice Razão de queima do ciclo anterior, em WAD.
    function razaoQueima(uint256 ciclo) public view returns (uint256) {
        uint256 emitido = emitidoNoCiclo[ciclo];
        if (emitido == 0) return WAD;
        return (queimadoNoCiclo[ciclo] * WAD) / emitido;
    }

    /// @notice Se o mundo queima menos do que emite, o fator sobe e tudo endurece.
    /// @dev Usa o ciclo ANTERIOR: o corrente ainda está em andamento.
    function fatorPolitica() public view returns (uint256) {
        uint256 c = cicloAtual();
        if (c == 0) return WAD;
        uint256 razao = razaoQueima(c - 1);
        if (razao < RAZAO_QUEIMA_MIN_WAD) razao = RAZAO_QUEIMA_MIN_WAD;
        uint256 fator = (META_QUEIMA_WAD * WAD) / razao;
        if (fator < FATOR_MIN_WAD) return FATOR_MIN_WAD;
        if (fator > FATOR_MAX_WAD) return FATOR_MAX_WAD;
        return fator;
    }

    // ------------------------------------------------------------------ //
    //  As três respostas                                                  //
    // ------------------------------------------------------------------ //

    /// @notice dificuldade = (1 + saturação)^1,375 × fatorPolítica, em WAD.
    function dificuldade(uint16 especie) public view returns (uint256) {
        uint256 base = WAD + saturacao(especie);
        return _mulWad(_pow11_8(base), fatorPolitica());
    }

    /// @notice Taxa de captura efetiva, no mesmo espaço 1..255 que o jogo usa.
    function capturaEfetiva(uint16 especie) external view returns (uint256) {
        uint256 d = dificuldade(especie);
        if (d == 0) return 255;
        uint256 efetiva = (uint256(capturaBase[especie]) * WAD) / d;
        if (efetiva == 0) return 1;
        return efetiva > 255 ? 255 : efetiva;
    }

    /// @notice custo = base × (1 + saturação)^0,625 × √fatorPolítica.
    function custoDeArremesso(uint16 especie, uint256 custoBase) external view returns (uint256) {
        uint256 base = WAD + saturacao(especie);
        uint256 mult = _mulWad(_pow5_8(base), _sqrtWad(fatorPolitica()));
        return (custoBase * mult) / WAD;
    }

    // ------------------------------------------------------------------ //
    //  Relatos dos contratos do jogo                                      //
    // ------------------------------------------------------------------ //

    /// @notice Chamado pelo contrato de NFT a cada cunhagem. Reverte no teto.
    function registrarCunhagem(uint16 especie) external apenasRelator {
        uint256 nova = ofertaPorEspecie[especie] + 1;
        uint256 teto = tetoDaEspecie(especie);
        if (nova > teto) revert TetoDaEspecieAtingido(especie, nova, teto);
        ofertaPorEspecie[especie] = nova;
        emit OfertaAtualizada(especie, nova);
    }

    function registrarFluxo(uint256 emitido, uint256 queimado) external apenasRelator {
        uint256 c = cicloAtual();
        if (emitido != 0) emitidoNoCiclo[c] += emitido;
        if (queimado != 0) queimadoNoCiclo[c] += queimado;
        emit FluxoRegistrado(c, emitido, queimado);
    }

    // ------------------------------------------------------------------ //
    //  Administração                                                      //
    // ------------------------------------------------------------------ //

    function definirRelator(address conta, bool autorizado) external onlyOwner {
        relator[conta] = autorizado;
        emit RelatorDefinido(conta, autorizado);
    }

    /// @notice Registra as espécies do bestiário com a taxa de captura do jogo.
    function registrarEspecies(uint16[] calldata especies, uint8[] calldata caps) external onlyOwner {
        uint256 n = especies.length;
        if (n == 0 || n > 100 || n != caps.length) revert EspecieInvalida();
        for (uint256 i = 0; i < n; ++i) {
            if (especies[i] == 0 || caps[i] == 0) revert EspecieInvalida();
            capturaBase[especies[i]] = caps[i];
            emit EspecieRegistrada(especies[i], caps[i], metaDaEspecie(especies[i]));
        }
    }

    function renounceOwnership() public view override onlyOwner {
        revert OperacaoDesabilitada();
    }

    // ------------------------------------------------------------------ //
    //  Matemática em WAD                                                  //
    // ------------------------------------------------------------------ //

    function _mulWad(uint256 a, uint256 b) private pure returns (uint256) {
        return (a * b) / WAD;
    }

    /// @dev √x mantendo a escala WAD.
    function _sqrtWad(uint256 x) private pure returns (uint256) {
        return Math.sqrt(x * WAD);
    }

    /// @dev x^(1/8) = sqrt(sqrt(sqrt(x)))
    function _raiz8(uint256 x) private pure returns (uint256) {
        return _sqrtWad(_sqrtWad(_sqrtWad(x)));
    }

    /// @dev x^(1/4) = sqrt(sqrt(x))
    function _raiz4(uint256 x) private pure returns (uint256) {
        return _sqrtWad(_sqrtWad(x));
    }

    /// @dev x^(11/8) = x · (x³)^(1/8)
    function _pow11_8(uint256 x) private pure returns (uint256) {
        uint256 x3 = _mulWad(_mulWad(x, x), x);
        return _mulWad(x, _raiz8(x3));
    }

    /// @dev x^(5/8) = (x⁵)^(1/8)
    function _pow5_8(uint256 x) private pure returns (uint256) {
        uint256 x2 = _mulWad(x, x);
        uint256 x4 = _mulWad(x2, x2);
        uint256 x5 = _mulWad(x4, x);
        return _raiz8(x5);
    }

    /// @dev x^(9/4) = x² · x^(1/4)
    function _pow9_4(uint256 x) private pure returns (uint256) {
        return _mulWad(_mulWad(x, x), _raiz4(x));
    }
}
