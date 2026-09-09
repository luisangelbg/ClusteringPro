/* ClusteringPro — Block 3 figures: distance heat map, PCoA (classical MDS) map, Shepard diagram,
   distribution of distances, k-nearest-neighbour network, comparison of coefficients. */

const P3 = {};

function groupsOf(labelsGroups, cfg) {
  const groups = labelsGroups;
  if (!groups) return null;
  const levels = [...new Set(groups)];
  return { levels, colorOf: i => Fig.color(cfg.palette || 'cluster', levels.indexOf(groups[i])), items: levels.map((l, k) => ({ label: l, color: Fig.color(cfg.palette || 'cluster', k), shape: 'circle' })) };
}
P3.orderObjects = (R, how) => {
  const n = R.D.length;
  if (how === 'vat') return vatOrder(R.D);
  if (how === 'hclust') return HC.agglomerate(R.D, 'average').order;
  if (how === 'group' && R.groups) return R.groups.map((g, i) => [g, i]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]).map(x => x[1]);
  return Array.from({ length: n }, (_, i) => i);
};

/* ---------- 1. distance heat map ---------- */
P3.heat = (cfg, R) => {
  const D = R.D, n = D.length, ord = P3.orderObjects(R, cfg.order || 'vat');
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const showLab = cfg.labels !== 'none' && (cfg.labels === 'all' || n <= 60);
  const labW = showLab ? Math.min(150, 10 + Math.max(...R.labels.map(l => String(l).length)) * 6.2 * Fig.fs('tick')) : 10;
  const f = Fig.frame(svg, cfg, { margin: { left: labW + (R.groups ? 26 : 12), right: 90, bottom: labW + 20, top: 56 } });
  const side = Math.min(f.x1 - f.x0, f.y1 - f.y0), ox = f.x0, oy = f.y0, cell = side / n;
  let mx = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][j] > mx) mx = D[i][j];
  const cm = Fig.colormaps[cfg.cmap] || Fig.colormaps.viridis;
  const col = t => cm(cfg.reverse ? 1 - t : t);
  const g = Fig.g();
  if (n > 90) {
    const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(col(mx ? D[ord[i]][ord[j]] / mx : 0)); const k = (i * n + j) * 4; img.data[k] = +m[1]; img.data[k + 1] = +m[2]; img.data[k + 2] = +m[3]; img.data[k + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    const image = Fig.el('image', { x: ox, y: oy, width: side, height: side, href: cv.toDataURL('image/png'), preserveAspectRatio: 'none', style: 'image-rendering:pixelated' });
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', cv.toDataURL('image/png'));
    g.appendChild(image);
  } else {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = D[ord[i]][ord[j]], t = mx ? v / mx : 0;
      g.appendChild(Fig.el('rect', { x: ox + j * cell, y: oy + i * cell, width: cell + 0.3, height: cell + 0.3, fill: col(t) }));
      if (cfg.values && n <= 18 && i !== j) g.appendChild(Fig.text(ox + j * cell + cell / 2, oy + i * cell + cell / 2 + 3.5, v < 10 ? v.toFixed(2) : v.toFixed(1), { size: Math.min(10, cell * 0.38), anchor: 'middle', fill: Fig.onColor(col(t)), font: f.font, role: 'label' }));
    }
  }
  g.appendChild(Fig.el('rect', { x: ox, y: oy, width: side, height: side, fill: 'none', stroke: f.t.axis }));
  const gi = groupsOf(R.groups, cfg);
  if (gi && cfg.groupStrip !== false) ord.forEach((obs, i) => { g.appendChild(Fig.el('rect', { x: ox - 14, y: oy + i * cell, width: 9, height: cell + 0.3, fill: gi.colorOf(obs) })); g.appendChild(Fig.el('rect', { x: ox + i * cell, y: oy - 14, width: cell + 0.3, height: 9, fill: gi.colorOf(obs) })); });
  if (showLab) ord.forEach((obs, i) => {
    g.appendChild(Fig.text(ox - (gi ? 20 : 6), oy + i * cell + cell / 2 + 3.5, R.labels[obs], { size: Math.min(11, Math.max(6, cell * 0.8)), anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' }));
    g.appendChild(Fig.text(ox + i * cell + cell / 2 + 3, oy + side + 6, R.labels[obs], { size: Math.min(11, Math.max(6, cell * 0.8)), anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick', rotate: -90 }).cloneNode(true));
  });
  /* rotated bottom labels: redo with proper rotation anchor */
  const bx = ox + side + 24;
  for (let k = 0; k < 50; k++) g.appendChild(Fig.el('rect', { x: bx, y: oy + k * side / 50, width: 12, height: side / 50 + 0.5, fill: col(k / 49) }));
  g.appendChild(Fig.text(bx + 17, oy + 5, '0', { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 17, oy + side + 3, Fig.fmtTick(+mx.toPrecision(3)), { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 6, oy - 8, 'd', { size: 11, anchor: 'middle', fill: f.t.muted, font: f.font, italic: true, role: 'label' }));
  g.appendChild(Fig.text(f.W - 10, f.H - 8, { vat: 'objects in VAT order', hclust: 'objects in UPGMA order', group: 'objects grouped by the known grouping', original: 'objects in table order' }[cfg.order || 'vat'], { size: 10, anchor: 'end', fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  if (gi && cfg.groupStrip !== false) Fig.legend(f, gi.items, cfg, { pos: cfg.legendPos || 'bottom' });
  return svg;
};

/* ---------- 2. PCoA map ---------- */
P3.mds = (cfg, R) => {
  const P = R.mds.points, n = P.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const xs = P.map(p => p[0]), ys = P.map(p => p[1] || 0);
  const dx = Fig.niceDomain(S.min(xs), S.max(xs)), dy = Fig.niceDomain(S.min(ys), S.max(ys));
  const x = Fig.scaleLinear(dx[0], dx[1], f.x0, f.x1), y = Fig.scaleLinear(dy[0], dy[1], f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || `PCoA 1 (${fmtPct(R.mds.pct[0] || 0, 1)})` }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || `PCoA 2 (${fmtPct(R.mds.pct[1] || 0, 1)})` }));
  const g = Fig.g();
  g.appendChild(Fig.el('line', { x1: x(0), x2: x(0), y1: f.y0, y2: f.y1, stroke: f.t.axis, 'stroke-dasharray': '4 4', opacity: 0.6 }));
  g.appendChild(Fig.el('line', { x1: f.x0, x2: f.x1, y1: y(0), y2: y(0), stroke: f.t.axis, 'stroke-dasharray': '4 4', opacity: 0.6 }));
  const gi = groupsOf(R.groups, cfg);
  const col = i => gi ? gi.colorOf(i) : (cfg.pointColor || Fig.color(cfg.palette, 0));
  if (gi && cfg.hulls) gi.levels.forEach((l, k) => { const pts = P.map((p, i) => [x(p[0]), y(p[1] || 0), i]).filter(q => R.groups[q[2]] === l).map(q => [q[0], q[1]]); if (pts.length >= 3) g.appendChild(Fig.el('path', { d: Geom.blobPath(Geom.hull(pts), 8), fill: Fig.alpha(gi.items[k].color, 0.13), stroke: gi.items[k].color, 'stroke-width': 1, 'stroke-opacity': 0.6 })); });
  const r = +cfg.pointSize || 4.5;
  P.forEach((p, i) => g.appendChild(Fig.marker(x(p[0]), y(p[1] || 0), r, cfg.shape || 'circle', { fill: col(i), stroke: f.t.bg, 'stroke-width': 0.8, opacity: 0.92 })));
  if (cfg.labels === 'all' || (cfg.labels !== 'none' && n <= 60)) P.forEach((p, i) => g.appendChild(Fig.text(x(p[0]) + r + 2, y(p[1] || 0) + 3.5, R.labels[i], { size: +cfg.labelSize || 9, fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 })));
  f.g.appendChild(g);
  if (gi) Fig.legend(f, gi.items, cfg);
  return svg;
};

/* ---------- 3. Shepard diagram ---------- */
P3.shepard = (cfg, R) => {
  const D = R.D, P = R.mds.points, n = D.length;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 74, right: 24, bottom: 62, top: 56 } });
  const xs = [], ys = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { xs.push(D[i][j]); ys.push(Math.hypot(P[i][0] - P[j][0], (P[i][1] || 0) - (P[j][1] || 0))); }
  const top = Math.max(S.max(xs), S.max(ys)) * 1.04;
  const x = Fig.scaleLinear(0, top, f.x0, f.x1), y = Fig.scaleLinear(0, top, f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'original dissimilarity' }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'distance in the 2-D map' }));
  const g = Fig.g();
  g.appendChild(Fig.el('line', { x1: x(0), y1: y(0), x2: x(top), y2: y(top), stroke: f.t.axis, 'stroke-dasharray': '5 4' }));
  const c = cfg.pointColor || Fig.color(cfg.palette, 0);
  xs.forEach((v, k) => g.appendChild(Fig.el('circle', { cx: x(v), cy: y(ys[k]), r: xs.length > 2000 ? 1.5 : 2.4, fill: c, opacity: xs.length > 2000 ? 0.35 : 0.55 })));
  const r2 = S.pearson(xs, ys) ** 2;
  g.appendChild(Fig.text(f.x0 + 10, f.y0 + 18, `r² = ${r2.toFixed(3)} · stress = ${R.stress.toFixed(3)}`, { size: 12, fill: f.t.fg, font: f.font, weight: 'bold', role: 'label' }));
  g.appendChild(Fig.text(f.x0 + 10, f.y0 + 34, R.stress < 0.1 ? 'the map reproduces the distances well' : R.stress < 0.2 ? 'acceptable representation; read distant pairs with care' : 'poor 2-D representation: trust the matrix, not the map', { size: 11, fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- 4. distribution of distances ---------- */
P3.hist = (cfg, R) => {
  const v = R.diag.values;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 64, right: 24, bottom: 62, top: 56 } });
  const h = S.histogram(v, +cfg.bins || S.nBins(v, 'fd'));
  const x = Fig.scaleLinear(h.min, h.max, f.x0, f.x1);
  const dens = h.counts.map(c => c / (v.length * h.width));
  const grid = Array.from({ length: 160 }, (_, i) => h.min + (h.max - h.min) * i / 159), kd = S.kde(v, grid);
  const y = Fig.scaleLinear(0, Math.max(...dens, ...kd) * 1.12, f.y1, f.y0);
  Fig.axisX(f, x, Object.assign({}, cfg, { xlab: cfg.xlab || 'dissimilarity between pairs of objects' }));
  Fig.axisY(f, y, Object.assign({}, cfg, { ylab: cfg.ylab || 'density' }));
  const g = Fig.g(), c = cfg.barColor || Fig.color(cfg.palette, 0);
  h.counts.forEach((cnt, i) => g.appendChild(Fig.el('rect', { x: x(h.edges[i]), y: y(dens[i]), width: Math.max(0.5, x(h.edges[i + 1]) - x(h.edges[i]) - 1), height: f.y1 - y(dens[i]), fill: Fig.alpha(c, 0.55), stroke: c, 'stroke-width': 0.6 })));
  g.appendChild(Fig.el('path', { d: 'M' + grid.map((t, i) => `${x(t).toFixed(1)},${y(kd[i]).toFixed(1)}`).join(' L'), fill: 'none', stroke: cfg.lineColor || Fig.color(cfg.palette, 1), 'stroke-width': 2.2 }));
  [['mean', R.diag.mean], ['median', R.diag.median]].forEach(([l, val], k) => { g.appendChild(Fig.el('line', { x1: x(val), x2: x(val), y1: f.y0, y2: f.y1, stroke: f.t.fg, 'stroke-dasharray': k ? '2 3' : '6 3', opacity: 0.6 })); g.appendChild(Fig.text(x(val) + 4, f.y0 + 14 + k * 14, `${l} ${fmtNum(val, 3)}`, { size: 10, fill: f.t.fg, font: f.font, role: 'label' })); });
  f.g.appendChild(g);
  return svg;
};

/* ---------- 5. k-nearest-neighbour network on the PCoA map ---------- */
P3.knn = (cfg, R) => {
  const D = R.D, P = R.mds.points, n = D.length, k = Math.max(1, Math.min(+cfg.k || 3, n - 1));
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 40, right: 24, bottom: 40, top: 56 } });
  const xs = P.map(p => p[0]), ys = P.map(p => p[1] || 0);
  const dx = Fig.niceDomain(S.min(xs), S.max(xs)), dy = Fig.niceDomain(S.min(ys), S.max(ys));
  const x = Fig.scaleLinear(dx[0], dx[1], f.x0, f.x1), y = Fig.scaleLinear(dy[0], dy[1], f.y1, f.y0);
  const g = Fig.g();
  const gi = groupsOf(R.groups, cfg);
  const col = i => gi ? gi.colorOf(i) : (cfg.pointColor || Fig.color(cfg.palette, 0));
  const nn = D.map((row, i) => row.map((d, j) => [d, j]).filter(q => q[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, k).map(q => q[1]));
  const mutual = (i, j) => nn[i].includes(j) && nn[j].includes(i);
  const mx = R.diag.max || 1;
  for (let i = 0; i < n; i++) nn[i].forEach(j => { if (j < i && mutual(i, j)) return; const w = 1 - 0.6 * D[i][j] / mx; g.appendChild(Fig.el('line', { x1: x(xs[i]), y1: y(ys[i]), x2: x(xs[j]), y2: y(ys[j]), stroke: gi && R.groups[i] === R.groups[j] ? col(i) : (cfg.edgeColor || '#9a9ab0'), 'stroke-width': mutual(i, j) ? 2 * w + 0.5 : 0.8, opacity: mutual(i, j) ? 0.75 : 0.35 })); });
  P.forEach((p, i) => g.appendChild(Fig.marker(x(xs[i]), y(ys[i]), +cfg.pointSize || 4.5, 'circle', { fill: col(i), stroke: f.t.bg, 'stroke-width': 0.8 })));
  if (cfg.labels === 'all' || (cfg.labels !== 'none' && n <= 60)) P.forEach((p, i) => g.appendChild(Fig.text(x(xs[i]) + 6, y(ys[i]) + 3.5, R.labels[i], { size: +cfg.labelSize || 9, fill: f.t.fg, font: f.font, role: 'label', halo: f.t.bg, haloWidth: 2.5 })));
  g.appendChild(Fig.text(f.x0 + 6, f.y1 - 8, `edges: each object → its ${k} nearest neighbours (thick = mutual); grey = across known groups`, { size: 10, fill: f.t.muted, font: f.font, role: 'label' }));
  f.g.appendChild(g);
  if (gi) Fig.legend(f, gi.items, cfg);
  return svg;
};

