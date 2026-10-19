/*
 * NxFormPrint 묶음 파일 — 양도감면A (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 조특54호 · 조특62호 · 조특63호의32 · 조특13호 · 조특14호 · 조특37호 · 조특51호의3
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-양도감면A.js → node tools/formprint-check-ext.js 양도감면A
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
    '조특54호': "조세특례제한법 시행규칙 [별지 제54호서식]", // 공익사업용토지 등에 대한 세액감면신청서(부표: 토지 등 수용사실 확인서)
    '조특62호': "조세특례제한법 시행규칙 [별지 제62호서식]", // 장기임대주택에 대한 양도소득 세액감면신청서
    '조특63호의32': "조세특례제한법 시행규칙 [별지 제63호의32서식]", // 연금계좌 납입에 대한 양도소득세 세액공제신청서
    '조특13호': "조세특례제한법 시행규칙 [별지 제13호서식]", // 현물출자 등에 대한 세액감면(면제)신청서
    '조특14호': "조세특례제한법 시행규칙 [별지 제14호서식]", // 개발제한구역 지정에 따른 매수대상 토지 등에 대한 세액감면신청서
    '조특37호': "조세특례제한법 시행규칙 [별지 제37호서식]", // 구조조정대상부동산등세액감면신청서
    '조특51호의3': "조세특례제한법 시행규칙 [별지 제51호의3서식]", // 경영회생 지원을 위한 농지 매매 등에 대한 양도소득세 환급신청서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '양도감면A', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
