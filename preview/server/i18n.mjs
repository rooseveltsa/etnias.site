// Ecossistema de traduções: idiomas de referência (catálogos no repositório), línguas cadastradas pela gestão
// e traduções sugeridas por tradutores das comunidades, aprovadas pela administração ou moderação.
import { readFileSync } from 'node:fs';
import { roleOf } from './admin.mjs';

export const i18nActions = ['set_locale', 'i18n_lang_add', 'i18n_lang_toggle', 'i18n_translator', 'i18n_suggest', 'i18n_review'];
export const BASE = 'pt-BR';
// Catálogos completos mantidos no repositório (preview/i18n/<code>.json); as aprovações da comunidade se sobrepõem a eles.
export const REFERENCE = [{ code: 'en', name: 'English' }, { code: 'es', name: 'Español' }];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const keyOf = a => `id:${a.id}`;
let sourceCache;
export function sourceStrings() {
  if (!sourceCache) {
    try { sourceCache = JSON.parse(readFileSync(new URL('../i18n/source.json', import.meta.url), 'utf8')); }
    catch { sourceCache = []; }
  }
  return sourceCache;
}
const refCache = {};
function referenceCatalog(code) {
  if (!(code in refCache)) {
    try { refCache[code] = JSON.parse(readFileSync(new URL(`../i18n/${code}.json`, import.meta.url), 'utf8')); }
    catch { refCache[code] = {}; }
  }
  return refCache[code];
}
const placeholders = s => (s.match(/\{\d+\}/g) || []).sort().join();

function i18nState(state) {
  state.i18n ||= {};
  state.i18n.languages ||= [];
  state.i18n.translators ||= {};
  state.i18n.suggestions ||= [];
  state.i18n.approved ||= {};
  return state.i18n;
}
/** Idiomas disponíveis para escolha: base, referência e línguas da comunidade ativadas. */
export function languagesOf(state, includeDisabled = false) {
  const custom = (state.i18n?.languages || []).filter(l => includeDisabled || l.enabled);
  return [{ code: BASE, name: 'Português', kind: 'base', enabled: true }, ...REFERENCE.map(l => ({ ...l, kind: 'reference', enabled: true })), ...custom.map(l => ({ ...l, kind: 'community' }))];
}
/** Bloco do snapshot: idioma da pessoa, lista para o seletor e traduções aprovadas pela comunidade. */
export function i18nFor(state, account) {
  const locale = account?.locale || null;
  return { locale, languages: languagesOf(state).map(({ code, name }) => ({ code, name })), overrides: (locale && state.i18n?.approved?.[locale]) || {}, translates: state.i18n?.translators?.[account?.id] || [] };
}
const canTranslate = (state, actor, lang, env) => !!roleOf(actor, env) || (state.i18n?.translators?.[actor.id] || []).includes(lang);