/* ---------- 6. comparison of coefficients ---------- */
P3.cmp = (cfg, C) => {
  const names = C.names, k = names.length, R = cfg.rank ? C.Rs : C.R;
  const svg = Fig.svg(cfg.width, cfg.height, cfg.theme);
  const f = Fig.frame(svg, cfg, { margin: { left: 190, right: 90, bottom: 150, top: 56 } });
  const cell = Math.min((f.x1 - f.x0) / k, (f.y1 - f.y0) / k), ox = f.x0, oy = f.y0;
  const cm = Fig.colormaps[cfg.cmap] || Fig.colormaps.viridis;
  const g = Fig.g();
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
    const r = R[a][b], t = Math.max(0, Math.min(1, r));
    g.appendChild(Fig.el('rect', { x: ox + b * cell, y: oy + a * cell, width: cell - 1, height: cell - 1, fill: cm(t), rx: 1 }));
    if (a !== b) g.appendChild(Fig.text(ox + b * cell + cell / 2, oy + a * cell + cell / 2 + 4, r.toFixed(2), { size: Math.min(11, cell * 0.36), anchor: 'middle', fill: Fig.onColor(cm(t)), font: f.font, role: 'label' }));
  }
  names.forEach((nm, i) => { g.appendChild(Fig.text(ox - 6, oy + i * cell + cell / 2 + 4, nm, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick' })); g.appendChild(Fig.text(ox + i * cell + cell / 2, oy + k * cell + 8, nm, { size: 11, anchor: 'end', fill: f.t.fg, font: f.font, role: 'tick', rotate: -45 })); });
  const bx = ox + k * cell + 24, bh = k * cell;
  for (let q = 0; q < 40; q++) g.appendChild(Fig.el('rect', { x: bx, y: oy + q * bh / 40, width: 12, height: bh / 40 + 0.5, fill: cm(1 - q / 39) }));
  g.appendChild(Fig.text(bx + 17, oy + 4, '1', { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 17, oy + bh + 4, '0', { size: 10, fill: f.t.fg, font: f.font, role: 'tick' }));
  g.appendChild(Fig.text(bx + 6, oy - 8, cfg.rank ? 'ρ' : 'r', { size: 11, anchor: 'middle', fill: f.t.muted, font: f.font, italic: true, role: 'label' }));
  f.g.appendChild(g);
  return svg;
};

/* ---------- mounting ---------- */
P3.mountAll = R => {
  const pal = { key: 'palette', label: 'Palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  const leg = { key: 'legendPos', label: 'Legend position', type: 'select', options: [['right', 'Top right'], ['left', 'Top left'], ['bottom', 'Below the plot'], ['none', 'Hidden']] };
  const labs = [{ key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'automatic (n ≤ 60)'], ['all', 'all'], ['none', 'none']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 6, max: 16, step: 0.5 }];
  const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">Figure "${esc(spec.title)}" could not be drawn: ${esc(e.message)}</div>`; } };
  mount('fig3Heat', {
    title: 'Dissimilarity matrix as a heat map', fileName: 'distance_heatmap', width: 760, height: 700,
    defaults: { palette: 'cluster', title: `${R.name} dissimilarity between objects`, order: 'vat', cmap: 'viridis', reverse: true, values: true, labels: 'auto', groupStrip: true, legendPos: 'bottom' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'order', label: 'Object order', type: 'select', options: [['vat', 'VAT (nearest neighbours together)'], ['hclust', 'UPGMA tree order'], ['group', 'By known grouping'], ['original', 'Table order']] },
      { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }, { key: 'reverse', label: 'Dark = similar', type: 'checkbox' }, { key: 'values', label: 'Show values (n ≤ 18)', type: 'checkbox' },
      { key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'automatic (n ≤ 60)'], ['all', 'all'], ['none', 'none']] }, { key: 'groupStrip', label: 'Known-group strips', type: 'checkbox' }, pal, leg],
    render: cfg => P3.heat(cfg, R),
  });
  mount('fig3MDS', {
    title: 'Principal coordinates (classical MDS) of the dissimilarity', fileName: 'pcoa_map', width: 900, height: 600,
    defaults: { palette: 'cluster', title: `PCoA map · ${R.name}`, subtitle: `stress ${R.stress.toFixed(3)} · ${fmtPct((R.mds.pct[0] || 0) + (R.mds.pct[1] || 0), 0)} of the (positive) variance in two axes`, labels: 'auto', labelSize: 9, pointSize: 4.5, hulls: true, shape: 'circle', legendPos: 'right', pointColor: '#4f46a5' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' }, { key: 'xlab', label: 'X axis title', type: 'text' }, { key: 'ylab', label: 'Y axis title', type: 'text' }, ...labs,
      { key: 'pointSize', label: 'Point size', type: 'range', min: 2, max: 10, step: 0.5 }, { key: 'shape', label: 'Point shape', type: 'select', options: Fig.shapes }, { key: 'hulls', label: 'Convex hulls per group', type: 'checkbox' }, { key: 'pointColor', label: 'Point colour (no groups)', type: 'color' }, pal, leg],
    render: cfg => P3.mds(cfg, R),
  });
  mount('fig3Shepard', {
    title: 'Shepard diagram: how faithful is the 2-D map?', fileName: 'shepard_diagram', width: 620, height: 520,
    defaults: { palette: 'cluster', title: 'Shepard diagram', pointColor: '#4f46a5' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'pointColor', label: 'Point colour', type: 'color' }, pal],
    render: cfg => P3.shepard(cfg, R),
  });
  mount('fig3Hist', {
    title: 'Distribution of the pairwise dissimilarities', fileName: 'distance_distribution', width: 620, height: 420,
    defaults: { palette: 'cluster', title: 'Pairwise dissimilarities', bins: 0, barColor: '#4f46a5', lineColor: '#e0803c' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'bins', label: 'Bins (0 = automatic)', type: 'number', min: 0, max: 80, step: 1 }, { key: 'barColor', label: 'Bar colour', type: 'color' }, { key: 'lineColor', label: 'Density colour', type: 'color' }, pal],
    render: cfg => P3.hist(cfg, R),
  });
  mount('fig3KNN', {
    title: 'Nearest-neighbour network', fileName: 'knn_network', width: 900, height: 600,
    defaults: { palette: 'cluster', title: 'k-nearest-neighbour network on the PCoA map', k: 3, labels: 'auto', labelSize: 9, pointSize: 4.5, edgeColor: '#9a9ab0', legendPos: 'right' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'k', label: 'Neighbours (k)', type: 'range', min: 1, max: 10, step: 1 }, ...labs, { key: 'pointSize', label: 'Point size', type: 'range', min: 2, max: 10, step: 0.5 }, { key: 'edgeColor', label: 'Edge colour (between groups)', type: 'color' }, pal, leg],
    render: cfg => P3.knn(cfg, R),
  });
};
P3.mountCmp = C => {
  try {
    Fig.mount('fig3Cmp', {
      title: 'Agreement between coefficients', fileName: 'coefficient_comparison', width: 760, height: 640,
      defaults: { title: 'Correlation between dissimilarity matrices', cmap: 'viridis', rank: false },
      controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'rank', label: 'Use Spearman (rank) correlation', type: 'checkbox' }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }],
      render: cfg => P3.cmp(cfg, C),
    });
  } catch (e) { console.error(e); el('fig3Cmp').innerHTML = `<div class="msg msg-error">${esc(e.message)}</div>`; }
};
window.P3 = P3;
