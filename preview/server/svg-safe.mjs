// Sanitização de SVG enviado pelo painel admin (ícones de reação e figurinhas).
// Lista de permissões: só desenho. Sem script, estilo, imagem externa, referência a outro arquivo ou evento.
// O SVG é guardado já limpo e ainda é servido com CSP "sandbox", como segunda camada.
const ELEMENTS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'title', 'desc']);
const ATTRS = new Set(['viewbox', 'width', 'height', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fill', 'fill-rule', 'fill-opacity', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'transform', 'points', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform', 'fx', 'fy', 'id', 'clip-path', 'preserveaspectratio', 'xmlns', 'version', 'role', 'aria-label']);
const MAX_BYTES = 100 * 1024;
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const esc = v => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function cleanValue(name, value) {
  if (value.length > 4000) fail('SVG com atributo grande demais.');
  if (/[&<>]|\\|javascript|expression|data:|@import|script/i.test(value)) fail('O SVG tem conteúdo não permitido (' + name + ').');
  if (/url\(/i.test(value) && !/^url\(#[\w-]+\)$/.test(value.trim())) fail('O SVG referencia algo externo.');
  return value;
}
export function sanitizeSvg(buffer) {
  if (buffer.length > MAX_BYTES) fail('Escolha um SVG de até 100 KB.');
  const source = buffer.toString('utf8');
  if (source.includes('\0')) fail('Arquivo SVG inválido.');
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<!\[CDATA\[/i.test(source)) fail('O SVG tem declarações não permitidas.');
  const cleaned = source.replace(/<\?xml[^>]*\?>/i, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const out = []; const stack = [];
  const token = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)|(<)/g;
  let match, seenRoot = false;
  while ((match = token.exec(cleaned))) {
    if (match[6]) fail('Arquivo SVG inválido.');
    if (match[5] !== undefined) {
      const top = stack[stack.length - 1];
      if (match[5].trim() && (top === 'title' || top === 'desc')) out.push(esc(match[5].replace(/&[a-z]+;/gi, '')));
      else if (match[5].trim()) fail('O SVG tem texto fora de título ou descrição.');
      continue;
    }
    const closing = match[1] === '/', name = match[2].toLowerCase(), selfClose = match[4] === '/';
    if (!ELEMENTS.has(name)) fail(`Elemento <${name}> não permitido em SVG.`);
    if (closing) { if (stack.pop() !== name) fail('SVG mal formado.'); out.push(`</${name}>`); continue; }
    if (!seenRoot && name !== 'svg') fail('O arquivo precisa começar com <svg>.');
    seenRoot = true;
    const attrs = [];
    const attrRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g; let a;
    while ((a = attrRe.exec(match[3]))) {
      const attr = a[1].toLowerCase(); const value = a[2] ?? a[3] ?? '';
      if (attr.startsWith('on') || attr === 'style' || attr === 'class' || attr.includes('href') || attr.startsWith('xmlns:') || attr.startsWith('xml:')) { if (attr.startsWith('on') || attr.includes('href')) fail('O SVG tem atributo não permitido (' + attr + ').'); continue; }
      if (!ATTRS.has(attr)) continue;
      if (attr === 'xmlns') { if (value !== 'http://www.w3.org/2000/svg') fail('Namespace do SVG inválido.'); continue; }
      attrs.push(`${attr === 'viewbox' ? 'viewBox' : attr === 'gradientunits' ? 'gradientUnits' : attr === 'gradienttransform' ? 'gradientTransform' : attr === 'preserveaspectratio' ? 'preserveAspectRatio' : attr}="${esc(cleanValue(attr, value))}"`);
    }
    if (name === 'svg' && stack.length === 0) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
    if (name === 'svg' && !attrs.some(x => x.startsWith('viewBox'))) fail('O SVG precisa de viewBox.');
    out.push(`<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}${selfClose ? '/' : ''}>`);
    if (!selfClose) stack.push(name);
  }
  if (!seenRoot || stack.length) fail('SVG mal formado.');
  const svg = out.join('');
  if (svg.length > MAX_BYTES) fail('SVG grande demais.');
  return Buffer.from(svg, 'utf8');
}
