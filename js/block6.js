/* ClusteringPro — Block 6 UI: optimal number of clusters, stability, tree support, external validation,
   comparison of algorithms. */

(function () {
const GEN_NAMES = { hier: 'Hierarchical cut', kmeans: 'k-means', pam: 'PAM' };
let coordCache = null;

function coordsX() {
  const quantLike = state.dist.fam === 'quant' && /euclid|sqeuclid|pca/.test(state.dist.id);
  if (quantLike || state.isDistance) return { X: state.X, name: state.isDistance ? 'MDS coordinates of your matrix' : 'working matrix (Block 2)' };
  if (!coordCache || coordCache.key !== state.dist.id + state.dist.n) { const m = S.cmdscale(state.dist.D); coordCache = { key: state.dist.id + state.dist.n, X: m.points }; }
  return { X: coordCache.X, name: `PCoA axes of ${state.dist.name}` };
}
function kRange() { const n = state.dist.n; const a = Math.max(2, +el('vkMin').value || 2), b = Math.max(a, Math.min(+el('vkMax').value || 10, n - 1)); return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
function hcMethod() { return state.hclust ? state.hclust.method : (state.dist.diag && state.dist.diag.euclid && state.dist.diag.euclid.negMass < 0.05 ? 'ward.D2' : 'average'); }
const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">Figure "${esc(spec.title)}" could not be drawn: ${esc(e.message)}</div>`; } };
const pal = { key: 'palette', label: 'Palette', type: 'select', options: Object.entries(Fig.paletteNames) };

/* ---------- 1. k sweep ---------- */
function runSweep() {
  if (!state.dist) return;
  clearMessages('vkMessages');
  const { X, name } = coordsX(), D = state.dist.D, ks = kRange();
  if (ks.length < 3) { showMessage('vkMessages', 'error', 'Use a range of at least three values of k.'); return; }
  const gen = VAL.generator(el('vkGen').value, D, X, hcMethod());
  const t0 = performance.now();
  let sw;
  try { sw = VAL.sweep(X, D, ks, gen, { gapB: +el('vkGapB').value || 0, seed: 2026 }); } catch (e) { showMessage('vkMessages', 'error', esc(e.message)); return; }
  sw.coordName = name; sw.ms = performance.now() - t0;
  state.validation = Object.assign(state.validation || {}, { sweep: sw, kOpt: sw.consensus[0] ? sw.consensus[0].k : null });
  renderSweep(sw);
  el('vkResults').style.display = '';
  enableStep(7, true); el('nextBtn6').disabled = false;
  document.dispatchEvent(new CustomEvent('validationchange'));
  el('vkResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderSweep(sw) {
  const c = sw.consensus, total = Object.values(sw.votes).filter(v => v.k != null).length;
  const tiles = [['Consensus k', c[0] ? c[0].k : '—', c[0] ? `${c[0].votes} of ${total} indices` : '', 'ok']];
  if (c[1]) tiles.push(['Runner-up', c[1].k, `${c[1].votes} of ${total} indices`]);
  tiles.push(['Silhouette', sw.votes.silhouette.k, `max ${fmtFixed(Math.max(...sw.rows.map(r => r.silhouette)), 3)}`], ['Gap statistic', sw.gap ? sw.votes.gap.k : 'not run', sw.gap ? `${sw.gap.B} reference sets · global max at ${sw.gap.globalMax}` : 'set B > 0'], ['Elbow (WSS)', sw.votes.elbow.k, 'knee of the curve'], ['Partitions from', GEN_NAMES[sw.generator], sw.coordName]);
  statTiles('vkTiles', tiles);
  const checks = []; const add = (l, t, x) => checks.push([l, t, x]);
  if (c[0] && c[0].votes >= total * 0.5) add('ok', `Clear consensus for k = ${c[0].k}`, `${c[0].votes} of the ${total} criteria agree. ${sw.votes.silhouette.k === c[0].k ? 'The silhouette agrees.' : `The silhouette prefers k = ${sw.votes.silhouette.k}.`}`);
  else if (c[0] && c[1] && c[0].votes === c[1].votes) add('warn', `Tie between k = ${c[0].k} and k = ${c[1].k}`, 'The criteria split their votes. Prefer the smaller k unless the extra cluster is interpretable, and check both with the stability analysis below.');
  else if (c[0]) add('info', `Weak consensus for k = ${c[0].k}`, `Only ${c[0].votes} of ${total} criteria agree; the others spread over ${c.length - 1} other value${c.length - 1 === 1 ? "" : "s"}. The structure may be hierarchical (several valid resolutions) or weak.`);
  const s2 = sw.rows.find(r => r.k === 2), sk = c[0] ? sw.rows.find(r => r.k === c[0].k) : null;
  if (c[0] && c[0].k === sw.ks[sw.ks.length - 1] && sw.ks.length > 3) add('warn', `The consensus k = ${c[0].k} is the upper end of the range`, 'Several criteria keep improving as clusters are added and stop only where the range stops. This usually means there is no natural number of clusters (the partition just keeps slicing the data finer). Extend the range to check, and read it together with the gap statistic and the stability below.');
  if (sk && sk.silhouette < 0.25) add('warn', `Low silhouette at the consensus k (${fmtFixed(sk.silhouette, 2)})`, 'Even the best k gives weak, overlapping clusters. Consider another dissimilarity or method, or accept a fuzzy description.');
  if (sw.gap && sw.gap.best === 1) add('warn', 'The gap statistic finds no cluster structure (k = 1)', 'The gap at k = 1 is within one standard error of the gap at k = 2: the data are no more clustered than uniform reference data spread over the same range. The other criteria can only choose among k ≥ 2, so read their votes with caution and check the stability of the clusters below.' + (sw.n < 30 ? ` With only ${sw.n} objects the reference sets vary a lot and the rule is conservative.` : ''));
  if (sw.gap && sw.gap.best !== sw.gap.globalMax) add('info', `Gap statistic: first-SE rule chooses k = ${sw.gap.best}, the global maximum is at k = ${sw.gap.globalMax}`, 'The conservative rule stops at the first k whose gap is within one standard error of the next; the maximum favours more clusters.');
  if (s2 && sw.votes.silhouette.k === 2 && sw.rows.length > 3) add('info', 'The silhouette peaks at k = 2', 'A very common outcome: a coarse split dominates. If the domain suggests finer groups, look at the silhouette of k = 3–4 and at the tree.');
  add('info', 'How the vote works', 'Each criterion selects one k by its own rule (maximum, minimum, first k under a threshold or the knee of a curve). The tally is a guide, not a proof: the final k must also be interpretable in Block 7.');
  const host = el('vkChecks'); host.innerHTML = '';
  checks.forEach(([level, title, text]) => host.appendChild(mk('div', { class: 'check-item ' + level }, `<div class="ck-icon">${level === 'ok' ? '✅' : level === 'bad' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${title}</div><div class="ck-text">${text}</div></div>`)));
  /* table */
  const keys = ['wss', 'silhouette', 'ch', 'db', 'dunn', 'gap', 'cindex', 'mcclain', 'pbm', 'rl', 'hartigan', 'kl', 'bhDiff'].filter(k => sw.rows.some(r => isFinite(r[k])));
  const voteK = key => sw.votes[key === 'wss' ? 'elbow' : key] ? sw.votes[key === 'wss' ? 'elbow' : key].k : null;
  const cols = [{ key: 'k', label: 'k', num: true }].concat(keys.map(k => ({ key: k, label: P6.INDEX_META[k].label + (voteK(k) ? ` → ${voteK(k)}` : ''), num: true, html: true })));
  const rows = sw.rows.map(r => { const o = { k: r.k }; keys.forEach(k => { const v = r[k]; o[k] = isFinite(v) ? (voteK(k) === r.k ? `<b style="color:var(--accent)">${fmtNum(v, 3)}</b>` : fmtNum(v, 3)) : '—'; }); return o; });
  buildTable('vkTable', cols, rows, { caption: 'Internal indices by k · bold = the k each index selects' });
  /* figures */
  mount('fig6Panel', { title: 'Every criterion at a glance', fileName: 'index_panel', width: 960, height: 620, defaults: { palette: 'cluster', title: 'Internal indices versus the number of clusters' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal], render: cfg => P6.panel(cfg, sw) });
  mount('fig6Votes', { title: 'Consensus of the criteria', fileName: 'consensus_votes', width: 760, height: 420, defaults: { palette: 'cluster', title: 'How many criteria vote for each k', names: true }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'names', label: 'Show index names inside the bars', type: 'checkbox' }, pal], render: cfg => P6.votes(cfg, sw) });
  mount('fig6Elbow', { title: 'Elbow: within-cluster sum of squares', fileName: 'elbow', width: 620, height: 400, defaults: { palette: 'cluster', title: 'Total within-cluster sum of squares' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal], render: cfg => P6.curve(cfg, sw, 'wss', { best: sw.votes.elbow.k, bestLabel: 'knee at' }) });
  mount('fig6Sil', { title: 'Average silhouette by k', fileName: 'silhouette_by_k', width: 620, height: 400, defaults: { palette: 'cluster', title: 'Average silhouette width' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal], render: cfg => P6.curve(cfg, sw, 'silhouette', { bestLabel: 'maximum at' }) });
  el('fig6Gap').style.display = sw.gap ? '' : 'none';
  if (sw.gap) mount('fig6Gap', { title: 'Gap statistic', fileName: 'gap_statistic', width: 620, height: 400, defaults: { palette: 'cluster', title: `Gap statistic (${sw.gap.B} uniform reference sets)` }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal], render: cfg => P6.curve(cfg, { rows: sw.gap.ks.map((k, i) => ({ k, gap: sw.gap.gap[i], gapSE: sw.gap.sk[i] })), votes: {}, gap: sw.gap }, 'gap', { best: sw.gap.best, bestLabel: 'first-SE rule:', note: 'bars: ± 1 standard error' }) });
  el('adoptK').textContent = c[0] ? `Adopt k = ${c[0].k} in Blocks 4 and 5` : 'Adopt k'; el('adoptK').disabled = !c[0];
}
function adoptK() {
  const k = state.validation && state.validation.kOpt; if (!k) return;
  if (el('cutK')) { el('cutMode').value = 'k'; el('cutMode').dispatchEvent(new Event('change')); el('cutK').value = k; if (state.hclust) el('cutApply').click(); }
  if (el('ptK')) el('ptK').value = k;
  showMessage('vkMessages', 'success', `k = ${k} set in Block 4 (tree cut applied) and in Block 5 (run the method again there to refresh its partition).`);
}

/* ---------- 2. stability ---------- */
function currentPartition() {
  const which = el('stSource').value;
  if (which === 'partition' && state.partition) return { cl: state.partition.cluster, name: `${state.partition.name} (Block 5), k = ${state.partition.k}`, kind: state.partition.method === 'pam' || state.partition.method === 'clara' ? 'pam' : (state.partition.method === 'kmeans' || state.partition.method === 'hkmeans' ? 'kmeans' : 'hier') };
  if (state.hclust && state.hclust.cl) return { cl: state.hclust.cl, name: `tree cut (Block 4), k = ${state.hclust.k}`, kind: 'hier' };
  return null;
}
function runStability() {
  const P = currentPartition(); if (!P) { showMessage('stMessages', 'error', 'No partition yet: cut the tree in Block 4 or run a method in Block 5.'); return; }
  clearMessages('stMessages');
  if (P.cl.includes(0)) { showMessage('stMessages', 'warning', 'Noise objects (DBSCAN) are ignored: they are given their own cluster 0 for the resampling.'); }
  const { X } = coordsX(), D = state.dist.D;
  const cl = P.cl.map(c => c === 0 ? Math.max(...P.cl) + 1 : c);
  const gen = VAL.generator(P.kind, D, X, hcMethod());
  const B = Math.max(10, Math.min(500, +el('stB').value || 50));
  const st = VAL.stability(D, X, cl, gen, B, 77);
  state.validation = Object.assign(state.validation || {}, { stability: Object.assign(st, { partition: P.name }) });
  const rows = st.clusters.map(c => ({ c: `Cluster ${c.cluster}`, n: c.n, mean: fmtFixed(c.mean, 3), min: fmtFixed(c.min, 3), dis: `${c.dissolved} (${fmtPct(c.dissolved / (c.runs || 1), 0)})`, rec: `${c.recovered} (${fmtPct(c.recovered / (c.runs || 1), 0)})`, verdict: c.mean >= 0.85 ? 'highly stable' : c.mean >= 0.75 ? 'stable' : c.mean >= 0.6 ? 'some pattern' : c.mean >= 0.5 ? 'doubtful' : 'dissolved' }));
  buildTable('stTable', [{ key: 'c', label: 'Cluster' }, { key: 'n', label: 'n', num: true }, { key: 'mean', label: 'Mean Jaccard', num: true }, { key: 'min', label: 'Min', num: true }, { key: 'dis', label: 'Dissolved (< 0.5)' }, { key: 'rec', label: 'Recovered (> 0.75)' }, { key: 'verdict', label: 'Verdict' }], rows, { caption: `${P.name} · ${B} bootstrap samples, reclustered with ${GEN_NAMES[P.kind]}` });
  const bad = st.clusters.filter(c => c.mean < 0.6).length, good = st.clusters.filter(c => c.mean >= 0.75).length, mid = st.clusters.length - bad - good;
  el('stText').innerHTML = `<div class="check-item ${bad ? 'warn' : 'ok'}"><div class="ck-icon">${bad ? '⚠️' : '✅'}</div><div class="ck-body"><div class="ck-title">${good} of ${st.clusters.length} clusters are stable (mean Jaccard ≥ 0.75)${mid ? `; ${mid} ${mid > 1 ? 'show' : 'shows'} only some pattern` : ''}${bad ? `; ${bad} ${bad > 1 ? 'are' : 'is'} doubtful or dissolved` : ''}</div><div class="ck-text">Each bootstrap sample recomputes the clustering on a resample of the objects; a cluster is counted as recovered when a bootstrap cluster overlaps it with Jaccard above 0.75 and dissolved below 0.5. Clusters that dissolve depend on a few objects and should not be interpreted as real groups.</div></div></div>`;
  mount('fig6Stab', { title: 'Bootstrap stability of the clusters', fileName: 'cluster_stability', width: 760, height: 420, defaults: { palette: 'cluster', title: `Cluster stability · ${P.name}`, badColor: '#c93a2c' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'badColor', label: 'Dissolved colour', type: 'color' }, pal], render: cfg => P6.stability(cfg, st) });
  el('stResults').style.display = '';
  document.dispatchEvent(new CustomEvent('validationchange'));
}

