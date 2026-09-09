/* ClusteringPro — Block 5 engine: partitioning, fuzzy, model-based, density-based and spectral clustering.
   Every method returns { method, k, cluster (1..k per object, 0 = noise), ... } so that the UI, the
   validation block and the report treat them alike. Coordinates come from the working matrix or from
   the PCoA axes of the chosen dissimilarity; PAM, CLARA, DBSCAN and spectral work on the matrix itself. */

const PT = {};
const sq = KM.sqd;
const sumArr = a => a.reduce((s, v) => s + v, 0);

/* ---------------- k-means ---------------- */
PT.kmeans = (X, k, o) => {
  o = o || {};
  const n = X.length, p = X[0].length, r = o.rng || rng(o.seed || 1), nstart = o.nstart || 10, maxIter = o.maxIter || 100;
  const tss = KM.tss(X);
  let best = null;
  for (let s = 0; s < nstart; s++) {
    let C = o.centers && s === 0 ? o.centers.map(c => c.slice()) : KM.init(X, k, r, o.init === 'random' ? 'random' : 'pp');
    let cluster, iter = 0, moved = true;
    if (o.algorithm === 'macqueen') {
      cluster = KM.assign(X, C).cluster; const cnt = new Array(k).fill(0); cluster.forEach(c => cnt[c]++);
      C = KM.update(X, cluster, C);
      for (iter = 0; iter < maxIter && moved; iter++) {
        moved = false;
        for (let i = 0; i < n; i++) {
          let bj = 0, bd = Infinity; for (let j = 0; j < k; j++) { const d = sq(X[i], C[j]); if (d < bd) { bd = d; bj = j; } }
          if (bj !== cluster[i]) { const a = cluster[i]; cnt[a]--; cnt[bj]++; for (let t = 0; t < p; t++) { if (cnt[a] > 0) C[a][t] += (C[a][t] - X[i][t]) / cnt[a]; C[bj][t] += (X[i][t] - C[bj][t]) / cnt[bj]; } cluster[i] = bj; moved = true; }
        }
      }
      cluster = KM.assign(X, C).cluster; C = KM.update(X, cluster, C);
    } else {
      let res = KM.assign(X, C);
      for (iter = 0; iter < maxIter; iter++) { const C2 = KM.update(X, res.cluster, C), res2 = KM.assign(X, C2); const mv = res2.cluster.some((c, i) => c !== res.cluster[i]); C = C2; res = res2; if (!mv) break; }
      cluster = res.cluster;
      if (o.algorithm !== 'lloyd') {
        /* Hartigan optimal-transfer passes: move a point when it lowers the total within-cluster SS */
        const cnt = new Array(k).fill(0); cluster.forEach(c => cnt[c]++);
        for (let pass = 0; pass < 50; pass++) {
          let moves = 0;
          for (let i = 0; i < n; i++) {
            const a = cluster[i]; if (cnt[a] <= 1) continue;
            const costA = cnt[a] / (cnt[a] - 1) * sq(X[i], C[a]);
            let bj = -1, bc = costA;
            for (let j = 0; j < k; j++) { if (j === a) continue; const c = cnt[j] / (cnt[j] + 1) * sq(X[i], C[j]); if (c < bc) { bc = c; bj = j; } }
            if (bj >= 0) { for (let t = 0; t < p; t++) { C[a][t] = (C[a][t] * cnt[a] - X[i][t]) / (cnt[a] - 1); C[bj][t] = (C[bj][t] * cnt[bj] + X[i][t]) / (cnt[bj] + 1); } cnt[a]--; cnt[bj]++; cluster[i] = bj; moves++; }
          }
          iter++;
          if (!moves) break;
        }
      }
    }
    const wssBy = new Array(k).fill(0); cluster.forEach((c, i) => wssBy[c] += sq(X[i], C[c]));
    const wss = sumArr(wssBy);
    if (!best || wss < best.wss - 1e-12) best = { cluster, centers: C, wss, wssBy, iter };
  }
  return { method: 'kmeans', k, cluster: best.cluster.map(c => c + 1), centers: best.centers, wss: best.wss, wssBy: best.wssBy, tss, bss: tss - best.wss, iter: best.iter, params: { algorithm: o.algorithm || 'hartigan', nstart, init: o.centers ? 'tree' : (o.init || 'k-means++') } };
};

