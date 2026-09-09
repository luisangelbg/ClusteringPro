/* ClusteringPro — Block 3 engine: similarity and dissimilarity coefficients.
   Every coefficient returns an n×n dissimilarity matrix (0 on the diagonal). Similarities s are
   converted with d = 1 − s. Sources come from the Block 2 working data (state). */

const Dist = {};

/* ---------------- catalogue ---------------- */
Dist.families = {
  quant:      { label: 'Quantitative', help: 'Continuous measurements (scaled in Block 2 unless you choose the raw source).' },
  binary:     { label: 'Binary (0/1)', help: 'Presence/absence, yes/no. Asymmetric coefficients ignore shared absences (d).' },
  nominal:    { label: 'Nominal / ordinal', help: 'Categories compared by agreement; ordinal levels by their ranks.' },
  ecological: { label: 'Counts & abundances', help: 'Species × site tables: asymmetric, non-negative, dominated by zeros.' },
  mixed:      { label: 'Mixed (Gower)', help: 'Any combination of variable types on a common 0–1 scale.' },
  given:      { label: 'Supplied matrix', help: 'The distance matrix you loaded, optionally transformed.' },
};
/* id, family, name, kind (d = dissimilarity, s = similarity converted), formula (plain text), note, range */
Dist.catalog = [
  { id: 'euclidean', fam: 'quant', name: 'Euclidean', formula: 'd = √ Σ (xᵢ − yᵢ)²', note: 'The straight-line distance. Default for k-means and Ward; sensitive to scale and outliers.', range: '0–∞' },
  { id: 'sqeuclidean', fam: 'quant', name: 'Squared Euclidean', formula: 'd = Σ (xᵢ − yᵢ)²', note: 'What Ward and k-means minimise internally; exaggerates large differences.', range: '0–∞' },
  { id: 'manhattan', fam: 'quant', name: 'Manhattan (city block)', formula: 'd = Σ |xᵢ − yᵢ|', note: 'Sum of absolute differences; less influenced by a single extreme variable.', range: '0–∞' },
  { id: 'minkowski', fam: 'quant', name: 'Minkowski (order p)', formula: 'd = ( Σ |xᵢ − yᵢ|ᵖ )^(1/p)', note: 'p = 1 Manhattan, p = 2 Euclidean, large p → Chebyshev.', range: '0–∞', param: 'p' },
  { id: 'chebyshev', fam: 'quant', name: 'Chebyshev (maximum)', formula: 'd = max |xᵢ − yᵢ|', note: 'Only the largest single difference counts.', range: '0–∞' },
  { id: 'canberra', fam: 'quant', name: 'Canberra', formula: 'd = Σ |xᵢ − yᵢ| / (|xᵢ| + |yᵢ|)', note: 'Differences relative to magnitude; for positive, skewed data. Terms with xᵢ = yᵢ = 0 are skipped (R convention).', range: '0–p' },
  { id: 'mahalanobis', fam: 'quant', name: 'Mahalanobis', formula: 'd = √ (x − y)ᵀ S⁻¹ (x − y)', note: 'Euclidean after removing correlations between variables (computed through the principal components).', range: '0–∞' },
  { id: 'pca_euclid', fam: 'quant', name: 'Euclidean on principal components', formula: 'd = √ Σₖ (PCₖ(x) − PCₖ(y))²', note: 'Keeps the k leading components; removes noise and redundancy before clustering.', range: '0–∞', param: 'k' },
  { id: 'pearson', fam: 'quant', name: 'Pearson correlation distance', formula: 'd = 1 − r(x, y)', note: 'Two objects are similar when their profiles rise and fall together, whatever their level. Standard for expression data.', range: '0–2' },
  { id: 'pearson_abs', fam: 'quant', name: 'Absolute Pearson distance', formula: 'd = 1 − |r(x, y)|', note: 'Opposite profiles also count as similar.', range: '0–1' },
  { id: 'spearman', fam: 'quant', name: 'Spearman correlation distance', formula: 'd = 1 − ρ(x, y)', note: 'Rank-based profile similarity; robust to outliers and monotone transformations.', range: '0–2' },
  { id: 'kendall', fam: 'quant', name: 'Kendall correlation distance', formula: 'd = 1 − τ(x, y)', note: 'Based on concordant and discordant pairs of variables.', range: '0–2' },
  { id: 'cosine', fam: 'quant', name: 'Cosine distance', formula: 'd = 1 − x·y / (‖x‖ ‖y‖)', note: 'Angle between the profiles; ignores their length.', range: '0–2' },

  { id: 'jaccard', fam: 'binary', name: 'Jaccard', formula: 's = a / (a + b + c)', note: 'Asymmetric: shared absences do not count. The default for species and markers.', range: '0–1' },
  { id: 'dice', fam: 'binary', name: 'Dice / Sørensen', formula: 's = 2a / (2a + b + c)', note: 'Asymmetric; gives double weight to shared presences.', range: '0–1' },
  { id: 'sm', fam: 'binary', name: 'Simple matching', formula: 's = (a + d) / (a + b + c + d)', note: 'Symmetric: 0 and 1 are equally informative (male/female, allele A/B).', range: '0–1' },
  { id: 'rogers', fam: 'binary', name: 'Rogers & Tanimoto', formula: 's = (a + d) / (a + d + 2(b + c))', note: 'Symmetric, mismatches weigh double.', range: '0–1' },
  { id: 'sokal', fam: 'binary', name: 'Sokal & Sneath (asymmetric)', formula: 's = a / (a + 2(b + c))', note: 'Asymmetric, mismatches weigh double.', range: '0–1' },
  { id: 'russell', fam: 'binary', name: 'Russell & Rao', formula: 's = a / (a + b + c + d)', note: 'Shared presences over all variables; absences count against similarity.', range: '0–1' },
  { id: 'ochiai', fam: 'binary', name: 'Ochiai', formula: 's = a / √((a + b)(a + c))', note: 'Cosine similarity for binary data.', range: '0–1' },
  { id: 'kulczynski', fam: 'binary', name: 'Kulczynski', formula: 's = ½ [a/(a + b) + a/(a + c)]', note: 'Mean of the two conditional proportions of shared presences.', range: '0–1' },
  { id: 'hamming', fam: 'binary', name: 'Hamming (mismatches)', formula: 'd = b + c', note: 'Number of variables in which the two objects differ.', range: '0–p' },
  { id: 'yule', fam: 'binary', name: 'Yule', formula: 'd = (1 − Q) / 2,  Q = (ad − bc)/(ad + bc)', note: 'Association-based; 0.5 means independence.', range: '0–1' },

  { id: 'sm_nominal', fam: 'nominal', name: 'Simple matching (categories)', formula: 'd = number of variables with different categories / p', note: 'Proportion of mismatching categories across the nominal (and binary) variables.', range: '0–1' },
  { id: 'ordinal_manhattan', fam: 'nominal', name: 'Manhattan on normalised ranks', formula: 'd = Σ |rank(xᵢ) − rank(yᵢ)| / (kᵢ − 1) / p', note: 'Ordered categories compared by their ranks, each variable scaled to 0–1.', range: '0–1' },
  { id: 'gower_cat', fam: 'nominal', name: 'Gower (categorical + ordinal)', formula: 'd = mean over variables of the type-specific 0–1 dissimilarity', note: 'Simple matching for nominal, normalised rank difference for ordinal, Jaccard-style for binary.', range: '0–1' },

  { id: 'bray', fam: 'ecological', name: 'Bray–Curtis', formula: 'd = Σ |xᵢ − yᵢ| / Σ (xᵢ + yᵢ)', note: 'The workhorse for community data; ignores double zeros; 1 = no species in common. Not Euclidean (use √d for Ward).', range: '0–1' },
  { id: 'ruzicka', fam: 'ecological', name: 'Ružička (quantitative Jaccard)', formula: 'd = 1 − Σ min(xᵢ, yᵢ) / Σ max(xᵢ, yᵢ)', note: 'Jaccard generalised to abundances.', range: '0–1' },
  { id: 'kulczynski_q', fam: 'ecological', name: 'Kulczynski (quantitative)', formula: 'd = 1 − ½ [Σmin/Σx + Σmin/Σy]', note: 'Less sensitive to differences in total abundance than Bray–Curtis.', range: '0–1' },
  { id: 'morisita', fam: 'ecological', name: 'Morisita–Horn', formula: 'd = 1 − 2 Σ xᵢyᵢ / [(Σxᵢ²/X² + Σyᵢ²/Y²) X Y]', note: 'Nearly independent of sample size; emphasises dominant species.', range: '0–1' },
  { id: 'hellinger', fam: 'ecological', name: 'Hellinger distance', formula: 'd = √ Σ (√(xᵢ/X) − √(yᵢ/Y))²', note: 'Euclidean distance between square-rooted relative abundances; suitable for Ward, k-means and PCA.', range: '0–√2' },
  { id: 'chord', fam: 'ecological', name: 'Chord distance', formula: 'd = √ Σ (xᵢ/‖x‖ − yᵢ/‖y‖)²', note: 'Euclidean distance between profiles scaled to unit length.', range: '0–√2' },
  { id: 'chisq', fam: 'ecological', name: 'Chi-square distance', formula: 'd = √(Σ₊₊) · √ Σⱼ (1/cⱼ) (xⱼ/X − yⱼ/Y)²', note: 'The distance behind correspondence analysis; rare species weigh more.', range: '0–∞' },
  { id: 'canberra_eco', fam: 'ecological', name: 'Canberra (abundances)', formula: 'd = Σ |xᵢ − yᵢ| / (xᵢ + yᵢ) over species present in at least one', note: 'Every species weighs the same, whatever its abundance.', range: '0–p' },
  { id: 'jaccard_pa', fam: 'ecological', name: 'Jaccard on presence/absence', formula: 's = a / (a + b + c) after coding x > 0 as 1', note: 'Throws away abundances and keeps composition only.', range: '0–1' },

  { id: 'gower', fam: 'mixed', name: 'Gower', formula: 'd = Σₖ wₖ dₖ / Σₖ wₖ · dₖ: |x−y|/range (quantitative, ordinal ranks), mismatch (nominal), Jaccard-style (binary)', note: 'Each variable contributes 0–1; quantitative variables are range-scaled internally, so scaling in Block 2 is irrelevant here.', range: '0–1', param: 'gower' },
  { id: 'euclid_dummy', fam: 'mixed', name: 'Euclidean on the working matrix', formula: 'd = √ Σ (xᵢ − yᵢ)² over scaled numeric columns and dummy-coded categories', note: 'The quick alternative: categories become 0/1 columns weighted 1/√2. Less principled than Gower.', range: '0–∞' },

  { id: 'given', fam: 'given', name: 'As supplied', formula: 'd = D', note: 'Your matrix, unchanged.', range: 'as given' },
  { id: 'given_sqrt', fam: 'given', name: 'Square root', formula: 'd = √D', note: 'Makes many non-Euclidean dissimilarities (Bray–Curtis, Jaccard) Euclidean-embeddable, which Ward and PCoA appreciate.', range: '0–√max' },
  { id: 'given_sq', fam: 'given', name: 'Squared', formula: 'd = D²', note: 'Use when your matrix holds square-rooted distances and you need the original scale.', range: '0–max²' },
];
Dist.byId = id => Dist.catalog.find(c => c.id === id);

