import { IptvChannel } from '../types.js';
import { sanitizeText, validateExternalHttpUrl } from '../validation/security.js';

export interface ParsedM3uResult {
  channels: IptvChannel[];
  groups: string[];
  skippedCount: number;
}

function extractAttr(line: string, attrName: string): string | undefined {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = line.match(regex);
  return match ? match[1].trim() : undefined;
}

/**
 * Parses standard #EXTM3U / #EXTINF IPTV playlists, validating every stream URL
 * against SSRF restrictions and extracting channel logos and categories.
 */
export function parseM3uPlaylist(rawContent: string, maxChannels: number = 1500): ParsedM3uResult {
  const lines = rawContent.split(/\r?\n/);
  const channels: IptvChannel[] = [];
  const groupSet = new Set<string>();
  const seenUrls = new Set<string>();
  let skippedCount = 0;

  let pendingMeta: {
    name: string;
    logo?: string;
    group: string;
    tvgId?: string;
  } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      const commaIndex = line.indexOf(',');
      const rawTitle = commaIndex >= 0 ? line.slice(commaIndex + 1) : '';
      const tvgName = extractAttr(line, 'tvg-name');
      const logoRaw = extractAttr(line, 'tvg-logo');
      const groupRaw = extractAttr(line, 'group-title');
      const tvgId = extractAttr(line, 'tvg-id');

      let safeLogo: string | undefined;
      if (logoRaw) {
        const check = validateExternalHttpUrl(logoRaw);
        if (check.ok && check.url) safeLogo = check.url;
      }

      pendingMeta = {
        name: sanitizeText(rawTitle || tvgName || 'Adsız Kanal', 90),
        logo: safeLogo,
        group: sanitizeText(groupRaw || 'Genel', 48) || 'Genel',
        tvgId: tvgId ? sanitizeText(tvgId, 60) : undefined,
      };
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    const urlValidation = validateExternalHttpUrl(line);
    if (!urlValidation.ok || !urlValidation.url) {
      skippedCount++;
      pendingMeta = null;
      continue;
    }

    if (seenUrls.has(urlValidation.url)) {
      pendingMeta = null;
      continue;
    }

    seenUrls.add(urlValidation.url);
    const meta = pendingMeta ?? {
      name: `Yayın ${channels.length + 1}`,
      group: 'Genel',
    };

    groupSet.add(meta.group);
    channels.push({
      id: `ch-${channels.length + 1}-${hashShort(urlValidation.url)}`,
      name: meta.name,
      url: urlValidation.url,
      logo: meta.logo,
      group: meta.group,
      tvgId: meta.tvgId,
      isLive: true,
    });
    pendingMeta = null;

    if (channels.length >= maxChannels) break;
  }

  return {
    channels,
    groups: Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'tr')),
    skippedCount,
  };
}

function hashShort(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}
