/**
 * solemn-onboarding.test.ts — the wake is never asked to celebrate.
 *
 * Guards the four things that, if any one of them slips, put "Joyful & lively —
 * music, dancing, and a packed floor" or a persona card reading "The Grand
 * Celebration" in front of a family arranging a funeral:
 *
 *   1. The solemn axes carry the SAME ids + option keys as the celebratory ones
 *      (resolvePersona is a pure lookup over those keys — a renamed key resolves
 *      every solemn answer to NO persona, silently).
 *   2. No celebratory vocabulary survives anywhere in the solemn copy.
 *   3. The register reaches the resolver on EVERY path, including the two where
 *      the DB read fails — which is the whole reason the copy is in code.
 *   4. The sixteen celebratory types are byte-identical. The frozen literals
 *      below are NEVER edited to match a change; if one fails, the change is
 *      wrong.
 *
 * 🔑 The `adds` check is the one that catches a QUESTION BECOMING DECORATION:
 * the shell intersects each option's `adds` against the type's real taxonomy
 * tiles, so a slug outside the funeral's eight categories is dropped in silence
 * and the answer shapes nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { EXP_AXES, EXP_PERSONAS } from '@/app/onboarding/wedding/_data/experience-personas';
import { GENERIC_EXP_AXES, GENERIC_PERSONA_REVEAL } from './generic-content';
import { SOLEMN_EXP_AXES, SOLEMN_PERSONA_REVEAL } from './solemn-content';
import { resolveOnboardingSpec } from './onboarding-spec';
import { PER_TYPE_QUESTIONS } from './type-questions';
import { PERSONA_PACKS } from './persona-packs';
import { getSpecialtyFields } from './specialty-catalog';
import { resolveOnboardingFlow } from './flow-config';
import { FUNERAL_PROFILE } from '@/lib/event-type-profile';

/** The EIGHT service categories a funeral can actually reach — the seven scoped
 *  by migration 20271163083797 plus the universal `livestream`. Read out of the
 *  live taxonomy, not remembered. An `adds` id outside this set is dropped by
 *  the shell's intersection and the question means nothing. */
const FUNERAL_CATEGORIES = new Set([
  'catering', 'choir', 'coordinator', 'florist',
  'guest_shuttle', 'photo_video', 'printing', 'livestream',
]);

/**
 * Words that must never appear in anything a bereaved family is shown.
 *
 * 🪤 EVERY ONE IS ANCHORED WITH \b, AND THAT IS NOT TIDINESS. The first cut of
 * this list matched by substring and went red on the option titled "A funeral
 * Mass" — because "funeral" contains "fun". A substring word list reports the
 * word it was written to protect. `celebrat` keeps a deliberate open tail so it
 * catches celebrate / celebration / celebratory in one entry; the \b is on the
 * FRONT, where the false positive was.
 */
const CELEBRATORY = [
  /\bcelebrat/, /\bpart(y|ies)\b/, /\bunforgettable\b/, /\bwow\b/,
  /\bthe more the merrier\b/, /\bdanc(e|ing)\b/, /\bgo all out\b/,
  /\bfun\b/, /\bglam\b/, /\bmerry\b/, /\bfestive\b/,
];

function offendingWords(text: string): string[] {
  const lower = text.toLowerCase();
  return CELEBRATORY.filter((re) => re.test(lower)).map((re) => re.source);
}

// ---- 1. the keys are locked --------------------------------------------------

test('solemn axes mirror the wedding axis ids + option keys exactly', () => {
  assert.equal(SOLEMN_EXP_AXES.length, EXP_AXES.length);
  for (let i = 0; i < EXP_AXES.length; i++) {
    const w = EXP_AXES[i]!;
    const s = SOLEMN_EXP_AXES[i]!;
    assert.equal(s.id, w.id, `axis ${i} id`);
    assert.deepEqual(
      s.options.map((o) => o.key),
      w.options.map((o) => o.key),
      `axis ${w.id} option keys`,
    );
  }
});

