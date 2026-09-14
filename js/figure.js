/* ClusteringPro — SVG figure engine (shared with the other LABG apps).
   Every figure is drawn as "pure" SVG (inline style attributes, no external CSS)
   so that export to PNG / JPG / WEBP / TIFF / SVG is faithful at any resolution.

   Fig.mount(host, spec) draws a figure with an editor panel (titles, palettes,
   fonts, sizes) and an export bar. spec.render(cfg) must return a new <svg>. */

const Fig = {};
const NS = 'http://www.w3.org/2000/svg';

/* ================= palettes ================= */
Fig.palettes = {
  cluster:  ['#4f46a5', '#e0803c', '#1fa39a', '#d64a6a', '#7bb041', '#8a5cd6', '#2b7bb9', '#c9a227', '#8c5a3c', '#6d6e71'],
  vivid:    ['#d7263d', '#1b6ca8', '#2e9e5b', '#7b3fa0', '#f08a24', '#8a5a2b', '#e45fa3', '#7d7d7d', '#39a9a0', '#e8c228'],
  harvest:  ['#3a5a40', '#a3b18a', '#dda15e', '#bc6c25', '#588157', '#e9c46a', '#8c5a3c', '#344e41', '#f4a261', '#264653'],
  soil:     ['#5b3a29', '#8c6a4a', '#b89b74', '#d9c8a9', '#3f5f3a', '#7f9f6d', '#c7b446', '#2f4a3a', '#a0522d', '#6b6b6b'],
  set2:     ['#7fc8a9', '#f3a683', '#9aa8d6', '#e7a1c8', '#b5d56a', '#f7d86b', '#dcc19e', '#bfbfbf', '#6fae3e', '#dfad2e'],
  dark2:    ['#157a62', '#c65d1b', '#6b63a8', '#cf2f7f', '#5d9b2c', '#c9971a', '#98702a', '#5e5e5e', '#2f76a8', '#a94a25'],
  okabe:    ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000', '#999999', '#661100'],
  tol:      ['#4477AA', '#EE6677', '#228833', '#CCBB44', '#66CCEE', '#AA3377', '#BBBBBB', '#000000', '#EE7733', '#009988'],
  pastel:   ['#a8c8ec', '#f7bd92', '#9ddcaf', '#f3a6a3', '#cdbff5', '#dcc0a3', '#f2b6de', '#d3d3d3', '#f6f2a4', '#bde8e5'],
  greys:    ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#4b5563', '#1f2937', '#e5e7eb', '#111827', '#6b7280'],
};
Fig.paletteNames = {
  cluster: 'ClusteringPro', vivid: 'Vivid', harvest: 'Harvest', soil: 'Soil & crop', set2: 'Soft', dark2: 'Deep',
  okabe: 'Okabe–Ito (colour-blind safe)', tol: 'Paul Tol (colour-blind safe)', pastel: 'Pastel', greys: 'Greyscale',
};

