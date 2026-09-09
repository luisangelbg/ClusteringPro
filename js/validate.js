/* ClusteringPro — Block 6 engine: optimal number of clusters, internal validation, stability,
   multiscale bootstrap for trees, external validation and comparison of algorithms. */

const VAL = {};
const sumA = a => a.reduce((s, v) => s + v, 0);

/* ---------- partition generators used for the k sweep ---------- */
VAL.generator = (kind, D, X, hcMethod) => {
  let tree = null;
  if (kind === 'hier') tree = state.hclust && state.hclust.hc.n === D.length ? state.hclust.hc : HC.agglomerate(D, hcMethod || 'ward.D2');
  return {
    kind, tree,
    run: (k, Dsub, Xsub) => {
      if (kind === 'kmeans') return PT.kmeans(Xsub || X, k, { nstart: 5, seed: 1 }).cluster;
      if (kind === 'pam') return PT.pam(Dsub || D, k).cluster;
      const t = Dsub ? HC.agglomerate(Dsub, (state.hclust && state.hclust.method) || hcMethod || 'ward.D2', { beta: state.hclust ? state.hclust.beta : undefined }) : tree;
      return HC.cutree(t, k);
    },
  };
};

/* ---------- internal indices for one partition ---------- */
VAL.centroids = (X, cl, k) => Array.from({ length: k }, (_, c) => { const m = X.filter((_, i) => cl[i] === c + 1); return m.length ? PT.centroidOf(m) : null; });
VAL.indices = (X, D, cl, o) => {
  o = o || {};
  const n = cl.length, ids = [...new Set(cl)].sort((a, b) => a - b), k = ids.length, p = X[0].length;
  const cen = VAL.centroids(X, cl, k), grand = PT.centroidOf(X);
  const ss = PT.ss(X, cl), wss = ss.wss, bss = ss.bss, tss = ss.tss;
  const out = { k, wss, bss, tss };
  const sil = PT.silhouette(D, cl); out.silhouette = sil.avg;
  out.ch = k > 1 && n > k ? (bss / (k - 1)) / (wss / (n - k)) : NaN;
  /* Davies–Bouldin */
  if (k > 1) { const s = cen.map((c, j) => { const m = X.filter((_, i) => cl[i] === j + 1); return m.length ? S.mean(m.map(x => Math.sqrt(KM.sqd(x, c)))) : 0; }); let db = 0; for (let i = 0; i < k; i++) { let mx = 0; for (let j = 0; j < k; j++) if (i !== j) { const d = Math.sqrt(KM.sqd(cen[i], cen[j])) || 1e-12; mx = Math.max(mx, (s[i] + s[j]) / d); } db += mx; } out.db = db / k; } else out.db = NaN;
  /* Dunn, C-index, McClain–Rao on D */
  let minBetween = Infinity, maxDiam = 0, Sw = 0, Nw = 0, Sb = 0, Nb = 0; const within = [], all = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = D[i][j]; all.push(d); if (cl[i] === cl[j]) { Sw += d; Nw++; within.push(d); if (d > maxDiam) maxDiam = d; } else { Sb += d; Nb++; if (d < minBetween) minBetween = d; } }
  out.dunn = k > 1 && maxDiam > 0 ? minBetween / maxDiam : NaN;
  if (k > 1 && Nw > 0) { all.sort((a, b) => a - b); const smin = sumA(all.slice(0, Nw)), smax = sumA(all.slice(all.length - Nw)); out.cindex = smax > smin ? (Sw - smin) / (smax - smin) : 0; out.mcclain = Nb ? (Sw / Nw) / (Sb / Nb) : NaN; } else { out.cindex = NaN; out.mcclain = NaN; }
  /* PBM */
  const E1 = sumA(X.map(x => Math.sqrt(KM.sqd(x, grand)))), Ek = sumA(X.map((x, i) => Math.sqrt(KM.sqd(x, cen[cl[i] - 1]))));
  let Dk = 0; for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) Dk = Math.max(Dk, Math.sqrt(KM.sqd(cen[i], cen[j])));
  out.pbm = k > 1 && Ek > 0 ? Math.pow(E1 / Ek * Dk / k, 2) : NaN;
  /* Ratkowsky–Lance */
  if (k > 1) { let cbar = 0; for (let j = 0; j < p; j++) { const col = X.map(r => r[j]), gm = S.mean(col); let bgss = 0, tssj = 0; for (let c = 0; c < k; c++) { const m = col.filter((_, i) => cl[i] === c + 1); if (m.length) bgss += m.length * (S.mean(m) - gm) ** 2; } col.forEach(v => tssj += (v - gm) ** 2); cbar += tssj > 0 ? Math.sqrt(bgss / tssj) : 0; } out.rl = cbar / p / Math.sqrt(k); } else out.rl = NaN;
  out.ballhall = wss / k;
  /* connectivity (clValid) with L neighbours */
  const L = Math.min(o.L || 10, n - 1); let conn = 0;
  for (let i = 0; i < n; i++) { const nb = D[i].map((d, j) => [d, j]).filter(x => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, L); nb.forEach((x, r) => { if (cl[x[1]] !== cl[i]) conn += 1 / (r + 1); }); }
  out.connectivity = conn;
  return out;
};

