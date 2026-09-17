/**
 * Estúdio de modelos — ferramenta de desenvolvimento, fora do jogo.
 *
 * Mostra o boneco (com as animações de andar, agachar e mirar) e cada arma em
 * primeira pessoa, para ajustar proporção, cor e pose sem precisar entrar numa
 * partida e correr até o inimigo. Abre com `npm run estudio`.
 */

import * as THREE from '../vendor/three.module.js';
import { ARMAS } from '../../shared/armas.js';
import { TIMES } from '../../shared/constantes.js';
import { criarJogadores } from './mundo/jogadores.js';
import { criarArmaFps } from './mundo/arma-fps.js';

const tela = document.getElementById('tela');
const barra = document.getElementById('barra');
const legenda = document.getElementById('legenda');

const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// --- cena do boneco ---------------------------------------------------------

const cena = new THREE.Scene();
cena.background = new THREE.Color(0x2a3550);
cena.add(new THREE.HemisphereLight(0xcfe0f7, 0x4a5262, 1.5));
const sol = new THREE.DirectionalLight(0xfff2d8, 1.6);
sol.position.set(3, 5, 2);
cena.add(sol);
const contra = new THREE.DirectionalLight(0xaec4e8, 0.55);
contra.position.set(-3, 3, -2);
cena.add(contra);

// Chão quadriculado, para dar escala e horizonte.
const chao = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshLambertMaterial({ color: 0x7c828c })
);
chao.rotation.x = -Math.PI / 2;
cena.add(chao);
for (let i = -6; i <= 6; i++) {
  const linha = new THREE.Mesh(
    new THREE.BoxGeometry(i % 2 === 0 ? 0.04 : 0.02, 0.01, 24),
    new THREE.MeshLambertMaterial({ color: 0x646b78 })
  );
  linha.position.set(i, 0.006, 0);
  cena.add(linha);
}

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
const bonecos = criarJogadores(cena);
const armaFps = criarArmaFps();

// --- controles --------------------------------------------------------------

const estado = {
  modo: 'boneco',
  arma: 'mc47',
  time: TIMES.AZUL,
  andando: true,
  agachado: false,
  mirando: false,
  orbita: 0,
  distancia: 3.4,
  altura: 1.1
};

function botao(rotulo, aoClicar, ativoSe) {
  const b = document.createElement('button');
  b.textContent = rotulo;
  b.addEventListener('click', () => {
    aoClicar();
    atualizarBotoes();
  });
  b.dataset.ativo = ativoSe;
  barra.appendChild(b);
  return { b, ativoSe };
}

const botoes = [];
botoes.push(botao('Boneco', () => (estado.modo = 'boneco'), () => estado.modo === 'boneco'));
botoes.push(botao('Arma em 1ª pessoa', () => (estado.modo = 'arma'), () => estado.modo === 'arma'));
botoes.push(botao('Andando', () => (estado.andando = !estado.andando), () => estado.andando));
botoes.push(botao('Agachado', () => (estado.agachado = !estado.agachado), () => estado.agachado));
botoes.push(botao('Mirando', () => (estado.mirando = !estado.mirando), () => estado.mirando));
botoes.push(
  botao(
    'Trocar time',
    () => (estado.time = estado.time === TIMES.AZUL ? TIMES.VERMELHO : TIMES.AZUL),
    () => estado.time === TIMES.VERMELHO
  )
);
for (const id of [...Object.keys(ARMAS), 'marreta', 'bloco']) {
  botoes.push(
    botao(
      ARMAS[id]?.nome ?? id,
      () => {
        estado.arma = id;
        armaFps.mostrar(id);
      },
      () => estado.arma === id
    )
  );
}

function atualizarBotoes() {
  for (const { b, ativoSe } of botoes) b.classList.toggle('ativo', Boolean(ativoSe()));
}
atualizarBotoes();

// Arrastar gira a câmera; a roda aproxima.
let arrastando = false;
tela.addEventListener('mousedown', () => (arrastando = true));
window.addEventListener('mouseup', () => (arrastando = false));
window.addEventListener('mousemove', (e) => {
  if (arrastando) estado.orbita -= e.movementX * 0.01;
});
tela.addEventListener('wheel', (e) => {
  estado.distancia = Math.max(1.2, Math.min(9, estado.distancia + e.deltaY * 0.002));
});

// --- laço -------------------------------------------------------------------

function redimensionar() {
  const largura = tela.clientWidth || window.innerWidth;
  const altura = tela.clientHeight || window.innerHeight;
  renderer.setSize(largura, altura, false);
  camera.aspect = largura / altura;
  camera.updateProjectionMatrix();
  armaFps.redimensionar(largura, altura);
}
window.addEventListener('resize', redimensionar);
redimensionar();
armaFps.mostrar(estado.arma);

let anterior = performance.now();
let fase = 0;

function quadro(agora) {
  requestAnimationFrame(quadro);
  const dt = Math.min(0.05, (agora - anterior) / 1000);
  anterior = agora;

  if (estado.modo === 'boneco') {
    // O boneco fica parado no lugar; a "velocidade" alimenta a animação.
    fase += dt;
    bonecos.sincronizar(
      [
        {
          id: 'modelo',
          nome: 'Metralha',
          time: estado.time,
          vivo: true,
          agachado: estado.agachado,
          armaId: estado.arma,
          velocidade: estado.andando ? 5 : 0,
          pos: { x: 0, y: 0, z: 0 },
          // No jogo, yaw 0 olha para -Z; a câmera do estúdio fica em +Z, então
          // sem este meio-giro o boneco apareceria sempre de costas.
          yaw: Math.PI,
          pitch: Math.sin(fase * 0.6) * 0.35
        }
      ],
      dt
    );

    const raio = estado.distancia;
    camera.position.set(
      Math.sin(estado.orbita) * raio,
      estado.altura + 0.6,
      Math.cos(estado.orbita) * raio
    );
    camera.lookAt(0, 1.0, 0);
    renderer.render(cena, camera);
    legenda.textContent = `boneco · ${estado.time} · ${estado.arma} · arraste para girar, roda para aproximar`;
  } else {
    armaFps.atualizar(dt, { mirando: estado.mirando, andando: estado.andando, noChao: true });
    renderer.render(armaFps.cena, armaFps.camera);
    legenda.textContent = `arma em 1ª pessoa · ${estado.arma} · ${estado.mirando ? 'mirando' : 'no quadril'}`;
  }
}
requestAnimationFrame(quadro);

// Atalhos: espaço dispara, R recarrega, F golpeia (para ver as animações).
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') armaFps.disparar();
  if (e.code === 'KeyR') armaFps.recarregar();
  if (e.code === 'KeyF') armaFps.golpear();
});
