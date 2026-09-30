/* ClusteringPro — global state and shared utilities.
   No ES modules: everything hangs from window so the app also works from file:// */

const state = {
  /* --- Block 2: data --- */
  fileName: null,
  sheetName: null,
  sheets: [],
  workbook: null,
  rawHeader: [],
  rawRows: [],          // array of arrays
  columns: [],          // [{name, kind, role, n, missing, unique, stats..., levels[]}]
  /* role: 'active' | 'supplementary' | 'label' | 'group' | 'id' | 'excluded'
     kind: 'quantitative' | 'binary' | 'nominal' | 'ordinal' | 'count' */
  roles: { active: [], supplementary: [], id: null, group: null },
  scaling: 'zscore',
  ready: false,
  /* later blocks */
  dist: null,            // {method, matrix, labels}
  hclust: null,          // {method, merge, height, order}
  partition: null,       // {method, k, cluster[], centers}
  validation: null,
};
window.state = state;

/* ---------------- DOM ---------------- */
function el(id) { return document.getElementById(id); }
function els(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
function mk(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'style') n.setAttribute('style', attrs[k]);
    else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  if (html != null) n.innerHTML = html;
  return n;
}
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showMessage(container, type, text) {
  if (typeof container === 'string') container = el(container);
  if (!container) return null;
  const div = mk('div', { class: 'msg msg-' + type }, text);
  /* errors and warnings are announced to screen readers */
  if (window.LABG) LABG.messageRole(div, type);
  container.appendChild(div);
  /* an error ends the open wait without the tick */
  if (type === 'error' && cpWork.current) cpWork.current._failed = true;
  return div;
}

/* Waiting window (LABG Suite): opens only if the work lasts more than 300 ms.
   cpAfterPaint lets the browser paint the window first, then runs the work and closes it
   (tick when it went well, silently when an error was shown or cpNoResult() was called). */
function cpWork(es, en) {
  if (!window.LABG || !LABG.work) return null;
  const w = LABG.work({ title: LABG.t(es, en || es), delay: 300 });
  cpWork.current = w; return w;
}
cpWork.current = null;
function cpEnd(w) {
  if (cpWork.current === w) cpWork.current = null;
  if (w && !w.ended) { if (w._failed) w.close(); else w.done(); }
}
function cpAfterPaint(f, w) {
  const done = () => cpEnd(w);
  return (window.LABG && LABG.nextPaint ? LABG.nextPaint() : new Promise(r => setTimeout(r, 30))).then(f).then(done, e => { console.error(e); if (w) w._failed = true; done(); });
}
/* a run that stops for lack of data (with a warning) ends its wait without the tick */
function cpNoResult() { if (cpWork.current) cpWork.current._failed = true; }
function clearMessages(container) {
  if (typeof container === 'string') container = el(container);
  if (container) container.innerHTML = '';
}

function statTiles(container, tiles) {
  if (typeof container === 'string') container = el(container);
  container.innerHTML = '';
  tiles.forEach(t => {
    const [label, value, sub, level] = Array.isArray(t) ? t : [t.label, t.value, t.sub, t.level];
    const d = mk('div', { class: 'stat-tile' + (level ? ' ' + level : '') });
    d.innerHTML = `<div class="stat-label">${label}</div><div class="stat-value">${value}</div>` +
      (sub ? `<div class="stat-sub">${sub}</div>` : '');
    container.appendChild(d);
  });
}