/* ---------- gap statistic (Tibshirani et al.) ---------- */
VAL.gap = (X, ks, gen, B, seed) => {
  const n = X.length, p = X[0].length, r = rng(seed || 2026);
  const lo = X[0].map((_, j) => S.min(X.map(q => q[j]))), hi = X[0].map((_, j) => S.max(X.map(q => q[j])));
  const logW = ks.map(k => Math.log(k === 1 ? KM.tss(X) : PT.ss(X, gen.run(k)).wss));
  const ref = ks.map(() => []);
  for (let b = 0; b < B; b++) {
    const U = Array.from({ length: n }, () => lo.map((l, j) => l + r() * (hi[j] - l)));
    const Du = gen.kind === 'kmeans' || n > 150 ? null : HC.dist(U);
    ks.forEach((k, i) => { const cl = k === 1 ? U.map(() => 1) : (gen.kind === 'kmeans' || n > 150 ? PT.kmeans(U, k, { nstart: 2, seed: b + 1 }).cluster : gen.kind === 'pam' ? PT.pam(Du, k).cluster : HC.cutree(HC.agglomerate(Du, (state.hclust && state.hclust.method) || 'ward.D2'), k)); ref[i].push(Math.log(k === 1 ? KM.tss(U) : PT.ss(U, cl).wss)); });
  }
  const ElogW = ref.map(a => S.mean(a)), sk = ref.map(a => Math.sqrt(S.mean(a.map(v => (v - S.mean(a)) ** 2))) * Math.sqrt(1 + 1 / B));
  const gap = ks.map((k, i) => ElogW[i] - logW[i]);
  /* firstSEmax: smallest k such that gap(k) ≥ gap(k+1) − s(k+1) */
  let best = ks[ks.length - 1];
  for (let i = 0; i < ks.length - 1; i++) if (gap[i] >= gap[i + 1] - sk[i + 1]) { best = ks[i]; break; }
  const globalMax = ks[gap.indexOf(Math.max(...gap))];
  return { ks, logW, ElogW, gap, sk, best, globalMax, B };
};

