/**
 * Copia o Three.js de node_modules para renderer/vendor/.
 *
 * A interface roda sem bundler: os módulos ES são servidos direto pelo
 * protocolo app://, que só enxerga renderer/ e shared/. Copiar o arquivo do
 * Three para dentro de renderer/ evita mapear node_modules no protocolo e
 * garante que o empacotado leve exatamente o mesmo arquivo do desenvolvimento.
 *
 * Roda no postinstall e antes do build. A pasta renderer/vendor/ fica no
 * .gitignore: é artefato derivado, npm install a recria.
 */

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'node_modules', 'three', 'build');
const DESTINO = path.join(RAIZ, 'renderer', 'vendor');

// three.module.js importa ./three.core.js nas versões novas do Three; copiar
// os dois mantém o import relativo funcionando.
const ARQUIVOS = ['three.module.js', 'three.core.js'];

if (!fs.existsSync(ORIGEM)) {
  console.error('three não está instalado — rode npm install primeiro.');
  process.exit(1);
}

fs.mkdirSync(DESTINO, { recursive: true });

let copiados = 0;
for (const nome of ARQUIVOS) {
  const de = path.join(ORIGEM, nome);
  if (!fs.existsSync(de)) continue; // versões antigas não têm three.core.js
  fs.copyFileSync(de, path.join(DESTINO, nome));
  copiados++;
}

if (copiados === 0) {
  console.error('nenhum arquivo do Three encontrado em node_modules/three/build');
  process.exit(1);
}
console.log(`vendor: ${copiados} arquivo(s) do Three copiados para renderer/vendor/`);
