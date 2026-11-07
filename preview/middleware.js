import { verifySession } from './server/session.mjs';

/**
 * Casa Opy opens on the welcome screen. A signed account cookie may open the app.
 * Creating an account and signing in happen on /api/community. There is no shared browser password.
 */
export const config = { matcher: '/:path*' };

function isPublic(pathname) {
  return pathname === '/entrar' || pathname.startsWith('/entrar/')
    || pathname === '/assets' || pathname.startsWith('/assets/')
    || pathname === '/api' || pathname.startsWith('/api/')
    || pathname === '/manifest.webmanifest' || pathname === '/sw.js';
}

function safeNext(pathname, search) {
  const value = pathname + search;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) return '/';
  return value;
}

function cookieValue(request) {
  const header = request.headers.get('cookie') || '';
  const part = header.split(';').map(item => item.trim()).find(item => item.startsWith('opy_visitor='));
  return part ? part.slice('opy_visitor='.length) : '';
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (isPublic(url.pathname)) return;
  const secret = process.env.OPY_SESSION_SECRET || '';
  if (secret.length >= 32 && await verifySession(cookieValue(request), secret)) return;
  const dest = new URL('/entrar/', url);
  const next = safeNext(url.pathname, url.search);
  if (next !== '/') dest.searchParams.set('next', next);
  return Response.redirect(dest, 307);
}
