/**
 * Projeção do estado por jogador — a peça anticola do projeto.
 *
 * O servidor guarda o tabuleiro inteiro com as cores. Cada jogador recebe uma
 * cópia recortada: o operativo só enxerga a cor de uma carta depois que ela é
 * virada. Se mandássemos o tabuleiro completo e escondêssemos as cores no CSS,
 * bastaria abrir o inspetor para ganhar todas as partidas.
 */

import { FASE } from '../shared/regras.js';
import { FUNCOES, iniciais } from '../shared/protocolo.js';

/** Resumo de um jogador, visível para todo mundo na sala. */
function fichaDoJogador(jogador, anfitriaoId) {
  return {
    id: jogador.id,
    nome: jogador.nome,
    // Vem do launcher quando houver; nulo enquanto o jogador digita o nome à mão.
    avatar: jogador.avatar ?? null,
    time: jogador.time,
    funcao: jogador.funcao,
    conectado: jogador.conectado,
    anfitriao: jogador.id === anfitriaoId
  };
}

/**
 * Cada time precisa de pelo menos um mestre e um operativo — sem isso não há
 * quem dê a dica ou quem palpite.
 */
export function podeIniciar(sala) {
  return ['vermelho', 'azul'].every((time) => {
    const doTime = [...sala.jogadores.values()].filter((j) => j.time === time && j.conectado);
    return (
      doTime.some((j) => j.funcao === FUNCOES.MESTRE) &&
      doTime.some((j) => j.funcao === FUNCOES.OPERATIVO)
    );
  });
}

/** Marcas de voto de uma carta, já com a sigla que aparece na interface. */
function votosDaCarta(sala, indice) {
  const ids = sala.votos.get(indice);
  if (!ids || ids.size === 0) return [];
  return [...ids]
    .map((id) => sala.jogadores.get(id))
    .filter(Boolean)
    .map((j) => ({ id: j.id, nome: j.nome, sigla: iniciais(j.nome) }));
}

/** Recorta o tabuleiro de acordo com quem está olhando. */
function tabuleiroPara(sala, jogador) {
  const partida = sala.partida;
  const acabou = partida.fase === FASE.FIM;
  const ehMestre = jogador.funcao === FUNCOES.MESTRE;
  // No fim da partida todo mundo vê tudo; durante o jogo, só o mestre.
  const revelaTudo = acabou || ehMestre;
  // Os votos do time da vez ficam visíveis para o próprio time e para quem está
  // assistindo — o espectador acompanha a discussão sem ganhar informação
  // nenhuma sobre as cores.
  const veVotos =
    (jogador.time === partida.vez || jogador.funcao === FUNCOES.ESPECTADOR) && !acabou;

  return partida.cartas.map((carta, indice) => ({
    palavra: carta.palavra,
    revelada: carta.revelada,
    tipo: carta.revelada || revelaTudo ? carta.tipo : null,
    reveladaPor: carta.reveladaPor,
    votos: veVotos ? votosDaCarta(sala, indice) : []
  }));
}

/** Estado completo que o app recebe a cada mudança. */
export function vistaDaSala(sala, jogadorId) {
  const jogador = sala.jogadores.get(jogadorId);
  if (!jogador) return null;

  const partida = sala.partida;
  const acabou = Boolean(partida) && partida.fase === FASE.FIM;

  return {
    codigo: sala.codigo,
    // Relógio do servidor: o app usa isto para corrigir a diferença do relógio
    // local e todo mundo ver a mesma contagem regressiva.
    agora: Date.now(),
    tela: !partida ? 'lobby' : acabou ? 'fim' : 'jogo',
    voce: fichaDoJogador(jogador, sala.anfitriaoId),
    jogadores: [...sala.jogadores.values()].map((j) => fichaDoJogador(j, sala.anfitriaoId)),
    config: sala.config,
    podeIniciar: podeIniciar(sala),
    partida: partida
      ? {
          cartas: tabuleiroPara(sala, jogador),
          vez: partida.vez,
          fase: partida.fase,
          dica: partida.dica,
          restantes: partida.restantes,
          timeInicial: partida.timeInicial,
          vencedor: partida.vencedor,
          motivo: partida.motivo,
          historico: partida.historico,
          duracaoTurno: partida.duracaoTurno,
          turnoTerminaEm: partida.turnoTerminaEm,
          votosEncerrar:
            (jogador.time === partida.vez || jogador.funcao === FUNCOES.ESPECTADOR) && !acabou
              ? [...sala.votosEncerrar]
              : []
        }
      : null
  };
}
