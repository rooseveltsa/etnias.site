// Tradução da interface: o português do código é a chave; catálogos em /assets/i18n/<idioma>.json
// e traduções aprovadas pela comunidade (vindas do servidor) traduzem o DOM, inclusive o que é criado depois.
(() => {
  const BASE = 'pt-BR', STORE = 'opy-locale', REFERENCE = ['en', 'es'];
  const SKIP = '.post-copy,.community-post-text,.story-card-text,.chat-bubble,[data-no-i18n],script,style';
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const read = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
  const guess = () => { const n = (navigator.language || '').toLowerCase(); return REFERENCE.find(c => n.startsWith(c)) || BASE; };
  let locale = read(STORE) || guess();
  let dict = {}, patterns = [], ready = false;
  let languages = [{ code: BASE, name: 'Português' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' }];

  const escape = s => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  function compile() {
    patterns = Object.keys(dict).filter(k => /\{\d+\}/.test(k)).map(k => {
      const order = [];
      const re = new RegExp('^' + escape(k).replace(/\\\{(\d+)\\\}/g, (_, n) => { order.push(n); return '(.+?)'; }) + '$');
      return { re, order, to: dict[k] };
    });
  }
  function t(text) {
    if (!text || locale === BASE) return text;
    const core = text.trim(); if (!core) return text;
    let out = dict[core];
    if (out === undefined) {
      for (const p of patterns) { const m = core.match(p.re); if (m) { out = p.to.replace(/\{(\d+)\}/g, (_, n) => m[p.order.indexOf(n) + 1] ?? ''); break; } }
    }
    return out === undefined || out === core ? text : text.replace(core, out);
  }
  const skipped = el => !el || el.closest(SKIP);
  function translateAttrs(el) { for (const a of ATTRS) { const old = el.getAttribute(a); if (old) { const v = t(old); if (v !== old) el.setAttribute(a, v); } } }
  function translate(root) {
    if (locale === BASE || !ready || !root) return;
    if (root.nodeType === 3) { if (!skipped(root.parentElement)) { const v = t(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; } return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let n = walker.currentNode; n; n = walker.nextNode()) {
      if (n.nodeType === 3) { const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
      else translateAttrs(n);
    }
  }
  const observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') translate(m.target);
      else if (m.type === 'attributes') { if (ready && locale !== BASE && !skipped(m.target)) translateAttrs(m.target); }
      else m.addedNodes.forEach(translate);
    }
  });
  async function load() {
    let base = {};
    if (REFERENCE.includes(locale)) {
      try { const r = await fetch(`/assets/i18n/${locale}.json?v=${document.documentElement.dataset.i18nVersion || ''}`); if (r.ok) base = await r.json(); } catch {}
    }
    dict = { ...base, ...dict }; compile(); ready = true;
    document.documentElement.lang = locale;
    translate(document.body);
    document.documentElement.classList.remove('i18n-pending');
  }
  function picker() {
    const label = document.createElement('label'); label.className = 'opy-locale'; label.dataset.noI18n = '';
    const icon = document.createElement('span'); icon.textContent = '🌐'; icon.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Idioma · Language');
    for (const l of languages) { const o = new Option(l.name, l.code); o.selected = l.code === locale; select.append(o); }
    select.onchange = () => setLocale(select.value);
    label.append(icon, select); return label;
  }
  function mountPickers() {
    document.querySelectorAll('.opy-locale').forEach(el => el.remove());
    for (const host of document.querySelectorAll('.welcome-panel, .opy-sidebar, .pf-account')) host.append(picker());
  }
  async function setLocale(code) {
    write(STORE, code);
    try { sessionStorage.setItem('opy-locale-sync', code); } catch {}
    if (window.OpyI18n.signedIn) {
      try { await fetch('/api/community', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_locale', locale: code }) }); } catch {}
    }
    location.reload();
  }
  window.OpyI18n = {
    t, signedIn: false,
    // Chamado pelo preview.js a cada snapshot: alinha o idioma da conta, a lista de idiomas e as traduções aprovadas.
    sync(info) {
      if (!info) return;
      this.signedIn = true;
      const server = info.locale;
      // Conta sem idioma escolhido herda o deste navegador (inclusive o detectado automaticamente).
      if (!server) { if (locale !== BASE) fetch('/api/community', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_locale', locale }) }).catch(() => {}); }
      else if (server !== locale) {
        let tried = ''; try { tried = sessionStorage.getItem('opy-locale-sync') || ''; } catch {}
        // Primeira vez nesta aba: o idioma salvo na conta vence. Se a pessoa acabou de trocar aqui, a escolha local vence.
        if (tried !== locale) { try { sessionStorage.setItem('opy-locale-sync', server); } catch {} write(STORE, server); location.reload(); return; }
      }
      if (JSON.stringify(info.languages) !== JSON.stringify(languages)) { languages = info.languages || languages; mountPickers(); }
      const overrides = info.overrides || {};
      if (Object.keys(overrides).some(k => dict[k] !== overrides[k])) { Object.assign(dict, overrides); compile(); translate(document.body); }
    }
  };
  if (locale !== BASE) {
    document.documentElement.classList.add('i18n-pending');
    setTimeout(() => document.documentElement.classList.remove('i18n-pending'), 1500);
  }
  const start = () => {
    mountPickers();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    load();
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();
