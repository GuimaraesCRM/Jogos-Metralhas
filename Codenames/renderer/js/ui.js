/**
 * Ajudantes de interface: criação de elementos, ícones e avisos.
 *
 * Não há framework aqui. Para um jogo de uma tela e vinte e cinco cartas, um
 * punhado de funções sobre o DOM sai mais leve e mais previsível — e mantém o
 * app abrindo instantaneamente, sem passo de build.
 */

/**
 * Cria um elemento. As propriedades viram atributos, com três atalhos:
 * `classe`, `texto` e `ao` (ouvintes de evento).
 *
 *   el('button', { classe: 'botao', texto: 'Jogar', ao: { click: jogar } })
 */
export function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);

  for (const [chave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;

    if (chave === 'classe') no.className = valor;
    else if (chave === 'texto') no.textContent = valor;
    else if (chave === 'html') no.innerHTML = valor;
    else if (chave === 'ao') {
      for (const [evento, fn] of Object.entries(valor)) no.addEventListener(evento, fn);
    } else if (chave === 'dados') {
      for (const [d, v] of Object.entries(valor)) if (v !== null) no.dataset[d] = v;
    } else if (chave in no && chave !== 'list') {
      no[chave] = valor;
    } else {
      no.setAttribute(chave, valor);
    }
  }

  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }

  return no;
}

/** Troca todo o conteúdo de um nó. */
export function preencher(no, ...filhos) {
  no.replaceChildren(...filhos.flat().filter(Boolean));
  return no;
}

/* ------------------------------------------------------------------ ícones */

const ICONES = {
  caveira:
    '<path d="M12 2C7.6 2 4 5.5 4 9.9c0 2.4 1.1 4.5 2.8 5.9.4.3.6.8.6 1.3V19a2 2 0 0 0 2 2h1v-2h1.2v2h1.6v-2H14v2h1a2 2 0 0 0 2-2v-1.9c0-.5.2-1 .6-1.3 1.7-1.4 2.8-3.5 2.8-5.9C20 5.5 16.4 2 12 2Zm-3.2 8.4a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm6.4 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM12 14.6l1 2h-2l1-2Z"/>',
  agente:
    '<path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.4 0 8 2.2 8 4.9V21H4v-3.1C4 15.2 7.6 13 12 13Z"/>',
  relogio:
    '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.3l3.6 2.1-1 1.7L11 13.4V7h2Z"/>',
  copiar:
    '<path d="M9 2h9a2 2 0 0 1 2 2v12h-2V4H9V2Zm-4 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/>',
  coroa: '<path d="M3 17h18l1.4-9.4-5.1 3.4L12 3 6.7 11 1.6 7.6 3 17Zm0 2v2h18v-2H3Z"/>',
  neutro: '<path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-5 7h10v2H7v-2Z"/>',
  minimizar: '<path d="M5 11h14v2H5z"/>',
  maximizar: '<path d="M5 5h14v14H5V5Zm2 2v10h10V7H7Z"/>',
  restaurar: '<path d="M8 3h13v13h-3v-2h1V5H10v1H8V3Zm-5 5h13v13H3V8Zm2 2v9h9v-9H5Z"/>',
  fechar: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5Z"/>'
};

/** Devolve um <svg> pronto para injetar. */
export function icone(nome, classe = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  if (classe) svg.setAttribute('class', classe);
  svg.innerHTML = ICONES[nome] ?? '';
  return svg;
}

/* ------------------------------------------------------------------ avisos */

const containerAvisos = () => document.getElementById('avisos');

/** Mensagem passageira no rodapé. Erros do servidor chegam por aqui. */
export function aviso(mensagem, tipo = 'erro') {
  const caixa = containerAvisos();
  if (!caixa) return;

  const no = el('div', { classe: `aviso ${tipo === 'info' ? 'aviso--info' : ''}`, texto: mensagem });
  caixa.append(no);

  setTimeout(() => {
    no.classList.add('aviso--saindo');
    no.addEventListener('animationend', () => no.remove(), { once: true });
  }, 3400);
}

/* ------------------------------------------------------------------ apoio */

/** "1:30", "0:07" — o formato que se lê de relance num relógio de turno. */
export function formatarTempo(segundos) {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Plural sem drama: `plural(1, 'carta', 'cartas')`. */
export function plural(n, singular, plural_) {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/** O logo, usado na entrada (grande) e no cabeçalho do jogo (pequeno). */
export function logo(tamanho = 'grande') {
  return el(
    'div',
    { classe: `logo logo--${tamanho}` },
    el('div', { classe: 'logo__titulo', texto: 'Palavras Secretas' }),
    el('div', { classe: 'logo__linha', texto: 'jogo de espionagem' })
  );
}
