/* ClusteringPro — Block 5 figures: cluster map with hulls/ellipses, silhouette plot, cluster sizes,
   membership heat map (fuzzy / model-based), BIC profile, k-NN distance plot (DBSCAN). */

const P5 = {};

function ellipsePath(pts, x, y) {
  /* 95 % concentration ellipse from the 2-D covariance of the points (data units → pixels) */
  if (pts.length < 3) return null;
  const mx = S.mean(pts.map(p => p[0])), my = S.mean(pts.map(p => p[1]));
  let sxx = 0, syy = 0, sxy = 0; pts.forEach(p => { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); });
  const n1 = pts.length - 1; sxx /= n1; syy /= n1; sxy /= n1;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(tr / 2 - disc, 1e-12);
  const ang = Math.atan2(l1 - sxx, sxy || 1e-12);
  const a = Math.sqrt(5.991 * l1), b = Math.sqrt(5.991 * l2);
  const pts2 = []; for (let t = 0; t <= 72; t++) { const th = t / 72 * 2 * Math.PI; const ex = a * Math.cos(th), ey = b * Math.sin(th); pts2.push([x(mx + ex * Math.cos(ang) - ey * Math.sin(ang)), y(my + ex * Math.sin(ang) + ey * Math.cos(ang))]); }
  return 'M' + pts2.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + ' Z';
}

/* ---------- 1. cluster map ---------- */
P5.map = (cfg, R) => {
  const C = R.coords, n = C.length, cl = R.cluster, k = R.k;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const xs = C.map(p => p[0]), ys = C.map(p => p[1] || 0);
  const dx = Fig.niceDomain(S.min(xs), S.max(xs)), dy = Fig.niceDomain(S.min(ys), S.max(ys));
  const x = Fig.scaleLinear(dx[0], dx[1], f.x0, f.x1), y = Fig.scaleLinear(dy[0], dy[1], f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || R.axisNames[0] }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || R.axisNames[1] }));
  const g = Fig.g();
  g.appendChild(Fig.el('line', { x1: x(0), x2: x(0), y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-dasharray': '4 4', opacity: 0.5 }));
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(0), y2: y(0), stroke: f.t.axis, 'stroke-dasharray': '4 4', opacity: 0.5 }));
  const col = c => c === 0 ? (cfg.noiseColor || '#9a9ab0') : Fig.color(cfg.palette, c - 1);
  const gLevels = R.groups ? [...new Set(R.groups)] : null;
  const shapeOf = i => cfg.shapeBy === 'group' && gLevels ? Fig.shapes[gLevels.indexOf(R.groups[i]) % Fig.shapes.length] : (cfg.shape || 'circle');
  for (let c = 1; c <= k; c++) {
    const pts = C.filter((_, i) => cl[i] === c).map(p => [p[0], p[1] || 0]);
    if (cfg.region === 'hull' && pts.length >= 3) g.appendChild(Fig.el('path', { d: Geom.blobPath(Geom.hull(pts.map(p => [x(p[0]), y(p[1])])), 8), fill: Fig.alpha(col(c), +cfg.regionAlpha || 0.12), stroke: col(c), 'stroke-width': 1, 'stroke-opacity': 0.7 }));
    else if (cfg.region === 'ellipse') { const d = ellipsePath(pts, x, y); if (d) g.appendChild(Fig.el('path', { d, fill: Fig.alpha(col(c), +cfg.regionAlpha || 0.12), stroke: col(c), 'stroke-width': 1.2, 'stroke-opacity': 0.8 })); }
  }
  const r = +cfg.pointSize || 4.5;
  /* fuzzy / model-based: point opacity by certainty */
  const cert = R.membership ? R.membership.map(u => Math.max(...u)) : null;
  C.forEach((p, i) => {
    const px = x(p[0]), py = y(p[1] || 0);
    if (cl[i] === 0) { g.appendChild(Fig.marker(px, py, r, 'cross', { fill: col(0) })); return; }
    g.appendChild(Fig.marker(px, py, r, shapeOf(i), { fill: col(cl[i]), stroke: f.t.bg, 'stroke-width': 0.8, opacity: cert && cfg.certainty ? 0.25 + 0.75 * cert[i] : 0.92 }));
  });
  if (cfg.centers !== 'none' && R.centers2d) R.centers2d.forEach((c, j) => { if (!c) return; const px = x(c[0]), py = y(c[1]); if (cfg.centers === 'medoid' && R.medoids) g.appendChild(Fig.el('circle', { cx: px, cy: py, r: r + 4, fill: 'none', stroke: col(j + 1), 'stroke-width': 2.2 })); else { g.appendChild(Fig.marker(px, py, r + 3, 'diamond', { fill: col(j + 1), stroke: f.t.bg, 'stroke-width': 1.6 })); } if (cfg.centerLabels) g.appendChild(Fig.text(px, py - r - 8, `C${j + 1}`, { size: 11, anchor: 'middle', weight: 'bold', fill: col(j + 1), font: f.font, role: 'label', halo: f.t.bg, haloWidth: 3 })); });
  if (cfg.labels === 'all' || (cfg.labels !== 'none' && n <= 60)) C.forEach((p, i) => g.appendChild(Fig.text(x(p[0]) + r + 2, y(p[1] || 0) + 3.5, R.labels[i], { size: +cfg.labelSize || 9, fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 })));
  f.g.appendChild(g);
  const items = [];
  for (let c = 1; c <= k; c++) items.push({ label: `Cluster ${c} (n = ${cl.filter(v => v === c).length})`, color: col(c), shape: 'circle' });
  if (cl.includes(0)) items.push({ label: `noise (n = ${cl.filter(v => v === 0).length})`, color: col(0), shape: 'circle' });
  if (cfg.shapeBy === 'group' && gLevels) gLevels.forEach((l, i) => items.push({ label: `${l} (${Fig.shapes[i % Fig.shapes.length]})`, color: f.t.muted, shape: 'circle' }));
  Fig.legend(f, items, cfg);
  return svg;
};