/* ---------- 3. pvclust ---------- */
function runPv() {
  clearMessages('pvMessages');
  const n = state.dist.n;
  if (state.isDistance || !state.X) { showMessage('pvMessages', 'error', 'Variables are needed to resample: not available for a supplied distance matrix.'); return; }
  if (n > 200) { showMessage('pvMessages', 'error', 'Multiscale bootstrap is limited to 200 objects here.'); return; }
  const numIdx = state.Xkinds.map((k, j) => j).filter(j => !state.Xdummy[j]);
  const X = state.X.map(r => numIdx.map(j => r[j]));
  if (X[0].length < 3) { showMessage('pvMessages', 'error', 'At least three variables are needed.'); return; }
  const method = hcMethod(), B = Math.max(10, Math.min(500, +el('pvB').value || 30));
  const scales = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
  const t0 = performance.now();
  const pv = VAL.pvclust(X, method, B, scales, 13, { beta: state.hclust ? state.hclust.beta : undefined });
  pv.ms = performance.now() - t0; pv.method = method;
  state.validation = Object.assign(state.validation || {}, { pv });
  const thr = +el('pvThr').value || 0.95;
  const sig = pv.nodes.filter(nd => nd.au >= thr && nd.size < n).sort((a, b) => b.au - a.au || b.size - a.size);
  const rows = sig.map(nd => ({ node: `node ${nd.step + 1}`, n: nd.size, au: (nd.au * 100).toFixed(0), bp: (nd.bp * 100).toFixed(0), h: fmtNum(nd.height, 3), members: nd.members.map(i => esc(state.dist.labels[i])).slice(0, 25).join(', ') + (nd.size > 25 ? ' …' : '') }));
  buildTable('pvTable', [{ key: 'node', label: 'Cluster (tree node)' }, { key: 'n', label: 'n', num: true }, { key: 'au', label: 'AU %', num: true }, { key: 'bp', label: 'BP %', num: true }, { key: 'h', label: 'Height', num: true }, { key: 'members', label: 'Members', html: true }], rows, { caption: `Clusters supported at AU ≥ ${Math.round(thr * 100)} % · Euclidean distance on the ${X[0].length} numeric variables, ${HC_METHOD_NAMES[method]} linkage, ${B} resamples × ${scales.length} scales` });
  if (state.dist.fam !== 'quant' || !/euclid/.test(state.dist.id)) showMessage('pvMessages', 'info', 'Resampling the variables requires recomputing the distance from them; Euclidean distance on the working variables is used here, which differs from your Block 3 dissimilarity.');
  if (X[0].length < 15) showMessage('pvMessages', 'warning', `Only ${X[0].length} variables: with so few columns the multiscale bootstrap is liberal, and even in random data many clusters reach AU ≥ 95 %. Read AU as a rough guide and rely on the bootstrap of the objects (card 2) to judge the clusters.`);
  el('pvText').innerHTML = `<p class="hint">${sig.length} cluster${sig.length === 1 ? '' : 's'} with AU ≥ ${Math.round(thr * 100)} %. AU (approximately unbiased) corrects the plain bootstrap probability BP for its known bias; an AU of 95 % means the cluster is strongly supported by the variables, not an accident of which variables were measured.</p>`;
  mount('fig6Pv', { title: 'Tree with bootstrap support', fileName: 'pvclust_tree', width: 960, height: 560, defaults: { palette: 'cluster', title: `Multiscale bootstrap support · ${HC_METHOD_NAMES[method]}`, subtitle: `${B} resamples at ${scales.length} scales · numbers: AU % (red)${''}`, threshold: thr, showAU: true, showBP: false, valueSize: 9, labels: n <= 120 ? 'auto' : 'none', labelSize: 9, branchWidth: 1.6, auColor: '#d64a6a', bpColor: '#2f9e44', boxColor: '#d64a6a', legendPos: 'right' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' }, { key: 'threshold', label: 'AU threshold for boxes', type: 'range', min: 0.5, max: 0.99, step: 0.01 }, { key: 'showAU', label: 'Show AU values', type: 'checkbox' }, { key: 'showBP', label: 'Show BP values', type: 'checkbox' }, { key: 'valueSize', label: 'Value size', type: 'range', min: 6, max: 14, step: 0.5 }, { key: 'labels', label: 'Leaf labels', type: 'select', options: [['auto', 'shown'], ['none', 'hidden']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 6, max: 14, step: 0.5 }, { key: 'branchWidth', label: 'Branch width', type: 'range', min: 0.5, max: 4, step: 0.1 }, { key: 'auColor', label: 'AU colour', type: 'color' }, { key: 'bpColor', label: 'BP colour', type: 'color' }, { key: 'boxColor', label: 'Box colour', type: 'color' }, pal], render: cfg => P6.pvDendro(cfg, pv, state.dist.labels) });
  el('pvResults').style.display = '';
  document.dispatchEvent(new CustomEvent('validationchange'));
}

/* ---------- 4. external validation ---------- */
function runExternal() {
  clearMessages('exMessages');
  const a = el('exA').value, b = el('exB').value;
  const get = id => id === 'groups' ? (state.groups ? { cl: state.groups, name: 'known grouping' } : null) : id === 'partition' ? (state.partition ? { cl: state.partition.cluster, name: `${state.partition.name} (Block 5)` } : null) : (state.hclust && state.hclust.cl ? { cl: state.hclust.cl, name: `tree cut (Block 4)` } : null);
  const A = get(a), Bp = get(b);
  if (!A || !Bp) { showMessage('exMessages', 'error', 'One of the two labellings is not available yet.'); return; }
  if (a === b) { showMessage('exMessages', 'warning', 'Choose two different labellings.'); return; }
  const ext = VAL.external(A.cl, Bp.cl);
  state.validation = Object.assign(state.validation || {}, { external: Object.assign(ext, { names: [A.name, Bp.name] }) });
  statTiles('exTiles', [['Adjusted Rand', fmtFixed(ext.ari, 3), '1 = identical, 0 = chance', ext.ari > 0.7 ? 'ok' : ext.ari > 0.4 ? 'warn' : 'bad'], ['Rand', fmtFixed(ext.rand, 3), 'pairs agreeing'], ['NMI', fmtFixed(ext.nmi, 3), 'normalised mutual information', ext.nmi > 0.7 ? 'ok' : ext.nmi > 0.4 ? 'warn' : ''], ['Variation of information', fmtFixed(ext.vi, 3), '0 = identical (lower is better)'], ['Jaccard · FM', `${fmtFixed(ext.jaccard, 3)} · ${fmtFixed(ext.fm, 3)}`, 'pair-counting indices'], ['Purity', fmtPct(ext.purity, 1), `of ${A.name} w.r.t. ${Bp.name}`], ['χ² test', `${fmtNum(ext.chi, 2)} (df ${ext.df})`, `p ${ext.pval < 0.001 ? '< 0.001' : '= ' + fmtFixed(ext.pval, 3)} · Cramér V ${fmtFixed(ext.cramer, 2)}`, ext.pval < 0.05 ? 'ok' : 'warn']]);
  el('exText').innerHTML = `<p class="hint">${ext.ari > 0.8 ? 'The two labellings are essentially the same partition.' : ext.ari > 0.5 ? 'Substantial agreement: most objects are grouped alike, with a minority placed differently.' : ext.ari > 0.2 ? 'Partial agreement: the two labellings capture related but different structure.' : 'The labellings are unrelated: what random labels would give.'} ${ext.pval < 0.05 ? 'The association is statistically significant (χ²).' : 'The association is not statistically significant.'}</p>`;
  mount('fig6Ext', { title: 'Cross-table', fileName: 'external_validation', width: 760, height: 480, defaults: { title: `${A.name} × ${Bp.name}`, cmap: 'viridis', percent: true }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }, { key: 'percent', label: 'Show row percentages', type: 'checkbox' }], render: cfg => P6.external(cfg, ext, [a === 'groups' ? '' : 'C', Bp.name]) });
  el('exResults').style.display = '';
  document.dispatchEvent(new CustomEvent('validationchange'));
}

/* ---------- 5. clValid ---------- */
function runClValid() {
  clearMessages('cvMessages');
  const methods = els('#cvList input:checked').map(i => i.value); if (!methods.length) { showMessage('cvMessages', 'warning', 'Tick at least one method.'); return; }
  const { X } = coordsX(), D = state.dist.D, ks = kRange();
  const cv = VAL.clValid(X, D, ks, methods, hcMethod());
  const names = { hier: `Hierarchical (${HC_METHOD_NAMES[hcMethod()]})`, kmeans: 'k-means', pam: 'PAM' };
  state.validation = Object.assign(state.validation || {}, { clValid: Object.assign(cv, { names }) });
  buildTable('cvTable', [{ key: 'm', label: 'Measure' }, { key: 'best', label: 'Best method' }, { key: 'k', label: 'k', num: true }, { key: 'v', label: 'Value', num: true }], ['connectivity', 'dunn', 'silhouette'].map(m => ({ m: P6.INDEX_META[m].label + (m === 'connectivity' ? ' (lower is better)' : ' (higher is better)'), best: names[cv.best[m].method], k: cv.best[m].k, v: fmtNum(cv.best[m][m], 3) })), { caption: 'Optimal scores (clValid-style)' });
  const full = ks.map(k => { const o = { k }; methods.forEach(m => { const r = cv.rows.find(q => q.method === m && q.k === k); ['connectivity', 'dunn', 'silhouette'].forEach(x => o[m + x] = fmtNum(r[x], 3)); }); return o; });
  buildTable('cvFull', [{ key: 'k', label: 'k', num: true }].concat(methods.flatMap(m => ['connectivity', 'dunn', 'silhouette'].map(x => ({ key: m + x, label: `${names[m].split(' ')[0]} · ${P6.INDEX_META[x].label}`, num: true })))), full, { caption: 'All measures by method and k' });
  mount('fig6Cv', { title: 'Comparison of algorithms over k', fileName: 'clvalid_comparison', width: 760, height: 460, defaults: { palette: 'cluster', title: 'Internal validation by method and k', measure: 'silhouette', legendPos: 'right' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'measure', label: 'Measure', type: 'select', options: [['silhouette', 'Silhouette'], ['dunn', 'Dunn'], ['connectivity', 'Connectivity']] }, pal, { key: 'legendPos', label: 'Legend position', type: 'select', options: [['bottom', 'Below the plot'], ['right', 'Top right'], ['none', 'Hidden']] }], render: cfg => P6.clValid(cfg, cv, names) });
  el('cvResults').style.display = '';
}

