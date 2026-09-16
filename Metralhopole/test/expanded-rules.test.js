import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom, join, act, tick, snapshot, board, RULES, JAIL, INDUSTRIES} from '../game.js';

function setup() {
  const r = createRoom('ABC123','Ana'); join(r,'Bruno'); act(r,r.players[0].token,'start');
  r.deck = ['bonus','bonus','bonus','bonus'];
  return r;
}
function roll(r,a,b) { let i = 0; act(r,r.players[r.turn].token,'roll',null,() => [a,b][i++]); }
function nextOwnTurn(r) {
  act(r,r.players[0].token,'end');
  assert.equal(r.turn,1);
  r.deadline = Date.now() - 1; tick(r); assert.equal(r.turn,0);
}
test('tabuleiro tem 60 casas, 40 terrenos, 4 indústrias e prisão em canto oposto', () => {
  assert.equal(board.length,60); assert.equal(board.filter(t => t.type === 'property').length,40);
  assert.equal(INDUSTRIES.length,4); assert.deepEqual(INDUSTRIES.map(id => Math.floor(id/15)),[0,1,2,3]);
  for (const id of INDUSTRIES) assert.equal(board[id].price,25000);
  assert.equal(board[JAIL].type,'jail'); assert.equal(board[(JAIL+30)%60].type,'go-to-jail');
  assert.equal(RULES.startingMoney,500000);
});
test('visitar a prisão não prende; casa oposta prende sem bônus de transporte', () => {
  const r = setup(), p = r.players[0]; p.position = 12; roll(r,1,2);
  assert.equal(p.position,JAIL); assert.equal(p.jailed,false);
  nextOwnTurn(r); p.position = 42; const balance = p.money; roll(r,1,2);
  assert.equal(p.position,JAIL); assert.equal(p.jailed,true); assert.equal(p.jailTurns,0);
  assert.equal(p.money,balance); assert.equal(r.extraRoll,false);
});
test('carta Sorte prende e não concede nova jogada em uma dupla', () => {
  const r = setup(), p = r.players[0]; r.deck = ['jail']; roll(r,2,2);
  assert.equal(p.jailed,true); assert.equal(p.position,JAIL); assert.equal(r.extraRoll,false);
  assert.equal(r.lastCard.type,'jail'); assert.equal(p.money,RULES.startingMoney);
  assert.equal(snapshot(r).deck,undefined); assert.equal(snapshot(r).discard,undefined);
});
test('terceira dupla consecutiva prende antes de mover; contagem reinicia por turno', () => {
  const r = setup(), p = r.players[0];
  roll(r,1,1); assert.equal(r.extraRoll,true); act(r,p.token,'end'); assert.equal(r.turn,0);
  roll(r,1,1); assert.equal(r.doubles,2); act(r,p.token,'end');
  p.position = 59; const balance = p.money; roll(r,6,6);
  assert.equal(p.jailed,true); assert.equal(p.money,balance); assert.equal(p.position,JAIL);
  nextOwnTurn(r); assert.equal(r.doubles,0);
});
test('dupla libera da prisão, move a soma e não concede jogada extra', () => {
  const r = setup(), p = r.players[0]; p.jailed = true; p.position = JAIL; p.jailTurns = 1;
  roll(r,1,1); assert.equal(p.jailed,false); assert.equal(p.position,JAIL+2);
  assert.equal(p.jailTurns,0); assert.equal(r.extraRoll,false);
  act(r,p.token,'end'); assert.equal(r.turn,1);
});
test('três turnos presos: tentativa falha, espera e timeout contam uma vez cada', () => {
  const r = setup(), p = r.players[0]; p.jailed = true; p.position = JAIL;
  roll(r,1,2); assert.equal(p.jailTurns,1);
  assert.throws(() => act(r,p.token,'jail-wait'),/agora/);
  nextOwnTurn(r); act(r,p.token,'jail-wait'); assert.equal(p.jailTurns,2);
  nextOwnTurn(r); r.deadline = Date.now()-1; tick(r);
  assert.equal(p.jailed,false); assert.equal(p.position,JAIL); assert.equal(r.turn,1);
  r.deadline = Date.now()-1; tick(r); roll(r,1,2); assert.equal(p.position,JAIL+3);
});
test('carta de saída é guardada, consumida uma vez e devolvida ao descarte', () => {
  const r = setup(), p = r.players[0]; r.deck = ['release']; p.position = 1; roll(r,1,2);
  assert.equal(p.jailCards,1); assert.equal(r.discard.includes('release'),false);
  nextOwnTurn(r); p.jailed = true; p.position = JAIL;
  act(r,p.token,'jail-card'); assert.equal(p.jailCards,0); assert.equal(p.jailed,false);
  assert.equal(r.discard.at(-1),'release'); assert.equal(r.stage,'roll');
  assert.throws(() => act(r,p.token,'jail-card'),/precisa/);
  roll(r,1,2); assert.equal(p.position,JAIL+3);
});
test('aluguel industrial usa preço original vezes soma, sem melhorias', () => {
  const r = setup(), [a,b] = r.players; const id = INDUSTRIES[0];
  r.properties[id] = {owner:b.id,level:0}; a.position = id-5;
  roll(r,2,3); assert.equal(r.stage,'rent'); act(r,a.token,'rent-confirm'); assert.equal(a.money,RULES.startingMoney-125000); assert.equal(b.money,RULES.startingMoney+125000);
  nextOwnTurn(r); r.properties[id].owner = a.id;
  assert.throws(() => act(r,a.token,'upgrade',id),/Indústrias/);
  a.position=id-5; const balance=a.money; roll(r,2,3); assert.equal(a.money,balance);
});
test('comprar a quarta indústria encerra imediatamente a partida', () => {
  const r = setup(), p = r.players[0];
  for (const id of INDUSTRIES.slice(0,3)) r.properties[id] = {owner:p.id,level:0};
  p.position = INDUSTRIES[3]-3; roll(r,1,2); act(r,p.token,'buy');
  assert.equal(r.phase,'finished'); assert.equal(r.winnerReason,'industries'); assert.deepEqual(r.winner,[p.id]);
  assert.throws(() => act(r,p.token,'end'),/turno/);
});
test('comprador fora de turno vence ao aceitar oferta da quarta indústria', () => {
  const r = setup(), [a,b] = r.players;
  for (const id of INDUSTRIES.slice(0,3)) r.properties[id] = {owner:b.id,level:0};
  r.properties[INDUSTRIES[3]] = {owner:a.id,level:0};
  act(r,a.token,'trade-offer',{type:'sell',target:b.id,property:INDUSTRIES[3],price:70000});
  act(r,b.token,'trade-accept',r.trade.id);
  assert.equal(r.phase,'finished'); assert.deepEqual(r.winner,[b.id]); assert.equal(r.winnerReason,'industries');
  assert.equal(b.money,RULES.startingMoney-70000); assert.equal(board[INDUSTRIES[3]].price,25000);
});
test('pausa congela tempo e ofertas, bloqueia ações e retoma sem reiniciar o turno', t => {
  t.mock.timers.enable({apis:['Date'],now:100000});
  const r = setup(), [a,b] = r.players; r.properties[1] = {owner:a.id,level:0};
  act(r,a.token,'trade-offer',{type:'sell',target:b.id,property:1,price:50000}); const id=r.trade.id;
  t.mock.timers.tick(17000); act(r,b.token,'pause');
  assert.equal(r.pauseRemaining,58000); assert.equal(r.deadline,null);
  t.mock.timers.tick(600000); tick(r); assert.equal(r.turn,0); assert.equal(r.trade.id,id);
  assert.throws(() => act(r,b.token,'trade-accept',id),/pausada/);
  assert.throws(() => act(r,a.token,'roll'),/pausada/);
  assert.throws(() => act(r,b.token,'pause'),/já está/);
  act(r,a.token,'resume'); assert.equal(r.deadline-Date.now(),58000);
  act(r,b.token,'trade-accept',id); assert.equal(r.properties[1].owner,b.id);
  t.mock.timers.tick(57999); tick(r); assert.equal(r.turn,0);
  t.mock.timers.tick(1); tick(r); assert.equal(r.turn,1);
});
test('pausa na prisão não conta como turno de espera', t => {
  t.mock.timers.enable({apis:['Date'],now:100000});
  const r=setup(), p=r.players[0]; p.jailed=true; p.position=JAIL;
  act(r,p.token,'pause'); t.mock.timers.tick(1000000); tick(r); assert.equal(p.jailTurns,0);
  act(r,p.token,'resume'); assert.equal(r.deadline-Date.now(),RULES.turnMs);
});
