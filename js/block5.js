/* ClusteringPro — Block 5 UI: partitioning, fuzzy, model-based, density-based and spectral clustering. */

(function () {
const METHODS = {
  kmeans:   { name: 'k-means', space: 'coords', help: 'Centroids in coordinate space; minimises the within-cluster sum of squares. Hartigan–Wong by default.' },
  hkmeans:  { name: 'Hierarchical k-means', space: 'coords', help: 'k-means started from the centroids of the Block 4 tree cut at k: no dependence on random starts.' },
  pam:      { name: 'PAM (k-medoids)', space: 'dist', help: 'Medoids are real objects; works on any dissimilarity, robust to outliers.' },
  clara:    { name: 'CLARA', space: 'dist', help: 'PAM on repeated samples, for large n; keeps the medoids with the lowest total cost.' },
  fcm:      { name: 'Fuzzy c-means', space: 'coords', help: 'Every object gets a membership degree in each cluster (fuzzifier m).' },
  gmm:      { name: 'Gaussian mixture (EM + BIC)', space: 'coords', help: 'Model-based: clusters are Gaussian components; BIC selects k and the covariance model.' },
  dbscan:   { name: 'DBSCAN', space: 'dist', help: 'Density-based: core points with ≥ minPts neighbours within ε; arbitrary shapes; outliers become noise.' },
  spectral: { name: 'Spectral', space: 'dist', help: 'k-means on the leading eigenvectors of the normalised affinity graph; recovers curved and nested shapes.' },
};
const NAME = Object.fromEntries(Object.entries(METHODS).map(([k, v]) => [k, v.name]));
let pcoaCache = null;

function coordSpace(source) {
  if (source === 'pcoa') {
    if (!pcoaCache || pcoaCache.distId !== state.dist.id + state.dist.n) { const m = S.cmdscale(state.dist.D); pcoaCache = { distId: state.dist.id + state.dist.n, X: m.points, pct: m.pct }; }
    return { X: pcoaCache.X, name: `PCoA axes of ${state.dist.name} (${pcoaCache.X[0].length} positive axes)`, map: state.dist.mds.points, axisNames: [`PCoA 1 (${fmtPct(state.dist.mds.pct[0] || 0, 1)})`, `PCoA 2 (${fmtPct(state.dist.mds.pct[1] || 0, 1)})`] };
  }
  const pc = state.eda && state.eda.pca ? state.eda.pca : null;
  return { X: state.X, name: state.isDistance ? 'MDS coordinates of your matrix' : 'working matrix from Block 2', map: pc ? pc.scores : state.dist.mds.points, axisNames: pc ? [`${pc.kind === 'MDS' ? 'MDS' : 'PC'}1 (${fmtPct(pc.pct[0] || 0, 1)})`, `${pc.kind === 'MDS' ? 'MDS' : 'PC'}2 (${fmtPct(pc.pct[1] || 0, 1)})`] : ['axis 1', 'axis 2'] };
}
function defaultK() { return state.hclust ? state.hclust.k : state.groups ? new Set(state.groups).size : 3; }
function showParams() {
  const m = el('ptMethod').value;
  el('ptHelp').textContent = METHODS[m].help;
  const show = (id, on) => { el(id).style.display = on ? '' : 'none'; };
  show('pK', !['dbscan', 'gmm'].includes(m) || (m === 'gmm' && el('gmmAuto').value === 'fixed'));
  show('pSource', METHODS[m].space === 'coords');
  show('pKmeans', m === 'kmeans');
  show('pClara', m === 'clara');
  show('pFcm', m === 'fcm');
  show('pGmm', m === 'gmm');
  show('pDbscan', m === 'dbscan');
  show('pSpectral', m === 'spectral');
  show('pSeed', ['kmeans', 'clara', 'fcm', 'gmm', 'spectral'].includes(m));
}

function run() {
  if (!state.dist) return;
  clearMessages('ptMessages');
  const m = el('ptMethod').value, D = state.dist.D, n = D.length, seed = +el('ptSeed').value || 1;
  let k = Math.max(1, Math.min(+el('ptK').value || defaultK(), n - 1));
  const t0 = performance.now();
  let res, space = null;
  try {
    if (METHODS[m].space === 'coords') { space = coordSpace(el('ptSource').value); if (!space.X || !space.X.length) throw new Error('No coordinates available.'); }
    if (m === 'kmeans') res = PT.kmeans(space.X, k, { algorithm: el('kmAlgo').value, nstart: +el('kmNstart').value || 10, init: el('kmInit').value, seed });
    else if (m === 'hkmeans') {
      if (!state.hclust) throw new Error('Build a tree in Block 4 first: hierarchical k-means starts from its cut.');
      const cl = HC.cutree(state.hclust.hc, k); const centers = Array.from({ length: k }, (_, c) => PT.centroidOf(space.X.filter((_, i) => cl[i] === c + 1)));
      res = PT.kmeans(space.X, k, { centers, nstart: 1, algorithm: 'hartigan', seed }); res.method = 'hkmeans'; res.params.init = `centroids of the ${window.HC_METHOD_NAMES ? HC_METHOD_NAMES[state.hclust.method] : state.hclust.method} tree cut at k = ${k}`;
    }
    else if (m === 'pam') { if (n > 800) throw new Error('PAM is limited to 800 objects here; use CLARA.'); res = PT.pam(D, k); }
    else if (m === 'clara') res = PT.clara(D, k, { samples: +el('claraSamples').value || 5, sampleSize: +el('claraSize').value || 0, seed });
    else if (m === 'fcm') res = PT.fcm(space.X, k, { m: +el('fcmM').value || 2, seed });
    else if (m === 'gmm') {
      const models = els('#gmmModels input:checked').map(i => i.value); if (!models.length) throw new Error('Tick at least one covariance model.');
      if (el('gmmAuto').value === 'auto') { const kmax = Math.min(+el('gmmKmax').value || 8, n - 1); const sel = PT.gmmSelect(space.X, Array.from({ length: kmax - 1 }, (_, i) => i + 2), models, { seed }); if (!sel.best) throw new Error('No mixture could be fitted (singular covariances). Try spherical or diagonal models.'); res = sel.best.fit; res.selection = sel; k = res.k; }
      else { const sel = PT.gmmSelect(space.X, [k], models, { seed }); if (!sel.best) throw new Error('No mixture could be fitted.'); res = sel.best.fit; res.selection = sel; }
    }
    else if (m === 'dbscan') {
      const minPts = Math.max(2, +el('dbMinPts').value || 4);
      const knd = PT.knnDist(D, minPts - 1), sorted = knd.slice().sort((a, b) => b - a), knee = PT.knee(sorted);
      let eps = +el('dbEps').value; const auto = !(eps > 0); if (auto) { eps = sorted[knee]; el('dbEps').value = +eps.toPrecision(4); }
      res = PT.dbscan(D, eps, minPts); res.knnSorted = sorted; res.knee = knee; res.epsAuto = auto; res.kNN = minPts - 1; k = res.k;
      if (k === 0) throw new Error(`DBSCAN found no cluster with ε = ${fmtNum(eps, 4)} and minPts = ${minPts}: every object is noise. Increase ε or lower minPts.`);
    }
    else if (m === 'spectral') { if (n > 500) throw new Error('Spectral clustering is limited to 500 objects here.'); res = PT.spectral(D, k, { neighbours: +el('spNeigh').value || 7, graph: el('spGraph').value, sigma: +el('spSigma').value || 0 }); }
  } catch (e) { showMessage('ptMessages', 'error', esc(e.message)); return; }
  res.ms = performance.now() - t0;
  finish(res, space);
}
function finish(res, space) {
  const R = res; const n = R.cluster.length, cl = R.cluster;
  R.name = NAME[R.method]; R.labels = state.dist.labels; R.groups = state.groups;
  R.sil = PT.silhouette(state.dist.D, cl);
  if (space) { R.space = space.name; R.coords = space.map.map(p => [p[0], p[1] == null ? 0 : p[1]]); R.axisNames = space.axisNames; R.ssq = PT.ss(space.X, cl); }
  else { R.space = state.dist.fam === 'given' ? 'supplied dissimilarity matrix' : state.dist.name + ' dissimilarity matrix'; R.coords = state.dist.mds.points.map(p => [p[0], p[1] == null ? 0 : p[1]]); R.axisNames = [`PCoA 1 (${fmtPct(state.dist.mds.pct[0] || 0, 1)})`, `PCoA 2 (${fmtPct(state.dist.mds.pct[1] || 0, 1)})`]; }
  R.centers2d = Array.from({ length: R.k }, (_, c) => { if (R.medoids) return R.coords[R.medoids[c]]; const pts = R.coords.filter((_, i) => cl[i] === c + 1); return pts.length ? [S.mean(pts.map(p => p[0])), S.mean(pts.map(p => p[1]))] : null; });
  R.sizes = PT.sizes(cl);
  if (state.groups && R.k > 1) R.ariGroups = HC.ari(cl, state.groups);
  if (state.hclust && state.hclust.cl) R.ariTree = HC.ari(cl, state.hclust.cl);
  state.partition = R;
  renderResults(R);
  mountFigures(R);
  el('ptResults').style.display = ''; el('cmp5Card').style.display = '';
  enableStep(6, true); el('nextBtn5').disabled = false;
  document.dispatchEvent(new CustomEvent('partitionchange'));
  el('ptResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResults(R) {
  const sil = R.sil, lvl = sil.avg >= 0.7 ? 'ok' : sil.avg >= 0.5 ? 'ok' : sil.avg >= 0.25 ? 'warn' : 'bad';
  const clustered = R.cluster.filter(c => c > 0).length, single = R.k < 2;
  const silSub = single ? 'undefined for a single cluster' : (sil.negatives ? `${sil.negatives} object${sil.negatives > 1 ? 's' : ''} with s < 0` : 'no negative silhouettes') + (R.noise ? ` · on the ${clustered} clustered objects (noise excluded)` : '');
  const tiles = [['Method', R.name, R.space], ['Clusters', R.k, R.method === 'dbscan' ? `${R.noise} noise object${R.noise === 1 ? '' : 's'}` : `sizes ${Object.values(R.sizes).join(' / ')}`], ['Average silhouette', single ? '—' : fmtFixed(sil.avg, 3), silSub, single ? '' : lvl]];
  if (R.ssq) tiles.push(['Between-SS / total-SS', fmtPct(R.ssq.bss / R.ssq.tss, 1), 'variance explained by the partition', R.ssq.bss / R.ssq.tss > 0.6 ? 'ok' : R.ssq.bss / R.ssq.tss > 0.4 ? 'warn' : '']);
  if (R.method === 'kmeans' || R.method === 'hkmeans') tiles.push(['Iterations', R.iter, `${R.params.algorithm} · ${R.params.nstart} start${R.params.nstart > 1 ? 's' : ''} · ${({ pp: 'k-means++', 'k-means++': 'k-means++', random: 'random objects' })[R.params.init] || R.params.init}`]);
  if (R.method === 'pam') tiles.push(['Total cost', fmtNum(R.cost, 3), `${R.iter} swap${R.iter === 1 ? '' : 's'}`]);
  if (R.method === 'clara') tiles.push(['Best sample', `${R.sample} of ${R.params.samples}`, `sample size ${R.params.sampleSize} · cost ${fmtNum(R.cost, 3)}`]);
  if (R.method === 'fcm') tiles.push(['Partition coefficient', fmtFixed(R.pc, 3), `normalised ${fmtFixed(R.pcNorm, 3)} · entropy ${fmtFixed(R.pe, 3)}`, R.pcNorm > 0.7 ? 'ok' : R.pcNorm > 0.4 ? 'warn' : 'bad']);
  if (R.method === 'gmm') tiles.push(['Model', `${R.params.model} · k = ${R.k}`, `BIC ${fmtNum(R.bic, 1)} · log-lik ${fmtNum(R.loglik, 1)}`], ['Mean uncertainty', fmtFixed(S.mean(R.uncertainty), 3), `${R.uncertainty.filter(u => u > 0.25).length} objects above 0.25`]);
  if (R.method === 'dbscan') tiles.push(['ε · minPts', `${fmtNum(R.params.eps, 4)} · ${R.params.minPts}`, R.epsAuto ? 'ε from the knee of the k-NN plot' : 'ε set by hand'], ['Noise', `${R.noise} (${fmtPct(R.noise / R.cluster.length, 0)})`, `${R.core.filter(Boolean).length} core points`, R.noise / R.cluster.length > 0.3 ? 'warn' : 'ok']);
  if (R.method === 'spectral') tiles.push(['Affinity graph', `${R.params.graph === 'full' ? 'full' : R.params.neighbours + '-NN'} · σ ${fmtNum(R.params.sigma, 3)}`, 'Gaussian kernel on the dissimilarity']);
  if (R.ariTree != null) tiles.push(['ARI vs Block 4 tree', fmtFixed(R.ariTree, 3), state.hclust.k === R.k ? 'same k' : `tree cut at k = ${state.hclust.k}`, R.ariTree > 0.7 ? 'ok' : R.ariTree > 0.4 ? 'warn' : '']);
  if (R.ariGroups != null) tiles.push(['ARI vs known groups', fmtFixed(R.ariGroups, 3), 'external validation', R.ariGroups > 0.7 ? 'ok' : R.ariGroups > 0.4 ? 'warn' : 'bad']);
  statTiles('ptTiles', tiles);
  const checks = []; const add = (l, t, x) => checks.push([l, t, x]);
  if (single) { /* the silhouette is undefined with a single cluster */ }
  else if (sil.avg >= 0.7) add('ok', `Strong structure (silhouette ${fmtFixed(sil.avg, 2)})`, 'Objects are much closer to their own cluster than to the nearest other one.');
  else if (sil.avg >= 0.5) add('ok', `Reasonable structure (silhouette ${fmtFixed(sil.avg, 2)})`, 'A clear partition with some objects near the boundaries.');
  else if (sil.avg >= 0.25) add('warn', `Weak structure (silhouette ${fmtFixed(sil.avg, 2)})`, 'Clusters overlap; the partition may still be useful but treat it as exploratory and check the stability in Block 6.');
  else add('bad', `No substantial structure (silhouette ${fmtFixed(sil.avg, 2)})`, 'Objects are about as close to other clusters as to their own. Try a different k, method or dissimilarity.');
  if (!single && R.noise && R.noise / R.cluster.length > 0.2) add('info', 'The silhouette ignores the noise objects', `It is computed on the ${clustered} objects placed in clusters. With ${fmtPct(R.noise / R.cluster.length, 0)} of the objects set aside as noise, a high silhouette describes only the dense cores; compare methods on all the objects before preferring this partition.`);
  const worst = Object.entries(sil.byCluster).sort((a, b) => a[1] - b[1])[0];
  if (worst && worst[1] < 0.2 && R.k > 1) add('warn', `Cluster ${worst[0]} is poorly defined (silhouette ${fmtFixed(worst[1], 2)})`, 'Its members are close to other clusters: it may be a leftover group or a gradient split in two.');
  const tiny = Object.entries(R.sizes).filter(([c, v]) => +c > 0 && v < 3);
  if (tiny.length) add('warn', `${tiny.length} tiny cluster${tiny.length > 1 ? 's' : ''} (fewer than 3 objects)`, `${tiny.map(t => 'C' + t[0]).join(', ')}: probably outliers captured as clusters. PAM or DBSCAN handle them better than k-means.`);
  if (R.ariTree != null && state.hclust.k === R.k) add(R.ariTree > 0.7 ? 'ok' : 'info', `Agreement with the hierarchical cut: ARI ${fmtFixed(R.ariTree, 2)}`, R.ariTree > 0.7 ? 'Two different algorithms find the same groups: a good sign of real structure.' : 'The partition differs from the tree cut; the objects that change are the ambiguous ones (see the silhouette plot).');
  if (R.ariGroups != null) add(R.ariGroups > 0.7 ? 'ok' : R.ariGroups > 0.4 ? 'info' : 'warn', `Known grouping recovered with ARI ${fmtFixed(R.ariGroups, 2)}`, R.ariGroups > 0.7 ? 'The clusters reproduce your classification.' : 'Partial agreement: the data carry structure that your grouping does not, or vice versa.');
  if ((R.method === 'kmeans' || R.method === 'hkmeans' || R.method === 'fcm' || R.method === 'gmm') && state.dist.fam !== 'quant' && state.dist.fam !== 'given' && el('ptSource').value === 'working') add('info', 'Coordinate method on the working matrix', `Your Block 3 dissimilarity is ${state.dist.name}, but ${R.name} works in Euclidean coordinates. Choose "PCoA axes" as the coordinate source to make it consistent with that dissimilarity, or compare with PAM, which uses the matrix directly.`);
  if (R.method === 'dbscan') { if (R.noise / R.cluster.length > 0.3) add('warn', 'More than 30 % of the objects are noise', 'Raise ε or lower minPts; or the data are simply not dense anywhere.'); if (R.k === 1) add('info', 'A single dense cluster', 'Everything reachable is connected: lower ε to split it, or accept that there is one core group plus outliers.'); }
  if (R.method === 'fcm' && R.pcNorm < 0.4) add('warn', 'Very fuzzy partition', 'Memberships are spread across clusters: the groups overlap heavily or the fuzzifier m is too large (try 1.5).');
  if (R.method === 'gmm' && R.selection && R.selection.table.length > 1) add('info', `BIC chose ${R.params.model} with k = ${R.k}`, `Compared ${R.selection.table.filter(t => isFinite(t.bic)).length} fits. ${PT.gmmModels[R.params.model]}. Prefer the simplest model whose BIC is within a few units of the best.`);
  const host = el('ptChecks'); host.innerHTML = '';
  checks.forEach(([level, title, text]) => host.appendChild(mk('div', { class: 'check-item ' + level }, `<div class="ck-icon">${level === 'ok' ? '✅' : level === 'bad' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${title}</div><div class="ck-text">${text}</div></div>`)));
  /* cluster table */
  const rows = [];
  for (let c = 1; c <= R.k; c++) { const mem = R.labels.filter((_, i) => R.cluster[i] === c); rows.push({ c: `Cluster ${c}`, n: mem.length, sil: R.k < 2 ? '—' : fmtFixed(sil.byCluster[c], 3), rep: R.medoids ? `medoid: ${esc(R.labels[R.medoids[c - 1]])}` : R.centers ? 'centroid' : '—', members: mem.slice(0, 30).map(esc).join(', ') + (mem.length > 30 ? ` … (+${mem.length - 30})` : '') }); }
  if (R.cluster.includes(0)) rows.push({ c: 'Noise', n: R.noise, sil: '—', rep: '—', members: R.labels.filter((_, i) => R.cluster[i] === 0).slice(0, 30).map(esc).join(', ') });
  buildTable('ptClusterTable', [{ key: 'c', label: 'Cluster' }, { key: 'n', label: 'n', num: true }, { key: 'sil', label: 'Mean silhouette', num: true }, { key: 'rep', label: 'Representative', html: true }, { key: 'members', label: 'Members', html: true }], rows);
  const ct = el('ptCrossTable'); ct.innerHTML = '';
  const cross = (other, title, ari) => {
    const ct0 = HC.contingency(R.cluster, other), isTree = /^tree C/.test(String(ct0.lb[0]));
    /* tree-cut columns in natural order (tree C1, C2, C3…); known groups keep the order of the data */
    const ordB = ct0.lb.map((g, j) => j).sort((p, q) => String(ct0.lb[p]).localeCompare(String(ct0.lb[q]), undefined, { numeric: true }));
    const la = ct0.la, lb = isTree ? ordB.map(j => ct0.lb[j]) : ct0.lb, M = isTree ? ct0.M.map(r => ordB.map(j => r[j])) : ct0.M; const cols = [{ key: 'c', label: title }].concat(lb.map((g, j) => ({ key: 'g' + j, label: esc(String(g)), num: true }))); const rws = la.map((c, i) => { const o = { c: c === 0 ? 'Noise' : `Cluster ${c}` }; lb.forEach((g, j) => o['g' + j] = M[i][j]); return o; }).sort((a, b) => (a.c === 'Noise' ? 99 : +a.c.slice(8)) - (b.c === 'Noise' ? 99 : +b.c.slice(8))); const d = mk('div', { class: 'table-scroll', style: 'margin-top:10px' }); buildTable(d, cols, rws, { caption: `${title} · adjusted Rand index ${ari.toFixed(3)}` }); ct.appendChild(d); };
  if (state.groups && R.k > 1) cross(state.groups, 'Cluster \\ known group', R.ariGroups);
  if (state.hclust && state.hclust.cl) cross(state.hclust.cl.map(c => 'tree C' + c), 'Cluster \\ Block 4 tree cut', R.ariTree);
}

function mountFigures(R) {
  const pal = { key: 'palette', label: 'Palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  const leg = { key: 'legendPos', label: 'Legend position', type: 'select', options: [['right', 'Top right'], ['left', 'Top left'], ['bottom', 'Below the plot'], ['none', 'Hidden']] };
  const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">Figure "${esc(spec.title)}" could not be drawn: ${esc(e.message)}</div>`; } };
  const n = R.cluster.length;
  mount('fig5Map', {
    title: 'Cluster map', fileName: `${R.method}_cluster_map`, width: 900, height: 600,
    defaults: { palette: 'cluster', title: `${R.name} · k = ${R.k}`, subtitle: R.k < 2 ? `${R.space} · a single cluster` : `${R.space} · average silhouette ${R.sil.avg.toFixed(3)}${R.noise ? ' (noise excluded)' : ''}`, region: 'ellipse', regionAlpha: 0.12, centers: R.medoids ? 'medoid' : 'centroid', centerLabels: true, labels: 'auto', labelSize: 9, pointSize: 4.5, shape: 'circle', shapeBy: state.groups ? 'group' : 'none', certainty: true, noiseColor: '#9a9ab0', legendPos: 'right' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' }, { key: 'xlab', label: 'X axis title', type: 'text' }, { key: 'ylab', label: 'Y axis title', type: 'text' },
      { key: 'region', label: 'Cluster region', type: 'select', options: [['ellipse', '95 % concentration ellipse'], ['hull', 'convex hull'], ['none', 'none']] }, { key: 'regionAlpha', label: 'Region opacity', type: 'range', min: 0, max: 0.5, step: 0.02 },
      { key: 'centers', label: 'Centres', type: 'select', options: [['centroid', 'centroid (◆)'], ['medoid', 'medoid (ring)'], ['none', 'none']] }, { key: 'centerLabels', label: 'Cluster numbers at the centres', type: 'checkbox' },
      { key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'automatic (n ≤ 60)'], ['all', 'all'], ['none', 'none']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 6, max: 16, step: 0.5 },
      { key: 'pointSize', label: 'Point size', type: 'range', min: 2, max: 10, step: 0.5 }, { key: 'shape', label: 'Point shape', type: 'select', options: Fig.shapes }, { key: 'shapeBy', label: 'Shape by known group', type: 'select', options: [['none', 'no'], ['group', 'yes']] },
      { key: 'certainty', label: 'Fade uncertain objects (fuzzy / mixture)', type: 'checkbox' }, { key: 'noiseColor', label: 'Noise colour', type: 'color' }, pal, leg],
    render: cfg => P5.map(cfg, R),
  });
  mount('fig5Sil', {
    title: 'Silhouette plot', fileName: `${R.method}_silhouette`, width: 760, height: Math.max(380, Math.min(1200, 120 + n * 7)),
    defaults: { palette: 'cluster', title: `Silhouette widths · ${R.name}, k = ${R.k}`, labels: n <= 60, avgColor: '#d64a6a' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'labels', label: 'Object labels (n ≤ 80)', type: 'checkbox' }, { key: 'avgColor', label: 'Mean line colour', type: 'color' }, pal],
    render: cfg => P5.silhouette(cfg, R),
  });
  mount('fig5Sizes', {
    title: 'Cluster sizes', fileName: `${R.method}_sizes`, width: 620, height: 380,
    defaults: { palette: 'cluster', title: 'Objects per cluster', noiseColor: '#9a9ab0' },
    controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'noiseColor', label: 'Noise colour', type: 'color' }, pal],
    render: cfg => P5.sizes(cfg, R),
  });
  const extra = el('fig5Extra'); extra.style.display = '';
  if (R.membership) mount('fig5Extra', { title: R.method === 'gmm' ? 'Posterior membership probabilities' : 'Membership degrees', fileName: `${R.method}_membership`, width: 760, height: Math.max(380, Math.min(1200, 120 + n * 9)), defaults: { palette: 'cluster', title: R.method === 'gmm' ? 'Posterior probability of each component' : `Fuzzy memberships (m = ${R.params.m})`, cmap: 'viridis', labels: 'auto' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }, { key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'shown (n ≤ 80)'], ['none', 'hidden']] }, pal], render: cfg => P5.membership(cfg, R) });
  else if (R.method === 'dbscan') mount('fig5Extra', { title: 'k-NN distance plot (choosing ε)', fileName: 'dbscan_knn_plot', width: 760, height: 420, defaults: { palette: 'cluster', title: `Sorted ${R.kNN}-NN distances · knee at ε = ${fmtNum(R.params.eps, 4)}` }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal], render: cfg => P5.knn(cfg, R) });
  else extra.style.display = 'none';
  const bicHost = el('fig5Bic');
  if (R.method === 'gmm' && R.selection && R.selection.table.length > 1) { bicHost.style.display = ''; mount('fig5Bic', { title: 'BIC by number of components and model', fileName: 'gmm_bic', width: 760, height: 460, defaults: { palette: 'cluster', title: 'Model selection by BIC', legendPos: 'bottom' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal, leg], render: cfg => P5.bic(cfg, R.selection) }); }
  else bicHost.style.display = 'none';
}

