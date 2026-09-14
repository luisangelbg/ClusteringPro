/* ClusteringPro — Block 2 figures: variable spreads, correlation heat map, PCA/MDS preview,
   VAT image, Hopkins statistic and multivariate outliers. All built with the Fig engine. */

const P2 = {};
/* grey ramp (white → black) used by the classical VAT image */
Fig.colormaps.greys = t => { const v = Math.round(255 * (1 - Math.max(0, Math.min(1, isFinite(t) ? t : 0)))); return `rgb(${v},${v},${v})`; };
Fig.colormapNames.greys = 'Greys';

function groupInfo(eda, cfg) {
  if (!eda.groups) return null;
  const levels = [...new Set(eda.groups)];
  const colorOf = i => Fig.color(cfg.palette || 'cluster', levels.indexOf(eda.groups[i]));
  return { levels, colorOf, items: levels.map((l, k) => ({ label: l, color: Fig.color(cfg.palette || 'cluster', k), shape: 'circle' })) };
}
const KIND_COL = { quant: 0, nominal: 1, binary: 2, count: 3, ordinal: 4 };
const KIND_LABEL = { quant: 'quantitative', nominal: 'nominal (dummy)', binary: 'binary', count: 'count', ordinal: 'ordinal' };

/* ---------- 1. Spread of the variables in the working matrix ---------- */
P2.varBox = (cfg, eda) => {
  const which = cfg.which || 'scaled';
  let vars = eda.varStats.filter(v => which === 'scaled' || (v.raw && !v.dummy));
  if (cfg.hideDummy && which === 'scaled') vars = vars.filter(v => !v.dummy);
  if (cfg.sort === 'sd') vars = vars.slice().sort((a, b) => b.sd - a.sd);
  const H = Math.max(300, 90 + vars.length * (+cfg.rowH || 24));
  const svg = Fig.svg(cfg.width, H, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 150, right: 30, bottom: 56, top: 56 } });
  const boxes = vars.map(v => which === 'scaled' ? v.box : v.raw);
  let lo = Infinity, hi = -Infinity;
  boxes.forEach(b => { lo = Math.min(lo, b.whiskerLo, ...b.outliers); hi = Math.max(hi, b.whiskerHi, ...b.outliers); });
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  const dom = Fig.niceDomain(lo, hi), x = Fig.scaleLinear(dom[0], dom[1], f.x0, f.x1);
  const band = Fig.scaleBand(vars.map(v => v.name), f.y0, f.y1, 0.35);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || (which === 'scaled' ? 'value in the working matrix' : 'raw value') }));
  const g = Fig.g();
  vars.forEach((v, i) => {
    const b = boxes[i], y = band.center(i), bw = band.bandwidth, col = Fig.color(cfg.palette, KIND_COL[v.kind] || 0);
    g.appendChild(Fig.text(f.x0 - 8, y + 4, v.name.length > 22 ? v.name.slice(0, 21) + '…' : v.name, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' }));
    g.appendChild(Fig.el('line', { x1: x(b.whiskerLo), x2: x(b.q1), y1: y, y2: y, stroke: col, 'stroke-width': 1.4 }));
    g.appendChild(Fig.el('line', { x1: x(b.q3), x2: x(b.whiskerHi), y1: y, y2: y, stroke: col, 'stroke-width': 1.4 }));
    g.appendChild(Fig.el('rect', { x: x(b.q1), y: y - bw / 2, width: Math.max(1, x(b.q3) - x(b.q1)), height: bw, fill: Fig.alpha(col, 0.35), stroke: col, 'stroke-width': 1.4, rx: 2 }));
    g.appendChild(Fig.el('line', { x1: x(b.median), x2: x(b.median), y1: y - bw / 2, y2: y + bw / 2, stroke: col, 'stroke-width': 2.4 }));
    if (cfg.showMean !== false) g.appendChild(Fig.marker(x(b.mean), y, 3, 'diamond', { fill: f.t.bg, stroke: col, 'stroke-width': 1.2 }));
    b.outliers.forEach(o => g.appendChild(Fig.el('circle', { cx: x(o), cy: y, r: 2.6, fill: 'none', stroke: col, 'stroke-width': 1 })));
  });
  f.g.appendChild(g);
  const kinds = [...new Set(vars.map(v => v.kind))];
  Fig.legend(f, kinds.map(k => ({ label: KIND_LABEL[k] || k, color: Fig.color(cfg.palette, KIND_COL[k] || 0) })), cfg, { pos: cfg.legendPos || 'bottom' });
  return svg;
};

/* ---------- 2. Correlation heat map ---------- */
P2.corrHeat = (cfg, eda) => {
  const names = eda.corr.names, R = eda.corr.R, p = names.length;
  const size = Math.min(cfg.width - 200, cfg.height - 120);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 130, right: 90, bottom: 110, top: 56 } });
  const cell = Math.min((f.x1 - f.x0) / p, (f.y1 - f.y0) / p, size / p);
  const ox = f.x0, oy = f.y0;
  const cmap = Fig.colormaps[cfg.cmap] || Fig.colormaps.rdbu;
  const g = Fig.g();
  const fs = Math.min(11, cell * 0.5);
  for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) {
    const r = R[a][b], t = (r + 1) / 2;
    g.appendChild(Fig.el('rect', { x: ox + b * cell, y: oy + a * cell, width: cell - 1, height: cell - 1, fill: cmap(cfg.cmap === 'rdbu' || !cfg.cmap ? 1 - t : t), rx: 1 }));
    if (cfg.values !== false && p <= 18 && a !== b) g.appendChild(Fig.text(ox + b * cell + cell / 2, oy + a * cell + cell / 2 + fs * 0.35, r.toFixed(2), { size: fs, anchor: 'middle', fill: Math.abs(r) > 0.55 ? '#fff' : f.t.fg, font: f.font, role: 'label' }));
  }
  names.forEach((nm, i) => {
    g.appendChild(Fig.text(ox - 6, oy + i * cell + cell / 2 + 4, nm, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' }));
    g.appendChild(Fig.text(ox + i * cell + cell / 2, oy + p * cell + 8, nm, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick', rotate: -45 }));
  });
  /* colour bar */
  const bx = ox + p * cell + 24, by = oy, bh = p * cell;
  for (let k = 0; k < 40; k++) g.appendChild(Fig.el('rect', { x: bx, y: by + k * bh / 40, width: 12, height: bh / 40 + 0.5, fill: cmap(cfg.cmap === 'rdbu' || !cfg.cmap ? k / 39 : 1 - k / 39) }));
  [['+1', by + 4], ['0', by + bh / 2 + 4], ['−1', by + bh + 4]].forEach(([l, y]) => g.appendChild(Fig.text(bx + 17, y, l, { size: 10, fill: f.t.fg, font: f.font, role: 'tick' })));
  g.appendChild(Fig.text(bx + 6, by - 8, 'r', { size: 11, anchor: 'middle', fill: f.t.muted, font: f.font, italic: true, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- 3. PCA / MDS preview ---------- */
P2.pcaScatter = (cfg, eda) => {
  const S2 = eda.pca.scores, n = S2.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const xs = S2.map(s => s[0]), ys = S2.map(s => s[1]);
  const dx = Fig.niceDomain(S.min(xs), S.max(xs)), dy = Fig.niceDomain(S.min(ys), S.max(ys));
  const x = Fig.scaleLinear(dx[0], dx[1], f.x0, f.x1), y = Fig.scaleLinear(dy[0], dy[1], f.y1, f.y0);
  const ax = eda.pca.kind === 'MDS' ? 'MDS' : 'PC';
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || `${ax}1 (${fmtPct(eda.pca.pct[0] || 0, 1)})` }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || `${ax}2 (${fmtPct(eda.pca.pct[1] || 0, 1)})` }));
  const g = Fig.g();
  g.appendChild(Fig.el('line', { x1: x(0), x2: x(0), y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-dasharray': '4 4', opacity: 0.6 }));
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(0), y2: y(0), stroke: f.t.axis, 'stroke-dasharray': '4 4', opacity: 0.6 }));
  const gi = groupInfo(eda, cfg);
  const col = i => gi ? gi.colorOf(i) : (cfg.pointColor || Fig.color(cfg.palette, 0));
  if (gi && cfg.hulls) gi.levels.forEach((l, k) => {
    const pts = S2.map((s, i) => [x(s[0]), y(s[1]), i]).filter(p => eda.groups[p[2]] === l).map(p => [p[0], p[1]]);
    if (pts.length >= 3) g.appendChild(Fig.el('path', { d: Geom.blobPath(Geom.hull(pts), 8), fill: Fig.alpha(gi.items[k].color, 0.13), stroke: gi.items[k].color, 'stroke-width': 1, 'stroke-opacity': 0.6 }));
  });
  const r = +cfg.pointSize || 4;
  S2.forEach((s, i) => g.appendChild(Fig.marker(x(s[0]), y(s[1]), r, cfg.shape || 'circle', { fill: col(i), stroke: f.t.bg, 'stroke-width': 0.8, opacity: 0.9 })));
  const showLab = cfg.labels === 'all' || (cfg.labels !== 'none' && n <= 60);
  if (showLab) S2.forEach((s, i) => g.appendChild(Fig.text(x(s[0]) + r + 2, y(s[1]) + 3.5, eda.labels[i], { size: +cfg.labelSize || 9, fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 })));
  f.g.appendChild(g);
  if (gi) Fig.legend(f, gi.items, cfg);
  return svg;
};

/* ---------- 4. VAT: ordered dissimilarity image ---------- */
P2.vat = (cfg, eda) => {
  const n = eda.n, ord = eda.vat.order, D = eda.D;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: eda.groups ? 60 : 40, right: 90, bottom: 50, top: 56 } });
  const side = Math.min(f.x1 - f.x0, f.y1 - f.y0);
  const ox = f.x0, oy = f.y0;
  let mx = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][j] > mx) mx = D[i][j];
  const cmap = Fig.colormaps[cfg.cmap] || Fig.colormaps.greys;
  const dark = cfg.cmap === 'greys' || !cfg.cmap; /* greys: small distance = dark, as in the classical VAT */
  const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const t = mx ? D[ord[i]][ord[j]] / mx : 0;
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(cmap(dark ? 1 - t : t));
    const k = (i * n + j) * 4; img.data[k] = +m[1]; img.data[k + 1] = +m[2]; img.data[k + 2] = +m[3]; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const image = Fig.el('image', { x: ox, y: oy, width: side, height: side, href: cv.toDataURL('image/png'), preserveAspectRatio: 'none', style: 'image-rendering:pixelated' });
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', cv.toDataURL('image/png'));
  f.g.appendChild(image);
  f.g.appendChild(Fig.el('rect', { x: ox, y: oy, width: side, height: side, fill: 'none', stroke: f.t.axis }));
  /* group strip */
  const gi = groupInfo(eda, cfg);
  if (gi && cfg.groupStrip !== false) {
    ord.forEach((obs, i) => f.g.appendChild(Fig.el('rect', { x: ox - 14, y: oy + i * side / n, width: 9, height: side / n + 0.4, fill: gi.colorOf(obs) })));
    Fig.legend(f, gi.items, cfg, { pos: cfg.legendPos || 'bottom' });
  }
  f.g.appendChild(Fig.text(ox + side / 2, oy + side + 16, `objects in VAT order (n = ${n})`, { size: 11, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'axis' }));
  /* colour bar */
  const bx = ox + side + 24, bh = side;
  for (let k = 0; k < 50; k++) f.g.appendChild(Fig.el('rect', { x: bx, y: oy + k * bh / 50, width: 12, height: bh / 50 + 0.5, fill: cmap(dark ? 1 - k / 49 : k / 49) }));
  f.g.appendChild(Fig.text(bx + 17, oy + 5, '0', { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  f.g.appendChild(Fig.text(bx + 17, oy + bh + 3, Fig.fmtTick(+mx.toPrecision(3)), { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  f.g.appendChild(Fig.text(bx + 6, oy - 8, 'd', { size: 11, anchor: 'middle', fill: f.t.muted, font: f.font, italic: true, role: 'label' }));
  return svg;
};

/* ---------- 5. Hopkins statistic against its null distribution ---------- */
P2.hopkins = (cfg, eda) => {
  const H = eda.hopkins, m = H.m;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 64, right: 24, bottom: 62, top: 56 } });
  const xmin = Math.max(0, Math.min(H.lo - 0.12, H.H - 0.08)), xmax = Math.min(1, Math.max(H.hi + 0.12, H.H + 0.08));
  const x = Fig.scaleLinear(xmin, xmax, f.x0, f.x1);
  const grid = Array.from({ length: 241 }, (_, i) => xmin + (xmax - xmin) * i / 240);
  const dv = S.kde(H.nullH, grid), peak = Math.max(...dv);
  const y = Fig.scaleLinear(0, peak * 1.2, f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'Hopkins statistic H' }), { count: 8 });
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'density of H for uniform data' }));
  const g = Fig.g();
  const nullCol = cfg.nullColor || '#9a9ab0', obsCol = cfg.obsColor || Fig.color(cfg.palette, 0);
  const dens = t => S.kde(H.nullH, [t])[0];
  const band = grid.filter(t => t >= H.lo && t <= H.hi);
  if (band.length > 1) g.appendChild(Fig.el('path', { d: 'M' + band.map(t => `${x(t).toFixed(1)},${y(dens(t)).toFixed(1)}`).join(' L') + ` L${x(band[band.length - 1]).toFixed(1)},${f.y1} L${x(band[0]).toFixed(1)},${f.y1} Z`, fill: Fig.alpha(nullCol, 0.25) }));
  g.appendChild(Fig.el('path', { d: 'M' + grid.map((t, i) => `${x(t).toFixed(1)},${y(dv[i]).toFixed(1)}`).join(' L'), fill: 'none', stroke: nullCol, 'stroke-width': 2 }));
  H.nullH.forEach(h => g.appendChild(Fig.el('line', { x1: x(h), x2: x(h), y1: f.y1 - 8, y2: f.y1 - 1, stroke: nullCol, 'stroke-width': 1, opacity: 0.6 })));
  /* the observed label goes on the side of the line with more room; the null-distribution caption
     takes the opposite corner, or drops one row when the two texts would collide */
  const left = x(H.H) - f.x0 > f.x1 - x(H.H);
  const capW = 6.2 * 52, labW = 7 * 46;
  const collide = left ? (x(H.H) - 8) > (f.x1 - 8 - capW) : (x(H.H) + 8) < (f.x0 + 8 + capW);
  const capY = collide ? f.y0 + 48 : f.y0 + 16;
  g.appendChild(Fig.text(left ? f.x1 - 8 : f.x0 + 8, capY, `uniform data, same n, p and range (${H.nsim} simulations)`, { size: 11, anchor: left ? 'end' : 'start', fill: f.t.muted, font: f.font, role: 'label' }));
  g.appendChild(Fig.text(left ? f.x1 - 8 : f.x0 + 8, capY + 15, `95 % band ${H.lo.toFixed(2)}–${H.hi.toFixed(2)} · mean ${H.nullMean.toFixed(2)}`, { size: 11, anchor: left ? 'end' : 'start', fill: f.t.muted, font: f.font, role: 'label' }));
  /* observed draws and mean */
  H.runs.forEach(h => g.appendChild(Fig.el('line', { x1: x(h), x2: x(h), y1: f.y1 - 18, y2: f.y1 - 9, stroke: obsCol, 'stroke-width': 1.2, opacity: 0.8 })));
  g.appendChild(Fig.el('line', { x1: x(H.H), x2: x(H.H), y1: f.y0, y2: f.y1, stroke: obsCol, 'stroke-width': 2.2, 'stroke-dasharray': '6 3' }));
  const lx = left ? x(H.H) - 8 : x(H.H) + 8;
  g.appendChild(Fig.text(lx, f.y0 + 16, `observed H = ${H.H.toFixed(3)} (±${H.sd.toFixed(3)}, 20 draws, m = ${m})`, { size: 12, anchor: left ? 'end' : 'start', fill: obsCol, font: f.font, weight: 'bold', role: 'label' }));
  g.appendChild(Fig.text(lx, f.y0 + 32, `p ${H.pval < 0.001 ? '< 0.001' : '= ' + H.pval.toFixed(3)} · ` + (H.pval <= 0.05 && H.H >= 0.7 ? 'clear tendency to cluster' : H.pval <= 0.05 ? 'detectable but modest tendency' : H.H >= 0.62 ? 'moderate tendency' : 'close to spatial randomness'), { size: 11, anchor: left ? 'end' : 'start', fill: f.t.fg, font: f.font, role: 'label' }));
  g.appendChild(Fig.text(x(H.H) + (left ? -6 : 6), f.y1 - 22, 'upper ticks: observed draws · lower ticks: simulations', { size: 9, anchor: left ? 'end' : 'start', fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- 6. Multivariate outliers: Mahalanobis D² per object ---------- */
P2.outliers = (cfg, eda) => {
  const M = eda.maha, n = eda.n;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 70, right: 24, bottom: 62, top: 56 } });
  const order = cfg.sort ? M.d2.map((d, i) => i).sort((a, b) => M.d2[a] - M.d2[b]) : M.d2.map((_, i) => i);
  const x = Fig.scaleLinear(0, n + 1, f.x0, f.x1);
  const top = Math.max(S.max(M.d2), M.thresholdStrict) * 1.1;
  const y = Fig.scaleLinear(0, top, f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || (cfg.sort ? 'objects sorted by D²' : 'object (row order)') }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || `Mahalanobis D² (df = ${M.df})` }));
  const g = Fig.g();
  const gi = groupInfo(eda, cfg);
  const col = i => gi ? gi.colorOf(i) : Fig.color(cfg.palette, 0);
  const warnCol = cfg.warnColor || '#d64a6a';
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(M.threshold), y2: y(M.threshold), stroke: warnCol, 'stroke-dasharray': '5 4', 'stroke-width': 1.3 }));
  g.appendChild(Fig.text(f.x0 + 6, y(M.threshold) - 4, 'χ² 97.5 % (suspect)', { size: 10, anchor: 'start', fill: warnCol, font: f.font, role: 'label' }));
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(M.thresholdStrict), y2: y(M.thresholdStrict), stroke: warnCol, 'stroke-width': 1.6 }));
  g.appendChild(Fig.text(f.x0 + 6, y(M.thresholdStrict) - 4, 'χ² 99.9 % (extreme)', { size: 10, anchor: 'start', fill: warnCol, font: f.font, role: 'label' }));
  order.forEach((i, k) => {
    const px = x(k + 1), py = y(M.d2[i]);
    g.appendChild(Fig.el('line', { x1: px, x2: px, y1: f.y1, y2: py, stroke: col(i), 'stroke-width': 1, opacity: 0.35 }));
    g.appendChild(Fig.marker(px, py, +cfg.pointSize || 3.5, 'circle', { fill: M.d2[i] > M.threshold ? warnCol : col(i), stroke: f.t.bg, 'stroke-width': 0.8 }));
    if (M.d2[i] > M.threshold) g.appendChild(Fig.text(px, py - 7, eda.labels[i], { size: 9, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 }));
  });
  f.g.appendChild(g);
  if (gi) Fig.legend(f, gi.items, cfg);
  return svg;
};

