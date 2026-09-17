/**
 * A loja, estilo CS2: categorias com preços, aberta com B durante o freeze.
 * O servidor é quem valida tudo — o menu só mostra e pede.
 *
 * Os botões são criados UMA vez e depois só têm o estado atualizado. Recriar o
 * DOM a cada foto do servidor (20×/s) engolia os cliques: um `click` exige que
 * mousedown e mouseup caiam no mesmo elemento, e o botão era destruído entre
 * os dois.
 */

import { ARMAS, CATEGORIAS, EQUIPAMENTOS, ROTULO_CATEGORIA } from '../../shared/armas.js';
import { PARTIDA } from '../../shared/constantes.js';

function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

const DETALHE_EQUIPAMENTO = {
  colete: 'Absorve 40% do dano no corpo',
  capacete: 'Colete novo + proteção de headshot',
  granada: 'Explosiva · máx. 2',
  blocos: 'Construa cobertura · máx. 30'
};

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

  /** id do item -> { botao, estado(eu) => ({ bloqueado, comprado }) } */
  const itens = new Map();

  function criarBotao(id, nome, detalhe, preco, estado) {
    const botao = el('button', 'item-compra');
    const info = el('div');
    info.append(el('div', 'nome', nome), el('div', 'detalhe', detalhe));
    botao.append(info, el('div', 'preco', preco === 0 ? 'GRÁTIS' : `$${preco}`));
    botao.addEventListener('click', () => aoComprar(id));
    itens.set(id, { botao, estado });
    return botao;
  }

  // ---- montagem única -------------------------------------------------------

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
      bloco.appendChild(
        criarBotao(arma.id, arma.nome, detalhe, arma.preco, (eu) => {
          const comprado = eu.armas[arma.slot]?.id === arma.id;
          return { comprado, bloqueado: comprado || arma.preco > eu.dinheiro };
        })
      );
    }
    corpo.appendChild(bloco);
  }

  const equipamentos = el('div', 'categoria-compra');
  equipamentos.appendChild(el('h3', '', 'Equipamento'));
  for (const eq of Object.values(EQUIPAMENTOS)) {
    equipamentos.appendChild(
      criarBotao(eq.id, eq.nome, DETALHE_EQUIPAMENTO[eq.id] ?? '', eq.preco, (eu) => {
        let comprado = false;
        if (eq.id === 'colete') comprado = eu.colete >= PARTIDA.COLETE_MAXIMO && !eu.capacete;
        else if (eq.id === 'capacete') comprado = eu.capacete && eu.colete >= PARTIDA.COLETE_MAXIMO;
        else if (eq.id === 'granada') comprado = eu.granadas >= EQUIPAMENTOS.granada.maximo;
        else if (eq.id === 'blocos') {
          comprado = eu.blocos + EQUIPAMENTOS.blocos.quantidade > EQUIPAMENTOS.blocos.maximo;
        }
        return { comprado, bloqueado: comprado || eq.preco > eu.dinheiro };
      })
    );
  }
  corpo.appendChild(equipamentos);

  // ---- atualização de estado (sem tocar na estrutura) ------------------------

  function refletir(eu) {
    dinheiro.textContent = `$${eu?.dinheiro ?? 0}`;
    if (!eu) return;
    for (const { botao, estado } of itens.values()) {
      const { bloqueado, comprado } = estado(eu);
      // Só escreve quando muda: mexer no DOM à toa também custa caro.
      if (botao.disabled !== bloqueado) botao.disabled = bloqueado;
      botao.classList.toggle('comprado', comprado);
    }
  }

  function abrir(eu) {
    refletir(eu);
    raiz.classList.remove('escondido');
  }

  function atualizar(eu) {
    if (raiz.classList.contains('escondido')) return;
    refletir(eu);
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
