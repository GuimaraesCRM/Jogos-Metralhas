import http from 'node:http';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRoom, join, act, snapshot, tick } from './game.js';

export function createServer() {
  const rooms = new Map();
  return http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const room = rooms.get(url.searchParams.get('code'));
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        if (!room || !room.players.some(p => p.token === token)) return send(403, {error: 'Sala ou sessão inválida.'});
        room.touched = Date.now(); tick(room); return send(200, snapshot(room));
      }
      if (req.method !== 'POST' || !['/api/create', '/api/join', '/api/action'].includes(url.pathname)) return send(404, {error: 'Não encontrado.'});
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) return send(403, {error: 'Origem inválida.'});
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) return send(413, {error: 'Pedido muito grande.'}); }
      const body = JSON.parse(raw || '{}');
      for (const [code, room] of rooms) if (Date.now() - room.touched > 86400000) rooms.delete(code);
      if (url.pathname === '/api/create') {
        if (rooms.size >= 200) return send(503, {error: 'Limite de salas atingido.'});
        let code; do { code = randomInt(0, 36 ** 6).toString(36).padStart(6, '0').toUpperCase(); } while (rooms.has(code));
        const room = createRoom(code, body.name); rooms.set(code, room);
        return send(201, {code, token: room.players[0].token, id: room.players[0].id});
      }
      const room = rooms.get(String(body.code || '').toUpperCase());
      if (!room) return send(404, {error: 'Sala não encontrada.'});
      room.touched = Date.now();
      if (url.pathname === '/api/join') {
        const p = join(room, body.name); return send(200, {code: room.code, token: p.token, id: p.id});
      }
      tick(room);
      act(room, req.headers.authorization?.replace(/^Bearer /, ''), body.action, body.value);
      send(200, snapshot(room));
    } catch (error) { send(400, {error: error instanceof SyntaxError ? 'Pedido inválido.' : error.message}); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '0.0.0.0', () => console.log(`Monopoly disponível em http://localhost:${port}`));
}
