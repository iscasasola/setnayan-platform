/**
 * the-card-posts-every-column.test.ts — a field the card stops rendering is a
 * column the card starts ERASING.
 *
 * ── The mechanism ───────────────────────────────────────────────────────────
 * `updateGuest` is a full-document write: it reads each column out of the
 * posted FormData and writes what it finds. `clean(formData.get('x')) || null`
 * cannot tell "the host cleared this box" from "no box was rendered" — both
 * arrive as absent, and both are written as NULL.
 *
 * That was survivable while the form had a Save button: the write happened when
 * a host asked for it. Since 2026-09-22 the card AUTOSAVES, so the write
 * happens whenever anybody edits anything. A field dropped from the layout now
 * erases its column for every guest a host so much as opens.
 *
 * ── It already happened once, in the change that added this file ────────────
 * The owner asked for the free-text Relationship field to be removed from the
 * card. Removing the input alone would have nulled `guests.relation` on every
 * keystroke — a column `/guests/new` still writes and the tea-ceremony page
 * still READS, to label each elder in serving order. The fix is a hidden input
 * that carries the value through: removed from the UI, not from the guest.
 *
 * 🔑 So the rule is NOT "every column must be editable here". It is "every
 * column this action writes must be REPRESENTED here" — as a control, or as a
 * deliberate carrier. Deciding a field does not belong on this card is a design
 * call; deleting somebody's data by doing so is not.
 *
 * 🛡 Mutation-checked, each confirmed RED:
 *  · delete the hidden `relation` carrier          → RED
 *  · delete the hidden `seniority_rank` carrier    → RED
 *  · remove the dietary_restrictions field         → RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARD = stripComments(readFileSync(join(HERE, 'guest-card-body.tsx'), 'utf8'));
const ACTIONS = stripComments(
  readFileSync(resolve(HERE, '..', '[guestId]', 'actions.ts'), 'utf8'),
);

/** The columns `updateGuest` reads out of the posted form. */
function columnsUpdateGuestWrites(): string[] {
  const at = ACTIONS.indexOf('export async function updateGuest(');
  assert.notEqual(at, -1, 'updateGuest is gone — this test is pinning a ghost');
  // Stop at the next top-level export so a sibling action's reads are not
  // counted as this one's.
  const end = ACTIONS.indexOf('export async function ', at + 10);
  const body = ACTIONS.slice(at, end === -1 ? undefined : end);
  const keys = [...body.matchAll(/formData\.get\('([a-z_]+)'\)/g)]
    .map((m) => m[1])
    .filter((k): k is string => Boolean(k));
  return [...new Set(keys)];
}

/** Fields the card is allowed NOT to carry, each with the reason it is safe. */
const EXEMPT: Record<string, string> = {
  // Read only as the fallback when `plus_one_count` is absent, and the count is
  // a radio group with one option always checked — so this branch cannot run
  // from this card.
  plus_one_allowed: 'superseded by plus_one_count, which is always posted',
  // Autosave plumbing, not a column.
  quiet: 'tells the action not to redirect',
  return_to: 'tells the action where an error lands',
};

test('every column updateGuest writes is represented on the card', () => {
  const missing: string[] = [];
  for (const key of columnsUpdateGuestWrites()) {
    if (key in EXEMPT) continue;
    const present =
      CARD.includes(`id="${key}"`) || CARD.includes(`name="${key}"`);
    if (!present) missing.push(key);
  }
  assert.deepEqual(
    missing,
    [],
    `these columns are WRITTEN by updateGuest but not posted by the card, so ` +
      `every autosave nulls them: ${missing.join(', ')}. Add the control back, ` +
      `or carry the value in a hidden input and say why.`,
  );
});

test('the carriers are hidden inputs, not forgotten controls', () => {
  // Named explicitly, because these two are invisible by design and a future
  // reader tidying "unused" inputs is exactly the hazard.
  for (const key of ['relation', 'seniority_rank']) {
    assert.ok(
      new RegExp(`type="hidden"\\s+name="${key}"`).test(CARD),
      `${key} must be carried through the form, not dropped`,
    );
  }
});

test('the count of posted columns is printed, so a silent shrink is visible', () => {
  const cols = columnsUpdateGuestWrites().filter((k) => !(k in EXEMPT));
  // Printed rather than pinned to a number: the list grows legitimately when a
  // column is added, and a hard-coded total would only teach the next person to
  // bump it. The assertion above is what has teeth.
  console.log(`updateGuest writes ${cols.length} columns from this form:`);
  console.log('  ' + cols.sort().join(', '));
  assert.ok(cols.length > 15, 'suspiciously few columns — did the parser break?');
});
