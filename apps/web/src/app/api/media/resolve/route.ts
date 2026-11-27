import { NextRequest, NextResponse } from 'next/server';
import {
  extractYouTubeId,
  sanitizeText,
  validateExternalHttpUrl,
  VideoSourceType,
} from '@luma/shared';
import { checkApiRateLimit } from '@/lib/server/auth';

export interface ResolvedMediaItem {
  title: string;
  url: string;
  sourceType: VideoSourceType;
  quality?: string;
  thumbnail?: string;
}

function parseTwitterStatusUrl(rawUrl: string): { user: string; id: string } | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (
      host !== 'x.com' &&
      host !== 'twitter.com' &&
      host !== 'mobile.twitter.com' &&
      host !== 'fxtwitter.com' &&
      host !== 'vxtwitter.com'
    ) {
      return null;
    }
    const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (m) return { user: m[1], id: m[2] };
    const m2 = u.pathname.match(/^\/i\/status\/(\d+)/);
    if (m2) return { user: 'i', id: m2[1] };
    return null;
  } catch {
    return null;
  }
}

async function resolveTwitterVideos(user: string, id: string): Promise<ResolvedMediaItem[]> {
  const results: ResolvedMediaItem[] = [];
  const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(user)}/status/${encodeURIComponent(id)}`, {
    headers: { 'User-Agent': 'LumaMediaResolver/2.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return results;

  const data = (await res.json()) as {
    tweet?: {
      text?: string;
      author?: { name?: string };
      media?: {
        videos?: Array<{
          url?: string;
          thumbnail_url?: string;
          width?: number;
          height?: number;
          variants?: Array<{ url?: string; bitrate?: number; content_type?: string }>;
        }>;
      };
    };
  };

  const tweet = data?.tweet;
  const videos = tweet?.media?.videos ?? [];
  const baseTitle = sanitizeText(
    tweet?.text
      ? `${tweet.author?.name ? `${tweet.author.name}: ` : ''}${tweet.text}`
      : 'X (Twitter) Videosu',
    100,
  );

  for (const v of videos) {
    if (v.url && validateExternalHttpUrl(v.url).ok) {
      results.push({
        title: baseTitle || 'X Videosu',
        url: v.url,
        sourceType: v.url.includes('.m3u8') ? 'hls' : 'mp4',
        quality: v.height ? `${v.height}p MP4` : 'HD MP4',
        thumbnail: v.thumbnail_url,
      });
    }
    const hlsVariant = v.variants?.find((vr) => vr.url && vr.url.includes('.m3u8'));
    if (hlsVariant?.url && validateExternalHttpUrl(hlsVariant.url).ok) {
      results.push({
        title: `${baseTitle || 'X Videosu'} (HLS)`,
        url: hlsVariant.url,
        sourceType: 'hls',
        quality: 'HLS / Uyarlanabilir',
        thumbnail: v.thumbnail_url,
      });
    }
  }

  return results;
}

function absolutizeUrl(candidate: string, baseUrl: string): string | null {
  try {
    const cleaned = candidate.replace(/\\\//g, '/').replace(/&amp;/g, '&').trim();
    const abs = new URL(cleaned, baseUrl).toString();
    const check = validateExternalHttpUrl(abs);
    return check.ok && check.url ? check.url : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`resolve:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla istek. Kısa süre sonra tekrar deneyin.' }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const rawUrl = (body?.url || '').trim();
  const check = validateExternalHttpUrl(rawUrl);
  if (!check.ok || !check.url) {
    return NextResponse.json({ error: check.error || 'Geçerli bir URL girin.' }, { status: 400 });
  }

  // 1. Direct YouTube link
  const ytId = extractYouTubeId(check.url);
  if (ytId) {
    return NextResponse.json({
      items: [
        {
          title: 'YouTube Videosu',
          url: `https://www.youtube.com/watch?v=${ytId}`,
          sourceType: 'youtube',
          quality: 'YouTube',
        } satisfies ResolvedMediaItem,
      ],
    });
  }

  // 2. Direct MP4 / M3U8 file URL
  const lower = check.url.toLowerCase();
  if (/\.(mp4|webm|mov)(\?|$)/i.test(lower)) {
    return NextResponse.json({
      items: [
        {
          title: 'Doğrudan Video',
          url: check.url,
          sourceType: 'mp4',
          quality: 'MP4',
        } satisfies ResolvedMediaItem,
      ],
    });
  }
  if (/\.m3u8(\?|$)/i.test(lower)) {
    return NextResponse.json({
      items: [
        {
          title: 'Canlı HLS Akışı',
          url: check.url,
          sourceType: 'hls',
          quality: 'M3U8',
        } satisfies ResolvedMediaItem,
      ],
    });
  }

  // 3. X / Twitter status URL
  const tweetRef = parseTwitterStatusUrl(check.url);
  if (tweetRef) {
    try {
      const twItems = await resolveTwitterVideos(tweetRef.user, tweetRef.id);
      if (twItems.length > 0) {
        return NextResponse.json({ items: twItems });
      }
      return NextResponse.json(
        { error: 'Bu X/Twitter gönderisinde herkese açık video bulunamadı. Sekme Paylaşımını kullanabilirsiniz.' },
        { status: 404 },
      );
    } catch {
      return NextResponse.json(
        { error: 'X/Twitter videosu çözümlenemedi. Sekme Paylaşımı ile canlı izletebilirsiniz.' },
        { status: 502 },
      );
    }
  }

  // 4. General webpage video stream scan (og:video, <video>, .m3u8, .mp4)
  try {
    const pageRes = await fetch(check.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!pageRes.ok) {
      return NextResponse.json(
        {
          error: `Sayfa erişimi engelledi (HTTP ${pageRes.status}). Videoyu kendi tarayıcınızda açıp "Sekme / Ekran Paylaş" ile canlı izletebilirsiniz.`,
        },
        { status: 422 },
      );
    }

    const html = (await pageRes.text()).slice(0, 1_500_000);
    const titleMatch = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
    const pageTitle = sanitizeText(titleMatch?.[1] || new URL(check.url).hostname, 90);

    const found = new Map<string, ResolvedMediaItem>();
    const pushFound = (rawCandidate: string, sourceType: VideoSourceType, quality: string) => {
      const abs = absolutizeUrl(rawCandidate, check.url!);
      if (!abs || found.has(abs)) return;
      found.set(abs, {
        title: pageTitle || 'Bulunan Video',
        url: abs,
        sourceType,
        quality,
      });
    };

    // Meta tags (og:video, twitter:player:stream)
    const metaRegex =
      /<meta[^>]+(?:property|name)=["'](?:og:video(?::url|:secure_url)?|twitter:player:stream)["'][^>]+content=["']([^"']+)["']/gi;
    for (const m of html.matchAll(metaRegex)) {
      const u = m[1];
      pushFound(u, u.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4', 'Meta Video');
    }

    // <video src> and <source src>
    const tagSrcRegex = /<(?:video|source)[^>]+src=["']([^"']+)["']/gi;
    for (const m of html.matchAll(tagSrcRegex)) {
      const u = m[1];
      pushFound(u, u.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4', 'HTML5 Video');
    }

    // Embedded .m3u8 / .mp4 URLs inside page scripts/JSON
    const streamRegex = /(https?:\\?\/\\?\/[^"'\s<>\\)]+?\.(?:m3u8|mp4)(?:\?[^"'\s<>\\)]*)?)/gi;
    for (const m of html.matchAll(streamRegex)) {
      const u = m[1];
      const isHls = u.toLowerCase().includes('.m3u8');
      pushFound(u, isHls ? 'hls' : 'mp4', isHls ? 'HLS Akışı' : 'MP4 Dosyası');
      if (found.size >= 12) break;
    }

    const items = Array.from(found.values());
    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            'Bu sayfada doğrudan video akışı bulunamadı (korumalı veya JavaScript ile gizlenmiş olabilir). Videoyu kendi sekmenizde açıp "Sekme / Ekran Paylaş" ile canlı izletebilirsiniz.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      {
        error:
          'Sayfa okunamadı. Videoyu kendi sekmenizde açıp "Sekme / Ekran Paylaş" butonuyla canlı izletebilirsiniz.',
      },
      { status: 502 },
    );
  }
}
