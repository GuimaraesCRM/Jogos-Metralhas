/**
 * Identidade do jogador: launcher primeiro, digitação como reserva.
 *
 * Este arquivo e `electron/main.cjs` são **os dois únicos lugares** que sabem de
 * onde vem o apelido e a foto de quem está jogando. O launcher dos Jogos
 * Metralhas ainda não existe e o contrato dele não está definido; quando
 * estiver, é aqui que se encaixa, sem mexer no lobby, no servidor ou nas regras.
 *
 * Hoje o comportamento é o de sempre: se o launcher não disser nada, o jogo
 * pergunta o nome e lembra dele na próxima vez.
 */

import { CHAVES, lerGuardado } from './config.js';
import { limparAvatar, limparNome } from '/shared/protocolo.js';

/**
 * Pergunta ao processo principal se veio identidade de fora.
 *
 * Nunca lança: qualquer falha (rodando fora do Electron, ponte indisponível,
 * launcher antigo) cai no caminho manual, que é o que funciona hoje.
 */
export async function identidadeDoLauncher() {
  try {
    const bruta = await window.appDesktop?.launcher?.identidade();
    if (!bruta) return null;

    // O que vem de fora passa pela mesma limpeza do que vem do jogador: o
    // launcher é de confiança, mas um avatar mal formado não pode virar
    // conteúdo ativo dentro da interface.
    const nome = bruta.nome ? limparNome(bruta.nome, '') : '';
    const avatar = limparAvatar(bruta.avatar);
    const sala = typeof bruta.sala === 'string' ? bruta.sala.trim().toUpperCase() : null;

    if (!nome && !avatar && !sala) return null;
    return { nome: nome || null, avatar, sala: sala || null, origem: bruta.origem ?? 'launcher' };
  } catch {
    return null;
  }
}

/**
 * Identidade final usada pela tela inicial: o que o launcher mandou, ou o que
 * ficou guardado da última partida nesta máquina.
 *
 * `travado` diz se o nome veio de fora — nesse caso a tela mostra quem você é
 * em vez de pedir para digitar, porque quem manda no apelido é o launcher.
 */
export async function identidadeInicial() {
  const doLauncher = await identidadeDoLauncher();

  if (doLauncher?.nome) {
    return {
      nome: doLauncher.nome,
      avatar: doLauncher.avatar,
      sala: doLauncher.sala,
      travado: true,
      origem: doLauncher.origem
    };
  }

  return {
    nome: lerGuardado(CHAVES.NOME, '') ?? '',
    avatar: doLauncher?.avatar ?? null,
    sala: doLauncher?.sala ?? null,
    travado: false,
    origem: null
  };
}
