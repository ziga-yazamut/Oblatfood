// ---- list parsing (shared by the page and the build script) ----
var PRICE_RE = /^\d{1,3}(?:[  ]\d{3})+(?:[.,]\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/;
function parsePrice(s) {
  s = s.replace(/[  ]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}
// pages: [[{str, x, y, w}]] -> [[hu, en, price]]
function parseListPages(pages) {
  var out = [], allRows = [], xCount = {};
  pages.forEach(function (items) {
    var rows = [];
    items.forEach(function (it) {
      if (!it.str || !it.str.trim()) return;
      var row = null;
      for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].y - it.y) < 3) { row = rows[i]; break; }
      if (!row) { row = { y: it.y, cells: [] }; rows.push(row); }
      row.cells.push(it);
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    rows.forEach(function (row) {
      row.cells.sort(function (a, b) { return a.x - b.x; });
      var seen = {};
      row.cells.forEach(function (c) { var k = Math.round(c.x); if (!seen[k]) { seen[k] = 1; xCount[k] = (xCount[k] || 0) + 1; } });
      allRows.push(row);
    });
  });
  // column starts = left edges shared by many rows
  var cols = Object.keys(xCount).map(Number).filter(function (x) { return xCount[x] >= allRows.length * 0.15; }).sort(function (a, b) { return a - b; });
  allRows.forEach(function (row) {
    var cells = [];
    row.cells.forEach(function (c) {
      var col = -1;
      for (var i = 0; i < cols.length; i++) if (c.x >= cols[i] - 1.5) col = i;
      var last = cells[cells.length - 1];
      var t = c.str.trim();
      var sameCol = last && (cols.length ? last.col === col : c.x - (last.x + last.w) < 2.5);
      if (sameCol && !PRICE_RE.test(t)) { last.str += c.str; last.w = c.x + c.w - last.x; }
      else cells.push({ str: c.str, x: c.x, w: c.w, col: col });
    });
    var texts = cells.map(function (c) { return c.str.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var price = null;
    for (var j = texts.length - 1; j >= 1; j--) {
      if (PRICE_RE.test(texts[j])) { price = parsePrice(texts[j]); texts.splice(j, 1); break; }
    }
    if (price === null || !texts.length) { if (!out.header && texts.length >= 2) out.header = texts; return; } // header or noise
    out.push([texts[0], texts.slice(1).join(' '), price]);
  });
  return out;
}

// spreadsheet rows (array of arrays) -> [[name, english, price]]
function cellPrice(v) {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  var t = String(v).replace(/(ft|huf|eur|usd|€|\$|₪)/ig, '').trim();
  return PRICE_RE.test(t) ? parsePrice(t) : null;
}
function parseTable(table) {
  table = table.filter(function (r) { return r && r.some(function (c) { return String(c).trim() !== ''; }); });
  if (!table.length) return [];
  var width = Math.max.apply(null, table.map(function (r) { return r.length; }));
  var nameCol = -1, enCol = -1, priceCol = -1, skuCol = -1, start = 0;
  var SKU_RE = /(sku|cikksz|cikk sz|termékkód|termekkod|^kód$|^kod$|\bkód\b|\bcode\b|item no|article|art\.? ?no|barcode|ean|vonalk|מק"?ט|ברקוד)/;
  // 1) a header row that names the columns
  for (var h = 0; h < Math.min(table.length, 15) && priceCol < 0; h++) {
    var row = table[h].map(function (c) { return String(c).toLowerCase(); });
    var pc = -1, nc = -1, ec = -1, sc = -1;
    row.forEach(function (c, i) {
      if (pc < 0 && /(price|egysegar|egységár|unit|^ár$|\bár\b|cost|מחיר)/.test(c)) pc = i;
    });
    if (pc < 0) continue;
    row.forEach(function (c, i) {
      if (i === pc) return;
      if (sc < 0 && SKU_RE.test(c)) { sc = i; return; }
      if (ec < 0 && /(english|translat|angol|\beng\b)/.test(c)) ec = i;
      else if (nc < 0 && /(név|nev|name|termék|termek|product|item|descr|megnevez|מוצר|שם)/.test(c)) nc = i;
    });
    if (nc < 0 && ec >= 0) { nc = ec; ec = -1; }
    if (nc < 0) {
      // the price column is labelled but the name column isn't: take the column with the longest texts below
      var tl = [];
      table.slice(h + 1, h + 200).forEach(function (r) {
        r.forEach(function (v, i) { if (i !== pc && i !== ec && cellPrice(v) === null && /[a-zA-Z\u00c0-\u024f]{2}/.test(String(v))) tl[i] = (tl[i] || 0) + String(v).length; });
      });
      var bl = 0; tl.forEach(function (n, i) { if (n > bl) { bl = n; nc = i; } });
    }
    if (nc >= 0) { priceCol = pc; nameCol = nc; enCol = ec; skuCol = sc; start = h + 1; }
  }
  // 2) otherwise guess from the content
  if (priceCol < 0) {
    var num = [], txt = [];
    for (var c = 0; c < width; c++) { num[c] = 0; txt[c] = 0; }
    table.slice(0, 300).forEach(function (r) {
      for (var c = 0; c < width; c++) {
        var v = r[c]; if (v === undefined || String(v).trim() === '') continue;
        if (cellPrice(v) !== null) num[c]++; else if (/[a-zA-Z\u00c0-\u024f\u05d0-\u05ea]{2}/.test(String(v))) txt[c]++;
      }
    });
    var textCols = [];
    for (c = 0; c < width; c++) if (txt[c] > table.length * 0.3 && txt[c] > num[c]) textCols.push(c);
    var bestN = 0;
    for (c = 0; c < width; c++) if (textCols.indexOf(c) < 0 && num[c] > bestN) { bestN = num[c]; priceCol = c; }
    nameCol = textCols[0] === undefined ? -1 : textCols[0];
    enCol = textCols[1] === undefined ? -1 : textCols[1];
    if (priceCol < 0 || nameCol < 0) return [];
  }
  var out = [];
  table.slice(start).forEach(function (r, bi) {
    var name = String(r[nameCol] === undefined ? '' : r[nameCol]).replace(/\s+/g, ' ').trim();
    var en = enCol >= 0 ? String(r[enCol] === undefined ? '' : r[enCol]).replace(/\s+/g, ' ').trim() : '';
    var price = cellPrice(r[priceCol] === undefined ? '' : r[priceCol]);
    if (!name && en) { name = en; en = ''; }
    var sku = skuCol >= 0 ? String(r[skuCol] === undefined ? '' : r[skuCol]).trim() : '';
    if (name && price !== null) { var o = [name, en, price, sku, r.slice()]; o.bodyIdx = bi; out.push(o); }
  });
  out.byHeader = start > 0;
  out.header = start > 0 ? table[start - 1].map(function (c) { return String(c); }) : null;
  out.preamble = start > 1 ? table.slice(0, start - 1) : [];
  out.cols = { name: nameCol, en: enCol, price: priceCol };
  out.body = table.slice(start).map(function (r) { return r.slice(); });
  return out;
}

// a supplier SKU file (no prices needed) -> [[sku, name]]
function parseSkuTable(table) {
  table = table.filter(function (r) { return r && r.some(function (c) { return String(c).trim() !== ''; }); });
  if (!table.length) return [];
  var width = Math.max.apply(null, table.map(function (r) { return r.length; }));
  var SKU_RE = /(sku|cikksz|cikk sz|termékkód|termekkod|kód|kod|code|item no|article|art\.? ?no|barcode|ean|vonalk|מק"?ט|ברקוד|^id$)/;
  var NAME_RE = /(név|nev|name|termék|termek|product|item|descr|megnevez|מוצר|שם|תיאור)/;
  var skuCol = -1, nameCols = [], start = 0;
  for (var h = 0; h < Math.min(table.length, 15) && skuCol < 0; h++) {
    var row = table[h].map(function (c) { return String(c).toLowerCase().trim(); });
    var sc = -1, nc = [];
    row.forEach(function (c, i) { if (!c) return; if (sc < 0 && SKU_RE.test(c)) sc = i; else if (NAME_RE.test(c) || /english|translat|angol/.test(c)) nc.push(i); });
    if (sc >= 0 && nc.length) { skuCol = sc; nameCols = nc; start = h + 1; }
  }
  if (skuCol < 0) {
    // guess: the code-like column and the longest text column
    var code = [], len = [];
    for (var c = 0; c < width; c++) { code[c] = 0; len[c] = 0; }
    table.slice(0, 300).forEach(function (r) {
      for (var c = 0; c < width; c++) {
        var v = String(r[c] === undefined ? '' : r[c]).trim(); if (!v) continue;
        if (/^[A-Za-z0-9][A-Za-z0-9._\/-]{1,24}$/.test(v) && /\d/.test(v)) code[c]++;
        len[c] += v.length;
      }
    });
    var best = 0;
    for (c = 0; c < width; c++) if (code[c] > best) { best = code[c]; skuCol = c; }
    var bl = 0, nc2 = -1;
    for (c = 0; c < width; c++) if (c !== skuCol && len[c] > bl) { bl = len[c]; nc2 = c; }
    if (skuCol < 0 || nc2 < 0 || best < table.length * 0.5) return [];
    nameCols = [nc2];
  }
  var out = [];
  table.slice(start).forEach(function (r, bi) {
    var sku = String(r[skuCol] === undefined ? '' : r[skuCol]).trim();
    var names = nameCols.map(function (i) { return String(r[i] === undefined ? '' : r[i]).replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    if (sku && names.length) out.push([sku].concat(names));
  });
  out.byHeader = start > 0;
  return out;
}
if (typeof module !== 'undefined') module.exports = { parseListPages: parseListPages, parseTable: parseTable, parseSkuTable: parseSkuTable };
