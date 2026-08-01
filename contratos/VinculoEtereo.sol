// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
  VinculoEtereo — os Ânimos de Vharune (ERC-721) e o batismo na cadeia.

  ESPECIFICAÇÃO. NÃO IMPLANTADO. NÃO AUDITADO.
  O jogo em js/ não fala com este contrato. Nada aqui está vivo.

  ────────────────────────────────────────────────────────────────────────────
  A REGRA DE OURO

  Ânimo selvagem NÃO é NFT. Ele é éter solto: não tem token, não tem dono, não
  custa nada existir e some quando a batalha acaba. Só vira NFT no instante em
  que o vínculo se firma — e esse instante custa.

      encontro selvagem  →  fora da cadeia, grátis, efêmero
      arremesso do selo  →  AQUI. O selo queima dando certo ou não.
      captura            →  AQUI. Cunha o ERC-721 e grava o nascimento.

  Queimar no arremesso, e não no sucesso, é o que transforma dificuldade em
  política monetária: dá para encarecer o NFT médio sem mexer em tabela de preço.
  ────────────────────────────────────────────────────────────────────────────
  O BATISMO

  Quem captura escolhe o nome. Esse nome:
    • é único no mundo inteiro (primeiro que batiza, leva);
    • é IMUTÁVEL — dá para apelidar depois, mas a certidão continua mostrando
      o nome de nascimento e quem o deu;
    • vem junto da semente que desenha a criatura, então o NFT não aponta para
      uma imagem num servidor: ele contém a instrução de como se desenhar.
  ────────────────────────────────────────────────────────────────────────────
*/

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IPoliticaEconomica {
    function cicloAtual() external view returns (uint256);
    function desceNoCiclo(uint256 ciclo, uint16 especie) external view returns (bool);
    function custoDeArremesso(uint16 especie, uint256 custoBase) external view returns (uint256);
    function registrarCunhagem(uint16 especie) external;
    function registrarFluxo(uint256 emitido, uint256 queimado) external;
}

interface IInsumos {
    function consumirDe(address de, uint256 id, uint256 qtd) external;
}

interface IQueimavel {
    function burn(uint256 valor) external;
}