export function i18nAction(state, actor, body, env = process.env, now = Date.now()) {
  const i18n = i18nState(state);
  const role = roleOf(actor, env);
  const known = code => languagesOf(state, true).some(l => l.code === code);
  if (body.action === 'set_locale') {
    const code = String(body.locale || '');
    if (!languagesOf(state).some(l => l.code === code)) fail(400, 'Idioma indisponível.');
    actor.locale = code;
    return {};
  }
  if (body.action === 'i18n_lang_add') {
    if (role !== 'admin') fail(403, 'Só administradores podem cadastrar idiomas.');
    const code = String(body.code || '').trim();
    const name = String(body.name || '').trim().slice(0, 40);
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(code)) fail(400, 'Use um código de idioma como "gn", "yrl" ou "tpw-BR".');
    if (name.length < 2) fail(400, 'Informe o nome do idioma.');
    if (known(code)) fail(409, 'Esse idioma já existe.');
    i18n.languages.push({ code, name, enabled: false, createdAt: now, by: keyOf(actor) });
    return {};
  }
  if (body.action === 'i18n_lang_toggle') {
    if (role !== 'admin') fail(403, 'Só administradores podem ativar idiomas.');
    const lang = i18n.languages.find(l => l.code === body.code); if (!lang) fail(404, 'Idioma não encontrado.');
    lang.enabled = !!body.enabled;
    return {};
  }
  if (body.action === 'i18n_translator') {
    if (role !== 'admin') fail(403, 'Só administradores nomeiam tradutores.');
    const target = (state.accounts || []).find(a => keyOf(a) === body.userKey); if (!target) fail(404, 'Pessoa não encontrada.');
    const langs = [...new Set((Array.isArray(body.langs) ? body.langs : []).map(String))];
    if (langs.some(c => c === BASE || !known(c))) fail(400, 'Escolha idiomas cadastrados.');
    if (langs.length) i18n.translators[target.id] = langs; else delete i18n.translators[target.id];
    return {};
  }
  if (body.action === 'i18n_suggest') {
    const lang = String(body.lang || '');
    if (lang === BASE || !known(lang)) fail(400, 'Escolha um idioma cadastrado.');
    if (!canTranslate(state, actor, lang, env)) fail(403, 'Você não está entre os tradutores deste idioma.');
    const source = String(body.source || '');
    if (!sourceStrings().includes(source)) fail(400, 'Esse texto não faz parte da interface.');
    const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!text) fail(400, 'Escreva a tradução.');
    if (placeholders(text) !== placeholders(source)) fail(400, 'Mantenha os marcadores como {0} da frase original.');
    // Uma sugestão pendente por pessoa, frase e idioma: a nova substitui a anterior.
    i18n.suggestions = i18n.suggestions.filter(s => !(s.status === 'pendente' && s.lang === lang && s.source === source && s.by === keyOf(actor)));
    i18n.suggestions.push({ id: `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`, lang, source, text, by: keyOf(actor), byName: actor.name, at: now, status: 'pendente' });
    if (i18n.suggestions.length > 5000) i18n.suggestions = i18n.suggestions.filter(s => s.status === 'pendente').concat(i18n.suggestions.filter(s => s.status !== 'pendente').slice(-2000));
    return {};
  }
  if (body.action === 'i18n_review') {
    if (!role) fail(403, 'Só a gestão aprova traduções.');
    const s = i18n.suggestions.find(x => x.id === body.id && x.status === 'pendente'); if (!s) fail(404, 'Sugestão não encontrada.');
    if (body.decision === 'aprovar') {
      s.status = 'aprovada';
      (i18n.approved[s.lang] ||= {})[s.source] = s.text;
      // As outras sugestões pendentes para a mesma frase ficam superadas.
      for (const o of i18n.suggestions) if (o !== s && o.status === 'pendente' && o.lang === s.lang && o.source === s.source) o.status = 'superada';
    } else if (body.decision === 'recusar') s.status = 'recusada';
    else fail(400, 'Escolha aprovar ou recusar.');
    s.reviewedBy = actor.name; s.reviewedAt = now;
    return {};
  }
  fail(400, 'Ação de tradução desconhecida.');
}

/** Painel de traduções: idiomas com progresso, frases, sugestões e tradutores. Gestão vê tudo; tradutores, os seus idiomas. */
export function i18nView(state, viewer, env = process.env) {
  const role = roleOf(viewer, env);
  const mine = state.i18n?.translators?.[viewer.id] || [];
  if (!role && !mine.length) fail(403, 'O painel de traduções é para a gestão e para quem traduz.');
  const source = sourceStrings();
  const approved = state.i18n?.approved || {};
  const languages = languagesOf(state, true).filter(l => l.code !== BASE && (role || mine.includes(l.code))).map(l => {
    const ref = l.kind === 'reference' ? referenceCatalog(l.code) : {};
    const done = source.filter(s => approved[l.code]?.[s] || ref[s]).length;
    return { code: l.code, name: l.name, kind: l.kind, enabled: l.enabled, done, total: source.length };
  });
  const codes = new Set(languages.map(l => l.code));
  const suggestions = (state.i18n?.suggestions || []).filter(s => codes.has(s.lang)).slice(-500).reverse();
  const translations = Object.fromEntries(languages.map(l => [l.code, { ...(l.kind === 'reference' ? referenceCatalog(l.code) : {}), ...(approved[l.code] || {}) }]));
  const translators = role ? Object.entries(state.i18n?.translators || {}).map(([id, langs]) => {
    const a = (state.accounts || []).find(x => x.id === id);
    return a ? { key: keyOf(a), name: a.name, username: a.username, langs } : null;
  }).filter(Boolean) : [];
  return { role: role || 'translator', canManage: role === 'admin', canReview: !!role, languages, source, translations, suggestions, translators };
}
