/**
 * Uma sala: o lobby (quem está, em que time) e, quando o anfitrião inicia, a
 * partida em andamento. A sala não conhece WebSocket além de guardar o `ws` de
 * cada jogador para o index.js enviar mensagens — regras de jogo ficam em
 * shared/regras.js e a simulação em tempo real em partida.js.
 */

import { randomUUID, randomBytes } from 'node:crypto';
import { limparNome, limparAvatar } from '../shared/protocolo.js';
import { LIMITE_COMBATE, LIMITE_COMPRA, PARTIDA, TEMPOS, TIMES, duracaoValida } from '../shared/constantes.js';
import { Partida } from './partida.js';

const FASES_DA_SALA = { LOBBY: 'lobby', JOGO: 'jogo' };

export class Sala {
  constructor(codigo) {
    this.codigo = codigo;
    this.fase = FASES_DA_SALA.LOBBY;
    this.jogadores = new Map();
    this.anfitriaoId = null;
    this.partida = null;
    // Tempos do round, escolhidos pelo anfitrião no lobby.
    this.config = { compra: TEMPOS.COMPRA, combate: TEMPOS.COMBATE };
    this.ultimaAtividade = Date.now();
  }

  get quantidadeConectada() {
    return [...this.jogadores.values()].filter((j) => j.conectado).length;
  }

  tocar() {
    this.ultimaAtividade = Date.now();
  }

  // ---------------------------------------------------------------- entrada

  entrar(nomeBruto, ws, avatarBruto) {
    this.tocar();
    if (this.fase !== FASES_DA_SALA.LOBBY) {
      return { ok: false, erro: 'A partida já começou nesta sala. Espere acabar ou peça o código de outra.' };
    }
    if (this.jogadores.size >= PARTIDA.MAX_POR_TIME * 2) {
      return { ok: false, erro: 'A sala está cheia.' };
    }

    const jogador = {
      id: randomUUID(),
      token: randomBytes(16).toString('hex'),
      nome: limparNome(nomeBruto),
      avatar: limparAvatar(avatarBruto),
      time: null,
      ws,
      conectado: true
    };
    this.jogadores.set(jogador.id, jogador);
    if (!this.anfitriaoId) this.anfitriaoId = jogador.id;
    return { ok: true, jogador };
  }

  reconectar(jogadorId, token, ws) {
    this.tocar();
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador || jogador.token !== token) {
      return { ok: false, erro: 'Esse crachá não vale mais para esta sala.' };
    }
    jogador.ws = ws;
    jogador.conectado = true;
    return { ok: true, jogador };
  }

  desconectar(jogadorId) {
    this.tocar();
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador) return { ok: false, erro: 'Jogador desconhecido.' };
    jogador.conectado = false;
    jogador.ws = null;

    // No lobby, quem sai de vez libera a vaga; numa partida o lugar fica
    // guardado para reconexão.
    if (this.fase === FASES_DA_SALA.LOBBY) {
      this.jogadores.delete(jogadorId);
    }

    if (this.anfitriaoId === jogadorId) {
      const proximo = [...this.jogadores.values()].find((j) => j.conectado);
      this.anfitriaoId = proximo ? proximo.id : null;
    }
    return { ok: true };
  }

  // ------------------------------------------------------------------ lobby

  escolherTime(jogadorId, time) {
    this.tocar();
    if (this.fase !== FASES_DA_SALA.LOBBY) return { ok: false, erro: 'A partida já começou.' };
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador) return { ok: false, erro: 'Jogador desconhecido.' };
    if (time !== TIMES.AZUL && time !== TIMES.VERMELHO && time !== null) {
      return { ok: false, erro: 'Time desconhecido.' };
    }
    if (time) {
      const noTime = [...this.jogadores.values()].filter((j) => j.time === time).length;
      if (noTime >= PARTIDA.MAX_POR_TIME) return { ok: false, erro: 'Esse time está cheio.' };
    }
    jogador.time = time;
    return { ok: true };
  }

  /** Só o anfitrião muda os tempos, e só enquanto a partida não começou. */
  configurar(jogadorId, { compra, combate }) {
    this.tocar();
    if (this.fase !== FASES_DA_SALA.LOBBY) return { ok: false, erro: 'A partida já começou.' };
    if (jogadorId !== this.anfitriaoId) return { ok: false, erro: 'Só o anfitrião muda a configuração.' };

    if (compra !== undefined) {
      const valor = duracaoValida(compra, LIMITE_COMPRA);
      if (valor === null) {
        return { ok: false, erro: `O tempo de compra vai de ${LIMITE_COMPRA.MINIMO}s a ${LIMITE_COMPRA.MAXIMO}s.` };
      }
      this.config.compra = valor;
    }
    if (combate !== undefined) {
      const valor = duracaoValida(combate, LIMITE_COMBATE);
      if (valor === null) {
        return { ok: false, erro: `O tempo de round vai de ${LIMITE_COMBATE.MINIMO}s a ${LIMITE_COMBATE.MAXIMO}s.` };
      }
      this.config.combate = valor;
    }
    return { ok: true };
  }

  iniciarPartida(jogadorId, agora = Date.now()) {
    this.tocar();
    if (this.fase !== FASES_DA_SALA.LOBBY) return { ok: false, erro: 'A partida já começou.' };
    if (jogadorId !== this.anfitriaoId) return { ok: false, erro: 'Só o anfitrião inicia a partida.' };

    const azuis = [...this.jogadores.values()].filter((j) => j.time === TIMES.AZUL);
    const vermelhos = [...this.jogadores.values()].filter((j) => j.time === TIMES.VERMELHO);
    if (azuis.length < PARTIDA.MIN_POR_TIME || vermelhos.length < PARTIDA.MIN_POR_TIME) {
      return { ok: false, erro: 'Cada time precisa de pelo menos um jogador.' };
    }
    const semTime = [...this.jogadores.values()].filter((j) => !j.time);
    if (semTime.length > 0) {
      return { ok: false, erro: 'Tem gente sem time. Todo mundo precisa escolher um lado.' };
    }

    this.fase = FASES_DA_SALA.JOGO;
    this.partida = new Partida({ sala: this, agora, tempos: this.config });
    return { ok: true };
  }

  voltarAoLobby(jogadorId) {
    this.tocar();
    if (jogadorId !== this.anfitriaoId) return { ok: false, erro: 'Só o anfitrião volta a sala ao lobby.' };
    if (this.fase !== FASES_DA_SALA.JOGO || !this.partida?.terminou) {
      return { ok: false, erro: 'A partida ainda não terminou.' };
    }
    this.partida = null;
    this.fase = FASES_DA_SALA.LOBBY;
    // Quem caiu durante a partida e não voltou não ocupa vaga no lobby novo.
    for (const [id, jogador] of this.jogadores) {
      if (!jogador.conectado) this.jogadores.delete(id);
    }
    if (!this.jogadores.has(this.anfitriaoId)) {
      const proximo = [...this.jogadores.values()].find((j) => j.conectado);
      this.anfitriaoId = proximo ? proximo.id : null;
    }
    return { ok: true };
  }
}
