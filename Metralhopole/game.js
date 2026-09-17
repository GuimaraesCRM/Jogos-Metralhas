import { randomInt, randomUUID } from 'node:crypto';

import {board, smallBoard, RULES, JAIL, INDUSTRIES, SMALL_INDUSTRIES, buyable, ownsGroup, rentFor, improvementCost, money} from './public/board.js';
export {board, RULES, JAIL, INDUSTRIES};
export const CHARACTERS=['character-female-a','character-female-b','character-female-c','character-female-d','character-female-e','character-female-f','character-male-a','character-male-b','character-male-c','character-male-d','character-male-e','character-male-f'];
function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createRoom(code, name, options = {}) {
  const maxPlayers = Number(options.maxPlayers) === 4 ? 4 : 8;
  const room = {code, maxPlayers, board:maxPlayers===4?smallBoard:board, industries:maxPlayers===4?SMALL_INDUSTRIES:INDUSTRIES, jail:maxPlayers===4?8:JAIL, phase:'lobby', players:[], properties:{}, turn:0, round:1, stage:'roll', dice:[], rollSequence:0, doubles:0, extraRoll:false, logs:[], winner:null, winnerReason:null, touched:Date.now(), deadline:null, paused:false, pauseRemaining:null, pausedBy:null, trade:null, pendingPayment:null, pendingChoice:null, carnival:null, lastCard:null, lastMove:null, moveSequence:0,
    deck:shuffle(['bonus','bonus','promotion','promotion','refund','lottery','repair','repair','plumbing','taxFine','jail','jail','release','release','carnival','blackout','joker']), discard:[]};
  join(room, name, options.character);
  return room;
}
export function join(room, name, requestedCharacter) {
  if (room.phase !== 'lobby') throw Error('A partida já começou.');
  if (room.players.length >= room.maxPlayers) throw Error(`A sala está cheia (${room.maxPlayers} jogadores).`);
  const clean = String(name || '').trim().slice(0, 20);
  if (!clean) throw Error('Informe seu nome.');
  if (room.players.some(p => p.name.toLowerCase() === clean.toLowerCase())) throw Error('Esse nome já está na sala.');
  const used=new Set(room.players.map(p=>p.character)); const character=requestedCharacter||CHARACTERS.find(item=>!used.has(item));
  if(!CHARACTERS.includes(character)) throw Error('Escolha um personagem válido.');
  if(used.has(character)) throw Error('Esse personagem já foi escolhido por outro jogador.');
  const p = {id:randomUUID(), token:randomUUID(), name:clean, character, money:RULES.startingMoney, position:0, bankrupt:false, jailed:false, jailTurns:0, jailCards:0};
  room.players.push(p);
  return p;
}
const log = (r, text) => { r.logs.unshift(text); r.logs = r.logs.slice(0, 30); };
export const wealth = (r, p) => p.money + Object.entries(r.properties).reduce((sum, [id, lot]) => sum + (lot.owner === p.id ? r.board[id].price + Array.from({length:lot.level},(_,i)=>improvementCost(r.board[id],i+1)).reduce((a,b)=>a+b,0) : 0), 0);
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
  const industrialist = active.find(p => r.industries.every(id => r.properties[id]?.owner === p.id));
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
    if(r.pendingPayment?.payer===current.id){
      for(const [id,lot] of Object.entries(r.properties).filter(([,lot])=>lot.owner===current.id).sort((a,b)=>r.board[a[0]].price-r.board[b[0]].price)){
        if(current.money>=r.pendingPayment.amount)break; const tile=r.board[id],value=Math.floor((tile.price+Array.from({length:lot.level},(_,i)=>improvementCost(tile,i+1)).reduce((a,b)=>a+b,0))*.75); current.money+=value; delete r.properties[id]; log(r,`${current.name} vendeu ${tile.name} automaticamente ao banco por ${money(value)}.`);
      }
      const owner=r.players.find(p=>p.id===r.pendingPayment.owner),amount=r.pendingPayment.amount; charge(r,current,amount,owner); r.pendingPayment=null; log(r,`${current.name} teve o aluguel de ${money(amount)} resolvido ao fim do tempo.`);
    }
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
  if (!Number.isInteger(value.property) || !buyable(r.board[value.property])) throw Error('Propriedade inválida.');
  const buyer = value.type === 'buy' ? p : target;
  const seller = value.type === 'sell' ? p : target;
  const lot = r.properties[value.property];
  if (!lot || lot.owner !== seller.id) throw Error('A propriedade não pertence ao vendedor escolhido.');
  if (buyer.money < value.price) throw Error('O comprador não tem saldo suficiente para essa oferta.');
  r.trade = {id: randomUUID(), from: p.id, to: target.id, buyer: buyer.id, seller: seller.id, property: value.property, price: value.price, level: lot.level};
  log(r, `${p.name} propôs ${value.type === 'buy' ? 'comprar' : 'vender'} ${r.board[value.property].name} por ${money(value.price)} para ${target.name}.`);
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
  log(r, `${buyer.name} comprou ${r.board[offer.property].name} de ${seller.name} por ${money(offer.price)}.`);
  checkVictory(r);
}
function sendToJail(r, p, reason, appendCurrentMove = false) {
  const from = p.position;
  p.position = r.jail; p.jailed = true; p.jailTurns = 0;
  const currentMove = appendCurrentMove && r.lastMove?.player === p.id && r.lastMove.to === from ? r.lastMove : null;
  r.lastMove = {sequence:++r.moveSequence, player:p.id, from:currentMove?.from ?? from, to:r.jail, path:[...(currentMove?.path || []), r.jail], direct:!currentMove};
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
  if (card !== 'joker') r.discard.push(card);
  if (card === 'joker') { r.pendingChoice={type:'joker',player:p.id}; r.stage='choice'; log(r, `${p.name} encontrou a raríssima METRALHA CORINGA e pode comprar uma propriedade livre pela metade do preço.`); }
  else if (card === 'carnival') { r.pendingChoice={type:'carnival',player:p.id}; r.stage='choice'; log(r, `${p.name} pode escolher uma propriedade para sediar o Carnaval e aumentar seu aluguel em 50%.`); }
  else if (card === 'blackout') { r.pendingChoice={type:'blackout',player:p.id}; r.stage='choice'; log(r, `${p.name} pode apagar uma propriedade adversária por cinco rodadas.`); }
  else if (card === 'jail') sendToJail(r, p, 'carta Sorte', true);
  else if (['bonus','promotion','refund','lottery'].includes(card)) { const amounts={bonus:25000,promotion:40000,refund:18000,lottery:60000}; p.money+=amounts[card]; log(r, ({bonus:`${p.name} recebeu um bônus de ${money(amounts[card])}.`,promotion:`${p.name} foi promovido no trabalho e recebeu ${money(amounts[card])}.`,refund:`${p.name} recebeu uma restituição de ${money(amounts[card])}.`,lottery:`${p.name} ganhou um prêmio de ${money(amounts[card])}.`})[card]); }
  else { const amounts={repair:15000,plumbing:22000,taxFine:30000}; charge(r,p,amounts[card]); log(r,({repair:`${p.name} pagou ${money(amounts[card])} por reparos.`,plumbing:`Um encanamento estourou e ${p.name} pagou ${money(amounts[card])}.`,taxFine:`${p.name} pagou uma multa bancária de ${money(amounts[card])}.`})[card]); }
}
function move(r, p, total) {
  const from = p.position;
  if (p.position + total >= r.board.length) { p.money += RULES.lapBonus; log(r, `${p.name} recebeu ${money(RULES.lapBonus)} pela volta.`); }
  p.position = (p.position + total) % r.board.length;
  r.lastMove = {sequence:++r.moveSequence, player:p.id, from, to:p.position, path:Array.from({length:total}, (_, step) => (from + step + 1) % r.board.length), direct:false};
  const tile = r.board[p.position];
  r.stage = 'end'; log(r, `${p.name} tirou ${r.dice.join(' + ')} e chegou em ${tile.name}.`);
  if (buyable(tile)) {
    const lot = r.properties[tile.id];
    if (!lot) r.stage = 'buy';
    else if (lot.owner !== p.id) {
      const completeGroup = tile.type === 'property' && ownsGroup(r.board, r.properties, lot.owner, tile.group);
      let rent = rentFor(tile, lot, total, completeGroup);
      if (r.carnival?.property===tile.id) rent=Math.ceil(rent*1.5);
      if (lot.blackoutUntil && lot.blackoutUntil>r.round) log(r, `${tile.name} está sem energia: nenhum aluguel é cobrado.`);
      else { r.pendingPayment={payer:p.id,owner:lot.owner,property:tile.id,amount:rent}; r.stage='rent'; log(r, `${p.name} precisa confirmar o aluguel de ${money(rent)} por ${tile.name}${completeGroup&&lot.level===0?' (grupo de cor completo)':''}.`); }
    } else if (tile.type==='property') { lot.visits=(lot.visits||1)+1; r.stage='upgrade'; log(r, `${p.name} voltou a ${tile.name} e pode construir.`); }
  } else if (tile.type === 'tax') { charge(r, p, RULES.tax); log(r, `${p.name} recebeu uma cobrança de ${money(RULES.tax)} de imposto.`); }
  else if (tile.type === 'event') drawCard(r, p);
  else if (tile.type === 'go-to-jail') sendToJail(r, p, 'casa Vá à prisão', true);
  else if (tile.type === 'jail') log(r, `${p.name} está apenas visitando a prisão.`);
  if (p.bankrupt) next(r);
}
function roll(r, p, dice) {
  if (r.stage !== 'roll') throw Error('Os dados já foram lançados.');
  r.dice = [dice(), dice()];
  r.rollSequence++;
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
  if (action === 'set-character') {
    if (r.phase !== 'lobby') throw Error('O personagem só pode ser alterado no lobby.');
    if (!CHARACTERS.includes(value)) throw Error('Escolha um personagem válido.');
    if (r.players.some(other => other !== p && other.character === value)) throw Error('Esse personagem já foi escolhido por outro jogador.');
    p.character = value;
    log(r, `${p.name} escolheu um novo personagem.`);
    return;
  }
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
  if (action === 'sell-bank' || action === 'sell-bank-auto') {
    if (r.phase !== 'playing' || p.bankrupt) throw Error('A venda ao banco não está disponível.');
    if (action === 'sell-bank-auto' && (!r.pendingPayment || r.pendingPayment.payer!==p.id)) throw Error('Não há cobrança pendente para liquidar.');
    if (action === 'sell-bank' && r.players[r.turn] !== p) throw Error('Venda propriedades somente durante seu turno.');
    const owned=Object.entries(r.properties).filter(([,lot])=>lot.owner===p.id);
    const sell=id=>{ const lot=r.properties[id],tile=r.board[id]; if(!lot||lot.owner!==p.id) throw Error('Esse imóvel não é seu.'); const value=Math.floor((tile.price+Array.from({length:lot.level},(_,i)=>improvementCost(tile,i+1)).reduce((a,b)=>a+b,0))*.75); p.money+=value; delete r.properties[id]; log(r,`${p.name} vendeu ${tile.name} ao banco por ${money(value)} (75% do patrimônio investido).`); };
    if(action==='sell-bank') sell(String(value)); else for(const [id] of owned.sort((a,b)=>r.board[a[0]].price-r.board[b[0]].price)){ if(p.money>=r.pendingPayment.amount) break; sell(id); }
    return;
  }
  if (action === 'rent-confirm') {
    const payment=r.pendingPayment;
    if(!payment||payment.payer!==p.id) throw Error('Não há aluguel aguardando confirmação.');
    if(p.money<payment.amount) throw Error('Saldo insuficiente. Venda imóveis ao banco ou negocie antes de confirmar.');
    const owner=r.players.find(other=>other.id===payment.owner); charge(r,p,payment.amount,owner); r.pendingPayment=null; r.stage='end'; log(r,`${p.name} confirmou o pagamento de ${money(payment.amount)} a ${owner.name}.`); return;
  }
  if(action==='declare-bankruptcy'){
    const payment=r.pendingPayment;if(!payment||payment.payer!==p.id)throw Error('Não há cobrança pendente.'); const owner=r.players.find(other=>other.id===payment.owner); charge(r,p,payment.amount,owner); r.pendingPayment=null; if(p.bankrupt)next(r); return;
  }
  if (action === 'card-choice') {
    const choice=r.pendingChoice, id=Number(value), tile=r.board[id], lot=r.properties[id];
    if(!choice||choice.player!==p.id||!tile) throw Error('Escolha indisponível.');
    if(choice.type==='joker'){ if(!buyable(tile)||lot||p.money<Math.floor(tile.price/2)) throw Error('Escolha uma propriedade livre que você possa comprar.'); p.money-=Math.floor(tile.price/2); r.properties[id]={owner:p.id,level:0,visits:0}; log(r,`${p.name} usou a METRALHA CORINGA e comprou ${tile.name} com 50% de desconto.`); }
    else if(choice.type==='carnival'){ if(tile.type!=='property'||lot?.owner!==p.id) throw Error('Escolha uma propriedade comum sua.'); r.carnival={property:id,owner:p.id}; log(r,`${tile.name} agora sedia o Carnaval: aluguel 50% maior até outro Carnaval.`); }
    else { if(tile.type!=='property'||!lot||lot.owner===p.id) throw Error('Escolha uma propriedade comum de outro jogador.'); lot.blackoutUntil=r.round+5; log(r,`${tile.name} ficará em apagão por cinco rodadas.`); }
    r.pendingChoice=null; r.stage='end'; return;
  }
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
    const tile = r.board[p.position];
    if (r.stage !== 'buy' || r.properties[tile.id]) throw Error('Não há terreno disponível para comprar.');
    if (p.money < tile.price) throw Error('Saldo insuficiente.');
    p.money -= tile.price; r.properties[tile.id] = {owner: p.id, level: 0, visits: 1}; r.stage = 'end';
    log(r, `${p.name} comprou ${tile.name}.`);
    checkVictory(r);
  } else if (action === 'upgrade') {
    const id=Number(value?.property ?? value), target=Number(value?.level ?? ((r.properties[id]?.level||0)+1)); const tile=r.board[id], lot=r.properties[id];
    if(tile?.type==='industry') throw Error('Indústrias não recebem melhorias.');
    if(tile?.type!=='property'||!lot||lot.owner!==p.id||p.position!==id||r.stage!=='upgrade'||target<=lot.level||target>4) throw Error('Melhoria indisponível. É preciso cair novamente na propriedade.');
    if(target<=3 && lot.visits<2 || target===4 && lot.visits<3) throw Error('São necessárias duas visitas para casas e três para o hotel.');
    const price=Array.from({length:target-lot.level},(_,i)=>improvementCost(tile,lot.level+i+1)).reduce((a,b)=>a+b,0);
    if(p.money<price) throw Error('Saldo insuficiente.'); p.money-=price; lot.level=target; r.stage='end'; log(r,`${p.name} construiu ${target===4?'um hotel':`${target} casa(s)`} em ${tile.name}.`);
  } else if (action === 'end') {
    if(r.pendingPayment||r.pendingChoice) throw Error('Resolva a cobrança ou a carta antes de encerrar o turno.');
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
  return {...visible, players: r.players.map(({token, ...p}) => ({...p, wealth: wealth(r, p)})), board:r.board};
}
