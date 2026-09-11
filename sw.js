// 설치 가능성(installability) 조건을 만족시키기 위한 최소한의 서비스워커.
// 캐싱 전략은 목적이 아니고, "서비스워커가 등록·활성화되어 있다"는 사실 자체가 목적이다
// (fetch 핸들러 없이는 크롬/삼성인터넷이 "설치 가능한 앱"으로 인정하지 않는다).
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ self.clients.claim(); });
self.addEventListener('fetch', function(e){
  e.respondWith(fetch(e.request));
});
