/**
 * A loja, estilo CS2: categorias com preços, aberta com B durante o freeze.
 * O servidor é quem valida tudo — o menu só mostra e pede.
 */

import { ARMAS, CATEGORIAS, EQUIPAMENTOS, ROTULO_CATEGORIA } from '../../shared/armas.js';

function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

export function criarMenuCompra(container, { aoComprar, aoFechar }) {
  const raiz = el('div', 'menu-compra escondido');
  container.appendChild(raiz);

  const cabecalho = el('div', 'cabecalho');
  cabecalho.appendChild(el('h2', '', 'LOJA'));
  const dinheiro = el('div', 'dinheiro', '$0');
  cabecalho.appendChild(dinheiro);

  const corpo = el('div', 'corpo');
  const rodape = el('div', 'rodape');
  rodape.append(
    el('span', '', 'Compras valem só durante o freeze time, dentro da sua base.'),
    el('span', '', 'B fecha a loja')
  );

  raiz.append(cabecalho, corpo, rodape);

  let euAtual = null;

  function botaoItem(id, nome, detalhe, preco) {
    const botao = el('button', 'item-compra');
    const info = el('div');
    info.append(el('div', 'nome', nome), el('div', 'detalhe', detalhe));
    botao.append(info, el('div', 'preco', preco === 0 ? 'GRÁTIS' : `$${preco}`));
    botao.addEventListener('click', () => aoComprar(id));
    return botao;
  }

  function reconstruir() {
    corpo.innerHTML = '';
    const eu = euAtual;

    // Colunas: armas por categoria + equipamentos.
    const porCategoria = new Map();
    for (const arma of Object.values(ARMAS)) {
      if (!porCategoria.has(arma.categoria)) porCategoria.set(arma.categoria, []);
      porCategoria.get(arma.categoria).push(arma);
    }

    const ordem = [CATEGORIAS.PISTOLA, CATEGORIAS.SHOTGUN, CATEGORIAS.SMG, CATEGORIAS.RIFLE, CATEGORIAS.SNIPER];
    for (const categoria of ordem) {
      const bloco = el('div', 'categoria-compra');
      bloco.appendChild(el('h3', '', ROTULO_CATEGORIA[categoria]));
      for (const arma of porCategoria.get(categoria) ?? []) {
        if (arma.preco === 0) continue; // a PM-9 já vem de graça
        const detalhe = `${arma.dano}${arma.pellets > 1 ? `×${arma.pellets}` : ''} dano · ${arma.rpm} RPM`;
        const botao = botaoItem(arma.id, arma.nome, detalhe, arma.preco);
        if (eu) {
          const jaTem = eu.armas[arma.slot]?.id === arma.id;
          botao.disabled = arma.preco > eu.dinheiro || jaTem;
          botao.classList.toggle('comprado', jaTem);
        }
        bloco.appendChild(botao);
      }
      corpo.appendChild(bloco);
    }

    const equipamentos = el('div', 'categoria-compra');
    equipamentos.appendChild(el('h3', '', 'Equipamento'));
    const detalhes = {
      colete: 'Absorve 40% do dano no corpo',
      capacete: 'Colete novo + proteção de headshot',
      granada: 'Explosiva · máx. 2',
      blocos: 'Construa cobertura · máx. 30'
    };
    for (const eq of Object.values(EQUIPAMENTOS)) {
      const botao = botaoItem(eq.id, eq.nome, detalhes[eq.id] ?? '', eq.preco);
      if (eu) {
        let bloqueado = eq.preco > eu.dinheiro;
        if (eq.id === 'colete' && eu.colete >= 100) bloqueado = true;
        if (eq.id === 'capacete' && eu.capacete && eu.colete >= 100) bloqueado = true;
        if (eq.id === 'granada' && eu.granadas >= EQUIPAMENTOS.granada.maximo) bloqueado = true;
        if (eq.id === 'blocos' && eu.blocos + EQUIPAMENTOS.blocos.quantidade > EQUIPAMENTOS.blocos.maximo) {
          bloqueado = true;
        }
        botao.disabled = bloqueado;
      }
      equipamentos.appendChild(botao);
    }
    corpo.appendChild(equipamentos);
  }

  function abrir(eu) {
    euAtual = eu;
    dinheiro.textContent = `$${eu?.dinheiro ?? 0}`;
    reconstruir();
    raiz.classList.remove('escondido');
  }

  function atualizar(eu) {
    if (raiz.classList.contains('escondido')) return;
    euAtual = eu;
    dinheiro.textContent = `$${eu?.dinheiro ?? 0}`;
    reconstruir();
  }

  function fechar() {
    raiz.classList.add('escondido');
    if (aoFechar) aoFechar();
  }

  return {
    abrir,
    fechar,
    atualizar,
    get aberto() {
      return !raiz.classList.contains('escondido');
    },
    destruir() {
      raiz.remove();
    }
  };
}
