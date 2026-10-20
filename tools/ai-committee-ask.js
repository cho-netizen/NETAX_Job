#!/usr/bin/env node
// [2026.10.20 밤샘 5번] AI 위원(서버 ai_ask_slots)에게 고객 정보 없는 추상 질문 하나 — 답은 화면과 파일로(커밋 안 함)
//  사용: node tools/ai-committee-ask.js <질문 파일(.txt)> [ids=gemini-paid]
'use strict';
const fs = require('fs');
const { loadNxSecret } = require('./nx-secret');
const { key: KEY, gas: GAS } = loadNxSecret();
const head = fs.readFileSync(process.argv[2], 'utf8');
const ids = (process.argv[3] || 'gemini-paid').split(',');
fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ai_ask_slots', _key: KEY, ids, head, maxTokens: 1800 }) })
  .then((r) => r.text()).then((t) => {
    let j; try { j = JSON.parse(t); } catch (e) { console.log('응답이 JSON이 아님: ' + t.slice(0, 200)); return; }
    if (j.error) { console.log('오류: ' + j.error); return; }
    const out = process.argv[2].replace(/\.txt$/, '') + '_답.json';
    fs.writeFileSync(out, JSON.stringify(j, null, 1));
    (j.answers || []).forEach((a) => console.log('— ' + (a.id || a.name || '') + ':\n' + String(a.text || a.answer || a.error || '').slice(0, 3000)));
  }).catch((e) => console.log('실패: ' + e.message));
