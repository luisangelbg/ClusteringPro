/* ClusteringPro — Block 7 UI: cluster profiles and interpretation, indicator species, discriminant
   analysis, classification rules and assignment of new observations. */

(function () {
let PRF = null;

function partitionChoice() {
  const w = el('prSource').value;
  if (w === 'partition' && state.partition) return { cl: state.partition.cluster.map(c => c === 0 ? Math.max(...state.partition.cluster) + 1 : c), name: `${state.partition.name} (Block 5), k = ${state.partition.k}`, noise: state.partition.cluster.includes(0) };
  if (state.hclust && state.hclust.cl) return { cl: state.hclust.cl, name: `tree cut (Block 4), k = ${state.hclust.k}` };
  return null;
}
/* numeric and categorical variables available (active + supplementary), on the rows kept in Block 2 */
function variables() {
  const num = [], cat = [];
  (state.numNames || []).forEach((nm, j) => num.push({ name: nm, kind: state.numKinds[j], get: () => state.numRaw.map(r => r[j]), role: 'active' }));
  (state.catNames || []).forEach((nm, j) => { const col = state.columns.find(c => c.name === nm); if (col && col.kind === 'ordinal') return; cat.push({ name: nm, get: () => state.cat.map(r => r[j]), role: 'active' }); });
  state.columns.filter(c => c.role === 'supplementary').forEach(c => {
    if (c.kind === 'quant' || c.kind === 'count' || (c.kind === 'ordinal' && c.num.length)) { const vals = state.rowIndex.map(i => toNumber(c.values[i], state.decimal)); const m = S.mean(vals.filter(v => v != null)); num.push({ name: c.name, kind: c.kind, get: () => vals.map(v => v == null ? m : v), role: 'supplementary' }); }
    else { const vals = state.rowIndex.map(i => isMissing(c.values[i]) ? '(missing)' : String(c.values[i]).trim()); cat.push({ name: c.name, get: () => vals, role: 'supplementary' }); }
  });
  return { num, cat };
}
function renderVarLists() {
  const V = variables();
  const fill = (host, list, checkedFn) => { host.innerHTML = ''; list.forEach(v => { const lab = mk('label', { class: 'checkbox-label', style: 'margin:0' }); const cb = mk('input', { type: 'checkbox', value: v.name }); cb.checked = checkedFn(v); lab.appendChild(cb); lab.appendChild(document.createTextNode(` ${v.name} `)); lab.appendChild(mk('span', { class: 'pill ' + (v.role === 'supplementary' ? '' : (KINDS[v.kind] ? KINDS[v.kind].cls : 'nominal')) }, v.role === 'supplementary' ? 'supplementary' : (KINDS[v.kind] ? KINDS[v.kind].label : 'categorical'))); host.appendChild(lab); }); };
  fill(el('prVars'), V.num, () => true); fill(el('prCats'), V.cat, () => true);
  el('prCatsWrap').style.display = V.cat.length ? '' : 'none';
  const species = V.num.filter(v => v.kind === 'count' || v.kind === 'binary').length;
  el('prSpeciesWrap').style.display = species >= 2 ? '' : 'none';
  el('prSpecies').checked = species >= 2 && (state.profile && (state.profile.type === 'ecological' || state.profile.type === 'binary'));
}

function run() {
  const P = partitionChoice(); if (!P) { showMessage('prMessages', 'error', 'No partition yet: cut the tree in Block 4 or run a method in Block 5.'); return; }
  clearMessages('prMessages');
  if (P.noise) showMessage('prMessages', 'info', 'DBSCAN noise objects are profiled as an extra cluster (the last one).');
  const V = variables();
  const numSel = els('#prVars input:checked').map(i => i.value), catSel = els('#prCats input:checked').map(i => i.value);
  const num = V.num.filter(v => numSel.includes(v.name)), cat = V.cat.filter(v => catSel.includes(v.name));
  if (!num.length && !cat.length) { showMessage('prMessages', 'error', 'Select at least one variable.'); return; }
  const cl = P.cl, k = Math.max(...cl), n = cl.length;
  const X = num.length ? cl.map((_, i) => num.map(v => v.get()[i])) : null;
  const cols = num.map(v => v.get());
  const Xm = num.length ? cl.map((_, i) => cols.map(c => c[i])) : null;
  const t0 = performance.now();
  const quant = num.length ? PR.quantProfiles(Xm, num.map(v => v.name), cl, k).map((q, j) => Object.assign(q, { index: j, kind: num[j].kind, role: num[j].role })) : [];
  const catCols = cat.map(v => v.get());
  const cats = cat.length ? PR.catProfiles(cl.map((_, i) => catCols.map(c => c[i])), cat.map(v => v.name), cl, k) : [];
  let indval = null;
  if (el('prSpecies').checked) { const sp = num.map((v, j) => j).filter(j => num[j].kind === 'count' || num[j].kind === 'binary'); if (sp.length >= 2) indval = PR.indval(cl.map((_, i) => sp.map(j => cols[j][i])), sp.map(j => num[j].name), cl, k, Math.max(99, +el('prPerm').value || 499), 5); }
  const sizes = PT.sizes(cl);
  PRF = { partition: P.name, cl, k, n, sizes, quant, cats, indval, X: Xm, numNames: num.map(v => v.name), numKinds: num.map(v => v.kind), labels: state.dist.labels, ms: performance.now() - t0 };
  state.profiles = PRF;
  renderProfiles();
  mountProfileFigures();
  if (Xm && Xm[0].length >= 1 && k >= 2) runLDA(); else { el('ldaCard').style.display = 'none'; el('predCard').style.display = 'none'; }
  el('prResults').style.display = '';
  enableStep(8, true); el('nextBtn7').disabled = false;
  document.dispatchEvent(new CustomEvent('profilechange'));
  el('prResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function describeCluster(c) {
  const parts = [];
  const q = PRF.quant.map(v => ({ v, cc: v.clusters[c - 1] })).filter(x => isFinite(x.cc.vtest) && Math.abs(x.cc.vtest) >= 1.96).sort((a, b) => Math.abs(b.cc.vtest) - Math.abs(a.cc.vtest));
  const hi = q.filter(x => x.cc.vtest > 0).slice(0, 4), lo = q.filter(x => x.cc.vtest < 0).slice(0, 4);
  if (hi.length) parts.push(`<b>higher</b> ${hi.map(x => `${esc(x.v.name)} (${fmtNum(x.cc.mean, 3)} vs ${fmtNum(x.v.mean, 3)} overall, v = ${x.cc.vtest.toFixed(1)})`).join('; ')}`);
  if (lo.length) parts.push(`<b>lower</b> ${lo.map(x => `${esc(x.v.name)} (${fmtNum(x.cc.mean, 3)} vs ${fmtNum(x.v.mean, 3)}, v = ${x.cc.vtest.toFixed(1)})`).join('; ')}`);
  const cats = [];
  PRF.cats.forEach(cv => cv.rows.forEach(r => { const cc = r.clusters[c - 1]; if (cc.vtest >= 1.96 && cc.count >= 2) cats.push(`${esc(cv.name)} = ${esc(String(r.level))} (${Math.round(cc.propInCluster * 100)} % of the cluster vs ${Math.round(r.total / PRF.n * 100)} % overall)`); }));
  if (cats.length) parts.push(`<b>over-represented categories</b>: ${cats.slice(0, 5).join('; ')}`);
  if (PRF.indval) { const sp = PRF.indval.filter(r => r.best === c - 1 && r.p < 0.05).sort((a, b) => b.max - a.max).slice(0, 5); if (sp.length) parts.push(`<b>indicator species</b>: ${sp.map(r => `${esc(r.name)} (IndVal ${Math.round(r.max * 100)} %)`).join(', ')}`); }
  return parts.length ? parts.join('. ') + '.' : 'No variable departs significantly from the overall mean: an "average" cluster, or a small one.';
}
function renderProfiles() {
  const k = PRF.k, sig = PRF.quant.filter(v => v.p < 0.05).length, top = PRF.quant.slice().sort((a, b) => (b.F || 0) - (a.F || 0))[0];
  const tiles = [['Partition', PRF.partition, `${PRF.n} objects`], ['Clusters', k, Object.entries(PRF.sizes).map(([c, v]) => `C${c}: ${v}`).join(' · ')], ['Discriminating variables', `${sig} of ${PRF.quant.length}`, 'ANOVA p < 0.05', sig ? 'ok' : 'warn']];
  if (top) tiles.push(['Strongest separator', top.name, `F = ${fmtNum(top.F, 2)}, η² = ${fmtFixed(top.eta2, 2)}`]);
  if (PRF.cats.length) { const cs = PRF.cats.filter(c => c.p < 0.05).length; tiles.push(['Associated categorical variables', `${cs} of ${PRF.cats.length}`, 'χ² p < 0.05']); }
  if (PRF.indval) tiles.push(['Indicator species', PRF.indval.filter(r => r.p < 0.05).length, `of ${PRF.indval.length} (p < 0.05)`]);
  statTiles('prTiles', tiles);
  const host = el('prNarrative'); host.innerHTML = '';
  for (let c = 1; c <= k; c++) host.appendChild(mk('div', { class: 'cluster-card', style: `border-top:4px solid ${Fig.color('cluster', c - 1)}` }, `<h4 style="color:${Fig.color('cluster', c - 1)}">Cluster ${c} <span class="hint" style="margin:0">n = ${PRF.sizes[c] || 0}</span></h4><p>${describeCluster(c)}</p>`));
  /* quantitative table */
  const cols = [{ key: 'name', label: 'Variable' }, { key: 'overall', label: 'Overall mean (SD)' }].concat(Array.from({ length: k }, (_, c) => ({ key: 'c' + c, label: `C${c + 1} mean (v)`, html: true }))).concat([{ key: 'F', label: 'F', num: true }, { key: 'p', label: 'p (ANOVA)', num: true }, { key: 'eta', label: 'η²', num: true }, { key: 'kw', label: 'p (Kruskal)', num: true }]);
  const rows = PRF.quant.slice().sort((a, b) => (b.F || 0) - (a.F || 0)).map(v => { const o = { name: v.name + (v.role === 'supplementary' ? ' (suppl.)' : ''), overall: `${fmtNum(v.mean, 3)} (${fmtNum(v.sd, 3)})`, F: fmtNum(v.F, 2), p: fmtP(v.p), eta: fmtFixed(v.eta2, 3), kw: fmtP(v.kw.p) }; v.clusters.forEach((cc, c) => { const s = Math.abs(cc.vtest) >= 1.96; o['c' + c] = `${s ? '<b>' : ''}${fmtNum(cc.mean, 3)}${s ? '</b>' : ''} <span class="hint" style="margin:0;color:${cc.vtest > 1.96 ? 'var(--success)' : cc.vtest < -1.96 ? 'var(--danger)' : 'inherit'}">(${isFinite(cc.vtest) ? cc.vtest.toFixed(1) : '—'})</span>`; }); return o; });
  buildTable('prQuantTable', cols, rows, { caption: 'Quantitative variables by cluster · v = test value of the cluster mean against the overall mean (|v| ≥ 1.96 in bold)' });
  const ct = el('prCatTable'); ct.innerHTML = '';
  PRF.cats.forEach(cv => { const d = mk('div', { class: 'table-scroll', style: 'margin-top:10px' }); const cols2 = [{ key: 'level', label: cv.name }].concat(Array.from({ length: k }, (_, c) => ({ key: 'c' + c, label: `C${c + 1} (n = ${cv.nc[c]})`, html: true }))).concat([{ key: 'tot', label: 'Total', num: true }]); const rws = cv.rows.map(r => { const o = { level: r.level, tot: r.total }; r.clusters.forEach((cc, c) => { const s = Math.abs(cc.vtest) >= 1.96; o['c' + c] = `${s ? '<b>' : ''}${cc.count} (${Math.round(cc.propInCluster * 100)} %)${s ? '</b>' : ''}${cc.vtest >= 1.96 ? ' ▲' : cc.vtest <= -1.96 ? ' ▼' : ''}`; }); return o; }); buildTable(d, cols2, rws, { caption: `${cv.name} · χ² = ${fmtNum(cv.chi, 2)}, df ${cv.df}, p ${fmtP(cv.p)} · Cramér V ${fmtFixed(cv.cramer, 2)} · ▲ over- / ▼ under-represented (|v| ≥ 1.96)` }); ct.appendChild(d); });
  const it = el('prIndTable'); it.innerHTML = '';
  if (PRF.indval) buildTable(it, [{ key: 'name', label: 'Species / variable' }, { key: 'cluster', label: 'Indicator of' }, { key: 'iv', label: 'IndVal %', num: true }, { key: 'A', label: 'Specificity A %', num: true }, { key: 'B', label: 'Fidelity B %', num: true }, { key: 'p', label: 'p (permutation)', num: true }], PRF.indval.slice().sort((a, b) => b.max - a.max).map(r => ({ name: r.name, cluster: `Cluster ${r.best + 1}`, iv: (r.max * 100).toFixed(1), A: (r.A * 100).toFixed(0), B: (r.B * 100).toFixed(0), p: fmtP(r.p), _class: r.p < 0.05 ? '' : 'dim' })), { caption: `Indicator value (Dufrêne–Legendre) · ${PRF.indval[0].nperm} permutations` });
}
function mountProfileFigures() {
  const pal = { key: 'palette', label: 'Cluster palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">Figure "${esc(spec.title)}" could not be drawn: ${esc(e.message)}</div>`; } };
  const hasQ = PRF.quant.length > 0, k = PRF.k;
  ['fig7Heat', 'fig7Radar', 'fig7Parallel', 'fig7Boxes'].forEach(id => el(id).style.display = hasQ ? '' : 'none');
  if (hasQ) {
    mount('fig7Heat', { title: 'Cluster profiles as a heat map', fileName: 'cluster_profiles_heatmap', width: 900, height: Math.max(320, 200 + k * 60), defaults: { palette: 'cluster', title: 'Standardised cluster means', value: 'z', cmap: 'rdbu', values: true, allVars: PRF.quant.length <= 30 }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'value', label: 'Cell value', type: 'select', options: [['z', 'cluster mean in SD units (z)'], ['vtest', 'test value v'], ['mean', 'raw mean (scaled per variable)']] }, { key: 'cmap', label: 'Colour map', type: 'select', options: Object.entries(Fig.colormapNames) }, { key: 'values', label: 'Show values', type: 'checkbox' }, { key: 'allVars', label: 'All variables (else the 30 most discriminating)', type: 'checkbox' }, pal], render: cfg => P7.meansHeat(cfg, PRF) });
    mount('fig7Radar', { title: 'Radar of cluster means', fileName: 'cluster_radar', width: 760, height: 600, defaults: { palette: 'cluster', title: 'Cluster profiles (means scaled 0–1)', maxVars: 10, scaleBy: 'means', fillAlpha: 0.15, lineWidth: 2, labelSize: 10, legendPos: 'right' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'maxVars', label: 'Variables shown (most discriminating)', type: 'range', min: 3, max: 20, step: 1 }, { key: 'scaleBy', label: 'Scale each axis by', type: 'select', options: [['means', 'range of the cluster means'], ['data', 'range of the data']] }, { key: 'fillAlpha', label: 'Fill opacity', type: 'range', min: 0, max: 0.5, step: 0.05 }, { key: 'lineWidth', label: 'Line width', type: 'range', min: 0.5, max: 5, step: 0.5 }, { key: 'labelSize', label: 'Axis label size', type: 'range', min: 6, max: 16, step: 0.5 }, pal, { key: 'legendPos', label: 'Legend position', type: 'select', options: [['right', 'Top right'], ['bottom', 'Below the plot'], ['none', 'Hidden']] }], render: cfg => P7.radar(cfg, PRF) });
    mount('fig7Parallel', { title: 'Parallel coordinates of the cluster means', fileName: 'cluster_parallel', width: 900, height: 480, defaults: { palette: 'cluster', title: 'Cluster means in standardised units', maxVars: 12, objects: PRF.n <= 200, lineWidth: 2.5 }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'maxVars', label: 'Variables shown', type: 'range', min: 3, max: 30, step: 1 }, { key: 'objects', label: 'Draw the individual objects (faint)', type: 'checkbox' }, { key: 'lineWidth', label: 'Line width', type: 'range', min: 0.5, max: 5, step: 0.5 }, pal], render: cfg => P7.parallel(cfg, PRF) });
    mount('fig7Boxes', { title: 'Distribution of each variable by cluster', fileName: 'cluster_boxplots', width: 960, height: Math.max(360, 60 + Math.ceil(Math.min(12, PRF.quant.length) / 4) * 200), defaults: { palette: 'cluster', title: 'Box plots by cluster (most discriminating variables first)', maxVars: 12 }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'maxVars', label: 'Variables shown', type: 'range', min: 2, max: 24, step: 1 }, pal], render: cfg => P7.boxGrid(cfg, PRF) });
  }
  el('fig7Cats').style.display = PRF.cats.length ? '' : 'none';
  if (PRF.cats.length) mount('fig7Cats', { title: 'Composition of the categorical variables by cluster', fileName: 'cluster_categories', width: 900, height: Math.max(360, 60 + Math.ceil(Math.min(4, PRF.cats.length) / 2) * 260), defaults: { palette: 'cluster', catPalette: 'set2', title: 'Category proportions within each cluster', maxVars: 4 }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'maxVars', label: 'Variables shown', type: 'range', min: 1, max: 8, step: 1 }, { key: 'catPalette', label: 'Category palette', type: 'select', options: Object.entries(Fig.paletteNames) }, pal], render: cfg => P7.catBars(cfg, PRF.cats.slice().sort((a, b) => a.p - b.p), k) });
  el('fig7Indval').style.display = PRF.indval ? '' : 'none';
  if (PRF.indval) mount('fig7Indval', { title: 'Indicator species', fileName: 'indicator_values', width: 900, height: Math.max(360, 120 + Math.min(20, PRF.indval.length) * 22), defaults: { palette: 'cluster', title: 'Indicator value of each species for its best cluster', maxVars: 20, italic: true, legendPos: 'bottom' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'maxVars', label: 'Species shown', type: 'range', min: 5, max: 60, step: 1 }, { key: 'italic', label: 'Italic names', type: 'checkbox' }, pal], render: cfg => P7.indval(cfg, PRF.indval, k) });
}

