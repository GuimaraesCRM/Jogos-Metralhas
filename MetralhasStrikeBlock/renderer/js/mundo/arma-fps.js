/**
 * A arma em primeira pessoa.
 *
 * Duas decisões estruturais aqui:
 *
 *  1. **Cena própria.** O viewmodel vive numa cena e numa câmera separadas,
 *     desenhadas depois do mundo com o buffer de profundidade limpo. Sem isso
 *     a arma atravessa a parede quando o jogador encosta num bloco — ela está
 *     a meio metro do olho, o bloco está a um metro, e o teste de profundidade
 *     faz o certo pelo motivo errado. É como todo FPS resolve isso.
 *
 *  2. **Tudo continua sendo geometria gerada por código**, sem arquivo de
 *     modelo: as peças (corpo, cano, guarda-mão, carregador, coronha, punho,
 *     mira de ferro, luneta) são caixas e cilindros posicionados por arma, com
 *     material metálico e luz dedicada. Modelo baixado traria arquivo binário
 *     e licença de terceiro para dentro do repositório.
 */

import * as THREE from '../../vendor/three.module.js';
import { MARRETA, armaPorId } from '../../../shared/armas.js';

/**
 * Onde a arma descansa. No quadril ela fica no canto; mirando, ela vai para o
 * centro e a ALTURA é calculada por arma, para que a mira de ferro (ou a
 * luneta) caia exatamente no meio da tela — mirar só vale a pena se a mira da
 * arma apontar para onde a bala vai.
 */
const POSE_QUADRIL = { x: 0.17, y: -0.145, z: -0.52 };
const MIRA_Z = -0.4;

/** O modelo inteiro é reduzido: em tamanho real a arma engole a tela. */
const ESCALA = 0.5;

/**
 * Ambiente refletido, gerado por código.
 *
 * Material metálico sem nada para refletir renderiza PRETO — é a armadilha
 * clássica do MeshStandardMaterial. Este gradiente (céu claro em cima, chão
 * escuro embaixo) é o que dá ao metal o brilho que faz a arma parecer metal.
 */
function ambienteDeEstudio() {
  const tela = document.createElement('canvas');
  tela.width = 32;
  tela.height = 64;
  const p = tela.getContext('2d');
  const grad = p.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, '#e8eef8'); // luz do alto
  grad.addColorStop(0.45, '#8f9cb0');
  grad.addColorStop(0.55, '#4a5262');
  grad.addColorStop(1, '#14181f'); // chão
  p.fillStyle = grad;
  p.fillRect(0, 0, 32, 64);

  const textura = new THREE.CanvasTexture(tela);
  textura.mapping = THREE.EquirectangularReflectionMapping;
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// ------------------------------------------------------------------ materiais

// Metalness moderado: alto demais some com a cor difusa e escurece tudo.
const MATERIAIS = {
  metalEscuro: new THREE.MeshStandardMaterial({ color: 0x545b66, metalness: 0.55, roughness: 0.45 }),
  metalMedio: new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.6, roughness: 0.4 }),
  metalClaro: new THREE.MeshStandardMaterial({ color: 0x8b93a1, metalness: 0.65, roughness: 0.35 }),
  polimero: new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.1, roughness: 0.72 }),
  madeira: new THREE.MeshStandardMaterial({ color: 0x8a5a30, metalness: 0.02, roughness: 0.8 }),
  madeiraClara: new THREE.MeshStandardMaterial({ color: 0xa8703d, metalness: 0.02, roughness: 0.75 }),
  vidro: new THREE.MeshStandardMaterial({
    color: 0x2f4d5c,
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.6
  }),
  ferro: new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.4, roughness: 0.6 }),
  cabo: new THREE.MeshStandardMaterial({ color: 0x9c7442, metalness: 0.02, roughness: 0.85 }),
  aco: new THREE.MeshStandardMaterial({ color: 0xa8b0bc, metalness: 0.7, roughness: 0.28 })
};

function bloco(w, h, d, material, x = 0, y = 0, z = 0) {
  const malha = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  malha.position.set(x, y, z);
  return malha;
}

function cilindro(raio, altura, material, x = 0, y = 0, z = 0, eixo = 'z') {
  const malha = new THREE.Mesh(new THREE.CylinderGeometry(raio, raio, altura, 12), material);
  if (eixo === 'z') malha.rotation.x = Math.PI / 2;
  else if (eixo === 'x') malha.rotation.z = Math.PI / 2;
  malha.position.set(x, y, z);
  return malha;
}

/**
 * Mira de ferro: poste na frente, aro atrás. Alinhados no eixo do cano e na
 * altura da linha de visada, para que mirando o jogador realmente "olhe" por
 * eles.
 */