test('every resolvable persona has solemn reveal copy, and a legal palette feel', () => {
  // 'timeless' is one of the 8 values events.mood_feel_key's CHECK admits — a
  // value outside it is refused at the commit, after the family has answered.
  for (const p of EXP_PERSONAS) {
    const r = SOLEMN_PERSONA_REVEAL[p.key];
    assert.ok(r, `missing solemn reveal for ${p.key}`);
    assert.ok(r.name.length > 0 && r.tagline.length > 0);
    assert.equal(r.feel, 'timeless', `${p.key}: a wake gets one dignified palette`);
  }
  assert.deepEqual(
    Object.keys(SOLEMN_PERSONA_REVEAL).sort(),
    Object.keys(GENERIC_PERSONA_REVEAL).sort(),
    'a persona missing here falls through to "The Grand Celebration"',
  );
});

// ---- 2. no celebratory word survives ----------------------------------------

test('no celebratory vocabulary anywhere in the solemn quiz or reveal', () => {
  let checked = 0;
  for (const axis of SOLEMN_EXP_AXES) {
    for (const text of [axis.eyebrow, axis.question]) {
      checked++;
      assert.deepEqual(offendingWords(text), [], `axis ${axis.id}: "${text}"`);
    }
    for (const o of axis.options) {
      for (const text of [o.title, o.desc]) {
        checked++;
        assert.deepEqual(offendingWords(text), [], `axis ${axis.id}/${o.key}: "${text}"`);
      }
    }
  }
  for (const [k, r] of Object.entries(SOLEMN_PERSONA_REVEAL)) {
    for (const text of [r.name, r.tagline]) {
      checked++;
      assert.deepEqual(offendingWords(text), [], `reveal ${k}: "${text}"`);
    }
  }
  for (const q of PER_TYPE_QUESTIONS.funeral ?? []) {
    for (const text of [q.eyebrow, q.question]) {
      checked++;
      assert.deepEqual(offendingWords(text), [], `question ${q.id}: "${text}"`);
    }
    for (const o of q.options) {
      for (const text of [o.title, o.desc]) {
        checked++;
        assert.deepEqual(offendingWords(text), [], `question ${q.id}/${o.key}: "${text}"`);
      }
    }
  }
  for (const f of getSpecialtyFields('funeral')) {
    for (const text of [f.label, f.help ?? '']) {
      checked++;
      assert.deepEqual(offendingWords(text), [], `field ${f.key}: "${text}"`);
    }
  }
  // ANTI-EMPTY-SWEEP FLOOR: if the copy is deleted or renamed away, this test
  // would pass while checking nothing. 60 is well below the ~110 real strings.
  assert.ok(checked >= 60, `only ${checked} strings checked — the sweep found nothing to sweep`);
});

test('the CELEBRATORY copy still says the celebratory words (the check can fire)', () => {
  // Proves the word list above actually matches: the generic axes must offend it.
  const generic = GENERIC_EXP_AXES.flatMap((a) => [
    a.question,
    ...a.options.flatMap((o) => [o.title, o.desc]),
  ]);
  const hits = generic.filter((t) => offendingWords(t).length > 0).length;
  assert.ok(hits >= 3, `expected the celebratory copy to trip the word list, got ${hits}`);
});

// ---- 3. the register reaches the resolver on every path ---------------------

test('a solemn register swaps the BASE quiz + reveal, before any override', () => {
  const solemn = resolveOnboardingSpec('funeral', 'funeral', null, 'solemn');
  assert.equal(solemn.register, 'solemn');
  assert.equal(solemn.axes[2]!.options[1]!.title, 'Warm, and full of stories');
  assert.equal(solemn.revealByPersona.big_celebration!.name, 'The Wide Circle');

  // The degrade path — a failed/absent override row — must stay solemn. This is
  // the case an admin `axis_overrides` row could not have covered.
  const noRow = resolveOnboardingSpec('funeral', 'funeral', null, 'solemn');
  assert.equal(noRow.revealByPersona.big_celebration!.name, 'The Wide Circle');
});

test('an admin override still layers ON TOP of the solemn base', () => {
  const spec = resolveOnboardingSpec('funeral', 'funeral', {
    intro: null,
    questions: null,
    persona_pack: null,
    reveal_overrides: { big_celebration: { name: 'Many Will Come' } },
    axis_overrides: { feel: { question: 'How many are you expecting?' } },
  }, 'solemn');
  assert.equal(spec.revealByPersona.big_celebration!.name, 'Many Will Come');
  // the un-overridden half is still solemn, not celebratory
  assert.equal(spec.revealByPersona.keepsake!.name, 'Something to Keep');
  assert.equal(spec.axes[1]!.question, 'How many are you expecting?');
  assert.equal(spec.axes[2]!.options[1]!.title, 'Warm, and full of stories');
});

