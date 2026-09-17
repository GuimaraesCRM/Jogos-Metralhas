/**
 * Os outros jogadores: bonecos articulados na cor do time.
 *
 * Cada boneco é uma hierarquia de pivôs (quadril → tronco → pescoço → cabeça,
 * ombros → braços, quadril → pernas), o que permite animar caminhada, mira e
 * agachamento girando juntas em vez de mover caixas soltas pelo espaço.
 *
 * O rosto é uma textura desenhada num canvas e aplicada só na face da frente
 * da cabeça — olhos, sobrancelhas, nariz e boca. É o que faz o boneco parecer
 * alguém olhando para você, e continua sendo 100% gerado por código.
 *
 * Quem decide ONDE cada boneco fica é a interpolação em simulacao-local.js;
 * aqui só se aplica o estado recebido e se anima o corpo.
 */

import * as THREE from '../../vendor/three.module.js';
import { TIMES } from '../../../shared/constantes.js';
import { armaPorId } from '../../../shared/armas.js';

const CORES = {
  [TIMES.AZUL]: {
    uniforme: 0x2f5fa8,
    uniformeClaro: 0x4d8fe0,
    colete: 0x24406e,
    capacete: 0x1f3559
  },
  [TIMES.VERMELHO]: {
    uniforme: 0xa83636,
    uniformeClaro: 0xe05252,
    colete: 0x7a2626,
    capacete: 0x5e1d1d
  }
};

const PELE = 0xc89d78;
const PELE_ESCURA_HEX = '#a87f5c';

// ------------------------------------------------------------------- rosto

/**
 * Desenha um rosto de frente. Simples de propósito: a esta distância, o que
 * lê são os olhos e a direção do olhar.
 */
function texturaDeRosto() {
  const tela = document.createElement('canvas');
  tela.width = 64;
  tela.height = 64;
  const p = tela.getContext('2d');

  // Pele de base, com um tom mais escuro nas laterais para dar volume.
  p.fillStyle = '#c89d78';
  p.fillRect(0, 0, 64, 64);
  p.fillStyle = 'rgba(120, 80, 50, 0.18)';
  p.fillRect(0, 0, 7, 64);
  p.fillRect(57, 0, 7, 64);

  // Cabelo: franja cobrindo o topo.
  p.fillStyle = '#3a2a1c';
  p.fillRect(0, 0, 64, 15);
  p.fillRect(0, 15, 9, 10);
  p.fillRect(55, 15, 9, 10);

  // Sobrancelhas.
  p.fillStyle = '#3a2a1c';
  p.fillRect(13, 22, 15, 4);
  p.fillRect(36, 22, 15, 4);

  // Olhos: branco, íris e um brilho.
  const olho = (x) => {
    p.fillStyle = '#f2f2f2';
    p.fillRect(x, 28, 14, 9);
    p.fillStyle = '#3d2c1e';
    p.fillRect(x + 4, 29, 6, 7);
    p.fillStyle = '#101010';
    p.fillRect(x + 6, 31, 3, 4);
    p.fillStyle = 'rgba(255,255,255,0.9)';
    p.fillRect(x + 5, 30, 2, 2);
  };
  olho(12);
  olho(38);

  // Nariz e sombra sob ele.
  p.fillStyle = PELE_ESCURA_HEX;
  p.fillRect(30, 38, 5, 8);
  p.fillStyle = 'rgba(90, 60, 40, 0.5)';
  p.fillRect(30, 45, 5, 2);

  // Boca.
  p.fillStyle = '#7a3b34';
  p.fillRect(24, 51, 16, 4);
  p.fillStyle = 'rgba(0,0,0,0.25)';
  p.fillRect(24, 51, 16, 1);

  const textura = new THREE.CanvasTexture(tela);
  textura.magFilter = THREE.NearestFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  return textura;
}

// Uma textura só, compartilhada por todos os bonecos.
let texturaRosto = null;
function rosto() {
  if (!texturaRosto) texturaRosto = texturaDeRosto();
  return texturaRosto;
}

// ------------------------------------------------------------------ etiqueta

