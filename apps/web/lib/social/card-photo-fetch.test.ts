/**
 * card-photo-fetch.test.ts — THE SHARE PICTURE HAS A TIME LIMIT.
 *
 * 1 · EXECUTED: against a server that sends its headers and then never
 *     finishes the body, the fetch gives up at the limit (headers alone are not
 *     "arrived" — the body is the photo).
 * 2 · EVERY photo fetch behind `/api/og/**` carries the limit, and sits inside
 *     the `try` whose `catch` draws the card with no photo.
 * 3 · EVERY route under `app/api/og` states its own `maxDuration`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AddressInfo } from 'node:net';

import { CARD_PHOTO_TIMEOUT_MS, cardPhotoSignal } from './card-photo-fetch';
import { stripComments } from '../strip-comments';

const WEB = join(__dirname, '..', '..');

test('1 · a photo that starts and never finishes is given up on at the limit', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'image/jpeg' });
    res.write(Buffer.alloc(16)); // the headers and a first chunk arrive; the rest never does
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  const started = Date.now();
  try {
    await assert.rejects(async () => {
      const res = await fetch(`http://127.0.0.1:${port}/photo.jpg`, { signal: cardPhotoSignal(300) });
      assert.equal(res.ok, true, 'the stand-in did not answer — the test is not exercising the body');
      await res.arrayBuffer();
    });
    const took = Date.now() - started;
    assert.ok(took >= 250 && took < 3000, `gave up after ${took} ms, expected about 300`);
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});

test('the limit is a few seconds — under every route’s own limit', () => {
  assert.ok(CARD_PHOTO_TIMEOUT_MS >= 2000 && CARD_PHOTO_TIMEOUT_MS <= 8000, String(CARD_PHOTO_TIMEOUT_MS));
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test('2 · every photo fetch behind the share pictures carries the limit, inside the try that falls back', () => {
  const cards = walk(join(WEB, 'lib', 'social')).filter((f) => /-card\.tsx?$/.test(f));
  assert.ok(cards.length >= 5, `expected the share-card renderers, found ${cards.length}`);
  let fetches = 0;
  for (const file of cards) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/\bfetch\(/g)) {
      fetches += 1;
      const at = m.index as number;
      const call = src.slice(at, src.indexOf('\n', at));
      assert.match(
        call,
        /signal:\s*cardPhotoSignal\(\)/,
        `${relative(WEB, file)}: a photo is fetched with no time limit — ${call.trim()}`,
      );
      // The nearest `try {` before it must still be open, so a give-up is caught.
      const before = src.slice(0, at);
      const tryAt = before.lastIndexOf('try {');
      assert.ok(tryAt > -1, `${relative(WEB, file)}: the photo fetch is not inside a try`);
      const between = before.slice(tryAt);
      const open = (between.match(/\{/g) ?? []).length;
      const closed = (between.match(/\}/g) ?? []).length;
      assert.ok(open > closed, `${relative(WEB, file)}: the photo fetch is outside the try that draws the card without it`);
    }
  }
  assert.ok(fetches >= 5, `only ${fetches} photo fetches found across the cards — the scan went blind`);
});

test('3 · every /api/og route states its own time limit', () => {
  const routes = walk(join(WEB, 'app', 'api', 'og')).filter((f) => /route\.tsx?$/.test(f));
  assert.ok(routes.length >= 7, `expected the share-picture routes, found ${routes.length}`);
  for (const file of routes) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const m = /^export const maxDuration = (\d+);/m.exec(src);
    assert.ok(m, `${relative(WEB, file)} has no maxDuration — its limit is the platform's 300 s`);
    const seconds = Number((m as RegExpExecArray)[1]);
    assert.ok(seconds >= 10 && seconds <= 60, `${relative(WEB, file)}: maxDuration ${seconds}s`);
    assert.ok(seconds * 1000 > CARD_PHOTO_TIMEOUT_MS * 2, 'the route would end before a card could fall back');
  }
});
