/*
 * NxFormPrint 묶음 파일 — 상속부속A (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 상속1호 · 상속1호부표1 · 상속2호 · 상속3호 · 상속5호 · 상속6호 · 상속6호의2 · 상속7호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-상속부속A.js → node tools/formprint-check-ext.js 상속부속A
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
    '상속1호': "상속세 및 증여세법 시행규칙 [별지 제1호서식]", // 가업상속공제신고서
    '상속1호부표1': "상속세 및 증여세법 시행규칙 [별지 제1호서식 부표1]", // 가업상속재산명세서
    '상속2호': "상속세 및 증여세법 시행규칙 [별지 제2호서식]", // 영농상속공제신고서
    '상속3호': "상속세 및 증여세법 시행규칙 [별지 제3호서식]", // 배우자 상속재산 미분할 신고서
    '상속5호': "상속세 및 증여세법 시행규칙 [별지 제5호서식]", // 금융재산 상속공제 신고서
    '상속6호': "상속세 및 증여세법 시행규칙 [별지 제6호서식]", // 재해손실 공제신고서(상속세, 증여세)
    '상속6호의2': "상속세 및 증여세법 시행규칙 [별지 제6호의2서식]", // 동거주택상속공제신고서
    '상속7호': "상속세 및 증여세법 시행규칙 [별지 제7호서식]", // 외국납부세액공제신청서(상속세, 증여세)
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '상속부속A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
