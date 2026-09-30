/* ClusteringPro — Block 8 UI: report options, preview, HTML / PDF / ZIP export, methods paragraph. */

(function () {
let lastHtml = null, autoTitle = '';

function opts() {
  return {
    title: el('rpTitle').value.trim() || 'Cluster analysis report', author: el('rpAuthor').value.trim(), notes: el('rpNotes').value.trim(),
    data: el('rpData').checked, dist: el('rpDist').checked, hier: el('rpHier').checked, part: el('rpPart').checked, valid: el('rpValid').checked, profiles: el('rpProfiles').checked,
    methods: el('rpMethods').checked, appendix: el('rpAppendix').checked, rawdata: el('rpRaw').checked,
    summary: el('rpExec').checked, cite: el('rpCite').checked,
    zipFmt: el('rpZipFmt').value, zipRes: +el('rpZipRes').value,
  };
}
function availability() {
  const items = [
    ['rpData', 'Data & exploratory analysis', !!state.eda], ['rpDist', 'Similarity & distance', !!state.dist], ['rpHier', 'Hierarchical clustering', !!state.hclust],
    ['rpPart', 'Partitioning methods', !!state.partition], ['rpValid', 'Optimal k & validation', !!(state.validation && (state.validation.sweep || state.validation.stability || state.validation.external))], ['rpProfiles', 'Profiles & prediction', !!state.profiles],
  ];
  items.forEach(([id, label, ok]) => { const cb = el(id); cb.disabled = !ok; cb.checked = ok; cb.parentElement.classList.toggle('is-off', !ok); cb.parentElement.querySelector('.rp-state').textContent = ok ? 'ready' : 'not run yet'; });
  const figs = Fig.mounted().length;
  el('rpSummary').innerHTML = `<div class="ds-item"><div class="ds-label">Blocks completed</div><div class="ds-value">${items.filter(i => i[2]).length} of 6</div></div><div class="ds-item"><div class="ds-label">Figures as edited</div><div class="ds-value">${figs}</div><div class="ds-sub">embedded as vector graphics</div></div><div class="ds-item"><div class="ds-label">Data set</div><div class="ds-value">${esc(state.fileName || '—')}</div><div class="ds-sub">${state.dist ? state.dist.n + ' objects' : ''}</div></div>`;
  /* the suggested title follows the data set until the user types their own */
  if (state.fileName && (!el('rpTitle').value || el('rpTitle').value === autoTitle)) { autoTitle = `Cluster analysis of ${state.fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ')}`; el('rpTitle').value = autoTitle; }
  const any = items.some(i => i[2]);
  ['rpPreview', 'rpHtml', 'rpPrint', 'rpZip', 'rpMethodsBtn'].forEach(id => el(id).disabled = !any);
}
function preview() {
  const o = opts();
  lastHtml = Report.build(o);
  const fr = el('rpFrame'); fr.srcdoc = lastHtml; el('rpPreviewWrap').style.display = '';
  el('rpInfo').textContent = `${Math.round(lastHtml.length / 1024)} KB · ${(lastHtml.match(/<figure/g) || []).length} figures · ${(lastHtml.match(/<table/g) || []).length} tables`;
}
async function copyMethods() {
  const txt = Report.methodsText().replace(/<[^>]+>/g, '');
  try { await navigator.clipboard.writeText(txt); showMessage('rpMessages', 'success', 'Methods paragraph copied to the clipboard.'); }
  catch (e) { el('rpMethodsText').value = txt; showMessage('rpMessages', 'info', 'Select and copy the text below.'); }
  el('rpMethodsText').value = txt; el('rpMethodsText').style.display = '';
}
function init() {
  if (!el('rpPreview')) return;
  el('rpPreview').addEventListener('click', () => cpAfterPaint(preview, cpWork('Armando el informe', 'Building the report')));
  el('rpHtml').addEventListener('click', () => {
    const save = () => download(lastHtml, slug(opts().title) + '.html', 'text/html;charset=utf-8');
    if (lastHtml) save(); else cpAfterPaint(() => { preview(); save(); }, cpWork('Armando el informe', 'Building the report'));
  });
  el('rpPrint').addEventListener('click', () => { if (!lastHtml) preview(); const w = window.open('', '_blank'); if (!w) { showMessage('rpMessages', 'warning', 'Allow pop-ups to print.'); return; } w.document.write(lastHtml); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 700); });
  el('rpZip').addEventListener('click', () => {
    const b = el('rpZip'); b.disabled = true;
    const w = cpWork('Empaquetando el informe, los datos y las figuras', 'Packing the report, data and figures');
    if (!w) b.textContent = 'Packing…';
    const o = Object.assign(opts(), { onProgress: (i, n) => { if (w) w.update(i / (n || 1), LABG.t(`Figura ${i + 1} de ${n}`, `Figure ${i + 1} of ${n}`)); } });
    cpAfterPaint(async () => {
      try { if (!lastHtml) preview(); download(await Report.zip(o, lastHtml), slug(o.title) + '_package.zip'); }
      catch (e) { showMessage('rpMessages', 'error', 'Could not build the package: ' + esc(e.message)); }
      finally { b.disabled = false; b.textContent = '⬇ Full package (ZIP)'; }
    }, w);
  });
  el('rpMethodsBtn').addEventListener('click', copyMethods);
  ['datachange', 'distchange', 'hclustchange', 'partitionchange', 'validationchange', 'profilechange'].forEach(ev => document.addEventListener(ev, () => { lastHtml = null; availability(); }));
  document.addEventListener('stepchange', e => { if (e.detail.step === 8) availability(); });
  availability();
}
document.addEventListener('DOMContentLoaded', init);
/* used by the manual's screenshot tool to print the report without a window */
window.B8 = { opts, preview };
})();
