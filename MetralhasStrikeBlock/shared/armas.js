/**
 * Tabela de armas e equipamentos, com as contas de dano.
 *
 * Cliente e servidor leem a mesma tabela: o menu de compra mostra estes preços
 * e o servidor cobra exatamente eles — divergência aqui viraria dinheiro de
 * graça ou compra impossível.
 */

export const CATEGORIAS = {
  PISTOLA: 'pistola',
  SHOTGUN: 'shotgun',
  SMG: 'smg',
  RIFLE: 'rifle',
  SNIPER: 'sniper'
};

export const ROTULO_CATEGORIA = {
  pistola: 'Pistolas',
  shotgun: 'Shotguns',
  smg: 'Submetralhadoras',
  rifle: 'Rifles',
  sniper: 'Snipers'
};

export const ARMAS = {
  pm9: {
    id: 'pm9',
    nome: 'PM-9',
    categoria: CATEGORIAS.PISTOLA,
    preco: 0,
    dano: 26,
    multCabeca: 4.0,
    rpm: 400,
    automatica: false,
    pellets: 1,
    rajada: 1,
    pente: 12,
    reserva: 36,
    spreadBase: 0.010,
    spreadAndando: 0.020,
    danoBloco: 2,
    recompensa: 300,
    zoom: null,
    slot: 2,
    spreadMirando: 0.010
  },
  magnum: {
    id: 'magnum',
    nome: 'Magnum Bloco',
    categoria: CATEGORIAS.PISTOLA,
    preco: 700,
    dano: 55,
    multCabeca: 4.0,
    rpm: 150,
    automatica: false,
    pellets: 1,
    rajada: 1,
    pente: 7,
    reserva: 21,
    spreadBase: 0.008,
    spreadAndando: 0.025,
    danoBloco: 4,
    recompensa: 300,
    zoom: null,
    slot: 2,
    spreadMirando: 0.008
  },
  canocurto: {
    id: 'canocurto',
    nome: 'Cano Curto',
    categoria: CATEGORIAS.SHOTGUN,
    preco: 1100,
    dano: 9,
    multCabeca: 1.5,
    rpm: 68,
    automatica: false,
    pellets: 8,
    rajada: 1,
    pente: 6,
    reserva: 24,
    spreadBase: 0.120,
    spreadAndando: 0.020,
    danoBloco: 10,
    recompensa: 900,
    zoom: null,
    slot: 1,
    spreadMirando: 0.120
  },
  repetidora: {
    id: 'repetidora',
    nome: 'Repetidora',
    categoria: CATEGORIAS.SHOTGUN,
    preco: 2000,
    dano: 8,
    multCabeca: 1.5,
    rpm: 210,
    automatica: false,
    pellets: 6,
    rajada: 1,
    pente: 7,
    reserva: 28,
    spreadBase: 0.100,
    spreadAndando: 0.020,
    danoBloco: 8,
    recompensa: 900,
    zoom: null,
    slot: 1,
    spreadMirando: 0.100
  },
  mpbloco: {
    id: 'mpbloco',
    nome: 'MP-Bloco',
    categoria: CATEGORIAS.SMG,
    preco: 1250,
    dano: 18,
    multCabeca: 2.5,
    rpm: 750,
    automatica: true,
    pellets: 1,
    rajada: 1,
    pente: 30,
    reserva: 90,
    spreadBase: 0.030,
    spreadAndando: 0.015,
    danoBloco: 2,
    recompensa: 600,
    zoom: null,
    slot: 1,
    spreadMirando: 0.030
  },
  metralhinha: {
    id: 'metralhinha',
    nome: 'Metralhinha',
    categoria: CATEGORIAS.SMG,
    preco: 1700,
    dano: 22,
    multCabeca: 2.5,
    rpm: 800,
    automatica: true,
    pellets: 1,
    rajada: 1,
    pente: 25,
    reserva: 100,
    spreadBase: 0.028,
    spreadAndando: 0.015,
    danoBloco: 2,
    recompensa: 600,
    zoom: null,
    slot: 1,
    spreadMirando: 0.028
  },
  mc47: {
    id: 'mc47',
    nome: 'MC-47',
    categoria: CATEGORIAS.RIFLE,
    preco: 2700,
    dano: 34,
    multCabeca: 4.0,
    rpm: 600,
    automatica: true,
    pellets: 1,
    rajada: 1,
    pente: 30,
    reserva: 90,
    spreadBase: 0.022,
    spreadAndando: 0.030,
    danoBloco: 4,
    recompensa: 300,
    zoom: null,
    slot: 1,
    spreadMirando: 0.022
  },
  mb4: {
    id: 'mb4',
    nome: 'MB-4',
    categoria: CATEGORIAS.RIFLE,
    preco: 3100,
    dano: 30,
    multCabeca: 3.6,
    rpm: 660,
    automatica: true,
    pellets: 1,
    rajada: 1,
    pente: 30,
    reserva: 90,
    spreadBase: 0.016,
    spreadAndando: 0.028,
    danoBloco: 3,
    recompensa: 300,
    zoom: null,
    slot: 1,
    spreadMirando: 0.016
  },
  tribloco: {
    id: 'tribloco',
    nome: 'Tribloco',
    categoria: CATEGORIAS.RIFLE,
    preco: 2050,
    dano: 30,
    multCabeca: 3.3,
    rpm: 500,
    automatica: false,
    pellets: 1,
    rajada: 3,
    pente: 24,
    reserva: 72,
    spreadBase: 0.018,
    spreadAndando: 0.028,
    danoBloco: 3,
    recompensa: 300,
    zoom: null,
    slot: 1,
    spreadMirando: 0.018
  },
  luneta: {
    id: 'luneta',
    nome: 'Luneta Leve',
    categoria: CATEGORIAS.SNIPER,
    preco: 1700,
    dano: 74,
    multCabeca: 4.0,
    rpm: 48,
    automatica: false,
    pellets: 1,
    rajada: 1,
    pente: 10,
    reserva: 30,
    spreadBase: 0.060,
    spreadAndando: 0.030,
    danoBloco: 6,
    recompensa: 300,
    zoom: 0.35,
    slot: 1,
    spreadMirando: 0.002
  },
  awb: {
    id: 'awb',
    nome: 'AWB',
    categoria: CATEGORIAS.SNIPER,
    preco: 4750,
    dano: 115,
    multCabeca: 4.0,
    rpm: 41,
    automatica: false,
    pellets: 1,
    rajada: 1,
    pente: 10,
    reserva: 30,
    spreadBase: 0.070,
    spreadAndando: 0.030,
    danoBloco: 8,
    recompensa: 100,
    zoom: 0.25,
    slot: 1,
    spreadMirando: 0.001
  }
};

