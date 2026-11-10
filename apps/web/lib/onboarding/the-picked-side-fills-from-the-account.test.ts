/**
 * 🪪 "WHICH ONE IS YOU?" FILLS THE SIDE YOU PICKED — FROM THE ACCOUNT, EVEN WHEN IT WAS ALREADY PICKED.
 *
 * Owner, 10 Nov (Build 5 Lane P, Step 0 row 33), on his phone, verbatim: *"It asked me who i am and it
 * did not fill it up."* — the wedding's names step read "Which one is you? = Groom" and the GROOM · YOU
 * boxes were empty, although the account has a name.
 *
 * Two holes, both closed through the ONE seat path (`seatSelf` / `moveSelf`, `lib/onboarding/couple-handoff.ts`),
 * never a second prefill:
 *   1. the seat ran only at the moment of a pick — a resumed draft (or a role carried from the old role
 *      screen) arrived with the side already chosen, so nothing ever filled it. The shell now seats once
 *      on arrival, after the draft is read;
 *   2. it read only `display_name` and split it on the first space — the account's formal first + last
 *      (`users.first_name` / `last_name`) are now preferred, taken as written ("Maria Clara" stays one
 *      first name).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moveSelf, seatSelf, splitSelfName } from '@/lib/onboarding/couple-handoff';

const web = process.cwd();
const read = (p: string) => readFileSync(join(web, p), 'utf8');
const empty = { brideFirstName: '', groomFirstName: '', brideLastName: '', groomLastName: '' };

test('the formal first + last are taken as written — never split on the first space', () => {
  assert.deepEqual(splitSelfName({ first: 'Maria Clara', last: 'dela Cruz', display: 'Mara' }), {
    first: 'Maria Clara',
    last: 'dela Cruz',
  });
  // No formal first name → the display name, as before.
  assert.deepEqual(splitSelfName({ first: null, last: 'Casasola', display: 'Ice Casasola' }), { first: 'Ice', last: 'Casasola' });
  assert.equal(splitSelfName({ first: null, last: null, display: null }), null);
  assert.equal(splitSelfName({ first: null, last: null, display: 'ice@example.com' }), null, 'never an email as a name');
  // The one-string form is unchanged.
  assert.deepEqual(splitSelfName('Indalecio Casasola'), { first: 'Indalecio', last: 'Casasola' });
});

test('the picked side fills, the partner never does, and a re-pick moves only the untouched prefill', () => {
  const me = { first: 'Indalecio', last: 'Casasola', display: 'Ice' };
  assert.deepEqual(seatSelf('groom', me, empty), { groomFirstName: 'Indalecio', groomLastName: 'Casasola' });
  const seated = { ...empty, groomFirstName: 'Indalecio', groomLastName: 'Casasola' };
  assert.deepEqual(moveSelf('groom', 'bride', me, seated), {
    groomFirstName: '',
    groomLastName: '',
    brideFirstName: 'Indalecio',
    brideLastName: 'Casasola',
  });
  assert.deepEqual(seatSelf('groom', me, { ...empty, groomFirstName: 'Ice' }), { groomLastName: 'Casasola' }, 'typed text is never overwritten');
});

test('the wedding shell seats the side ALREADY picked once the draft is read (not only on a pick)', () => {
  const shell = read('app/onboarding/wedding/_components/onboarding-shell.tsx');
  const at = shell.indexOf('const seatedOnArrival = useRef(false);');
  assert.ok(at > 0, 'the shell keeps a once-only seat on arrival');
  const effect = shell.slice(at, shell.indexOf('const selectRole = ', at));
  assert.match(effect, /if \(!hydrated \|\| seatedOnArrival\.current\) return;/, 'it waits for the draft, and runs once');
  assert.match(effect, /seatSelf\(s\.role \?\? '', selfName, s\)/, 'through the ONE seat (seatSelf), on the role already in state');
  assert.match(effect, /seatCouple\(/, 'a carried couple still wins');
});

test('the wedding page hands the shell the formal first + last when the account has them', () => {
  const page = read('app/onboarding/wedding/page.tsx');
  assert.match(page, /const \{ religion, displayName, firstName, lastName \} = await getSelfPersonalization\(\);/);
  assert.match(page, /selfName = firstName \? \{ first: firstName, last: lastName, display: displayName \} : displayName;/);
  const reader = read('lib/self-personalization.ts');
  assert.match(reader, /\.select\('religion, civil_status, birth_date, sex, display_name, first_name, last_name'\)/);
});
