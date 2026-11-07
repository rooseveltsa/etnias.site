async function registerAccount(base, profile = {}) {
  const username = profile.username || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  const password = profile.password || 'Opy-previa-2026';
  const name = profile.name || 'Parente Teste';
  const googleKey = profile.googleKey || (username + '@gmail.com');
  const phone = profile.phone || ('119' + Math.floor(Math.random() * 1e8).toString().padStart(8, '0'));
  const response = await fetch(base + '/api/community', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ action: 'register', name, username, password, googleKey, phone })
  });
  const data = await response.json().catch(() => ({}));
  const pair = (response.headers.get('set-cookie') || '').split(';')[0];
  const split = pair.indexOf('=');
  return { status: response.status, data, username, password, name, cookie: pair, cookieName: pair.slice(0, split), cookieValue: pair.slice(split + 1) };
}

async function signIn(context, base) {
  const account = await registerAccount(base);
  if (account.status !== 200) throw new Error(account.data.error || `cadastro recusado (${account.status})`);
  await context.addCookies([{ name: account.cookieName, value: account.cookieValue, url: base }]);
  return account;
}

module.exports = { registerAccount, signIn };
