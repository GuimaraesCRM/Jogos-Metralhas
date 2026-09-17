/**
 * A máquina de rounds e a economia, em funções puras.
 *
 * Nada aqui conhece rede, relógio de verdade ou renderização: o tempo entra
 * como argumento (`agora`, em ms) e as decisões saem como valores de retorno.
 * É o que permite testar uma partida inteira num teste de unidade, e é o
 * servidor quem transforma esses retornos em mensagens para os clientes.
 */

import { ECONOMIA, FASES, PARTIDA, TEMPOS, TIMES, timeOposto } from './constantes.js';
import { ARMAS, EQUIPAMENTOS, MARRETA, armaPorId } from './armas.js';

/** Arsenal de começo de vida: só a pistola inicial (e a marreta, implícita). */
function arsenalInicial() {
  const pistola = ARMAS.pm9;
  return {
    // slot 1 = primária, slot 2 = pistola. A marreta é o slot 3, sempre presente.
    armas: {
      1: null,
      2: { id: pistola.id, municao: pistola.pente, reserva: pistola.reserva }
    },
    slot: 2
  };
}

export function criarPartida({ jogadores, agora, tempos }) {
  // O dono da sala pode ter escolhido outros tempos no lobby.
  const duracoes = {
    COMPRA: tempos?.compra ?? TEMPOS.COMPRA,
    COMBATE: tempos?.combate ?? TEMPOS.COMBATE,
    POS_ROUND: TEMPOS.POS_ROUND
  };

  const partida = {
    tempos: duracoes,
    fase: FASES.COMPRA,
    faseTerminaEm: agora + duracoes.COMPRA * 1000,
    round: 1,
    placar: { [TIMES.AZUL]: 0, [TIMES.VERMELHO]: 0 },
    ladosTrocados: false,
    vencedorPartida: null,
    jogadores: new Map()
  };

  for (const { id, nome, time } of jogadores) {
    partida.jogadores.set(id, {
      id,
      nome,
      time,
      vivo: true,
      hp: PARTIDA.HP_MAXIMO,
      colete: 0,
      capacete: false,
      dinheiro: ECONOMIA.INICIAL,
      granadas: 0,
      blocos: 0,
      kills: 0,
      mortes: 0,
      ...arsenalInicial()
    });
  }

  return partida;
}

export function jogadoresDoTime(partida, time) {
  return [...partida.jogadores.values()].filter((j) => j.time === time);
}

export function vivosDoTime(partida, time) {
  return jogadoresDoTime(partida, time).filter((j) => j.vivo).length;
}

function darDinheiro(jogador, quantia) {
  jogador.dinheiro = Math.min(ECONOMIA.TETO, jogador.dinheiro + quantia);
}

// ------------------------------------------------------------------ compra

/**
 * Tenta comprar um item. `dentroDaBase` vem do servidor, que é quem sabe onde
 * o jogador está — as regras só decidem se a compra vale.
 */
