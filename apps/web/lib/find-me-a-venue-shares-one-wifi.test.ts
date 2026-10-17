/**
 * 📶 A VENUE SHARES ONE WI-FI — event-day L1·5 (lib/find-me.ts budgets).
 *
 * Before: the find-me door's budgets were per event × per IP — 20 name look-ups
 * and 10 digit tries in 15 minutes. A reception is ONE Wi-Fi address, so the
 * 21st guest to type their name was silently shown the ask-to-join form. Now
 * each budget is per PHONE (a signed cookie) and the connection's is sized for
 * a whole venue. Run against an in-memory limiter with the real numbers.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the per-IP name budget held at the phone’s number again  → tests 1, 2 red;
 *   • the per-phone name budget dropped                        → test 2 red;
 *   • the per-guest digits budget dropped                      → test 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
import {
  FIND_ME_DIGITS_LIMIT,
  FIND_ME_NAME_LIMIT,
  FIND_ME_ROW_LIMIT,
  FIND_ME_VENUE_DIGITS_LIMIT,
  FIND_ME_VENUE_NAME_LIMIT,
  FIND_ME_WINDOW_SECS,
} from './find-me';

type Srv = typeof import('./find-me.server');
const srv = (): Promise<Srv> => import('./find-me.server');

/** A fixed-window limiter in memory — the same contract as `enforceRateLimit`. */
function memoryLimiter() {
  const hits = new Map<string, number>();
  return async (bucket: string, ident: string, opts: { limit: number }) => {
    const k = `${bucket}:${ident}`;
    const n = (hits.get(k) ?? 0) + 1;
    hits.set(k, n);
    return { ok: n <= opts.limit };
  };
}
const venue = () => new Headers({ 'x-vercel-forwarded-for': '203.0.113.7' });
const NAMES = { device: FIND_ME_NAME_LIMIT, venue: FIND_ME_VENUE_NAME_LIMIT, windowSecs: FIND_ME_WINDOW_SECS };
const DIGITS = { device: FIND_ME_DIGITS_LIMIT, venue: FIND_ME_VENUE_DIGITS_LIMIT, row: FIND_ME_ROW_LIMIT, windowSecs: FIND_ME_WINDOW_SECS };

test('1 · 250 guests on one Wi-Fi, two name tries each — every one is looked up', async () => {
  const { spendNameLookup } = await srv();
  const limit = memoryLimiter();
  let refused = 0;
  for (let g = 0; g < 250; g++) {
    for (let t = 0; t < 2; t++) if (!(await spendNameLookup('ev', venue(), `phone-${g}`, NAMES, limit))) refused += 1;
  }
  assert.equal(refused, 0, `${refused} real look-ups were refused at the venue door`);
});

test('2 · one phone is still held to a person’s pace, and a cookie-less flood to the venue’s', async () => {
  const { spendNameLookup } = await srv();
  const limit = memoryLimiter();
  const one = [];
  for (let i = 0; i < FIND_ME_NAME_LIMIT + 1; i++) one.push(await spendNameLookup('ev', venue(), 'phone-x', NAMES, limit));
  assert.equal(one.filter(Boolean).length, FIND_ME_NAME_LIMIT, 'one phone looked up past its own budget');
  const flood = memoryLimiter();
  let allowed = 0;
  for (let i = 0; i < FIND_ME_VENUE_NAME_LIMIT + 50; i++) if (await spendNameLookup('ev', venue(), `fresh-${i}`, NAMES, flood)) allowed += 1;
  assert.equal(allowed, FIND_ME_VENUE_NAME_LIMIT, 'a script throwing its cookie away is not bounded by the connection');
  // No phone id at all (no secret) → the connection keeps the old, tight number.
  const bare = memoryLimiter();
  let bareAllowed = 0;
  for (let i = 0; i < FIND_ME_NAME_LIMIT + 5; i++) if (await spendNameLookup('ev', venue(), null, NAMES, bare)) bareAllowed += 1;
  assert.equal(bareAllowed, FIND_ME_NAME_LIMIT);
});

test('3 · digits: the room gets through, one guest’s digits still get 5 tries from everywhere', async () => {
  const { spendDigitsTry } = await srv();
  const limit = memoryLimiter();
  let refused = 0;
  for (let g = 0; g < 120; g++) {
    for (let t = 0; t < 2; t++) if (!(await spendDigitsTry('ev', `guest-${g}`, venue(), `phone-${g}`, DIGITS, limit))) refused += 1;
  }
  assert.equal(refused, 0, `${refused} real digit tries were refused at the venue door`);
  const guess = memoryLimiter();
  let tries = 0;
  for (let i = 0; i < 20; i++) if (await spendDigitsTry('ev', 'victim', venue(), `bot-${i}`, DIGITS, guess)) tries += 1;
  assert.equal(tries, FIND_ME_ROW_LIMIT, 'one guest’s digits can be guessed past their own budget');
});

test('4 · the budgets are written down with their reason', async () => {
  const { readFileSync } = await import('node:fs');
  const lib = readFileSync(`${__dirname}/find-me.ts`, 'utf8');
  assert.match(lib, /THE BUDGETS ARE PER PHONE FIRST, AND THE CONNECTION'S IS SIZED FOR A VENUE/);
  assert.ok(FIND_ME_VENUE_NAME_LIMIT >= 300 && FIND_ME_VENUE_DIGITS_LIMIT >= 200, 'the venue ceiling shrank below a reception');
});
