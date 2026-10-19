/*
 * NxFormPrint 묶음 파일 — 증여특례A (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 증여10호의2 · 증여10호의2부표1 · 증여10호의2부표2 · 증여10호의5 · 증여10호의6 · 조특52호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-증여특례A.js → node tools/formprint-check-ext.js 증여특례A
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
    '증여10호의2': "상속세 및 증여세법 시행규칙 [별지 제10호의2서식]", // 증여세과세표준신고 및 자진납부계산서(창업자금 및 가업승계주식 등 특례세율 적용 증여재산 신고용)
    '증여10호의2부표1': "상속세 및 증여세법 시행규칙 [별지 제10호의2서식 부표1]", // 창업자금 증여재산평가 및 과세가액 계산명세서
    '증여10호의2부표2': "상속세 및 증여세법 시행규칙 [별지 제10호의2서식 부표2]", // 가업승계 주식 등 증여재산평가 및 과세가액 계산명세서
    '증여10호의5': "상속세 및 증여세법 시행규칙 [별지 제10호의5서식]", // 증여세과세표준신고 및 자진납부계산서(초과배당에 따른 이익의 증여재산 신고용)
    '증여10호의6': "상속세 및 증여세법 시행규칙 [별지 제10호의6서식]", // 증여세과세표준신고 및 자진납부계산서(특정법인과의 거래를 통한 증여의제이익 신고용)
    '조특52호': "조세특례제한법 시행규칙 [별지 제52호서식]", // 영농자녀 증여농지등의 세액감면신청서(부표: 증여받은 농지등의 명세서)
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '증여특례A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
