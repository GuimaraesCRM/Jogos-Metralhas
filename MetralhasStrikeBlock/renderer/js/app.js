/**
 * O maestro da interface: liga telas, conexão e partida.
 *
 *   inicial ──criar/entrar──▶ lobby ──iniciar──▶ jogo ──fim──▶ tela final
 *      ▲                                                        │
 *      └────────────────────── sair ◀─────────── voltar ao lobby┘
 *
 * A reconexão usa o crachá guardado no localStorage: se o app abrir e houver
 * um, tenta voltar direto para a sala (e para a partida, se houver uma).
 */

import { DO_CLIENTE, DO_SERVIDOR, limparNome } from '../../shared/protocolo.js';
import { criarConexao } from './net.js';
import { store } from './store.js';
import { identidadeInicial } from './launcher.js';
import { telaInicial } from './telas/inicial.js';
import { telaLobby } from './telas/lobby.js';
import { telaFim } from './telas/fim.js';
import { criarJogo } from './simulacao-local.js';

const raiz = document.getElementById('raiz');
const areaAvisos = document.getElementById('avisos');

const app = {
  conexao: criarConexao(),
  identidade: null,
  meuId: null,
  meuTime: null,
  estadoLobby: null,
  jogo: null,
  emPartida: false,
  dadosFim: null,
  saindo: false
};

function aviso(mensagem) {
  const bloco = document.createElement('div');
  bloco.className = 'aviso';
  bloco.textContent = mensagem;
  areaAvisos.appendChild(bloco);
  setTimeout(() => bloco.remove(), 4500);
}

// ------------------------------------------------------------------ telas

function mostrarInicial() {
  app.emPartida = false;
  telaInicial(raiz, {
    identidade: app.identidade,
    servidorSalvo: store.servidor,
    aoCriar: (nome, servidor) => entrarNoJogo(nome, servidor, null),
    aoEntrar: (nome, servidor, codigo) => {
      if (!codigo || codigo.length !== 4) return aviso('O código da sala tem 4 letras.');
      entrarNoJogo(nome, servidor, codigo);
    }
  });
}

function mostrarLobby() {
  if (!app.estadoLobby || app.emPartida) return;
  telaLobby(raiz, app.estadoLobby, app.meuId, {
    aoEscolherTime: (time) => app.conexao.enviar(DO_CLIENTE.ESCOLHER_TIME, { time }),
    aoConfigurar: (mudanca) => app.conexao.enviar(DO_CLIENTE.CONFIGURAR, mudanca),
    aoIniciar: () => app.conexao.enviar(DO_CLIENTE.INICIAR_PARTIDA),
    aoSair: sairDaSala
  });
}

function mostrarFim() {
  const souAnfitriao = app.estadoLobby?.anfitriaoId === app.meuId;
  telaFim(raiz, app.dadosFim, app.meuTime, souAnfitriao, {
    aoVoltar: () => app.conexao.enviar(DO_CLIENTE.VOLTAR_AO_LOBBY),
    aoSair: sairDaSala
  });
}

// ------------------------------------------------------------- conexão

