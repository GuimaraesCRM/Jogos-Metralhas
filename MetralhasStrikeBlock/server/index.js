/**
 * Servidor de partidas.
 *
 * Mantém as salas em memória e roda o loop de simulação (30 Hz) das partidas
 * ativas. Sem banco de dados de propósito — uma partida dura vinte minutos e
 * não sobrevive a um reinício, o que é aceitável aqui e deixa a hospedagem
 * gratuita viável.
 *
 * Sobe um endpoint HTTP em /saude porque as hospedagens gratuitas exigem uma
 * resposta HTTP comum para considerar o serviço no ar.
 */

import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Sala } from './sala.js';
import { vistaDoLobby, vistaDaPartidaInicial } from './vistas.js';
import { DO_CLIENTE, DO_SERVIDOR, NOME_DO_JOGO, gerarCodigo } from '../shared/protocolo.js';
import { INTERVALO_TICK_MS } from '../shared/constantes.js';

const PORTA = Number(process.env.PORT) || 8790;

/** Sala sem ninguém conectado vira lixo depois disso — dá tempo de reconectar. */
const TEMPO_DE_VIDA_VAZIA = 5 * 60 * 1000;

/**
 * Teto de salas simultâneas. O servidor é pensado para um grupo de amigos, mas
 * fica exposto na internet: sem um limite, um laço bobo criando salas
 * derrubaria a partida de quem está jogando.
 */
const LIMITE_DE_SALAS = 100;
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
        servico: 'metralhas-strike-block',
        salas: salas.size,
        jogadores: [...salas.values()].reduce((t, s) => t + s.quantidadeConectada, 0)
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

// As mensagens do jogo têm algumas centenas de bytes. O teto corta pela raiz o
// envio de payloads gigantes para consumir memória do servidor.
const wss = new WebSocketServer({ server: servidorHttp, maxPayload: 16 * 1024 });

// ------------------------------------------------------------------ envio

function enviar(ws, tipo, dados = {}) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ tipo, ...dados }));
}

function transmitirLobby(sala) {
  for (const jogador of sala.jogadores.values()) {
    enviar(jogador.ws, DO_SERVIDOR.LOBBY, { estado: vistaDoLobby(sala) });
  }
}

