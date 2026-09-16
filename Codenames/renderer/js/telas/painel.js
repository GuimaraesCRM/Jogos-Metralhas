/**
 * Painel lateral da tela de jogo.
 *
 * Mostra de quem é a vez, a dica em cartaz (ou o formulário, se você for o
 * mestre da vez), o histórico da partida e quem está em cada time. O conteúdo
 * muda conforme a sua função: o operativo vê o botão de encerrar o turno, o
 * mestre vê o campo de dica, e ninguém vê o que não lhe diz respeito.
 */

import { el, preencher, plural, retrato } from '../ui.js';
import { enviar } from '../net.js';
import { DO_CLIENTE, FUNCOES, MODO_REVELACAO, ROTULO_FUNCAO } from '/shared/protocolo.js';
import { criarControleDeTempo } from './tempo.js';

const ROTULO_RESULTADO = {
  acerto: 'acertou',
  'acerto-ultimo': 'acertou — acabaram os palpites',
  neutra: 'carta neutra',
  adversario: 'carta do adversário',
  assassino: 'o assassino',
  fim: 'última carta'
};

export function criarPainel() {
  // --- de quem é a vez -----------------------------------------------------

  const vezTexto = el('div', { classe: 'vez__texto' });
  const vezSub = el('div', { classe: 'vez__sub' });
  const vez = el(
    'div',
    { classe: 'vez' },
    el('span', { classe: 'vez__bolinha' }),
    el(
      'div',
      {},
      // Rótulo fixo em cima e o nome do time embaixo: evita construir frases
      // como "Vez do Os Espiões" com nomes que o próprio jogador escreveu.
      el('div', { classe: 'vez__rotulo', texto: 'Jogando agora' }),
      vezTexto,
      vezSub
    )
  );

  // --- formulário de dica (só para o mestre da vez) -------------------------

  const campoPalavra = el('input', {
    classe: 'entrada',
    type: 'text',
    maxLength: 24,
    placeholder: 'Sua dica',
    spellcheck: false
  });

  const campoNumero = el('input', {
    classe: 'entrada',
    type: 'number',
    min: 1,
    max: 9,
    value: 1
  });

  function mandarDica() {
    const palavra = campoPalavra.value.trim();
    const numero = Number(campoNumero.value);
    if (!palavra) return campoPalavra.focus();
    enviar(DO_CLIENTE.DAR_DICA, { palavra, numero });
    campoPalavra.value = '';
    campoNumero.value = '1';
  }

  campoPalavra.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') mandarDica();
  });
  campoNumero.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') mandarDica();
  });

  const formularioDica = el(
    'div',
    { classe: 'cartao oculto' },
    el('div', { classe: 'cartao__titulo', texto: 'Sua dica' }),
    el(
      'div',
      { classe: 'formulario-dica' },
      el('div', { classe: 'formulario-dica__linha' }, campoPalavra, campoNumero),
      el('button', {
        classe: 'botao botao--principal botao--largo',
        texto: 'Anunciar dica',
        ao: { click: mandarDica }
      }),
      el('span', {
        classe: 'lobby__dica',
        texto: 'Uma palavra só, e quantas cartas ela cobre. Seu time ganha um palpite extra.'
      })
    )
  );

  // --- dica em cartaz ------------------------------------------------------

  const dicaPalavra = el('span', { classe: 'dica-atual__palavra' });
  const dicaNumero = el('span', { classe: 'dica-atual__numero' });
  const dicaRestantes = el('span', { classe: 'dica-atual__restantes' });
  const dicaAtual = el('div', { classe: 'dica-atual oculto' }, dicaPalavra, dicaNumero, dicaRestantes);

  const botaoEncerrar = el('button', {
    classe: 'botao botao--largo oculto',
    texto: 'Encerrar turno',
    ao: { click: () => enviar(DO_CLIENTE.VOTAR_ENCERRAR) }
  });

  // --- histórico e elenco --------------------------------------------------

  const historico = el('div', { classe: 'historico' });
  const elenco = el('div', { classe: 'elenco' });

  // Ajuste do relógio no meio da partida: só o anfitrião vê este bloco.
  const controleTempo = criarControleDeTempo();
  const cartaoTempo = el(
    'div',
    { classe: 'cartao oculto' },
    el('div', { classe: 'cartao__titulo', texto: 'Tempo por turno' }),
    controleTempo.no,
    el('span', { classe: 'lobby__dica', texto: 'Vale a partir do próximo turno.' })
  );

  const no = el(
    'aside',
    { classe: 'jogo__painel' },
    vez,
    dicaAtual,
    formularioDica,
    botaoEncerrar,
    el(
      'div',
      { classe: 'cartao' },
      el('div', { classe: 'cartao__titulo', texto: 'O que já rolou' }),
      historico
    ),
    el('div', { classe: 'cartao' }, el('div', { classe: 'cartao__titulo', texto: 'Times' }), elenco),
    cartaoTempo
  );

  return {
    no,
    atualizar(estado) {
      const { partida, voce, config, jogadores } = estado;
      const souDaVez = voce.time === partida.vez;
      const souMestre = voce.funcao === FUNCOES.MESTRE;
      const mestreDaVez = jogadores.find(
        (j) => j.time === partida.vez && j.funcao === FUNCOES.MESTRE
      );

      vezTexto.textContent = config.nomes[partida.vez];
      vezSub.textContent =
        partida.fase === 'dica'
          ? `${mestreDaVez?.nome ?? `O ${ROTULO_FUNCAO.mestre}`} está escolhendo a dica`
          : `${plural(partida.dica?.palpitesRestantes ?? 0, 'palpite restante', 'palpites restantes')}`;

      // Formulário de dica: só para o mestre do time da vez, e só antes da dica.
      const podeDarDica = souMestre && souDaVez && partida.fase === 'dica';
      formularioDica.classList.toggle('oculto', !podeDarDica);
      if (podeDarDica && document.activeElement === document.body) campoPalavra.focus();

      const temDica = partida.fase === 'palpite' && partida.dica;
      dicaAtual.classList.toggle('oculto', !temDica);
      if (temDica) {
        dicaPalavra.textContent = partida.dica.palavra;
        dicaNumero.textContent = String(partida.dica.numero);
        dicaRestantes.textContent = plural(
          partida.dica.palpitesRestantes,
          'palpite restante',
          'palpites restantes'
        );
      }

      cartaoTempo.classList.toggle('oculto', !voce.anfitriao);
      if (voce.anfitriao) controleTempo.atualizar(config.duracaoTurno, true);

      atualizarEncerrar(botaoEncerrar, estado, souDaVez);
      preencher(historico, ...linhasDoHistorico(partida, config));
      preencher(elenco, ...blocosDoElenco(jogadores, config, voce));
    }
  };
}

