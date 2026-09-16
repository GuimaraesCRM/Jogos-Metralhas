/**
 * A partida em tempo real: o que o servidor simula e decide.
 *
 * Divisão de autoridade do jogo inteiro:
 *  - o CLIENTE manda a própria posição (movimento com latência zero) e o
 *    servidor só VALIDA: deslocamento máximo por intervalo, nada dentro de
 *    parede, ninguém fora da base durante o freeze;
 *  - o SERVIDOR decide tudo que ganha round: tiro (raycast aqui, nunca no
 *    cliente), dano, morte, dinheiro, compras, blocos e granadas.
 *
 * O loop roda a 30 Hz (index.js chama `tick`) e as fotos do estado saem a
 * 20 Hz. Eventos pontuais (tiro, morte, bloco) saem na hora.
 */

import { randomUUID } from 'node:crypto';
import {
  BLOCO_JOGADOR,
  FASES,
  FISICA,
  GRANADA,
  INTERVALO_SNAPSHOT_MS,
  TIMES
} from '../shared/constantes.js';
import { DO_SERVIDOR } from '../shared/protocolo.js';
import { MARRETA, armaPorId, danoDoTiro, intervaloEntreTiros } from '../shared/armas.js';
import {
  BLOCOS,
  caixaColide,
  definirBloco,
  dentro,
  ehBlocoDeJogador,
  linhaLivre,
  obterBloco,
  raioContraCaixa,
  raycastVoxel
} from '../shared/mundo.js';
import { SPAWNS, ZONA_BASE, dentroDaZona, gerarArena } from '../shared/mapa.js';
import { criarGranada, passoGranada, alturaOlhos } from '../shared/fisica.js';
import * as regras from '../shared/regras.js';
import { snapshotPara } from './vistas.js';

const ALCANCE_TIRO = 200;
const TEMPO_RECARGA_MS = 2200;
/** Tolerância da validação de cadência: rede não entrega tiros em métrica exata. */
const FOLGA_CADENCIA = 0.8;
/** O cliente pode reportar origem do tiro até isso longe da última posição aceita. */
const DESVIO_MAX_ORIGEM = 2;

// Hitboxes: caixa do corpo cobre o tronco/pernas; a cabeça é um cubo em cima.
const CABECA = { LADO: 0.5, ALTURA: 0.4 };

export class Partida {
  constructor({ sala, agora }) {
    this.sala = sala;
    this.mundo = gerarArena();
    this.blocosDeJogador = new Map(); // "x,y,z" -> { x, y, z, id, hp }
    this.granadas = [];
    this.tick_ = 0;
    this.acumuladorSnapshot = 0;
    this.eventos = []; // drenados pelo index.js a cada tick

    const jogadores = [...sala.jogadores.values()].map((j) => ({
      id: j.id,
      nome: j.nome,
      time: j.time
    }));
    this.estado = regras.criarPartida({ jogadores, agora });

    // Estado de movimento/combate que não pertence às regras puras.
    this.corpos = new Map();
    for (const j of jogadores) {
      this.corpos.set(j.id, {
        pos: { x: 0, y: 1, z: 0 },
        yaw: 0,
        pitch: 0,
        agachado: false,
        ultimaMsgEm: agora,
        ultimoTiroEm: 0,
        ultimoGolpeEm: 0,
        recarregaAte: 0
      });
    }
    this.posicionarNosSpawns();
  }

  get terminou() {
    return this.estado.fase === FASES.FIM;
  }

  // ------------------------------------------------------------- utilidades

  emitirEvento(tipo, dados, paraId = null) {
    this.eventos.push({ tipo, dados, paraId });
  }

  drenarEventos() {
    const eventos = this.eventos;
    this.eventos = [];
    return eventos;
  }

  jogador(id) {
    return this.estado.jogadores.get(id);
  }

  posicionarNosSpawns() {
    const indices = { [TIMES.AZUL]: 0, [TIMES.VERMELHO]: 0 };
    for (const j of this.estado.jogadores.values()) {
      const spawn = SPAWNS[j.time][indices[j.time] % SPAWNS[j.time].length];
      indices[j.time] += 1;
      const corpo = this.corpos.get(j.id);
      corpo.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
      corpo.yaw = spawn.yaw;
      corpo.pitch = 0;
      this.emitirEvento(DO_SERVIDOR.CORRIGIR_POS, { pos: corpo.pos, yaw: spawn.yaw }, j.id);
    }
  }