contract VinculoEtereo is ERC721, ERC721Enumerable, Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    // ------------------------------------------------------------------ //
    //  Certidão de nascimento                                             //
    // ------------------------------------------------------------------ //

    struct Nascimento {
        string  nome;             // dado no batismo — imutável
        bytes32 nomeNormalizado;  // garante unicidade global
        address batizante;        // quem estava lá
        uint64  blocoNascimento;
        uint64  tempoNascimento;
        uint32  cicloDeOrva;      // sob qual lua ele desceu
        uint32  semente;          // semente da arte procedural
        uint16  especie;
        uint16  porte;            // milésimos (1035 = 103,5%)
        int16   matiz;            // graus
        uint8   nivelDeCaptura;
        uint8   padrao;
        bool    prismatico;
    }

    /// @dev O apelido muda; o nome de nascimento, nunca.
    mapping(uint256 tokenId => Nascimento) private _certidao;
    mapping(uint256 tokenId => string) private _apelido;
    mapping(bytes32 nomeNormalizado => uint256 tokenId) public tokenPorNome;

    // ------------------------------------------------------------------ //
    //  Voucher de arremesso (EIP-712)                                     //
    // ------------------------------------------------------------------ //

    /*
      O servidor do jogo assina UM voucher por arremesso — inclusive os que
      falharam. O contrato sempre queima o selo; só cunha se sucesso == true.
      É isso que faz o custo cair no arremesso, não na captura.
    */
    struct Arremesso {
        address vinculista;
        uint16  especie;
        uint16  idSelo;
        uint32  semente;
        uint32  ciclo;
        uint16  porte;
        int16   matiz;
        uint8   nivel;
        uint8   padrao;
        bool    prismatico;
        bool    sucesso;
        uint256 nonce;
        uint256 prazo;
    }

    bytes32 private constant TIPO_ARREMESSO = keccak256(
        "Arremesso(address vinculista,uint16 especie,uint16 idSelo,uint32 semente,uint32 ciclo,"
        "uint16 porte,int16 matiz,uint8 nivel,uint8 padrao,bool prismatico,bool sucesso,"
        "uint256 nonce,uint256 prazo)"
    );

    mapping(uint256 nonce => bool usado) public nonceUsado;

    // ------------------------------------------------------------------ //
    //  Configuração                                                       //
    // ------------------------------------------------------------------ //

    IPoliticaEconomica public politica;
    IInsumos public insumos;
    IERC20 public immutable eter;
    IERC20 public immutable ambar;
    address public tesouraria;

    /// @notice Quem assina os vouchers. Ponto único de confiança, declarado.
    address public assinante;

    /// @notice Custo base de cada selo, em ETR. A sobretaxa vem da política.
    mapping(uint16 idSelo => uint256 custoBase) public custoBaseDoSelo;

    uint256 public constant CUSTO_BATISMO = 5 ether;      // AMB
    uint256 public constant CUSTO_REBATISMO = 25 ether;   // AMB
    uint16 public constant BATISMO_QUEIMA_BP = 5_000;     // 50%
    uint16 public constant REBATISMO_QUEIMA_BP = 8_000;   // 80%

    uint256 public capturasPorCicloPorCarteira = 60;
    mapping(uint256 ciclo => mapping(address conta => uint256)) public capturasNoCiclo;

    uint256 private _proximoId = 1;
    string private _uriBase;
    bool public metadadosCongelados;

    // ------------------------------------------------------------------ //
    //  Eventos                                                            //
    // ------------------------------------------------------------------ //

    event SeloArremessado(address indexed vinculista, uint16 indexed especie, uint16 idSelo, bool sucesso, uint256 sobretaxa);
    event AnimaBatizada(uint256 indexed tokenId, address indexed batizante, string nome, uint16 especie, uint32 semente);
    event Apelidado(uint256 indexed tokenId, string apelido);
    event AssinanteDefinido(address indexed anterior, address indexed novo);
    event UriBaseAtualizada(string nova);
    event MetadadosCongelados();

    // ------------------------------------------------------------------ //
    //  Erros                                                              //
    // ------------------------------------------------------------------ //

    error AssinaturaInvalida();
    error NonceJaUsado(uint256 nonce);
    error VoucherVencido(uint256 prazo);
    error CicloIncorreto(uint32 doVoucher, uint256 atual);
    error EspecieNaoDesceNesteCiclo(uint16 especie);
    error NomeIndisponivel(bytes32 nomeNormalizado);
    error NomeInvalido();
    error SeloDesconhecido(uint16 idSelo);
    error LimiteDeCapturasNoCiclo();
    error NaoEhDono();
    error TokenInexistente();
    error DestinoInvalido();
    error MetadadosJaCongelados();
    error OperacaoDesabilitada();

    // ------------------------------------------------------------------ //

    constructor(
        address donoInicial,
        address eter_,
        address ambar_,
        address tesouraria_,
        address assinante_,
        string memory uriBase_
    )
        ERC721("Animos de Vharune", "ANIMA")
        Ownable(donoInicial)
        EIP712("VinculoEtereo", "1")
    {
        if (eter_ == address(0) || ambar_ == address(0) || tesouraria_ == address(0) || assinante_ == address(0)) {
            revert DestinoInvalido();
        }
        eter = IERC20(eter_);
        ambar = IERC20(ambar_);
        tesouraria = tesouraria_;
        assinante = assinante_;
        _uriBase = uriBase_;
    }

    // ================================================================== //
    //  O ARREMESSO                                                        //
    // ================================================================== //

    /**
     * @notice Arremessa um selo. O selo queima dando certo ou não.
     *         Se o voucher disser que a captura funcionou, cunha o Ânimo e
     *         grava a certidão de nascimento com o nome escolhido.
     * @param v         voucher assinado pelo servidor do jogo
     * @param assinatura assinatura EIP-712
     * @param nome      o batismo. Ignorado quando o arremesso falha.
     * @param nomeNormalizado hash do nome normalizado (minúsculo, sem acento)
     */
    function arremessar(
        Arremesso calldata v,
        bytes calldata assinatura,
        string calldata nome,
        bytes32 nomeNormalizado
    ) external nonReentrant returns (uint256 tokenId) {
        // ---------- validação do voucher ----------
        if (block.timestamp > v.prazo) revert VoucherVencido(v.prazo);
        if (nonceUsado[v.nonce]) revert NonceJaUsado(v.nonce);
        if (v.vinculista != msg.sender) revert AssinaturaInvalida();

        bytes32 digesto = _hashTypedDataV4(keccak256(abi.encode(
            TIPO_ARREMESSO, v.vinculista, v.especie, v.idSelo, v.semente, v.ciclo,
            v.porte, v.matiz, v.nivel, v.padrao, v.prismatico, v.sucesso, v.nonce, v.prazo
        )));
        if (ECDSA.recover(digesto, assinatura) != assinante) revert AssinaturaInvalida();

        nonceUsado[v.nonce] = true;

        uint256 ciclo = politica.cicloAtual();
        if (v.ciclo != ciclo) revert CicloIncorreto(v.ciclo, ciclo);
        if (!politica.desceNoCiclo(ciclo, v.especie)) revert EspecieNaoDesceNesteCiclo(v.especie);

        uint256 custoBase = custoBaseDoSelo[v.idSelo];
        if (custoBase == 0) revert SeloDesconhecido(v.idSelo);

        // ---------- o selo queima, deu certo ou não ----------
        insumos.consumirDe(msg.sender, v.idSelo, 1);

        // ---------- sobretaxa da política ----------
        // custoDeArremesso já embute saturação da espécie e o termostato global.
        uint256 custoTotal = politica.custoDeArremesso(v.especie, custoBase);
        uint256 sobretaxa = custoTotal > custoBase ? custoTotal - custoBase : 0;
        if (sobretaxa != 0) {
            eter.safeTransferFrom(msg.sender, address(this), sobretaxa);
            IQueimavel(address(eter)).burn(sobretaxa);
            politica.registrarFluxo(0, sobretaxa);
        }

        emit SeloArremessado(msg.sender, v.especie, v.idSelo, v.sucesso, sobretaxa);

        if (!v.sucesso) return 0;

        // ---------- cunhagem + batismo ----------
        if (capturasNoCiclo[ciclo][msg.sender] >= capturasPorCicloPorCarteira) {
            revert LimiteDeCapturasNoCiclo();
        }
        capturasNoCiclo[ciclo][msg.sender] += 1;

        if (nomeNormalizado == bytes32(0) || bytes(nome).length < 2 || bytes(nome).length > 48) {
            revert NomeInvalido();
        }
        if (tokenPorNome[nomeNormalizado] != 0) revert NomeIndisponivel(nomeNormalizado);

        tokenId = _proximoId;
        unchecked { _proximoId = tokenId + 1; }

        _certidao[tokenId] = Nascimento({
            nome: nome,
            nomeNormalizado: nomeNormalizado,
            batizante: msg.sender,
            blocoNascimento: uint64(block.number),
            tempoNascimento: uint64(block.timestamp),
            cicloDeOrva: uint32(ciclo),
            semente: v.semente,
            especie: v.especie,
            porte: v.porte,
            matiz: v.matiz,
            nivelDeCaptura: v.nivel,
            padrao: v.padrao,
            prismatico: v.prismatico
        });
        tokenPorNome[nomeNormalizado] = tokenId;

        // Cobra o batismo e avisa a política ANTES da interação do _safeMint.
        _cobrarEmAmbar(CUSTO_BATISMO, BATISMO_QUEIMA_BP);
        politica.registrarCunhagem(v.especie);

        emit AnimaBatizada(tokenId, msg.sender, nome, v.especie, v.semente);

        _safeMint(msg.sender, tokenId);
    }

    // ================================================================== //
    //  APELIDO — o nome de nascimento continua o mesmo                    //
    // ================================================================== //

    /**
     * @notice Dá um apelido ao Ânimo. Custa caro de propósito: nome é espaço
     *         escasso. A certidão de nascimento NÃO muda — quem olhar vai
     *         continuar vendo o nome original e quem o deu.
     */
    function apelidar(uint256 tokenId, string calldata novoApelido, bytes32 apelidoNormalizado) external nonReentrant {
        if (_ownerOf(tokenId) != msg.sender) revert NaoEhDono();
        if (bytes(novoApelido).length < 2 || bytes(novoApelido).length > 48) revert NomeInvalido();
        if (tokenPorNome[apelidoNormalizado] != 0) revert NomeIndisponivel(apelidoNormalizado);

        bytes32 anterior = keccak256(bytes(_apelido[tokenId]));
        if (anterior != keccak256("")) {
            // libera o apelido antigo para outra pessoa
            delete tokenPorNome[anterior];
        }

        _cobrarEmAmbar(CUSTO_REBATISMO, REBATISMO_QUEIMA_BP);
        _apelido[tokenId] = novoApelido;
        tokenPorNome[apelidoNormalizado] = tokenId;
        emit Apelidado(tokenId, novoApelido);
    }

    // ================================================================== //
    //  LEITURA                                                            //
    // ================================================================== //

    /// @notice A certidão de nascimento completa. Nunca muda.
    function certidao(uint256 tokenId) external view returns (Nascimento memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenInexistente();
        return _certidao[tokenId];
    }

    /// @notice Como o Ânimo é chamado hoje (apelido, ou o nome de nascimento).
    function nomeAtual(uint256 tokenId) external view returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenInexistente();
        bytes memory ap = bytes(_apelido[tokenId]);
        return ap.length == 0 ? _certidao[tokenId].nome : _apelido[tokenId];
    }

    function nomeDisponivel(bytes32 nomeNormalizado) external view returns (bool) {
        return tokenPorNome[nomeNormalizado] == 0;
    }

    function totalCunhado() external view returns (uint256) {
        unchecked { return _proximoId - 1; }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenInexistente();
        return bytes(_uriBase).length == 0 ? "" : string.concat(_uriBase, tokenId.toString(), ".json");
    }

    // ================================================================== //
    //  ADMINISTRAÇÃO                                                      //
    // ================================================================== //

    function definirAssinante(address novo) external onlyOwner {
        if (novo == address(0)) revert DestinoInvalido();
        emit AssinanteDefinido(assinante, novo);
        assinante = novo;
    }

    function definirContratos(address politica_, address insumos_) external onlyOwner {
        if (politica_ == address(0) || insumos_ == address(0)) revert DestinoInvalido();
        politica = IPoliticaEconomica(politica_);
        insumos = IInsumos(insumos_);
    }

    function definirCustoDeSelo(uint16 idSelo, uint256 custoBase) external onlyOwner {
        custoBaseDoSelo[idSelo] = custoBase;
    }

    function definirLimitePorCiclo(uint256 limite) external onlyOwner {
        if (limite == 0 || limite > 1000) revert OperacaoDesabilitada();
        capturasPorCicloPorCarteira = limite;
    }

    function definirUriBase(string calldata nova) external onlyOwner {
        if (metadadosCongelados) revert MetadadosJaCongelados();
        _uriBase = nova;
        emit UriBaseAtualizada(nova);
    }

    function congelarMetadados() external onlyOwner {
        if (metadadosCongelados) revert MetadadosJaCongelados();
        metadadosCongelados = true;
        emit MetadadosCongelados();
    }

    function renounceOwnership() public view override onlyOwner {
        revert OperacaoDesabilitada();
    }

    // ================================================================== //

    function _cobrarEmAmbar(uint256 valor, uint16 queimaBP) private {
        uint256 queima = (valor * queimaBP) / 10_000;
        uint256 aoTesouro = valor - queima;
        if (queima != 0) {
            ambar.safeTransferFrom(msg.sender, address(this), queima);
            IQueimavel(address(ambar)).burn(queima);
        }
        if (aoTesouro != 0) {
            ambar.safeTransferFrom(msg.sender, tesouraria, aoTesouro);
        }
    }

    // ------------------------------------------------------------------ //

    function _update(address para, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(para, tokenId, auth);
    }

    function _increaseBalance(address conta, uint128 valor)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(conta, valor);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Sem receive() e sem fallback(): o contrato não aceita ETH.
}
