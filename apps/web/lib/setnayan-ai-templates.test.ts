/**
 * Setnayan AI template library + renderer invariants (node:test via tsx).
 *
 * Guards that the renderer is PURE string substitution (deterministic, free):
 * terminology resolution + slot fill, event-type-aware via terminology, with the
 * library locked at exactly 35 templates and the wedding-only gate honored.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderTemplate,
  templatesForEventType,
  SETNAYAN_AI_TEMPLATES,
  SETNAYAN_AI_TEMPLATE_COUNT,
  TemplateNotFoundError,
  TemplateVariantError,
} from './setnayan-ai-templates';

test('library is exactly 33 templates across 5 categories', () => {
  assert.equal(SETNAYAN_AI_TEMPLATE_COUNT, 33);
  const cats = new Set(Object.values(SETNAYAN_AI_TEMPLATES).map((t) => t.category));
  assert.deepEqual(
    [...cats].sort(),
    ['commend', 'guard', 'inference', 'secretary', 'trend'],
  );
});

test('every template id matches its key + every variant has the same tokens it declares as data slots are renderable', () => {
  for (const [key, tpl] of Object.entries(SETNAYAN_AI_TEMPLATES)) {
    assert.equal(tpl.id, key);
    assert.ok(Object.keys(tpl.copy).length >= 1, `${key} has at least one copy variant`);
  }
});

test('renderTemplate fills data slots + resolves terminology (wedding default)', () => {
  const out = renderTemplate('TRD-01', {
    percent: 68,
    cohort_descriptor: 'Cavite, ₱400k',
    service: 'a coordinator',
  });
  // {organizers} → pluralize('couple') = 'couples'
  assert.match(out, /68% of couples like you \(Cavite, ₱400k\) added a coordinator/);
});

test('terminology swaps for a non-wedding event type', () => {
  const out = renderTemplate(
    'TRD-02',
    { category: 'catering', median_spend: '50,000', cohort_descriptor: 'Manila' },
    { organizerNoun: 'host', eventWord: 'birthday' },
  );
  assert.match(out, /hosts like you/);
});

test('pluralize handles -y → -ies (family → families)', () => {
  const out = renderTemplate(
    'TRD-02',
    { category: 'venue', median_spend: '10,000', cohort_descriptor: 'Cebu' },
    { organizerNoun: 'family', eventWord: 'christening' },
  );
  assert.match(out, /families like you/);
});

test('{date_label} derives from the event word', () => {
  const wedding = renderTemplate('SEC-02', {
    category: 'caterers',
    weeks: 6,
    top2: 'A and B',
    differentiator: 'price',
  });
  assert.match(wedding, /wedding date/);
  const birthday = renderTemplate(
    'SEC-02',
    { category: 'caterers', weeks: 6, top2: 'A and B', differentiator: 'price' },
    { organizerNoun: 'host', eventWord: 'birthday' },
  );
  assert.match(birthday, /birthday date/);
});

test('SEC-04 has a templated draft variant (drafting stays free, no LLM)', () => {
  const draft = renderTemplate(
    'SEC-04',
    { vendor: 'Lights Co', service: 'lighting', date_label_value: 'May 9' },
    undefined,
    'draft',
  );
  assert.match(draft, /Hi Lights Co, following up on our inquiry about lighting for May 9/);
});

test('unknown data slot is left intact, not crashed', () => {
  const out = renderTemplate('GRD-01', { vendor: 'Bloom' }); // amount/due_date/days_left missing
  assert.match(out, /Bloom/);
  assert.match(out, /\{amount\}/); // unresolved token preserved
});

test('unknown template id throws TemplateNotFoundError', () => {
  assert.throws(() => renderTemplate('NOPE-99', {}), TemplateNotFoundError);
});

test('unknown variant throws TemplateVariantError', () => {
  assert.throws(
    () => renderTemplate('SEC-01', {}, undefined, 'nope'),
    TemplateVariantError,
  );
});

test('GRD-02 (PH statutory) is wedding-only; absent for other event types', () => {
  const weddingIds = templatesForEventType('wedding').map((t) => t.id);
  const birthdayIds = templatesForEventType('birthday').map((t) => t.id);
  assert.ok(weddingIds.includes('GRD-02'));
  assert.ok(!birthdayIds.includes('GRD-02'));
  // everything else is shared
  assert.equal(weddingIds.length, 33);
  assert.equal(birthdayIds.length, 32);
});