/* ---------------- data sources from Block 2 ---------------- */
Dist.sources = () => {
  const s = {};
  if (state.isDistance) { s.given = { D: state.D0, labels: state.labels }; s.labels = state.labels; s.families = ['given']; return s; }
  const kinds = state.numKinds || [], names = state.numNames || [];
  const idx = pred => kinds.map((k, j) => j).filter(j => pred(kinds[j]));
  const numIdx = idx(k => k === 'quant' || k === 'count' || k === 'ordinal');
  const binIdx = idx(k => k === 'binary');
  const wIdx = state.Xkinds.map((k, j) => j).filter(j => !state.Xdummy[j] && state.Xkinds[j] !== 'binary');
  s.quantWorking = { X: state.X.map(r => wIdx.map(j => r[j])), names: wIdx.map(j => state.Xnames[j]) };
  s.quantRaw = { X: state.numRaw.map(r => numIdx.map(j => r[j])), names: numIdx.map(j => names[j]) };
  const nonneg = numIdx.filter(j => state.numRaw.every(r => r[j] >= 0));
  s.counts = nonneg.length >= 2 ? { X: state.numRaw.map(r => nonneg.map(j => r[j])), names: nonneg.map(j => names[j]), fromCounts: nonneg.some(j => kinds[j] === 'count') } : null;
  if (binIdx.length) s.binary = { B: state.numRaw.map(r => binIdx.map(j => r[j])), names: binIdx.map(j => names[j]), derived: false };
  else if (s.counts) s.binary = { B: s.counts.X.map(r => r.map(v => v > 0 ? 1 : 0)), names: s.counts.names, derived: true };
  const ordNames = new Set(state.columns.filter(c => c.kind === 'ordinal').map(c => c.name));
  const catIdx = (state.catNames || []).map((n, j) => j).filter(j => !ordNames.has(state.catNames[j]));
  s.nominal = catIdx.length ? { C: state.cat.map(r => catIdx.map(j => r[j])), names: catIdx.map(j => state.catNames[j]) } : null;
  const ordIdx = idx(k => k === 'ordinal');
  s.ordinal = ordIdx.length ? { R: state.numRaw.map(r => ordIdx.map(j => r[j])), names: ordIdx.map(j => names[j]) } : null;
  s.working = { X: state.X, names: state.Xnames };
  s.labels = state.labels;
  s.families = [];
  if (s.quantWorking.names.length) s.families.push('quant');
  if (s.binary) s.families.push('binary');
  if (s.nominal || s.ordinal || binIdx.length) s.families.push('nominal');
  if (s.counts) s.families.push('ecological');
  s.families.push('mixed');
  return s;
};
Dist.defaultFor = profileType => ({ quant: 'euclidean', ecological: 'bray', binary: 'jaccard', nominal: 'sm_nominal', ordinal: 'ordinal_manhattan', mixed: 'gower', distance: 'given' }[profileType] || 'euclidean');

