/**
 * A arma em primeira pessoa: caixas estilizadas presas à câmera, com recuo,
 * mergulho de recarga e troca animados por código. Zero assets.
 */

import * as THREE from '../../vendor/three.module.js';
import { armaPorId } from '../../../shared/armas.js';

const POSICAO_BASE = { x: 0.3, y: -0.26, z: -0.55 };

function caixa(largura, altura, comprimento, cor) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(largura, altura, comprimento),
    new THREE.MeshLambertMaterial({ color: cor })
  );
}

/** Monta o modelo de uma arma pela categoria — silhuetas diferentes bastam. */
function montarModelo(tipo) {
  const grupo = new THREE.Group();

  if (tipo === 'marreta') {
    const cabo = caixa(0.05, 0.05, 0.5, 0x7a5a34);
    cabo.position.z = -0.1;
    const cabecote = caixa(0.16, 0.14, 0.14, 0x4a4f58);
    cabecote.position.z = -0.38;
    grupo.add(cabo, cabecote);
    return grupo;
  }

  if (tipo === 'bloco') {
    const bloco = caixa(0.22, 0.22, 0.22, 0x9aa7bd);
    grupo.add(bloco);
    return grupo;
  }

  const arma = armaPorId(tipo);
  const categoria = arma?.categoria ?? 'rifle';

  const perfis = {
    pistola: { corpo: [0.07, 0.12, 0.28], cano: [0.04, 0.04, 0.12], cor: 0x3a3f48 },
    shotgun: { corpo: [0.09, 0.12, 0.5], cano: [0.055, 0.055, 0.3], cor: 0x5a4632 },
    smg: { corpo: [0.08, 0.13, 0.38], cano: [0.04, 0.04, 0.18], cor: 0x343943 },
    rifle: { corpo: [0.08, 0.13, 0.55], cano: [0.045, 0.045, 0.28], cor: 0x3d4350 },
    sniper: { corpo: [0.075, 0.12, 0.7], cano: [0.04, 0.04, 0.4], cor: 0x2f3d33 }
  };
  const perfil = perfis[categoria] ?? perfis.rifle;

  const corpo = caixa(...perfil.corpo, perfil.cor);
  const cano = caixa(...perfil.cano, 0x22262e);
  cano.position.z = -(perfil.corpo[2] / 2 + perfil.cano[2] / 2 - 0.02);
  const cabo = caixa(0.06, 0.16, 0.08, 0x2a2e36);
  cabo.position.set(0, -0.12, perfil.corpo[2] * 0.28);
  grupo.add(corpo, cano, cabo);

  if (categoria === 'sniper') {
    const luneta = caixa(0.05, 0.06, 0.22, 0x1c1f26);
    luneta.position.set(0, 0.09, -0.05);
    grupo.add(luneta);
  }

  // Clarão do disparo, escondido até o tiro.
  const clarao = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.14),
    new THREE.MeshBasicMaterial({ color: 0xffd75c, transparent: true, opacity: 0.9 })
  );
  clarao.position.z = cano.position.z - perfil.cano[2] / 2 - 0.08;
  clarao.visible = false;
  grupo.add(clarao);
  grupo.userData.clarao = clarao;

  return grupo;
}

export function criarArmaFps(camera) {
  const suporte = new THREE.Group();
  suporte.position.set(POSICAO_BASE.x, POSICAO_BASE.y, POSICAO_BASE.z);
  camera.add(suporte);

  let modelo = null;
  let tipoAtual = null;
  let recuo = 0;
  let recarga = 0; // 0..1: fração restante da animação de recarga
  let troca = 0;
  let claraoTempo = 0;

  function mostrar(tipo) {
    if (tipo === tipoAtual) return;
    tipoAtual = tipo;
    if (modelo) suporte.remove(modelo);
    modelo = montarModelo(tipo);
    suporte.add(modelo);
    troca = 1;
  }

  function disparar() {
    recuo = 1;
    claraoTempo = 0.05;
    const clarao = modelo?.userData?.clarao;
    if (clarao) {
      clarao.visible = true;
      clarao.rotation.z = Math.random() * Math.PI;
    }
  }

  function recarregar() {
    recarga = 1;
  }

  function atualizar(dt, mirando) {
    recuo = Math.max(0, recuo - dt * 9);
    recarga = Math.max(0, recarga - dt / 2.2);
    troca = Math.max(0, troca - dt * 4);

    claraoTempo -= dt;
    const clarao = modelo?.userData?.clarao;
    if (clarao && claraoTempo <= 0) clarao.visible = false;

    // Mirando, a arma centraliza e chega mais perto do olho.
    const alvoX = mirando ? 0.0 : POSICAO_BASE.x;
    const alvoY = (mirando ? -0.18 : POSICAO_BASE.y) - recarga * 0.25 - troca * 0.3;
    const alvoZ = POSICAO_BASE.z + recuo * 0.09;

    suporte.position.x += (alvoX - suporte.position.x) * Math.min(1, dt * 14);
    suporte.position.y += (alvoY - suporte.position.y) * Math.min(1, dt * 14);
    suporte.position.z = alvoZ;
    suporte.rotation.x = recuo * 0.14 + recarga * 0.9;
  }

  function esconder(escondida) {
    suporte.visible = !escondida;
  }

  return { mostrar, disparar, recarregar, atualizar, esconder };
}
