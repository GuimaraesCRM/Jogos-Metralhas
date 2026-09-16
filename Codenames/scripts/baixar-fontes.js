/**
 * Baixa os subsets latinos das fontes do projeto e gera renderer/styles/fontes.css.
 *
 * Roda uma vez, na mão (`node scripts/baixar-fontes.js`). Os .woff2 ficam
 * versionados junto com o app: o jogo tem que abrir bonito sem internet, e o
 * .exe empacotado não deveria ir buscar tipografia em servidor de terceiro.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_FONTES = path.join(RAIZ, 'renderer', 'assets', 'fontes');
const SAIDA_CSS = path.join(RAIZ, 'renderer', 'styles', 'fontes.css');

const CONSULTA =
  'https://fonts.googleapis.com/css2' +
  '?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap';

// O Google devolve woff2 só para quem se apresenta como navegador moderno.
const NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const SUBSETS = ['latin', 'latin-ext'];

async function principal() {
  const css = await (await fetch(CONSULTA, { headers: { 'User-Agent': NAVEGADOR } })).text();
  await fs.mkdir(PASTA_FONTES, { recursive: true });

  const blocos = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[\s\S]*?\})/g)];
  const baixados = new Map();
  const regras = [];

  for (const [, subset, bloco] of blocos) {
    if (!SUBSETS.includes(subset)) continue;

    const familia = /font-family:\s*'([^']+)'/.exec(bloco)[1];
    const peso = /font-weight:\s*([^;]+);/.exec(bloco)[1].trim();
    const url = /url\((https:\/\/[^)]+)\)/.exec(bloco)[1];
    const faixa = /unicode-range:\s*([^;]+);/.exec(bloco)[1].trim();

    if (!baixados.has(url)) {
      const arquivo = `${familia.toLowerCase().replace(/ /g, '-')}-${peso}-${subset}.woff2`;
      const dados = Buffer.from(await (await fetch(url)).arrayBuffer());
      await fs.writeFile(path.join(PASTA_FONTES, arquivo), dados);
      baixados.set(url, arquivo);
      console.log(`  ${arquivo} (${Math.round(dados.length / 1024)} KB)`);
    }

    regras.push(
      `@font-face {\n` +
        `  font-family: '${familia}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${peso};\n` +
        `  font-display: swap;\n` +
        `  src: url('../assets/fontes/${baixados.get(url)}') format('woff2');\n` +
        `  unicode-range: ${faixa};\n` +
        `}\n`
    );
  }

  const cabecalho = [
    '/*',
    ' * Fontes embarcadas no app.',
    ' *',
    ' * Arquivo gerado por scripts/baixar-fontes.js — não editar à mão.',
    ' */',
    '',
    ''
  ].join('\n');

  await fs.writeFile(SAIDA_CSS, cabecalho + regras.join('\n'), 'utf8');
  console.log(`\n${regras.length} regras escritas em renderer/styles/fontes.css`);
}

principal().catch((erro) => {
  console.error('Falha ao baixar as fontes:', erro.message);
  process.exit(1);
});
