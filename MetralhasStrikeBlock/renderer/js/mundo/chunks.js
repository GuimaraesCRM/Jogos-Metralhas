/**
 * A malha do mundo voxel.
 *
 * O mundo é fatiado em chunks de 16×32×16. Cada chunk vira UMA geometria com
 * as faces mescladas, e só as faces expostas ao ar são geradas — num mapa
 * 64×32×64 isso dá poucos milhares de quads no total. Editar um bloco
 * reconstrói só o chunk dele (1–2 ms, imperceptível).
 *
 * As cores são por vértice: cada id de bloco tem uma cor base, cada face um
 * sombreado fixo (topo claro, fundo escuro) e cada bloco uma variação sutil
 * de tom — é o que faz um mundo de cubos "ler" como Minecraft e não como
 * plástico liso.
 */

import * as THREE from '../../vendor/three.module.js';
import { BLOCOS, obterBloco } from '../../../shared/mundo.js';

const LADO_CHUNK = 16;

export const COR_DO_BLOCO = {
  [BLOCOS.PISO]: 0x7c828c,
  [BLOCOS.MURO]: 0x646b78,
  [BLOCOS.CAIXA]: 0xa0784a,
  [BLOCOS.DEGRAU]: 0x8a919d,
  [BLOCOS.BASE_AZUL]: 0x3a6ab8,
  [BLOCOS.BASE_VERMELHA]: 0xb83a3a,
  [BLOCOS.TORRE]: 0x565e6b,
  [BLOCOS.JOGADOR_AZUL]: 0x6fa1e8,
  [BLOCOS.JOGADOR_VERMELHO]: 0xe87a6f
};

// Sombreado fixo por face: topo, fundo, ±x, ±z.
const SOMBRA_FACE = { topo: 1.0, fundo: 0.5, ladoX: 0.8, ladoZ: 0.66 };

// Cada face: 4 cantos (em coordenadas do cubo unitário) + normal + sombra.
const FACES = [
  { dir: [0, 1, 0], sombra: SOMBRA_FACE.topo, cantos: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], sombra: SOMBRA_FACE.fundo, cantos: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], sombra: SOMBRA_FACE.ladoX, cantos: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [-1, 0, 0], sombra: SOMBRA_FACE.ladoX, cantos: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: [0, 0, 1], sombra: SOMBRA_FACE.ladoZ, cantos: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], sombra: SOMBRA_FACE.ladoZ, cantos: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }
];

/** Variação de tom por bloco: hash barato e estável de (x,y,z). */
function variacao(x, y, z) {
  const h = (x * 374761393 + y * 668265263 + z * 2147483647) & 0xffff;
  return 0.94 + (h / 0xffff) * 0.12;
}

export function criarMalhaDoMundo(mundo, cena) {
  const chunksX = Math.ceil(mundo.tamX / LADO_CHUNK);
  const chunksZ = Math.ceil(mundo.tamZ / LADO_CHUNK);
  const malhas = new Array(chunksX * chunksZ).fill(null);

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const grupo = new THREE.Group();
  cena.add(grupo);

  const cor = new THREE.Color();

  function construirChunk(cx, cz) {
    const posicoes = [];
    const normais = [];
    const cores = [];
    const indices = [];

    const x0 = cx * LADO_CHUNK;
    const z0 = cz * LADO_CHUNK;
    const x1 = Math.min(x0 + LADO_CHUNK, mundo.tamX);
    const z1 = Math.min(z0 + LADO_CHUNK, mundo.tamZ);

    for (let y = 0; y < mundo.tamY; y++) {
      for (let z = z0; z < z1; z++) {
        for (let x = x0; x < x1; x++) {
          const id = obterBloco(mundo, x, y, z);
          if (id === BLOCOS.AR) continue;

          cor.setHex(COR_DO_BLOCO[id] ?? 0xff00ff);
          const tom = variacao(x, y, z);

          for (const face of FACES) {
            const vizinho = obterBloco(mundo, x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            if (vizinho !== BLOCOS.AR) continue;

            const base = posicoes.length / 3;
            for (const [dx, dy, dz] of face.cantos) {
              posicoes.push(x + dx, y + dy, z + dz);
              normais.push(face.dir[0], face.dir[1], face.dir[2]);
              const s = face.sombra * tom;
              cores.push(cor.r * s, cor.g * s, cor.b * s);
            }
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    const indiceChunk = cx + cz * chunksX;
    if (malhas[indiceChunk]) {
      grupo.remove(malhas[indiceChunk]);
      malhas[indiceChunk].geometry.dispose();
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3));
    geometria.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3));
    geometria.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    geometria.setIndex(indices);

    const malha = new THREE.Mesh(geometria, material);
    malha.frustumCulled = true;
    malhas[indiceChunk] = malha;
    grupo.add(malha);
  }

  function reconstruirTudo() {
    for (let cz = 0; cz < chunksZ; cz++) {
      for (let cx = 0; cx < chunksX; cx++) construirChunk(cx, cz);
    }
  }

  /** Reconstrói o chunk do bloco editado — e o vizinho, se estava na borda. */
  function aoMudarBloco(x, z) {
    const cx = Math.floor(x / LADO_CHUNK);
    const cz = Math.floor(z / LADO_CHUNK);
    const afetados = new Set([`${cx},${cz}`]);
    if (x % LADO_CHUNK === 0 && cx > 0) afetados.add(`${cx - 1},${cz}`);
    if (x % LADO_CHUNK === LADO_CHUNK - 1 && cx < chunksX - 1) afetados.add(`${cx + 1},${cz}`);
    if (z % LADO_CHUNK === 0 && cz > 0) afetados.add(`${cx},${cz - 1}`);
    if (z % LADO_CHUNK === LADO_CHUNK - 1 && cz < chunksZ - 1) afetados.add(`${cx},${cz + 1}`);
    for (const chave of afetados) {
      const [a, b] = chave.split(',').map(Number);
      construirChunk(a, b);
    }
  }

  function destruir() {
    for (const malha of malhas) {
      if (!malha) continue;
      grupo.remove(malha);
      malha.geometry.dispose();
    }
    cena.remove(grupo);
    material.dispose();
  }

  reconstruirTudo();

  return { reconstruirTudo, aoMudarBloco, destruir };
}