function etiquetaDeNome(nome, corTime) {
  const tela = document.createElement('canvas');
  tela.width = 256;
  tela.height = 64;
  const p = tela.getContext('2d');
  p.font = '600 30px "Segoe UI", sans-serif';
  p.textAlign = 'center';
  p.textBaseline = 'middle';

  const largura = Math.min(240, p.measureText(nome).width + 28);
  p.fillStyle = 'rgba(8, 10, 16, 0.62)';
  p.beginPath();
  p.roundRect((256 - largura) / 2, 8, largura, 48, 10);
  p.fill();
  p.strokeStyle = corTime;
  p.lineWidth = 2;
  p.stroke();

  p.fillStyle = '#e8edf5';
  p.fillText(nome, 128, 34);

  const textura = new THREE.CanvasTexture(tela);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: true }));
  sprite.scale.set(1.7, 0.42, 1);
  return sprite;
}

// -------------------------------------------------------------------- peças

function caixa(w, h, d, cor, x = 0, y = 0, z = 0) {
  const malha = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: cor })
  );
  malha.position.set(x, y, z);
  return malha;
}

/** Arminha simplificada na mão do boneco — silhueta por categoria, sem detalhe. */
function armaDoBoneco(armaId) {
  const grupo = new THREE.Group();
  const escuro = new THREE.MeshLambertMaterial({ color: 0x24282f });
  const medio = new THREE.MeshLambertMaterial({ color: 0x3c424c });

  const def = armaPorId(armaId);
  const categoria = def?.categoria ?? (armaId === 'marreta' ? 'marreta' : 'rifle');

  if (armaId === 'marreta') {
    const cabo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), new THREE.MeshLambertMaterial({ color: 0x7a5a34 }));
    cabo.position.z = -0.12;
    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.16), medio);
    cabeca.position.z = -0.36;
    grupo.add(cabo, cabeca);
    return grupo;
  }
  if (armaId === 'bloco') {
    grupo.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: 0x8fa3c4 })));
    return grupo;
  }

  const perfis = {
    pistola: { corpo: [0.05, 0.1, 0.22], cano: 0.08 },
    shotgun: { corpo: [0.06, 0.1, 0.5], cano: 0.3 },
    smg: { corpo: [0.06, 0.11, 0.36], cano: 0.16 },
    rifle: { corpo: [0.06, 0.11, 0.5], cano: 0.26 },
    sniper: { corpo: [0.06, 0.1, 0.62], cano: 0.36 }
  };
  const perfil = perfis[categoria] ?? perfis.rifle;

  const corpo = new THREE.Mesh(new THREE.BoxGeometry(...perfil.corpo), escuro);
  corpo.position.z = -perfil.corpo[2] / 2;
  const cano = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, perfil.cano), medio);
  cano.position.z = -perfil.corpo[2] - perfil.cano / 2 + 0.02;
  const pente = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.05), medio);
  pente.position.set(0, -0.09, -perfil.corpo[2] * 0.45);
  grupo.add(corpo, cano);
  if (categoria !== 'pistola') grupo.add(pente);

  if (categoria === 'sniper') {
    const luneta = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), escuro);
    luneta.position.set(0, 0.08, -perfil.corpo[2] * 0.55);
    grupo.add(luneta);
  }
  return grupo;
}

// ------------------------------------------------------------------- boneco

