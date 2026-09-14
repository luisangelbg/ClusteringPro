/* ClusteringPro — Block 6 figures: index curves and small multiples, consensus votes, gap statistic,
   bootstrap stability, dendrogram with AU/BP values, comparison of algorithms, external cross-table. */

const P6 = {};
const INDEX_META = {
  wss: { label: 'Within-cluster SS (elbow)', dir: 'knee' }, silhouette: { label: 'Silhouette', dir: 'max' }, ch: { label: 'Calinski–Harabasz', dir: 'max' }, db: { label: 'Davies–Bouldin', dir: 'min' },
  dunn: { label: 'Dunn', dir: 'max' }, gap: { label: 'Gap statistic', dir: 'rule' }, cindex: { label: 'C-index', dir: 'min' }, mcclain: { label: 'McClain–Rao', dir: 'min' }, pbm: { label: 'PBM', dir: 'max' },
  rl: { label: 'Ratkowsky–Lance', dir: 'max' }, hartigan: { label: 'Hartigan', dir: 'rule' }, kl: { label: 'Krzanowski–Lai', dir: 'max' }, bhDiff: { label: 'Ball–Hall (drop)', dir: 'max' }, connectivity: { label: 'Connectivity', dir: 'min' },
};
P6.INDEX_META = INDEX_META;

/* ---------- generic index-vs-k curve ---------- */
P6.curve = (cfg, sw, key, opts) => {
  opts = opts || {};
  const rows = sw.rows, ks = rows.map(r => r.k), ys = rows.map(r => r[key]);
  const ok = ys.map((v, i) => isFinite(v) ? i : -1).filter(i => i >= 0);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const vals = ok.map(i => ys[i]), se = key === 'gap' ? rows.map(r => r.gapSE) : null;
  const lo = Math.min(...vals.map((v, t) => v - (se ? se[ok[t]] : 0))), hi = Math.max(...vals.map((v, t) => v + (se ? se[ok[t]] : 0)));
  const yd = Fig.niceDomain(lo, hi, key === 'wss');
  const x = Fig.scaleLinear(ks[0] - 0.5, ks[ks.length - 1] + 0.5, f.x0, f.x1), y = Fig.scaleLinear(yd[0], yd[1], f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'number of clusters k' }), { ticks: ks });
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || (INDEX_META[key] || { label: key }).label }));
  const g = Fig.g(), c = Fig.color(cfg.palette, 0), hl = Fig.color(cfg.palette, 1);
  if (se) ok.forEach(i => { g.appendChild(Fig.el('line', { x1: x(ks[i]), x2: x(ks[i]), y1: y(ys[i] - se[i]), y2: y(ys[i] + se[i]), stroke: c, 'stroke-width': 1.2 })); [ys[i] - se[i], ys[i] + se[i]].forEach(v => g.appendChild(Fig.el('line', { x1: x(ks[i]) - 4, x2: x(ks[i]) + 4, y1: y(v), y2: y(v), stroke: c, 'stroke-width': 1.2 }))); });
  if (ok.length) g.appendChild(Fig.el('path', { d: 'M' + ok.map(i => `${x(ks[i]).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(' L'), fill: 'none', stroke: c, 'stroke-width': 2.2 }));
  const best = opts.best != null ? opts.best : (sw.votes[key] ? sw.votes[key].k : null);
  ok.forEach(i => g.appendChild(Fig.marker(x(ks[i]), y(ys[i]), ks[i] === best ? 6 : 4, 'circle', { fill: ks[i] === best ? hl : c, stroke: f.t.bg, 'stroke-width': 1 })));
  if (best != null) { g.appendChild(Fig.el('line', { x1: x(best), x2: x(best), y1: f.y0, y2: f.y1, stroke: hl, 'stroke-dasharray': '5 4', 'stroke-width': 1.3 })); g.appendChild(Fig.text(x(best) + 6, f.y0 + 16, `${opts.bestLabel || 'suggested'} k = ${best}`, { size: 12, weight: 'bold', fill: hl, font: f.font, role: 'label' })); }
  if (opts.note) g.appendChild(Fig.text(f.x1 - 6, f.y1 - 8, opts.note, { size: 10, anchor: 'end', fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- small multiples of every index ---------- */
P6.panel = (cfg, sw) => {
  const keys = ['wss', 'silhouette', 'ch', 'db', 'dunn', 'gap', 'cindex', 'mcclain', 'pbm', 'rl', 'hartigan', 'kl'].filter(k => sw.rows.some(r => isFinite(r[k])));
  const cols = 4, rowsN = Math.ceil(keys.length / cols);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 16, right: 16, bottom: 20, top: 50 } });
  const pw = (f.x1 - f.x0) / cols, ph = (f.y1 - f.y0) / rowsN;
  const ks = sw.rows.map(r => r.k), c = Fig.color(cfg.palette, 0), hl = Fig.color(cfg.palette, 1);
  keys.forEach((key, idx) => {
    const px = f.x0 + (idx % cols) * pw + 40, py = f.y0 + Math.floor(idx / cols) * ph + 18, w = pw - 56, h = ph - 46;
    const ys = sw.rows.map(r => r[key]), ok = ys.map((v, i) => isFinite(v) ? i : -1).filter(i => i >= 0);
    const vals = ok.map(i => ys[i]); const lo = Math.min(...vals), hi = Math.max(...vals);
    const x = Fig.scaleLinear(ks[0], ks[ks.length - 1], px, px + w), y = Fig.scaleLinear(lo, hi === lo ? lo + 1 : hi, py + h, py);
    const g = Fig.g();
    g.appendChild(Fig.el('rect', { x: px - 6, y: py - 4, width: w + 12, height: h + 8, fill: 'none', stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, rx: 4 }));
    g.appendChild(Fig.el('path', { d: 'M' + ok.map(i => `${x(ks[i]).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(' L'), fill: 'none', stroke: c, 'stroke-width': 1.6 }));
    const best = sw.votes[key === 'wss' ? 'elbow' : key] ? sw.votes[key === 'wss' ? 'elbow' : key].k : null;
    ok.forEach(i => g.appendChild(Fig.el('circle', { cx: x(ks[i]), cy: y(ys[i]), r: ks[i] === best ? 4.5 : 2.5, fill: ks[i] === best ? hl : c })));
    g.appendChild(Fig.text(px + w / 2, py - 8, `${INDEX_META[key].label}${best != null ? ` → k = ${best}` : ''}`, { size: 10, anchor: 'middle', weight: 'bold', fill: best != null ? hl : f.t.fg, font: f.font, role: 'label' }));
    ks.forEach(k => { if (k === ks[0] || k === ks[ks.length - 1] || k % 2 === 0) g.appendChild(Fig.text(x(k), py + h + 12, String(k), { size: 8, anchor: 'middle', fill: f.t.muted, font: f.font, role: 'tick' })); });
    g.appendChild(Fig.text(px - 8, py + 4, Fig.fmtTick(+hi.toPrecision(2)), { size: 7.5, anchor: 'end', fill: f.t.muted, font: f.font, role: 'tick' }));
    g.appendChild(Fig.text(px - 8, py + h + 3, Fig.fmtTick(+lo.toPrecision(2)), { size: 7.5, anchor: 'end', fill: f.t.muted, font: f.font, role: 'tick' }));
    f.g.appendChild(g);
  });
  return svg;
};

