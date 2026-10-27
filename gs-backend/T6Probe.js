// [2026.10.27 T6 2단계 점검] 편집기에서 바로 찾기 쉽게 별도 파일 — 시험이 끝나면 이 파일은 지운다.
// [2026.10.27 T6 2단계 점검] 편집기에서 직접 실행하는 토큰 점검 — ScriptApp.getIdentityToken()이 웹앱(익명 접근)에서 null로 와서(🧪 비교 401),
//  편집기 실행 문맥에서는 나오는지 가른다. 결과는 총괄관리자\_가상사건\_시험서비스_비교_YYYYMMDD.json에 한 줄(토큰 본문은 적지 않고 있음/없음·aud·/health 코드만).
function t6TokenProbe() {
  var rec = { probe: 'editor', at: Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), user: String(Session.getEffectiveUser().getEmail() || '') };
  var token = null; try { token = ScriptApp.getIdentityToken(); } catch (e) { rec.tokenError = String(e && e.message || e).slice(0, 120); }
  rec.hasToken = !!token; rec.tokenLen = token ? String(token).length : 0;
  if (token) { try { var seg = String(token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'); while (seg.length % 4) seg += '='; var pl = JSON.parse(Utilities.newBlob(Utilities.base64Decode(seg)).getDataAsString('UTF-8')); rec.aud = String(pl.aud || ''); rec.iss = String(pl.iss || ''); rec.email = String(pl.email || ''); } catch (e) { rec.audError = String(e && e.message || e).slice(0, 80); } }
  var url = String(PropertiesService.getScriptProperties().getProperty(T6_READER_URL_PROP_) || T6_READER_URL_DEFAULT_ || '').trim().replace(/\/+$/, '');
  if (url && token) { try { var r = UrlFetchApp.fetch(url + '/health', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }); rec.healthCode = r.getResponseCode(); rec.healthBody = String(r.getContentText() || '').slice(0, 120); } catch (e) { rec.healthError = String(e && e.message || e).slice(0, 120); } }
  try {
    var chief = getChiefManagerFolder_(); var dir = getOrCreateSubfolder_(chief, '_가상사건');
    var name = '_시험서비스_비교_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd') + '.json';
    var it = dir.getFilesByName(name), arr = [];
    if (it.hasNext()) { var f = it.next(); try { arr = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { arr = []; } if (!Array.isArray(arr)) arr = []; arr.push(rec); f.setContent(JSON.stringify(arr, null, 1)); }
    else dir.createFile(name, JSON.stringify([rec], null, 1), 'application/json');
  } catch (e) { rec.saved = '기록 실패: ' + String(e && e.message || e).slice(0, 100); }
  Logger.log(JSON.stringify(rec));
  return rec;
}

