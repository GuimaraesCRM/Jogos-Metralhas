/**
 * O que cada jogador enxerga.
 *
 * A vista do lobby é igual para todos. A foto (snapshot) da partida é
 * recortada por jogador: posição, kills e mortes são públicos (o placar TAB
 * mostra), mas dinheiro, arsenal e HP só circulam dentro do próprio time —
 * saber que o inimigo está de AWB nova ou com 5 de vida é vantagem que o
 * servidor não entrega.
 */

export function vistaDoLobby(sala) {
  return {
    codigo: sala.codigo,
    fase: sala.fase,
    anfitriaoId: sala.anfitriaoId,
    jogadores: [...sala.jogadores.values()].map((j) => ({
      id: j.id,
      nome: j.nome,
      avatar: j.avatar,
      time: j.time,
      conectado: j.conectado
    }))
  };
}

/** Estado inicial que um cliente precisa para entrar (ou voltar) numa partida. */
export function vistaDaPartidaInicial(partida) {
  return {
    blocosDeJogador: [...partida.blocosDeJogador.values()],
    jogadores: [...partida.estado.jogadores.values()].map((j) => ({
      id: j.id,
      nome: j.nome,
      time: j.time
    }))
  };
}

export function snapshotPara(partida, jogadorId, agora) {
  const { estado } = partida;
  const eu = estado.jogadores.get(jogadorId);
  const corpoEu = partida.corpos.get(jogadorId);

  const jogadores = [];
  for (const j of estado.jogadores.values()) {
    const corpo = partida.corpos.get(j.id);
    const aliado = eu && j.time === eu.time;
    jogadores.push({
      id: j.id,
      nome: j.nome,
      time: j.time,
      vivo: j.vivo,
      kills: j.kills,
      mortes: j.mortes,
      pos: [arred(corpo.pos.x), arred(corpo.pos.y), arred(corpo.pos.z)],
      yaw: arred(corpo.yaw),
      pitch: arred(corpo.pitch),
      agachado: corpo.agachado,
      slot: j.slot,
      armaId: j.armas[j.slot]?.id ?? 'marreta',
      // Só o próprio time sabe quanto de vida e dinheiro cada um tem.
      hp: aliado ? j.hp : undefined,
      dinheiro: aliado ? j.dinheiro : undefined
    });
  }

  return {
    tick: partida.tick_,
    agora,
    fase: estado.fase,
    faseTerminaEm: estado.faseTerminaEm,
    round: estado.round,
    placar: { ...estado.placar },
    jogadores,
    granadas: partida.granadas.map((g) => ({
      id: g.id,
      pos: [arred(g.pos.x), arred(g.pos.y), arred(g.pos.z)]
    })),
    eu: eu
      ? {
          hp: eu.hp,
          colete: eu.colete,
          capacete: eu.capacete,
          dinheiro: eu.dinheiro,
          granadas: eu.granadas,
          blocos: eu.blocos,
          vivo: eu.vivo,
          time: eu.time,
          slot: eu.slot,
          armas: {
            1: eu.armas[1] ? { ...eu.armas[1] } : null,
            2: eu.armas[2] ? { ...eu.armas[2] } : null
          },
          recarregaAte: corpoEu?.recarregaAte ?? 0
        }
      : null
  };
}

/** Três casas decimais bastam para posição/ângulo e encurtam bem o JSON. */
function arred(v) {
  return Math.round(v * 1000) / 1000;
}
