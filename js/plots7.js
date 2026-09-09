/* ClusteringPro — Block 7 figures: heat map of cluster means, radar, parallel coordinates, box-plot grid,
   categorical composition, indicator values, LDA map and classification tree. */

const P7 = {};

function topVars(PRF, cfg, max) { const vars = PRF.quant.slice().sort((a, b) => (b.F || 0) - (a.F || 0)); return cfg.allVars ? vars : vars.slice(0, max || 12); }

/* ---------- 1. heat map of cluster profiles ---------- */
P7.meansHeat = (cfg, PRF) => {
  const vars = topVars(PRF, cfg, 30), k = PRF.k, kind = cfg.value || 'z';
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const labW = Math.max(...vars.map(v => v.name.length)) * 10 * 0.58 * Fig.fs('tick') + 16;
  const f = Fig.frame(svg, cfg, { margin: { left: 90, right: 90, bottom: labW + 10, top: 56 } });
  const cw = (f.x1 - f.x0) / vars.length, ch = Math.min((f.y1 - f.y0) / k, 60);
  const val = (v, c) => kind === 'vtest' ? v.clusters[c].vtest : kind === 'mean' ? v.clusters[c].mean : v.clusters[c].z;
  const vals = vars.flatMap(v => v.clusters.map((_, c) => val(v, c))).filter(isFinite);
  const lim = kind === 'mean' ? null : Math.max(...vals.map(Math.abs), 1e-9);
  const cm = Fig.colormaps[cfg.cmap] || Fig.colormaps.rdbu, g = Fig.g();
  vars.forEach((v, j) => { const mn = kind === 'mean' ? Math.min(...v.clusters.map(c => c.mean)) : 0, mx = kind === 'mean' ? Math.max(...v.clusters.map(c => c.mean)) : 0; for (let c = 0; c < k; c++) { const x = val(v, c); const t = kind === 'mean' ? (mx > mn ? (x - mn) / (mx - mn) : 0.5) : 0.5 + 0.5 * Math.max(-1, Math.min(1, x / lim)); const col = cm(kind === 'mean' ? t : 1 - t); g.appendChild(Fig.el('rect', { x: f.x0 + j * cw, y: f.y0 + c * ch, width: cw - 1.5, height: ch - 1.5, fill: col, rx: 2 })); if (cfg.values !== false && cw > 34) g.appendChild(Fig.text(f.x0 + j * cw + cw / 2, f.y0 + c * ch + ch / 2 + 4, kind === 'mean' ? fmtNum(x, 2) : x.toFixed(1), { size: Math.min(10, cw * 0.28), anchor: 'middle', fill: Fig.onColor(col), font: f.font, role: 'label', weight: kind === 'vtest' && Math.abs(x) > 1.96 ? 'bold' : 'normal' })); } g.appendChild(Fig.text(f.x0 + j * cw + cw / 2 + 4, f.y0 + k * ch + 8, v.name, { size: 10, anchor: 'end', rotate: -60, fill: f.t.fg, font: f.font, role: 'tick' })); });
  for (let c = 0; c < k; c++) g.appendChild(Fig.text(f.x0 - 8, f.y0 + c * ch + ch / 2 + 4, `Cluster ${c + 1} (n = ${PRF.sizes[c + 1] || 0})`, { size: 11, anchor: 'end', fill: Fig.color(cfg.palette, c), font: f.font, weight: 'bold', role: 'tick' }));
  const bx = f.x1 + 20, bh = k * ch;
  for (let q = 0; q < 40; q++) g.appendChild(Fig.el('rect', { x: bx, y: f.y0 + q * bh / 40, width: 12, height: bh / 40 + 0.5, fill: cm(kind === 'mean' ? 1 - q / 39 : q / 39) }));
  g.appendChild(Fig.text(bx + 16, f.y0 + 4, kind === 'mean' ? 'max' : `+${lim.toFixed(1)}`, { size: 9, fill: f.t.fg, font: f.font, role: 'tick' })); g.appendChild(Fig.text(bx + 16, f.y0 + bh + 3, kind === 'mean' ? 'min' : `−${lim.toFixed(1)}`, { size: 9, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 6, f.y0 - 8, kind === 'vtest' ? 'v' : kind === 'mean' ? 'mean' : 'z', { size: 10, anchor: 'middle', fill: f.t.muted, font: f.font, italic: true, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- 2. radar ---------- */
P7.radar = (cfg, PRF) => {
  const vars = topVars(PRF, cfg, +cfg.maxVars || 10), k = PRF.k, m = vars.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 24, right: 24, bottom: 24, top: 56 } });
  const cx = (f.x0 + f.x1) / 2 - (cfg.legendPos === 'right' ? 70 : 0), cy = (f.y0 + f.y1) / 2, R = Math.min(f.x1 - f.x0, f.y1 - f.y0) / 2 - 70;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / m;
  const scale = (v, c) => { const means = v.clusters.map(x => x.mean); const lo = cfg.scaleBy === 'data' ? S.min(v.groups.flat()) : Math.min(...means), hi = cfg.scaleBy === 'data' ? S.max(v.groups.flat()) : Math.max(...means); return hi > lo ? (v.clusters[c].mean - lo) / (hi - lo) : 0.5; };
  const g = Fig.g();
  [0.25, 0.5, 0.75, 1].forEach(t => g.appendChild(Fig.el('polygon', { points: vars.map((_, i) => `${cx + R * t * Math.cos(ang(i))},${cy + R * t * Math.sin(ang(i))}`).join(' '), fill: 'none', stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid })));
  vars.forEach((v, i) => { g.appendChild(Fig.el('line', { x1: cx, y1: cy, x2: cx + R * Math.cos(ang(i)), y2: cy + R * Math.sin(ang(i)), stroke: f.t.axis, opacity: 0.6 })); const lx = cx + (R + 14) * Math.cos(ang(i)), ly = cy + (R + 14) * Math.sin(ang(i)); g.appendChild(Fig.text(lx, ly + 4, v.name, { size: +cfg.labelSize || 10, anchor: Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end', fill: f.t.fg, font: f.font, role: 'label' })); });
  for (let c = 0; c < k; c++) { const col = Fig.color(cfg.palette, c), pts = vars.map((v, i) => { const t = 0.05 + 0.95 * scale(v, c); return [cx + R * t * Math.cos(ang(i)), cy + R * t * Math.sin(ang(i))]; }); g.appendChild(Fig.el('polygon', { points: pts.map(p => p.join(',')).join(' '), fill: Fig.alpha(col, +cfg.fillAlpha || 0.15), stroke: col, 'stroke-width': +cfg.lineWidth || 2 })); pts.forEach(p => g.appendChild(Fig.el('circle', { cx: p[0], cy: p[1], r: 3, fill: col }))); }
  f.g.appendChild(g);
  Fig.legend(f, Array.from({ length: k }, (_, c) => ({ label: `Cluster ${c + 1} (n = ${PRF.sizes[c + 1] || 0})`, color: Fig.color(cfg.palette, c), shape: 'line' })), cfg, { pos: cfg.legendPos || 'right' });
  return svg;
};

/* ---------- 3. parallel coordinates ---------- */
P7.parallel = (cfg, PRF) => {
  const vars = topVars(PRF, cfg, +cfg.maxVars || 12), k = PRF.k;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 60, right: 24, bottom: 90, top: 56 } });
  const xs = vars.map((_, i) => f.x0 + (vars.length === 1 ? 0.5 : i / (vars.length - 1)) * (f.x1 - f.x0));
  const zObj = (v, i) => v.sd > 0 ? (v.groups.flat()[i] - v.mean) / v.sd : 0;
  const lim = Math.max(2.5, ...vars.flatMap(v => v.clusters.map(c => Math.abs(c.z))));
  const y = Fig.scaleLinear(-lim, lim, f.y1, f.y0);
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'standardised value (z)' }));
  const g = Fig.g();
  xs.forEach((x, i) => { g.appendChild(Fig.el('line', { x1: x, x2: x, y1: f.y0, y2: f.y1, stroke: f.t.axis, opacity: 0.5 })); g.appendChild(Fig.text(x, f.y1 + 14, vars[i].name, { size: 10, anchor: 'end', rotate: -40, fill: f.t.fg, font: f.font, role: 'tick' })); });
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(0), y2: y(0), stroke: f.t.axis, 'stroke-dasharray': '4 4' }));
  if (cfg.objects && PRF.cl) { const order = []; vars.forEach(v => { let t = 0; order.push(v.groups.map((gA, c) => gA.map(() => c))); }); const n = PRF.cl.length; for (let i = 0; i < n; i++) { const pts = vars.map((v, j) => { const col = PRF.X.map(r => r[v.index]); return `${xs[j]},${y(v.sd > 0 ? (col[i] - v.mean) / v.sd : 0)}`; }); g.appendChild(Fig.el('path', { d: 'M' + pts.join(' L'), fill: 'none', stroke: Fig.color(cfg.palette, PRF.cl[i] - 1), 'stroke-width': 0.8, opacity: 0.25 })); } }
  for (let c = 0; c < k; c++) { const col = Fig.color(cfg.palette, c); const pts = vars.map((v, j) => [xs[j], y(v.clusters[c].z)]); g.appendChild(Fig.el('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), fill: 'none', stroke: col, 'stroke-width': +cfg.lineWidth || 2.5 })); pts.forEach(p => g.appendChild(Fig.el('circle', { cx: p[0], cy: p[1], r: 3.5, fill: col, stroke: f.t.bg }))); }
  f.g.appendChild(g);
  Fig.legend(f, Array.from({ length: k }, (_, c) => ({ label: `Cluster ${c + 1}`, color: Fig.color(cfg.palette, c), shape: 'line' })), cfg);
  return svg;
};

/* ---------- 4. box-plot grid ---------- */
P7.boxGrid = (cfg, PRF) => {
  const vars = topVars(PRF, cfg, +cfg.maxVars || 12), k = PRF.k, cols = Math.min(4, vars.length), rowsN = Math.ceil(vars.length / cols);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 16, right: 16, bottom: 16, top: 50 } });
  const pw = (f.x1 - f.x0) / cols, ph = (f.y1 - f.y0) / rowsN;
  vars.forEach((v, idx) => {
    const px = f.x0 + (idx % cols) * pw + 44, py = f.y0 + Math.floor(idx / cols) * ph + 22, w = pw - 60, h = ph - 52;
    const all = v.groups.flat(), lo = S.min(all), hi = S.max(all), y = Fig.scaleLinear(lo, hi === lo ? lo + 1 : hi, py + h, py);
    const band = Fig.scaleBand(v.groups.map((_, c) => String(c)), px, px + w, 0.3), g = Fig.g();
    g.appendChild(Fig.el('rect', { x: px - 6, y: py - 4, width: w + 12, height: h + 8, fill: 'none', stroke: f.t.grid === 'none' ? f.t.axis : f.t.grid, rx: 4 }));
    v.groups.forEach((a, c) => { if (!a.length) return; const b = S.boxStats(a), col = Fig.color(cfg.palette, c), x = band.center(c), bw = band.bandwidth; g.appendChild(Fig.el('line', { x1: x, x2: x, y1: y(b.whiskerLo), y2: y(b.whiskerHi), stroke: col })); g.appendChild(Fig.el('rect', { x: x - bw / 2, y: y(b.q3), width: bw, height: Math.max(1, y(b.q1) - y(b.q3)), fill: Fig.alpha(col, 0.35), stroke: col, rx: 2 })); g.appendChild(Fig.el('line', { x1: x - bw / 2, x2: x + bw / 2, y1: y(b.median), y2: y(b.median), stroke: col, 'stroke-width': 2 })); b.outliers.forEach(o => g.appendChild(Fig.el('circle', { cx: x, cy: y(o), r: 2, fill: 'none', stroke: col }))); g.appendChild(Fig.text(x, py + h + 12, `C${c + 1}`, { size: 8, anchor: 'middle', fill: f.t.muted, font: f.font, role: 'tick' })); });
    g.appendChild(Fig.text(px + w / 2, py - 9, `${v.name}${isFinite(v.p) ? ` · p ${v.p < 0.001 ? '< 0.001' : '= ' + v.p.toFixed(3)}` : ''}`, { size: 10, anchor: 'middle', weight: 'bold', fill: f.t.fg, font: f.font, role: 'label' }));
    g.appendChild(Fig.text(px - 8, py + 4, Fig.fmtTick(+hi.toPrecision(3)), { size: 7.5, anchor: 'end', fill: f.t.muted, font: f.font, role: 'tick' })); g.appendChild(Fig.text(px - 8, py + h + 3, Fig.fmtTick(+lo.toPrecision(3)), { size: 7.5, anchor: 'end', fill: f.t.muted, font: f.font, role: 'tick' }));
    f.g.appendChild(g);
  });
  return svg;
};

