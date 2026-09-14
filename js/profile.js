/* ClusteringPro — Block 7 engine: cluster profiles and interpretation, indicator species,
   linear discriminant analysis, classification tree rules and assignment of new observations. */

const PR = {};
const sumV = a => a.reduce((s, v) => s + v, 0);

/* ---------- one-way ANOVA and Kruskal–Wallis ---------- */
PR.anova = (groups) => {
  const g = groups.filter(a => a.length > 0), k = g.length, all = g.flat(), n = all.length;
  if (k < 2 || n <= k) return { F: NaN, p: NaN, eta2: NaN, df1: k - 1, df2: n - k };
  const gm = S.mean(all); let ssb = 0, ssw = 0;
  g.forEach(a => { const m = S.mean(a); ssb += a.length * (m - gm) ** 2; a.forEach(v => ssw += (v - m) ** 2); });
  const F = ssw > 0 ? (ssb / (k - 1)) / (ssw / (n - k)) : (ssb > 0 ? Infinity : NaN);
  return { F, p: isFinite(F) ? 1 - S.pf(F, k - 1, n - k) : (ssb > 0 ? 0 : NaN), eta2: ssb + ssw > 0 ? ssb / (ssb + ssw) : NaN, df1: k - 1, df2: n - k };
};
PR.kruskal = (groups) => {
  const g = groups.filter(a => a.length > 0), k = g.length, all = g.flat(), n = all.length;
  if (k < 2) return { H: NaN, p: NaN };
  const r = S.ranks(all); let idx = 0, H = 0;
  g.forEach(a => { const rs = r.slice(idx, idx + a.length); idx += a.length; H += sumV(rs) ** 2 / a.length; });
  H = 12 / (n * (n + 1)) * H - 3 * (n + 1);
  const cnt = new Map(); all.forEach(v => cnt.set(v, (cnt.get(v) || 0) + 1)); let T = 0; cnt.forEach(t => { T += t ** 3 - t; });
  const C = 1 - T / (n ** 3 - n); if (C > 0) H /= C;
  return { H, p: 1 - S.pchisq(H, k - 1) };
};

/* ---------- quantitative profiles with test values ---------- */
PR.quantProfiles = (X, names, cl, k) => {
  const N = X.length;
  return names.map((name, j) => {
    const col = X.map(r => r[j]), m = S.mean(col), sd = S.sd(col), v2 = S.variance(col) * (N - 1) / N; /* the test value uses the variance with denominator N */
    const groups = Array.from({ length: k }, (_, c) => col.filter((_, i) => cl[i] === c + 1));
    const clusters = groups.map((a, c) => { const nc = a.length, mc = nc ? S.mean(a) : NaN; const se = nc && v2 > 0 && N > 1 ? Math.sqrt(v2 / nc * (N - nc) / (N - 1)) : NaN; const v = isFinite(se) && se > 0 ? (mc - m) / se : (isFinite(mc) && mc !== m ? Infinity * Math.sign(mc - m) : 0); return { cluster: c + 1, n: nc, mean: mc, sd: nc > 1 ? S.sd(a) : NaN, se: nc > 1 ? S.sd(a) / Math.sqrt(nc) : NaN, median: nc ? S.median(a) : NaN, min: nc ? S.min(a) : NaN, max: nc ? S.max(a) : NaN, vtest: v, p: isFinite(v) ? 2 * (1 - S.pnorm(Math.abs(v))) : 0, z: sd > 0 ? (mc - m) / sd : 0 }; });
    return Object.assign({ name, mean: m, sd, groups }, PR.anova(groups), { kw: PR.kruskal(groups), clusters });
  });
};
/* ---------- categorical profiles: over/under-represented categories ---------- */
PR.catProfiles = (C, names, cl, k) => {
  const N = C.length;
  return names.map((name, j) => {
    const col = C.map(r => r[j]), levels = [...new Set(col)].sort();
    const nc = Array.from({ length: k }, (_, c) => cl.filter(x => x === c + 1).length);
    const M = levels.map(l => Array.from({ length: k }, (_, c) => col.filter((v, i) => v === l && cl[i] === c + 1).length));
    const rows = levels.map((l, li) => { const tot = sumV(M[li]), p = tot / N; return { level: l, total: tot, clusters: M[li].map((cnt, c) => { const pc = nc[c] ? cnt / nc[c] : 0; const se = nc[c] && p > 0 && p < 1 ? Math.sqrt(p * (1 - p) / nc[c] * (N - nc[c]) / (N - 1)) : NaN; const v = isFinite(se) && se > 0 ? (pc - p) / se : 0; return { cluster: c + 1, count: cnt, propInCluster: pc, propOfLevel: tot ? cnt / tot : 0, vtest: v, p: 2 * (1 - S.pnorm(Math.abs(v))) }; }) }; });
    let chi = 0; levels.forEach((l, li) => { for (let c = 0; c < k; c++) { const e = sumV(M[li]) * nc[c] / N; if (e > 0) chi += (M[li][c] - e) ** 2 / e; } });
    const df = (levels.length - 1) * (k - 1);
    return { name, levels, counts: M, nc, chi, df, p: df > 0 ? 1 - S.pchisq(chi, df) : 1, cramer: df > 0 ? Math.sqrt(chi / (N * Math.min(levels.length - 1, k - 1))) : 0, rows };
  });
};

