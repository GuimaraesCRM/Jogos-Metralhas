/**
 * Teclado e mouse da partida.
 *
 * Mantém o estado contínuo (teclas seguradas, yaw/pitch acumulados do mouse) e
 * dispara ações discretas (trocar slot, recarregar, abrir a loja) para quem se
 * inscrever. Nada aqui conhece rede nem regras: entrada vira intenção, o resto
 * do jogo decide o que fazer com ela.
 */

import { SENSIBILIDADE } from './config.js';

const MAPA_TECLAS = {
  KeyW: 'frente',
  KeyS: 'tras',
  KeyA: 'esquerda',
  KeyD: 'direita',
  Space: 'pular',
  ControlLeft: 'agachar',
  KeyC: 'agachar'
};

const MAPA_ACOES = {
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  KeyR: 'recarregar',
  KeyG: 'granada',
  KeyB: 'comprar',
  KeyE: 'trocar-espectador'
};

export function criarEntrada(canvas) {
  const comandos = { frente: false, tras: false, esquerda: false, direita: false, pular: false, agachar: false };
  const olhar = { yaw: 0, pitch: 0 };
  const mouse = { atirando: false, mirando: false };

  const ouvintes = new Set();
  const emitir = (acao, extra) => {
    for (const fn of ouvintes) fn(acao, extra);
  };

  let ativa = false;

  function aoTeclar(evento) {
    if (!ativa) return;

    if (evento.code === 'Tab') {
      evento.preventDefault();
      if (!evento.repeat) emitir('placar', true);
      return;
    }
    if (evento.code === 'F11') {
      evento.preventDefault();
      window.appDesktop?.janela?.alternarTelaCheia();
      return;
    }
    if (evento.repeat) return;

    const comando = MAPA_TECLAS[evento.code];
    if (comando) {
      comandos[comando] = true;
      return;
    }
    const acao = MAPA_ACOES[evento.code];
    if (acao) emitir(acao);
  }

  function aoSoltar(evento) {
    if (evento.code === 'Tab') {
      evento.preventDefault();
      emitir('placar', false);
      return;
    }
    const comando = MAPA_TECLAS[evento.code];
    if (comando) comandos[comando] = false;
  }

  function aoMoverMouse(evento) {
    if (!travado()) return;
    olhar.yaw -= evento.movementX * SENSIBILIDADE;
    olhar.pitch -= evento.movementY * SENSIBILIDADE;
    const limite = Math.PI / 2 - 0.01;
    olhar.pitch = Math.min(limite, Math.max(-limite, olhar.pitch));
  }

  function aoApertarMouse(evento) {
    if (!ativa) return;
    if (!travado()) {
      // O primeiro clique no canvas devolve o mouse ao jogo.
      if (evento.target === canvas) travarMouse();
      return;
    }
    if (evento.button === 0) {
      mouse.atirando = true;
      emitir('atirar-clique');
    }
    if (evento.button === 2) mouse.mirando = true;
  }

  function aoSoltarMouse(evento) {
    if (evento.button === 0) mouse.atirando = false;
    if (evento.button === 2) mouse.mirando = false;
  }

  function travado() {
    return document.pointerLockElement === canvas;
  }

  function travarMouse() {
    // O navegador recusa a trava quando a janela não está em foco (e nas
    // janelas de teste automatizado). Recusa não pode virar exceção solta: o
    // jogo segue com o mouse livre e o jogador clica de novo.
    try {
      const pedido = canvas.requestPointerLock();
      if (pedido && typeof pedido.catch === 'function') pedido.catch(() => {});
    } catch {
      /* sem trava de mouse desta vez */
    }
  }

  function destravarMouse() {
    if (travado()) document.exitPointerLock();
  }

  function aoMudarTrava() {
    if (!travado()) {
      // Soltou o mouse (ESC ou programaticamente): zera tudo que era contínuo,
      // senão o personagem continua andando sozinho.
      for (const chave of Object.keys(comandos)) comandos[chave] = false;
      mouse.atirando = false;
      mouse.mirando = false;
      emitir('mouse-solto');
    }
  }

  document.addEventListener('keydown', aoTeclar);
  document.addEventListener('keyup', aoSoltar);
  document.addEventListener('mousemove', aoMoverMouse);
  document.addEventListener('mousedown', aoApertarMouse);
  document.addEventListener('mouseup', aoSoltarMouse);
  document.addEventListener('pointerlockchange', aoMudarTrava);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    comandos,
    olhar,
    mouse,
    travado,
    travarMouse,
    destravarMouse,
    aoAcao(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
    ativar() {
      ativa = true;
    },
    desativar() {
      ativa = false;
      destravarMouse();
    },
    destruir() {
      ativa = false;
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('keyup', aoSoltar);
      document.removeEventListener('mousemove', aoMoverMouse);
      document.removeEventListener('mousedown', aoApertarMouse);
      document.removeEventListener('mouseup', aoSoltarMouse);
      document.removeEventListener('pointerlockchange', aoMudarTrava);
    }
  };
}
