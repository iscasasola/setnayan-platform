/**
 * asked-once.test.ts — a birthday asks the celebrant's name once (owner 2026-10-22, "Yes to all": Host 6, prototype
 * `journey_fixes_2026-10-22.html`; the 1 Oct ruling "ask every fact once").
 *
 * The property: a specialty field whose answer the honoree screen already holds is SHOWN with Change, never drawn as
 * a box to fill again — and the birthday's Event name example is its own, never the hangout's.
 *
 * Comments stripped before matching (`lib/strip-comments.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BIRTHDAY_NAME_EXAMPLE, eventNameExample, specialtyAskedElsewhere } from './asked-once';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

// SABOTAGE: drop the `v === input.derived[k]` comparison → RED (a typed, different name would be hidden).
test('the celebrant is shown, not asked, exactly when it is the honoree screen’s answer', () => {
  const derived = { celebrant_name: 'Lola Rosa', celebrant_age: 80 };
  const base = { derived, hasHonoreeScreen: true };
  assert.deepEqual(specialtyAskedElsewhere({ ...base, values: { celebrant_name: 'Lola Rosa' } }), ['celebrant_name']);
  assert.deepEqual(
    specialtyAskedElsewhere({ ...base, values: { celebrant_name: 'Nina' } }),
    [],
    'a name the person typed differently keeps its own field — never hide somebody’s answer behind a chip',
  );
  assert.deepEqual(specialtyAskedElsewhere({ ...base, values: {} }), [], 'nothing held → the field asks');
  assert.deepEqual(specialtyAskedElsewhere({ ...base, values: { celebrant_name: '  ' }, derived: { celebrant_name: '  ' } }), []);
  assert.deepEqual(
    specialtyAskedElsewhere({ ...base, values: { celebrant_name: 'Lola Rosa' }, hasHonoreeScreen: false }),
    [],
    'no honoree screen → nowhere for Change to go → the field stays',
  );
  assert.deepEqual(
    specialtyAskedElsewhere({ ...base, values: { celebrant_name: 'Lola Rosa', celebrant_age: 80 } }),
    ['celebrant_name'],
    'only the NAME moves; "Turning" stays a field, as drawn',
  );
});

// SABOTAGE: return 'Movie night sa bahay' for a birthday → RED.
test('a birthday’s Event name example is its own, from the name already given', () => {
  assert.equal(eventNameExample({ eventType: 'birthday', name: 'Lola Rosa', age: 80 }), 'Lola Rosa turns 80');
  assert.equal(eventNameExample({ eventType: 'birthday', name: 'Lola Rosa' }), 'Lola Rosa’s birthday');
  assert.equal(eventNameExample({ eventType: 'birthday' }), BIRTHDAY_NAME_EXAMPLE);
  assert.equal(BIRTHDAY_NAME_EXAMPLE, 'Lola Rosa turns 80');
  for (const t of ['hangout', 'wedding', 'wake', 'debut']) {
    assert.equal(eventNameExample({ eventType: t, name: 'X', age: 3 }), null, `${t} keeps its screen’s own line`);
  }
});

// SABOTAGE: drop `answered={askedElsewhere}` from the specialty screen → RED.
test('the wizard hands the specialty screen what is already answered, and Change goes back to where it is asked', () => {
  const wizard = read('app/onboarding/[type]/_components/generic-onboarding.tsx');
  assert.match(wizard, /answered=\{askedElsewhere\}/);
  assert.match(wizard, /onChangeAnswered=\{\(\) => \{[\s\S]{0,300}setStep\(Math\.max\(0, screens\.indexOf\('honoree'\)\)\)/);
  assert.match(wizard, /namePlaceholder=\{nameExample \?\? undefined\}/, 'the needs screen still borrows the hangout’s example');
});

// SABOTAGE: render <Field> for every key (drop the `shown.has` branch) → RED.
test('an answered field is drawn as the answer with Change — never as a box', () => {
  const fields = read('app/onboarding/[type]/_components/specialty-fields.tsx');
  const branch = fields.indexOf('shown.has(f.key) ? (');
  const field = fields.indexOf('<Field field={f}', branch);
  assert.ok(branch > 0 && field > branch, 'the answered branch must come before the input');
  const row = fields.slice(branch, field);
  assert.match(row, /data-specialty-answered=\{f\.key\}/);
  assert.match(row, />\s*Change\s*</);
  assert.doesNotMatch(row, /<input|<Field/, 'the answered row must not be a box to fill');
});
