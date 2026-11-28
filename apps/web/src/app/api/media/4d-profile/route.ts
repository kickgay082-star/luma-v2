import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/lib/server/auth';
import {
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
    return NextResponse.json({
      videoKey: titleHint || 'generic',
      biomeLabel: fallback?.label || 'Sinema Atmosferi',
      base: fallback?.effects || { wind: 0.12 },
      cues: [],
    });
  }

  let videoTitle = titleHint;
  const cues: FourDTimelineCue[] = [];
  let base: Partial<FourDEffects> = { wind: 0.14 };
  let biomeLabel = '4D Dinamik Mod';

  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(7_000),
    });

    if (watchRes.ok) {
      const html = await watchRes.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) {
        videoTitle = decodeXml(titleMatch[1].replace(/\s*-\s*YouTube$/i, ''));
      }

      // Inspect description & chapters for overall biome
      const shortDescMatch = html.match(/"shortDescription":"((?:\\.|[^"\\]){0,2000})"/);
      const combinedMeta = `${videoTitle} ${shortDescMatch?.[1] || ''}`;
      const matched = matchFourDEffectsFromText(combinedMeta);
      if (matched) {
        base = {
          ...matched.effects,
          // Keep base continuous ambience gentler so timed spikes feel dramatic
          water: matched.effects.water ? matched.effects.water * 0.65 : 0,
          rain: matched.effects.rain ? matched.effects.rain * 0.65 : 0,
          fire: matched.effects.fire ? matched.effects.fire * 0.6 : 0,
          snow: matched.effects.snow ? matched.effects.snow * 0.7 : 0,
          wind: matched.effects.wind ? matched.effects.wind * 0.6 : 0.15,
          shake: matched.effects.shake ? matched.effects.shake * 0.45 : 0,
          lightning: 0,
        };
        biomeLabel = matched.label;
      }

      // Extract timed caption track URL if available
      const capMatch = html.match(/"captionTracks":\[\{"baseUrl":"([^"]+)"/);
      if (capMatch?.[1]) {
        const capUrl = capMatch[1].replace(/\\u0026/g, '&');
        try {
          const capRes = await fetch(capUrl, { signal: AbortSignal.timeout(4_500) });
          if (capRes.ok) {
            const capXml = await capRes.text();
            const textRegex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
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

  if (cues.length === 0 && !matchFourDEffectsFromText(videoTitle)) {
    const titleMatched = matchFourDEffectsFromText(titleHint);
    if (titleMatched) {
      base = titleMatched.effects;
      biomeLabel = titleMatched.label;
    }
  }

  return NextResponse.json({
    videoKey: `yt:${youtubeId}`,
    biomeLabel,
    base,
    cues,
  });
}