/** Sempre no slot 3, de graça: quebra blocos de jogador e serve de último recurso. */
export const MARRETA = {
  id: 'marreta',
  nome: 'Marreta',
  dano: 35,
  danoBloco: 30,
  alcance: 2.5,
  rpm: 120,
  recompensa: 1500,
  slot: 3
};

export const EQUIPAMENTOS = {
  colete: { id: 'colete', nome: 'Colete', preco: 650 },
  // Inclui um colete novo, como no CS.
  capacete: { id: 'capacete', nome: 'Colete + Capacete', preco: 1000 },
  granada: { id: 'granada', nome: 'Granada HE', preco: 300, maximo: 2 },
  blocos: { id: 'blocos', nome: 'Pacote de 6 blocos', preco: 200, quantidade: 6, maximo: 30 }
};

/** Sniper sem mirar atira "do quadril": spread grande de propósito. */
export const SPREAD_SNIPER_SEM_MIRA = 0.06;

export function armaPorId(id) {
  return ARMAS[id] ?? null;
}

export function precoDe(itemId) {
  if (ARMAS[itemId]) return ARMAS[itemId].preco;
  if (EQUIPAMENTOS[itemId]) return EQUIPAMENTOS[itemId].preco;
  return null;
}

/**
 * Shotguns perdem dano com distância: 1.0 até 8 m, queda linear até 0.25 em
 * 30 m. As demais categorias acertam com dano cheio em qualquer distância.
 */
export function fatorDistancia(arma, distancia) {
  if (arma.categoria === CATEGORIAS.SHOTGUN) {
    if (distancia <= 8) return 1.0;
    if (distancia >= 30) return 0.25;
    return Math.max(0.25, 1.0 - ((distancia - 8) * 0.75) / 22);
  }
  return 1.0;
}

/**
 * Dano final de um projétil. `parte` é 'cabeca' ou 'corpo'. Capacete corta o
 * multiplicador de cabeça para no máximo 2×; colete absorve 40% do dano ao
 * corpo. Nunca devolve menos que 1: acertou, arranhou.
 */
export function danoDoTiro(arma, parte, temColete, temCapacete, distancia = 0) {
  const base = arma.dano * fatorDistancia(arma, distancia);
  let resultado;
  if (parte === 'cabeca') {
    const mult = temCapacete ? Math.min(arma.multCabeca, 2.0) : arma.multCabeca;
    resultado = base * mult;
  } else {
    resultado = base * (temColete ? 0.6 : 1);
  }
  return Math.max(1, Math.round(resultado));
}

export function intervaloEntreTiros(arma) {
  return 60000 / arma.rpm;
}
