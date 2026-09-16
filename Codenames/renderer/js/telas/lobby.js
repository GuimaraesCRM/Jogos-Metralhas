/**
 * Lobby: código da sala, escolha de times e funções, configurações da partida.
 *
 * A montagem acontece uma vez; depois só as partes que mudam são reescritas.
 * O motivo é o campo de nome do time: refazer a tela inteira a cada mensagem do
 * servidor roubaria o cursor de quem está digitando.
 */

import { el, logo, preencher, icone, retrato, aviso } from '../ui.js';
import { enviar, sair } from '../net.js';
import {
  DO_CLIENTE,
  FUNCOES,
  MODO_REVELACAO,
  ROTULO_FUNCAO,
  ROTULO_FUNCAO_PLURAL
} from '/shared/protocolo.js';
import { criarControleDeTempo } from './tempo.js';

export function criarTelaLobby() {
  const valorCodigo = el('div', { classe: 'codigo__valor', texto: '----' });
  const painelVermelho = painelDeTime('vermelho');
  const painelAzul = painelDeTime('azul');
  const bancada = criarBancada();

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
      bancada.no,
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
              texto: `No consenso, a carta só vira quando todos os ${ROTULO_FUNCAO_PLURAL.operativo} do time clicam nela.`
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
      bancada.atualizar(estado);

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
  return `Cada time precisa de um ${ROTULO_FUNCAO.mestre} e pelo menos um ${ROTULO_FUNCAO.operativo}.`;
}

/**
 * Painel de um time: nome editável, Metralha Espião e Metralhas Operadores.
 *
 * Os botões de entrar só aparecem quando há o que fazer. Antes eles ficavam
 * sempre na tela, apagados quando o posto estava ocupado, e um botão apagado
 * parece defeito, não regra — a pessoa fica clicando achando que travou.
 */
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
    classe: 'botao botao--pequeno botao--fantasma botao--largo oculto',
    texto: `Assumir o posto de ${ROTULO_FUNCAO.mestre}`,
    ao: { click: () => enviar(DO_CLIENTE.ESCOLHER_FUNCAO, { time, funcao: FUNCOES.MESTRE }) }
  });

  const botaoOperativo = el('button', {
    classe: `botao botao--pequeno botao--${time} botao--largo oculto`,
    texto: `Entrar como ${ROTULO_FUNCAO.operativo}`,
    ao: { click: () => enviar(DO_CLIENTE.ESCOLHER_FUNCAO, { time, funcao: FUNCOES.OPERATIVO }) }
  });

  const no = el(
    'div',
    { classe: `time time--${time}` },
    campoNome,
    el(
      'div',
      { classe: 'time__grupo' },
      el('span', { classe: 'time__titulo', texto: ROTULO_FUNCAO.mestre }),
      listaMestre,
      botaoMestre
    ),
    el(
      'div',
      { classe: 'time__grupo' },
      el('span', { classe: 'time__titulo', texto: ROTULO_FUNCAO_PLURAL.operativo }),
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

      const eu = estado.voce;
      const doTime = estado.jogadores.filter((j) => j.time === time);
      const mestre = doTime.find((j) => j.funcao === FUNCOES.MESTRE);
      const operativos = doTime.filter((j) => j.funcao === FUNCOES.OPERATIVO);

      preencher(
        listaMestre,
        mestre
          ? fichaDeJogador(mestre, eu.id)
          : el('div', { classe: 'time__vazio', texto: 'Posto vago.' })
      );

      preencher(
        listaOperativos,
        operativos.length > 0
          ? operativos.map((j) => fichaDeJogador(j, eu.id))
          : el('div', { classe: 'time__vazio', texto: 'Nenhum agente neste time ainda.' })
      );

      // O posto de Metralha Espião é único: o botão só existe se estiver vago.
      botaoMestre.classList.toggle('oculto', Boolean(mestre));

      // O de operador só some quando você já é operador deste mesmo time.
      const jaSouOperativoAqui = eu.time === time && eu.funcao === FUNCOES.OPERATIVO;
      botaoOperativo.classList.toggle('oculto', jaSouOperativoAqui);
    }
  };
}

