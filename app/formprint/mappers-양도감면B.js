/*
 * NxFormPrint 묶음 파일 — 양도감면B (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 조특52호의3 · 조특62호의2 · 조특62호의3 · 조특63호 · 조특63호의2 · 조특63호의4
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-양도감면B.js → node tools/formprint-check-ext.js 양도감면B
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
    '조특52호의3': "조세특례제한법 시행규칙 [별지 제52호의3서식]", // 1세대 1주택 과세특례(인구감소지역주택, 준공후미분양주택 취득자) 신고서
    '조특62호의2': "조세특례제한법 시행규칙 [별지 제62호의2서식]", // 장기일반민간임대주택등에 대한 과세특례적용신청서
    '조특62호의3': "조세특례제한법 시행규칙 [별지 제62호의3서식]", // 장기임대주택에 대한 과세특례적용신청서
    '조특63호': "조세특례제한법 시행규칙 [별지 제63호서식]", // 미분양주택과세특례적용신고서
    '조특63호의2': "조세특례제한법 시행규칙 [별지 제63호의2서식]", // 양도소득세특례세율적용신청서
    '조특63호의4': "조세특례제한법 시행규칙 [별지 제63호의4서식]", // 농어촌주택 등 취득자에 대한 과세특례신고서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '양도감면B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
