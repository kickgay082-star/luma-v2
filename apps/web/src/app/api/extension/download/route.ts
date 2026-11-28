import { NextResponse } from 'next/server';

interface ZipEntry {
  name: string;
  content: Buffer;
}

const CRC_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.content;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x5421, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5421, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

const MANIFEST_JSON = JSON.stringify(
  {
    manifest_version: 3,
    name: 'Luma Video Köprüsü',
    version: '1.1.0',
    description:
      'İzlediğin film, dizi veya sosyal medya sekmesindeki videoyu Cloudflare/Render engeline takılmadan doğrudan Luma 3D perdesine aktarır.',
    permissions: [
      'webRequest',
      'tabCapture',
      'declarativeNetRequest',
      'tabs',
      'activeTab',
      'scripting',
      'storage',
    ],
    host_permissions: ['<all_urls>'],
    background: {
      service_worker: 'background.js',
    },
    action: {
      default_popup: 'popup.html',
      default_title: 'Luma Video Köprüsü',
    },
    content_scripts: [
      {
        matches: [
          'https://luma-v2-lemon.vercel.app/*',
          'https://*.vercel.app/*',
          'http://localhost/*',
          'http://127.0.0.1/*',
        ],
        js: ['content_luma.js'],
        run_at: 'document_start',
      },
      {
        matches: ['<all_urls>'],
        all_frames: true,
        js: ['content_scan.js'],
        run_at: 'document_idle',
      },
    ],
  },
  null,
  2,
);

