import { NextRequest, NextResponse } from 'next/server';
import { checkApiRateLimit } from '@/lib/server/auth';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapDdgHref(rawHref: string): string {
  try {
    if (rawHref.startsWith('//')) rawHref = 'https:' + rawHref;
    const u = new URL(rawHref, 'https://duckduckgo.com');
    const uddg = u.searchParams.get('uddg');
    if (uddg && /^https?:\/\//i.test(uddg)) return uddg;
    if (/^https?:\/\//i.test(u.toString()) && !u.hostname.endsWith('duckduckgo.com')) {
      return u.toString();
    }
  } catch {
    // ignore invalid href
  }
  return '';
}

async function searchViaDuckDuckGoHtml(query: string): Promise<WebSearchResult[]> {
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return [];
  const html = await res.text();
  const results: WebSearchResult[] = [];
  const blockRegex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) && results.length < 15) {
    const url = unwrapDdgHref(m[1]);
    const title = decodeHtml(m[2]);
    const snippet = m[3] ? decodeHtml(m[3]) : '';
    if (url && title && !results.some((r) => r.url === url)) {
      results.push({ title, url, snippet });
    }
  }
  return results;
}

async function searchViaBingHtml(query: string): Promise<WebSearchResult[]> {
  const res = await fetch(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=tr`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return [];
  const html = await res.text();
  const results: WebSearchResult[] = [];
  const algoRegex =
    /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;

  let m: RegExpExecArray | null;
  while ((m = algoRegex.exec(html)) && results.length < 15) {
    const url = decodeHtml(m[1]);
    const title = decodeHtml(m[2]);
    const snippet = m[3] ? decodeHtml(m[3]) : '';
    if (url && title && !results.some((r) => r.url === url)) {
      results.push({ title, url, snippet });
    }
  }
  return results;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkApiRateLimit(`browser-search:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla arama isteği.' }, { status: 429 });
  }

  const query = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!query || query.length > 200) {
    return NextResponse.json({ results: [] });
  }

  let results: WebSearchResult[] = [];
  try {
    results = await searchViaDuckDuckGoHtml(query);
  } catch {
    results = [];
  }

  if (results.length === 0) {
    try {
      results = await searchViaBingHtml(query);
    } catch {
      results = [];
    }
  }

  return NextResponse.json({ query, results });
}
