import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Transmissão ao vivo (Fase 4). O vídeo passa pelo MediaMTX (deploy/opy/mediamtx.yml); aqui ficam as regras:
// quem pode publicar e assistir, a publicação "ao vivo" no feed e a gravação que vira vídeo ao terminar.
export const liveActions = ['live_start', 'live_stop'];
const MAX_LIVE_MS = 6 * 60 * 60 * 1000;
const RECORDING_WAIT_MS = 2 * 60 * 1000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export const liveEnabled = (env = process.env) => !!env.OPY_LIVE_URL;
const active = p => !!p.live && !p.live.endedAt;
function end(post, now) { post.live.endedAt = now; delete post.live.key; }

// Encerra lives cujo aparelho sumiu sem avisar. Roda em toda escrita.
export function settleLives(state, now = Date.now()) {
  for (const p of state.posts || []) if (active(p) && now - p.live.startedAt > MAX_LIVE_MS) end(p, now);
}

export function liveAction(state, me, body, env = process.env, now = Date.now()) {
  if (!liveEnabled(env)) fail(503, 'A transmissão ao vivo ainda não está ativa neste servidor.');
  if (body.action === 'live_start') {
    if ((state.posts || []).some(p => p.authorId === me.id && active(p))) fail(409, 'Você já está ao vivo. Encerre a live atual antes de começar outra.');
    if (body.text !== undefined && (typeof body.text !== 'string' || body.text.length > 300)) fail(400, 'A descrição da live tem no máximo 300 caracteres.');
    const text = (body.text || '').trim();
    const post = { id: randomUUID(), authorId: me.id, author: me.name, text, origin: 'preview', createdAt: now, audience: 'public', communityId: '', communityName: '', feeling: '', location: '', reactions: {}, comments: [], saves: [], shares: 0, live: { key: randomBytes(24).toString('hex'), startedAt: now } };
    state.posts.unshift(post);
    const followers = Object.entries(state.follows || {}).filter(([, list]) => Array.isArray(list) && list.includes(`id:${me.id}`)).map(([id]) => id);
    return { postId: post.id, key: post.live.key, notify: followers, push: { title: `${me.name} está ao vivo`, body: text || 'Toque para assistir à transmissão.', href: `/#post-${post.id}`, tag: `live-${post.id}` } };
  }
  const post = (state.posts || []).find(p => p.id === body.postId && p.live);
  if (!post) fail(404, 'Live não encontrada.');
  if (post.authorId !== me.id) fail(403, 'Somente quem transmite pode encerrar a live.');
  if (active(post)) end(post, now);
  return { postId: post.id };
}

// Webhook do MediaMTX (authMethod: http). Publicar exige a chave da live (Authorization: Bearer); assistir exige live ativa.
export function liveAuth(state, body) {
  const post = uuid.test(body?.path || '') && (state.posts || []).find(p => p.id === body.path && p.live);
  if (!post || !active(post)) return false;
  if (body.action === 'publish') return typeof body.token === 'string' && body.token.length > 0 && body.token === post.live.key;
  return body.action === 'read';
}

export const projectLive = p => p.live ? { active: active(p), startedAt: p.live.startedAt, endedAt: p.live.endedAt || 0, recording: p.live.recording || '' } : null;

// Quando a live termina, o MediaMTX fecha o arquivo em /recordings/<postId>/; ele vira o vídeo da publicação.
// Procura por até 2 minutos depois do fim; sem arquivo (navegador sem H.264, queda antes do primeiro quadro) marca 'none'.
export async function attachRecordings(store, env = process.env, now = Date.now()) {
  const dir = env.OPY_LIVE_RECORDINGS_DIR;
  if (!dir) return;
  const { data } = await store.readState();
  const pending = (data.posts || []).filter(p => p.live?.endedAt && !p.live.recording);
  if (!pending.length) return;
  const found = new Map();
  for (const p of pending) {
    try { const files = (await readdir(join(dir, p.id))).filter(f => f.endsWith('.mp4')).sort(); if (files.length) found.set(p.id, files[0]); } catch {}
  }
  const giveUp = new Set(pending.filter(p => !found.has(p.id) && now - p.live.endedAt > RECORDING_WAIT_MS).map(p => p.id));
  if (!found.size && !giveUp.size) return;
  await store.transact(state => {
    for (const p of state.posts || []) {
      if (!p.live) continue;
      if (found.has(p.id)) { p.media = { url: `/live/recordings/${p.id}/${found.get(p.id)}`, kind: 'video', name: 'live.mp4' }; p.live.recording = 'ok'; }
      else if (giveUp.has(p.id)) p.live.recording = 'none';
    }
  });
}

// Arquivo de gravação de uma publicação visível: só o caminho gravado na própria publicação é servido (sem travessia de pastas).
export async function recordingFile(post, pathname, env = process.env) {
  if (!env.OPY_LIVE_RECORDINGS_DIR || !post?.media?.url || post.media.url !== pathname) return null;
  const file = join(env.OPY_LIVE_RECORDINGS_DIR, pathname.slice('/live/recordings/'.length));
  try { const info = await stat(file); return info.isFile() ? { file, info } : null; } catch { return null; }
}