/**
 * Bancada: quem ainda não escolheu time e quem está só assistindo.
 *
 * Isto era uma linha fina e discreta no meio da tela, e passava despercebido —
 * dava para começar a partida sem notar que alguém tinha ficado de fora. Agora
 * é um cartão com peso próprio, e é também onde fica a opção de assistir.
 */
function criarBancada() {
  const semTime = el('div', { classe: 'bancada__lista' });
  const espectadores = el('div', { classe: 'bancada__lista' });
  const grupoSemTime = el('div', { classe: 'bancada__grupo' });
  const grupoEspectadores = el('div', { classe: 'bancada__grupo' });

  const botaoAssistir = el('button', {
    classe: 'botao botao--pequeno botao--fantasma',
    texto: 'Só assistir',
    ao: { click: () => enviar(DO_CLIENTE.ESCOLHER_FUNCAO, { funcao: FUNCOES.ESPECTADOR }) }
  });

  const no = el(
    'div',
    { classe: 'bancada' },
    el(
      'div',
      { classe: 'bancada__topo' },
      el('span', { classe: 'bancada__titulo', texto: 'Fora dos times' }),
      botaoAssistir
    ),
    grupoSemTime,
    grupoEspectadores
  );

  return {
    no,
    atualizar(estado) {
      const eu = estado.voce;
      const soltos = estado.jogadores.filter((j) => !j.time && j.funcao !== FUNCOES.ESPECTADOR);
      const assistindo = estado.jogadores.filter((j) => j.funcao === FUNCOES.ESPECTADOR);

      grupoSemTime.classList.toggle('oculto', soltos.length === 0);
      if (soltos.length > 0) {
        preencher(
          grupoSemTime,
          el('div', {
            classe: 'bancada__rotulo bancada__rotulo--alerta',
            texto:
              soltos.length === 1
                ? '1 pessoa ainda não escolheu time'
                : `${soltos.length} pessoas ainda não escolheram time`
          }),
          preencher(semTime, ...soltos.map((j) => fichaDeJogador(j, eu.id)))
        );
      }

      grupoEspectadores.classList.toggle('oculto', assistindo.length === 0);
      if (assistindo.length > 0) {
        preencher(
          grupoEspectadores,
          el('div', { classe: 'bancada__rotulo', texto: 'Assistindo' }),
          preencher(espectadores, ...assistindo.map((j) => fichaDeJogador(j, eu.id)))
        );
      }

      // Já está assistindo? O botão vira informação, não ação repetida.
      const souEspectador = eu.funcao === FUNCOES.ESPECTADOR;
      botaoAssistir.classList.toggle('oculto', souEspectador);
      no.dataset.vazia = soltos.length === 0 && assistindo.length === 0 ? 'sim' : 'nao';
    }
  };
}

/** Ficha de uma pessoa na sala: retrato, nome, e quem é você no meio da lista. */
function fichaDeJogador(jogador, meuId) {
  const souEu = jogador.id === meuId;

  return el(
    'div',
    {
      classe: ['jogador', souEu ? 'jogador--eu' : '', jogador.conectado ? '' : 'jogador--ausente']
        .filter(Boolean)
        .join(' ')
    },
    retrato(jogador),
    el('span', { classe: 'jogador__nome', texto: jogador.nome }),
    // Com dois "Lucas" na sala, esta é a única forma de saber qual é o seu.
    souEu ? el('span', { classe: 'etiqueta etiqueta--voce', texto: 'você' }) : null,
    jogador.anfitriao ? el('span', { classe: 'etiqueta etiqueta--anfitriao', texto: 'anfitrião' }) : null,
    jogador.conectado ? null : el('span', { classe: 'etiqueta', texto: 'caiu' })
  );
}

/** Grupo de pílulas exclusivas (o modo de revelação usa este). */
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
