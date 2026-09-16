/**
 * Todo o som do jogo, sintetizado na hora com WebAudio.
 *
 * Nenhum arquivo de áudio no projeto — tiros são rajadas de ruído com um
 * oscilador grave por baixo, a recarga são dois cliques, a explosão é ruído
 * com envelope longo. Não é orquestra, mas dá leitura instantânea do que
 * aconteceu e mantém o repositório 100% código.
 *
 * Posicional simples: volume cai com a distância e o StereoPanner puxa o som
 * para o lado de onde veio, calculado pelo ângulo relativo à câmera.
 */

let ctx = null;
let mestre = null;

function contexto() {
  if (!ctx) {
    ctx = new AudioContext();
    mestre = ctx.createGain();
    mestre.gain.value = 0.5;
    mestre.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Chamada num primeiro clique/tecla: navegador só libera áudio após gesto. */
export function destravarAudio() {
  contexto();
}

function saida(dist = 0, pan = 0) {
  const c = contexto();
  const ganho = c.createGain();
  ganho.gain.value = Math.min(1, 1 / (1 + dist * 0.09));
  const panner = c.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  ganho.connect(panner);
  panner.connect(mestre);
  return ganho;
}

function ruidoBranco(duracao) {
  const c = contexto();
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duracao), c.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  const fonte = c.createBufferSource();
  fonte.buffer = buffer;
  return fonte;
}

function estalo(destino, { duracao = 0.08, freq = 900, tipo = 'square', volume = 0.4, quando = 0 }) {
  const c = contexto();
  const osc = c.createOscillator();
  osc.type = tipo;
  osc.frequency.value = freq;
  const g = c.createGain();
  const t = c.currentTime + quando;
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + duracao);
  osc.connect(g);
  g.connect(destino);
  osc.start(t);
  osc.stop(t + duracao + 0.02);
}

// ------------------------------------------------------------------ tiros

const PERFIL_TIRO = {
  pistola: { ruido: 0.07, grave: 220, queda: 60, volume: 0.5 },
  shotgun: { ruido: 0.16, grave: 110, queda: 35, volume: 0.85 },
  smg: { ruido: 0.05, grave: 260, queda: 90, volume: 0.4 },
  rifle: { ruido: 0.09, grave: 160, queda: 50, volume: 0.6 },
  sniper: { ruido: 0.22, grave: 80, queda: 24, volume: 0.95 },
  marreta: { ruido: 0.04, grave: 150, queda: 70, volume: 0.35 }
};

