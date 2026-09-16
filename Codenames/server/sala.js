/**
 * Uma sala: quem está dentro, em que time, e a partida em andamento.
 *
 * Todo pedido do cliente passa por aqui e é conferido antes de virar mudança de
 * estado. As regras em si moram em shared/regras.js; esta classe cuida do que é
 * social — funções, votos, anfitrião, reconexão.
 *
 * Os métodos devolvem `{ ok, erro? }` e, quando dá certo, empilham eventos em
 * `this.eventos` para o servidor transmitir junto com o novo estado.
 */

import { randomUUID } from 'node:crypto';
import {
  criarPartida,
  darDica,
  revelarCarta,
  encerrarTurno,
  turnoExpirou,
  FASE
} from '../shared/regras.js';
import {
  FUNCOES,
  ROTULO_FUNCAO,
  MODO_REVELACAO,
  duracaoTurnoValida,
  limparNome,
  limparAvatar
} from '../shared/protocolo.js';

const TIMES = ['vermelho', 'azul'];
const LIMITE_JOGADORES = 8;

export class Sala {
  constructor(codigo) {
    this.codigo = codigo;
    this.jogadores = new Map();
    this.anfitriaoId = null;
    this.partida = null;
    this.eventos = [];

    this.config = {
      duracaoTurno: 0,
      modoRevelacao: MODO_REVELACAO.CONSENSO,
      nomes: { vermelho: 'Time Vermelho', azul: 'Time Azul' }
    };

    // Votos do turno atual: índice da carta -> conjunto de ids que clicaram nela.
    this.votos = new Map();
    this.votosEncerrar = new Set();

    this.criadaEm = Date.now();
    this.ultimaAtividade = Date.now();
  }

  // ---------------------------------------------------------------- pessoas

  get quantidadeConectada() {
    return [...this.jogadores.values()].filter((j) => j.conectado).length;
  }

  /** Operativos conectados de um time — quem precisa concordar para virar carta. */
  operativosDoTime(time) {
    return [...this.jogadores.values()].filter(
      (j) => j.conectado && j.time === time && j.funcao === FUNCOES.OPERATIVO
    );
  }

  entrar(nome, ws, avatar = null) {
    if (this.quantidadeConectada >= LIMITE_JOGADORES) {
      return { ok: false, erro: 'Esta sala já está cheia (8 jogadores).' };
    }

    // Quem chega com a partida rolando entra como espectador: acompanha o jogo
    // sem furar o equilíbrio dos times nem ver as cores.
    const partidaEmAndamento = Boolean(this.partida);

    const jogador = {
      id: randomUUID(),
      token: randomUUID(),
      nome: this.nomeDisponivel(limparNome(nome)),
      avatar: limparAvatar(avatar),
      time: null,
      funcao: partidaEmAndamento ? FUNCOES.ESPECTADOR : null,
      conectado: true,
      ws
    };

    this.jogadores.set(jogador.id, jogador);
    if (!this.anfitriaoId) this.anfitriaoId = jogador.id;
    this.tocar();
    return { ok: true, jogador };
  }

  /** Dois "Lucas" na mesma sala viram "Lucas" e "Lucas (2)". */
  nomeDisponivel(desejado) {
    const usados = new Set([...this.jogadores.values()].map((j) => j.nome));
    if (!usados.has(desejado)) return desejado;
    for (let n = 2; n < 20; n++) {
      const tentativa = `${desejado} (${n})`;
      if (!usados.has(tentativa)) return tentativa;
    }
    return desejado;
  }

