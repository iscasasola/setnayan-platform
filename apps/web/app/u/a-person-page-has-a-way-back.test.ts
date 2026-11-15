import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Owner 2026-10-26: "I opened a user and now im stuck on her account" — People opens /u/<slug> and the page
   drew no way back; inside the installed app there is no browser bar.
   2026-11-12 (DECISION_LOG "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"; owner: "when we enter a shop, event or
   anything, we should be able to go back to home"): drawn for EVERYONE now, signed out too, returning IN PLACE (the
   browser's back to Discover or People); cold, People signed in and Discover signed out (the drawing's Person row).
   Sabotage (each fails, 2026-11-12): put `if (!signedIn) return null` back; drop `inPlace` from either button; point
   the signed-out button at /dashboard?seg=people. */
const page = readFileSync(join(process.cwd(), 'app/u/[userSlug]/page.tsx'), 'utf8');
const back = readFileSync(join(process.cwd(), 'app/u/_components/profile-back.tsx'), 'utf8');

test('the person page draws the way back above its header', () => {
  const inner = page.indexOf('<div className="uprof-inner">');
  // The header is the shared `ProfileHeader` since 11 Nov 2026 (the same component Home draws).
  const head = page.indexOf('<ProfileHeader');
  const at = page.indexOf('<ProfileBack />');
  assert.ok(inner > -1 && head > -1, 'the page lost its inner wrapper or header');
  assert.ok(at > inner && at < head, 'ProfileBack must sit inside the page, above the header');
});

test('the way back returns in place, through the one shared back button; cold, People signed in', () => {
  // People is a section of Home since 11 Nov 2026 ("HOME IS THE PROFILE").
  assert.match(back, /<BackButton\s+href="\/dashboard\?seg=people"\s+label="People"[^>]*\binPlace\b[^>]*\/>/);
  assert.match(back, /from '@\/app\/_components\/back-button'/);
});

test('a signed-out visitor gets a way back too — in place, cold to Discover (2026-11-12)', () => {
  assert.doesNotMatch(back, /if \(!signedIn\) return null/, 'the person page is a dead end for someone signed out again');
  assert.match(back, /<BackButton\s+href="\/"\s+label="Discover"[^>]*\binPlace\b[^>]*\/>/, 'no in-place ‹ Discover for someone signed out');
  // Who is looking is read on the device (the page stays cacheable), and nothing is drawn until it is known.
  assert.match(back, /auth\.getSession\(\)/);
  assert.match(back, /if \(signedIn === null\) return null/);
  assert.match(back, /signedIn \? \(\s*<BackButton\s+href="\/dashboard\?seg=people"[\s\S]*?\) : \(\s*<BackButton\s+href="\/"/);
});