/* ---------- LDA, tree and prediction ---------- */
let LDA = null, TREE = null;
function runLDA() {
  const X = PRF.X, cl = PRF.cl, k = PRF.k, n = X.length, p = X[0].length;
  el('ldaCard').style.display = ''; el('predCard').style.display = '';
  clearMessages('ldaMessages');
  if (Object.values(PRF.sizes).some(v => v < 2)) showMessage('ldaMessages', 'warning', 'Some cluster has fewer than 2 objects: its covariance cannot be estimated; the pooled matrix is regularised.');
  if (n <= p + k) showMessage('ldaMessages', 'warning', `Few objects for ${p} variables: the discriminant rule will fit the training data too well; trust the leave-one-out accuracy.`);
  const t0 = performance.now();
  LDA = PR.ldaValidate(X, cl, k, { equalPriors: el('ldaPriors').value === 'equal' });
  LDA.cl = cl; LDA.labels = PRF.labels; LDA.model = LDA; LDA.ms = performance.now() - t0;
  TREE = PR.tree(X, PRF.numNames, cl, k, { maxDepth: +el('treeDepth').value || 3, minLeaf: +el('treeLeaf').value || 3 });
  state.lda = LDA; state.tree = TREE;
  statTiles('ldaTiles', [['Wilks Λ', fmtFixed(LDA.wilks, 3), `χ² ${fmtNum(LDA.chi, 1)}, df ${LDA.df}, p ${fmtP(LDA.pWilks)}`, LDA.pWilks < 0.05 ? 'ok' : 'warn'], ['Resubstitution accuracy', fmtPct(LDA.accuracy, 1), 'objects re-classified into their own cluster'], ['Leave-one-out accuracy', isFinite(LDA.loo) ? fmtPct(LDA.loo, 1) : '—', 'honest estimate for new objects', LDA.loo > 0.9 ? 'ok' : LDA.loo > 0.7 ? 'warn' : 'bad'], ['Discriminant axes', LDA.axes.length, LDA.pct.map((v, i) => `LD${i + 1} ${fmtPct(v, 0)}`).join(' · ')], ['Tree rules', TREE.rules.length, `depth ≤ ${TREE.depth} · accuracy ${fmtPct(TREE.accuracy, 0)}`]]);
  const M = LDA.confusion, Ml = LDA.confusionLoo;
  buildTable('ldaConfusion', [{ key: 'c', label: 'Cluster \\ predicted' }].concat(Array.from({ length: k }, (_, j) => ({ key: 'p' + j, label: `C${j + 1}`, num: true, html: true }))), M.map((r, i) => { const o = { c: `Cluster ${i + 1}` }; r.forEach((v, j) => o['p' + j] = i === j ? `<b>${v}</b>${isFinite(LDA.loo) ? ` <span class="hint" style="margin:0">(${Ml[i][j]})</span>` : ''}` : `${v}${isFinite(LDA.loo) ? ` <span class="hint" style="margin:0">(${Ml[i][j]})</span>` : ''}`); return o; }), { caption: 'Confusion matrix: resubstitution (leave-one-out in parentheses)' });
  buildTable('ldaCoef', [{ key: 'v', label: 'Variable' }].concat(LDA.axes.map((_, t) => ({ key: 'a' + t, label: `LD${t + 1} std. coef.`, num: true }))).concat(LDA.axes.map((_, t) => ({ key: 's' + t, label: `LD${t + 1} structure r`, num: true }))), PRF.numNames.map((nm, j) => { const o = { v: nm }; LDA.axes.forEach((_, t) => { o['a' + t] = fmtFixed(LDA.stdCoef[t][j], 3); o['s' + t] = fmtFixed(LDA.structure[t][j], 3); }); return o; }), { caption: 'Standardised discriminant coefficients (weight of each variable) and structure correlations (variable vs. axis)' });
  el('treeRules').innerHTML = '<ol>' + TREE.rules.map(r => `<li><b>Cluster ${r.cluster}</b> ${r.conditions.length ? 'if ' + r.conditions.map(esc).join(' and ') : '(everything)'} <span class="hint" style="margin:0">— n = ${r.n}, ${Math.round(r.purity * 100)} % pure</span></li>`).join('') + '</ol>';
  const mount = (id, spec) => { try { Fig.mount(id, spec); } catch (e) { console.error(id, e); el(id).innerHTML = `<div class="msg msg-error">${esc(e.message)}</div>`; } };
  const pal = { key: 'palette', label: 'Palette', type: 'select', options: Object.entries(Fig.paletteNames) };
  mount('fig7LDA', { title: 'Discriminant map', fileName: 'lda_map', width: 900, height: 600, defaults: { palette: 'cluster', title: 'Linear discriminant analysis of the clusters', subtitle: `Wilks Λ = ${LDA.wilks.toFixed(3)} · leave-one-out accuracy ${isFinite(LDA.loo) ? fmtPct(LDA.loo, 0) : '—'}`, ellipses: true, labels: 'auto', labelSize: 9, pointSize: 4.5, legendPos: 'right' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'subtitle', label: 'Subtitle', type: 'text' }, { key: 'ellipses', label: '95 % ellipses', type: 'checkbox' }, { key: 'labels', label: 'Object labels', type: 'select', options: [['auto', 'automatic (n ≤ 60)'], ['all', 'all'], ['none', 'none']] }, { key: 'labelSize', label: 'Label size', type: 'range', min: 6, max: 16, step: 0.5 }, { key: 'pointSize', label: 'Point size', type: 'range', min: 2, max: 10, step: 0.5 }, pal, { key: 'legendPos', label: 'Legend position', type: 'select', options: [['right', 'Top right'], ['left', 'Top left'], ['bottom', 'Below the plot'], ['none', 'Hidden']] }], render: cfg => P7.lda(cfg, LDA) });
  mount('fig7Tree', { title: 'Classification tree', fileName: 'classification_tree', width: 960, height: 420, defaults: { palette: 'cluster', title: 'Decision rules that reproduce the clusters', legendPos: 'right' }, controls: [{ key: 'title', label: 'Title', type: 'text' }, pal], render: cfg => P7.tree(cfg, TREE, k) });
}

