/**
 * Barra de título do app.
 *
 * O jogo roda em janela sem moldura, então quem desenha os botões de
 * minimizar, maximizar e fechar somos nós. A vantagem é que a janela inteira
 * fica com a cara do jogo, sem a barra cinza do sistema por cima.
 *
 * Toda a área é arrastável (`-webkit-app-region: drag`), menos os botões — daí
 * o `no-drag` neles, sem o qual não dá nem para clicar.
 */

import { el, icone } from './ui.js';

const janela = () => window.appDesktop?.janela;

export function criarBarraDeTitulo() {
  const botaoMaximizar = el('button', {
    classe: 'barra__botao',
    type: 'button',
    title: 'Maximizar',
    'aria-label': 'Maximizar',
    ao: { click: () => janela()?.alternarMaximizar() }
  }, icone('maximizar'));

  const no = el(
    'div',
    { classe: 'barra' },
    el(
      'div',
      { classe: 'barra__marca' },
      el('span', { classe: 'barra__selo', texto: 'PS' }),
      el('span', { classe: 'barra__nome', texto: 'Palavras Secretas' })
    ),
    el(
      'div',
      { classe: 'barra__controles' },
      el('button', {
        classe: 'barra__botao',
        type: 'button',
        title: 'Minimizar',
        'aria-label': 'Minimizar',
        ao: { click: () => janela()?.minimizar() }
      }, icone('minimizar')),
      botaoMaximizar,
      el('button', {
        classe: 'barra__botao barra__botao--fechar',
        type: 'button',
        title: 'Fechar',
        'aria-label': 'Fechar',
        ao: { click: () => janela()?.fechar() }
      }, icone('fechar'))
    )
  );

  function refletirMaximizacao(maximizada) {
    no.dataset.maximizada = maximizada ? 'sim' : 'nao';
    botaoMaximizar.title = maximizada ? 'Restaurar' : 'Maximizar';
    botaoMaximizar.setAttribute('aria-label', botaoMaximizar.title);
    botaoMaximizar.replaceChildren(icone(maximizada ? 'restaurar' : 'maximizar'));
  }

  // O `catch` importa: fora do app empacotado (num teste, ou se a ponte não
  // estiver disponível) a promessa falharia sem ninguém para tratá-la.
  janela()?.estaMaximizada().then(refletirMaximizacao).catch(() => refletirMaximizacao(false));
  janela()?.aoMudarMaximizacao(refletirMaximizacao);

  // Duplo clique na barra maximiza, como manda o costume do Windows.
  no.addEventListener('dblclick', (evento) => {
    if (evento.target.closest('.barra__botao')) return;
    janela()?.alternarMaximizar();
  });

  return no;
}