function lerp(a, b, t) { return a + (b - a) * t; }
function rgb(r, g, b) { return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`; }
function rampFrom(stops) {
  return t => {
    t = Math.max(0, Math.min(1, isFinite(t) ? t : 0));
    const n = stops.length - 1;
    const i = Math.min(n - 1, Math.floor(t * n));
    const u = t * n - i;
    const a = stops[i], b = stops[i + 1];
    return rgb(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u));
  };
}
Fig.colormaps = {
  viridis: rampFrom([[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]]),
  magma:   rampFrom([[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]]),
  inferno: rampFrom([[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]]),
  plasma:  rampFrom([[13,8,135],[126,3,168],[204,71,120],[248,149,64],[240,249,33]]),
  cividis: rampFrom([[0,32,77],[60,86,120],[124,123,120],[192,164,98],[255,234,70]]),
  /* the diverging and sequential ramps below are original to this program: their stops come from
     anchors in the OKLCH colour space, with lightness rising to the centre and falling to the ends
     (diverging) or falling steadily (sequential), and ends that stay apart under red–green colour blindness */
  rdylbu:  rampFrom([[39,67,135],[105,174,213],[252,245,199],[237,156,85],[165,30,36]]),
  rdbu:    rampFrom([[2,56,105],[151,197,222],[246,239,230],[229,166,146],[144,40,34]]),
  spectral:rampFrom([[86,69,151],[82,200,180],[241,244,182],[248,154,86],[166,31,71]]),
  bluered: rampFrom([[30,71,152],[243,237,230],[190,48,37]]),
  greens:  rampFrom([[241,247,221],[89,180,125],[0,63,51]]),
  ylgn:    rampFrom([[252,250,203],[189,224,126],[71,148,76],[3,71,65]]),
  browns:  rampFrom([[253,245,230],[204,153,102],[102,51,0]]),
  heat:    rampFrom([[255,247,217],[253,146,62],[158,18,43]]),
};
Fig.colormapNames = {
  viridis: 'Viridis', magma: 'Magma', inferno: 'Inferno', plasma: 'Plasma', cividis: 'Cividis (colour-blind safe)',
  rdylbu: 'Red–Yellow–Blue', rdbu: 'Red–Blue (diverging)', spectral: 'Spectral', bluered: 'Blue–White–Red',
  greens: 'Greens', ylgn: 'Yellow–Green', browns: 'Browns (soil)', heat: 'Heat',
};

function parseColor(col) {
  let m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(col);
  if (m) return [+m[1], +m[2], +m[3]];
  m = /^#([0-9a-f]{6})$/i.exec(col);
  if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
  m = /^#([0-9a-f]{3})$/i.exec(col);
  if (m) return m[1].split('').map(h => parseInt(h + h, 16));
  return null;
}
Fig.darken = (col, amount) => {
  const c = parseColor(col); if (!c) return col;
  const k = 1 - (amount == null ? 0.35 : amount);
  return rgb(c[0] * k, c[1] * k, c[2] * k);
};
Fig.lighten = (col, amount) => {
  const c = parseColor(col); if (!c) return col;
  const k = amount == null ? 0.5 : amount;
  return rgb(c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k);
};
Fig.alpha = (col, a) => { const c = parseColor(col); return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : col; };
Fig.luminance = col => {
  const c = parseColor(col); if (!c) return 1;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
};
Fig.onColor = (col, darkFg) => Fig.luminance(col) > 0.55 ? (darkFg || '#1b1f2a') : '#ffffff';
Fig.color = (palette, i) => {
  const p = Fig.palettes[palette] || Fig.palettes.cluster;
  return p[i % p.length];
};

/* ================= themes & typography ================= */
Fig.themes = {
  light:   { bg: '#ffffff', fg: '#1b1f2a', muted: '#667085', grid: '#e6e9ef', axis: '#9aa3b2' },
  paper:   { bg: '#fbf9f4', fg: '#2b2b28', muted: '#6b6a63', grid: '#e8e2d6', axis: '#a8a294' },
  dark:    { bg: '#171a22', fg: '#e9edf3', muted: '#98a1b3', grid: '#2a2f3d', axis: '#4b5364' },
  minimal: { bg: '#ffffff', fg: '#111111', muted: '#555555', grid: 'none',    axis: '#111111' },
  journal: { bg: '#ffffff', fg: '#000000', muted: '#333333', grid: 'none',    axis: '#000000' },
};
Fig.themeNames = { light: 'Light', paper: 'Paper', dark: 'Dark', minimal: 'Minimal', journal: 'Journal (black & white axes)' };
Fig.fonts = {
  sans: 'Helvetica, Arial, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  segoe: '"Segoe UI", Roboto, sans-serif',
  calibri: 'Calibri, "Segoe UI", sans-serif',
  cambria: 'Cambria, Georgia, serif',
  mono: 'Consolas, "Courier New", monospace',
};
Fig.fontNames = {
  sans: 'Helvetica', arial: 'Arial', serif: 'Georgia', times: 'Times New Roman', segoe: 'Segoe UI',
  calibri: 'Calibri', cambria: 'Cambria', mono: 'Monospace',
};

/* ================= SVG constructors ================= */
Fig.svg = (w, h, theme) => {
  const t = Fig.themes[theme] || Fig.themes.light;
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('xmlns', NS);
  s.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('width', w);
  s.setAttribute('height', h);
  s.dataset.w = w; s.dataset.h = h;
  s.appendChild(Fig.el('rect', { x: 0, y: 0, width: w, height: h, fill: t.bg, 'data-bg': '1' }));
  return s;
};
Fig.el = (tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
};
Fig.g = attrs => Fig.el('g', attrs);

/* ---------- typographic scale ----------
   Multipliers in force while a figure is drawn. Fig.mount sets them before
   calling render, so EVERY text that goes through Fig.text is affected.
   Roles: 'title'/'subtitle' → titles · 'axis'/'tick' → axes and ticks ·
   'legend'/'label' (default) → labels and legends. */
Fig._fs = { title: 1, axis: 1, label: 1 };
Fig.fsGroup = role =>
  (role === 'title' || role === 'subtitle') ? 'title'
    : (role === 'axis' || role === 'tick') ? 'axis' : 'label';
Fig.fs = role => Fig._fs[Fig.fsGroup(role)] || 1;
Fig.setFontScale = cfg => {
  const g = +cfg.fontScale || 1;
  Fig._fs = { title: g * (+cfg.fsTitle || 1), axis: g * (+cfg.fsAxis || 1), label: g * (+cfg.fsLabel || 1) };
};

Fig.text = (x, y, str, o) => {
  o = o || {};
  const size = (o.size || 12) * Fig.fs(o.role);
  return Fig.el('text', {
    stroke: o.halo || null,
    'stroke-width': o.halo ? (o.haloWidth || 3) * Fig.fs(o.role) : null,
    'stroke-linejoin': o.halo ? 'round' : null,
    'paint-order': o.halo ? 'stroke fill' : null,
    x, y,
    'font-family': o.font || Fig.fonts.sans,
    'font-size': +size.toFixed(2),
    'font-weight': o.weight || 'normal',
    'font-style': o.italic ? 'italic' : null,
    fill: o.fill || '#1b1f2a',
    'text-anchor': o.anchor || 'start',
    'dominant-baseline': o.baseline || null,
    transform: o.rotate ? `rotate(${o.rotate} ${x} ${y})` : null,
    opacity: o.opacity != null ? o.opacity : null,
  }, str);
};

/* ================= scales & axes ================= */
Fig.scaleLinear = (d0, d1, r0, r1) => {
  const span = (d1 - d0) || 1;
  const f = v => r0 + (v - d0) / span * (r1 - r0);
  f.invert = q => d0 + (q - r0) / ((r1 - r0) || 1) * span;
  f.domain = [d0, d1]; f.range = [r0, r1];
  return f;
};
Fig.scaleBand = (labels, r0, r1, padding) => {
  padding = padding == null ? 0.2 : padding;
  const n = labels.length || 1;
  const step = (r1 - r0) / n;
  const bw = step * (1 - padding);
  const f = i => r0 + step * (typeof i === 'number' ? i : labels.indexOf(i)) + step * padding / 2;
  f.bandwidth = bw; f.step = step; f.center = i => f(i) + bw / 2;
  return f;
};
Fig.ticks = (min, max, count) => {
  count = count || 6;
  const span = (max - min) || 1;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toFixed(10));
  }
  return out;
};
Fig.fmtTick = v => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-4 || a >= 1e6) return v.toExponential(1);
  return String(+v.toFixed(6));
};
/* "nice" domain padded a little, with optional zero inclusion */
Fig.niceDomain = (min, max, includeZero) => {
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.05;
  const t = Fig.ticks(min - pad, max + pad, 6);
  const step = t.length > 1 ? t[1] - t[0] : (max - min) / 5;
  const lo = includeZero && min === 0 ? 0 : Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;
  return [lo, hi];
};

/* Standard frame: title, subtitle, axes, gridlines. Returns {g, x, y} helpers.
   cfg keys used: theme, font, title, subtitle, xlab, ylab, grid, box */
Fig.frame = (svg, cfg, o) => {
  const t = Fig.themes[cfg.theme] || Fig.themes.light;
  const font = Fig.fonts[cfg.font] || Fig.fonts.sans;
  const W = +svg.dataset.w, H = +svg.dataset.h;
  const m = Object.assign({ top: 56, right: 24, bottom: 62, left: 74 }, o.margin || {});
  if (!cfg.title) m.top -= 22;
  if (cfg.subtitle) m.top += 16;
  const x0 = m.left, x1 = W - m.right, y0 = m.top, y1 = H - m.bottom;
  const g = Fig.g({ 'font-family': font });
  svg.appendChild(g);
  if (cfg.title) g.appendChild(Fig.text(W / 2, 26, cfg.title, { size: 17, weight: 'bold', anchor: 'middle', fill: t.fg, font, role: 'title' }));
  if (cfg.subtitle) g.appendChild(Fig.text(W / 2, 26 + 18 * Fig.fs('title'), cfg.subtitle, { size: 12, anchor: 'middle', fill: t.muted, font, role: 'subtitle' }));
  return { g, x0, x1, y0, y1, W, H, t, font, m };
};
/* draw linear y axis with grid; sc = Fig.scaleLinear; f = frame */
Fig.axisY = (f, sc, cfg, o) => {
  o = o || {};
  const ticks = o.ticks || Fig.ticks(sc.domain[0], sc.domain[1], o.count || 6);
  const g = Fig.g();
  ticks.forEach(v => {
    if (v < sc.domain[0] - 1e-9 || v > sc.domain[1] + 1e-9) return;
    const y = sc(v);
    if (cfg.grid !== false && f.t.grid !== 'none')
      g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y, y2: y, stroke: f.t.grid, 'stroke-width': 1, 'stroke-dasharray': cfg.gridDash ? '3 3' : null }));
    g.appendChild(Fig.el('line', { x1: f.x0 - 5, x2: f.x0, y1: y, y2: y, stroke: f.t.axis, 'stroke-width': 1 }));
    g.appendChild(Fig.text(f.x0 - 9, y + 4, o.fmt ? o.fmt(v) : Fig.fmtTick(v), { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' }));
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x0, y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.ylab) g.appendChild(Fig.text(20, (f.y0 + f.y1) / 2, cfg.ylab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, rotate: -90, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};
Fig.axisX = (f, sc, cfg, o) => {
  o = o || {};
  const ticks = o.ticks || Fig.ticks(sc.domain[0], sc.domain[1], o.count || 6);
  const g = Fig.g();
  ticks.forEach(v => {
    if (v < sc.domain[0] - 1e-9 || v > sc.domain[1] + 1e-9) return;
    const x = sc(v);
    if (cfg.grid !== false && f.t.grid !== 'none' && o.grid !== false)
      g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y0, y2: f.y1, stroke: f.t.grid, 'stroke-width': 1, 'stroke-dasharray': cfg.gridDash ? '3 3' : null }));
    g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
    g.appendChild(Fig.text(x, f.y1 + 18, o.fmt ? o.fmt(v) : Fig.fmtTick(v), { size: 11, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'tick' }));
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.xlab) g.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + 44, cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};
/* categorical x axis */
Fig.axisXBand = (f, band, labels, cfg, o) => {
  o = o || {};
  const g = Fig.g();
  const rot = o.rotate != null ? o.rotate : (labels.length > 8 || labels.some(l => String(l).length > 12) ? -35 : 0);
  labels.forEach((lab, i) => {
    const x = band.center(i);
    g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y1, y2: f.y1 + 5, stroke: f.t.axis, 'stroke-width': 1 }));
    g.appendChild(Fig.text(x, f.y1 + 18, String(lab), {
      size: 11, anchor: rot ? 'end' : 'middle', fill: f.t.fg, font: f.font, role: 'tick', rotate: rot || null,
    }));
  });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: f.y1, y2: f.y1, stroke: f.t.axis, 'stroke-width': 1.2 }));
  if (cfg.xlab) g.appendChild(Fig.text((f.x0 + f.x1) / 2, f.y1 + (rot ? 58 : 44), cfg.xlab, { size: 13, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'axis', weight: cfg.axisBold ? 'bold' : 'normal' }));
  f.g.appendChild(g);
  return g;
};
/* legend: items [{label, color, shape?}] placed at top-right inside plot */
Fig.legend = (f, items, cfg, o) => {
  o = o || {};
  const g = Fig.g();
  const fs = 11 * Fig.fs('legend');
  const lh = fs * 1.55;
  const pos = cfg.legendPos || o.pos || 'right';
  if (pos === 'none') return g;
  let x, y;
  const longest = Math.max(...items.map(i => String(i.label).length)) * fs * 0.58 + 26;
  if (pos === 'right') { x = f.x1 - longest; y = f.y0 + 8; }
  else if (pos === 'left') { x = f.x0 + 10; y = f.y0 + 8; }
  else if (pos === 'bottom') { x = f.x0; y = f.y1 + 40 * Fig.fs('axis') + 18; }
  else { x = f.x1 - longest; y = f.y0 + 8; }
  if (pos === 'bottom') {
    let cx = x;
    items.forEach(it => {
      g.appendChild(Fig.el('rect', { x: cx, y: y - fs * 0.85, width: fs, height: fs, fill: it.color, rx: 2 }));
      const tx = Fig.text(cx + fs + 5, y, it.label, { size: 11, fill: f.t.fg, font: f.font, role: 'legend' });
      g.appendChild(tx);
      cx += fs + 10 + String(it.label).length * fs * 0.6 + 14;
    });
  } else {
    if (o.box !== false) g.appendChild(Fig.el('rect', { x: x - 8, y: y - 6, width: longest + 4, height: items.length * lh + 8, fill: f.t.bg, stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, rx: 4, opacity: 0.92 }));
    items.forEach((it, i) => {
      const yy = y + i * lh + fs * 0.85;
      if (it.shape === 'line') g.appendChild(Fig.el('line', { x1: x, x2: x + fs, y1: yy - fs * 0.35, y2: yy - fs * 0.35, stroke: it.color, 'stroke-width': 2.5 }));
      else if (it.shape === 'circle') g.appendChild(Fig.el('circle', { cx: x + fs / 2, cy: yy - fs * 0.35, r: fs * 0.45, fill: it.color }));
      else g.appendChild(Fig.el('rect', { x, y: yy - fs * 0.85, width: fs, height: fs, fill: it.color, rx: 2 }));
      g.appendChild(Fig.text(x + fs + 6, yy, it.label, { size: 11, fill: f.t.fg, font: f.font, role: 'legend' }));
    });
  }
  f.g.appendChild(g);
  return g;
};
/* point marker of a given shape */
Fig.marker = (x, y, r, shape, attrs) => {
  attrs = attrs || {};
  switch (shape) {
    case 'square': return Fig.el('rect', Object.assign({ x: x - r, y: y - r, width: 2 * r, height: 2 * r }, attrs));
    case 'triangle': return Fig.el('polygon', Object.assign({ points: `${x},${y - r * 1.2} ${x - r * 1.1},${y + r * 0.8} ${x + r * 1.1},${y + r * 0.8}` }, attrs));
    case 'diamond': return Fig.el('polygon', Object.assign({ points: `${x},${y - r * 1.3} ${x + r * 1.3},${y} ${x},${y + r * 1.3} ${x - r * 1.3},${y}` }, attrs));
    case 'cross': { const g = Fig.g(attrs); g.appendChild(Fig.el('line', { x1: x - r, x2: x + r, y1: y - r, y2: y + r, stroke: attrs.fill || '#000', 'stroke-width': 1.8 })); g.appendChild(Fig.el('line', { x1: x - r, x2: x + r, y1: y + r, y2: y - r, stroke: attrs.fill || '#000', 'stroke-width': 1.8 })); return g; }
    default: return Fig.el('circle', Object.assign({ cx: x, cy: y, r }, attrs));
  }
};
Fig.shapes = ['circle', 'square', 'triangle', 'diamond', 'cross'];

/* ================= export ================= */
Fig.serialize = svg => {
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    new XMLSerializer().serializeToString(clone);
};

/* ---- CRC32 (for PNG chunk injection) ---- */
let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/* Insert a pHYs chunk so the PNG carries its DPI (journals check this). */
Fig.pngWithDpi = (buf, dpi) => {
  const src = new Uint8Array(buf);
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4);            // 'pHYs'
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  /* IHDR is always first: 8 sig + 4 len + 4 type + 13 data + 4 crc = 33 */
  const out = new Uint8Array(src.length + chunk.length);
  out.set(src.subarray(0, 33), 0); out.set(chunk, 33); out.set(src.subarray(33), 33 + chunk.length);
  return out;
};
/* Minimal uncompressed RGB TIFF encoder with resolution tags (baseline TIFF 6.0). */
Fig.encodeTiff = (imageData, dpi) => {
  const { width: w, height: h, data } = imageData;
  const nPix = w * h, rgbBytes = nPix * 3;
  const nEntries = 12;
  const ifdOffset = 8;
  const ifdSize = 2 + nEntries * 12 + 4;
  const extraOffset = ifdOffset + ifdSize;          // bitsPerSample (6) + xres (8) + yres (8)
  const dataOffset = extraOffset + 6 + 8 + 8;
  const buf = new ArrayBuffer(dataOffset + rgbBytes);
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8[0] = 0x49; u8[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifdOffset, true);
  let p = ifdOffset;
  dv.setUint16(p, nEntries, true); p += 2;
  const entry = (tag, type, count, value) => { dv.setUint16(p, tag, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true); if (type === 3 && count === 1) dv.setUint16(p + 8, value, true); else dv.setUint32(p + 8, value, true); p += 12; };
  entry(256, 4, 1, w);                    // ImageWidth
  entry(257, 4, 1, h);                    // ImageLength
  entry(258, 3, 3, extraOffset);          // BitsPerSample → offset
  entry(259, 3, 1, 1);                    // Compression: none
  entry(262, 3, 1, 2);                    // Photometric: RGB
  entry(273, 4, 1, dataOffset);           // StripOffsets
  entry(277, 3, 1, 3);                    // SamplesPerPixel
  entry(278, 4, 1, h);                    // RowsPerStrip
  entry(279, 4, 1, rgbBytes);             // StripByteCounts
  entry(282, 5, 1, extraOffset + 6);      // XResolution
  entry(283, 5, 1, extraOffset + 14);     // YResolution
  entry(296, 3, 1, 2);                    // ResolutionUnit: inch
  dv.setUint32(p, 0, true);               // next IFD
  dv.setUint16(extraOffset, 8, true); dv.setUint16(extraOffset + 2, 8, true); dv.setUint16(extraOffset + 4, 8, true);
  dv.setUint32(extraOffset + 6, dpi, true); dv.setUint32(extraOffset + 10, 1, true);
  dv.setUint32(extraOffset + 14, dpi, true); dv.setUint32(extraOffset + 18, 1, true);
  let q = dataOffset;
  for (let i = 0; i < nPix; i++) { u8[q++] = data[i * 4]; u8[q++] = data[i * 4 + 1]; u8[q++] = data[i * 4 + 2]; }
  return new Blob([buf], { type: 'image/tiff' });
};

/* Raster export. scale multiplies the base size. dpi is only metadata (PNG/TIFF). */
Fig.toRaster = (svg, { format = 'png', scale = 4, background = '#ffffff', dpi = 300 } = {}) =>
  new Promise((resolve, reject) => {
    const w = +svg.dataset.w || svg.viewBox.baseVal.width || 900;
    const h = +svg.dataset.h || svg.viewBox.baseVal.height || 600;
    /* a transparent background also needs the figure's own background rectangle removed */
    let node = svg;
    if (!background) { node = svg.cloneNode(true); const bg = node.firstElementChild; if (bg && bg.tagName.toLowerCase() === 'rect') bg.setAttribute('fill', 'none'); }
    const src = Fig.serialize(node);
    const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const ctx = c.getContext('2d');
      if (format !== 'png' || background) {
        ctx.fillStyle = background || '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      if (format === 'tiff') {
        try { resolve(Fig.encodeTiff(ctx.getImageData(0, 0, c.width, c.height), dpi)); }
        catch (e) { reject(e); }
        return;
      }
      const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
      c.toBlob(b => {
        if (!b) return reject(new Error('Could not generate the image'));
        if (format === 'png') b.arrayBuffer().then(ab => resolve(new Blob([Fig.pngWithDpi(ab, dpi)], { type: 'image/png' })));
        else resolve(b);
      }, mime, 0.97);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not rasterize the SVG')); };
    img.src = url;
  });

Fig.exportFigure = async (svg, { format = 'png', scale = 4, name = 'figure', background = '#ffffff', dpi = 300 } = {}) => {
  if (format === 'svg') {
    download(new Blob([Fig.serialize(svg)], { type: 'image/svg+xml;charset=utf-8' }), name + '.svg');
    return;
  }
  const blob = await Fig.toRaster(svg, { format, scale, background, dpi });
  download(blob, name + '.' + (format === 'jpg' ? 'jpg' : format === 'tiff' ? 'tif' : format));
};

/* ================= figure block with editor + export bar ================= */
Fig.registry = {};

let measureHost = null;
function measured(svg, fn) {
  if (!measureHost) {
    measureHost = document.createElement('div');
    measureHost.setAttribute('style',
      'position:fixed;left:-100000px;top:0;width:6000px;height:6000px;visibility:hidden;pointer-events:none');
    document.body.appendChild(measureHost);
  }
  measureHost.appendChild(svg);
  try { fn(svg); } finally { measureHost.removeChild(svg); }
}
/* If enlarging fonts pushes text outside the canvas, grow the viewBox instead of clipping. */
function fitViewBox(svg) {
  let b;
  try { b = svg.getBBox(); } catch (e) { return; }
  if (!b || (!b.width && !b.height)) return;
  const w = +svg.dataset.w, h = +svg.dataset.h, pad = 5;
  const x0 = Math.min(0, b.x - pad), y0 = Math.min(0, b.y - pad);
  const x1 = Math.max(w, b.x + b.width + pad), y1 = Math.max(h, b.y + b.height + pad);
  if (x0 === 0 && y0 === 0 && x1 === w && y1 === h) return;
  const nw = x1 - x0, nh = y1 - y0;
  svg.setAttribute('viewBox', `${x0.toFixed(1)} ${y0.toFixed(1)} ${nw.toFixed(1)} ${nh.toFixed(1)}`);
  svg.setAttribute('width', nw.toFixed(1));
  svg.setAttribute('height', nh.toFixed(1));
  svg.dataset.w = nw; svg.dataset.h = nh;
  const bg = svg.firstElementChild;
  if (bg && bg.tagName === 'rect') {
    bg.setAttribute('x', x0.toFixed(1)); bg.setAttribute('y', y0.toFixed(1));
    bg.setAttribute('width', nw.toFixed(1)); bg.setAttribute('height', nh.toFixed(1));
  }
}

/* Controls shared by every figure: style + typography. Their values persist
   across figures and sessions (the user's preferred look is remembered). */
Fig.STYLE_CONTROLS = [
  { key: 'theme', label: 'Theme', type: 'select', options: Object.entries(Fig.themeNames), shared: true },
  { key: 'font', label: 'Font family', type: 'select', options: Object.entries(Fig.fontNames), shared: true },
  { key: 'fontScale', label: 'Font size: all', type: 'range', min: 0.6, max: 2.6, step: 0.05, shared: true },
  { key: 'fsTitle', label: 'Font size: titles', type: 'range', min: 0.6, max: 3, step: 0.05, shared: true },
  { key: 'fsAxis', label: 'Font size: axes & ticks', type: 'range', min: 0.6, max: 3, step: 0.05, shared: true },
  { key: 'fsLabel', label: 'Font size: labels & legend', type: 'range', min: 0.6, max: 3, step: 0.05, shared: true },
  { key: 'axisBold', label: 'Bold axis titles', type: 'checkbox', shared: true },
  { key: 'grid', label: 'Gridlines', type: 'checkbox', shared: true },
  { key: 'gridDash', label: 'Dashed gridlines', type: 'checkbox', shared: true },
  { key: 'width', label: 'Width (px)', type: 'number', min: 400, max: 2400, step: 20 },
  { key: 'height', label: 'Height (px)', type: 'number', min: 300, max: 2000, step: 20 },
];
const SHARED_DEFAULTS = { theme: 'light', font: 'sans', fontScale: 1, fsTitle: 1, fsAxis: 1, fsLabel: 1, axisBold: false, grid: true, gridDash: false };

Fig.mount = (host, spec) => {
  if (typeof host === 'string') host = el(host);
  const hostId = host.id || ('fig_' + Math.random().toString(36).slice(2, 8));
  host.innerHTML = '';
  host.classList.add('fig-block');
  const saved = Prefs.get('figstyle', {});
  const cfg = Object.assign({}, SHARED_DEFAULTS, saved, spec.defaults || {});
  if (cfg.width == null) cfg.width = spec.width || 900;
  if (cfg.height == null) cfg.height = spec.height || 560;

  const head = mk('div', { class: 'fig-head' });
  head.appendChild(mk('h4', null, esc(spec.title || 'Figure')));
  host.appendChild(head);
  const canvas = mk('div', { class: 'fig-canvas' });
  host.appendChild(canvas);

  let current = null;
  function redraw() {
    canvas.innerHTML = '';
    Fig.setFontScale(cfg);
    try { current = spec.render(cfg); } finally { Fig._fs = { title: 1, axis: 1, label: 1 }; }
    measured(current, fitViewBox);
    canvas.appendChild(current);
    updateInfo();
  }
  function persistShared() {
    const s = {};
    Fig.STYLE_CONTROLS.forEach(c => { if (c.shared) s[c.key] = cfg[c.key]; });
    Prefs.set('figstyle', s);
  }

  /* --- editor --- */
  const det = mk('details', { class: 'fig-editor' });
  det.appendChild(mk('summary', null, '⚙ Edit figure — titles, colours, fonts, sizes'));
  const tabs = mk('div', { class: 'fig-tabs' });
  const groups = [
    { name: 'Content & colours', controls: spec.controls || [] },
    { name: 'Style & typography', controls: Fig.STYLE_CONTROLS },
  ];
  groups.forEach((gr, gi) => {
    const tab = mk('button', { class: 'fig-tab' + (gi === 0 ? ' active' : ''), type: 'button' }, gr.name);
    tab.addEventListener('click', () => {
      els('.fig-tab', det).forEach(b => b.classList.remove('active'));
      els('.fig-opts', det).forEach(g => g.style.display = 'none');
      tab.classList.add('active'); gr.grid.style.display = '';
    });
    tabs.appendChild(tab);
  });
  det.appendChild(tabs);
  groups.forEach((gr, gi) => {
    const grid = mk('div', { class: 'fig-opts' });
    if (gi > 0) grid.style.display = 'none';
    gr.grid = grid;
    gr.controls.forEach(c => {
      if (cfg[c.key] == null && c.type === 'range') cfg[c.key] = 1;
      const lab = mk('label', { class: 'inline-label' });
      lab.appendChild(document.createTextNode(c.label + ' '));
      let input;
      const commit = () => { if (c.shared) persistShared(); redraw(); };
      if (c.type === 'select') {
        input = mk('select');
        (c.options || []).forEach(o => {
          const [val, txt] = Array.isArray(o) ? o : [o, o];
          const op = mk('option', { value: val }, esc(txt));
          if (String(cfg[c.key]) === String(val)) op.selected = true;
          input.appendChild(op);
        });
        input.addEventListener('change', () => { cfg[c.key] = input.value; commit(); });
      } else if (c.type === 'checkbox') {
        input = mk('input', { type: 'checkbox' });
        input.checked = !!cfg[c.key];
        input.addEventListener('change', () => { cfg[c.key] = input.checked; commit(); });
        lab.insertBefore(input, lab.firstChild);
        grid.appendChild(lab);
        return;
      } else if (c.type === 'color') {
        input = mk('input', { type: 'color', value: cfg[c.key] || '#4f46a5' });
        input.addEventListener('input', () => { cfg[c.key] = input.value; commit(); });
      } else if (c.type === 'range') {
        input = mk('input', { type: 'range', min: c.min, max: c.max, step: c.step || 1, value: cfg[c.key] });
        const out = mk('span', { class: 'range-val' }, String(cfg[c.key]));
        input.addEventListener('input', () => { cfg[c.key] = +input.value; out.textContent = String(cfg[c.key]); commit(); });
        lab.appendChild(input); lab.appendChild(out);
        grid.appendChild(lab);
        return;
      } else if (c.type === 'number') {
        input = mk('input', { type: 'number', min: c.min, max: c.max, step: c.step || 1, value: cfg[c.key], style: 'width:90px' });
        input.addEventListener('change', () => { cfg[c.key] = +input.value; commit(); });
      } else if (c.type === 'colors') {
        /* one colour picker per series */
        const wrap = mk('div', { class: 'color-row' });
        (c.labels || []).forEach((l, i) => {
          const cur = (cfg[c.key] && cfg[c.key][i]) || Fig.color(cfg.palette, i);
          const ci = mk('input', { type: 'color', value: cur, title: l });
          ci.addEventListener('input', () => { cfg[c.key] = cfg[c.key] || []; cfg[c.key][i] = ci.value; commit(); });
          const sl = mk('span', { class: 'color-item' }); sl.appendChild(ci); sl.appendChild(mk('small', null, esc(l)));
          wrap.appendChild(sl);
        });
        lab.appendChild(wrap);
        grid.appendChild(lab);
        return;
      } else {
        input = mk('input', { type: 'text', value: cfg[c.key] != null ? cfg[c.key] : '', style: 'width:200px' });
        input.addEventListener('change', () => { cfg[c.key] = input.value; commit(); });
      }
      lab.appendChild(input);
      grid.appendChild(lab);
    });
    det.appendChild(grid);
  });
  host.appendChild(det);

  /* --- export bar --- */
  const tools = mk('div', { class: 'fig-tools' });
  const fmt = mk('select');
  [['png', 'PNG'], ['tiff', 'TIFF (journal submission)'], ['svg', 'SVG (vector, editable)'], ['jpg', 'JPG'], ['webp', 'WEBP']]
    .forEach(([v, t]) => fmt.appendChild(mk('option', { value: v }, t)));
  const res = mk('select');
  [['2', 'Screen · 2× (150 dpi)'], ['4', 'High · 4× (300 dpi)'], ['6', 'Very high · 6× (450 dpi)'],
   ['8', 'Publication · 8× (600 dpi)'], ['12', 'Maximum · 12× (900 dpi)']].forEach(([v, t]) => res.appendChild(mk('option', { value: v }, t)));
  res.value = Prefs.get('figres', '4');
  const bgSel = mk('select');
  [['#ffffff', 'White background'], ['transparent', 'Transparent (PNG)']].forEach(([v, t]) => bgSel.appendChild(mk('option', { value: v }, t)));
  const btn = mk('button', { class: 'btn btn-secondary btn-sm' }, '⬇ Download figure');
  const info = mk('span', { class: 'hint', style: 'margin:0' });
  function updateInfo() {
    if (!current) return;
    const w = +current.dataset.w, h = +current.dataset.h, k = +res.value;
    const dpi = k * 75;
    info.textContent = fmt.value === 'svg'
      ? 'Vector: scales without loss; editable in Inkscape, Illustrator or PowerPoint.'
      : `${Math.round(w * k)} × ${Math.round(h * k)} px · ${(w * k / dpi * 2.54).toFixed(1)} × ${(h * k / dpi * 2.54).toFixed(1)} cm at ${dpi} dpi`;
  }
  fmt.addEventListener('change', updateInfo);
  res.addEventListener('change', () => { Prefs.set('figres', res.value); updateInfo(); });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await Fig.exportFigure(current, {
        format: fmt.value, scale: +res.value, dpi: +res.value * 75,
        name: (spec.fileName || slug(spec.title || 'figure')),
        background: bgSel.value === 'transparent' ? null : bgSel.value,
      });
    } catch (e) { alert('Export failed: ' + e.message); }
    btn.disabled = false;
  });
  tools.appendChild(mk('span', { class: 'inline-label' }, 'Format'));
  tools.appendChild(fmt);
  tools.appendChild(mk('span', { class: 'inline-label' }, 'Resolution'));
  tools.appendChild(res);
  tools.appendChild(bgSel);
  tools.appendChild(btn);
  tools.appendChild(info);
  host.appendChild(tools);

  redraw();
  const api = {
    redraw, cfg, hostId, title: spec.title || hostId,
    fileName: spec.fileName || slug(spec.title || hostId),
    get svg() { return current; },
  };
  Fig.registry[hostId] = api;
  return api;
};
Fig.mounted = () => Object.values(Fig.registry).filter(a => {
  const h = document.getElementById(a.hostId);
  if (!h || !a.svg || !document.body.contains(h)) return false;
  for (let n = h; n && n !== document.body; n = n.parentElement) {
    if (n.classList.contains('step-panel')) continue;
    if (n.style && n.style.display === 'none') return false;
  }
  return true;
});

window.Fig = Fig;
