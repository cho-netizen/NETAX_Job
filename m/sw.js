// [2026.10.15] job 휴대폰 창구(job.netax.kr/m/) 서비스워커.
// job 화면은 구글 서버 주소에서 뜨기 때문에 그 자체로는 휴대폰 앱 설치·"공유하기" 대상이 될 수 없다
// (설치 판정 때 최상위 문서가 script.google.com이 되어 버림 — 2026-09 iframe 방식도 실기기에서 실패).
// 그래서 job.netax.kr/m/에 이 작은 창구를 따로 두고, 설치·공유받기만 여기서 한다.
//
// 공유하기(manifest.json share_target)는 POST로 들어오는데 깃허브 페이지는 POST를 받을 수 없으므로,
// 여기서 가로채 파일을 Cache Storage에 잠깐 담아두고 /m/?share=1로 다시 연다(work의 sw.js와 같은 방식).
// 그 밖의 요청은 손대지 않는다(캐시 안 함 — 항상 최신 화면).
const SHARE_CACHE = 'nx-m-share-v1';
const META_KEY = '/m/__share/meta';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    // 앞서 공유하고 아직 안 올린 것이 있으면 버리지 않고 이어 붙인다.
    let meta = { items: [] };
    const old = await cache.match(META_KEY);
    if (old) { try { meta = await old.json(); } catch (err) { meta = { items: [] }; } }
    if (!Array.isArray(meta.items)) meta.items = [];
    const stamp = Date.now().toString(36);
    let i = 0;
    for (const f of form.getAll('files')) {
      if (!(f instanceof File) || !f.size) continue;
      const key = '/m/__share/f_' + stamp + '_' + (i++);
      await cache.put(key, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }));
      meta.items.push({ kind: 'file', key: key, name: f.name || ('공유파일_' + i), type: f.type || '', size: f.size });
    }
    const title = String(form.get('title') || '').trim();
    const text = String(form.get('text') || '').trim();
    const url = String(form.get('url') || '').trim();
    if (text || url) {
      const body = [title, text, (url && text.indexOf(url) === -1) ? url : ''].filter(Boolean).join('\n');
      meta.items.push({ kind: 'text', text: body, size: body.length });
    }
    await cache.put(META_KEY, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
  } catch (err) {
    // 꺼내기에 실패해도 창구 화면은 열리게 한다(화면이 "받은 것이 없습니다"로 알려 줌).
  }
  return Response.redirect('/m/?share=1', 303);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname === '/m/share-target') {
    e.respondWith(handleShareTarget(e.request));
  }
});
