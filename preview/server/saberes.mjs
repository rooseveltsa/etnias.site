// Saberes: trilhas de conhecimento com aulas em ordem. Conhecimento tradicional: só a equipe (admin ou moderador)
// publica, edita e remove; qualquer pessoa da rede acompanha as trilhas e marca as aulas concluídas (progresso por conta).
import { randomUUID } from 'node:crypto';

export const saberesActions = ['trilha_save', 'trilha_delete', 'trilha_start', 'trilha_lesson'];
const MAX_TRILHAS = 200, MAX_LESSONS = 30;
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max, label, required = true) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (typeof value !== 'string' && value != null) fail(400, `Confira o campo ${label}.`);
  if (required && !v) fail(400, `Preencha o campo ${label}.`);
  if (v.length > max) fail(400, `O campo ${label} aceita até ${max} caracteres.`);
  return v;
}
// Mesmas regras do cartão de YouTube do feed: youtu.be, youtube.com (watch, shorts, embed, live) e youtube-nocookie.
export function youtubeIdOf(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let u; try { u = new URL(raw); } catch { fail(400, 'Cole o link completo do vídeo no YouTube.'); }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') { id = u.searchParams.get('v') || ''; const parts = u.pathname.split('/').filter(Boolean); if (!id && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) id = parts[1] || ''; }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) fail(400, 'O vídeo da aula precisa ser um link do YouTube.');
  return id;
}
const isStaff = me => me.role === 'admin' || me.role === 'moderator';
const listOf = state => (state.trilhas ||= []);
const progressOf = (state, me, id) => state.trilhaProgress?.[me.id]?.[id] || null;
function findTrilha(state, id) {
  const t = typeof id === 'string' && listOf(state).find(x => x.id === id);
  if (!t) fail(404, 'Trilha não encontrada.');
  return t;
}
function lessonsOf(value, previous = []) {
  if (!Array.isArray(value) || !value.length) fail(400, 'Adicione pelo menos uma aula à trilha.');
  if (value.length > MAX_LESSONS) fail(400, `Uma trilha tem até ${MAX_LESSONS} aulas.`);
  const known = new Set(previous.map(l => l.id));
  return value.map((l, i) => {
    if (!l || typeof l !== 'object') fail(400, 'Confira as aulas da trilha.');
    const n = i + 1;
    return { id: typeof l.id === 'string' && known.has(l.id) ? l.id : randomUUID(), title: text(l.title, 120, `título da aula ${n}`), text: text(l.text ?? '', 8000, `texto da aula ${n}`, false), youtube: youtubeIdOf(l.video) };
  });
}
// Progresso só conta aulas que ainda existem (a equipe pode ter editado a trilha).
function project(t, me, state, full) {
  const p = progressOf(state, me, t.id), ids = new Set(t.lessons.map(l => l.id));
  const done = (p?.done || []).filter(id => ids.has(id));
  const next = t.lessons.find(l => !done.includes(l.id));
  const base = { id: t.id, title: t.title, summary: t.summary, povo: t.povo, cover: t.cover ? `/api/media?id=${t.cover.id}` : '', lessonsCount: t.lessons.length, doneCount: done.length, started: !!p, nextLessonId: (p?.last && ids.has(p.last) && !done.includes(p.last) ? p.last : next?.id) || '', updatedAt: t.updatedAt };
  if (!full) return base;
  return { ...base, author: t.author, lessons: t.lessons.map(l => ({ id: l.id, title: l.title, text: l.text, youtube: l.youtube, video: l.youtube ? `https://www.youtube.com/watch?v=${l.youtube}` : '', done: done.includes(l.id) })) };
}
export function saberesView(state, me, params) {
  const id = String(params.get('id') || '');
  if (id) return { staff: isStaff(me), trilha: project(findTrilha(state, id), me, state, true) };
  return { staff: isStaff(me), trilhas: listOf(state).map(t => project(t, me, state, false)) };
}
// Capa de trilha é visível para quem está na rede, como as fotos de perfil.
export const saberMedia = (state, id) => listOf(state).find(t => t.cover?.id === id)?.cover || null;

// upload: capa nova já validada e salva por community.mjs. Devolve o id para a resposta e as mídias a apagar.
export function saberesAction(state, me, body, upload) {
  const removedIds = [];
  if (body.action === 'trilha_save' || body.action === 'trilha_delete') {
    if (!isStaff(me)) fail(403, 'Somente a equipe do Etnias publica e edita trilhas de saberes.');
  }
  if (body.action === 'trilha_save') {
    const editing = body.id ? findTrilha(state, body.id) : null;
    if (!editing && listOf(state).length >= MAX_TRILHAS) fail(409, 'Limite de trilhas atingido neste servidor.');
    const fields = { title: text(body.title, 120, 'título'), summary: text(body.summary, 600, 'resumo'), povo: text(body.povo ?? '', 80, 'povo ou tema', false), lessons: lessonsOf(body.lessons, editing?.lessons) };
    const now = Date.now();
    if (editing) {
      // cover: undefined mantém, null remove, arquivo novo troca.
      if (upload || body.cover === null) { if (editing.cover) removedIds.push(editing.cover.id); delete editing.cover; }
      Object.assign(editing, fields, { updatedAt: now }, upload ? { cover: { id: upload.id, kind: upload.kind, name: upload.name } } : {});
      return { id: editing.id, removedIds };
    }
    const t = { id: randomUUID(), ...fields, authorId: me.id, author: me.name, createdAt: now, updatedAt: now, ...(upload ? { cover: { id: upload.id, kind: upload.kind, name: upload.name } } : {}) };
    listOf(state).unshift(t);
    return { id: t.id, removedIds };
  }
  const t = findTrilha(state, body.id);
  if (body.action === 'trilha_delete') {
    state.trilhas = listOf(state).filter(x => x !== t);
    for (const p of Object.values(state.trilhaProgress || {})) delete p[t.id];
    if (t.cover) removedIds.push(t.cover.id);
    return { id: '', removedIds };
  }
  state.trilhaProgress ||= {};
  const mine = (state.trilhaProgress[me.id] ||= {});
  const p = (mine[t.id] ||= { startedAt: Date.now(), done: [], last: t.lessons[0]?.id || '' });
  if (body.action === 'trilha_lesson') {
    const lesson = t.lessons.find(l => l.id === body.lessonId);
    if (!lesson) fail(404, 'Aula não encontrada.');
    if (typeof body.done !== 'boolean') fail(400, 'Informe se a aula foi concluída.');
    p.done = body.done ? [...new Set([...p.done, lesson.id])] : p.done.filter(id => id !== lesson.id);
    p.last = lesson.id;
  }
  return { id: t.id, removedIds };
}
