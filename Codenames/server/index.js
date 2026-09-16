/**
 * Servidor de salas.
 *
 * É um relay simples: mantém as salas em memória, aplica as regras e reenvia o
 * estado para todo mundo. Sem banco de dados de propósito — uma partida dura
 * vinte minutos e não sobrevive a um reinício, o que é perfeitamente aceitável
 * aqui e deixa a hospedagem gratuita viável.
 *
 * Sobe um endpoint HTTP em /saude porque as hospedagens gratuitas exigem uma
 * resposta HTTP comum para considerar o serviço no ar.
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Sala } from './sala.js';
import { vistaDaSala } from './vistas.js';
import { DO_CLIENTE, DO_SERVIDOR, gerarCodigo } from '../shared/protocolo.js';

const PORTA = Number(process.env.PORT) || 8787;

/** Sala sem ninguém conectado vira lixo depois disso — dá tempo de reconectar. */
const TEMPO_DE_VIDA_VAZIA = 5 * 60 * 1000;

/**
 * Teto de salas simultâneas. O servidor é pensado para um grupo de amigos, mas
 * fica exposto na internet: sem um limite, um laço bobo criando salas derrubaria
 * a partida de quem está jogando. Trezentas salas é folga larga para o uso real.
 */
const LIMITE_DE_SALAS = 300;
const INTERVALO_MANUTENCAO = 1000;
const INTERVALO_PULSO = 30000;

const salas = new Map();

const log = (...args) => console.log(new Date().toISOString(), ...args);

// ------------------------------------------------------------------ HTTP

const servidorHttp = http.createServer((req, res) => {
  if (req.url === '/saude' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        servico: 'palavras-secretas',
        salas: salas.size,
        jogadores: [...salas.values()].reduce((t, s) => t + s.quantidadeConectada, 0)
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

// As mensagens do jogo têm algumas centenas de bytes. O teto de 16 KB corta
// pela raiz o envio de payloads gigantes para consumir memória do servidor.
const wss = new WebSocketServer({ server: servidorHttp, maxPayload: 16 * 1024 });

// ------------------------------------------------------------------ envio

function enviar(ws, tipo, dados = {}) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ tipo, ...dados }));
}

/**
 * Manda o estado para cada jogador da sala — cada um com a sua vista recortada,
 * porque o operativo não pode receber as cores que o mestre recebe.
 */
function transmitir(sala) {
  const eventos = sala.drenarEventos();
  for (const jogador of sala.jogadores.values()) {
    if (!jogador.ws || jogador.ws.readyState !== jogador.ws.OPEN) continue;
    enviar(jogador.ws, DO_SERVIDOR.ESTADO, { estado: vistaDaSala(sala, jogador.id) });
    for (const evento of eventos) enviar(jogador.ws, DO_SERVIDOR.EVENTO, { evento });
  }
}

function codigoInedito() {
  let codigo;
  do {
    codigo = gerarCodigo();
  } while (salas.has(codigo));
  return codigo;
}

// --------------------------------------------------------------- mensagens

/**
 * Trata uma mensagem do cliente. `sessao` guarda em que sala e com que
 * identidade esta conexão está falando — nada disso vem da mensagem, senão
 * bastaria mandar o id de outra pessoa para jogar no lugar dela.
 */
