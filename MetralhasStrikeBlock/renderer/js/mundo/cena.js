/**
 * A cena Three.js: câmera, luzes, céu e o renderer preso ao canvas.
 *
 * O Three chega aqui vendorado (scripts/vendor.cjs copia o módulo para
 * renderer/vendor/), então o import é um caminho relativo comum — sem bundler,
 * sem importmap, sem CDN.
 */

import * as THREE from '../../vendor/three.module.js';
import { FOV_PADRAO } from '../config.js';

export function criarCena(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Tom filmico segura os brilhos do metal sem estourar o branco.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x2a3550);
  // A névoa esconde o "fim do mundo" e dá profundidade ao mapa pequeno.
  cena.fog = new THREE.Fog(0x2a3550, 60, 130);

  const camera = new THREE.PerspectiveCamera(FOV_PADRAO, 1, 0.05, 220);
  camera.rotation.order = 'YXZ'; // yaw primeiro, depois pitch — padrão FPS

  // Luz ambiente fria vinda do céu + sol quente lateral. Sem sombras: o
  // sombreamento por face dos chunks já dá a leitura de volume.
  const hemisferio = new THREE.HemisphereLight(0xcfe0f7, 0x4a5262, 1.5);
  cena.add(hemisferio);

  const sol = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sol.position.set(30, 50, 15);
  cena.add(sol);

  // Uma segunda direcional fraca do lado oposto impede que as faces viradas
  // para longe do sol virem silhuetas pretas.
  const contraluz = new THREE.DirectionalLight(0xaec4e8, 0.55);
  contraluz.position.set(-25, 30, -20);
  cena.add(contraluz);

  function redimensionar() {
    // Mede o container, não o canvas: o tamanho do canvas é consequência do
    // CSS, e medi-lo aqui deixaria o renderer refém do próprio valor anterior.
    const caixa = canvas.parentElement;
    const largura = caixa?.clientWidth || window.innerWidth;
    const altura = caixa?.clientHeight || window.innerHeight;
    // updateStyle = false: quem manda no tamanho de exibição é o CSS; aqui só
    // ajustamos a resolução do buffer.
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
  }

  function definirFov(fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', redimensionar);
  redimensionar();

  return { THREE, renderer, cena, camera, redimensionar, definirFov };
}