  limparBlocosDeJogador() {
    for (const bloco of this.blocosDeJogador.values()) {
      definirBloco(this.mundo, bloco.x, bloco.y, bloco.z, BLOCOS.AR);
      this.emitirEvento(DO_SERVIDOR.BLOCO_MUDOU, { x: bloco.x, y: bloco.y, z: bloco.z, id: BLOCOS.AR, hp: 0 });
    }
    this.blocosDeJogador.clear();
  }

  /** Caixas de colisão de tiro de um jogador: corpo e cabeça. */
  hitboxes(id) {
    const corpo = this.corpos.get(id);
    const meia = FISICA.LARGURA / 2;
    const alturaCorpo = FISICA.ALTURA - CABECA.ALTURA;
    const p = corpo.pos;
    return {
      corpo: {
        min: { x: p.x - meia, y: p.y, z: p.z - meia },
        max: { x: p.x + meia, y: p.y + alturaCorpo, z: p.z + meia }
      },
      cabeca: {
        min: { x: p.x - CABECA.LADO / 2, y: p.y + alturaCorpo, z: p.z - CABECA.LADO / 2 },
        max: { x: p.x + CABECA.LADO / 2, y: p.y + FISICA.ALTURA, z: p.z + CABECA.LADO / 2 }
      }
    };
  }

  centroDoPeito(id) {
    const { pos } = this.corpos.get(id);
    return { x: pos.x, y: pos.y + 1.2, z: pos.z };
  }

  // ------------------------------------------------------------------- tick

  tickPartida(agora, dtMs) {
    this.tick_ += 1;

    this.simularGranadas(agora, dtMs / 1000);
    this.aplicarRecargasProntas(agora);
    this.avancarFases(agora);

    this.acumuladorSnapshot += dtMs;
    if (this.acumuladorSnapshot >= INTERVALO_SNAPSHOT_MS) {
      this.acumuladorSnapshot = 0;
      for (const j of this.sala.jogadores.values()) {
        if (!j.conectado) continue;
        this.emitirEvento(DO_SERVIDOR.SNAPSHOT, snapshotPara(this, j.id, agora), j.id);
      }
    }
  }

  avancarFases(agora) {
    const { estado } = this;

    if (estado.fase === FASES.COMPRA && agora >= estado.faseTerminaEm) {
      regras.iniciarCombate(estado, agora);
      this.emitirEvento(DO_SERVIDOR.FASE, { fase: estado.fase, terminaEm: estado.faseTerminaEm });
      return;
    }

    if (estado.fase === FASES.COMBATE) {
      const fim = regras.avaliarRound(estado, agora);
      if (fim) {
        const resultado = regras.terminarRound(estado, fim, agora);
        this.emitirEvento(DO_SERVIDOR.FIM_ROUND, resultado);
      }
      return;
    }

    if (estado.fase === FASES.POS_ROUND && agora >= estado.faseTerminaEm) {
      const campeao = regras.campeao(estado);
      if (campeao) {
        regras.encerrarPartida(estado, campeao);
        this.emitirEvento(DO_SERVIDOR.FIM_PARTIDA, {
          vencedor: campeao,
          placar: { ...estado.placar },
          jogadores: [...estado.jogadores.values()].map((j) => ({
            id: j.id,
            nome: j.nome,
            time: j.time,
            kills: j.kills,
            mortes: j.mortes
          }))
        });
        return;
      }

      if (regras.horaDeTrocarLado(estado)) {
        regras.trocarLados(estado);
        this.emitirEvento(DO_SERVIDOR.TROCA_DE_LADO, { placar: { ...estado.placar } });
      }

      this.granadas = [];
      this.limparBlocosDeJogador();
      regras.iniciarProximoRound(estado, agora);
      this.posicionarNosSpawns();
      this.emitirEvento(DO_SERVIDOR.FASE, {
        fase: estado.fase,
        terminaEm: estado.faseTerminaEm,
        round: estado.round
      });
    }
  }

  // --------------------------------------------------------------- granadas

  simularGranadas(agora, dt) {
    for (const granada of this.granadas) {
      passoGranada(granada, dt, this.mundo);
      if (agora >= granada.explodeEm) this.explodir(granada);
    }
    this.granadas = this.granadas.filter((g) => !g.explodiu);
  }

