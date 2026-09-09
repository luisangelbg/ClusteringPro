/* ClusteringPro — Block 1 (home page) wiring and navigation. */

(function () {
const BLOCKS = [
  { n: 1, title: 'Home & theory', tag: 'Ready', text: 'What clustering is, the families of methods, how to choose distances and linkages, and how to validate what you find.' },
  { n: 2, title: 'Data & exploratory analysis', tag: 'Ready', text: 'Excel, CSV, JSON… Variable typing (quantitative, binary, nominal, ordinal, counts), roles, missing values, scaling, outliers and clustering tendency (Hopkins, VAT, PCA preview).' },
  { n: 3, title: 'Similarity & distance', tag: 'Ready', text: 'Euclidean, Manhattan, Minkowski, correlation, Mahalanobis; Jaccard, Dice, simple matching; Gower for mixed data; Bray–Curtis, Hellinger, chi-square for ecological counts. Distance heat maps and MDS.' },
  { n: 4, title: 'Hierarchical clustering', tag: 'Ready', text: 'Single, complete, UPGMA, WPGMA, centroid, median, Ward, flexible beta; DIANA. Dendrogram studio with palettes, radial and phylogenic layouts, editable labels, legends and axes. Tanglegrams and tree comparison.' },
  { n: 5, title: 'Partitioning & advanced', tag: 'Ready', text: 'k-means (Hartigan–Wong, Lloyd, k-means++), PAM, CLARA, fuzzy c-means, hierarchical k-means, Gaussian mixtures, DBSCAN. Cluster maps on PCA axes with hulls and ellipses.' },
  { n: 6, title: 'Optimal k & validation', tag: 'Ready', text: 'Elbow, silhouette, gap statistic, Calinski–Harabasz, Davies–Bouldin, Dunn, consensus of indices; bootstrap stability and p-values for trees; Rand, ARI and NMI against known groups.' },
  { n: 7, title: 'Profiles & prediction', tag: 'Ready', text: 'Cluster profiles with heat maps and radars, variables that define each group (v-tests, ANOVA), indicator species, discriminant analysis and assignment of new observations.' },
  { n: 8, title: 'Report & export', tag: 'Ready', text: 'Self-contained HTML/PDF report with methods, tables and every figure as you edited it; ZIP with data, tables and images at publication resolution.' },
];
const METHODS = [
  ['agnes', 'hier', 'Agglomerative', 'bottom-up merges · 8 linkage rules'],
  ['diana', 'hier', 'Divisive (DIANA)', 'top-down splits'],
  ['tanglegram', 'hier', 'Tree comparison', 'tanglegram · entanglement · Baker γ'],
  ['heatmap', 'hier', 'Clustered heat map', 'rows and columns ordered by trees'],
  ['kmeans', 'part', 'k-means', 'centroids · Hartigan–Wong · k-means++'],
  ['pam', 'part', 'k-medoids (PAM)', 'robust to outliers · any distance'],
  ['clara', 'part', 'CLARA', 'PAM for thousands of rows'],
  ['fuzzy', 'part', 'Fuzzy c-means', 'membership degrees instead of labels'],
  ['gmm', 'adv', 'Model-based', 'Gaussian mixtures · EM · BIC'],
  ['dbscan', 'adv', 'DBSCAN', 'density · any shape · noise'],
  ['hkmeans', 'adv', 'Hierarchical k-means', 'tree seeds the centres'],
  ['tendency', 'val', 'Clustering tendency', 'Hopkins statistic · VAT image'],
  ['optk', 'val', 'Optimal number of clusters', 'elbow · silhouette · gap · 30 indices'],
  ['validation', 'val', 'Validation', 'silhouette · Dunn · stability · ARI'],
  ['supervised', 'val', 'Supervised follow-up', 'LDA · classify new observations'],
];
const DTYPES = [
  ['quant', 'Quantitative', 'Yield, height, gene expression, soil chemistry, morphometrics.', 'Euclidean · Manhattan · correlation · Mahalanobis'],
  ['binary', 'Binary (0/1)', 'Presence/absence of species, alleles, traits, symptoms.', 'Jaccard · Dice · simple matching · Ochiai'],
  ['nominal', 'Nominal', 'Cultivar, soil type, colour, region, category.', 'Simple matching · Hamming · Gower'],
  ['ordinal', 'Ordinal', 'Damage scores, Likert scales, ranked classes.', 'Ranks + Manhattan · Gower'],
  ['count', 'Counts & abundances', 'Species × site tables, OTU counts, insect captures.', 'Bray–Curtis · Hellinger · chi-square · Morisita–Horn'],
  ['mixed', 'Mixed', 'Any combination of the above in one table.', 'Gower distance'],
  ['dist', 'Distance matrix', 'A matrix you already computed (genetic, geographic, expert).', 'Used directly'],
];

function init() {
  if (!el('featureGrid')) return;
  el('brandLogo').innerHTML = Art.logo();
  el('heroArt').innerHTML = Art.hero();
  for (let n = 2; n <= 8; n++) { const h = el('soon' + n); if (h) h.innerHTML = Art.soon() + '<div>This block is being built. Blocks are released in order.</div>'; }

  const fg = el('featureGrid');
  BLOCKS.forEach(b => {
    const card = mk('div', { class: 'feature' + (b.tag === 'Planned' ? ' soon' : '') });
    card.innerHTML = `<div class="f-art">${Art.block(b.n)}</div><div class="f-num">${b.n}</div><span class="f-tag">${b.tag}</span><h3>${b.title}</h3><p>${b.text}</p>`;
    card.addEventListener('click', () => {
      const btn = document.querySelector(`.step-btn[data-step="${b.n}"]`);
      if (btn && !btn.disabled) goStep(b.n);
      else if (b.n >= 3 && !state.ready) { goStep(2); }
    });
    fg.appendChild(card);
  });
  const mg = el('methodGallery');
  METHODS.forEach(([id, fam, name, sub]) => mg.appendChild(mk('div', { class: 'method-card' }, `<span class="m-fam ${fam}">${{ hier: 'hierarchical', part: 'partitioning', adv: 'advanced', val: 'validation' }[fam]}</span>${Art.method(id)}<div class="m-name">${name}</div><div class="m-sub">${sub}</div>`)));
  const dg = el('dtypeGrid');
  DTYPES.forEach(([id, name, text, dist]) => dg.appendChild(mk('div', { class: 'dtype' }, `${Art.dtype(id)}<h4>${name}</h4><p>${text}</p><div class="dt-dist">${dist}</div>`)));

  els('.theory-fig[data-fig]').forEach(d => { d.insertAdjacentHTML('afterbegin', Art.fig(d.dataset.fig)); });

  el('startBtn').addEventListener('click', () => goStep(2));
  el('theoryBtn').addEventListener('click', () => { const t = el('theory'); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); const first = t.querySelector('details.acc'); if (first) first.open = true; });
  el('playBtn').addEventListener('click', () => el('playground').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  el('brand').addEventListener('click', () => goStep(1));
  els('.step-btn').forEach(b => b.addEventListener('click', () => { if (!b.disabled) goStep(+b.dataset.step); }));
  els('[data-go]').forEach(b => b.addEventListener('click', () => goStep(+b.dataset.go)));
}
document.addEventListener('DOMContentLoaded', init);
})();
