/**
 * The guest-side receiver for coordinator announcements.
 *
 * ── WHAT THIS PROTECTS ──────────────────────────────────────────────────────
 * The composer shipped months before this, and the privacy control for it is
 * ACTIVE in production — but nothing on the guest site ever read what it wrote.
 * A coordinator could type "phones down, the ceremony is starting" and it would
 * reach only the couple's own dashboard. This file pins the four properties
 * that make the receiver correct, all of which are easy to undo by accident.
 *
 * Source scans: there is no DOM under `tsx --test`, and the render path needs a
 * live event, a guest session and a day-of phase. What regresses here is the
 * WIRING — someone widens the audience, drops the live-window gate, or makes an
 * announcement dismissible.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARD = readFileSync(join(HERE, 'day-of-announcement.tsx'), 'utf8');
const SITE = readFileSync(join(HERE, 'site-body.tsx'), 'utf8');
const LOADERS = readFileSync(join(HERE, '..', '_lib', 'loaders.ts'), 'utf8');

test('announcement · GUESTS only — a stranger with the link never sees it', () => {
  // The render must sit inside guestTree, after it, not before. An announcement
  // is for the people in the room; "the ceremony is running late" is not for
  // whoever was forwarded the URL.
  const guestTreeStart = SITE.indexOf('const guestTree =');
  const renderAt = SITE.indexOf('<DayOfAnnouncement');
  assert.ok(guestTreeStart > 0, 'guestTree not found — the scan is pointed wrong');
  assert.ok(renderAt > 0, 'the announcement is not rendered at all');
  assert.ok(
    renderAt > guestTreeStart,
    'the announcement renders OUTSIDE the guest tree — that would show it to anonymous visitors',
  );
  // And it must not have been added to the anonymous tree too.
  const anonStart = SITE.indexOf('const anonymousTree =');
  const anonSlice = SITE.slice(anonStart, guestTreeStart);
  assert.ok(
    !anonSlice.includes('<DayOfAnnouncement'),
    'the announcement also renders in the anonymous tree',
  );
});

test('announcement · live window only — nothing stale survives the day', () => {
  // The loader takes the resolved phase and returns null outside it. If someone
  // drops that argument the guard is gone and a "we are running late" from the
  // wedding day haunts the page forever.
  assert.match(LOADERS, /export const loadDayOfBroadcast = cache\(/);
  assert.match(LOADERS, /isLive: boolean,/);
  assert.match(LOADERS, /if \(!isLive\) return null;/);
});

test('announcement · one message, never a feed', () => {
  // A guest gets the latest only. A scrollback of operational chatter is the
  // coordinator's business and would compete with the couple's own words.
  assert.match(LOADERS, /\.order\('created_at', \{ ascending: false \}\)/);
  assert.match(LOADERS, /\.limit\(1\)/);
});

test('announcement · not dismissible, and announced politely', () => {
  // "Phones down" that a guest can swipe away is worse than none — the
  // coordinator has no way to know it was dismissed.
  // Scan the CODE, not the prose — the file's own docblock explains why it is
  // not dismissible, and matching that word would fail on the explanation.
  const code = CARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // The real signals of dismissibility are a handler and local state. Do NOT
  // add bare words like "hidden" here: `aria-hidden` on the decorative icon is
  // correct, and a blunt word-list flags it. (Caught three times in one day —
  // a smell test that fires on correct code teaches people to delete the test.)
  for (const smell of ['onClick', 'useState', 'dismiss(', 'Dismiss(', 'onDismiss']) {
    assert.ok(
      !code.includes(smell),
      `the announcement card's CODE contains "${smell}" — it must not be dismissible`,
    );
  }
  // It is a server component: no directive, so no client state is even possible.
  assert.ok(!code.includes("'use client'"), 'the card became a client component — why?');
  // role=status + polite: announced without seizing focus. `alert` would
  // interrupt whatever the guest is reading, and this is not an error.
  assert.match(CARD, /role="status"/);
  assert.match(CARD, /aria-live="polite"/);
  assert.ok(!CARD.includes('role="alert"'), 'an announcement must not be an alert');
});

test('announcement · the coordinator’s words render as TEXT, never as markup', () => {
  // Typed by a person on a phone under pressure, shown to every guest at the
  // wedding. Nothing here may interpret it.
  assert.ok(
    !CARD.includes('dangerouslySetInnerHTML'),
    'the announcement body is rendered as HTML — it is untrusted human input',
  );
  assert.match(CARD, /\{body\}/);
});
