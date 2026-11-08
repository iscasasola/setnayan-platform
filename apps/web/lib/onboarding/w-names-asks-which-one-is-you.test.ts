/**
 * w-names-asks-which-one-is-you.test.ts — the wedding's names card asks "Which one is you?" FIRST, and
 * your account name lands in YOUR row only.
 *
 * Owner, 2026-11-08, verbatim (on "should `w_names` ask which one is you?"): *"yes. they need to be one of
 * the 2."* So:
 *   · the card cannot be passed until the person has picked bride or groom — no third choice;
 *   · the pick is the wizard's EXISTING `role` (→ `event_moderators.role_subtype` + the creator's own guest
 *     row at commit), never a new store;
 *   · their own row starts from the account name (first + last), editable, with the phone's name tokens;
 *     the partner's row is never prefilled and keeps autofill off;
 *   · a re-pick moves the untouched prefill to the new own row, and never overwrites or clears typed text.
 *
 * Executed where it can be (the pure rules); read as source only for the wiring between them.
 * SABOTAGE (2026-11-08): see the build notes `build-notes/w-names-which-one-is-you.md`.
 *
 * Run from apps/web:  npx tsx --test lib/onboarding/w-names-asks-which-one-is-you.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/security/source-text';
import { moveSelf } from '@/lib/onboarding/couple-handoff';
import { WEDDING_SELF_SIDES, weddingNamesReady, weddingSelfSide } from '@/lib/onboarding/wedding-cards';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const SHELL = 'app/onboarding/wedding/_components/onboarding-shell.tsx';
const CARDS = 'app/onboarding/wedding/_components/wedding-cards.tsx';

const EMPTY = { brideFirstName: '', brideLastName: '', groomFirstName: '', groomLastName: '' };
const ME = 'Ice Casasola';

test('🔑 the names card cannot be passed without a pick — names alone are not enough', () => {
  const both = { brideFirstName: 'Maria', groomFirstName: 'Juan' };
  assert.equal(weddingNamesReady({ role: null, ...both }), false, 'no pick → no Continue');
  assert.equal(weddingNamesReady({ role: 'helper', ...both }), false, 'a helper (an old draft) has not answered it');
  assert.equal(weddingNamesReady({ role: 'bride', ...both }), true);
  assert.equal(weddingNamesReady({ role: 'groom', ...both }), true);
  assert.equal(weddingNamesReady({ role: 'bride', brideFirstName: 'Maria', groomFirstName: ' ' }), false, 'both first names');
  // …and the shell's Continue for w_names is THAT rule, not a copy of it.
  assert.match(read(SHELL), /case 'w_names':\s*return weddingNamesReady\(state\);/);
});

test('exactly the two of the couple — no third option, in the role screen’s own words', () => {
  assert.deepEqual(WEDDING_SELF_SIDES.map((o) => o.key), ['bride', 'groom']);
  assert.deepEqual(WEDDING_SELF_SIDES.map((o) => o.label), ['Bride', 'Groom']);
  assert.equal(weddingSelfSide('helper'), null);
  assert.equal(weddingSelfSide(null), null);
  const cards = read(CARDS);
  // ONE dropdown, fed from the two rows only, and it writes through the shell's selectRole.
  assert.match(cards, /options=\{WEDDING_SELF_SIDES\.map\(/);
  assert.match(cards, /dataAttr="data-wedding-self"/);
  assert.match(cards, /if \(next\) pickSelf\(next\);/);
  assert.ok(!/Someone helping|'helper'/.test(cards), 'the names card never offers a helper');
  // The pick is the existing `role` — the shell hands the card selectRole, and the commit carries s.role.
  const shell = read(SHELL);
  assert.match(shell, /pickSelf=\{selectRole\}/);
  assert.match(shell, /role: s\.role,/);
});

test('🔑 your account name fills YOUR row; the partner’s row stays empty', () => {
  assert.deepEqual(moveSelf(null, 'bride', ME, EMPTY), { brideFirstName: 'Ice', brideLastName: 'Casasola' });
  assert.deepEqual(moveSelf(null, 'groom', ME, EMPTY), { groomFirstName: 'Ice', groomLastName: 'Casasola' });
  for (const side of ['bride', 'groom'] as const) {
    const out = moveSelf(null, side, ME, EMPTY);
    const partner = side === 'bride' ? 'groom' : 'bride';
    assert.equal(out[`${partner}FirstName`], undefined, `${side}: the partner's first name is never filled`);
    assert.equal(out[`${partner}LastName`], undefined, `${side}: the partner's last name is never filled`);
  }
  assert.deepEqual(moveSelf(null, 'bride', 'ice@example.com', EMPTY), {}, 'never an email as a name');
  assert.deepEqual(moveSelf(null, 'bride', null, EMPTY), {});
  assert.deepEqual(moveSelf(null, 'bride', 'Ice', EMPTY), { brideFirstName: 'Ice' }, 'one word → first name only');
});

test('🔑 a re-pick MOVES the untouched prefill — typed text is never overwritten or cleared', () => {
  const asBride = { ...EMPTY, brideFirstName: 'Ice', brideLastName: 'Casasola' };
  // untouched prefill moves across
  assert.deepEqual(moveSelf('bride', 'groom', ME, asBride), {
    brideFirstName: '',
    brideLastName: '',
    groomFirstName: 'Ice',
    groomLastName: 'Casasola',
  });
  // an edited prefill is typed text: it stays where it is
  assert.deepEqual(moveSelf('bride', 'groom', ME, { ...asBride, brideFirstName: 'Icee' }), {
    brideLastName: '',
    groomFirstName: 'Ice',
    groomLastName: 'Casasola',
  });
  // the new own row was typed in: it is never overwritten (the prefill only leaves the partner row)
  assert.deepEqual(moveSelf('bride', 'groom', ME, { ...asBride, groomFirstName: 'Juan', groomLastName: 'Reyes' }), {
    brideFirstName: '',
    brideLastName: '',
  });
  // picking the same side again changes nothing typed
  assert.deepEqual(moveSelf('bride', 'bride', ME, { ...asBride, brideFirstName: 'Maria' }), {});
});

test('the shell seats through moveSelf — a carried couple still wins', () => {
  assert.match(
    read(SHELL),
    /coupleCarry\.current \? seatCouple\(r, coupleCarry\.current, s\) : moveSelf\(s\.role, r, selfName, s\)/,
  );
});