/* ---------- consensus votes ---------- */
P6.votes = (cfg, sw) => {
  const SHORT = { 'Silhouette': 'Silhouette', 'Calinski–Harabasz': 'CH', 'Davies–Bouldin': 'DB', 'Dunn': 'Dunn', 'C-index': 'C-index', 'McClain–Rao': 'McClain', 'PBM': 'PBM', 'Ratkowsky–Lance': 'RL', 'Ball–Hall': 'Ball–Hall', 'Krzanowski–Lai': 'KL', 'Hartigan': 'Hartigan', 'Gap statistic': 'Gap', 'Elbow (WSS)': 'Elbow' };
  const ks = sw.ks, tally = ks.map(k => sw.tally[k] || 0), names = ks.map(k => Object.values(sw.votes).filter(v => v.k === k).map(v => SHORT[v.label] || v.label));
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 64, right: 24, bottom: 56, top: 56 } });
  const band = Fig.scaleBand(ks.map(String), f.x0, f.x1, 0.3), y = Fig.scaleLinear(0, Math.max(...tally, 1) * 1.25, f.y1, f.y0);
  Fig.axisXBand(f, band, ks.map(String), Object.assign({}, cfg, { xlab: cfg.xlab || 'number of clusters k' }), { rotate: 0 });
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'indices voting for k' }), { count: 5, fmt: v => Number.isInteger(v) ? String(v) : '' });
  const g = Fig.g(), best = sw.consensus[0] ? sw.consensus[0].k : null;
  if (sw.votes.gap && sw.votes.gap.k != null && !ks.includes(sw.votes.gap.k)) g.appendChild(Fig.text(f.x1 - 4, f.y0 + 12, `Gap statistic: k = ${sw.votes.gap.k}${sw.votes.gap.k === 1 ? ' (no cluster structure)' : ''}, outside the bars`, { size: 10, anchor: 'end', weight: 'bold', fill: Fig.color(cfg.palette, 1), font: f.font, role: 'label' }));
  ks.forEach((k, i) => { const v = tally[i]; if (!v) return; g.appendChild(Fig.el('rect', { x: band(i), y: y(v), width: band.bandwidth, height: f.y1 - y(v), fill: k === best ? Fig.color(cfg.palette, 1) : Fig.color(cfg.palette, 0), rx: 3 })); g.appendChild(Fig.text(band.center(i), y(v) - 6, String(v), { size: 11, anchor: 'middle', weight: 'bold', fill: f.t.fg, font: f.font, role: 'label' })); if (cfg.names !== false) names[i].forEach((nm, t) => g.appendChild(Fig.text(band.center(i), y(v) + 12 + t * 11, nm, { size: Math.min(9, band.bandwidth / 6), anchor: 'middle', fill: '#fff', font: f.font, role: 'label' }))); });
  f.g.appendChild(g);
  return svg;
};

