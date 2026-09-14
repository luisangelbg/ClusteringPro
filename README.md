# ClusteringPro

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22682795.svg)](https://doi.org/10.5281/zenodo.22682795)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

**Cluster analysis for every kind of data, without writing code.** All eight blocks are complete.

A local web platform (HTML + JavaScript, no installation, no internet) that guides the user from the raw table to
publication-ready dendrograms and cluster maps: exploratory analysis and clustering tendency, similarity coefficients
for quantitative, binary, nominal, ordinal, mixed and ecological data, hierarchical and partitioning methods, density
and model-based clustering, the optimal number of clusters, validation, cluster profiling, supervised follow-up and
an automatic report.

Developed as a teaching and research tool for biology, ecology, agronomy and related sciences.

## Use it online

**https://luisangelbg.github.io/ClusteringPro/** — nothing to install; the app runs in your browser and your data never leave your computer (the page is static: there is no server-side computation and nothing is uploaded).

## How to open a local copy

1. Right-click **`server.ps1`** → *Run with PowerShell* (or double-click `Open ClusteringPro.bat`). The browser opens at `http://localhost:8900`.
   If the port is busy: `powershell -ExecutionPolicy Bypass -File server.ps1 -Port 9001`
2. Double-clicking `index.html` also works, example datasets included: they are embedded in
   `js/examples.js` (generated from `data/` with `manual/herramientas/incrustar-ejemplos.pl`).
3. To use it from a tablet on the same Wi-Fi network, run the script *as administrator*; it prints the address.

## Status of the blocks

| Block | Content | Status |
|---|---|---|
| 1 | Home page: overview, live k-means + dendrogram playground, data types, method gallery, 13 theory lessons with figures, method chooser, glossary | ✅ ready |
| 2 | Data import (xlsx, xls, ods, csv, tsv, txt, json, clipboard, distance matrices), automatic typing (quantitative, count/abundance, binary, nominal, ordinal) and roles (active, supplementary, label, known grouping), missing values (drop / impute), transformations (log, sqrt, Hellinger, chord, relative abundance, presence/absence), scaling (z, range, robust, max-abs), readiness grade A–D with recommendations, Hopkins statistic with Monte-Carlo null and p-value, VAT image, PCA/MDS map, Mahalanobis outliers, correlation heat map, variable spreads; 7 example datasets | ✅ ready |
| 3 | Similarity and distance: 39 coefficients in 6 families (quantitative incl. Minkowski, Mahalanobis, Euclidean on PCs and correlation distances; 10 binary; nominal/ordinal; 9 ecological; Gower with weights and dummy-Euclidean; supplied matrix with √d / d²), metric and Euclidean-embeddability diagnostics, nearest neighbours, known-group separation ratio, heat map with VAT/UPGMA/group ordering, PCoA map with rescaled stress, Shepard diagram, distribution of dissimilarities, k-NN network, comparison of candidate coefficients (correlation matrix + text) | ✅ ready |
| 4 | Hierarchical clustering: 10 rules (single, complete, UPGMA, WPGMA, centroid, median, Ward.D, Ward.D2, flexible β, DIANA), cophenetic correlation, agglomerative/divisive coefficient, reversals, chaining check, cut by k or height with suggested k from merge-height jumps, cluster table and cross-table with ARI/purity against known groups; dendrogram studio (rectangular, triangular, horizontal, radial/fan; colour by cluster, known group, height gradient; cut line, cluster boxes, numbers, collapse into triangles, hanging leaves, leaf symbols and shapes, label colour/angle/italics, leaf order along PCoA/by group/by tightness, axis, guide circles, legend); heat map of variables with object and variable trees; comparison of linkage rules (cophenetic, coefficients, Fowlkes–Mallows, ARI, Baker's γ heat map) and untangled tanglegrams with entanglement and crossings | ✅ ready |
| 5 | Partitioning and advanced methods: k-means (Hartigan–Wong, Lloyd, MacQueen; k-means++ or random starts; nstart; seed), hierarchical k-means seeded by the Block 4 tree, PAM (BUILD + SWAP), CLARA, fuzzy c-means (fuzzifier, partition coefficient and entropy), Gaussian mixtures by EM with five covariance models and BIC selection of k and model, DBSCAN with automatic ε from the knee of the k-NN plot, spectral clustering (k-NN or full Gaussian affinity); coordinates from the working matrix or the PCoA axes of the Block 3 dissimilarity; silhouette on the Block 3 matrix; cross-tables and ARI against the tree cut and the known groups; cluster map with 95 % ellipses or hulls, centroids/medoids, shapes by group, fading of uncertain objects; silhouette plot; cluster sizes; membership / posterior heat map; BIC profile; k-NN distance plot; comparison of methods at the same k with an ARI heat map | ✅ ready |
| 6 | Optimal k and validation: sweep over k with partitions from the tree cut, k-means or PAM; 13 criteria (elbow, silhouette, Calinski–Harabasz, Davies–Bouldin, Dunn, gap statistic with uniform reference sets and the first-SE rule, C-index, McClain–Rao, PBM, Ratkowsky–Lance, Hartigan, Krzanowski–Lai, Ball–Hall) each voting for a k, consensus tally, table and small-multiple panel, "adopt k" into Blocks 4–5; bootstrap stability of a partition (cluster-wise mean Jaccard, dissolved/recovered counts); multiscale bootstrap of the tree with AU/BP values and boxes on supported clusters; external validation between any two labellings (Rand, ARI, NMI, VI, Jaccard, Fowlkes–Mallows, purity, χ² with Cramér's V) with a cross-table heat map; comparison of hierarchical, k-means and PAM over k (connectivity, Dunn, silhouette) | ✅ ready |
| 7 | Cluster profiles and interpretation: per-variable ANOVA, Kruskal–Wallis and η²; test values (v) of every cluster mean against the overall mean for active and supplementary variables; over/under-represented categories with χ² and Cramér's V; indicator species (Dufrêne–Legendre IndVal with permutation test); automatic narrative card per cluster; heat map of standardised means / v-tests, radar, parallel coordinates with individual objects, box-plot grid, categorical composition bars, IndVal bars; linear discriminant analysis (Wilks' Λ, standardised coefficients, structure correlations, confusion matrix, leave-one-out accuracy, LD map with ellipses); classification tree with plain rules and a drawn tree; assignment of pasted/loaded new observations by LDA posterior, nearest centroid and tree rule, with CSV export | ✅ ready |
| 8 | Report and export: self-contained HTML report (title, author, notes, table of contents, every diagnostic, table and figure of Blocks 2–7 exactly as edited, auto-drafted methods paragraph, cluster-membership appendix, optional raw-data appendix), in-app preview, print to PDF, methods paragraph to clipboard, ZIP package with data (as loaded, preprocessed, dissimilarity matrix), CSV tables (membership, tree merges, indices by k, profiles, indicator values), figures as SVG plus PNG/TIFF/JPG/WEBP at 150–900 dpi | ✅ ready |

## Architecture

```
index.html          page structure, Block 1 content and theory, panels for every block
css/style.css       single stylesheet, light and dark themes
js/core.js          global state, DOM helpers, number formatting, downloads, step navigation, seeded RNG
js/hclust.js        clustering engine used on the home page: distance matrix, Lance–Williams agglomeration
                    (single, complete, average, weighted, centroid, median, Ward.D, Ward.D2), cutree, layout,
                    cophenetic correlation, k-means (k-means++ / random, stepwise), silhouette, convex hulls
js/art.js           SVG illustrations: logo, hero, block thumbnails, method cards, data-type icons, theory
                    figures and a real dendrogram renderer (vertical, horizontal, radial; colours by cut)
js/playground.js    interactive demo: datasets, k-means animation, dendrogram recomputed per linkage
js/home.js          Block 1 wiring
js/stats.js         descriptive statistics, distributions, Jacobi eigen-decomposition, PCA, classical MDS,
                    Mahalanobis D² through PCA scores, matrix inverse, seedable RNG
js/figure.js        SVG figure engine: palettes, colour maps, themes, axes, legends, editor panel,
                    export to PNG (with dpi), TIFF (with dpi), SVG, JPG, WEBP at 2×–12×
js/data.js          Block 2: import, column profiling and typing, roles, preprocessing to the working
                    matrix (state.X), Hopkins with Monte-Carlo null, VAT ordering, readiness grade
js/plots2.js        Block 2 figures (P2.*): variable spreads, correlation heat map, PCA/MDS map, VAT image,
                    Hopkins null distribution, Mahalanobis outliers
js/dist.js          Block 3 engine: coefficient catalogue (Dist.catalog), data sources from Block 2,
                    Dist.compute, diagnostics (metric check, Euclidean embeddability, nearest neighbours),
                    Dist.compare (correlation between matrices)
js/plots3.js        Block 3 figures (P3.*): distance heat map, PCoA map, Shepard diagram, distribution,
                    k-NN network, coefficient comparison
js/block3.js        Block 3 UI
js/dendro.js        Dendro.draw (tree renderer: vertical, horizontal, radial, triangular, collapse, hang) and
                    Block 4 figures (P4.*): dendrogram studio, clustered heat map, tanglegram, linkage
                    agreement heat map, merge-height profile
js/block4.js        Block 4 UI (linkage choice, cut, comparison of rules, tanglegrams)
js/partition.js     Block 5 engine (PT.*): k-means (Hartigan / Lloyd / MacQueen), PAM, CLARA, fuzzy c-means,
                    Gaussian mixtures (EM, five covariance models, BIC), DBSCAN + k-NN knee, spectral,
                    generic silhouette, sums of squares
js/plots5.js        Block 5 figures (P5.*): cluster map, silhouette plot, sizes, membership heat map, BIC,
                    k-NN distance plot
js/block5.js        Block 5 UI (method choice and parameters, results, comparison of methods)
js/validate.js      Block 6 engine (VAL.*): internal indices, gap statistic, k sweep with consensus,
                    bootstrap stability, multiscale bootstrap AU/BP, external indices, comparison of algorithms
js/plots6.js        Block 6 figures (P6.*): index curves and small multiples, votes, stability bars,
                    tree with AU/BP, algorithm comparison lines, external cross-table
js/block6.js        Block 6 UI
js/profile.js       Block 7 engine (PR.*): ANOVA / Kruskal–Wallis, quantitative and categorical profiles with
                    v-tests, IndVal with permutations, LDA (fit, predict, leave-one-out), classification tree, nearest-centroid
js/plots7.js        Block 7 figures (P7.*): profile heat map, radar, parallel coordinates, box grid, categorical
                    bars, indicator values, LDA map, classification tree
js/block7.js        Block 7 UI (variable selection, narrative cards, tables, LDA / tree, new observations)
js/zip.js           ZIP writer (store method, CRC-32) for the package
js/report.js        Report.build (self-contained HTML from DOM snapshots + Fig.mounted() figures),
                    Report.methodsText (auto-drafted methods), Report.zip (data, tables, figures)
js/block8.js        Block 8 UI (options, preview iframe, HTML / PDF / ZIP, methods to clipboard)
data/               example datasets (maize morphology, species presence/absence, insect abundances,
                    mixed soil profiles, genetic distance matrix)
js/examples.js      the same datasets embedded, so that they load from file://
vendor/xlsx.full.min.js   local copy of SheetJS
```

Everything is plain JavaScript without modules, so the app also runs from `file://`.

## Third-party code

`vendor/xlsx.full.min.js` is the SheetJS Community Edition (Apache License 2.0), used only to read spreadsheet files. Everything else is original code.

## Licence

ClusteringPro is free software released under the GNU General Public License, version 3 or later (see `LICENSE`).

## How to cite

Barrera-Guzmán, L. Á. (2026). *ClusteringPro: finding, validating and interpreting natural groups in biological, ecological and agronomic data without programming* (Version 1.0.1) [Computer software]. Zenodo. https://doi.org/10.5281/zenodo.22682795

The DOI above is the concept DOI and always resolves to the latest version; each release also has its own DOI (v1.0.1: [10.5281/zenodo.22682889](https://doi.org/10.5281/zenodo.22682889); v1.0.0: [10.5281/zenodo.22682796](https://doi.org/10.5281/zenodo.22682796)). `CITATION.cff` carries the same metadata, and GitHub builds its "Cite this repository" button from it.