const BACKGROUND_JS = `
const TAB_KEY_PREFIX = 'luma_vids_';
const LUMA_RULE_ID = 7701;

// Scoped header unblocking ONLY when initiated by Luma web tabs so embeds/HLS work cleanly
async function installLumaHeaderRules() {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) return;
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [LUMA_RULE_ID],
      addRules: [
        {
          id: LUMA_RULE_ID,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [
              { header: 'x-frame-options', operation: 'remove' },
              { header: 'content-security-policy', operation: 'remove' },
              { header: 'access-control-allow-origin', operation: 'set', value: '*' },
            ],
          },
          condition: {
            initiatorDomains: ['luma-v2-lemon.vercel.app', 'localhost', '127.0.0.1'],
            resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'other'],
          },
        },
      ],
    });
  } catch {}
}

chrome.runtime.onInstalled.addListener(() => {
  installLumaHeaderRules();
});
chrome.runtime.onStartup.addListener(() => {
  installLumaHeaderRules();
});
installLumaHeaderRules();

function classifyUrl(rawUrl, contentType) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) return null;
  const lower = rawUrl.toLowerCase();
  const ct = (contentType || '').toLowerCase();

  if (/\\.(ts|m4s|key|vtt|srt|png|jpg|jpeg|webp|gif|css|woff2?)(\\?|$)/i.test(lower)) {
    return null;
  }

  if (lower.includes('.m3u8') || ct.includes('mpegurl') || ct.includes('apple.mpegurl')) {
    return 'hls';
  }
  if (/\\.(mp4|webm|mov)(\\?|$)/i.test(lower) || ct.startsWith('video/')) {
    return 'mp4';
  }
  if (
    lower.includes('youtube.com/watch') ||
    lower.includes('youtube.com/embed') ||
    lower.includes('youtu.be/')
  ) {
    return 'youtube';
  }
  if (
    /\\/embed\\/|player\\.|vidmoly|ok\\.ru\\/video|sibnet\\.ru|vk\\.com\\/video_ext|dailymotion\\.com\\/embed|vimeo\\.com\\/video/i.test(
      lower
    )
  ) {
    return 'embed';
  }
  return null;
}

async function addVideoForTab(tabId, item) {
  if (!tabId || tabId < 0 || !item || !item.url) return;
  const key = TAB_KEY_PREFIX + tabId;
  try {
    const store = await chrome.storage.session.get(key);
    const list = Array.isArray(store[key]) ? store[key] : [];
    if (list.some((v) => v.url === item.url)) return;
    const next = [
      {
        url: item.url,
        sourceType: item.sourceType || 'mp4',
        title: item.title || 'Yakalanan Video',
        ts: Date.now(),
      },
      ...list,
    ].slice(0, 20);
    await chrome.storage.session.set({ [key]: next });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#7C5CFF' });
    await chrome.action.setBadgeText({ tabId, text: String(next.length) });
  } catch {}
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const sourceType = classifyUrl(details.url, '');
    if (!sourceType || details.tabId < 0) return;
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      addVideoForTab(details.tabId, {
        url: details.url,
        sourceType,
        title: (tab && tab.title) || 'Video Akışı',
      });
    });
  },
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const ctHeader = (details.responseHeaders || []).find(
      (h) => h.name && h.name.toLowerCase() === 'content-type'
    );
    const ct = ctHeader ? ctHeader.value || '' : '';
    const sourceType = classifyUrl(details.url, ct);
    if (!sourceType) return;
    chrome.tabs.get(details.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      addVideoForTab(details.tabId, {
        url: details.url,
        sourceType,
        title: (tab && tab.title) || 'Medya Akışı',
      });
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(TAB_KEY_PREFIX + tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    chrome.storage.session.remove(TAB_KEY_PREFIX + tabId).catch(() => {});
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
});

async function findLumaRoomTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter(
    (t) =>
      t.url &&
      /\\/room\\//i.test(t.url) &&
      (t.url.includes('luma-v2') || t.url.includes('localhost') || t.url.includes('127.0.0.1'))
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'REPORT_VIDEO' && sender.tab && sender.tab.id >= 0) {
    const sourceType = msg.sourceType || classifyUrl(msg.url, '') || 'mp4';
    addVideoForTab(sender.tab.id, {
      url: msg.url,
      sourceType,
      title: msg.title || sender.tab.title || 'Bulunan Video',
    }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'GET_TAB_VIDEOS') {
    const key = TAB_KEY_PREFIX + msg.tabId;
    chrome.storage.session.get(key).then((store) => {
      sendResponse({ videos: Array.isArray(store[key]) ? store[key] : [] });
    });
    return true;
  }

  if (msg.type === 'FIND_LUMA_TABS') {
    findLumaRoomTabs().then((lumaTabs) => {
      sendResponse({ tabs: lumaTabs.map((t) => ({ id: t.id, title: t.title, url: t.url })) });
    });
    return true;
  }

  if (msg.type === 'CAPTURE_TAB_TO_LUMA') {
    (async () => {
      const lumaTabs = await findLumaRoomTabs();
      if (lumaTabs.length === 0) {
        sendResponse({ ok: false, error: 'Önce açık bir Luma sinema odasına girin.' });
        return;
      }
      const lumaTab = lumaTabs[0];
      if (msg.tabId === lumaTab.id) {
        sendResponse({ ok: false, error: 'Önce filmin açık olduğu site sekmesine geçip tıklayın.' });
        return;
      }

      chrome.tabCapture.getMediaStreamId(
        { targetTabId: msg.tabId, consumerTabId: lumaTab.id },
        async (streamId) => {
          if (chrome.runtime.lastError || !streamId) {
            sendResponse({
              ok: false,
              error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Sekme video aktarımı başlatılamadı.',
            });
            return;
          }
          try {
            await chrome.scripting.executeScript({
              target: { tabId: lumaTab.id },
              func: (p) => {
                window.postMessage(p, window.location.origin);
              },
              args: [
                {
                  type: 'LUMA_EXTENSION_TAB_STREAM',
                  streamId,
                  title: msg.title || 'Canlı Video Sekmesi',
                },
              ],
            });
            sendResponse({ ok: true });
          } catch (e) {
            sendResponse({ ok: false, error: String(e) });
          }
        }
      );
    })();
    return true;
  }

  if (msg.type === 'SEND_TO_LUMA') {
    (async () => {
      const lumaTabs = await findLumaRoomTabs();
      if (lumaTabs.length === 0) {
        sendResponse({ ok: false, error: 'Açık bir Luma odası sekmesi bulunamadı.' });
        return;
      }
      const targetTab = lumaTabs[0];
      const payload = {
        type: 'LUMA_EXTENSION_VIDEO',
        url: msg.url,
        sourceType: msg.sourceType || 'mp4',
        title: msg.title || 'Eklentiden Gelen Video',
      };
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id },
          func: (p) => {
            window.postMessage(p, window.location.origin);
          },
          args: [payload],
        });
        sendResponse({ ok: true, roomTitle: targetTab.title });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});
`;

