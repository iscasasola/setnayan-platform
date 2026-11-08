/**
 * for-me-locks-the-celebrant.test.ts — "For · You" fills the celebrant with your own name and LOCKS it, on
 * every create path; your own name starts in YOUR slot only.
 *
 * Owner, 2026-11-08, verbatim: *"I log in as Ice Casasola's account, and then I go to create event for me. So
 * the celebrant will also autofill for me the name that I assign to myself. And if it's for me, it cannot be
 * edited out because it's a celebration for me, unless they pick someone else, which will give them the power to
 * create a name or connect it to a person."* — corpus `plans/autofill_and_self_prefill_2026-11-08/BUILD_BRIEF.md`.
 *
 * SABOTAGE (2026-11-08): adding `name="honoree_label"` to the lock's input turned "the lock posts nothing" RED;
 * restored → GREEN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { seatSelf } from '@/lib/onboarding/couple-handoff';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const stripComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const LOCK = 'app/_components/self-celebrant-lock.tsx';
const WIZARD = 'app/onboarding/[type]/_components/generic-onboarding.tsx';
const PICKER = 'app/dashboard/(account)/create-event/_components/event-type-picker.tsx';
const WEDDING = 'app/onboarding/wedding/_components/onboarding-shell.tsx';

test('the lock is read-only, says the one quiet line, and posts nothing', () => {
  const src = stripComments(read(LOCK));
  const input = /<input[\s\S]*?\/>/.exec(src)?.[0] ?? '';
  assert.ok(input, 'the lock must draw the celebrant FIELD, not a sentence');
  assert.match(input, /\breadOnly\b/, 'for you, the celebrant cannot be edited');
  assert.doesNotMatch(input, /\sname=/, 'a blank honoree IS the account holder — the lock must post nothing');
  assert.match(src, /'This event is for you'/);
  assert.match(src, /'Change who it’s for'/);
});

test('every create path that knows it is "for you" draws the lock — and only then', () => {
  const wizard = stripComments(read(WIZARD));
  assert.match(wizard, /\{knowsCelebrant \? \([\s\S]{0,300}?<SelfCelebrantLock/, 'the wizard’s celebrant screen');
  assert.match(wizard, /const knowsCelebrant = momentForSelf && !honoree && !blockedBy;/);
  // The way out is the For ▾ row, keeping where they were headed.
  assert.match(wizard, /changeHref=\{[\s\S]{0,160}?'\/dashboard\/create-event'/);

  const picker = stripComments(read(PICKER));
  assert.match(
    picker,
    /subject\?\.kind === 'self' && pickerAsksHonoree\(selected\.key, 'self'\) && !communityId \? \([\s\S]{0,80}?<SelfCelebrantLock/,
    'the grid’s inline form',
  );
  assert.match(picker, /onChange=\{openForMenu\}/, '"Change who it’s for" re-opens For ▾ on the same page');
  assert.match(picker, /querySelector<HTMLButtonElement>\('\[data-create-for\]'\)\?\.click\(\)/);
  // Someone else: the shipped, editable name-or-link field is untouched.
  assert.match(picker, /name="honoree_label"/);
  assert.match(picker, /name="honoree_dependent_id"/);
});

test('a wedding seats your own name in YOUR slot — never the partner’s', () => {
  const empty = { brideFirstName: '', groomFirstName: '', brideLastName: '', groomLastName: '' };
  assert.deepEqual(seatSelf('bride', 'Ice Casasola', empty), { brideFirstName: 'Ice', brideLastName: 'Casasola' });
  assert.deepEqual(seatSelf('groom', 'Ice Casasola', empty), { groomFirstName: 'Ice', groomLastName: 'Casasola' });
  assert.deepEqual(seatSelf('helper', 'Ice Casasola', empty), {}, 'a helper is not the couple');
  assert.deepEqual(seatSelf('bride', null, empty), {});
  assert.deepEqual(seatSelf('bride', 'ice@example.com', empty), {}, 'never an email as a name');
  assert.deepEqual(
    seatSelf('bride', 'Ice Casasola', { ...empty, brideFirstName: 'Maria' }),
    { brideLastName: 'Casasola' },
    'a name they typed is never overwritten',
  );
  const shell = stripComments(read(WEDDING));
  assert.match(
    shell,
    // moveSelf = seatSelf for a first pick, and moves an untouched prefill on a re-pick (w-names-asks-which-one-is-you).
    /coupleCarry\.current \? seatCouple\(r, coupleCarry\.current, s\) : moveSelf\(s\.role, r, selfName, s\)/,
    'a carried couple wins; otherwise only your own slot',
  );
  // The own slot offers the phone's saved name; the partner's stays off.
  assert.match(shell, /autoComplete=\{state\.role === 'bride' \? 'given-name' : 'off'\}/);
  assert.match(shell, /autoComplete=\{state\.role === 'groom' \? 'family-name' : 'off'\}/);
});