export function comprar(partida, jogadorId, itemId, dentroDaBase) {
  const jogador = partida.jogadores.get(jogadorId);
  if (!jogador) return { ok: false, erro: 'Jogador desconhecido.' };
  if (partida.fase !== FASES.COMPRA) return { ok: false, erro: 'A loja só abre no início do round.' };
  if (!jogador.vivo) return { ok: false, erro: 'Mortos não compram.' };
  if (!dentroDaBase) return { ok: false, erro: 'Você precisa estar na sua base para comprar.' };

  const arma = armaPorId(itemId);
  if (arma) {
    if (arma.preco > jogador.dinheiro) return { ok: false, erro: 'Dinheiro insuficiente.' };
    const ocupante = jogador.armas[arma.slot];
    if (ocupante && ocupante.id === arma.id) return { ok: false, erro: 'Você já tem essa arma.' };
    jogador.dinheiro -= arma.preco;
    jogador.armas[arma.slot] = { id: arma.id, municao: arma.pente, reserva: arma.reserva };
    jogador.slot = arma.slot;
    return { ok: true, itemId };
  }

  const equipamento = EQUIPAMENTOS[itemId];
  if (!equipamento) return { ok: false, erro: 'Item desconhecido.' };
  if (equipamento.preco > jogador.dinheiro) return { ok: false, erro: 'Dinheiro insuficiente.' };

  if (itemId === 'colete') {
    if (jogador.colete >= PARTIDA.COLETE_MAXIMO) return { ok: false, erro: 'Colete já está cheio.' };
    jogador.colete = PARTIDA.COLETE_MAXIMO;
  } else if (itemId === 'capacete') {
    if (jogador.capacete && jogador.colete >= PARTIDA.COLETE_MAXIMO) {
      return { ok: false, erro: 'Você já tem colete e capacete.' };
    }
    jogador.colete = PARTIDA.COLETE_MAXIMO;
    jogador.capacete = true;
  } else if (itemId === 'granada') {
    if (jogador.granadas >= equipamento.maximo) return { ok: false, erro: 'Limite de granadas.' };
    jogador.granadas += 1;
  } else if (itemId === 'blocos') {
    if (jogador.blocos + equipamento.quantidade > equipamento.maximo) {
      return { ok: false, erro: 'Você não carrega mais blocos que isso.' };
    }
    jogador.blocos += equipamento.quantidade;
  }

  jogador.dinheiro -= equipamento.preco;
  return { ok: true, itemId };
}

// ------------------------------------------------------------------ combate

/**
 * Aplica dano já calculado (o servidor faz a conta com armas.danoDoTiro e o
 * desgaste do colete). Devolve se o alvo morreu.
 */
export function aplicarDano(partida, alvoId, quantidade) {
  const alvo = partida.jogadores.get(alvoId);
  if (!alvo || !alvo.vivo) return { morreu: false };
  alvo.hp = Math.max(0, alvo.hp - quantidade);
  if (alvo.hp > 0) return { morreu: false };
  alvo.vivo = false;
  alvo.mortes += 1;
  return { morreu: true };
}

/** Credita a morte: contador e recompensa em dinheiro pela arma usada. */
export function registrarKill(partida, assassinoId, armaId) {
  const assassino = partida.jogadores.get(assassinoId);
  if (!assassino) return;
  assassino.kills += 1;
  const recompensa =
    armaPorId(armaId)?.recompensa ??
    (armaId === MARRETA.id ? MARRETA.recompensa : 300);
  darDinheiro(assassino, recompensa);
}

// ------------------------------------------------------------------- fases

/**
 * Avalia se o round de combate terminou. Chamada a cada tick pelo servidor.
 * Devolve null enquanto o round segue, ou { vencedor, motivo } — vencedor null
 * significa empate (os dois times caíram juntos, ou o tempo acabou empatado).
 */
export function avaliarRound(partida, agora) {
  if (partida.fase !== FASES.COMBATE) return null;

  const vivosAzul = vivosDoTime(partida, TIMES.AZUL);
  const vivosVermelho = vivosDoTime(partida, TIMES.VERMELHO);

  if (vivosAzul === 0 && vivosVermelho === 0) return { vencedor: null, motivo: 'eliminacao' };
  if (vivosAzul === 0) return { vencedor: TIMES.VERMELHO, motivo: 'eliminacao' };
  if (vivosVermelho === 0) return { vencedor: TIMES.AZUL, motivo: 'eliminacao' };

  if (agora >= partida.faseTerminaEm) {
    if (vivosAzul === vivosVermelho) return { vencedor: null, motivo: 'tempo' };
    return {
      vencedor: vivosAzul > vivosVermelho ? TIMES.AZUL : TIMES.VERMELHO,
      motivo: 'tempo'
    };
  }
  return null;
}

/**
 * Fecha o round: pontua, paga a economia e entra no pós-round.
 * Empate não pontua e paga dinheiro de derrota para os dois lados.
 */
export function terminarRound(partida, { vencedor, motivo }, agora) {
  if (vencedor) partida.placar[vencedor] += 1;

  for (const jogador of partida.jogadores.values()) {
    const ganhou = vencedor && jogador.time === vencedor;
    darDinheiro(jogador, ganhou ? ECONOMIA.VITORIA : ECONOMIA.DERROTA);
  }

  partida.fase = FASES.POS_ROUND;
  partida.faseTerminaEm = agora + (partida.tempos?.POS_ROUND ?? TEMPOS.POS_ROUND) * 1000;

  return { vencedor, motivo, placar: { ...partida.placar } };
}

