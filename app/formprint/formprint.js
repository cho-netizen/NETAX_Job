/*
 * NxFormPrint — 법정서식 "원본 모양" 출력 (작업자 파, 2026-10-19)
 *
 * 하는 일: 드라이브 법제처 원본(PDF) 묶음 PDF를 바탕에 깔고, 위치판(칸마다 쪽·x·y·w·h)대로
 *          값을 올려 찍어 PDF 한 벌을 만든다. 바탕이 원본 그 자체라 칸 배치·번호·개정일·작성방법이 원본 그대로다.
 *
 * 브라우저:  <script src=".../formprint/formprint.js"></script> (+ mappers.js) → window.NxFormPrint
 *   NxFormPrint.render('양도84호', values, opts)            → Promise<Blob(PDF)>
 *   NxFormPrint.renderMany([{formKey, values}, …], opts)   → Promise<{blob, bytes, report}>  (여러 서식을 한 파일로)
 *   NxFormPrint.keys('양도84호')                            → Promise<[{키, 칸, 이름, 종류, 줄수}]>  (값 이름 목록)
 *   NxFormPrint.open(blob, '파일이름.pdf')                  → 새 창으로 보기
 * node:      const FP = require('./formprint.js'); FP.renderBytes(jobs, { PDFLib, fontkit, fontBytes, loadMap, getSourceBytes })
 *
 * values 규칙(키 = 위치판의 "키", 없으면 칸번호(+@열)(+.부분); 같은 서식 안에서 겹치면 "칸~이름"):
 *   - 금액: 숫자 → 쉼표 넣은 숫자(원 글자 없음). 0도 "0"으로 찍음(opts.zeroBlank=true면 비움).
 *   - 세율·비율: 숫자 30 → "30%". 글자로 주면 그대로.
 *   - 날짜: 'YYYY-MM-DD' → 'YYYY.MM.DD'. 다른 글자는 그대로.
 *   - 체크: values['신고구분|기한 내 신고'] = true  또는  values['신고구분'] = '기한 내 신고'.
 *           줄마다 있는 체크(줄번호): values['③|여'] = [true, false, …] 또는 values['③|여#2'] = true.
 *   - 여러 줄 칸(줄): 배열이면 줄마다 하나씩, values['키#2']처럼 줄을 지정해도 됨.
 *           글자 칸에 긴 글자 하나를 주면 칸 너비에 맞춰 다음 줄로 이어 씀.
 *   - null·undefined·'' 는 찍지 않음.
 *   - 칸 너비를 넘으면 글자 크기를 줄임(최소 4pt). 그래도 넘치면 report.overflow에 남김.
 *   - 한 장에 모자라면 다음 장에 이어 찍음(아래 "다음 장 이어 찍기" 설명): 표의 줄은 배열을 줄 수보다 길게
 *     (또는 '⑦#8'), 열은 키 숫자를 키워서('①@자산4.앞', '④@세율5') 넘기면 됨. report.continued = [{formKey, pages, …}].
 *     합계·서명 등 표 아래 칸은 마지막 장에만(opts.continueTotals = 'first'면 첫 장에만).
 *
 * 바탕 PDF: callGas('listFolder', {folderId}) → files[{id,name,sizeBytes}] 에서 위치판 원본.파일의 이름으로 찾고,
 *           callGas('readFileBinary', {fileId}) → {name, mimeType, base64} 로 받음. 받은 뒤 원본.md5와 비교 — 다르면 찍지 않고 오류.
 * 글꼴: 나눔고딕 Regular(고정 TTF, SIL OFL 1.1, Google Fonts 저장소 github.com/google/fonts ofl/nanumgothic) — 쓴 글자만 PDF에 넣음.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    var prev = root.NxFormPrint || {};
    for (var k in api) if (Object.prototype.hasOwnProperty.call(api, k)) prev[k] = api[k];
    root.NxFormPrint = prev;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var VERSION = '2026-10-19';
  // 드라이브 업무관리자/서식/법제처 원본(PDF)/<세목> 폴더
  var FOLDERS = {
    '상속': '11qD8IugSmXnNlI2RueaSrTCYrL74F937',
    '증여': '1wqtL3uPhNCuAwM8O3uHM1F-tt8QQLJ-3',
    '양도': '126zwjK9dcE8-ZgMYGdgj3FZiei78DsK7',
    '공통': '1L9OQq6HWSn_Jk0ap5IwbUYbU_NrdP90y'
  };
  var LIBS = {
    pdfLib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', // 앱(docs·memo)이 이미 쓰는 같은 파일
    fontkit: 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'
  };
  var MIN_SIZE = 4;

  // 이 파일이 놓인 폴더(위치판·글꼴을 같은 곳에서 읽음). 못 찾으면 깃허브 페이지 주소.
  var scriptBase = (function () {
    try {
      var cs = typeof document !== 'undefined' && document.currentScript;
      if (cs && cs.src) return cs.src.replace(/[^\/]*$/, '');
    } catch (e) {}
    return 'https://job.netax.kr/app/formprint/';
  })();

  var config = {
    base: scriptBase,                       // 위치판/·fonts/ 가 있는 주소(끝에 /)
    fontFile: 'fonts/NanumGothic-Regular.ttf',
    folders: FOLDERS,
    libs: LIBS,
    callGas: null                           // 비우면 전역 callGas 사용
  };

  // ───────── 작은 도구 ─────────
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function commas(n) {
    var neg = n < 0; var s = String(Math.abs(Math.round(n)));
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + s;
  }
  function commasDec(n) {
    var neg = n < 0; var a = Math.abs(n);
    var ip = Math.floor(a), fp = Math.round((a - ip) * 1000) / 1000;
    var s = String(ip).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (fp > 0) s += String(fp).replace(/^0/, '');
    return (neg ? '-' : '') + s;
  }
  function trimNum(n) { return String(Math.round(n * 1000) / 1000); }
  function basename(p) { return String(p || '').split(/[\\\/]/).pop(); }
  function normName(s) { s = String(s || ''); try { s = s.normalize('NFC'); } catch (e) {} return s.replace(/¸/g, ',').replace(/\s+/g, ' ').trim(); }
  function 세목Of(map) {
    var parts = String(map.원본 && map.원본.파일 || '').split(/[\\\/]/);
    var d = parts[parts.length - 2] || '';
    return FOLDERS[d] ? d : null;
  }
  function b64ToBytes(b64) {
    if (typeof Buffer !== 'undefined' && typeof atob === 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // MD5(받은 원본 PDF가 위치판을 잰 판과 같은지 확인용) — RFC 1321 그대로
  function md5hex(bytes) {
    var K = [], S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    var len = bytes.length, nBlk = ((len + 8) >>> 6) + 1, W = new Int32Array(nBlk * 16);
    for (i = 0; i < len; i++) W[i >> 2] |= bytes[i] << ((i % 4) * 8);
    W[len >> 2] |= 0x80 << ((len % 4) * 8);
    W[nBlk * 16 - 2] = (len * 8) | 0; W[nBlk * 16 - 1] = Math.floor(len / 536870912);
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var blk = 0; blk < nBlk * 16; blk += 16) {
      var A = a0, B = b0, C = c0, D = d0;
      for (var j = 0; j < 64; j++) {
        var F, g;
        if (j < 16) { F = (B & C) | (~B & D); g = j; }
        else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
        else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * j) % 16; }
        var tmp = D; D = C; C = B;
        var x = (A + F + K[j] + W[blk + g]) | 0;
        B = (B + ((x << S[j]) | (x >>> (32 - S[j])))) | 0; A = tmp;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    var hex = '';
    [a0, b0, c0, d0].forEach(function (v) { for (var k = 0; k < 4; k++) hex += ((v >>> (k * 8)) & 255).toString(16).padStart(2, '0'); });
    return hex;
  }

  // ───────── 불러오기(브라우저 기본, opts로 바꿔 끼울 수 있음) ─────────
  var cache = { maps: {}, src: {}, font: null };

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('라이브러리를 불러오지 못했습니다: ' + url)); };
      document.head.appendChild(s);
    });
  }
  function ensureLibs(opts) {
    if (opts && opts.PDFLib && opts.fontkit) return Promise.resolve({ PDFLib: opts.PDFLib, fontkit: opts.fontkit });
    var p = Promise.resolve();
    if (!root.PDFLib) p = p.then(function () { return loadScript(config.libs.pdfLib); });
    return p.then(function () { if (!root.fontkit) return loadScript(config.libs.fontkit); })
      .then(function () {
        if (!root.PDFLib || !root.fontkit) throw new Error('PDF 라이브러리(pdf-lib·fontkit)를 불러오지 못했습니다.');
        return { PDFLib: root.PDFLib, fontkit: root.fontkit };
      });
  }
  function fetchOk(url, kind) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error((kind || '파일') + '을(를) 불러오지 못했습니다(' + r.status + '): ' + url);
      return r;
    });
  }
  function loadMap(formKey, opts) {
    if (opts && opts.loadMap) return Promise.resolve(opts.loadMap(formKey));
    if (cache.maps[formKey]) return Promise.resolve(cache.maps[formKey]);
    var url = config.base + '위치판/' + encodeURIComponent('서식위치_' + formKey + '.json');
    return fetchOk(url, '위치판(' + formKey + ')').then(function (r) { return r.json(); })
      .then(function (j) { cache.maps[formKey] = j; return j; });
  }
  function loadFont(opts) {
    if (opts && opts.fontBytes) return Promise.resolve(opts.fontBytes);
    if (cache.font) return Promise.resolve(cache.font);
    return fetchOk(config.base + config.fontFile, '한글 글꼴').then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { cache.font = new Uint8Array(ab); return cache.font; });
  }
  function getCallGas(opts) {
    var f = (opts && opts.callGas) || config.callGas || (typeof callGas === 'function' ? callGas : null) || root.callGas; // eslint-disable-line no-undef
    if (typeof f !== 'function') throw new Error('서버 호출 함수(callGas)가 없어 원본 서식 PDF를 받을 수 없습니다.');
    return f;
  }
  // 위치판의 원본 PDF 바이트(md5 확인까지)
  function loadSource(map, opts) {
    var want = map.원본 && map.원본.md5;
    if (want && cache.src[want]) return cache.src[want]; // 같은 원본은 한 번만 받음(받는 중이면 그 약속을 같이 기다림)
    var p;
    if (opts && opts.getSourceBytes) p = Promise.resolve(opts.getSourceBytes(map));
    else {
      var cg = getCallGas(opts);
      var 세목 = 세목Of(map), name = basename(map.원본 && map.원본.파일);
      var folderId = 세목 && (config.folders[세목]);
      if (!folderId) return Promise.reject(new Error('위치판의 원본 파일 경로에서 세목 폴더(상속·증여·양도·공통)를 알 수 없습니다: ' + (map.원본 && map.원본.파일)));
      p = Promise.resolve(cg('listFolder', { folderId: folderId })).then(function (list) {
        if (!list || list.error) throw new Error('드라이브 서식/법제처 원본(PDF) 폴더를 읽지 못했습니다: ' + (list && list.error || '응답 없음'));
        var files = list.files || [];
        var f = files.filter(function (x) { return x.name === name; })[0] ||
          files.filter(function (x) { return normName(x.name) === normName(name); })[0];
        if (!f) throw new Error('드라이브 "법제처 원본(PDF)/' + 세목 + '" 폴더에서 원본 서식 파일을 찾지 못했습니다: ' + name);
        if (map.원본.크기 && f.sizeBytes && Number(f.sizeBytes) !== Number(map.원본.크기))
          throw new Error('드라이브의 원본 서식 파일 크기가 위치판을 잰 판과 다릅니다(' + f.sizeBytes + ' ≠ ' + map.원본.크기 + '바이트) — 서식이 바뀌었으면 위치판을 다시 재야 합니다. 찍지 않았습니다: ' + name);
        return cg('readFileBinary', { fileId: f.id });
      }).then(function (res) {
        if (!res || res.error || !res.base64) throw new Error('원본 서식 PDF를 받지 못했습니다: ' + (res && res.error || '응답 없음'));
        return b64ToBytes(res.base64);
      });
    }
    p = p.then(function (bytes) {
      bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      var got = md5hex(bytes);
      if (want && got !== want) throw new Error('원본 서식 PDF가 위치판을 잰 판과 다릅니다(md5 ' + got + ' ≠ ' + want + ') — 서식이 개정됐으면 위치판을 다시 재야 합니다. 찍지 않았습니다: ' + basename(map.원본.파일));
      return bytes;
    });
    if (want) { cache.src[want] = p; p.catch(function () { if (cache.src[want] === p) delete cache.src[want]; }); }
    return p;
  }

  // ───────── 칸 키 ─────────
  function baseOf(c) {
    if (c.키) return String(c.키).split('|')[0];
    return c.칸 + (c.열 ? '@' + c.열 : '') + (c.부분 ? '.' + c.부분 : '') + (c.열번호 ? '@' + c.열번호 : '');
  }
  // 서식 하나(map.서식[i])의 칸마다 값 키를 정함
  function slotsOf(entry) {
    var cnt = {};
    entry.칸.forEach(function (c) {
      var k = c.종류 === '체크' ? baseOf(c) + '|' + c.보기 + '#' + (c.줄번호 || 0) : baseOf(c);
      cnt[k] = (cnt[k] || 0) + 1;
    });
    return entry.칸.map(function (c) {
      var b = baseOf(c), key;
      if (c.종류 === '체크') {
        var dup = cnt[b + '|' + c.보기 + '#' + (c.줄번호 || 0)] > 1;
        if (dup) b = c.칸 + '~' + c.이름;
        key = c.키 && !dup ? c.키 : b + '|' + c.보기;
      } else {
        key = c.키 && cnt[b] === 1 ? c.키 : (cnt[b] > 1 ? c.칸 + '~' + c.이름 : b);
      }
      return { c: c, key: key, base: b };
    });
  }
  function keys(formKey, opts) {
    return loadMap(formKey, opts).then(function (map) { return keysOfMap(map); });
  }
  function keysOfMap(map) {
    var out = [], seen = {};
    map.서식.forEach(function (entry) {
      slotsOf(entry).forEach(function (s) {
        if (seen[s.key]) return; seen[s.key] = 1;
        out.push({ 키: s.key, 칸: s.c.칸, 이름: s.c.이름, 종류: s.c.종류, 줄수: s.c.줄 ? s.c.줄.length : (s.c.줄번호 ? '줄' + s.c.줄번호 : 1), 서식: entry.서식 });
      });
    });
    return out;
  }

  // ───────── 값 → 글자 ─────────
  function fmt(v, kind, opts) {
    if (v === null || v === undefined || v === '' || v === false) return '';
    if (isNum(v)) {
      if (kind === '세율' || kind === '비율') return trimNum(v) + '%';
      if (kind === '금액') return (v === 0 && opts.zeroBlank) ? '' : commas(v);
      if (kind === '숫자') return commasDec(v);
      return String(v);
    }
    if (typeof v === 'number') return '';
    var s = String(v);
    if (kind === '날짜' && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, '.');
    return s;
  }
  function truthy(v) { return v === true || v === 1 || v === 'V' || v === 'v' || v === '○' || v === 'Y' || v === '예'; }
  function checkOn(values, s, used) {
    var c = s.c, k = s.key, ri = (c.줄번호 || 1) - 1;
    function mark(name) { used[name] = 1; return true; }
    if (c.줄번호 && values[k + '#' + c.줄번호] !== undefined) return truthy(values[k + '#' + c.줄번호]) && mark(k + '#' + c.줄번호);
    var v = values[k];
    if (v !== undefined) { used[k] = 1; return Array.isArray(v) ? truthy(v[ri]) : (!c.줄번호 || ri === 0) && truthy(v); }
    var bv = values[s.base];
    if (bv !== undefined) {
      used[s.base] = 1;
      if (Array.isArray(bv)) return bv[ri] === c.보기;
      return (!c.줄번호 || ri === 0) && bv === c.보기;
    }
    return false;
  }

  // 글자를 칸 너비에 맞춰 줄로 나눔(띄어쓰기 우선, 안 되면 글자 단위)
  function wrapText(s, font, size, avail) {
    var out = [];
    String(s).split('\n').forEach(function (para) {
      var line = '';
      var tokens = para.split(/(\s+)/);
      tokens.forEach(function (t) {
        if (!t) return;
        var tryL = line + t;
        if (font.widthOfTextAtSize(tryL, size) <= avail) { line = tryL; return; }
        if (line.trim()) out.push(line.replace(/\s+$/, ''));
        line = '';
        t = t.replace(/^\s+/, '');
        // 한 낱말이 칸보다 길면 글자 단위로 자름
        while (t && font.widthOfTextAtSize(t, size) > avail) {
          var n = t.length;
          while (n > 1 && font.widthOfTextAtSize(t.slice(0, n), size) > avail) n--;
          out.push(t.slice(0, n)); t = t.slice(n);
        }
        line = t;
      });
      if (line.trim() || !out.length) out.push(line.replace(/\s+$/, ''));
    });
    return out;
  }

  // 칸 하나(한 줄 높이)에 글자 찍기 — 넘치면 줄이고, 글자 칸은 높이가 되면 두 줄로
  function drawCell(ctx, page, c, top, h, s, label) {
    var PDFLib = ctx.PDFLib, font = ctx.font, H = page.getHeight();
    var pad = c.여백 == null ? 3 : c.여백;
    var align = c.정렬 || (c.종류 === '금액' || c.종류 === '숫자' ? '오른쪽' : '왼쪽');
    var avail = align === '가운데' ? c.w - 2 * Math.max(pad, 0.6) : c.w - pad - 1;
    var size = c.글자크기 || 8;
    if (h > 0) size = Math.min(size, Math.max(MIN_SIZE, h - 1.5));
    var w = font.widthOfTextAtSize(s, size), base = size;
    var lines = [s];
    if (w > avail) {
      var fit = Math.max(MIN_SIZE, Math.floor(size * avail / w * 10) / 10);
      // 글자 칸이고 높이가 두 줄 이상 되면, 줄이기 전에 줄바꿈부터 해 봄
      if (c.종류 === '글자' && fit < size * 0.8 && h >= 2 * size * 1.05) {
        var wl = wrapText(s, font, size, avail);
        var maxLines = Math.floor(h / (size * 1.05));
        if (wl.length <= maxLines) lines = wl; else { size = fit; }
      } else size = fit;
      w = font.widthOfTextAtSize(s, size);
      if (lines.length === 1 && w > avail + 0.01) ctx.report.overflow.push(label + ' "' + s + '" (글자폭 ' + w.toFixed(1) + ' > 칸 ' + avail.toFixed(1) + 'pt)');
      if (size < base) ctx.report.shrunk.push(label + ' ' + base + '→' + size + 'pt');
    }
    if (ctx.opts.debugBoxes) page.drawRectangle({ x: c.x, y: H - top - h, width: c.w, height: h, borderColor: PDFLib.rgb(0.1, 0.45, 0.95), borderWidth: 0.4 });
    var lh = size * 1.05, blockTop = top + (h - lh * lines.length) / 2;
    lines.forEach(function (ln, i) {
      var lw = font.widthOfTextAtSize(ln, size);
      var x = align === '오른쪽' ? c.x + c.w - pad - lw : align === '가운데' ? c.x + (c.w - lw) / 2 : c.x + pad;
      var mid = lines.length === 1 ? top + h / 2 : blockTop + lh * (i + 0.5);
      page.drawText(ln, { x: x, y: H - mid - size * 0.35, size: size, font: font, color: ctx.color });
    });
    ctx.report.placed++;
  }

  function stampEntry(ctx, entry, pageOf, values) {
    var used = ctx.used;
    slotsOf(entry).forEach(function (s) {
      var c = s.c, page = pageOf(c.쪽);
      if (!page) return;
      var H = page.getHeight(), label = (ctx.formKey + ' ' + s.key);
      if (c.종류 === '체크') {
        if (!checkOn(values, s, used)) return;
        var size = c.글자크기 || 8;
        if (ctx.opts.debugBoxes) page.drawCircle({ x: c.cx, y: H - c.cy, size: size * 0.6, borderColor: ctx.PDFLib.rgb(0.9, 0.1, 0.1), borderWidth: 0.4 });
        if (c.표시 === '○') {
          // [2026.10.20 눈검사 ③] ○ 가로 반지름 = 실제 글자 폭의 반 + 여백(예전 글자 수 × 0.45 + 3은 한 글자 보기에서 너무 넓어 옆 쉼표에 닿음) — 위치판 c.○반지름으로 덮어쓸 수 있음
          var tw = c['○반지름'] || Math.max(size * 0.6, ctx.font.widthOfTextAtSize(String(c.보기 || ''), size) / 2 + Math.max(2, size * 0.5));
          page.drawEllipse({ x: c.cx, y: H - c.cy, xScale: tw, yScale: size * 0.95, borderColor: ctx.color, borderWidth: 0.6 }); // 세로 0.7 → 0.95(글자 위아래를 지나가던 것)
        } else {
          // [2026.10.20 눈검사 ①] V는 글자 크기의 85% — 서식 [ ] 틈이 좁아 굵은 V가 괄호에 닿던 것(위치판 c.체크크기로 덮어쓸 수 있음)
          var vs = c.체크크기 || size * 0.85, vw = ctx.bold.widthOfTextAtSize('V', vs);
          page.drawText('V', { x: c.cx - vw / 2, y: H - c.cy - vs * 0.36, size: vs, font: ctx.bold, color: ctx.color });
        }
        ctx.report.placed++;
        return;
      }
      var rows = c.줄 && c.줄.length ? c.줄 : [[c.y, c.h]];
      var whole = values[s.key];
      if (whole !== undefined) used[s.key] = 1;
      // 글자 칸에 긴 글 하나 → 칸 너비에 맞춰 여러 줄로 이어 씀
      var flow = null;
      if (rows.length > 1 && typeof whole === 'string' && c.종류 === '글자') {
        var size0 = Math.min(c.글자크기 || 8, Math.max(MIN_SIZE, rows[0][1] - 1.5));
        var pad0 = c.여백 == null ? 3 : c.여백;
        flow = wrapText(whole, ctx.font, size0, c.w - pad0 - 1);
        if (flow.length > rows.length) { flow = flow.slice(0, rows.length - 1).concat([flow.slice(rows.length - 1).join(' ')]); }
      }
      rows.forEach(function (r, ri) {
        var v, rk = s.key + '#' + (ri + 1);
        if (values[rk] !== undefined) { v = values[rk]; used[rk] = 1; }
        else if (flow) v = flow[ri];
        else if (Array.isArray(whole)) v = whole[ri];
        else if (ri === 0) v = whole;
        var t = fmt(v, c.종류, ctx.opts);
        if (t === '') return;
        drawCell(ctx, page, c, r[0], r[1], t, label + (rows.length > 1 ? '#' + (ri + 1) : ''));
      });
    });
  }

  // ───────── 쪽 번호 읽기 ─────────
  // 위치판의 '쪽'·'뒷면쪽'은 숫자 하나(2)·배열([2,3,4])·null이 섞여 있음(증여10호·상속9호 = 숫자, 양도84호 = 배열) — 모두 배열로.
  function toPages(v) {
    if (v === null || v === undefined || v === '') return [];
    if (Array.isArray(v)) return v.reduce(function (a, x) { return a.concat(toPages(x)); }, []);
    if (typeof v === 'number') return isFinite(v) && v > 0 ? [v] : [];
    if (typeof v === 'string') return v.split(/[^0-9]+/).filter(Boolean).map(Number).filter(function (n) { return n > 0; });
    return [];
  }

  // ───────── 다음 장 이어 찍기(작업자 거, 2026-10-19) ─────────
  // 한 장에 자리가 모자라면 그 서식 쪽을 원본에서 한 번 더 복사해 나머지를 이어 찍는다. 서식마다 따로 짜지 않고 위치판에서 반복 단위를 알아냄:
  //   줄(row): 같은 쪽에서 줄 위치(c.줄의 y들)가 똑같은 여러 줄 칸이 2개 이상 → 표의 줄. 한 장 용량 = 줄 수.
  //            줄번호가 있는 체크 칸(③|여 등) → 같은 키의 가장 큰 줄번호가 용량.
  //            값: 배열이면 앞에서부터 장마다 줄 수만큼, '키#7'처럼 줄을 지정하면 7번째 줄(= 2장 2번째 줄, 줄 5개 표일 때).
  //   열(col): 열 이름이 '이름+숫자'(세율1·자산1·종목1) 또는 열번호(1~5) → 같은 이름끼리 가장 큰 숫자가 용량.
  //            값: 위치판 키의 숫자만 키워 줌 — '①@자산5.앞' = 자산 열 3개 서식의 2장 2번째 열.
  //   나머지 칸: 그 쪽 표(반복 칸) 맨 위보다 위에 있으면 머리(성명·귀속연도 등) → 장마다 찍음.
  //              표 맨 위와 같거나 아래(합계·계·서명·신고일 등) → 마지막 장에만(opts.continueTotals = 'first'면 첫 장에만).
  //   이어 찍은 장 위쪽 여백에 '(계속 2/3)' 표시, 첫 장엔 '(1/3)'. 작성방법(뒷면) 쪽은 다시 넣지 않음.
  function meaningful(v) { return v !== undefined && v !== null && v !== '' && v !== false; }
  function lastIdx(arr) { for (var i = arr.length - 1; i >= 0; i--) if (meaningful(arr[i])) return i; return -1; }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function colInfo(c) {
    if (c.열번호) return { prefix: '', num: Number(c.열번호), token: '@' + c.열번호 };
    var m = c.열 && /^(.*?)(\d+)$/.exec(String(c.열));
    return m ? { prefix: m[1], num: Number(m[2]), token: '@' + c.열 } : null;
  }
  // 키에서 열 자리('@자산1')를 찾아 앞·뒤로 나눔(뒤는 끝 또는 . | # ~ 로 시작해야 함)
  function splitTok(key, token) {
    var from = 0, i;
    while ((i = key.indexOf(token, from)) >= 0) {
      var nx = key.charAt(i + token.length);
      if (nx === '' || '.|#~'.indexOf(nx) >= 0) return { pre: key.slice(0, i), post: key.slice(i + token.length) };
      from = i + 1;
    }
    return null;
  }
  function slotTop(c) {
    if (c.종류 === '체크') return c.cy - (c.글자크기 || 8) / 2;
    if (c.줄 && c.줄.length) return c.줄[0][0];
    return c.y;
  }
  // 서식 하나(entry)를 값(values)에 맞춰 몇 장이 필요한지 계획
  function planEntry(entry, values) {
    var slots = slotsOf(entry), hashAll = {};
    Object.keys(values).forEach(function (k) {
      var m = /^(.*)#(\d+)$/.exec(k);
      if (m) (hashAll[m[1]] = hashAll[m[1]] || []).push(Number(m[2]));
    });
    function hashMax(k) {
      var mx = 0; (hashAll[k] || []).forEach(function (n) { if (n > mx && meaningful(values[k + '#' + n])) mx = n; }); return mx;
    }
    // 줄 표 찾기: 같은 쪽·같은 줄 위치의 여러 줄 칸 수
    var sigCnt = {}, chkCap = {};
    function sigOf(c) { return c.쪽 + ':' + c.줄.map(function (r) { return Math.round(r[0] * 2) / 2; }).join(','); }
    slots.forEach(function (s) {
      var c = s.c;
      if (colInfo(c)) return;
      if (c.종류 !== '체크' && c.줄 && c.줄.length > 1) sigCnt[sigOf(c)] = (sigCnt[sigOf(c)] || 0) + 1;
      if (c.종류 === '체크' && c.줄번호) chkCap[s.key] = Math.max(chkCap[s.key] || 0, c.줄번호);
    });
    var colCap = {};
    slots.forEach(function (s) { var ci = colInfo(s.c); if (ci) colCap[ci.prefix] = Math.max(colCap[ci.prefix] || 0, ci.num); });
    // 열 값의 가장 큰 번호(키 숫자를 키운 값까지)
    var colMax = {}, tmplSeen = {};
    var vkeys = Object.keys(values);
    var plan = slots.map(function (s) {
      var c = s.c, ci = colInfo(c), sp = { s: s, keys: c.종류 === '체크' && s.base !== s.key ? [s.key, s.base] : [s.key] };
      if (ci) {
        var tm = sp.keys.map(function (k) { return splitTok(k, ci.token); });
        if (tm.some(function (t) { return !t; })) { sp.kind = 'fixed'; return sp; }
        sp.kind = 'col'; sp.prefix = ci.prefix; sp.num = ci.num; sp.cap = colCap[ci.prefix]; sp.tm = tm;
        tm.forEach(function (t) {
          var id = t.pre + '\u0001' + t.post; if (tmplSeen[id]) return; tmplSeen[id] = 1;
          var re = new RegExp('^' + escRe(t.pre) + '@' + escRe(ci.prefix) + '(\\d+)' + escRe(t.post) + '(?:#\\d+)?$');
          vkeys.forEach(function (k) {
            var m = re.exec(k);
            if (m && meaningful(values[k])) colMax[ci.prefix] = Math.max(colMax[ci.prefix] || 0, Number(m[1]));
          });
        });
        return sp;
      }
      var N = 0;
      if (c.종류 === '체크' && c.줄번호) N = chkCap[s.key];
      else if (c.종류 !== '체크' && c.줄 && c.줄.length > 1 && sigCnt[sigOf(c)] >= 2) N = c.줄.length;
      if (N) {
        var L = 0;
        sp.keys.forEach(function (k) {
          if (Array.isArray(values[k])) L = Math.max(L, lastIdx(values[k]) + 1);
          L = Math.max(L, hashMax(k));
        });
        sp.kind = 'row'; sp.cap = N; sp.need = Math.max(1, Math.ceil(L / N));
        return sp;
      }
      sp.kind = 'other';
      return sp;
    });
    plan.forEach(function (sp) { if (sp.kind === 'col') sp.need = Math.max(1, Math.ceil((colMax[sp.prefix] || 0) / sp.cap)); if (sp.kind === 'fixed') sp.need = 1; });
    // 쪽마다 필요한 장 수, 표 맨 위
    var needOf = {}, topOf = {};
    plan.forEach(function (sp) {
      var pg = sp.s.c.쪽;
      if (sp.kind === 'other') return;
      needOf[pg] = Math.max(needOf[pg] || 1, sp.need);
      var t = slotTop(sp.s.c); if (isNum(t)) topOf[pg] = topOf[pg] === undefined ? t : Math.min(topOf[pg], t);
    });
    var total = 1;
    plan.forEach(function (sp) {
      var pg = sp.s.c.쪽;
      if (!needOf[pg]) needOf[pg] = 1;
      if (sp.kind === 'other') { var t = slotTop(sp.s.c); sp.kind = topOf[pg] !== undefined && isNum(t) && t < topOf[pg] - 1 ? 'head' : 'tail'; }
      total = Math.max(total, needOf[pg]);
    });
    var shortOf = {};
    plan.forEach(function (sp) { if (sp.kind === 'row' || sp.kind === 'col') { var u = (sp.kind === 'col' ? '열 ' + (sp.prefix || '번호') : '줄 ' + (sp.s.c.칸 || sp.s.key)); shortOf[u] = Math.max(shortOf[u] || 0, sp.cap); } });
    return { plan: plan, needOf: needOf, total: total, hashAll: hashAll, capacity: shortOf };
  }
  // p번째 장(0부터)에 찍을 값(view)과, view 키 → 원래 키 대응
  function viewFor(pl, values, p, totalsFirst) {
    var view = {}, orig = {};
    function put(vk, ok) { if (values[ok] !== undefined) { view[vk] = values[ok]; orig[vk] = ok; } }
    function putAll(vk, ok) { put(vk, ok); (pl.hashAll[ok] || []).forEach(function (n) { put(vk + '#' + n, ok + '#' + n); }); }
    pl.plan.forEach(function (sp) {
      var pg = sp.s.c.쪽, last = (pl.needOf[pg] || 1) - 1;
      if (sp.kind === 'head') sp.keys.forEach(function (k) { putAll(k, k); });
      else if (sp.kind === 'tail') { if (p === (totalsFirst ? 0 : last)) sp.keys.forEach(function (k) { putAll(k, k); }); }
      else if (sp.kind === 'fixed') { if (p === 0) sp.keys.forEach(function (k) { putAll(k, k); }); }
      else if (sp.kind === 'row') {
        var N = sp.cap, off = p * N;
        sp.keys.forEach(function (k) {
          var v = values[k];
          if (Array.isArray(v)) { view[k] = v.slice(off, off + N); orig[k] = k; }
          else if (p === 0 && v !== undefined) { view[k] = v; orig[k] = k; }
          (pl.hashAll[k] || []).forEach(function (n) { if (n > off && n <= off + N) put(k + '#' + (n - off), k + '#' + n); });
        });
      } else if (sp.kind === 'col') {
        var n = p * sp.cap + sp.num;
        sp.keys.forEach(function (k, i) { var t = sp.tm[i]; putAll(k, t.pre + '@' + sp.prefix + n + t.post); });
      }
    });
    return { view: view, orig: orig };
  }

  // [고침] @pdf-lib/fontkit 1.1.1의 TrueType 부분 넣기(subset) 버그: 글자 모양(glyf) 조각 길이가 홀수인데
  //  위치표(loca)를 짧은 형식(2바이트 단위)으로 써서, 홀수 조각 뒤의 글자가 전부 깨진다(나눔고딕·IBM Plex에서 숫자·한글 대부분 사라짐,
  //  맑은고딕은 조각이 짝수라 괜찮았음 — 2026-10-19 시험). 조각마다 0 한 바이트를 덧대 짝수로 맞춘다(글자 모양은 그대로).
  function patchFontkitSubset(fontkit, fontBytes) {
    try {
      var sub = fontkit.create(fontBytes).createSubset();
      var proto = Object.getPrototypeOf(sub);
      if (!proto || proto.__nxEvenGlyf || typeof proto._addGlyph !== 'function') return;
      var orig = proto._addGlyph;
      proto._addGlyph = function (gid) {
        var r = orig.call(this, gid);
        var i = this.glyf.length - 1, buf = this.glyf[i];
        if (buf && buf.length % 2) {
          var C = buf.constructor, padded = C && typeof C.alloc === 'function' ? C.alloc(buf.length + 1) : new Uint8Array(buf.length + 1);
          padded.set(buf, 0);
          this.glyf[i] = padded; this.offset += 1;
        }
        return r;
      };
      proto.__nxEvenGlyf = true;
    } catch (e) { /* 고치지 못해도 계속(맑은고딕 같은 글꼴은 원래 괜찮음) */ }
  }

  // jobs: [{formKey, values}] → {bytes, report}
  function renderBytes(jobs, opts) {
    opts = opts || {};
    var report = { placed: 0, shrunk: [], overflow: [], unknownKeys: [], warnings: [], forms: [], continued: [] };
    var libs, fontBytes;
    return ensureLibs(opts).then(function (l) { libs = l; return loadFont(opts); })
      .then(function (fb) { fontBytes = fb; patchFontkitSubset(libs.fontkit, fontBytes); return Promise.all(jobs.map(function (j) { return loadMap(j.formKey, opts); })); })
      .then(function (maps) {
        return Promise.all(maps.map(function (m) { return loadSource(m, opts); })).then(function (srcs) { return { maps: maps, srcs: srcs }; });
      })
      .then(function (d) {
        var PDFLib = libs.PDFLib;
        return PDFLib.PDFDocument.create().then(function (doc) {
          doc.registerFontkit(libs.fontkit);
          return Promise.all([doc.embedFont(fontBytes, { subset: true }), doc.embedFont(PDFLib.StandardFonts.HelveticaBold)])
            .then(function (fonts) {
              var srcDocs = {};
              var chain = Promise.resolve();
              jobs.forEach(function (job, ji) {
                chain = chain.then(function () {
                  var map = d.maps[ji], md5 = map.원본.md5 || ('#' + ji);
                  return (srcDocs[md5] ? Promise.resolve(srcDocs[md5]) : PDFLib.PDFDocument.load(d.srcs[ji]).then(function (sd) { srcDocs[md5] = sd; return sd; }))
                    .then(function (src) {
                      var values = job.values || {};
                      var pageNos = [], frontNos = [];
                      // 이어 찍기 계획(서식마다): 쪽별 필요한 장 수
                      var plans = map.서식.map(function (e) { return planEntry(e, values); });
                      var needOf = {};
                      map.서식.forEach(function (e, ei) {
                        toPages(e.쪽).forEach(function (p) {
                          if (pageNos.indexOf(p) < 0) pageNos.push(p);
                          if (frontNos.indexOf(p) < 0) frontNos.push(p);
                          needOf[p] = Math.max(needOf[p] || 1, plans[ei].needOf[p] || 1);
                        });
                        if (opts.backPages !== false) toPages(e.뒷면쪽).forEach(function (p) { if (pageNos.indexOf(p) < 0) pageNos.push(p); });
                      });
                      pageNos.sort(function (a, b) { return a - b; });
                      return doc.copyPages(src, pageNos.map(function (n) { return n - 1; })).then(function (copied) {
                        // 이어 찍을 장: 원본 쪽을 한 번 더 복사(쪽마다 따로 복사해야 서로 다른 장이 됨)
                        var extra = [];
                        frontNos.forEach(function (n) { for (var q = 1; q < (needOf[n] || 1); q++) extra.push({ n: n, q: q }); });
                        return extra.reduce(function (pr, x) {
                          return pr.then(function () { return doc.copyPages(src, [x.n - 1]).then(function (cp) { x.page = cp[0]; }); });
                        }, Promise.resolve()).then(function () { return { copied: copied, extra: extra }; });
                      }).then(function (cc) {
                        var copied = cc.copied, byNoP = [{}], all = [];
                        copied.forEach(function (p, i) {
                          var n = pageNos[i];
                          doc.addPage(p); byNoP[0][n] = p; all.push({ page: p, n: n, q: 0 });
                          if (p.getRotation && p.getRotation().angle) report.warnings.push(job.formKey + ' ' + n + '쪽이 돌려져 있음(' + p.getRotation().angle + '도) — 좌표가 어긋날 수 있음');
                          // 그 쪽의 이어 찍은 장은 바로 뒤에
                          cc.extra.forEach(function (x) {
                            if (x.n !== n) return;
                            doc.addPage(x.page); (byNoP[x.q] = byNoP[x.q] || {})[n] = x.page; all.push({ page: x.page, n: n, q: x.q });
                          });
                        });
                        var ctx = { PDFLib: PDFLib, font: fonts[0], bold: fonts[1], report: report, opts: opts, formKey: job.formKey, used: {},
                          color: opts.color ? PDFLib.rgb.apply(null, opts.color) : PDFLib.rgb(0, 0, 0) };
                        var before = report.placed, sheets = 1;
                        map.서식.forEach(function (e, ei) {
                          var pl = plans[ei];
                          if (pl.total <= 1) { stampEntry(ctx, e, function (n) { return byNoP[0][n]; }, values); return; }
                          sheets = Math.max(sheets, pl.total);
                          for (var q = 0; q < pl.total; q++) {
                            var vw = viewFor(pl, values, q, opts.continueTotals === 'first');
                            var c2 = Object.create(ctx); c2.used = {};
                            stampEntry(c2, e, (function (qq) { return function (n) { return byNoP[qq] && byNoP[qq][n]; }; })(q), vw.view);
                            Object.keys(c2.used).forEach(function (k) { ctx.used[vw.orig[k] || k] = 1; });
                          }
                          report.continued.push({ formKey: job.formKey, 서식: e.서식, pages: pl.total, 쪽별장수: pl.needOf, 한장용량: pl.capacity,
                            합계칸: opts.continueTotals === 'first' ? '첫 장에만' : '마지막 장에만' });
                        });
                        // 이어 찍은 표시(위치판 밖 위쪽 여백, 오른쪽 끝)
                        // [2026.10.20 눈검사 ④] 위치판 서식 항목에 장마다_따로: true(나라마다 한 장인 소득11호 부표1 등)면 그 쪽은 이어 찍은 장이 아니라 따로 내는 장 — 표시 안 함
                        var ownSheet_ = {};
                        map.서식.forEach(function (e) { if (e.장마다_따로) (e.칸 || []).forEach(function (c) { ownSheet_[c.쪽] = 1; }); });
                        all.forEach(function (a) {
                          var tot = needOf[a.n] || 1;
                          if (tot <= 1 || ownSheet_[a.n]) return;
                          var t = a.q === 0 ? '(1/' + tot + ')' : '(계속 ' + (a.q + 1) + '/' + tot + ')';
                          var sz = 7, tw = fonts[0].widthOfTextAtSize(t, sz);
                          a.page.drawText(t, { x: a.page.getWidth() - 24 - tw, y: a.page.getHeight() - 14, size: sz, font: fonts[0], color: PDFLib.rgb(0.25, 0.25, 0.25) });
                        });
                        Object.keys(values).forEach(function (k) {
                          var v = values[k];
                          if (!ctx.used[k] && v !== undefined && v !== null && v !== '') report.unknownKeys.push(job.formKey + ' ' + k);
                        });
                        if (opts.watermark) all.forEach(function (a) {
                          var p = a.page;
                          p.drawText(String(opts.watermark), { x: 40, y: p.getHeight() - 18, size: 8, font: fonts[0], color: PDFLib.rgb(0.8, 0.1, 0.1) });
                        });
                        report.forms.push({ formKey: job.formKey, 쪽: pageNos, 이어찍은장: cc.extra.length, 장수: sheets, 찍은칸: report.placed - before, 원본: basename(map.원본.파일), 개정: map.원본.개정일 || '' });
                      });
                    });
                });
              });
              return chain.then(function () { return doc.save(); });
            });
        });
      })
      .then(function (bytes) { return { bytes: bytes, report: report }; });
  }

  function renderMany(jobs, opts) {
    return renderBytes(jobs, opts).then(function (r) {
      return { blob: new Blob([r.bytes], { type: 'application/pdf' }), bytes: r.bytes, report: r.report };
    });
  }
  function render(formKey, values, opts) {
    return renderMany([{ formKey: formKey, values: values }], opts).then(function (r) { return r.blob; });
  }
  // 대응표(mappers.js)로 값을 만들고 여러 서식을 한 파일로 찍음
  //   list: ['양도84호', '양도84부표1'] 또는 [{formKey, ctx}] / ctx: 대응표에 넘길 자료
  function renderWithMappers(list, ctx, opts) {
    var M = (root.NxFormPrint && root.NxFormPrint.mappers) || api.mappers || {};
    var mapped = [];
    var jobs = list.map(function (it) {
      var key = typeof it === 'string' ? it : it.formKey;
      var fn = M[key];
      if (typeof fn !== 'function') throw new Error('값 대응표가 없는 서식입니다: ' + key);
      var m = fn(typeof it === 'string' ? ctx : (it.ctx || ctx));
      mapped.push({ formKey: key, missing: m.missing, notes: m.notes, checks: m.checks });
      return { formKey: key, values: m.values };
    });
    return renderMany(jobs, opts).then(function (r) { r.mapped = mapped; return r; });
  }
  function open(blob, name) {
    var url = URL.createObjectURL(blob);
    var w = window.open(url, '_blank');
    if (!w) { var a = document.createElement('a'); a.href = url; a.download = name || '법정서식.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    return url;
  }

  var api = {
    VERSION: VERSION, config: config, FOLDERS: FOLDERS,
    render: render, renderMany: renderMany, renderBytes: renderBytes, renderWithMappers: renderWithMappers,
    keys: keys, keysOfMap: keysOfMap, slotsOf: slotsOf, planEntry: planEntry, toPages: toPages, loadMap: loadMap, loadSource: loadSource,
    open: open, md5hex: md5hex, fmt: fmt, clearCache: function () { cache.maps = {}; cache.src = {}; cache.font = null; }
  };
  return api;
});