function tratar(ws, sessao, msg) {
  const { tipo } = msg;

  if (tipo === DO_CLIENTE.PING) {
    enviar(ws, DO_SERVIDOR.PONG);
    return;
  }

  // --- entrada na sala -----------------------------------------------------

  if (tipo === DO_CLIENTE.CRIAR_SALA) {
    if (salas.size >= LIMITE_DE_SALAS) {
      return enviar(ws, DO_SERVIDOR.ERRO, {
        mensagem: 'O servidor está cheio de salas agora. Tente de novo em alguns minutos.'
      });
    }

    const sala = new Sala(codigoInedito());
    salas.set(sala.codigo, sala);

    const r = sala.entrar(msg.nome, ws);
    if (!r.ok) return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: r.erro });

    sessao.codigo = sala.codigo;
    sessao.jogadorId = r.jogador.id;
    log(`sala ${sala.codigo} criada por ${r.jogador.nome}`);

    enviar(ws, DO_SERVIDOR.ENTROU, {
      codigo: sala.codigo,
      jogadorId: r.jogador.id,
      token: r.jogador.token
    });
    transmitir(sala);
    return;
  }

  if (tipo === DO_CLIENTE.ENTRAR_SALA) {
    const codigo = String(msg.codigo ?? '').trim().toUpperCase();
    const sala = salas.get(codigo);
    if (!sala) {
      return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Não existe sala com esse código.' });
    }

    const r = sala.entrar(msg.nome, ws);
    if (!r.ok) return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: r.erro });

    sessao.codigo = codigo;
    sessao.jogadorId = r.jogador.id;
    log(`${r.jogador.nome} entrou na sala ${codigo}`);

    enviar(ws, DO_SERVIDOR.ENTROU, {
      codigo,
      jogadorId: r.jogador.id,
      token: r.jogador.token
    });
    transmitir(sala);
    return;
  }

  if (tipo === DO_CLIENTE.RECONECTAR) {
    const sala = salas.get(String(msg.codigo ?? '').toUpperCase());
    if (!sala) {
      return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Essa sala não existe mais.', fatal: true });
    }

    const r = sala.reconectar(msg.jogadorId, msg.token, ws);
    if (!r.ok) return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: r.erro, fatal: true });

    sessao.codigo = sala.codigo;
    sessao.jogadorId = r.jogador.id;
    log(`${r.jogador.nome} voltou para a sala ${sala.codigo}`);

    enviar(ws, DO_SERVIDOR.ENTROU, {
      codigo: sala.codigo,
      jogadorId: r.jogador.id,
      token: r.jogador.token
    });
    transmitir(sala);
    return;
  }

  // --- daqui para baixo, só quem já está numa sala -------------------------

  const sala = salas.get(sessao.codigo);
  if (!sala || !sessao.jogadorId) {
    return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Você não está em nenhuma sala.' });
  }
  const eu = sessao.jogadorId;

  const acoes = {
    [DO_CLIENTE.ESCOLHER_FUNCAO]: () => sala.escolherFuncao(eu, msg.time, msg.funcao),
    [DO_CLIENTE.RENOMEAR_TIME]: () => sala.renomearTime(eu, msg.time, msg.nome),
    [DO_CLIENTE.CONFIGURAR]: () => sala.configurar(eu, msg),
    [DO_CLIENTE.INICIAR_PARTIDA]: () => sala.iniciarPartida(eu),
    [DO_CLIENTE.DAR_DICA]: () => sala.darDica(eu, msg.palavra, msg.numero),
    [DO_CLIENTE.VOTAR_CARTA]: () => sala.votarCarta(eu, msg.indice),
    [DO_CLIENTE.VOTAR_ENCERRAR]: () => sala.votarEncerrar(eu),
    [DO_CLIENTE.NOVA_PARTIDA]: () => sala.novaPartida(eu),
    [DO_CLIENTE.VOLTAR_AO_LOBBY]: () => sala.voltarAoLobby(eu),
    [DO_CLIENTE.SAIR]: () => {
      sala.desconectar(eu);
      sessao.codigo = null;
      sessao.jogadorId = null;
      return { ok: true };
    }
  };

  const acao = acoes[tipo];
  if (!acao) return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: `Mensagem desconhecida: ${tipo}` });

  const r = acao();
  if (!r.ok) enviar(ws, DO_SERVIDOR.ERRO, { mensagem: r.erro });
  transmitir(sala);
}

// --------------------------------------------------------------- conexões

wss.on('connection', (ws) => {
  const sessao = { codigo: null, jogadorId: null };
  ws.estaVivo = true;
  ws.on('pong', () => {
    ws.estaVivo = true;
  });

  ws.on('message', (bruto) => {
    let msg;
    try {
      msg = JSON.parse(bruto.toString());
    } catch {
      return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Mensagem malformada.' });
    }

    try {
      tratar(ws, sessao, msg);
    } catch (erro) {
      // Um bug tratando uma mensagem não pode derrubar o servidor inteiro e
      // acabar com a partida de todo mundo.
      console.error('Falha ao tratar mensagem:', msg?.tipo, erro);
      enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Algo deu errado no servidor.' });
    }
  });

  ws.on('close', () => {
    const sala = salas.get(sessao.codigo);
    if (!sala || !sessao.jogadorId) return;
    sala.desconectar(sessao.jogadorId);
    transmitir(sala);
  });

  ws.on('error', () => {
    /* o evento 'close' faz a limpeza; aqui só evitamos derrubar o processo */
  });
});

/**
 * Conexão caída nem sempre dispara 'close' (Wi-Fi que some, notebook que
 * dorme). O ping periódico descobre os mortos e libera o lugar.
 */
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.estaVivo) {
      ws.terminate();
      continue;
    }
    ws.estaVivo = false;
    ws.ping();
  }
}, INTERVALO_PULSO).unref();

// ------------------------------------------------------------- manutenção

setInterval(() => {
  const agora = Date.now();
  for (const [codigo, sala] of salas) {
    // Relógio do turno: o servidor é quem decide quando o tempo acabou.
    if (sala.verificarTempo()) transmitir(sala);

    const vazia = sala.quantidadeConectada === 0;
    if (vazia && agora - sala.ultimaAtividade > TEMPO_DE_VIDA_VAZIA) {
      salas.delete(codigo);
      log(`sala ${codigo} descartada por inatividade`);
    }
  }
}, INTERVALO_MANUTENCAO).unref();

servidorHttp.listen(PORTA, () => {
  log(`Servidor de Palavras Secretas ouvindo na porta ${PORTA}`);
});
