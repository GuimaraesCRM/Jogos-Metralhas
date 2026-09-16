/**
 * Efeitos visuais efêmeros: tracers de tiro, partículas de impacto, granadas
 * voando e explosões. Tudo geometria simples com vida curta — o atualizar(dt)
 * anda as animações e recolhe o lixo.
 */

import * as THREE from '../../vendor/three.module.js';

export function criarEfeitos(cena) {
  const vivos = []; // { objeto, vida, tipo, vel? }
  const granadas = new Map(); // id -> mesh

  const geometriaParticula = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  const geometriaGranada = new THREE.SphereGeometry(0.14, 8, 8);
  const materialGranada = new THREE.MeshLambertMaterial({ color: 0x3d4a3a });

  function tracer(origem, impacto) {
    const pontos = [
      new THREE.Vector3(origem.x, origem.y, origem.z),
      new THREE.Vector3(impacto.x, impacto.y, impacto.z)
    ];
    const geometria = new THREE.BufferGeometry().setFromPoints(pontos);
    const material = new THREE.LineBasicMaterial({
      color: 0xffe9a3,
      transparent: true,
      opacity: 0.85
    });
    const linha = new THREE.Line(geometria, material);
    cena.add(linha);
    vivos.push({ objeto: linha, vida: 0.07, tipo: 'tracer' });
  }

  function impactoBloco(pos, corHex = 0x9aa7bd) {
    for (let i = 0; i < 6; i++) {
      const material = new THREE.MeshBasicMaterial({ color: corHex, transparent: true });
      const particula = new THREE.Mesh(geometriaParticula, material);
      particula.position.set(pos.x, pos.y, pos.z);
      cena.add(particula);
      vivos.push({
        objeto: particula,
        vida: 0.4,
        tipo: 'particula',
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3.5,
          (Math.random() - 0.5) * 4
        )
      });
    }
  }

  function explosao(pos) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.85
    });
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), material);
    bola.position.set(pos.x, pos.y, pos.z);
    cena.add(bola);
    vivos.push({ objeto: bola, vida: 0.35, tipo: 'explosao' });
    impactoBloco(pos, 0x6b6f77);
    impactoBloco(pos, 0xffb347);
  }

  /** Granadas em voo vêm no snapshot; as que sumirem de lá são removidas. */
  function sincronizarGranadas(lista) {
    const vistos = new Set();
    for (const g of lista) {
      vistos.add(g.id);
      let mesh = granadas.get(g.id);
      if (!mesh) {
        mesh = new THREE.Mesh(geometriaGranada, materialGranada);
        granadas.set(g.id, mesh);
        cena.add(mesh);
      }
      mesh.position.set(g.pos[0], g.pos[1], g.pos[2]);
    }
    for (const [id, mesh] of granadas) {
      if (!vistos.has(id)) {
        cena.remove(mesh);
        granadas.delete(id);
      }
    }
  }

  function atualizar(dt) {
    for (let i = vivos.length - 1; i >= 0; i--) {
      const efeito = vivos[i];
      efeito.vida -= dt;

      if (efeito.tipo === 'particula') {
        efeito.vel.y -= 12 * dt;
        efeito.objeto.position.addScaledVector(efeito.vel, dt);
        efeito.objeto.material.opacity = Math.max(0, efeito.vida / 0.4);
      } else if (efeito.tipo === 'explosao') {
        const fator = 1 + (0.35 - efeito.vida) * 16;
        efeito.objeto.scale.setScalar(fator);
        efeito.objeto.material.opacity = Math.max(0, efeito.vida / 0.35) * 0.85;
      } else if (efeito.tipo === 'tracer') {
        efeito.objeto.material.opacity = Math.max(0, efeito.vida / 0.07) * 0.85;
      }

      if (efeito.vida <= 0) {
        cena.remove(efeito.objeto);
        if (efeito.objeto.geometry !== geometriaParticula) efeito.objeto.geometry.dispose();
        efeito.objeto.material.dispose();
        vivos.splice(i, 1);
      }
    }
  }

  function limpar() {
    for (const efeito of vivos) cena.remove(efeito.objeto);
    vivos.length = 0;
    for (const mesh of granadas.values()) cena.remove(mesh);
    granadas.clear();
  }

  return { tracer, impactoBloco, explosao, sincronizarGranadas, atualizar, limpar };
}
