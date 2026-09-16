import {board as preview, SIDE, RULES, INDUSTRIES, buyable, money} from './board.js';
const $ = id => document.getElementById(id);
const palette = ['#c6f185', '#7bc6f1', '#ee98b3', '#eac776', '#bca1ef', '#76d9c2', '#f2a477', '#d4dee8'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session;
try { session = JSON.parse(localStorage.getItem('session') || 'null'); } catch { localStorage.removeItem('session'); }
let state, busy = false, polling = false, connected = false, animating = false, noticeTimer, hostAddresses = [], boardStamp;
const displayedPositions = new Map();
let lastAnimatedMove = 0;
const initialRightPanel = document.querySelector('.right-panel').innerHTML;
function notify(message) { $('notice').textContent = message.replace(/^Error invoking remote method '[^']+': Error: /, ''); $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 6500); }
async function request(path, body, endpoint = session?.endpoint || $('endpoint').value.trim()) {
  return window.desktop.request({endpoint, path, body, token: session?.token});
}
async function perform(fn) {
  if (busy || animating) return;
  busy = true; if (state) render();
  try { await fn(); } catch (e) { notify(e.message); }
  finally { busy = false; if (state) render(); }
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function acceptState(latest) {
  const movement = latest.lastMove;
  const shouldAnimate = movement && movement.sequence > lastAnimatedMove && displayedPositions.has(movement.player);
  state = latest;
  for (const player of state.players) if (!displayedPositions.has(player.id)) displayedPositions.set(player.id, player.position);
  if (!shouldAnimate) {
    for (const player of state.players) displayedPositions.set(player.id, player.position);
    if (movement) lastAnimatedMove = movement.sequence;
    render(); return;
  }
  animating = true;
  displayedPositions.set(movement.player, movement.from);
  render();
  for (const position of movement.path) {
    await delay(movement.direct ? 320 : 145);
    displayedPositions.set(movement.player, position);
    boardStamp = undefined;
    renderBoard();
    const pawn = document.querySelector(`.token[data-player-id="${movement.player}"]`);
    pawn?.classList.add('moving');
  }
  lastAnimatedMove = movement.sequence;
  animating = false;
  render();
}
function saveSession(data, endpoint) {
  session = {...data, endpoint}; localStorage.setItem('session', JSON.stringify(session));
}
async function enter(kind) {
  if (!$('name').value.trim()) throw Error('Digite seu nome antes de continuar.');
  const endpoint = $('endpoint').value.trim();
  const body = {name: $('name').value, code: $('code').value.trim().toUpperCase()};
  const data = await request(`/api/${kind}`, body, endpoint);
  saveSession(data, endpoint); await poll();
}
async function poll(manual = false) {
  if (!session || polling || busy) return;
  polling = true;
  const activeSession = session;
  try {
    const latest = await request(`/api/state?code=${session.code}`);
    if (session !== activeSession) return;
    const wasDisconnected = !connected; connected = true;
    $('connection').textContent = '● CONECTADO';
    if (wasDisconnected || JSON.stringify(latest) !== JSON.stringify(state)) await acceptState(latest);
    if (manual) notify('Reconectado! Seu dinheiro, propriedades, cartas e posição foram recuperados.');
  }
  catch(e) { if (session !== activeSession) return; connected = false; if (state) render(); $('connection').textContent = '○ SEM CONEXÃO'; $('setup').hidden = true; $('room-panel').hidden = false; $('room-code').textContent = session.code; $('lobby-note').textContent = 'Conexão interrompida. Seu progresso permanece no servidor. Use Reconectar ou aguarde a tentativa automática; não use Sair para reconectar.'; if (manual) notify('Ainda sem conexão. Confira o anfitrião; sua sessão foi mantida para tentar novamente.'); }
  finally { polling = false; }
}
function boardLocation(id) {
  if (id <= SIDE) return [SIDE + 1, SIDE + 1 - id];
  if (id <= SIDE * 2) return [SIDE * 2 + 1 - id, 1];
  if (id <= SIDE * 3) return [1, id - SIDE * 2 + 1];
  return [id - SIDE * 3 + 1, SIDE + 1];
}
function renderBoard() {
  const stamp = JSON.stringify({board:state?.board || preview, players:state?.players, properties:state?.properties, displayed:[...displayedPositions]});
  if (stamp === boardStamp) return;
  boardStamp = stamp;
  $('board').querySelectorAll('.tile').forEach(el => el.remove());
  for (const tile of state?.board || preview) {
    const el = document.createElement('button'); el.type = 'button'; el.dataset.tile = tile.id; el.className = `tile ${tile.type !== 'property' ? 'special ' + tile.type : ''}`;
    const [row, col] = boardLocation(tile.id); el.style.gridRow = row; el.style.gridColumn = col;
    const lot = state?.properties[tile.id];
    const owner = lot ? state.players.findIndex(p => p.id === lot.owner) : -1;
    const tokens = (state?.players || []).map((p, i) => ({...p, index:i, visualPosition:displayedPositions.get(p.id) ?? p.position})).filter(p => !p.bankrupt && p.visualPosition === tile.id);
    el.style.setProperty('--color', tile.color || '#abc8a9'); el.style.setProperty('--owner', palette[owner] || '#344');
    el.title = tile.name + (lot ? ` · ${state.players[owner].name} · aluguel ${tile.type === 'industry' ? money(tile.price) + ' × soma dos dados' : money(tile.rent * (lot.level + 1))}` : '');
    el.setAttribute('aria-label', el.title + ' — ver detalhes');
    el.innerHTML = `${tile.type === 'property' ? '<span class="stripe"></span>' : `<span class="tile-symbol">${({start:'↗',event:'?',rest:'☕',tax:'R$',jail:'▥','go-to-jail':'➜▥',industry:'⚙'})[tile.type]}</span>`}<span class="tile-name">${esc(tile.name)}</span>${buyable(tile) ? `<span class="tile-price">${tile.price / 1000} mil</span>` : ''}${lot ? `<span class="owner-mark">${owner + 1} ${'◆'.repeat(lot.level)}</span>` : ''}<span class="tokens">${tokens.map(p => `<span class="token ${p.jailed ? 'jailed' : ''}" data-player-id="${p.id}" title="${esc(p.name)}${p.jailed ? ' — preso' : tile.type === 'jail' ? ' — visitante' : ''}" style="--player:${palette[p.index]}"><span>${p.index + 1}</span></span>`).join('')}</span>`;
    $('board').append(el);
  }
}
function render() {
  $('setup').hidden = !!session; $('room-panel').hidden = !session;
  renderBoard();
  if (!state || !session) return;
  const me = state.players.find(p => p.id === session.id);
  const current = state.players[state.turn];
  const mine = current?.id === session.id && state.phase === 'playing' && !me?.bankrupt && !state.paused && connected && !animating;
  $('pause').hidden = state.phase !== 'playing'; $('pause').disabled = busy || !connected || me?.bankrupt;
  $('pause').textContent = state.paused ? 'Retomar partida' : 'Pausar partida';
  $('pause-banner').hidden = !state.paused || state.phase !== 'playing';
  $('pause-banner').textContent = `Partida pausada por ${state.players.find(p => p.id === state.pausedBy)?.name || 'um jogador'}. O tempo do turno está congelado.`;
  $('room-code').textContent = state.code;
  $('host-address').textContent = hostAddresses.length ? `Endereços desta máquina: ${hostAddresses.join(' ou ')}. Compartilhe o endereço acessível aos amigos e o código.` : `Servidor: ${session.endpoint}`;
  $('player-count').textContent = `${state.players.length}/8`;
  $('players').innerHTML = state.players.map((p,i) => `<div class="player ${p.id === current?.id && state.phase === 'playing' ? 'current' : ''} ${p.bankrupt ? 'out' : ''}"><div class="avatar" style="--player:${palette[i]}">${i + 1}</div><div class="player-name">${esc(p.name)}${p.id === session.id ? ' (você)' : ''}<small>${p.bankrupt ? 'Faliu' : `${p.jailed ? `Preso ${p.jailTurns}/3 · ` : ''}${INDUSTRIES.filter(id => state.properties[id]?.owner === p.id).length}/4 indústrias · ${p.jailCards} carta(s)`}</small><small>Patrimônio ${money(p.wealth)}</small></div><div class="player-money">${money(p.money)}</div></div>`).join('');
  $('start').hidden = state.phase !== 'lobby' || state.players[0]?.id !== session.id;
  $('start').disabled = busy || state.players.length < 2;
  $('lobby-note').textContent = state.phase === 'lobby' ? 'Compartilhe o código e o endereço. O anfitrião inicia com 2 a 8 jogadores.' : 'Sair durante a partida conta como desistência. Você pode fechar e reabrir o aplicativo para reconectar, se não for o anfitrião.';
  $('round').textContent = state.phase === 'lobby' ? '60 casas · 44 propriedades' : `Rodada ${state.round} · sem limite de rodadas`;
  $('table-title').textContent = state.phase === 'lobby' ? 'A mesa está aberta.' : state.phase === 'finished' ? 'Bons negócios, pessoal.' : mine ? 'Sua vez de fazer história.' : `${current.name} está jogando.`;
  $('turn-label').textContent = state.phase === 'lobby' ? 'ANTES DA PRIMEIRA JOGADA' : state.phase === 'finished' ? 'FIM DE PARTIDA' : mine ? 'É A SUA VEZ' : 'NA VEZ DE';
  $('turn-title').textContent = state.phase === 'lobby' ? 'Convide a turma.' : state.phase === 'finished' ? 'Temos um vencedor!' : current.name;
  $('turn-description').textContent = state.phase === 'lobby' ? 'Conquiste as quatro indústrias ou seja o último jogador a sobreviver.' : state.phase === 'finished' ? state.players.filter(p => state.winner.includes(p.id)).map(p => p.name).join(' e ') + (state.winnerReason === 'industries' ? ' venceu com as quatro indústrias!' : ' venceu como último sobrevivente!') : state.paused ? 'A partida e o cronômetro estão pausados.' : !connected ? 'Reconecte para continuar de onde parou.' : me?.bankrupt ? 'Você faliu, mas pode acompanhar o restante da partida.' : mine ? current.jailed ? `Na prisão: ${current.jailTurns}/3 turnos cumpridos. Tire uma dupla, espere ou use uma carta (${current.jailCards} disponível).` : state.stage === 'roll' ? `Lance os dados.${state.doubles ? ` ${state.doubles} dupla(s) neste turno: a terceira manda à prisão!` : ''}` : `Você está em ${state.board[current.position].name}.${state.extraRoll ? ' Tirou uma dupla e joga novamente.' : ''}` : 'Acompanhe o tabuleiro enquanto espera sua vez.';
  const disabled = busy ? 'disabled' : '';
  $('actions').innerHTML = mine ? `${state.stage === 'roll' ? `<button class="primary" data-action="roll" ${disabled}>⚄ ${me.jailed ? 'Tentar uma dupla' : 'Lançar dados'}</button>${me.jailed ? `<button class="secondary" data-action="jail-wait" ${disabled}>Esperar na prisão</button><button class="secondary" data-action="jail-card" ${busy || !me.jailCards ? 'disabled' : ''}>Usar carta de saída (${me.jailCards})</button>` : ''}` : `${state.stage === 'buy' ? `<button class="primary" data-action="buy" ${busy || me.money < state.board[me.position].price ? 'disabled' : ''}>Comprar por ${money(state.board[me.position].price)}</button>` : ''}<button class="secondary" data-action="end" ${disabled}>${state.extraRoll ? (state.stage === 'buy' ? 'Não comprar; jogar novamente' : 'Jogar novamente') : (state.stage === 'buy' ? 'Não comprar e passar' : 'Encerrar turno')} →</button>`}` : '';
  $('timer').hidden = state.phase !== 'playing'; updateTimer();
  renderTrade(mine);
  const assets = Object.entries(state.properties).filter(([,lot]) => lot.owner === session.id);
  $('asset-count').textContent = assets.length;
  $('assets').innerHTML = assets.length ? assets.map(([id,lot]) => { const tile = state.board[id]; const cost = Math.floor(tile.price / 2); return `<div class="asset"><span class="asset-swatch" style="background:${tile.color}"></span><div class="asset-name">${esc(tile.name)}<small>${tile.type === 'industry' ? `${money(tile.price)} × soma dos dados` : `Nível ${lot.level} · aluguel ${money(tile.rent * (lot.level + 1))}`}</small></div>${tile.type === 'property' ? `<button data-action="upgrade" data-value="${id}" ${!mine || busy || state.trade || lot.level >= 3 || me.money < cost ? 'disabled' : ''}>${lot.level >= 3 ? 'Máx.' : '+ ' + money(cost)}</button>` : '<span class="hint">⚙</span>'}</div>`; }).join('') : '<p class="hint empty">Sua primeira propriedade é só uma jogada de distância.</p>';
  $('feed').innerHTML = state.logs.map(text => `<div class="feed-item">${esc(text)}</div>`).join('') || '<p class="hint">Os acontecimentos da partida aparecem aqui.</p>';
  if (state.dice.length) { $('die-one').textContent = String.fromCodePoint(0x267f + state.dice[0]); $('die-two').textContent = String.fromCodePoint(0x267f + state.dice[1]); }
}
function renderTrade(mine) {
  const offer = state.trade;
  $('trade-panel').hidden = state.phase !== 'playing';
  $('send-trade').disabled = busy || !$('trade-property').value;
  if (!mine || offer) $('trade-dialog').close();
  if (!offer) {
    $('trade-content').innerHTML = mine
      ? '<p class="hint">Escolha um jogador e proponha comprar ou vender uma propriedade por um valor definido por você.</p><button class="secondary wide" data-open-trade>Fazer uma oferta</button>'
      : '<p class="hint">Você pode propor negócios no seu turno e responder a ofertas quando elas chegarem.</p>';
    return;
  }
  const buyer = state.players.find(p => p.id === offer.buyer);
  const seller = state.players.find(p => p.id === offer.seller);
  const toMe = offer.to === session.id;
  const fromMe = offer.from === session.id;
  const disabled = busy || state.paused || !connected ? 'disabled' : '';
  $('trade-content').innerHTML = `<div class="eyebrow accent">${toMe ? 'OFERTA PARA VOCÊ' : 'OFERTA PENDENTE'}</div><h4>${esc(state.board[offer.property].name)}</h4><p class="muted">${esc(buyer.name)} paga <strong>${money(offer.price)}</strong> a ${esc(seller.name)} pela propriedade com nível ${offer.level}.</p>${toMe ? `<p class="hint">${offer.buyer === session.id ? 'Ao aceitar, você paga e recebe a propriedade.' : 'Ao aceitar, você recebe o valor e entrega a propriedade.'}</p><div class="button-row"><button class="primary" data-action="trade-accept" data-value="${offer.id}" ${disabled}>Aceitar</button><button class="secondary" data-action="trade-reject" data-value="${offer.id}" ${disabled}>Recusar</button></div>` : fromMe ? `<p class="hint">Aguardando resposta. A oferta expira ao encerrar seu turno.</p><button class="ghost wide" data-action="trade-cancel" data-value="${offer.id}" ${disabled}>Cancelar oferta</button>` : '<p class="hint">Os jogadores estão decidindo. Nenhuma transferência aconteceu ainda.</p>'}`;
  if (mine) $('actions').querySelectorAll('[data-action]').forEach(button => { if (button.dataset.action !== 'end') button.disabled = true; });
}
function fillTradeProperties() {
  const selling = $('trade-type').value === 'sell';
  const owner = selling ? session.id : $('trade-target').value;
  const lots = Object.entries(state.properties).filter(([, lot]) => lot.owner === owner);
  $('trade-property').innerHTML = lots.length ? lots.map(([id, lot]) => `<option value="${id}">${esc(state.board[id].name)} · nível ${lot.level}</option>`).join('') : '<option value="">Nenhuma propriedade disponível</option>';
  const buyer = state.players.find(p => p.id === (selling ? $('trade-target').value : session.id));
  $('trade-budget').textContent = buyer ? `Saldo do comprador (${buyer.name}): ${money(buyer.money)}.` : '';
  $('send-trade').disabled = !lots.length || busy;
}
function openTrade() {
  if (busy || state?.phase !== 'playing' || state.players[state.turn].id !== session.id || state.trade) return;
  $('trade-target').innerHTML = state.players.filter(p => p.id !== session.id && !p.bankrupt).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('trade-price').value = ''; fillTradeProperties(); $('trade-dialog').showModal();
}
function updateTimer() { if (state?.phase === 'playing') $('timer').textContent = `◷ ${Math.max(0, Math.ceil((state.paused ? state.pauseRemaining : state.deadline - Date.now()) / 1000))}s ${state.paused ? 'restantes · PAUSADO' : 'para encerrar o turno'}`; }
$('host').onclick = () => perform(async () => {
  if (!$('name').value.trim()) throw Error('Digite seu nome antes de hospedar.');
  const host = await window.desktop.host(); hostAddresses = host.addresses; $('endpoint').value = host.endpoint; await enter('create');
});
$('create').onclick = () => perform(() => enter('create'));
$('join').onclick = () => perform(() => enter('join'));
$('start').onclick = () => perform(async () => { await acceptState(await request('/api/action', {code: session.code, action:'start'})); });
document.addEventListener('click', event => {
  const tileButton = event.target.closest('[data-tile]');
  if (tileButton) { showTile(Number(tileButton.dataset.tile)); return; }
  if (event.target.closest('[data-open-trade]')) { openTrade(); return; }
  const button = event.target.closest('[data-action]');
  if (button) perform(async () => { await acceptState(await request('/api/action', {code:session.code, action:button.dataset.action, value:button.dataset.action.startsWith('trade-') ? button.dataset.value : Number(button.dataset.value)})); });
});
$('trade-type').onchange = fillTradeProperties;
$('trade-target').onchange = fillTradeProperties;
$('close-trade').onclick = () => $('trade-dialog').close();
$('trade-form').onsubmit = event => {
  event.preventDefault();
  const value = {type:$('trade-type').value, target:$('trade-target').value, property:Number($('trade-property').value), price:Number($('trade-price').value)};
  perform(async () => { await acceptState(await request('/api/action', {code:session.code, action:'trade-offer', value})); });
};
$('leave').onclick = () => $('leave-dialog').showModal();
$('cancel-leave').onclick = () => $('leave-dialog').close();
$('confirm-leave').onclick = () => perform(async () => {
  $('leave-dialog').close();
  try { await request('/api/action', {code:session.code, action:'leave'}); } catch { /* Permite sair mesmo se o servidor já encerrou. */ }
  localStorage.removeItem('session'); session = null; state = null;
  document.querySelector('.right-panel').innerHTML = initialRightPanel;
  $('connection').textContent = 'EDIÇÃO DESKTOP'; $('table-title').textContent = 'Construa sua sorte.';
  $('round').textContent = '60 casas · 44 propriedades'; $('pause').hidden = true; $('pause-banner').hidden = true;
  $('die-one').textContent = '⚄'; $('die-two').textContent = '⚂'; render();
});
$('copy-code').onclick = () => navigator.clipboard.writeText(session.code).then(() => notify('Código copiado! Envie também o endereço do servidor.')).catch(() => notify(`Código: ${session.code}`));
$('view').onclick = () => { const top = $('board').classList.toggle('top'); $('view').textContent = top ? 'Vista 3D' : 'Vista de cima'; };
$('rules-button').onclick = () => $('rules').showModal(); $('close-rules').onclick = () => $('rules').close();
$('reconnect').onclick = () => { if (polling || busy) notify('Uma tentativa de conexão já está em andamento.'); else { $('connection').textContent = 'RECONECTANDO…'; poll(true); } };
$('pause').onclick = () => perform(async () => { await acceptState(await request('/api/action', {code:session.code, action:state.paused ? 'resume' : 'pause'})); });
function showTile(id) {
  const tile = (state?.board || preview)[id], lot = state?.properties[id];
  $('tile-title').textContent = tile.name;
  $('tile-detail').textContent = buyable(tile) ? `Preço original: ${money(tile.price)}. ${lot ? 'Proprietário: ' + state.players.find(p => p.id === lot.owner).name + '.' : 'Disponível no banco.'} ${tile.type === 'industry' ? `Aluguel: ${money(tile.price)} multiplicado pela soma dos dois dados. Conquiste as quatro indústrias para vencer. Não recebe melhorias.` : `Aluguel: ${money(tile.rent * ((lot?.level || 0) + 1))}. Nível ${lot?.level || 0} de 3.`}` : ({jail:'Cair aqui pelo movimento normal é apenas uma visita. Quem foi enviado à prisão precisa tirar uma dupla, cumprir três turnos ou usar a carta de saída.', 'go-to-jail':'Você é enviado à prisão no canto oposto, sem bônus de partida pelo deslocamento.', event:'Compre uma carta Sorte: bônus, reparos, ir à prisão ou guardar uma carta Sair da prisão.',start:`Cada volta completa rende ${money(RULES.lapBonus)}.`,rest:'Casa de descanso. Nenhuma cobrança.',tax:`Pague ${money(RULES.tax)} ao banco.`})[tile.type];
  $('tile-dialog').showModal();
}
$('close-tile').onclick = () => $('tile-dialog').close();
renderBoard(); if (session) poll(); setInterval(poll, 1200); setInterval(updateTimer, 250);
