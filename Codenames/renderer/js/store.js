/**
 * Guarda o último estado recebido do servidor e avisa quem quiser saber.
 *
 * O app não calcula nada sobre a partida: ele desenha o que veio. Este arquivo
 * é só a caixa onde esse "veio" fica, mais um pub/sub de três linhas.
 */

const ouvintes = new Set();

export const loja = {
  estado: null,        // vista da sala, do jeito que o servidor mandou
  conexao: 'parado',   // parado | conectando | conectado | caiu
  ultimoEvento: null,

  definirEstado(estado) {
    this.estado = estado;
    this.avisar();
  },

  definirConexao(situacao) {
    if (this.conexao === situacao) return;
    this.conexao = situacao;
    this.avisar();
  },

  registrarEvento(evento) {
    this.ultimoEvento = evento;
  },

  limpar() {
    this.estado = null;
    this.avisar();
  },

  avisar() {
    for (const ouvinte of ouvintes) ouvinte(this);
  }
};

/** Inscreve um ouvinte e devolve a função que o remove. */
export function aoMudar(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}
