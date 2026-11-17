#!/usr/bin/env node
// S-05: ensaio (dry-run) da migração do community.json para SQLite. NÃO altera o banco de produção: lê um community.json (de preferência uma
// CÓPIA), grava um arquivo .sqlite à parte e confere que dá para reconstruir exatamente o mesmo JSON a partir dele.
//
// Uso:  node scripts/opy-migrar-sqlite.mjs <community.json> [saida.sqlite]
// Desenho (um passo seguro, sem reescrever o app): coleções grandes (contas, publicações, mensagens, ligações) viram uma tabela com
// uma linha por item (JSON do item + colunas de busca); o resto fica em kv(chave, json). Ordem dos itens e das chaves é preservada,
// então reconstruir = ler as tabelas na ordem. Um app futuro pode então gravar só as linhas que mudaram, em vez de 11 MB por ação.
import { readFile, stat, rm } from 'node:fs/promises';

let DatabaseSync;
try { ({ DatabaseSync } = await import('node:sqlite')); }
catch { console.error('Este Node não tem node:sqlite (precisa do Node 22.13 ou mais novo, ou 22.5+ com --experimental-sqlite).'); process.exit(2); }

export const COLLECTIONS = {
  accounts: { table: 'accounts', cols: { id: i => i.id, username: i => i.username ?? null } },
  posts: { table: 'posts', cols: { id: i => i.id, author_id: i => i.authorId ?? null, created_at: i => i.createdAt ?? null } },
  dms: { table: 'dms', cols: { id: i => i.id, from_key: i => i.fromKey ?? null, to_key: i => i.toKey ?? null, created_at: i => i.createdAt ?? null } },
  stories: { table: 'stories', cols: { id: i => i.id, author_id: i => i.authorId ?? null } },
  communities: { table: 'communities', cols: { id: i => i.id } },
  market: { table: 'market', cols: { id: i => i.id, seller_id: i => i.sellerId ?? null } }
};

export function migrate(data, db) {
  db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');
  db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, json TEXT NOT NULL, pos INTEGER NOT NULL)');
  for (const { table, cols } of Object.values(COLLECTIONS)) {
    db.exec(`CREATE TABLE ${table} (pos INTEGER PRIMARY KEY, ${Object.keys(cols).map(c => c + ' TEXT').join(', ')}, json TEXT NOT NULL)`);
    db.exec(`CREATE INDEX ${table}_id ON ${table}(id)`);
  }
  db.exec('BEGIN');
  let keyPos = 0;
  const counts = {};
  const putKv = db.prepare('INSERT INTO kv (key, json, pos) VALUES (?, ?, ?)');
  for (const [key, value] of Object.entries(data)) {
    const spec = COLLECTIONS[key];
    if (spec && Array.isArray(value)) {
      const names = Object.keys(spec.cols);
      const insert = db.prepare(`INSERT INTO ${spec.table} (pos, ${names.join(', ')}, json) VALUES (?, ${names.map(() => '?').join(', ')}, ?)`);
      value.forEach((item, pos) => insert.run(pos, ...names.map(n => { const v = spec.cols[n](item); return v == null ? null : String(v); }), JSON.stringify(item)));
      putKv.run(`__collection:${key}`, JSON.stringify({ n: value.length }), keyPos++);
      counts[key] = value.length;
    } else { putKv.run(key, JSON.stringify(value), keyPos++); counts[key] = Array.isArray(value) ? value.length : typeof value === 'object' && value ? Object.keys(value).length : 1; }
  }
  db.exec('COMMIT');
  return counts;
}

export function rebuild(db) {
  const out = {};
  for (const row of db.prepare('SELECT key, json FROM kv ORDER BY pos').all()) {
    const m = /^__collection:(.+)$/.exec(row.key);
    if (m) out[m[1]] = db.prepare(`SELECT json FROM ${COLLECTIONS[m[1]].table} ORDER BY pos`).all().map(r => JSON.parse(r.json));
    else out[row.key] = JSON.parse(row.json);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, target = `${process.env.TMPDIR || '/tmp'}/opy-dryrun-${Date.now()}.sqlite`] = process.argv.slice(2);
  if (!source) { console.error('Uso: node scripts/opy-migrar-sqlite.mjs <community.json> [saida.sqlite]'); process.exit(2); }
  const t0 = Date.now();
  const raw = await readFile(source, 'utf8');
  const data = JSON.parse(raw);
  await rm(target, { force: true });
  const db = new DatabaseSync(target);
  const counts = migrate(data, db);
  const t1 = Date.now();
  const back = rebuild(db);
  const t2 = Date.now();
  const same = JSON.stringify(back) === JSON.stringify(data);
  const integrity = db.prepare('PRAGMA integrity_check').get();
  db.close();
  const size = (await stat(target)).size;
  console.log(JSON.stringify({ origem: source, bytesOrigem: raw.length, sqlite: target, bytesSqlite: size, migrarMs: t1 - t0, reconstruirMs: t2 - t1, idêntico: same, integrity: Object.values(integrity)[0], itens: counts }, null, 2));
  process.exit(same ? 0 : 1);
}
