/**
 * Ambiente de desenvolvimento.
 *
 * Sobe o servidor de salas local e abre quatro janelas do app de uma vez, para
 * dar para jogar uma partida inteira sozinho: dois mestres e dois operativos.
 * Sem isso, testar qualquer regra de turno exigiria juntar quatro pessoas.
 *
 *   npm run dev            -> 4 janelas
 *   npm run dev -- 6       -> 6 janelas
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const exigir = createRequire(import.meta.url);

const janelas = Number(process.argv[2]) || 4;
const filhos = [];

function iniciar(nome, comando, args, extras = {}) {
  const filho = spawn(comando, args, { cwd: RAIZ, stdio: 'inherit', ...extras });
  filho.on('exit', (codigo) => {
    console.log(`\n[${nome}] terminou (${codigo}). Encerrando o ambiente.`);
    encerrar();
  });
  filhos.push(filho);
  return filho;
}

function encerrar() {
  for (const filho of filhos) {
    if (!filho.killed) filho.kill();
  }
  process.exit(0);
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

console.log(`Servidor local + ${janelas} janelas. Ctrl+C encerra tudo.\n`);

iniciar('servidor', process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: '8787' }
});

// `require('electron')` fora do Electron devolve o caminho do executável.
const electron = exigir('electron');

// ELECTRON_RUN_AS_NODE faz o executável se comportar como Node puro: a janela
// nunca abre e o erro que aparece ("electron não exporta BrowserWindow") não
// entrega a causa. Algumas ferramentas deixam essa variável ligada no ambiente,
// então limpamos antes de abrir o app.
const ambienteDoApp = { ...process.env };
delete ambienteDoApp.ELECTRON_RUN_AS_NODE;

iniciar('app', electron, ['.', `--janelas=${janelas}`], { env: ambienteDoApp });
