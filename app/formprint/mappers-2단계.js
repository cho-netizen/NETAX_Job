/*
 * NxFormPrint 묶음 파일 — 2단계 (계산기·옛 인쇄가 실제로 쓰는데 원본 모양이 없던 서식, 2026-10-20)
 * 이 묶음의 서식: 소득103호 · 소득104호 · 소득105호 · 조특52호의2 · 조특11호의8 · 조특11호의10 · 조특11호의13 · 증여10호의5부표1 · 증여10호의5부표2 · 증여10호의6부표1 · 증여10호의6부표2 · 상속1호부표2 · 상속12호의2부표2
 * 등록 방법·모양은 mappers.js 끝의 "서식 묶음 파일" 설명을 따른다.
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
  var forms = {};
  var mappers = {};
  var ctxFor = {};
  var ready = {};
  function plan(tax, ctx) { var L = []; return L; }
  return { 묶음: '2단계', forms: forms, mappers: mappers, plan: plan, ctxFor: ctxFor, ready: ready };
});
