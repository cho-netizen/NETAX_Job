// [2026.10.23 T6 2단계] 원본은 C:/GitHub/netax-replay/lib/gas.js — Cloud Run 도커 안에 넣기 위해 복사(고치면 원본도 같이). 쓰기·바깥 호출 막기는 server.js가 덧씌운다.
// 가짜 GAS 전역 — Code.js·AnswerKey.js를 고치지 않고 vm에 그대로 싣기 위한 것.
// 여기 없는 GAS 기능을 부르면 "로컬 재현기에 없는 GAS 기능"으로 기록하고 오류를 던진다(서버와 결과가 달라질 수 있는 곳을 숨기지 않으려고).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const crypto = require('crypto');
const { Blob, Iter } = require('./vfs');

function missingProxy(name, report) {
  return new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive || k === 'toString') return () => '[가짜 ' + name + ']';
      if (k === 'then') return undefined;
      return missingProxy(name + '.' + String(k), report);
    },
    apply() { report(name); throw new Error('로컬 재현기에 없는 GAS 기능: ' + name); }
  });
}
function service(name, impl, report) {
  return new Proxy(impl, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'symbol') return undefined; return missingProxy(name + '.' + String(k), report); } });
}

// yyyy-MM-dd HH:mm:ss 등 — Asia/Seoul 기준
function formatDate(d, tz, fmt) {
  d = d instanceof Date ? d : new Date(d);
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  const days = { Sun: '일', Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토' };
  return String(fmt).replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|ss|SSS|EEE|E|'([^']*)'/g, (t, lit) => {
    if (lit !== undefined) return lit;
    switch (t) {
      case 'yyyy': return p.year; case 'yy': return p.year.slice(2); case 'MM': return p.month; case 'M': return String(+p.month);
      case 'dd': return p.day; case 'd': return String(+p.day); case 'HH': return p.hour; case 'H': return String(+p.hour);
      case 'mm': return p.minute; case 'ss': return p.second; case 'SSS': return String(d.getMilliseconds()).padStart(3, '0');
      default: return days[p.weekday] || p.weekday;
    }
  });
}

// zip(hwpx 등) — 중앙 디렉터리만 읽어 풀기
function unzip(blob) {
  const buf = blob._buf ? blob._buf() : Buffer.from(blob.getBytes());
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip 아님');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString('utf8');
    const lnlen = buf.readUInt16LE(off + 26), lxlen = buf.readUInt16LE(off + 28);
    const data = buf.slice(off + 30 + lnlen + lxlen, off + 30 + lnlen + lxlen + csize);
    if (!/\/$/.test(name)) { const raw = method === 8 ? zlib.inflateRawSync(data) : data; out.push(new Blob(() => raw, name, 'application/octet-stream')); }
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

function makeCache(store) {
  return {
    get: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    getAll: (ks) => { const o = {}; ks.forEach((k) => { if (k in store) o[k] = store[k]; }); return o; },
    put: (k, v) => { store[k] = String(v); }, putAll: (o) => { Object.keys(o).forEach((k) => { store[k] = String(o[k]); }); },
    remove: (k) => { delete store[k]; }, removeAll: (ks) => ks.forEach((k) => delete store[k])
  };
}
function makeProps(store) {
  return {
    getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); },
    deleteProperty: (k) => { delete store[k]; }, getProperties: () => Object.assign({}, store), setProperties: (o) => { Object.assign(store, o); },
    getKeys: () => Object.keys(store), deleteAllProperties: () => { Object.keys(store).forEach((k) => delete store[k]); }
  };
}

// 사건 시트 — WORK_HEADERS 순서로 사건 행(JSON)을 시트 값처럼 만든다. 쓰기는 메모리에만.
function makeSheet(headers, rows, report) {
  const data = [headers.slice()].concat(rows.map((r) => headers.map((h) => {
    const v = r[h];
    if (v === undefined || v === null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : v;
  })));
  const range = (r, c, nr, nc) => ({
    getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = []; for (let j = 0; j < (nc || 1); j++) row.push((data[r - 1 + i] || [])[c - 1 + j] ?? ''); o.push(row); } return o; },
    getDisplayValues() { return this.getValues().map((x) => x.map(String)); },
    getValue: () => (data[r - 1] || [])[c - 1] ?? '',
    setValues: (vals) => { vals.forEach((row, i) => row.forEach((v, j) => { (data[r - 1 + i] = data[r - 1 + i] || [])[c - 1 + j] = v; })); },
    setValue: (v) => { (data[r - 1] = data[r - 1] || [])[c - 1] = v; },
    setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }
  });
  const sheet = {
    getDataRange: () => ({ getValues: () => data.map((x) => x.slice()), getDisplayValues: () => data.map((x) => x.map(String)) }),
    getLastColumn: () => data[0].length, getLastRow: () => data.length,
    getRange: (r, c, nr, nc) => range(r, c, nr, nc),
    appendRow: (row) => { data.push(row.slice()); }, getName: () => '사건', setFrozenRows() {}, deleteRow: (i) => { data.splice(i - 1, 1); },
    getSheetId: () => 1, _data: data
  };
  const ss = { getSheetByName: () => sheet, insertSheet: () => sheet, getSheets: () => [sheet], getId: () => 'FAKE_SHEET', getUrl: () => '' };
  return service('SpreadsheetApp', { openById: () => ss, flush() {}, getActiveSpreadsheet: () => ss }, report);
}

