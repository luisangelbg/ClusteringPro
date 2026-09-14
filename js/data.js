/* ClusteringPro — Block 2: data import, variable typing and roles, missing values, scaling,
   exploratory analysis and clustering tendency. */

(function () {

const MISSING_CODES = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '.', '-', '--', '?', 'nd', 's/d', 'sd',
  'missing', 'faltante', '#n/a', '#div/0!', '#value!', '#valor!', '#ref!', '#name?', 'inf', '-inf']);

const KINDS = {
  quant:   { label: 'Quantitative',      cls: 'quant',   help: 'Continuous or integer measurements: height, yield, pH, expression.' },
  count:   { label: 'Count / abundance', cls: 'count',   help: 'Non-negative integers with many zeros: species abundances, captures, reads.' },
  binary:  { label: 'Binary (0/1)',      cls: 'binary',  help: 'Two states: present/absent, yes/no, allele A/B.' },
  nominal: { label: 'Nominal',           cls: 'nominal', help: 'Unordered categories: cultivar, soil type, colour.' },
  ordinal: { label: 'Ordinal',           cls: 'ordinal', help: 'Ordered categories: low < medium < high, damage scores.' },
};
const ROLES = {
  active:        { label: 'Active (used to cluster)', color: '#4f46a5', help: 'The variables that define similarity between objects.' },
  supplementary: { label: 'Supplementary',            color: '#1fa39a', help: 'Kept for describing the clusters later (Block 7), not used to build them.' },
  label:         { label: 'Object label / ID',        color: '#6d6e71', help: 'Names shown on dendrogram leaves and plots. One column.' },
  group:         { label: 'Known grouping',           color: '#e0803c', help: 'A classification you already have (species, region…), for external validation and colouring. Never used to cluster.' },
  excluded:      { label: 'Exclude',                  color: '#b5b5b5', help: 'Ignore this column.' },
};
const BINARY_SETS = [['0', '1'], ['no', 'yes'], ['n', 'y'], ['false', 'true'], ['absent', 'present'], ['a', 'p'], ['-', '+'], ['no', 'si'], ['no', 'sí'], ['absence', 'presence'], ['f', 't'], ['0', '1.0']];
const ORDINAL_SETS = [
  ['very low', 'low', 'medium', 'high', 'very high'], ['low', 'medium', 'high'], ['low', 'moderate', 'high'], ['none', 'low', 'medium', 'high'],
  ['poor', 'moderate', 'good', 'excellent'], ['poor', 'moderate', 'good', 'excessive'], ['poor', 'fair', 'good', 'excellent'], ['poor', 'moderate', 'good'],
  ['small', 'medium', 'large'], ['never', 'rarely', 'sometimes', 'often', 'always'], ['light', 'moderate', 'severe'], ['mild', 'moderate', 'severe'],
  ['resistant', 'moderately resistant', 'moderately susceptible', 'susceptible'], ['early', 'intermediate', 'late'], ['bajo', 'medio', 'alto'],
];
const ID_RX = /^(id|code|codigo|código|accession|acc|genotype|genotipo|sample|muestra|site|sitio|plot|parcela|profile|perfil|name|nombre|label|obs|individual|cultivar|line|linea|línea|entry|rowname|row_name|object)$/i;
const GROUP_RX = /^(group|grupo|class|clase|type|tipo|habitat|region|región|origin|origen|landscape|treatment|tratamiento|category|categoria|categoría|species|especie|cluster|population|poblacion|población|site_type|status|zone|zona|country|pais|país|family|familia)$/i;
const COUNT_RX = /(_sp$|_spp$|abund|count|conteo|captur|reads|otu|asv|individuals|n_)/i;
window.KINDS = KINDS; window.ROLES = ROLES;

/* ============================================================
   File reading (shared parsing helpers)
   ============================================================ */