/* ---------- sweep over k with all indices and the consensus ---------- */
VAL.sweep = (X, D, ks, gen, o) => {
  o = o || {};
  const n = X.length, p = X[0].length, rows = [];
  const tss = KM.tss(X);
  ks.forEach(k => { const cl = gen.run(k); rows.push(Object.assign({ cl }, VAL.indices(X, D, cl))); });
  const wssOf = k => k === 1 ? tss : (rows.find(r => r.k === k) || {}).wss;
  /* indices needing neighbours */
  rows.forEach((r, i) => {
    const k = r.k, wk = r.wss, wk1 = wssOf(k + 1), wkm = wssOf(k - 1);
    r.hartigan = wk1 != null && wk1 > 0 ? (wk / wk1 - 1) * (n - k - 1) : NaN;
    r.bhDiff = wkm != null ? wkm / (k - 1 || 1) - wk / k : NaN;
    const diff = q => { const a = wssOf(q - 1), b = wssOf(q); return a != null && b != null ? Math.pow(q - 1, 2 / p) * a - Math.pow(q, 2 / p) * b : NaN; };
    const d1 = diff(k), d2 = diff(k + 1); r.kl = isFinite(d1) && isFinite(d2) && d2 !== 0 ? Math.abs(d1 / d2) : NaN;
  });
  const gap = o.gapB > 0 ? VAL.gap(X, ks, gen, o.gapB, o.seed) : null;
  if (gap) rows.forEach((r, i) => { r.gap = gap.gap[i]; r.gapSE = gap.sk[i]; });
  /* each index votes for one k */
  const pick = (key, dir) => { const vals = rows.map(r => r[key]); const ok = vals.map((v, i) => isFinite(v) ? i : -1).filter(i => i >= 0); if (!ok.length) return null; let bi = ok[0]; ok.forEach(i => { if (dir === 'max' ? vals[i] > vals[bi] : vals[i] < vals[bi]) bi = i; }); return rows[bi].k; };
  const votes = {
    silhouette: { k: pick('silhouette', 'max'), rule: 'maximum', label: 'Silhouette' },
    ch: { k: pick('ch', 'max'), rule: 'maximum', label: 'Calinski–Harabasz' },
    db: { k: pick('db', 'min'), rule: 'minimum', label: 'Davies–Bouldin' },
    dunn: { k: pick('dunn', 'max'), rule: 'maximum', label: 'Dunn' },
    cindex: { k: pick('cindex', 'min'), rule: 'minimum', label: 'C-index' },
    mcclain: { k: pick('mcclain', 'min'), rule: 'minimum', label: 'McClain–Rao' },
    pbm: { k: pick('pbm', 'max'), rule: 'maximum', label: 'PBM' },
    rl: { k: pick('rl', 'max'), rule: 'maximum', label: 'Ratkowsky–Lance' },
    bhDiff: { k: pick('bhDiff', 'max'), rule: 'largest drop of WSS/k', label: 'Ball–Hall' },
    kl: { k: pick('kl', 'max'), rule: 'maximum', label: 'Krzanowski–Lai' },
  };
  const hart = rows.find(r => isFinite(r.hartigan) && r.hartigan <= 10); votes.hartigan = { k: hart ? hart.k : pick('hartigan', 'min'), rule: 'first k with H ≤ 10', label: 'Hartigan' };
  if (gap) votes.gap = { k: gap.best, rule: 'first k within 1 SE of the next (Tibshirani)', label: 'Gap statistic' };
  /* elbow: max distance to the line joining the ends of the WSS curve */
  const w = rows.map(r => r.wss), kk = rows.map(r => r.k); { const x0 = kk[0], y0 = w[0], x1 = kk[kk.length - 1], y1 = w[w.length - 1]; const len = Math.hypot(x1 - x0, y1 - y0) || 1; let bi = 0, bd = -1; kk.forEach((k, i) => { const d = Math.abs((y1 - y0) * k - (x1 - x0) * w[i] + x1 * y0 - y1 * x0) / len; if (d > bd) { bd = d; bi = i; } }); votes.elbow = { k: kk[bi], rule: 'knee of the WSS curve', label: 'Elbow (WSS)' }; }
  const tally = {}; Object.values(votes).forEach(v => { if (v.k != null) tally[v.k] = (tally[v.k] || 0) + 1; });
  const consensus = Object.entries(tally).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([k, c]) => ({ k: +k, votes: c }));
  return { ks, rows, votes, tally, consensus, gap, n, p, generator: gen.kind };
};

/* ---------- bootstrap stability of a partition (clusterboot) ---------- */
VAL.stability = (D, X, cl, gen, B, seed) => {
  const n = cl.length, k = Math.max(...cl), r = rng(seed || 77), jac = Array.from({ length: k }, () => []);
  for (let b = 0; b < B; b++) {
    const pick = new Set(); for (let i = 0; i < n; i++) pick.add(Math.floor(r() * n));
    const U = [...pick].sort((a, b2) => a - b2);
    if (U.length < k + 2) continue;
    const Dsub = U.map(i => U.map(j => D[i][j])), Xsub = X ? U.map(i => X[i]) : null;
    let clb; try { clb = gen.run(k, Dsub, Xsub); } catch (e) { continue; }
    const kb = Math.max(...clb);
    for (let c = 1; c <= k; c++) {
      const orig = new Set(U.filter(i => cl[i] === c)); if (!orig.size) { jac[c - 1].push(0); continue; }
      let best = 0;
      for (let cb = 1; cb <= kb; cb++) { const bs = U.filter((i, t) => clb[t] === cb); let inter = 0; bs.forEach(i => { if (orig.has(i)) inter++; }); const j = inter / (orig.size + bs.length - inter); if (j > best) best = j; }
      jac[c - 1].push(best);
    }
  }
  return { B, clusters: jac.map((a, c) => ({ cluster: c + 1, n: cl.filter(x => x === c + 1).length, mean: a.length ? S.mean(a) : NaN, min: a.length ? S.min(a) : NaN, dissolved: a.filter(v => v < 0.5).length, recovered: a.filter(v => v > 0.75).length, runs: a.length })) };
};

