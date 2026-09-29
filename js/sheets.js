/* ClusteringPro — spreadsheet reader (.xlsx, .xlsm, .ods). A workbook of those formats is a ZIP archive
   of XML files: this module opens the archive with the decompressor that the browser already has
   (DecompressionStream) and reads the XML with DOMParser. No external library is used. */

const Sheets = {};
const SHEET_EXT = ['xlsx', 'xlsm', 'ods'];
const OLD_EXT = ['xls', 'xlsb', 'xlt', 'xla'];
Sheets.canRead = ext => SHEET_EXT.includes(String(ext).toLowerCase());
Sheets.isOldFormat = ext => OLD_EXT.includes(String(ext).toLowerCase());

/* ---------- ZIP archive ---------- */

function unzip(buffer) {
  const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0 && i >= u8.length - 22 - 65535; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('the file is not a spreadsheet in the .xlsx, .xlsm or .ods format');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  if (off === 0xFFFFFFFF) throw new Error('the workbook uses the ZIP64 layout, which this reader does not open');
  const dec = new TextDecoder('utf-8'), entries = {};
  for (let i = 0; i < count && dv.getUint32(off, true) === 0x02014b50; i++) {
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), elen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const local = dv.getUint32(off + 42, true);
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nlen));
    const lnlen = dv.getUint16(local + 26, true), lelen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lelen;
    entries[name] = { method, data: u8.subarray(start, start + csize) };
    off += 46 + nlen + elen + clen;
  }
  return entries;
}

async function entryBytes(entry) {
  if (!entry) return null;
  if (entry.method === 0) return entry.data;
  if (entry.method !== 8) throw new Error('the workbook uses a compression method that this reader does not open');
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser is too old to open .xlsx and .ods files; save the table as .csv');
  const stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function entryXml(entries, name) {
  const bytes = await entryBytes(entries[name]);
  if (!bytes) return null;
  const doc = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('the file ' + name + ' inside the workbook is damaged');
  return doc;
}

/* ---------- shared helpers ---------- */

const tags = (node, name) => Array.from(node.getElementsByTagName(name));
const attr = (node, name) => node.getAttribute(name);

function colIndex(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else if (c >= 97 && c <= 122) n = n * 26 + (c - 96);
    else break;
  }
  return n - 1;
}

/* Excel and LibreOffice count days from 1899-12-30 (or 1904-01-01 in the old Macintosh mode). */
function serialToDate(serial, epoch1904) {
  const base = epoch1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(base + Math.round(serial * 86400000));
}

/* A dense grid: blank rows are dropped and every row is padded to the same width, as the app expects. */
function toGrid(rows) {
  const width = rows.reduce((m, r) => Math.max(m, r ? r.length : 0), 0);
  const out = [];
  for (const row of rows) {
    const full = Array.from({ length: width }, (_, i) => (row && row[i] !== undefined && row[i] !== null ? row[i] : ''));
    if (full.some(v => v !== '')) out.push(full);
  }
  return out;
}

/* ---------- .xlsx and .xlsm ---------- */

const DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function isDateFormat(id, code) {
  if (DATE_IDS.has(id)) return true;
  if (!code) return false;
  const clean = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '').replace(/\\./g, '');
  return /[ymdhs]/i.test(clean);
}

function sharedStrings(doc) {
  if (!doc) return [];
  return tags(doc.documentElement, 'si').map(si => {
    const phonetic = new Set();
    for (const rPh of tags(si, 'rPh')) for (const t of tags(rPh, 't')) phonetic.add(t);
    return tags(si, 't').filter(t => !phonetic.has(t)).map(t => t.textContent).join('');
  });
}

function dateStyles(doc) {
  if (!doc) return [];
  const custom = {};
  for (const f of tags(doc.documentElement, 'numFmt')) custom[+attr(f, 'numFmtId')] = attr(f, 'formatCode');
  const xfs = doc.getElementsByTagName('cellXfs')[0];
  if (!xfs) return [];
  return tags(xfs, 'xf').map(xf => {
    const id = +(attr(xf, 'numFmtId') || 0);
    return isDateFormat(id, custom[id]);
  });
}

function xlsxSheet(doc, strings, isDate, epoch1904) {
  const rows = [];
  for (const row of tags(doc.documentElement, 'row')) {
    const r = attr(row, 'r') ? +attr(row, 'r') - 1 : rows.length;
    const cells = [];
    let next = 0;
    for (const c of tags(row, 'c')) {
      const ref = attr(c, 'r');
      const col = ref ? colIndex(ref) : next;
      next = col + 1;
      const type = attr(c, 't') || 'n';
      const v = c.getElementsByTagName('v')[0];
      let value = '';
      if (type === 's') value = strings[+(v ? v.textContent : -1)] || '';
      else if (type === 'inlineStr') value = tags(c, 't').map(t => t.textContent).join('');
      else if (type === 'str' || type === 'e') value = v ? v.textContent : '';
      else if (type === 'b') value = v ? v.textContent === '1' : '';
      else if (v && v.textContent !== '') {
        const num = +v.textContent;
        const style = +(attr(c, 's') || 0);
        value = Number.isNaN(num) ? v.textContent : (isDate[style] ? serialToDate(num, epoch1904) : num);
      }
      cells[col] = value;
    }
    rows[r] = cells;
  }
  const merges = tags(doc.documentElement, 'mergeCell').map(m => {
    const [a, b] = (attr(m, 'ref') || '').split(':');
    const cell = ref => ({ r: +(ref.match(/\d+/) || [1])[0] - 1, c: colIndex(ref) });
    return { s: cell(a || 'A1'), e: cell(b || a || 'A1') };
  });
  return { grid: toGrid(rows), merges };
}