function criarBoneco(time, nome) {
  const c = CORES[time] ?? CORES[TIMES.AZUL];
  const raiz = new THREE.Group();

  // --- quadril: tudo pendura daqui, e é ele que agacha ---------------------
  const quadril = new THREE.Group();
  quadril.position.y = 0.88; // altura do quadril em pé
  raiz.add(quadril);

  // --- pernas (pivô no quadril, giram em X para caminhar) ------------------
  const pernas = [];
  for (const lado of [-1, 1]) {
    const pivo = new THREE.Group();
    pivo.position.set(lado * 0.13, 0, 0);
    quadril.add(pivo);

    const coxa = caixa(0.2, 0.46, 0.22, c.uniforme, 0, -0.23, 0);
    const bota = caixa(0.22, 0.14, 0.28, 0x2a2e36, 0, -0.5, 0.02);
    const joelho = caixa(0.19, 0.06, 0.21, c.uniformeClaro, 0, -0.42, 0);
    pivo.add(coxa, joelho, bota);
    pernas.push(pivo);
  }

  // --- tronco --------------------------------------------------------------
  const tronco = new THREE.Group();
  quadril.add(tronco);

  tronco.add(caixa(0.46, 0.5, 0.26, c.uniforme, 0, 0.25, 0)); // torso
  tronco.add(caixa(0.48, 0.3, 0.29, c.colete, 0, 0.34, 0)); // colete tático
  tronco.add(caixa(0.14, 0.1, 0.31, c.uniformeClaro, 0, 0.3, 0.01)); // fivela
  tronco.add(caixa(0.5, 0.1, 0.27, c.uniformeClaro, 0, 0.48, 0)); // ombreira
  // Bolsos do colete, para o peito não ser um bloco chapado.
  tronco.add(caixa(0.1, 0.12, 0.05, c.capacete, -0.13, 0.33, 0.15));
  tronco.add(caixa(0.1, 0.12, 0.05, c.capacete, 0.13, 0.33, 0.15));

  // --- pescoço e cabeça ----------------------------------------------------
  const pescoco = caixa(0.14, 0.11, 0.14, PELE, 0, 0.545, 0);
  tronco.add(pescoco);

  const pivoCabeca = new THREE.Group();
  pivoCabeca.position.y = 0.6;
  tronco.add(pivoCabeca);

  // Cabeça com o rosto só na face da frente (-Z, índice 5 do BoxGeometry).
  const pele = new THREE.MeshLambertMaterial({ color: PELE });
  const nuca = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
  const materiais = [pele, pele, nuca, pele, pele, new THREE.MeshLambertMaterial({ map: rosto() })];
  const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), materiais);
  cabeca.position.y = 0.21;
  pivoCabeca.add(cabeca);

  // Orelhas e capacete.
  pivoCabeca.add(caixa(0.05, 0.12, 0.1, PELE, -0.22, 0.2, 0.02));
  pivoCabeca.add(caixa(0.05, 0.12, 0.1, PELE, 0.22, 0.2, 0.02));
  pivoCabeca.add(caixa(0.46, 0.14, 0.44, c.capacete, 0, 0.4, 0));
  pivoCabeca.add(caixa(0.47, 0.06, 0.12, c.capacete, 0, 0.35, -0.2)); // aba

  // --- braços --------------------------------------------------------------
  // O braço direito segura o punho da arma; o esquerdo apoia o guarda-mão.
  // Ambos ficam num pivô que acompanha o pitch da mira.
  const pivoBracos = new THREE.Group();
  pivoBracos.position.y = 0.45;
  tronco.add(pivoBracos);

  // Braço direito: no punho da arma, colado ao corpo. O `rotation.z` puxa a
  // mão para a linha central, que é onde a arma fica.
  const bracoDireito = new THREE.Group();
  bracoDireito.position.set(-0.29, 0, 0);
  pivoBracos.add(bracoDireito);
  bracoDireito.add(caixa(0.14, 0.3, 0.14, c.uniforme, 0, -0.13, -0.02)); // braço
  bracoDireito.add(caixa(0.13, 0.13, 0.24, PELE, 0, -0.26, -0.12)); // antebraço
  bracoDireito.add(caixa(0.12, 0.12, 0.12, 0x2a2e36, 0, -0.26, -0.24)); // luva
  bracoDireito.rotation.set(-1.15, 0, 0.5);

  // Braço esquerdo: mais esticado, apoiando o guarda-mão lá na frente.
  const bracoEsquerdo = new THREE.Group();
  bracoEsquerdo.position.set(0.29, 0, 0);
  pivoBracos.add(bracoEsquerdo);
  bracoEsquerdo.add(caixa(0.14, 0.3, 0.14, c.uniforme, 0, -0.13, -0.02));
  bracoEsquerdo.add(caixa(0.13, 0.13, 0.3, PELE, 0, -0.26, -0.16));
  bracoEsquerdo.add(caixa(0.12, 0.12, 0.12, 0x2a2e36, 0, -0.26, -0.32));
  bracoEsquerdo.rotation.set(-1.45, 0, -0.62);

  // A arma fica entre as duas mãos, na altura do peito. O pivô dos braços já
  // está em y=0.45 dentro do tronco, então este y é relativo a ele — daí o
  // valor negativo: a arma desce do ombro para o peito.
  const suporteArma = new THREE.Group();
  suporteArma.position.set(-0.13, -0.22, -0.24);
  pivoBracos.add(suporteArma);

  const etiqueta = etiquetaDeNome(nome, time === TIMES.AZUL ? '#4d8fe0' : '#e05252');
  etiqueta.position.y = 2.18;
  raiz.add(etiqueta);

  return {
    raiz,
    quadril,
    tronco,
    pivoCabeca,
    pivoBracos,
    bracoDireito,
    bracoEsquerdo,
    suporteArma,
    pernas,
    etiqueta,
    armaAtual: null,
    faseAndar: Math.random() * Math.PI * 2,
    time
  };
}

