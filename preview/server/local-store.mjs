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
  // Anexos novos ficam em binário (arquivo .bin + tipo no .type): sem os 33% extras do base64 e sem decodificar JSON a cada leitura.
  // Os antigos (media-<id>.json com base64) continuam sendo lidos; scripts/opy-media-binarize.mjs converte quando quiser.
  const binPath = id => mediaPath(id).replace(/\.json$/, '.bin');
  const typePath = id => mediaPath(id).replace(/\.json$/, '.type');
  async function saveMedia(id, bytes, type) {
    await atomicWrite(binPath(id), bytes); await atomicWrite(typePath(id), type);
    await unlink(mediaPath(id)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    forget(id);
  }
  // Cada anexo fica em disco como JSON com base64: ler e decodificar um vídeo de 40 MB a cada pedido de trecho (Range) seria lento.
  // Os últimos anexos lidos ficam decodificados em memória (até ~96 MB no total) e os pedidos seguintes saem daí.
  const recent = new Map(); let recentBytes = 0;
  const RECENT_LIMIT = 96 * 1024 * 1024;
  function remember(id, value) {
    if (value.buffer.length > RECENT_LIMIT / 2) return;
    recent.set(id, value); recentBytes += value.buffer.length;
    while (recentBytes > RECENT_LIMIT) { const [oldest, old] = recent.entries().next().value; recent.delete(oldest); recentBytes -= old.buffer.length; }
  }
  async function readMedia(id) {
    const hit = recent.get(id);
    if (hit) { recent.delete(id); recent.set(id, hit); return { statusCode: 200, blob: { contentType: hit.type }, buffer: hit.buffer, stream: new Blob([hit.buffer]).stream() }; }
    try {
      let buffer, type;
      try { [buffer, type] = [await readFile(binPath(id)), (await readFile(typePath(id), 'utf8')).trim()]; }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const value = JSON.parse(await readFile(mediaPath(id), 'utf8'));
        buffer = Buffer.from(value.bytes, 'base64'); type = value.type;
      }
      remember(id, { type, buffer });
      return { statusCode: 200, blob: { contentType: type }, buffer, stream: new Blob([buffer]).stream() };
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  function forget(id) { const hit = recent.get(id); if (hit) { recent.delete(id); recentBytes -= hit.buffer.length; } }
  async function deleteMedia(id) {
    forget(id);
    for (const path of [mediaPath(id), binPath(id), typePath(id)]) await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  return { readState, transact, saveMedia, readMedia, deleteMedia };
}
