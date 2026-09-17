/**
 * Os outros jogadores: bonecos articulados na cor do time.
 *
 * O corpo é uma hierarquia de pivôs (quadril → tronco → pescoço → cabeça;
 * ombro → cotovelo → mão), então animar é girar juntas, não mover caixas
 * soltas pelo espaço.
 *
 * Duas coisas que importam mais do que parecem:
 *
 *  - **A arma é filha do braço**, não um objeto solto perto do corpo. É o que
 *    impede a cena de "arma flutuando ao lado de um braço enfiado no peito".
 *    As duas mãos agarram a arma nos pontos certos porque as três coisas
 *    pendem da mesma cadeia de juntas.
 *
 *  - **As alturas vêm de `shared/constantes.js`**, as mesmas que o servidor
 *    usa para montar as caixas de acerto. A cabeça desenhada e a cabeça que o
 *    tiro procura são a mesma cabeça, em pé ou agachado.
 */

import * as THREE from '../../vendor/three.module.js';
import { CORPO, FISICA, TIMES, alturaDoCorpo } from '../../../shared/constantes.js';
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

/**
 * Onde a ARMA fica, no quadril e mirando. Os braços não têm pose própria: eles
 * são calculados para alcançar os pontos de agarre da arma, onde quer que ela
 * esteja. É por isso que o boneco segura a arma de verdade em vez de ficar com
 * ela boiando ao lado.
 */
const POSE_ARMA = {
  quadril: { pos: [-0.12, -0.14, -0.3], rot: [0.05, 0.14, 0] },
  mirando: { pos: [0, -0.015, -0.34], rot: [0, 0, 0] }
};

/** Comprimento dos dois ossos do braço (ombro→cotovelo, cotovelo→mão). */
const OSSO_BRACO = 0.27;
const OSSO_ANTEBRACO = 0.27;

const FRENTE_DO_BRACO = new THREE.Vector3(0, 0, -1);
const _alvo = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

const travar = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Cinemática inversa de dois ossos: gira ombro e cotovelo para que a mão caia
 * no ponto pedido.
 *
 * O braço aponta no -Z local, então primeiro o ombro se vira para o alvo; daí
 * a lei dos cossenos dá quanto o cotovelo precisa dobrar para a corrente
 * fechar exatamente na distância certa. Alvo fora de alcance deixa o braço
 * esticado, apontando — que é o que um braço faz mesmo.
 *
 * `giroDoCotovelo` decide para que lado o cotovelo aponta, senão os dois
 * braços dobrariam para o mesmo lugar e ficariam dentro do peito.
 */
function apontarBraco(ombro, cotovelo, alvoLocal, giroDoCotovelo) {
  _dir.copy(alvoLocal).sub(ombro.position);
  const distancia = _dir.length();
  if (distancia < 1e-4) return;
  _dir.divideScalar(distancia);

  // Ombro encara o alvo.
  _quat.setFromUnitVectors(FRENTE_DO_BRACO, _dir);
  ombro.quaternion.copy(_quat);
  // Gira em torno do próprio eixo para escolher o lado do cotovelo.
  ombro.rotateZ(giroDoCotovelo);

  const alcance = OSSO_BRACO + OSSO_ANTEBRACO;
  if (distancia >= alcance - 1e-3) {
    // Esticado: nada a dobrar.
    cotovelo.rotation.x = 0;
    return;
  }

  const d = Math.max(distancia, 1e-3);
  const cosOmbro = travar(
    (OSSO_BRACO * OSSO_BRACO + d * d - OSSO_ANTEBRACO * OSSO_ANTEBRACO) / (2 * OSSO_BRACO * d),
    -1,
    1
  );
  const cosCotovelo = travar(
    (OSSO_BRACO * OSSO_BRACO + OSSO_ANTEBRACO * OSSO_ANTEBRACO - d * d) /
      (2 * OSSO_BRACO * OSSO_ANTEBRACO),
    -1,
    1
  );

  // Levanta o braço superior e dobra o cotovelo de volta: a soma recoloca a
  // mão sobre a linha reta até o alvo, à distância exata.
  ombro.rotateX(-Math.acos(cosOmbro));
  cotovelo.rotation.x = Math.PI - Math.acos(cosCotovelo);
}