/* ---------------- PAM (k-medoids) on a dissimilarity matrix ---------------- */
PT.pam = (D, k, o) => {
  o = o || {};
  const n = D.length;
  let med = [];
  if (o.medoids) med = o.medoids.slice();
  else {
    /* BUILD */
    const tot = D.map(r => sumArr(r)); med.push(tot.indexOf(Math.min(...tot)));
    const dmin = D[med[0]].slice();
    while (med.length < k) {
      let best = -1, bg = -Infinity;
      for (let h = 0; h < n; h++) { if (med.includes(h)) continue; let gain = 0; for (let j = 0; j < n; j++) gain += Math.max(0, dmin[j] - D[h][j]); if (gain > bg) { bg = gain; best = h; } }
      med.push(best); for (let j = 0; j < n; j++) dmin[j] = Math.min(dmin[j], D[best][j]);
    }
  }
  const cost = m => { let c = 0; for (let j = 0; j < n; j++) { let b = Infinity; for (const mi of m) if (D[mi][j] < b) b = D[mi][j]; c += b; } return c; };
  let cur = cost(med), iter = 0;
  /* SWAP */
  for (; iter < 200; iter++) {
    let bestSwap = null, bestCost = cur;
    for (let a = 0; a < k; a++) for (let h = 0; h < n; h++) {
      if (med.includes(h)) continue;
      const trial = med.slice(); trial[a] = h; const c = cost(trial);
      if (c < bestCost - 1e-12) { bestCost = c; bestSwap = [a, h]; }
    }
    if (!bestSwap) break;
    med[bestSwap[0]] = bestSwap[1]; cur = bestCost;
  }
  const cluster = new Array(n); for (let j = 0; j < n; j++) { let b = Infinity, bi = 0; med.forEach((m, i) => { if (D[m][j] < b) { b = D[m][j]; bi = i; } }); cluster[j] = bi + 1; }
  return { method: 'pam', k, cluster, medoids: med, cost: cur, iter, params: {} };
};

/* ---------------- CLARA: PAM on repeated samples ---------------- */
PT.clara = (D, k, o) => {
  o = o || {};
  const n = D.length, r = o.rng || rng(o.seed || 7), samples = o.samples || 5, size = Math.min(n, o.sampleSize || Math.min(n, 40 + 2 * k));
  let best = null;
  for (let s = 0; s < samples; s++) {
    const idx = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const sub = idx.slice(0, size).sort((a, b) => a - b);
    const Ds = sub.map(i => sub.map(j => D[i][j]));
    const pm = PT.pam(Ds, k);
    const med = pm.medoids.map(m => sub[m]);
    let cost = 0; const cluster = new Array(n);
    for (let j = 0; j < n; j++) { let b = Infinity, bi = 0; med.forEach((m, i) => { if (D[m][j] < b) { b = D[m][j]; bi = i; } }); cost += b; cluster[j] = bi + 1; }
    if (!best || cost < best.cost) best = { cluster, medoids: med, cost, sample: s + 1 };
  }
  return Object.assign({ method: 'clara', k, params: { samples, sampleSize: size } }, best);
};

/* ---------------- fuzzy c-means on coordinates ---------------- */
PT.fcm = (X, k, o) => {
  o = o || {};
  const n = X.length, p = X[0].length, m = o.m || 2, maxIter = o.maxIter || 200, r = o.rng || rng(o.seed || 3);
  let C = KM.init(X, k, r, 'pp'), U = Array.from({ length: n }, () => new Array(k).fill(0)), J = Infinity, iter = 0;
  const e = 2 / (m - 1);
  for (; iter < maxIter; iter++) {
    for (let i = 0; i < n; i++) {
      const d = C.map(c => Math.sqrt(sq(X[i], c)) + 1e-12);
      for (let j = 0; j < k; j++) { let s = 0; for (let l = 0; l < k; l++) s += Math.pow(d[j] / d[l], e); U[i][j] = 1 / s; }
    }
    const C2 = Array.from({ length: k }, () => new Array(p).fill(0)), w = new Array(k).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) { const u = Math.pow(U[i][j], m); w[j] += u; for (let t = 0; t < p; t++) C2[j][t] += u * X[i][t]; }
    for (let j = 0; j < k; j++) for (let t = 0; t < p; t++) C2[j][t] = w[j] ? C2[j][t] / w[j] : C[j][t];
    let J2 = 0; for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) J2 += Math.pow(U[i][j], m) * sq(X[i], C2[j]);
    C = C2;
    if (Math.abs(J - J2) < 1e-8 * Math.max(1, J2)) { J = J2; break; }
    J = J2;
  }
  const cluster = U.map(u => u.indexOf(Math.max(...u)) + 1);
  const pc = sumArr(U.map(u => sumArr(u.map(v => v * v)))) / n;                    /* Dunn's partition coefficient */
  const pe = -sumArr(U.map(u => sumArr(u.map(v => v > 0 ? v * Math.log(v) : 0)))) / n;   /* partition entropy */
  return { method: 'fcm', k, cluster, centers: C, membership: U, objective: J, iter, pc, pcNorm: (k * pc - 1) / (k - 1), pe, params: { m } };
};

