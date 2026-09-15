/**
 * THE COUPLE'S MESSAGE BELONGS TO THE PAGE, NOT TO A PAYMENT METHOD.
 *
 * ── 🔴 WHERE THE OWNER'S WORDS ACTUALLY WERE ───────────────────────────────
 * He picked a template, and it appeared on his live gifts page — before any of
 * this shipped. Measured: all 171 characters were sitting in
 * `event_egift_methods.note`, i.e. pasted onto the BANK CARD, because that was
 * the only box on the screen that would hold a sentence.
 *
 * That is one fact in the wrong home, and it fails in two ordinary ways:
 *   · delete the bank card and the couple's words go with it;
 *   · add a second method and they are typed twice, then edited twice, then
 *     disagree.
 *
 * 🔑 AND IT IS WHY THIS COLUMN IS PAGE-LEVEL. A per-method note stays for what
 * it is for ("please put your name in the reference"); the couple's reason for
 * asking at all is a property of the PAGE.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

import { PABUYA_TEMPLATES, PABUYA_MESSAGE_MAX, cleanPabuyaMessage } from './pabuya-message';

test('five templates, each inside the column’s ceiling', () => {
  assert.equal(PABUYA_TEMPLATES.length, 5, 'the owner asked for five');
  for (const t of PABUYA_TEMPLATES) {
    assert.ok(t.body.length <= PABUYA_MESSAGE_MAX, `${t.name} is longer than the column allows`);
    assert.ok(t.name.length > 0 && t.key.length > 0);
  }
  const keys = PABUYA_TEMPLATES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length, 'two templates share a key');
});

test('🔑 no template opens with the ask', () => {
  /* Every one makes the gift optional before it mentions money. A page that
     opens with the request is the reason couples are embarrassed to turn this
     on at all, and a template that does it would spread that by default. */
  for (const t of PABUYA_TEMPLATES) {
    const opening = t.body.slice(0, 60).toLowerCase();
    assert.ok(
      !/^(we would love to receive|send|give us|please give)/.test(opening),
      `"${t.name}" opens with the ask — it should make the gift optional first`,
    );
  }
});

test('⚠ empty becomes NULL, never an empty string', () => {
  /* A stored '' renders a blank paragraph above the QR codes, which reads as a
     layout fault rather than as "they wrote nothing". NULL is the only honest
     way to say unset — and it is what keeps every untouched event reading
     exactly as it did before this column existed. */
  assert.equal(cleanPabuyaMessage(''), null);
  assert.equal(cleanPabuyaMessage('   \n  '), null);
  assert.equal(cleanPabuyaMessage(undefined), null);
  assert.equal(cleanPabuyaMessage(null), null);
});

test('it trims, and it cannot exceed what the CHECK constraint allows', () => {
  assert.equal(cleanPabuyaMessage('  hello  '), 'hello');
  const long = 'x'.repeat(PABUYA_MESSAGE_MAX + 250);
  assert.equal(cleanPabuyaMessage(long)?.length, PABUYA_MESSAGE_MAX,
    'a long paste would be refused by events_pabuya_message_chk rather than trimmed');
});

test('🔒 the saved value is TEXT, never a template key', () => {
  /* So editing a template after picking it is just editing — and improving a
     template's wording later can never silently rewrite a page somebody has
     already published. */
  const picked = PABUYA_TEMPLATES[0]!;
  assert.equal(cleanPabuyaMessage(picked.body), picked.body);
  assert.notEqual(cleanPabuyaMessage(picked.body), picked.key);
});

test('🔒 the two boxes do not read as the same kind of box', () => {
  /*
    ⚖ Owner 2026-09-15, "move the message off the bank card" — and the label is
    WHY his words landed there. The per-method field used to say "Note for
    guests (optional)", which is exactly what a couple reads when they want to
    tell guests why they are asking. He typed the whole paragraph into it.

    🔑 KEEPING `event_egift_methods.note` IS A DECISION, NOT AN OVERSIGHT. It
    stays for per-account plumbing ("please put your name in the reference",
    "this account is for the reception"). The condition on keeping it is that
    the two must be visibly different things on screen — otherwise the next
    couple does what the owner did, and the repo ends up with two columns
    holding one kind of text and no way to say which is right.

    ⚠ stripComments PADS WITH SPACES, so collapse whitespace before matching or
    every window is blank.
  */
  const src = stripComments(
    readFileSync(
      join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'pabuya', '_components', 'pabuya-manager.tsx'),
      'utf8',
    ),
  ).replace(/\s+/g, ' ');

  assert.match(src, /label="Note for this account \(optional\)"/,
    'the per-method note must name the ACCOUNT it belongs to');
  assert.doesNotMatch(src, /Note for guests/,
    'a field called "note for guests" is where a couple types the page-level message');
});