  explodir(granada) {
    granada.explodiu = true;
    const danos = [];

    for (const alvo of this.estado.jogadores.values()) {
      if (!alvo.vivo) continue;
      const centro = this.centroDoPeito(alvo.id);
      const dist = Math.hypot(centro.x - granada.pos.x, centro.y - granada.pos.y, centro.z - granada.pos.z);
      if (dist > GRANADA.RAIO) continue;
      // Parede no caminho abafa a explosão — o raycast usa o mesmo grid do tiro.
      if (!linhaLivre(this.mundo, granada.pos, centro)) continue;

      const dano = Math.max(1, Math.round(GRANADA.DANO * (1 - dist / GRANADA.RAIO)));
      const { morreu } = regras.aplicarDano(this.estado, alvo.id, dano);
      danos.push({ id: alvo.id, dano });
      this.emitirEvento(DO_SERVIDOR.DANO, { de: granada.dono, para: alvo.id, quanto: dano, parte: 'corpo' });
      if (morreu) this.registrarMorte(granada.dono, alvo.id, 'granada', false);
    }

    this.emitirEvento(DO_SERVIDOR.GRANADA_EXPLODIU, {
      id: granada.id,
      pos: { ...granada.pos },
      danos
    });
  }

  registrarMorte(assassinoId, vitimaId, armaId, headshot) {
    const assassino = this.jogador(assassinoId);
    const vitima = this.jogador(vitimaId);
    // Dano no próprio time (ou em si mesmo, com granada) não paga recompensa.
    const inimigos = assassino && vitima && assassino.time !== vitima.time;
    if (inimigos) regras.registrarKill(this.estado, assassinoId, armaId);
    this.emitirEvento(DO_SERVIDOR.MORTE, {
      assassino: assassinoId,
      vitima: vitimaId,
      arma: armaId,
      headshot
    });
  }

  // ------------------------------------------------------------- movimento

