/**
 * A partida rodando no cliente.
 *
 * Junta tudo: física local do próprio jogador (latência zero), interpolação
 * dos outros (100 ms atrás, entre dois snapshots), tiro com cadência/spread
 * locais espelhando as regras do servidor, blocos, granadas, HUD, loja e sons.
 *
 * O servidor continua mandando: qualquer divergência (posição rejeitada,
 * munição, dinheiro) é corrigida pelo estado que chega dele.
 */

import {
  ATRASO_INTERPOLACAO_MS,
  BLOCO_JOGADOR,
  FASES,
  FISICA,
  TIMES
} from '../../shared/constantes.js';
import { DO_CLIENTE, DO_SERVIDOR } from '../../shared/protocolo.js';
import { SPREAD_SNIPER_SEM_MIRA, armaPorId, intervaloEntreTiros } from '../../shared/armas.js';
import { BLOCOS, definirBloco, obterBloco, raycastVoxel } from '../../shared/mundo.js';
import { ZONA_BASE, dentroDaZona, direcaoDoOlhar, gerarArena } from '../../shared/mapa.js';
import { alturaOlhos, criarCorpo, passoJogador } from '../../shared/fisica.js';

import { FOV_PADRAO } from './config.js';
import { criarCena } from './mundo/cena.js';
import { criarMalhaDoMundo, COR_DO_BLOCO } from './mundo/chunks.js';
import { criarJogadores } from './mundo/jogadores.js';
import { criarArmaFps } from './mundo/arma-fps.js';
import { criarEfeitos } from './mundo/efeitos.js';
import { criarEntrada } from './entrada.js';
import { criarHud } from './hud.js';
import { criarMenuCompra } from './menu-compra.js';
import * as audio from './audio.js';

const PASSO_FISICA = 1 / 60;
const INTERVALO_ENVIO_MS = 33;

