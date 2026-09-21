/**
 * The grouped "Profile & settings" page splits what was ONE personal-info form
 * across four groups. Each of those forms posts to the same action, which used
 * to write every column on every save — so a Guest-details save would have
 * wiped the display name, and a Profile save would have withdrawn the consent
 * for religion and dietary needs. These tests execute the field-selection rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { planPersonalInfoPatch, PRESENCE_MARKERS } from './profile-personal-info-patch';
import { FORMAL_NAME_FIELDS } from './formal-name';

const NOW = '2026-09-21T00:00:00.000Z';

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

function patchOf(entries: Record<string, string>, existing: Parameters<typeof planPersonalInfoPatch>[1] = null) {
  const plan = planPersonalInfoPatch(form(entries), existing, NOW);
  assert.ok(plan.ok, 'expected a plan, got a refusal');
  return plan.patch;
}

/** Exactly what the Profile group's form posts. */
const PROFILE_FORM = {
  tab: 'profile',
  display_name: 'Ice Casasola',
  name_prefix: 'Mr.',
  first_name: 'Indalecio',
  middle_name: 'Sacdalan',
  last_name: 'Casasola',
  name_suffix: 'II',
  phone: '+63 917',
  [PRESENCE_MARKERS.profile_photo_url]: '1',
  profile_photo_url: 'r2://media/profile-photo/u/a.webp',
  birth_date: '1986-12-16',
};

/** Exactly what the Guest-details group's form posts. */
const GUEST_FORM = {
  tab: 'guest-details',
  meal_preference: '',
  dietary_restrictions: 'nut allergy',
  civil_status: '',
  religion: 'catholic',
  sex: '',
};

const GUEST_COLUMNS = ['meal_preference', 'dietary_restrictions', 'civil_status', 'religion', 'sex'];
const PROFILE_COLUMNS = ['display_name', ...FORMAL_NAME_FIELDS, 'phone', 'profile_photo_url', 'birth_date'];

test('a Guest-details save does not touch the display name, the name parts, phone, photo or birthday', () => {
  const patch = patchOf(GUEST_FORM);
  for (const col of PROFILE_COLUMNS) {
    assert.equal(col in patch, false, `Guest-details save wrote ${col}`);
  }
  assert.equal('marketing_opt_in' in patch, false);
  assert.equal('public_greeting_opt_in' in patch, false);
  // …and does write what it carries.
  assert.equal(patch.dietary_restrictions, 'nut allergy');
  assert.equal(patch.religion, 'catholic');
  assert.equal(patch.meal_preference, null);
});

test('a Profile save does not touch meal, dietary, religion, civil status, gender — or their consents', () => {
  const patch = patchOf(PROFILE_FORM, {
    religion: 'catholic',
    dietary_restrictions: 'halal',
    civil_status: 'married',
    sex: 'male',
  });
  for (const col of GUEST_COLUMNS) {
    assert.equal(col in patch, false, `Profile save wrote ${col}`);
  }
  for (const col of Object.keys(patch)) {
    assert.ok(!col.endsWith('_consent_at'), `Profile save moved a consent stamp: ${col}`);
  }
  assert.equal(patch.display_name, 'Ice Casasola');
  assert.equal(patch.first_name, 'Indalecio');
  assert.equal(patch.birth_date, '1986-12-16');
});

test('unchecked marketing on the Preferences switch form sets false and clears the consent stamp', () => {
  const patch = patchOf(
    { tab: 'preferences', [PRESENCE_MARKERS.marketing_opt_in]: '1' },
    { marketing_opt_in: true },
  );
  assert.equal(patch.marketing_opt_in, false);
  assert.equal(patch.marketing_consent_at, null);
  // A marketing switch is not a profile save.
  for (const col of [...PROFILE_COLUMNS, ...GUEST_COLUMNS]) assert.equal(col in patch, false);
});

test('checked marketing stamps consent only on the transition', () => {
  const first = patchOf({ [PRESENCE_MARKERS.marketing_opt_in]: '1', marketing_opt_in: 'on' }, { marketing_opt_in: false });
  assert.equal(first.marketing_opt_in, true);
  assert.equal(first.marketing_consent_at, NOW);
  const again = patchOf({ [PRESENCE_MARKERS.marketing_opt_in]: '1', marketing_opt_in: 'on' }, { marketing_opt_in: true });
  assert.equal('marketing_consent_at' in again, false, 'an unchanged opt-in must keep its original stamp');
});

test('marketing absent from the Profile form leaves it untouched', () => {
  const patch = patchOf(PROFILE_FORM, { marketing_opt_in: true });
  assert.equal('marketing_opt_in' in patch, false);
  assert.equal('marketing_consent_at' in patch, false);
});

test('the greeting switch: marker + no value = off; no marker = untouched', () => {
  assert.equal(patchOf({ [PRESENCE_MARKERS.public_greeting_opt_in]: '1' }).public_greeting_opt_in, false);
  assert.equal(
    patchOf({ [PRESENCE_MARKERS.public_greeting_opt_in]: '1', public_greeting_opt_in: 'on' }).public_greeting_opt_in,
    true,
  );
  assert.equal('public_greeting_opt_in' in patchOf(PROFILE_FORM), false);
});

test('a cleared photo on the Profile form nulls it; a form without the photo leaves it alone', () => {
  const { profile_photo_url: _drop, ...cleared } = PROFILE_FORM;
  assert.equal(patchOf(cleared).profile_photo_url, null);
  assert.equal('profile_photo_url' in patchOf(GUEST_FORM), false);
});

test('Guest details keeps the RA 10173 consent transitions for what it posts', () => {
  const patch = patchOf(GUEST_FORM, { religion: null, dietary_restrictions: 'halal', civil_status: 'married' });
  assert.equal(patch.religion_consent_at, NOW, 'first religion value must stamp consent');
  assert.equal('dietary_restrictions_consent_at' in patch, false, 'a changed-but-present value keeps its stamp');
  assert.equal(patch.civil_status_consent_at, null, 'withdrawing civil status must clear its consent');
});

test('a malformed birthday is refused, not half-saved', () => {
  const plan = planPersonalInfoPatch(form({ ...PROFILE_FORM, birth_date: '16/12/1986' }), null, NOW);
  assert.equal(plan.ok, false);
});