/* ---------- indicator value (Dufrêne & Legendre) with permutations ---------- */
PR.indval = (X, names, cl, k, nperm, seed) => {
  const N = X.length, r = rng(seed || 5);
  const compute = labels => names.map((_, j) => {
    const col = X.map(row => row[j]);
    const means = [], pres = [];
    for (let c = 1; c <= k; c++) { const idx = labels.map((l, i) => l === c ? i : -1).filter(i => i >= 0); means.push(idx.length ? S.mean(idx.map(i => col[i])) : 0); pres.push(idx.length ? idx.filter(i => col[i] > 0).length / idx.length : 0); }
    const tot = sumV(means);
    const iv = means.map((m, c) => tot > 0 ? (m / tot) * pres[c] : 0);
    const best = iv.indexOf(Math.max(...iv));
    return { iv, best, max: iv[best], A: tot > 0 ? means[best] / tot : 0, B: pres[best] };
  });
  const obs = compute(cl);
  const ge = names.map(() => 0);
  for (let p = 0; p < nperm; p++) { const perm = cl.slice(); for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } const pm = compute(perm); pm.forEach((o, j) => { if (o.max >= obs[j].max - 1e-12) ge[j]++; }); }
  return names.map((name, j) => Object.assign({ name, p: (ge[j] + 1) / (nperm + 1), nperm }, obs[j]));
};