/* ---------- compare methods at the same k ---------- */
function compare() {
  if (!state.dist) return;
  clearMessages('cmp5Messages');
  const ids = els('#cmp5List input:checked').map(i => i.value);
  if (ids.length < 2) { showMessage('cmp5Messages', 'warning', 'Tick at least two methods.'); return; }
  const k = Math.max(2, Math.min(+el('ptK').value || defaultK(), state.dist.n - 1)), D = state.dist.D, seed = +el('ptSeed').value || 1;
  const space = coordSpace(el('ptSource').value);
  const results = [], names = [];
  ids.forEach(id => {
    try {
      let r;
      if (id === 'kmeans') r = PT.kmeans(space.X, k, { nstart: 10, seed });
      else if (id === 'hkmeans') { if (!state.hclust) return; const cl = HC.cutree(state.hclust.hc, k); r = PT.kmeans(space.X, k, { centers: Array.from({ length: k }, (_, c) => PT.centroidOf(space.X.filter((_, i) => cl[i] === c + 1))), nstart: 1 }); }
      else if (id === 'pam') r = PT.pam(D, k);
      else if (id === 'clara') r = PT.clara(D, k, { seed });
      else if (id === 'fcm') r = PT.fcm(space.X, k, { seed });
      else if (id === 'gmm') { const s = PT.gmmSelect(space.X, [k], ['VVI', 'VVV'], { seed }); if (!s.best) return; r = s.best.fit; }
      else if (id === 'spectral') r = PT.spectral(D, k, {});
      else if (id === 'hier') { if (!state.hclust) return; r = { method: 'hier', k, cluster: HC.cutree(state.hclust.hc, k) }; }
      if (!r) return;
      r.sil = PT.silhouette(D, r.cluster); r.ssq = PT.ss(space.X, r.cluster);
      results.push(r); names.push(id === 'hier' ? `Tree (${HC_METHOD_NAMES[state.hclust.method]})` : NAME[id]);
    } catch (e) { showMessage('cmp5Messages', 'warning', `${esc(NAME[id] || id)}: ${esc(e.message)}`); }
  });
  if (results.length < 2) return;
  const ARI = results.map(a => results.map(b => HC.ari(a.cluster, b.cluster)));
  state.partitionCompare = { names, results, ARI };
  const rows = results.map((r, i) => ({ method: names[i], sil: r.sil.avg.toFixed(3), neg: r.sil.negatives, bss: fmtPct(r.ssq.bss / r.ssq.tss, 1), sizes: Object.values(PT.sizes(r.cluster)).join(' / '), ariMean: (ARI[i].reduce((s, v, j) => s + (j === i ? 0 : v), 0) / (results.length - 1)).toFixed(3), gari: state.groups ? HC.ari(r.cluster, state.groups).toFixed(3) : '—' }));
  buildTable('cmp5Table', [{ key: 'method', label: 'Method' }, { key: 'sil', label: 'Mean silhouette', num: true }, { key: 'neg', label: 's < 0', num: true }, { key: 'bss', label: 'BSS / TSS', num: true }, { key: 'sizes', label: 'Cluster sizes' }, { key: 'ariMean', label: 'Mean ARI with the others', num: true }, { key: 'gari', label: 'ARI vs known groups', num: true }], rows, { caption: `All methods at k = ${k} · silhouette on ${state.dist.name}` });
  try { Fig.mount('fig5Agree', { title: 'Agreement between methods', fileName: 'method_agreement', width: 700, height: 580, defaults: { title: `Adjusted Rand index between partitions (k = ${k})`, measure: 'baker', cmap: 'viridis' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }], render: cfg => P4.methodsHeat(cfg, { names, baker: ARI, coph: ARI }) }); } catch (e) { console.error(e); }
  const best = rows.slice().sort((a, b) => +b.sil - +a.sil)[0];
  let lo = 1, pair = null; for (let a = 0; a < results.length; a++) for (let b = a + 1; b < results.length; b++) if (ARI[a][b] < lo) { lo = ARI[a][b]; pair = [names[a], names[b]]; }
  el('cmp5Text').innerHTML = `<p><b>${esc(best.method)}</b> reaches the highest silhouette (${best.sil}). ${lo > 0.8 ? `All methods essentially agree (lowest ARI ${lo.toFixed(2)}, ${esc(pair[0])} vs ${esc(pair[1])}): the groups are robust to the algorithm.` : lo > 0.5 ? `Moderate agreement (lowest ARI ${lo.toFixed(2)} between ${esc(pair[0])} and ${esc(pair[1])}): a core of objects is stable, the rest depends on the algorithm.` : `Methods disagree (${esc(pair[0])} vs ${esc(pair[1])}: ARI ${lo.toFixed(2)}): the partition is not robust; reconsider k (Block 6) or the assumptions of the methods (shape, density, Euclidean geometry).`}</p>`;
  el('cmp5Results').style.display = '';
}

