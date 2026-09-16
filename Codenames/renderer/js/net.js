/**
 * Cliente WebSocket.
 *
 * Responsabilidades: manter a conexão de pé, guardar o crachá que permite voltar
 * para a partida depois de uma queda, e repassar o que chega para a loja.
 *
 * A reconexão importa mais aqui do que num app comum: se o Wi-Fi oscila no meio
 * de um turno, a partida dos outros cinco jogadores não pode parar esperando.
 */

import { DO_CLIENTE, DO_SERVIDOR } from '/shared/protocolo.js';
import { CHAVES, enderecoDoServidor, guardar, lerGuardado } from './config.js';
import { loja } from './store.js';
import { aviso } from './ui.js';

let socket = null;
let tentativas = 0;
let tempoDeEspera = null;
let querConectar = false;
const ouvintesDeEvento = new Set();

/** Espera crescente entre tentativas, com teto de 8s para não sumir de vez. */
const atrasoDaTentativa = () => Math.min(800 * 2 ** tentativas, 8000);

export const cracha = {
  ler: () => lerGuardado(CHAVES.CRACHA),
  gravar: (valor) => guardar(CHAVES.CRACHA, valor),
  apagar: () => guardar(CHAVES.CRACHA, null)
};

export function aoEvento(ouvinte) {
  ouvintesDeEvento.add(ouvinte);
  return () => ouvintesDeEvento.delete(ouvinte);
}

export function enviar(tipo, dados = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    aviso('Sem conexão com o servidor. Tentando voltar...');
    return false;
  }
  socket.send(JSON.stringify({ tipo, ...dados }));
  return true;
}

/** Abre a conexão (ou reabre, depois de uma queda). */
export function conectar() {
  querConectar = true;
  clearTimeout(tempoDeEspera);

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  loja.definirConexao('conectando');

  try {
    socket = new WebSocket(enderecoDoServidor());
  } catch {
    // Endereço malformado nem chega a abrir: avisa e deixa o usuário corrigir.
    loja.definirConexao('caiu');
    aviso('Endereço do servidor inválido.');
    return;
  }

  socket.addEventListener('open', () => {
    tentativas = 0;
    loja.definirConexao('conectado');

    // Havia uma partida em andamento nesta máquina? Tenta voltar para o lugar.
    const guardado = cracha.ler();
    if (guardado?.codigo && guardado?.jogadorId) {
      enviar(DO_CLIENTE.RECONECTAR, guardado);
    }
  });

  socket.addEventListener('message', (mensagem) => {
    let msg;
    try {
      msg = JSON.parse(mensagem.data);
    } catch {
      return;
    }
    receber(msg);
  });

  socket.addEventListener('close', () => {
    socket = null;
    if (!querConectar) return;
    loja.definirConexao('caiu');
    tentativas++;
    tempoDeEspera = setTimeout(conectar, atrasoDaTentativa());
  });

  socket.addEventListener('error', () => {
    /* o 'close' vem logo atrás e é lá que a nova tentativa é agendada */
  });
}

export function desconectar() {
  querConectar = false;
  clearTimeout(tempoDeEspera);
  socket?.close();
  socket = null;
  loja.definirConexao('parado');
}

function receber(msg) {
  switch (msg.tipo) {
    case DO_SERVIDOR.ENTROU:
      cracha.gravar({ codigo: msg.codigo, jogadorId: msg.jogadorId, token: msg.token });
      break;

    case DO_SERVIDOR.ESTADO:
      loja.definirEstado(msg.estado);
      break;

    case DO_SERVIDOR.EVENTO:
      loja.registrarEvento(msg.evento);
      for (const ouvinte of ouvintesDeEvento) ouvinte(msg.evento);
      break;

    case DO_SERVIDOR.ERRO:
      // Erro fatal = a sala não existe mais. O crachá virou lixo; melhor
      // apagar e voltar para a tela inicial do que insistir num lugar morto.
      if (msg.fatal) {
        cracha.apagar();
        loja.limpar();
      }
      aviso(msg.mensagem);
      break;

    default:
      break;
  }
}

/** Sai da sala de propósito: avisa o servidor e esquece o crachá. */
export function sair() {
  enviar(DO_CLIENTE.SAIR);
  cracha.apagar();
  loja.limpar();
}
