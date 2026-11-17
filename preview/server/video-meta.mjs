// Regras do MOMENTOS (especificação de 14/11/2026): vídeo de até 4 minutos (240 s).
export const MAX_VIDEO_SECONDS = 240;
// Duração de um MP4/MOV lida do cabeçalho (moov > mvhd), sem programa externo. Devolve segundos ou 0 se não der para saber
// (WebM, arquivo fora do padrão): nesse caso quem decide é a checagem feita no aparelho antes do envio.
export function mp4Seconds(bytes) {
  const find = (start, end, wanted) => {
    let at = start;
    while (at + 8 <= end) {
      let size = bytes.readUInt32BE(at);
      const type = bytes.toString('latin1', at + 4, at + 8);
      let header = 8;
      if (size === 1) { if (at + 16 > end) return null; size = Number(bytes.readBigUInt64BE(at + 8)); header = 16; }
      else if (size === 0) size = end - at;
      if (size < header || at + size > end) return null;
      if (type === wanted) return { start: at + header, end: at + size };
      at += size;
    }
    return null;
  };
  try {
    const moov = find(0, bytes.length, 'moov'); if (!moov) return 0;
    const mvhd = find(moov.start, moov.end, 'mvhd'); if (!mvhd) return 0;
    const version = bytes[mvhd.start];
    const scale = version === 1 ? bytes.readUInt32BE(mvhd.start + 20) : bytes.readUInt32BE(mvhd.start + 12);
    const units = version === 1 ? Number(bytes.readBigUInt64BE(mvhd.start + 24)) : bytes.readUInt32BE(mvhd.start + 16);
    return scale > 0 ? units / scale : 0;
  } catch { return 0; }
}
