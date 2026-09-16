/**
 * Tela inicial: nome, criar sala ou entrar com um código.
 *
 * Também é onde se troca o endereço do servidor — escondido atrás de um link,
 * porque 99% das vezes o padrão já está certo, mas quem hospedou o próprio
 * servidor precisa de um lugar para colar o endereço sem recompilar o app.
 */

import { el, logo, aviso, retrato } from '../ui.js';
import { enviar } from '../net.js';
import { CHAVES, SERVIDOR_PADRAO, enderecoDoServidor, guardar } from '../config.js';
import { identidadeInicial } from '../launcher.js';
import { DO_CLIENTE } from '/shared/protocolo.js';

const TEXTO_CONEXAO = {
  parado: 'desconectado',
  conectando: 'conectando ao servidor...',
  conectado: 'conectado',
  caiu: 'servidor fora de alcance — tentando de novo'
};

export function criarTelaEntrada() {
  const campoNome = el('input', {
    classe: 'entrada',
    type: 'text',
    maxLength: 18,
    placeholder: 'Como te chamam?',
    value: '',
    autofocus: true
  });

  // Preenchido quando o launcher entregar a identidade; nulo enquanto não houver.
  const blocoIdentidade = el('div', { classe: 'identidade oculta' });
  let identidade = { nome: '', avatar: null, sala: null, travado: false };
  let jaTentouEntrarSozinho = false;

  const campoCodigo = el('input', {
    classe: 'entrada entrada--codigo',
    type: 'text',
    maxLength: 4,
    placeholder: '----',
    spellcheck: false,
    ao: {
      input: () => {
        // O código é sempre maiúsculo e só de letras: corrigir enquanto digita
        // evita o erro chato de "entrei e disse que a sala não existe".
        campoCodigo.value = campoCodigo.value.toUpperCase().replace(/[^A-Z]/g, '');
      },
      keydown: (e) => {
        if (e.key === 'Enter') entrarNaSala();
      }
    }
  });

  const campoServidor = el('input', {
    classe: 'entrada',
    type: 'text',
    value: enderecoDoServidor(),
    spellcheck: false,
    placeholder: SERVIDOR_PADRAO
  });

  const blocoServidor = el(
    'div',
    { classe: 'campo oculto' },
    el('span', { classe: 'campo__rotulo', texto: 'Endereço do servidor' }),
    campoServidor,
    el('button', {
      classe: 'botao botao--pequeno botao--fantasma',
      texto: 'Salvar e reconectar',
      ao: {
        click: () => {
          const novo = campoServidor.value.trim();
          if (!/^wss?:\/\//i.test(novo)) {
            return aviso('O endereço precisa começar com ws:// ou wss://');
          }
          guardar(CHAVES.SERVIDOR, novo);
          aviso('Servidor salvo. Reconectando...', 'info');
          location.reload();
        }
      }
    })
  );

  const pontoConexao = el('span', { classe: 'conexao__ponto' });
  const textoConexao = el('span', { texto: TEXTO_CONEXAO.conectando });
  const conexao = el('div', { classe: 'conexao' }, pontoConexao, textoConexao);

  function nomeValido() {
    const nome = campoNome.value.trim();
    if (nome.length < 2) {
      aviso('Escreva seu nome para entrar.');
      campoNome.focus();
      return null;
    }
    // Nome vindo do launcher não é nosso para guardar: ele manda na próxima vez.
    if (!identidade.travado) guardar(CHAVES.NOME, nome);
    return nome;
  }

  function criarSala() {
    const nome = nomeValido();
    if (nome) enviar(DO_CLIENTE.CRIAR_SALA, { nome, avatar: identidade.avatar });
  }

  function entrarNaSala() {
    const nome = nomeValido();
    if (!nome) return;
    const codigo = campoCodigo.value.trim().toUpperCase();
    if (codigo.length !== 4) {
      aviso('O código da sala tem 4 letras.');
      campoCodigo.focus();
      return;
    }
    enviar(DO_CLIENTE.ENTRAR_SALA, { codigo, nome, avatar: identidade.avatar });
  }

  const no = el(
    'div',
    { classe: 'tela-entrada' },
    el(
      'div',
      { classe: 'entrada__caixa' },
      el(
        'div',
        { classe: 'entrada__cabecalho' },
        logo('grande'),
        el('p', {
          classe: 'entrada__subtitulo',
          texto:
            'Dois times, vinte e cinco palavras e um assassino no meio. ' +
            'Crie uma sala e mande o código para o resto do grupo.'
        })
      ),
      el(
        'div',
        { classe: 'painel' },
        el(
          'div',
          { classe: 'entrada__formulario' },
          el(
            'label',
            { classe: 'campo' },
            el('span', { classe: 'campo__rotulo', texto: 'Seu nome' }),
            campoNome,
            blocoIdentidade
          ),
          el('button', {
            classe: 'botao botao--principal botao--largo',
            texto: 'Criar uma sala',
            ao: { click: criarSala }
          }),
          el('div', { classe: 'entrada__separador', texto: 'ou' }),
          el(
            'label',
            { classe: 'campo' },
            el('span', { classe: 'campo__rotulo', texto: 'Código da sala' }),
            campoCodigo
          ),
          el('button', {
            classe: 'botao botao--largo',
            texto: 'Entrar na sala',
            ao: { click: entrarNaSala }
          })
        )
      ),
      el(
        'div',
        { classe: 'entrada__rodape' },
        conexao,
        el('button', {
          classe: 'ligacao',
          texto: 'Configurar servidor',
          ao: { click: () => blocoServidor.classList.toggle('oculto') }
        }),
        blocoServidor
      )
    )
  );

  campoNome.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (campoCodigo.value.length === 4 ? entrarNaSala : criarSala)();
  });

  /**
   * Aplica a identidade resolvida. Com o launcher no ar, o nome deixa de ser um
   * campo para preencher e vira a exibição de quem você já é; sem ele, volta a
   * ser o campo de sempre, preenchido com o último nome usado nesta máquina.
   */
  function aplicarIdentidade(resolvida) {
    identidade = resolvida;
    campoNome.value = resolvida.nome ?? '';

    if (!resolvida.travado) {
      blocoIdentidade.classList.add('oculta');
      campoNome.focus();
      return;
    }

    campoNome.classList.add('oculto');
    blocoIdentidade.classList.remove('oculta');
    blocoIdentidade.replaceChildren(
      retrato({ nome: resolvida.nome, avatar: resolvida.avatar }, 'retrato--grande'),
      el(
        'div',
        {},
        el('div', { classe: 'identidade__nome', texto: resolvida.nome }),
        el('div', { classe: 'identidade__origem', texto: 'identificado pelo launcher' })
      )
    );

    if (resolvida.sala) campoCodigo.value = resolvida.sala;
  }

  identidadeInicial().then(aplicarIdentidade);

  return {
    no,
    atualizar(loja) {
      conexao.dataset.estado = loja.conexao;
      textoConexao.textContent = TEXTO_CONEXAO[loja.conexao] ?? '';

      // Launcher que já indicou a sala não deveria exigir um clique a mais:
      // assim que a conexão abre, o jogo entra sozinho. Uma vez só, para uma
      // recusa do servidor não virar laço de tentativas.
      if (identidade.sala && loja.conexao === 'conectado' && !jaTentouEntrarSozinho) {
        jaTentouEntrarSozinho = true;
        entrarNaSala();
      }
    }
  };
}
