/**
 * Os bonecos dos outros jogadores: humanoides de caixas na cor do time, com
 * plaquinha de nome em cima. O próprio jogador não tem boneco — a câmera é
 * ele (primeira pessoa).
 *
 * Quem decide ONDE cada boneco fica é a interpolação em simulacao-local.js;
 * aqui só se aplica o estado recebido.
 */

import * as THREE from '../../vendor/three.module.js';
import { TIMES } from '../../../shared/constantes.js';

const CORES = {
  [TIMES.AZUL]: { corpo: 0x2b5ca8, claro: 0x4d8fe0 },
  [TIMES.VERMELHO]: { corpo: 0xa82b2b, claro: 0xe05252 }
};

function etiquetaDeNome(nome) {
  const tela = document.createElement('canvas');
  tela.width = 256;
  tela.height = 64;
  const pincel = tela.getContext('2d');
  pincel.font = '600 30px "Segoe UI", sans-serif';
  pincel.textAlign = 'center';
  pincel.textBaseline = 'middle';
  pincel.fillStyle = 'rgba(8, 10, 16, 0.6)';
  const largura = Math.min(240, pincel.measureText(nome).width + 24);
  pincel.beginPath();
  pincel.roundRect((256 - largura) / 2, 8, largura, 48, 10);
  pincel.fill();
  pincel.fillStyle = '#e8edf5';
  pincel.fillText(nome, 128, 34);

  const textura = new THREE.CanvasTexture(tela);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: true }));
  sprite.scale.set(1.7, 0.42, 1);
  return sprite;
}

function criarBoneco(time, nome) {
  const grupo = new THREE.Group();
  const cores = CORES[time] ?? CORES[TIMES.AZUL];
  const materialCorpo = new THREE.MeshLambertMaterial({ color: cores.corpo });
  const materialClaro = new THREE.MeshLambertMaterial({ color: cores.claro });

  const pernas = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), materialCorpo);
  pernas.position.y = 0.4;
  grupo.add(pernas);

  const tronco = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.6, 0.34), materialClaro);
  tronco.position.y = 1.1;
  grupo.add(tronco);

  // A cabeça vive num pivô próprio para acompanhar o pitch da mira.
  const pivoCabeca = new THREE.Group();
  pivoCabeca.position.y = 1.62;
  const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), materialCorpo);
  cabeca.position.y = 0.18;
  pivoCabeca.add(cabeca);
  grupo.add(pivoCabeca);

  // A "arma" do boneco: um paralelepípedo escuro apontando para a frente.
  const arma = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.09, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x22262e })
  );
  arma.position.set(0.28, 1.25, -0.3);
  grupo.add(arma);

  const etiqueta = etiquetaDeNome(nome);
  etiqueta.position.y = 2.25;
  grupo.add(etiqueta);

  return { grupo, pivoCabeca, etiqueta };
}

export function criarJogadores(cena) {
  const bonecos = new Map(); // id -> { grupo, pivoCabeca }

  /**
   * `estados`: lista de { id, nome, time, pos {x,y,z}, yaw, pitch, vivo,
   * agachado }, já interpolados. Bonecos que sumirem da lista são removidos.
   */
  function sincronizar(estados) {
    const vistos = new Set();

    for (const estado of estados) {
      vistos.add(estado.id);
      let boneco = bonecos.get(estado.id);
      if (!boneco) {
        boneco = criarBoneco(estado.time, estado.nome);
        boneco.time = estado.time;
        bonecos.set(estado.id, boneco);
        cena.add(boneco.grupo);
      }

      // Troca de lado no meio da partida: recria com a cor nova.
      if (boneco.time !== estado.time) {
        cena.remove(boneco.grupo);
        boneco = criarBoneco(estado.time, estado.nome);
        boneco.time = estado.time;
        bonecos.set(estado.id, boneco);
        cena.add(boneco.grupo);
      }

      boneco.grupo.visible = estado.vivo;
      boneco.grupo.position.set(estado.pos.x, estado.pos.y, estado.pos.z);
      boneco.grupo.rotation.y = estado.yaw;
      boneco.pivoCabeca.rotation.x = estado.pitch * 0.8;
      boneco.grupo.scale.y = estado.agachado ? 0.8 : 1;
    }

    for (const [id, boneco] of bonecos) {
      if (!vistos.has(id)) {
        cena.remove(boneco.grupo);
        bonecos.delete(id);
      }
    }
  }

  function limpar() {
    for (const boneco of bonecos.values()) cena.remove(boneco.grupo);
    bonecos.clear();
  }

  return { sincronizar, limpar };
}