/* ---------- bootstrap stability ---------- */
P6.stability = (cfg, st) => {
  const cls = st.clusters;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 64, right: 24, bottom: 56, top: 56 } });
  const labels = cls.map(c => `C${c.cluster} (n=${c.n})`);
  const band = Fig.scaleBand(labels, f.x0, f.x1, 0.35), y = Fig.scaleLinear(0, 1.15, f.y1, f.y0);
  Fig.axisXBand(f, band, labels, Object.assign({}, cfg, { xlab: cfg.xlab || 'cluster' }), { rotate: labels.length > 10 ? -35 : 0 });
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'bootstrap Jaccard similarity' }), { ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] });
  const g = Fig.g();
  cls.forEach((c, i) => { const col = c.mean >= 0.75 ? Fig.color(cfg.palette, 0) : c.mean >= 0.5 ? Fig.color(cfg.palette, 1) : (cfg.badColor || '#c93a2c'); g.appendChild(Fig.el('rect', { x: band(i), y: y(c.mean), width: band.bandwidth, height: f.y1 - y(c.mean), fill: col, rx: 3, opacity: 0.85 })); });
  [[0.5, 'dissolved below', '#c93a2c'], [0.75, 'stable above', '#2f9e44']].forEach(([v, t, col]) => { g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(v), y2: y(v), stroke: col, 'stroke-dasharray': '5 4', 'stroke-width': 1.4 })); g.appendChild(Fig.text(f.x1 - 4, y(v) - 4, `${v} · ${t}`, { size: 9, anchor: 'end', fill: col, font: f.font, weight: 'bold', role: 'label', halo: f.t.bg, haloWidth: 3 })); });
  cls.forEach((c, i) => { g.appendChild(Fig.el('line', { x1: band.center(i), x2: band.center(i), y1: y(c.min), y2: y(c.mean), stroke: f.t.fg, 'stroke-width': 1.4 })); g.appendChild(Fig.el('line', { x1: band.center(i) - 6, x2: band.center(i) + 6, y1: y(c.min), y2: y(c.min), stroke: f.t.fg, 'stroke-width': 1.4 })); g.appendChild(Fig.text(band.center(i), y(c.mean) - 6, c.mean.toFixed(2), { size: 11, anchor: 'middle', weight: 'bold', fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 3 })); });
  g.appendChild(Fig.text(f.x0 + 4, y(1.12), `${st.B} bootstrap samples · bars: mean Jaccard · whisker: minimum`, { size: 10, fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- dendrogram with AU / BP values ---------- */
P6.pvDendro = (cfg, pv, labels) => {
  const hc = pv.hc, n = hc.n;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const fs = (+cfg.labelSize || 9) * Fig.fs('label'), labSpace = cfg.labels === 'none' ? 8 : Math.max(...labels.map(l => String(l).length)) * fs * 0.58 + 14;
  const f = Fig.frame(svg, cfg, { margin: { left: 70, right: 24, bottom: labSpace + 24, top: 56 } });
  const g = Fig.g();
  const thr = +cfg.threshold || 0.95;
  const R = Dendro.draw(g, hc, { orient: 'v', x: f.x0, y: f.y0, w: f.x1 - f.x0, h: f.y1 - f.y0, cl: null, clusterColor: () => f.t.fg, neutral: cfg.branchColor || f.t.muted, stroke: +cfg.branchWidth || 1.6 });
  /* boxes around clusters with AU ≥ threshold (largest first so nested ones stay visible) */
  const sig = pv.nodes.filter(nd => nd.au >= thr && nd.size < n).sort((a, b) => b.size - a.size);
  sig.forEach(nd => { const us = nd.members.map(i => R.uLeaf(i)), u0 = Math.min(...us) - 0.5 / n, u1 = Math.max(...us) + 0.5 / n; const p0 = R.map(u0, 0), p1 = R.map(u1, nd.height * 1.02); g.appendChild(Fig.el('rect', { x: p0[0], y: p1[1] - 4, width: p1[0] - p0[0], height: p0[1] - p1[1] + 4, fill: Fig.alpha(cfg.boxColor || '#d64a6a', 0.08), stroke: cfg.boxColor || '#d64a6a', 'stroke-width': 1.2, rx: 3 })); });
  pv.nodes.forEach(nd => { if (nd.size >= n) return; const u = (R.L.nodes[nd.step].x + 0.5) / n, p = R.map(u, nd.height); if (cfg.showAU !== false) g.appendChild(Fig.text(p[0] - 3, p[1] - 4, Math.round(nd.au * 100), { size: +cfg.valueSize || 9, anchor: 'end', fill: cfg.auColor || '#d64a6a', font: f.font, weight: nd.au >= thr ? 'bold' : 'normal', role: 'label', halo: f.t.bg, haloWidth: 2 })); if (cfg.showBP) g.appendChild(Fig.text(p[0] + 3, p[1] - 4, Math.round(nd.bp * 100), { size: +cfg.valueSize || 9, fill: cfg.bpColor || '#2f9e44', font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2 })); });
  if (cfg.labels !== 'none') for (let i = 0; i < n; i++) { const p = R.leafPoint(i); g.appendChild(Fig.text(p[0], p[1] + 8, String(labels[i]), { size: +cfg.labelSize || 9, anchor: 'end', rotate: -90, fill: f.t.fg, font: f.font, role: 'label', baseline: 'middle' })); }
  f.g.appendChild(g);
  Fig.axisY(f, Fig.scaleLinear(0, R.maxH, f.y1, f.y0), Object.assign({}, cfg, { ylab: 'Height' }));
  Fig.legend(f, [{ label: `AU (approximately unbiased) %`, color: cfg.auColor || '#d64a6a', shape: 'circle' }, ...(cfg.showBP ? [{ label: 'BP (bootstrap probability) %', color: cfg.bpColor || '#2f9e44', shape: 'circle' }] : []), { label: `boxes: AU ≥ ${Math.round(thr * 100)} %`, color: cfg.boxColor || '#d64a6a', shape: 'line' }], cfg, { pos: cfg.legendPos || 'right' });
  return svg;
};

/* ---------- comparison of algorithms over k ---------- */
P6.algorithms = (cfg, cv, names) => {
  const measure = cfg.measure || 'silhouette', methods = [...new Set(cv.rows.map(r => r.method))], ks = [...new Set(cv.rows.map(r => r.k))].sort((a, b) => a - b);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 80, top: 56 } });
  const vals = cv.rows.map(r => r[measure]).filter(isFinite), yd = Fig.niceDomain(S.min(vals), S.max(vals));
  const x = Fig.scaleLinear(ks[0] - 0.5, ks[ks.length - 1] + 0.5, f.x0, f.x1), y = Fig.scaleLinear(yd[0], yd[1], f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'number of clusters k' }), { ticks: ks });
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || `${INDEX_META[measure].label} (${INDEX_META[measure].dir === 'min' ? 'lower' : 'higher'} is better)` }));
  const g = Fig.g();
  methods.forEach((m, mi) => { const pts = ks.map(k => { const r = cv.rows.find(q => q.method === m && q.k === k); return r && isFinite(r[measure]) ? [x(k), y(r[measure])] : null; }).filter(Boolean); const c = Fig.color(cfg.palette, mi); if (pts.length) g.appendChild(Fig.el('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), fill: 'none', stroke: c, 'stroke-width': 2 })); pts.forEach(p => g.appendChild(Fig.marker(p[0], p[1], 3.5, Fig.shapes[mi % Fig.shapes.length], { fill: c }))); });
  const b = cv.best[measure]; if (b) { g.appendChild(Fig.el('circle', { cx: x(b.k), cy: y(b[measure]), r: 9, fill: 'none', stroke: '#d64a6a', 'stroke-width': 2 })); g.appendChild(Fig.text(x(b.k) + 12, y(b[measure]) - 8, `best: ${names[b.method] || b.method}, k = ${b.k}`, { size: 11, weight: 'bold', fill: '#d64a6a', font: f.font, role: 'label', halo: f.t.bg, haloWidth: 3 })); }
  f.g.appendChild(g);
  Fig.legend(f, methods.map((m, mi) => ({ label: names[m] || m, color: Fig.color(cfg.palette, mi), shape: 'line' })), cfg, { pos: cfg.legendPos || 'bottom' });
  return svg;
};

/* ---------- external cross-table heat map ---------- */
P6.external = (cfg, ext, titles) => {
  /* rows and columns in natural order (C1, C2, … ; group names alphabetically) */
  const cmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
  const ri = ext.la.map((_, i) => i).sort((a, b) => cmp(ext.la[a], ext.la[b])), ci = ext.lb.map((_, j) => j).sort((a, b) => cmp(ext.lb[a], ext.lb[b]));
  const la = ri.map(i => ext.la[i]), lb = ci.map(j => ext.lb[j]), M = ri.map(i => ci.map(j => ext.M[i][j])), rows = la.length, cols = lb.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 120, right: 90, bottom: 110, top: 56 } });
  const cw = Math.min((f.x1 - f.x0) / cols, 120), ch = Math.min((f.y1 - f.y0) / rows, 70), ox = f.x0, oy = f.y0;
  const cm = Fig.colormaps[cfg.cmap] || Fig.colormaps.viridis, g = Fig.g();
  const rowS = M.map(r => r.reduce((s, v) => s + v, 0));
  M.forEach((r, i) => r.forEach((v, j) => { const t = rowS[i] ? v / rowS[i] : 0; g.appendChild(Fig.el('rect', { x: ox + j * cw, y: oy + i * ch, width: cw - 2, height: ch - 2, fill: cm(t), rx: 3 })); g.appendChild(Fig.text(ox + j * cw + cw / 2, oy + i * ch + ch / 2 + 4, `${v}${cfg.percent ? ` (${Math.round(t * 100)}%)` : ''}`, { size: 11, anchor: 'middle', fill: Fig.onColor(cm(t)), font: f.font, weight: 'bold', role: 'label' })); }));
  la.forEach((l, i) => g.appendChild(Fig.text(ox - 8, oy + i * ch + ch / 2 + 4, `${titles[0]} ${l}`, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' })));
  lb.forEach((l, j) => g.appendChild(Fig.text(ox + j * cw + cw / 2, oy + rows * ch + 10, String(l), { size: 11, anchor: 'end', rotate: -35, fill: f.t.fg, font: f.font, role: 'tick' })));
  g.appendChild(Fig.text(ox + cols * cw / 2, oy - 10, titles[1], { size: 11, anchor: 'middle', fill: f.t.muted, font: f.font, role: 'label' }));
  g.appendChild(Fig.text(ox + cols * cw + 60, oy + rows * ch + 84, `ARI ${ext.ari.toFixed(3)} · NMI ${ext.nmi.toFixed(3)} · purity ${(ext.purity * 100).toFixed(0)} % · χ² p ${ext.pval < 0.001 ? '< 0.001' : '= ' + ext.pval.toFixed(3)}`, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'label' }));
  const bx = ox + cols * cw + 20, bh = rows * ch;
  for (let q = 0; q < 40; q++) g.appendChild(Fig.el('rect', { x: bx, y: oy + q * bh / 40, width: 12, height: bh / 40 + 0.5, fill: cm(1 - q / 39) }));
  g.appendChild(Fig.text(bx + 16, oy + 4, '100 %', { size: 9, fill: f.t.fg, font: f.font, role: 'tick' })); g.appendChild(Fig.text(bx + 16, oy + bh + 3, '0 %', { size: 9, fill: f.t.fg, font: f.font, role: 'tick' })); g.appendChild(Fig.text(bx + 6, oy - 8, 'row %', { size: 9, anchor: 'middle', fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

window.P6 = P6;
