// ============================================================
// [2026.11.20] 금융거래 합치기 — 암호 걸린 은행 엑셀·압축 열기(토큰 0, 바깥 전송 없음)
// ------------------------------------------------------------
// 세무사님 11-20 「권장대로 하자」(docs/_기록/금융거래_10년검토_계획서_20261120.html ㉤): 사건에 암호를 한 번 적어 두시면
// 그 사건 파일을 열 때 쓴다. 암호는 장부·기록·시트에 남기지 않는다.
//  · 엑셀(xlsx·「.xlsx」 이름의 옛 형식) 암호 = Office 「agile」 암호화(신한은행 거래내역 3개가 이 방식 — 11-20 실자료 조사)
//    겉은 복합 문서(CFB) 안에 EncryptionInfo(XML)·EncryptedPackage 두 흐름. 암호 → SHA-512 되풀이 → AES-CBC로 열쇠를 풀고,
//    패키지를 4096바이트 토막마다 풀면 보통 xlsx(zip)가 나온다.
//  · 옛 방식 「standard」(엑셀 2007)도 같은 틀로 연다(AES-ECB, SHA-1 50,000번).
//  · 압축(zip) 암호 = 전통 PKWARE 방식(ZipCrypto). AES 압축(WinZip)은 못 엶 — 그렇다고 알림.
// 바이트는 0~255 숫자 배열(Uint8Array)로 다룬다. 해시는 Utilities.computeDigest(GAS) — node 시험에선 같은 이름의 흉내를 넣는다.
// ============================================================

