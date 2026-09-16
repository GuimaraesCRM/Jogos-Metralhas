/**
 * A conexão com o servidor de partidas.
 *
 * Um embrulho fino sobre WebSocket: `enviar(tipo, dados)` para falar e
 * `em(tipo, fn)` para ouvir. As mensagens de alta frequência (estado_jogador)
 * passam por aqui como qualquer outra — o servidor é quem aguenta o ritmo.
 */

export function criarConexao() {
  let ws = null;
  const ouvintes = new Map();
  let aoFechar = null;

  function em(tipo, fn) {
    ouvintes.set(tipo, fn);
  }

  function conectar(url) {
    return new Promise((resolver, falhar) => {
      try {
        ws = new WebSocket(url);
      } catch (erro) {
        return falhar(erro);
      }

      const falhaInicial = () => falhar(new Error('Não deu para conectar nesse servidor.'));
      ws.addEventListener('error', falhaInicial, { once: true });

      ws.addEventListener('open', () => {
        ws.removeEventListener('error', falhaInicial);
        resolver();
      });

      ws.addEventListener('message', (evento) => {
        let msg;
        try {
          msg = JSON.parse(evento.data);
        } catch {
          return;
        }
        const fn = ouvintes.get(msg.tipo);
        if (fn) fn(msg);
      });

      ws.addEventListener('close', () => {
        ws = null;
        if (aoFechar) aoFechar();
      });
    });
  }

  function enviar(tipo, dados = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ tipo, ...dados }));
    return true;
  }

  function fechar() {
    aoFechar = null;
    if (ws) ws.close();
    ws = null;
  }

  return {
    conectar,
    enviar,
    em,
    fechar,
    get conectada() {
      return Boolean(ws) && ws.readyState === WebSocket.OPEN;
    },
    set aoFechar(fn) {
      aoFechar = fn;
    }
  };
}