/* ---------- 5. categorical composition ---------- */
P7.catBars = (cfg, cats, k) => {
  const use = cats.slice(0, +cfg.maxVars || 4), cols = Math.min(2, use.length), rowsN = Math.ceil(use.length / cols);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 16, right: 16, bottom: 16, top: 50 } });
  const pw = (f.x1 - f.x0) / cols, ph = (f.y1 - f.y0) / rowsN;
  use.forEach((cv, idx) => {
    const px = f.x0 + (idx % cols) * pw + 44, py = f.y0 + Math.floor(idx / cols) * ph + 24, w = pw - 200, h = ph - 60;
    const band = Fig.scaleBand(Array.from({ length: k }, (_, c) => String(c)), px, px + w, 0.3), y = Fig.scaleLinear(0, 1, py + h, py), g = Fig.g();
    for (let c = 0; c < k; c++) { let acc = 0; cv.levels.forEach((l, li) => { const p = cv.nc[c] ? cv.counts[li][c] / cv.nc[c] : 0; if (!p) return; g.appendChild(Fig.el('rect', { x: band(c), y: y(acc + p), width: band.bandwidth, height: y(acc) - y(acc + p), fill: Fig.color(cfg.catPalette || 'set2', li), stroke: f.t.bg, 'stroke-width': 0.8 })); if (p > 0.12) g.appendChild(Fig.text(band.center(c), y(acc + p / 2) + 3, `${Math.round(p * 100)}%`, { size: 8, anchor: 'middle', fill: Fig.onColor(Fig.color(cfg.catPalette || 'set2', li)), font: f.font, role: 'label' })); acc += p; }); g.appendChild(Fig.text(band.center(c), py + h + 12, `C${c + 1}`, { size: 9, anchor: 'middle', fill: Fig.color(cfg.palette, c), weight: 'bold', font: f.font, role: 'tick' })); }
    g.appendChild(Fig.text(px + w / 2, py - 10, `${cv.name} · χ² p ${cv.p < 0.001 ? '< 0.001' : '= ' + cv.p.toFixed(3)} · V = ${cv.cramer.toFixed(2)}`, { size: 10, anchor: 'middle', weight: 'bold', fill: f.t.fg, font: f.font, role: 'label' }));
    cv.levels.forEach((l, li) => { g.appendChild(Fig.el('rect', { x: px + w + 14, y: py + li * 14, width: 10, height: 10, fill: Fig.color(cfg.catPalette || 'set2', li), rx: 2 })); g.appendChild(Fig.text(px + w + 28, py + li * 14 + 9, String(l).slice(0, 22), { size: 9, fill: f.t.fg, font: f.font, role: 'label' })); });
    f.g.appendChild(g);
  });
  return svg;
};

