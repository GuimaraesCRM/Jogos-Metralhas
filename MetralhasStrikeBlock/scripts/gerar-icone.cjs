/**
 * Gera build/icone.ico a partir de um desenho vetorial.
 *
 * Roda dentro do Electron (`npm run icone`) porque precisamos de um motor de
 * renderização para virar o SVG em PNG. O .ico é montado byte a byte aqui
 * mesmo: o formato é só um cabeçalho e uma lista de PNGs, e uma dependência a
 * mais no projeto só para isso não se justifica.
 */

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const SAIDA = path.join(__dirname, '..', 'build', 'icone.ico');
// 256 é o que o Windows usa em telas grandes; 16 é o da barra de tarefas.
const TAMANHOS = [16, 24, 32, 48, 64, 128, 256];

/**
 * O símbolo: dois blocos (azul e vermelho) frente a frente com uma mira no
 * meio. A 16 pixels os blocos ainda leem como dois quadrados de cor — qualquer
 * desenho mais detalhado vira borrão.
 */
const DESENHO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1c2330"/>
      <stop offset="1" stop-color="#0e1116"/>
    </linearGradient>
    <linearGradient id="azul" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4d8fe0"/>
      <stop offset="1" stop-color="#2b5ca8"/>
    </linearGradient>
    <linearGradient id="vermelho" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e05252"/>
      <stop offset="1" stop-color="#a82b2b"/>
    </linearGradient>
  </defs>

  <rect width="256" height="256" rx="56" fill="url(#fundo)"/>
  <rect x="8" y="8" width="240" height="240" rx="50" fill="none"
        stroke="#e8edf5" stroke-opacity="0.18" stroke-width="4"/>

  <!-- blocos dos dois times, com "topo" mais claro para lerem como cubos -->
  <rect x="34" y="96" width="76" height="76" rx="10" fill="url(#azul)"/>
  <rect x="34" y="96" width="76" height="20" rx="10" fill="#6ea8ef" opacity="0.85"/>
  <rect x="146" y="96" width="76" height="76" rx="10" fill="url(#vermelho)"/>
  <rect x="146" y="96" width="76" height="20" rx="10" fill="#ef7a6e" opacity="0.85"/>

  <!-- mira -->
  <circle cx="128" cy="134" r="34" fill="none" stroke="#f2f5fa" stroke-width="10"/>
  <line x1="128" y1="84" x2="128" y2="106" stroke="#f2f5fa" stroke-width="10" stroke-linecap="round"/>
  <line x1="128" y1="162" x2="128" y2="184" stroke="#f2f5fa" stroke-width="10" stroke-linecap="round"/>
  <line x1="78" y1="134" x2="100" y2="134" stroke="#f2f5fa" stroke-width="10" stroke-linecap="round"/>
  <line x1="156" y1="134" x2="178" y2="134" stroke="#f2f5fa" stroke-width="10" stroke-linecap="round"/>
</svg>`;

/** Monta o container .ico: cabeçalho, índice de entradas e os PNGs em seguida. */
function montarIco(imagens) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4);

  let deslocamento = 6 + imagens.length * 16;
  const entradas = imagens.map(({ tamanho, png }) => {
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0); // 0 significa 256
    entrada.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    entrada.writeUInt8(0, 2); // paleta
    entrada.writeUInt8(0, 3); // reservado
    entrada.writeUInt16LE(1, 4); // planos
    entrada.writeUInt16LE(32, 6); // bits por pixel
    entrada.writeUInt32LE(png.length, 8);
    entrada.writeUInt32LE(deslocamento, 12);
    deslocamento += png.length;
    return entrada;
  });

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.png)]);
}

app.whenReady().then(async () => {
  // Uma janela escondida desenha o SVG num canvas e devolve os PNGs em base64.
  // Preferi este caminho a `capturePage`: a captura depende de composição de
  // tela e falha em janelas offscreen, enquanto o canvas é puro DOM.
  const janela = new BrowserWindow({ show: false, width: 300, height: 300 });
  await janela.loadURL('data:text/html;charset=utf-8,<!doctype html><meta charset="utf-8"><body></body>');

  const svgBase64 = Buffer.from(DESENHO, 'utf8').toString('base64');

  const pngsBase64 = await janela.webContents.executeJavaScript(`
    (async () => {
      const fonte = 'data:image/svg+xml;base64,${svgBase64}';
      const imagem = new Image();
      await new Promise((ok, falhou) => {
        imagem.onload = ok;
        imagem.onerror = () => falhou(new Error('o SVG não carregou'));
        imagem.src = fonte;
      });

      return ${JSON.stringify(TAMANHOS)}.map((lado) => {
        const tela = document.createElement('canvas');
        tela.width = lado;
        tela.height = lado;
        const pincel = tela.getContext('2d');
        pincel.imageSmoothingQuality = 'high';
        pincel.drawImage(imagem, 0, 0, lado, lado);
        return tela.toDataURL('image/png').split(',')[1];
      });
    })()
  `, true);

  janela.destroy();

  const imagens = TAMANHOS.map((tamanho, i) => ({
    tamanho,
    png: Buffer.from(pngsBase64[i], 'base64')
  }));

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, montarIco(imagens));
  console.log(`icone.ico gerado com ${TAMANHOS.length} tamanhos (${TAMANHOS.join(', ')} px)`);
  app.quit();
});
