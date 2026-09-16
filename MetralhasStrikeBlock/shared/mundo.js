/**
 * A grade de voxels do mundo e as consultas geométricas sobre ela.
 *
 * Uma arena 64×32×64 cabe inteira num Uint8Array de 128 KB, então nada aqui é
 * esperto: acesso direto, raycast DDA clássico e pronto. Cliente e servidor
 * usam este mesmo arquivo — o tiro que o servidor valida atravessa exatamente
 * os mesmos blocos que o cliente desenha.
 */

import { MUNDO } from './constantes.js';

// Ids de bloco. 0 é ar; 1–9 são o mapa base, indestrutível; 20+ são blocos
// colocados por jogadores durante o round, destrutíveis.
export const BLOCOS = {
  AR: 0,
  PISO: 1,
  MURO: 2,
  CAIXA: 3,
  DEGRAU: 4,
  BASE_AZUL: 5,
  BASE_VERMELHA: 6,
  TORRE: 7,
  JOGADOR_AZUL: 20,
  JOGADOR_VERMELHO: 21
};

export function ehBlocoDeJogador(id) {
  return id >= 20;
}

export function ehSolido(id) {
  return id !== BLOCOS.AR;
}

export function criarMundo() {
  const { TAM_X, TAM_Y, TAM_Z } = MUNDO;
  return {
    tamX: TAM_X,
    tamY: TAM_Y,
    tamZ: TAM_Z,
    blocos: new Uint8Array(TAM_X * TAM_Y * TAM_Z)
  };
}

export function indice(mundo, x, y, z) {
  return x + z * mundo.tamX + y * mundo.tamX * mundo.tamZ;
}

export function dentro(mundo, x, y, z) {
  return x >= 0 && x < mundo.tamX && y >= 0 && y < mundo.tamY && z >= 0 && z < mundo.tamZ;
}

/** Fora do mundo devolve ar: cair para fora é tratado pela física, não aqui. */
export function obterBloco(mundo, x, y, z) {
  if (!dentro(mundo, x, y, z)) return BLOCOS.AR;
  return mundo.blocos[indice(mundo, x, y, z)];
}

export function definirBloco(mundo, x, y, z, id) {
  if (!dentro(mundo, x, y, z)) return;
  mundo.blocos[indice(mundo, x, y, z)] = id;
}

/** O bloco (inteiro) que contém uma coordenada contínua. */
export function blocoDe(v) {
  return Math.floor(v);
}

/**
 * A caixa do jogador (pés em `pos`, largura/altura da física) intersecta algum
 * bloco sólido? Usada pela física para colisão e pelo servidor para validar
 * posições reportadas.
 */
export function caixaColide(mundo, pos, largura, altura) {
  const meia = largura / 2;
  const x0 = blocoDe(pos.x - meia);
  const x1 = blocoDe(pos.x + meia - 1e-6);
  const y0 = blocoDe(pos.y);
  const y1 = blocoDe(pos.y + altura - 1e-6);
  const z0 = blocoDe(pos.z - meia);
  const z1 = blocoDe(pos.z + meia - 1e-6);

  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (ehSolido(obterBloco(mundo, x, y, z))) return true;
      }
    }
  }
  return false;
}

/**
 * Raycast DDA (Amanatides & Woo): caminha bloco a bloco ao longo do raio até
 * bater num sólido ou estourar o alcance. Devolve
 * `{ x, y, z, dist, normal: {x,y,z} }` do bloco atingido, ou null.
 *
 * `normal` aponta para fora da face atingida — é onde um bloco novo seria
 * colocado e para onde as partículas de impacto voam.
 */
export function raycastVoxel(mundo, origem, direcao, alcanceMax) {
  const comprimento = Math.hypot(direcao.x, direcao.y, direcao.z);
  if (comprimento === 0) return null;
  const dx = direcao.x / comprimento;
  const dy = direcao.y / comprimento;
  const dz = direcao.z / comprimento;

  let x = blocoDe(origem.x);
  let y = blocoDe(origem.y);
  let z = blocoDe(origem.z);

  const passoX = dx > 0 ? 1 : -1;
  const passoY = dy > 0 ? 1 : -1;
  const passoZ = dz > 0 ? 1 : -1;

  // Distância ao longo do raio até cruzar a próxima fronteira de bloco em cada
  // eixo, e quanto ela cresce a cada bloco atravessado.
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  const borda = (v, bloco, passo) => (passo > 0 ? bloco + 1 - v : v - bloco);
  let tMaxX = dx !== 0 ? borda(origem.x, x, passoX) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? borda(origem.y, y, passoY) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? borda(origem.z, z, passoZ) * tDeltaZ : Infinity;

  let dist = 0;
  let normal = { x: 0, y: 0, z: 0 };

  // Se a origem já está dentro de um sólido (cano encostado na parede), o
  // primeiro bloco conta como impacto imediato.
  if (ehSolido(obterBloco(mundo, x, y, z))) {
    return { x, y, z, dist: 0, normal: { x: 0, y: 0, z: 0 } };
  }

  while (dist <= alcanceMax) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += passoX;
      dist = tMaxX;
      tMaxX += tDeltaX;
      normal = { x: -passoX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += passoY;
      dist = tMaxY;
      tMaxY += tDeltaY;
      normal = { x: 0, y: -passoY, z: 0 };
    } else {
      z += passoZ;
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = { x: 0, y: 0, z: -passoZ };
    }

    if (dist > alcanceMax) return null;

    // Sair da caixa do mundo por cima ou pelos lados encerra o raio: não há
    // nada sólido lá fora para acertar.
    if (!dentro(mundo, x, y, z)) {
      const saiuDeVez =
        (passoX > 0 ? x >= mundo.tamX : x < 0) ||
        (passoY > 0 ? y >= mundo.tamY : y < 0) ||
        (passoZ > 0 ? z >= mundo.tamZ : z < 0);
      if (saiuDeVez) return null;
      continue;
    }

    if (ehSolido(obterBloco(mundo, x, y, z))) {
      return { x, y, z, dist, normal };
    }
  }
  return null;
}

/**
 * Interseção raio × AABB (slab method). Devolve a distância até a entrada da
 * caixa, ou null se o raio não a cruza dentro do alcance. Usada para acertar
 * jogadores: cada jogador vira duas caixas (corpo e cabeça).
 */
export function raioContraCaixa(origem, direcao, min, max, alcanceMax) {
  let tMin = 0;
  let tMax = alcanceMax;

  for (const eixo of ['x', 'y', 'z']) {
    const d = direcao[eixo];
    const o = origem[eixo];
    if (Math.abs(d) < 1e-9) {
      if (o < min[eixo] || o > max[eixo]) return null;
      continue;
    }
    let t1 = (min[eixo] - o) / d;
    let t2 = (max[eixo] - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/**
 * Existe linha de visão desobstruída entre dois pontos? Usada pela granada
 * (parede bloqueia a explosão) e pelos testes do mapa (spawns não podem se ver).
 */
export function linhaLivre(mundo, a, b) {
  const direcao = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const dist = Math.hypot(direcao.x, direcao.y, direcao.z);
  if (dist < 1e-6) return true;
  const impacto = raycastVoxel(mundo, a, direcao, dist);
  return impacto === null;
}
