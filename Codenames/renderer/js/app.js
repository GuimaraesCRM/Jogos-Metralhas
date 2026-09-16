/**
 * Ponto de entrada da interface.
 *
 * Trabalho do arquivo: abrir a conexão, e a cada estado recebido decidir qual
 * tela deve estar na frente. A tela só é remontada quando muda de fato — dentro
 * dela, tudo é atualizado no lugar, para não interromper animações nem roubar o
 * foco de quem está digitando.
 */

import { loja, aoMudar } from './store.js';
import { conectar, aoEvento } from './net.js';
import { aviso } from './ui.js';
import { criarTelaEntrada } from './telas/entrada.js';
import { criarTelaLobby } from './telas/lobby.js';
import { criarTelaJogo } from './telas/jogo.js';
import { criarTelaFim } from './telas/fim.js';
import { criarBarraDeTitulo } from './barra-titulo.js';

const raiz = document.getElementById('raiz');

// Janela sem moldura: a barra de título é desenhada pelo próprio app e fica
// acima de #raiz, presente em todas as telas.
document.body.prepend(criarBarraDeTitulo());

const FABRICAS = {
  entrada: criarTelaEntrada,
  lobby: criarTelaLobby,
  jogo: criarTelaJogo
};

let telaAtual = null;
let nomeTelaAtual = null;
let sobreposicaoFim = null;

/**
 * Qual tela mostrar. Sem estado do servidor significa que ainda não entramos em
 * sala nenhuma — ou que a sala morreu e voltamos para o começo.
 *
 * O fim de partida é a exceção: ele não substitui a tela de jogo, entra por
 * cima dela, para o tabuleiro revelado continuar visível ao fundo.
 */
function telaDoEstado(estado) {
  if (!estado) return 'entrada';
  return estado.tela === 'fim' ? 'jogo' : estado.tela;
}

function desenhar() {
  const nome = telaDoEstado(loja.estado);

  if (nome !== nomeTelaAtual) {
    telaAtual?.destruir?.();
    telaAtual = FABRICAS[nome]();
    nomeTelaAtual = nome;
    raiz.replaceChildren(telaAtual.no);
  }

  telaAtual.atualizar(loja);

  // Sobreposição de fim de jogo.
  const acabou = loja.estado?.tela === 'fim';
  if (acabou && !sobreposicaoFim) {
    sobreposicaoFim = criarTelaFim();
    document.body.append(sobreposicaoFim.no);
  }
  if (acabou) {
    sobreposicaoFim.atualizar(loja);
  } else if (sobreposicaoFim) {
    sobreposicaoFim.no.remove();
    sobreposicaoFim = null;
  }
}

/** Avisos curtos para o que acontece com os outros jogadores. */
function narrar(evento) {
  if (evento.tipo === 'dica') {
    aviso(`${evento.autor ?? 'O mestre'} disse: ${evento.palavra} ${evento.numero}`, 'info');
  } else if (evento.tipo === 'passou' && evento.motivo === 'tempo') {
    aviso('O tempo acabou. A vez passou.', 'info');
  } else if (evento.resultado === 'assassino') {
    aviso('O assassino foi virado.');
  }
}

aoMudar(desenhar);
aoEvento(narrar);

desenhar();
conectar();