/* ---------- 6. indicator values ---------- */
P7.indval = (cfg, iv, k) => {
  const rows = iv.slice().sort((a, b) => b.max - a.max).slice(0, +cfg.maxVars || 20);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const labW = Math.max(...rows.map(r => r.name.length)) * 10 * 0.6 + 16;
  const f = Fig.frame(svg, cfg, { margin: { left: labW + 20, right: 120, bottom: 56, top: 56 } });
  const x = Fig.scaleLinear(0, 1, f.x0, f.x1), band = Fig.scaleBand(rows.map(r => r.name), f.y0, f.y1, 0.3);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'indicator value (specificity × fidelity)' }), { fmt: v => Math.round(v * 100) + ' %' });
  const g = Fig.g();
  rows.forEach((r, i) => { const col = Fig.color(cfg.palette, r.best), yv = band(i); g.appendChild(Fig.el('rect', { x: x(0), y: yv, width: x(r.max) - x(0), height: band.bandwidth, fill: col, rx: 2, opacity: r.p < 0.05 ? 0.95 : 0.4 })); g.appendChild(Fig.text(f.x0 - 8, yv + band.bandwidth / 2 + 4, r.name, { size: 10, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick', italic: !!cfg.italic })); g.appendChild(Fig.text(x(r.max) + 6, yv + band.bandwidth / 2 + 4, `C${r.best + 1} · A ${Math.round(r.A * 100)} % · B ${Math.round(r.B * 100)} %${r.p < 0.05 ? ' *' : ''}`, { size: 9, fill: f.t.fg, font: f.font, role: 'label' })); });
  g.appendChild(Fig.text(f.x1, f.y0 - 6, `* p < 0.05 (${rows[0] ? rows[0].nperm : 0} permutations) · faded bars: not significant`, { size: 9, anchor: 'end', fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  Fig.legend(f, Array.from({ length: k }, (_, c) => ({ label: `Cluster ${c + 1}`, color: Fig.color(cfg.palette, c) })), cfg, { pos: cfg.legendPos || 'bottom' });
  return svg;
};

/* ---------- 7. LDA map ---------- */
P7.lda = (cfg, L) => {
  const M = L.model, k = M.k, S2 = M.scores, n = S2.length, q = M.axes.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const col = c => Fig.color(cfg.palette, c - 1);
  const g = Fig.g();
  if (q >= 2) {
    const xs = S2.map(s => s[0]), ys = S2.map(s => s[1]);
    const dx = Fig.niceDomain(S.min(xs), S.max(xs)), dy = Fig.niceDomain(S.min(ys), S.max(ys));
    const x = Fig.scaleLinear(dx[0], dx[1], f.x0, f.x1), y = Fig.scaleLinear(dy[0], dy[1], f.y1, f.y0);
    Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || `LD1 (${fmtPct(M.pct[0], 1)} of the discriminating variance)` }));
    Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || `LD2 (${fmtPct(M.pct[1], 1)})` }));
    for (let c = 1; c <= k; c++) { const pts = S2.filter((_, i) => L.cl[i] === c).map(s => [s[0], s[1]]); if (pts.length >= 3 && cfg.ellipses !== false) { const mx = S.mean(pts.map(p => p[0])), my = S.mean(pts.map(p => p[1])); let sxx = 0, syy = 0, sxy = 0; pts.forEach(p => { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }); const n1 = pts.length - 1; sxx /= n1; syy /= n1; sxy /= n1; const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + disc, l2 = Math.max(tr / 2 - disc, 1e-12), ang = Math.atan2(l1 - sxx, sxy || 1e-12), a = Math.sqrt(5.991 * l1), b = Math.sqrt(5.991 * l2); const d = 'M' + Array.from({ length: 73 }, (_, t) => { const th = t / 72 * 2 * Math.PI, ex = a * Math.cos(th), ey = b * Math.sin(th); return `${x(mx + ex * Math.cos(ang) - ey * Math.sin(ang)).toFixed(1)},${y(my + ex * Math.sin(ang) + ey * Math.cos(ang)).toFixed(1)}`; }).join(' L') + ' Z'; g.appendChild(Fig.el('path', { d, fill: Fig.alpha(col(c), 0.12), stroke: col(c), 'stroke-width': 1.2 })); } }
    S2.forEach((s, i) => g.appendChild(Fig.marker(x(s[0]), y(s[1]), +cfg.pointSize || 4.5, L.pred && L.pred[i] !== L.cl[i] ? 'cross' : 'circle', { fill: col(L.cl[i]), stroke: f.t.bg, 'stroke-width': 0.8 })));
    M.centersLD.forEach((c, ci) => { g.appendChild(Fig.marker(x(c[0]), y(c[1]), 8, 'diamond', { fill: col(ci + 1), stroke: f.t.bg, 'stroke-width': 1.6 })); g.appendChild(Fig.text(x(c[0]), y(c[1]) - 12, `C${ci + 1}`, { size: 11, anchor: 'middle', weight: 'bold', fill: col(ci + 1), font: f.font, role: 'label', halo: f.t.bg, haloWidth: 3 })); });
    if (cfg.labels === 'all' || (cfg.labels !== 'none' && n <= 60)) S2.forEach((s, i) => g.appendChild(Fig.text(x(s[0]) + 6, y(s[1]) + 3.5, L.labels[i], { size: +cfg.labelSize || 9, fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 })));
    g.appendChild(Fig.text(f.x1 - 6, f.y1 - 8, '✕ = misclassified by the discriminant rule', { size: 9, anchor: 'end', fill: f.t.muted, font: f.font, role: 'label' }));
  } else {
    const xs = S2.map(s => s[0]), dx = Fig.niceDomain(S.min(xs), S.max(xs)), x = Fig.scaleLinear(dx[0], dx[1], f.x0, f.x1);
    Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'LD1' }));
    const rowH = (f.y1 - f.y0) / k;
    for (let c = 1; c <= k; c++) { const vals = xs.filter((_, i) => L.cl[i] === c), grid = Array.from({ length: 120 }, (_, t) => dx[0] + (dx[1] - dx[0]) * t / 119), kd = vals.length > 1 ? S.kde(vals, grid) : grid.map(() => 0), peak = Math.max(...kd, 1e-9), y0 = f.y0 + c * rowH; g.appendChild(Fig.el('path', { d: 'M' + grid.map((t, i) => `${x(t).toFixed(1)},${(y0 - kd[i] / peak * rowH * 0.85).toFixed(1)}`).join(' L') + ` L${x(grid[119])},${y0} L${x(grid[0])},${y0} Z`, fill: Fig.alpha(col(c), 0.3), stroke: col(c), 'stroke-width': 1.5 })); vals.forEach(v => g.appendChild(Fig.el('line', { x1: x(v), x2: x(v), y1: y0 - 6, y2: y0, stroke: col(c) }))); g.appendChild(Fig.text(f.x0 + 6, y0 - rowH * 0.85, `Cluster ${c}`, { size: 11, weight: 'bold', fill: col(c), font: f.font, role: 'label' })); }
  }
  f.g.appendChild(g);
  Fig.legend(f, Array.from({ length: k }, (_, c) => ({ label: `Cluster ${c + 1}`, color: col(c + 1), shape: 'circle' })), cfg);
  return svg;
};