// ------------------------------------------------------------------- rosto

const PELE_ESCURA_HEX = '#a87f5c';

function texturaDeRosto() {
  const tela = document.createElement('canvas');
  tela.width = 64;
  tela.height = 64;
  const p = tela.getContext('2d');

  p.fillStyle = '#c89d78';
  p.fillRect(0, 0, 64, 64);
  p.fillStyle = 'rgba(120, 80, 50, 0.18)';
  p.fillRect(0, 0, 7, 64);
  p.fillRect(57, 0, 7, 64);

  // Cabelo cobrindo o topo e as têmporas.
  p.fillStyle = '#3a2a1c';
  p.fillRect(0, 0, 64, 13);
  p.fillRect(0, 13, 8, 9);
  p.fillRect(56, 13, 8, 9);

  p.fillRect(13, 22, 15, 4); // sobrancelhas
  p.fillRect(36, 22, 15, 4);

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

  p.fillStyle = PELE_ESCURA_HEX;
  p.fillRect(30, 38, 5, 8);
  p.fillStyle = 'rgba(90, 60, 40, 0.5)';
  p.fillRect(30, 45, 5, 2);

  p.fillStyle = '#7a3b34';
  p.fillRect(24, 51, 16, 4);
  p.fillStyle = 'rgba(0,0,0,0.25)';
  p.fillRect(24, 51, 16, 1);

  const textura = new THREE.CanvasTexture(tela);
  textura.magFilter = THREE.NearestFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  return textura;
}

let texturaRosto = null;
const rosto = () => (texturaRosto ??= texturaDeRosto());

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

/**
 * Onde as duas mãos agarram cada silhueta, no espaço local da arma. São estes
 * pontos que os braços perseguem: sem eles o boneco fica com a arma flutuando
 * ao lado de braços apontando para o nada.
 */
function agarresDaArma(armaId, perfil) {
  if (armaId === 'marreta') return { direita: [0, 0, 0.02], esquerda: [0, 0, -0.16] };
  if (armaId === 'bloco') return { direita: [0.06, -0.04, -0.14], esquerda: null };
  return {
    direita: [0, -0.05, -perfil.corpo * 0.3],
    esquerda: perfil.corpo > 0.25 ? [0, -0.02, -perfil.corpo * 0.85] : null
  };
}

/** Arma vista de fora: silhueta por categoria, com o cano apontando para -Z. */
function armaDoBoneco(armaId) {
  const grupo = new THREE.Group();
  // Cores, não materiais: `caixa` monta o material a partir do número. Passar
  // um Material aqui faz `color` receber um objeto e a arma sair branca.
  const escuro = 0x23272e;
  const medio = 0x3d434c;
  const madeira = 0x6d4a2b;

  const def = armaPorId(armaId);
  const categoria = def?.categoria ?? (armaId === 'marreta' ? 'marreta' : 'rifle');

  if (armaId === 'marreta') {
    grupo.add(caixa(0.04, 0.04, 0.46, madeira, 0, 0, -0.1));
    grupo.add(caixa(0.13, 0.13, 0.16, medio, 0, 0, -0.34));
    return { grupo, agarres: agarresDaArma(armaId) };
  }
  if (armaId === 'bloco') {
    grupo.add(caixa(0.22, 0.22, 0.22, 0x8fa3c4, 0, 0, -0.18));
    return { grupo, agarres: agarresDaArma(armaId) };
  }

  const perfis = {
    pistola: { corpo: 0.2, cano: 0.07, alt: 0.1, madeira: false },
    shotgun: { corpo: 0.42, cano: 0.28, alt: 0.1, madeira: true },
    smg: { corpo: 0.32, cano: 0.14, alt: 0.11, madeira: false },
    rifle: { corpo: 0.42, cano: 0.24, alt: 0.11, madeira: armaId === 'mc47' },
    sniper: { corpo: 0.5, cano: 0.34, alt: 0.1, madeira: armaId === 'luneta' }
  };
  const perfil = perfis[categoria] ?? perfis.rifle;

  grupo.add(caixa(0.06, perfil.alt, perfil.corpo, escuro, 0, 0, -perfil.corpo / 2));
  grupo.add(caixa(0.03, 0.03, perfil.cano, medio, 0, 0.012, -perfil.corpo - perfil.cano / 2 + 0.02));
  grupo.add(caixa(0.05, 0.09, 0.05, escuro, 0, -0.08, -perfil.corpo * 0.3)); // punho

  if (categoria !== 'pistola') {
    grupo.add(caixa(0.035, 0.12, 0.05, medio, 0, -0.09, -perfil.corpo * 0.55)); // pente
    grupo.add(caixa(0.055, 0.075, 0.12, perfil.madeira ? madeira : escuro, 0, -0.005, 0.05)); // coronha
  }
  if (perfil.madeira) {
    grupo.add(caixa(0.062, 0.055, 0.14, madeira, 0, 0.01, -perfil.corpo * 0.85));
  }
  if (categoria === 'sniper') {
    grupo.add(caixa(0.04, 0.045, 0.2, escuro, 0, 0.08, -perfil.corpo * 0.5));
  }
  return { grupo, agarres: agarresDaArma(armaId, perfil) };
}

