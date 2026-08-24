/**
 * the-invitation-is-not-our-billboard.test.ts — H-3 (= the former AP-4), and
 * delegated call #7 of 2026-08-23: "our wordmark on a shared card → ONCE, not
 * three times. It is the couple's invitation, not our billboard."
 *
 * MEASURED 2026-08-24. `monogramCardTree` named us three times, all
 * unconditional: 'SETNAYAN · INVITATION' at the top, the `wordmark()` in the
 * footer, and 'www.setnayan.com' beneath it.
 *
 * 🔑 AND IT IS THE CARD THAT ACTUALLY SHIPS. Production holds 5 editorials,
 * 0 published and 0 with a hero photo — so the photo variant and the branded
 * Real-Story variant are both unreachable, and this monogram card is what every
 * real share of every real invitation renders today. The three mentions were
 * not a theoretical nit on a code path nobody hits.
 *
 * ⚠ THE PLATFORM ALREADY PRINTS OUR NAME. `generateMetadata` sends
 * `siteName: 'Setnayan'`, so the share surface renders it beside the card
 * regardless. Three more times inside the image bought no reach.
 *
 * ⛔ WHAT THIS FILE DELIBERATELY DOES NOT DO, AND WHY IT IS PINNED BELOW.
 * The other half of H-3 — putting the couple's own photograph on the card — has
 * a tempting source: `events.std_media.posterKey`, the poster frame of the
 * save-the-date film, which one production event really has. It is NOT used,
 * because that key is the COUPLE'S OWN OBJECT. SEC-6 exists precisely so guests
 * are served a SEALED, screened copy at `events/{id}/std-screened/…` instead —
 * a spine hardened over three rounds after a real attack in which a crafted key
 * earned a genuine `approved` verdict while resolving to a foreign origin.
 * Feeding the unsealed poster to a public, unauthenticated share card would
 * walk straight back into that. The sanctioned photo path (a PUBLISHED
 * editorial hero, via the stable streaming route) already ships and is already
 * correct; it simply has no data yet.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const CARD = join(HERE, 'realstory-card.tsx');

/** Comments here quote the removed strings to explain the defect; a raw grep
 *  would match the explanation and report the bug it just fixed. */
function source(): string {
  return readFileSync(CARD, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The body of one `function name(` … matching brace. */
function treeBody(name: string): string {
  const src = source();
  const m = new RegExp(`function ${name}\\([^)]*\\)[^{]*\\{`).exec(src);
  assert.notEqual(m, null, `${name} is gone from realstory-card.tsx`);
  let i = m!.index + m![0].length;
  let depth = 1;
  while (depth > 0 && i < src.length) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') depth -= 1;
    i += 1;
  }
  return src.slice(m!.index + m![0].length, i);
}

function brandMentions(body: string): string[] {
  return body.match(/'[^']*[Ss][Ee][Tt][Nn][Aa][Yy][Aa][Nn][^']*'|wordmark\(\)|madeWithMark\(\)/g) ?? [];
}

test('🔴 the invitation card names us ONCE', () => {
  const hits = brandMentions(treeBody('monogramCardTree'));
  assert.equal(
    hits.length,
    1,
    `the couple's invitation share card names Setnayan ${hits.length} time(s): ` +
      `${JSON.stringify(hits)}. It is their invitation, not our billboard — and ` +
      `the share surface already prints our name from openGraph siteName.`,
  );
});

test('the one that survives is the wordmark, in the footer', () => {
  const body = treeBody('monogramCardTree');
  assert.match(body, /wordmark\(\)/, 'the footer wordmark is the mention that stays');
  assert.equal(
    /'www\.setnayan\.com'/.test(body),
    false,
    'the url line is back — a share card always travels WITH the link it ' +
      'previews, so the address on the image is the least useful of the three',
  );
});

test('the header still says what the card is', () => {
  // Dropping the slot entirely would push the couple's monogram off centre —
  // the layout is a three-slot space-between.
  assert.match(
    treeBody('monogramCardTree'),
    /'INVITATION'/,
    "the header slot lost its label; the card's three-slot layout needs it and " +
      'a reader needs to know what they are looking at',
  );
});

test('the couple still get their own mark, names and date', () => {
  const body = treeBody('monogramCardTree');
  // 🪤 THE FIRST VERSION OF THIS TEST WAS DECORATION, and the mutation run is
  // what said so. It asserted /initials/ — which also matches the DECLARATION
  // `const initials = monogramInitials(...)` a few lines above. Gutting the
  // element that RENDERS them scored 1 → 0 on the render line and stayed GREEN,
  // because the declaration was still sitting there satisfying the match.
  // Each assertion now pins the RENDER POSITION: the value as an element child,
  // not the identifier anywhere in the function.
  assert.match(
    body,
    /^\s+initials,$/m,
    'the couple monogram initials are no longer RENDERED on their own card',
  );
  assert.match(
    body,
    /clamp\(input\.coupleNames, \d+\),/,
    'the couple names are no longer rendered on their own card',
  );
  assert.match(
    body,
    /input\.dateLabel\.toUpperCase\(\)/,
    'the date is no longer rendered on their own card',
  );
});

test('⛔ the share card does not serve the couple’s UNSEALED save-the-date media', () => {
  // The SEC-6 boundary this PR deliberately did not cross. `std_media` holds
  // the couple's own object; guests are served a sealed, screened copy at a
  // different key. A public, unauthenticated OG route must not reach past that.
  const raw = readFileSync(CARD, 'utf8');
  const route = readFileSync(
    join(WEB, 'app', 'api', 'og', 'realstory-slug', '[slug]', 'route.ts'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [name, src] of [['realstory-card.tsx', source()], ['the og route', route]] as const) {
    assert.equal(
      /std_media|posterKey|std-video-poster/.test(src),
      false,
      `${name} now reads the couple's own save-the-date media. Guests are ` +
        `served a SEALED copy (events/{id}/std-screened/…) precisely because ` +
        `the unsealed object is unscreened — SEC-6 was hardened over three ` +
        `rounds after a crafted key earned a real 'approved' verdict while ` +
        `resolving to a foreign origin. Do not feed it to a public OG route.`,
    );
  }
  assert.ok(raw.length > 0);
});

test('the sanctioned photo path still prefers the STABLE url over a presign', () => {
  // A presigned URL baked into a crawler's cache expires and the card silently
  // breaks later with nothing to blame — this repo has already paid for that on
  // prerendered blog pages. Unchanged by this PR, and pinned so it stays true.
  const route = readFileSync(
    join(WEB, 'app', 'api', 'og', 'realstory-slug', '[slug]', 'route.ts'),
    'utf8',
  );
  assert.match(
    route,
    /heroPhotoUrl: data\.heroStableUrl \?\? data\.heroPhotoUrl/,
    'the OG route stopped preferring the stable streaming URL for the hero — a ' +
      'presign in a crawler cache dies quietly',
  );
});
