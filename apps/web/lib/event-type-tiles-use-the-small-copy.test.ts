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
  assert.match(src, /sizes="150px"/);
});