/** Um braço: ombro → braço → cotovelo → antebraço → mão, tudo articulado. */
function criarBraco(corUniforme, lado) {
  const ombro = new THREE.Group();
  // Braço superior pendurado do ombro, com a ombreira arredondando a junta.
  ombro.add(caixa(0.13, 0.13, 0.28, corUniforme, 0, 0, -0.13));
  ombro.add(caixa(0.15, 0.15, 0.1, corUniforme, 0, 0, -0.02));

  const cotovelo = new THREE.Group();
  cotovelo.position.z = -0.27;
  ombro.add(cotovelo);

  // Antebraço fino: grosso demais lê como um bloco de carne solto.
  cotovelo.add(caixa(0.1, 0.1, 0.26, PELE, 0, 0, -0.13));
  cotovelo.add(caixa(0.115, 0.115, 0.06, corUniforme, 0, 0, -0.03)); // punho da manga

  const mao = new THREE.Group();
  mao.position.z = -0.27;
  cotovelo.add(mao);
  mao.add(caixa(0.1, 0.095, 0.11, 0x2a2e36)); // luva
  mao.add(caixa(0.095, 0.03, 0.045, PELE, 0, 0.045, -0.03)); // dedos

  return { ombro, cotovelo, mao };
}

// ------------------------------------------------------------------- boneco

