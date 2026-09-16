/**
 * Tela de fim de partida: placar final, tabela de kills e o caminho de volta
 * ao lobby (anfitrião) ou a espera (demais).
 */

import { TIMES, ROTULO_TIME } from '../../../shared/constantes.js';

function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

export function telaFim(container, dados, meuTime, souAnfitriao, { aoVoltar, aoSair }) {
  container.innerHTML = '';
  const tela = el('div', 'tela');
  const cartao = el('div', 'cartao largo');

  const venceu = meuTime && dados.vencedor === meuTime;
  cartao.appendChild(
    el(
      'div',
      'fim-titulo',
      dados.vencedor ? `${ROTULO_TIME[dados.vencedor]} venceu!${venceu ? ' 🏆' : ''}` : 'Partida encerrada'
    )
  );

  const placar = el('div', 'fim-placar');
  placar.appendChild(el('span', 'azul', String(dados.placar[TIMES.AZUL])));
  placar.appendChild(el('span', '', '×'));
  placar.appendChild(el('span', 'vermelho', String(dados.placar[TIMES.VERMELHO])));
  cartao.appendChild(placar);

  const tabela = el('table', 'tabela-final');
  const cabecalho = el('tr');
  for (const titulo of ['Jogador', 'Time', 'Kills', 'Mortes']) {
    cabecalho.appendChild(el('th', titulo === 'Jogador' || titulo === 'Time' ? '' : 'num', titulo));
  }
  tabela.appendChild(cabecalho);
  const ordenados = [...dados.jogadores].sort((a, b) => b.kills - a.kills);
  for (const jogador of ordenados) {
    const linha = el('tr');
    linha.appendChild(el('td', '', jogador.nome));
    linha.appendChild(
      el('td', jogador.time === TIMES.AZUL ? 'cor-azul' : 'cor-vermelho', jogador.time === TIMES.AZUL ? 'Azul' : 'Vermelho')
    );
    linha.appendChild(el('td', 'num', String(jogador.kills)));
    linha.appendChild(el('td', 'num', String(jogador.mortes)));
    tabela.appendChild(linha);
  }
  cartao.appendChild(tabela);

  const linhaBotoes = el('div', 'linha');
  const botaoVoltar = el('button', 'primario', souAnfitriao ? 'Voltar ao lobby' : 'Aguardando o anfitrião…');
  botaoVoltar.disabled = !souAnfitriao;
  botaoVoltar.addEventListener('click', aoVoltar);
  const botaoSair = el('button', '', 'Sair da sala');
  botaoSair.addEventListener('click', aoSair);
  linhaBotoes.append(botaoVoltar, botaoSair);
  cartao.appendChild(linhaBotoes);

  tela.appendChild(cartao);
  container.appendChild(tela);
}