/* ---------- linear discriminant analysis ---------- */
function symInvSqrt(W, ridge) {
  const e = S.eigenSym(W), p = W.length, lam = e.values.map(v => Math.max(v, 0) + ridge);
  const build = f => { const M = Array.from({ length: p }, () => new Array(p).fill(0)); for (let t = 0; t < p; t++) { const w = f(lam[t]), v = e.vectors[t]; for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) M[a][b] += w * v[a] * v[b]; } return M; };
  return { invSqrt: build(l => 1 / Math.sqrt(l)), inv: build(l => 1 / l) };
}
const matVec = (M, v) => M.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
const matMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, x, t) => s + x * B[t][j], 0)));
PR.ldaFit = (X, cl, k, o) => {
  o = o || {};
  const n = X.length, p = X[0].length;
  const idx = Array.from({ length: k }, (_, c) => cl.map((x, i) => x === c + 1 ? i : -1).filter(i => i >= 0));
  const ng = idx.map(a => a.length), gm = PT.centroidOf(X);
  const means = idx.map(a => a.length ? PT.centroidOf(a.map(i => X[i])) : gm.slice());
  const W = Array.from({ length: p }, () => new Array(p).fill(0)), B = Array.from({ length: p }, () => new Array(p).fill(0));
  idx.forEach((a, c) => { a.forEach(i => { for (let s = 0; s < p; s++) { const ds = X[i][s] - means[c][s]; for (let t = 0; t < p; t++) W[s][t] += ds * (X[i][t] - means[c][t]); } }); for (let s = 0; s < p; s++) for (let t = 0; t < p; t++) B[s][t] += ng[c] * (means[c][s] - gm[s]) * (means[c][t] - gm[t]); });
  for (let s = 0; s < p; s++) for (let t = 0; t < p; t++) { W[s][t] /= Math.max(n - k, 1); B[s][t] /= Math.max(k - 1, 1); }
  const trW = W.reduce((s, r, i) => s + r[i], 0) / p, ridge = (o.ridge == null ? 1e-4 : o.ridge) * (trW || 1);
  const { invSqrt, inv } = symInvSqrt(W, ridge);
  const M = matMul(matMul(invSqrt, B), invSqrt);
  const e = S.eigenSym(M), q = Math.min(k - 1, p);
  const axes = e.vectors.slice(0, q).map(v => matVec(invSqrt, v));
  const lam = e.values.slice(0, q).map(v => Math.max(v, 0));
  const pct = lam.map(v => v / (sumV(lam) || 1));
  const wilks = lam.reduce((s, v) => s / (1 + v), 1);
  const chi = -(n - 1 - (p + k) / 2) * Math.log(Math.max(wilks, 1e-300)), df = p * (k - 1);
  const priors = o.equalPriors ? ng.map(() => 1 / k) : ng.map(v => v / n);
  const model = { p, k, n, ng, means, gm, W, Winv: inv, axes, lam, pct, wilks, chi, df, pWilks: 1 - S.pchisq(chi, df), priors };
  model.scores = X.map(x => axes.map(a => a.reduce((s, v, j) => s + v * (x[j] - gm[j]), 0)));
  model.centersLD = means.map(m => axes.map(a => a.reduce((s, v, j) => s + v * (m[j] - gm[j]), 0)));
  /* standardised coefficients (× pooled within SD) and structure correlations */
  const wsd = W.map((r, i) => Math.sqrt(Math.max(r[i], 0)));
  model.stdCoef = axes.map(a => a.map((v, j) => v * wsd[j]));
  model.structure = axes.map((a, t) => X[0].map((_, j) => { const col = X.map(r => r[j]), sc = model.scores.map(s => s[t]); return S.sd(col) > 0 && S.sd(sc) > 0 ? S.pearson(col, sc) : 0; }));
  return model;
};
PR.ldaPredict = (model, x) => {
  const d = model.means.map((m, c) => { const wm = matVec(model.Winv, m); return x.reduce((s, v, j) => s + v * wm[j], 0) - 0.5 * m.reduce((s, v, j) => s + v * wm[j], 0) + Math.log(model.priors[c] + 1e-300); });
  const mx = Math.max(...d), w = d.map(v => Math.exp(v - mx)), sw = sumV(w);
  const post = w.map(v => v / sw);
  const cls = post.indexOf(Math.max(...post)) + 1;
  const ld = model.axes.map(a => a.reduce((s, v, j) => s + v * (x[j] - model.gm[j]), 0));
  return { cluster: cls, posterior: post, ld };
};
PR.ldaValidate = (X, cl, k, o) => {
  const model = PR.ldaFit(X, cl, k, o), n = X.length;
  const pred = X.map(x => PR.ldaPredict(model, x).cluster);
  const M = Array.from({ length: k }, () => new Array(k).fill(0)); cl.forEach((c, i) => M[c - 1][pred[i] - 1]++);
  const acc = M.reduce((s, r, i) => s + r[i], 0) / n;
  let loo = 0; const looPred = new Array(n);
  if (n <= 600) { for (let i = 0; i < n; i++) { const Xi = X.filter((_, t) => t !== i), ci = cl.filter((_, t) => t !== i); if (new Set(ci).size < k) { looPred[i] = pred[i]; continue; } const m = PR.ldaFit(Xi, ci, k, o); looPred[i] = PR.ldaPredict(m, X[i]).cluster; if (looPred[i] === cl[i]) loo++; } }
  const Mloo = Array.from({ length: k }, () => new Array(k).fill(0)); if (n <= 600) cl.forEach((c, i) => Mloo[c - 1][looPred[i] - 1]++);
  return Object.assign(model, { pred, confusion: M, accuracy: acc, loo: n <= 600 ? loo / n : NaN, looPred, confusionLoo: Mloo });
};