/* ---------------- Gaussian mixture models by EM ---------------- */
function chol(A) {
  const n = A.length, L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 0) return null; L[i][j] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
function logDensity(x, mu, L) {
  /* log N(x | mu, Sigma) with Sigma = L Lᵀ */
  const p = x.length, y = new Array(p);
  for (let i = 0; i < p; i++) { let s = x[i] - mu[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
  let q = 0, ld = 0; for (let i = 0; i < p; i++) { q += y[i] * y[i]; ld += Math.log(L[i][i]); }
  return -0.5 * q - ld - 0.5 * p * Math.log(2 * Math.PI);
}
PT.gmmModels = { EII: 'spherical, equal volume', VII: 'spherical, varying volume', VVI: 'diagonal, varying', EEE: 'ellipsoidal, equal shape & orientation', VVV: 'ellipsoidal, all varying' };
PT.gmm = (X, k, o) => {
  o = o || {};
  const n = X.length, p = X[0].length, model = o.model || 'VVV', maxIter = o.maxIter || 200;
  const km = PT.kmeans(X, k, { nstart: 3, seed: o.seed || 5 });
  let mu = km.centers.map(c => c.slice()), pi = new Array(k).fill(1 / k);
  const cnt = new Array(k).fill(0); km.cluster.forEach(c => cnt[c - 1]++); pi = cnt.map(c => Math.max(c, 1) / n);
  const ridge = 1e-4 * (S.colSds(X).reduce((s, v) => s + v * v, 0) / p + 1e-12);
  const covOf = (resp) => {
    const Nk = resp[0].map((_, j) => sumArr(resp.map(r => r[j])));
    const Sig = Array.from({ length: k }, () => Array.from({ length: p }, () => new Array(p).fill(0)));
    for (let j = 0; j < k; j++) for (let i = 0; i < n; i++) { const w = resp[i][j]; if (w < 1e-12) continue; for (let a = 0; a < p; a++) { const da = X[i][a] - mu[j][a]; for (let b = a; b < p; b++) Sig[j][a][b] += w * da * (X[i][b] - mu[j][b]); } }
    for (let j = 0; j < k; j++) for (let a = 0; a < p; a++) for (let b = a; b < p; b++) { Sig[j][a][b] /= Math.max(Nk[j], 1e-9); Sig[j][b][a] = Sig[j][a][b]; }
    if (model === 'EII' || model === 'VII') { for (let j = 0; j < k; j++) { const v = Sig[j].reduce((s, r, a) => s + r[a], 0) / p; Sig[j] = Sig[j].map((r, a) => r.map((_, b) => a === b ? v : 0)); } }
    if (model === 'VVI') for (let j = 0; j < k; j++) Sig[j] = Sig[j].map((r, a) => r.map((v, b) => a === b ? v : 0));
    if (model === 'EII' || model === 'EEE') { const pooled = Array.from({ length: p }, () => new Array(p).fill(0)); for (let j = 0; j < k; j++) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) pooled[a][b] += Sig[j][a][b] * Nk[j] / n; for (let j = 0; j < k; j++) Sig[j] = pooled.map(r => r.slice()); }
    for (let j = 0; j < k; j++) for (let a = 0; a < p; a++) Sig[j][a][a] += ridge;
    return Sig;
  };
  let resp = Array.from({ length: n }, (_, i) => Array.from({ length: k }, (_, j) => km.cluster[i] - 1 === j ? 1 : 0));
  let Sig = covOf(resp), ll = -Infinity, iter = 0;
  for (; iter < maxIter; iter++) {
    const Ls = Sig.map(chol); if (Ls.some(L => !L)) break;
    let ll2 = 0;
    for (let i = 0; i < n; i++) {
      const lp = Ls.map((L, j) => Math.log(pi[j] + 1e-300) + logDensity(X[i], mu[j], L));
      const mx = Math.max(...lp); const w = lp.map(v => Math.exp(v - mx)); const s = sumArr(w);
      resp[i] = w.map(v => v / s); ll2 += mx + Math.log(s);
    }
    const Nk = resp[0].map((_, j) => sumArr(resp.map(r => r[j])));
    pi = Nk.map(v => v / n);
    mu = Array.from({ length: k }, (_, j) => Array.from({ length: p }, (_, t) => sumArr(resp.map((r, i) => r[j] * X[i][t])) / Math.max(Nk[j], 1e-9)));
    Sig = covOf(resp);
    if (Math.abs(ll2 - ll) < 1e-6 * Math.max(1, Math.abs(ll2))) { ll = ll2; break; }
    ll = ll2;
  }
  const npar = k * p + (k - 1) + ({ EII: 1, VII: k, VVI: k * p, EEE: p * (p + 1) / 2, VVV: k * p * (p + 1) / 2 }[model]);
  /* a component supported by fewer points than it has covariance parameters is degenerate: reject the fit */
  const NkFinal = resp[0].map((_, j) => sumArr(resp.map(r => r[j])));
  const minSupport = model === 'VVV' ? p + 2 : model === 'VVI' ? 3 : 2;
  const degenerate = NkFinal.some(v => v < minSupport) || !isFinite(ll);
  const bic = degenerate ? -Infinity : 2 * ll - npar * Math.log(n);
  const cluster = resp.map(r => r.indexOf(Math.max(...r)) + 1);
  return { method: 'gmm', k, cluster, centers: mu, covariances: Sig, weights: pi, membership: resp, uncertainty: resp.map(r => 1 - Math.max(...r)), loglik: ll, bic, npar, iter, params: { model } };
};
PT.gmmSelect = (X, kRange, models, o) => {
  const table = [];
  kRange.forEach(k => models.forEach(model => { try { const g = PT.gmm(X, k, Object.assign({}, o, { model })); table.push({ k, model, bic: g.bic, loglik: g.loglik, fit: g }); } catch (e) { table.push({ k, model, bic: -Infinity, error: e.message }); } }));
  const best = table.filter(t => isFinite(t.bic)).sort((a, b) => b.bic - a.bic)[0];
  return { table, best };
};

/* ---------------- DBSCAN on a dissimilarity matrix ---------------- */
PT.knnDist = (D, k) => D.map((row, i) => row.map((d, j) => j === i ? Infinity : d).sort((a, b) => a - b)[k - 1]);
PT.knee = sortedDesc => {
  const n = sortedDesc.length; if (n < 3) return 0;
  const x0 = 0, y0 = sortedDesc[0], x1 = n - 1, y1 = sortedDesc[n - 1];
  let best = 0, bi = 0; const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  for (let i = 0; i < n; i++) { const d = Math.abs((y1 - y0) * i - (x1 - x0) * sortedDesc[i] + x1 * y0 - y1 * x0) / len; if (d > best) { best = d; bi = i; } }
  return bi;
};
PT.dbscan = (D, eps, minPts) => {
  const n = D.length, cluster = new Array(n).fill(0), visited = new Array(n).fill(false), core = new Array(n).fill(false);
  const neigh = i => { const out = []; for (let j = 0; j < n; j++) if (D[i][j] <= eps) out.push(j); return out; };
  let c = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue; visited[i] = true;
    const N = neigh(i);
    if (N.length < minPts) continue;
    c++; core[i] = true; cluster[i] = c;
    const queue = N.filter(j => j !== i);
    while (queue.length) {
      const j = queue.shift();
      if (!visited[j]) { visited[j] = true; const Nj = neigh(j); if (Nj.length >= minPts) { core[j] = true; Nj.forEach(q => { if (!visited[q] || cluster[q] === 0) queue.push(q); }); } }
      if (cluster[j] === 0) cluster[j] = c;
    }
  }
  const noise = cluster.filter(x => x === 0).length;
  return { method: 'dbscan', k: c, cluster, core, noise, params: { eps, minPts } };
};

