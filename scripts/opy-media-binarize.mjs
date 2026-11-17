#!/usr/bin/env node
// Converte anexos antigos (media-<id>.json com base64) para o formato binário novo (media-<id>.bin + media-<id>.type).
// Por padrão só ENSAIA (mostra o que faria). Com --apply grava o binário, confere byte a byte e só então apaga o .json daquele anexo.
// Uso:  node scripts/opy-media-binarize.mjs <pasta-de-dados> [--apply]
import { readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const [dir, flag] = process.argv.slice(2);
if (!dir) { console.error('Uso: node scripts/opy-media-binarize.mjs <pasta-de-dados> [--apply]'); process.exit(2); }
const apply = flag === '--apply';
let n = 0, saved = 0, failed = 0, skipped = 0;
for (const f of await readdir(dir)) {
  const m = /^media-([a-f0-9-]{36})\.json$/.exec(f); if (!m) continue;
  const base = join(dir, `media-${m[1]}`);
  try {
    const rawJson = await readFile(join(dir, f), 'utf8');
    const { type, bytes } = JSON.parse(rawJson);
    const buffer = Buffer.from(bytes, 'base64');
    saved += rawJson.length - buffer.length; n++;
    if (!apply) continue;
    const tmp = `${base}.${randomUUID()}.tmp`;
    await writeFile(tmp, buffer, { mode: 0o600 }); await rename(tmp, `${base}.bin`);
    await writeFile(tmp, type, { mode: 0o600 }); await rename(tmp, `${base}.type`);
    const check = await readFile(`${base}.bin`);
    if (!check.equals(buffer) || (await readFile(`${base}.type`, 'utf8')) !== type) { failed++; await unlink(`${base}.bin`); await unlink(`${base}.type`); console.error('conferência falhou:', m[1]); continue; }
    await unlink(join(dir, f));
  } catch (error) { failed++; console.error('erro em', f, error.message); skipped++; }
}
console.log(JSON.stringify({ modo: apply ? 'aplicado' : 'ensaio', anexos: n, bytesEconomizados: saved, falhas: failed }));
process.exit(failed ? 1 : 0);