/* ---------- multiscale bootstrap for hierarchical clusters (pvclust AU / BP) ---------- */
VAL.pvclust = (X, method, B, scales, seed, opts) => {
  opts = opts || {};
  const n = X.length, p = X[0].length, r = rng(seed || 13);
  const D0 = HC.dist(X), h0 = HC.agglomerate(D0, method, opts);
  const mem0 = HC.members(h0);
  const key = m => m.slice().sort((a, b) => a - b).join(',');
  const keys = mem0.map(key);
  const counts = scales.map(() => new Array(n - 1).fill(0));
  scales.forEach((sc, si) => {
    const pb = Math.max(2, Math.round(sc * p));
    for (let b = 0; b < B; b++) {
      const cols = Array.from({ length: pb }, () => Math.floor(r() * p));
      const Xb = X.map(row => cols.map(j => row[j]));
      const hb = HC.agglomerate(HC.dist(Xb), method, opts);
      const set = new Set(HC.members(hb).map(key));
      keys.forEach((k, s) => { if (set.has(k)) counts[si][s]++; });
    }
  });
  const nodes = mem0.map((m, s) => {
    const bp = counts.map(c => c[s] / B);
    /* fit z(r) = v √r + c / √r  by least squares on scales with 0 < bp < 1 */
    let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sw = 0; const pts = [];
    scales.forEach((sc, si) => { let q = bp[si]; if (q <= 0) q = 0.5 / B; if (q >= 1) q = 1 - 0.5 / B; const z = S.qnorm(1 - q), sr = Math.sqrt(sc); pts.push([sr, z]); });
    /* solve for v, c: z = v*sr + c/sr → linear in (sr, 1/sr) */
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0; pts.forEach(([sr, z]) => { const u = sr, w = 1 / sr; a11 += u * u; a12 += u * w; a22 += w * w; b1 += u * z; b2 += w * z; });
    const det = a11 * a22 - a12 * a12; let v = 0, c = 0; if (Math.abs(det) > 1e-12) { v = (b1 * a22 - b2 * a12) / det; c = (a11 * b2 - a12 * b1) / det; }
    const au = 1 - S.pnorm(v - c), bpMain = bp[scales.indexOf(1)] != null ? bp[scales.indexOf(1)] : bp[Math.floor(scales.length / 2)];
    return { step: s, members: m, size: m.length, height: h0.height[s], au, bp: bpMain, bpScales: bp, v, c };
  });
  return { hc: h0, nodes, scales, B };
};

/* ---------- external validation between two labellings ---------- */
VAL.external = (a, b) => {
  const n = a.length, { la, lb, M } = HC.contingency(a, b);
  const c2 = x => x * (x - 1) / 2;
  const rowS = M.map(r => sumA(r)), colS = lb.map((_, j) => sumA(M.map(r => r[j])));
  const sumIJ = M.flat().reduce((s, v) => s + c2(v), 0), sumI = rowS.reduce((s, v) => s + c2(v), 0), sumJ = colS.reduce((s, v) => s + c2(v), 0);
  const TP = sumIJ, FP = sumI - sumIJ, FN = sumJ - sumIJ, TN = c2(n) - TP - FP - FN;
  const rand = (TP + TN) / c2(n), jaccard = TP / (TP + FP + FN || 1), fm = TP / Math.sqrt((TP + FP) * (TP + FN) || 1);
  const ari = HC.ari(a, b);
  const H = arr => -arr.filter(v => v > 0).reduce((s, v) => s + v / n * Math.log(v / n), 0);
  const Ha = H(rowS), Hb = H(colS); let I = 0; M.forEach((r, i) => r.forEach((v, j) => { if (v > 0) I += v / n * Math.log((v * n) / (rowS[i] * colS[j])); }));
  const nmi = Ha + Hb > 0 ? 2 * I / (Ha + Hb) : 1, vi = Ha + Hb - 2 * I;
  const purity = M.reduce((s, r) => s + Math.max(...r), 0) / n;
  /* chi-square */
  let chi = 0; M.forEach((r, i) => r.forEach((v, j) => { const e = rowS[i] * colS[j] / n; if (e > 0) chi += (v - e) ** 2 / e; }));
  const df = (la.length - 1) * (lb.length - 1), pval = df > 0 ? 1 - S.pchisq(chi, df) : 1;
  const cramer = df > 0 ? Math.sqrt(chi / (n * Math.min(la.length - 1, lb.length - 1))) : 0;
  return { la, lb, M, rand, ari, jaccard, fm, nmi, vi, purity, chi, df, pval, cramer, Ha, Hb, I };
};

/* ---------- comparison of algorithms over k (clValid) ---------- */
VAL.clValid = (X, D, ks, methods, hcMethod) => {
  const out = [];
  methods.forEach(m => { const gen = VAL.generator(m, D, X, hcMethod); ks.forEach(k => { const cl = gen.run(k); const ix = VAL.indices(X, D, cl); out.push({ method: m, k, connectivity: ix.connectivity, dunn: ix.dunn, silhouette: ix.silhouette }); }); });
  const best = {};
  ['connectivity', 'dunn', 'silhouette'].forEach(m => { const dir = m === 'connectivity' ? 'min' : 'max'; best[m] = out.slice().sort((a, b) => dir === 'min' ? a[m] - b[m] : b[m] - a[m])[0]; });
  return { rows: out, best };
};

window.VAL = VAL;