const CONTENT_LUMA_JS = `
(function() {
  try {
    document.documentElement.dataset.lumaExt = '1';
    window.postMessage({ type: 'LUMA_EXTENSION_READY', version: '1.1.0' }, window.location.origin);
  } catch {}
})();
`;

const CONTENT_SCAN_JS = `
(function() {
  if (window.location.href.includes('luma-v2')) return;
  const reported = new Set();

  function report(url, kind) {
    if (!url || typeof url !== 'string') return;
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    try {
      const abs = new URL(url, window.location.href).toString();
      if (reported.has(abs)) return;
      reported.add(abs);
      chrome.runtime.sendMessage({
        type: 'REPORT_VIDEO',
        url: abs,
        sourceType: kind,
        title: document.title || window.location.hostname
      }).catch(() => {});
    } catch {}
  }

  function scan() {
    document.querySelectorAll('video, source').forEach((el) => {
      const s = el.getAttribute('src') || el.currentSrc;
      if (s) report(s, s.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
    });
    document.querySelectorAll('iframe').forEach((fr) => {
      const s = fr.getAttribute('src') || fr.getAttribute('data-src');
      if (s && /embed|player|vidmoly|ok\\.ru|sibnet|youtube|vimeo|dailymotion|vk\\.com|m3u8|mp4/i.test(s)) {
        report(s, 'embed');
      }
    });
    try {
      performance.getEntriesByType('resource').forEach((entry) => {
        if (/\\.(m3u8|mp4|webm)(\\?|$)/i.test(entry.name)) {
          report(entry.name, entry.name.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
        }
      });
    } catch {}
  }

  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    const s = this.currentSrc || this.src;
    if (s) report(s, s.toLowerCase().includes('.m3u8') ? 'hls' : 'mp4');
    return origPlay.apply(this, arguments);
  };

  scan();
  setInterval(scan, 2500);
})();
`;

