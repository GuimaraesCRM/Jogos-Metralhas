/**
 * Tela inicial: nome (travado quando vem do launcher), endereço do servidor e
 * criar/entrar em sala.
 */

import { SERVIDOR_PADRAO } from '../config.js';
import { iniciais } from '../../../shared/protocolo.js';

function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

export function telaInicial(container, { identidade, servidorSalvo, aoCriar, aoEntrar }) {
  container.innerHTML = '';
  const tela = el('div', 'tela');
  const cartao = el('div', 'cartao');

  const logo = el('div', 'logo');
  const titulo = el('div', 'titulo');
  titulo.append('METRALHAS ');
  titulo.appendChild(el('span', 'azul', 'STRIKE'));
  titulo.append(' ');
  titulo.appendChild(el('span', 'vermelho', 'BLOCK'));
  logo.appendChild(titulo);
  logo.appendChild(el('div', 'subtitulo', 'Azul contra Vermelho · rounds, economia e blocos'));
  cartao.appendChild(logo);

  // Identidade: avatar + nome.
  const campoNome = el('div', 'campo');
  campoNome.appendChild(el('label', '', 'Seu nome'));
  const linhaNome = el('div', 'linha');
  const avatar = el('div', 'avatar');
  avatar.style.width = '40px';
  avatar.style.height = '40px';
  avatar.style.flex = 'none';
  if (identidade.avatar) {
    const img = document.createElement('img');
    img.src = identidade.avatar;
    img.alt = '';
    avatar.appendChild(img);
  } else {
    avatar.textContent = iniciais(identidade.nome || '?');
  }
  const inputNome = document.createElement('input');
  inputNome.type = 'text';
  inputNome.maxLength = 18;
  inputNome.value = identidade.nome || '';
  inputNome.placeholder = 'Como te chamam?';
  if (identidade.travado) inputNome.disabled = true;
  linhaNome.append(avatar, inputNome);
  campoNome.appendChild(linhaNome);
  if (identidade.travado) {
    campoNome.appendChild(el('div', 'nota launcher', 'Identidade fornecida pelo launcher'));
  }
  cartao.appendChild(campoNome);

  // Servidor.
  const campoServidor = el('div', 'campo');
  campoServidor.appendChild(el('label', '', 'Servidor'));
  const inputServidor = document.createElement('input');
  inputServidor.type = 'text';
  inputServidor.value = servidorSalvo || SERVIDOR_PADRAO;
  inputServidor.placeholder = SERVIDOR_PADRAO;
  campoServidor.appendChild(inputServidor);
  cartao.appendChild(campoServidor);

  cartao.appendChild(el('div', 'separador'));

  // Criar sala.
  const botaoCriar = el('button', 'primario', 'Criar sala');
  botaoCriar.addEventListener('click', () => {
    aoCriar(inputNome.value, inputServidor.value.trim() || SERVIDOR_PADRAO);
  });
  cartao.appendChild(botaoCriar);

  // Entrar com código.
  const linhaEntrar = el('div', 'linha');
  const inputCodigo = document.createElement('input');
  inputCodigo.type = 'text';
  inputCodigo.maxLength = 4;
  inputCodigo.placeholder = 'CÓDIGO';
  inputCodigo.style.textTransform = 'uppercase';
  if (identidade.sala) inputCodigo.value = identidade.sala;
  const botaoEntrar = el('button', '', 'Entrar na sala');
  botaoEntrar.addEventListener('click', () => {
    aoEntrar(inputNome.value, inputServidor.value.trim() || SERVIDOR_PADRAO, inputCodigo.value.trim().toUpperCase());
  });
  linhaEntrar.append(inputCodigo, botaoEntrar);
  cartao.appendChild(linhaEntrar);

  cartao.appendChild(
    el('div', 'nota', 'O servidor local sobe com npm run dev · para jogar pela internet, todos apontam para o mesmo endereço')
  );

  tela.appendChild(cartao);
  container.appendChild(tela);

  inputCodigo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') botaoEntrar.click();
  });
  if (!identidade.travado) inputNome.focus();

  return { inputNome, inputServidor };
}