// Code.js 등 gs-backend의 .js를 한 vm 문맥에 싣는다(GAS처럼 전역 공유)
function loadBackend(opt) {
  const missing = {};
  const report = (name) => { missing[name] = (missing[name] || 0) + 1; };
  const vfs = opt.vfs;
  const cacheStore = {}, propStore = Object.assign({}, opt.props || {}), userProps = {};
  const consoleLog = [];
  const ctx = {
    console: { log: (...a) => consoleLog.push(a.join(' ')), warn: (...a) => consoleLog.push('경고 ' + a.join(' ')), error: (...a) => consoleLog.push('오류 ' + a.join(' ')), info: (...a) => consoleLog.push(a.join(' ')) },
    Logger: { log: (...a) => { consoleLog.push(a.join(' ')); } },
    DriveApp: service('DriveApp', {
      getFileById: (id) => vfs.getFileById(id), getFolderById: (id) => vfs.getFolderById(id),
      getRootFolder: () => vfs.root, createFile: (n, c, m) => vfs.root.createFile(n, c, m), createFolder: (n) => vfs.root.createFolder(n),
      searchFiles: (q) => {
        const m = /title contains '([^']+)'/.exec(String(q || ''));
        return new Iter(vfs.allFiles().filter((f) => !f.trashed && (!m || f.name.indexOf(m[1]) !== -1)));
      },
      getFilesByName: (n) => new Iter(vfs.allFiles().filter((f) => f.name === n)),
      Access: {}, Permission: {}
    }, report),
    CacheService: service('CacheService', { getScriptCache: () => makeCache(cacheStore), getUserCache: () => makeCache(cacheStore), getDocumentCache: () => makeCache(cacheStore) }, report),
    PropertiesService: service('PropertiesService', { getScriptProperties: () => makeProps(propStore), getUserProperties: () => makeProps(userProps), getDocumentProperties: () => makeProps(userProps) }, report),
    LockService: service('LockService', (() => { const l = { waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }; return { getUserLock: () => l, getScriptLock: () => l, getDocumentLock: () => l }; })(), report),
    Session: service('Session', { getScriptTimeZone: () => 'Asia/Seoul', getActiveUser: () => ({ getEmail: () => '' }), getEffectiveUser: () => ({ getEmail: () => '' }), getTemporaryActiveUserKey: () => 'local' }, report),
    Utilities: service('Utilities', {
      formatDate, sleep() {}, unzip, getUuid: () => crypto.randomUUID(),
      newBlob: (data, type, name) => { const b = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.from(data) : Buffer.from(String(data == null ? '' : data)); return new Blob(() => b, name || '', type || 'text/plain'); },
      base64Encode: (d) => Buffer.from(Array.isArray(d) ? d : String(d)).toString('base64'), base64Decode: (s) => Array.from(Buffer.from(String(s), 'base64')),
      base64EncodeWebSafe: (d) => Buffer.from(Array.isArray(d) ? d : String(d)).toString('base64url'), base64DecodeWebSafe: (s) => Array.from(Buffer.from(String(s), 'base64url')),
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg || 'md5').update(Array.isArray(s) ? Buffer.from(s) : String(s)).digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { MD5: 'md5', SHA_1: 'sha1', SHA_256: 'sha256', SHA_512: 'sha512' }, Charset: { UTF_8: 'utf8' },
      parseCsv: (s) => String(s).split(/\r?\n/).filter(String).map((l) => l.split(','))
    }, report),
    SpreadsheetApp: makeSheet(opt.headers || [], opt.rows || [], report),
    HtmlService: service('HtmlService', {
      createHtmlOutputFromFile: (n) => { const t = fs.readFileSync(path.join(opt.backendDir, n + '.html'), 'utf8'); return { getContent: () => t }; },
      XFrameOptionsMode: {}
    }, report),
    DocumentApp: service('DocumentApp', { ParagraphHeading: {}, GlyphType: {} }, report),
    Drive: missingProxy('Drive(고급 서비스)', report),
    UrlFetchApp: missingProxy('UrlFetchApp', report),
    ScriptApp: missingProxy('ScriptApp', report),
    GmailApp: missingProxy('GmailApp', report), MailApp: missingProxy('MailApp', report), CalendarApp: missingProxy('CalendarApp', report),
    SlidesApp: missingProxy('SlidesApp', report), ContentService: missingProxy('ContentService', report), Maps: missingProxy('Maps', report)
  };
  vm.createContext(ctx);
  const order = opt.files;
  order.forEach((f) => {
    const src = fs.readFileSync(path.join(opt.backendDir, f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  });
  // 빈 부분을 사람이 알아보게 — 아래 이름들은 서버에서만 되는 일(구글 글자인식·엑셀 변환 등)
  return { ctx, missing, cacheStore, propStore, consoleLog, run: (code) => vm.runInContext(code, ctx) };
}

module.exports = { loadBackend, formatDate };
