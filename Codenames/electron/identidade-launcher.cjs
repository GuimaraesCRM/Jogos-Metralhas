/**
 * ---------------------------------------------------------------------------
 * Ponte com o launcher do bundle (ponto de integração futura)
 * ---------------------------------------------------------------------------
 *
 * Quando o launcher dos Jogos Metralhas existir, é ele quem vai saber o apelido
 * e a foto do jogador — o jogo não deveria perguntar de novo. O contrato final
 * ainda não está definido, então esta função aceita as duas formas mais
 * prováveis e ignora o que não reconhece:
 *
 *   1. Argumentos de linha de comando, que é como um launcher normalmente abre
 *      um jogo:
 *        "Metralhas Secretos.exe" --jogador-nome="Lucas" --jogador-avatar="https://..." --sala=ABCD
 *
 *   2. Variáveis de ambiente, úteis quando o launcher prefere não expor dados
 *      na linha de comando (que fica visível na lista de processos):
 *        METRALHAS_JOGADOR_NOME, METRALHAS_JOGADOR_AVATAR, METRALHAS_SALA
 *
 *   3. Um pacote único em base64, para quando o launcher tiver mais campos:
 *        --jogador=<base64 de {"nome":"...","avatar":"...","sala":"..."}>
 *
 * Para trocar o contrato, mexa só aqui e em renderer/js/launcher.js. Nada mais
 * do jogo sabe de onde vem a identidade.
 */
function identidadeDoLauncher(argv = process.argv, ambiente = process.env) {
  const valorDoArgumento = (chave) => {
    const arg = argv.find((a) => a.startsWith(`--${chave}=`));
    return arg ? arg.slice(chave.length + 3) : null;
  };

  let pacote = {};
  const empacotado = valorDoArgumento('jogador');
  if (empacotado) {
    try {
      pacote = JSON.parse(Buffer.from(empacotado, 'base64').toString('utf8'));
    } catch {
      // Pacote ilegível não derruba o jogo: cai no fluxo normal de digitar o nome.
      pacote = {};
    }
  }

  const nome = valorDoArgumento('jogador-nome') ?? ambiente.METRALHAS_JOGADOR_NOME ?? pacote.nome ?? null;
  const avatar = valorDoArgumento('jogador-avatar') ?? ambiente.METRALHAS_JOGADOR_AVATAR ?? pacote.avatar ?? null;
  const sala = valorDoArgumento('sala') ?? ambiente.METRALHAS_SALA ?? pacote.sala ?? null;

  if (!nome && !avatar && !sala) return null;
  return { nome, avatar, sala, origem: 'launcher' };
}


module.exports = { identidadeDoLauncher };
