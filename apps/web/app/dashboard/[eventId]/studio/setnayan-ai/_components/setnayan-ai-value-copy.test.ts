import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  buildAiValueGroups,
  WEDDING_AI_VALUE_TERMS,
  type AiValueTerms,
} from './setnayan-ai-value-copy';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A birthday: host-organized, no statutory pack. The canonical non-wedding case. */
const BIRTHDAY: AiValueTerms = {
  eventWord: 'event',
  organizerNoun: 'host',
  hasStatutoryPaperwork: false,
};

const allText = (terms: AiValueTerms) =>
  buildAiValueGroups(terms)
    .flatMap((g) => [g.heading, g.blurb, ...g.caps.flatMap((c) => [c.title, c.body])])
    .join('\n');

// ── The defect this module exists to fix ───────────────────────────────────
test('a non-wedding NEVER promises PH marriage paperwork', () => {
  const text = allText(BIRTHDAY);
  for (const banned of ['Pre-Cana', 'marriage', 'PSA', 'license']) {
    assert.ok(
      !text.includes(banned),
      `Non-wedding copy must not mention "${banned}" — it promised marriage paperwork on a birthday`,
    );
  }
});

test('a wedding KEEPS the statutory paperwork promise', () => {
  const text = allText(WEDDING_AI_VALUE_TERMS);
  assert.match(text, /PH marriage paperwork/);
  assert.match(text, /Pre-Cana/);
});

test('the deadline row still promises something real without a statutory pack', () => {
  // Dropping the paperwork clause must not leave a stub. The remaining promise
  // (booking windows) is a capability the app genuinely runs for every type.
  const cap = buildAiValueGroups(BIRTHDAY)
    .flatMap((g) => g.caps)
    .find((c) => c.id === 'deadlines');
  assert.ok(cap, 'the deadlines capability must still be present');
  assert.match(cap.body, /booking windows/);
  // No dangling em-dash pair or doubled punctuation from the removed clause.
  assert.ok(!/—\s*—/.test(cap.body), 'orphaned em-dashes from the removed clause');
  assert.ok(!/\s,|,,|\s\./.test(cap.body), `punctuation broke: ${cap.body}`);
});

// ── The other two wedding-isms ─────────────────────────────────────────────
test('the demand row uses the type ORGANIZER, not "another couple"', () => {
  assert.match(allText(BIRTHDAY), /another host starts looking/);
  assert.ok(!allText(BIRTHDAY).includes('another couple'));
  assert.match(allText(WEDDING_AI_VALUE_TERMS), /another couple starts looking/);
});

test('no "reception" anywhere — a tournament has none', () => {
  for (const terms of [BIRTHDAY, WEDDING_AI_VALUE_TERMS]) {
    assert.ok(!allText(terms).toLowerCase().includes('reception'));
  }
  assert.match(allText(BIRTHDAY), /distance to your venue/);
});

test('the shortlist blurb uses the type event word', () => {
  assert.match(allText(BIRTHDAY), /made for your event\./);
  assert.match(allText(WEDDING_AI_VALUE_TERMS), /made for your wedding\./);
});

// ── Structure invariants ───────────────────────────────────────────────────
test('every type gets the same 9 capabilities with stable ids', () => {
  const ids = (t: AiValueTerms) => buildAiValueGroups(t).flatMap((g) => g.caps.map((c) => c.id));
  const wedding = ids(WEDDING_AI_VALUE_TERMS);
  assert.equal(wedding.length, 9);
  assert.deepEqual(new Set(wedding).size, 9, 'ids must be unique — they key icons + live figures');
  // Type-awareness varies WORDS, never which capabilities exist. A non-wedding
  // must not silently lose a row, and must not gain a dormant one.
  assert.deepEqual(ids(BIRTHDAY), wedding);
});

test('DRIFT GUARD — the component maps an icon for every capability id', () => {
  // The component keys CAP_ICON off the ids authored here. Adding a capability
  // without an icon renders `undefined` as a JSX tag and crashes the surface, so
  // pin the two lists together rather than trusting the Record type at a
  // distance.
  const tsx = readFileSync(join(HERE, 'setnayan-ai-value.tsx'), 'utf8');
  const iconBlock = tsx.slice(tsx.indexOf('const CAP_ICON'), tsx.indexOf('const CAP_FIGURE'));
  for (const { id } of buildAiValueGroups(WEDDING_AI_VALUE_TERMS).flatMap((g) => g.caps)) {
    assert.match(iconBlock, new RegExp(`\\b${id}:`), `CAP_ICON is missing an icon for "${id}"`);
  }
});

test('DRIFT GUARD — no capability body hardcodes a wedding-ism', () => {
  // The whole class of bug, caught generically: build the copy for a type with
  // NO wedding traits and assert none of the wedding vocabulary survives.
  const text = allText(BIRTHDAY).toLowerCase();
  for (const word of ['couple', 'wedding', 'bride', 'groom', 'reception', 'pre-cana']) {
    assert.ok(!text.includes(word), `non-wedding copy leaked the wedding-ism "${word}"`);
  }
});
