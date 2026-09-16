const { test } = require('node:test');
const assert = require('node:assert/strict');

const { identidadeDoLauncher } = require('./identidade-launcher.cjs');

const SEM_AMBIENTE = {};

test('sem argumento nem ambiente, não há identidade de launcher', () => {
  assert.equal(identidadeDoLauncher(['app.exe'], SEM_AMBIENTE), null);
});

test('argumentos de linha de comando entregam nome, avatar e sala', () => {
  const id = identidadeDoLauncher(
    ['app.exe', '--jogador-nome=Lucas', '--jogador-avatar=https://foto.example/eu.png', '--sala=ABCD'],
    SEM_AMBIENTE
  );
  assert.deepEqual(id, {
    nome: 'Lucas',
    avatar: 'https://foto.example/eu.png',
    sala: 'ABCD',
    origem: 'launcher'
  });
});

test('variáveis de ambiente funcionam sozinhas', () => {
  const id = identidadeDoLauncher(['app.exe'], {
    METRALHAS_JOGADOR_NOME: 'Vera',
    METRALHAS_SALA: 'QWER'
  });
  assert.equal(id.nome, 'Vera');
  assert.equal(id.avatar, null);
  assert.equal(id.sala, 'QWER');
});

test('pacote base64 é aceito e o argumento explícito ganha dele', () => {
  const pacote = Buffer.from(JSON.stringify({ nome: 'DoPacote', sala: 'ZZZZ' }), 'utf8').toString('base64');

  const soPacote = identidadeDoLauncher(['app.exe', `--jogador=${pacote}`], SEM_AMBIENTE);
  assert.equal(soPacote.nome, 'DoPacote');
  assert.equal(soPacote.sala, 'ZZZZ');

  const comArgumento = identidadeDoLauncher(
    ['app.exe', `--jogador=${pacote}`, '--jogador-nome=Explicito'],
    SEM_AMBIENTE
  );
  assert.equal(comArgumento.nome, 'Explicito'); // argumento > pacote
  assert.equal(comArgumento.sala, 'ZZZZ'); // o resto ainda vem do pacote
});

test('prioridade completa: argumento > ambiente > pacote', () => {
  const pacote = Buffer.from(JSON.stringify({ nome: 'Pacote' }), 'utf8').toString('base64');
  const id = identidadeDoLauncher(['app.exe', `--jogador=${pacote}`, '--jogador-nome=Argumento'], {
    METRALHAS_JOGADOR_NOME: 'Ambiente'
  });
  assert.equal(id.nome, 'Argumento');
});

test('pacote base64 ilegível não derruba nada: cai no fluxo manual', () => {
  assert.equal(identidadeDoLauncher(['app.exe', '--jogador=%%%não-é-base64%%%'], SEM_AMBIENTE), null);
});