/* ---------------- spectral clustering (normalised, Ng–Jordan–Weiss) ---------------- */
PT.spectral = (D, k, o) => {
  o = o || {};
  const n = D.length;
  const kn = Math.min(o.neighbours || 7, n - 1);
  const knd = PT.knnDist(D, kn), sigma = o.sigma || S.median(knd) || 1;
  const W = Array.from({ length: n }, () => new Array(n).fill(0));
  const nb = D.map((row, i) => row.map((d, j) => [d, j]).filter(x => x[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, kn).map(x => x[1]));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && (o.graph === 'full' || nb[i].includes(j) || nb[j].includes(i))) W[i][j] = Math.exp(-D[i][j] * D[i][j] / (2 * sigma * sigma));
  const deg = W.map(r => sumArr(r) + 1e-12);
  const M = W.map((r, i) => r.map((v, j) => v / Math.sqrt(deg[i] * deg[j])));
  const e = S.eigenSym(M);
  const V = Array.from({ length: n }, (_, i) => e.vectors.slice(0, k).map(v => v[i]));
  const Y = V.map(r => { const nr = Math.sqrt(sumArr(r.map(v => v * v))) || 1; return r.map(v => v / nr); });
  const km = PT.kmeans(Y, k, { nstart: 10, seed: 11 });
  return { method: 'spectral', k, cluster: km.cluster, embedding: Y, eigenvalues: e.values.slice(0, k + 3), params: { neighbours: kn, sigma, graph: o.graph || 'knn' } };
};

