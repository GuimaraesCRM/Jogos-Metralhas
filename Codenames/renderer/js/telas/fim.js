/**
 * Fim de partida.
 *
 * Fica por cima da tela de jogo em vez de substituí-la: o tabuleiro continua
 * atrás, agora com todas as cores abertas, que é justamente a hora em que o
 * pessoal quer ver o que quase clicou.
 */

import { el, icone } from '../ui.js';
import { enviar, sair } from '../net.js';
import { DO_CLIENTE } from '/shared/protocolo.js';

export function criarTelaFim() {
  const faixa = el('div', { classe: 'fim__faixa', texto: 'fim de partida' });
  const vencedor = el('h2', { classe: 'fim__vencedor' });
  const motivo = el('p', { classe: 'fim__motivo' });
  const caveira = icone('caveira', 'fim__caveira oculto');

  const botaoNova = el('button', {
    classe: 'botao botao--principal',
    texto: 'Nova partida',
    ao: { click: () => enviar(DO_CLIENTE.NOVA_PARTIDA) }
  });

  const botaoLobby = el('button', {
    classe: 'botao',
    texto: 'Voltar ao lobby',
    ao: { click: () => enviar(DO_CLIENTE.VOLTAR_AO_LOBBY) }
  });

  const botaoSair = el('button', {
    classe: 'botao botao--fantasma',
    texto: 'Sair',
    ao: { click: sair }
  });

  const caixa = el(
    'div',
    { classe: 'fim__caixa' },
    caveira,
    faixa,
    vencedor,
    motivo,
    el('div', { classe: 'fim__acoes' }, botaoNova, botaoLobby, botaoSair)
  );

  const no = el('div', { classe: 'fim' }, caixa);

  return {
    no,
    atualizar(loja) {
      const { partida, config, voce } = loja.estado ?? {};
      if (!partida?.vencedor) return;

      const ganhou = voce.time === partida.vencedor;
      caixa.className = `fim__caixa fim--${partida.vencedor}`;
      caixa.classList.add(`fim--${partida.vencedor}`);
      no.className = `fim fim--${partida.vencedor}`;

      faixa.textContent = ganhou ? 'vocês venceram' : 'fim de partida';
      vencedor.textContent = config.nomes[partida.vencedor];

      const porAssassino = partida.motivo === 'assassino';
      caveira.classList.toggle('oculto', !porAssassino);
      motivo.textContent = porAssassino
        ? 'O time adversário virou a carta do assassino. Fim imediato.'
        : 'Todas as cartas do time foram encontradas.';

      // Só o anfitrião controla o que acontece depois da partida.
      botaoNova.disabled = !voce.anfitriao;
      botaoLobby.disabled = !voce.anfitriao;
      botaoNova.title = voce.anfitriao ? '' : 'Só quem criou a sala pode começar outra partida';
    }
  };
}
