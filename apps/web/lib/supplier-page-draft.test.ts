/**
 * YOUR PAGE — the draft and the ONE Apply (lib/supplier-page-draft.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changedParts,
  draftEntries,
  draftLine,
  parseStoredDraft,
  pruneDraft,
  sectionsOf,
  withDraft,
  type PageSaved,
} from './supplier-page-draft';

const saved: PageSaved = {
  about: 'Three halls on one hill.',
  services: ['venue'],
  sections: { portfolio: true, trusted_by: true, editorials: true },
  hero: '',
  accent: '',
  pin: '',
  stories: [],
};

test('a change undone is no change — nothing to apply', () => {
  const d = { about: ' Three halls on one hill. ', sections: { portfolio: true, trusted_by: true, editorials: true } };
  assert.deepEqual(pruneDraft(d, saved), {});
  assert.equal(draftLine(d, saved), null);
  assert.deepEqual(draftEntries(d, saved), []);
});

test('changed parts are listed in the order couples scroll, with their plain names', () => {
  const d = { accent: 'sage', about: 'New words.' };
  assert.deepEqual(changedParts(d, saved), ['about', 'accent']);
  assert.equal(draftLine(d, saved), '2 changes · About · Look');
});

test('ONE Apply carries every changed part: its field marker, then its own entries', () => {
  const d = {
    about: 'New words.',
    services: ['venue', 'catering'],
    sections: { portfolio: false, trusted_by: true, editorials: true },
    hero: 'k1',
  };
  assert.deepEqual(draftEntries(d, saved), [
    ['field', 'microsite_about'],
    ['microsite_about', 'New words.'],
    ['field', 'microsite_featured_services'],
    ['microsite_featured_services', 'venue'],
    ['microsite_featured_services', 'catering'],
    ['field', 'microsite_sections'],
    ['section_trusted_by', 'on'],
    ['section_editorials', 'on'],
    ['field', 'microsite_hero_photo'],
    ['microsite_hero_photo', 'k1'],
  ]);
});

test('clearing every featured service still sends the field — an empty pick is a change', () => {
  assert.deepEqual(draftEntries({ services: [] }, saved), [['field', 'microsite_featured_services']]);
});

test('the page shown while editing is the published page with the draft on top', () => {
  assert.equal(withDraft(saved, { accent: 'sage' }).accent, 'sage');
  assert.equal(withDraft(saved, { accent: 'sage' }).about, saved.about);
});

test('a stored draft is read back part by part — anything off-shape is dropped', () => {
  assert.deepEqual(parseStoredDraft(null), {});
  assert.deepEqual(parseStoredDraft('not json'), {});
  assert.deepEqual(
    parseStoredDraft(JSON.stringify({ about: 'x', services: ['a', 2], sections: { portfolio: false }, hero: 'k', evil: 1 })),
    { about: 'x', hero: 'k' },
  );
  assert.deepEqual(
    parseStoredDraft(JSON.stringify({ sections: { portfolio: false, trusted_by: true, editorials: true } })),
    { sections: { portfolio: false, trusted_by: true, editorials: true } },
  );
});

test('a section missing from the stored map is shown (the public page’s own rule)', () => {
  assert.deepEqual(sectionsOf({ portfolio: false }), { portfolio: false, trusted_by: true, editorials: true });
});