function criarBoneco(time, nome) {
  const c = CORES[time] ?? CORES[TIMES.AZUL];
  const raiz = new THREE.Group();

  // Alturas derivadas das constantes compartilhadas, para o desenho bater com
  // as caixas de acerto do servidor.
  const alturaTronco = FISICA.ALTURA - CORPO.ALTURA_CABECA - CORPO.QUADRIL; // 1.8-0.4-0.85
  const alturaOmbro = alturaTronco - 0.1;

  const quadril = new THREE.Group();
  quadril.position.y = CORPO.QUADRIL;
  raiz.add(quadril);

  // --- pernas --------------------------------------------------------------
  const pernas = [];
  for (const lado of [-1, 1]) {
    const pivo = new THREE.Group();
    pivo.position.set(lado * 0.13, 0, 0);
    quadril.add(pivo);
    pivo.add(caixa(0.2, 0.55, 0.22, c.uniforme, 0, -0.28, 0)); // coxa+canela
    pivo.add(caixa(0.19, 0.06, 0.21, c.uniformeClaro, 0, -0.5, 0)); // joelho
    pivo.add(caixa(0.22, 0.14, 0.28, 0x2a2e36, 0, -0.78, 0.03)); // bota
    pernas.push(pivo);
  }

  // --- tronco --------------------------------------------------------------
  const tronco = new THREE.Group();
  quadril.add(tronco);
  tronco.add(caixa(0.44, alturaTronco, 0.25, c.uniforme, 0, alturaTronco / 2, 0));
  tronco.add(caixa(0.46, 0.28, 0.28, c.colete, 0, alturaTronco * 0.62, 0)); // colete
  tronco.add(caixa(0.1, 0.11, 0.05, c.capacete, -0.12, alturaTronco * 0.6, 0.145)); // bolsos
  tronco.add(caixa(0.1, 0.11, 0.05, c.capacete, 0.12, alturaTronco * 0.6, 0.145));
  tronco.add(caixa(0.5, 0.09, 0.26, c.uniformeClaro, 0, alturaOmbro, 0)); // ombreira
  tronco.add(caixa(0.14, 0.1, 0.14, PELE, 0, alturaTronco - 0.02, 0)); // pescoço

  // --- cabeça --------------------------------------------------------------
  // Base exatamente onde o servidor começa a caixa da cabeça.
  const pivoCabeca = new THREE.Group();
  pivoCabeca.position.y = alturaTronco;
  tronco.add(pivoCabeca);

  const pele = new THREE.MeshLambertMaterial({ color: PELE });
  const nuca = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
  const ladoCabeca = CORPO.ALTURA_CABECA * 0.85; // 0.34
  const materiais = [pele, pele, nuca, pele, pele, new THREE.MeshLambertMaterial({ map: rosto() })];
  const cabeca = new THREE.Mesh(
    new THREE.BoxGeometry(ladoCabeca, ladoCabeca, ladoCabeca * 0.95),
    materiais
  );
  cabeca.position.y = ladoCabeca / 2;
  pivoCabeca.add(cabeca);
  pivoCabeca.add(caixa(0.05, 0.1, 0.09, PELE, -ladoCabeca / 2 - 0.02, ladoCabeca / 2, 0.01));
  pivoCabeca.add(caixa(0.05, 0.1, 0.09, PELE, ladoCabeca / 2 + 0.02, ladoCabeca / 2, 0.01));
  // Capacete ocupa os últimos centímetros até o topo da caixa de acerto.
  pivoCabeca.add(caixa(ladoCabeca + 0.04, 0.06, ladoCabeca + 0.03, c.capacete, 0, CORPO.ALTURA_CABECA - 0.03, 0));
  pivoCabeca.add(caixa(ladoCabeca + 0.05, 0.04, 0.1, c.capacete, 0, CORPO.ALTURA_CABECA - 0.07, -ladoCabeca / 2));

  // --- braços e arma -------------------------------------------------------
  // Tudo pendura do mesmo pivô, que acompanha o pitch: os braços e a arma
  // nunca se separam porque são a mesma cadeia.
  const pivoBracos = new THREE.Group();
  pivoBracos.position.y = alturaOmbro;
  tronco.add(pivoBracos);

  const bracoDir = criarBraco(c.uniforme, 1);
  bracoDir.ombro.position.x = -0.26;
  pivoBracos.add(bracoDir.ombro);

  const bracoEsq = criarBraco(c.uniforme, -1);
  bracoEsq.ombro.position.x = 0.26;
  pivoBracos.add(bracoEsq.ombro);

  const suporteArma = new THREE.Group();
  pivoBracos.add(suporteArma);

  const etiqueta = etiquetaDeNome(nome, time === TIMES.AZUL ? '#4d8fe0' : '#e05252');
  raiz.add(etiqueta);

  return {
    raiz,
    quadril,
    tronco,
    pivoCabeca,
    pivoBracos,
    bracoDir,
    bracoEsq,
    suporteArma,
    pernas,
    etiqueta,
    alturaTronco,
    armaAtual: null,
    faseAndar: Math.random() * Math.PI * 2,
    agachadoSuave: 0,
    miraSuave: 0,
    time
  };
}

// -------------------------------------------------------------------- módulo

/**
 * Põe a arma na pose (quadril ↔ mirando) e depois manda os braços atrás dela.
 * A ordem importa: a arma decide, os braços obedecem.
 */
