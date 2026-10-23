// [2026.10.23 T6 2단계] 원본은 C:/GitHub/netax-replay/lib/vfs.js — Cloud Run 도커 안에 넣기 위해 복사(고치면 원본도 같이). 드라이브 파일은 drive-tree.js가 메모리 항목으로 채운다.
// 가짜 구글 드라이브 — 내 컴퓨터의 Drive 데스크톱 폴더(J:\내 드라이브\...)를 GAS DriveApp처럼 보이게 한다.
// 파일ID·수정시각은 ① manifests/<사건폴더>.json(Drive 커넥터로 받아 둔 목록) ② 정답지점검결과 json의 docTypes(이름→ID)
// ③ 글자인식기억 파일 이름(ocrtxt_<ID>_<수정시각>.txt) 순서로 맞춘다. 못 맞추면 가짜 ID(글자인식기억을 못 찾음 → "글자 없음").
// 쓰기(createFile·setContent·createFolder)는 메모리에만 한다 — 실제 드라이브 파일은 절대 안 바뀐다.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', heic: 'image/heic', webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  md: 'text/markdown', txt: 'text/plain', json: 'application/json', csv: 'text/csv', html: 'text/html', htm: 'text/html',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwp: 'application/x-hwp', hwpx: 'application/hwp+zip', zip: 'application/zip', '7z': 'application/x-7z-compressed', rar: 'application/x-rar-compressed',
  gdoc: 'application/vnd.google-apps.document', gsheet: 'application/vnd.google-apps.spreadsheet', gslides: 'application/vnd.google-apps.presentation',
  lnk: 'application/octet-stream'
};
const mimeOf = (name) => MIME[(path.extname(name).slice(1) || '').toLowerCase()] || 'application/octet-stream';
const fakeId = (s) => 'LOCAL' + crypto.createHash('sha1').update(s).digest('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 28);

class Iter { constructor(a) { this.a = a.slice(); this.i = 0; } hasNext() { return this.i < this.a.length; } next() { if (!this.hasNext()) throw new Error('더 없음'); return this.a[this.i++]; } }

class Blob {
  constructor(get, name, type) { this._get = get; this._name = name; this._type = type; }
  getBytes() { return Array.from(this._get()); }
  getDataAsString() { return this._get().toString('utf8'); }
  getName() { return this._name; }
  setName(n) { this._name = n; return this; }
  getContentType() { return this._type; }
  setContentType(t) { this._type = t; return this; }
  _buf() { return this._get(); }
}

class VFile {
  constructor(vfs, o) { Object.assign(this, { _vfs: vfs }, o); }
  getId() { return this.id; }
  getName() { return this.name; }
  getMimeType() { return this.mimeType; }
  getLastUpdated() { return new Date(this.modified); }
  getDateCreated() { return new Date(this.modified); }
  getSize() { try { return this.local ? fs.statSync(this.local).size : Buffer.byteLength(this.mem || ''); } catch (e) { return 0; } }
  getUrl() { return 'https://drive.google.com/file/d/' + this.id + '/view'; }
  isTrashed() { return !!this.trashed; }
  setTrashed(b) { this.trashed = !!b; this._vfs.log.push('휴지통(메모리만): ' + this.name); return this; }
  getParents() { return new Iter(this.parent ? [this.parent] : []); }
  getBlob() { return new Blob(() => (this.mem != null ? Buffer.from(String(this.mem)) : fs.readFileSync(this.local)), this.name, this.mimeType); }
  getAs() { return this.getBlob(); }
  setContent(t) { this.mem = String(t); this.modified = Date.now(); this._vfs.writes.push(this.name); return this; }
  setName(n) { this._vfs.log.push('이름 바꾸기(메모리만): ' + this.name + ' → ' + n); this.name = n; return this; }
  getDescription() { return this.desc || ''; }
  setDescription(d) { this.desc = d; return this; }
  moveTo(folder) { if (this.parent) this.parent._files = this.parent._files.filter((f) => f !== this); this.parent = folder; folder._files.push(this); return this; }
  makeCopy(name, folder) { return (folder || this.parent).createFile(name || this.name, this.getBlob().getDataAsString(), this.mimeType); }
}

class VFolder {
  constructor(vfs, o) { Object.assign(this, { _vfs: vfs, _files: [], _folders: [] }, o); }
  getId() { return this.id; }
  getName() { return this.name; }
  getUrl() { return 'https://drive.google.com/drive/folders/' + this.id; }
  isTrashed() { return false; }
  getParents() { return new Iter(this.parent ? [this.parent] : []); }
  _scan() { if (this._lazy) { const f = this._lazy; this._lazy = null; f(); } }
  getFiles() { this._scan(); return new Iter(this._files.filter((f) => !f.trashed)); }
  getFolders() { this._scan(); return new Iter(this._folders); }
  getFilesByName(n) { this._scan(); return new Iter(this._files.filter((f) => !f.trashed && f.name === n)); }
  getFoldersByName(n) { this._scan(); return new Iter(this._folders.filter((f) => f.name === n)); }
  getFilesByType(t) { this._scan(); return new Iter(this._files.filter((f) => !f.trashed && f.mimeType === t)); }
  searchFiles() { this._scan(); return new Iter(this._files.filter((f) => !f.trashed)); }
  createFile(name, content, mime) {
    if (name && typeof name === 'object' && name._buf) { const b = name; name = b.getName(); content = b._buf().toString('utf8'); mime = b.getContentType(); }
    const f = new VFile(this._vfs, { id: fakeId('mem:' + this.id + '/' + name + ':' + Date.now() + Math.random()), name, mimeType: mime || mimeOf(name), modified: Date.now(), mem: String(content == null ? '' : content), parent: this });
    this._files.push(f); this._vfs.byId[f.id] = f; this._vfs.writes.push((this.name || '') + '/' + name);
    return f;
  }
  createFolder(name) {
    const d = new VFolder(this._vfs, { id: fakeId('memdir:' + this.id + '/' + name + Math.random()), name, parent: this });
    this._folders.push(d); this._vfs.byId[d.id] = d; return d;
  }
  addFile(f) { return this; }
}

class VFS {
  constructor(opt) {
    this.byId = {}; this.writes = []; this.log = [];
    this.stats = { idManifest: 0, idDocTypes: 0, idStoreOnly: 0, idFake: 0, modFromStore: 0 };
    this.manifest = opt.manifest || {};   // 상대경로 → { id, modified, mimeType }
    this.nameToId = opt.nameToId || {};   // 파일 이름 → ID(정답지점검결과 docTypes; 이름이 겹치면 빠짐)
    this.storeIndex = opt.storeIndex || {}; // ID → [수정시각,…] (글자인식기억 파일 이름에서)
    this.root = this.mem('메모리 루트');
  }
  mem(name, parent) { const d = new VFolder(this, { id: fakeId('memroot:' + name), name, parent: parent || null }); this.byId[d.id] = d; return d; }
  // 내 컴퓨터 폴더를 가짜 드라이브 폴더로 — rel은 사건폴더 기준 상대경로(매니페스트 키)
  mount(localDir, opt) {
    opt = opt || {};
    const self = this;
    const mk = function (dir, rel, parent, id) {
      const d = new VFolder(self, { id: id || (self.manifest[rel + '/'] && self.manifest[rel + '/'].id) || fakeId('dir:' + dir), name: path.basename(dir), parent, local: dir });
      self.byId[d.id] = d;
      d._lazy = function () {
        let ents = [];
        try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        ents.forEach(function (e) {
          const full = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
          if (e.isDirectory()) { d._folders.push(mk(full, r, d)); return; }
          if (/^desktop\.ini$/i.test(e.name)) return;
          d._files.push(self._fileFor(full, r, e.name, d));
        });
      };
      if (opt.noStats) d._noStats = true;
      if (opt.eager !== false) d._scan();
      return d;
    };
    return mk(localDir, '', opt.parent || null, opt.id);
  }
  _fileFor(full, rel, name, parent) {
    let st; try { st = fs.statSync(full); } catch (e) { st = { mtimeMs: Date.now() }; }
    const m = this.manifest[rel];
    let id, modified, mimeType = mimeOf(name);
    // Drive 데스크톱은 확장자 없는 드라이브 파일(예: "장례비명세2")에 확장자를 붙여 보여 준다 — 드라이브 쪽 이름으로 되돌린다
    const bare = name.replace(/\.[A-Za-z0-9]{2,5}$/, ''), relBare = rel.replace(/\.[A-Za-z0-9]{2,5}$/, '');
    const mm = m || this.manifest[relBare];
    if (mm && mm.id) { id = mm.id; modified = mm.modified; if (mm.mimeType) mimeType = mm.mimeType; if (mm.name) name = mm.name; this.stats.idManifest++; }
    else if (this.nameToId[name]) { id = this.nameToId[name]; this.stats.idDocTypes++; }
    else if (bare !== name && this.nameToId[bare]) { id = this.nameToId[bare]; name = bare; this.stats.idDocTypes++; }
    if (id && !modified) {
      const ms = this.storeIndex[id];
      if (ms && ms.length) { modified = Math.max.apply(null, ms); this.stats.modFromStore++; }
    }
    if (!id) { id = fakeId('file:' + full); if (!parent || !parent._noStats) this.stats.idFake++; }
    const f = new VFile(this, { id, name, mimeType, modified: modified || Math.round(st.mtimeMs), local: full, parent, rel });
    this.byId[id] = f;
    return f;
  }
  getFileById(id) { const f = this.byId[String(id)]; if (!f || !(f instanceof VFile)) throw new Error('로컬 재현기: 파일 없음 ' + id); return f; }
  getFolderById(id) { const f = this.byId[String(id)]; if (!f || !(f instanceof VFolder)) throw new Error('로컬 재현기: 폴더 없음 ' + id); f._scan(); return f; }
  allFiles() { return Object.keys(this.byId).map((k) => this.byId[k]).filter((f) => f instanceof VFile); }
}

module.exports = { VFS, VFile, VFolder, Iter, Blob, mimeOf, fakeId };
