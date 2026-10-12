/**
 * guest-preload.test.ts — 🔁 ONE VISIT, ONE RENDER.
 *
 * The warm-up asked the service worker to fetch `/<slug>` after every visit, so a guest whose
 * visit already came through the worker (which caches every guest navigation it answers —
 * public/sw.js, network-first) paid for the whole page twice. The page is asked again only
 * when this document did NOT arrive through the worker as exactly `/<slug>`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { arrivedThroughWorkerAs, guestPreloadUrls } from './guest-preload';

const ICONS = ['/manifest.json', '/icon-192.svg', '/icon-512.svg'];
const at = (url: string, workerStart?: number) => ({ name: url, workerStart });

test('a visit that came through the worker as /<slug> is not fetched a second time', () => {
  assert.equal(arrivedThroughWorkerAs('maria-and-jose', at('https://setnayan.com/maria-and-jose', 12.5)), true);
  assert.deepEqual(guestPreloadUrls('maria-and-jose', at('https://setnayan.com/maria-and-jose', 12.5)), ICONS);
});

test('every other arrival still warms the page — nothing else cached it', () => {
  for (const [why, entry] of [
    ['no worker answered (first visit)', at('https://setnayan.com/maria-and-jose', 0)],
    ['the browser does not say', at('https://setnayan.com/maria-and-jose')],
    ['no navigation entry at all', undefined],
    ['an address with a query (the cache key differs)', at('https://setnayan.com/maria-and-jose?k=abc', 9)],
    ['reached in-app from another page', at('https://setnayan.com/maria-and-jose/invite/enter', 9)],
    ['another spelling of the slug', at('https://setnayan.com/Maria-And-Jose', 9)],
    ['an unreadable entry name', at('not a url', 9)],
  ] as const) {
    assert.deepEqual(guestPreloadUrls('maria-and-jose', entry), [...ICONS, '/maria-and-jose'], why);
  }
});

test('the component posts exactly that list — no second, hand-kept list', () => {
  const src = stripComments(readFileSync(join(__dirname, 'guest-preload.tsx'), 'utf8'));
  assert.match(src, /urls: guestPreloadUrls\(eventSlug, thisDocumentsNavigation\(\)\),/);
  assert.equal(src.split("'PRELOAD_ASSETS'").length - 1, 1, 'a second warm-up message is posted');
  assert.match(src, /if \(!arrivedThroughWorkerAs\(eventSlug, entry\)\) urls\.push\(`\/\$\{eventSlug\}`\);/);
});
