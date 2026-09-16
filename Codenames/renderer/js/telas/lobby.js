/**
 * Lobby: código da sala, escolha de times e funções, configurações da partida.
 *
 * A montagem acontece uma vez; depois só as partes que mudam são reescritas.
 * O motivo é o campo de nome do time: refazer a tela inteira a cada mensagem do
 * servidor roubaria o cursor de quem está digitando.
 */

import { el, logo, preencher, icone, aviso } from '../ui.js';
import { enviar, sair } from '../net.js';
import { DO_CLIENTE, FUNCOES, MODO_REVELACAO, iniciais } from '/shared/protocolo.js';
import { criarControleDeTempo } from './tempo.js';

export function criarTelaLobby() {
  const valorCodigo = el('div', { classe: 'codigo__valor', texto: '----' });
  const painelVermelho = painelDeTime('vermelho');
  const painelAzul = painelDeTime('azul');
  const semTime = el('div', { classe: 'lobby__sem-time oculto' });

  const botaoIniciar = el('button', {
    classe: 'botao botao--principal',
    texto: 'Começar a partida',
    ao: { click: () => enviar(DO_CLIENTE.INICIAR_PARTIDA) }
  });
  const dicaInicio = el('p', { classe: 'lobby__dica' });

  const controleTempo = criarControleDeTempo();

  const opcoesRevelacao = grupoDeOpcoes(
    [
      [MODO_REVELACAO.CONSENSO, 'Por consenso'],
      [MODO_REVELACAO.LIVRE, 'Clique livre']
    ],
    (valor) => enviar(DO_CLIENTE.CONFIGURAR, { modoRevelacao: valor })
  );

  const no = el(
    'div',
    { classe: 'tela-lobby' },
    el(
      'div',
      { classe: 'lobby' },
      el(
        'div',
        { classe: 'lobby__topo' },
        logo('pequeno'),
        el(
          'div',
          { classe: 'codigo' },
          el(
            'div',
            {},
            el('div', { classe: 'codigo__rotulo', texto: 'Código da sala' }),
            valorCodigo
          ),
          el(
            'button',
            {
              classe: 'botao botao--pequeno botao--fantasma',
              title: 'Copiar o código',
              ao: {
                click: async () => {
                  await navigator.clipboard.writeText(valorCodigo.textContent);
                  aviso('Código copiado. Manda no grupo!', 'info');
                }
              }
            },
            icone('copiar'),
            'Copiar'
          )
        ),
        el('button', {
          classe: 'botao botao--pequeno botao--fantasma',
          texto: 'Sair da sala',
          ao: { click: sair }
        })
      ),
      el('div', { classe: 'times' }, painelVermelho.no, painelAzul.no),
      semTime,
      el(
        'div',
        { classe: 'painel' },
        el(
          'div',
          { classe: 'config' },
          el(
            'div',
            { classe: 'campo' },
            el('span', { classe: 'campo__rotulo', texto: 'Tempo por turno' }),
            controleTempo.no,
            el('span', {
              classe: 'lobby__dica',
              texto: 'O relógio vale para a dica e para os palpites. Dá para mudar durante a partida.'
            })
          ),
          el(
            'div',
            { classe: 'campo' },
            el('span', { classe: 'campo__rotulo', texto: 'Como a carta vira' }),
            opcoesRevelacao.no,
            el('span', {
              classe: 'lobby__dica',
              texto: 'No consenso, a carta só vira quando todos os operativos do time clicam nela.'
            })
          )
        )
      ),
      el('div', { classe: 'lobby__inicio' }, botaoIniciar, dicaInicio)
    )
  );

  return {
    no,
    atualizar(loja) {
      const estado = loja.estado;
      if (!estado) return;

      valorCodigo.textContent = estado.codigo;
      const souAnfitriao = estado.voce.anfitriao;

      painelVermelho.atualizar(estado);
      painelAzul.atualizar(estado);

      // Quem ainda não escolheu time fica visível para ninguém ser esquecido.
      const soltos = estado.jogadores.filter((j) => !j.time);
      semTime.classList.toggle('oculto', soltos.length === 0);
      if (soltos.length > 0) {
        preencher(
          semTime,
          el('span', { texto: 'Ainda sem time:' }),
          ...soltos.map((j) => el('span', { classe: 'etiqueta', texto: j.nome }))
        );
      }

      controleTempo.atualizar(estado.config.duracaoTurno, souAnfitriao);
      opcoesRevelacao.atualizar(estado.config.modoRevelacao, souAnfitriao);

      botaoIniciar.disabled = !souAnfitriao || !estado.podeIniciar;
      dicaInicio.textContent = mensagemDeInicio(estado, souAnfitriao);
    }
  };
}

/** Explica por que o botão de começar está apagado. */
function mensagemDeInicio(estado, souAnfitriao) {
  if (estado.podeIniciar && souAnfitriao) return 'Todo mundo pronto. Boa sorte.';
  if (estado.podeIniciar) {
    const anfitriao = estado.jogadores.find((j) => j.anfitriao);
    return `Esperando ${anfitriao?.nome ?? 'o anfitrião'} começar a partida.`;
  }
  return 'Cada time precisa de um mestre-espião e pelo menos um operativo.';
}

