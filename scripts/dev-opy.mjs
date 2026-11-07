import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

if (process.env.VERCEL) throw new Error('Este comando serve apenas para teste local.');
const project = fileURLToPath(new URL('../', import.meta.url));
process.chdir(project);
await access(join(project, 'preview/dist/public/iara/index.html')).catch(() => { throw new Error('Exporte a prévia antes de iniciar: php scripts/export-opy-preview.php'); });
const port = Number(process.env.PORT || 8101);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Use uma porta entre 1024 e 65535.');
const directory = join(project, 'preview/local-data', String(port));
await mkdir(directory, { recursive: true, mode: 0o700 });
const secretPath = join(directory, 'session-secret');
try { await writeFile(secretPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
process.env.OPY_SESSION_SECRET = (await readFile(secretPath, 'utf8')).trim();
process.env.OPY_LOCAL_DATA_DIR = directory;
console.log(`Teste local: dados em preview/local-data/${port}. Crie uma conta de teste na tela de entrada.`);
await import('./opy-preview-server.mjs');
