/**
 * raw-hex-only-goes-down.test.ts — 🌙 THE COUPLE'S DASHBOARD PAINTS FROM TOKENS; A RAW HEX CAN ONLY BE REMOVED.
 *
 * WHY. The couple's `/dashboard` area opened to dark on 18 Nov 2026 (owner: "dark mode. YES :D" · pick 5, "the couple's
 * /dashboard goes dark first"). A colour written as a hex in a screen file does not follow the theme: it stays the
 * light value on a dark screen — a white card, an espresso word, a pale chip. Before the area was put on the
 * ready-list (`DARK_READY`, lib/appearance.ts) its screen colours were moved onto tokens; this file is what stops the
 * next one from being typed back in.
 *
 * WHAT IT COUNTS. Every hex colour literal (`#rgb`, `#rrggbb`, `#rrggbbaa`) in the non-test `.ts` / `.tsx` / `.css`
 * files under `app/dashboard`, comments removed with the repo's one stripper, summed PER AREA (the folder under
 * `[eventId]`, or under `(account)`). Each area's count may only go DOWN from `raw-hex.baseline.json`.
 *
 * WHAT IS LEFT IN THE BASELINE, AND WHY IT IS NOT ZERO. A hex that is a colour the PERSON or the ART owns is not
 * chrome and must not follow the theme: the couple's own palette and monogram colours (data), a drawing of a phone, a
 * camera or a wax seal, the seat-plan lab's own stage, print and PDF routes (always light — owner call 9, 13 Oct), the
 * schedule's phase swatches, a status tone that already carries its `html.dark` pair in the same stylesheet. Those are
 * what the remaining numbers are. A NEW one needs the same honest reason — and the usual answer is a token.
 *
 * TO LOWER A COUNT after removing hexes: `WRITE_HEX_BASELINE=1 pnpm exec tsx --test app/dashboard/raw-hex-only-goes-down.test.ts`
 * (it refuses to raise any number). Never edit the JSON by hand to go green.
 *
 * SABOTAGE (each run once, each went red): `style={{ color: '#123456' }}` added to budget/page.tsx → the budget area ·
 * a new folder with one hex and no baseline row → "an area with no baseline".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { areaOf, assertHexOnlyGoesDown, countHex } from '@/lib/raw-hex-ratchet';

const HERE = dirname(fileURLToPath(import.meta.url));

test('the couple’s dashboard: raw hex colours per area only go down', () => {
  assertHexOnlyGoesDown(HERE, join(HERE, 'raw-hex.baseline.json'), '18 Nov 2026');
});

test('the counter can see a hex — and is not fooled by a comment or an id', () => {
  assert.equal(countHex(`const a = { color: '#C24E25', bg: "#fff" };`, false), 2);
  assert.equal(countHex(`// was #C24E25 (PR #7098)\nconst a = 1; /* #fff */`, false), 0);
  assert.equal(countHex(`.x { color: #2c2a29; } /* #ffffff */ .y { background: #1c1a16cc; }`, true), 2);
  assert.equal(countHex(`className="bg-[#17160F] text-raised"`, false), 1);
  assert.equal(areaOf('[eventId]/budget/_components/x.tsx'), '[eventId]/budget');
  assert.equal(areaOf('(account)/billing/page.tsx'), '(account)/billing');
  assert.equal(areaOf('[eventId]/layout.tsx'), '[eventId]');
  assert.equal(areaOf('page.tsx'), '(root)');
});
