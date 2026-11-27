# Luma V2 — Multiplayer 3D Social Cinema Platform

Luma V2; gerçek zamanlı multiplayer 3D sanal sinema odaları, özelleştirilebilir artiküle 3D avatarlar, server-authoritative koltuk oturma sistemi, WebRTC + Web Audio API tabanlı 3D konumsal sesli sohbet (proximity voice chat), senkronize YouTube / MP4 / HLS oynatma ve kullanıcı tarafından sağlanan IPTV (M3U/M3U8) desteği sunan tam yığın (full-stack) web platformudur.

## Mimari

- `packages/shared` (`@luma/shared`): Ortak TypeScript protokolleri, 10 farklı 3D oda teması ve koltuk/engel geometrileri, circle-vs-AABB çarpışma motoru, M3U/M3U8 parser, SSRF & URL doğrulama ve konumsal ses sönümleme fonksiyonları.
- `apps/realtime` (`@luma/realtime`): Socket.IO tabanlı server-authoritative multiplayer sunucu (port `4001`). Hareket doğrulama, atomik koltuk rezervasyonu, ayrılmada otomatik koltuk boşaltma ve sahip devri, WebRTC sinyal yönlendirme, video senkronizasyonu, moderasyon ve hız sınırlama.
- `apps/web` (`@luma/web`): Next.js App Router + React Three Fiber + Drei + Tailwind CSS + Zustand + HLS.js (port `3000`). Node 24 built-in `node:sqlite` (`WAL` modu) ve HMAC-SHA256 + `scrypt` kimlik doğrulama ile sıfır harici kurulum gerektirmeden çalışır.

## Kurulum ve Çalıştırma

```bash
npm install
npm run build --workspace=@luma/shared
npm run dev
```

- Web Arayüzü: `http://localhost:3000`
- Realtime Sunucu: `http://localhost:4001`

Ortam değişkenleri için `.env.example` dosyasına bakabilirsiniz.

## Testler ve Doğrulama

```bash
npm test
npm run typecheck
npm run build
```
