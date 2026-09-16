/**
 * Testes do contrato com o launcher.
 *
 * Vale a pena testar mesmo sendo poucas linhas: é a única parte do jogo que lê
 * dados de um programa externo que ainda não existe, e o modo de falhar
 * importa — um argumento estranho tem que cair no fluxo normal, nunca quebrar a
 * abertura do jogo.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { identidadeDoLauncher } = require('./identidade-launcher.cjs');

const semLauncher = ['electron', '.'];
const empacotar = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');

test('sem launcher, não inventa identidade', () => {
  assert.equal(identidadeDoLauncher(semLauncher, {}), null);
  assert.equal(identidadeDoLauncher([...semLauncher, '--janelas=4'], {}), null);
});

test('lê identidade dos argumentos de linha de comando', () => {
  const r = identidadeDoLauncher(
    [...semLauncher, '--jogador-nome=Lucas', '--jogador-avatar=https://ex.com/a.png', '--sala=ABCD'],
    {}
  );
  assert.deepEqual(r, {
    nome: 'Lucas',
    avatar: 'https://ex.com/a.png',
    sala: 'ABCD',
    origem: 'launcher'
  });
});

test('lê identidade das variáveis de ambiente', () => {
  const r = identidadeDoLauncher(semLauncher, {
    METRALHAS_JOGADOR_NOME: 'Ana',
    METRALHAS_SALA: 'WXYZ'
  });
  assert.equal(r.nome, 'Ana');
  assert.equal(r.sala, 'WXYZ');
});

test('lê identidade de um pacote base64', () => {
  const r = identidadeDoLauncher(
    [...semLauncher, `--jogador=${empacotar({ nome: 'Bia', avatar: 'https://ex.com/b.png' })}`],
    {}
  );
  assert.equal(r.nome, 'Bia');
  assert.equal(r.avatar, 'https://ex.com/b.png');
});

test('argumento vence ambiente, que vence o pacote', () => {
  const argv = [...semLauncher, '--jogador-nome=DoArgumento', `--jogador=${empacotar({ nome: 'DoPacote' })}`];
  const r = identidadeDoLauncher(argv, { METRALHAS_JOGADOR_NOME: 'DoAmbiente' });
  assert.equal(r.nome, 'DoArgumento');

  const semArgumento = [...semLauncher, `--jogador=${empacotar({ nome: 'DoPacote' })}`];
  assert.equal(identidadeDoLauncher(semArgumento, { METRALHAS_JOGADOR_NOME: 'DoAmbiente' }).nome, 'DoAmbiente');
});

test('pacote ilegível não derruba a abertura do jogo', () => {
  assert.equal(identidadeDoLauncher([...semLauncher, '--jogador=nao-e-base64-valido!!'], {}), null);
  assert.equal(identidadeDoLauncher([...semLauncher, '--jogador='], {}), null);

  // Pacote válido em base64, mas que não descreve um jogador.
  const lixo = Buffer.from('[1,2,3]').toString('base64');
  assert.equal(identidadeDoLauncher([...semLauncher, `--jogador=${lixo}`], {}), null);
});

test('nome com espaços e acentos sobrevive ao transporte', () => {
  const r = identidadeDoLauncher([...semLauncher, '--jogador-nome=João da Silva'], {});
  assert.equal(r.nome, 'João da Silva');
});