function miraDeFerro(grupo, alturaLinha, zFrente, zTras) {
  const poste = bloco(0.008, 0.032, 0.01, MATERIAIS.ferro, 0, alturaLinha, zFrente);
  const protetorA = bloco(0.006, 0.042, 0.012, MATERIAIS.ferro, -0.022, alturaLinha + 0.004, zFrente);
  const protetorB = bloco(0.006, 0.042, 0.012, MATERIAIS.ferro, 0.022, alturaLinha + 0.004, zFrente);

  const aroEsq = bloco(0.008, 0.034, 0.016, MATERIAIS.ferro, -0.026, alturaLinha + 0.002, zTras);
  const aroDir = bloco(0.008, 0.034, 0.016, MATERIAIS.ferro, 0.026, alturaLinha + 0.002, zTras);
  const aroTopo = bloco(0.06, 0.008, 0.016, MATERIAIS.ferro, 0, alturaLinha + 0.019, zTras);

  grupo.add(poste, protetorA, protetorB, aroEsq, aroDir, aroTopo);
}

// ----------------------------------------------------------------- as mãos

const PELE = new THREE.MeshStandardMaterial({ color: 0xc89d78, metalness: 0.0, roughness: 0.85 });
const LUVA = new THREE.MeshStandardMaterial({ color: 0x31363f, metalness: 0.15, roughness: 0.8 });
const MANGA = new THREE.MeshStandardMaterial({ color: 0x3d4654, metalness: 0.05, roughness: 0.9 });

/**
 * Uma mão com antebraço, para a arma não ficar flutuando sozinha na tela.
 *
 * O braço aponta para trás e para baixo (some pela borda da tela, como no
 * corpo de quem está segurando), e os dedos se fecham em volta da peça. O
 * `lado` é -1 para a esquerda e +1 para a direita.
 */
function criarMao(lado) {
  const grupo = new THREE.Group();

  // Punho fechado em volta da peça: palma, dorso e dedos.
  const palma = bloco(0.052, 0.062, 0.07, LUVA, 0, 0, 0);
  grupo.add(palma);
  for (let i = 0; i < 4; i++) {
    // Dedos passando por baixo da peça, ligeiramente escalonados.
    grupo.add(bloco(0.018, 0.02, 0.05, PELE, lado * 0.028, 0.018 - i * 0.019, -0.006 + i * 0.004));
  }
  const polegar = bloco(0.02, 0.022, 0.05, PELE, -lado * 0.026, 0.012, -0.012);
  polegar.rotation.y = -lado * 0.3;
  grupo.add(polegar);

  // Antebraço: sai da mão para trás e para baixo, saindo da tela como o
  // braço de quem está segurando a arma.
  const antebraco = bloco(0.072, 0.072, 0.3, MANGA, 0, 0, 0.19);
  grupo.add(antebraco);
  grupo.add(bloco(0.08, 0.08, 0.055, MANGA, 0, 0, 0.075)); // punho da manga
  grupo.add(bloco(0.086, 0.086, 0.09, MANGA, 0, -0.012, 0.33)); // cotovelo

  return grupo;
}

/**
 * Prende as mãos no modelo, nos pontos de agarre daquela arma. Elas viram
 * filhas do grupo da arma, então acompanham recuo, recarga e golpada sem
 * precisar de animação própria.
 *
 * As rotações inclinam o antebraço para baixo e para fora, que é o caminho
 * que ele faria até o ombro — sem isso o braço fica boiando na horizontal.
 */
function porMaosNaArma(grupo, agarres) {
  if (agarres?.direita) {
    const mao = criarMao(1);
    mao.position.set(...agarres.direita);
    mao.rotation.set(0.62, -0.16, 0.06);
    grupo.add(mao);
  }
  if (agarres?.esquerda) {
    const mao = criarMao(-1);
    mao.position.set(...agarres.esquerda);
    // A mão de apoio cruza por baixo do guarda-mão, vindo do outro lado.
    mao.rotation.set(0.72, 0.42, -0.1);
    grupo.add(mao);
  }
}

// ------------------------------------------------------------------- modelos

/**
 * Cada construtor devolve `{ grupo, cano, alturaMira }`, onde `cano` é um
 * Object3D na ponta do cano — é dele que sai o clarão e de onde o tracer é
 * desenhado — e `alturaMira` alinha a mira no centro da tela durante o ADS.
 */

function pistola(cores = {}) {
  const grupo = new THREE.Group();
  const corpo = cores.corpo ?? MATERIAIS.metalEscuro;

  grupo.add(bloco(0.042, 0.075, 0.2, corpo, 0, 0.012, -0.05)); // ferrolho
  grupo.add(bloco(0.038, 0.05, 0.16, MATERIAIS.metalMedio, 0, -0.03, -0.03)); // armação
  const punho = bloco(0.04, 0.115, 0.058, MATERIAIS.polimero, 0, -0.095, 0.035);
  punho.rotation.x = -0.28;
  grupo.add(punho);
  const carregadorPistola = bloco(0.026, 0.055, 0.03, MATERIAIS.metalClaro, 0, -0.085, 0.03);
  carregadorPistola.name = 'carregador';
  grupo.add(carregadorPistola);
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.052, -0.008)); // gatilho/guarda
  grupo.add(cilindro(0.011, 0.06, MATERIAIS.aco, 0, 0.012, -0.155)); // cano saindo

  miraDeFerro(grupo, 0.052, -0.135, 0.02);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.012, -0.185);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.052, 0.028], esquerda: null });
  return { grupo, cano, alturaMira: 0.052 };
}