  tratarEstadoJogador(id, msg, agora) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !corpo || !jogador.vivo) return;

    const pos = validarVetor(msg.pos);
    if (!pos) return;

    corpo.yaw = Number(msg.yaw) || 0;
    corpo.pitch = travar(Number(msg.pitch) || 0, -Math.PI / 2, Math.PI / 2);
    corpo.agachado = Boolean(msg.agachado);

    const dt = travar((agora - corpo.ultimaMsgEm) / 1000, 0, 0.25);
    corpo.ultimaMsgEm = agora;

    // Anti-teleporte: deslocamento máximo com 50% de folga para rede irregular.
    const dx = pos.x - corpo.pos.x;
    const dz = pos.z - corpo.pos.z;
    const horizontal = Math.hypot(dx, dz);
    const maxHorizontal = FISICA.VEL_ANDAR * 1.5 * dt + 0.05;
    const maxVertical = 45 * dt + 0.1;

    const rejeitar = () => this.emitirEvento(DO_SERVIDOR.CORRIGIR_POS, { pos: corpo.pos }, id);

    if (horizontal > maxHorizontal || Math.abs(pos.y - corpo.pos.y) > maxVertical) {
      return rejeitar();
    }

    // Nada de terminar o freeze fora da base.
    if (this.estado.fase === FASES.COMPRA && !dentroDaZona(ZONA_BASE[jogador.time], pos)) {
      return rejeitar();
    }

    // Nada de ficar com o corpo dentro de bloco. A checagem usa uma caixa um
    // fio menor: a posição legítima encosta em parede o tempo todo.
    const folga = 0.02;
    const sonda = { x: pos.x, y: pos.y + folga, z: pos.z };
    if (caixaColide(this.mundo, sonda, FISICA.LARGURA - folga * 2, FISICA.ALTURA - folga * 2)) {
      return rejeitar();
    }

    corpo.pos = pos;
  }

  // ------------------------------------------------------------------ tiro

  tratarAtirar(id, msg, agora) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !jogador.vivo) return;
    if (this.estado.fase !== FASES.COMBATE) return;
    if (agora < corpo.recarregaAte) return; // recarregando

    const slot = jogador.slot;
    if (slot !== 1 && slot !== 2) return; // marreta usa `golpear`
    const armaEstado = jogador.armas[slot];
    if (!armaEstado || armaEstado.municao <= 0) return;
    const def = armaPorId(armaEstado.id);

    if (agora - corpo.ultimoTiroEm < intervaloEntreTiros(def) * FOLGA_CADENCIA) return;
    corpo.ultimoTiroEm = agora;

    const origem = validarVetor(msg.origem);
    const direcao = validarVetor(msg.direcao);
    if (!origem || !direcao) return;

    // A origem precisa ser a cabeça do jogador que o servidor conhece.
    const olhos = {
      x: corpo.pos.x,
      y: corpo.pos.y + alturaOlhos(corpo.agachado),
      z: corpo.pos.z
    };
    if (Math.hypot(origem.x - olhos.x, origem.y - olhos.y, origem.z - olhos.z) > DESVIO_MAX_ORIGEM) return;

    armaEstado.municao -= 1;

    // Shotgun espalha os pellets aqui no servidor; as outras armas atiram na
    // direção enviada (o cliente já aplicou o spread que mostrou na tela).
    const disparos = [];
    for (let p = 0; p < def.pellets; p++) {
      const dir = def.pellets > 1 ? espalhar(direcao, def.spreadBase) : normalizar(direcao);
      disparos.push(dir);
    }

    let impactoPrincipal = null;
    let acertouAlguem = false;

    for (const dir of disparos) {
      const resultado = this.resolverProjetil(id, jogador, def, origem, dir);
      if (!impactoPrincipal) impactoPrincipal = resultado.impacto;
      if (resultado.acertouJogador) {
        acertouAlguem = true;
        impactoPrincipal = resultado.impacto;
      }
    }

    this.emitirEvento(DO_SERVIDOR.TIRO, {
      atirador: id,
      arma: def.id,
      origem,
      impacto: impactoPrincipal,
      acertou: acertouAlguem
    });
  }

  /** Um projétil: acha o que ele atinge primeiro (voxel ou jogador) e aplica. */
  resolverProjetil(atiradorId, atirador, def, origem, dir) {
    const voxel = raycastVoxel(this.mundo, origem, dir, ALCANCE_TIRO);
    const distVoxel = voxel ? voxel.dist : Infinity;

    let alvoMaisPerto = null;
    let distAlvo = Infinity;
    let parte = 'corpo';

    for (const alvo of this.estado.jogadores.values()) {
      if (alvo.id === atiradorId || !alvo.vivo) continue;
      const caixas = this.hitboxes(alvo.id);
      const naCabeca = raioContraCaixa(origem, dir, caixas.cabeca.min, caixas.cabeca.max, ALCANCE_TIRO);
      const noCorpo = raioContraCaixa(origem, dir, caixas.corpo.min, caixas.corpo.max, ALCANCE_TIRO);

      const dist = Math.min(naCabeca ?? Infinity, noCorpo ?? Infinity);
      if (dist < distAlvo) {
        distAlvo = dist;
        alvoMaisPerto = alvo;
        parte = (naCabeca ?? Infinity) <= (noCorpo ?? Infinity) ? 'cabeca' : 'corpo';
      }
    }

    // Jogador atrás de parede: o voxel chega primeiro e o tiro morre nele.
    if (alvoMaisPerto && distAlvo < distVoxel) {
      const headshot = parte === 'cabeca';
      const temColete = alvoMaisPerto.colete > 0;
      const bruto = danoDoTiro(def, parte, false, false, distAlvo);
      const final = danoDoTiro(def, parte, temColete, alvoMaisPerto.capacete, distAlvo);
      if (temColete) {
        alvoMaisPerto.colete = Math.max(0, alvoMaisPerto.colete - Math.max(0, bruto - final));
      }

      const mesmoTime = alvoMaisPerto.time === atirador.time;
      // Fogo amigo desligado: o tiro para no aliado mas não machuca.
      if (!mesmoTime) {
        const { morreu } = regras.aplicarDano(this.estado, alvoMaisPerto.id, final);
        this.emitirEvento(DO_SERVIDOR.DANO, {
          de: atiradorId,
          para: alvoMaisPerto.id,
          quanto: final,
          parte
        });
        if (morreu) this.registrarMorte(atiradorId, alvoMaisPerto.id, def.id, headshot);
      }

      return {
        acertouJogador: !mesmoTime,
        impacto: somar(origem, escalar(dir, distAlvo))
      };
    }

    if (voxel) {
      this.danificarBloco(voxel, def.danoBloco);
      return { acertouJogador: false, impacto: somar(origem, escalar(dir, voxel.dist)) };
    }

    return { acertouJogador: false, impacto: somar(origem, escalar(dir, ALCANCE_TIRO)) };
  }

  danificarBloco(voxel, dano) {
    const id = obterBloco(this.mundo, voxel.x, voxel.y, voxel.z);
    if (!ehBlocoDeJogador(id)) return; // mapa base é indestrutível

    const chave = `${voxel.x},${voxel.y},${voxel.z}`;
    const bloco = this.blocosDeJogador.get(chave);
    if (!bloco) return;

    bloco.hp -= dano;
    if (bloco.hp <= 0) {
      definirBloco(this.mundo, voxel.x, voxel.y, voxel.z, BLOCOS.AR);
      this.blocosDeJogador.delete(chave);
      this.emitirEvento(DO_SERVIDOR.BLOCO_MUDOU, { x: voxel.x, y: voxel.y, z: voxel.z, id: BLOCOS.AR, hp: 0 });
    } else {
      this.emitirEvento(DO_SERVIDOR.BLOCO_MUDOU, { x: voxel.x, y: voxel.y, z: voxel.z, id: bloco.id, hp: bloco.hp });
    }
  }

  // ---------------------------------------------------------------- marreta

  tratarGolpear(id, agora) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !jogador.vivo) return;
    if (this.estado.fase !== FASES.COMBATE) return;
    if (jogador.slot !== 3) return;
    if (agora - corpo.ultimoGolpeEm < intervaloEntreTiros(MARRETA) * FOLGA_CADENCIA) return;
    corpo.ultimoGolpeEm = agora;

    const origem = {
      x: corpo.pos.x,
      y: corpo.pos.y + alturaOlhos(corpo.agachado),
      z: corpo.pos.z
    };
    const dir = direcaoDe(corpo.yaw, corpo.pitch);

    // Primeiro procura um jogador no alcance curto; senão, um bloco.
    for (const alvo of this.estado.jogadores.values()) {
      if (alvo.id === id || !alvo.vivo || alvo.time === jogador.time) continue;
      const caixas = this.hitboxes(alvo.id);
      const dist = Math.min(
        raioContraCaixa(origem, dir, caixas.corpo.min, caixas.corpo.max, MARRETA.alcance) ?? Infinity,
        raioContraCaixa(origem, dir, caixas.cabeca.min, caixas.cabeca.max, MARRETA.alcance) ?? Infinity
      );
      if (dist === Infinity) continue;

      const { morreu } = regras.aplicarDano(this.estado, alvo.id, MARRETA.dano);
      this.emitirEvento(DO_SERVIDOR.DANO, { de: id, para: alvo.id, quanto: MARRETA.dano, parte: 'corpo' });
      if (morreu) this.registrarMorte(id, alvo.id, MARRETA.id, false);
      this.emitirEvento(DO_SERVIDOR.TIRO, {
        atirador: id,
        arma: MARRETA.id,
        origem,
        impacto: somar(origem, escalar(dir, dist)),
        acertou: true
      });
      return;
    }

    const voxel = raycastVoxel(this.mundo, origem, dir, MARRETA.alcance);
    if (voxel) this.danificarBloco(voxel, MARRETA.danoBloco);
  }

  // ----------------------------------------------------------------- blocos

  tratarColocarBloco(id, msg, agora) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !jogador.vivo) return;
    if (this.estado.fase !== FASES.COMBATE && this.estado.fase !== FASES.COMPRA) return;
    if (jogador.blocos <= 0) return;

    const x = Math.floor(Number(msg.x));
    const y = Math.floor(Number(msg.y));
    const z = Math.floor(Number(msg.z));
    if (!Number.isFinite(x + y + z) || !dentro(this.mundo, x, y, z)) return;
    if (obterBloco(this.mundo, x, y, z) !== BLOCOS.AR) return;

    // Alcance a partir dos olhos até o centro da célula.
    const olhos = { x: corpo.pos.x, y: corpo.pos.y + alturaOlhos(corpo.agachado), z: corpo.pos.z };
    const centro = { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
    if (Math.hypot(centro.x - olhos.x, centro.y - olhos.y, centro.z - olhos.z) > BLOCO_JOGADOR.ALCANCE + 0.9) return;

    // Não pode nascer bloco dentro de gente.
    for (const outro of this.estado.jogadores.values()) {
      if (!outro.vivo) continue;
      const p = this.corpos.get(outro.id).pos;
      const meia = FISICA.LARGURA / 2;
      const cruzaX = p.x + meia > x && p.x - meia < x + 1;
      const cruzaY = p.y + FISICA.ALTURA > y && p.y < y + 1;
      const cruzaZ = p.z + meia > z && p.z - meia < z + 1;
      if (cruzaX && cruzaY && cruzaZ) return;
    }

    // No freeze só se constrói dentro da própria base.
    if (this.estado.fase === FASES.COMPRA && !dentroDaZona(ZONA_BASE[jogador.time], centro)) return;

    const idBloco = jogador.time === TIMES.AZUL ? BLOCOS.JOGADOR_AZUL : BLOCOS.JOGADOR_VERMELHO;
    jogador.blocos -= 1;
    definirBloco(this.mundo, x, y, z, idBloco);
    this.blocosDeJogador.set(`${x},${y},${z}`, { x, y, z, id: idBloco, hp: BLOCO_JOGADOR.HP });
    this.emitirEvento(DO_SERVIDOR.BLOCO_MUDOU, { x, y, z, id: idBloco, hp: BLOCO_JOGADOR.HP });
  }

  // --------------------------------------------------------------- granadas

  tratarLancarGranada(id, msg, agora) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !jogador.vivo) return;
    if (this.estado.fase !== FASES.COMBATE) return;
    if (jogador.granadas <= 0) return;

    const direcao = validarVetor(msg.direcao);
    if (!direcao) return;
    jogador.granadas -= 1;

    const olhos = { x: corpo.pos.x, y: corpo.pos.y + alturaOlhos(corpo.agachado), z: corpo.pos.z };
    const dir = normalizar(direcao);
    const origem = somar(olhos, escalar(dir, 0.4));
    const granada = criarGranada(origem, dir);
    granada.id = randomUUID();
    granada.dono = id;
    granada.explodeEm = agora + GRANADA.PAVIO_S * 1000;
    this.granadas.push(granada);
  }

  // ----------------------------------------------------- compra e utilidades

  tratarComprar(id, itemId) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador) return;
    const dentroDaBase = dentroDaZona(ZONA_BASE[jogador.time], corpo.pos);
    const r = regras.comprar(this.estado, id, itemId, dentroDaBase);
    if (r.ok) this.emitirEvento(DO_SERVIDOR.COMPRA_OK, { itemId }, id);
    else this.emitirEvento(DO_SERVIDOR.COMPRA_FALHOU, { itemId, mensagem: r.erro }, id);
  }

  tratarTrocarArma(id, slot) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !jogador.vivo) return;
    const s = Number(slot);
    if (s !== 1 && s !== 2 && s !== 3) return;
    if ((s === 1 || s === 2) && !jogador.armas[s]) return;
    jogador.slot = s;
    corpo.recarregaAte = 0; // trocar de arma cancela a recarga
  }

  tratarRecarregar(id, agora) {
    const jogador = this.jogador(id);
    const corpo = this.corpos.get(id);
    if (!jogador || !jogador.vivo) return;
    if (jogador.slot !== 1 && jogador.slot !== 2) return;
    const arma = jogador.armas[jogador.slot];
    if (!arma) return;
    const def = armaPorId(arma.id);
    if (arma.municao >= def.pente || arma.reserva <= 0) return;
    if (corpo.recarregaAte > agora) return; // já recarregando
    corpo.recarregaAte = agora + TEMPO_RECARGA_MS;
  }

  aplicarRecargasProntas(agora) {
    for (const [id, corpo] of this.corpos) {
      if (corpo.recarregaAte > 0 && agora >= corpo.recarregaAte) {
        corpo.recarregaAte = 0;
        const jogador = this.jogador(id);
        if (jogador?.vivo) regras.aplicarRecarga(jogador);
      }
    }
  }
}

// ------------------------------------------------------------ vetorzinhos

function validarVetor(v) {
  if (!v || typeof v !== 'object') return null;
  const x = Number(v.x);
  const y = Number(v.y);
  const z = Number(v.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

function normalizar(v) {
  const c = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / c, y: v.y / c, z: v.z / c };
}

function somar(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function escalar(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function travar(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function direcaoDe(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

/** Gira uma direção por um desvio aleatório dentro de um cone (spread). */
function espalhar(direcao, spread) {
  const d = normalizar(direcao);
  return normalizar({
    x: d.x + (Math.random() * 2 - 1) * spread,
    y: d.y + (Math.random() * 2 - 1) * spread,
    z: d.z + (Math.random() * 2 - 1) * spread
  });
}

