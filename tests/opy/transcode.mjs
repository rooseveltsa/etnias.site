import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ffmpegAvailable, scheduleTranscode, idle, transcodeStats, transcoding } from '../../preview/server/transcode.mjs';

const has = ffmpegAvailable();
test('transcodificação: vídeo grande vira MP4 leve; sem ffmpeg o original fica', { skip: !has && 'ffmpeg não instalado' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'opy-vid-'));
  // 3 s de vídeo 1920x1080 com muito detalhe (ruído) para ser pesado de verdade.
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-c:a', 'aac', join(dir, 'in.mp4')]);
  const original = readFileSync(join(dir, 'in.mp4'));
  const stored = new Map([['v1', { type: 'video/mp4', buffer: original }]]);
  const store = { readMedia: async id => stored.has(id) ? { statusCode: 200, blob: { contentType: stored.get(id).type }, buffer: stored.get(id).buffer } : null, saveMedia: async (id, bytes, type) => stored.set(id, { type, buffer: bytes }) };
  assert.equal(scheduleTranscode('v1', store), true);
  assert.equal(transcoding('v1'), true, 'fica marcado como processando');
  await idle();
  assert.equal(transcoding('v1'), false, 'sai de processando ao terminar');
  const out = stored.get('v1');
  assert.ok(out.buffer.length < original.length * 0.95, `esperava menor: ${out.buffer.length} vs ${original.length}`);
  assert.equal(out.type, 'video/mp4');
  writeFileSync(join(dir, 'out.mp4'), out.buffer);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=height,codec_name', '-of', 'csv=p=0', join(dir, 'out.mp4')]).stdout.toString().trim();
  assert.match(probe, /h264,720/);
  assert.equal(transcodeStats.done, 1);
  // Lixo que não é vídeo: falha sem derrubar nada e o original permanece.
  stored.set('v2', { type: 'video/mp4', buffer: Buffer.from('isto não é um vídeo') });
  scheduleTranscode('v2', store); await idle();
  assert.equal(stored.get('v2').buffer.toString(), 'isto não é um vídeo'); assert.equal(transcodeStats.failed, 1);
});

test('ponta a ponta: vídeo publicado é trocado pela versão leve e continua tocando', { skip: !has && 'ffmpeg não instalado' }, async () => {
  const { startServer } = await import('./helpers-server.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'opy-vid2-'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-c:a', 'aac', '-movflags', '+faststart', join(dir, 'in.mp4')]);
  const original = readFileSync(join(dir, 'in.mp4'));
  const s = await startServer();
  try {
    const r = await s.api({ action: 'register', acceptTerms: true, username: 'cine', name: 'Cine', password: 'Senha-de-teste-2026', contact: 'cine@exemplo.com' });
    const pub = await s.api({ action: 'publish', text: 'meu vídeo', audience: 'public', media: { name: 'v.mp4', data: 'data:video/mp4;base64,' + original.toString('base64') } }, { cookie: r.cookie });
    assert.equal(pub.status, 200, JSON.stringify(pub.data).slice(0, 200));
    const post = pub.data.posts.find(p => p.text === 'meu vídeo'); const url = post.media.url;
    let size = original.length;
    for (let i = 0; i < 80 && size >= original.length * 0.95; i++) { await new Promise(r => setTimeout(r, 250)); const res = await fetch(s.base + url, { headers: { cookie: r.cookie } }); size = (await res.arrayBuffer()).byteLength; }
    assert.ok(size < original.length * 0.95, `vídeo deveria encolher: ${size} vs ${original.length}`);
  } finally { await s.stop(); }
});