function revolverPesado() {
  const grupo = new THREE.Group();
  grupo.add(bloco(0.04, 0.062, 0.14, MATERIAIS.aco, 0, 0.015, -0.03));
  const tambor = cilindro(0.032, 0.07, MATERIAIS.metalClaro, 0, 0.012, 0.01);
  tambor.name = 'tambor';
  grupo.add(tambor);
  grupo.add(cilindro(0.013, 0.16, MATERIAIS.aco, 0, 0.016, -0.14)); // cano longo
  grupo.add(bloco(0.016, 0.018, 0.14, MATERIAIS.aco, 0, 0.042, -0.14)); // pente de mira
  const punho = bloco(0.042, 0.12, 0.062, MATERIAIS.madeira, 0, -0.082, 0.05);
  punho.rotation.x = -0.34;
  grupo.add(punho);
  grupo.add(bloco(0.014, 0.032, 0.03, MATERIAIS.ferro, 0, -0.042, 0.005));

  miraDeFerro(grupo, 0.062, -0.2, 0.02);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.016, -0.225);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.05, 0.05], esquerda: null });
  return { grupo, cano, alturaMira: 0.062 };
}

function shotgunCurta() {
  const grupo = new THREE.Group();
  grupo.add(bloco(0.05, 0.062, 0.24, MATERIAIS.metalEscuro, 0, 0, -0.06)); // caixa
  grupo.add(cilindro(0.019, 0.3, MATERIAIS.aco, 0, 0.026, -0.2)); // cano
  grupo.add(cilindro(0.013, 0.26, MATERIAIS.metalMedio, 0, -0.012, -0.19)); // tubo do pente
  const bombaCurta = bloco(0.05, 0.05, 0.11, MATERIAIS.madeira, 0, -0.005, -0.17);
  bombaCurta.name = 'bomba';
  grupo.add(bombaCurta);
  const punho = bloco(0.044, 0.11, 0.06, MATERIAIS.madeira, 0, -0.078, 0.045);
  punho.rotation.x = -0.32;
  grupo.add(punho);
  grupo.add(bloco(0.05, 0.075, 0.1, MATERIAIS.madeiraClara, 0, -0.035, 0.11)); // coronha curta
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.04, -0.005));

  miraDeFerro(grupo, 0.062, -0.33, 0.01);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.026, -0.36);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.048, 0.04], esquerda: [0, -0.008, -0.17] });
  return { grupo, cano, alturaMira: 0.062 };
}

function shotgunLonga() {
  const grupo = new THREE.Group();
  grupo.add(bloco(0.052, 0.07, 0.28, MATERIAIS.metalMedio, 0, 0, -0.08));
  grupo.add(cilindro(0.018, 0.4, MATERIAIS.aco, 0, 0.028, -0.27));
  grupo.add(cilindro(0.014, 0.34, MATERIAIS.metalEscuro, 0, -0.012, -0.25));
  const bombaLonga = bloco(0.052, 0.052, 0.14, MATERIAIS.polimero, 0, -0.004, -0.23);
  bombaLonga.name = 'bomba';
  grupo.add(bombaLonga);
  const punho = bloco(0.044, 0.115, 0.06, MATERIAIS.polimero, 0, -0.08, 0.04);
  punho.rotation.x = -0.3;
  grupo.add(punho);
  grupo.add(bloco(0.05, 0.085, 0.16, MATERIAIS.polimero, 0, -0.03, 0.14));
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.042, -0.01));

  miraDeFerro(grupo, 0.066, -0.43, 0.0);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.028, -0.47);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.05, 0.03], esquerda: [0, -0.012, -0.23] });
  return { grupo, cano, alturaMira: 0.066 };
}

