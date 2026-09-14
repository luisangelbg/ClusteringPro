/* ClusteringPro — interactive playground on the home page.
   Left: a 2-D dataset you can regenerate or extend by clicking; k-means runs step by step.
   Right: the real dendrogram of the same points, recomputed for the chosen linkage and cut at k. */

(function () {
const W = 420, H = 300, PAD = 18;
const pg = { P: [], C: null, cluster: null, iter: 0, timer: null, seed: 7, dataset: 'blobs3', k: 3, linkage: 'ward.D2', hc: null, D: null };

function gen(kind, seed) {
  const r = rng(seed); let P = [];
  const clip = p => [Math.min(W - PAD, Math.max(PAD, p[0])), Math.min(H - PAD, Math.max(PAD, p[1]))];
  const b = (cx, cy, sd, n, sdy) => { for (let i = 0; i < n; i++) P.push(clip([cx + randn(r) * sd, cy + randn(r) * (sdy || sd)])); };
  switch (kind) {
    case 'blobs4': b(95, 80, 22, 15); b(320, 75, 22, 15); b(120, 230, 22, 15); b(310, 225, 22, 15); break;
    case 'elong': b(120, 90, 50, 22, 12); b(280, 210, 50, 22, 12); b(300, 90, 14, 14); break;
    case 'moons': for (let i = 0; i < 30; i++) { const a = Math.PI * i / 29; P.push(clip([150 + 90 * Math.cos(a) + randn(r) * 7, 150 - 70 * Math.sin(a) + randn(r) * 7])); P.push(clip([240 + 90 * Math.cos(a + Math.PI) + randn(r) * 7, 175 - 70 * Math.sin(a + Math.PI) + randn(r) * 7])); } break;
    case 'ring': for (let i = 0; i < 44; i++) { const a = i / 44 * 2 * Math.PI; P.push(clip([210 + 110 * Math.cos(a) + randn(r) * 7, 150 + 105 * Math.sin(a) + randn(r) * 7])); } b(210, 150, 16, 20); break;
    case 'uniform': for (let i = 0; i < 55; i++) P.push([PAD + r() * (W - 2 * PAD), PAD + r() * (H - 2 * PAD)]); break;
    default: b(110, 95, 26, 18); b(300, 80, 24, 18); b(215, 225, 26, 18);
  }
  return P;
}

function rebuildTree() {
  pg.D = HC.dist(pg.P);
  pg.hc = pg.P.length >= 2 ? HC.agglomerate(pg.D, pg.linkage) : null;
}

function drawScatter() {
  const svg = el('pgScatter'); if (!svg) return;
  let g = `<defs><clipPath id="pgClip"><rect x="${PAD}" y="${PAD}" width="${W - 2 * PAD}" height="${H - 2 * PAD}"/></clipPath></defs><rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;
  g += `<path d="M${PAD},${PAD} V${H - PAD} H${W - PAD}" class="art-ax" stroke-width="1"/>`;
  const col = i => pg.cluster ? CL[pg.cluster[i] % CL.length] : '#8d8da4';
  if (pg.cluster && pg.C) {
    g += '<g clip-path="url(#pgClip)">';
    for (let j = 0; j < pg.C.length; j++) {
      const members = pg.P.filter((_, i) => pg.cluster[i] === j);
      if (members.length >= 3) g += `<path d="${Geom.blobPath(Geom.hull(members), 12)}" fill="${CL[j % CL.length]}" opacity="0.13" stroke="${CL[j % CL.length]}" stroke-opacity="0.5" stroke-width="1.2"/>`;
    }
    g += '</g>';
  }
  pg.P.forEach((p, i) => { g += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2" fill="${col(i)}" stroke="#fff" stroke-width="0.9" opacity="0.95"/>`; });
  if (pg.C) pg.C.forEach((c, j) => {
    let d = ''; for (let t = 0; t < 8; t++) { const a = -Math.PI / 2 + t * Math.PI / 4, rr = t % 2 ? 4.5 : 10; d += (t ? 'L' : 'M') + (c[0] + rr * Math.cos(a)).toFixed(1) + ',' + (c[1] + rr * Math.sin(a)).toFixed(1); }
    g += `<path d="${d}Z" fill="${CL[j % CL.length]}" stroke="#fff" stroke-width="1.5"/>`;
  });
  g += `<text x="${W - PAD}" y="${H - 5}" text-anchor="end" font-size="9" class="art-mut" ${'font-family="system-ui, sans-serif"'}>click anywhere to add a point</text>`;
  svg.innerHTML = g;
}

