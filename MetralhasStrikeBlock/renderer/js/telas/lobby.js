/**
 * Lobby da sala: colunas Azul e Vermelho, quem ainda não escolheu, e o botão
 * de iniciar (só o anfitrião).
 */

import {
  DURACOES_COMBATE,
  DURACOES_COMPRA,
  ROTULO_TIME,
  TEMPOS,
  TIMES
} from '../../../shared/constantes.js';
import { iniciais } from '../../../shared/protocolo.js';

function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

function itemJogador(jogador, meuId, anfitriaoId) {
  const item = el('div', 'jogador-item' + (jogador.conectado ? '' : ' desconectado'));
  const avatar = el('div', 'avatar');
  if (jogador.avatar) {
    const img = document.createElement('img');
    img.src = jogador.avatar;
    img.alt = '';
    avatar.appendChild(img);
  } else {
    avatar.textContent = iniciais(jogador.nome);
  }
  item.appendChild(avatar);
  item.appendChild(el('span', '', jogador.nome));
  if (jogador.id === anfitriaoId) item.appendChild(el('span', 'anfitriao', '👑'));
  if (jogador.id === meuId) item.appendChild(el('span', 'voce', 'você'));
  if (!jogador.conectado) item.appendChild(el('span', 'voce', 'fora'));
  return item;
}

/**
 * Uma linha de atalhos de duração. Só o anfitrião mexe; os outros veem o
 * valor escolhido, para saberem em que partida estão entrando.
 */
function linhaDeTempo(rotulo, valorAtual, opcoes, souAnfitriao, aoEscolher) {
  const bloco = el('div', 'campo');
  bloco.appendChild(el('label', '', rotulo));
  const linha = el('div', 'linha');

  for (const segundos of opcoes) {
    const escolhido = segundos === valorAtual;
    const botao = el('button', escolhido ? 'primario' : '', `${segundos}s`);
    botao.disabled = !souAnfitriao;
    if (!escolhido) botao.addEventListener('click', () => aoEscolher(segundos));
    linha.appendChild(botao);
  }

  // Valor fora dos atalhos (veio digitado antes) ainda precisa aparecer.
  if (!opcoes.includes(valorAtual)) {
    const marca = el('button', 'primario', `${valorAtual}s`);
    marca.disabled = true;
    linha.appendChild(marca);
  }

  bloco.appendChild(linha);
  return bloco;
}

export function telaLobby(container, estado, meuId, { aoEscolherTime, aoIniciar, aoSair, aoConfigurar }) {
  container.innerHTML = '';
  const tela = el('div', 'tela');
  const cartao = el('div', 'cartao largo');

  const cabecalho = el('div', 'lobby-cabecalho');
  const bloco = el('div');
  bloco.appendChild(el('div', 'nota', 'Código da sala — passe para os amigos'));
  bloco.appendChild(el('div', 'lobby-codigo', estado.codigo));
  cabecalho.appendChild(bloco);
  const botaoSair = el('button', '', 'Sair da sala');
  botaoSair.addEventListener('click', aoSair);
  cabecalho.appendChild(botaoSair);
  cartao.appendChild(cabecalho);

  const times = el('div', 'lobby-times');
  for (const time of [TIMES.AZUL, TIMES.VERMELHO]) {
    const coluna = el('div', `time-coluna ${time}`);
    coluna.appendChild(el('h3', '', ROTULO_TIME[time]));
    for (const jogador of estado.jogadores.filter((j) => j.time === time)) {
      coluna.appendChild(itemJogador(jogador, meuId, estado.anfitriaoId));
    }
    const botao = el('button', '', `Jogar de ${time === TIMES.AZUL ? 'Azul' : 'Vermelho'}`);
    botao.addEventListener('click', () => aoEscolherTime(time));
    coluna.appendChild(botao);
    times.appendChild(coluna);
  }
  cartao.appendChild(times);

  const semTime = estado.jogadores.filter((j) => !j.time);
  if (semTime.length > 0) {
    cartao.appendChild(el('div', 'nota', 'Ainda escolhendo lado:'));
    const fila = el('div', 'sem-time');
    for (const jogador of semTime) fila.appendChild(itemJogador(jogador, meuId, estado.anfitriaoId));
    cartao.appendChild(fila);
  }

  cartao.appendChild(el('div', 'separador'));

  const souAnfitriao = meuId === estado.anfitriaoId;

  // Tempos do round: quem manda na sala escolhe.
  const config = estado.config ?? { compra: TEMPOS.COMPRA, combate: TEMPOS.COMBATE };
  const tempos = el('div', 'lobby-tempos');
  tempos.appendChild(
    linhaDeTempo('Tempo de combate', config.combate, DURACOES_COMBATE, souAnfitriao, (s) =>
      aoConfigurar({ combate: s })
    )
  );
  tempos.appendChild(
    linhaDeTempo('Tempo de compra', config.compra, DURACOES_COMPRA, souAnfitriao, (s) =>
      aoConfigurar({ compra: s })
    )
  );
  cartao.appendChild(tempos);
  if (!souAnfitriao) {
    cartao.appendChild(el('div', 'nota', 'Só o anfitrião muda os tempos do round.'));
  }
  cartao.appendChild(el('div', 'separador'));
  const botaoIniciar = el('button', 'primario', souAnfitriao ? 'Iniciar partida' : 'Aguardando o anfitrião…');
  botaoIniciar.disabled = !souAnfitriao;
  botaoIniciar.addEventListener('click', aoIniciar);
  cartao.appendChild(botaoIniciar);
  cartao.appendChild(el('div', 'nota', 'Primeiro time a vencer 8 rounds ganha · troca de lado no round 7'));

  tela.appendChild(cartao);
  container.appendChild(tela);
}