function submetralhadora(compacta) {
  const grupo = new THREE.Group();
  const comprimento = compacta ? 0.26 : 0.3;

  grupo.add(bloco(0.048, 0.072, comprimento, MATERIAIS.polimero, 0, 0, -0.07));
  grupo.add(bloco(0.044, 0.042, 0.1, MATERIAIS.metalEscuro, 0, 0.026, -0.19)); // guarda-mão
  grupo.add(cilindro(0.012, 0.14, MATERIAIS.aco, 0, 0.012, -0.24));
  const carregador = bloco(0.03, 0.14, 0.05, MATERIAIS.metalMedio, 0, -0.09, -0.02);
  carregador.rotation.x = 0.1;
  carregador.name = 'carregador';
  grupo.add(carregador);
  const punho = bloco(0.042, 0.1, 0.055, MATERIAIS.polimero, 0, -0.072, 0.055);
  punho.rotation.x = -0.26;
  grupo.add(punho);
  // Coronha de arame dobrável.
  grupo.add(bloco(0.008, 0.008, 0.14, MATERIAIS.metalClaro, -0.026, 0.006, 0.13));
  grupo.add(bloco(0.008, 0.008, 0.14, MATERIAIS.metalClaro, 0.026, 0.006, 0.13));
  grupo.add(bloco(0.058, 0.03, 0.012, MATERIAIS.polimero, 0, 0.006, 0.2));
  grupo.add(bloco(0.014, 0.028, 0.026, MATERIAIS.ferro, 0, -0.04, -0.01));

  miraDeFerro(grupo, 0.056, -0.26, 0.03);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.012, -0.305);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.048, 0.055], esquerda: [0, 0.012, -0.2] });
  return { grupo, cano, alturaMira: 0.056 };
}

/** Estilo AK: madeira, cano longo, quebra-chamas. */
function rifleAk() {
  const grupo = new THREE.Group();
  grupo.add(bloco(0.05, 0.08, 0.3, MATERIAIS.metalEscuro, 0, 0, -0.06));
  grupo.add(bloco(0.05, 0.05, 0.16, MATERIAIS.madeira, 0, 0.022, -0.24)); // guarda-mão
  grupo.add(cilindro(0.012, 0.26, MATERIAIS.aco, 0, 0.018, -0.34));
  grupo.add(cilindro(0.017, 0.05, MATERIAIS.metalEscuro, 0, 0.018, -0.46)); // quebra-chamas
  grupo.add(cilindro(0.012, 0.18, MATERIAIS.metalMedio, 0, 0.05, -0.28)); // tubo de gás

  // Pente curvo característico: três segmentos inclinando, num grupo só para
  // a recarga conseguir tirar o pente inteiro de uma vez.
  const penteAk = new THREE.Group();
  penteAk.name = 'carregador';
  for (let i = 0; i < 3; i++) {
    const seg = bloco(0.03, 0.06, 0.05, MATERIAIS.metalClaro, 0, -0.07 - i * 0.05, -0.02 + i * 0.022);
    seg.rotation.x = 0.28 + i * 0.12;
    penteAk.add(seg);
  }
  grupo.add(penteAk);

  const punho = bloco(0.042, 0.11, 0.055, MATERIAIS.madeira, 0, -0.08, 0.06);
  punho.rotation.x = -0.3;
  grupo.add(punho);
  grupo.add(bloco(0.046, 0.075, 0.2, MATERIAIS.madeira, 0, -0.012, 0.19)); // coronha
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.046, 0.01));

  miraDeFerro(grupo, 0.07, -0.42, 0.02);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.018, -0.49);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.05, 0.062], esquerda: [0, 0.016, -0.245] });
  return { grupo, cano, alturaMira: 0.07 };
}

/** Estilo M4: polímero, alça de transporte, trilho. */
function rifleM4() {
  const grupo = new THREE.Group();
  grupo.add(bloco(0.048, 0.078, 0.26, MATERIAIS.polimero, 0, 0, -0.05));
  // Guarda-mão cilíndrico com nervuras.
  grupo.add(cilindro(0.026, 0.2, MATERIAIS.polimero, 0, 0.016, -0.27));
  for (let i = 0; i < 4; i++) {
    grupo.add(cilindro(0.028, 0.012, MATERIAIS.metalEscuro, 0, 0.016, -0.2 - i * 0.045));
  }
  grupo.add(cilindro(0.011, 0.22, MATERIAIS.aco, 0, 0.016, -0.4));
  grupo.add(cilindro(0.016, 0.045, MATERIAIS.metalEscuro, 0, 0.016, -0.48));

  const penteM4 = bloco(0.03, 0.13, 0.048, MATERIAIS.polimero, 0, -0.085, -0.03);
  penteM4.name = 'carregador';
  grupo.add(penteM4);
  const punho = bloco(0.042, 0.105, 0.052, MATERIAIS.polimero, 0, -0.078, 0.05);
  punho.rotation.x = -0.28;
  grupo.add(punho);
  // Coronha tubular ajustável.
  grupo.add(cilindro(0.016, 0.16, MATERIAIS.metalEscuro, 0, 0.004, 0.16));
  grupo.add(bloco(0.046, 0.07, 0.09, MATERIAIS.polimero, 0, -0.008, 0.21));
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.044, 0.0));

  // Trilho superior.
  grupo.add(bloco(0.03, 0.012, 0.3, MATERIAIS.metalEscuro, 0, 0.046, -0.14));
  miraDeFerro(grupo, 0.068, -0.4, 0.04);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.016, -0.51);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.048, 0.052], esquerda: [0, 0.016, -0.27] });
  return { grupo, cano, alturaMira: 0.068 };
}

