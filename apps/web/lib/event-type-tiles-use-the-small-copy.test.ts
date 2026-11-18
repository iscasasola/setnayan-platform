// ⚡ The front page's event-type strip draws 150-px tiles; each must have a small copy of
// the repo photo, and the strip must offer it (srcSet) — else 20 tiles pull ~170 KB each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const full = readdirSync(join(ROOT, 'public/event-types')).filter((f) => f.endsWith('.webp'));

test('every repo event-type photo has a small copy that is much lighter', () => {
  for (const f of full) {
    const small = join(ROOT, 'public/event-types/sm', f);
    assert.ok(existsSync(small), `public/event-types/sm/${f} is missing`);
    assert.ok(statSync(small).size < 60_000, `${f} small copy is over 60 KB`);
  }
});

test('the front-page strip offers the small copy via srcSet', () => {
  const src = readFileSync(join(ROOT, 'app/_components/frontdoor/front-door-landing.tsx'), 'utf8');
  assert.match(src, /srcSet=\{[^}]*eventTypeSmallPhotoSrc\(t\.key\)/);
  assert.match(src, /sizes="\(min-width: 701px\) 200px, 150px"/);
});

/* The `sizes` above must be the widths the CSS really draws — a 150 the CSS has grown to 200 would hand a 2× desktop
   the 330-px copy for a 400-px box (blurred). Read both widths from the stylesheet itself. */
test('the srcSet sizes match the tile widths the stylesheet draws', () => {
  const css = readFileSync(join(ROOT, 'app/_components/frontdoor/front-door-landing.css'), 'utf8');
  const widths = [...css.matchAll(/\.fd \.fl-et \{[^}]*?\bwidth: (\d+)px/g)].map((m) => Number(m[1]));
  assert.deepEqual(widths, [150, 200], `the tile is drawn at ${widths.join(', ')} px — update \`sizes\` and this test together`);
  const wide = css.slice(0, css.lastIndexOf('.fd .fl-et {')).match(/@media \(min-width: (\d+)px\)[^@]*$/);
  assert.equal(wide?.[1], '701', 'the 200-px tile is no longer under the 701-px breakpoint `sizes` names');
  /* Every width × density up to 2× is covered by a copy at least as wide (the 3× phone takes the 880). */
  for (const w of widths) assert.ok(330 >= w * 1.5 && 880 >= w * 2, `${w}px tiles outgrow the copies`);
});