function predictNew() {
  if (!LDA || !PRF) return;
  clearMessages('predMessages');
  const text = el('newData').value.trim(); if (!text) { showMessage('predMessages', 'warning', 'Paste a table with a header row first.'); return; }
  let grid; try { grid = parseCSV(text, null); } catch (e) { showMessage('predMessages', 'error', esc(e.message)); return; }
  const header = grid[0].map(h => String(h).trim()), rows = grid.slice(1).filter(r => r.some(v => !isMissing(v)));
  const lower = header.map(h => h.toLowerCase());
  const idx = PRF.numNames.map(nm => lower.indexOf(nm.toLowerCase()));
  const missing = PRF.numNames.filter((_, j) => idx[j] < 0);
  if (missing.length === PRF.numNames.length) { showMessage('predMessages', 'error', `None of the variables was found. Expected columns: ${esc(PRF.numNames.join(', '))}.`); return; }
  if (missing.length) showMessage('predMessages', 'warning', `Missing columns filled with the overall mean: ${esc(missing.join(', '))}.`);
  const labelIdx = lower.findIndex(h => !PRF.numNames.some(nm => nm.toLowerCase() === h));
  const means = PRF.quant.map(q => q.mean);
  const cm = PR.centroidModel(PRF.X, PRF.cl, PRF.k);
  const out = rows.map((r, i) => { const x = PRF.numNames.map((nm, j) => { const v = idx[j] >= 0 ? toNumber(r[idx[j]], 'auto') : null; return v == null ? means[j] : v; }); const l = PR.ldaPredict(LDA, x), c = PR.centroidPredict(cm, x), t = TREE.predict(x); return { label: labelIdx >= 0 ? String(r[labelIdx]) : `new ${i + 1}`, lda: l.cluster, post: Math.max(...l.posterior), centroid: c.cluster, tree: t, agree: l.cluster === c.cluster && c.cluster === t, x }; });
  state.predictions = out;
  buildTable('predTable', [{ key: 'label', label: 'Object' }, { key: 'lda', label: 'LDA cluster', num: true }, { key: 'post', label: 'Posterior', num: true, fmt: v => fmtFixed(v, 3) }, { key: 'centroid', label: 'Nearest centroid', num: true }, { key: 'tree', label: 'Tree rule', num: true }, { key: 'agree', label: 'Agreement', get: r => r.agree ? 'all three agree' : 'methods differ' }], out, { caption: `${out.length} new observation${out.length > 1 ? 's' : ''} assigned to the ${PRF.k} clusters` });
  el('predResults').style.display = '';
  const dis = out.filter(o => !o.agree).length;
  el('predText').innerHTML = `<p class="hint">${dis ? `${dis} observation${dis > 1 ? 's' : ''} where the three rules disagree: they sit between clusters; the LDA posterior tells how confident the assignment is.` : 'All three rules agree for every new observation.'}</p>`;
}
function downloadPred() { if (!state.predictions) return; download(matrixToCSV(['Object', 'LDA_cluster', 'Posterior', 'Centroid_cluster', 'Tree_cluster'].concat(PRF.numNames), state.predictions.map(o => [o.label, o.lda, +o.post.toFixed(4), o.centroid, o.tree].concat(o.x))), slug(state.fileName) + '_new_assignments.csv', 'text/csv;charset=utf-8'); }
function downloadProfiles() {
  if (!PRF) return;
  const header = ['Variable', 'Overall_mean', 'Overall_SD'].concat(Array.from({ length: PRF.k }, (_, c) => [`C${c + 1}_n`, `C${c + 1}_mean`, `C${c + 1}_SD`, `C${c + 1}_vtest`]).flat()).concat(['F', 'p_ANOVA', 'eta2', 'H_Kruskal', 'p_Kruskal']);
  const rows = PRF.quant.map(v => [v.name, +v.mean.toFixed(6), +v.sd.toFixed(6)].concat(v.clusters.flatMap(c => [c.n, +(c.mean || 0).toFixed(6), isFinite(c.sd) ? +c.sd.toFixed(6) : '', isFinite(c.vtest) ? +c.vtest.toFixed(4) : ''])).concat([+v.F.toFixed(4), +v.p.toFixed(6), +v.eta2.toFixed(4), +v.kw.H.toFixed(4), +v.kw.p.toFixed(6)]));
  download(matrixToCSV(header, rows), slug(state.fileName) + '_cluster_profiles.csv', 'text/csv;charset=utf-8');
}
function useExample() { el('newData').value = PRF ? [PRF.numNames.join('\t')].concat([0, 1, 2].map(t => PRF.numNames.map((nm, j) => { const q = PRF.quant[j]; const c = q.clusters[t % PRF.k]; return +(c.mean + (q.sd || 0) * 0.3 * (t - 1)).toFixed(3); }).join('\t'))).join('\n') : ''; }