/** Rajada de 3: corpo curto e compacto, com mira holográfica. */
function rifleRajada() {
  const grupo = new THREE.Group();
  grupo.add(bloco(0.05, 0.08, 0.24, MATERIAIS.metalMedio, 0, 0, -0.05));
  grupo.add(bloco(0.046, 0.046, 0.15, MATERIAIS.polimero, 0, 0.018, -0.23));
  grupo.add(cilindro(0.011, 0.18, MATERIAIS.aco, 0, 0.016, -0.35));
  const penteRajada = bloco(0.03, 0.12, 0.046, MATERIAIS.metalEscuro, 0, -0.082, -0.02);
  penteRajada.name = 'carregador';
  grupo.add(penteRajada);
  const punho = bloco(0.042, 0.1, 0.052, MATERIAIS.polimero, 0, -0.075, 0.05);
  punho.rotation.x = -0.28;
  grupo.add(punho);
  grupo.add(bloco(0.046, 0.075, 0.14, MATERIAIS.polimero, 0, -0.01, 0.16));
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.044, 0.0));

  // Mira holográfica: caixa com vidro esverdeado e um ponto vermelho.
  grupo.add(bloco(0.048, 0.042, 0.07, MATERIAIS.metalEscuro, 0, 0.066, -0.06));
  grupo.add(bloco(0.04, 0.034, 0.004, MATERIAIS.vidro, 0, 0.068, -0.094));
  const ponto = new THREE.Mesh(
    new THREE.SphereGeometry(0.004, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4d4d })
  );
  ponto.position.set(0, 0.068, -0.096);
  grupo.add(ponto);

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.016, -0.44);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.048, 0.05], esquerda: [0, 0.018, -0.23] });
  return { grupo, cano, alturaMira: 0.068 };
}

function sniper(pesada) {
  const grupo = new THREE.Group();
  const comprimentoCano = pesada ? 0.42 : 0.32;
  const corpoMat = pesada ? MATERIAIS.polimero : MATERIAIS.madeira;

  grupo.add(bloco(0.05, 0.075, 0.34, corpoMat, 0, -0.005, -0.06));
  grupo.add(bloco(0.046, 0.05, 0.22, corpoMat, 0, 0.012, -0.28)); // guarda-mão
  grupo.add(cilindro(0.013, comprimentoCano, MATERIAIS.aco, 0, 0.014, -0.42));
  if (pesada) grupo.add(cilindro(0.019, 0.07, MATERIAIS.metalEscuro, 0, 0.014, -0.6));

  const penteSniper = bloco(0.028, 0.08, 0.05, MATERIAIS.metalClaro, 0, -0.07, -0.02);
  penteSniper.name = 'carregador';
  grupo.add(penteSniper);
  const punho = bloco(0.042, 0.105, 0.055, corpoMat, 0, -0.078, 0.055);
  punho.rotation.x = -0.3;
  grupo.add(punho);
  grupo.add(bloco(0.048, 0.085, 0.22, corpoMat, 0, -0.012, 0.2)); // coronha longa
  grupo.add(bloco(0.048, 0.03, 0.09, corpoMat, 0, 0.042, 0.13)); // apoio de face
  grupo.add(bloco(0.014, 0.03, 0.028, MATERIAIS.ferro, 0, -0.044, 0.005));
  // Ferrolho lateral — é ele que a recarga puxa e empurra.
  const ferrolho = cilindro(0.008, 0.07, MATERIAIS.aco, 0.034, 0.02, 0.03, 'x');
  ferrolho.name = 'ferrolho';
  grupo.add(ferrolho);
  grupo.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), MATERIAIS.aco).translateX(0.07).translateY(0.02).translateZ(0.03));

  // Luneta: tubo, campânulas e lentes.
  const tubo = cilindro(0.023, 0.3, MATERIAIS.metalEscuro, 0, 0.075, -0.1);
  grupo.add(tubo);
  grupo.add(cilindro(0.03, 0.06, MATERIAIS.metalEscuro, 0, 0.075, -0.23)); // objetiva
  grupo.add(cilindro(0.027, 0.05, MATERIAIS.metalEscuro, 0, 0.075, 0.02)); // ocular
  grupo.add(cilindro(0.027, 0.006, MATERIAIS.vidro, 0, 0.075, -0.258));
  grupo.add(cilindro(0.024, 0.006, MATERIAIS.vidro, 0, 0.075, 0.043));
  grupo.add(cilindro(0.012, 0.02, MATERIAIS.metalClaro, 0, 0.098, -0.1)); // torre de ajuste
  // Anéis de montagem.
  grupo.add(bloco(0.05, 0.03, 0.016, MATERIAIS.metalMedio, 0, 0.056, -0.18));
  grupo.add(bloco(0.05, 0.03, 0.016, MATERIAIS.metalMedio, 0, 0.056, -0.01));

  if (pesada) {
    // Bipé recolhido sob o guarda-mão.
    const perna = (x) => {
      const p = bloco(0.008, 0.09, 0.008, MATERIAIS.metalEscuro, x, -0.05, -0.33);
      p.rotation.x = 0.5;
      p.rotation.z = x > 0 ? -0.25 : 0.25;
      return p;
    };
    grupo.add(perna(-0.02), perna(0.02));
  }

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.014, pesada ? -0.66 : -0.6);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.05, 0.058], esquerda: [0, 0.01, -0.29] });
  return { grupo, cano, alturaMira: 0.075 };
}