/** Entrega os eventos que a partida acumulou: dirigidos ou para todo mundo. */
function despacharEventosDaPartida(sala) {
  const partida = sala.partida;
  if (!partida) return;
  for (const evento of partida.drenarEventos()) {
    if (evento.paraId) {
      const jogador = sala.jogadores.get(evento.paraId);
      if (jogador) enviar(jogador.ws, evento.tipo, evento.dados);
    } else {
      for (const jogador of sala.jogadores.values()) {
        enviar(jogador.ws, evento.tipo, evento.dados);
      }
    }
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
function tratar(ws, sessao, msg, agora) {
  const { tipo } = msg;

  if (tipo === DO_CLIENTE.PING) {
    enviar(ws, DO_SERVIDOR.PONG, { agora });
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

    const r = sala.entrar(msg.nome, ws, msg.avatar);
    if (!r.ok) return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: r.erro });

    sessao.codigo = sala.codigo;
    sessao.jogadorId = r.jogador.id;
    log(`sala ${sala.codigo} criada por ${r.jogador.nome}`);

    enviar(ws, DO_SERVIDOR.ENTROU, {
      codigo: sala.codigo,
      jogadorId: r.jogador.id,
      token: r.jogador.token
    });
    transmitirLobby(sala);
    return;
  }

  if (tipo === DO_CLIENTE.ENTRAR_SALA) {
    const codigo = String(msg.codigo ?? '').trim().toUpperCase();
    const sala = salas.get(codigo);
    if (!sala) {
      return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Não existe sala com esse código.' });
    }

    const r = sala.entrar(msg.nome, ws, msg.avatar);
    if (!r.ok) return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: r.erro });

    sessao.codigo = codigo;
    sessao.jogadorId = r.jogador.id;
    log(`${r.jogador.nome} entrou na sala ${codigo}`);

    enviar(ws, DO_SERVIDOR.ENTROU, {
      codigo,
      jogadorId: r.jogador.id,
      token: r.jogador.token
    });
    transmitirLobby(sala);
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

    // Quem volta no meio da partida recebe o estado para reconstruir a cena.
    if (sala.partida) {
      const corpo = sala.partida.corpos.get(r.jogador.id);
      enviar(ws, DO_SERVIDOR.PARTIDA_INICIADA, { estado: vistaDaPartidaInicial(sala.partida) });
      if (corpo) enviar(ws, DO_SERVIDOR.CORRIGIR_POS, { pos: corpo.pos, yaw: corpo.yaw });
    }
    transmitirLobby(sala);
    return;
  }

  // --- daqui para baixo, só quem já está numa sala -------------------------

  const sala = salas.get(sessao.codigo);
  if (!sala || !sessao.jogadorId) {
    return enviar(ws, DO_SERVIDOR.ERRO, { mensagem: 'Você não está em nenhuma sala.' });
  }
  const eu = sessao.jogadorId;
  const partida = sala.partida;

  // Mensagens de partida vão direto para o motor: são frequentes demais para o
  // caminho normal de "responde e retransmite o lobby".
  if (partida && !partida.terminou) {
    switch (tipo) {
      case DO_CLIENTE.ESTADO_JOGADOR:
        return partida.tratarEstadoJogador(eu, msg, agora);
      case DO_CLIENTE.ATIRAR:
        return partida.tratarAtirar(eu, msg, agora);
      case DO_CLIENTE.GOLPEAR:
        return partida.tratarGolpear(eu, agora);
      case DO_CLIENTE.RECARREGAR:
        return partida.tratarRecarregar(eu, agora);
      case DO_CLIENTE.TROCAR_ARMA:
        return partida.tratarTrocarArma(eu, msg.slot);
      case DO_CLIENTE.COMPRAR:
        return partida.tratarComprar(eu, msg.itemId);
      case DO_CLIENTE.COLOCAR_BLOCO:
        return partida.tratarColocarBloco(eu, msg, agora);
      case DO_CLIENTE.LANCAR_GRANADA:
        return partida.tratarLancarGranada(eu, msg, agora);
    }
  }

  const acoes = {
    [DO_CLIENTE.ESCOLHER_TIME]: () => sala.escolherTime(eu, msg.time),
    [DO_CLIENTE.CONFIGURAR]: () => sala.configurar(eu, msg),
    [DO_CLIENTE.INICIAR_PARTIDA]: () => {
      const r = sala.iniciarPartida(eu, agora);
      if (r.ok) {
        log(`partida iniciada na sala ${sala.codigo}`);
        for (const jogador of sala.jogadores.values()) {
          enviar(jogador.ws, DO_SERVIDOR.PARTIDA_INICIADA, {
            estado: vistaDaPartidaInicial(sala.partida)
          });
        }
        despacharEventosDaPartida(sala); // corrigir_pos dos spawns
      }
      return r;
    },
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
  transmitirLobby(sala);
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
      tratar(ws, sessao, msg, Date.now());
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
    transmitirLobby(sala);
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

// ------------------------------------------------------------ loop do jogo

let ultimoTick = Date.now();
setInterval(() => {
  const agora = Date.now();
  const dtMs = agora - ultimoTick;
  ultimoTick = agora;

  for (const sala of salas.values()) {
    if (!sala.partida) continue;
    try {
      if (!sala.partida.terminou) sala.partida.tickPartida(agora, dtMs);
      despacharEventosDaPartida(sala);
    } catch (erro) {
      console.error(`Falha no tick da sala ${sala.codigo}:`, erro);
    }
  }
}, INTERVALO_TICK_MS).unref();

// ------------------------------------------------------------- manutenção

setInterval(() => {
  const agora = Date.now();
  for (const [codigo, sala] of salas) {
    const vazia = sala.quantidadeConectada === 0;
    if (vazia && agora - sala.ultimaAtividade > TEMPO_DE_VIDA_VAZIA) {
      salas.delete(codigo);
      log(`sala ${codigo} descartada por inatividade`);
    }
  }
}, INTERVALO_MANUTENCAO).unref();

servidorHttp.listen(PORTA, () => {
  log(`Servidor de ${NOME_DO_JOGO} ouvindo na porta ${PORTA}`);
});