function drawTree() {
  const svg = el('pgTree'); if (!svg) return;
  if (!pg.hc) { svg.innerHTML = ''; return; }
  const n = pg.P.length;
  const body = Art.dendro(pg.hc, { x: 34, y: 16, w: W - 50, h: H - 60, k: Math.min(pg.k, n), stroke: n > 80 ? 1.2 : n > 40 ? 1.6 : 2.2, cut: true, leafDot: n > 80 ? 1.6 : 2.6, axis: true, neutral: '#a4a4b8' });
  const maxH = Math.max(...pg.hc.height) * 1.06;
  let ticks = '';
  for (let t = 0; t <= 4; t++) { const y = 16 + (H - 60) - t / 4 * (H - 60); ticks += `<text x="24" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="8" class="art-mut" font-family="system-ui, sans-serif">${(maxH * t / 4).toFixed(0)}</text>`; }
  svg.innerHTML = body + ticks + `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" font-size="9.5" class="art-mut" font-family="system-ui, sans-serif">${labelOf(pg.linkage)} · ${n} leaves · cut at k = ${Math.min(pg.k, n)}</text>`;
}
function labelOf(m) { return { single: 'Single linkage', complete: 'Complete linkage', average: 'UPGMA (average)', weighted: 'WPGMA (weighted)', centroid: 'Centroid (UPGMC)', median: 'Median (WPGMC)', 'ward.D': 'Ward.D', 'ward.D2': 'Ward.D2' }[m] || m; }

function status(extra) {
  const s = el('pgStatus'); if (!s) return;
  const parts = [];
  if (pg.hc && pg.P.length > 3) parts.push(`Cophenetic correlation <b>${HC.copheneticCor(pg.D, pg.hc).toFixed(3)}</b>`);
  if (pg.cluster && pg.C) {
    const wss = KM.assign(pg.P, pg.C).wss, tss = KM.tss(pg.P);
    const sil = KM.silhouette(pg.P, pg.cluster), avg = sil.reduce((a, b) => a + b, 0) / sil.length;
    parts.push(`k-means iteration <b>${pg.iter}</b>`, `between-SS / total-SS <b>${(100 * (1 - wss / tss)).toFixed(1)} %</b>`, `average silhouette <b>${avg.toFixed(3)}</b>`);
  }
  if (extra) parts.push(extra);
  s.innerHTML = parts.join(' · ') || 'Press <b>Run k-means</b> or change the linkage; the tree on the right is computed from the same points.';
}

function stopTimer() { if (pg.timer) { clearInterval(pg.timer); pg.timer = null; } }
function kmStart() {
  const k = Math.min(pg.k, pg.P.length);
  pg.C = KM.init(pg.P, k, rng(pg.seed * 31 + 1), 'random'); pg.cluster = KM.assign(pg.P, pg.C).cluster; pg.iter = 0;
}
function kmStep() {
  if (!pg.C) kmStart();
  const C2 = KM.update(pg.P, pg.cluster, pg.C), res = KM.assign(pg.P, C2);
  const moved = res.cluster.some((c, i) => c !== pg.cluster[i]) || C2.some((c, j) => Math.hypot(c[0] - pg.C[j][0], c[1] - pg.C[j][1]) > 1e-6);
  pg.C = C2; pg.cluster = res.cluster; pg.iter++;
  drawScatter(); status(moved ? '' : '<b>converged</b>');
  return moved;
}
function kmRun() {
  stopTimer(); kmStart(); drawScatter(); status();
  pg.timer = setInterval(() => { if (!kmStep()) stopTimer(); }, 420);
}
function reset() { stopTimer(); pg.C = null; pg.cluster = null; pg.iter = 0; drawScatter(); status(); }
function regenerate(newSeed) {
  stopTimer(); if (newSeed) pg.seed = (pg.seed * 7 + 13) % 1000;
  pg.P = gen(pg.dataset, pg.seed); pg.C = null; pg.cluster = null; pg.iter = 0;
  rebuildTree(); drawScatter(); drawTree(); status();
}

function init() {
  if (!el('pgScatter')) return;
  el('pgDataset').addEventListener('change', e => { pg.dataset = e.target.value; regenerate(false); });
  el('pgK').addEventListener('input', e => { pg.k = +e.target.value; el('pgKVal').textContent = pg.k; if (pg.cluster) { stopTimer(); kmStart(); drawScatter(); } drawTree(); status(); });
  el('pgLinkage').addEventListener('change', e => { pg.linkage = e.target.value; rebuildTree(); drawTree(); status(); });
  el('pgRegen').addEventListener('click', () => regenerate(true));
  el('pgRun').addEventListener('click', kmRun);
  el('pgStep').addEventListener('click', () => { stopTimer(); kmStep(); });
  el('pgReset').addEventListener('click', reset);
  el('pgScatter').addEventListener('click', e => {
    if (pg.P.length >= 150) return;
    const svg = e.currentTarget, rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W, y = (e.clientY - rect.top) / rect.height * H;
    if (x < PAD || x > W - PAD || y < PAD || y > H - PAD) return;
    stopTimer(); pg.P.push([x, y]); pg.C = null; pg.cluster = null; pg.iter = 0;
    rebuildTree(); drawScatter(); drawTree(); status();
  });
  regenerate(false);
}
document.addEventListener('DOMContentLoaded', init);
})();
