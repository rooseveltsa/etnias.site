// Sobe o servidor real (scripts/opy-preview-server.mjs) com dados locais temporários, para testes ponta a ponta.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
export async function freePort() { return new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); }); }
export async function startServer({ env = {}, seed } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'opy-test-'));
  if (seed) await writeFile(join(dir, 'community.json'), JSON.stringify(seed));
  const port = await freePort();
  const child = spawn(process.execPath, ['scripts/opy-preview-server.mjs'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', OPY_LOCAL_DATA_DIR: dir, OPY_SESSION_SECRET: 'teste-seguranca-segredo-longo-2026-xxxxxxxx', OPY_REGISTER_PER_HOUR: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { const r = await fetch(base + '/api/health'); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  const api = async (body, { cookie = '', ip = '', raw } = {}) => {
    const headers = { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}), ...(ip ? { 'x-forwarded-for': ip } : {}) };
    const r = await fetch(base + '/api/community', { method: body === undefined && raw === undefined ? 'GET' : 'POST', headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  return {
    base, dir, api, logs: () => logs,
    file: async () => readFile(join(dir, 'community.json'), 'utf8').catch(() => ''),
    stop: async () => { child.kill('SIGKILL'); await rm(dir, { recursive: true, force: true }); }
  };
}
