import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const script = await readFile(new URL('assets/js/cfs-home-tiktok.js', root), 'utf8');

const mainNav = html.match(/<nav\b[^>]*id="r104MainNav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
assert(mainNav, 'Main navigation must exist');
assert.match(mainNav, /href="https:\/\/www\.tiktok\.com\/@cfs_zockt"/, 'TikTok profile must be reachable in main navigation');
assert.match(html, /class="r104-discord" href="https:\/\/discord\.gg\/3bfAkcJTp"/, 'Discord invite must be reachable from header');
assert.match(html, /href="https:\/\/www\.twitch\.tv\/cfs_zockt"/, 'Twitch channel must be linked');
assert.match(html, /id="refTikTokVideos"/, 'Video grid is required');
assert.match(html, /id="liveStatusBadge"/, 'Live-status panel is required');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs break UI controls');
const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
assert.deepEqual([...new Set(anchors.filter(anchor => !ids.includes(anchor)))], [], 'All homepage anchors must have targets');

async function renderVideos(response, fail = false) {
  const box = { innerHTML: '' };
  const document = {
    readyState: 'complete',
    getElementById: id => id === 'refTikTokVideos' ? box : null
  };
  const fetch = async (path, options) => {
    assert.equal(path, '/api/public/tiktok/videos');
    assert.equal(options.cache, 'no-store');
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => response };
  };
  runInNewContext(script, { document, fetch, URL, Set, console });
  await new Promise(resolve => setImmediate(resolve));
  return box.innerHTML;
}

const firstUrl = 'https://www.tiktok.com/@cfs_zockt/video/1234567';
const secondUrl = 'https://www.tiktok.com/@cfs_zockt/video/2345678';
const videos = [
  { id: '1', url: firstUrl, title: 'Clips & <Scripts>', thumbnail_url: 'https://p16-sign.tiktokcdn.com/cover.jpg' },
  { id: '1', url: firstUrl, title: 'Duplikat' },
  { id: '2', url: secondUrl, title: 'Echter zweiter Clip' },
  { id: '3', url: 'javascript:alert(1)', title: 'Unsicherer Link' },
  { id: '4', url: 'https://www.tiktok.com.evil.invalid/@cfs_zockt/video/123', title: 'Falsche Domain' },
  { id: '5', url: 'https://www.tiktok.com/@cfs_zockt/video/3456789', thumbnail_url: 'javascript:alert(1)', title: 'Ohne Thumbnail' }
];
const rendered = await renderVideos({ videos });
assert.equal((rendered.match(/class="ref-video-card"/g) || []).length, 3, 'Only unique real TikTok videos should render');
assert(rendered.includes('Clips &amp; &lt;Scripts&gt;'), 'Video title must be HTML escaped');
assert(!rendered.includes('javascript:'), 'Unsafe URL must never render');
assert(!rendered.includes('Duplikat'), 'Duplicate videos must not render');
assert(!rendered.includes('cfs-original-design-previews'), 'Design previews must not masquerade as videos');
const unavailable = await renderVideos({ videos: [] });
assert.match(unavailable, /keine bestätigten Videos verfügbar/i, 'Empty videos must be clearly identified');
assert.match(unavailable, /https:\/\/www\.tiktok\.com\/@cfs_zockt/, 'Empty state must offer real TikTok profile');
assert(!unavailable.includes('<img'), 'Empty state must not display fake thumbnails');
assert.match(await renderVideos(null, true), /keine bestätigten Videos verfügbar/i, 'Network failure must have honest fallback');

console.log('Public home: unique IDs, valid anchors, Discord/TikTok/Twitch, authentic unique videos and honest fallbacks verified.');