/* ---------------- computation ---------------- */
function pairwise(n, f) {
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const v = f(i, j); D[i][j] = D[j][i] = isFinite(v) ? Math.max(0, v) : 0; }
  return D;
}
const sum = a => a.reduce((s, v) => s + v, 0);
function kendallTau(x, y) {
  let c = 0, d = 0; const n = x.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const s = Math.sign(x[i] - x[j]) * Math.sign(y[i] - y[j]); if (s > 0) c++; else if (s < 0) d++; }
  return (c + d) ? (c - d) / (c + d) : 0;
}

/* opts: {p, k, gowerBinary:'asym'|'sym', gowerWeights:{name:w}, source:'working'|'raw'} */
Dist.compute = (id, opts) => {
  opts = opts || {};
  const c = Dist.byId(id); if (!c) throw new Error('Unknown coefficient ' + id);
  const src = Dist.sources();
  const out = { id, name: c.name, fam: c.fam, params: {}, note: '' };
  let D, n;
  const qx = () => { const q = opts.source === 'raw' ? src.quantRaw : src.quantWorking; out.note = opts.source === 'raw' ? 'Computed on the raw (unscaled) numeric variables.' : 'Computed on the working matrix from Block 2 (transformed and scaled).'; out.vars = q.names; return q.X; };
  switch (c.fam) {
    case 'quant': {
      const X = qx(); n = X.length; const p = X[0].length;
      if (id === 'euclidean') D = pairwise(n, (i, j) => Math.sqrt(KM.sqd(X[i], X[j])));
      else if (id === 'sqeuclidean') D = pairwise(n, (i, j) => KM.sqd(X[i], X[j]));
      else if (id === 'manhattan') D = pairwise(n, (i, j) => { let s = 0; for (let t = 0; t < p; t++) s += Math.abs(X[i][t] - X[j][t]); return s; });
      else if (id === 'minkowski') { const pw = +opts.p || 3; out.params.p = pw; D = pairwise(n, (i, j) => { let s = 0; for (let t = 0; t < p; t++) s += Math.pow(Math.abs(X[i][t] - X[j][t]), pw); return Math.pow(s, 1 / pw); }); }
      else if (id === 'chebyshev') D = pairwise(n, (i, j) => { let s = 0; for (let t = 0; t < p; t++) s = Math.max(s, Math.abs(X[i][t] - X[j][t])); return s; });
      else if (id === 'canberra') D = pairwise(n, (i, j) => { let s = 0, used = 0; for (let t = 0; t < p; t++) { const den = Math.abs(X[i][t]) + Math.abs(X[j][t]); if (den > 0) { s += Math.abs(X[i][t] - X[j][t]) / den; used++; } } return used ? s * p / used : 0; });
      else if (id === 'mahalanobis') { const pc = S.pca(X, { scale: false }); const keep = pc.values.map((v, j) => j).filter(j => pc.values[j] > 1e-8 * Math.max(pc.values[0], 1e-12) && j < n - 1); D = pairwise(n, (i, j) => Math.sqrt(keep.reduce((s, t) => s + (pc.scores[i][t] - pc.scores[j][t]) ** 2 / pc.values[t], 0))); out.params.components = keep.length; }
      else if (id === 'pca_euclid') { const pc = S.pca(X, { scale: false }); const k = Math.max(1, Math.min(+opts.k || 2, p)); out.params.k = k; out.params.varExplained = pc.pct.slice(0, k).reduce((a, b) => a + b, 0); D = pairwise(n, (i, j) => Math.sqrt(pc.scores[i].slice(0, k).reduce((s, v, t) => s + (v - pc.scores[j][t]) ** 2, 0))); }
      else if (id === 'pearson') D = pairwise(n, (i, j) => 1 - S.pearson(X[i], X[j]));
      else if (id === 'pearson_abs') D = pairwise(n, (i, j) => 1 - Math.abs(S.pearson(X[i], X[j])));
      else if (id === 'spearman') { const R = X.map(r => S.ranks(r)); D = pairwise(n, (i, j) => 1 - S.pearson(R[i], R[j])); }
      else if (id === 'kendall') D = pairwise(n, (i, j) => 1 - kendallTau(X[i], X[j]));
      else if (id === 'cosine') { const nrm = X.map(r => Math.sqrt(sum(r.map(v => v * v)))); D = pairwise(n, (i, j) => nrm[i] && nrm[j] ? 1 - sum(X[i].map((v, t) => v * X[j][t])) / (nrm[i] * nrm[j]) : 0); }
      if (p < 3 && /pearson|spearman|kendall|cosine/.test(id)) out.warning = 'Correlation-type distances need several variables per object; with fewer than 3 they are meaningless.';
      break;
    }
    case 'binary': {
      const B = src.binary.B; n = B.length; const p = B[0].length; out.vars = src.binary.names;
      out.note = src.binary.derived ? 'Binary coding derived from the numeric variables (x > 0 → 1).' : 'Computed on the binary variables (second state coded 1).';
      const abcd = (i, j) => { let a = 0, b = 0, c2 = 0, d = 0; for (let t = 0; t < p; t++) { const x = B[i][t], y = B[j][t]; if (x && y) a++; else if (x && !y) b++; else if (!x && y) c2++; else d++; } return [a, b, c2, d]; };
      const f = {
        jaccard: (a, b, c2) => a + b + c2 ? 1 - a / (a + b + c2) : 0,
        dice: (a, b, c2) => 2 * a + b + c2 ? 1 - 2 * a / (2 * a + b + c2) : 0,
        sm: (a, b, c2, d) => (b + c2) / (a + b + c2 + d),
        rogers: (a, b, c2, d) => a + d + 2 * (b + c2) ? 2 * (b + c2) / (a + d + 2 * (b + c2)) : 0,
        sokal: (a, b, c2) => a + 2 * (b + c2) ? 2 * (b + c2) / (a + 2 * (b + c2)) : 0,
        russell: (a, b, c2, d) => 1 - a / (a + b + c2 + d),
        ochiai: (a, b, c2) => (a + b) && (a + c2) ? 1 - a / Math.sqrt((a + b) * (a + c2)) : 1,
        kulczynski: (a, b, c2) => (a + b) && (a + c2) ? 1 - 0.5 * (a / (a + b) + a / (a + c2)) : 1,
        hamming: (a, b, c2) => b + c2,
        yule: (a, b, c2, d) => (a * d + b * c2) ? (1 - (a * d - b * c2) / (a * d + b * c2)) / 2 : 0.5,
      }[id];
      D = pairwise(n, (i, j) => f(...abcd(i, j)));
      break;
    }
    case 'nominal': {
      n = src.labels.length;
      const parts = [];   /* each part: (i,j) → [sumDissim, count] */
      if ((id === 'sm_nominal' || id === 'gower_cat') && src.nominal) { const C = src.nominal.C; parts.push((i, j) => { let s = 0; for (let t = 0; t < C[0].length; t++) if (C[i][t] !== C[j][t]) s++; return [s, C[0].length]; }); }
      if ((id === 'sm_nominal' || id === 'gower_cat') && src.binary && !src.binary.derived) { const B = src.binary.B; parts.push((i, j) => { let s = 0, m = 0; for (let t = 0; t < B[0].length; t++) { if (id === 'gower_cat' && !B[i][t] && !B[j][t]) continue; m++; if (B[i][t] !== B[j][t]) s++; } return [s, m]; }); }
      if ((id === 'ordinal_manhattan' || id === 'gower_cat') && src.ordinal) { const R = src.ordinal.R; const rng_ = R[0].map((_, t) => Math.max(1, S.max(R.map(r => r[t])) - S.min(R.map(r => r[t])))); parts.push((i, j) => { let s = 0; for (let t = 0; t < R[0].length; t++) s += Math.abs(R[i][t] - R[j][t]) / rng_[t]; return [s, R[0].length]; }); }
      if (!parts.length) throw new Error('No variables of the required type (nominal, ordinal or binary) are active.');
      out.vars = [].concat(src.nominal && id !== 'ordinal_manhattan' ? src.nominal.names : [], src.binary && !src.binary.derived && id !== 'ordinal_manhattan' ? src.binary.names : [], src.ordinal && id !== 'sm_nominal' ? src.ordinal.names : []);
      D = pairwise(n, (i, j) => { let s = 0, m = 0; parts.forEach(f => { const [a, b] = f(i, j); s += a; m += b; }); return m ? s / m : 0; });
      out.note = 'Computed on the categorical variables; quantitative variables are ignored by this coefficient.';
      break;
    }
    case 'ecological': {
      const X = src.counts.X; n = X.length; const p = X[0].length; out.vars = src.counts.names;
      out.note = src.counts.fromCounts ? 'Computed on the raw counts / abundances.' : 'Computed on the raw non-negative numeric variables (no count columns were declared).';
      const tot = X.map(r => sum(r));
      if (id === 'bray') D = pairwise(n, (i, j) => { let num = 0, den = 0; for (let t = 0; t < p; t++) { num += Math.abs(X[i][t] - X[j][t]); den += X[i][t] + X[j][t]; } return den ? num / den : 0; });
      else if (id === 'ruzicka') D = pairwise(n, (i, j) => { let mn = 0, mx = 0; for (let t = 0; t < p; t++) { mn += Math.min(X[i][t], X[j][t]); mx += Math.max(X[i][t], X[j][t]); } return mx ? 1 - mn / mx : 0; });
      else if (id === 'kulczynski_q') D = pairwise(n, (i, j) => { let mn = 0; for (let t = 0; t < p; t++) mn += Math.min(X[i][t], X[j][t]); return tot[i] && tot[j] ? 1 - 0.5 * (mn / tot[i] + mn / tot[j]) : 1; });
      else if (id === 'morisita') { const sq = X.map(r => sum(r.map(v => v * v))); D = pairwise(n, (i, j) => { let xy = 0; for (let t = 0; t < p; t++) xy += X[i][t] * X[j][t]; const den = (sq[i] / (tot[i] * tot[i]) + sq[j] / (tot[j] * tot[j])) * tot[i] * tot[j]; return den ? 1 - 2 * xy / den : 1; }); }
      else if (id === 'hellinger') { const H = X.map((r, i) => r.map(v => tot[i] ? Math.sqrt(v / tot[i]) : 0)); D = pairwise(n, (i, j) => Math.sqrt(KM.sqd(H[i], H[j]))); }
      else if (id === 'chord') { const Nn = X.map(r => { const nr = Math.sqrt(sum(r.map(v => v * v))); return r.map(v => nr ? v / nr : 0); }); D = pairwise(n, (i, j) => Math.sqrt(KM.sqd(Nn[i], Nn[j]))); }
      else if (id === 'chisq') { const colSum = X[0].map((_, t) => sum(X.map(r => r[t]))), grand = sum(colSum); D = pairwise(n, (i, j) => { let s = 0; for (let t = 0; t < p; t++) if (colSum[t] > 0) s += ((tot[i] ? X[i][t] / tot[i] : 0) - (tot[j] ? X[j][t] / tot[j] : 0)) ** 2 / colSum[t]; return Math.sqrt(grand * s); }); }
      else if (id === 'canberra_eco') D = pairwise(n, (i, j) => { let s = 0; for (let t = 0; t < p; t++) { const den = X[i][t] + X[j][t]; if (den > 0) s += Math.abs(X[i][t] - X[j][t]) / den; } return s; });
      else if (id === 'jaccard_pa') D = pairwise(n, (i, j) => { let a = 0, bc = 0; for (let t = 0; t < p; t++) { const x = X[i][t] > 0, y = X[j][t] > 0; if (x && y) a++; else if (x || y) bc++; } return a + bc ? bc / (a + bc) : 0; });
      break;
    }
    case 'mixed': {
      n = src.labels.length;
      if (id === 'euclid_dummy') { const X = src.working.X; D = pairwise(n, (i, j) => Math.sqrt(KM.sqd(X[i], X[j]))); out.vars = src.working.names; out.note = 'Euclidean distance on the full working matrix (scaled numeric columns + dummy columns).'; break; }
      const W = opts.gowerWeights || {}; const wOf = nm => W[nm] == null ? 1 : +W[nm];
      const asym = opts.gowerBinary !== 'sym'; out.params.binary = asym ? 'asymmetric' : 'symmetric';
      const parts = [], used = [];
      if (src.quantRaw.names.length) { const X = src.quantRaw.X; const rg = X[0].map((_, t) => Math.max(1e-12, S.max(X.map(r => r[t])) - S.min(X.map(r => r[t])))); const w = src.quantRaw.names.map(wOf); used.push(...src.quantRaw.names); parts.push((i, j) => { let s = 0, m = 0; for (let t = 0; t < X[0].length; t++) { s += w[t] * Math.abs(X[i][t] - X[j][t]) / rg[t]; m += w[t]; } return [s, m]; }); }
      if (src.binary && !src.binary.derived) { const B = src.binary.B; const w = src.binary.names.map(wOf); used.push(...src.binary.names); parts.push((i, j) => { let s = 0, m = 0; for (let t = 0; t < B[0].length; t++) { if (asym && !B[i][t] && !B[j][t]) continue; m += w[t]; if (B[i][t] !== B[j][t]) s += w[t]; } return [s, m]; }); }
      if (src.nominal) { const C = src.nominal.C; const w = src.nominal.names.map(wOf); used.push(...src.nominal.names); parts.push((i, j) => { let s = 0, m = 0; for (let t = 0; t < C[0].length; t++) { m += w[t]; if (C[i][t] !== C[j][t]) s += w[t]; } return [s, m]; }); }
      out.vars = used;
      D = pairwise(n, (i, j) => { let s = 0, m = 0; parts.forEach(f => { const [a, b] = f(i, j); s += a; m += b; }); return m ? s / m : 0; });
      out.note = `Gower distance over ${used.length} variables (quantitative and ordinal range-scaled, nominal by matching, binary ${asym ? 'asymmetric' : 'symmetric'}).`;
      break;
    }
    case 'given': {
      const G = src.given.D; n = G.length;
      D = G.map(r => r.map(v => id === 'given_sqrt' ? Math.sqrt(v) : id === 'given_sq' ? v * v : v));
      out.note = 'Your supplied matrix' + (id === 'given' ? '.' : id === 'given_sqrt' ? ', square-rooted.' : ', squared.');
      break;
    }
  }
  out.D = D; out.n = n; out.labels = src.labels;
  return out;
};

