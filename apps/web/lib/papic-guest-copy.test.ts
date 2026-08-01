/**
 * Papic GUEST-SURFACE copy is event-type neutral.
 *
 * These four pages are reached by a SEAT or GUEST token, not by an event — they
 * genuinely cannot know whether the event is a wedding, a birthday or a Simple
 * Event, and several of them (the dead-link branch especially) have no event
 * context at all. So they must not name one.
 *
 * ── HOW THE LAST FOUR STRINGS SURVIVED A COPY SWEEP ──────────────────────────
 * The 2026-07-31 pass fixed the paragraph each of these pages shows a SIGNED-IN
 * visitor, because that is the render every manual check produced — the tester
 * was always signed in. The strings that stayed were in the OTHER arms:
 *
 *   • claim/[token] — the SIGNED-OUT branch ("One of the couple asked you to be
 *     part of their wedding photo crew"), found only when a browser with no
 *     session happened to open it;
 *   • join/[token]  — the DEAD-LINK branch ("Ask the couple to re-share"), which
 *     fires only when the token resolves to nothing;
 *   • join/[token]  — the `metadata.description`, which no rendering shows at all.
 *
 * **A conditional's other arm is a surface you have not looked at**, and page
 * metadata is a surface nobody looks at. A source-level assertion sees all of
 * them at once, which is the whole reason this file exists rather than a
 * checklist.
 *
 * ⚠ `app/papic/page.tsx` is deliberately EXCLUDED. That is the public marketing
 * page, and its wedding-first copy + SEO keywords are the standing "lead
 * all-events, weddings deepest" positioning — not a defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Token-reached guest capture surfaces. NOT the marketing page. */
const GUEST_SURFACES = [
  'app/papic/join/[token]/page.tsx',
  'app/papic/claim/[token]/page.tsx',
  'app/papic/me/[token]/page.tsx',
  'app/papic/seat/[token]/page.tsx',
];

/** Strip JS/JSX comments so the explanatory notes above each fix don't self-trip. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

for (const rel of GUEST_SURFACES) {
  test(`${rel} names no event type`, () => {
    const m = withoutComments(read(rel)).match(/wedding/i);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". This page is reached by a TOKEN, not an ` +
        `event — it cannot know the event type, and Papic ships on all 16. ` +
        `Say "the day" / "your event", or nothing.`,
    );
  });

  test(`${rel} does not assume the host is a couple`, () => {
    const m = withoutComments(read(rel)).match(/\bthe couple\b|\bcouple['’]s\b|couple&rsquo;s/i);
    assert.equal(
      m,
      null,
      `${rel} carries "${m?.[0]}". A birthday has a celebrant, a reunion an ` +
        `organiser, a Simple Event a host. Use "the host" or "whoever sent it".`,
    );
  });
}