/** Botão de passar a vez, com a contagem de votos quando o modo é consenso. */
function atualizarEncerrar(botao, estado, souDaVez) {
  const { partida, voce, config, jogadores } = estado;
  const podeEncerrar =
    souDaVez && voce.funcao === FUNCOES.OPERATIVO && partida.fase === 'palpite';

  botao.classList.toggle('oculto', !podeEncerrar);
  if (!podeEncerrar) return;

  if (config.modoRevelacao === MODO_REVELACAO.LIVRE) {
    botao.textContent = 'Encerrar turno';
    return;
  }

  const operativos = jogadores.filter(
    (j) => j.conectado && j.time === partida.vez && j.funcao === FUNCOES.OPERATIVO
  ).length;
  const votos = partida.votosEncerrar.length;
  const euVotei = partida.votosEncerrar.includes(voce.id);

  botao.textContent =
    operativos > 1
      ? `${euVotei ? 'Cancelar' : 'Encerrar turno'} (${votos}/${operativos})`
      : 'Encerrar turno';
}

/** Histórico do mais recente para o mais antigo, cortado no que cabe na tela. */
function linhasDoHistorico(partida, config) {
  const itens = [...partida.historico].reverse().slice(0, 14);

  if (itens.length === 0) {
    return [el('div', { classe: 'historico__vazio', texto: 'A partida acabou de começar.' })];
  }

  return itens.map((item) => {
    const classe = `historico__item historico__item--${item.time}`;

    if (item.tipo === 'dica') {
      return el(
        'div',
        { classe },
        el('span', { classe: 'historico__palavra', texto: item.palavra }),
        el('span', { classe: 'historico__nota', texto: `dica para ${item.numero}` })
      );
    }

    if (item.tipo === 'revelacao') {
      return el(
        'div',
        { classe },
        el('span', { classe: 'historico__palavra', texto: item.palavra }),
        el('span', {
          classe: 'historico__nota',
          texto: ROTULO_RESULTADO[item.resultado] ?? item.cor
        })
      );
    }

    return el(
      'div',
      { classe },
      el('span', { texto: config.nomes[item.time] ?? 'O time' }),
      el('span', {
        classe: 'historico__nota',
        texto: item.motivo === 'tempo' ? 'tempo esgotado' : 'passou a vez'
      })
    );
  });
}

/** Quem está em cada time, com o mestre destacado e os ausentes esmaecidos. */
function blocosDoElenco(jogadores, config, voce) {
  const assistindo = jogadores.filter((j) => j.funcao === FUNCOES.ESPECTADOR);

  const times = ['vermelho', 'azul'].map((time) => {
    const doTime = jogadores
      .filter((j) => j.time === time)
      // Mestre primeiro: é a informação que mais se procura durante a partida.
      .sort((a, b) => (a.funcao === FUNCOES.MESTRE ? -1 : 0) - (b.funcao === FUNCOES.MESTRE ? -1 : 0));

    return el(
      'div',
      { classe: `elenco__time elenco__time--${time}` },
      el('div', { classe: 'elenco__nome', texto: config.nomes[time] }),
      el(
        'div',
        { classe: 'elenco__lista' },
        ...doTime.map((j) =>
          el('span', {
            classe: 'elenco__pessoa',
            texto: j.id === voce.id ? `${j.nome} (você)` : j.nome,
            title: ROTULO_FUNCAO[j.funcao] ?? '',
            dados: {
              mestre: j.funcao === FUNCOES.MESTRE ? 'sim' : 'nao',
              ausente: j.conectado ? 'nao' : 'sim'
            }
          })
        )
      )
    );
  });

  if (assistindo.length === 0) return times;

  return [
    ...times,
    el(
      'div',
      { classe: 'elenco__time elenco__time--plateia' },
      el('div', { classe: 'elenco__nome', texto: 'Assistindo' }),
      el(
        'div',
        { classe: 'elenco__lista' },
        ...assistindo.map((j) =>
          el('span', {
            classe: 'elenco__pessoa',
            texto: j.id === voce.id ? `${j.nome} (você)` : j.nome,
            dados: { ausente: j.conectado ? 'nao' : 'sim' }
          })
        )
      )
    )
  ];
}