function downloadMembership() {
  const R = state.partition; if (!R) return;
  const header = ['Object'].concat(state.groups ? ['Group'] : []).concat(['Cluster']).concat(R.membership ? Array.from({ length: R.k }, (_, j) => (R.method === 'gmm' ? 'P_C' : 'u_C') + (j + 1)) : []).concat(R.sil ? ['Silhouette'] : []);
  const rows = R.labels.map((l, i) => [l].concat(state.groups ? [state.groups[i]] : []).concat([R.cluster[i]]).concat(R.membership ? R.membership[i].map(v => +v.toFixed(4)) : []).concat(R.sil ? [+R.sil.s[i].toFixed(4)] : []));
  download(matrixToCSV(header, rows), slug(state.fileName) + '_' + R.method + '_k' + R.k + '.csv', 'text/csv;charset=utf-8');
}

function refresh() {
  if (!state.dist) return;
  state.partition = null; el('ptResults').style.display = 'none'; el('cmp5Card').style.display = 'none'; el('cmp5Results').style.display = 'none';
  enableStep(6, false); el('nextBtn5').disabled = true;
  el('ptK').value = defaultK();
  el('dbEps').value = 0;   /* an ε found for other data would be meaningless here */
  renderReco();
}
/* the recommendation depends on the Block 4 tree too, so it is redrawn when the tree changes */
function renderReco() {
  const eu = state.dist.diag && state.dist.diag.euclid ? state.dist.diag.euclid.negMass : 0;
  const quantLike = state.dist.fam === 'quant' && /euclid|sqeuclid|pca/.test(state.dist.id);
  el('ptSource').value = quantLike || state.isDistance ? 'working' : 'pcoa';
  let rec = 'kmeans', why;
  const t = state.profile ? state.profile.type : 'quant';
  if (state.isDistance) { rec = 'pam'; why = 'Your supplied matrix is used as it is: PAM works directly on the matrix and its medoids are real objects.'; }
  else if (t === 'mixed' || t === 'nominal' || t === 'binary' || t === 'ordinal') { rec = 'pam'; why = `${state.dist.name} is not a Euclidean distance on raw coordinates: PAM works directly on the matrix and its medoids are real objects.`; }
  else if (t === 'ecological') { rec = 'pam'; why = 'For community data PAM on Bray–Curtis (or k-means on Hellinger-transformed data) is the standard route.'; }
  else if (state.eda && state.eda.maha && state.eda.maha.d2.some(d => d > state.eda.maha.thresholdStrict)) { rec = 'pam'; why = 'Extreme outliers were flagged in Block 2: medoids resist them better than centroids.'; }
  else { rec = state.hclust ? 'hkmeans' : 'kmeans'; why = state.hclust ? 'Quantitative data with a Ward tree available: seeding k-means with the tree centroids gives a reproducible, refined partition.' : 'Quantitative data in Euclidean space: k-means (Hartigan–Wong, many starts) is fast and well understood.'; }
  if (eu >= 0.1 && rec !== 'pam') why += ' The dissimilarity is not Euclidean-embeddable, so coordinate methods use the PCoA axes.';
  el('ptMethod').value = rec;
  el('ptReco').innerHTML = `<h4>Recommendation</h4><div class="reco-row"><div><b>Method</b>${esc(NAME[rec])}</div><div><b>k to start with</b>${defaultK()} (${state.hclust ? 'tree cut of Block 4' : state.groups ? 'your known groups' : 'default'}; Block 6 will test a range)</div><div><b>Why</b>${esc(why)}</div></div>`;
  showParams();
}
function init() {
  if (!el('ptMethod')) return;
  const sel = el('ptMethod'); Object.entries(METHODS).forEach(([id, m]) => sel.appendChild(mk('option', { value: id }, m.name)));
  sel.addEventListener('change', showParams);
  el('gmmAuto').addEventListener('change', showParams);
  const gm = el('gmmModels'); Object.entries(PT.gmmModels).forEach(([id, txt]) => { const lab = mk('label', { class: 'checkbox-label', style: 'margin:0' }); const cb = mk('input', { type: 'checkbox', value: id }); cb.checked = ['VII', 'VVI', 'VVV'].includes(id); lab.appendChild(cb); lab.appendChild(document.createTextNode(` ${id} — ${txt}`)); gm.appendChild(lab); });
  const cl = el('cmp5List'); [['hier', 'Hierarchical cut (Block 4)'], ...Object.entries(NAME).filter(([id]) => id !== 'dbscan')].forEach(([id, nm]) => { const lab = mk('label', { class: 'checkbox-label', style: 'margin:0' }); const cb = mk('input', { type: 'checkbox', value: id }); cb.checked = ['hier', 'kmeans', 'pam', 'fcm', 'gmm'].includes(id); lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + nm)); cl.appendChild(lab); });
  el('ptRun').addEventListener('click', run);
  el('cmp5Run').addEventListener('click', compare);
  el('dlMembershipBtn').addEventListener('click', downloadMembership);
  el('nextBtn5').addEventListener('click', () => goStep(6));
  document.addEventListener('distchange', refresh);
  document.addEventListener('hclustchange', () => { if (state.dist && !state.partition) { el('ptK').value = defaultK(); renderReco(); } });
}
document.addEventListener('DOMContentLoaded', init);
window.PT_METHOD_NAMES = NAME;
})();