export function tocarTiro(categoria, dist = 0, pan = 0) {
  const c = contexto();
  const perfil = PERFIL_TIRO[categoria] ?? PERFIL_TIRO.rifle;
  const destino = saida(dist, pan);

  // O "crack": ruído com envelope agudíssimo.
  const fonte = ruidoBranco(perfil.ruido);
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 5000;
  const g = c.createGain();
  g.gain.setValueAtTime(perfil.volume, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + perfil.ruido);
  fonte.connect(filtro);
  filtro.connect(g);
  g.connect(destino);
  fonte.start();

  // O "punch": oscilador grave despencando de pitch.
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(perfil.grave, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(perfil.queda, c.currentTime + 0.09);
  const g2 = c.createGain();
  g2.gain.setValueAtTime(perfil.volume * 0.8, c.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  osc.connect(g2);
  g2.connect(destino);
  osc.start();
  osc.stop(c.currentTime + 0.15);
}

export function tocarVazio() {
  estalo(saida(), { duracao: 0.04, freq: 1400, volume: 0.2 });
}

export function tocarRecarga() {
  const destino = saida();
  estalo(destino, { duracao: 0.05, freq: 800, volume: 0.3 });
  estalo(destino, { duracao: 0.05, freq: 1100, volume: 0.3, quando: 0.14 });
}

export function tocarHit() {
  estalo(saida(), { duracao: 0.06, freq: 1800, tipo: 'sine', volume: 0.35 });
}

export function tocarHeadshot() {
  const destino = saida();
  estalo(destino, { duracao: 0.05, freq: 2100, tipo: 'sine', volume: 0.4 });
  estalo(destino, { duracao: 0.07, freq: 2700, tipo: 'sine', volume: 0.4, quando: 0.06 });
}

export function tocarDanoRecebido() {
  const c = contexto();
  const destino = saida();
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.16);
  const g = c.createGain();
  g.gain.setValueAtTime(0.4, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
  osc.connect(g);
  g.connect(destino);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}

export function tocarExplosao(dist = 0, pan = 0) {
  const c = contexto();
  const destino = saida(dist, pan);
  const fonte = ruidoBranco(0.9);
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.setValueAtTime(2400, c.currentTime);
  filtro.frequency.exponentialRampToValueAtTime(120, c.currentTime + 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(1.0, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.9);
  fonte.connect(filtro);
  filtro.connect(g);
  g.connect(destino);
  fonte.start();
}

export function tocarBloco(colocado, dist = 0, pan = 0) {
  estalo(saida(dist, pan), {
    duracao: 0.07,
    freq: colocado ? 480 : 300,
    tipo: 'square',
    volume: 0.3
  });
}

export function tocarCompra() {
  const destino = saida();
  // Arpejo curto de caixa registradora.
  estalo(destino, { duracao: 0.08, freq: 880, tipo: 'sine', volume: 0.3 });
  estalo(destino, { duracao: 0.08, freq: 1175, tipo: 'sine', volume: 0.3, quando: 0.07 });
  estalo(destino, { duracao: 0.12, freq: 1568, tipo: 'sine', volume: 0.3, quando: 0.14 });
}

export function tocarCompraNegada() {
  estalo(saida(), { duracao: 0.14, freq: 220, tipo: 'square', volume: 0.25 });
}

export function tocarInicioRound() {
  const destino = saida();
  estalo(destino, { duracao: 0.25, freq: 660, tipo: 'sine', volume: 0.4 });
  estalo(destino, { duracao: 0.4, freq: 990, tipo: 'sine', volume: 0.4, quando: 0.2 });
}

export function tocarFimRound(vitoria) {
  const destino = saida();
  if (vitoria) {
    estalo(destino, { duracao: 0.18, freq: 523, tipo: 'sine', volume: 0.4 });
    estalo(destino, { duracao: 0.18, freq: 659, tipo: 'sine', volume: 0.4, quando: 0.15 });
    estalo(destino, { duracao: 0.3, freq: 784, tipo: 'sine', volume: 0.4, quando: 0.3 });
  } else {
    estalo(destino, { duracao: 0.25, freq: 330, tipo: 'sine', volume: 0.35 });
    estalo(destino, { duracao: 0.35, freq: 247, tipo: 'sine', volume: 0.35, quando: 0.2 });
  }
}

let ultimoPasso = 0;

export function tocarPasso() {
  const agora = performance.now();
  if (agora - ultimoPasso < 320) return; // ritmo de passos, não metralhadora
  ultimoPasso = agora;
  const c = contexto();
  const destino = saida();
  const fonte = ruidoBranco(0.04);
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 500;
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
  fonte.connect(filtro);
  filtro.connect(g);
  g.connect(destino);
  fonte.start();
}

/**
 * Distância e pan de um evento no mundo em relação à câmera.
 * O pan usa o ângulo entre o "direita" da câmera e o vetor até a fonte.
 */
export function espacial(minhaPos, yaw, pos) {
  const dx = pos.x - minhaPos.x;
  const dz = pos.z - minhaPos.z;
  const dist = Math.hypot(dx, dz, (pos.y ?? 0) - (minhaPos.y ?? 0));
  // Vetor "direita" da câmera (yaw 0 olha para -Z → direita é +X).
  const dirX = Math.cos(yaw);
  const dirZ = -Math.sin(yaw);
  const comprimento = Math.hypot(dx, dz) || 1;
  const pan = (dx * dirX + dz * dirZ) / comprimento;
  return { dist, pan };
}
