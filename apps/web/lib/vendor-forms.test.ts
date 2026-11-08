/**
 * 📋 The Form Maker's pure rules (lib/vendor-forms.ts) — and the one fact that must never drift: the types the Maker
 * offers are exactly the types the database accepts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORM_ANSWER_TYPES,
  answerText,
  answeredCount,
  cleanOptions,
  draftItemsOfTemplate,
  formsForBookedCards,
  itemRow,
  normalizedVideoUrl,
  suggestionsForCategories,
  validateFormDraft,
} from './vendor-forms';

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');

test('the Maker offers exactly the types the database CHECK accepts — v113 order, no photo upload', () => {
  const file = fs.readdirSync(MIGRATIONS).find((f) => f.endsWith('_a_shop_keeps_a_library_of_forms.sql'));
  assert.ok(file, 'the Forms migration is missing');
  const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
  const check = /vendor_questions_answer_type_chk\s+CHECK \(answer_type IN \(([^)]*)\)/.exec(sql);
  assert.ok(check, 'the answer_type CHECK moved');
  const dbKeys = [...check[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(dbKeys, FORM_ANSWER_TYPES.map((t) => t.key));
  assert.deepEqual(
    FORM_ANSWER_TYPES.map((t) => t.label),
    ['Short answer', 'Long answer', 'Multiple choice', 'Checkboxes', 'Dropdown', 'Date', 'Number', 'Yes / No', 'Measurement'],
  );
});

test('a draft says what stops it saving, in words', () => {
  assert.deepEqual(
    validateFormDraft({ title: ' ', items: [], serviceIds: [] }).map((p) => p.at),
    ['title', 'items'],
  );
  const probs = validateFormDraft({
    title: 'Shot list',
    serviceIds: [],
    items: [
      { kind: 'question', prompt: 'Pick one', answerType: 'dropdown', required: false, options: [' ', ''] },
      { kind: 'video_link', caption: 'x', url: 'javascript:alert(1)' },
      { kind: 'question', prompt: 'Your names?', answerType: 'short_answer', required: true },
    ],
  });
  assert.deepEqual(probs.map((p) => p.at), [0, 1]);
});

test('an item writes exactly its own payload (mirrors vendor_questions_item_shape_chk)', () => {
  const q = itemRow({ kind: 'question', prompt: ' Size? ', answerType: 'short_answer', required: true, options: ['a'] }, 3);
  assert.equal(q.options, null, 'a non-choice question carries no options');
  assert.equal(q.prompt, 'Size?');
  assert.equal(q.display_order, 3);
  const c = itemRow({ kind: 'question', prompt: 'Pick', answerType: 'checkboxes', required: false, options: ['A', 'a', ' B '] }, 0);
  assert.deepEqual(c.options, ['A', 'B']);
  const v = itemRow({ kind: 'video_link', caption: '', url: 'youtu.be/dQw4w9WgXcQ' }, 1);
  assert.match(v.video_url ?? '', /^https:\/\//);
  assert.equal(v.media_keys, null);
});

test('video links: https or nothing', () => {
  assert.equal(normalizedVideoUrl('ftp://x'), null);
  assert.equal(normalizedVideoUrl('data:text/html,hi'), null);
  assert.match(normalizedVideoUrl('http://vimeo.com/123') ?? '', /^https:\/\/vimeo\.com\/123/);
});

test('the booking moment sends each linked live form once', () => {
  const links = [
    { form_id: 'f1', vendor_service_id: 's1' },
    { form_id: 'f1', vendor_service_id: 's2' },
    { form_id: 'f2', vendor_service_id: 's3' },
    { form_id: 'f3', vendor_service_id: 's1' },
  ];
  assert.deepEqual(formsForBookedCards(links, ['s1', 's2']), ['f1', 'f3']);
  assert.deepEqual(formsForBookedCards(links, ['s1'], new Set(['f1'])), ['f1'], 'a retired form is never auto-sent');
  assert.deepEqual(formsForBookedCards(links, []), []);
});

test('suggestions: the service’s own first, then the group’s others, each once; empty stays empty', () => {
  const s = [
    { category_id: 'photo', template_key: 'shot_list', sort_order: 1 },
    { category_id: 'photo', template_key: 'brief', sort_order: 0 },
    { category_id: 'video', template_key: 'sde_song', sort_order: 0 },
    { category_id: 'video', template_key: 'brief', sort_order: 2 },
  ];
  assert.deepEqual(suggestionsForCategories(s, ['photo'], ['photo', 'video']), { own: ['brief', 'shot_list'], alsoUseful: ['sde_song'] });
  assert.deepEqual(suggestionsForCategories([], ['photo'], ['video']), { own: [], alsoUseful: [] });
});

test('a template copies question lines only, with safe types', () => {
  const d = draftItemsOfTemplate([
    { prompt: 'Venue?', answer_type: 'short_answer' },
    { prompt: '', answer_type: 'short_answer' },
    { prompt: 'Upload', answer_type: 'photo_upload' },
    { prompt: 'Pick', answer_type: 'dropdown', options: ['A', 'A', 'B'] },
  ]);
  assert.equal(d.length, 3);
  assert.equal(d[1]!.kind === 'question' && d[1]!.answerType, 'short_answer', 'an unknown type falls back, never stored raw');
  assert.deepEqual(d[2]!.kind === 'question' ? d[2]!.options : null, ['A', 'B']);
  assert.deepEqual(draftItemsOfTemplate('nope'), []);
});

test('answers are text, shaped by type', () => {
  assert.equal(answerText('number', '12.5'), '12.5');
  assert.equal(answerText('number', 'twelve'), null);
  assert.equal(answerText('date', ' 14 Feb 2027 '), '14 Feb 2027', 'a date is the couple’s words (text answers only)');
  assert.equal(answerText('yes_no', 'Maybe'), null);
  assert.equal(answerText('checkboxes', ['A', 'Z', 'B'], ['A', 'B']), 'A · B');
  assert.equal(answerText('dropdown', 'C', ['A', 'B']), null);
  assert.equal(answerText('short_answer', '   '), null);
  assert.deepEqual(cleanOptions(['x', 'X', '']), ['x']);
  assert.deepEqual(
    answeredCount(
      [
        { question_id: 'a', item_kind: 'question' },
        { question_id: 'b', item_kind: 'video_link' },
        { question_id: 'c', item_kind: 'question' },
      ],
      new Set(['a', 'b']),
    ),
    { answered: 1, total: 2 },
  );
});
