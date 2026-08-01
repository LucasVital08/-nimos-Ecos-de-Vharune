/* =========================================================================
   web3/carteira.js — Integração Web3 OPCIONAL e somente leitura
   ---------------------------------------------------------------------
   REGRAS DESTE MÓDULO (por design, não por acaso):
     • Nada aqui é necessário para jogar. O jogo funciona 100% offline.
     • A conexão só acontece quando a pessoa clica no botão.
     • NENHUMA transação é criada, assinada ou enviada. Não há `eth_sendTransaction`,
       nem `signMessage`, nem `approve`, nem chamada a contrato que gaste gás.
     • Nada é implantado (deploy) e nenhum NFT é criado de verdade.
     • O contrato em contratos/VinculoEtereo.sol é referência auditável, não é usado aqui.
   ========================================================================= */
(function (G) {
  'use strict';

  var E = G.Estado;
  var C = G.Criatura;
  var UI = G.UI;
  var W = G.Carteira = {};

  var conta = null;
  var rede = null;

  var REDES = {
    '0x1': 'Ethereum',
    '0x5': 'Goerli (teste)',
    '0xaa36a7': 'Sepolia (teste)',
    '0x89': 'Polygon',
    '0x13882': 'Amoy (teste)',
    '0x2105': 'Base',
    '0x14a34': 'Base Sepolia (teste)'
  };

  W.disponivel = function () {
    return typeof window !== 'undefined' && !!window.ethereum;
  };

  W.conectada = function () { return !!conta; };
  W.conta = function () { return conta; };

  W.encurtar = function (a) {
    return a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
  };

  /* Só é chamado a partir de um clique explícito. */
  W.conectar = function () {
    if (!W.disponivel()) {
      UI.toast('Nenhuma carteira detectada neste navegador.', 'aviso');
      return Promise.resolve(null);
    }
    return window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(function (contas) {
        conta = (contas && contas[0]) || null;
        return window.ethereum.request({ method: 'eth_chainId' });
      })
      .then(function (id) {
        rede = id;
        UI.toast('Carteira conectada (somente leitura).', 'ok');
        G.bus.emit('carteira_mudou');
        return conta;
      })
      .catch(function (e) {
        if (e && e.code === 4001) UI.toast('Conexão recusada.', 'aviso');
        else UI.toast('Não foi possível conectar.', 'aviso');
        return null;
      });
  };

  W.desconectar = function () {
    conta = null;
    rede = null;
    UI.toast('Carteira desconectada do jogo.', 'ok');
    G.bus.emit('carteira_mudou');
  };

  /* -------------------- metadados no padrão ERC-721 -------------------- */
  /* Gerado localmente. Nada é enviado para lugar nenhum.                  */
  W.metadados = function (c) {
    var esp = G.especie(c.esp);
    var at = C.atributos(c);
    return {
      name: C.nome(c) + ' #' + (c.seed >>> 0).toString(16).toUpperCase(),
      description: 'Ânimo de Vharune registrado por um Vinculista. ' + esp.desc,
      external_url: 'https://exemplo.invalido/animos',
      image: G.Arte.dataURL(c.esp, G.variacaoDe(c)),
      attributes: [
        { trait_type: 'Espécie', value: esp.nome },
        { trait_type: 'Categoria', value: esp.categoria },
        { trait_type: 'Aspecto primário', value: G.nomeTipo(esp.tipos[0]) },
        { trait_type: 'Aspecto secundário', value: esp.tipos[1] ? G.nomeTipo(esp.tipos[1]) : 'nenhum' },
        { trait_type: 'Padrão', value: C.padraoNome(c) },
        { trait_type: 'Porte', value: C.porteNome(c) },
        { trait_type: 'Natureza', value: C.natureza(c).nome },
        { trait_type: 'Prismático', value: c.prismatico ? 'Sim' : 'Não' },
        { display_type: 'number', trait_type: 'Nível', value: c.nivel },
        { display_type: 'number', trait_type: 'Vigor', value: at.hp },
        { display_type: 'number', trait_type: 'Ataque', value: at.atk },
        { display_type: 'number', trait_type: 'Defesa', value: at.def },
        { display_type: 'number', trait_type: 'Atq. Especial', value: at.atkEsp },
        { display_type: 'number', trait_type: 'Def. Especial', value: at.defEsp },
        { display_type: 'number', trait_type: 'Velocidade', value: at.vel },
        { display_type: 'boost_percentage', trait_type: 'Vínculo', value: Math.round(c.vinculo) }
      ]
    };
  };

  W.baixarMetadados = function (c) {
    var json = JSON.stringify(W.metadados(c), null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'animos-' + c.esp + '-' + (c.seed >>> 0).toString(16) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    UI.toast('Metadados salvos no seu computador.', 'ok');
  };

  /* ----------------------------- painel -------------------------------- */
  W.renderPainel = function (corpo) {
    var box = G.criar('div', 'opcoes');

    var aviso = G.criar('div', 'op-bloco');
    aviso.appendChild(G.criar('h4', null, 'O que este módulo faz — e o que não faz'));
    aviso.appendChild(G.criar('p', null,
      'Ânimos é um jogo completo sem blockchain nenhuma. Este painel existe só como base técnica opcional.\n\n' +
      '• Nada é implantado na rede e nenhum NFT real é criado.\n' +
      '• Nenhuma transação é montada, assinada ou enviada — em lugar nenhum do código.\n' +
      '• A conexão só ocorre se você clicar, e serve apenas para exibir seu endereço.\n' +
      '• Seu save continua no localStorage do navegador, como sempre.'));
    box.appendChild(aviso);

    var conexao = G.criar('div', 'op-bloco');
    conexao.appendChild(G.criar('h4', null, 'Carteira'));
    if (!W.disponivel()) {
      conexao.appendChild(G.criar('p', null,
        'Nenhum provedor EIP-1193 (window.ethereum) foi detectado neste navegador. ' +
        'Isso não afeta o jogo em nada.'));
    } else if (conta) {
      conexao.appendChild(G.criar('p', null,
        'Conectada em modo leitura.\nEndereço: ' + conta + '\nRede: ' + (REDES[rede] || rede || 'desconhecida')));
      var acoes = G.criar('div', 'op-acoes');
      var bd = G.criar('button', 'btn btn-peq btn-fantasma', 'Desconectar do jogo');
      bd.addEventListener('click', function () { W.desconectar(); UI.recarregarPainel(); });
      acoes.appendChild(bd);
      conexao.appendChild(acoes);
    } else {
      conexao.appendChild(G.criar('p', null,
        'Uma carteira foi detectada. Conectar é opcional e não gera custo nem transação: ' +
        'o jogo só lê o endereço público para exibi-lo aqui.'));
      var acoes2 = G.criar('div', 'op-acoes');
      var bc = G.criar('button', 'btn btn-peq', 'Conectar (somente leitura)');
      bc.addEventListener('click', function () {
        W.conectar().then(function () { UI.recarregarPainel(); });
      });
      acoes2.appendChild(bc);
      conexao.appendChild(acoes2);
    }
    box.appendChild(conexao);

    var meta = G.criar('div', 'op-bloco');
    meta.appendChild(G.criar('h4', null, 'Prévia de metadados ERC-721'));
    meta.appendChild(G.criar('p', null,
      'Gera localmente o JSON no formato de metadados ERC-721 de um Ânimo da sua equipe, ' +
      'com a arte embutida como data URI. Use para testar um contrato próprio em rede de testes, se quiser.'));
    if (!E.s.equipe.length) {
      meta.appendChild(G.criar('p', 'mini', 'Sua equipe está vazia.'));
    } else {
      var sel = G.criar('select');
      sel.style.cssText = 'width:100%;padding:.6em;background:var(--painel);color:var(--texto);' +
        'border:1px solid var(--borda);border-radius:9px;font:inherit;margin-bottom:9px';
      E.s.equipe.forEach(function (c, i) {
        var o = G.criar('option', null, C.nome(c) + ' — Nv ' + c.nivel + ' · ' + C.marcaIndividual(c));
        o.value = String(i);
        sel.appendChild(o);
      });
      meta.appendChild(sel);

      var ta = G.criar('textarea', 'saida');
      ta.readOnly = true;
      function atualizar() {
        var c = E.s.equipe[parseInt(sel.value, 10) || 0];
        var m = W.metadados(c);
        var copia = JSON.parse(JSON.stringify(m));
        copia.image = m.image.slice(0, 64) + '… (data URI, ' + m.image.length + ' bytes)';
        ta.value = JSON.stringify(copia, null, 2);
      }
      sel.addEventListener('change', atualizar);
      meta.appendChild(ta);
      atualizar();

      var acoes3 = G.criar('div', 'op-acoes');
      acoes3.style.marginTop = '9px';
      var bb = G.criar('button', 'btn btn-peq', 'Baixar JSON completo');
      bb.addEventListener('click', function () {
        W.baixarMetadados(E.s.equipe[parseInt(sel.value, 10) || 0]);
      });
      acoes3.appendChild(bb);
      meta.appendChild(acoes3);
    }
    box.appendChild(meta);

    var contrato = G.criar('div', 'op-bloco');
    contrato.appendChild(G.criar('h4', null, 'Contrato de referência'));
    contrato.appendChild(G.criar('p', null,
      'O arquivo contratos/VinculoEtereo.sol traz um ERC-721 mínimo e seguro (Ownable, ' +
      'proteção contra reentrância na cunhagem, limite de suprimento, URI congelável). ' +
      'Ele NÃO é compilado nem implantado por este jogo. Leia o README antes de qualquer teste, ' +
      'e use somente rede de testes.'));
    box.appendChild(contrato);

    corpo.appendChild(box);
  };

})(window.ANIMOS);
