import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom, join, act} from '../game.js';

const dice = (a,b) => { let i=0; return () => [a,b][i++]; };
function game(options={}) { const r=createRoom('NEW123','Ana',options); join(r,'Beto'); act(r,r.players[0].token,'start'); return r; }

test('tabuleiro de quatro jogadores tem 32 casas, 20 propriedades, quatro sortes e quatro indústrias', () => {
  const r=createRoom('SMALL4','Ana',{maxPlayers:4});
  for(let i=1;i<4;i++) join(r,`P${i}`);
  assert.throws(()=>join(r,'P4'),/4 jogadores/);
  assert.equal(r.board.length,32);
  assert.equal(r.board.filter(t=>t.type==='property').length,20);
  assert.equal(r.board.filter(t=>t.type==='event').length,4);
  assert.equal(r.board.filter(t=>t.type==='industry').length,4);
});

test('cada jogador precisa usar um personagem 3D exclusivo', () => {
  const r=createRoom('MODEL1','Ana',{character:'character-female-a'});
  assert.throws(()=>join(r,'Beto','character-female-a'),/já foi escolhido/);
  const beto=join(r,'Beto','character-male-a');
  assert.equal(r.players[0].character,'character-female-a'); assert.equal(beto.character,'character-male-a');
});

test('personagem pode ser trocado no lobby sem duplicar e trava após o início', () => {
  const r=createRoom('MODEL2','Ana',{character:'character-female-a'});
  const beto=join(r,'Beto','character-male-a');
  act(r,beto.token,'set-character','character-male-b');
  assert.equal(beto.character,'character-male-b');
  assert.throws(()=>act(r,r.players[0].token,'set-character','character-male-b'),/já foi escolhido/);
  act(r,r.players[0].token,'start');
  assert.throws(()=>act(r,beto.token,'set-character','character-male-c'),/lobby/);
});

test('aluguel aguarda confirmação e permite vender imóvel ao banco antes do pagamento', () => {
  const r=game(),[a,b]=r.players;
  r.properties[3]={owner:b.id,level:0,visits:1}; r.properties[1]={owner:a.id,level:0,visits:1};
  a.money=1; act(r,a.token,'roll',null,dice(1,2));
  assert.equal(r.stage,'rent'); assert.equal(a.money,1);
  act(r,a.token,'sell-bank',1); assert.ok(a.money>1);
  act(r,a.token,'rent-confirm'); assert.equal(r.pendingPayment,null); assert.equal(b.money,503000);
});

test('segunda visita libera três casas e terceira visita libera hotel', () => {
  const r=game(),p=r.players[0],tile=r.board[3];
  r.properties[3]={owner:p.id,level:0,visits:2}; p.position=3; r.stage='upgrade';
  act(r,p.token,'upgrade',{property:3,level:3}); assert.equal(r.properties[3].level,3);
  r.properties[3].visits=3; r.stage='upgrade'; act(r,p.token,'upgrade',{property:3,level:4});
  assert.equal(r.properties[3].level,4); assert.ok(p.money<500000); assert.equal(tile.type,'property');
});

test('coringa aparece uma vez e compra imóvel livre pela metade', () => {
  const r=game(),p=r.players[0]; r.deck=['joker']; p.position=1;
  act(r,p.token,'roll',null,dice(1,2)); assert.equal(r.pendingChoice.type,'joker');
  const target=r.board.find(t=>t.type==='property'&&!r.properties[t.id]); const before=p.money;
  act(r,p.token,'card-choice',target.id); assert.equal(r.properties[target.id].owner,p.id);
  assert.equal(p.money,before-Math.floor(target.price/2)); assert.equal(r.discard.includes('joker'),false);
});

test('carnaval aumenta aluguel e apagão suspende cobrança por cinco rodadas', () => {
  const r=game(),[a,b]=r.players,owned=r.board.find(t=>t.type==='property');
  r.properties[owned.id]={owner:a.id,level:0,visits:1}; r.pendingChoice={type:'carnival',player:a.id}; r.stage='choice';
  act(r,a.token,'card-choice',owned.id); assert.equal(r.carnival.property,owned.id);
  r.pendingChoice={type:'blackout',player:b.id}; r.stage='choice'; r.turn=1;
  act(r,b.token,'card-choice',owned.id); assert.equal(r.properties[owned.id].blackoutUntil,r.round+5);
});