/* ---------- 2. silhouette plot ---------- */
P5.silhouette = (cfg, R) => {
  const sil = R.sil, cl = R.cluster, k = R.k, n = cl.length;
  const idx = cl.map((c, i) => i).filter(i => cl[i] > 0).sort((a, b) => cl[a] - cl[b] || sil.s[b] - sil.s[a]);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: cfg.labels && n <= 80 ? 110 : 60, right: 150, bottom: 56, top: 56 } });
  const lo = Math.min(-0.1, S.min(sil.s));
  const x = Fig.scaleLinear(lo, 1, f.x0, f.x1);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'silhouette width s(i)' }));
  const g = Fig.g(), bh = (f.y1 - f.y0) / Math.max(idx.length, 1);
  let yy = f.y0, prev = null, clusterStart = {};
  idx.forEach((i, t) => { if (cl[i] !== prev) { clusterStart[cl[i]] = yy; prev = cl[i]; } const w = x(sil.s[i]) - x(0); g.appendChild(Fig.el('rect', { x: Math.min(x(0), x(sil.s[i])), y: yy, width: Math.abs(w), height: Math.max(0.5, bh - (bh > 3 ? 1 : 0)), fill: Fig.color(cfg.palette, cl[i] - 1), opacity: 0.9 })); if (cfg.labels && n <= 80) g.appendChild(Fig.text(f.x0 - 6, yy + bh * 0.5 + 3, R.labels[i], { size: 8, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' })); yy += bh; });
  g.appendChild(Fig.el('line', { x1: x(0), x2: x(0), y1: f.y0, y2: f.y1, stroke: f.t.axis }));
  g.appendChild(Fig.el('line', { x1: x(sil.avg), x2: x(sil.avg), y1: f.y0, y2: f.y1, stroke: cfg.avgColor || '#d64a6a', 'stroke-dasharray': '6 3', 'stroke-width': 1.4 }));
  g.appendChild(Fig.text(x(sil.avg) + 4, f.y0 - 5, `mean ${sil.avg.toFixed(3)}`, { size: 11, weight: 'bold', fill: cfg.avgColor || '#d64a6a', font: f.font, role: 'label' }));
  Object.keys(clusterStart).forEach(c => { const nc = cl.filter(v => +v === +c).length; g.appendChild(Fig.text(f.x1 + 8, clusterStart[c] + Math.min(nc * bh / 2, 40) + 4, `C${c}: n = ${nc}, s̄ = ${sil.byCluster[c].toFixed(2)}`, { size: 10, fill: Fig.color(cfg.palette, c - 1), font: f.font, role: 'label' })); });
  f.g.appendChild(g);
  return svg;
};

/* ---------- 3. cluster sizes with silhouette ---------- */
P5.sizes = (cfg, R) => {
  const k = R.k, cl = R.cluster, sizes = Array.from({ length: k }, (_, c) => cl.filter(v => v === c + 1).length);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 64, right: 24, bottom: 56, top: 56 } });
  const labels = sizes.map((_, c) => `C${c + 1}`).concat(cl.includes(0) ? ['noise'] : []);
  const vals = sizes.concat(cl.includes(0) ? [cl.filter(v => v === 0).length] : []);
  const band = Fig.scaleBand(labels, f.x0, f.x1, 0.3), y = Fig.scaleLinear(0, Math.max(...vals) * 1.15, f.y1, f.y0);
  Fig.axisXBand(f, band, labels, Object.assign({}, cfg, { xlab: cfg.xlab || 'cluster' }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'number of objects' }));
  const g = Fig.g();
  vals.forEach((v, i) => { const c = i < k ? Fig.color(cfg.palette, i) : (cfg.noiseColor || '#9a9ab0'); g.appendChild(Fig.el('rect', { x: band(i), y: y(v), width: band.bandwidth, height: f.y1 - y(v), fill: c, rx: 3 })); g.appendChild(Fig.text(band.center(i), y(v) - 6, i < k && R.sil ? `${v} · s̄ ${R.sil.byCluster[i + 1].toFixed(2)}` : String(v), { size: 10, anchor: 'middle', fill: f.t.fg, font: f.font, role: 'label' })); });
  f.g.appendChild(g);
  return svg;
};

