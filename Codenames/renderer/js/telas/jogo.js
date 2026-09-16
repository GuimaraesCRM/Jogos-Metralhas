/**
 * Tela de jogo: cabeçalho com placar e relógio, tabuleiro 5x5 e painel lateral.
 *
 * As vinte e cinco cartas são criadas uma única vez e depois atualizadas no
 * lugar. Recriá-las a cada mensagem do servidor cancelaria a animação de virar
 * — e a virada é o melhor momento do jogo.
 */

import { el, logo, icone, preencher, formatarTempo, plural, aviso } from '../ui.js';
import { enviar, sair } from '../net.js';
import { DO_CLIENTE, FUNCOES, MODO_REVELACAO } from '/shared/protocolo.js';
import { criarCarta } from './carta.js';
import { criarPainel } from './painel.js';

export function criarTelaJogo() {
  // --- cabeçalho -----------------------------------------------------------

  const placar = {
    vermelho: el('span', { classe: 'placar__numero', texto: '9' }),
    azul: el('span', { classe: 'placar__numero', texto: '8' })
  };
  const nomesPlacar = {
    vermelho: el('span', { classe: 'placar__nome', texto: 'Time Vermelho' }),
    azul: el('span', { classe: 'placar__nome', texto: 'Time Azul' })
  };
  const caixasPlacar = {
    vermelho: el(
      'div',
      { classe: 'placar__time placar__time--vermelho' },
      placar.vermelho,
      nomesPlacar.vermelho
    ),
    azul: el('div', { classe: 'placar__time placar__time--azul' }, placar.azul, nomesPlacar.azul)
  };

  const valorRelogio = el('span', { classe: 'relogio__valor', texto: '--' });
  const relogio = el('div', { classe: 'relogio oculto' }, icone('relogio'), valorRelogio);

  const cabecalho = el(
    'header',
    { classe: 'cabecalho' },
    logo('pequeno'),
    el(
      'div',
      { classe: 'placar' },
      caixasPlacar.vermelho,
      el('span', { classe: 'placar__traco' }),
      caixasPlacar.azul
    ),
    el(
      'div',
      { classe: 'cabecalho__direita' },
      relogio,
      el('button', {
        classe: 'botao botao--pequeno botao--fantasma',
        texto: 'Sair',
        ao: { click: sair }
      })
    )
  );

  // --- tabuleiro -----------------------------------------------------------

  function clicarNaCarta(indice) {
    enviar(DO_CLIENTE.VOTAR_CARTA, { indice });
  }

  const cartas = Array.from({ length: 25 }, (_, i) => criarCarta(i, clicarNaCarta));
  const tabuleiro = el('div', { classe: 'tabuleiro' }, ...cartas.map((c) => c.no));

  // --- painel --------------------------------------------------------------

  const painel = criarPainel();

  const no = el(
    'div',
    { classe: 'tela-jogo' },
    cabecalho,
    el(
      'div',
      { classe: 'jogo__corpo' },
      el('div', { classe: 'jogo__tabuleiro' }, tabuleiro),
      painel.no
    )
  );

  // O relógio corre localmente entre as mensagens do servidor, senão ele só
  // andaria quando alguém jogasse. `desvio` corrige a diferença entre o relógio
  // desta máquina e o do servidor.
  let desvio = 0;
  let ultimoEstado = null;

  function desenharRelogio() {
    const partida = ultimoEstado?.partida;
    if (!partida?.turnoTerminaEm) {
      relogio.classList.add('oculto');
      return;
    }
    relogio.classList.remove('oculto');
    const restante = (partida.turnoTerminaEm - (Date.now() + desvio)) / 1000;
    valorRelogio.textContent = formatarTempo(restante);
    relogio.dataset.urgente = restante <= 10 ? 'sim' : 'nao';
  }

  const tique = setInterval(desenharRelogio, 250);

  return {
    no,
    destruir: () => clearInterval(tique),

    atualizar(loja) {
      const estado = loja.estado;
      if (!estado?.partida) return;
      ultimoEstado = estado;
      if (typeof estado.agora === 'number') desvio = estado.agora - Date.now();

      const { partida, voce, config } = estado;

      // A cor da vez tinge a interface inteira por herança de variável CSS.
      no.dataset.vez = partida.vez;

      for (const time of ['vermelho', 'azul']) {
        placar[time].textContent = String(partida.restantes[time]);
        nomesPlacar[time].textContent = config.nomes[time];
        caixasPlacar[time].dataset.ativo = partida.vez === time ? 'sim' : 'nao';
      }

      desenharRelogio();

      // O mestre-espião enxerga as cores; o operativo, não. Quem decide isso é
      // o servidor (as cores nem chegam aqui) — o atributo só muda o desenho.
      tabuleiro.dataset.modo = voce.funcao === FUNCOES.MESTRE ? 'mestre' : 'operativo';
      tabuleiro.dataset.fim = partida.fase === 'fim' ? 'sim' : 'nao';

      const podeClicar =
        voce.funcao === FUNCOES.OPERATIVO &&
        voce.time === partida.vez &&
        partida.fase === 'palpite';

      partida.cartas.forEach((carta, i) => {
        cartas[i].atualizar(carta, { podeClicar, meuId: voce.id });
      });

      painel.atualizar(estado);
    }
  };
}