/* Builds a <table>. columns: [{key,label,get?,fmt?,num?,html?}] */
function buildTable(container, columns, rows, opts) {
  opts = opts || {};
  if (typeof container === 'string') container = el(container);
  container.innerHTML = '';
  const table = mk('table');
  if (opts.caption) table.appendChild(mk('caption', null, opts.caption));
  const thead = mk('thead'), trh = mk('tr');
  columns.forEach(c => {
    const th = mk('th', { class: c.num ? 'num' : null });
    th.innerHTML = c.label != null ? c.label : c.key;
    trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = mk('tbody');
  const shown = opts.limit ? rows.slice(0, opts.limit) : rows;
  shown.forEach(r => {
    const tr = mk('tr');
    if (r && r._class) tr.className = r._class;
    columns.forEach(c => {
      const td = mk('td', { class: c.num ? 'num' : null });
      let v = c.get ? c.get(r) : r[c.key];
      if (c.html) { td.innerHTML = v == null ? '—' : v; tr.appendChild(td); return; }
      if (c.fmt && v != null && v !== '') v = c.fmt(v);
      td.textContent = (v === null || v === undefined || v === '' ||
        (typeof v === 'number' && !isFinite(v))) ? '—' : v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
  if (opts.limit && rows.length > opts.limit) {
    const p = mk('p', { class: 'hint', style: 'padding:6px 12px;margin:0' });
    p.textContent = `Showing ${opts.limit} of ${rows.length} rows.`;
    container.appendChild(p);
  }
  return table;
}

function tableToCSV(table) {
  const rows = [...table.querySelectorAll('tr')].map(tr =>
    [...tr.children].map(td => csvEscape(td.textContent.trim())).join(','));
  return '﻿' + rows.join('\r\n');
}

/* ---------------- numbers ---------------- */
function fmtNum(v, d) {
  if (v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs < 1e-4 || abs >= 1e7) return n.toExponential(d != null ? d : 2);
  return n.toLocaleString('en-US', { maximumFractionDigits: d != null ? d : 3 });
}
function fmtFixed(v, d) {
  if (v === Infinity) return '∞';
  if (v === -Infinity) return '−∞';
  if (v == null || !isFinite(v)) return '—';
  return Number(v).toFixed(d == null ? 3 : d);
}
function fmtP(p) {
  if (p == null || !isFinite(p)) return '—';
  if (p < 0.0001) return '< 0.0001';
  return Number(p).toFixed(4);
}
function fmtPct(x, d) {
  if (x == null || !isFinite(x)) return '—';
  return (x * 100).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d }) + '%';
}

/* ---------------- CSV / downloads ---------------- */
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function matrixToCSV(header, rows) {
  const head = header.map(csvEscape).join(',');
  const body = rows.map(r => r.map(csvEscape).join(','));
  return '﻿' + [head, ...body].join('\r\n');
}
function download(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = mk('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function slug(s) {
  return String(s || 'clusteringpro').replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'clusteringpro';
}

/* ---------------- step navigation ----------------
   Blocks 2 and 8 are open from the start; 3 to 8 are unlocked by the workflow
   (enableStep). A block counts as done once a later block has been unlocked. */
const STEP_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8'];
const stepUnlocked = {};
const stepBtn = n => document.querySelector('.step-btn[data-step="' + n + '"]');
const stepOn = n => { const b = stepBtn(n); return !!b && !b.disabled; };

function goStep(n) {
  els('.step-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + n));
  els('.step-btn').forEach(b => b.classList.toggle('active', b.dataset.step === String(n)));
  document.body.classList.toggle('on-home', String(n) === '1');
  if (window.LABG) {
    LABG.setCurrentStep(n);
    LABG.announce('Block: ' + stepLabel(n));
  }
  refreshStepFooters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.dispatchEvent(new CustomEvent('stepchange', { detail: { step: n } }));
}
function enableStep(n, on) {
  const b = stepBtn(n);
  if (b) b.disabled = (on === false);
  stepUnlocked[String(n)] = (on !== false);
  refreshStepMarks();
  refreshStepFooters();
}

function refreshStepMarks() {
  if (!window.LABG) return;
  STEP_ORDER.forEach((s, i) => {
    if (s === '1') return;
    const later = STEP_ORDER.slice(i + 1).some(t => stepUnlocked[t]);
    LABG.markStep(s, stepOn(s) && later ? 'done' : null);
  });
}

/* Footer of each block: Previous / Next, named after the block's button. */
function stepLabel(n) {
  const b = stepBtn(n); if (!b) return '';
  const c = b.cloneNode(true);
  c.querySelectorAll('.step-num, .step-state').forEach(x => x.remove());
  return b.querySelector('.step-num').textContent.trim() + ' · ' + c.textContent.replace(/\s+/g, ' ').trim();
}
function refreshStepFooters() {
  els('.step-panel').forEach(p => {
    const n = p.id.replace('panel-', '');
    const i = STEP_ORDER.indexOf(n);
    if (i < 0) return;
    let f = p.querySelector(':scope > .step-footer');
    if (!f) {
      f = mk('nav', { class: 'step-footer no-print', 'aria-label': 'Blocks' });
      f.innerHTML = '<button type="button" class="btn btn-secondary prev"></button><button type="button" class="btn btn-primary next"></button>';
      /* data-nav, not data-go: home.js already binds every [data-go] once */
      f.addEventListener('click', e => { const b = e.target.closest('button[data-nav]'); if (b && !b.disabled) goStep(+b.dataset.nav); });
      p.appendChild(f);
    }
    const prev = STEP_ORDER.slice(0, i).reverse().find(stepOn);
    const next = STEP_ORDER.slice(i + 1).find(s => stepBtn(s));
    const bp = f.querySelector('.prev'), bn = f.querySelector('.next');
    bp.hidden = !prev;
    if (prev) { bp.dataset.nav = prev; bp.innerHTML = `← <span><small>Previous</small>${esc(stepLabel(prev))}</span>`; }
    bn.hidden = !next;
    if (next) {
      bn.dataset.nav = next; bn.disabled = !stepOn(next);
      bn.innerHTML = `<span><small>Next</small>${esc(stepLabel(next))}</span> →`;
    }
  });
}

/* Common LABG Suite bar: theme, shortcuts, leave warning and keyboard.
   Only inside the app (a page may load core.js without labg-core.js). */
document.addEventListener('DOMContentLoaded', () => {
  if (!window.LABG) return;
  if (LABG.work) {
    LABG.work.scene = 'cluster';
    LABG.work.tips = [
      ['La estabilidad por bootstrap del Bloque 6 da por estable un grupo con Jaccard medio ≥ 0.75.', 'Block 6 bootstrap stability calls a cluster stable when its mean Jaccard is ≥ 0.75.'],
      ['El botón «Adopt k» lleva el k de consenso a los Bloques 4 y 5.', 'The «Adopt k» button carries the consensus k to Blocks 4 and 5.'],
      ['El paquete ZIP del Bloque 8 guarda cada figura como SVG, además del informe y las tablas en CSV.', 'The Block 8 ZIP package keeps every figure as SVG, plus the report and CSV tables.'],
    ];
  }
  LABG.theme.init('clusteringpro.theme');
  const tb = el('themeBtn');
  if (tb) tb.addEventListener('click', () => LABG.theme.toggle());
  const hb = el('helpBtn');
  if (hb) hb.addEventListener('click', () => LABG.showShortcuts());
  LABG.shortcuts([]);
  LABG.bindStepKeys(n => goStep(+n));
  LABG.guardUnload(() => !!(state.rawRows && state.rawRows.length));
  LABG.setCurrentStep((document.querySelector('.step-btn.active') || {}).dataset?.step || '1');
  refreshStepMarks();
  refreshStepFooters();
});

/* Persisted user preferences (figure style etc.) */
const Prefs = {
  get(k, d) { try { const v = localStorage.getItem('clusteringpro:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('clusteringpro:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

/* Seeded RNG (LCG) shared by illustrations and the playground */
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
function randn(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

Object.assign(window, {
  el, els, mk, esc, showMessage, clearMessages, statTiles, buildTable, tableToCSV,
  fmtNum, fmtFixed, fmtP, fmtPct, csvEscape, matrixToCSV, download, slug,
  goStep, enableStep, Prefs, rng, randn, cpWork, cpEnd, cpAfterPaint, cpNoResult,
});