function aplicarPose(boneco, t) {
  const a = POSE_ARMA.quadril;
  const b = POSE_ARMA.mirando;
  const entre = (x, y) => x + (y - x) * t;

  const arma = boneco.suporteArma;
  arma.position.set(entre(a.pos[0], b.pos[0]), entre(a.pos[1], b.pos[1]), entre(a.pos[2], b.pos[2]));
  arma.rotation.set(entre(a.rot[0], b.rot[0]), entre(a.rot[1], b.rot[1]), entre(a.rot[2], b.rot[2]));
  arma.updateMatrix();

  const agarres = boneco.agarres;
  if (!agarres) return;

  // Os pontos de agarre estão no espaço da arma; a matriz do suporte os leva
  // para o espaço dos ombros, que é onde a IK trabalha.
  if (agarres.direita) {
    _alvo.set(...agarres.direita).applyMatrix4(arma.matrix);
    apontarBraco(boneco.bracoDir.ombro, boneco.bracoDir.cotovelo, _alvo, 0.5);
  }
  if (agarres.esquerda) {
    boneco.bracoEsq.ombro.visible = true;
    _alvo.set(...agarres.esquerda).applyMatrix4(arma.matrix);
    apontarBraco(boneco.bracoEsq.ombro, boneco.bracoEsq.cotovelo, _alvo, -0.5);
  } else {
    // Arma de uma mão só: o outro braço descansa ao lado do corpo.
    boneco.bracoEsq.ombro.quaternion.identity();
    boneco.bracoEsq.ombro.rotation.set(-0.15, 0, -0.12);
    boneco.bracoEsq.cotovelo.rotation.x = 0.35;
  }
}

export function criarJogadores(cena) {
  const bonecos = new Map();

  function trocarArma(boneco, armaId) {
    if (boneco.armaAtual === armaId) return;
    boneco.armaAtual = armaId;
    boneco.suporteArma.clear();
    const { grupo, agarres } = armaDoBoneco(armaId);
    boneco.suporteArma.add(grupo);
    boneco.agarres = agarres;
  }

  /**
   * `estados`: { id, nome, time, pos, yaw, pitch, vivo, agachado, mirando,
   * armaId, velocidade }.
   */
  function sincronizar(estados, dt) {
    const vistos = new Set();

    for (const estado of estados) {
      vistos.add(estado.id);
      let boneco = bonecos.get(estado.id);

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

      // Agachar: o corpo inteiro comprime até a altura que o servidor usa nas
      // caixas de acerto, então o que se vê é onde o tiro acerta.
      const agachado = estado.agachado ? 1 : 0;
      boneco.agachadoSuave += (agachado - boneco.agachadoSuave) * Math.min(1, dt * 12);
      const ag = boneco.agachadoSuave;
      const alturaAlvo = alturaDoCorpo(estado.agachado);
      boneco.quadril.position.y = CORPO.QUADRIL + (CORPO.QUADRIL_AGACHADO - CORPO.QUADRIL) * ag;
      // O tronco encolhe o resto da diferença, mantendo a cabeça no topo.
      const sobra = alturaAlvo - CORPO.ALTURA_CABECA - boneco.quadril.position.y;
      boneco.tronco.scale.y = Math.max(0.55, sobra / boneco.alturaTronco);
      boneco.tronco.rotation.x = 0.22 * ag;

      // Mirar: a pose de braços e arma vai para a de mira, e é isso que o
      // inimigo enxerga quando alguém encosta o olho na arma.
      const mira = estado.mirando ? 1 : 0;
      boneco.miraSuave += (mira - boneco.miraSuave) * Math.min(1, dt * 11);
      aplicarPose(boneco, boneco.miraSuave);

      const pitch = Math.max(-1.2, Math.min(1.2, estado.pitch ?? 0));
      boneco.pivoCabeca.rotation.x = pitch * 0.85;
      // Mirando, os braços seguem o olhar quase inteiro; no quadril, menos.
      boneco.pivoBracos.rotation.x = pitch * (0.55 + 0.4 * boneco.miraSuave);

      // Caminhada: pernas em contrafase, amplitude conforme a velocidade.
      const vel = Math.min(1, (estado.velocidade ?? 0) / FISICA.VEL_ANDAR);
      if (vel > 0.05) boneco.faseAndar += dt * (6 + vel * 6);
      const amplitude = vel * (0.7 - 0.25 * ag);
      const balanco = Math.sin(boneco.faseAndar) * amplitude;
      boneco.pernas[0].rotation.x = balanco - 0.5 * ag;
      boneco.pernas[1].rotation.x = -balanco - 0.5 * ag;
      if (vel <= 0.05) {
        for (const perna of boneco.pernas) {
          perna.rotation.x += (-0.5 * ag - perna.rotation.x) * Math.min(1, dt * 8);
        }
      }
      boneco.tronco.rotation.z = balanco * 0.06;

      // A etiqueta fica sempre logo acima da cabeça, agachado ou não.
      boneco.etiqueta.position.y = alturaAlvo + 0.35;
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