/* ---------------- silhouette on any dissimilarity; noise (0) excluded ---------------- */
PT.silhouette = (D, cl) => {
  const n = D.length, ids = [...new Set(cl.filter(c => c > 0))].sort((a, b) => a - b), s = new Array(n).fill(0), a = new Array(n).fill(0), b = new Array(n).fill(0), nb = new Array(n).fill(0);
  const members = {}; ids.forEach(c => members[c] = []); cl.forEach((c, i) => { if (c > 0) members[c].push(i); });
  for (let i = 0; i < n; i++) {
    if (cl[i] === 0) continue;
    const own = members[cl[i]];
    if (own.length <= 1) { s[i] = 0; continue; }
    a[i] = sumArr(own.filter(j => j !== i).map(j => D[i][j])) / (own.length - 1);
    let best = Infinity, bc = 0;
    ids.forEach(c => { if (c === cl[i]) return; const m = sumArr(members[c].map(j => D[i][j])) / members[c].length; if (m < best) { best = m; bc = c; } });
    b[i] = best; nb[i] = bc;
    s[i] = isFinite(best) ? (best - a[i]) / Math.max(a[i], best) : 0;
  }
  const byCluster = {}; ids.forEach(c => byCluster[c] = members[c].length ? S.mean(members[c].map(i => s[i])) : 0);
  const valid = cl.map((c, i) => c > 0 ? s[i] : null).filter(v => v != null);
  return { s, a, b, neighbour: nb, byCluster, avg: valid.length ? S.mean(valid) : 0, negatives: valid.filter(v => v < 0).length };
};
PT.sizes = cl => { const c = {}; cl.forEach(x => c[x] = (c[x] || 0) + 1); return c; };
/* within / between sums of squares of a partition in coordinates */
PT.ss = (X, cl) => {
  const ids = [...new Set(cl.filter(c => c > 0))]; let wss = 0; const tss = KM.tss(X);
  ids.forEach(c => { const m = X.filter((_, i) => cl[i] === c); if (!m.length) return; const cen = centroidOf(m); m.forEach(x => wss += sq(x, cen)); });
  return { wss, tss, bss: tss - wss };
};
function centroidOf(M) { const p = M[0].length, c = new Array(p).fill(0); M.forEach(r => r.forEach((v, t) => c[t] += v)); return c.map(v => v / M.length); }
PT.centroidOf = centroidOf;

window.PT = PT;
