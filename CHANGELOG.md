# Changelog

## Unreleased

- Studentized range (`S.ptukey` and `S.qtukey` in `js/stats.js`): the last cut-off of the inner integral was
  exp(−30/k) instead of exp(−30) (there is a single range), which turned small probabilities into 0 when there are
  many means (k = 10: every value below 0.05); the first term also uses now the threshold exp(−50/k) of the classical
  algorithm. Checked against R 4.4.2 on a grid of 125 points (k = 2 to 20, ν = 2 to ∞; all within 1e-7). No block of
  ClusteringPro calls these functions, so no result of the app changes.
- Normal distribution (`S.pnorm`, and through it `S.qnorm`, the p-values of the test values in Block 7 and the AU and
  BP probabilities of the multiscale bootstrap): `erf` is now the double-precision rational approximation of Cody
  (1969), the same as in BreedingPro, and `pnorm` is computed from `erfc`, so the lower tail keeps its relative
  precision. The former approximation was good to about 4e-8 in absolute value and lost the tail (pnorm(−20) gave 0;
  qnorm(0.5) gave 3.8e-8 instead of 0). Against R 4.4.2, pnorm now agrees within 1.1e-15 (2.4e-13 relative in the
  lower tail, down to z = −38) and qnorm within 1.1e-9 relative. No result changes at the precision the app prints,
  except very small tail probabilities, which are now right.