  /** Volta para o lugar de quem caiu, conferindo o crachá guardado no cliente. */
  reconectar(jogadorId, token, ws) {
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador || jogador.token !== token) {
      return { ok: false, erro: 'Não achamos seu lugar nesta sala.' };
    }
    if (jogador.ws && jogador.ws !== ws) {
      try {
        jogador.ws.close(4000, 'Conectado em outro lugar');
      } catch {
        /* a conexão antiga já pode ter morrido; seguir é seguro */
      }
    }
    jogador.ws = ws;
    jogador.conectado = true;
    this.tocar();
    return { ok: true, jogador };
  }

  desconectar(jogadorId) {
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador) return;
    jogador.conectado = false;
    jogador.ws = null;

    // Fora de partida, quem sai some da lista. Durante a partida o lugar fica
    // guardado, senão uma queda de Wi-Fi apagaria o time inteiro.
    if (!this.partida) {
      this.jogadores.delete(jogadorId);
      this.limparVotosDe(jogadorId);
    }
    if (this.anfitriaoId === jogadorId) this.passarAnfitriao();
    this.tocar();
  }

  /** O anfitrião saiu: promove o jogador conectado mais antigo. */
  passarAnfitriao() {
    const proximo = [...this.jogadores.values()].find((j) => j.conectado);
    this.anfitriaoId = proximo ? proximo.id : null;
  }

  tocar() {
    this.ultimaAtividade = Date.now();
  }

  // ------------------------------------------------------------------ lobby

  escolherFuncao(jogadorId, time, funcao) {
    if (this.partida) return { ok: false, erro: 'A partida já começou.' };
    const jogador = this.jogadores.get(jogadorId);
    if (!jogador) return { ok: false, erro: 'Jogador desconhecido.' };
    if (!Object.values(FUNCOES).includes(funcao)) return { ok: false, erro: 'Função inválida.' };

    // Espectador não pertence a time nenhum: assiste e não conta para o começo.
    if (funcao === FUNCOES.ESPECTADOR) {
      jogador.time = null;
      jogador.funcao = FUNCOES.ESPECTADOR;
      this.tocar();
      return { ok: true };
    }

    if (!TIMES.includes(time)) return { ok: false, erro: 'Time inválido.' };

    // Um Metralha Espião por time: o cargo é único, como o cartão-chave no jogo físico.
    if (funcao === FUNCOES.MESTRE) {
      const jaTem = [...this.jogadores.values()].find(
        (j) => j.id !== jogadorId && j.time === time && j.funcao === FUNCOES.MESTRE
      );
      if (jaTem) {
        return { ok: false, erro: `${jaTem.nome} já é o ${ROTULO_FUNCAO.mestre} desse time.` };
      }
    }

    jogador.time = time;
    jogador.funcao = funcao;
    this.tocar();
    return { ok: true };
  }

  renomearTime(jogadorId, time, nome) {
    if (jogadorId !== this.anfitriaoId) {
      return { ok: false, erro: 'Só quem criou a sala renomeia os times.' };
    }
    if (!TIMES.includes(time)) return { ok: false, erro: 'Time inválido.' };
    const padrao = time === 'vermelho' ? 'Time Vermelho' : 'Time Azul';
    this.config.nomes[time] = limparNome(nome, padrao);
    this.tocar();
    return { ok: true };
  }

  /**
   * Muda tempo de turno e modo de revelação. Vale também no meio da partida:
   * o novo tempo entra no turno seguinte, para ninguém ter o relógio encurtado
   * no meio de um palpite. A exceção é desligar o relógio, que tem efeito
   * imediato — é o que a pessoa espera ao escolher "sem tempo".
   */
  configurar(jogadorId, { duracaoTurno, modoRevelacao }) {
    if (jogadorId !== this.anfitriaoId) {
      return { ok: false, erro: 'Só quem criou a sala muda as configurações.' };
    }

    if (duracaoTurno !== undefined) {
      const duracao = duracaoTurnoValida(duracaoTurno);
      if (duracao === null) {
        return { ok: false, erro: 'O tempo por turno vai de 15 a 900 segundos, ou nenhum.' };
      }
      this.config.duracaoTurno = duracao;
      if (this.partida) {
        this.partida.duracaoTurno = duracao;
        if (duracao === 0) this.partida.turnoTerminaEm = null;
      }
    }

    if (modoRevelacao !== undefined) {
      if (!Object.values(MODO_REVELACAO).includes(modoRevelacao)) {
        return { ok: false, erro: 'Modo de revelação inválido.' };
      }
      this.config.modoRevelacao = modoRevelacao;
    }

    this.tocar();
    return { ok: true };
  }

  // ----------------------------------------------------------------- partida

  iniciarPartida(jogadorId) {
    if (jogadorId !== this.anfitriaoId) {
      return { ok: false, erro: 'Só quem criou a sala começa a partida.' };
    }
    if (this.partida) return { ok: false, erro: 'A partida já está rolando.' };

    for (const time of TIMES) {
      const doTime = [...this.jogadores.values()].filter((j) => j.conectado && j.time === time);
      if (!doTime.some((j) => j.funcao === FUNCOES.MESTRE)) {
        return { ok: false, erro: `O ${this.config.nomes[time]} está sem ${ROTULO_FUNCAO.mestre}.` };
      }
      if (!doTime.some((j) => j.funcao === FUNCOES.OPERATIVO)) {
        return { ok: false, erro: `O ${this.config.nomes[time]} está sem ${ROTULO_FUNCAO.operativo}.` };
      }
    }

    this.partida = criarPartida({ duracaoTurno: this.config.duracaoTurno });
    this.limparVotos();
    this.eventos.push({ tipo: 'partida-iniciada', vez: this.partida.vez });
    this.tocar();
    return { ok: true };
  }

  /** Sorteia um tabuleiro novo mantendo times e funções. */
  novaPartida(jogadorId) {
    if (jogadorId !== this.anfitriaoId) {
      return { ok: false, erro: 'Só quem criou a sala inicia outra partida.' };
    }
    this.partida = criarPartida({ duracaoTurno: this.config.duracaoTurno });
    this.limparVotos();
    this.eventos.push({ tipo: 'partida-iniciada', vez: this.partida.vez });
    this.tocar();
    return { ok: true };
  }

  /** Volta ao lobby para trocar de time ou mexer nas configurações. */
  voltarAoLobby(jogadorId) {
    if (jogadorId !== this.anfitriaoId) {
      return { ok: false, erro: 'Só quem criou a sala volta ao lobby.' };
    }
    this.partida = null;
    this.limparVotos();
    // Quem caiu no meio da partida some agora que a sala voltou a ser lobby.
    for (const [id, j] of this.jogadores) if (!j.conectado) this.jogadores.delete(id);
    this.tocar();
    return { ok: true };
  }

  darDica(jogadorId, palavra, numero) {
    const jogador = this.jogadores.get(jogadorId);
    if (!this.partida) return { ok: false, erro: 'A partida não começou.' };
    if (!jogador || jogador.funcao !== FUNCOES.MESTRE) {
      return { ok: false, erro: `Só o ${ROTULO_FUNCAO.mestre} dá a dica.` };
    }

    const r = darDica(this.partida, { time: jogador.time, palavra, numero });
    if (!r.ok) return r;

    this.partida = r.estado;
    this.limparVotos();
    this.eventos.push({ ...r.evento, autor: jogador.nome });
    this.tocar();
    return { ok: true };
  }

  // -------------------------------------------------------------- votação

  limparVotos() {
    this.votos.clear();
    this.votosEncerrar.clear();
  }

  limparVotosDe(jogadorId) {
    for (const conjunto of this.votos.values()) conjunto.delete(jogadorId);
    this.votosEncerrar.delete(jogadorId);
  }

  /** Confere se o jogador pode palpitar agora. */
  validarPalpite(jogadorId) {
    const jogador = this.jogadores.get(jogadorId);
    if (!this.partida) return { ok: false, erro: 'A partida não começou.' };
    if (this.partida.fase !== FASE.PALPITE) {
      return { ok: false, erro: `Esperem a dica do ${ROTULO_FUNCAO.mestre}.` };
    }
    if (!jogador || jogador.funcao !== FUNCOES.OPERATIVO) {
      return { ok: false, erro: `Só o ${ROTULO_FUNCAO.operativo} escolhe as cartas.` };
    }
    if (jogador.time !== this.partida.vez) {
      return { ok: false, erro: 'Não é a vez do seu time.' };
    }
    return { ok: true, jogador };
  }

  /**
   * Clique numa carta. No modo consenso vale como voto e a carta só vira quando
   * todos os operativos conectados do time apontam para ela; clicar de novo na
   * mesma carta cancela o próprio voto. No modo livre, o clique já revela.
   */
  votarCarta(jogadorId, indice) {
    const permissao = this.validarPalpite(jogadorId);
    if (!permissao.ok) return permissao;

    if (!Number.isInteger(indice) || indice < 0 || indice >= this.partida.cartas.length) {
      return { ok: false, erro: 'Carta inválida.' };
    }
    if (this.partida.cartas[indice].revelada) {
      return { ok: false, erro: 'Essa carta já foi virada.' };
    }

    const jogador = permissao.jogador;

    if (this.config.modoRevelacao === MODO_REVELACAO.LIVRE) {
      return this.revelar(jogador, indice);
    }

    const jaVotouAqui = this.votos.get(indice)?.has(jogadorId) ?? false;
    this.limparVotosDe(jogadorId); // um voto por pessoa de cada vez

    if (jaVotouAqui) {
      this.tocar();
      return { ok: true }; // clicou de novo: era para desmarcar
    }

    if (!this.votos.has(indice)) this.votos.set(indice, new Set());
    this.votos.get(indice).add(jogadorId);

    const operativos = this.operativosDoTime(jogador.time);
    const todosDeAcordo =
      operativos.length > 0 && operativos.every((o) => this.votos.get(indice).has(o.id));

    if (todosDeAcordo) return this.revelar(jogador, indice);

    this.tocar();
    return { ok: true };
  }

  /** Vira a carta de fato, aplicando as regras e limpando a mesa de votos. */
  revelar(jogador, indice) {
    const r = revelarCarta(this.partida, { time: jogador.time, indice });
    if (!r.ok) return r;

    this.partida = r.estado;
    this.limparVotos();
    this.eventos.push({ ...r.evento, autor: jogador.nome });
    this.tocar();
    return { ok: true };
  }

  /** Mesmo mecanismo de consenso, aplicado a "encerrar o turno". */
  votarEncerrar(jogadorId) {
    const permissao = this.validarPalpite(jogadorId);
    if (!permissao.ok) return permissao;
    const jogador = permissao.jogador;

    if (this.config.modoRevelacao === MODO_REVELACAO.LIVRE) {
      return this.encerrar(jogador.time, 'escolha');
    }

    if (this.votosEncerrar.has(jogadorId)) {
      this.votosEncerrar.delete(jogadorId);
      this.tocar();
      return { ok: true };
    }

    this.votosEncerrar.add(jogadorId);
    const operativos = this.operativosDoTime(jogador.time);
    const todosDeAcordo =
      operativos.length > 0 && operativos.every((o) => this.votosEncerrar.has(o.id));

    if (todosDeAcordo) return this.encerrar(jogador.time, 'escolha');

    this.tocar();
    return { ok: true };
  }

  encerrar(time, motivo) {
    const r = encerrarTurno(this.partida, { time, motivo });
    if (!r.ok) return r;
    this.partida = r.estado;
    this.limparVotos();
    this.eventos.push(r.evento);
    this.tocar();
    return { ok: true };
  }

  /**
   * Chamado pelo relógio do servidor. O tempo é decidido aqui, e não no app de
   * cada jogador, para que ninguém veja o turno acabar num instante diferente.
   */
  verificarTempo() {
    if (!this.partida || !turnoExpirou(this.partida)) return false;
    const r = encerrarTurno(this.partida, { time: this.partida.vez, motivo: 'tempo' });
    if (!r.ok) return false;
    this.partida = r.estado;
    this.limparVotos();
    this.eventos.push({ ...r.evento, motivo: 'tempo' });
    return true;
  }

  /** Eventos acumulados desde a última transmissão. */
  drenarEventos() {
    const lista = this.eventos;
    this.eventos = [];
    return lista;
  }
}