function marreta() {
  const grupo = new THREE.Group();

  // Cabo com enrolamento de fita no punho.
  grupo.add(cilindro(0.016, 0.46, MATERIAIS.cabo, 0, -0.02, -0.06));
  for (let i = 0; i < 4; i++) {
    grupo.add(cilindro(0.018, 0.022, MATERIAIS.ferro, 0, -0.02, 0.09 - i * 0.035));
  }
  // Cabeçote de aço com as duas faces.
  grupo.add(bloco(0.075, 0.075, 0.17, MATERIAIS.aco, 0, 0.005, -0.3));
  grupo.add(bloco(0.085, 0.085, 0.03, MATERIAIS.metalClaro, 0, 0.005, -0.37));
  grupo.add(bloco(0.085, 0.085, 0.03, MATERIAIS.metalClaro, 0, 0.005, -0.23));
  grupo.add(cilindro(0.021, 0.1, MATERIAIS.metalEscuro, 0, 0.005, -0.3)); // colar do cabo

  const cano = new THREE.Object3D();
  cano.position.set(0, 0.005, -0.37);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0, -0.018, 0.06], esquerda: [0, -0.018, -0.1] });
  return { grupo, cano, alturaMira: 0.03 };
}

function blocoNaMao() {
  const grupo = new THREE.Group();
  const cubo = bloco(0.2, 0.2, 0.2, new THREE.MeshStandardMaterial({
    color: 0x8fa3c4,
    metalness: 0.05,
    roughness: 0.95
  }), 0, -0.02, -0.12);
  cubo.rotation.set(0.3, 0.5, 0.1);
  grupo.add(cubo);
  // Arestas marcadas, para o cubo não virar um borrão liso.
  const arestas = new THREE.LineSegments(
    new THREE.EdgesGeometry(cubo.geometry),
    new THREE.LineBasicMaterial({ color: 0x2b3444 })
  );
  arestas.position.copy(cubo.position);
  arestas.rotation.copy(cubo.rotation);
  grupo.add(arestas);

  const cano = new THREE.Object3D();
  cano.position.set(0, -0.02, -0.22);
  grupo.add(cano);
  porMaosNaArma(grupo, { direita: [0.075, -0.06, -0.06], esquerda: null });
  return { grupo, cano, alturaMira: 0.0 };
}

const CONSTRUTORES = {
  pm9: () => pistola(),
  magnum: () => revolverPesado(),
  canocurto: () => shotgunCurta(),
  repetidora: () => shotgunLonga(),
  mpbloco: () => submetralhadora(true),
  metralhinha: () => submetralhadora(false),
  mc47: () => rifleAk(),
  mb4: () => rifleM4(),
  tribloco: () => rifleRajada(),
  luneta: () => sniper(false),
  awb: () => sniper(true),
  marreta: () => marreta(),
  bloco: () => blocoNaMao()
};

// ------------------------------------------------------------------- módulo

