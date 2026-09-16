import { randomInt, randomUUID } from 'node:crypto';

import {board, RULES, JAIL, INDUSTRIES, buyable, rentFor, money} from './public/board.js';
export {board, RULES, JAIL, INDUSTRIES};
function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createRoom(code, name) {
  const room = {code, phase:'lobby', players:[], properties:{}, turn:0, round:1, stage:'roll', dice:[], doubles:0, extraRoll:false, logs:[], winner:null, winnerReason:null, touched:Date.now(), deadline:null, paused:false, pauseRemaining:null, pausedBy:null, trade:null, lastCard:null,
    deck:shuffle(['bonus','bonus','bonus','bonus','repair','repair','repair','repair','jail','jail','release','release']), discard:[]};
  join(room, name);
  return room;
}
export function join(room, name) {
  if (room.phase !== 'lobby') throw Error('A partida já começou.');
  if (room.players.length >= 8) throw Error('A sala está cheia (8 jogadores).');
  const clean = String(name || '').trim().slice(0, 20);
  if (!clean) throw Error('Informe seu nome.');
  if (room.players.some(p => p.name.toLowerCase() === clean.toLowerCase())) throw Error('Esse nome já está na sala.');
  const p = {id:randomUUID(), token:randomUUID(), name:clean, money:RULES.startingMoney, position:0, bankrupt:false, jailed:false, jailTurns:0, jailCards:0};
  room.players.push(p);
  return p;
}
const log = (r, text) => { r.logs.unshift(text); r.logs = r.logs.slice(0, 30); };
export const wealth = (r, p) => p.money + Object.entries(r.properties).reduce((sum, [id, lot]) => sum + (lot.owner === p.id ? board[id].price + lot.level * Math.floor(board[id].price / 2) : 0), 0);
function finish(r, winner, reason) {
  cancelTrade(r, 'A partida terminou.');
  r.phase = 'finished';
  r.winner = [winner.id]; r.winnerReason = reason; r.extraRoll = false;
  r.paused = false; r.pauseRemaining = null; r.pausedBy = null;
  log(r, `${winner.name} venceu ${reason === 'industries' ? 'ao conquistar as quatro indústrias' : 'como último sobrevivente'}!`);
}
function checkVictory(r) {
  if (r.phase !== 'playing') return;
  const active = r.players.filter(p => !p.bankrupt);
  const industrialist = active.find(p => INDUSTRIES.every(id => r.properties[id]?.owner === p.id));
  if (industrialist) finish(r, industrialist, 'industries');
  else if (active.length === 1) finish(r, active[0], 'survival');
}
function returnCards(r, p) {
  for (let i = 0; i < p.jailCards; i++) r.discard.push('release');
  p.jailCards = 0;
}
function charge(r, p, amount, recipient) {
  const payment = Math.min(amount, p.money);
  p.money -= payment;
  if (recipient) recipient.money += payment;
  if (payment < amount) {
    p.bankrupt = true;
    returnCards(r, p);
    for (const [id, lot] of Object.entries(r.properties)) if (lot.owner === p.id) delete r.properties[id];
    log(r, `${p.name} faliu. Seus terrenos voltaram ao banco.`);
  }
}
function next(r) {
  cancelTrade(r, 'O turno terminou.');
  checkVictory(r);
  if (r.phase === 'finished') return;
  do {
    r.turn = (r.turn + 1) % r.players.length;
    if (r.turn === 0) r.round++;
  } while (r.players[r.turn].bankrupt);
  r.stage = 'roll';
  r.doubles = 0; r.extraRoll = false;
  r.deadline = r.paused ? null : Date.now() + RULES.turnMs;
  if (r.paused) r.pauseRemaining = RULES.turnMs;
}
export function tick(r) {
  if (r.phase === 'playing' && !r.paused && Date.now() >= r.deadline) {
    const current = r.players[r.turn];
    if (current.jailed && r.stage === 'roll') serveJailTurn(r, current);
    log(r, `Tempo de ${r.players[r.turn].name} esgotado. Turno passado.`);
    next(r);
  }
}
function cancelTrade(r, reason) {
  if (!r.trade) return;
  r.trade = null;
  log(r, `Oferta cancelada. ${reason}`);
}
function proposeTrade(r, p, value) {
  if (r.trade) throw Error('Já existe uma oferta pendente. Cancele-a antes de criar outra.');
  if (!value || !['buy', 'sell'].includes(value.type)) throw Error('Escolha comprar ou vender.');
  const target = r.players.find(other => other.id === value.target && other !== p && !other.bankrupt);
  if (!target) throw Error('Escolha outro jogador ativo.');
  if (!Number.isSafeInteger(value.price) || value.price < 1) throw Error('O valor deve ser um número inteiro positivo.');
  if (!Number.isInteger(value.property) || !buyable(board[value.property])) throw Error('Propriedade inválida.');
  const buyer = value.type === 'buy' ? p : target;
  const seller = value.type === 'sell' ? p : target;
  const lot = r.properties[value.property];
  if (!lot || lot.owner !== seller.id) throw Error('A propriedade não pertence ao vendedor escolhido.');
  if (buyer.money < value.price) throw Error('O comprador não tem saldo suficiente para essa oferta.');
  r.trade = {id: randomUUID(), from: p.id, to: target.id, buyer: buyer.id, seller: seller.id, property: value.property, price: value.price, level: lot.level};
  log(r, `${p.name} propôs ${value.type === 'buy' ? 'comprar' : 'vender'} ${board[value.property].name} por ${money(value.price)} para ${target.name}.`);
}
function respondToTrade(r, p, action, id) {
  const offer = r.trade;
  if (r.phase !== 'playing' || !offer || offer.id !== id) throw Error('Essa oferta não está mais disponível.');
  if (action === 'trade-cancel') {
    if (offer.from !== p.id) throw Error('Somente o autor pode cancelar a oferta.');
    cancelTrade(r, `${p.name} retirou a proposta.`); return;
  }
  if (offer.to !== p.id || p.bankrupt) throw Error('Somente o destinatário pode responder à oferta.');
  if (action === 'trade-reject') {
    r.trade = null; log(r, `${p.name} recusou a oferta.`); return;
  }
  const buyer = r.players.find(other => other.id === offer.buyer);
  const seller = r.players.find(other => other.id === offer.seller);
  const lot = r.properties[offer.property];
  if (r.players[r.turn].id !== offer.from || !buyer || !seller || buyer.bankrupt || seller.bankrupt || !lot || lot.owner !== seller.id || lot.level !== offer.level) {
    cancelTrade(r, 'As condições da negociação mudaram.');
    throw Error('As condições da negociação mudaram. Envie uma nova oferta.');
  }
  if (buyer.money < offer.price) throw Error('O comprador não tem mais saldo suficiente.');
  buyer.money -= offer.price; seller.money += offer.price; lot.owner = buyer.id; r.trade = null;
  log(r, `${buyer.name} comprou ${board[offer.property].name} de ${seller.name} por ${money(offer.price)}.`);
  checkVictory(r);
}
function sendToJail(r, p, reason) {
  p.position = JAIL; p.jailed = true; p.jailTurns = 0;
  r.extraRoll = false; r.doubles = 0; r.stage = 'end';
  log(r, `${p.name} foi para a prisão: ${reason}. Não recebe bônus de partida nesse deslocamento.`);
}
function serveJailTurn(r, p) {
  p.jailTurns++; r.stage = 'end'; r.extraRoll = false;
  if (p.jailTurns >= RULES.jailTurns) {
    p.jailed = false; p.jailTurns = 0;
    log(r, `${p.name} cumpriu três turnos preso. Está livre e volta a se mover no próximo turno.`);
  } else log(r, `${p.name} continua preso (${p.jailTurns}/${RULES.jailTurns} turnos cumpridos).`);
}
function drawCard(r, p) {
  if (!r.deck.length) { r.deck = shuffle(r.discard); r.discard = []; }
  const card = r.deck.pop();
  r.lastCard = {player:p.id, type:card};
  if (card === 'release') {
    p.jailCards++; log(r, `${p.name} recebeu a carta “Sair da prisão”. Ela fica guardada até ser usada.`);
    return;
  }
  r.discard.push(card);
  if (card === 'jail') sendToJail(r, p, 'carta Sorte');
  else if (card === 'bonus') { p.money += RULES.chanceBonus; log(r, `${p.name} ganhou ${money(RULES.chanceBonus)} na Sorte.`); }
  else { charge(r, p, RULES.repairs); log(r, `${p.name} recebeu uma cobrança de ${money(RULES.repairs)} por reparos.`); }
}
function move(r, p, total) {
  if (p.position + total >= board.length) { p.money += RULES.lapBonus; log(r, `${p.name} recebeu ${money(RULES.lapBonus)} pela volta.`); }
  p.position = (p.position + total) % board.length;
  const tile = board[p.position];
  r.stage = 'end'; log(r, `${p.name} tirou ${r.dice.join(' + ')} e chegou em ${tile.name}.`);
  if (buyable(tile)) {
    const lot = r.properties[tile.id];
    if (!lot) r.stage = 'buy';
    else if (lot.owner !== p.id) {
      const rent = rentFor(tile, lot, total);
      charge(r, p, rent, r.players.find(other => other.id === lot.owner));
      log(r, `${p.name} pagou aluguel de até ${money(rent)}${tile.type === 'industry' ? ` (${money(tile.price)} × ${total} nos dados)` : ''}.`);
    }
  } else if (tile.type === 'tax') { charge(r, p, RULES.tax); log(r, `${p.name} recebeu uma cobrança de ${money(RULES.tax)} de imposto.`); }
  else if (tile.type === 'event') drawCard(r, p);
  else if (tile.type === 'go-to-jail') sendToJail(r, p, 'casa Vá à prisão');
  else if (tile.type === 'jail') log(r, `${p.name} está apenas visitando a prisão.`);
  if (p.bankrupt) next(r);
}
function roll(r, p, dice) {
  if (r.stage !== 'roll') throw Error('Os dados já foram lançados.');
  r.dice = [dice(), dice()];
  const double = r.dice[0] === r.dice[1], total = r.dice[0] + r.dice[1];
  if (p.jailed) {
    r.doubles = 0; r.extraRoll = false;
    if (!double) { log(r, `${p.name} tirou ${r.dice.join(' + ')} na prisão.`); serveJailTurn(r, p); return; }
    p.jailed = false; p.jailTurns = 0;
    log(r, `${p.name} tirou uma dupla e saiu da prisão!`);
    move(r, p, total); return;
  }
  r.doubles = double ? r.doubles + 1 : 0;
  r.extraRoll = double;
  if (r.doubles === 3) { sendToJail(r, p, 'três duplas consecutivas no mesmo turno'); return; }
  move(r, p, total);
}
export function act(r, token, action, value, dice = () => randomInt(1, 7)) {
  const p = r.players.find(p => p.token === token);
  if (!p) throw Error('Sessão inválida.');
  tick(r);
  if (action === 'leave') {
    if (r.phase === 'lobby') r.players = r.players.filter(other => other !== p);
    else if (r.phase === 'playing' && !p.bankrupt) {
      if (r.trade && [r.trade.buyer, r.trade.seller].includes(p.id)) cancelTrade(r, `${p.name} saiu da partida.`);
      p.money = 0; p.bankrupt = true;
      returnCards(r, p);
      for (const [id, lot] of Object.entries(r.properties)) if (lot.owner === p.id) delete r.properties[id];
      log(r, `${p.name} deixou a partida.`);
      if (r.players[r.turn] === p) next(r);
      else checkVictory(r);
    }
    return;
  }
  if (action === 'start') {
    if (r.phase !== 'lobby' || p !== r.players[0]) throw Error('Só o anfitrião pode iniciar a sala.');
    if (r.players.length < 2) throw Error('São necessários pelo menos 2 jogadores.');
    r.phase = 'playing'; r.deadline = Date.now() + RULES.turnMs; log(r, 'A partida começou! Vença por sobrevivência ou com quatro indústrias.'); return;
  }
  if (action === 'pause' || action === 'resume') {
    if (r.phase !== 'playing' || p.bankrupt) throw Error('Somente jogadores ativos podem pausar ou retomar a partida.');
    if (action === 'pause') {
      if (r.paused) throw Error('A partida já está pausada.');
      r.pauseRemaining = Math.max(0, r.deadline - Date.now());
      r.paused = true; r.pausedBy = p.id; r.deadline = null;
      log(r, `${p.name} pausou a partida. O tempo restante está congelado.`);
    } else {
      if (!r.paused) throw Error('A partida não está pausada.');
      r.deadline = Date.now() + r.pauseRemaining;
      r.paused = false; r.pauseRemaining = null; r.pausedBy = null;
      log(r, `${p.name} retomou a partida.`);
    }
    return;
  }
  if (r.paused) throw Error('A partida está pausada. Retome para continuar.');
  if (['trade-accept', 'trade-reject', 'trade-cancel'].includes(action)) {
    respondToTrade(r, p, action, value); return;
  }
  if (r.phase !== 'playing' || r.players[r.turn] !== p || p.bankrupt) throw Error('Aguarde seu turno.');
  if (action === 'trade-offer') { proposeTrade(r, p, value); return; }
  if (r.trade && action !== 'end') throw Error('Aguarde a resposta ou cancele sua oferta para continuar jogando.');
  if (action === 'roll') {
    roll(r, p, dice);
  } else if (action === 'jail-wait') {
    if (!p.jailed || r.stage !== 'roll') throw Error('Você não pode cumprir um turno de prisão agora.');
    serveJailTurn(r, p);
  } else if (action === 'jail-card') {
    if (!p.jailed || r.stage !== 'roll' || p.jailCards < 1) throw Error('Você precisa estar preso, antes de lançar os dados, e ter a carta.');
    p.jailCards--; r.discard.push('release'); p.jailed = false; p.jailTurns = 0;
    log(r, `${p.name} usou “Sair da prisão”. Já pode lançar os dados normalmente.`);
  } else if (action === 'buy') {
    const tile = board[p.position];
    if (r.stage !== 'buy' || r.properties[tile.id]) throw Error('Não há terreno disponível para comprar.');
    if (p.money < tile.price) throw Error('Saldo insuficiente.');
    p.money -= tile.price; r.properties[tile.id] = {owner: p.id, level: 0}; r.stage = 'end';
    log(r, `${p.name} comprou ${tile.name}.`);
    checkVictory(r);
  } else if (action === 'upgrade') {
    const tile = board[value]; const lot = r.properties[value];
    if (tile?.type !== 'property' || !lot || lot.owner !== p.id || lot.level >= 3) throw Error('Melhoria indisponível. Indústrias não recebem melhorias.');
    const price = Math.floor(tile.price / 2);
    if (p.money < price) throw Error('Saldo insuficiente.');
    p.money -= price; lot.level++; log(r, `${p.name} melhorou ${tile.name} para nível ${lot.level}.`);
  } else if (action === 'end') {
    if (r.stage === 'roll') throw Error('Lance os dados primeiro.');
    if (r.extraRoll && !p.jailed) {
      cancelTrade(r, 'O jogador vai lançar os dados novamente.');
      r.extraRoll = false; r.stage = 'roll';
      log(r, `${p.name} tirou uma dupla e joga novamente (${r.doubles}/3).`);
    } else next(r);
  } else throw Error('Ação desconhecida.');
}
export function snapshot(r) {
  const {touched, deck, discard, ...visible} = r;
  return {...visible, players: r.players.map(({token, ...p}) => ({...p, wealth: wealth(r, p)})), board};
}