const POPUP_HTML = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Luma Video Köprüsü</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; width: 370px; background: #090A0F; color: #F4F4F5; padding: 14px; }
    .hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .logo { font-weight: 700; font-size: 14px; color: #fff; }
    .badge { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: #1E1B2E; color: #C4B5FD; border: 1px solid #7C5CFF55; }
    .status { font-size: 11px; padding: 8px 10px; border-radius: 10px; margin-bottom: 10px; background: #12141E; border: 1px solid #ffffff15; color: #A1A1AA; }
    .status.ok { border-color: #10B98155; color: #6EE7B7; }
    .hero { width: 100%; border: 0; border-radius: 11px; padding: 11px 12px; font-size: 12px; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, #7C5CFF, #3B82F6); color: #fff; margin-bottom: 6px; box-shadow: 0 6px 20px rgba(124, 92, 255, 0.35); }
    .hero:hover { filter: brightness(1.08); }
    .hint { font-size: 10.5px; color: #A1A1AA; line-height: 1.4; margin-bottom: 12px; }
    .secTitle { font-size: 11px; font-weight: 600; color: #D4D4D8; margin: 8px 0 6px; }
    .list { display: flex; flex-direction: column; gap: 7px; max-height: 220px; overflow-y: auto; }
    .card { background: #11131D; border: 1px solid #ffffff18; border-radius: 10px; padding: 8px; }
    .title { font-size: 11.5px; font-weight: 600; color: #fff; margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .url { font-size: 10px; color: #71717A; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .kind { font-size: 10px; padding: 2px 6px; border-radius: 6px; background: #ffffff12; color: #E4E4E7; font-family: monospace; }
    .btn { border: 0; border-radius: 7px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; background: #27272A; color: #fff; }
    .btn:hover { background: #7C5CFF; }
    .empty { text-align: center; padding: 14px 8px; font-size: 11px; color: #71717A; background: #10121A; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="hdr">
    <span class="logo">Luma Video Köprüsü v1.1</span>
    <span class="badge" id="countBadge">0 link</span>
  </div>
  <div id="roomStatus" class="status">Açık Luma odası aranıyor...</div>

  <button id="captureTabBtn" class="hero" type="button">
    Bu Sekmedeki Videoyu Canlı Odaya Aktar (%100 Çalışır)
  </button>
  <div class="hint">
    Cloudflare / kaçak site / IP kilidi tanımaz, ekran seçme penceresi açmaz. Videoyu bu sekmede oynatıp tıkla, ses + görüntü direkt Luma 3D perdeye gider.
  </div>

  <div class="secTitle">Veya Doğrudan Akış Linki Gönder (HLS / MP4)</div>
  <div id="videoList" class="list"></div>
  <script src="popup.js"></script>
</body>
</html>`;

const POPUP_JS = `
document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('roomStatus');
  const listEl = document.getElementById('videoList');
  const countEl = document.getElementById('countBadge');
  const captureTabBtn = document.getElementById('captureTabBtn');

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage({ type: 'FIND_LUMA_TABS' }, (res) => {
    const tabs = (res && res.tabs) || [];
    if (tabs.length > 0) {
      statusEl.className = 'status ok';
      statusEl.textContent = 'Luma Odası Bağlı: ' + (tabs[0].title || 'Sinema Odası');
    } else {
      statusEl.textContent = 'Uyarı: Önce bir Luma odasına girin (luma-v2-lemon.vercel.app).';
    }
  });

  captureTabBtn.onclick = () => {
    if (!activeTab || !activeTab.id) return;
    statusEl.className = 'status';
    statusEl.textContent = 'Canlı video akışı Luma odasına bağlanıyor...';
    chrome.runtime.sendMessage(
      { type: 'CAPTURE_TAB_TO_LUMA', tabId: activeTab.id, title: activeTab.title },
      (res) => {
        if (res && res.ok) {
          statusEl.className = 'status ok';
          statusEl.textContent = 'Canlı yayın Luma 3D perdesinde başladı ✓';
        } else {
          statusEl.textContent = (res && res.error) || 'Aktarım başlatılamadı.';
        }
      }
    );
  };

  function sendVideo(item) {
    chrome.runtime.sendMessage({ type: 'SEND_TO_LUMA', ...item }, (res) => {
      if (res && res.ok) {
        statusEl.className = 'status ok';
        statusEl.textContent = 'Akış Luma 3D perdeye gönderildi ✓';
      } else {
        statusEl.textContent = (res && res.error) || 'Gönderilemedi.';
      }
    });
  }

  if (activeTab && activeTab.id) {
    chrome.runtime.sendMessage({ type: 'GET_TAB_VIDEOS', tabId: activeTab.id }, (res) => {
      const videos = (res && res.videos) || [];
      countEl.textContent = videos.length + ' link';
      if (videos.length === 0) {
        listEl.innerHTML =
          '<div class="empty">Henüz ham .m3u8/.mp4 linki yakalanmadı.<br/>Yukarıdaki mavi/mor butonu kullanabilirsin.</div>';
        return;
      }
      listEl.innerHTML = '';
      videos.forEach((v) => {
        const card = document.createElement('div');
        card.className = 'card';
        const t = document.createElement('div');
        t.className = 'title';
        t.textContent = v.title || 'Bulunan Video';
        const u = document.createElement('div');
        u.className = 'url';
        u.textContent = v.url;
        const row = document.createElement('div');
        row.className = 'row';
        const k = document.createElement('span');
        k.className = 'kind';
        k.textContent = String(v.sourceType || 'mp4').toUpperCase();
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.type = 'button';
        btn.textContent = 'Linki Gönder';
        btn.onclick = () => sendVideo(v);
        row.appendChild(k);
        row.appendChild(btn);
        card.appendChild(t);
        card.appendChild(u);
        card.appendChild(row);
        listEl.appendChild(card);
      });
    });
  }
});
`;

export async function GET() {
  const zipBuffer = buildZip([
    { name: 'manifest.json', content: Buffer.from(MANIFEST_JSON, 'utf8') },
    { name: 'background.js', content: Buffer.from(BACKGROUND_JS, 'utf8') },
    { name: 'content_luma.js', content: Buffer.from(CONTENT_LUMA_JS, 'utf8') },
    { name: 'content_scan.js', content: Buffer.from(CONTENT_SCAN_JS, 'utf8') },
    { name: 'popup.html', content: Buffer.from(POPUP_HTML, 'utf8') },
    { name: 'popup.js', content: Buffer.from(POPUP_JS, 'utf8') },
  ]);

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="luma-video-koprusu-eklentisi.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
