/**
 * Endereço do servidor de salas.
 *
 * Trocar a linha abaixo pelo endereço do seu servidor depois de publicá-lo
 * (ver LEIAME.md). O valor aqui é só o ponto de partida — quem abre o app pode
 * apontar para outro servidor pela engrenagem na tela inicial, e a escolha fica
 * guardada na máquina dele.
 *
 * Formato: ws:// para servidor local, wss:// para servidor publicado na internet.
 */
export const SERVIDOR_PADRAO = 'ws://localhost:8787';

/** Onde guardamos as preferências e o crachá de reconexão. */
export const CHAVES = {
  SERVIDOR: 'metralhas-secretos.servidor',
  NOME: 'metralhas-secretos.nome',
  CRACHA: 'metralhas-secretos.cracha'
};

/** Lê do localStorage sem explodir quando o valor está corrompido. */
export function lerGuardado(chave, padrao = null) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? padrao : JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

export function guardar(chave, valor) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo privativo ou armazenamento cheio: o jogo continua, sem memória */
  }
}

export const enderecoDoServidor = () => lerGuardado(CHAVES.SERVIDOR, SERVIDOR_PADRAO);
