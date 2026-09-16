const $ = id => document.getElementById(id);
const palette = ['#c6f185', '#7bc6f1', '#ee98b3', '#eac776', '#bca1ef', '#76d9c2', '#f2a477', '#d4dee8'];
const money = value => '$' + value.toLocaleString('pt-BR');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session;
try { session = JSON.parse(localStorage.getItem('session') || 'null'); } catch { localStorage.removeItem('session'); }
let state, busy = false, polling = false, noticeTimer, hostAddresses = [];
const initialRightPanel = document.querySelector('.right-panel').innerHTML;
const placeholderNames = ['PARTIDA','Vila Aurora','Rua das Flores','Praça Solar','SORTE','Porto Azul','Marina','Ilha Coral','FÉRIAS','Alameda Verde','Jardim Real','Parque Central','IMPOSTO','Avenida Neon','Distrito Tech','Torre Digital','SORTE','Praia Dourada','Costa Bela','Mirante','CAFÉ','Boulevard','Palácio','Skyline'];
const special = {0:'start',4:'event',8:'rest',12:'tax',16:'event',20:'rest'};
let n = 0;
const preview = placeholderNames.map((name, id) => ({id, name, type:special[id] || 'property', color: special[id] ? null : ['#ed9e64','#50bdd4','#79bd8a','#a389dc','#efcb62','#ef829a'][Math.floor(n++ / 3)], price: 120 + Math.floor((n - 1) / 3) * 50}));
function notify(message) { $('notice').textContent = message.replace(/^Error invoking remote method '[^']+': Error: /, ''); $('notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('notice').hidden = true, 6500); }
async function request(path, body, endpoint = session?.endpoint || $('endpoint').value.trim()) {
  return window.desktop.request({endpoint, path, body, token: session?.token});
}
async function perform(fn) {
  if (busy) return;
  busy = true; if (state) render();
  try { await fn(); } catch (e) { notify(e.message); }
  finally { busy = false; if (state) render(); }
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
async function poll() {
  if (!session || polling || busy) return;
  polling = true;
  const activeSession = session;
  try {
    const latest = await request(`/api/state?code=${session.code}`);
    if (session !== activeSession) return;
    $('connection').textContent = '● CONECTADO';
    if (JSON.stringify(latest) !== JSON.stringify(state)) { state = latest; render(); }
  }
  catch(e) { if (session !== activeSession) return; $('connection').textContent = '○ SEM CONEXÃO'; $('setup').hidden = true; $('room-panel').hidden = false; $('room-code').textContent = session.code; $('lobby-note').textContent = 'Tentando reconectar. Mantenha o anfitrião aberto. Se a sala acabou, saia e crie outra.'; }
  finally { polling = false; }
}
function boardLocation(id) {
  if (id <= 6) return [7, 7 - id];
  if (id <= 12) return [13 - id, 1];
  if (id <= 18) return [1, id - 11];
  return [id - 17, 7];
}
function renderBoard() {
  $('board').querySelectorAll('.tile').forEach(el => el.remove());
  for (const tile of state?.board || preview) {
    const el = document.createElement('div'); el.className = `tile ${tile.type !== 'property' ? 'special ' + tile.type : ''}`;
    const [row, col] = boardLocation(tile.id); el.style.gridRow = row; el.style.gridColumn = col;
    const lot = state?.properties[tile.id];
    const owner = lot ? state.players.findIndex(p => p.id === lot.owner) : -1;
    const tokens = (state?.players || []).map((p, i) => ({...p, index:i})).filter(p => !p.bankrupt && p.position === tile.id);
    el.style.setProperty('--color', tile.color || '#abc8a9'); el.style.setProperty('--owner', palette[owner] || '#344');
    el.title = tile.name + (lot ? ` · ${state.players[owner].name} · aluguel ${money(tile.rent * (lot.level + 1))}` : '');
    el.innerHTML = `${tile.type === 'property' ? '<span class="stripe"></span>' : `<span class="tile-symbol">${({start:'↗',event:'?',rest:'☕',tax:'$'})[tile.type]}</span>`}<span class="tile-name">${esc(tile.name)}</span>${tile.type === 'property' ? `<span class="tile-price">${money(tile.price)}</span>` : ''}${lot ? `<span class="owner-mark">${owner + 1} ${'◆'.repeat(lot.level)}</span>` : ''}<span class="tokens">${tokens.map(p => `<span class="token" style="--player:${palette[p.index]}">${p.index + 1}</span>`).join('')}</span>`;
    $('board').append(el);
  }
}
function render() {
  $('setup').hidden = !!session; $('room-panel').hidden = !session;
  renderBoard();
  if (!state || !session) return;
  const me = state.players.find(p => p.id === session.id);
  const current = state.players[state.turn];
  const mine = current?.id === session.id && state.phase === 'playing' && !me?.bankrupt;
  $('room-code').textContent = state.code;
  $('host-address').textContent = hostAddresses.length ? `Endereços desta máquina: ${hostAddresses.join(' ou ')}. Compartilhe o endereço acessível aos amigos e o código.` : `Servidor: ${session.endpoint}`;
  $('player-count').textContent = `${state.players.length}/8`;
  $('players').innerHTML = state.players.map((p,i) => `<div class="player ${p.id === current?.id && state.phase === 'playing' ? 'current' : ''} ${p.bankrupt ? 'out' : ''}"><div class="avatar" style="--player:${palette[i]}">${i + 1}</div><div class="player-name">${esc(p.name)}${p.id === session.id ? ' (você)' : ''}<small>${p.bankrupt ? 'Faliu' : 'Patrimônio ' + money(p.wealth)}</small></div><div class="player-money">${money(p.money)}</div></div>`).join('');
  $('start').hidden = state.phase !== 'lobby' || state.players[0]?.id !== session.id;
  $('start').disabled = busy || state.players.length < 2;
  $('lobby-note').textContent = state.phase === 'lobby' ? 'Compartilhe o código e o endereço. O anfitrião inicia com 2 a 8 jogadores.' : 'Sair durante a partida conta como desistência. Você pode fechar e reabrir o aplicativo para reconectar, se não for o anfitrião.';
  $('round').textContent = state.phase === 'lobby' ? 'Aguardando jogadores' : `Rodada ${Math.min(state.round, state.maxRounds)} de ${state.maxRounds}`;
  $('table-title').textContent = state.phase === 'lobby' ? 'A mesa está aberta.' : state.phase === 'finished' ? 'Bons negócios, pessoal.' : mine ? 'Sua vez de fazer história.' : `${current.name} está jogando.`;
  $('turn-label').textContent = state.phase === 'lobby' ? 'ANTES DA PRIMEIRA JOGADA' : state.phase === 'finished' ? 'FIM DE PARTIDA' : mine ? 'É A SUA VEZ' : 'NA VEZ DE';
  $('turn-title').textContent = state.phase === 'lobby' ? 'Convide a turma.' : state.phase === 'finished' ? 'Temos um vencedor!' : current.name;
  $('turn-description').textContent = state.phase === 'lobby' ? 'Até oito pessoas, uma cidade e vinte rodadas para construir seu patrimônio.' : state.phase === 'finished' ? state.players.filter(p => state.winner.includes(p.id)).map(p => p.name).join(' e ') + ' venceu por patrimônio ou sobrevivência.' : me?.bankrupt ? 'Você faliu, mas pode acompanhar o restante da partida.' : mine ? state.stage === 'roll' ? 'Lance os dados. O próximo grande negócio pode estar logo ali.' : `Você está em ${state.board[current.position].name}.` : 'Acompanhe o tabuleiro enquanto espera sua vez.';
  const disabled = busy ? 'disabled' : '';
  $('actions').innerHTML = mine ? `${state.stage === 'roll' ? `<button class="primary" data-action="roll" ${disabled}>⚄ Lançar dados</button>` : `${state.stage === 'buy' ? `<button class="primary" data-action="buy" ${busy || me.money < state.board[me.position].price ? 'disabled' : ''}>Comprar por ${money(state.board[me.position].price)}</button>` : ''}<button class="secondary" data-action="end" ${disabled}>${state.stage === 'buy' ? 'Não comprar e passar' : 'Encerrar turno'} →</button>`}` : '';
  $('timer').hidden = state.phase !== 'playing'; updateTimer();
  const assets = Object.entries(state.properties).filter(([,lot]) => lot.owner === session.id);
  $('asset-count').textContent = assets.length;
  $('assets').innerHTML = assets.length ? assets.map(([id,lot]) => { const tile = state.board[id]; const cost = Math.floor(tile.price / 2); return `<div class="asset"><span class="asset-swatch" style="background:${tile.color}"></span><div class="asset-name">${esc(tile.name)}<small>Nível ${lot.level} · aluguel ${money(tile.rent * (lot.level + 1))}</small></div><button data-action="upgrade" data-value="${id}" ${!mine || busy || lot.level >= 3 || me.money < cost ? 'disabled' : ''}>${lot.level >= 3 ? 'Máx.' : '+ ' + money(cost)}</button></div>`; }).join('') : '<p class="hint empty">Sua primeira propriedade é só uma jogada de distância.</p>';
  $('feed').innerHTML = state.logs.map(text => `<div class="feed-item">${esc(text)}</div>`).join('') || '<p class="hint">Os acontecimentos da partida aparecem aqui.</p>';
  if (state.dice.length) { $('die-one').textContent = String.fromCodePoint(0x267f + state.dice[0]); $('die-two').textContent = String.fromCodePoint(0x267f + state.dice[1]); }
}
function updateTimer() { if (state?.phase === 'playing') $('timer').textContent = `◷ ${Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000))}s para encerrar o turno`; }
$('host').onclick = () => perform(async () => {
  if (!$('name').value.trim()) throw Error('Digite seu nome antes de hospedar.');
  const host = await window.desktop.host(); hostAddresses = host.addresses; $('endpoint').value = host.endpoint; await enter('create');
});
$('create').onclick = () => perform(() => enter('create'));
$('join').onclick = () => perform(() => enter('join'));
$('start').onclick = () => perform(async () => { state = await request('/api/action', {code: session.code, action:'start'}); });
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) perform(async () => { state = await request('/api/action', {code:session.code, action:button.dataset.action, value:Number(button.dataset.value)}); });
});
$('leave').onclick = () => $('leave-dialog').showModal();
$('cancel-leave').onclick = () => $('leave-dialog').close();
$('confirm-leave').onclick = () => perform(async () => {
  $('leave-dialog').close();
  try { await request('/api/action', {code:session.code, action:'leave'}); } catch { /* Permite sair mesmo se o servidor já encerrou. */ }
  localStorage.removeItem('session'); session = null; state = null;
  document.querySelector('.right-panel').innerHTML = initialRightPanel;
  $('connection').textContent = 'EDIÇÃO DESKTOP'; $('table-title').textContent = 'Construa sua sorte.';
  $('round').textContent = '20 rodadas · maior patrimônio vence';
  $('die-one').textContent = '⚄'; $('die-two').textContent = '⚂'; render();
});
$('copy-code').onclick = () => navigator.clipboard.writeText(session.code).then(() => notify('Código copiado! Envie também o endereço do servidor.')).catch(() => notify(`Código: ${session.code}`));
$('view').onclick = () => { const top = $('board').classList.toggle('top'); $('view').textContent = top ? 'Vista 3D' : 'Vista de cima'; };
$('rules-button').onclick = () => $('rules').showModal(); $('close-rules').onclick = () => $('rules').close();
renderBoard(); if (session) poll(); setInterval(poll, 1200); setInterval(updateTimer, 250);