async function readXlsx(entries) {
  const book = await entryXml(entries, 'xl/workbook.xml');
  if (!book) throw new Error('the workbook has no xl/workbook.xml: it is not an .xlsx or .xlsm file');
  const rels = await entryXml(entries, 'xl/_rels/workbook.xml.rels');
  const target = {};
  if (rels) for (const rel of tags(rels.documentElement, 'Relationship')) target[attr(rel, 'Id')] = attr(rel, 'Target');
  const pr = book.getElementsByTagName('workbookPr')[0];
  const epoch1904 = !!pr && (attr(pr, 'date1904') === '1' || attr(pr, 'date1904') === 'true');
  const strings = sharedStrings(await entryXml(entries, 'xl/sharedStrings.xml'));
  const isDate = dateStyles(await entryXml(entries, 'xl/styles.xml'));
  const names = [], sheets = {};
  let n = 0;
  for (const s of tags(book.documentElement, 'sheet')) {
    n++;
    const name = attr(s, 'name') || 'Sheet' + n;
    const id = attr(s, 'r:id') || attr(s, 'id') || '';
    let path = target[id] || 'worksheets/sheet' + n + '.xml';
    path = path.replace(/^\//, '').replace(/^xl\//, '');
    const doc = await entryXml(entries, 'xl/' + path);
    if (!doc) continue;
    names.push(name);
    sheets[name] = xlsxSheet(doc, strings, isDate, epoch1904);
  }
  if (!names.length) throw new Error('the workbook has no readable sheets');
  return { names, sheets };
}

/* ---------- .ods ---------- */

const REPEAT_LIMIT = 1000;   /* a spreadsheet writes its empty tail as one repeated cell or row */

function odsCellValue(cell) {
  const type = attr(cell, 'office:value-type');
  if (type === 'float' || type === 'percentage' || type === 'currency') return +attr(cell, 'office:value');
  if (type === 'boolean') return attr(cell, 'office:boolean-value') === 'true';
  if (type === 'date') {
    const raw = attr(cell, 'office:date-value') || '';
    const d = new Date(raw.length === 10 ? raw + 'T00:00:00Z' : raw);
    return Number.isNaN(d.getTime()) ? raw : d;
  }
  const text = tags(cell, 'text:p').map(p => p.textContent).join('\n');
  if (type === 'time') return attr(cell, 'office:time-value') || text;
  return text;
}

function odsSheet(table) {
  const rows = [], merges = [];
  let r = 0;
  for (const row of tags(table, 'table:table-row')) {
    const cells = [];
    let c = 0, filled = false;
    for (const cell of Array.from(row.children)) {
      const covered = cell.tagName === 'table:covered-table-cell';
      if (!covered && cell.tagName !== 'table:table-cell') continue;
      const repeat = Math.max(1, +(attr(cell, 'table:number-columns-repeated') || 1));
      const value = covered ? '' : odsCellValue(cell);
      const span = +(attr(cell, 'table:number-columns-spanned') || 1), down = +(attr(cell, 'table:number-rows-spanned') || 1);
      if (span > 1 || down > 1) merges.push({ s: { r, c }, e: { r: r + down - 1, c: c + span - 1 } });
      if (value === '' && repeat > REPEAT_LIMIT) { c += 1; continue; }
      for (let i = 0; i < repeat; i++) { cells[c++] = value; if (value !== '') filled = true; }
    }
    const repeatRow = Math.max(1, +(attr(row, 'table:number-rows-repeated') || 1));
    if (!filled && repeatRow > REPEAT_LIMIT) { r++; continue; }
    for (let i = 0; i < repeatRow; i++) rows[r++] = filled ? cells.slice() : [];
  }
  return { grid: toGrid(rows), merges };
}

async function readOds(entries) {
  const doc = await entryXml(entries, 'content.xml');
  if (!doc) throw new Error('the file has no content.xml: it is not an .ods spreadsheet');
  const names = [], sheets = {};
  let n = 0;
  for (const table of tags(doc.documentElement, 'table:table')) {
    n++;
    const name = attr(table, 'table:name') || 'Sheet' + n;
    names.push(name);
    sheets[name] = odsSheet(table);
  }
  if (!names.length) throw new Error('the file has no readable sheets');
  return { names, sheets };
}

/* ---------- entry point ---------- */

/* Reads the whole workbook and returns { names, sheets }, where each sheet is { grid, merges }. */
Sheets.read = async (buffer, ext) => {
  const entries = unzip(buffer);
  const kind = String(ext).toLowerCase() === 'ods' || entries['content.xml'] ? 'ods' : 'xlsx';
  return kind === 'ods' ? readOds(entries) : readXlsx(entries);
};

window.Sheets = Sheets;