// -------------------------------------------------------------------- módulo

export function criarJogadores(cena) {
  const bonecos = new Map();

  function trocarArma(boneco, armaId) {
    if (boneco.armaAtual === armaId) return;
    boneco.armaAtual = armaId;
    boneco.suporteArma.clear();
    boneco.suporteArma.add(armaDoBoneco(armaId));
  }

  /**
   * `estados`: lista de { id, nome, time, pos, yaw, pitch, vivo, agachado,
   * armaId, velocidade } — `velocidade` em m/s no plano, para dosar a
   * caminhada.
   */
  function sincronizar(estados, dt) {
    const vistos = new Set();

    for (const estado of estados) {
      vistos.add(estado.id);
      let boneco = bonecos.get(estado.id);

      // Boneco novo, ou troca de lado no meio da partida (muda a cor).
      if (!boneco || boneco.time !== estado.time) {
        if (boneco) cena.remove(boneco.raiz);
        boneco = criarBoneco(estado.time, estado.nome);
        bonecos.set(estado.id, boneco);
        cena.add(boneco.raiz);
      }

      boneco.raiz.visible = estado.vivo;
      if (!estado.vivo) continue;

      boneco.raiz.position.set(estado.pos.x, estado.pos.y, estado.pos.z);
      boneco.raiz.rotation.y = estado.yaw;

      trocarArma(boneco, estado.armaId ?? 'pm9');

      // Cabeça e braços acompanham o pitch (a arma aponta para onde ele olha).
      const pitch = Math.max(-1.2, Math.min(1.2, estado.pitch ?? 0));
      boneco.pivoCabeca.rotation.x = pitch * 0.85;
      boneco.pivoBracos.rotation.x = pitch * 0.8;

      // Agachar: quadril desce, tronco inclina, pernas dobram.
      const agachado = estado.agachado ? 1 : 0;
      boneco.alvoAgachado = agachado;
      boneco.agachadoSuave = boneco.agachadoSuave ?? agachado;
      boneco.agachadoSuave += (agachado - boneco.agachadoSuave) * Math.min(1, dt * 12);
      const ag = boneco.agachadoSuave;
      boneco.quadril.position.y = 0.88 - 0.3 * ag;
      boneco.tronco.rotation.x = 0.25 * ag;

      // Caminhada: pernas em contrafase, amplitude conforme a velocidade.
      const vel = Math.min(1, (estado.velocidade ?? 0) / 5);
      if (vel > 0.05) boneco.faseAndar += dt * (6 + vel * 6);
      const amplitude = vel * (0.7 - 0.25 * ag);
      const balanco = Math.sin(boneco.faseAndar) * amplitude;
      boneco.pernas[0].rotation.x = balanco - 0.45 * ag;
      boneco.pernas[1].rotation.x = -balanco - 0.45 * ag;

      // Parado, as pernas voltam devagar para a posição neutra.
      if (vel <= 0.05) {
        for (const perna of boneco.pernas) {
          perna.rotation.x += (-0.45 * ag - perna.rotation.x) * Math.min(1, dt * 8);
        }
      }

      // Um balanço leve no tronco e nos braços acompanha o passo.
      boneco.tronco.rotation.z = Math.sin(boneco.faseAndar) * amplitude * 0.06;
      boneco.bracoEsquerdo.rotation.z = -0.3 + Math.sin(boneco.faseAndar) * amplitude * 0.08;

      // A etiqueta não agacha junto: fica sempre acima da cabeça.
      boneco.etiqueta.position.y = 2.18 - 0.3 * ag;
    }

    for (const [id, boneco] of bonecos) {
      if (!vistos.has(id)) {
        cena.remove(boneco.raiz);
        bonecos.delete(id);
      }
    }
  }

  function limpar() {
    for (const boneco of bonecos.values()) cena.remove(boneco.raiz);
    bonecos.clear();
  }

  return { sincronizar, limpar };
}
