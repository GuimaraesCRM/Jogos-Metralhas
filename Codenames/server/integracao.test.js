/**
 * Teste de integração: sobe o servidor de verdade, conecta quatro jogadores por
 * WebSocket e joga uma partida inteira até alguém vencer.
 *
 * É o teste que mais vale neste projeto. Ele cobre o caminho que os testes de
 * unidade não alcançam — protocolo, times, consenso, difusão do estado — e é o
 * único lugar onde dá para provar que o operativo não recebe as cores.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = 8899;
const ENDERECO = `ws://127.0.0.1:${PORTA}`;

/** Sobe o servidor num processo separado e espera ele anunciar que está ouvindo. */
async function subirServidor() {
  const processo = spawn(process.execPath, [path.join(AQUI, 'index.js')], {
    env: { ...process.env, PORT: String(PORTA) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await new Promise((resolve, reject) => {
    const prazo = setTimeout(() => reject(new Error('servidor não subiu a tempo')), 8000);
    processo.stdout.on('data', (d) => {
      if (d.toString().includes('ouvindo na porta')) {
        clearTimeout(prazo);
        resolve();
      }
    });
    processo.on('error', reject);
  });

  return processo;
}

/** Cliente de teste: guarda o último estado recebido e sabe esperar por condições. */
class Cliente {
  constructor(nome) {
    this.nome = nome;
    this.estado = null;
    this.erros = [];
    this.eventos = [];
    this.espera = [];
  }

  async conectar() {
    this.ws = new WebSocket(ENDERECO);
    await once(this.ws, 'open');
    this.ws.on('message', (bruto) => this.receber(JSON.parse(bruto.toString())));
    return this;
  }

  receber(msg) {
    if (msg.tipo === 'estado') this.estado = msg.estado;
    if (msg.tipo === 'entrou') Object.assign(this, { jogadorId: msg.jogadorId, codigo: msg.codigo, token: msg.token });
    if (msg.tipo === 'evento') this.eventos.push(msg.evento);
    if (msg.tipo === 'erro') this.erros.push(msg.mensagem);
    // Resolve quem estava esperando por uma condição que agora é verdadeira.
    this.espera = this.espera.filter((p) => {
      if (!p.condicao(this)) return true;
      p.resolver();
      return false;
    });
  }

  enviar(tipo, dados = {}) {
    this.ws.send(JSON.stringify({ tipo, ...dados }));
  }

  /** Espera até `condicao(cliente)` virar verdade, ou falha com uma mensagem clara. */
  ate(condicao, descricao, prazoMs = 5000) {
    if (condicao(this)) return Promise.resolve();
    return new Promise((resolver, rejeitar) => {
      const prazo = setTimeout(() => {
        rejeitar(new Error(`[${this.nome}] tempo esgotado esperando: ${descricao}`));
      }, prazoMs);
      this.espera.push({
        condicao,
        resolver: () => {
          clearTimeout(prazo);
          resolver();
        }
      });
    });
  }

  fechar() {
    this.ws?.close();
  }
}

test('quatro jogadores jogam uma partida inteira pelo servidor', async (t) => {
  const servidor = await subirServidor();
  const clientes = [];
  t.after(() => {
    clientes.forEach((c) => c.fechar());
    servidor.kill();
  });

  const mestreVermelho = await new Cliente('mestre vermelho').conectar();
  const opVermelho = await new Cliente('operativo vermelho').conectar();
  const mestreAzul = await new Cliente('mestre azul').conectar();
  const opAzul = await new Cliente('operativo azul').conectar();
  clientes.push(mestreVermelho, opVermelho, mestreAzul, opAzul);

  // --- lobby ---------------------------------------------------------------

  mestreVermelho.enviar('criar_sala', { nome: 'Ana' });
  await mestreVermelho.ate((c) => c.codigo, 'receber o código da sala');
  const codigo = mestreVermelho.codigo;
  assert.match(codigo, /^[A-Z]{4}$/);

  for (const [cliente, nome] of [
    [opVermelho, 'Bruno'],
    [mestreAzul, 'Carla'],
    [opAzul, 'Diego']
  ]) {
    cliente.enviar('entrar_sala', { codigo, nome });
    await cliente.ate((c) => c.estado, `${nome} entrar na sala`);
  }

  await mestreVermelho.ate((c) => c.estado?.jogadores.length === 4, 'os quatro aparecerem no lobby');
  assert.equal(mestreVermelho.estado.voce.anfitriao, true, 'quem criou é o anfitrião');
  assert.equal(opVermelho.estado.voce.anfitriao, false);

  // Sem times definidos, começar tem que ser recusado.
  mestreVermelho.enviar('iniciar_partida');
  await mestreVermelho.ate((c) => c.erros.length > 0, 'recusa por falta de times');

  mestreVermelho.enviar('escolher_funcao', { time: 'vermelho', funcao: 'mestre' });
  opVermelho.enviar('escolher_funcao', { time: 'vermelho', funcao: 'operativo' });
  mestreAzul.enviar('escolher_funcao', { time: 'azul', funcao: 'mestre' });
  opAzul.enviar('escolher_funcao', { time: 'azul', funcao: 'operativo' });
  await mestreVermelho.ate((c) => c.estado.podeIniciar, 'a sala ficar pronta para começar');

  // Dois mestres no mesmo time não pode.
  opVermelho.erros = [];
  opVermelho.enviar('escolher_funcao', { time: 'vermelho', funcao: 'mestre' });
  await opVermelho.ate((c) => c.erros.length > 0, 'recusa de segundo mestre-espião');

  mestreVermelho.enviar('renomear_time', { time: 'vermelho', nome: 'Os Vermelhos' });
  mestreVermelho.enviar('configurar', { duracaoTurno: 0, modoRevelacao: 'consenso' });
  await mestreVermelho.ate((c) => c.estado.config.nomes.vermelho === 'Os Vermelhos', 'renomear o time');

  // --- partida -------------------------------------------------------------

  mestreVermelho.enviar('iniciar_partida');
  await opAzul.ate((c) => c.estado.tela === 'jogo', 'a partida começar para todos');

  const mestres = { vermelho: mestreVermelho, azul: mestreAzul };
  const operativos = { vermelho: opVermelho, azul: opAzul };

  // O ponto central: o operativo não recebe as cores das cartas fechadas.
  const cartasDoOperativo = opVermelho.estado.partida.cartas;
  assert.equal(cartasDoOperativo.length, 25);
  assert.ok(
    cartasDoOperativo.every((c) => c.tipo === null),
    'nenhuma cor pode chegar ao operativo antes da carta virar'
  );
  assert.ok(
    mestreVermelho.estado.partida.cartas.every((c) => typeof c.tipo === 'string'),
    'o mestre-espião precisa ver todas as cores'
  );

  // Joga até alguém vencer, sempre escolhendo uma carta certa do time da vez.
  // O teste consulta a vista do mestre, que é quem legitimamente conhece as cores.
  let rodadas = 0;
  while (mestreVermelho.estado.tela === 'jogo' && rodadas < 60) {
    rodadas++;
    const vez = mestreVermelho.estado.partida.vez;
    const mestre = mestres[vez];
    const operativo = operativos[vez];

    if (mestreVermelho.estado.partida.fase === 'dica') {
      mestre.enviar('dar_dica', { palavra: `PISTA${rodadas}`, numero: 1 });
      await operativo.ate((c) => c.estado.partida.fase === 'palpite', 'a dica chegar ao operativo');
      assert.equal(operativo.estado.partida.dica.palpitesRestantes, 2, 'dica 1 dá 2 palpites');
    }

    const alvo = mestre.estado.partida.cartas.findIndex((c) => !c.revelada && c.tipo === vez);
    assert.ok(alvo >= 0, 'o mestre deveria enxergar uma carta do próprio time');

    // Com um operativo só, o consenso é imediato: o voto dele já basta.
    operativo.enviar('votar_carta', { indice: alvo });
    // Esperar em cada cliente separadamente: são conexões diferentes, e a ordem
    // de entrega entre elas não é garantida.
    for (const cliente of clientes) {
      await cliente.ate((c) => c.estado.partida.cartas[alvo].revelada, 'a carta virar para todos');
    }

    const carta = opAzul.estado.partida.cartas[alvo];
    assert.equal(carta.revelada, true);
    assert.equal(carta.tipo, vez, 'depois de virada, a cor aparece para todo mundo');
  }

  assert.equal(mestreVermelho.estado.tela, 'fim', 'a partida precisa terminar');
  const vencedor = mestreVermelho.estado.partida.vencedor;
  assert.ok(['vermelho', 'azul'].includes(vencedor));
  assert.equal(mestreVermelho.estado.partida.motivo, 'cartas');
  assert.equal(mestreVermelho.estado.partida.restantes[vencedor], 0);

  // No fim, o tabuleiro inteiro é revelado para todos — inclusive o assassino.
  assert.ok(
    opVermelho.estado.partida.cartas.every((c) => typeof c.tipo === 'string'),
    'o fim de jogo abre todas as cores'
  );

  // --- nova partida --------------------------------------------------------

  mestreVermelho.enviar('nova_partida');
  await opAzul.ate((c) => c.estado.tela === 'jogo', 'a nova partida começar');
  assert.equal(opAzul.estado.partida.cartas.filter((c) => c.revelada).length, 0);
  assert.equal(opAzul.estado.voce.funcao, 'operativo', 'as funções são mantidas');
  assert.ok(
    opAzul.estado.partida.cartas.every((c) => c.tipo === null),
    'o novo tabuleiro volta a esconder as cores'
  );
});

test('consenso exige os dois operativos, e quem cai volta ao mesmo lugar', async (t) => {
  const servidor = await subirServidor();
  const clientes = [];
  t.after(() => {
    clientes.forEach((c) => c.fechar());
    servidor.kill();
  });

  const mestreV = await new Cliente('mestre vermelho').conectar();
  const op1 = await new Cliente('operativo 1').conectar();
  const op2 = await new Cliente('operativo 2').conectar();
  const mestreA = await new Cliente('mestre azul').conectar();
  const opA = await new Cliente('operativo azul').conectar();
  clientes.push(mestreV, op1, op2, mestreA, opA);

  mestreV.enviar('criar_sala', { nome: 'Ana' });
  await mestreV.ate((c) => c.codigo, 'código da sala');
  const codigo = mestreV.codigo;

  for (const [cliente, nome] of [[op1, 'Bruno'], [op2, 'Bruno'], [mestreA, 'Carla'], [opA, 'Diego']]) {
    cliente.enviar('entrar_sala', { codigo, nome });
    await cliente.ate((c) => c.estado, `${nome} entrar`);
  }

  // Dois "Bruno" na mesma sala precisam virar nomes distintos.
  const nomes = mestreV.estado.jogadores.map((j) => j.nome);
  assert.equal(new Set(nomes).size, nomes.length, 'nomes repetidos devem ser desambiguados');

  mestreV.enviar('escolher_funcao', { time: 'vermelho', funcao: 'mestre' });
  op1.enviar('escolher_funcao', { time: 'vermelho', funcao: 'operativo' });
  op2.enviar('escolher_funcao', { time: 'vermelho', funcao: 'operativo' });
  mestreA.enviar('escolher_funcao', { time: 'azul', funcao: 'mestre' });
  opA.enviar('escolher_funcao', { time: 'azul', funcao: 'operativo' });
  await mestreV.ate((c) => c.estado?.podeIniciar, 'sala pronta');

  mestreV.enviar('iniciar_partida');
  for (const cliente of clientes) {
    await cliente.ate((c) => c.estado?.tela === 'jogo', 'partida começar para todos');
  }

  // Força a vez do time vermelho dando a dica de quem for da vez até chegar neles.
  if (mestreV.estado.partida.vez !== 'vermelho') {
    mestreA.enviar('dar_dica', { palavra: 'ABERTURA', numero: 1 });
    await opA.ate((c) => c.estado?.partida?.fase === 'palpite', 'dica azul');
    opA.enviar('votar_carta', { indice: mestreA.estado.partida.cartas.findIndex((c) => !c.revelada && c.tipo === 'neutra') });
    await mestreV.ate((c) => c.estado?.partida?.vez === 'vermelho', 'a vez passar para o vermelho');
  }

  mestreV.enviar('dar_dica', { palavra: 'CONSENSO', numero: 2 });
  await op2.ate((c) => c.estado?.partida?.fase === 'palpite', 'dica vermelha');

  const alvo = mestreV.estado.partida.cartas.findIndex((c) => !c.revelada && c.tipo === 'vermelho');

  // Um voto sozinho não vira a carta: aparece como marca para o time.
  op1.enviar('votar_carta', { indice: alvo });
  await op2.ate((c) => c.estado?.partida?.cartas[alvo].votos.length === 1, 'a marca de voto aparecer');
  assert.equal(op2.estado.partida.cartas[alvo].revelada, false, 'um voto só não revela');
  assert.equal(opA.estado.partida.cartas[alvo].votos.length, 0, 'o time adversário não vê os votos');

  // O segundo voto fecha o consenso e a carta vira.
  op2.enviar('votar_carta', { indice: alvo });
  await op1.ate((c) => c.estado?.partida?.cartas[alvo].revelada, 'a carta virar com o consenso');
  assert.equal(op1.estado.partida.cartas[alvo].tipo, 'vermelho');

  // --- reconexão -----------------------------------------------------------

  const cracha = { codigo, jogadorId: op1.jogadorId, token: op1.token };
  const reveladasAntes = op1.estado.partida.cartas.filter((c) => c.revelada).length;
  op1.fechar();

  const voltou = await new Cliente('operativo 1 de volta').conectar();
  clientes.push(voltou);
  voltou.enviar('reconectar', cracha);
  await voltou.ate((c) => c.estado?.tela === 'jogo', 'voltar para a partida');

  assert.equal(voltou.estado.voce.id, cracha.jogadorId, 'volta com a mesma identidade');
  assert.equal(voltou.estado.voce.funcao, 'operativo');
  assert.equal(voltou.estado.voce.time, 'vermelho');
  assert.equal(
    voltou.estado.partida.cartas.filter((c) => c.revelada).length,
    reveladasAntes,
    'a partida continua de onde parou'
  );
  assert.ok(
    voltou.estado.partida.cartas.filter((c) => !c.revelada).every((c) => c.tipo === null),
    'reconectar não pode entregar as cores'
  );

  // Crachá inválido é recusado.
  const intruso = await new Cliente('intruso').conectar();
  clientes.push(intruso);
  intruso.enviar('reconectar', { codigo, jogadorId: cracha.jogadorId, token: 'token-errado' });
  await intruso.ate((c) => c.erros.length > 0, 'recusa de crachá inválido');
});

test('espectador assiste sem entregar as cores nem contar para os times', async (t) => {
  const servidor = await subirServidor();
  const clientes = [];
  t.after(() => {
    clientes.forEach((c) => c.fechar());
    servidor.kill();
  });

  const mestreV = await new Cliente('mestre vermelho').conectar();
  const opV = await new Cliente('operativo vermelho').conectar();
  const mestreA = await new Cliente('mestre azul').conectar();
  const opA = await new Cliente('operativo azul').conectar();
  const plateia = await new Cliente('espectador').conectar();
  clientes.push(mestreV, opV, mestreA, opA, plateia);

  mestreV.enviar('criar_sala', { nome: 'Ana' });
  await mestreV.ate((c) => c.codigo, 'código da sala');
  const codigo = mestreV.codigo;

  for (const [cliente, nome] of [[opV, 'Bruno'], [mestreA, 'Carla'], [opA, 'Diego'], [plateia, 'Elis']]) {
    cliente.enviar('entrar_sala', { codigo, nome });
    await cliente.ate((c) => c.estado, `${nome} entrar`);
  }

  mestreV.enviar('escolher_funcao', { time: 'vermelho', funcao: 'mestre' });
  opV.enviar('escolher_funcao', { time: 'vermelho', funcao: 'operativo' });
  mestreA.enviar('escolher_funcao', { time: 'azul', funcao: 'mestre' });
  opA.enviar('escolher_funcao', { time: 'azul', funcao: 'operativo' });
  plateia.enviar('escolher_funcao', { funcao: 'espectador' });

  await plateia.ate((c) => c.estado?.voce.funcao === 'espectador', 'virar espectador');
  assert.equal(plateia.estado.voce.time, null, 'espectador não pertence a time');
  await mestreV.ate((c) => c.estado?.podeIniciar, 'a sala poder começar mesmo com espectador');

  mestreV.enviar('iniciar_partida');
  for (const cliente of clientes) {
    await cliente.ate((c) => c.estado?.tela === 'jogo', 'partida começar');
  }

  // O ponto: espectador vê o tabuleiro fechado, igual a um operativo adversário.
  assert.ok(
    plateia.estado.partida.cartas.every((c) => c.tipo === null),
    'o espectador não pode receber as cores'
  );

  // E não consegue jogar, mesmo mandando a mensagem na mão.
  plateia.erros = [];
  const vez = mestreV.estado.partida.vez;
  const mestreDaVez = vez === 'vermelho' ? mestreV : mestreA;
  mestreDaVez.enviar('dar_dica', { palavra: 'PLATEIA', numero: 1 });
  await plateia.ate((c) => c.estado?.partida?.fase === 'palpite', 'a dica chegar');

  plateia.enviar('votar_carta', { indice: 0 });
  await plateia.ate((c) => c.erros.length > 0, 'recusa de voto do espectador');
  assert.equal(plateia.estado.partida.cartas[0].revelada, false, 'nada foi revelado');

  plateia.erros = [];
  plateia.enviar('dar_dica', { palavra: 'OUTRA', numero: 1 });
  await plateia.ate((c) => c.erros.length > 0, 'recusa de dica do espectador');
});

test('quem chega no meio da partida entra assistindo', async (t) => {
  const servidor = await subirServidor();
  const clientes = [];
  t.after(() => {
    clientes.forEach((c) => c.fechar());
    servidor.kill();
  });

  const mestreV = await new Cliente('mestre vermelho').conectar();
  const opV = await new Cliente('operativo vermelho').conectar();
  const mestreA = await new Cliente('mestre azul').conectar();
  const opA = await new Cliente('operativo azul').conectar();
  clientes.push(mestreV, opV, mestreA, opA);

  mestreV.enviar('criar_sala', { nome: 'Ana' });
  await mestreV.ate((c) => c.codigo, 'código');
  const codigo = mestreV.codigo;

  for (const [cliente, nome] of [[opV, 'Bruno'], [mestreA, 'Carla'], [opA, 'Diego']]) {
    cliente.enviar('entrar_sala', { codigo, nome });
    await cliente.ate((c) => c.estado, `${nome} entrar`);
  }

  mestreV.enviar('escolher_funcao', { time: 'vermelho', funcao: 'mestre' });
  opV.enviar('escolher_funcao', { time: 'vermelho', funcao: 'operativo' });
  mestreA.enviar('escolher_funcao', { time: 'azul', funcao: 'mestre' });
  opA.enviar('escolher_funcao', { time: 'azul', funcao: 'operativo' });
  await mestreV.ate((c) => c.estado?.podeIniciar, 'sala pronta');

  mestreV.enviar('iniciar_partida');
  await opA.ate((c) => c.estado?.tela === 'jogo', 'partida começar');

  // Antes, chegar atrasado dava "a partida já começou" e a pessoa ficava de fora.
  const atrasado = await new Cliente('atrasado').conectar();
  clientes.push(atrasado);
  atrasado.enviar('entrar_sala', { codigo, nome: 'Fábio' });
  await atrasado.ate((c) => c.estado?.tela === 'jogo', 'entrar direto na partida');

  assert.equal(atrasado.estado.voce.funcao, 'espectador');
  assert.equal(atrasado.estado.voce.time, null);
  assert.ok(
    atrasado.estado.partida.cartas.every((c) => c.tipo === null || c.revelada),
    'quem chega atrasado também não recebe as cores'
  );
});
