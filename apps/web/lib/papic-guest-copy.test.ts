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
 * ⚠ `app/(shell)/papic/page.tsx` is deliberately EXCLUDED. That is the public marketing
 * page, and its wedding-first copy + SEO keywords are the standing "lead
 * all-events, weddings deepest" positioning — not a defect.
 *
 * ── 🪤 THE FIRST VERSION OF THIS FILE HAD THE BUG IT WAS WRITTEN TO PREVENT ──
 * It listed four `page.tsx` files by hand and missed every `_components/`
 * folder — where the strings actually live. It passed while 29 more sat one
 * directory below, including "Every shot lands in the couple's gallery" on the
 * capture screen itself. **A hand-typed file list is the same defect as a
 * hand-typed string**, so this now WALKS the tree: a new Papic surface is
 * covered the moment it exists, with nobody remembering to add it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * WALK the Papic guest tree — never a hand-maintained list (see the header).
 * Only `app/(shell)/papic/page.tsx`, the public marketing page, is excluded.
 */
function guestSurfaces(dir = 'app/papic', acc: string[] = []): string[] {
  for (const entry of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) guestSurfaces(rel, acc);
    else if (entry.name.endsWith('.tsx') && rel !== 'app/(shell)/papic/page.tsx') acc.push(rel);
  }
  return acc;
}

const GUEST_SURFACES = guestSurfaces();

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
