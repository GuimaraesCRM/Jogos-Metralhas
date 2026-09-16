/**
 * A ponta da interface na ponte com o launcher do bundle.
 *
 * A identidade pode vir de dois lugares, nesta ordem:
 *  1. do launcher (via electron/identidade-launcher.cjs, atravessando o IPC) —
 *     nome e foto vêm prontos e o campo de nome fica travado;
 *  2. do que o jogador digitou da última vez (localStorage).
 *
 * Quando o launcher existir de verdade, nada nesta interface muda: só o
 * conteúdo entregue pelo IPC passa a vir preenchido.
 */

import { limparNome, limparAvatar } from '../../shared/protocolo.js';
import { store } from './store.js';

export async function identidadeInicial() {
  let doLauncher = null;
  try {
    doLauncher = await window.appDesktop?.launcher?.identidade();
  } catch {
    doLauncher = null;
  }

  if (doLauncher && (doLauncher.nome || doLauncher.avatar)) {
    return {
      nome: limparNome(doLauncher.nome, ''),
      avatar: limparAvatar(doLauncher.avatar),
      sala: typeof doLauncher.sala === 'string' ? doLauncher.sala.toUpperCase() : null,
      travado: Boolean(doLauncher.nome),
      origem: 'launcher'
    };
  }

  return {
    nome: store.nome,
    avatar: null,
    sala: null,
    travado: false,
    origem: 'manual'
  };
}
