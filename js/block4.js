/* ClusteringPro — Block 4 UI: hierarchical clustering, cut, dendrogram studio, heat map with trees,
   comparison of linkage methods and tanglegrams. */

(function () {
const METHODS = [
  ['ward.D2', 'Ward.D2 (minimum variance)'], ['average', 'Average · UPGMA'], ['complete', 'Complete (farthest neighbour)'], ['single', 'Single (nearest neighbour)'],
  ['weighted', 'Weighted · WPGMA (McQuitty)'], ['centroid', 'Centroid · UPGMC'], ['median', 'Median · WPGMC'], ['ward.D', 'Ward.D (on unsquared d)'],
  ['flexible', 'Flexible beta (Lance–Williams)'], ['diana', 'DIANA (divisive)'],
];
const NAME = Object.fromEntries(METHODS.map(m => [m[0], m[1].split(' (')[0].split(' ·')[0]]));
let T = null;

function treeData(hc) {
  const numIdx = state.Xkinds ? state.Xkinds.map((k, j) => j).filter(j => !state.Xdummy[j]) : [];
  return {
    hc, labels: state.dist.labels, groups: state.groups,
    axis: state.dist.mds ? state.dist.mds.points.map(p => p[0]) : null,
    X: state.X && numIdx.length ? state.X.map(r => numIdx.map(j => r[j])) : null,
    vars: numIdx.map(j => state.Xnames[j]),
  };
}

function run() {
  if (!state.dist) return;
  clearMessages('hcMessages');
  const method = el('hcMethod').value, beta = +el('hcBeta').value;
  const n = state.dist.n;
  if (n > 1500) { showMessage('hcMessages', 'error', 'More than 1500 objects: the agglomeration is O(n³) in this version. Reduce the objects or use the partitioning methods of Block 5.'); return; }
  const t0 = performance.now();
  let hc;
  try { hc = HC.agglomerate(state.dist.D, method, { beta }); } catch (e) { showMessage('hcMessages', 'error', esc(e.message)); return; }
  T = treeData(hc);
  const coph = HC.copheneticCor(state.dist.D, hc), coef = HC.coefficient(hc), rev = HC.reversals(hc), sug = HC.suggestK(hc, 12);
  state.hclust = { method, beta: method === 'flexible' ? beta : null, hc, coph, coef, reversals: rev, suggested: sug.slice(0, 3), labels: T.labels, ms: performance.now() - t0 };
  el('cutMode').value = 'k'; el('cutK').value = state.groups ? new Set(state.groups).size : (sug[0] ? sug[0].k : 3); toggleCut();
  applyCut(true);
  renderSummary();
  mountFigures();
  el('hcResults').style.display = ''; el('cmp4Card').style.display = '';
  fillTangleSelects();
  el('hcResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleCut() { const byK = el('cutMode').value === 'k'; el('cutKWrap').style.display = byK ? '' : 'none'; el('cutHWrap').style.display = byK ? 'none' : ''; }
function applyCut(silent) {
  const H = state.hclust; if (!H) return;
  const hc = H.hc, byK = el('cutMode').value === 'k';
  let k = byK ? Math.max(1, Math.min(+el('cutK').value || 2, hc.n)) : 1 + hc.height.filter(v => v > +el('cutH').value).length;
  const cl0 = HC.cutree(hc, k);
  /* renumber left to right in tree order */
  const map = new Map(); hc.order.forEach(i => { if (!map.has(cl0[i])) map.set(cl0[i], map.size + 1); });
  const cl = cl0.map(c => map.get(c));
  const hs = hc.height.slice().sort((a, b) => a - b);
  H.k = k; H.cl = cl; H.cutH = k > 1 && k <= hc.n ? (byK ? (hs[hc.n - k - 1] + hs[hc.n - k]) / 2 : +el('cutH').value) : null;
  if (!byK) el('cutK').value = k; else if (H.cutH != null) el('cutH').value = +H.cutH.toPrecision(4);
  renderCut();
  const api = Fig.registry.fig4Dendro;
  if (api && !silent) { api.cfg.k = k; api.cfg.cutMode = 'k'; api.redraw(); const hm = Fig.registry.fig4Heatmap; if (hm) { hm.cfg.k = k; hm.cfg.cutMode = 'k'; hm.redraw(); } }
  enableStep(5, true); el('nextBtn4').disabled = false;
  document.dispatchEvent(new CustomEvent('hclustchange'));
}

function renderSummary() {
  const H = state.hclust, hc = H.hc, d = state.dist;
  const cLvl = H.coph >= 0.75 ? 'ok' : H.coph >= 0.6 ? 'warn' : 'bad';
  const tiles = [
    ['Method', NAME[H.method] + (H.method === 'flexible' ? ` (β = ${H.beta})` : ''), `${hc.n} objects · ${d.name}`],
    ['Cophenetic correlation', fmtFixed(H.coph, 3), 'tree vs. original dissimilarities', cLvl],
    [H.method === 'diana' ? 'Divisive coefficient' : 'Agglomerative coefficient', fmtFixed(H.coef, 3), 'strength of the hierarchical structure', H.coef >= 0.7 ? 'ok' : H.coef >= 0.5 ? 'warn' : ''],
    ['Suggested k (height jumps)', H.suggested.map(s => s.k).join(' · '), 'largest gaps between merges'],
    ['Reversals', H.reversals, H.reversals ? 'non-monotone merges' : 'monotone tree', H.reversals ? 'warn' : 'ok'],
  ];
  statTiles('hcTiles', tiles);
  const checks = [];
  const add = (l, t, x) => checks.push([l, t, x]);
  if (cLvl === 'ok') add('ok', `The tree is a faithful summary of the dissimilarities (r = ${fmtFixed(H.coph, 3)})`, 'Cophenetic distances (the heights at which pairs join) correlate strongly with the original matrix. Distances read from the dendrogram are trustworthy.');
  else if (cLvl === 'warn') add('warn', `Moderate cophenetic correlation (r = ${fmtFixed(H.coph, 3)})`, 'The tree distorts some of the original distances. Compare linkages below: UPGMA usually maximises this correlation; Ward and complete linkage trade fidelity for compact clusters.');
  else add('bad', `Low cophenetic correlation (r = ${fmtFixed(H.coph, 3)})`, 'The dendrogram is a poor representation of the matrix. Try another linkage, another coefficient (Block 3), or a partitioning method (Block 5).');
  if (H.reversals) add('warn', `${H.reversals} reversal${H.reversals > 1 ? 's' : ''} in the tree`, 'Centroid and median linkage can merge at a lower height than a previous merge (the branches cross back). Cutting such a tree at a height is ambiguous; cut by k instead, or use average or Ward linkage.');
  /* chaining */
  const late = hc.merge.slice(Math.floor((hc.n - 1) / 2)); const single = late.filter(m => (m[0] < 0) !== (m[1] < 0)).length;
  if (late.length >= 6 && single / late.length > 0.7) add('warn', 'Chaining: objects are added one by one to a growing cluster', `${fmtPct(single / late.length, 0)} of the later merges attach a single object. Typical of single linkage on gradients: the clusters are elongated chains rather than compact groups. Complete, average or Ward linkage give more compact clusters; single linkage is right if you expect elongated shapes.`);
  if (d.diag && d.diag.euclid && d.diag.euclid.negMass >= 0.1 && /ward|centroid|median/.test(H.method)) add('warn', 'This linkage assumes Euclidean distances', `Your dissimilarity is not Euclidean-embeddable (${fmtPct(d.diag.euclid.negMass, 0)} negative eigenvalue mass). Ward, centroid and median linkage still run but their geometric meaning is lost. Use √d (the square-root option of Block 3) or prefer average / complete linkage.`);
  if (H.method === 'diana') add('info', 'Divisive analysis', 'DIANA starts from one cluster and splits by diameter; it is usually better than agglomerative methods at recovering a few large clusters, and the divisive coefficient plays the role of the agglomerative coefficient.');
  if (H.coef < 0.5) add('info', 'Weak hierarchical structure', `A coefficient of ${fmtFixed(H.coef, 2)} means objects join late relative to the final merge: the data are more like a gradient than a set of nested groups. (The coefficient also grows with n; compare only trees of the same data.)`);
  add('info', `Cut suggestions: k = ${H.suggested.map(s => `${s.k} (gap ${fmtPct(s.rel, 0)} of the tree height)`).join(', ')}`, 'These are the largest jumps between consecutive merge heights. Block 6 will weigh them against silhouette, gap statistic and stability; the domain has the final word.');
  const host = el('hcChecks'); host.innerHTML = '';
  checks.forEach(([level, title, text]) => host.appendChild(mk('div', { class: 'check-item ' + level }, `<div class="ck-icon">${level === 'ok' ? '✅' : level === 'bad' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${title}</div><div class="ck-text">${text}</div></div>`)));
}
function renderCut() {
  const H = state.hclust, k = H.k, cl = H.cl, labels = H.labels;
  const rows = []; for (let c = 1; c <= k; c++) { const mem = labels.map((l, i) => cl[i] === c ? l : null).filter(x => x != null); rows.push({ c: `Cluster ${c}`, n: mem.length, members: mem.slice(0, 40).map(esc).join(', ') + (mem.length > 40 ? ` … (+${mem.length - 40})` : '') }); }
  buildTable('clusterTable', [{ key: 'c', label: 'Cluster' }, { key: 'n', label: 'n', num: true }, { key: 'members', label: 'Members', html: true }], rows, { caption: `Partition into k = ${k} cluster${k > 1 ? 's' : ''}${H.cutH != null ? ` (cut height ${fmtNum(H.cutH, 4)})` : ''}` });
  const ct = el('crossTable'); ct.innerHTML = '';
  if (state.groups && k > 1) {
    const { la, lb, M } = HC.contingency(cl, state.groups);
    const ari = HC.ari(cl, state.groups);
    const purity = M.reduce((s, r) => s + Math.max(...r), 0) / cl.length;
    H.ari = ari;
    const cols = [{ key: 'c', label: 'Cluster \\ group' }].concat(lb.map((g, j) => ({ key: 'g' + j, label: esc(g), num: true }))).concat([{ key: 'tot', label: 'n', num: true }]);
    const rws = la.map((c, i) => { const o = { c: `Cluster ${c}`, tot: M[i].reduce((s, v) => s + v, 0) }; lb.forEach((g, j) => o['g' + j] = M[i][j]); return o; }).sort((a, b) => +a.c.slice(8) - +b.c.slice(8));
    buildTable(ct, cols, rws, { caption: `Clusters vs. known grouping · adjusted Rand index ${ari.toFixed(3)} · purity ${fmtPct(purity, 0)}` });
    ct.appendChild(mk('p', { class: 'hint' }, ari > 0.8 ? 'The tree recovers your known grouping almost exactly.' : ari > 0.5 ? 'Substantial agreement with the known grouping, with some objects placed differently.' : ari > 0.2 ? 'Partial agreement: the clusters and the known grouping capture different structure.' : 'The clusters are unrelated to the known grouping (ARI near 0 is what random labels give).'));
  }
}

/* ---------- figures ---------- */
function mountFigures() {
  const H = state.hclust;
  const pal = { key: 'palette', label: 'Cluster palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  const gpal = { key: 'groupPalette', label: 'Known-group palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  const cmap = { key: 'cmap', label: 'Gradient colour map', type: 'select', options: Object.entries(Fig.colormapNames) };
  const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">Figure "${esc(spec.title)}" could not be drawn: ${esc(e.message)}</div>`; } };
  const n = T.hc.n;
  mount('fig4Heights', {
    title: 'Merge heights: where to cut', fileName: 'merge_heights', width: 760, height: 380,
    defaults: { palette: 'cluster', title: `Merge heights · ${NAME[H.method]}`, maxK: 15 },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'maxK', label: 'Largest k shown', type: 'range', min: 5, max: 30, step: 1 }, pal],
    render: cfg => P4.heights(cfg, T),
  });
  mount('fig4Dendro', {
    title: 'Dendrogram studio', fileName: 'dendrogram', width: 960, height: n > 60 ? 620 : 560,
    defaults: {
      palette: 'cluster', groupPalette: 'vivid', cmap: 'viridis', title: `${NAME[H.method]} dendrogram · ${state.dist.name}`, subtitle: `cophenetic correlation ${H.coph.toFixed(3)}`,
      layout: 'rect', k: H.k, cutMode: 'k', cutHeight: 0, colourBy: 'cluster', neutral: '#8a8aa0', singleColor: '#4f46a5', branchWidth: n > 100 ? 1.2 : 1.8,
      labels: 'auto', labelSize: n > 80 ? 8 : 10, labelColour: 'cluster', labelAngle: 0, labelItalic: false, leafPoints: state.groups ? 'group' : 'none', pointSize: 3.5, groupShapes: false,
      showCut: true, cutColor: '#d64a6a', boxes: true, boxAlpha: 0.12, boxDash: false, clusterNumbers: true, collapse: false, hang: 0, leafOrder: 'default', reverse: false,
      axis: true, axisTitle: 'Height', radialAxis: false, innerRadius: 8, startAngle: -90, sweep: 350, legend: state.groups ? 'both' : 'clusters', legendPos: 'auto',
    },
    controls: [
      { key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'layout', label: 'Layout', type: 'select', options: [['rect', 'Rectangular (leaves at the bottom)'], ['recttri', 'Triangular'], ['horizontal', 'Horizontal (leaves on the right)'], ['horizontaltri', 'Horizontal triangular'], ['radial', 'Radial / circular'], ['radialtri', 'Radial triangular (fan)']] },
      { key: 'k', label: 'Clusters k (cut)', type: 'range', min: 1, max: Math.min(20, n), step: 1 }, { key: 'cutMode', label: 'Cut by', type: 'select', options: [['k', 'number of clusters'], ['height', 'height']] }, { key: 'cutHeight', label: 'Cut height (if by height)', type: 'number', min: 0, max: 1e9, step: 0.01 },
      { key: 'colourBy', label: 'Colour branches by', type: 'select', options: [['cluster', 'cluster'], ['group', 'known grouping'], ['gradient', 'height gradient'], ['single', 'one colour']] }, pal, gpal, cmap, { key: 'neutral', label: 'Colour above the cut', type: 'color' }, { key: 'singleColor', label: 'Single colour', type: 'color' },
      { key: 'branchWidth', label: 'Branch width', type: 'range', min: 0.5, max: 5, step: 0.1 },
      { key: 'labels', label: 'Leaf labels', type: 'select', options: [['auto', 'automatic (n ≤ 120)'], ['all', 'all'], ['none', 'none']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 5, max: 18, step: 0.5 }, { key: 'labelColour', label: 'Label colour', type: 'select', options: [['cluster', 'by cluster'], ['group', 'by known grouping'], ['plain', 'plain']] }, { key: 'labelAngle', label: 'Label angle offset', type: 'range', min: -45, max: 90, step: 5 }, { key: 'labelItalic', label: 'Italic labels (taxa)', type: 'checkbox' },
      { key: 'leafPoints', label: 'Leaf symbols', type: 'select', options: [['none', 'none'], ['group', 'coloured by known grouping'], ['cluster', 'coloured by cluster']] }, { key: 'pointSize', label: 'Symbol size', type: 'range', min: 1.5, max: 8, step: 0.5 }, { key: 'groupShapes', label: 'Different shapes per group', type: 'checkbox' },
      { key: 'showCut', label: 'Show cut line', type: 'checkbox' }, { key: 'cutColor', label: 'Cut line colour', type: 'color' }, { key: 'boxes', label: 'Cluster boxes', type: 'checkbox' }, { key: 'boxAlpha', label: 'Box fill opacity', type: 'range', min: 0, max: 0.5, step: 0.02 }, { key: 'boxDash', label: 'Dashed boxes', type: 'checkbox' }, { key: 'clusterNumbers', label: 'Cluster numbers', type: 'checkbox' },
      { key: 'collapse', label: 'Collapse clusters into triangles', type: 'checkbox' }, { key: 'hang', label: 'Hang leaves (fraction of height)', type: 'range', min: 0, max: 0.3, step: 0.01 },
      { key: 'leafOrder', label: 'Leaf order', type: 'select', options: [['default', 'tree default'], ['pcoa', 'along the first PCoA axis'], ['group', 'by known grouping'], ['size', 'tight clusters first'], ['alpha', 'alphabetical where possible']] }, { key: 'reverse', label: 'Reverse order', type: 'checkbox' },
      { key: 'axis', label: 'Height axis', type: 'checkbox' }, { key: 'axisTitle', label: 'Axis title', type: 'text' }, { key: 'radialAxis', label: 'Guide circles (radial)', type: 'checkbox' }, { key: 'innerRadius', label: 'Inner radius % (radial)', type: 'range', min: 0, max: 60, step: 1 }, { key: 'startAngle', label: 'Start angle (radial)', type: 'range', min: -180, max: 180, step: 5 }, { key: 'sweep', label: 'Sweep angle (radial)', type: 'range', min: 90, max: 360, step: 5 },
      { key: 'legend', label: 'Legend content', type: 'select', options: [['clusters', 'clusters'], ['groups', 'known groups'], ['both', 'both'], ['none', 'none']] }, { key: 'legendPos', label: 'Legend position', type: 'select', options: [['auto', 'Automatic'], ['right', 'Top right'], ['left', 'Top left'], ['bottom', 'Below the plot'], ['none', 'Hidden']] },
    ],
    render: cfg => P4.dendrogram(cfg, T),
  });
  if (T.X && T.vars.length >= 2 && !state.isDistance) {
    el('fig4Heatmap').style.display = '';
    mount('fig4Heatmap', {
      title: 'Heat map of the variables with the object tree', fileName: 'clustered_heatmap', width: 900, height: Math.max(480, Math.min(1400, 160 + n * 12)),
      defaults: { palette: 'cluster', groupPalette: 'vivid', cmap: 'rdbu', title: 'Objects × variables, ordered by the tree', k: H.k, cutMode: 'k', cutHeight: 0, scaleCells: true, clusterColumns: true, labels: 'auto', labelSize: 9, labelColour: 'cluster', treeSize: 120, leafOrder: 'default', reverse: false },
      controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'k', label: 'Clusters k', type: 'range', min: 1, max: Math.min(20, n), step: 1 }, { key: 'cmap', label: 'Cell colour map', type: 'select', options: Object.entries(Fig.colormapNames) }, { key: 'scaleCells', label: 'z-score the variables', type: 'checkbox' }, { key: 'clusterColumns', label: 'Cluster the variables too', type: 'checkbox' },
        { key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'automatic (n ≤ 80)'], ['all', 'all'], ['none', 'none']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 5, max: 14, step: 0.5 }, { key: 'labelColour', label: 'Label colour', type: 'select', options: [['cluster', 'by cluster'], ['plain', 'plain']] }, { key: 'treeSize', label: 'Tree size (px)', type: 'range', min: 40, max: 260, step: 10 }, { key: 'leafOrder', label: 'Leaf order', type: 'select', options: [['default', 'tree default'], ['pcoa', 'along the first PCoA axis'], ['group', 'by known grouping'], ['size', 'tight clusters first']] }, pal, gpal],
      render: cfg => P4.heatmap(cfg, T),
    });
  } else el('fig4Heatmap').style.display = 'none';
}

/* ---------- comparison of linkage methods ---------- */
function compareMethods() {
  const D = state.dist.D, n = D.length;
  if (n > 600) { showMessage('cmp4Messages', 'warning', 'Comparison of all methods is limited to 600 objects.'); return; }
  clearMessages('cmp4Messages');
  const ids = els('#cmp4List input:checked').map(i => i.value);
  if (ids.length < 2) { showMessage('cmp4Messages', 'warning', 'Tick at least two methods.'); return; }
  const trees = {}, rows = [], k = state.hclust.k, ref = state.hclust;
  ids.forEach(id => { trees[id] = id === ref.method ? ref.hc : HC.agglomerate(D, id, { beta: +el('hcBeta').value }); });
  const names = ids.map(id => NAME[id]);
  const baker = ids.map(a => ids.map(b => a === b ? 1 : HC.bakerGamma(trees[a], trees[b])));
  const coph = ids.map(a => ids.map(b => a === b ? 1 : HC.copheneticBetween(trees[a], trees[b])));
  ids.forEach((id, i) => {
    const hc = trees[id], cl = HC.cutree(hc, k);
    rows.push({ method: names[i], coph: HC.copheneticCor(D, hc).toFixed(3), coef: HC.coefficient(hc).toFixed(3), rev: HC.reversals(hc), ari: HC.ari(cl, ref.cl).toFixed(3), fm: HC.fowlkesMallows(hc, ref.hc, k).toFixed(3), gari: state.groups ? HC.ari(cl, state.groups).toFixed(3) : '—', sizes: (() => { const c = {}; cl.forEach(x => c[x] = (c[x] || 0) + 1); return Object.values(c).sort((a, b) => b - a).join(' / '); })() });
  });
  state.hclustCompare = { ids, names, trees, baker, coph };
  buildTable('cmp4Table', [{ key: 'method', label: 'Linkage' }, { key: 'coph', label: 'Cophenetic r', num: true }, { key: 'coef', label: 'Aggl./div. coefficient', num: true }, { key: 'rev', label: 'Reversals', num: true }, { key: 'sizes', label: `Cluster sizes at k = ${k}` }, { key: 'ari', label: `ARI vs ${NAME[ref.method]}`, num: true }, { key: 'fm', label: `Fowlkes–Mallows B${k}`, num: true }, { key: 'gari', label: 'ARI vs known groups', num: true }], rows, { caption: 'One tree per linkage rule on the same dissimilarity matrix' });
  try {
    Fig.mount('fig4Methods', {
      title: 'Agreement between linkage methods', fileName: 'linkage_agreement', width: 720, height: 600,
      defaults: { title: 'Agreement between the trees of different linkages', measure: 'baker', cmap: 'viridis' },
      controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'measure', label: 'Measure', type: 'select', options: [['baker', "Baker's gamma (rank correlation of merge levels)"], ['coph', 'Correlation between cophenetic matrices']] }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }],
      render: cfg => P4.methodsHeat(cfg, state.hclustCompare),
    });
  } catch (e) { console.error(e); }
  const best = rows.slice().sort((a, b) => +b.coph - +a.coph)[0];
  let lo = 1, pair = null; for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) if (baker[a][b] < lo) { lo = baker[a][b]; pair = [names[a], names[b]]; }
  el('cmp4Text').innerHTML = `<p><b>${esc(best.method)}</b> gives the highest cophenetic correlation (${best.coph}). ${lo > 0.8 ? `All the trees agree closely (lowest Baker γ ${lo.toFixed(2)} between ${esc(pair[0])} and ${esc(pair[1])}): the structure is robust to the linkage rule.` : lo > 0.5 ? `The linkages agree only moderately (Baker γ down to ${lo.toFixed(2)} between ${esc(pair[0])} and ${esc(pair[1])}): the clusters change with the rule — pick it on theoretical grounds and look at the tanglegram.` : `Strong disagreement between ${esc(pair[0])} and ${esc(pair[1])} (Baker γ ${lo.toFixed(2)}): the hierarchy is not stable across linkages, a sign of weak or non-nested structure.`}</p>`;
  el('cmp4Results').style.display = '';
  fillTangleSelects();
}
function fillTangleSelects() {
  ['tgA', 'tgB'].forEach((id, i) => { const s = el(id); const cur = s.value; s.innerHTML = ''; METHODS.forEach(m => s.appendChild(mk('option', { value: m[0] }, m[1]))); s.value = cur && METHODS.some(m => m[0] === cur) ? cur : (i === 0 ? state.hclust.method : (state.hclust.method === 'average' ? 'ward.D2' : 'average')); });
}
function tanglegram() {
  const D = state.dist.D, a = el('tgA').value, b = el('tgB').value;
  if (a === b) { showMessage('cmp4Messages', 'warning', 'Choose two different linkages.'); return; }
  clearMessages('cmp4Messages');
  const trees = (state.hclustCompare && state.hclustCompare.trees) || {};
  const h1 = trees[a] || (a === state.hclust.method ? state.hclust.hc : HC.agglomerate(D, a, { beta: +el('hcBeta').value }));
  const h2 = trees[b] || (b === state.hclust.method ? state.hclust.hc : HC.agglomerate(D, b, { beta: +el('hcBeta').value }));
  const T2 = { h1, h2, labels: state.dist.labels, name1: NAME[a], name2: NAME[b], untangled: HC.untangle(h1, h2), baker: HC.bakerGamma(h1, h2), coph: HC.copheneticBetween(h1, h2) };
  const n = h1.n;
  try {
    Fig.mount('fig4Tangle', {
      title: 'Tanglegram', fileName: `tanglegram_${a}_${b}`, width: 900, height: Math.max(420, Math.min(1400, 120 + n * 13)),
      defaults: { palette: 'cluster', title: `Tanglegram · ${NAME[a]} vs ${NAME[b]}`, k: state.hclust.k, untangle: true, labels: n <= 80 ? 'auto' : 'none', labelSize: 9, gap: 0.3, branchWidth: 1.6, lineWidth: 1.2, lineColor: '#4f46a5' },
      controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'k', label: 'Colour by clusters of the left tree (k)', type: 'range', min: 1, max: Math.min(20, n), step: 1 }, { key: 'untangle', label: 'Untangle (rotate branches)', type: 'checkbox' }, { key: 'labels', label: 'Labels', type: 'select', options: [['auto', 'shown'], ['none', 'hidden']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 5, max: 14, step: 0.5 }, { key: 'gap', label: 'Space between trees', type: 'range', min: 0.15, max: 0.6, step: 0.05 }, { key: 'branchWidth', label: 'Branch width', type: 'range', min: 0.5, max: 4, step: 0.1 }, { key: 'lineWidth', label: 'Connector width', type: 'range', min: 0.3, max: 4, step: 0.1 }, { key: 'lineColor', label: 'Connector colour (k = 1)', type: 'color' }, { key: 'palette', label: 'Palette', type: 'select', options: Object.entries(Fig.paletteNames) }],
      render: cfg => P4.tanglegram(cfg, T2),
    });
  } catch (e) { console.error(e); el('fig4Tangle').innerHTML = `<div class="msg msg-error">${esc(e.message)}</div>`; }
  el('fig4Tangle').style.display = '';
}

