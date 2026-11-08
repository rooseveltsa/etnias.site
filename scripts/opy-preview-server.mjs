import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import handler from '../preview/server/community.mjs';
import middleware from '../preview/middleware.js';
import { verifySession, sessionCookie } from '../preview/server/session.mjs';
const root = resolve('preview/dist/public');
// Fotos, vídeos e arquivos herdados do Etnias antigo, no disco em OPY_LEGACY_MEDIA_DIR (contém a pasta upload/).
const legacyRoot = process.env.OPY_LEGACY_MEDIA_DIR ? resolve(process.env.OPY_LEGACY_MEDIA_DIR) : '';
const legacyTypes = { '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ogg':'audio/ogg','.m4a':'audio/mp4','.pdf':'application/pdf' };
async function serveLegacy(req, res, pathname) {
  const notFound = () => { res.writeHead(404); res.end(); };
  if (!legacyRoot) return notFound();
  // As páginas eram públicas no site antigo, mas a rede nova pede entrada: só quem tem sessão vê a mídia.
  if (!await verifySession(sessionCookie(req), process.env.OPY_SESSION_SECRET)) { res.writeHead(401); return res.end(); }
  const file = resolve(legacyRoot, '.' + decodeURIComponent(pathname.slice('/legado'.length)));
  const type = legacyTypes[extname(file).toLowerCase()];
  if (!file.startsWith(legacyRoot + sep) || !type) return notFound();
  let info;
  try { info = await stat(file); } catch { return notFound(); }
  if (!info.isFile()) return notFound();
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable' };
  // Range é o que permite o vídeo avançar e tocar no iPhone.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}
const types = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ttf':'font/ttf','.webmanifest':'application/manifest+json','.json':'application/json; charset=utf-8' };
const port = Number(process.env.PORT) || 8101;
// Na VPS o container precisa ouvir 0.0.0.0; o proxy HTTPS do host fica na frente. Localmente segue em 127.0.0.1.
const host = process.env.HOST || '127.0.0.1';
// Mesmos cabeçalhos de preview/dist/vercel.json, mais câmera e microfone só para o próprio site (chamadas e gravação de áudio).
const security = {
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'"
};
http.createServer(async (req, res) => {
 for (const [name, value] of Object.entries(security)) res.setHeader(name, value);
 try {
  // Atrás do Caddy o navegador usa HTTPS; sem isso os redirecionamentos voltariam para http://.
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const url = new URL(req.url, `${proto}://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;
  const path = pathname.replace(/\/$/, '') || '/';
  if (pathname.startsWith('/legado/')) return await serveLegacy(req, res, pathname);
  if (path === '/api/community' || path === '/api/media') {
    if (req.method === 'POST') {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 4*1024*1024) { res.writeHead(413); return res.end(); } }
      try { req.body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); }
    }
    return handler(req, res);
  }
  const gate = await middleware(new Request(url, { headers: req.headers }));
  if (gate) { res.writeHead(gate.status, Object.fromEntries(gate.headers)); return res.end(); }
  const file = resolve(root, '.' + decodeURIComponent(pathname) + (pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + sep) || !types[extname(file)]) { res.writeHead(404); return res.end(); }
  try { res.setHeader('Content-Type', types[extname(file)]); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
 } catch { if (!res.headersSent) res.writeHead(400); res.end('Requisição inválida.'); }
}).on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} está ocupada. Feche a outra prévia ou use PORT=8102 node scripts/dev-opy.mjs.` : error.message);
  process.exitCode = 1;
}).listen(port, host, () => console.log(`Casa Opy ouvindo em http://${host}:${port}`));
