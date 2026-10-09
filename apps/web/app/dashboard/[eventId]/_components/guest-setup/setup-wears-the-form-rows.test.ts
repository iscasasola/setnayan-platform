/**
 * setup-wears-the-form-rows.test.ts — GUESTS › SETUP IS DRAWN BY THE APP'S FORM ROWS (step 3B, owner 2026-10-09: the features
 * are built — *"maybe just for it to adapt to the template"*).
 *
 * THE CLAIM: no Setup row draws its own grid (`SETUP_ROW`) or colour. The list is one `FormRows`; the three shared parts are
 * handed the SAME frames the Maker hands them (`setup-frames.tsx` — held equal to the Maker's, source against source); the
 * rows that are not a shared part (Invitations · Your one link · Finalize) are `FormRow` with their buttons at the right,
 * their sentence behind an ⓘ (`Explain`) and ONE filled forward step per row. Reply by is the date row, written LIVE (there is
 * no Apply on this door) and marked so. Nothing about what is written, or where, changed.
 *
 * SABOTAGE (each seen RED, then restored): a `SETUP_ROW` section back on a row · the frame diverging from the Maker's · Reply by
 * back on a native date input · a second filled button on a row · the live mark dropped · the ⓘ sentence printed under the name.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const ROWS = read('guest-setup-rows.tsx');
const FRAMES = read('setup-frames.tsx');
const MAKER = read('..', '..', 'launch', '_components', 'maker-rsvp-ask.tsx');

/** One exported frame, as source, spaces collapsed — so two files can be compared. */
const frameSrc = (src: string, name: string) => {
  const from = src.indexOf(`export const ${name} =`);
  assert.ok(from >= 0, `${name} is gone`);
  const rest = src.slice(from);
  const end = rest.search(/\n\s*\n/);
  return rest.slice(0, end < 0 ? undefined : end).replace(/\s+/g, ' ').trim();
};

test('no Setup row draws its own grid, section or terracotta (the old skin is not imported)', () => {
  assert.doesNotMatch(ROWS, /setup-skin|SETUP_ROW|SETUP_TITLE|SETUP_SUB|SETUP_ACTS|<section\b/, 'a Setup row draws its own shape again');
  assert.doesNotMatch(ROWS, /bg-mulberry|bg-ink\b/, 'a hand colour is back');
  assert.match(ROWS, /<FormRows data="guest-setup">/);
});

test('the three shared parts get the SAME frames as the Maker (source against source)', () => {
  assert.match(ROWS, /<GuestsGetIn frame=\{getInFrame\}/);
  assert.match(ROWS, /<RsvpAsks frame=\{asksFrame\}/);
  assert.match(ROWS, /<ReplyBy\s+layout="frame"\s+frame=\{replyByFrame\}/);
  for (const name of ['getInFrame', 'asksFrame']) {
    assert.equal(frameSrc(FRAMES, name), frameSrc(MAKER, name), `${name} no longer draws the way the Maker's does`);
  }
  /* Reply by differs by one thing, on purpose: Setup keeps the sentence behind its ⓘ. */
  const mk = frameSrc(MAKER, 'replyByFrame');
  const su = frameSrc(FRAMES, 'replyByFrame');
  assert.equal(
    su.replace(' about={{ words: REPLY_BY_LINE }}', '').replace('onKeep={keepInPlainWords(row.keep)}', 'onKeep={row.keep}'),
    mk,
    'Reply by differs from the Maker’s by more than its ⓘ and its plain refusal',
  );
  assert.match(su, /about=\{\{ words: REPLY_BY_LINE \}\}/);
});

test('the frames file carries the template and the parts still do not (Guests › Setup downloads it once, the Maker’s chunk not at all)', () => {
  for (const part of ['guests-get-in.tsx', 'rsvp-asks.tsx', 'reply-by.tsx']) {
    assert.doesNotMatch(read(part), /form-row|\/calendar|setup-frames/, `${part} imports a template`);
  }
  assert.doesNotMatch(MAKER, /setup-frames/, 'the Maker imports Guests › Setup’s frames (its first load)');
});