function finU8_(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  var u = new Uint8Array(bytes.length);
  for (var i = 0; i < bytes.length; i++) u[i] = bytes[i] & 255;
  return u;
}
function finSigned_(u) { var a = new Array(u.length); for (var i = 0; i < u.length; i++) a[i] = u[i] > 127 ? u[i] - 256 : u[i]; return a; }
function finConcat_(list) {
  var n = 0, i; for (i = 0; i < list.length; i++) n += list[i].length;
  var out = new Uint8Array(n), o = 0;
  for (i = 0; i < list.length; i++) { out.set(list[i], o); o += list[i].length; }
  return out;
}
function finHash_(alg, u) {
  var A = Utilities.DigestAlgorithm, map = { 'SHA512': A.SHA_512, 'SHA-512': A.SHA_512, 'SHA1': A.SHA_1, 'SHA-1': A.SHA_1, 'SHA256': A.SHA_256, 'SHA-256': A.SHA_256, 'SHA384': A.SHA_384, 'SHA-384': A.SHA_384 };
  var a = map[String(alg).toUpperCase()];
  if (!a) throw new Error('암호 해시 방식을 모름: ' + alg);
  return finU8_(Utilities.computeDigest(a, finSigned_(u)));
}
function finLe32_(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
function finB64_(s) { return finU8_(Utilities.base64Decode(String(s || ''))); }

// ---------- 복합 문서(CFB) 읽기 — 흐름 이름 → 바이트 ----------
function finCfbIs_(u) { return u.length > 512 && u[0] === 0xD0 && u[1] === 0xCF && u[2] === 0x11 && u[3] === 0xE0 && u[4] === 0xA1 && u[5] === 0xB1 && u[6] === 0x1A && u[7] === 0xE1; }
function finCfbRead_(bytes) {
  var u = finU8_(bytes);
  if (!finCfbIs_(u)) throw new Error('복합 문서가 아님');
  var r16 = function (p) { return u[p] | (u[p + 1] << 8); }, r32 = function (p) { return (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; };
  var secSize = 1 << r16(30), miniSize = 1 << r16(32);
  var nFat = r32(44), dirStart = r32(48), miniCut = r32(56), miniFatStart = r32(60), nMiniFat = r32(64), difatStart = r32(68), nDifat = r32(72);
  var secOff = function (s) { return (s + 1) * secSize; };
  var fatSecs = [], i;
  for (i = 0; i < 109 && fatSecs.length < nFat; i++) { var v = r32(76 + i * 4); if (v < 0xFFFFFFFA) fatSecs.push(v); }
  var dsec = difatStart, guard = 0;
  while (fatSecs.length < nFat && dsec < 0xFFFFFFFA && guard++ < 10000 && nDifat) {
    var base = secOff(dsec), per = secSize / 4 - 1;
    for (i = 0; i < per && fatSecs.length < nFat; i++) { var w = r32(base + i * 4); if (w < 0xFFFFFFFA) fatSecs.push(w); }
    dsec = r32(base + per * 4);
  }
  var fat = [];
  fatSecs.forEach(function (s) { var b = secOff(s); for (var k = 0; k < secSize / 4; k++) fat.push(r32(b + k * 4)); });
  var chain = function (start, table) { var out = [], s = start, g = 0; while (s < 0xFFFFFFFA && g++ < 1000000) { out.push(s); s = table[s]; } return out; };
  var readChain = function (start) { var cs = chain(start, fat), parts = cs.map(function (s) { return u.subarray(secOff(s), secOff(s) + secSize); }); return finConcat_(parts); };
  var dirBytes = readChain(dirStart), entries = [];
  for (var off = 0; off + 128 <= dirBytes.length; off += 128) {
    var nl = dirBytes[off + 64] | (dirBytes[off + 65] << 8), name = '';
    for (var c = 0; c + 1 < nl - 1 && c < 64; c += 2) name += String.fromCharCode(dirBytes[off + c] | (dirBytes[off + c + 1] << 8));
    var d = dirBytes.subarray(off, off + 128), dv = function (p) { return (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0; };
    entries.push({ name: name, type: d[66], start: dv(116), size: dv(120) });
  }
  var root = entries[0] || { start: 0xFFFFFFFE, size: 0 };
  var miniStream = root.start < 0xFFFFFFFA ? readChain(root.start) : new Uint8Array(0);
  var miniFat = [];
  if (nMiniFat && miniFatStart < 0xFFFFFFFA) { var mf = readChain(miniFatStart); for (i = 0; i + 4 <= mf.length; i += 4) miniFat.push((mf[i] | (mf[i + 1] << 8) | (mf[i + 2] << 16) | (mf[i + 3] << 24)) >>> 0); }
  var streams = {};
  entries.forEach(function (e) {
    if (e.type !== 2) return;
    var data;
    if (e.size < miniCut && miniFat.length) {
      var cs = chain(e.start, miniFat);
      data = finConcat_(cs.map(function (s) { return miniStream.subarray(s * miniSize, s * miniSize + miniSize); }));
    } else data = readChain(e.start);
    streams[e.name] = data.subarray(0, e.size);
  });
  return streams;
}

// ---------- AES(풀기만) — 128·192·256 ----------
var FIN_AES_ = null;
function finAesTables_() {
  if (FIN_AES_) return FIN_AES_;
  var sbox = new Uint8Array(256), inv = new Uint8Array(256), p = 1, q = 1;
  do {
    p = p ^ ((p << 1) & 255) ^ (p & 0x80 ? 0x1B : 0);
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 255; if (q & 0x80) q ^= 0x09;
    var x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    x = (x ^ 0x63) & 255; sbox[p] = x; inv[x] = p;
  } while (p !== 1);
  sbox[0] = 0x63; inv[0x63] = 0;
  var mul = function (a, b) { var r = 0; while (b) { if (b & 1) r ^= a; a = (a << 1) ^ (a & 0x80 ? 0x11B : 0); b >>= 1; } return r & 255; };
  var T = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (var i = 0; i < 256; i++) {
    var s = inv[i], w = ((mul(s, 14) << 24) | (mul(s, 9) << 16) | (mul(s, 13) << 8) | mul(s, 11)) >>> 0;
    for (var k = 0; k < 4; k++) { T[k][i] = w; w = ((w >>> 8) | (w << 24)) >>> 0; }
  }
  FIN_AES_ = { sbox: sbox, inv: inv, T: T, mul: mul };
  return FIN_AES_;
}
function finAesKey_(key) {
  var A = finAesTables_(), nk = key.length / 4, nr = nk + 6, w = new Uint32Array(4 * (nr + 1)), rcon = 1, i;
  if ([4, 6, 8].indexOf(nk) === -1) throw new Error('AES 열쇠 길이 이상: ' + key.length);
  for (i = 0; i < nk; i++) w[i] = ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0;
  for (i = nk; i < w.length; i++) {
    var t = w[i - 1];
    if (i % nk === 0) { t = ((A.sbox[(t >>> 16) & 255] << 24) | (A.sbox[(t >>> 8) & 255] << 16) | (A.sbox[t & 255] << 8) | A.sbox[t >>> 24]) ^ (rcon << 24); rcon = A.mul(rcon, 2); }
    else if (nk > 6 && i % nk === 4) t = (A.sbox[t >>> 24] << 24) | (A.sbox[(t >>> 16) & 255] << 16) | (A.sbox[(t >>> 8) & 255] << 8) | A.sbox[t & 255];
    w[i] = (w[i - nk] ^ t) >>> 0;
  }
  // 풀기용 열쇠: 순서를 뒤집고 가운데 바퀴는 InvMixColumns를 미리 건다
  var dw = new Uint32Array(w.length);
  for (var r = 0; r <= nr; r++) for (var c = 0; c < 4; c++) {
    var v = w[(nr - r) * 4 + c];
    if (r > 0 && r < nr) v = (A.T[0][A.sbox[v >>> 24]] ^ A.T[1][A.sbox[(v >>> 16) & 255]] ^ A.T[2][A.sbox[(v >>> 8) & 255]] ^ A.T[3][A.sbox[v & 255]]) >>> 0;
    dw[r * 4 + c] = v;
  }
  return { nr: nr, dw: dw };
}
function finAesBlock_(K, inp, ip, out, op) {
  var A = finAesTables_(), T = A.T, inv = A.inv, dw = K.dw, nr = K.nr;
  var g = function (p) { return ((inp[p] << 24) | (inp[p + 1] << 16) | (inp[p + 2] << 8) | inp[p + 3]) >>> 0; };
  var s0 = g(ip) ^ dw[0], s1 = g(ip + 4) ^ dw[1], s2 = g(ip + 8) ^ dw[2], s3 = g(ip + 12) ^ dw[3], t0, t1, t2, t3, k = 4;
  for (var r = 1; r < nr; r++) {
    t0 = T[0][s0 >>> 24] ^ T[1][(s3 >>> 16) & 255] ^ T[2][(s2 >>> 8) & 255] ^ T[3][s1 & 255] ^ dw[k];
    t1 = T[0][s1 >>> 24] ^ T[1][(s0 >>> 16) & 255] ^ T[2][(s3 >>> 8) & 255] ^ T[3][s2 & 255] ^ dw[k + 1];
    t2 = T[0][s2 >>> 24] ^ T[1][(s1 >>> 16) & 255] ^ T[2][(s0 >>> 8) & 255] ^ T[3][s3 & 255] ^ dw[k + 2];
    t3 = T[0][s3 >>> 24] ^ T[1][(s2 >>> 16) & 255] ^ T[2][(s1 >>> 8) & 255] ^ T[3][s0 & 255] ^ dw[k + 3];
    s0 = t0 >>> 0; s1 = t1 >>> 0; s2 = t2 >>> 0; s3 = t3 >>> 0; k += 4;
  }
  var put = function (p, a, b, c, d, kk) {
    var v = ((inv[a >>> 24] << 24) | (inv[(b >>> 16) & 255] << 16) | (inv[(c >>> 8) & 255] << 8) | inv[d & 255]) ^ kk;
    out[p] = (v >>> 24) & 255; out[p + 1] = (v >>> 16) & 255; out[p + 2] = (v >>> 8) & 255; out[p + 3] = v & 255;
  };
  put(op, s0, s3, s2, s1, dw[k]); put(op + 4, s1, s0, s3, s2, dw[k + 1]); put(op + 8, s2, s1, s0, s3, dw[k + 2]); put(op + 12, s3, s2, s1, s0, dw[k + 3]);
}
function finAesCbcDec_(key, iv, data) {
  var K = finAesKey_(key), out = new Uint8Array(data.length - (data.length % 16)), prev = iv.slice(0, 16);
  for (var p = 0; p < out.length; p += 16) {
    finAesBlock_(K, data, p, out, p);
    for (var j = 0; j < 16; j++) out[p + j] ^= prev[j];
    prev = data.subarray(p, p + 16);
  }
  return out;
}
function finAesEcbDec_(key, data) {
  var K = finAesKey_(key), out = new Uint8Array(data.length - (data.length % 16));
  for (var p = 0; p < out.length; p += 16) finAesBlock_(K, data, p, out, p);
  return out;
}

// ---------- 엑셀 암호 풀기 ----------
function finIsEncryptedOffice_(bytes) {
  var u = finU8_(bytes);
  if (!finCfbIs_(u)) return false;
  try { var st = finCfbRead_(u); return !!(st.EncryptionInfo && st.EncryptedPackage); } catch (e) { return false; }
}
function finFixLen_(u, n, pad) { if (u.length >= n) return u.slice(0, n); var o = new Uint8Array(n); o.fill(pad); o.set(u); return o; }
function finPwBytes_(pw) { var s = String(pw || ''), u = new Uint8Array(s.length * 2); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); u[2 * i] = c & 255; u[2 * i + 1] = c >>> 8; } return u; }
// 돌려줌: 풀린 패키지(Uint8Array, 보통 xlsx zip). 암호가 틀리면 Error('암호가 맞지 않음')
function finOfficeDecrypt_(bytes, password) {
  var st = finCfbRead_(bytes), info = st.EncryptionInfo, pkg = st.EncryptedPackage;
  if (!info || !pkg) throw new Error('암호 걸린 엑셀이 아님');
  var vMaj = info[0] | (info[1] << 8), vMin = info[2] | (info[3] << 8);
  var size = (pkg[0] | (pkg[1] << 8) | (pkg[2] << 16) | (pkg[3] << 24)) >>> 0; size += (pkg[4] | (pkg[5] << 8) | (pkg[6] << 16) | (pkg[7] << 24)) * 4294967296;
  var body = pkg.subarray(8), pwb = finPwBytes_(password), out;
  if (vMaj === 4 && vMin === 4) { // agile
    var xml = ''; for (var i = 8; i < info.length; i++) xml += String.fromCharCode(info[i]);
    var attr = function (tag, name) { var m = new RegExp('<' + tag + '\\b[^>]*\\s' + name + '="([^"]*)"').exec(xml); return m ? m[1] : ''; };
    var kd = { salt: finB64_(attr('keyData', 'saltValue')), alg: attr('keyData', 'hashAlgorithm'), block: Number(attr('keyData', 'blockSize')) || 16, keyBits: Number(attr('keyData', 'keyBits')) || 256, cipher: attr('keyData', 'cipherAlgorithm'), chain: attr('keyData', 'cipherChaining') };
    var ek = { salt: finB64_(attr('p:encryptedKey', 'saltValue')), alg: attr('p:encryptedKey', 'hashAlgorithm'), spin: Number(attr('p:encryptedKey', 'spinCount')), keyBits: Number(attr('p:encryptedKey', 'keyBits')) || 256,
      hashSize: Number(attr('p:encryptedKey', 'hashSize')) || 64, vIn: finB64_(attr('p:encryptedKey', 'encryptedVerifierHashInput')), vVal: finB64_(attr('p:encryptedKey', 'encryptedVerifierHashValue')), kv: finB64_(attr('p:encryptedKey', 'encryptedKeyValue')) };
    if (!/AES/i.test(kd.cipher) || !/CBC/i.test(kd.chain)) throw new Error('이 암호 방식은 아직 못 엶: ' + kd.cipher + ' ' + kd.chain);
    var h = finHash_(ek.alg, finConcat_([ek.salt, pwb]));
    for (var it = 0; it < ek.spin; it++) h = finHash_(ek.alg, finConcat_([finLe32_(it), h]));
    var derive = function (blk) { return finFixLen_(finHash_(ek.alg, finConcat_([h, new Uint8Array(blk)])), ek.keyBits / 8, 0x36); };
    var vin = finAesCbcDec_(derive([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]), ek.salt, ek.vIn);
    var vval = finAesCbcDec_(derive([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]), ek.salt, ek.vVal);
    var hin = finHash_(ek.alg, vin.slice(0, ek.salt.length));
    for (var q = 0; q < hin.length; q++) if (hin[q] !== vval[q]) throw new Error('암호가 맞지 않음');
    var secret = finAesCbcDec_(derive([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]), ek.salt, ek.kv).slice(0, kd.keyBits / 8);
    var parts = [], seg = 4096;
    for (var s = 0, n = 0; s < body.length; s += seg, n++) {
      var iv = finFixLen_(finHash_(kd.alg, finConcat_([kd.salt, finLe32_(n)])), kd.block, 0x36);
      parts.push(finAesCbcDec_(secret, iv, body.subarray(s, Math.min(body.length, s + seg))));
    }
    out = finConcat_(parts);
  } else if ((vMaj === 3 || vMaj === 4) && vMin === 2) { // standard(엑셀 2007)
    var hs = (info[8] | (info[9] << 8) | (info[10] << 16) | (info[11] << 24)) >>> 0, H = 12;
    var algId = (info[H + 8] | (info[H + 9] << 8) | (info[H + 10] << 16) | (info[H + 11] << 24)) >>> 0, kBits = (info[H + 16] | (info[H + 17] << 8) | (info[H + 18] << 16) | (info[H + 19] << 24)) >>> 0;
    if (algId !== 0x660E && algId !== 0x660F && algId !== 0x6610) throw new Error('이 암호 방식은 아직 못 엶(RC4 등)');
    var V = H + hs, vsalt = info.subarray(V + 4, V + 20), vEnc = info.subarray(V + 20, V + 36), vhEnc = info.subarray(V + 40, V + 72);
    var hh = finHash_('SHA1', finConcat_([vsalt, pwb]));
    for (var j = 0; j < 50000; j++) hh = finHash_('SHA1', finConcat_([finLe32_(j), hh]));
    hh = finHash_('SHA1', finConcat_([hh, finLe32_(0)]));
    var x1 = new Uint8Array(64), x2 = new Uint8Array(64); x1.fill(0x36); x2.fill(0x5c);
    for (var z = 0; z < hh.length; z++) { x1[z] ^= hh[z]; x2[z] ^= hh[z]; }
    var key = finConcat_([finHash_('SHA1', x1), finHash_('SHA1', x2)]).slice(0, kBits / 8);
    var dv = finAesEcbDec_(key, vEnc), dvh = finAesEcbDec_(key, vhEnc), hv = finHash_('SHA1', dv);
    for (var y = 0; y < 20; y++) if (hv[y] !== dvh[y]) throw new Error('암호가 맞지 않음');
    out = finAesEcbDec_(key, body);
  } else throw new Error('이 암호 방식은 아직 못 엶(판 ' + vMaj + '.' + vMin + ')');
  return out.subarray(0, size);
}

// ---------- 압축(zip) 전통 암호 ----------
var FIN_CRC_ = null;
function finCrcTab_() { if (FIN_CRC_) return FIN_CRC_; FIN_CRC_ = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; FIN_CRC_[n] = c >>> 0; } return FIN_CRC_; }
function finZipCryptoDec_(data, password) {
  var T = finCrcTab_(), k0 = 0x12345678, k1 = 0x23456789, k2 = 0x34567890;
  var upd = function (b) {
    k0 = (T[(k0 ^ b) & 255] ^ (k0 >>> 8)) >>> 0;
    k1 = (k1 + (k0 & 255)) >>> 0; k1 = (Math.imul(k1, 134775813) + 1) >>> 0;
    k2 = (T[(k2 ^ (k1 >>> 24)) & 255] ^ (k2 >>> 8)) >>> 0;
  };
  var pw = Utilities.newBlob(String(password || '')).getBytes();
  for (var i = 0; i < pw.length; i++) upd(pw[i] & 255);
  var out = new Uint8Array(data.length);
  for (var j = 0; j < data.length; j++) { var t = (k2 | 2) & 0xFFFF, c = (data[j] ^ ((Math.imul(t, t ^ 1) >>> 8) & 255)) & 255; out[j] = c; upd(c); }
  return out.subarray(12); // 앞 12바이트는 암호 머리
}
// 압축 풀기(암호 있으면 씀) — 돌려줌 { files:[{name, bytes(Uint8Array)}], enc: 못 푼 암호 파일 수, aes: AES 암호 수, bad: 암호 틀림 수 }
function finUnzip_(bytes, password) {
  var u = finU8_(bytes);
  var r16 = function (p) { return u[p] | (u[p + 1] << 8); }, r32 = function (p) { return (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; };
  var e = -1; for (var p = u.length - 22; p >= Math.max(0, u.length - 22 - 65557); p--) { if (u[p] === 0x50 && u[p + 1] === 0x4b && u[p + 2] === 5 && u[p + 3] === 6) { e = p; break; } }
  if (e < 0) throw new Error('zip 끝 목록 없음');
  var cnt = r16(e + 10), off = r32(e + 16), res = { files: [], enc: 0, aes: 0, bad: 0 };
  for (var j = 0; j < cnt; j++) {
    if (r32(off) !== 0x02014b50) break;
    var fl = r16(off + 8), meth = r16(off + 10), crc = r32(off + 16), csz = r32(off + 20), nl = r16(off + 28), el = r16(off + 30), cl = r16(off + 32), lo = r32(off + 42);
    var name = tcZipName_(u.subarray(off + 46, off + 46 + nl), !!(fl & 0x800));
    off += 46 + nl + el + cl;
    if (/\/$/.test(name)) continue;
    var ds = lo + 30 + r16(lo + 26) + r16(lo + 28), raw = u.subarray(ds, ds + csz);
    if (meth === 99) { res.aes++; continue; }
    if (fl & 1) {
      if (!password) { res.enc++; continue; }
      raw = finZipCryptoDec_(raw, password);
    }
    var data;
    try { if (meth === 0) data = raw; else if (meth === 8) data = finU8_(tcInflateRaw_(raw)); else continue; }
    catch (err) { if (fl & 1) { res.bad++; continue; } throw err; }
    if (fl & 1) { // 암호가 맞았는지 — 풀린 내용의 CRC가 맞아야 함
      var T = finCrcTab_(), c = 0xFFFFFFFF; for (var k = 0; k < data.length; k++) c = T[(c ^ data[k]) & 255] ^ (c >>> 8);
      if (((c ^ 0xFFFFFFFF) >>> 0) !== crc) { res.bad++; continue; }
    }
    res.files.push({ name: name, bytes: data });
  }
  return res;
}