export function criarJogo({ container, conexao, meuId, estadoInicial, aoFimDePartida }) {
  // ------------------------------------------------------------- montagem

  container.innerHTML = '';
  container.className = 'jogo';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const mundo = gerarArena();
  for (const b of estadoInicial?.blocosDeJogador ?? []) {
    definirBloco(mundo, b.x, b.y, b.z, b.id);
  }

  const { cena, camera, renderer, redimensionar, definirFov } = criarCena(canvas);
  cena.add(camera); // a arma em primeira pessoa é filha da câmera
  const chunks = criarMalhaDoMundo(mundo, cena);
  const bonecos = criarJogadores(cena);
  const efeitos = criarEfeitos(cena);
  const armaFps = criarArmaFps(camera);
  const entrada = criarEntrada(canvas);
  const hud = criarHud(container);

  const nomes = new Map((estadoInicial?.jogadores ?? []).map((j) => [j.id, j.nome]));

  // --------------------------------------------------------------- estado

  const corpo = criarCorpo({ x: 32, y: 2, z: 32 });
  let fotos = []; // buffer de snapshots para interpolação
  let ultimaFoto = null;
  let desvioRelogio = 0;
  let meuTime = null;
  let vivo = true;
  let fase = FASES.COMPRA;
  let lojaAberta = false;
  let encerrado = false;

  // Espelho local da arma para atirar sem esperar o snapshot.
  let slotLocal = 2;
  let ultimoSlotServidor = null;
  let municaoLocal = { 1: 0, 2: 12 };
  let ultimoTiroLocal = 0;
  let rajadaRestante = 0;
  let proximoTiroDaRajada = 0;

  // Espectador: índice do aliado observado.
  let alvoEspectador = 0;

  const agoraServidor = () => Date.now() + desvioRelogio;

  function armaDoSlot(slot) {
    const eu = ultimaFoto?.eu;
    if (!eu) return null;
    return eu.armas?.[slot] ?? null;
  }

  function defAtiva() {
    if (slotLocal !== 1 && slotLocal !== 2) return null;
    const arma = armaDoSlot(slotLocal);
    return arma ? armaPorId(arma.id) : null;
  }

  const ehSniper = () => defAtiva()?.categoria === 'sniper';
  const mirando = () => entrada.mouse.mirando && ehSniper();

  // ------------------------------------------------------------ rede: fotos

  conexao.em(DO_SERVIDOR.SNAPSHOT, (foto) => {
    // Desvio de relógio numa média móvel: um snapshot atrasado não sacode tudo.
    const desvioNovo = foto.agora - Date.now();
    desvioRelogio = ultimaFoto ? desvioRelogio * 0.9 + desvioNovo * 0.1 : desvioNovo;
    hud.definirDesvioRelogio(desvioRelogio);

    fotos.push(foto);
    if (fotos.length > 30) fotos.shift();
    ultimaFoto = foto;
    fase = foto.fase;

    const eu = foto.eu;
    if (eu) {
      meuTime = eu.time;
      // Sincroniza o espelho local com a verdade do servidor.
      municaoLocal[1] = eu.armas[1]?.municao ?? 0;
      municaoLocal[2] = eu.armas[2]?.municao ?? 0;
      // Só adota o slot do servidor quando ELE muda (compra troca para a arma
      // nova) — senão o "modo bloco" (slot 4, que o servidor não conhece)
      // seria desfeito a cada snapshot.
      if (eu.slot !== ultimoSlotServidor) {
        ultimoSlotServidor = eu.slot;
        if (slotLocal !== eu.slot) {
          slotLocal = eu.slot;
          const arma = eu.armas[eu.slot];
          armaFps.mostrar(eu.slot === 3 ? 'marreta' : arma?.id ?? 'marreta');
        }
      }

      if (vivo && !eu.vivo) {
        // Morremos: vira espectador até o próximo round.
        alvoEspectador = 0;
        hud.modoEspectador(nomeDoAliadoObservado() ?? '—');
      } else if (!vivo && eu.vivo) {
        hud.modoEspectador(null);
      }
      vivo = eu.vivo;
    }

    hud.aplicarSnapshot(foto);
    if (lojaAberta) menu.atualizar(eu);
    efeitos.sincronizarGranadas(foto.granadas ?? []);
  });

  conexao.em(DO_SERVIDOR.CORRIGIR_POS, (msg) => {
    corpo.pos.x = msg.pos.x;
    corpo.pos.y = msg.pos.y;
    corpo.pos.z = msg.pos.z;
    corpo.vel.x = corpo.vel.y = corpo.vel.z = 0;
    if (typeof msg.yaw === 'number') {
      entrada.olhar.yaw = msg.yaw;
      entrada.olhar.pitch = 0;
    }
  });

  // ----------------------------------------------------------- rede: eventos

  conexao.em(DO_SERVIDOR.TIRO, (msg) => {
    if (msg.atirador === meuId) return; // o nosso já foi desenhado na hora
    efeitos.tracer(msg.origem, msg.impacto);
    efeitos.impactoBloco(msg.impacto);
    const def = armaPorId(msg.arma);
    const { dist, pan } = audio.espacial(corpo.pos, entrada.olhar.yaw, msg.origem);
    audio.tocarTiro(def?.categoria ?? (msg.arma === 'marreta' ? 'marreta' : 'rifle'), dist, pan);
  });

  conexao.em(DO_SERVIDOR.DANO, (msg) => {
    if (msg.para === meuId) {
      hud.marcarDano();
      audio.tocarDanoRecebido();
    }
    if (msg.de === meuId) {
      hud.marcarAcerto();
      if (msg.parte === 'cabeca') audio.tocarHeadshot();
      else audio.tocarHit();
    }
  });

  conexao.em(DO_SERVIDOR.MORTE, (msg) => {
    const nomeA = nomes.get(msg.assassino) ?? '?';
    const nomeV = nomes.get(msg.vitima) ?? '?';
    const timeDe = (id) => ultimaFoto?.jogadores.find((j) => j.id === id)?.time ?? TIMES.AZUL;
    hud.adicionarKill(nomeA, nomeV, msg.arma, msg.headshot, timeDe(msg.assassino), timeDe(msg.vitima));
  });

  conexao.em(DO_SERVIDOR.BLOCO_MUDOU, (msg) => {
    const anterior = obterBloco(mundo, msg.x, msg.y, msg.z);
    if (anterior === msg.id) return; // só mudou o HP do bloco
    definirBloco(mundo, msg.x, msg.y, msg.z, msg.id);
    chunks.aoMudarBloco(msg.x, msg.z);

    const centro = { x: msg.x + 0.5, y: msg.y + 0.5, z: msg.z + 0.5 };
    const { dist, pan } = audio.espacial(corpo.pos, entrada.olhar.yaw, centro);
    if (msg.id === BLOCOS.AR) {
      efeitos.impactoBloco(centro, COR_DO_BLOCO[anterior] ?? 0x9aa7bd);
      audio.tocarBloco(false, dist, pan);
    } else {
      audio.tocarBloco(true, dist, pan);
    }
  });

  conexao.em(DO_SERVIDOR.GRANADA_EXPLODIU, (msg) => {
    efeitos.explosao(msg.pos);
    const { dist, pan } = audio.espacial(corpo.pos, entrada.olhar.yaw, msg.pos);
    audio.tocarExplosao(dist, pan);
  });

  conexao.em(DO_SERVIDOR.FASE, (msg) => {
    fase = msg.fase;
    if (msg.fase === FASES.COMPRA) {
      hud.mostrarFaixa(`ROUND ${msg.round ?? ''} — COMPRE SEU EQUIPAMENTO (B)`, 4000);
      audio.tocarInicioRound();
    } else if (msg.fase === FASES.COMBATE) {
      hud.mostrarFaixa('VAI!', 1500);
      audio.tocarInicioRound();
      if (lojaAberta) fecharLoja();
    }
  });

  conexao.em(DO_SERVIDOR.FIM_ROUND, (msg) => {
    if (!msg.vencedor) {
      hud.mostrarFaixa('ROUND EMPATADO', 3500);
      audio.tocarFimRound(false);
    } else {
      const venceu = msg.vencedor === meuTime;
      hud.mostrarFaixa(venceu ? 'ROUND VENCIDO!' : 'Round perdido…', 3500);
      audio.tocarFimRound(venceu);
    }
  });

  conexao.em(DO_SERVIDOR.TROCA_DE_LADO, () => {
    hud.mostrarFaixa('TROCA DE LADO!', 3500);
  });

  conexao.em(DO_SERVIDOR.FIM_PARTIDA, (msg) => {
    destruir();
    aoFimDePartida(msg);
  });

  conexao.em(DO_SERVIDOR.COMPRA_OK, () => {
    audio.tocarCompra();
  });

  conexao.em(DO_SERVIDOR.COMPRA_FALHOU, (msg) => {
    audio.tocarCompraNegada();
    hud.mostrarFaixa(msg.mensagem ?? 'Compra recusada', 1800);
  });

  // ----------------------------------------------------------------- loja

  const menu = criarMenuCompra(container, {
    aoComprar: (itemId) => conexao.enviar(DO_CLIENTE.COMPRAR, { itemId }),
    aoFechar: () => {
      lojaAberta = false;
    }
  });

  function abrirLoja() {
    if (fase !== FASES.COMPRA || !vivo) return;
    lojaAberta = true;
    hud.mostrarPausa(false);
    menu.abrir(ultimaFoto?.eu);
    entrada.destravarMouse();
  }

  function fecharLoja() {
    menu.fechar();
    lojaAberta = false;
    entrada.travarMouse();
  }

  // ---------------------------------------------------------------- ações

  function trocarSlot(slot) {
    if (!vivo) return;
    if (slot === 4) {
      if ((ultimaFoto?.eu?.blocos ?? 0) <= 0) return;
      slotLocal = 4;
      armaFps.mostrar('bloco');
      // O servidor não precisa saber do "modo bloco": colocar_bloco é a ação.
      return;
    }
    if (slot === 3) {
      slotLocal = 3;
      armaFps.mostrar('marreta');
      conexao.enviar(DO_CLIENTE.TROCAR_ARMA, { slot });
      return;
    }
    const arma = armaDoSlot(slot);
    if (!arma) return;
    slotLocal = slot;
    armaFps.mostrar(arma.id);
    conexao.enviar(DO_CLIENTE.TROCAR_ARMA, { slot });
  }

  function origemDoTiro() {
    return {
      x: corpo.pos.x,
      y: corpo.pos.y + alturaOlhos(entrada.comandos.agachar),
      z: corpo.pos.z
    };
  }

  function direcaoComSpread(def) {
    const movendo =
      entrada.comandos.frente || entrada.comandos.tras || entrada.comandos.esquerda || entrada.comandos.direita;

    let spread;
    if (def.categoria === 'sniper') {
      spread = mirando() ? def.spreadMirando : SPREAD_SNIPER_SEM_MIRA;
    } else {
      spread = def.spreadBase + (movendo ? def.spreadAndando : 0);
    }

    const dir = direcaoDoOlhar(entrada.olhar.yaw, entrada.olhar.pitch);
    return {
      x: dir.x + (Math.random() * 2 - 1) * spread,
      y: dir.y + (Math.random() * 2 - 1) * spread,
      z: dir.z + (Math.random() * 2 - 1) * spread
    };
  }

  function dispararUmaVez(agora) {
    const def = defAtiva();
    if (!def) return;
    if (municaoLocal[slotLocal] <= 0) {
      audio.tocarVazio();
      return;
    }

    municaoLocal[slotLocal] -= 1;
    ultimoTiroLocal = agora;

    const origem = origemDoTiro();
    const direcao = direcaoComSpread(def);
    conexao.enviar(DO_CLIENTE.ATIRAR, { origem, direcao });

    // Feedback imediato: som, recuo e tracer até onde o raio local bate.
    audio.tocarTiro(def.categoria);
    armaFps.disparar();
    const impacto = raycastVoxel(mundo, origem, direcao, 200);
    const fim = impacto
      ? { x: origem.x + direcao.x * impacto.dist, y: origem.y + direcao.y * impacto.dist, z: origem.z + direcao.z * impacto.dist }
      : { x: origem.x + direcao.x * 200, y: origem.y + direcao.y * 200, z: origem.z + direcao.z * 200 };
    // Normaliza o comprimento usado no tracer (a direção tem spread, módulo ~1).
    efeitos.tracer({ x: origem.x, y: origem.y - 0.08, z: origem.z }, fim);
  }

  function tentarAtirar(agora, cliqueNovo) {
    if (!vivo || lojaAberta || !entrada.travado()) return;

    // Blocos podem ser colocados também no freeze (dentro da base).
    if (slotLocal === 4) {
      if (cliqueNovo && (fase === FASES.COMBATE || fase === FASES.COMPRA)) colocarBloco();
      return;
    }

    if (fase !== FASES.COMBATE) return;

    if (slotLocal === 3) {
      if (!cliqueNovo) return;
      conexao.enviar(DO_CLIENTE.GOLPEAR, {});
      armaFps.disparar();
      audio.tocarTiro('marreta');
      return;
    }

    const def = defAtiva();
    if (!def) return;
    const intervalo = intervaloEntreTiros(def);
    if (agora - ultimoTiroLocal < intervalo) return;
    if (!def.automatica && !cliqueNovo && rajadaRestante <= 0) return;

    if (def.rajada > 1 && cliqueNovo) {
      rajadaRestante = def.rajada;
      proximoTiroDaRajada = agora;
    }

    if (def.rajada > 1) {
      if (rajadaRestante > 0 && agora >= proximoTiroDaRajada) {
        dispararUmaVez(agora);
        rajadaRestante -= 1;
        proximoTiroDaRajada = agora + intervalo;
      }
      return;
    }

    dispararUmaVez(agora);
  }

  function colocarBloco() {
    if ((ultimaFoto?.eu?.blocos ?? 0) <= 0) return;
    const origem = origemDoTiro();
    const dir = direcaoDoOlhar(entrada.olhar.yaw, entrada.olhar.pitch);
    const impacto = raycastVoxel(mundo, origem, dir, BLOCO_JOGADOR.ALCANCE);
    if (!impacto) return;
    const alvo = {
      x: impacto.x + impacto.normal.x,
      y: impacto.y + impacto.normal.y,
      z: impacto.z + impacto.normal.z
    };
    conexao.enviar(DO_CLIENTE.COLOCAR_BLOCO, alvo);
  }

  function nomeDoAliadoObservado() {
    const aliados = (ultimaFoto?.jogadores ?? []).filter((j) => j.time === meuTime && j.vivo && j.id !== meuId);
    if (aliados.length === 0) return null;
    return aliados[alvoEspectador % aliados.length]?.nome ?? null;
  }

  entrada.aoAcao((acao) => {
    audio.destravarAudio();

    if (acao === 'comprar') {
      if (lojaAberta) fecharLoja();
      else abrirLoja();
      return;
    }
    if (acao === 'placar') return; // tratado com o segundo argumento abaixo
    if (lojaAberta) return;

    if (acao === 'slot1') trocarSlot(1);
    else if (acao === 'slot2') trocarSlot(2);
    else if (acao === 'slot3') trocarSlot(3);
    else if (acao === 'slot4') trocarSlot(4);
    else if (acao === 'recarregar') {
      if (slotLocal === 1 || slotLocal === 2) {
        conexao.enviar(DO_CLIENTE.RECARREGAR, {});
        armaFps.recarregar();
        audio.tocarRecarga();
      }
    } else if (acao === 'granada') {
      if (!vivo || fase !== FASES.COMBATE) return;
      if ((ultimaFoto?.eu?.granadas ?? 0) <= 0) return;
      const direcao = direcaoDoOlhar(entrada.olhar.yaw, entrada.olhar.pitch);
      conexao.enviar(DO_CLIENTE.LANCAR_GRANADA, { direcao });
      armaFps.disparar();
    } else if (acao === 'trocar-espectador') {
      if (!vivo) {
        alvoEspectador += 1;
        hud.modoEspectador(nomeDoAliadoObservado() ?? '—');
      }
    } else if (acao === 'atirar-clique') {
      tentarAtirar(performance.now(), true);
    } else if (acao === 'mouse-solto') {
      if (!lojaAberta && !encerrado) hud.mostrarPausa(true);
    }
  });

  // TAB pressionado/solto chega como ('placar', true|false).
  entrada.aoAcao((acao, apertado) => {
    if (acao === 'placar') hud.mostrarPlacar(apertado, ultimaFoto, meuId);
  });

  hud.botaoVoltarJogo.addEventListener('click', () => {
    hud.mostrarPausa(false);
    entrada.travarMouse();
  });

  // ------------------------------------------------------------ interpolação

  function estadosInterpolados() {
    const alvoT = agoraServidor() - ATRASO_INTERPOLACAO_MS;

    let antes = null;
    let depois = null;
    for (let i = fotos.length - 1; i >= 0; i--) {
      if (fotos[i].agora <= alvoT) {
        antes = fotos[i];
        depois = fotos[i + 1] ?? null;
        break;
      }
    }
    if (!antes) antes = fotos[0];
    if (!antes) return [];
    if (!depois) depois = antes;

    const span = depois.agora - antes.agora;
    const t = span > 0 ? Math.min(1, Math.max(0, (alvoT - antes.agora) / span)) : 1;

    const porIdDepois = new Map(depois.jogadores.map((j) => [j.id, j]));
    const estados = [];
    for (const a of antes.jogadores) {
      if (a.id === meuId) continue;
      const b = porIdDepois.get(a.id) ?? a;
      estados.push({
        id: a.id,
        nome: a.nome,
        time: b.time,
        vivo: b.vivo,
        agachado: b.agachado,
        pos: {
          x: a.pos[0] + (b.pos[0] - a.pos[0]) * t,
          y: a.pos[1] + (b.pos[1] - a.pos[1]) * t,
          z: a.pos[2] + (b.pos[2] - a.pos[2]) * t
        },
        yaw: lerpAngulo(a.yaw, b.yaw, t),
        pitch: a.pitch + (b.pitch - a.pitch) * t
      });
    }
    return estados;
  }

  // ----------------------------------------------------------------- loop

  let idRaf = 0;
  let ultimoQuadro = performance.now();
  let acumuladorFisica = 0;
  let acumuladorEnvio = 0;
  let armaMostradaInicial = false;

  function quadro(agoraMs) {
    if (encerrado) return;
    idRaf = requestAnimationFrame(quadro);

    const dt = Math.min(0.1, (agoraMs - ultimoQuadro) / 1000);
    ultimoQuadro = agoraMs;

    if (!armaMostradaInicial && ultimaFoto?.eu) {
      armaMostradaInicial = true;
      trocarSlot(ultimaFoto.eu.slot);
    }

    // Física do próprio jogador em passo fixo.
    if (vivo) {
      acumuladorFisica += dt;
      const congelado = lojaAberta || !entrada.travado();
      const comandos = congelado
        ? { frente: false, tras: false, esquerda: false, direita: false, pular: false, agachar: false }
        : entrada.comandos;
      while (acumuladorFisica >= PASSO_FISICA) {
        passoJogador(corpo, comandos, entrada.olhar.yaw, PASSO_FISICA, mundo);
        acumuladorFisica -= PASSO_FISICA;
      }
      // Durante o freeze o time fica preso na base — o mesmo limite que o
      // servidor impõe, aplicado aqui para não ficar quicando na correção.
      if (fase === FASES.COMPRA && meuTime && !dentroDaZona(ZONA_BASE[meuTime], corpo.pos)) {
        const zona = ZONA_BASE[meuTime];
        corpo.pos.x = Math.min(zona.x1 - 0.31, Math.max(zona.x0 + 0.31, corpo.pos.x));
        corpo.pos.z = Math.min(zona.z1 - 0.31, Math.max(zona.z0 + 0.31, corpo.pos.z));
      }
      const movendo = comandos.frente || comandos.tras || comandos.esquerda || comandos.direita;
      if (movendo && corpo.noChao) audio.tocarPasso();
    }

    // Tiro automático segurando o botão.
    if (entrada.mouse.atirando || rajadaRestante > 0) tentarAtirar(performance.now(), false);

    // Reporta o estado ao servidor (30 Hz).
    acumuladorEnvio += dt * 1000;
    if (acumuladorEnvio >= INTERVALO_ENVIO_MS) {
      acumuladorEnvio = 0;
      if (vivo) {
        conexao.enviar(DO_CLIENTE.ESTADO_JOGADOR, {
          pos: { x: corpo.pos.x, y: corpo.pos.y, z: corpo.pos.z },
          yaw: entrada.olhar.yaw,
          pitch: entrada.olhar.pitch,
          agachado: entrada.comandos.agachar
        });
      }
    }

    // Câmera: primeira pessoa, ou olho do aliado observado.
    if (vivo) {
      camera.position.set(corpo.pos.x, corpo.pos.y + alturaOlhos(entrada.comandos.agachar), corpo.pos.z);
      camera.rotation.y = entrada.olhar.yaw;
      camera.rotation.x = entrada.olhar.pitch;
    } else {
      const aliados = estadosInterpolados().filter((j) => j.time === meuTime && j.vivo);
      const alvo = aliados[alvoEspectador % Math.max(1, aliados.length)];
      if (alvo) {
        camera.position.set(alvo.pos.x, alvo.pos.y + FISICA.OLHOS, alvo.pos.z);
        camera.rotation.y = alvo.yaw;
        camera.rotation.x = alvo.pitch;
      }
    }

    // Zoom de sniper.
    const zoom = mirando() ? defAtiva()?.zoom ?? 1 : 1;
    const fovAlvo = FOV_PADRAO * zoom;
    if (Math.abs(camera.fov - fovAlvo) > 0.5) definirFov(camera.fov + (fovAlvo - camera.fov) * 0.4);
    hud.mostrarZoom(mirando());
    armaFps.esconder(mirando() || !vivo);

    bonecos.sincronizar(estadosInterpolados());
    efeitos.atualizar(dt);
    armaFps.atualizar(dt, mirando());
    hud.atualizarRelogio();

    renderer.render(cena, camera);
  }

  function lerpAngulo(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
  }

  // --------------------------------------------------------------- arranque

  entrada.ativar();
  redimensionar();
  hud.mostrarFaixa('COMPRE SEU EQUIPAMENTO (B) — clique para capturar o mouse', 5000);
  idRaf = requestAnimationFrame(quadro);

  function destruir() {
    if (encerrado) return;
    encerrado = true;
    cancelAnimationFrame(idRaf);
    entrada.destruir();
    hud.destruir();
    menu.destruir();
    bonecos.limpar();
    efeitos.limpar();
    chunks.destruir();
    renderer.dispose();
    container.innerHTML = '';
    container.className = '';
  }

  return { destruir };
}
