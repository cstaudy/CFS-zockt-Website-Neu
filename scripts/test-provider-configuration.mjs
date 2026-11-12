import assert from 'node:assert/strict';
import { twitchConfigured, finishTwitch } from '../src/twitch.js';
import { tiktokConfigured, finishTikTok } from '../src/tiktok.js';

const original = Object.fromEntries(['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI', 'SESSION_SECRET'].map(key => [key, process.env[key]]));
try {
  Object.assign(process.env, {
    TWITCH_CLIENT_ID: 'test-id', TWITCH_CLIENT_SECRET: 'test-client-secret',
    TIKTOK_CLIENT_KEY: 'test-key', TIKTOK_CLIENT_SECRET: 'test-client-secret',
    TIKTOK_REDIRECT_URI: 'https://example.invalid/callback'
  });
  delete process.env.SESSION_SECRET;
  assert.equal(twitchConfigured(), false);
  assert.equal(tiktokConfigured(), false);
  assert.equal((await finishTwitch({}, {}, new URL('https://example.invalid/'))).status, 503);
  assert.equal((await finishTikTok({}, {}, new URL('https://example.invalid/'))).status, 503);
  process.env.SESSION_SECRET = 'test-session-secret';
  assert.equal(twitchConfigured(), true);
  assert.equal(tiktokConfigured(), true);
  console.log('Provider configuration: OAuth requires a session secret.');
} finally {
  for (const [key, value] of Object.entries(original)) value === undefined ? delete process.env[key] : process.env[key] = value;
}