/** O placar de alguém bateu a meta? Devolve o time campeão ou null. */
export function campeao(partida) {
  for (const time of [TIMES.AZUL, TIMES.VERMELHO]) {
    if (partida.placar[time] >= PARTIDA.ROUNDS_PARA_VENCER) return time;
  }
  return null;
}

/** Hora de trocar de lado? (Uma vez só, depois do round de número fixo.) */
export function horaDeTrocarLado(partida) {
  const roundsJogados = partida.round;
  return !partida.ladosTrocados && roundsJogados >= PARTIDA.TROCA_DE_LADO_APOS;
}

/**
 * Troca os times de lado. O placar acompanha os GRUPOS de jogadores: quem fez
 * 5 rounds como azul continua com 5 rounds, agora como vermelho.
 */
export function trocarLados(partida) {
  partida.ladosTrocados = true;
  const azul = partida.placar[TIMES.AZUL];
  partida.placar[TIMES.AZUL] = partida.placar[TIMES.VERMELHO];
  partida.placar[TIMES.VERMELHO] = azul;

  for (const jogador of partida.jogadores.values()) {
    jogador.time = timeOposto(jogador.time);
    // Recomeço econômico, como no CS: pistola e dinheiro inicial.
    jogador.dinheiro = ECONOMIA.INICIAL;
    jogador.colete = 0;
    jogador.capacete = false;
    jogador.granadas = 0;
    jogador.blocos = 0;
    Object.assign(jogador, arsenalInicial());
  }
}

/**
 * Prepara o round seguinte: revive todo mundo, reabastece munição de quem
 * sobreviveu e devolve os mortos à estaca zero (perderam primária, colete e
 * granadas — os blocos que sobraram no bolso ficam).
 */
export function iniciarProximoRound(partida, agora) {
  partida.round += 1;
  partida.fase = FASES.COMPRA;
  partida.faseTerminaEm = agora + (partida.tempos?.COMPRA ?? TEMPOS.COMPRA) * 1000;

  for (const jogador of partida.jogadores.values()) {
    if (!jogador.vivo) {
      Object.assign(jogador, arsenalInicial());
      jogador.colete = 0;
      jogador.capacete = false;
      jogador.granadas = 0;
    } else {
      for (const slot of [1, 2]) {
        const arma = jogador.armas[slot];
        if (!arma) continue;
        const def = armaPorId(arma.id);
        arma.municao = def.pente;
        arma.reserva = def.reserva;
      }
    }
    jogador.vivo = true;
    jogador.hp = PARTIDA.HP_MAXIMO;
  }
}

/** Entra na fase de combate (fim do freeze time). */
export function iniciarCombate(partida, agora) {
  partida.fase = FASES.COMBATE;
  partida.faseTerminaEm = agora + (partida.tempos?.COMBATE ?? TEMPOS.COMBATE) * 1000;
}

/** Encerra a partida com um campeão. */
export function encerrarPartida(partida, time) {
  partida.fase = FASES.FIM;
  partida.vencedorPartida = time;
}

// ----------------------------------------------------------------- arsenal

export function armaAtiva(jogador) {
  if (jogador.slot === 3) return { tipo: 'marreta', def: MARRETA };
  const arma = jogador.armas[jogador.slot];
  if (!arma) return null;
  return { tipo: 'arma', def: armaPorId(arma.id), estado: arma };
}

/** Recarrega a arma do slot ativo. Devolve false se não havia o que fazer. */
export function aplicarRecarga(jogador) {
  const ativa = jogador.armas[jogador.slot];
  if (!ativa) return false;
  const def = armaPorId(ativa.id);
  const falta = def.pente - ativa.municao;
  if (falta <= 0 || ativa.reserva <= 0) return false;
  const pega = Math.min(falta, ativa.reserva);
  ativa.municao += pega;
  ativa.reserva -= pega;
  return true;
}
