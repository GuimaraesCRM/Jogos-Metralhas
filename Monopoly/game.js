import { randomInt, randomUUID } from 'node:crypto';

const names = ['Vila Aurora', 'Rua das Flores', 'Praça Solar', 'Porto Azul', 'Marina', 'Ilha Coral', 'Alameda Verde', 'Jardim Real', 'Parque Central', 'Avenida Neon', 'Distrito Tech', 'Torre Digital', 'Praia Dourada', 'Costa Bela', 'Mirante', 'Boulevard', 'Palácio', 'Skyline'];
const colors = ['#ed9e64', '#50bdd4', '#79bd8a', '#a389dc', '#efcb62', '#ef829a'];
const special = {0: ['start', 'PARTIDA'], 4: ['event', 'SORTE'], 8: ['rest', 'FÉRIAS'], 12: ['tax', 'IMPOSTO'], 16: ['event', 'SORTE'], 20: ['rest', 'CAFÉ']};
let property = 0;
export const board = Array.from({length: 24}, (_, id) => {
  if (special[id]) return {id, type: special[id][0], name: special[id][1]};
  const n = property++;
  return {id, type: 'property', name: names[n], group: Math.floor(n / 3), color: colors[Math.floor(n / 3)], price: 120 + Math.floor(n / 3) * 50, rent: 25 + Math.floor(n / 3) * 12};
});
export function createRoom(code, name) {
  const room = {code, phase: 'lobby', players: [], properties: {}, turn: 0, round: 1, maxRounds: 20, stage: 'roll', dice: [], logs: [], winner: null, touched: Date.now(), deadline: null, trade: null};
  join(room, name);
  return room;
}
export function join(room, name) {
  if (room.phase !== 'lobby') throw Error('A partida já começou.');
  if (room.players.length >= 8) throw Error('A sala está cheia (8 jogadores).');
  const clean = String(name || '').trim().slice(0, 20);
  if (!clean) throw Error('Informe seu nome.');
  if (room.players.some(p => p.name.toLowerCase() === clean.toLowerCase())) throw Error('Esse nome já está na sala.');
  const p = {id: randomUUID(), token: randomUUID(), name: clean, money: 1500, position: 0, bankrupt: false};
  room.players.push(p);
  return p;
}
const log = (r, text) => { r.logs.unshift(text); r.logs = r.logs.slice(0, 30); };
export const wealth = (r, p) => p.money + Object.entries(r.properties).reduce((sum, [id, lot]) => sum + (lot.owner === p.id ? board[id].price + lot.level * Math.floor(board[id].price / 2) : 0), 0);
function finish(r) {
  cancelTrade(r, 'A partida terminou.');
  const ranked = r.players.filter(p => !p.bankrupt).sort((a, b) => wealth(r, b) - wealth(r, a));
  r.phase = 'finished';
  r.winner = ranked.filter(p => wealth(r, p) === wealth(r, ranked[0])).map(p => p.id);
  log(r, 'Partida encerrada! Vence o maior patrimônio.');
}
function charge(r, p, amount, recipient) {
  const payment = Math.min(amount, p.money);
  p.money -= payment;
  if (recipient) recipient.money += payment;
  if (payment < amount) {
    p.bankrupt = true;
    for (const [id, lot] of Object.entries(r.properties)) if (lot.owner === p.id) delete r.properties[id];
    log(r, `${p.name} faliu. Seus terrenos voltaram ao banco.`);
  }
}
function next(r) {
  cancelTrade(r, 'O turno terminou.');
  if (r.players.filter(p => !p.bankrupt).length <= 1) return finish(r);
  do {
    r.turn = (r.turn + 1) % r.players.length;
    if (r.turn === 0) r.round++;
  } while (r.players[r.turn].bankrupt);
  if (r.round > r.maxRounds) return finish(r);
  r.stage = 'roll';
  r.deadline = Date.now() + 75000;
}
export function tick(r) {
  if (r.phase === 'playing' && Date.now() >= r.deadline) {
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
  if (!Number.isInteger(value.property) || board[value.property]?.type !== 'property') throw Error('Propriedade inválida.');
  const buyer = value.type === 'buy' ? p : target;
  const seller = value.type === 'sell' ? p : target;
  const lot = r.properties[value.property];
  if (!lot || lot.owner !== seller.id) throw Error('A propriedade não pertence ao vendedor escolhido.');
  if (buyer.money < value.price) throw Error('O comprador não tem saldo suficiente para essa oferta.');
  r.trade = {id: randomUUID(), from: p.id, to: target.id, buyer: buyer.id, seller: seller.id, property: value.property, price: value.price, level: lot.level};
  log(r, `${p.name} propôs ${value.type === 'buy' ? 'comprar' : 'vender'} ${board[value.property].name} por $${value.price} para ${target.name}.`);
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
  log(r, `${buyer.name} comprou ${board[offer.property].name} de ${seller.name} por $${offer.price}.`);
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
      for (const [id, lot] of Object.entries(r.properties)) if (lot.owner === p.id) delete r.properties[id];
      log(r, `${p.name} deixou a partida.`);
      if (r.players[r.turn] === p) next(r);
      else if (r.players.filter(other => !other.bankrupt).length <= 1) finish(r);
    }
    return;
  }
  if (action === 'start') {
    if (r.phase !== 'lobby' || p !== r.players[0]) throw Error('Só o anfitrião pode iniciar a sala.');
    if (r.players.length < 2) throw Error('São necessários pelo menos 2 jogadores.');
    r.phase = 'playing'; r.deadline = Date.now() + 75000; log(r, 'A partida começou!'); return;
  }
  if (['trade-accept', 'trade-reject', 'trade-cancel'].includes(action)) {
    respondToTrade(r, p, action, value); return;
  }
  if (r.phase !== 'playing' || r.players[r.turn] !== p || p.bankrupt) throw Error('Aguarde seu turno.');
  if (action === 'trade-offer') { proposeTrade(r, p, value); return; }
  if (r.trade && action !== 'end') throw Error('Aguarde a resposta ou cancele sua oferta para continuar jogando.');
  if (action === 'roll') {
    if (r.stage !== 'roll') throw Error('Os dados já foram lançados.');
    r.dice = [dice(), dice()];
    const move = r.dice[0] + r.dice[1];
    if (p.position + move >= board.length) { p.money += 200; log(r, `${p.name} recebeu $200 pela volta.`); }
    p.position = (p.position + move) % board.length;
    const tile = board[p.position];
    r.stage = 'end'; log(r, `${p.name} tirou ${r.dice.join(' + ')} e chegou em ${tile.name}.`);
    if (tile.type === 'property') {
      const lot = r.properties[tile.id];
      if (!lot) r.stage = 'buy';
      else if (lot.owner !== p.id) {
        const rent = tile.rent * (lot.level + 1);
        charge(r, p, rent, r.players.find(other => other.id === lot.owner));
        log(r, `${p.name} pagou aluguel de até $${rent}.`);
      }
    } else if (tile.type === 'tax') { charge(r, p, 120); log(r, `${p.name} recebeu uma cobrança de $120 de imposto.`); }
    else if (tile.type === 'event') {
      if (dice() % 2) { p.money += 150; log(r, `${p.name} ganhou um bônus de $150!`); }
      else { charge(r, p, 90); log(r, `${p.name} recebeu uma cobrança de $90 por reparos.`); }
    }
    if (p.bankrupt) next(r);
  } else if (action === 'buy') {
    const tile = board[p.position];
    if (r.stage !== 'buy' || r.properties[tile.id]) throw Error('Não há terreno disponível para comprar.');
    if (p.money < tile.price) throw Error('Saldo insuficiente.');
    p.money -= tile.price; r.properties[tile.id] = {owner: p.id, level: 0}; r.stage = 'end';
    log(r, `${p.name} comprou ${tile.name}.`);
  } else if (action === 'upgrade') {
    const tile = board[value]; const lot = r.properties[value];
    if (!tile || !lot || lot.owner !== p.id || lot.level >= 3) throw Error('Melhoria indisponível.');
    const price = Math.floor(tile.price / 2);
    if (p.money < price) throw Error('Saldo insuficiente.');
    p.money -= price; lot.level++; log(r, `${p.name} melhorou ${tile.name} para nível ${lot.level}.`);
  } else if (action === 'end') {
    if (r.stage === 'roll') throw Error('Lance os dados primeiro.');
    next(r);
  } else throw Error('Ação desconhecida.');
}
export function snapshot(r) {
  const {touched, ...visible} = r;
  return {...visible, players: r.players.map(({token, ...p}) => ({...p, wealth: wealth(r, p)})), board};
}