test('Reply by writes LIVE on this door and says so; the Maker’s stays drafted (the part’s marks)', async () => {
  const live = await renderSetup({ getIn: 'list' });
  assert.match(live, /data-setup-row="reply-by"[^>]*data-reply-by-field="live"[^>]*data-writes-live=""/, 'Setup’s Reply by is not marked live');
  assert.doesNotMatch(live, /type="date"/, 'Reply by is a native date input again');
  assert.match(live, /data-form-row-kind="date"/);
  assert.match(read('reply-by.tsx'), /draft \? \{ 'data-setup-row': 'reply-by', 'data-rsvp-setting': 'reply-by', 'data-reply-by-field': 'draft' \}/, 'the Maker’s marks changed');
});

test('every row is a Form row; the rows that are not a shared part are FormRow with their buttons at the right', async () => {
  const html = await renderSetup({ getIn: 'list' });
  const rows = [...html.matchAll(/data-setup-row="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['get-in', 'invitations', 'asks', 'reply-by', 'finalize']);
  for (const row of rows) assert.match(html, new RegExp(`data-form-row="[^"]*"[^>]*data-setup-row="${row}"|data-setup-row="${row}"[^>]*data-form-row="`), `${row} is not a Form row`);
  assert.equal((html.match(/data-form-rows="guest-setup"/g) ?? []).length, 1, 'more than one list');
  assert.match(html, /data-testid="setup-send"/);
  assert.match(html, /data-testid="setup-pick-who"/);
  assert.match(html, /data-testid="setup-finalize-now"/);
});

test('one filled forward step per row, and it is the brand (Send · Copy) or the OK (Finalize) — never a second', async () => {
  for (const getIn of ['list', 'personal', 'one_qr'] as const) {
    const html = await renderSetup({ getIn });
    for (const chunk of html.split('data-form-row=').slice(1)) {
      const filled = (chunk.match(/class="ab ab-\w+ ab-main/g) ?? []).length;
      assert.ok(filled <= 1, `${getIn}: a Setup row has ${filled} filled buttons`);
    }
  }
  const send = await renderSetup({ getIn: 'personal' });
  assert.match(send, /class="ab ab-brand ab-main[^"]*"[^>]*data-testid="setup-send"|data-testid="setup-send"[^>]*class="ab ab-brand ab-main/, 'Send to N is not the brand filled step');
  const copy = await renderSetup({ getIn: 'one_qr' });
  assert.match(copy, /aria-label="Copy"[^>]*class="ab ab-brand ab-main/, 'Copy is not the brand filled step');
  const none = await renderSetup({ getIn: 'personal', toInvite: 0 });
  assert.doesNotMatch(none.slice(none.indexOf('Everyone invited') - 300, none.indexOf('Everyone invited')), /ab-main/, '"Everyone invited" is a filled forward step');
});

test('the sentences sit behind an ⓘ (Explain), the counts stay on the row', async () => {
  const html = await renderSetup({ getIn: 'list' });
  assert.ok((html.match(/data-explain=""/g) ?? []).length >= 4, 'Setup’s rows lost their ⓘ');
  assert.doesNotMatch(html, /One by one from your phone/, 'the Invitations sentence is printed under the name');
  assert.doesNotMatch(html, /Your invitation asks guests to reply by this day/, 'the Reply by sentence is printed under the name');
  assert.match(html, /to invite\./, 'the count of who is left is not on the row');
  assert.doesNotMatch(read('guest-setup-rows.tsx'), /InfoTip|info-tip/, 'the older ⓘ is back');
});

test('what is written, and where, is as it was: the one blob through the one draft door, Reply by through its one writer', () => {
  assert.match(ROWS, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ rsvp_ask_config: next \} \}\)\)/);
  assert.match(ROWS, /action=\{updatePaxSettings\}/);
  assert.match(ROWS, /setGuestListFinalized\(eventId, (?:true|false)\)/);
});
