// legenda-cinetica — legenda presa na fala (item do Volito).
//
// Use SEMPRE como ITEM (esta pasta com item.json), nunca como programa solto:
// em programa solto (`code`/`program` na spec) o Volito NAO entrega props ao
// $.data — os props so chegam em item que declara props no item.json.
//
//   volito check  ./legenda-item --words words.json --prop linhas=3
//   volito render ./legenda-item --words words.json --prop destaque=pexinxavel \
//          --aspect 9:16 --format mp4 --out legenda.mp4
//
// A sincronia vem de $.words ([{w,s,e}]). Sem transcricao, nao desenha nada.

function legendaAgrupar(words, maxP, maxC, pausa) {
  var blocos = [], atual = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var tentativa = atual.concat([w]);
    var txt = tentativa.map(function (x) { return x.w; }).join(' ');
    var silencio = i > 0 ? (w.s - words[i - 1].e) : 0;
    var fecha = atual.length && (tentativa.length > maxP || txt.length > maxC || silencio > pausa);
    if (fecha) {
      blocos.push(atual);
      atual = [w];
    } else {
      atual = tentativa;
    }
  }
  if (atual.length) blocos.push(atual);
  var out = [];
  for (var j = 0; j < blocos.length; j++) {
    var b = blocos[j];
    out.push({
      texto: b.map(function (x) { return x.w; }).join(' '),
      s: b[0].s,
      e: b[b.length - 1].e
    });
  }
  return out;
}

function legendaLimpar(txt) {
  return String(txt).toLowerCase().replace(/^[^0-9a-z\u00c0-\u024f]+|[^0-9a-z\u00c0-\u024f]+$/g, '');
}

function legendaFit($, txt, size, maxW, font) {
  var s = size;
  while (s > 14) {
    var w = $.measure(txt, { size: s, weight: font.weight, family: font.family, ls: -0.02 });
    if (w <= maxW) break;
    s -= 2;
  }
  return s;
}

function legendaBlocosDeJson(txt) {
  if (!txt) return null;
  try {
    var d = JSON.parse(txt);
    if (!d || !d.length) return null;
    return d.map(function (b) { return { texto: b.texto || b.text || '', s: b.s, e: b.e }; })
      .filter(function (b) { return b.texto && typeof b.s === 'number' && typeof b.e === 'number'; });
  } catch (e) {
    return null;
  }
}

function frame(t, $) {
  const p = $.data || {};
  const W = $.W, H = $.H;
  const k = $.k || 1;
  const display = $.font('display');

  // ---------- headline: frase grande, marker por trecho *marcado* ----------
  if (p.modo === 'headline') {
    const frases = String(p.frases || '').split('\n').filter(function (l) { return l.trim(); });
    if (!frases.length) return '';
    const rows = $.sync(frases);
    return $.headline(t, rows, {
      x: W / 2,
      y: H * 0.30,
      size: (p.tamanho || 96) * k,
      weight: display.weight || 900,
      family: display.family,
      anchor: 'middle',
      fill: $.c.fg,
      marker: $.c.accent2,
      ls: -0.03,
      lh: 1.08
    });
  }

  // ---------- bloco: legenda de reel ----------
  const words = $.words || [];
  if (!words.length) return '';

  const blocos = legendaBlocosDeJson(p.blocosJson) ||
    legendaAgrupar(words, p.linhas || 3, p.maxCaracteres || 22, p.pausa || 0.3);
  const destaque = String(p.destaque || '').split(',')
    .map(legendaLimpar).filter(function (x) { return x.length > 0; });
  const largura = W - W * 0.16;
  const cx = W / 2;
  const cy = H * (p.ancora || 0.72);
  const saida = [];

  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    const proximo = blocos[i + 1] ? blocos[i + 1].s : Infinity;
    const t0 = b.s - 0.08;                       // entra 0,08 s antes da fala
    // sai 0,30 s depois da ultima palavra, MAS antes do proximo bloco entrar:
    // sem isso dois blocos ficam desenhados no mesmo frame (texto sobreposto).
    const t1 = Math.max(t0 + 0.05, Math.min(b.e + 0.30, proximo - 0.02, $.dur));
    if (t < t0 || t > t1) continue;

    const q = $.clamp($.pop(t, t0, 2.6, 7.5), 0, 1);
    const sai = 1 - $.clamp($.seg(t, Math.max(t1 - 0.16, t0), t1));
    const op = q * sai;
    if (op <= 0.001) continue;

    const texto = $.case ? $.case(b.texto) : b.texto;
    const sz = legendaFit($, texto, (p.tamanho || 96) * k, largura * 0.96, display);
    const hTxt = sz * 1.12;
    const lw = $.measure(texto, { size: sz, weight: display.weight, family: display.family, ls: -0.02 });

    let temDestaque = false;
    for (const palavra of b.texto.split(' ')) {
      if (destaque.indexOf(legendaLimpar(palavra)) >= 0) { temDestaque = true; break; }
    }

    const pecas = [];
    if (p.caixa !== false) {
      pecas.push($.rect(cx - Math.min(lw, largura) / 2 - 16 * k, cy - hTxt * 0.5 - 10 * k,
        Math.min(lw, largura) + 32 * k, hTxt + 22 * k,
        { r: 12 * k, fill: $.rgba($.c.bg, 0.62) }));
    }
    if (temDestaque) {
      const cresce = $.clamp($.seg(t, t0 + 0.05, t0 + 0.30));
      pecas.push($.rect(cx - lw / 2 - 6 * k, cy + hTxt * 0.02, (lw + 12 * k) * cresce, hTxt * 0.26,
        { r: 5 * k, fill: $.rgba($.c.accent2, 0.80) }));
    }
    pecas.push($.text(texto, {
      x: cx, y: cy - hTxt * 0.5,
      size: sz, weight: display.weight || 900, family: display.family,
      fill: $.c.fg, anchor: 'middle', ls: -0.02
    }));

    saida.push('<g opacity="' + op.toFixed(3) + '" transform="translate(' + cx.toFixed(2) + ',' +
      (cy + (1 - q) * 26 * k).toFixed(2) + ') scale(' + (0.94 + 0.06 * q).toFixed(4) +
      ') translate(' + (-cx).toFixed(2) + ',' + (-cy).toFixed(2) + ')">' + pecas.join('') + '</g>');
  }

  return saida.join('');
}

// trilha: um tick discreto por bloco, na hora de entrar
function sound($) {
  const p = $.data || {};
  const words = $.words || [];
  if (!words.length) return { cues: [], auto: true };
  const blocos = legendaBlocosDeJson(p.blocosJson) ||
    legendaAgrupar(words, p.linhas || 3, p.maxCaracteres || 22, p.pausa || 0.3);
  const cues = [];
  let ultimo = -1;
  for (const b of blocos) {
    const at = b.s - 0.08;
    if (at - ultimo < 0.15) continue;
    ultimo = at;
    cues.push({ at: at, kind: 'tick', level: 0.3 });
  }
  return { cues: cues, auto: false, level: 0.6, room: 0.15 };
}
