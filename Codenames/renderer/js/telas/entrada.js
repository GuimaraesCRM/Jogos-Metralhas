/**
 * Tela inicial: nome, criar sala ou entrar com um código.
 *
 * Também é onde se troca o endereço do servidor — escondido atrás de um link,
 * porque 99% das vezes o padrão já está certo, mas quem hospedou o próprio
 * servidor precisa de um lugar para colar o endereço sem recompilar o app.
 */

import { el, logo, aviso } from '../ui.js';
import { enviar, conectar } from '../net.js';
import { CHAVES, SERVIDOR_PADRAO, enderecoDoServidor, guardar, lerGuardado } from '../config.js';
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
    value: lerGuardado(CHAVES.NOME, '') ?? '',
    autofocus: true
  });

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
    guardar(CHAVES.NOME, nome);
    return nome;
  }

  function criarSala() {
    const nome = nomeValido();
    if (nome) enviar(DO_CLIENTE.CRIAR_SALA, { nome });
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
    enviar(DO_CLIENTE.ENTRAR_SALA, { codigo, nome });
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
            campoNome
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

  return {
    no,
    atualizar(loja) {
      conexao.dataset.estado = loja.conexao;
      textoConexao.textContent = TEXTO_CONEXAO[loja.conexao] ?? '';
    }
  };
}