function refresh() {
  if (!state.dist) return;
  PRF = null; state.profiles = null; el('prResults').style.display = 'none'; el('ldaCard').style.display = 'none'; el('predCard').style.display = 'none';
  enableStep(8, false); el('nextBtn7').disabled = true;
  el('prSource').value = state.partition ? 'partition' : 'tree';
  renderVarLists();
}
function init() {
  if (!el('prRun')) return;
  el('prRun').addEventListener('click', run);
  el('ldaRerun').addEventListener('click', () => { if (PRF && PRF.X) runLDA(); });
  el('predictBtn').addEventListener('click', predictNew);
  el('predExample').addEventListener('click', useExample);
  el('dlPredBtn').addEventListener('click', downloadPred);
  el('dlProfilesBtn').addEventListener('click', downloadProfiles);
  el('newFile').addEventListener('change', () => { const f = el('newFile').files[0]; if (!f) return; const rd = new FileReader(); rd.onload = e => { el('newData').value = e.target.result; }; rd.readAsText(f); el('newFile').value = ''; });
  el('nextBtn7').addEventListener('click', () => goStep(8));
  document.addEventListener('distchange', refresh);
  document.addEventListener('partitionchange', () => { if (state.dist) el('prSource').value = 'partition'; });
}
document.addEventListener('DOMContentLoaded', init);
})();