function prepararConexao() {
  const { conexao } = app;

  conexao.em(DO_SERVIDOR.ENTROU, (msg) => {
    app.meuId = msg.jogadorId;
    store.cracha = { codigo: msg.codigo, jogadorId: msg.jogadorId, token: msg.token };
  });

  conexao.em(DO_SERVIDOR.LOBBY, (msg) => {
    app.estadoLobby = msg.estado;
    const eu = msg.estado.jogadores.find((j) => j.id === app.meuId);
    if (eu?.time) app.meuTime = eu.time;

    // O anfitrião mandou a sala de volta ao lobby: a tela de fim já era.
    if (msg.estado.fase === 'lobby') app.dadosFim = null;

    if (app.dadosFim) mostrarFim();
    else if (!app.emPartida) mostrarLobby();
  });

  conexao.em(DO_SERVIDOR.PARTIDA_INICIADA, (msg) => {
    app.dadosFim = null;
    app.emPartida = true;
    app.jogo = criarJogo({
      container: raiz,
      conexao,
      meuId: app.meuId,
      estadoInicial: msg.estado,
      aoFimDePartida: (dados) => {
        app.jogo = null;
        app.emPartida = false;
        app.dadosFim = dados;
        const eu = dados.jogadores?.find((j) => j.id === app.meuId);
        if (eu) app.meuTime = eu.time;
        mostrarFim();
      }
    });
  });

  conexao.em(DO_SERVIDOR.ERRO, (msg) => {
    aviso(msg.mensagem ?? 'Algo deu errado.');
    if (msg.fatal) {
      store.cracha = null;
      encerrarJogoLocal();
      mostrarInicial();
    }
  });

  conexao.aoFechar = () => {
    if (app.saindo) return;
    const cracha = store.cracha;
    if (cracha) {
      aviso('Conexão perdida. Tentando voltar…');
      tentarReconectar(cracha, 6);
    } else {
      encerrarJogoLocal();
      mostrarInicial();
    }
  };
}

function encerrarJogoLocal() {
  if (app.jogo) {
    app.jogo.destruir();
    app.jogo = null;
  }
  app.emPartida = false;
}

async function tentarReconectar(cracha, tentativasRestantes) {
  if (tentativasRestantes <= 0) {
    store.cracha = null;
    encerrarJogoLocal();
    mostrarInicial();
    return aviso('Não deu para voltar à partida.');
  }
  try {
    await app.conexao.conectar(store.servidor || 'ws://localhost:8790');
    app.conexao.enviar(DO_CLIENTE.RECONECTAR, cracha);
  } catch {
    setTimeout(() => tentarReconectar(cracha, tentativasRestantes - 1), 1500);
  }
}

async function entrarNoJogo(nomeBruto, servidor, codigo) {
  const nome = limparNome(nomeBruto, '');
  if (!nome) return aviso('Escolha um nome primeiro.');

  store.nome = app.identidade.travado ? store.nome : nome;
  store.servidor = servidor;

  try {
    if (!app.conexao.conectada) await app.conexao.conectar(servidor);
  } catch {
    return aviso('Não deu para conectar nesse servidor. Ele está de pé?');
  }

  if (codigo) {
    app.conexao.enviar(DO_CLIENTE.ENTRAR_SALA, { codigo, nome, avatar: app.identidade.avatar });
  } else {
    app.conexao.enviar(DO_CLIENTE.CRIAR_SALA, { nome, avatar: app.identidade.avatar });
  }
}

function sairDaSala() {
  app.saindo = true;
  app.conexao.enviar(DO_CLIENTE.SAIR);
  store.cracha = null;
  app.estadoLobby = null;
  app.dadosFim = null;
  app.meuTime = null;
  encerrarJogoLocal();
  app.conexao.fechar();
  // Uma conexão nova e limpa para a próxima sala.
  app.conexao = criarConexao();
  prepararConexao();
  app.saindo = false;
  mostrarInicial();
}

// ------------------------------------------------------------------ boot

(async function iniciar() {
  app.identidade = await identidadeInicial();
  prepararConexao();

  // Caiu no meio de uma partida? O crachá devolve a cadeira.
  const cracha = store.cracha;
  if (cracha) {
    try {
      await app.conexao.conectar(store.servidor || 'ws://localhost:8790');
      app.conexao.enviar(DO_CLIENTE.RECONECTAR, cracha);
      return;
    } catch {
      store.cracha = null;
    }
  }

  // O launcher pode ter mandado direto para uma sala.
  if (app.identidade.sala && app.identidade.nome) {
    try {
      await app.conexao.conectar(store.servidor || 'ws://localhost:8790');
      app.conexao.enviar(DO_CLIENTE.ENTRAR_SALA, {
        codigo: app.identidade.sala,
        nome: app.identidade.nome,
        avatar: app.identidade.avatar
      });
      return;
    } catch {
      // Cai na tela inicial com o código preenchido.
    }
  }

  mostrarInicial();
})();