/* partitions for the sweep: the Block 4 tree if there is one, k-means on Euclidean-like coordinates, PAM otherwise */
function defaultGen() { const quantLike = state.dist.fam === 'quant' && /euclid|sqeuclid|pca/.test(state.dist.id); return state.hclust ? 'hier' : (quantLike ? 'kmeans' : 'pam'); }
function refresh() {
  if (!state.dist) return;
  state.validation = null;
  ['vkResults', 'stResults', 'pvResults', 'exResults', 'cvResults'].forEach(id => el(id).style.display = 'none');
  enableStep(7, false); el('nextBtn6').disabled = true;
  el('vkMax').value = Math.min(10, state.dist.n - 1);
  el('vkGen').value = defaultGen();
  const exSel = el('exA'), exB = el('exB');
  [exSel, exB].forEach(s => { s.innerHTML = ''; [['tree', 'Tree cut (Block 4)'], ['partition', 'Block 5 partition'], ['groups', 'Known grouping']].forEach(([v, t]) => s.appendChild(mk('option', { value: v }, t))); });
  exSel.value = state.partition ? 'partition' : 'tree'; exB.value = state.groups ? 'groups' : 'tree';
  el('stSource').value = state.partition ? 'partition' : 'tree';
  el('pvCard').style.display = state.isDistance ? 'none' : '';
}
function init() {
  if (!el('vkRun')) return;
  const cl = el('cvList'); [['hier', 'Hierarchical (Block 4 linkage)'], ['kmeans', 'k-means'], ['pam', 'PAM']].forEach(([id, nm]) => { const lab = mk('label', { class: 'checkbox-label', style: 'margin:0' }); const cb = mk('input', { type: 'checkbox', value: id }); cb.checked = true; lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + nm)); cl.appendChild(lab); });
  el('vkRun').addEventListener('click', runSweep);
  el('adoptK').addEventListener('click', adoptK);
  el('stRun').addEventListener('click', runStability);
  el('pvRun').addEventListener('click', runPv);
  el('exRun').addEventListener('click', runExternal);
  el('cvRun').addEventListener('click', runClValid);
  el('nextBtn6').addEventListener('click', () => goStep(7));
  document.addEventListener('distchange', refresh);
  document.addEventListener('hclustchange', () => { if (state.dist && !state.validation) el('vkGen').value = defaultGen(); });
  document.addEventListener('partitionchange', () => { if (state.dist) { el('stSource').value = 'partition'; el('exA').value = 'partition'; } });
}
document.addEventListener('DOMContentLoaded', init);
})();