test('the generic onboarding page passes the register — it is not defaulted away', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'app/onboarding/[type]/page.tsx'),
    'utf8',
  );
  assert.match(
    src,
    /getOnboardingSpec\(\s*type,\s*flow\.personaPackKey,\s*profile\.terminology\.register,?\s*\)/,
    'the page must hand the register down, or every solemn word is unreachable',
  );
});

test('the closing screen has a solemn arm, and the celebratory arm is unchanged', () => {
  const src = readFileSync(
    path.join(process.cwd(), 'app/onboarding/[type]/_components/generic-onboarding.tsx'),
    'utf8',
  );
  assert.match(src, /const solemn = register === 'solemn';/);
  assert.match(src, /solemn \? '🕊️' : '✨'/);
  // FROZEN LITERAL — the sixteen celebratory types must close exactly as before.
  assert.ok(
    src.includes("We’ll set up your dashboard${authed ? '' : ' — no account needed to start'}."),
    'the celebratory closing line changed — that is a regression, not an update',
  );
});

// ---- 4. the funeral's own content is reachable and means something ----------

test('the funeral resolves its OWN pack key, with or without the migration', () => {
  // NULL onboarding_flow_key (prod today, pre-migration) must still reach the
  // funeral's pack — this is the half that does not depend on a db push.
  const flow = resolveOnboardingFlow({ ...FUNERAL_PROFILE, onboardingFlowKey: null });
  assert.equal(flow.personaPackKey, 'funeral');
  assert.ok(PER_TYPE_QUESTIONS.funeral, 'the funeral has no questions');
  assert.ok(PERSONA_PACKS.funeral, 'the funeral has no starter plan');

  const spec = resolveOnboardingSpec('funeral', flow.personaPackKey, null, 'solemn');
  assert.equal(spec.questions.length, 3);
  assert.ok(spec.personaPack, 'the pack must resolve through the same key the page uses');
});

test('every funeral answer adds a category the funeral can actually reach', () => {
  let addsSeen = 0;
  for (const q of PER_TYPE_QUESTIONS.funeral ?? []) {
    for (const o of q.options) {
      for (const id of o.adds) {
        addsSeen++;
        assert.ok(
          FUNERAL_CATEGORIES.has(id),
          `${q.id}/${o.key} adds "${id}", which a funeral cannot reach — the shell drops it silently`,
        );
      }
    }
  }
  assert.ok(addsSeen >= 8, `only ${addsSeen} adds — the questions shape nothing`);
});

test('the funeral starter plan stays inside the eight categories', () => {
  const pack = PERSONA_PACKS.funeral!;
  for (const id of pack.essentials) {
    assert.ok(FUNERAL_CATEGORIES.has(id), `essential "${id}" is out of the funeral's reach`);
  }
  for (const [persona, extras] of Object.entries(pack.byPersona)) {
    for (const id of extras) {
      assert.ok(FUNERAL_CATEGORIES.has(id), `${persona} extra "${id}" is out of reach`);
    }
  }
  // "no marketing upsells" (the solemn register's own rule): no paid camera rung
  // in a bereaved family's starter plan. Papic is already granted free.
  for (const [persona, svcs] of Object.entries(pack.servicesByPersona)) {
    for (const s of svcs) {
      assert.ok(!s.startsWith('papic'), `${persona} offers "${s}" — a wake is not upsold`);
    }
  }
});

test('the funeral detail screen asks by name for the things a wake has', () => {
  const keys = getSpecialtyFields('funeral').map((f) => f.key);
  for (const k of ['departed_name', 'wake_place', 'pasiyam_start', 'resting_place', 'eulogists']) {
    assert.ok(keys.includes(k), `the funeral detail screen is missing ${k}`);
  }
  // Rosters are never hard-capped (catalog rule 1) — a wake is held up by many.
  for (const f of getSpecialtyFields('funeral')) {
    if (f.type === 'person_roster') {
      assert.ok(f.item_fields && f.item_fields.length > 0, `${f.key} roster has no item fields`);
    }
  }
});
