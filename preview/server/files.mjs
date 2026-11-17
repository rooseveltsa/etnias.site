import { createReadStream } from 'node:fs';

// Envia um arquivo do disco com suporte a Range (é o que permite o vídeo avançar e tocar no iPhone).
// Usado pela mídia do legado (/legado/*) e pelas gravações de live (/live/recordings/*).
export function sendFile(req, res, file, info, type) {
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start >= info.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': info.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// Envia um anexo que já está em memória (mídia da rede) com Range e cache: vídeo avança, toca no iPhone e não baixa de novo.
// O id da mídia nunca muda de conteúdo (troca de foto gera id novo), então o navegador pode guardar a cópia sem revalidar.
export function sendBuffer(req, res, buffer, type, id) {
  const etag = id ? `"${id}"` : '';
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
  if (etag) res.setHeader('ETag', etag);
  if (etag && req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end(); }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    const size = buffer.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${size}`); return res.end(); }
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    return req.method === 'HEAD' ? res.end() : res.end(buffer.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', buffer.length);
  return req.method === 'HEAD' ? res.end() : res.end(buffer);
}
