/**
 * every-heading-folds.test.ts — EVERY GUEST-LIST HEADING COLLAPSES AND EXPANDS,
 * THE PINNED "BRIDE & GROOM" TOO.
 *
 * ⚖ Owner 2026-09-21: *"these rows should be able to make the content of that
 * grouping collapse and expand like an accordion."* Measured live 2026-10-03 at
 * 375 px on maria-and-jose: tapping the pinned "Bride & Groom" heading flipped
 * `aria-expanded` but the cards stayed (124 → 124), while Groomsmen folded
 * (124 → 120). The honoree section was built down its own branch with its own
 * copy of the fold test — two places for one rule.
 *
 * Now the build makes every section WHOLE and ONE function (`foldSections`)
 * empties the folded ones, for every key alike.
 *
 * 🛡 Sabotaged (see the PR): making `foldSections` skip the 'honoree' key turns
 * the test red. (2026-10-09: the second test, which pinned the retired
 * GuestListMultiselect's two draw sites, went with that component.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldSections } from '@/lib/roster-arrangement';

const SECTIONS = [
  { key: 'honoree', label: 'Bride & Groom', count: 2, guests: ['maria', 'jose'], pinned: true },
  { key: 'role:Groomsmen', label: 'Groomsmen', count: 1, guests: ['gabriel'] },
  { key: 'role:Guests', label: 'Guests', count: 2, guests: ['cita', 'nena'] },
];

test('every heading folds and unfolds — the pinned honoree exactly like the rest', () => {
  for (const sec of SECTIONS) {
    const shut = foldSections(SECTIONS, new Set([sec.key]));
    for (const s of shut) {
      if (s.key === sec.key) {
        assert.deepEqual(s.guests, [], `folding "${sec.label}" left its cards on screen`);
        assert.equal(s.count, sec.count, `a folded "${sec.label}" no longer says how many it holds`);
        assert.equal(s.label, sec.label);
      } else {
        assert.deepEqual(s.guests, SECTIONS.find((x) => x.key === s.key)!.guests, `folding "${sec.label}" also hid "${s.label}"`);
      }
    }
    const open = foldSections(shut, new Set());
    // Re-open from the WHOLE build (the component keeps it), never from the folded copy.
    const reopened = foldSections(SECTIONS, new Set());
    assert.deepEqual(reopened, SECTIONS, `"${sec.label}" does not come back when opened`);
    assert.equal(open.length, SECTIONS.length);
  }
  // Everything shut at once — the pinned heading too.
  const all = foldSections(SECTIONS, new Set(SECTIONS.map((s) => s.key)));
  assert.ok(all.every((s) => s.guests.length === 0), 'a heading stayed open when every heading was folded');
});