/* ---------------- diagnostics ---------------- */
Dist.diagnose = D => {
  const n = D.length, vals = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) vals.push(D[i][j]);
  const zeros = vals.filter(v => v === 0).length;
  const dup = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (D[i][j] === 0) dup.push([i, j]);
  /* metric check: triangle inequality on all triples (n ≤ 120) or a sample */
  let viol = 0, tested = 0;
  const r = rng(99);
  const tri = (i, j, k) => { tested++; if (D[i][j] > D[i][k] + D[k][j] + 1e-9) viol++; };
  if (n <= 120) { for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = 0; k < n; k++) if (k !== i && k !== j) tri(i, j, k); }
  else for (let t = 0; t < 200000; t++) { const i = Math.floor(r() * n), j = Math.floor(r() * n), k = Math.floor(r() * n); if (i !== j && k !== i && k !== j) tri(i, j, k); }
  /* Euclidean embeddability: negative eigenvalues of the double-centred matrix */
  let euclid = null;
  if (n <= 400) {
    const m = S.cmdscale(D, 2); const pos = m.eig.filter(v => v > 1e-9), neg = m.eig.filter(v => v < -1e-9);
    const negMass = sum(neg.map(Math.abs)) / (sum(pos) + sum(neg.map(Math.abs)) || 1);
    euclid = { negMass, maxNeg: neg.length ? Math.min(...neg) : 0, nNeg: neg.length, pct2: m.pct, mds: m };
  }
  const nn = D.map((row, i) => row.map((d, j) => [d, j]).filter(x => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 3));
  return { n, min: S.min(vals), max: S.max(vals), mean: S.mean(vals), median: S.median(vals), sd: S.sd(vals), zeros, dup, viol, tested, euclid, nn, values: vals };
};

/* correlation between the upper triangles of several matrices */
Dist.compare = mats => {
  const k = mats.length, vecs = mats.map(M => { const v = []; for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) v.push(M[i][j]); return v; });
  const R = Array.from({ length: k }, () => new Array(k).fill(1)), Rs = Array.from({ length: k }, () => new Array(k).fill(1));
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) { R[a][b] = R[b][a] = S.pearson(vecs[a], vecs[b]); Rs[a][b] = Rs[b][a] = S.spearman(vecs[a], vecs[b]); }
  return { R, Rs };
};

window.Dist = Dist;
