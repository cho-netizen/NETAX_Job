/*
 * NxFormPrint 묶음 파일 — 양도소득특례 (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 소득83호 · 소득83호의2 · 소득83호의3 · 소득83호의4 · 소득83호의5 · 소득83호의6 · 소득11호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-양도소득특례.js → node tools/formprint-check-ext.js 양도소득특례
 */
(function (root, factory) {
  var NF = root.NxFormPrint;
  var MP = (NF && NF.registerExt) ? NF : (typeof require === 'function' ? require('./mappers.js') : null);
  var api = factory(root, MP.helpers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  MP.registerExt(api);
})(typeof window !== 'undefined' ? window : globalThis, function (root, H) {
  'use strict';
  var n = H.n, has = H.has, Out = H.Out;

  var forms = {
    '소득83호': "소득세법 시행규칙 [별지 제83호서식]", // 농어촌주택 소유자 1세대 1주택 특례적용신고서
    '소득83호의2': "소득세법 시행규칙 [별지 제83호의2서식]", // 주택임대사업자의 거주주택 1세대 1주택 특례적용신고서
    '소득83호의3': "소득세법 시행규칙 [별지 제83호의3서식]", // 장기저당담보주택에 대한 특례적용신고서
    '소득83호의4': "소득세법 시행규칙 [별지 제83호의4서식]", // 상생임대주택에 대한 특례적용신고서
    '소득83호의5': "소득세법 시행규칙 [별지 제83호의5서식]", // 조합원입주권 또는 분양권 소유자 1세대 1주택 특례적용신고서
    '소득83호의6': "소득세법 시행규칙 [별지 제83호의6서식]", // 1세대 3주택 이상자의 장기임대주택 등 일반세율 적용신청서
    '소득11호': "소득세법 시행규칙 [별지 제11호서식]", // 외국납부세액공제 신청서(묶음: 부표1 국가별 외국납부세액공제 명세서·부표2 소득종류별 명세서·부표3 하이브리
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '양도소득특례', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