/* ---------- downloads ---------- */
function downloadClusters() {
  const H = state.hclust; if (!H) return;
  const header = ['Object'].concat(state.groups ? ['Group'] : []).concat(['Cluster']);
  download(matrixToCSV(header, H.labels.map((l, i) => [l].concat(state.groups ? [state.groups[i]] : []).concat([H.cl[i]]))), slug(state.fileName) + '_' + H.method + '_k' + H.k + '_clusters.csv', 'text/csv;charset=utf-8');
}
function downloadMerges() {
  const H = state.hclust; if (!H) return;
  const hc = H.hc, lab = v => v < 0 ? H.labels[-v - 1] : 'node ' + v;
  download(matrixToCSV(['Step', 'Left', 'Right', 'Height', 'Size'], hc.merge.map((m, s) => [s + 1, lab(m[0]), lab(m[1]), +hc.height[s].toPrecision(6), HC.members(hc)[s].length])), slug(state.fileName) + '_' + H.method + '_merges.csv', 'text/csv;charset=utf-8');
}

function refresh() {
  if (!state.dist) return;
  state.hclust = null; el('hcResults').style.display = 'none'; el('cmp4Card').style.display = 'none'; el('cmp4Results').style.display = 'none'; el('fig4Tangle').style.display = 'none';
  enableStep(5, false); el('nextBtn4').disabled = true;
  const d = state.dist, eu = d.diag && d.diag.euclid ? d.diag.euclid.negMass : 0;
  let rec, why;
  if (eu < 0.05) { rec = 'ward.D2'; why = `${d.name} is Euclidean-embeddable, so Ward.D2 (compact, equal-variance clusters) is a sound default; UPGMA is the alternative when you care about the fidelity of the tree to the distances.`; }
  else { rec = 'average'; why = `${d.name} is not Euclidean-embeddable (${fmtPct(eu, 0)} negative eigenvalue mass): prefer UPGMA or complete linkage, which only need the matrix. If you want Ward, go back to Block 3 and tick the square-root option (√d).`; }
  if (state.profile && state.profile.type === 'ecological' && rec === 'ward.D2') why += ' For community data UPGMA on Bray–Curtis remains the classical choice.';
  el('hcMethod').value = rec;
  el('hcReco').innerHTML = `<h4>Recommendation</h4><div class="reco-row"><div><b>Linkage</b>${esc(NAME[rec])}</div><div><b>Why</b>${esc(why)}</div></div>`;
  el('hcBetaWrap').style.display = 'none';
}
function init() {
  if (!el('hcMethod')) return;
  const sel = el('hcMethod'); METHODS.forEach(m => sel.appendChild(mk('option', { value: m[0] }, m[1])));
  sel.addEventListener('change', () => { el('hcBetaWrap').style.display = sel.value === 'flexible' ? '' : 'none'; });
  const list = el('cmp4List'); METHODS.forEach(m => { const lab = mk('label', { class: 'checkbox-label', style: 'margin:0' }); const cb = mk('input', { type: 'checkbox', value: m[0] }); cb.checked = ['ward.D2', 'average', 'complete', 'single', 'weighted', 'diana'].includes(m[0]); lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + m[1])); list.appendChild(lab); });
  el('hcRun').addEventListener('click', run);
  el('cutMode').addEventListener('change', toggleCut);
  el('cutApply').addEventListener('click', () => applyCut(false));
  el('cmp4Run').addEventListener('click', compareMethods);
  el('tgRun').addEventListener('click', tanglegram);
  el('dlClustersBtn').addEventListener('click', downloadClusters);
  el('dlMergesBtn').addEventListener('click', downloadMerges);
  el('nextBtn4').addEventListener('click', () => goStep(5));
  document.addEventListener('distchange', refresh);
}
document.addEventListener('DOMContentLoaded', init);
window.HC_METHOD_NAMES = NAME;
})();
