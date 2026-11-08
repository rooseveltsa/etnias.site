import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createLocalStore(directory, initialState) {
  let pending = Promise.resolve();
  const statePath = join(directory, 'community.json');
  // Estado em memória: um único processo serve tudo, então ler o arquivo a cada requisição só custaria
  // o parse de vários MB. O arquivo é a persistência; uma falha no update invalida o cache para reler do disco.
  let cache = null;
  async function readState() {
    if (cache) return { data: cache, etag: null };
    try { cache = JSON.parse(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') cache = initialState(); else throw error; }
    return { data: cache, etag: null };
  }
  async function atomicWrite(path, value) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path + '.' + randomUUID() + '.tmp';
    try { await writeFile(temporary, value, { mode: 0o600 }); await rename(temporary, path); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  function transact(update) {
    // shortcut: um processo local serializa as escritas; usar banco para múltiplos servidores.
    const operation = pending.then(async () => {
      const { data } = await readState();
      let result;
      try { result = update(data); await atomicWrite(statePath, JSON.stringify(data)); }
      catch (error) { cache = null; throw error; }
      return { data, result };
    });
    pending = operation.catch(() => {});
    return operation;
  }
  function mediaPath(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identificador de anexo inválido.');
    return join(directory, 'media-' + id + '.json');
  }
  async function saveMedia(id, bytes, type) { await atomicWrite(mediaPath(id), JSON.stringify({ type, bytes: bytes.toString('base64') })); }
  async function readMedia(id) {
    try {
      const value = JSON.parse(await readFile(mediaPath(id), 'utf8'));
      return { statusCode: 200, blob: { contentType: value.type }, stream: new Blob([Buffer.from(value.bytes, 'base64')]).stream() };
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function deleteMedia(id) { await unlink(mediaPath(id)).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return { readState, transact, saveMedia, readMedia, deleteMedia };
}
