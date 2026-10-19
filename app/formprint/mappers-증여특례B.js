/*
 * NxFormPrint 묶음 파일 — 증여특례B (원본 모양 인쇄 55장 확장, 2026-10-20)
 * 이 묶음의 서식: 증여10호의3 · 증여10호의3부표1 · 증여10호의3부표2 · 증여10호의3부표3 · 증여10호의3부표4 · 증여10호의3부표5 · 증여10호의4 · 증여10호의4부표1 · 증여10호의4부표2 · 증여10호의4부표3 · 증여10호의4부표4
 *
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다. 장마다:
 *   1. 위치판 reftables/위치판/서식위치_<formKey>.json — 법제처 원본 PDF(드라이브 법제처 원본(PDF)/<세목>)로 잰 칸 자리
 *      (node tools/build-formprint.js 로 app/formprint/위치판/ 에 복사)
 *   2. 연결표 mappers[formKey](ctx) — 칸 해설 reftables/서식_<formKey>.json 의 칸 번호·계산기칸 그대로.
 *      계산기에 값이 없는 칸은 o.miss(칸, '계산기에 없음') 로 남기고 비운다(추측으로 채우지 않음).
 *   3. 시험 사례 app/formprint/test-cases-증여특례B.js → node tools/formprint-check-ext.js 증여특례B
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
    '증여10호의3': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식]", // 증여세과세표준신고 및 자진납부계산서(특수관계법인과의 거래를 통한 증여의제이익 신고용)
    '증여10호의3부표1': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표1]", // 수증자 등 및 과세가액 계산명세서(Ⅰ)
    '증여10호의3부표2': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표2]", // 나-1. 수혜법인 지배주주 판정을 위한 간접보유비율 산정
    '증여10호의3부표3': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표3]", // 다-1. 수증자 간접보유비율(간접출자법인 해당여부 및 간접보유비율)
    '증여10호의3부표4': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표4]", // 라-1. 지배주주 등과 특수관계법인(증여자 등)
    '증여10호의3부표5': "상속세 및 증여세법 시행규칙 [별지 제10호의3서식 부표5]", // 수증자 등 및 과세가액 계산명세서(Ⅱ)
    '증여10호의4': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식]", // 증여세과세표준신고 및 자진납부계산서(특수관계법인으로부터 제공받은 사업기회로 발생한 증여의제이익 신고용)
    '증여10호의4부표1': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표1]", // 수증자 등 및 과세가액 계산명세서(A)
    '증여10호의4부표2': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표2]", // 수증자 등 및 과세가액 계산명세서(A-1)(수증자 간접보유비율)
    '증여10호의4부표3': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표3]", // 수증자 등 및 과세가액 계산명세서(B)
    '증여10호의4부표4': "상속세 및 증여세법 시행규칙 [별지 제10호의4서식 부표4]", // 수증자 및 과세가액 계산명세서(B-1)(수혜법인의 부문별 영업이익 명세서)
  };
  var mappers = {};
  var ctxFor = {};
  var ready = {};

  // 세목 원본 모양 출력 묶음에 더할 서식(그 사건에 해당하는 것만)
  function plan(tax, ctx) {
    var L = [];
    return L;
  }

  return { 묶음: '증여특례B', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
