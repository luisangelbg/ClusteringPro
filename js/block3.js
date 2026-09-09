/* ClusteringPro — Block 3 UI: choose a coefficient, compute the dissimilarity matrix, diagnose it,
   draw it, and compare candidate coefficients. */

(function () {
let src = null, fam = 'quant';

function famsAvailable() { return src ? src.families : []; }
function coefsFor(f) { return Dist.catalog.filter(c => c.fam === f); }

function renderTabs() {
  const host = el('famTabs'); host.innerHTML = '';
  famsAvailable().forEach(f => {
    const b = mk('button', { class: 'tab' + (f === fam ? ' active' : ''), type: 'button' }, Dist.families[f].label);
    b.addEventListener('click', () => { fam = f; renderTabs(); renderCoefs(); });
    host.appendChild(b);
  });
  el('famHelp').textContent = Dist.families[fam] ? Dist.families[fam].help : '';
}
function renderCoefs(keepId) {
  const sel = el('coefSel'); sel.innerHTML = '';
  coefsFor(fam).forEach(c => sel.appendChild(mk('option', { value: c.id }, c.name)));
  if (keepId && coefsFor(fam).some(c => c.id === keepId)) sel.value = keepId;
  describe();
}
function describe() {
  const c = Dist.byId(el('coefSel').value); if (!c) return;
  el('coefDesc').innerHTML = `<div class="formula">${esc(c.formula)}</div><p class="hint" style="margin:6px 0 0">${esc(c.note)} Range: ${esc(c.range)}.</p>`;
  el('pMink').style.display = c.id === 'minkowski' ? '' : 'none';
  el('pK').style.display = c.id === 'pca_euclid' ? '' : 'none';
  el('pGower').style.display = c.id === 'gower' ? '' : 'none';
  el('pSource').style.display = c.fam === 'quant' ? '' : 'none';
  if (c.id === 'pca_euclid' && src) { const p = src.quantWorking.names.length; el('pcaK').max = p; if (+el('pcaK').value > p) el('pcaK').value = Math.min(2, p); }
  if (c.id === 'gower' && src) renderGowerWeights();
}
function renderGowerWeights() {
  const host = el('gowerWeights'); host.innerHTML = '';
  const names = [].concat(src.quantRaw.names, src.binary && !src.binary.derived ? src.binary.names : [], src.nominal ? src.nominal.names : []);
  names.forEach(nm => {
    const lab = mk('label', { class: 'inline-label' }, `${esc(nm)} `);
    const inp = mk('input', { type: 'number', min: 0, max: 10, step: 0.5, value: 1, style: 'width:64px', 'data-name': nm });
    lab.appendChild(inp); host.appendChild(lab);
  });
}
function gowerWeights() { const W = {}; els('#gowerWeights input').forEach(i => { W[i.dataset.name] = +i.value; }); return W; }
function currentOpts() { return { p: +el('minkP').value, k: +el('pcaK').value, gowerBinary: el('gowerBinary').value, gowerWeights: gowerWeights(), source: el('sourceSel').value }; }

function compute() {
  clearMessages('distMessages');
  let R;
  try { R = Dist.compute(el('coefSel').value, currentOpts()); }
  catch (e) { showMessage('distMessages', 'error', esc(e.message)); return; }
  R.groups = state.groups;
  R.diag = Dist.diagnose(R.D);
  const m = R.diag.euclid ? R.diag.euclid.mds : S.cmdscale(R.D, 2);
  R.mds = { points: m.points.map(p => [p[0], p[1] == null ? 0 : p[1]]), pct: m.pct };
  /* stress-1 of the 2-D configuration after the best linear rescaling of the map distances
     (classical MDS always shrinks distances; the rescaling removes that harmless bias) */
  const dd = [], dh = [];
  for (let i = 0; i < R.n; i++) for (let j = i + 1; j < R.n; j++) { dd.push(R.D[i][j]); dh.push(Math.hypot(R.mds.points[i][0] - R.mds.points[j][0], R.mds.points[i][1] - R.mds.points[j][1])); }
  const b = dh.reduce((s, v, k) => s + v * dd[k], 0) / (dh.reduce((s, v) => s + v * v, 0) || 1);
  let num = 0, den = 0; dd.forEach((d, k) => { num += (d - b * dh[k]) ** 2; den += d * d; });
  R.stress = den ? Math.sqrt(num / den) : 0;
  state.dist = R;
  if (R.warning) showMessage('distMessages', 'warning', esc(R.warning));
  renderResults(R);
  P3.mountAll(R);
  el('distResults').style.display = '';
  el('cmpCard').style.display = '';
  renderCmpList();
  enableStep(4, true); el('nextBtn3').disabled = false;
  document.dispatchEvent(new CustomEvent('distchange'));
  el('distResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResults(R) {
  const d = R.diag, c = Dist.byId(R.id);
  const tiles = [
    ['Coefficient', c.name, R.params.p ? `p = ${R.params.p}` : R.params.k ? `${R.params.k} components (${fmtPct(R.params.varExplained, 0)})` : R.params.components ? `${R.params.components} components` : R.params.binary ? `binary: ${R.params.binary}` : Dist.families[c.fam].label],
    ['Objects', R.n, `${R.n * (R.n - 1) / 2} pairs`],
    ['Range of d', `${fmtNum(d.min, 3)} – ${fmtNum(d.max, 3)}`, `mean ${fmtNum(d.mean, 3)} · median ${fmtNum(d.median, 3)}`],
    ['Identical pairs (d = 0)', d.zeros, d.zeros ? 'duplicates or ties' : 'none', d.zeros > R.n * 0.05 ? 'warn' : 'ok'],
    ['Triangle inequality', d.viol ? `${fmtPct(d.viol / d.tested, 1)} violated` : 'holds', d.viol ? 'not a metric' : 'metric', d.viol ? 'warn' : 'ok'],
  ];
  if (d.euclid) tiles.push(['Euclidean embeddable', d.euclid.negMass < 0.01 ? 'yes' : d.euclid.negMass < 0.1 ? 'nearly' : 'no', `${fmtPct(d.euclid.negMass, 1)} of the eigenvalue mass is negative`, d.euclid.negMass < 0.01 ? 'ok' : d.euclid.negMass < 0.1 ? 'warn' : 'bad']);
  tiles.push(['2-D map quality', `stress ${R.stress.toFixed(3)}`, `${fmtPct((R.mds.pct[0] || 0) + (R.mds.pct[1] || 0), 0)} of the variance in two axes`, R.stress < 0.1 ? 'ok' : R.stress < 0.2 ? 'warn' : 'bad']);
  statTiles('distTiles', tiles);
  const checks = [];
  const add = (level, title, text) => checks.push([level, title, text]);
  add('info', R.note, `Variables used: ${(R.vars || []).length ? esc(R.vars.slice(0, 12).join(', ')) + (R.vars.length > 12 ? ` … (${R.vars.length})` : '') : 'the supplied matrix'}.`);
  if (d.zeros) add(d.zeros > R.n * 0.05 ? 'warn' : 'info', `${d.zeros} pair${d.zeros > 1 ? 's' : ''} of objects at distance 0`, `${d.dup.slice(0, 6).map(([i, j]) => esc(R.labels[i]) + ' = ' + esc(R.labels[j])).join('; ')}${d.dup.length > 6 ? '; …' : ''}. Identical objects will always be merged first; with many ties, dendrogram order becomes arbitrary.`);
  if (d.viol) add('warn', 'The coefficient is not a metric', `${fmtPct(d.viol / d.tested, 2)} of the object triples violate the triangle inequality. Hierarchical methods still work (the tree may show reversals for centroid/median linkage); k-means needs coordinates, so use PAM or a PCoA/√d transformation.`);
  if (d.euclid) {
    if (d.euclid.negMass >= 0.1) add('warn', 'Not Euclidean-embeddable', `The double-centred matrix has ${d.euclid.nNeg} negative eigenvalues carrying ${fmtPct(d.euclid.negMass, 1)} of the mass. Ward linkage, k-means on PCoA axes and PCoA percentages are only approximate. Common fix: take the square root of the dissimilarity (Block 3 offers it for supplied matrices; for Bray–Curtis and Jaccard, √d is Euclidean).`);
    else if (d.euclid.negMass >= 0.01) add('info', 'Nearly Euclidean', `A small part of the eigenvalue mass (${fmtPct(d.euclid.negMass, 1)}) is negative; PCoA axes and Ward are acceptable.`);
    else add('ok', 'Euclidean-embeddable', 'The matrix can be represented exactly by points in Euclidean space: Ward, k-means on the PCoA axes and PCoA percentages are all valid.');
  }
  if (R.stress >= 0.2) add('warn', 'The 2-D map is a poor summary', `Stress ${R.stress.toFixed(3)}: distant pairs are misplaced in the plane. Judge similarity from the heat map and the tree, not from the map.`);
  /* bimodality hint */
  const v = d.values, mean = d.mean; const cv = d.sd / (mean || 1);
  if (cv > 0.45) add('info', 'Wide spread of dissimilarities', `Coefficient of variation ${cv.toFixed(2)}: some pairs are far closer than others — a good sign for clustering. Look for two humps in the distribution figure.`);
  else if (cv < 0.15) add('warn', 'All pairs are about equally dissimilar', `Coefficient of variation ${cv.toFixed(2)}: the objects are spread evenly, which is what happens in many dimensions or with no structure. Clusters found on such a matrix are fragile.`);
  if (R.groups) {
    const g = R.groups; let within = [], between = [];
    for (let i = 0; i < R.n; i++) for (let j = i + 1; j < R.n; j++) (g[i] === g[j] ? within : between).push(R.D[i][j]);
    if (within.length && between.length) { const ratio = S.mean(between) / (S.mean(within) || 1e-12); add(ratio > 1.5 ? 'ok' : ratio > 1.1 ? 'info' : 'warn', `Known groups: between-group distances are ${ratio.toFixed(2)}× the within-group ones`, ratio > 1.5 ? 'This coefficient separates your known grouping well.' : ratio > 1.1 ? 'Modest separation of the known grouping with this coefficient.' : 'This coefficient barely distinguishes your known groups; try another one in the comparison below.'); R.groupRatio = ratio; }
  }
  const host = el('distChecks'); host.innerHTML = '';
  checks.forEach(([level, title, text]) => host.appendChild(mk('div', { class: 'check-item ' + level }, `<div class="ck-icon">${level === 'ok' ? '✅' : level === 'bad' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${title}</div><div class="ck-text">${text}</div></div>`)));
  /* nearest neighbours */
  buildTable('nnTable', [{ key: 'obj', label: 'Object' }, { key: 'n1', label: '1st nearest', html: true }, { key: 'n2', label: '2nd', html: true }, { key: 'n3', label: '3rd', html: true }],
    R.labels.map((l, i) => ({ obj: l, n1: fmtNN(R, d.nn[i][0]), n2: fmtNN(R, d.nn[i][1]), n3: fmtNN(R, d.nn[i][2]) })), { limit: 300 });
}
function fmtNN(R, x) { return x ? `${esc(R.labels[x[1]])} <span class="hint" style="margin:0">(${fmtNum(x[0], 3)})</span>` : '—'; }

/* ---------- comparison ---------- */
function renderCmpList() {
  const host = el('cmpList'); host.innerHTML = '';
  const fams = famsAvailable();
  const current = state.dist ? state.dist.id : null;
  Dist.catalog.filter(c => fams.includes(c.fam) && !['sqeuclidean', 'minkowski', 'pca_euclid', 'given_sq', 'hamming'].includes(c.id)).forEach(c => {
    const lab = mk('label', { class: 'checkbox-label', style: 'margin:0' });
    const cb = mk('input', { type: 'checkbox', value: c.id });
    cb.checked = c.id === current || (c.fam === fam && ['euclidean', 'manhattan', 'pearson', 'canberra', 'jaccard', 'dice', 'sm', 'ochiai', 'bray', 'hellinger', 'ruzicka', 'morisita', 'gower', 'euclid_dummy', 'sm_nominal', 'gower_cat', 'given', 'given_sqrt'].includes(c.id));
    lab.appendChild(cb); lab.appendChild(document.createTextNode(` ${c.name} `)); lab.appendChild(mk('span', { class: 'pill' }, Dist.families[c.fam].label));
    host.appendChild(lab);
  });
}
function runCompare() {
  const ids = els('#cmpList input:checked').map(i => i.value);
  if (ids.length < 2) { showMessage('cmpMessages', 'warning', 'Tick at least two coefficients.'); return; }
  clearMessages('cmpMessages');
  const mats = [], names = [], notes = [];
  ids.forEach(id => { try { const r = Dist.compute(id, currentOpts()); mats.push(r.D); names.push(Dist.byId(id).name); if (state.groups) { let w = [], b = []; for (let i = 0; i < r.n; i++) for (let j = i + 1; j < r.n; j++) (state.groups[i] === state.groups[j] ? w : b).push(r.D[i][j]); notes.push(S.mean(b) / (S.mean(w) || 1e-12)); } } catch (e) { showMessage('cmpMessages', 'warning', `${esc(Dist.byId(id).name)}: ${esc(e.message)}`); } });
  if (mats.length < 2) return;
  const C = Object.assign({ names, notes }, Dist.compare(mats));
  state.distCompare = C;
  P3.mountCmp(C);
  const rows = names.map((nm, a) => { const o = { coef: nm }; names.forEach((n2, b) => o['c' + b] = C.R[a][b].toFixed(2)); if (notes.length) o.sep = notes[a].toFixed(2); return o; });
  buildTable('cmpTable', [{ key: 'coef', label: 'Coefficient' }].concat(names.map((n2, b) => ({ key: 'c' + b, label: n2.split(' ')[0], num: true }))).concat(notes.length ? [{ key: 'sep', label: 'Between / within (known groups)', num: true }] : []), rows, { caption: 'Pearson correlation between the pairwise dissimilarities of each coefficient' });
  let lo = 1, pair = null; for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) if (C.R[a][b] < lo) { lo = C.R[a][b]; pair = [names[a], names[b]]; }
  let hi = -1, hp = null; for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) if (C.R[a][b] > hi) { hi = C.R[a][b]; hp = [names[a], names[b]]; }
  const best = notes.length ? names[notes.indexOf(Math.max(...notes))] : null;
  el('cmpText').innerHTML = `<p>${lo > 0.9 ? `All the coefficients agree closely (lowest correlation ${lo.toFixed(2)} between ${esc(pair[0])} and ${esc(pair[1])}): the choice matters little for these data, and the clusters should be stable across them.` : lo > 0.7 ? `The coefficients agree moderately: the weakest pair is ${esc(pair[0])} vs ${esc(pair[1])} (r = ${lo.toFixed(2)}). Expect some objects to change cluster depending on the coefficient; choose on theoretical grounds (data type, double zeros, scale) and check stability in Block 6.` : `The coefficients disagree substantially (${esc(pair[0])} vs ${esc(pair[1])}: r = ${lo.toFixed(2)}). Your clusters will depend on this choice. Prefer the coefficient that matches the data type and the question, and report the comparison.`} ${hp ? `Closest pair: ${esc(hp[0])} and ${esc(hp[1])} (r = ${hi.toFixed(2)}).` : ''}${best ? ` Against your known grouping, <b>${esc(best)}</b> gives the largest between/within ratio.` : ''}</p>`;
  el('cmpResults').style.display = '';
}

function downloadD() {
  const R = state.dist; if (!R) return;
  download(matrixToCSV([''].concat(R.labels), R.D.map((r, i) => [R.labels[i]].concat(r.map(v => +v.toFixed(6))))), slug(state.fileName) + '_' + R.id + '_distance.csv', 'text/csv;charset=utf-8');
}

function refresh() {
  if (!state.ready || !state.X) return;
  src = Dist.sources();
  const def = Dist.byId(Dist.defaultFor(state.isDistance ? 'distance' : state.profile && state.profile.type));
  fam = famsAvailable().includes(def.fam) ? def.fam : famsAvailable()[0];
  renderTabs(); renderCoefs(def.id);
  el('distResults').style.display = 'none'; el('cmpCard').style.display = 'none'; el('cmpResults').style.display = 'none';
  state.dist = null; enableStep(4, false); el('nextBtn3').disabled = true;
  const R = state.recommend;
  el('distReco').innerHTML = R ? `<h4>Recommendation from Block 2</h4><div class="reco-row"><div><b>Dissimilarity</b>${esc(R.distance)}</div><div><b>Why</b>${esc(R.why)}</div></div>` : '';
}

function init() {
  if (!el('famTabs')) return;
  el('coefSel').addEventListener('change', describe);
  el('distRunBtn').addEventListener('click', compute);
  el('cmpRunBtn').addEventListener('click', runCompare);
  el('distDownloadBtn').addEventListener('click', downloadD);
  el('nextBtn3').addEventListener('click', () => goStep(4));
  document.addEventListener('datachange', refresh);
}
document.addEventListener('DOMContentLoaded', init);
})();
