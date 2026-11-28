import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/lib/server/auth';
import {
  buildProceduralFourDCues,
  FourDEffects,
  FourDTimelineCue,
  matchFourDEffectsFromText,
} from '@/lib/media/fourDEffects';

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`4d-profile:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla istek.' }, { status: 429 });
  }

  const youtubeId = (req.nextUrl.searchParams.get('youtubeId') || '').trim();
  const titleHint = (req.nextUrl.searchParams.get('title') || '').trim();

  if (!youtubeId || !/^[a-zA-Z0-9_-]{6,20}$/.test(youtubeId)) {
    const fallback = matchFourDEffectsFromText(titleHint);
    const base = fallback?.effects || { wind: 0.25, shake: 0.15 };
    const biomeLabel = fallback?.label || '4D Dinamik Sinema';
    return NextResponse.json({
      videoKey: titleHint || 'generic',
      biomeLabel,
      base,
      cues: buildProceduralFourDCues(base, biomeLabel),
    });
  }

  let videoTitle = titleHint;
  let authorName = '';
  const cues: FourDTimelineCue[] = [];
  let base: Partial<FourDEffects> = { wind: 0.28, shake: 0.14 };
  let biomeLabel = '4D Dinamik Mod';

  // 1. Reliable YouTube oEmbed fetch (always works without consent/bot block)
  try {
    const oeRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`,
      { signal: AbortSignal.timeout(4_500) },
    );
    if (oeRes.ok) {
      const oe = (await oeRes.json()) as { title?: string; author_name?: string };
      if (oe.title) videoTitle = oe.title;
      if (oe.author_name) authorName = oe.author_name;
    }
  } catch {
    // ignore oembed failure
  }

  // 2. Watch page metadata & timed captions
  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (watchRes.ok) {
      const html = await watchRes.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch?.[1] && !videoTitle) {
        videoTitle = decodeXml(titleMatch[1].replace(/\s*-\s*YouTube$/i, ''));
      }

      const shortDescMatch = html.match(/"shortDescription":"((?:\\.|[^"\\]){0,2000})"/);
      const combinedMeta = `${videoTitle} ${authorName} ${shortDescMatch?.[1] || ''}`;
      const matched = matchFourDEffectsFromText(combinedMeta);
      if (matched) {
        base = {
          ...matched.effects,
          water: matched.effects.water ? matched.effects.water * 0.72 : 0,
          rain: matched.effects.rain ? matched.effects.rain * 0.72 : 0,
          fire: matched.effects.fire ? matched.effects.fire * 0.68 : 0,
          snow: matched.effects.snow ? matched.effects.snow * 0.75 : 0,
          wind: matched.effects.wind ? matched.effects.wind * 0.65 : 0.25,
          shake: matched.effects.shake ? matched.effects.shake * 0.52 : 0.15,
          lightning: 0,
        };
        biomeLabel = matched.label;
      }

      const capMatch = html.match(/"captionTracks":\[\{"baseUrl":"([^"]+)"/);
      if (capMatch?.[1]) {
        const capUrl = capMatch[1].replace(/\\u0026/g, '&');
        try {
          const capRes = await fetch(capUrl, { signal: AbortSignal.timeout(4_500) });
          if (capRes.ok) {
            const capXml = await capRes.text();
            const textRegex =
              /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
            let m: RegExpExecArray | null;
            while ((m = textRegex.exec(capXml)) && cues.length < 180) {
              const startSec = Number(m[1]);
              const durSec = Math.max(2.5, Math.min(8, Number(m[2] || 4)));
              const line = decodeXml(m[3]);
              const lineEffects = matchFourDEffectsFromText(line);
              if (lineEffects && Number.isFinite(startSec)) {
                cues.push({
                  at: startSec,
                  dur: durSec,
                  label: lineEffects.label,
                  effects: lineEffects.effects,
                });
              }
            }
          }
        } catch {
          // captions unavailable
        }
      }
    }
  } catch {
    // fallback below
  }

  if (biomeLabel === '4D Dinamik Mod') {
    const titleMatched = matchFourDEffectsFromText(`${videoTitle} ${authorName}`);
    if (titleMatched) {
      base = titleMatched.effects;
      biomeLabel = titleMatched.label;
    }
  }

  const finalCues =
    cues.length > 0 ? cues : buildProceduralFourDCues(base, biomeLabel);

  return NextResponse.json({
    videoKey: `yt:${youtubeId}`,
    biomeLabel,
    videoTitle,
    base,
    cues: finalCues,
  });
}
