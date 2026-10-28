import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { GameService, HttpError } from './rooms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIRS = { '/shared/': path.join(ROOT, 'shared'), '/': path.join(ROOT, 'public') };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const MAX_BODY_BYTES = 256 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Requisição grande demais'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const prefix = pathname.startsWith('/shared/') ? '/shared/' : '/';
  const base = STATIC_DIRS[prefix];
  const rel = pathname.slice(prefix.length) || 'index.html';
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) return sendJson(res, 403, { error: 'Proibido' });
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Não encontrado' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  });
}

export function createServer(service) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Método não permitido' });
      return serveStatic(req, res, pathname);
    }
    try {
      const auth = req.headers.authorization ?? '';
      const player = service.authenticate(auth.startsWith('Bearer ') ? auth.slice(7) : '');
      const requirePlayer = () => {
        if (!player) throw new HttpError(401, 'Faça login de novo');
        return player;
      };
      const route = `${req.method} ${pathname}`;
      let match;

      if (route === 'POST /api/players') {
        const body = await readJson(req);
        return sendJson(res, 201, service.createPlayer(body.name));
      }
      if (route === 'GET /api/me') return sendJson(res, 200, service.publicPlayer(requirePlayer()));
      if (route === 'POST /api/bonus') return sendJson(res, 200, service.claimBonus(requirePlayer()));
      if (route === 'POST /api/rooms/join') return sendJson(res, 200, service.joinRoom(requirePlayer()));
      if ((match = route.match(/^POST \/api\/rooms\/([\w-]+)\/submit$/))) {
        const body = await readJson(req);
        return sendJson(res, 200, service.submit(requirePlayer(), match[1], body));
      }
      if ((match = route.match(/^GET \/api\/rooms\/([\w-]+)$/))) {
        return sendJson(res, 200, service.roomView(match[1], requirePlayer()));
      }
      throw new HttpError(404, 'Rota não encontrada');
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      console.error(err);
      return sendJson(res, 500, { error: 'Erro interno' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const store = openStore(process.env.DB_FILE ?? path.join(ROOT, 'data', 'db.json'));
  const service = new GameService({ store });
  setInterval(() => service.tick(), 5_000).unref();
  createServer(service).listen(port, () => {
    console.log(`Bloco Rush rodando em http://localhost:${port}`);
  });
}
