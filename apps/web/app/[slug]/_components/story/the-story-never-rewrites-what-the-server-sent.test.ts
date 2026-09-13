/**
 * THE STORY NEVER REWRITES WHAT THE SERVER SENT.
 *
 * Found by the Story's step-8 drive against the LIVE page (2026-09-11): on a published story, React
 * reported hydration error #418 on 2 loads in 12, signed out and as a guest, and threw the whole
 * story away to redraw it on the client. Diffing the server's HTML against the drawn page on a
 * failing load pointed at the minute count-up: `story-clock.tsx` set `textContent` on every
 * `[data-story-countup]` on the page, reached through `document.querySelectorAll` — including
 * minutes in streamed parts React had not hydrated yet. Whether the observer or the hydration went
 * first was a race, which is why it was intermittent and why no unit test or stand-in page saw it.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ────────────────────────────────────────────────────────────
 * That no component of the public story writes text or markup into the DOM directly — every such
 * write is a text node React will later compare — and that the count-up still paints through its
 * attribute and the stylesheet's `::before`. Attributes are safe (React does not compare them when
 * it hydrates); text and markup are not. Source is read through the repo's one comment stripper.
 * Sabotage-checked: restoring the old `node.textContent =` line fails it; restored, it passes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');

const WRITES = /\.(?:textContent|innerText|innerHTML|outerHTML|nodeValue)\s*=(?!=)|\.insertAdjacentHTML\s*\(/;

test('no story component writes text or markup into the page directly', () => {
  const files = readdirSync(HERE).filter((f) => f.endsWith('.tsx'));
  const offenders = files.filter((f) => WRITES.test(stripComments(readFileSync(join(HERE, f), 'utf8'))));
  console.log(`# [story] components scanned: ${files.length}, writing text directly: ${offenders.length}`);
  // A zero population is a broken guard, not a clean folder.
  assert.ok(files.length >= 5, `found only ${files.length} story components — the scan has stopped seeing them`);
  assert.deepEqual(offenders, [], `writes text/markup into the DOM directly: ${offenders.join(', ')}`);
});

test('the count-up still paints through its attribute and ::before', () => {
  const clock = stripComments(readFileSync(join(HERE, 'story-clock.tsx'), 'utf8'));
  const css = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));
  assert.match(clock, /node\.dataset\.storyCounting = formatClock\(/);
  assert.match(clock, /delete node\.dataset\.storyCounting;/);
  assert.match(css, /\[data-story-countup\]\[data-story-counting\]::before\s*\{[^}]*content:\s*attr\(data-story-counting\)/);
});