/** Painel de um time: nome editável, mestre-espião e operativos. */
function painelDeTime(time) {
  const campoNome = el('input', {
    classe: 'time__nome',
    type: 'text',
    maxLength: 18,
    ao: {
      change: () => enviar(DO_CLIENTE.RENOMEAR_TIME, { time, nome: campoNome.value }),
      keydown: (e) => {
        if (e.key === 'Enter') campoNome.blur();
      }
    }
  });

  const listaMestre = el('div', { classe: 'time__grupo' });
  const listaOperativos = el('div', { classe: 'time__grupo' });

  const botaoMestre = el('button', {
    classe: 'botao botao--pequeno botao--fantasma botao--largo',
    texto: 'Ser o mestre-espião',
    ao: { click: () => enviar(DO_CLIENTE.ESCOLHER_FUNCAO, { time, funcao: FUNCOES.MESTRE }) }
  });

  const botaoOperativo = el('button', {
    classe: `botao botao--pequeno botao--${time} botao--largo`,
    texto: 'Ser operativo',
    ao: { click: () => enviar(DO_CLIENTE.ESCOLHER_FUNCAO, { time, funcao: FUNCOES.OPERATIVO }) }
  });

  const no = el(
    'div',
    { classe: `time time--${time}` },
    campoNome,
    el(
      'div',
      { classe: 'time__grupo' },
      el('span', { classe: 'time__titulo', texto: 'Mestre-espião' }),
      listaMestre,
      botaoMestre
    ),
    el(
      'div',
      { classe: 'time__grupo' },
      el('span', { classe: 'time__titulo', texto: 'Operativos' }),
      listaOperativos,
      botaoOperativo
    )
  );

  return {
    no,
    atualizar(estado) {
      // Não sobrescrever o campo enquanto a pessoa digita nele.
      if (document.activeElement !== campoNome) campoNome.value = estado.config.nomes[time];
      campoNome.disabled = !estado.voce.anfitriao;
      campoNome.title = estado.voce.anfitriao ? 'Clique para renomear o time' : '';

      const doTime = estado.jogadores.filter((j) => j.time === time);
      const mestre = doTime.find((j) => j.funcao === FUNCOES.MESTRE);
      const operativos = doTime.filter((j) => j.funcao === FUNCOES.OPERATIVO);

      preencher(
        listaMestre,
        mestre
          ? fichaDeJogador(mestre, estado.voce.id)
          : el('div', { classe: 'time__vazio', texto: 'Ninguém assumiu o cargo ainda.' })
      );

      preencher(
        listaOperativos,
        operativos.length > 0
          ? operativos.map((j) => fichaDeJogador(j, estado.voce.id))
          : el('div', { classe: 'time__vazio', texto: 'Nenhum operativo neste time.' })
      );

      // O cargo de mestre é único: só aparece disponível se estiver vago (ou se
      // for você, para dar a volta e trocar de time).
      const souEu = estado.voce;
      botaoMestre.disabled = Boolean(mestre) && mestre.id !== souEu.id;
      botaoMestre.textContent =
        mestre?.id === souEu.id ? 'Você é o mestre-espião' : 'Ser o mestre-espião';
      botaoOperativo.disabled =
        souEu.time === time && souEu.funcao === FUNCOES.OPERATIVO;
      botaoOperativo.textContent =
        souEu.time === time && souEu.funcao === FUNCOES.OPERATIVO
          ? 'Você é operativo deste time'
          : 'Ser operativo';
    }
  };
}

function fichaDeJogador(jogador, meuId) {
  return el(
    'div',
    {
      classe: [
        'jogador',
        jogador.id === meuId ? 'jogador--eu' : '',
        jogador.conectado ? '' : 'jogador--ausente'
      ]
        .filter(Boolean)
        .join(' ')
    },
    el('span', { classe: 'jogador__sigla', texto: iniciais(jogador.nome) }),
    el('span', { classe: 'jogador__nome', texto: jogador.nome }),
    jogador.anfitriao ? el('span', { classe: 'etiqueta etiqueta--anfitriao', texto: 'anfitrião' }) : null,
    jogador.conectado ? null : el('span', { classe: 'etiqueta', texto: 'caiu' })
  );
}

/** Grupo de pílulas exclusivas (o timer e o modo de revelação usam este). */
function grupoDeOpcoes(opcoes, aoEscolher) {
  const botoes = opcoes.map(([valor, rotulo]) =>
    el('button', {
      classe: 'opcoes__item',
      type: 'button',
      texto: rotulo,
      'aria-pressed': 'false',
      ao: { click: () => aoEscolher(valor) }
    })
  );

  return {
    no: el('div', { classe: 'opcoes' }, ...botoes),
    atualizar(selecionado, habilitado) {
      botoes.forEach((botao, i) => {
        botao.setAttribute('aria-pressed', String(opcoes[i][0] === selecionado));
        botao.disabled = !habilitado;
      });
    }
  };
}
