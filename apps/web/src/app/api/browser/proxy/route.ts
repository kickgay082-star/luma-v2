import { NextRequest, NextResponse } from 'next/server';
import { validateExternalHttpUrl } from '@luma/shared';
import { checkApiRateLimit } from '@/lib/server/auth';

function buildInjectedHook(targetUrl: string): string {
  const safeTarget = JSON.stringify(targetUrl);
  return `<base href="${targetUrl.replace(/"/g, '&quot;')}" />
<script>
(function(){
  const PAGE_URL = ${safeTarget};
  const PROXY_PREFIX = '/api/browser/proxy?url=';
  const seen = new Set();

  function reportVideo(url, kind) {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    try {
      const abs = new URL(url, PAGE_URL).toString();
      if (seen.has(abs)) return;
      seen.add(abs);
      let sourceType = kind || 'mp4';
      const lower = abs.toLowerCase();
      if (lower.includes('.m3u8')) sourceType = 'hls';
      else if (lower.includes('youtube.com/embed') || lower.includes('youtu.be')) sourceType = 'youtube';
      else if (!/\\.(mp4|webm|mov)(\\?|$)/i.test(lower) && kind === 'embed') sourceType = 'embed';
      window.parent.postMessage({
        type: 'LUMA_VIDEO_FOUND',
        url: abs,
        sourceType,
        title: document.title || new URL(PAGE_URL).hostname
      }, '*');
    } catch {}
  }

  function scanDom() {
    document.querySelectorAll('video, source').forEach((el) => {
      const s = el.getAttribute('src') || el.currentSrc;
      if (s) reportVideo(s, s.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
    });
    document.querySelectorAll('iframe').forEach((fr) => {
      const s = fr.getAttribute('src') || fr.getAttribute('data-src');
      if (s && /player|embed|video|stream|vidmoly|ok\\.ru|sibnet|youtube|vimeo|dailymotion|vk\\.com|m3u8|mp4/i.test(s)) {
        reportVideo(s, 'embed');
      }
    });
  }

  // Hook media play & network stream requests
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    if (this.currentSrc || this.src) {
      reportVideo(this.currentSrc || this.src, 'mp4');
    }
    return origPlay.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function(input) {
    try {
      const u = typeof input === 'string' ? input : input?.url;
      if (u && /\\.(m3u8|mp4|webm)(\\?|$)/i.test(u)) {
        reportVideo(u, u.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
      }
    } catch {}
    return origFetch.apply(this, arguments);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(_method, url) {
    try {
      if (typeof url === 'string' && /\\.(m3u8|mp4|webm)(\\?|$)/i.test(url)) {
        reportVideo(url, url.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
      }
    } catch {}
    return origXhrOpen.apply(this, arguments);
  };

  // Route anchor & search form navigation back through Luma proxy
  document.addEventListener('click', function(e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    e.preventDefault();
    try {
      const abs = new URL(href, PAGE_URL).toString();
      window.parent.postMessage({ type: 'LUMA_NAVIGATE', url: abs }, '*');
      window.location.href = PROXY_PREFIX + encodeURIComponent(abs);
    } catch {}
  }, true);

  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (!form || !form.tagName || form.tagName !== 'FORM') return;
    const method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method !== 'GET') return;
    e.preventDefault();
    try {
      const action = form.getAttribute('action') || PAGE_URL;
      const u = new URL(action, PAGE_URL);
      const fd = new FormData(form);
      fd.forEach((v, k) => { u.searchParams.set(k, String(v)); });
      const abs = u.toString();
      window.parent.postMessage({ type: 'LUMA_NAVIGATE', url: abs }, '*');
      window.location.href = PROXY_PREFIX + encodeURIComponent(abs);
    } catch {}
  }, true);

  window.addEventListener('DOMContentLoaded', () => {
    window.parent.postMessage({ type: 'LUMA_PAGE_META', url: PAGE_URL, title: document.title }, '*');
    scanDom();
    const obs = new MutationObserver(scanDom);
    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    setInterval(scanDom, 2000);
  });
})();
</script>`;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`proxy:${ip}`, 45, 60_000)) {
    return new NextResponse('Çok fazla istek.', { status: 429 });
  }

  const rawUrl = req.nextUrl.searchParams.get('url') || '';
  const check = validateExternalHttpUrl(rawUrl);
  if (!check.ok || !check.url) {
    return new NextResponse('Geçersiz URL.', { status: 400 });
  }

  try {
    const upstream = await fetch(check.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
    const finalUrl = upstream.url || check.url;

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return NextResponse.redirect(finalUrl);
    }

    let html = (await upstream.text()).slice(0, 2_000_000);
    const hook = buildInjectedHook(finalUrl);

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${hook}`);
    } else {
      html = `${hook}\n${html}`;
    }

    return new NextResponse(html, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse(
      `<!doctype html><html><body style="background:#090A0F;color:#e4e4e7;font-family:system-ui;padding:32px;text-align:center"><h3>Sayfa yüklenemedi</h3><p style="color:#a1a1aa;font-size:14px">Hedef site bağlantıyı reddetti veya zaman aşımına uğradı.</p></body></html>`,
      { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