/* ---------- 8. classification tree ---------- */
P7.tree = (cfg, T, k) => {
  const root = T.root;
  const leaves = []; const count = nd => nd.left ? count(nd.left) + count(nd.right) : 1; const nLeaves = count(root);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 20, right: 20, bottom: 20, top: 56 } });
  const depthMax = T.depth, levelH = (f.y1 - f.y0 - 40) / Math.max(depthMax, 1), colW = (f.x1 - f.x0) / nLeaves;
  const g = Fig.g(); let cursor = 0;
  const layout = nd => { if (!nd.left) { nd.x = f.x0 + (cursor + 0.5) * colW; cursor++; } else { layout(nd.left); layout(nd.right); nd.x = (nd.left.x + nd.right.x) / 2; } nd.y = f.y0 + 20 + nd.depth * levelH; };
  layout(root);
  const bar = (nd, x, y, w) => { let acc = 0; nd.counts.forEach((c, i) => { const p = c / nd.n; if (!p) return; g.appendChild(Fig.el('rect', { x: x + acc * w, y, width: p * w, height: 8, fill: Fig.color(cfg.palette, i) })); acc += p; }); };
  const draw = nd => {
    if (nd.left) { [nd.left, nd.right].forEach((ch, side) => { g.appendChild(Fig.el('line', { x1: nd.x, y1: nd.y + 22, x2: ch.x, y2: ch.y - 22, stroke: f.t.axis, 'stroke-width': 1.4 })); g.appendChild(Fig.text((nd.x + ch.x) / 2 + (side ? 6 : -6), (nd.y + ch.y) / 2, side ? `> ${fmtNum(nd.thr, 3)}` : `≤ ${fmtNum(nd.thr, 3)}`, { size: 9, anchor: side ? 'start' : 'end', fill: f.t.muted, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2 })); draw(ch); }); }
    const w = Math.min(150, colW * 1.6), col = Fig.color(cfg.palette, nd.pred - 1);
    g.appendChild(Fig.el('rect', { x: nd.x - w / 2, y: nd.y - 22, width: w, height: 44, rx: 6, fill: nd.left ? f.t.bg : Fig.alpha(col, 0.15), stroke: nd.left ? f.t.axis : col, 'stroke-width': 1.2 }));
    g.appendChild(Fig.text(nd.x, nd.y - 8, nd.left ? nd.var : `Cluster ${nd.pred}`, { size: 10, anchor: 'middle', weight: 'bold', fill: nd.left ? f.t.fg : col, font: f.font, role: 'label' }));
    g.appendChild(Fig.text(nd.x, nd.y + 5, `n = ${nd.n} · ${Math.round(nd.purity * 100)} % C${nd.pred}`, { size: 8.5, anchor: 'middle', fill: f.t.muted, font: f.font, role: 'label' }));
    bar(nd, nd.x - w / 2 + 6, nd.y + 10, w - 12);
  };
  draw(root);
  f.g.appendChild(g);
  Fig.legend(f, Array.from({ length: k }, (_, c) => ({ label: `Cluster ${c + 1}`, color: Fig.color(cfg.palette, c) })), cfg, { pos: cfg.legendPos || 'right' });
  return svg;
};

window.P7 = P7;
