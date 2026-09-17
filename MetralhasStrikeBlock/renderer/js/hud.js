/**
 * O HUD da partida: DOM por cima do canvas 3D.
 *
 * Recebe o snapshot do servidor e reflete: vida, colete, munição, dinheiro,
 * placar, relógio da fase, killfeed, placar TAB, faixa de espectador e o menu
 * de pausa (mouse solto). O relógio anda no cliente entre snapshots usando o
 * desvio de relógio calculado pela simulação.
 */

import { FASES, ROTULO_TIME, TIMES } from '../../shared/constantes.js';
import { MARRETA, armaPorId } from '../../shared/armas.js';

function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

export function criarHud(container) {
  const raiz = el('div', 'hud');
  container.appendChild(raiz);

  // Mira: quatro traços que abrem conforme o spread, mais um ponto central.
  const crosshair = el('div', 'crosshair');
  const tracos = {
    cima: el('div', 'traco vertical'),
    baixo: el('div', 'traco vertical'),
    esquerda: el('div', 'traco horizontal'),
    direita: el('div', 'traco horizontal')
  };
  crosshair.append(el('div', 'ponto'), ...Object.values(tracos));

  const hitmarker = el('div', 'hitmarker');
  const vinheta = el('div', 'vinheta-dano');
  const zoomSniper = el('div', 'zoom-sniper escondido');

  // Placar do topo.
  const topo = el('div', 'hud-topo');
  const pontosAzul = el('div', 'pontos azul', '0');
  const meio = el('div');
  const relogio = el('div', 'relogio', '--:--');
  const rodada = el('div', 'rodada', 'ROUND 1');
  meio.append(relogio, rodada);
  const pontosVermelho = el('div', 'pontos vermelho', '0');
  topo.append(pontosAzul, meio, pontosVermelho);

  const faixaFase = el('div', 'faixa-fase');

  // Cantos inferiores.
  const vida = el('div', 'hud-vida');
  const blocoVida = el('div');
  const valorVida = el('div', 'valor', '100');
  blocoVida.append(valorVida, el('div', 'rotulo', 'Vida'));
  const blocoColete = el('div');
  const valorColete = el('div', 'valor', '0');
  blocoColete.append(valorColete, el('div', 'rotulo', 'Colete'));
  vida.append(blocoVida, blocoColete);

  const dinheiro = el('div', 'hud-dinheiro', '$800');

  const arma = el('div', 'hud-arma');
  const municao = el('div', 'municao');
  const nomeArma = el('div', 'nome-arma', 'PM-9');
  const avisoRecarga = el('div', 'recarregando escondido', 'RECARREGANDO…');
  arma.append(municao, nomeArma, avisoRecarga);

  const slots = el('div', 'hud-slots');

  const killfeed = el('div', 'killfeed');
  const faixaEspectador = el('div', 'faixa-espectador escondido');
  const placar = el('div', 'placar escondido');

  // Menu de pausa (mouse solto).
  const pausa = el('div', 'menu-pausa escondido');
  const cartaoPausa = el('div', 'cartao');
  cartaoPausa.append(el('div', 'fim-titulo', 'Jogo pausado'));
  const dicas = el('div', 'dica-teclas');
  dicas.innerHTML = [
    '<b>WASD</b> andar · <b>Espaço</b> pular · <b>Ctrl</b> agachar',
    '<b>Clique</b> atirar · <b>Direito</b> mirar (sniper) · <b>R</b> recarregar',
    '<b>1/2/3</b> armas · <b>4</b> blocos · <b>G</b> granada',
    '<b>B</b> loja (no início do round) · <b>TAB</b> placar · <b>F11</b> tela cheia'
  ].join('<br>');
  const botaoVoltarJogo = el('button', 'primario', 'Voltar ao jogo');
  cartaoPausa.append(dicas, botaoVoltarJogo);
  pausa.appendChild(cartaoPausa);

  raiz.append(
    vinheta,
    zoomSniper,
    crosshair,
    hitmarker,
    topo,
    faixaFase,
    vida,
    dinheiro,
    arma,
    slots,
    killfeed,
    faixaEspectador,
    placar,
    pausa
  );

  let desvioRelogio = 0; // servidor - cliente, em ms
  let faseAtual = null;
  let faseTerminaEm = 0;
  let timeoutFaixa = null;

  function definirDesvioRelogio(valor) {
    desvioRelogio = valor;
  }

  function mostrarFaixa(texto, duracaoMs = 2600) {
    faixaFase.textContent = texto;
    faixaFase.classList.add('ativa');
    clearTimeout(timeoutFaixa);
    if (duracaoMs > 0) {
      timeoutFaixa = setTimeout(() => faixaFase.classList.remove('ativa'), duracaoMs);
    }
  }

  function atualizarRelogio() {
    if (!faseTerminaEm) return;
    const agora = Date.now() + desvioRelogio;
    const restante = Math.max(0, faseTerminaEm - agora);
    const segundos = Math.ceil(restante / 1000);
    const mm = String(Math.floor(segundos / 60)).padStart(1, '0');
    const ss = String(segundos % 60).padStart(2, '0');
    relogio.textContent = `${mm}:${ss}`;
    relogio.classList.toggle('urgente', segundos <= 10 && faseAtual === FASES.COMBATE);
  }

  function aplicarSnapshot(foto) {
    faseAtual = foto.fase;
    faseTerminaEm = foto.faseTerminaEm;
    pontosAzul.textContent = foto.placar[TIMES.AZUL];
    pontosVermelho.textContent = foto.placar[TIMES.VERMELHO];
    rodada.textContent = `ROUND ${foto.round}`;

    const eu = foto.eu;
    if (!eu) return;

    valorVida.textContent = eu.vivo ? eu.hp : 0;
    valorVida.classList.toggle('baixa', eu.hp <= 30);
    valorColete.textContent = eu.colete;
    dinheiro.textContent = `$${eu.dinheiro}`;

    // Arma ativa e munição.
    if (eu.slot === 3) {
      municao.textContent = '—';
      nomeArma.textContent = MARRETA.nome;
    } else if (eu.slot === 4) {
      municao.textContent = String(eu.blocos);
      nomeArma.textContent = 'Blocos';
    } else {
      const armaEstado = eu.armas[eu.slot];
      if (armaEstado) {
        const def = armaPorId(armaEstado.id);
        municao.innerHTML = '';
        municao.append(String(armaEstado.municao));
        const reserva = el('span', 'reserva', ` / ${armaEstado.reserva}`);
        municao.appendChild(reserva);
        nomeArma.textContent = def?.nome ?? armaEstado.id;
      }
    }

    avisoRecarga.classList.toggle('escondido', !(eu.recarregaAte > Date.now() + desvioRelogio));

    // Barrinha de slots.
    slots.innerHTML = '';
    const itens = [
      [1, eu.armas[1] ? armaPorId(eu.armas[1].id)?.nome : null],
      [2, eu.armas[2] ? armaPorId(eu.armas[2].id)?.nome : null],
      [3, MARRETA.nome],
      [4, eu.blocos > 0 ? `Blocos ×${eu.blocos}` : null]
    ];
    for (const [numero, nome] of itens) {
      if (!nome) continue;
      const slot = el('div', 'slot' + (eu.slot === numero ? ' ativo' : ''), `${numero} ${nome}`);
      slots.appendChild(slot);
    }
    if (eu.granadas > 0) slots.appendChild(el('div', 'slot', `G Granada ×${eu.granadas}`));
  }

  function adicionarKill(nomeAssassino, nomeVitima, armaId, headshot, corAssassino, corVitima) {
    const linha = el('div', 'linha-kill');
    const nomeArmaKill = armaPorId(armaId)?.nome ?? (armaId === 'granada' ? 'Granada' : MARRETA.nome);
    const a = el('span', corAssassino === TIMES.AZUL ? 'cor-azul' : 'cor-vermelho', nomeAssassino);
    const v = el('span', corVitima === TIMES.AZUL ? 'cor-azul' : 'cor-vermelho', nomeVitima);
    linha.append(a, ` [${nomeArmaKill}${headshot ? ' ' : ''}] `);
    if (headshot) {
      const hs = el('span', 'hs', 'HS! ');
      linha.insertBefore(hs, v);
    }
    linha.appendChild(v);
    killfeed.prepend(linha);
    while (killfeed.children.length > 6) killfeed.lastChild.remove();
    setTimeout(() => linha.remove(), 7000);
  }

  function marcarAcerto() {
    hitmarker.classList.remove('ativa');
    void hitmarker.offsetWidth; // reinicia a animação
    hitmarker.classList.add('ativa');
  }

  function marcarDano() {
    vinheta.classList.add('ativa');
    setTimeout(() => vinheta.classList.remove('ativa'), 120);
  }

  function mostrarPlacar(mostrar, foto, meuId) {
    placar.classList.toggle('escondido', !mostrar);
    if (!mostrar || !foto) return;

    placar.innerHTML = '';
    const tabela = el('table');
    const cabecalho = el('tr');
    for (const titulo of ['Jogador', 'K', 'M', '$']) {
      const th = el('th', titulo === 'Jogador' ? '' : 'num', titulo);
      cabecalho.appendChild(th);
    }
    tabela.appendChild(cabecalho);

    for (const time of [TIMES.AZUL, TIMES.VERMELHO]) {
      const secao = el('tr');
      const td = el('td', time === TIMES.AZUL ? 'secao-azul' : 'secao-vermelho', ROTULO_TIME[time]);
      td.colSpan = 4;
      secao.appendChild(td);
      tabela.appendChild(secao);

      const doTime = foto.jogadores.filter((j) => j.time === time).sort((a, b) => b.kills - a.kills);
      for (const j of doTime) {
        const linha = el('tr', j.vivo ? '' : 'morto');
        linha.appendChild(el('td', '', j.nome + (j.id === meuId ? ' (você)' : '')));
        linha.appendChild(el('td', 'num', String(j.kills)));
        linha.appendChild(el('td', 'num', String(j.mortes)));
        linha.appendChild(el('td', 'num', j.dinheiro !== undefined ? `$${j.dinheiro}` : '—'));
        tabela.appendChild(linha);
      }
    }
    placar.appendChild(tabela);
  }

  function modoEspectador(nomeAlvo) {
    faixaEspectador.classList.toggle('escondido', !nomeAlvo);
    if (nomeAlvo) {
      faixaEspectador.innerHTML = '';
      faixaEspectador.append(
        el('div', 'titulo', 'Você caiu neste round'),
        el('div', 'dica', nomeAlvo === '—' ? 'Aguardando o fim do round…' : `Assistindo: ${nomeAlvo} · E troca de aliado`)
      );
    }
  }

  function mostrarPausa(mostrar) {
    pausa.classList.toggle('escondido', !mostrar);
  }

  function mostrarZoom(mostrar) {
    zoomSniper.classList.toggle('escondido', !mostrar);
    crosshair.classList.toggle('escondido', mostrar);
  }

  /** Mirando pela arma, a mira da tela some: quem mira é a arma. */
  function definirEstadoDeMira(mirando) {
    crosshair.classList.toggle('mirando', mirando);
  }

  /**
   * Abertura da mira, de 0 (cravada) a 1 (espalhada). O chamador traduz o
   * spread da arma para essa escala.
   */
  function definirAberturaDaMira(abertura) {
    const px = 3 + Math.min(1, Math.max(0, abertura)) * 22;
    tracos.cima.style.transform = `translateY(${-px - 9}px)`;
    tracos.baixo.style.transform = `translateY(${px}px)`;
    tracos.esquerda.style.transform = `translateX(${-px - 9}px)`;
    tracos.direita.style.transform = `translateX(${px}px)`;
  }

  return {
    aplicarSnapshot,
    atualizarRelogio,
    definirDesvioRelogio,
    mostrarFaixa,
    adicionarKill,
    marcarAcerto,
    marcarDano,
    mostrarPlacar,
    modoEspectador,
    mostrarPausa,
    mostrarZoom,
    definirEstadoDeMira,
    definirAberturaDaMira,
    botaoVoltarJogo,
    destruir() {
      raiz.remove();
    }
  };
}
