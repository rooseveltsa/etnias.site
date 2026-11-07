import test from 'node:test';
import assert from 'node:assert/strict';
import * as i18n from '../../preview/server/i18n.mjs';

const env = { OPY_ADMIN_USERNAMES: 'chefe' };
const boss = { id: 'b1', name: 'Chefe', username: 'chefe' };
const ana = { id: 'a1', name: 'Ana', username: 'ana' };
const beto = { id: 'c1', name: 'Beto', username: 'beto' };
const fresh = () => ({ accounts: [structuredClone(boss), structuredClone(ana), structuredClone(beto)] });
const acc = (s, a) => s.accounts.find(x => x.id === a.id);
const act = (s, who, body) => i18n.i18nAction(s, acc(s, who), body, env, 1000);
const rejects = (fn, code) => assert.throws(fn, e => e.status === code);
const source = i18n.sourceStrings();

test('idiomas: base, referência e língua da comunidade só aparece depois de ativada', () => {
  const s = fresh();
  assert.ok(source.length > 100, 'catálogo de origem carregado');
  assert.deepEqual(i18n.languagesOf(s).map(l => l.code), ['pt-BR', 'en', 'es']);
  rejects(() => act(s, ana, { action: 'i18n_lang_add', code: 'gn', name: 'Guarani' }), 403);
  rejects(() => act(s, boss, { action: 'i18n_lang_add', code: 'Guarani!', name: 'Guarani' }), 400);
  act(s, boss, { action: 'i18n_lang_add', code: 'gn', name: 'Guarani' });
  rejects(() => act(s, boss, { action: 'i18n_lang_add', code: 'gn', name: 'Outro' }), 409);
  rejects(() => act(s, ana, { action: 'set_locale', locale: 'gn' }), 400);
  act(s, boss, { action: 'i18n_lang_toggle', code: 'gn', enabled: true });
  act(s, ana, { action: 'set_locale', locale: 'gn' });
  assert.equal(i18n.i18nFor(s, acc(s, ana)).locale, 'gn');
  act(s, ana, { action: 'set_locale', locale: 'pt-BR' });
  assert.equal(acc(s, ana).locale, 'pt-BR', 'escolha explícita do português fica salva');
  assert.equal(i18n.i18nFor(s, acc(s, beto)).locale, null, 'sem escolha, o navegador decide');
});

test('tradutores sugerem, gestão aprova e a tradução chega a quem usa o idioma', () => {
  const s = fresh();
  act(s, boss, { action: 'i18n_lang_add', code: 'gn', name: 'Guarani' });
  act(s, boss, { action: 'i18n_lang_toggle', code: 'gn', enabled: true });
  const phrase = source.find(x => !/\{\d\}/.test(x));
  rejects(() => act(s, ana, { action: 'i18n_suggest', lang: 'gn', source: phrase, text: 'x' }), 403);
  rejects(() => i18n.i18nView(s, acc(s, ana), env), 403);
  act(s, boss, { action: 'i18n_translator', userKey: 'id:a1', langs: ['gn'] });
  rejects(() => act(s, ana, { action: 'i18n_suggest', lang: 'gn', source: 'texto inventado', text: 'x' }), 400);
  act(s, ana, { action: 'i18n_suggest', lang: 'gn', source: phrase, text: 'Primeira' });
  act(s, ana, { action: 'i18n_suggest', lang: 'gn', source: phrase, text: 'Revisada' });
  const view = i18n.i18nView(s, acc(s, ana), env);
  assert.deepEqual(view.languages.map(l => l.code), ['gn'], 'tradutor vê só o seu idioma');
  assert.equal(view.suggestions.length, 1, 'nova sugestão substitui a anterior da mesma pessoa');
  rejects(() => act(s, ana, { action: 'i18n_review', id: view.suggestions[0].id, decision: 'aprovar' }), 403);
  act(s, boss, { action: 'i18n_review', id: view.suggestions[0].id, decision: 'aprovar' });
  act(s, beto, { action: 'set_locale', locale: 'gn' });
  assert.equal(i18n.i18nFor(s, acc(s, beto)).overrides[phrase], 'Revisada');
  assert.equal(i18n.i18nView(s, acc(s, boss), env).languages.find(l => l.code === 'gn').done, 1);
});

test('marcadores {0} precisam ser mantidos', () => {
  const s = fresh();
  const withPh = source.find(x => /\{0\}/.test(x));
  assert.ok(withPh);
  rejects(() => act(s, boss, { action: 'i18n_suggest', lang: 'en', source: withPh, text: 'sem marcador' }), 400);
  act(s, boss, { action: 'i18n_suggest', lang: 'en', source: withPh, text: withPh });
});