/* ---------- mount everything ---------- */
P2.mountAll = eda => {
  const pal = { key: 'palette', label: 'Palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  const leg = { key: 'legendPos', label: 'Legend position', type: 'select', options: [['right', 'Top right'], ['left', 'Top left'], ['bottom', 'Below the plot'], ['none', 'Hidden']] };
  const show = (id, on) => { el(id).style.display = on ? '' : 'none'; };
  const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">Figure "${esc(spec.title)}" could not be drawn: ${esc(e.message)}</div>`; } };
  mount('figVarBox', {
    title: 'Spread of every variable after preprocessing', fileName: 'variable_spreads', width: 900, height: 420,
    defaults: { palette: 'cluster', title: 'Variables in the working matrix', which: 'scaled', sort: 'none', rowH: 24, hideDummy: false, showMean: true, legendPos: 'bottom' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'which', label: 'Values', type: 'select', options: [['scaled', 'after transformation and scaling'], ['raw', 'raw (numeric variables)']] },
      { key: 'sort', label: 'Order', type: 'select', options: [['none', 'as in the table'], ['sd', 'by spread']] }, { key: 'rowH', label: 'Row height', type: 'range', min: 14, max: 40, step: 1 },
      { key: 'hideDummy', label: 'Hide dummy columns', type: 'checkbox' }, { key: 'showMean', label: 'Show mean (◇)', type: 'checkbox' }, pal, leg],
    render: cfg => P2.varBox(cfg, eda),
  });
  show('figCorr', !!eda.corr);
  if (eda.corr) Fig.mount('figCorr', {
    title: 'Correlation between the numeric variables', fileName: 'correlation_heatmap', width: 760, height: 640,
    defaults: { title: 'Pearson correlation matrix', cmap: 'rdbu', values: true },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }, { key: 'values', label: 'Show values', type: 'checkbox' }],
    render: cfg => P2.corrHeat(cfg, eda),
  });
  mount('figPCA', {
    title: `${eda.pca.kind} preview of the objects`, fileName: eda.pca.kind.toLowerCase() + '_preview', width: 900, height: 600,
    defaults: { palette: 'cluster', title: `${eda.pca.kind} map of the objects`, subtitle: eda.groups ? 'coloured by the known grouping' : '', labels: 'auto', labelSize: 9, pointSize: 4.5, hulls: true, shape: 'circle', legendPos: 'right', pointColor: '#4f46a5' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' }, { key: 'xlab', label: 'X axis title', type: 'text' }, { key: 'ylab', label: 'Y axis title', type: 'text' },
      { key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'automatic (n ≤ 60)'], ['all', 'all'], ['none', 'none']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 6, max: 16, step: 0.5 },
      { key: 'pointSize', label: 'Point size', type: 'range', min: 2, max: 10, step: 0.5 }, { key: 'shape', label: 'Point shape', type: 'select', options: Fig.shapes }, { key: 'hulls', label: 'Convex hulls per group', type: 'checkbox' },
      { key: 'pointColor', label: 'Point colour (no groups)', type: 'color' }, pal, leg],
    render: cfg => P2.pcaScatter(cfg, eda),
  });
  mount('figVAT', {
    title: 'VAT image: visual assessment of clustering tendency', fileName: 'vat_image', width: 760, height: 640,
    defaults: { palette: 'cluster', title: 'Ordered dissimilarity image (VAT)', subtitle: 'dark blocks along the diagonal = groups of mutually close objects', cmap: 'greys', groupStrip: true, legendPos: 'bottom' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' }, { key: 'cmap', label: 'Colour map', type: 'select', options: [['greys', 'Greys (classical VAT)']].concat(Object.entries(Fig.colormapNames).filter(e => e[0] !== 'greys')) },
      { key: 'groupStrip', label: 'Known-group strip', type: 'checkbox' }, pal, leg],
    render: cfg => P2.vat(cfg, eda),
  });
  show('figHopkins', !!eda.hopkins);
  if (eda.hopkins) Fig.mount('figHopkins', {
    title: 'Hopkins statistic', fileName: 'hopkins_statistic', width: 900, height: 420,
    defaults: { palette: 'cluster', title: 'Clustering tendency: observed Hopkins statistic vs. the no-structure distribution', obsColor: '#4f46a5', nullColor: '#9a9ab0' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'obsColor', label: 'Observed colour', type: 'color' }, { key: 'nullColor', label: 'Null curve colour', type: 'color' }, pal],
    render: cfg => P2.hopkins(cfg, eda),
  });
  show('figOutliers', !!eda.maha);
  if (eda.maha) Fig.mount('figOutliers', {
    title: 'Multivariate outliers', fileName: 'mahalanobis_outliers', width: 900, height: 460,
    defaults: { palette: 'cluster', title: 'Mahalanobis distance of every object to the multivariate centre', sort: false, pointSize: 3.5, warnColor: '#d64a6a', legendPos: 'right' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'sort', label: 'Sort objects by D²', type: 'checkbox' }, { key: 'pointSize', label: 'Point size', type: 'range', min: 2, max: 8, step: 0.5 }, { key: 'warnColor', label: 'Outlier colour', type: 'color' }, pal, leg],
    render: cfg => P2.outliers(cfg, eda),
  });
};
window.P2 = P2;
