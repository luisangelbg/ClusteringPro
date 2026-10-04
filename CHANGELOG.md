# Changelog

## Unreleased

- Studentized range (`S.ptukey` and `S.qtukey` in `js/stats.js`): the last cut-off of the inner integral was
  exp(−30/k) instead of exp(−30) (there is a single range), which turned small probabilities into 0 when there are
  many means (k = 10: every value below 0.05); the first term also uses now the threshold exp(−50/k) of the classical
  algorithm. Checked against R 4.4.2 on a grid of 125 points (k = 2 to 20, ν = 2 to ∞; all within 1e-7). No block of
  ClusteringPro calls these functions, so no result of the app changes.
