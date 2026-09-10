/* ClusteringPro — Block 8: self-contained HTML report, print-to-PDF and ZIP package.
   The report collects the tables and diagnostics exactly as they are shown in the app (DOM snapshots)
   and every figure as the user edited it (Fig.mounted()). */

(function () {
const Report = {};
let figN = 0, tabN = 0;

/* ---------- software citation (kept in sync with CITATION.cff) ---------- */
Report.CITE = {
  author: 'Barrera-Guzmán, L. Á.', year: 2026, version: '1.0.1',
  title: 'ClusteringPro: finding, validating and interpreting natural groups in biological, ecological and agronomic data without programming',
  doi: '10.5281/zenodo.22682795', url: 'https://doi.org/10.5281/zenodo.22682795', repo: 'https://github.com/luisangelbg/ClusteringPro', online: 'https://luisangelbg.github.io/ClusteringPro/',
};
Report.citation = () => { const c = Report.CITE; return `${c.author} (${c.year}). ${c.title} (Version ${c.version}) [Computer software]. Zenodo. ${c.url}`; };
Report.citeSection = () => { const c = Report.CITE; return `<h2 id="cite">How to cite</h2><div class="methods"><p>If this analysis is published, please cite the software:</p><p class="cite">${esc(c.author)} (${c.year}). <i>${esc(c.title)}</i> (Version ${c.version}) [Computer software]. Zenodo. <a href="${c.url}">${c.url}</a></p><p class="hint">The DOI above is the concept DOI and always resolves to the latest version; version-specific DOIs are listed on the Zenodo record. Source code: <a href="${c.repo}">${c.repo}</a> · online version: <a href="${c.online}">${c.online}</a> · license GPL-3.0-or-later.</p><p class="hint">BibTeX:</p><pre>@software{barrera_guzman_clusteringpro_${c.year},
  author  = {Barrera-Guzmán, Luis Ángel},
  title   = {${c.title}},
  year    = {${c.year}},
  version = {${c.version}},
  doi     = {${c.doi}},
  url     = {${c.url}}
}</pre></div>`; };

/* ---------- descriptive labels for tables that have no caption in the app ---------- */
const TABLE_LABELS = {
  varTable: 'Variables: detected type, role in the analysis and summary statistics', clusterTable: 'Clusters obtained by cutting the tree: size and members',
  crossTable: 'Cross-tabulation of tree clusters against the known grouping', cmpTable: 'Comparison of dissimilarity coefficients', cmp4Table: 'Comparison of linkage rules',
  ptClusterTable: 'Clusters of the partition: size, silhouette and members', ptCrossTable: 'Cross-tabulation of the partition against the tree clusters and the known grouping',
  cmp5Table: 'Comparison of partitioning methods at the same k', vkTable: 'Validation indices for each number of clusters', stTable: 'Bootstrap stability of each cluster (Jaccard)',
  pvTable: 'Multiscale bootstrap support of the tree clusters', cvTable: 'Internal validation summary across methods and k', prQuantTable: 'Cluster profiles of the quantitative variables (means, test values, ANOVA)',
  prCatTable: 'Cluster profiles of the categorical variables', prIndTable: 'Indicator values of species / variables per cluster', ldaConfusion: 'Confusion matrix of the linear discriminant analysis',
  ldaCoef: 'Coefficients of the linear discriminant functions', predTable: 'Cluster assignment of new observations',
};
/* ---------- analysis context appended to every figure caption ---------- */
function figContext(hostId) {
  const d = state.dist ? Dist.byId(state.dist.id).name + ' dissimilarity' : '';
  if (/^fig[A-Z]/.test(hostId)) { const sc = { none: 'without scaling', zscore: 'after z-score standardisation', range: 'after range scaling to 0–1', robust: 'after robust scaling (median/IQR)', maxabs: 'after scaling by the maximum absolute value' }; return state.prep ? `working matrix ${sc[state.prep.scaling] || ''}`.trim() : ''; }
  if (hostId.startsWith('fig3')) return d;
  if (hostId.startsWith('fig4')) { const H = state.hclust; return H ? `${HC_METHOD_NAMES[H.method]} linkage on ${d}${H.k ? `, cut at k = ${H.k}` : ''}` : d; }
  if (hostId.startsWith('fig5')) { const R = state.partition; return R ? `${R.name}, k = ${R.k}${R.space ? ', on the ' + R.space : ''}` : ''; }
  if (hostId.startsWith('fig6')) { const V = state.validation; return V && V.sweep ? `validation over k = ${V.sweep.ks[0]}–${V.sweep.ks[V.sweep.ks.length - 1]} (${V.sweep.generator} partitions on ${d})` : d; }
  if (hostId.startsWith('fig7')) { const P = state.profiles; return P ? `profiles of the ${P.k} clusters (${P.source || 'adopted partition'})` : ''; }
  return '';
}

function visible(id) { const n = el(id); if (!n) return false; if (n.style.display === 'none') return false; for (let p = n.parentElement; p && p !== document.body; p = p.parentElement) { if (p.classList.contains('step-panel')) continue; if (p.style && p.style.display === 'none') return false; } return n.textContent.trim().length > 0 || n.querySelector('svg'); }
function grab(id, cls) {
  if (!visible(id)) return '';
  const n = el(id).cloneNode(true);
  /* form controls become their current value (variable types and roles, ordinal orders) */
  const live = el(id);
  const liveSel = live.querySelectorAll('select'), liveInp = live.querySelectorAll('input[type=text]');
  n.querySelectorAll('select').forEach((s, i) => { const src = liveSel[i]; s.replaceWith(document.createTextNode(src && src.options[src.selectedIndex] ? src.options[src.selectedIndex].text : '')); });
  n.querySelectorAll('input[type=text]').forEach((s, i) => { const src = liveInp[i]; s.replaceWith(document.createTextNode(src ? src.value : '')); });
  n.querySelectorAll('button, input, details.fig-editor, .fig-tools').forEach(x => x.remove());
  /* every table gets a number; tables without a caption in the app receive a descriptive one */
  const tables = [...n.querySelectorAll('table')];
  tables.forEach((t, i) => {
    tabN++;
    let cap = t.querySelector('caption');
    if (!cap) { cap = document.createElement('caption'); t.insertBefore(cap, t.firstChild); cap.innerHTML = esc((TABLE_LABELS[id] || 'Results') + (tables.length > 1 ? ` (${i + 1} of ${tables.length})` : '')); }
    cap.innerHTML = `<b>Table ${tabN}.</b> ${cap.innerHTML}`;
  });
  return `<div class="${cls || ''}">${n.innerHTML}</div>`;
}
function figures(prefix) {
  const test = typeof prefix === 'function' ? prefix : a => a.hostId.startsWith(prefix);
  return Fig.mounted().filter(test).map(a => {
    figN++;
    const clone = a.svg.cloneNode(true); clone.removeAttribute('width'); clone.removeAttribute('height'); clone.setAttribute('style', 'width:100%;height:auto');
    const ctx = figContext(a.hostId);
    const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const sub = a.cfg && a.cfg.subtitle ? esc(cap1(String(a.cfg.subtitle).trim())) : '';
    const cap = [esc(a.title), sub, esc(cap1(ctx))].filter(Boolean).map(s => { s = s.replace(/[.;\s]+$/, ''); return s + (/[?!]$/.test(s) ? '' : '.'); }).join(' ');
    return `<figure class="nobreak">${new XMLSerializer().serializeToString(clone)}<figcaption><b>Figure ${figN}.</b> ${cap}</figcaption></figure>`;
  }).join('');
}

/* ---------- executive summary: key numbers and a drafted results section ---------- */
const sizes = cl => { const c = {}; cl.forEach(v => { if (v) c[v] = (c[v] || 0) + 1; }); return Object.keys(c).sort((a, b) => a - b).map(k => c[k]); };
const silWord = s => s > 0.7 ? 'strong structure' : s > 0.5 ? 'reasonable structure' : s > 0.25 ? 'weak structure' : 'no substantial structure';
const jacWord = j => j > 0.85 ? 'highly stable' : j > 0.75 ? 'stable' : j > 0.6 ? 'indicates a pattern but is not fully stable' : 'unstable';
Report.summaryTiles = () => {
  const t = [];
  const tile = (l, v, s, lv) => t.push(`<div class="stat-tile${lv ? ' ' + lv : ''}"><div class="stat-label">${l}</div><div class="stat-value">${v}</div>${s ? `<div class="stat-sub">${s}</div>` : ''}</div>`);
  if (state.dist) tile('Objects', state.dist.n, state.columns ? `${state.columns.filter(c => c.role === 'active').length} active variables` : 'dissimilarity matrix supplied');
  if (state.eda && state.eda.hopkins) { const H = state.eda.hopkins; tile('Clustering tendency', 'H = ' + H.H.toFixed(2), H.pval < 0.05 ? 'non-random structure (p ' + (H.pval < 0.001 ? '< 0.001' : '= ' + H.pval.toFixed(3)) + ')' : 'not distinguishable from uniform', H.H > 0.75 ? 'ok' : H.H > 0.5 ? 'warn' : 'bad'); }
  if (state.dist) tile('Dissimilarity', esc(Dist.byId(state.dist.id).name), state.dist.diag && state.dist.diag.euclid ? (state.dist.diag.euclid.negMass < 0.01 ? 'Euclidean-embeddable' : 'non-Euclidean') : '');
  if (state.hclust) { const H = state.hclust; tile('Hierarchical tree', `${esc(HC_METHOD_NAMES[H.method])}, k = ${H.k}`, `cophenetic r = ${H.coph.toFixed(3)} · sizes ${sizes(H.cl).join(' / ')}`, H.coph > 0.75 ? 'ok' : H.coph > 0.6 ? 'warn' : 'bad'); }
  if (state.partition) { const R = state.partition; tile('Partition', `${esc(R.name)}, k = ${R.k}`, `silhouette ${R.sil.avg.toFixed(3)} (${silWord(R.sil.avg)}) · sizes ${sizes(R.cluster).join(' / ')}${R.noise ? ' · ' + R.noise + ' noise' : ''}`, R.sil.avg > 0.5 ? 'ok' : R.sil.avg > 0.25 ? 'warn' : 'bad'); }
  if (state.validation && state.validation.sweep && state.validation.sweep.consensus[0]) { const c = state.validation.sweep.consensus[0], tot = Object.values(state.validation.sweep.votes).filter(v => v.k != null).length; tile('Consensus k', c.k, `${c.votes} of ${tot} criteria`, c.votes / tot >= 0.5 ? 'ok' : 'warn'); }
  if (state.validation && state.validation.stability) { const m = S.mean(state.validation.stability.clusters.map(c => c.mean).filter(isFinite)); tile('Stability', 'Jaccard ' + m.toFixed(2), jacWord(m) + ` (${state.validation.stability.B} bootstraps)`, m > 0.75 ? 'ok' : m > 0.6 ? 'warn' : 'bad'); }
  const ari = state.validation && state.validation.external ? state.validation.external.ari : (state.partition && state.partition.ariGroups != null ? state.partition.ariGroups : (state.hclust && state.hclust.ari != null ? state.hclust.ari : null));
  if (ari != null) tile('Agreement with known groups', 'ARI = ' + ari.toFixed(3), ari > 0.8 ? 'excellent recovery' : ari > 0.5 ? 'moderate recovery' : 'weak recovery', ari > 0.8 ? 'ok' : ari > 0.5 ? 'warn' : 'bad');
  if (state.lda && isFinite(state.lda.loo)) tile('Discriminability', fmtPct(state.lda.loo, 1), 'LDA leave-one-out accuracy', state.lda.loo > 0.9 ? 'ok' : state.lda.loo > 0.7 ? 'warn' : 'bad');
  if (state.profiles && state.profiles.quant && state.profiles.quant.length) { const top = state.profiles.quant.slice().sort((a, b) => b.eta2 - a.eta2).slice(0, 3); tile('Most discriminant variables', esc(top.map(v => v.name).join(', ')), 'η² = ' + top.map(v => v.eta2.toFixed(2)).join(', ')); }
  return t.length ? `<div class="results-summary">${t.join('')}</div>` : '';
};
Report.resultsText = () => {
  const p = [];
  const n = state.dist ? state.dist.n : (state.rawRows ? state.rawRows.length : 0);
  if (state.eda && state.eda.hopkins) { const H = state.eda.hopkins; p.push(`<b>Clustering tendency.</b> The Hopkins statistic was ${H.H.toFixed(3)} (p ${H.pval < 0.001 ? '< 0.001' : '= ' + H.pval.toFixed(3)}), ${H.H > 0.75 ? 'well above the 0.5 expected for uniformly spread objects: the data contain genuine group structure' : H.H > 0.5 ? 'above 0.5: some group structure is present but it is not pronounced' : 'close to 0.5: the objects are spread almost uniformly and any partition should be interpreted with caution'}.`); }
  if (state.dist && state.dist.diag && state.dist.diag.euclid) { const e = state.dist.diag.euclid; p.push(`<b>Dissimilarity.</b> The ${Dist.byId(state.dist.id).name} coefficient produced a ${e.negMass < 0.01 ? 'Euclidean-embeddable matrix, so principal coordinates and Ward linkage are directly applicable' : `non-Euclidean matrix (${fmtPct(e.negMass, 1)} of the eigenvalue mass is negative); ordinations and Ward linkage on it are approximate`}${state.dist.stress != null ? `. The two-dimensional principal-coordinate map reproduced the dissimilarities with a stress of ${state.dist.stress.toFixed(3)}` : ''}.`); }
  if (state.hclust) { const H = state.hclust, sz = sizes(H.cl); p.push(`<b>Hierarchical clustering.</b> ${HC_METHOD_NAMES[H.method]} linkage reproduced the dissimilarities with a cophenetic correlation of ${H.coph.toFixed(3)} (${H.coph > 0.8 ? 'faithful' : H.coph > 0.7 ? 'acceptable' : 'distorted'} tree) and ${H.method === 'diana' ? 'a divisive' : 'an agglomerative'} coefficient of ${H.coef.toFixed(3)}${H.coef > 0.8 ? ', indicating clear structure' : ''}. Cutting the tree at k = ${H.k} gave clusters of ${sz.join(', ')} objects${H.ari != null ? ` (adjusted Rand index against the known grouping = ${H.ari.toFixed(3)})` : ''}${H.reversals ? `; ${H.reversals} reversal${H.reversals > 1 ? 's' : ''} occurred in the merge heights` : ''}.`); }
  if (state.partition) { const R = state.partition, sz = sizes(R.cluster); p.push(`<b>Partitioning.</b> ${R.name} with k = ${R.k} produced clusters of ${sz.join(', ')} objects${R.noise ? ` and left ${R.noise} objects as noise` : ''}. The average silhouette width was ${R.sil.avg.toFixed(3)}, which indicates ${silWord(R.sil.avg)}${R.sil.s ? `; ${R.sil.s.filter(v => v < 0).length} object${R.sil.s.filter(v => v < 0).length === 1 ? ' has' : 's have'} a negative silhouette (closer to another cluster than to its own)` : ''}${R.ariTree != null ? `. Agreement with the hierarchical cut: ARI = ${R.ariTree.toFixed(3)}` : ''}${R.ariGroups != null ? `; with the known grouping: ARI = ${R.ariGroups.toFixed(3)}` : ''}.`); }
  if (state.validation) { const V = state.validation, s = []; if (V.sweep && V.sweep.consensus[0]) { const c = V.sweep.consensus[0], tot = Object.values(V.sweep.votes).filter(v => v.k != null).length; s.push(`${c.votes} of ${tot} criteria pointed to k = ${c.k}${V.sweep.consensus[1] ? ` (next: k = ${V.sweep.consensus[1].k} with ${V.sweep.consensus[1].votes})` : ''}`); } if (V.stability) { const m = S.mean(V.stability.clusters.map(c => c.mean).filter(isFinite)); s.push(`the bootstrap Jaccard means (${V.stability.clusters.map(c => c.mean.toFixed(2)).join(', ')}) show that the partition is ${jacWord(m)}${V.stability.clusters.some(c => c.mean < 0.6) ? `; cluster${V.stability.clusters.filter(c => c.mean < 0.6).length > 1 ? 's' : ''} ${V.stability.clusters.filter(c => c.mean < 0.6).map(c => c.cluster).join(', ')} should not be over-interpreted` : ''}`); } if (V.pv) s.push(`multiscale bootstrap gave AU support values for the tree clusters (see the annotated dendrogram)`); if (V.external) s.push(`${V.external.names[0]} and ${V.external.names[1]} agreed at ARI = ${V.external.ari.toFixed(3)} and NMI = ${V.external.nmi.toFixed(3)} (χ² p ${V.external.pval < 0.001 ? '< 0.001' : '= ' + V.external.pval.toFixed(3)})`); if (s.length) p.push(`<b>Number of clusters and validation.</b> ${s.join('; ').replace(/^./, c => c.toUpperCase())}.`); }
  if (state.profiles) { const P = state.profiles, q = P.quant || []; const sig = q.filter(v => v.p < 0.05).length; const top = q.slice().sort((a, b) => b.eta2 - a.eta2).slice(0, 4); const desc = top.map(v => { const hi = v.clusters.reduce((b, c, i) => c.mean > (b.m == null ? -Infinity : b.m) ? { m: c.mean, i } : b, { m: null, i: -1 }); return `${v.name} (η² = ${v.eta2.toFixed(2)}, highest in cluster ${hi.i + 1})`; }); p.push(`<b>Cluster profiles.</b> ${sig} of ${q.length} quantitative variables differed among clusters (ANOVA, p &lt; 0.05); the most discriminant were ${desc.join(', ')}.${P.indval && P.indval.length ? ` ${P.indval.filter(r => r.p < 0.05).length} indicator taxa were significant at p &lt; 0.05.` : ''}${state.lda ? ` A linear discriminant analysis separated the clusters (Wilks' Λ = ${state.lda.wilks.toFixed(3)}, p ${state.lda.pWilks < 0.001 ? '< 0.001' : '= ' + state.lda.pWilks.toFixed(3)}) and re-classified ${fmtPct(state.lda.loo, 1)} of the objects correctly under leave-one-out cross-validation${state.tree ? `; ${state.tree.rules.length} classification rules of depth ≤ ${state.tree.depth} describe the partition with ${fmtPct(state.tree.accuracy, 0)} accuracy` : ''}.` : ''}`); }
  return p.length ? `<div class="methods"><b>Draft for the results section</b> (edit freely; every number is taken from the analysis above)<p>${p.join('</p><p>')}</p></div>` : '';
};
const CSS = `
body{font-family:Helvetica,Arial,sans-serif;color:#1d1d2b;background:#fff;max-width:1100px;margin:0 auto;padding:28px 36px;line-height:1.5;font-size:14px}
h1{font-size:1.9rem;letter-spacing:-.5px;margin:0 0 4px}h2{font-size:1.35rem;margin:34px 0 8px;padding-bottom:4px;border-bottom:2px solid #4f46a5}h3{font-size:1.05rem;margin:18px 0 6px}
.meta{color:#62627a;margin-bottom:22px}.meta b{color:#1d1d2b}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin:8px 0 14px}caption{caption-side:top;text-align:left;padding:6px 0;font-weight:600;font-size:12.5px}
th{background:#ebebf4;text-align:left;padding:6px 9px;border-bottom:1px solid #dedeea}td{padding:5px 9px;border-bottom:1px solid #eee;vertical-align:top}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}tr.dim td{color:#888}
.table-scroll{overflow-x:auto}
.results-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}.stat-tile{background:#f3f3f9;border-radius:8px;padding:9px 12px}.stat-label{font-size:.68rem;color:#62627a;text-transform:uppercase;letter-spacing:.05em;font-weight:600}.stat-value{font-size:1.15rem;font-weight:700}.stat-sub{font-size:.72rem;color:#62627a}
.stat-tile.ok{box-shadow:inset 3px 0 0 #2f9e44}.stat-tile.warn{box-shadow:inset 3px 0 0 #d98a1c}.stat-tile.bad{box-shadow:inset 3px 0 0 #c93a2c}
.check-list{padding:0;margin:8px 0}.check-item{display:flex;gap:10px;padding:8px 12px;border:1px solid #e3e3ee;border-radius:8px;margin-bottom:6px;align-items:flex-start}.ck-icon{width:20px;flex-shrink:0}.ck-title{font-weight:600;font-size:.9rem}.ck-text{font-size:.84rem;color:#555}
.check-item.ok{border-left:3px solid #2f9e44}.check-item.warn{border-left:3px solid #d98a1c}.check-item.bad{border-left:3px solid #c93a2c}.check-item.info{border-left:3px solid #1f9bb3}
.verdict{display:flex;gap:16px;align-items:center;background:#f3f3f9;border-radius:10px;padding:12px 16px;margin:8px 0}.verdict .grade{font-size:2.2rem;font-weight:800;min-width:60px;text-align:center}.grade small{display:block;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#62627a}.grade.g-a{color:#2f9e44}.grade.g-b{color:#1f9bb3}.grade.g-c{color:#d98a1c}.grade.g-d{color:#c93a2c}
.reco{border:1px solid #cfcbee;background:#f3f2fb;border-radius:10px;padding:10px 14px;margin:10px 0}.reco h4{margin:0 0 6px;color:#4f46a5;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em}.reco-row{display:flex;gap:14px;flex-wrap:wrap;font-size:.86rem}.reco-row b{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:#62627a}
.cluster-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;margin:10px 0}.cluster-card{border:1px solid #e3e3ee;border-radius:10px;padding:10px 14px;border-top-width:4px}.cluster-card h4{margin:0 0 4px;font-size:1rem}.cluster-card p{margin:0;font-size:.85rem}
.design-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0}.ds-item{background:#f3f3f9;border-radius:8px;padding:8px 12px}.ds-label{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:#62627a;font-weight:700}.ds-value{font-weight:600;font-size:.92rem}.ds-sub{font-size:.72rem;color:#62627a}
figure{margin:16px 0;page-break-inside:avoid}figcaption{font-size:.84rem;color:#444;margin-top:4px}.pill{display:inline-block;font-size:.68rem;padding:1px 7px;border-radius:999px;background:#ebebf4;color:#555}.flag{font-size:.72rem;color:#d98a1c}.flag.bad{color:#c93a2c}.flag.ok{color:#2f9e44}.hint{color:#62627a;font-size:.84rem}
.cite{padding-left:2em;text-indent:-2em}pre{background:#f3f3f9;border-radius:8px;padding:10px 12px;font-size:12px;overflow-x:auto}
.spark{display:none}.methods{background:#fbfbfe;border:1px solid #e3e3ee;border-radius:10px;padding:14px 18px;font-size:.92rem}.toc{columns:2;font-size:.9rem}.toc li{margin-bottom:2px}.notes{white-space:pre-wrap}
@media print{body{padding:0;max-width:none;font-size:12px}h2{page-break-after:avoid}table{font-size:11px}a{color:inherit;text-decoration:none}.nobreak{page-break-inside:avoid}figure svg{max-height:640px}}`;

/* ---------- auto-drafted methods paragraph ---------- */
Report.methodsText = () => {
  const p = [];
  if (state.rawRows && state.rawRows.length) {
    const act = state.columns.filter(c => c.role === 'active'), kinds = {}; act.forEach(c => kinds[c.kind] = (kinds[c.kind] || 0) + 1);
    p.push(`The data set (${esc(state.fileName || 'table')}) comprised ${state.rawRows.length} objects described by ${act.length} active variables (${Object.entries(kinds).map(([k, v]) => `${v} ${KINDS[k].label.toLowerCase()}`).join(', ')})${state.columns.some(c => c.role === 'supplementary') ? ` and ${state.columns.filter(c => c.role === 'supplementary').length} supplementary variables used only for interpretation` : ''}.`);
    if (state.prep) { const tr = { none: '', log: 'a log(x + 1) transformation', sqrt: 'a square-root transformation', hellinger: 'the Hellinger transformation', chord: 'the chord transformation', total: 'conversion to relative abundances', pa: 'reduction to presence/absence' }[state.prep.transform]; const sc = { none: 'no scaling', zscore: 'standardisation to z-scores', range: 'range scaling to 0–1', robust: 'robust scaling (median/IQR)', maxabs: 'scaling by the maximum absolute value' }[state.prep.scaling]; p.push(`Missing values were ${state.prep.missing === 'drop' ? `handled by removing incomplete objects (${state.prep.dropped} removed)` : `imputed (${state.prep.imputed} cells)`}; ${tr ? tr + ' followed by ' : ''}${sc} was applied to the quantitative variables.`); }
    if (state.eda && state.eda.hopkins) { const H = state.eda.hopkins; p.push(`Clustering tendency was assessed with the Hopkins statistic (H = ${H.H.toFixed(3)}, p ${H.pval < 0.001 ? '< 0.001' : '= ' + H.pval.toFixed(3)} against ${H.nsim} uniform reference sets) and a VAT image.`); }
  } else if (state.isDistance) p.push(`A ${state.dist ? state.dist.n : ''}-object dissimilarity matrix (${esc(state.fileName || '')}) was supplied directly.`);
  if (state.dist) { const d = state.dist, c = Dist.byId(d.id); p.push(`Dissimilarities between objects were computed with the ${c.name} coefficient${d.note ? ' (' + d.note.replace(/\.$/, '').toLowerCase() + ')' : ''}${d.diag && d.diag.euclid ? `; the matrix was ${d.diag.euclid.negMass < 0.01 ? '' : 'not '}Euclidean-embeddable (${fmtPct(d.diag.euclid.negMass, 1)} negative eigenvalue mass)` : ''}.`); }
  if (state.hclust) { const H = state.hclust; p.push(`Hierarchical clustering used ${HC_METHOD_NAMES[H.method]}${H.method === 'flexible' ? ` (β = ${H.beta})` : ''} linkage (cophenetic correlation ${H.coph.toFixed(3)}, ${H.method === 'diana' ? 'divisive' : 'agglomerative'} coefficient ${H.coef.toFixed(3)}); the tree was cut into ${H.k} clusters${H.ari != null ? `, which agreed with the known grouping at an adjusted Rand index of ${H.ari.toFixed(3)}` : ''}.`); if (state.hclustCompare) p.push(`${state.hclustCompare.names.length} linkage rules were compared through their cophenetic correlations, Baker's γ and tanglegrams.`); }
  if (state.partition) { const R = state.partition; p.push(`A ${R.name} partition into ${R.k} clusters was obtained${R.space ? ' on the ' + R.space : ''}${R.params && R.params.algorithm ? ` (${R.params.algorithm}, ${R.params.nstart} starts)` : ''}${R.params && R.params.model ? ` (covariance model ${R.params.model}, selected by BIC)` : ''}${R.method === 'dbscan' ? ` (ε = ${fmtNum(R.params.eps, 4)}, minPts = ${R.params.minPts}, ${R.noise} noise objects)` : ''}; its average silhouette width was ${R.sil.avg.toFixed(3)}${R.ariTree != null ? ` and its agreement with the hierarchical cut ARI = ${R.ariTree.toFixed(3)}` : ''}.`); }
  if (state.validation) { const V = state.validation; if (V.sweep) { const c = V.sweep.consensus, tot = Object.values(V.sweep.votes).filter(v => v.k != null).length; p.push(`The number of clusters was evaluated for k = ${V.sweep.ks[0]}–${V.sweep.ks[V.sweep.ks.length - 1]} with ${tot} criteria (silhouette, Calinski–Harabasz, Davies–Bouldin, Dunn, gap statistic, C-index, McClain–Rao, PBM, Ratkowsky–Lance, Hartigan, Krzanowski–Lai, Ball–Hall and the elbow of the within-cluster sum of squares); ${c[0] ? `k = ${c[0].k} received most votes (${c[0].votes} of ${tot})` : 'no consensus emerged'}.`); } if (V.stability) p.push(`Cluster stability was assessed with ${V.stability.B} bootstrap resamples of the objects (mean Jaccard ${V.stability.clusters.map(c => c.mean.toFixed(2)).join(', ')}).`); if (V.pv) p.push(`Support for the hierarchical clusters was estimated by multiscale bootstrap of the variables (${V.pv.B} resamples at ${V.pv.scales.length} scales; AU values).`); if (V.external) p.push(`Agreement between ${V.external.names[0]} and ${V.external.names[1]} was quantified with the adjusted Rand index (${V.external.ari.toFixed(3)}), normalised mutual information (${V.external.nmi.toFixed(3)}) and a χ² test (p ${V.external.pval < 0.001 ? '< 0.001' : '= ' + V.external.pval.toFixed(3)}).`); }
  if (state.profiles) { const P = state.profiles; p.push(`Clusters were characterised by one-way ANOVA and Kruskal–Wallis tests per variable and by test values of the cluster means against the overall mean${P.cats.length ? ', and by χ² tests on the categorical variables' : ''}${P.indval ? '; indicator species were identified with the Dufrêne–Legendre indicator value and a permutation test' : ''}.`); if (state.lda) p.push(`A linear discriminant analysis of the clusters (Wilks' Λ = ${state.lda.wilks.toFixed(3)}, p ${state.lda.pWilks < 0.001 ? '< 0.001' : '= ' + state.lda.pWilks.toFixed(3)}) classified ${fmtPct(state.lda.loo, 1)} of the objects correctly under leave-one-out cross-validation${state.tree ? `, and a classification tree of depth ${state.tree.depth} summarised the partition in ${state.tree.rules.length} rules` : ''}.`); }
  p.push(`All computations were carried out in ClusteringPro version ${Report.CITE.version} (${Report.CITE.author.replace(/,.*/, '')}, ${Report.CITE.year}; ${Report.CITE.url}), a browser-based platform for cluster analysis.`);
  return p.join(' ');
};

/* ---------- membership appendix ---------- */
function membershipTable() {
  if (!state.dist) return '';
  const cols = ['Object'].concat(state.groups ? ['Known group'] : []).concat(state.hclust ? [`Tree cluster (k = ${state.hclust.k})`] : []).concat(state.partition ? [`${state.partition.name} cluster`, 'Silhouette'] : []);
  const rows = state.dist.labels.map((l, i) => [l].concat(state.groups ? [state.groups[i]] : []).concat(state.hclust ? [state.hclust.cl[i]] : []).concat(state.partition ? [state.partition.cluster[i] || 'noise', state.partition.sil.s[i].toFixed(3)] : []));
  tabN++;
  return `<div class="table-scroll"><table><caption><b>Table ${tabN}.</b> Cluster membership of every object</caption><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function rawDataTable() {
  if (!state.rawRows || !state.rawRows.length) return '';
  tabN++;
  return `<div class="table-scroll"><table><caption><b>Table ${tabN}.</b> Data as loaded (${state.rawRows.length} rows)</caption><thead><tr>${state.rawHeader.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${state.rawRows.map(r => `<tr>${r.map(v => `<td>${esc(String(v ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ---------- build ---------- */
Report.build = o => {
  figN = 0; tabN = 0;
  const S8 = [];
  const sec = (title, body) => { if (body && body.replace(/<div class="[^"]*"><\/div>/g, '').trim()) S8.push({ title, body }); };
  if (o.data) sec('Data, preprocessing and clustering tendency', grab('varSummary', 'design-summary') + grab('varChecks', 'check-list') + grab('varTable', 'table-scroll') + grab('edaVerdict', 'verdict') + grab('edaTiles', 'results-summary') + grab('edaChecks', 'check-list') + figures(a => /^fig[A-Z]/.test(a.hostId)));
  if (o.dist) sec('Similarity and distance', grab('distTiles', 'results-summary') + grab('distChecks', 'check-list') + figures('fig3') + grab('cmpText') + grab('cmpTable', 'table-scroll'));
  if (o.hier) sec('Hierarchical clustering', grab('hcTiles', 'results-summary') + grab('hcChecks', 'check-list') + grab('clusterTable', 'table-scroll') + grab('crossTable') + figures('fig4') + grab('cmp4Text') + grab('cmp4Table', 'table-scroll'));
  if (o.part) sec('Partitioning and advanced clustering', grab('ptTiles', 'results-summary') + grab('ptChecks', 'check-list') + grab('ptClusterTable', 'table-scroll') + grab('ptCrossTable') + figures('fig5') + grab('cmp5Text') + grab('cmp5Table', 'table-scroll'));
  if (o.valid) sec('Number of clusters and validation', grab('vkTiles', 'results-summary') + grab('vkChecks', 'check-list') + grab('vkTable', 'table-scroll') + grab('stText') + grab('stTable', 'table-scroll') + grab('pvText') + grab('pvTable', 'table-scroll') + grab('exTiles', 'results-summary') + grab('exText') + grab('cvTable', 'table-scroll') + figures('fig6'));
  if (o.profiles) sec('Cluster profiles, discriminant analysis and rules', grab('prTiles', 'results-summary') + grab('prNarrative', 'cluster-grid') + grab('prQuantTable', 'table-scroll') + grab('prCatTable') + grab('prIndTable', 'table-scroll') + grab('ldaTiles', 'results-summary') + grab('ldaConfusion', 'table-scroll') + grab('ldaCoef', 'table-scroll') + (visible('treeRules') ? '<h3>Classification rules</h3>' + grab('treeRules') : '') + grab('predTable', 'table-scroll') + figures('fig7'));
  const summary = o.summary !== false ? (() => { const t = Report.summaryTiles(), r = Report.resultsText(); return t || r ? `<h2 id="summary">Summary</h2>${t}${r}` : ''; })() : '';
  const methods = o.methods ? `<h2>Methods</h2><div class="methods">${Report.methodsText()}</div>` : '';
  const cite = o.cite !== false ? Report.citeSection() : '';
  const appendix = (o.appendix && state.dist ? '<h2>Appendix A · Cluster membership</h2>' + membershipTable() : '') + (o.rawdata ? '<h2>Appendix B · Data</h2>' + rawDataTable() : '');
  const toc = (summary ? '<li><a href="#summary">Summary</a></li>' : '') + S8.map((s, i) => `<li><a href="#s${i + 1}">${i + 1}. ${esc(s.title)}</a></li>`).join('') + (methods ? `<li><a href="#methods">Methods</a></li>` : '') + (cite ? '<li><a href="#cite">How to cite</a></li>' : '') + (o.appendix && state.dist ? '<li><a href="#appA">Appendix A</a></li>' : '');
  const date = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(o.title)}</title><style>${CSS}</style></head><body>
<h1>${esc(o.title)}</h1>
<div class="meta">${o.author ? `<b>${esc(o.author)}</b> · ` : ''}${date} · ${state.fileName ? `data: <b>${esc(state.fileName)}</b> · ` : ''}${state.dist ? `${state.dist.n} objects` : ''}${state.hclust ? ` · tree: ${HC_METHOD_NAMES[state.hclust.method]}, k = ${state.hclust.k}` : ''}${state.partition ? ` · partition: ${esc(state.partition.name)}, k = ${state.partition.k}` : ''}</div>
${o.notes ? `<p class="notes">${esc(o.notes)}</p>` : ''}
<ol class="toc">${toc}</ol>
${summary}
${S8.map((s, i) => `<h2 id="s${i + 1}">${i + 1}. ${esc(s.title)}</h2>${s.body}`).join('')}
${methods.replace('<h2>', '<h2 id="methods">')}
${cite}
${appendix.replace('<h2>Appendix A', '<h2 id="appA">Appendix A')}
<p class="hint" style="margin-top:40px">Generated by ClusteringPro on ${new Date().toISOString().slice(0, 19).replace('T', ' ')}. Figures are embedded as vector graphics and print at full resolution.</p>
</body></html>`;
};

/* ---------- ZIP package ---------- */
Report.zip = async (o, html) => {
  const files = [{ name: 'report.html', data: html }];
  const scale = +o.zipRes || 4, dpi = scale * 75;
  if (state.rawRows && state.rawRows.length) files.push({ name: 'data/data_as_loaded.csv', data: matrixToCSV(state.rawHeader, state.rawRows) });
  if (state.X) files.push({ name: 'data/preprocessed_matrix.csv', data: matrixToCSV(['Object'].concat(state.groups ? ['Group'] : []).concat(state.Xnames), state.X.map((r, i) => [state.labels[i]].concat(state.groups ? [state.groups[i]] : []).concat(r.map(v => +v.toFixed(6))))) });
  if (state.dist) files.push({ name: `data/dissimilarity_${state.dist.id}.csv`, data: matrixToCSV([''].concat(state.dist.labels), state.dist.D.map((r, i) => [state.dist.labels[i]].concat(r.map(v => +v.toFixed(6))))) });
  if (state.dist) { const cols = ['Object'].concat(state.groups ? ['Group'] : []).concat(state.hclust ? ['Tree_cluster'] : []).concat(state.partition ? ['Partition_cluster', 'Silhouette'] : []); files.push({ name: 'tables/cluster_membership.csv', data: matrixToCSV(cols, state.dist.labels.map((l, i) => [l].concat(state.groups ? [state.groups[i]] : []).concat(state.hclust ? [state.hclust.cl[i]] : []).concat(state.partition ? [state.partition.cluster[i], +state.partition.sil.s[i].toFixed(4)] : []))) }); }
  if (state.hclust) { const hc = state.hclust.hc, lab = v => v < 0 ? state.hclust.labels[-v - 1] : 'node ' + v; files.push({ name: 'tables/tree_merges.csv', data: matrixToCSV(['Step', 'Left', 'Right', 'Height'], hc.merge.map((m, s) => [s + 1, lab(m[0]), lab(m[1]), +hc.height[s].toPrecision(6)])) }); }
  if (state.validation && state.validation.sweep) { const sw = state.validation.sweep, keys = ['wss', 'silhouette', 'ch', 'db', 'dunn', 'gap', 'cindex', 'mcclain', 'pbm', 'rl', 'hartigan', 'kl']; files.push({ name: 'tables/indices_by_k.csv', data: matrixToCSV(['k'].concat(keys), sw.rows.map(r => [r.k].concat(keys.map(k => isFinite(r[k]) ? +r[k].toPrecision(6) : '')))) }); }
  if (state.profiles) { const P = state.profiles; files.push({ name: 'tables/cluster_profiles.csv', data: matrixToCSV(['Variable', 'Overall_mean', 'Overall_SD'].concat(Array.from({ length: P.k }, (_, c) => [`C${c + 1}_n`, `C${c + 1}_mean`, `C${c + 1}_vtest`]).flat()).concat(['F', 'p_ANOVA', 'eta2']), P.quant.map(v => [v.name, +v.mean.toFixed(6), +v.sd.toFixed(6)].concat(v.clusters.flatMap(c => [c.n, +(c.mean || 0).toFixed(6), isFinite(c.vtest) ? +c.vtest.toFixed(4) : ''])).concat([+v.F.toFixed(4), +v.p.toFixed(6), +v.eta2.toFixed(4)]))) }); if (P.indval) files.push({ name: 'tables/indicator_values.csv', data: matrixToCSV(['Species', 'Cluster', 'IndVal', 'A', 'B', 'p'], P.indval.map(r => [r.name, r.best + 1, +r.max.toFixed(4), +r.A.toFixed(4), +r.B.toFixed(4), +r.p.toFixed(4)])) }); }
  files.push({ name: 'methods.txt', data: Report.methodsText().replace(/<[^>]+>/g, '') });
  const figs = Fig.mounted(); const used = new Set();
  for (const f of figs) {
    let nm = f.fileName; let q = 2; while (used.has(nm)) nm = f.fileName + '_' + q++; used.add(nm);
    files.push({ name: `figures/svg/${nm}.svg`, data: Fig.serialize(f.svg) });
    if (o.zipFmt !== 'svg') { try { const blob = await Fig.toRaster(f.svg, { format: o.zipFmt, scale, dpi, background: '#ffffff' }); files.push({ name: `figures/${o.zipFmt}/${nm}.${o.zipFmt === 'tiff' ? 'tif' : o.zipFmt}`, data: blob }); } catch (e) { console.error(e); } }
  }
  files.push({ name: 'README.txt', data: `${o.title}\n\nGenerated by ClusteringPro on ${new Date().toISOString()}\nReport: report.html (open in any browser; print to PDF from the browser)\nData: data/ (as loaded, preprocessed matrix, dissimilarity matrix)\nTables: tables/ (CSV)\nFigures: figures/svg (vector) and figures/${o.zipFmt} (${dpi} dpi)\nMethods paragraph: methods.txt\n` });
  return Zip.build(files);
};
window.Report = Report;
})();
