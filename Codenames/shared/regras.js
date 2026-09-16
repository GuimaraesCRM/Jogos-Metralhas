/**
 * Regras do jogo — funções puras, sem rede e sem DOM.
 *
 * Este arquivo é a única fonte de verdade sobre como uma partida evolui, e roda
 * exclusivamente no servidor. O cliente nunca aplica regra nenhuma: ele desenha
 * o que recebeu. Isso mantém todo mundo sincronizado e impede que alguém force
 * uma jogada inválida mexendo na interface.
 *
 * Toda função recebe um estado e devolve `{ ok, estado, evento }` ou
 * `{ ok: false, erro }`. Nada é mutado no lugar.
 */

import { PALAVRAS } from './palavras.js';

export const TIMES = ['vermelho', 'azul'];

export const TIPO = {
  VERMELHO: 'vermelho',
  AZUL: 'azul',
  NEUTRA: 'neutra',
  ASSASSINO: 'assassino'
};

export const FASE = {
  DICA: 'dica',       // esperando o mestre-espião falar
  PALPITE: 'palpite', // dica dada, operativos escolhendo cartas
  FIM: 'fim'
};

/** Distribuição clássica das 25 cartas. O time que começa ganha uma carta a mais. */
export const DISTRIBUICAO = {
  TOTAL: 25,
  TIME_INICIAL: 9,
  TIME_SEGUINTE: 8,
  NEUTRAS: 7,
  ASSASSINO: 1
};

export const adversario = (time) => (time === 'vermelho' ? 'azul' : 'vermelho');

/** Tira acento e caixa para comparar a dica digitada com as palavras do tabuleiro. */
export function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();
}

