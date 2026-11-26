// ============================================================
// [2026.11.26] 칸 하나 — GAS·넥스·세무사님이 같은 칸에 적고 머리말·글자색으로 가른다
// ------------------------------------------------------------
// 세무사님 11-26 「소명처럼 gas와 넥스와 내가 입력할 필드를 각각 만들지 말고 가급적 필드를 하나로 합치되,
//  각각이 입력한 것을 구분할 수 있도록 하자」 → 「권장대로 하자」
//  (계획서 총괄관리자/_기록/금융거래_누가적었나_계획서_20261126.html)
//  · 파랑 「GAS · …」 = GAS 답 · 보라 「넥스 · …」 = 넥스 답 · 검정(머리말 없음) = 세무사님
//  · 셈은 세무사님 > 넥스 > GAS. 검정만 확정 — 파랑·보라는 잠정. 아무도 세무사님 검정 글을 덮지 않는다
//  · 거두기: 머리말이 붙은 글은 세무사님 값이 아님(지우거나 고쳐 적으시면 세무사님 값)
//  · 넥스 값 보관: _금융거래_검토.json 의 U.nexV[열쇠] = { v, why, at } (세무사님이 넥스를 부르셨을 때만 씀 — finNexNote_)
// ============================================================
var FIN_CELL_GAS_ = 'GAS · ', FIN_CELL_NEX_ = '넥스 · ';
var FIN_CELL_CLR_ = { gas: '#1a56b0', nex: '#7b2fbf', user: '#000000', '': '#000000' };
var FIN_CELL_RE_ = /^(GAS|넥스|자동) ?·\s*/;   // 「자동 · 」은 11-25 소명 칸의 옛 GAS 글

// 칸 글 → 누가·값
function finCellWho_(v) {
  var t = v instanceof Date ? v : String(v == null ? '' : v).trim();
  if (t instanceof Date) return { who: 'user', v: t };
  var m = FIN_CELL_RE_.exec(t);
  if (m) return { who: m[1] === '넥스' ? 'nex' : 'gas', v: t.slice(m[0].length).trim() };
  return { who: t ? 'user' : '', v: t };
}
// 세무사님 값만(머리말 붙은 글은 '')
function finCellUser_(v) { var c = finCellWho_(v); return c.who === 'user' ? c.v : ''; }
// 보일 글 — 세무사님 > 넥스 > GAS
function finCellShow_(user, nex, gas) {
  var u = user instanceof Date ? user : String(user == null ? '' : user).trim(), n = String(nex == null ? '' : nex).trim(), g = String(gas == null ? '' : gas).trim();
  if (u) return { t: u, who: 'user' };
  if (n) return { t: FIN_CELL_NEX_ + n, who: 'nex' };
  if (g) return { t: FIN_CELL_GAS_ + g, who: 'gas' };
  return { t: '', who: '' };
}
// 누가 → 글자색
function finCellColor_(who) { return FIN_CELL_CLR_[who || ''] || '#000000'; }
// 고르기 목록 — 기본 목록 + 지금 보이는 글(머리말 붙은 것 포함, 경고 세모가 안 뜨게). 시트 한도 500
function finCellList_(base, shown) {
  var seen = {}, out = [];
  base.concat(shown || []).forEach(function (v) { v = String(v == null ? '' : v).trim(); if (v && !seen[v] && out.length < 500) { seen[v] = 1; out.push(v); } });
  return out;
}
// 넥스 값(보관)
function finNexV_(U, key) { var o = (U.nexV || {})[key]; return o && o.v ? o : null; }
