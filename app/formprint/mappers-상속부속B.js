/*
 * NxFormPrint 묶음 파일 — 상속부속B (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 상속12호의2 · 상속12호의2부표1 · 상속13호 · 상속13호의2 · 상속14호의2 · 상속14호의3 · 공통11호 · 공통11호부표 · 공통16호 · 국기8호
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-상속부속B.js → node tools/formprint-check-ext.js 상속부속B
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
    '상속12호의2': "상속세 및 증여세법 시행규칙 [별지 제12호의2서식]", // 가업상속 납부유예 신청서
    '상속12호의2부표1': "상속세 및 증여세법 시행규칙 [별지 제12호의2서식 부표1]", // 가업상속재산명세서(납부유예)
    '상속13호': "상속세 및 증여세법 시행규칙 [별지 제13호서식]", // 상속세 물납(변경, 철회)신청서
    '상속13호의2': "상속세 및 증여세법 시행규칙 [별지 제13호의2서식]", // 물납 재산 재평가 신청서
    '상속14호의2': "상속세 및 증여세법 시행규칙 [별지 제14호의2서식]", // 문화재 등 상속세 물납 (철회)신청서
    '상속14호의3': "상속세 및 증여세법 시행규칙 [별지 제14호의3서식]", // 징수유예 국가지정문화재등 ([ ]보유현황명세서, [ ]양도거래신고서)
    '공통11호': "상속세 및 증여세법 시행규칙 [별지 제11호서식]", // 상속세(증여세) 연부연납허가(변경, 철회) 신청서
    '공통11호부표': "상속세 및 증여세법 시행규칙 [별지 제11호서식 부표]", // 연부연납세액 계산명세
    '공통16호': "상속세 및 증여세법 시행규칙 [별지 제16호서식]", // 상속세(증여세) 과세표준 및 세액의 결정(경정)청구서
    '국기8호': "국세기본법 시행규칙 [별지 제8호서식]", // 상속인대표자신고서
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '상속부속B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