/** Embaralhamento Fisher-Yates. `rnd` é injetável para os testes serem determinísticos. */
export function embaralhar(lista, rnd = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Sorteia as 25 cartas: escolhe as palavras, monta a lista de cores na
 * proporção 9/8/7/1 e embaralha as cores por cima das palavras.
 */
export function gerarTabuleiro({ palavras = PALAVRAS, rnd = Math.random } = {}) {
  if (palavras.length < DISTRIBUICAO.TOTAL) {
    throw new Error('Banco de palavras insuficiente para montar um tabuleiro.');
  }

  const escolhidas = embaralhar(palavras, rnd).slice(0, DISTRIBUICAO.TOTAL);
  const timeInicial = rnd() < 0.5 ? 'vermelho' : 'azul';

  const cores = [
    ...Array(DISTRIBUICAO.TIME_INICIAL).fill(timeInicial),
    ...Array(DISTRIBUICAO.TIME_SEGUINTE).fill(adversario(timeInicial)),
    ...Array(DISTRIBUICAO.NEUTRAS).fill(TIPO.NEUTRA),
    ...Array(DISTRIBUICAO.ASSASSINO).fill(TIPO.ASSASSINO)
  ];

  const coresEmbaralhadas = embaralhar(cores, rnd);

  const cartas = escolhidas.map((palavra, i) => ({
    palavra,
    tipo: coresEmbaralhadas[i],
    revelada: false,
    reveladaPor: null
  }));

  return { cartas, timeInicial };
}

/** Cria o estado inicial de uma partida, pronta para o primeiro mestre dar a dica. */
export function criarPartida({ palavras, rnd = Math.random, duracaoTurno = 0 } = {}) {
  const { cartas, timeInicial } = gerarTabuleiro({ palavras, rnd });

  return {
    cartas,
    timeInicial,
    vez: timeInicial,
    fase: FASE.DICA,
    dica: null,
    historico: [],
    restantes: {
      vermelho: cartas.filter((c) => c.tipo === TIPO.VERMELHO).length,
      azul: cartas.filter((c) => c.tipo === TIPO.AZUL).length
    },
    vencedor: null,
    motivo: null,
    duracaoTurno,
    turnoTerminaEm: duracaoTurno > 0 ? Date.now() + duracaoTurno * 1000 : null
  };
}

/** Reinicia o relógio do turno. Chamado a cada troca de vez e a cada dica nova. */
function reiniciarRelogio(estado) {
  estado.turnoTerminaEm =
    estado.duracaoTurno > 0 ? Date.now() + estado.duracaoTurno * 1000 : null;
}

/** Passa a vez para o adversário e volta para a fase de dica. */
export function passarVez(estado) {
  const proximo = structuredClone(estado);
  proximo.vez = adversario(proximo.vez);
  proximo.fase = FASE.DICA;
  proximo.dica = null;
  reiniciarRelogio(proximo);
  return proximo;
}

/**
 * Mestre-espião anuncia a dica.
 *
 * Recusa se não for a vez dele, se já houver dica ativa, ou se a palavra estiver
 * visível no tabuleiro. Cartas já reveladas não contam: no jogo físico elas ficam
 * cobertas pelo cartão de agente, então a palavra deixou de estar à vista.
 */
export function darDica(estado, { time, palavra, numero }) {
  if (estado.fase === FASE.FIM) return { ok: false, erro: 'A partida já terminou.' };
  if (estado.vez !== time) return { ok: false, erro: 'Não é a vez do seu time.' };
  if (estado.fase !== FASE.DICA) return { ok: false, erro: 'Seu time já recebeu uma dica.' };

  const limpa = String(palavra ?? '').trim();
  if (!limpa) return { ok: false, erro: 'Escreva uma palavra para a dica.' };
  if (/\s/.test(limpa)) return { ok: false, erro: 'A dica precisa ser uma palavra só.' };
  if (limpa.length > 24) return { ok: false, erro: 'Essa dica é comprida demais.' };

  const n = Number(numero);
  if (!Number.isInteger(n) || n < 1 || n > 9) {
    return { ok: false, erro: 'O número da dica vai de 1 a 9.' };
  }

  const alvo = normalizar(limpa);
  const conflito = estado.cartas.some((c) => !c.revelada && normalizar(c.palavra) === alvo);
  if (conflito) {
    return { ok: false, erro: 'Essa palavra está no tabuleiro. Escolha outra.' };
  }

  // O palpite extra é a regra clássica: com "FRUTA 3" o time pode tentar 4 vezes.
  const dica = { palavra: limpa.toUpperCase(), numero: n, palpitesRestantes: n + 1 };

  const proximo = structuredClone(estado);
  proximo.fase = FASE.PALPITE;
  proximo.dica = dica;
  proximo.historico.push({ tipo: 'dica', time, palavra: dica.palavra, numero: n });
  reiniciarRelogio(proximo);

  return {
    ok: true,
    estado: proximo,
    evento: { tipo: 'dica', time, palavra: dica.palavra, numero: n }
  };
}

/**
 * Vira uma carta e resolve a consequência.
 *
 *   carta do próprio time  -> ponto; o turno continua enquanto sobrarem palpites
 *   carta do adversário    -> ponto para ele e a vez passa
 *   carta neutra           -> a vez passa
 *   assassino              -> derrota imediata de quem clicou
 */
export function revelarCarta(estado, { time, indice }) {
  if (estado.fase === FASE.FIM) return { ok: false, erro: 'A partida já terminou.' };
  if (estado.vez !== time) return { ok: false, erro: 'Não é a vez do seu time.' };
  if (estado.fase !== FASE.PALPITE) return { ok: false, erro: 'Esperem a dica do mestre-espião.' };
  if (!Number.isInteger(indice) || indice < 0 || indice >= estado.cartas.length) {
    return { ok: false, erro: 'Carta inválida.' };
  }
  if (estado.cartas[indice].revelada) return { ok: false, erro: 'Essa carta já foi virada.' };

  let proximo = structuredClone(estado);
  const carta = proximo.cartas[indice];
  carta.revelada = true;
  carta.reveladaPor = time;

  const evento = { tipo: 'revelacao', time, indice, palavra: carta.palavra, cor: carta.tipo };

  // O assassino encerra tudo na hora.
  if (carta.tipo === TIPO.ASSASSINO) {
    proximo.fase = FASE.FIM;
    proximo.vencedor = adversario(time);
    proximo.motivo = 'assassino';
    proximo.dica = null;
    proximo.turnoTerminaEm = null;
    evento.resultado = 'assassino';
    proximo.historico.push(evento);
    return { ok: true, estado: proximo, evento };
  }

  // Carta colorida sempre desconta do placar do time dono, mesmo virada por engano.
  if (carta.tipo === TIPO.VERMELHO || carta.tipo === TIPO.AZUL) {
    proximo.restantes[carta.tipo] = Math.max(0, proximo.restantes[carta.tipo] - 1);
  }

  proximo.historico.push(evento);

  // Vitória por completar as cartas. Vale para os dois lados: virar a última
  // carta do adversário entrega a partida para ele.
  if (proximo.restantes.vermelho === 0 || proximo.restantes.azul === 0) {
    proximo.fase = FASE.FIM;
    proximo.vencedor = proximo.restantes.vermelho === 0 ? 'vermelho' : 'azul';
    proximo.motivo = 'cartas';
    proximo.dica = null;
    proximo.turnoTerminaEm = null;
    evento.resultado = 'fim';
    return { ok: true, estado: proximo, evento };
  }

  if (carta.tipo === time) {
    proximo.dica.palpitesRestantes -= 1;
    if (proximo.dica.palpitesRestantes > 0) {
      evento.resultado = 'acerto';
      return { ok: true, estado: proximo, evento }; // segue no mesmo turno
    }
    evento.resultado = 'acerto-ultimo';
  } else {
    evento.resultado = carta.tipo === TIPO.NEUTRA ? 'neutra' : 'adversario';
  }

  proximo = passarVez(proximo);
  proximo.historico.push({ tipo: 'passou', time });
  return { ok: true, estado: proximo, evento };
}

/** O time abre mão do resto dos palpites, ou o relógio estourou. */
export function encerrarTurno(estado, { time, motivo = 'escolha' }) {
  if (estado.fase === FASE.FIM) return { ok: false, erro: 'A partida já terminou.' };
  if (motivo === 'escolha') {
    if (estado.vez !== time) return { ok: false, erro: 'Não é a vez do seu time.' };
    if (estado.fase !== FASE.PALPITE) {
      return { ok: false, erro: 'Ainda não houve dica neste turno.' };
    }
  }

  const quemPassou = estado.vez;
  const proximo = passarVez(estado);
  proximo.historico.push({ tipo: 'passou', time: quemPassou, motivo });
  return { ok: true, estado: proximo, evento: { tipo: 'passou', time: quemPassou, motivo } };
}

/** O relógio venceu? Consultado pelo servidor, que é o dono do tempo. */
export function turnoExpirou(estado, agora = Date.now()) {
  return (
    estado.fase !== FASE.FIM &&
    typeof estado.turnoTerminaEm === 'number' &&
    agora >= estado.turnoTerminaEm
  );
}