/* ---------- classification tree (Gini impurity) ---------- */
PR.tree = (X, names, cl, k, o) => {
  o = o || {}; const maxDepth = o.maxDepth || 3, minLeaf = o.minLeaf || 3;
  const gini = idx => { const cnt = new Array(k).fill(0); idx.forEach(i => cnt[cl[i] - 1]++); return 1 - cnt.reduce((s, c) => s + (c / idx.length) ** 2, 0); };
  const counts = idx => { const cnt = new Array(k).fill(0); idx.forEach(i => cnt[cl[i] - 1]++); return cnt; };
  const build = (idx, depth) => {
    const cnt = counts(idx), pred = cnt.indexOf(Math.max(...cnt)) + 1, node = { n: idx.length, counts: cnt, pred, purity: Math.max(...cnt) / idx.length, gini: gini(idx), depth };
    if (depth >= maxDepth || idx.length < 2 * minLeaf || node.purity === 1) return node;
    let best = null;
    names.forEach((nm, j) => {
      const vals = [...new Set(idx.map(i => X[i][j]))].sort((a, b) => a - b);
      for (let t = 0; t < vals.length - 1; t++) {
        const thr = (vals[t] + vals[t + 1]) / 2, L = idx.filter(i => X[i][j] <= thr), R = idx.filter(i => X[i][j] > thr);
        if (L.length < minLeaf || R.length < minLeaf) continue;
        const g = (L.length * gini(L) + R.length * gini(R)) / idx.length;
        if (!best || g < best.g - 1e-12) best = { j, thr, g, L, R };
      }
    });
    if (!best || node.gini - best.g < 1e-6) return node;
    node.var = names[best.j]; node.j = best.j; node.thr = best.thr; node.gain = node.gini - best.g;
    node.left = build(best.L, depth + 1); node.right = build(best.R, depth + 1);
    return node;
  };
  const root = build(X.map((_, i) => i), 0);
  const rules = [];
  const walk = (nd, path) => { if (!nd.left) { rules.push({ conditions: path.slice(), cluster: nd.pred, n: nd.n, purity: nd.purity, counts: nd.counts }); return; } walk(nd.left, path.concat([`${nd.var} ≤ ${fmtNum(nd.thr, 3)}`])); walk(nd.right, path.concat([`${nd.var} > ${fmtNum(nd.thr, 3)}`])); };
  walk(root, []);
  const predict = x => { let nd = root; while (nd.left) nd = x[nd.j] <= nd.thr ? nd.left : nd.right; return nd.pred; };
  const acc = X.reduce((s, x, i) => s + (predict(x) === cl[i] ? 1 : 0), 0) / X.length;
  return { root, rules, accuracy: acc, predict, depth: maxDepth };
};

/* ---------- nearest-centroid assignment in standardised space ---------- */
PR.centroidModel = (X, cl, k) => { const m = S.colMeans(X), sd = S.colSds(X).map(v => v || 1); const Z = X.map(r => r.map((v, j) => (v - m[j]) / sd[j])); return { m, sd, centers: Array.from({ length: k }, (_, c) => PT.centroidOf(Z.filter((_, i) => cl[i] === c + 1).length ? Z.filter((_, i) => cl[i] === c + 1) : [new Array(X[0].length).fill(0)])) }; };
PR.centroidPredict = (cm, x) => { const z = x.map((v, j) => (v - cm.m[j]) / cm.sd[j]); const d = cm.centers.map(c => Math.sqrt(KM.sqd(z, c))); const bi = d.indexOf(Math.min(...d)); return { cluster: bi + 1, distance: d[bi], distances: d }; };

window.PR = PR;
