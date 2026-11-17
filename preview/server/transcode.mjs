// U-03: vídeos novos viram uma versão leve em segundo plano (720p, H.264/AAC, MP4 com "faststart"). Uma fila de um trabalho por vez, para
// não competir com quem está usando a rede. Sem ffmpeg no servidor (ou se der erro), o vídeo original continua valendo.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let available;
export const ffmpegAvailable = () => available ??= spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
const queue = []; let running = false;
export const transcodeStats = { done: 0, skipped: 0, failed: 0 };

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; child.stderr.on('data', d => { err = (err + d).slice(-400); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('ffmpeg demorou demais')); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com ${code}: ${err.trim()}`)); });
  });
}
export async function transcodeBuffer(input, { maxHeight = 720, crf = 28, timeoutMs = 5 * 60_000 } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'opy-tc-'));
  try {
    await writeFile(join(dir, 'in'), input);
    await run(['-nostdin', '-y', '-i', join(dir, 'in'), '-map', '0:v:0', '-map', '0:a:0?', '-vf', `scale=-2:'min(${maxHeight},ih)'`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-threads', '2',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-f', 'mp4', join(dir, 'out.mp4')], timeoutMs);
    return await readFile(join(dir, 'out.mp4'));
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
async function work({ id, store }) {
  try {
    const media = await store.readMedia(id);
    if (!media || media.statusCode !== 200) return;
    const input = media.buffer || Buffer.from(await new Response(media.stream).arrayBuffer());
    const output = await transcodeBuffer(input);
    // Só troca se a versão leve existe e é de fato menor; senão fica o original.
    if (output.length > 1024 && output.length < input.length * 0.95) { await store.saveMedia(id, output, 'video/mp4'); transcodeStats.done++; }
    else transcodeStats.skipped++;
  } catch (error) { transcodeStats.failed++; console.error(`video: não foi possível otimizar ${id}: ${error.message}`); }
}
async function drain() {
  if (running) return; running = true;
  try { while (queue.length) await work(queue.shift()); } finally { running = false; }
}
export function scheduleTranscode(id, store) {
  if (process.env.OPY_TRANSCODE === '0' || !ffmpegAvailable()) return false;
  queue.push({ id, store }); setImmediate(drain);
  return true;
}
export const idle = async () => { while (running || queue.length) await new Promise(r => setTimeout(r, 50)); };
