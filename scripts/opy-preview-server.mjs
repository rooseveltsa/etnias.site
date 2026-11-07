import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import handler from '../preview/server/community.mjs';
import middleware from '../preview/middleware.js';
const root = resolve('preview/dist/public');
const types = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ttf':'font/ttf','.webmanifest':'application/manifest+json' };
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
