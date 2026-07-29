/* 中身を更新したら、この番号を必ず1つ上げること（v1 -> v2） */
const CACHE = "drill-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

/* Google Fonts は別オリジンなので、初回アクセス時に拾ってキャッシュする */
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 取得できたら保存する。別オリジンの不透明応答は保存に失敗しうるので握りつぶす */
async function cachePut(req, res) {
  try {
    const c = await caches.open(CACHE);
    await c.put(req, res);
  } catch (err) { /* 保存できなくても表示には影響しない */ }
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // フォントはキャッシュ優先。一度読めば以降オフラインでも同じ書体で出る
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          cachePut(e.request, res.clone());
          return res;
        }).catch(() => hit);
      })
    );
    return;
  }

  // ページ本体はネットワーク優先。更新がすぐ反映され、オフライン時はキャッシュに落ちる
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          cachePut("./index.html", res.clone());
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // それ以外（アイコン等）はキャッシュ優先
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === "basic") cachePut(e.request, res.clone());
        return res;
      })
    )
  );
});