/* ---------- 4. membership heat map ---------- */
P5.membership = (cfg, R) => {
  const U = R.membership, cl = R.cluster, k = R.k, n = U.length;
  const idx = cl.map((c, i) => i).sort((a, b) => cl[a] - cl[b] || Math.max(...U[b]) - Math.max(...U[a]));
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const showLab = n <= 80 && cfg.labels !== 'none';
  const f = Fig.frame(svg, cfg, { margin: { left: showLab ? 110 : 40, right: 90, bottom: 50, top: 56 } });
  const cm = Fig.colormaps[cfg.cmap] || Fig.colormaps.viridis, cw = (f.x1 - f.x0) / k, ch = (f.y1 - f.y0) / n;
  const g = Fig.g();
  idx.forEach((i, r) => { for (let j = 0; j < k; j++) { g.appendChild(Fig.el('rect', { x: f.x0 + j * cw, y: f.y0 + r * ch, width: cw - 1, height: Math.max(0.5, ch - (ch > 3 ? 0.6 : 0)), fill: cm(U[i][j]) })); if (ch > 11 && cw > 30) g.appendChild(Fig.text(f.x0 + j * cw + cw / 2, f.y0 + r * ch + ch / 2 + 3, U[i][j].toFixed(2), { size: Math.min(9, ch * 0.6), anchor: 'middle', fill: Fig.onColor(cm(U[i][j])), font: f.font, role: 'label' })); } if (showLab) g.appendChild(Fig.text(f.x0 - 6, f.y0 + r * ch + ch / 2 + 3, R.labels[i], { size: Math.min(9, Math.max(6, ch * 0.7)), anchor: 'end', fill: Fig.color(cfg.palette, cl[i] - 1), font: f.font, role: 'tick' })); });
  for (let j = 0; j < k; j++) g.appendChild(Fig.text(f.x0 + j * cw + cw / 2, f.y1 + 16, `C${j + 1}`, { size: 11, anchor: 'middle', fill: Fig.color(cfg.palette, j), font: f.font, weight: 'bold', role: 'tick' }));
  const bx = f.x1 + 24, bh = Math.min(200, f.y1 - f.y0);
  for (let q = 0; q < 40; q++) g.appendChild(Fig.el('rect', { x: bx, y: f.y0 + q * bh / 40, width: 12, height: bh / 40 + 0.5, fill: cm(1 - q / 39) }));
  g.appendChild(Fig.text(bx + 16, f.y0 + 4, '1', { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 16, f.y0 + bh + 4, '0', { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 6, f.y0 - 8, R.method === 'gmm' ? 'P' : 'u', { size: 11, anchor: 'middle', fill: f.t.muted, font: f.font, italic: true, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- 5. BIC profile ---------- */
P5.bic = (cfg, tab) => {
  const models = [...new Set(tab.table.map(t => t.model))], ks = [...new Set(tab.table.map(t => t.k))].sort((a, b) => a - b);
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 80, right: 24, bottom: 62, top: 56 } });
  const vals = tab.table.filter(t => isFinite(t.bic)).map(t => t.bic);
  const x = Fig.scaleLinear(ks[0] - 0.5, ks[ks.length - 1] + 0.5, f.x0, f.x1), yd = Fig.niceDomain(S.min(vals), S.max(vals)), y = Fig.scaleLinear(yd[0], yd[1], f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'number of components k' }), { ticks: ks });
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'BIC (higher is better)' }));
  const g = Fig.g();
  models.forEach((m, mi) => { const pts = ks.map(k => { const t = tab.table.find(q => q.k === k && q.model === m); return t && isFinite(t.bic) ? [x(k), y(t.bic)] : null; }).filter(Boolean); const c = Fig.color(cfg.palette, mi); g.appendChild(Fig.el('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), fill: 'none', stroke: c, 'stroke-width': 2 })); pts.forEach(p => g.appendChild(Fig.marker(p[0], p[1], 3.5, Fig.shapes[mi % Fig.shapes.length], { fill: c }))); });
  if (tab.best) { g.appendChild(Fig.el('circle', { cx: x(tab.best.k), cy: y(tab.best.bic), r: 9, fill: 'none', stroke: '#d64a6a', 'stroke-width': 2 })); g.appendChild(Fig.text(x(tab.best.k) + 12, y(tab.best.bic) - 8, `best: ${tab.best.model}, k = ${tab.best.k}`, { size: 11, weight: 'bold', fill: '#d64a6a', font: f.font, role: 'label', halo: f.t.bg, haloWidth: 3 })); }
  f.g.appendChild(g);
  Fig.legend(f, models.map((m, mi) => ({ label: `${m} · ${PT.gmmModels[m] || ''}`, color: Fig.color(cfg.palette, mi), shape: 'line' })), cfg, { pos: cfg.legendPos || 'bottom' });
  return svg;
};

/* ---------- 6. k-NN distance plot ---------- */
P5.knn = (cfg, R) => {
  const d = R.knnSorted, n = d.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const x = Fig.scaleLinear(0, n - 1, f.x0, f.x1), y = Fig.scaleLinear(0, S.max(d) * 1.08, f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'objects sorted by distance to their k-th neighbour' }));
  const ord = k => k + (k % 10 === 1 && k !== 11 ? 'st' : k % 10 === 2 && k !== 12 ? 'nd' : k % 10 === 3 && k !== 13 ? 'rd' : 'th');
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || `distance to the ${ord(R.kNN)} nearest neighbour` }));
  const g = Fig.g(), eps = R.params.eps;
  g.appendChild(Fig.el('path', { d: 'M' + d.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L'), fill: 'none', stroke: Fig.color(cfg.palette, 0), 'stroke-width': 2 }));
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(eps), y2: y(eps), stroke: '#d64a6a', 'stroke-dasharray': '6 3', 'stroke-width': 1.4 }));
  g.appendChild(Fig.text(f.x1 - 6, y(eps) - 6, `ε = ${fmtNum(eps, 4)}${R.epsAuto ? ' (knee)' : ''} · objects above the line become noise`, { size: 11, anchor: 'end', weight: 'bold', fill: '#d64a6a', font: f.font, role: 'label' }));
  if (R.knee != null) g.appendChild(Fig.marker(x(R.knee), y(d[R.knee]), 5, 'circle', { fill: 'none', stroke: '#d64a6a', 'stroke-width': 2 }));
  f.g.appendChild(g);
  return svg;
};

window.P5 = P5;
