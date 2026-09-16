/**
 * Uma carta do tabuleiro.
 *
 * Duas faces num cartão 3D: a frente com a palavra, o verso com a cor do
 * agente. Virar é só acrescentar a classe `revelada` — o CSS cuida do giro.
 */

import { el, icone } from '../ui.js';
import { iniciais } from '/shared/protocolo.js';

/** Qual selo aparece no verso de cada cor. */
const ICONE_DO_TIPO = {
  vermelho: 'agente',
  azul: 'agente',
  neutra: 'neutro',
  assassino: 'caveira'
};

export function criarCarta(indice, aoClicar) {
  const palavraFrente = el('span', { classe: 'carta__palavra' });
  const palavraVerso = el('span', { classe: 'carta__palavra' });
  const votos = el('span', { classe: 'carta__votos' });

  // Selo que avisa o mestre-espião sobre o assassino antes de a carta virar.
  const avisoAssassino = icone('caveira', 'carta__icone carta__icone--dica');

  const frente = el(
    'span',
    { classe: 'carta__face carta__face--frente' },
    palavraFrente,
    votos,
    avisoAssassino
  );

  const verso = el('span', { classe: 'carta__face carta__face--verso' }, palavraVerso);

  const no = el(
    'button',
    {
      classe: 'carta',
      type: 'button',
      ao: { click: () => aoClicar(indice) }
    },
    el('span', { classe: 'carta__interna' }, frente, verso)
  );

  let tipoDesenhado = null;

  return {
    no,

    atualizar(carta, { podeClicar, meuId }) {
      palavraFrente.textContent = carta.palavra;
      palavraVerso.textContent = carta.palavra;

      if (carta.tipo) no.dataset.tipo = carta.tipo;
      else delete no.dataset.tipo;

      // O selo do verso só é recriado quando a cor muda de fato.
      if (carta.tipo !== tipoDesenhado) {
        tipoDesenhado = carta.tipo;
        verso.querySelector('svg')?.remove();
        if (carta.tipo) verso.append(icone(ICONE_DO_TIPO[carta.tipo], 'carta__icone'));
      }

      no.classList.toggle('revelada', carta.revelada);
      no.disabled = carta.revelada || !podeClicar;
      no.setAttribute(
        'aria-label',
        carta.revelada ? `${carta.palavra} — carta ${carta.tipo}` : carta.palavra
      );

      desenharVotos(votos, no, carta.votos ?? [], meuId);
    }
  };
}

/** As iniciais de quem votou nesta carta, mais o anel de destaque. */
function desenharVotos(container, no, lista, meuId) {
  no.classList.toggle('com-voto', lista.length > 0);

  // Reescrever só quando a lista muda evita reiniciar a animação das marcas.
  const assinatura = lista.map((v) => v.id).join(',');
  if (container.dataset.assinatura === assinatura) return;
  container.dataset.assinatura = assinatura;

  container.replaceChildren(
    ...lista.map((votante) =>
      el('span', {
        classe: `voto ${votante.id === meuId ? 'voto--eu' : ''}`,
        texto: iniciais(votante.nome),
        title: votante.nome
      })
    )
  );
}