function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length).slice(0, 10);
  const cands = [',', ';', '\t', '|'];
  let best = ',', bestScore = -1;
  cands.forEach(d => {
    const counts = lines.map(l => l.split(d).length - 1);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const consistent = counts.every(c => c === counts[0]) ? 1 : 0.5;
    const score = mean * consistent;
    if (score > bestScore) { bestScore = score; best = d; }
  });
  return best;
}
function parseCSV(text, delim) {
  text = text.replace(/^﻿/, '');
  const d = delim || detectDelimiter(text);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function toNumber(v, decimal) {
  if (v == null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  let s = String(v).trim();
  if (!s || MISSING_CODES.has(s.toLowerCase())) return null;
  s = s.replace(/\s| /g, '').replace(/%$/, '');
  if (decimal === 'comma') s = s.replace(/\./g, '').replace(',', '.');
  else if (decimal === 'auto') {
    if (/,\d{1,3}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else s = s.replace(/,/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function isMissing(v) {
  if (v == null) return true;
  if (typeof v === 'number') return !isFinite(v);
  return MISSING_CODES.has(String(v).trim().toLowerCase());
}
function guessDecimal(rows) {
  let comma = 0, dot = 0;
  rows.slice(0, 500).forEach(r => r.forEach(v => {
    if (typeof v !== 'string') return;
    const s = v.trim();
    if (/^[+-]?\d+,\d+$/.test(s)) comma++;
    else if (/^[+-]?\d+\.\d+$/.test(s)) dot++;
  }));
  return comma > dot ? 'comma' : 'dot';
}

/* ============================================================
   Grid diagnostics
   ============================================================ */
function diagnoseGrid(rows, merges) {
  const issues = [];
  if (!rows.length) { issues.push({ level: 'bad', title: 'The sheet is empty', text: 'No rows with content were found.' }); return { issues, headerRow: 0 }; }
  const widths = rows.map(r => r.filter(v => !isMissing(v)).length);
  const maxW = Math.max(...widths);
  let headerRow = 0;
  while (headerRow < rows.length - 1 && widths[headerRow] < Math.max(2, maxW * 0.5)) headerRow++;
  if (headerRow > 0) issues.push({ level: 'warn', title: `${headerRow} title row${headerRow > 1 ? 's' : ''} above the header`, text: `The header appears to be on row ${headerRow + 1}. Those rows were skipped automatically — check the preview.` });
  if (merges && merges.length) issues.push({ level: 'bad', title: `${merges.length} merged cell range${merges.length > 1 ? 's' : ''} detected`, text: 'Merged cells break the one-row-per-object rule: only the first cell keeps its value. Unmerge them and fill every row.' });
  const hdr = rows[headerRow] || [];
  const blanks = hdr.filter(v => isMissing(v)).length;
  if (blanks) issues.push({ level: 'warn', title: `${blanks} column${blanks > 1 ? 's' : ''} without a name`, text: 'Unnamed columns were named V1, V2… (the first unnamed column is usually the object label).' });
  const names = hdr.map(v => String(v ?? '').trim()).filter(Boolean);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) issues.push({ level: 'warn', title: 'Duplicated column names', text: `Renamed with a suffix: ${[...new Set(dup)].join(', ')}.` });
  const body = rows.slice(headerRow + 1);
  const ragged = body.filter(r => r.filter(v => !isMissing(v)).length > hdr.length).length;
  if (ragged) issues.push({ level: 'warn', title: `${ragged} row${ragged > 1 ? 's' : ''} with more cells than the header`, text: 'Extra cells beyond the last column were dropped.' });
  const totals = body.filter(r => /^(total|mean|average|promedio|suma|sum|media)$/i.test(String(r[0] ?? '').trim())).length;
  if (totals) issues.push({ level: 'bad', title: `${totals} summary row${totals > 1 ? 's' : ''} (Total / Mean) inside the data`, text: 'Remove totals and averages: they would be clustered as if they were objects.' });
  return { issues, headerRow };
}

/* ============================================================
   Column profiling for clustering
   ============================================================ */
function matchOrdinal(levels) {
  const lc = levels.map(l => l.toLowerCase());
  for (const set of ORDINAL_SETS) if (lc.every(l => set.includes(l)) && lc.length >= 2) return set.filter(s => lc.includes(s)).map(s => levels[lc.indexOf(s)]);
  return null;
}
function matchBinary(levels) {
  if (levels.length !== 2) return null;
  const lc = levels.map(l => l.toLowerCase());
  for (const set of BINARY_SETS) if (lc.every(l => set.includes(l))) return { zero: levels[lc.indexOf(set[0])], one: levels[lc.indexOf(set[1])] };
  return null;
}

function profileColumns(header, rows, decimal) {
  let labelTaken = false, groupTaken = false;
  const cols = header.map((name, j) => {
    const raw = rows.map(r => r[j]);
    const present = raw.filter(v => !isMissing(v));
    const nums = present.map(v => toNumber(v, decimal));
    const nOk = nums.filter(v => v !== null).length;
    const numericRatio = present.length ? nOk / present.length : 0;
    const uniq = new Set(present.map(v => String(v).trim()));
    const col = { name, index: j, n: present.length, missing: rows.length - present.length, missingPct: rows.length ? (rows.length - present.length) / rows.length : 0, unique: uniq.size, numericRatio, values: raw };
    const lname = name.trim();
    col.levelCounts = {}; present.forEach(v => { const k = String(v).trim(); col.levelCounts[k] = (col.levelCounts[k] || 0) + 1; });
    if (present.length === 0) { Object.assign(col, { kind: 'quant', role: 'excluded', detected: 'Empty', levels: [], num: [] }); return col; }
    if (numericRatio >= 0.9 && nOk >= 2) {
      const v = nums.filter(x => x !== null);
      col.num = v; col.allInt = v.every(x => Number.isInteger(x));
      col.mean = S.mean(v); col.sd = S.sd(v); col.min = S.min(v); col.max = S.max(v); col.median = S.median(v);
      col.cv = col.mean ? Math.abs(col.sd / col.mean) * 100 : NaN; col.skew = S.skewness(v);
      col.zeros = v.filter(x => x === 0).length; col.negatives = v.filter(x => x < 0).length;
      col.outliers = col.sd > 0 ? v.filter(x => Math.abs((x - col.mean) / col.sd) > 3).length : 0;
      col.constant = !(col.sd > 0);
      col.levels = [...uniq].sort((a, b) => +a - +b);
      const bin = matchBinary(col.levels);
      if (numericRatio < 1) col.mixed = true;
      if (bin && uniq.size === 2) { col.kind = 'binary'; col.binary = bin; col.role = 'active'; col.detected = 'Binary 0/1'; }
      else if (ID_RX.test(lname) && uniq.size === present.length && !labelTaken) { col.kind = 'quant'; col.role = 'label'; col.detected = 'Identifier'; labelTaken = true; }
      else if (col.constant) { col.kind = 'quant'; col.role = 'excluded'; col.detected = 'Constant'; }
      else if (col.allInt && col.min >= 0 && uniq.size > 2 && (col.zeros / v.length >= 0.15 || COUNT_RX.test(lname))) { col.kind = 'count'; col.role = 'active'; col.detected = `Counts (${fmtPct(col.zeros / v.length, 0)} zeros)`; }
      else if (col.allInt && uniq.size <= 7 && uniq.size < present.length / 3 && !/(score|scale|grade|rating|sever|level|class|stage|index)/i.test(lname) && GROUP_RX.test(lname) && !groupTaken) { col.kind = 'nominal'; col.role = 'group'; col.detected = `Integer codes (${uniq.size} groups)`; groupTaken = true; }
      else if (col.allInt && uniq.size <= 9 && uniq.size < present.length / 3 && /(score|scale|grade|rating|sever|level|stage|damage|likert)/i.test(lname)) { col.kind = 'ordinal'; col.order = col.levels.slice(); col.role = 'active'; col.detected = `Ordinal scores (${uniq.size} levels)`; }
      else { col.kind = 'quant'; col.role = 'active'; col.detected = col.allInt ? 'Numeric (integers)' : 'Numeric (continuous)'; if (col.allInt && uniq.size <= 7 && uniq.size < present.length / 3) col.hintCodes = true; }
    } else {
      col.levels = Object.keys(col.levelCounts);
      col.num = [];
      const bin = matchBinary(col.levels), ord = matchOrdinal(col.levels);
      if (uniq.size === present.length && present.length > 3) { col.kind = 'nominal'; col.role = labelTaken ? 'excluded' : 'label'; col.detected = 'Text, all distinct (label)'; labelTaken = labelTaken || col.role === 'label'; }
      else if (bin) { col.kind = 'binary'; col.binary = bin; col.role = 'active'; col.detected = `Binary (${bin.zero} / ${bin.one})`; }
      else if (ord) { col.kind = 'ordinal'; col.order = ord; col.role = 'active'; col.detected = `Ordinal (${ord.length} levels)`; }
      else if (uniq.size > 40) { col.kind = 'nominal'; col.role = 'excluded'; col.detected = `Text (${uniq.size} categories)`; }
      else if (GROUP_RX.test(lname) && !groupTaken) { col.kind = 'nominal'; col.role = 'group'; col.detected = `Categorical (${uniq.size} groups)`; groupTaken = true; }
      else { col.kind = 'nominal'; col.role = 'active'; col.detected = `Categorical (${uniq.size} levels)`; }
      if (numericRatio > 0.5 && numericRatio < 0.9) col.mixed = true;
    }
    return col;
  });
  /* community tables: when most numeric columns are non-negative integers and zeros are common
     across them, treat the whole block as counts / abundances */
  const numAct = cols.filter(c => (c.kind === 'quant' || c.kind === 'count') && c.role === 'active');
  const intCols = numAct.filter(c => c.allInt && c.min >= 0);
  const withZeros = intCols.filter(c => c.zeros > 0).length;
  if (intCols.length >= 4 && intCols.length >= 0.6 * numAct.length && withZeros >= 0.3 * intCols.length) {
    intCols.forEach(c => { if (c.kind !== 'count') { c.kind = 'count'; c.detected = `Counts (${fmtPct(c.zeros / c.num.length, 0)} zeros)`; c.hintCodes = false; } });
  }
  return cols;
}

/* A square table whose first column repeats the header names is a distance matrix. */
function detectDistanceMatrix(header, rows, decimal) {
  const n = rows.length;
  if (n < 3 || header.length !== n + 1) return null;
  const rowLabels = rows.map(r => String(r[0] ?? '').trim().toLowerCase());
  const colLabels = header.slice(1).map(h => String(h).trim().toLowerCase());
  if (!rowLabels.every((l, i) => l === colLabels[i])) return null;
  const D = rows.map(r => r.slice(1).map(v => toNumber(v, decimal)));
  if (D.some(r => r.some(v => v == null || v < 0))) return null;
  let asym = 0, diag = 0;
  for (let i = 0; i < n; i++) { if (Math.abs(D[i][i]) > 1e-9) diag++; for (let j = i + 1; j < n; j++) if (Math.abs(D[i][j] - D[j][i]) > 1e-6 * Math.max(1, Math.abs(D[i][j]))) asym++; }
  if (diag > 0) return null;
  if (asym > 0) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const m = (D[i][j] + D[j][i]) / 2; D[i][j] = D[j][i] = m; }
  return { D, labels: rows.map(r => String(r[0]).trim()), asym };
}

/* ============================================================
   Loading pipeline
   ============================================================ */
function uniqueNames(hdr) {
  const seen = {};
  return hdr.map((h, i) => {
    let n = String(h ?? '').trim() || (i === 0 ? 'Object' : 'V' + (i + 1));
    if (seen[n]) { let k = 2; while (seen[n + '_' + k]) k++; n = n + '_' + k; }
    seen[n] = true;
    return n;
  });
}
function afterLoad(grid, fileName, sheetName, merges) {
  const rows0 = grid.filter(r => r.some(v => !isMissing(v)));
  const diag = diagnoseGrid(rows0, merges);
  if (!rows0.length) { showMessage('dataMessages', 'error', 'The file has no data.'); return; }
  const hdrRow = rows0[diag.headerRow] || [];
  const header = uniqueNames(hdrRow);
  let rows = rows0.slice(diag.headerRow + 1).map(r => header.map((_, j) => r[j] == null ? '' : r[j]));
  rows = rows.filter(r => !/^(total|mean|average|promedio|suma|sum|media)$/i.test(String(r[0] ?? '').trim()));
  const decSel = el('decimalSel').value;
  const decimal = decSel === 'auto' ? guessDecimal(rows) : decSel;
  Object.assign(state, { decimal, fileName, sheetName: sheetName || null, rawHeader: header, rawRows: rows, gridIssues: diag.issues, ready: false, eda: null, X: null });
  const dm = detectDistanceMatrix(header, rows, decimal);
  state.isDistance = !!dm;
  clearMessages('dataMessages');
  if (dm) {
    state.distInput = dm; state.columns = [];
    showMessage('dataMessages', 'success', `<b>${esc(fileName)}</b> — recognised as a <b>distance matrix</b> of ${dm.labels.length} objects${dm.asym ? ' (small asymmetries were averaged)' : ''}. Scaling does not apply; the matrix is used as it is.`);
  } else {
    state.columns = profileColumns(header, rows, decimal);
    showMessage('dataMessages', 'success', `<b>${esc(fileName)}</b>${sheetName ? ' · sheet <b>' + esc(sheetName) + '</b>' : ''} — ${rows.length} objects × ${header.length} columns read. Decimal separator: <b>${decimal === 'comma' ? 'comma' : 'point'}</b>.`);
  }
  renderIssues();
  renderVarTable();
  renderPreview();
  el('varCard').style.display = dm ? 'none' : '';
  el('prepCard').style.display = dm ? 'none' : '';
  el('edaCard').style.display = 'none';
  el('previewCard').style.display = '';
  state.prep.userScaling = false;
  updateSummary();
  if (dm) { applyPrep(); }
  else el('varCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function readFile(file) {
  const name = file.name.toLowerCase();
  const reader = new FileReader();
  clearMessages('dataMessages');
  showMessage('dataMessages', 'info', '<span class="loading"></span> Reading file…');
  const ext = name.split('.').pop();
  if (['csv', 'tsv', 'txt', 'dat', 'prn'].includes(ext)) {
    reader.onload = e => {
      try { afterLoad(parseCSV(e.target.result, ext === 'tsv' ? '\t' : (el('delimSel').value || null)), file.name); }
      catch (err) { clearMessages('dataMessages'); showMessage('dataMessages', 'error', 'Could not read the text file: ' + err.message); }
    };
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'json') {
    reader.onload = e => {
      try { afterLoad(jsonToGrid(JSON.parse(e.target.result)), file.name); }
      catch (err) { clearMessages('dataMessages'); showMessage('dataMessages', 'error', 'Could not read the JSON file: ' + err.message); }
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        state.sheets = wb.SheetNames; state.workbook = wb;
        const pick = el('sheetSelect');
        pick.innerHTML = '';
        wb.SheetNames.forEach(s => pick.appendChild(mk('option', { value: s }, esc(s))));
        el('sheetPicker').style.display = wb.SheetNames.length > 1 ? '' : 'none';
        loadSheet(wb.SheetNames[0], file.name);
      } catch (err) { clearMessages('dataMessages'); showMessage('dataMessages', 'error', 'Could not read the spreadsheet: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }
}
function loadSheet(sheetName, fileName) {
  const ws = state.workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: true });
  afterLoad(grid, fileName || state.fileName, sheetName, ws['!merges'] || []);
}
function jsonToGrid(j) {
  if (Array.isArray(j) && j.length && Array.isArray(j[0])) return j;
  if (Array.isArray(j) && j.length && typeof j[0] === 'object') {
    const keys = [...new Set(j.flatMap(o => Object.keys(o)))];
    return [keys].concat(j.map(o => keys.map(k => o[k] == null ? '' : o[k])));
  }
  if (j && Array.isArray(j.columns) && Array.isArray(j.data)) return [j.columns].concat(j.data);
  if (j && typeof j === 'object') {
    const keys = Object.keys(j).filter(k => Array.isArray(j[k]));
    if (keys.length) { const n = Math.max(...keys.map(k => j[k].length)); return [keys].concat(Array.from({ length: n }, (_, i) => keys.map(k => j[k][i] == null ? '' : j[k][i]))); }
  }
  throw new Error('Unrecognised JSON layout. Use an array of objects (one object per row).');
}
function loadPasted() {
  const text = el('pasteArea').value;
  if (!text.trim()) return;
  try { afterLoad(parseCSV(text, el('delimSel').value || null), 'pasted-data.txt'); }
  catch (err) { showMessage('dataMessages', 'error', 'Could not parse the pasted text: ' + err.message); }
}
function loadExample(path, name) {
  clearMessages('dataMessages');
  showMessage('dataMessages', 'info', '<span class="loading"></span> Loading example…');
  fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(txt => afterLoad(parseCSV(txt, ','), name))
    .catch(() => { clearMessages('dataMessages'); showMessage('dataMessages', 'error', 'Could not load the example. Open the app through <b>server.ps1</b> (examples cannot be read from file://).'); });
}
/* simulated datasets, generated in the browser */
function simulate(kind) {
  const r = rng(kind === 'noise' ? 77 : 91), grid = [['Object', 'Group', 'V1', 'V2', 'V3', 'V4', 'V5']];
  if (kind === 'noise') { for (let i = 0; i < 60; i++) grid.push(['U' + (i + 1), 'none', ...[0, 1, 2, 3, 4].map(() => +(r() * 10).toFixed(2))]); }
  else {
    const C = [[2, 8, 3, 7, 5], [8, 2, 7, 3, 5], [5, 5, 9, 9, 1], [9, 9, 2, 2, 9]];
    C.forEach((c, g) => { for (let i = 0; i < 20; i++) grid.push(['C' + (g + 1) + '-' + (i + 1), 'cluster ' + (g + 1), ...c.map(m => +(m + randn(r) * 0.8).toFixed(2))]); });
  }
  afterLoad(grid, kind === 'noise' ? 'simulated_uniform_noise.csv' : 'simulated_four_clusters.csv', null, []);
}

/* ============================================================
   UI: issues, variable table, preview, summary
   ============================================================ */
function renderIssues() {
  const host = el('gridIssues');
  host.innerHTML = '';
  const issues = state.gridIssues || [];
  if (!issues.length) { host.innerHTML = '<div class="check-item ok"><div class="ck-icon">✅</div><div class="ck-body"><div class="ck-title">Tidy table</div><div class="ck-text">One header row, one row per object, no merged cells or summary rows.</div></div></div>'; return; }
  issues.forEach(i => host.appendChild(mk('div', { class: 'check-item ' + i.level }, `<div class="ck-icon">${i.level === 'bad' ? '⛔' : i.level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${esc(i.title)}</div><div class="ck-text">${i.text}</div></div>`)));
}
function sparkline(col) {
  const w = 96, h = 24; let body = '';
  if ((col.kind === 'quant' || col.kind === 'count') && col.num.length > 1 && col.sd > 0) {
    const hist = S.histogram(col.num, 18), mx = Math.max(...hist.counts), bw = w / hist.k;
    hist.counts.forEach((c, i) => { const bh = mx ? (c / mx) * (h - 3) : 0; body += `<rect x="${(i * bw).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(bw - 0.6).toFixed(1)}" height="${bh.toFixed(1)}" fill="${col.kind === 'count' ? '#d64a6a' : '#4f46a5'}" opacity="0.75"/>`; });
  } else if (col.levelCounts) {
    const ent = (col.order || col.levels || []).slice(0, 14).map(l => [l, col.levelCounts[l] || 0]);
    const mx = Math.max(...ent.map(e => e[1]), 1), bw = w / Math.max(ent.length, 1);
    ent.forEach((e, i) => { const bh = (e[1] / mx) * (h - 3); body += `<rect x="${(i * bw).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${bh.toFixed(1)}" fill="${col.kind === 'binary' ? '#1fa39a' : col.kind === 'ordinal' ? '#7bb041' : '#e0803c'}" opacity="0.8"/>`; });
  }
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
function flagsFor(col) {
  const f = [];
  if (col.constant) f.push('<span class="flag bad">zero variance</span>');
  if (col.missingPct > 0.2) f.push(`<span class="flag bad">${fmtPct(col.missingPct, 0)} missing</span>`);
  else if (col.missingPct > 0) f.push(`<span class="flag">${col.missing} missing</span>`);
  if (col.mixed) f.push('<span class="flag bad">numbers mixed with text</span>');
  if ((col.kind === 'quant' || col.kind === 'count') && col.role === 'active') {
    if (Math.abs(col.skew) > 2) f.push('<span class="flag bad">strongly skewed → log/sqrt?</span>');
    else if (Math.abs(col.skew) > 1) f.push('<span class="flag">skewed</span>');
    if (col.outliers > 0) f.push(`<span class="flag">${col.outliers} outlier${col.outliers > 1 ? 's' : ''} |z|&gt;3</span>`);
  }
  if (col.hintCodes) f.push('<span class="flag">few integer values → nominal or ordinal?</span>');
  if (col.kind === 'nominal' && col.role === 'active' && col.unique > 15) f.push('<span class="flag">many categories</span>');
  if (col.kind === 'nominal' && col.levels) {
    const lc = col.levels.map(l => l.toLowerCase());
    if (new Set(lc).size < lc.length) f.push('<span class="flag bad">levels differ only by case</span>');
  }
  if (!f.length) f.push('<span class="flag ok">ok</span>');
  return f.join(' ');
}
function renderVarTable() {
  const host = el('varTable');
  host.innerHTML = '';
  if (state.isDistance) return;
  const table = mk('table', { class: 'var-table' });
  table.innerHTML = `<thead><tr><th>Variable</th><th>Detected</th><th>Type</th><th>Role</th><th class="num">n</th><th class="num">Missing</th><th class="num">Unique</th><th>Summary</th><th>Distribution</th><th>Checks</th></tr></thead>`;
  const tb = mk('tbody');
  state.columns.forEach(col => {
    const tr = mk('tr');
    const kindSel = mk('select');
    Object.entries(KINDS).forEach(([k, v]) => {
      if (col.num.length === 0 && (k === 'quant' || k === 'count')) return;
      if (col.num.length > 0 && col.numericRatio >= 0.9 && k === 'nominal' && col.unique > 40) return;
      const op = mk('option', { value: k }, v.label); if (col.kind === k) op.selected = true; kindSel.appendChild(op);
    });
    kindSel.addEventListener('change', () => { setKind(col, kindSel.value); renderVarTable(); updateSummary(); });
    const roleSel = mk('select');
    Object.entries(ROLES).forEach(([k, r]) => { const op = mk('option', { value: k }, r.label); if (col.role === k) op.selected = true; roleSel.appendChild(op); });
    roleSel.addEventListener('change', () => {
      col.role = roleSel.value;
      if (col.role === 'label') state.columns.forEach(c => { if (c !== col && c.role === 'label') c.role = 'excluded'; });
      if (col.role === 'group') state.columns.forEach(c => { if (c !== col && c.role === 'group') c.role = 'active'; });
      renderVarTable(); updateSummary();
    });
    const summary = (col.kind === 'quant' || col.kind === 'count') && col.num.length
      ? `mean ${fmtNum(col.mean, 3)} · SD ${fmtNum(col.sd, 3)} · [${fmtNum(col.min, 3)}, ${fmtNum(col.max, 3)}]`
      : col.kind === 'ordinal' ? (col.order || col.levels).map(esc).join(' &lt; ')
      : col.kind === 'binary' && col.binary ? `${esc(col.binary.zero)} = 0 · ${esc(col.binary.one)} = 1 (${fmtPct((col.levelCounts[col.binary.one] || 0) / col.n, 0)} ones)`
      : (col.levels || []).slice(0, 6).map(esc).join(', ') + ((col.levels || []).length > 6 ? ', …' : '');
    tr.innerHTML = `<td class="var-name">${esc(col.name)}</td><td><span class="pill ${KINDS[col.kind] ? KINDS[col.kind].cls : ''}">${esc(col.detected)}</span></td><td></td><td></td>
      <td class="num">${col.n}</td><td class="num">${col.missing}</td><td class="num">${col.unique}</td><td>${summary}</td><td>${sparkline(col)}</td><td>${flagsFor(col)}</td>`;
    const kindCell = tr.children[2]; kindCell.appendChild(kindSel);
    if (col.kind === 'ordinal' && col.role === 'active') {
      const inp = mk('input', { type: 'text', value: (col.order || col.levels).join(' < '), title: 'Order of the levels, from lowest to highest, separated by <' });
      inp.addEventListener('change', () => {
        const ord = inp.value.split('<').map(s => s.trim()).filter(Boolean);
        const missing = col.levels.filter(l => !ord.includes(l));
        col.order = ord.filter(l => col.levels.includes(l)).concat(missing);
        renderVarTable(); updateSummary();
      });
      kindCell.appendChild(mk('div', { style: 'margin-top:4px' })).appendChild(inp);
    }
    tr.children[3].appendChild(roleSel);
    tr.style.opacity = col.role === 'excluded' ? 0.55 : 1;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  host.appendChild(table);
}
function setKind(col, kind) {
  col.kind = kind;
  if (kind === 'ordinal' && !col.order) col.order = col.num.length ? col.levels.slice().sort((a, b) => +a - +b) : col.levels.slice().sort();
  if (kind === 'binary' && !col.binary) {
    const lv = col.levels.slice(0, 2); col.binary = matchBinary(col.levels) || { zero: lv[0], one: lv[1] || lv[0] };
  }
  if (col.role === 'excluded' || col.role === 'label') col.role = 'active';
}
function renderPreview() {
  const host = el('previewTable');
  const cols = state.rawHeader.map((h, j) => ({ key: j, label: esc(h), get: r => r[j] }));
  buildTable(host, cols, state.rawRows, { limit: 200 });
}

/* Data profile → recommendation for the later blocks */
function profileDataset() {
  if (state.isDistance) return { type: 'distance', n: state.distInput.labels.length, counts: {} };
  const act = state.columns.filter(c => c.role === 'active');
  const counts = {}; Object.keys(KINDS).forEach(k => counts[k] = act.filter(c => c.kind === k).length);
  const p = act.length;
  let type = 'mixed';
  if (!p) type = 'none';
  else if (counts.quant + counts.count === p && counts.count >= 0.6 * p) type = 'ecological';
  else if (counts.quant + counts.count === p) type = 'quant';
  else if (counts.binary === p) type = 'binary';
  else if (counts.nominal === p) type = 'nominal';
  else if (counts.ordinal === p) type = 'ordinal';
  else if (counts.quant + counts.count + counts.ordinal === p) type = 'quant';
  const skewed = act.filter(c => (c.kind === 'quant' || c.kind === 'count') && Math.abs(c.skew) > 1.5).length;
  const sds = act.filter(c => c.kind === 'quant' && c.sd > 0).map(c => c.sd);
  const disparity = sds.length > 1 ? Math.max(...sds) / Math.min(...sds) : 1;
  return { type, p, counts, skewed, disparity, n: state.rawRows.length, active: act };
}
function recommend(prof) {
  const R = { scaling: 'zscore', transform: 'none', distance: 'Euclidean', method: 'Ward.D2 (then k-means seeded by the tree)', alt: 'UPGMA · PAM · Gaussian mixture', why: '' };
  switch (prof.type) {
    case 'distance': Object.assign(R, { scaling: 'none', distance: 'Your matrix, as supplied', method: 'UPGMA or PAM (any distance)', alt: 'Complete linkage · Ward on √d if the distance is Euclidean-embeddable', why: 'A distance matrix already encodes the similarity: there is nothing to scale.' }); break;
    case 'ecological': Object.assign(R, { scaling: 'none', transform: 'hellinger', distance: 'Bray–Curtis (raw counts) or Euclidean on Hellinger-transformed data', method: 'UPGMA on Bray–Curtis, or Ward.D2 on Hellinger', alt: 'PAM · k-means on Hellinger', why: 'Abundance tables are dominated by zeros; asymmetric coefficients or the Hellinger transformation avoid grouping sites by the species they lack.' }); break;
    case 'binary': Object.assign(R, { scaling: 'none', distance: 'Jaccard (asymmetric) or simple matching (symmetric states)', method: 'UPGMA', alt: 'PAM · Ward on √(1 − s)', why: 'Binary data need a matching coefficient, not Euclidean distance. Choose Jaccard when 0 means absence, simple matching when both states are informative.' }); break;
    case 'nominal': Object.assign(R, { scaling: 'range', distance: 'Simple matching / Gower', method: 'PAM (k-medoids)', alt: 'UPGMA on Gower', why: 'Categorical variables are compared by agreement of categories; medoids are actual objects and need no averaging.' }); break;
    case 'ordinal': Object.assign(R, { scaling: 'range', distance: 'Manhattan on ranks / Gower', method: 'PAM or UPGMA', alt: 'Ward.D2 on ranks', why: 'Ranks preserve the order of the levels without assuming equal spacing.' }); break;
    case 'mixed': Object.assign(R, { scaling: 'range', distance: 'Gower', method: 'PAM (k-medoids)', alt: 'UPGMA on Gower', why: 'Gower mixes quantitative, binary, ordinal and nominal variables on a common 0–1 scale (range scaling is what Gower does internally, so the preview matches it); PAM works with any distance.' }); break;
    default:
      if (prof.disparity > 20) R.why = 'Variables have very different spreads (max/min SD > 20): standardise so that no variable dominates the distance.';
      else if (prof.disparity > 3) R.why = 'Spreads differ moderately; z-scores are the safe default. Keep raw units only if all variables share a unit and you want the larger ones to weigh more.';
      else { R.scaling = 'zscore'; R.why = 'Similar spreads: standardising changes little, but it keeps the analysis comparable across variables.'; }
      if (prof.skewed) { R.transform = 'log'; R.why += ` ${prof.skewed} variable${prof.skewed > 1 ? 's are' : ' is'} strongly skewed: a log or square-root transformation before scaling reduces the weight of extreme values.`; }
  }
  return R;
}
function updateSummary() {
  const host = el('varSummary'), checks = el('varChecks');
  host.innerHTML = ''; checks.innerHTML = '';
  const prof = profileDataset();
  state.profile = prof;
  if (state.isDistance) { state.recommend = recommend(prof); return; }
  const label = state.columns.find(c => c.role === 'label'), group = state.columns.find(c => c.role === 'group');
  const items = [
    ['Objects (rows)', prof.n, 'to be clustered'],
    ['Active variables', prof.p, Object.entries(prof.counts).filter(e => e[1]).map(e => `${e[1]} ${KINDS[e[0]].label.toLowerCase()}`).join(' · ') || '—'],
    ['Data profile', { quant: 'Quantitative', ecological: 'Ecological counts', binary: 'Binary', nominal: 'Nominal', ordinal: 'Ordinal', mixed: 'Mixed types', none: '—' }[prof.type], ''],
    ['Object labels', label ? label.name : 'row numbers', ''],
    ['Known grouping', group ? `${group.name} (${group.unique} groups)` : 'none', group ? 'for external validation' : 'optional'],
    ['Supplementary', state.columns.filter(c => c.role === 'supplementary').length || 'none', 'described in Block 7'],
  ];
  items.forEach(([l, v, s]) => host.appendChild(mk('div', { class: 'ds-item' }, `<div class="ds-label">${l}</div><div class="ds-value">${esc(String(v))}</div>${s ? `<div class="ds-sub">${esc(s)}</div>` : ''}`)));
  const add = (level, title, text) => checks.appendChild(mk('div', { class: 'check-item ' + level }, `<div class="ck-icon">${level === 'ok' ? '✅' : level === 'bad' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${title}</div><div class="ck-text">${text}</div></div>`));
  if (!prof.p) add('bad', 'No active variables', 'Mark at least two columns as <b>Active</b>.');
  else if (prof.p === 1) add('warn', 'Only one active variable', 'Clustering on a single variable is just binning its values. Add more variables if you can.');
  if (prof.n < 8) add('bad', 'Very few objects', `${prof.n} objects cannot support more than one or two clusters.`);
  else if (prof.p && prof.n / prof.p < 3) add('warn', 'Fewer than 3 objects per variable', 'Distances in high dimensions become similar for all pairs; consider clustering on principal components (Block 3 offers it).');
  const missAct = prof.active ? prof.active.reduce((a, c) => a + c.missing, 0) : 0;
  if (missAct) add('warn', `${missAct} missing value${missAct > 1 ? 's' : ''} among the active variables`, 'Choose below whether to drop those rows or impute them. Gower distance (Block 3) can also skip missing pairs.');
  if (prof.type === 'mixed') add('info', 'Mixed variable types', 'Quantitative, categorical and binary variables together: the natural route is <b>Gower distance + PAM</b>. Standardisation is handled inside Gower.');
  if (prof.type === 'ecological') add('info', 'Looks like a community (species × site) table', 'Asymmetric coefficients (Bray–Curtis, Jaccard) or the Hellinger transformation are recommended; do not use raw Euclidean distances.');
  if (prof.type === 'quant' && prof.disparity > 20) add('warn', 'Spreads differ by more than 20×', 'Without standardisation the variable with the largest units decides the clusters.');
  if (!label) add('info', 'No label column', 'Row numbers will be used as object names. Mark an ID column as <b>Object label</b> to see names on the dendrogram.');
  const hinted = state.columns.filter(c => c.hintCodes && c.role === 'active');
  if (hinted.length) add('info', 'Integer codes treated as quantitative', `${hinted.map(c => esc(c.name)).join(', ')}: few distinct integers. If they are categories, set the type to nominal or ordinal.`);
  if (prof.active && prof.active.some(c => c.constant)) add('warn', 'Constant variables', 'A variable without variation contributes nothing to the distances and is dropped.');
  /* recommendation */
  const R = recommend(prof); state.recommend = R;
  el('recoBox').innerHTML = `<h4>Recommended route for these data</h4><div class="reco-row"><div><b>Preprocessing</b>${R.transform !== 'none' ? esc({ log: 'log(x + 1)', sqrt: 'square root', hellinger: 'Hellinger' }[R.transform] || R.transform) + ' → ' : ''}${esc({ none: 'no scaling', zscore: 'z-scores', range: 'range 0–1', robust: 'robust' }[R.scaling])}</div><div><b>Dissimilarity</b>${esc(R.distance)}</div><div><b>Method</b>${esc(R.method)}</div><div><b>Also try</b>${esc(R.alt)}</div></div><p class="hint" style="margin:8px 0 0">${esc(R.why)}</p>`;
  if (!state.prep.userScaling) { el('scalingSel').value = R.scaling; el('transformSel').value = R.transform; }
  updatePrepHelp();
  el('applyBtn').disabled = !prof.p;
}
function updatePrepHelp() {
  const sc = el('scalingSel').value, tr = el('transformSel').value;
  el('scalingHelp').textContent = {
    none: 'Variables keep their units; the largest spreads dominate the distance.',
    zscore: 'Each variable gets mean 0 and SD 1 (the usual choice for Euclidean distance).',
    range: 'Each variable is mapped to 0–1 by (x − min)/(max − min); keeps the shape, sensitive to outliers.',
    robust: '(x − median)/IQR: like z-scores but resistant to extreme values.',
    maxabs: 'x / max|x|: keeps zeros at zero, useful for sparse data.',
  }[sc];
  el('transformHelp').textContent = {
    none: 'Values used as they are.',
    log: 'log(x + 1) per cell: compresses large values, keeps zeros. For skewed positive data.',
    sqrt: '√x per cell: milder than log; the classical variance-stabilising step for counts.',
    hellinger: 'Row-wise: √(x / row total). Makes abundance data suitable for Euclidean distance, Ward and k-means.',
    chord: 'Row-wise: x / √Σx². Each object becomes a unit vector; distances then reflect profile shape.',
    total: 'Row-wise: x / row total (relative abundances / profiles).',
    pa: 'Presence–absence: every value > 0 becomes 1.',
  }[tr];
  const rowwise = ['hellinger', 'chord', 'total', 'pa'].includes(tr);
  el('transformScope').textContent = rowwise ? (state.profile && state.profile.counts.count ? 'Applied to the count / abundance columns.' : 'Applied to all quantitative columns (no count columns were detected).') : (tr === 'none' ? '' : 'Applied to quantitative and count columns with non-negative values.');
}

/* ============================================================
   Preprocessing → numeric working matrix
   ============================================================ */
function applyPrep() {
  const prep = state.prep;
  prep.missing = el('missingSel').value; prep.scaling = el('scalingSel').value; prep.transform = el('transformSel').value; prep.ordinalAs = el('ordinalSel').value;
  if (state.isDistance) {
    const dm = state.distInput;
    const mds = S.cmdscale(dm.D);
    Object.assign(state, { X: mds.points, Xnames: mds.points[0].map((_, j) => 'MDS' + (j + 1)), Xkinds: mds.points[0].map(() => 'quant'), Xdummy: mds.points[0].map(() => false), labels: dm.labels, groups: null, rowIndex: dm.labels.map((_, i) => i), cat: [], catNames: [], numRaw: null, D0: dm.D, mdsPct: mds.pct });
    prep.dropped = 0; prep.imputed = 0;
    runEDA();
    return;
  }
  const act = state.columns.filter(c => c.role === 'active' && !c.constant && c.n > 0);
  const label = state.columns.find(c => c.role === 'label'), group = state.columns.find(c => c.role === 'group');
  const n = state.rawRows.length;
  /* rows */
  let rowIndex = state.rawRows.map((_, i) => i);
  let dropped = 0, imputed = 0;
  if (prep.missing === 'drop') { rowIndex = rowIndex.filter(i => act.every(c => !isMissing(c.values[i]))); dropped = n - rowIndex.length; }
  /* per-variable numeric encodings */
  const numCols = [], numNames = [], numKinds = [], numRaw = [];
  const cat = [], catNames = [];
  const dummies = [], dummyNames = [];
  act.forEach(c => {
    if (c.kind === 'quant' || c.kind === 'count') {
      const v = rowIndex.map(i => toNumber(c.values[i], state.decimal));
      const fill = c.kind === 'count' ? S.median(v.filter(x => x != null)) : S.mean(v.filter(x => x != null));
      const filled = v.map(x => { if (x == null) { imputed++; return fill; } return x; });
      numCols.push(filled); numNames.push(c.name); numKinds.push(c.kind); numRaw.push(filled.slice());
    } else if (c.kind === 'ordinal') {
      const ord = c.order || c.levels; const mode = S.median(rowIndex.map(i => ord.indexOf(String(c.values[i]).trim())).filter(k => k >= 0));
      const v = rowIndex.map(i => { const k = ord.indexOf(String(c.values[i]).trim()); if (k < 0) { imputed++; return mode; } return k; });
      const vals = prep.ordinalAs === 'numeric' && c.num.length ? rowIndex.map((i, t) => { const x = toNumber(c.values[i], state.decimal); return x == null ? +ord[Math.round(v[t])] : x; }) : v;
      numCols.push(vals); numNames.push(c.name); numKinds.push('ordinal'); numRaw.push(vals.slice());
      cat.push(rowIndex.map(i => String(c.values[i]).trim())); catNames.push(c.name);
    } else if (c.kind === 'binary') {
      const one = String(c.binary.one).toLowerCase();
      const cnt1 = rowIndex.filter(i => String(c.values[i]).trim().toLowerCase() === one).length, mode = cnt1 * 2 >= rowIndex.length ? 1 : 0;
      const v = rowIndex.map(i => { if (isMissing(c.values[i])) { imputed++; return mode; } return String(c.values[i]).trim().toLowerCase() === one ? 1 : 0; });
      numCols.push(v); numNames.push(c.name); numKinds.push('binary'); numRaw.push(v.slice());
    } else {
      let mode = null, best = 0; Object.entries(c.levelCounts).forEach(([k, v]) => { if (v > best) { best = v; mode = k; } });
      const v = rowIndex.map(i => { if (isMissing(c.values[i])) { imputed++; return mode; } return String(c.values[i]).trim(); });
      cat.push(v); catNames.push(c.name);
      const lv = c.levels.slice(0, 40);
      lv.forEach(l => { dummies.push(v.map(x => x === l ? 1 : 0)); dummyNames.push(c.name + '=' + l); });
    }
  });
  /* transformations */
  const tr = prep.transform;
  if (tr !== 'none') {
    const isRow = ['hellinger', 'chord', 'total', 'pa'].includes(tr);
    let target = numKinds.map((k, j) => j).filter(j => numKinds[j] === 'count');
    if (!target.length) target = numKinds.map((k, j) => j).filter(j => numKinds[j] === 'quant');
    const nonNeg = target.every(j => numCols[j].every(x => x >= 0));
    if (!nonNeg && (tr === 'log' || tr === 'sqrt' || isRow)) showMessage('prepMessages', 'warning', 'Some values are negative: the transformation was applied only where possible (log/sqrt use |x|; row-wise transformations were skipped).');
    if (isRow && nonNeg) {
      rowIndex.forEach((_, t) => {
        const vals = target.map(j => numCols[j][t]);
        const tot = vals.reduce((a, b) => a + b, 0), norm = Math.sqrt(vals.reduce((a, b) => a + b * b, 0));
        target.forEach((j, q) => {
          const x = vals[q];
          numCols[j][t] = tr === 'pa' ? (x > 0 ? 1 : 0) : tr === 'total' ? (tot ? x / tot : 0) : tr === 'chord' ? (norm ? x / norm : 0) : (tot ? Math.sqrt(x / tot) : 0);
        });
      });
    } else if (tr === 'log') target.forEach(j => { numCols[j] = numCols[j].map(x => Math.log1p(Math.abs(x)) * Math.sign(x || 1)); });
    else if (tr === 'sqrt') target.forEach(j => { numCols[j] = numCols[j].map(x => Math.sqrt(Math.abs(x)) * Math.sign(x || 1)); });
  }
  /* scaling (not for binary) */
  const sc = prep.scaling;
  numCols.forEach((v, j) => {
    if (numKinds[j] === 'binary' || sc === 'none') return;
    const m = S.mean(v), sd = S.sd(v), mn = S.min(v), mx = S.max(v), med = S.median(v), iqr = S.iqr(v), ma = Math.max(...v.map(Math.abs));
    numCols[j] = v.map(x => sc === 'zscore' ? (sd > 0 ? (x - m) / sd : 0) : sc === 'range' ? (mx > mn ? (x - mn) / (mx - mn) : 0) : sc === 'robust' ? (iqr > 0 ? (x - med) / iqr : (sd > 0 ? (x - m) / sd : 0)) : (ma > 0 ? x / ma : 0));
  });
  /* dummy columns scaled so that one nominal variable weighs like one quantitative variable */
  const X = rowIndex.map((_, t) => numCols.map(c => c[t]).concat(dummies.map(d => d[t] * (sc === 'none' ? 1 : 0.7071))));
  Object.assign(state, {
    X, Xnames: numNames.concat(dummyNames), Xkinds: numKinds.concat(dummyNames.map(() => 'nominal')), Xdummy: numNames.map(() => false).concat(dummyNames.map(() => true)),
    numRaw: rowIndex.map((_, t) => numRaw.map(c => c[t])), numNames, numKinds, cat: rowIndex.map((_, t) => cat.map(c => c[t])), catNames,
    labels: rowIndex.map(i => label ? String(label.values[i]).trim() : String(i + 1)),
    groups: group ? rowIndex.map(i => isMissing(group.values[i]) ? '(missing)' : String(group.values[i]).trim()) : null,
    rowIndex, D0: null,
  });
  prep.dropped = dropped; prep.imputed = imputed;
  clearMessages('prepMessages');
  if (dropped) showMessage('prepMessages', dropped / n > 0.2 ? 'warning' : 'info', `${dropped} row${dropped > 1 ? 's' : ''} with missing values dropped (${fmtPct(dropped / n, 0)}). ${rowIndex.length} objects remain.`);
  if (imputed) showMessage('prepMessages', 'info', `${imputed} missing cell${imputed > 1 ? 's' : ''} imputed (mean for quantitative, median for counts and ordinal, mode for categorical).`);
  if (!X.length || !X[0].length) { showMessage('prepMessages', 'error', 'Nothing left to analyse: no objects or no active variables.'); return; }
  runEDA();
}

/* ============================================================
   Exploratory analysis and clustering tendency
   ============================================================ */
/* Hopkins statistic with a Monte-Carlo null: the same statistic is computed on uniform data with the
   same n, p and bounding box, which gives a calibrated band and a p-value instead of the Beta(m, m)
   approximation (valid only for small m). m = half of the objects (10 ≤ m ≤ 200). */
function hopkins(X, seed) {
  const n = X.length, p = X[0].length;
  const m = Math.max(2, Math.min(n - 1, Math.max(10, Math.round(0.5 * n)), 200));
  const box = data => ({ lo: data[0].map((_, j) => S.min(data.map(r => r[j]))), hi: data[0].map((_, j) => S.max(data.map(r => r[j]))) });
  const nnOf = data => (q, skip) => { let best = Infinity; for (let i = 0; i < data.length; i++) { if (i === skip) continue; let d = 0; const r = data[i]; for (let j = 0; j < p; j++) { const t = r[j] - q[j]; d += t * t; if (d >= best) break; } if (d < best) best = d; } return Math.sqrt(best); };
  const evalH = (data, r) => {
    const { lo, hi } = box(data), nn = nnOf(data);
    let u = 0, w = 0;
    const idx = data.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (let t = 0; t < m; t++) { u += nn(lo.map((l, j) => l + r() * (hi[j] - l)), -1); w += nn(data[idx[t]], idx[t]); }
    return u + w > 0 ? u / (u + w) : 0.5;
  };
  const runs = [];
  for (let rep = 0; rep < 20; rep++) runs.push(evalH(X, rng(seed + rep * 7919)));
  const H = S.mean(runs);
  const { lo, hi } = box(X);
  const nsim = n * p * m > 4e6 ? 20 : n * p * m > 5e5 ? 40 : 80;
  const nullH = [];
  for (let s = 0; s < nsim; s++) {
    const r = rng(seed * 3 + s * 104729 + 17);
    const U = Array.from({ length: n }, () => lo.map((l, j) => l + r() * (hi[j] - l)));
    nullH.push(evalH(U, r));
  }
  const ge = nullH.filter(h => h >= H).length;
  return { H, sd: S.sd(runs), runs, m, nullH, nsim, lo: S.quantile(nullH, 0.025), hi: S.quantile(nullH, 0.975), nullMean: S.mean(nullH), pval: (ge + 1) / (nsim + 1) };
}
function vatOrder(D) {
  const n = D.length, order = [], inSet = new Array(n).fill(false);
  let start = 0, best = -1;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][j] > best) { best = D[i][j]; start = i; }
  order.push(start); inSet[start] = true;
  const dmin = D[start].slice();
  for (let k = 1; k < n; k++) {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < n; i++) if (!inSet[i] && dmin[i] < bd) { bd = dmin[i]; bi = i; }
    order.push(bi); inSet[bi] = true;
    for (let i = 0; i < n; i++) if (!inSet[i] && D[bi][i] < dmin[i]) dmin[i] = D[bi][i];
  }
  return order;
}
function runEDA() {
  const X = state.X, n = X.length, p = X[0].length;
  const eda = { n, p, names: state.Xnames, kinds: state.Xkinds, dummy: state.Xdummy, labels: state.labels, groups: state.groups, isDistance: state.isDistance };
  eda.D = state.isDistance ? state.D0 : HC.dist(X);
  /* Hopkins in the working space; beyond 12 dimensions the leading principal components (≥ 90 % of the
     variance, 2–10 axes) are used instead, because nearest-neighbour distances lose contrast in many
     dimensions. (The rotation slightly changes the shape of the data support, so this is only done when needed.) */
  let Xh = X, hk = p;
  if ((p > 12 || state.isDistance) && n > 3 && p > 2) {
    const pcAll = S.pca(X, { scale: false });
    let cum = 0, k = 0; while (k < pcAll.pct.length && cum < 0.9) { cum += pcAll.pct[k]; k++; }
    hk = Math.max(2, Math.min(10, k, p));
    Xh = pcAll.scores.map(s => s.slice(0, hk));
    eda.hopkinsPct = pcAll.pct.slice(0, hk).reduce((a, b) => a + b, 0);
  }
  eda.hopkins = n >= 6 ? hopkins(Xh, 2026) : null;
  if (eda.hopkins) eda.hopkins.k = hk;
  if (state.isDistance) { eda.pca = { scores: X.map(r => [r[0], r[1] == null ? 0 : r[1]]), pct: state.mdsPct, kind: 'MDS' }; }
  else {
    const pc = S.pca(X, { scale: false, k: 2 });
    eda.pca = { scores: pc.scores.map(s => [s[0], s[1] == null ? 0 : s[1]]), pct: pc.pct, kind: 'PCA' };
  }
  eda.vat = { order: vatOrder(eda.D) };
  eda.maha = (!state.isDistance && n > 4) ? S.mahalanobis(X) : null;
  const qIdx = eda.kinds.map((k, j) => j).filter(j => !eda.dummy[j] && eda.kinds[j] !== 'binary');
  eda.corr = !state.isDistance && qIdx.length >= 2 ? { names: qIdx.map(j => eda.names[j]), R: S.corMatrix(X.map(r => qIdx.map(j => r[j]))) } : null;
  eda.varStats = eda.names.map((nm, j) => { const v = X.map(r => r[j]); return { name: nm, kind: eda.kinds[j], dummy: eda.dummy[j], sd: S.sd(v), box: S.boxStats(v), raw: state.numRaw && j < state.numRaw[0].length ? S.boxStats(state.numRaw.map(r => r[j])) : null }; });
  state.eda = eda;
  renderEDA(eda);
  P2.mountAll(eda);
  state.ready = true;
  enableStep(3, true);
  el('nextBtn2').disabled = false;
  el('edaCard').style.display = '';
  el('edaCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.dispatchEvent(new CustomEvent('datachange'));
}
function renderEDA(eda) {
  const tiles = [], checks = [];
  let bad = 0, warn = 0;
  const H = eda.hopkins;
  tiles.push(['Objects', eda.n, state.prep.dropped ? `${state.prep.dropped} dropped` : 'after preprocessing']);
  tiles.push(['Variables in the working matrix', eda.p, eda.dummy.some(d => d) ? `${eda.dummy.filter(d => !d).length} numeric + ${eda.dummy.filter(d => d).length} dummy` : (eda.isDistance ? 'MDS axes from your matrix' : 'active columns')]);
  const pEff = eda.dummy.filter(d => !d).length + (eda.dummy.some(d => d) ? (state.catNames || []).length : 0) || eda.p;
  const np = eda.n / pEff;
  if (!eda.isDistance) tiles.push(['Objects per variable', fmtNum(np, 1), np >= 5 ? 'comfortable' : np >= 3 ? 'tight' : 'high-dimensional', np >= 5 ? 'ok' : np >= 3 ? 'warn' : 'bad']);
  if (H) {
    const sig = H.pval <= 0.05, strong = H.H >= 0.7;
    const lvl = sig && strong ? 'ok' : (sig || H.H >= 0.62) ? 'warn' : 'bad';
    const where = `${H.k < eda.p ? `on ${H.k} PCs (${fmtPct(eda.hopkinsPct, 0)} of the variance) ` : ''}with m = ${H.m}, averaged over 20 draws`;
    tiles.push(['Hopkins statistic', fmtFixed(H.H, 3), `uniform data: ${fmtFixed(H.lo, 2)}–${fmtFixed(H.hi, 2)} · p ${H.pval < 0.001 ? '< 0.001' : '= ' + fmtFixed(H.pval, 3)}`, lvl]);
    const nullTxt = `Uniform data with the same n, p and range give H between ${fmtFixed(H.lo, 2)} and ${fmtFixed(H.hi, 2)} (${H.nsim} simulations, mean ${fmtFixed(H.nullMean, 2)}).`;
    if (lvl === 'ok') checks.push(['ok', `Clear clustering tendency (H = ${fmtFixed(H.H, 3)}, p ${H.pval < 0.001 ? '< 0.001' : '= ' + fmtFixed(H.pval, 3)})`, `Computed ${where}. ${nullTxt} The data are far from spatial randomness: clusters are worth looking for.`]);
    else if (lvl === 'warn') { warn++; checks.push(['warn', `${sig ? 'Detectable but modest' : 'Moderate'} clustering tendency (H = ${fmtFixed(H.H, 3)}, p ${H.pval < 0.001 ? '< 0.001' : '= ' + fmtFixed(H.pval, 3)})`, `Computed ${where}. ${nullTxt} ${sig ? 'The value is beyond what uniform data produce, but not by a wide margin: expect few, well-populated groups or gradients rather than tight clusters. With few objects per group H stays modest even when the PCA map shows clear clouds — let the map and the VAT image weigh in.' : 'Some structure, possibly gradients rather than discrete groups. Look at the PCA map and the VAT image before trusting any partition.'}`]); }
    else { bad++; checks.push(['bad', `Weak or no clustering tendency (H = ${fmtFixed(H.H, 3)}, p = ${fmtFixed(H.pval, 3)})`, `Computed ${where}. ${nullTxt} The nearest-neighbour structure is what random points give. Any algorithm will still return clusters, but they may be arbitrary. Reconsider the variables, the scaling or the objects.`]); }
  }
  const pct2 = eda.pca.pct.slice(0, 2).reduce((a, b) => a + b, 0);
  tiles.push([`${eda.pca.kind}: first two axes`, fmtPct(pct2, 0), 'of the total variance', pct2 >= 0.5 ? 'ok' : pct2 >= 0.3 ? 'warn' : '']);
  if (eda.maha) {
    const out = eda.maha.d2.filter(d => d > eda.maha.threshold).length, strict = eda.maha.d2.filter(d => d > eda.maha.thresholdStrict).length;
    tiles.push(['Multivariate outliers', out, `D² > χ²₀.₉₇₅ (${strict} extreme)`, out / eda.n > 0.1 ? 'warn' : 'ok']);
    if (strict) { warn++; checks.push(['warn', `${strict} extreme object${strict > 1 ? 's' : ''} (Mahalanobis D² beyond the 99.9 % quantile)`, `${eda.labels.map((l, i) => [l, eda.maha.d2[i]]).filter(x => x[1] > eda.maha.thresholdStrict).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => esc(x[0])).join(', ')}. Hierarchical methods will isolate them in their own branch and k-means will drag centres toward them. Consider PAM, a robust scaling, or removing them after checking the raw values.`]); }
    else if (out / eda.n > 0.1) { warn++; checks.push(['warn', `${out} objects beyond the 97.5 % Mahalanobis quantile`, 'More than 10 % of the objects are far from the multivariate centre: heavy tails or a genuinely elongated structure. PAM and single linkage are less sensitive than k-means and Ward.']); }
    else checks.push(['ok', 'No extreme multivariate outliers', `${out} object${out === 1 ? '' : 's'} beyond the 97.5 % quantile, within what a well-behaved sample shows.`]);
  }
  if (eda.corr) {
    let mx = 0, pair = null; const R = eda.corr.R;
    for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) if (Math.abs(R[a][b]) > mx) { mx = Math.abs(R[a][b]); pair = [eda.corr.names[a], eda.corr.names[b]]; }
    tiles.push(['Strongest correlation', fmtFixed(mx, 2), pair ? `${pair[0]} × ${pair[1]}` : '', mx > 0.95 ? 'warn' : 'ok']);
    if (mx > 0.95) { warn++; checks.push(['warn', `${esc(pair[0])} and ${esc(pair[1])} are nearly redundant (|r| = ${fmtFixed(mx, 2)})`, 'Redundant variables count twice in a Euclidean distance. Keep one of them, or cluster on principal components (Block 3 offers it) to remove the redundancy.']); }
    else checks.push(['ok', 'No redundant variables', `Largest absolute correlation ${fmtFixed(mx, 2)}. Each variable brings its own information to the distance.`]);
  }
  if (!eda.isDistance) {
    const sds = eda.varStats.filter(v => !v.dummy && v.kind !== 'binary').map(v => v.sd).filter(s => s > 0);
    if (sds.length > 1) {
      const ratio = Math.max(...sds) / Math.min(...sds);
      tiles.push(['SD ratio (max / min)', fmtNum(ratio, 1), 'in the working matrix', ratio > 10 ? 'warn' : 'ok']);
      const rowwise = ['hellinger', 'chord', 'total', 'pa'].includes(state.prep.transform);
      if (ratio > 10 && state.prep.scaling === 'none' && !rowwise) { bad++; checks.push(['bad', 'Variables with very different spreads and no scaling', `The largest SD is ${fmtNum(ratio, 0)}× the smallest: the distance is essentially that variable alone. Choose z-scores or range scaling above and apply again.`]); }
      else if (ratio > 10) { warn++; checks.push(['warn', 'Spreads still differ after transformation', rowwise ? 'Row-wise transformations keep the differences between species: that is intended for ecological data, but check that a single abundant species is not driving everything.' : 'Even after scaling one variable spreads much more than the others (heavy tails or many identical values). Consider a robust scaling or a log transformation.']); }
    }
  }
  if (state.prep.dropped / (state.rawRows.length || 1) > 0.2) { warn++; checks.push(['warn', 'Many rows dropped for missing values', `${fmtPct(state.prep.dropped / state.rawRows.length, 0)} of the objects were removed. Imputation keeps them; Gower distance (Block 3) can also ignore missing pairs.`]); }
  if (eda.groups) {
    const g = [...new Set(eda.groups)];
    checks.push(['info', `Known grouping with ${g.length} groups will be used for external validation`, 'It colours the maps below and, in Block 6, feeds the Rand, adjusted Rand and NMI indices. It is never used to build the clusters.']);
  }
  if (!eda.isDistance && np < 3) { warn++; }
  if (eda.n < 8) { bad++; }
  const grade = bad >= 2 ? 'D' : bad === 1 ? 'C' : warn > 2 ? 'C' : warn ? 'B' : 'A';
  const gradeText = { A: 'The data are ready for clustering: clear tendency, balanced variables, no red flags.', B: 'Good to go, with the caveats listed below. Keep them in mind when you interpret the clusters.', C: 'Clustering is possible but fragile. Address the flagged points, or treat the results as exploratory.', D: 'These data do not support a clustering analysis as they stand. Revise the variables, the scaling or the objects.' }[grade];
  el('edaVerdict').innerHTML = `<div class="grade g-${grade.toLowerCase()}">${grade}<small>readiness</small></div><div class="v-text"><b>${gradeText}</b><br><span class="hint" style="margin:0">${eda.isDistance ? 'Input: a distance matrix, used as supplied (no transformation or scaling; the map and the tendency statistics come from its principal coordinates).' : `Preprocessing: ${esc({ drop: 'rows with missing values dropped', impute: 'missing values imputed' }[state.prep.missing])} · transformation: ${esc(state.prep.transform)} · scaling: ${esc(state.prep.scaling)}.`}</span></div>`;
  statTiles('edaTiles', tiles);
  const host = el('edaChecks'); host.innerHTML = '';
  checks.forEach(([level, title, text]) => host.appendChild(mk('div', { class: 'check-item ' + level }, `<div class="ck-icon">${level === 'ok' ? '✅' : level === 'bad' ? '⛔' : level === 'warn' ? '⚠️' : 'ℹ️'}</div><div class="ck-body"><div class="ck-title">${title}</div><div class="ck-text">${text}</div></div>`)));
  const R = state.recommend || recommend(profileDataset());
  el('edaReco').innerHTML = `<h4>What to do next</h4><div class="reco-row"><div><b>Dissimilarity (Block 3)</b>${esc(R.distance)}</div><div><b>Clustering (Blocks 4–5)</b>${esc(R.method)}</div><div><b>Also try</b>${esc(R.alt)}</div><div><b>Number of clusters</b>${eda.groups ? `start around ${new Set(eda.groups).size} (your known groups) and let Block 6 decide` : 'let Block 6 compare k = 2…10'}</div></div>`;
  state.grade = grade;
}

/* ============================================================
   Downloads & init
   ============================================================ */
function downloadWorking() {
  if (!state.X) return;
  const header = ['Object'].concat(state.groups ? ['Group'] : []).concat(state.Xnames);
  const rows = state.X.map((r, i) => [state.labels[i]].concat(state.groups ? [state.groups[i]] : []).concat(r.map(v => +v.toFixed(6))));
  download(matrixToCSV(header, rows), slug(state.fileName) + '_preprocessed.csv', 'text/csv;charset=utf-8');
}
function init() {
  if (!el('fileInput')) return;
  state.prep = { missing: 'drop', scaling: 'zscore', transform: 'none', ordinalAs: 'ranks', userScaling: false, dropped: 0, imputed: 0 };
  const dz = el('dropZone'), fi = el('fileInput');
  el('dzIcon').innerHTML = Art.upload();
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  fi.addEventListener('change', () => { if (fi.files[0]) readFile(fi.files[0]); fi.value = ''; });
  el('sheetSelect').addEventListener('change', () => loadSheet(el('sheetSelect').value));
  el('pasteBtn').addEventListener('click', loadPasted);
  el('applyBtn').addEventListener('click', applyPrep);
  el('downloadWorkingBtn').addEventListener('click', downloadWorking);
  el('nextBtn2').addEventListener('click', () => goStep(3));
  ['scalingSel', 'transformSel'].forEach(id => el(id).addEventListener('change', () => { state.prep.userScaling = true; updatePrepHelp(); }));
  els('.example-btn').forEach(b => b.addEventListener('click', () => b.dataset.sim ? simulate(b.dataset.sim) : loadExample(b.dataset.path, b.dataset.name)));
  const leg = el('roleLegend');
  Object.entries(ROLES).forEach(([k, r]) => leg.appendChild(mk('div', { class: 'role-item' }, `<span class="r-dot" style="background:${r.color}"></span><div><b>${r.label}</b><span>${r.help}</span></div>`)));
  const kl = el('kindLegend');
  Object.entries(KINDS).forEach(([k, v]) => kl.appendChild(mk('div', { class: 'role-item' }, `<span class="pill ${v.cls}" style="margin-top:2px">${v.label}</span><div><span>${v.help}</span></div>`)));
  updatePrepHelp();
}
document.addEventListener('DOMContentLoaded', init);
Object.assign(window, { parseCSV, toNumber, isMissing, loadExample, profileColumns, hopkins, vatOrder });
})();
