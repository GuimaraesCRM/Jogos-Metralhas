/**
 * Controle do tempo por turno, compartilhado entre o lobby e a tela de jogo.
 *
 * Quatro atalhos mais um campo livre. O campo livre existe porque cada grupo
 * tem um ritmo: 45 segundos para quem é rápido, 5 minutos para quem gosta de
 * discutir cada palavra. Só o anfitrião mexe, e a mudança vale do próximo
 * turno em diante — menos "sem tempo", que desliga o relógio na hora.
 */

import { el, formatarTempo } from '../ui.js';
import { enviar } from '../net.js';
import { DO_CLIENTE, DURACOES_TURNO, LIMITE_TURNO } from '/shared/protocolo.js';

const ROTULO = { 0: 'Sem tempo', 60: '60s', 90: '90s', 120: '120s' };

export function criarControleDeTempo() {
  const definir = (segundos) => enviar(DO_CLIENTE.CONFIGURAR, { duracaoTurno: segundos });

  const atalhos = DURACOES_TURNO.map((segundos) =>
    el('button', {
      classe: 'opcoes__item',
      type: 'button',
      texto: ROTULO[segundos],
      'aria-pressed': 'false',
      ao: { click: () => definir(segundos) }
    })
  );

  const botaoOutro = el('button', {
    classe: 'opcoes__item',
    type: 'button',
    texto: 'Outro',
    'aria-pressed': 'false',
    ao: { click: () => alternarLivre(true) }
  });

  const campoLivre = el('input', {
    classe: 'entrada',
    type: 'number',
    min: LIMITE_TURNO.MINIMO,
    max: LIMITE_TURNO.MAXIMO,
    step: 5,
    value: 180,
    ao: {
      keydown: (e) => {
        if (e.key === 'Enter') aplicarLivre();
      }
    }
  });

  const botaoAplicar = el('button', {
    classe: 'botao botao--pequeno',
    texto: 'Aplicar',
    ao: { click: aplicarLivre }
  });

  const blocoLivre = el(
    'div',
    { classe: 'tempo__livre oculto' },
    campoLivre,
    el('span', { classe: 'tempo__unidade', texto: 'seg' }),
    botaoAplicar
  );

  function aplicarLivre() {
    definir(Number(campoLivre.value));
  }

  function alternarLivre(mostrar) {
    blocoLivre.classList.toggle('oculto', !mostrar);
    if (mostrar) campoLivre.focus();
  }

  const no = el(
    'div',
    { classe: 'tempo' },
    el('div', { classe: 'opcoes' }, ...atalhos, botaoOutro),
    blocoLivre
  );

  return {
    no,
    atualizar(duracao, souAnfitriao) {
      const ehAtalho = DURACOES_TURNO.includes(duracao);

      atalhos.forEach((botao, i) => {
        botao.setAttribute('aria-pressed', String(DURACOES_TURNO[i] === duracao));
        botao.disabled = !souAnfitriao;
      });

      botaoOutro.setAttribute('aria-pressed', String(!ehAtalho));
      botaoOutro.textContent = ehAtalho ? 'Outro' : formatarTempo(duracao);
      botaoOutro.disabled = !souAnfitriao;

      campoLivre.disabled = !souAnfitriao;
      botaoAplicar.disabled = !souAnfitriao;

      // Um valor fora dos atalhos precisa ficar à vista, senão a pessoa não
      // entende de onde veio o "3:00" no botão.
      if (!ehAtalho) {
        blocoLivre.classList.remove('oculto');
        if (document.activeElement !== campoLivre) campoLivre.value = String(duracao);
      } else if (!souAnfitriao) {
        blocoLivre.classList.add('oculto');
      }
    }
  };
}