export function criarArmaFps() {
  // Cena e câmera dedicadas: é o que impede a arma de entrar na parede.
  const cena = new THREE.Scene();
  cena.environment = ambienteDeEstudio();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.005, 5);

  // Iluminação própria, pensada só para a arma: uma chave à esquerda alta,
  // um preenchimento frio à direita e uma contraluz para destacar a silhueta.
  cena.add(new THREE.AmbientLight(0xffffff, 0.75));
  const chave = new THREE.DirectionalLight(0xfff0d8, 1.8);
  chave.position.set(-0.6, 0.9, 0.5);
  cena.add(chave);
  const preenchimento = new THREE.DirectionalLight(0xaecbf0, 1.0);
  preenchimento.position.set(0.8, -0.2, 0.4);
  cena.add(preenchimento);
  const contra = new THREE.DirectionalLight(0xcfe0f7, 0.85);
  contra.position.set(0.2, 0.3, -1);
  cena.add(contra);

  const suporte = new THREE.Group();
  suporte.position.set(POSE_QUADRIL.x, POSE_QUADRIL.y, POSE_QUADRIL.z);
  suporte.scale.setScalar(ESCALA);
  cena.add(suporte);

  // O clarão do disparo é único e viaja para a arma ativa.
  const clarao = new THREE.Group();
  const nucleo = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.95 })
  );
  const petalas = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.1, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc247, transparent: true, opacity: 0.85 })
  );
  petalas.rotation.x = -Math.PI / 2;
  petalas.position.z = -0.05;
  clarao.add(nucleo, petalas);
  clarao.visible = false;

  const luzDoTiro = new THREE.PointLight(0xffc247, 0, 3);
  cena.add(luzDoTiro);

  let modelo = null;
  let cano = null;
  let tipoAtual = null;
  // Onde a arma precisa ficar para a mira dela cair no centro da tela.
  const poseMira = { x: 0, y: -0.03, z: MIRA_Z };

  // Estado das animações.
  let recuo = 0; // 0..1, decai depois do tiro
  let recarga = 0; // 1 -> 0 ao longo da recarga
  let estiloRecarga = 'pente';
  let troca = 0; // 1 -> 0 ao trocar de arma
  let golpe = 0; // 1 -> 0 durante a golpada da marreta
  let claraoAte = 0;
  let balanco = 0; // fase do balanço de caminhada
  let miraSuave = 0; // 0 no quadril, 1 mirando
  const posicao = new THREE.Vector3(POSE_QUADRIL.x, POSE_QUADRIL.y, POSE_QUADRIL.z);

  function mostrar(tipo) {
    if (tipo === tipoAtual) return;
    const construtor = CONSTRUTORES[tipo] ?? CONSTRUTORES.marreta;
    tipoAtual = tipo;
    if (modelo) suporte.remove(modelo);
    const montado = construtor();
    modelo = montado.grupo;
    cano = montado.cano;
    cano.add(clarao);
    suporte.add(modelo);

    // Mirando, a arma sobe até a linha do olho: descontamos a altura da mira
    // dela (já escalada) para que o poste caia no centro exato da tela.
    poseMira.y = -(montado.alturaMira ?? 0.06) * ESCALA;
    troca = 1;
    recuo = 0;
    recarga = 0;
  }

  function disparar() {
    recuo = 1;
    claraoAte = performance.now() + 45;
    clarao.visible = true;
    clarao.rotation.z = Math.random() * Math.PI;
    const escala = 0.85 + Math.random() * 0.4;
    clarao.scale.setScalar(escala);
    luzDoTiro.intensity = 6;
    if (cano) cano.getWorldPosition(luzDoTiro.position);
  }

  function golpear() {
    golpe = 1;
  }

  /**
   * Começa a recarga. `def` é a arma, para escolher o gesto: pente sai e
   * entra, bomba corre para trás e volta, ferrolho é puxado e empurrado, e o
   * tambor do revólver bascula para fora.
   */
  function recarregar(def) {
    recarga = 1;
    estiloRecarga = estiloDeRecarga(def);
  }

  /** Qual gesto de recarga cada arma faz. */
  function estiloDeRecarga(def) {
    if (!def) return 'pente';
    if (def.id === 'magnum') return 'tambor';
    if (def.categoria === 'shotgun') return 'bomba';
    if (def.categoria === 'sniper') return 'ferrolho';
    return 'pente';
  }

  /** Acha uma peça nomeada no modelo atual (carregador, bomba, ferrolho…). */
  function peca(nome) {
    return modelo?.children.find((filho) => filho.name === nome) ?? null;
  }

  /**
   * Anima a peça certa ao longo da recarga. `t` vai de 1 (começo) a 0 (fim),
   * então `passado` cresce de 0 a 1.
   */
  function animarRecarga(passado) {
    const carregador = peca('carregador');
    const bomba = peca('bomba');
    const ferrolho = peca('ferrolho');
    const tambor = peca('tambor');

    // Descanso: tudo volta ao lugar quando não há recarga em andamento.
    if (recarga <= 0) {
      if (carregador) carregador.position.y = carregador.userData.y0 ?? carregador.position.y;
      if (bomba) bomba.position.z = bomba.userData.z0 ?? bomba.position.z;
      if (ferrolho) ferrolho.position.x = ferrolho.userData.x0 ?? ferrolho.position.x;
      if (tambor) tambor.rotation.z = 0;
      return;
    }

    const guardar = (obj, eixo) => {
      if (obj && obj.userData[eixo + '0'] === undefined) obj.userData[eixo + '0'] = obj.position[eixo];
    };
    guardar(carregador, 'y');
    guardar(bomba, 'z');
    guardar(ferrolho, 'x');

    if (estiloRecarga === 'pente' && carregador) {
      // Primeira metade: o pente cai. Segunda: o novo sobe e encaixa.
      const queda = passado < 0.45 ? passado / 0.45 : 1 - (passado - 0.45) / 0.55;
      carregador.position.y = carregador.userData.y0 - queda * 0.22;
    } else if (estiloRecarga === 'bomba' && bomba) {
      // Vai e volta duas vezes: o gesto de bombear a shotgun.
      const ciclo = Math.sin(passado * Math.PI * 2);
      bomba.position.z = bomba.userData.z0 + Math.max(0, ciclo) * 0.09;
    } else if (estiloRecarga === 'ferrolho' && ferrolho) {
      const puxada = passado < 0.5 ? passado / 0.5 : 1 - (passado - 0.5) / 0.5;
      ferrolho.position.x = ferrolho.userData.x0 + puxada * 0.07;
    } else if (estiloRecarga === 'tambor' && tambor) {
      const abertura = passado < 0.5 ? passado / 0.5 : 1 - (passado - 0.5) / 0.5;
      tambor.rotation.z = abertura * 0.9;
    }
  }

  /**
   * Posição da ponta do cano no MUNDO, para o tracer sair de onde deveria.
   * A arma vive no espaço da câmera, então basta levar o ponto local pela
   * matriz da câmera do mundo.
   */
  function pontaDoCanoNoMundo(cameraDoMundo, destino) {
    if (!cano) return destino.set(0, 0, 0);
    cano.updateWorldMatrix(true, false);
    destino.setFromMatrixPosition(cano.matrixWorld);
    return destino.applyMatrix4(cameraDoMundo.matrixWorld);
  }

  function atualizar(dt, { mirando = false, andando = false, noChao = true } = {}) {
    recuo = Math.max(0, recuo - dt * 7.5);
    recarga = Math.max(0, recarga - dt / 2.2);
    animarRecarga(1 - recarga);
    troca = Math.max(0, troca - dt * 3.4);
    golpe = Math.max(0, golpe - dt / MARRETA.duracaoGolpe);

    if (performance.now() > claraoAte) {
      clarao.visible = false;
      luzDoTiro.intensity = Math.max(0, luzDoTiro.intensity - dt * 60);
    }

    // Transição suave entre quadril e mira.
    const alvoMira = mirando ? 1 : 0;
    miraSuave += (alvoMira - miraSuave) * Math.min(1, dt * 13);

    // Balanço de caminhada, que some quando o jogador mira.
    if (andando && noChao) balanco += dt * 9;
    const forcaBalanco = andando && noChao ? 0.012 * (1 - miraSuave) : 0;
    const balancoX = Math.cos(balanco) * forcaBalanco;
    const balancoY = Math.abs(Math.sin(balanco)) * forcaBalanco * 0.8;

    const baseX = POSE_QUADRIL.x + (poseMira.x - POSE_QUADRIL.x) * miraSuave;
    const baseY = POSE_QUADRIL.y + (poseMira.y - POSE_QUADRIL.y) * miraSuave;
    const baseZ = POSE_QUADRIL.z + (poseMira.z - POSE_QUADRIL.z) * miraSuave;

    // A golpada da marreta: levanta por cima do ombro e desce em arco.
    // Um pouco de ease para o movimento ter peso em vez de ser linear.
    const faseGolpe = 1 - golpe; // 0 -> 1 ao longo do golpe
    const subida = Math.sin(Math.min(1, faseGolpe / 0.35) * Math.PI * 0.5);
    const descida = faseGolpe > 0.35 ? Math.min(1, (faseGolpe - 0.35) / 0.35) : 0;
    const arco = golpe > 0 ? subida - descida * 1.25 : 0;

    const alvoX = baseX + balancoX - recarga * 0.05 + arco * 0.1;
    const alvoY = baseY + balancoY - recarga * 0.1 - troca * 0.34 + arco * 0.16;
    const alvoZ = baseZ + recuo * 0.075 + Math.abs(arco) * 0.06;

    posicao.x += (alvoX - posicao.x) * Math.min(1, dt * 18);
    posicao.y += (alvoY - posicao.y) * Math.min(1, dt * 18);
    posicao.z += (alvoZ - posicao.z) * Math.min(1, dt * 22);
    suporte.position.copy(posicao);

    // Rotação: coice para cima no tiro, giro na recarga, arco na marreta.
    suporte.rotation.x = recuo * 0.17 + recarga * 0.42 - arco * 1.15;
    suporte.rotation.y = recarga * 0.18 + balancoX * 1.5;
    suporte.rotation.z = recarga * 0.12 + arco * 0.25;

    // Mirando, o FOV do viewmodel também fecha um pouco: a arma "cresce" na
    // tela como num FPS de verdade.
    const fovAlvo = 58 - 10 * miraSuave;
    if (Math.abs(camera.fov - fovAlvo) > 0.05) {
      camera.fov += (fovAlvo - camera.fov) * Math.min(1, dt * 13);
      camera.updateProjectionMatrix();
    }
  }

  function redimensionar(largura, altura) {
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
  }

  function esconder(escondida) {
    suporte.visible = !escondida;
  }

  /** O quanto a mira já está fechada (0..1) — o HUD usa para a luneta. */
  function progressoDaMira() {
    return miraSuave;
  }

  function destruir() {
    cena.clear();
  }

  return {
    cena,
    camera,
    mostrar,
    disparar,
    golpear,
    recarregar,
    atualizar,
    redimensionar,
    esconder,
    progressoDaMira,
    pontaDoCanoNoMundo,
    destruir
  };
}
