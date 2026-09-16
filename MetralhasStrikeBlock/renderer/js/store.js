/**
 * O que sobrevive entre sessões, no localStorage.
 *
 * O crachá (sala + jogadorId + token) é o que devolve o jogador à partida
 * depois de uma queda: o app tenta reconectar com ele ao abrir.
 */

const CHAVES = {
  NOME: 'msb.nome',
  SERVIDOR: 'msb.servidor',
  CRACHA: 'msb.cracha'
};

function ler(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // localStorage indisponível não pode derrubar o jogo.
  }
}

export const store = {
  get nome() {
    return ler(CHAVES.NOME) || '';
  },
  set nome(valor) {
    gravar(CHAVES.NOME, valor);
  },

  get servidor() {
    return ler(CHAVES.SERVIDOR) || '';
  },
  set servidor(valor) {
    gravar(CHAVES.SERVIDOR, valor);
  },

  get cracha() {
    try {
      const bruto = ler(CHAVES.CRACHA);
      return bruto ? JSON.parse(bruto) : null;
    } catch {
      return null;
    }
  },
  set cracha(valor) {
    gravar(CHAVES.CRACHA, valor ? JSON.stringify(valor) : null);
  }
};
