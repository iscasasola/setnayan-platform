/**
 * "I am 18 or older" is the enabler. Being known to be under 18 is a refusal
 * the tickbox cannot override. (Owner, 2026-08-05.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ageOnDate, isKnownMinorGuest, FACE_ENROLMENT_MIN_AGE } from './face-enrolment-age';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const ON = new Date('2026-08-05T00:00:00.000Z');

/** Stub of the chained builder, returning a different row per table. */
function stub(rows: Record<string, unknown>) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
      };
      return chain;
    },
  } as never;
}

test('age is counted in whole years, and the birthday matters', () => {
  assert.equal(ageOnDate('2008-08-05', ON), 18, 'eighteen today');
  assert.equal(ageOnDate('2008-08-06', ON), 17, 'eighteen tomorrow is still seventeen');
  assert.equal(ageOnDate('2008-08-04', ON), 18);
  assert.equal(ageOnDate('2010-01-01', ON), 16);
});

test('age does not shift with the reader’s timezone', () => {
  // A birth date is a DATE. Reading it as a moment is what makes a day slip
  // west of Greenwich — and here a slipped day can flip 17 into 18.
  const before = process.env.TZ;
  for (const tz of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
    process.env.TZ = tz;
    assert.equal(ageOnDate('2008-08-06', ON), 17, `wrong under TZ=${tz}`);
  }
  process.env.TZ = before;
});

test('an unreadable birth date is not an age', () => {
  assert.equal(ageOnDate('', ON), null);
  assert.equal(ageOnDate('not a date', ON), null);
});

test('a guest we KNOW is 17 is refused', async () => {
  const known = await isKnownMinorGuest(
    stub({ guests: { person_id: 'p1' }, people: { birth_date: '2010-01-01' } }),
    'e1',
    'g1',
    ON,
  );
  assert.equal(known, true);
});

test('a guest we know is 18 is not refused', async () => {
  const known = await isKnownMinorGuest(
    stub({ guests: { person_id: 'p1' }, people: { birth_date: '2008-08-05' } }),
    'e1',
    'g1',
    ON,
  );
  assert.equal(known, false);
});

test('“we do not know” is not “they are a child”', async () => {
  // Most guests have no person link and no birth date. For them the attestation
  // is the whole gate — the owner's stated model. This function must not
  // pretend to more knowledge than it has.
  for (const rows of [
    { guests: { person_id: null } },
    { guests: { person_id: 'p1' }, people: { birth_date: null } },
    {}, // no guest row at all
  ]) {
    assert.equal(await isKnownMinorGuest(stub(rows), 'e1', 'g1', ON), false);
  }
});

test('the minimum age is 18, not a softer number', () => {
  assert.equal(FACE_ENROLMENT_MIN_AGE, 18);
});

test('THE enrolment writer applies the refusal — and the RSVP is no longer a writer at all', () => {
  // Since 2026-09-30 (owner: the question at RSVP, the selfie on the day) the
  // day-of catch is the ONLY path that stores a face. The RSVP writer is gone,
  // so a guard on "both" would be a guard on a file that no longer enrols.
  const code = strip(read('..', 'app', 'papic', 'face-enroll-actions.ts'));
  assert.match(code, /isKnownMinorGuest\(/, 'day-of / custom QR writer does not check');
  const rsvp = strip(read('..', 'app', '[slug]', 'actions.ts'));
  assert.doesNotMatch(
    rsvp,
    /from\('guest_face_enrollments'\)\s*\.insert\(/,
    'the RSVP enrols a face again — the minor refusal would have to follow it back',
  );
});

test('the refusal is ANDed with the attestation, never instead of it', () => {
  const code = strip(read('..', 'app', 'papic', 'face-enroll-actions.ts'));
  assert.match(
    code,
    /if \(!selfieRef \|\| !consent \|\| !ageAffirmed\) return \{ ok: false \};/,
    'consent and the 18+ tick must both still apply',
  );
  assert.match(code, /guestRow\.face_recognition_excluded === true/, 'the host exclusion must still apply');
  assert.match(code, /if \(await isKnownMinorGuest\(admin, eventId, guestId\)\)/, 'the known-minor refusal must still apply');
});
