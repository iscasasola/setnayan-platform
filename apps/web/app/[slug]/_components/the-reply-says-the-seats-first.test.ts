/**
 * 🪑 THE REPLY SAYS THE SEATS FIRST, THEN WHO YOU ARE, THEN WHO YOU BRING.
 *
 * Owner, verbatim, 2026-10-25: *"We reserved one seat for you · We reserved two seats for you · Then a screen where
 * they confirm their name and their nickname and contact number then their plus seat"* — the name read-only, with
 * "Wrong name? Tell the couple"; approved prototype `Setnayan/prototypes/rsvp_seats_2026-10-25/index.html`, every
 * open question answered "all as recommended" (DECISION_LOG 2026-10-25).
 *
 * What this pins, by rendering the real card and running the real rules:
 *   1 · the Seats step says N = 1 + the extra seats, in words, with one tile per seat — "You · +1 · +2";
 *   2 · the name is READ-ONLY: shown in the You step, never a box — the reply writes no name column;
 *   3 · "Wrong name? Tell the couple" writes ONLY `guests.guest_note` — one "Name correction: …" line, even when the
 *       note question is off, never twice, never over a stored note it could not read;
 *   4 · the YES order is Seats → You → +1s → tagging → the rest, and a No keeps its contact step after the note,
 *       read back from its own boxes;
 *   5 · a seat list that failed to read claims no count on the +1 step and offers one box (scenario E);
 *   6 · after Send, Save hands over their own card and each +1 ticket, and the Wallet slot is marked — in the
 *       owner-approved order (2026-10-25): the ticket, then Save and the Wallet slot together, then the +1 list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BASE, GUEST, doorAction, renderReplyCard } from '@/lib/reply-card.fixture';
import { extraSeatList, seatCountWords } from '@/lib/rsvp-seats-words';
import {
  DECLINED_CONTACT_FIELDS,
  NAME_CORRECTION_FIELD,
  NAME_CORRECTION_PREFIX,
  adoptDeclinedContactArm,
  readNameCorrection,
  withNameCorrection,
} from '@/lib/rsvp-you-step';

const APP = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const ASK_ALL = {};
/** A guest who has said Yes, with `extra` seats beyond their own and the seat list read (none named yet). */
function yes(extra: number, over: Record<string, unknown> = {}) {
  return renderReplyCard({
    ...BASE,
    doorAction,
    oneAtATime: true,
    askTagging: true,
    ask: ASK_ALL,
    guest: { ...GUEST, rsvp_status: 'attending', plus_one_allowed: extra > 0, plus_one_count: extra, plus_one_seats: extra > 0 ? [] : undefined, ...over },
  });
}
/** The markup of the step that opens at `marker`, up to the next step. */
function stepAt(html: string, marker: string): string {
  const at = html.indexOf(marker);
  assert.ok(at > -1, `no step carries ${marker}`);
  const open = html.lastIndexOf('<div', at);
  const next = html.indexOf('data-rsvp-step', at + marker.length);
  return html.slice(open, next > -1 ? next : undefined);
}

test('1 · the Seats step says N = 1 + the extra seats, with a tile for each — "You · +1 · +2"', async () => {
  for (const extra of [0, 1, 2, 3, 4]) {
    const html = await yes(extra);
    const seats = stepAt(html, 'data-rsvp-seats=');
    assert.match(seats, new RegExp(`data-rsvp-seats="${1 + extra}"`), `+${extra}: the step does not hold ${1 + extra}`);
    assert.ok(seats.includes(`We reserved ${seatCountWords(1 + extra)} for you`), `+${extra}: the heading is not "${seatCountWords(1 + extra)}"`);
    const tiles = [...seats.matchAll(/data-rsvp-seat-tile="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(tiles, ['You', ...Array.from({ length: extra }, (_, i) => `+${i + 1}`)], `+${extra}: tiles ${tiles.join(' · ')}`);
    assert.doesNotMatch(seats, /Seat \d/, `+${extra}: a seat is named by headcount, not "+1 / +2" (decision 4)`);
    assert.doesNotMatch(seats, /<input|<select|<textarea/, 'the Seats step asks something');
  }
  assert.equal(seatCountWords(1), 'one seat');
  assert.equal(seatCountWords(2), 'two seats');
  assert.equal(extraSeatList(3), '+1, +2 and +3');
});

test('2 · the name is shown read-only in the You step, beside "Wrong name? Tell the couple" — never a box', async () => {
  const html = await yes(1, { name_prefix: 'Dr.', middle_name: 'Santos' });
  const you = stepAt(html, 'data-rsvp-you');
  assert.ok(you.includes('You’re Dr. Ana Santos Reyes'), 'the You step does not show the name as the couple wrote it');
  assert.match(you, /data-rsvp-wrong-name=""[^>]*>Wrong name\? Tell the couple</);
  assert.match(you, /name="contact_display_name"/, 'the nickname is not asked in the You step');
  assert.match(you, /name="contact_mobile"/, 'the mobile is not asked in the You step');
  assert.ok(you.indexOf('name="contact_display_name"') < you.indexOf('name="contact_mobile"'), 'the nickname comes after the mobile');
  assert.doesNotMatch(you, /name="(?:name_prefix|first_name|middle_name|last_name|name_suffix)"/, 'a name box in the You step — names are host-only (2026-08-01)');
  // …and the reply's write names no name column.
  const action = read('[slug]/actions.ts');
  const write = action.slice(action.indexOf('const writeReply = '), action.indexOf('let { data: wrote, error } = await writeReply('));
  assert.ok(write.includes('.update({'), 'the reply write moved — re-point this guard');
  assert.doesNotMatch(write, /\b(?:first_name|last_name|middle_name|name_prefix|name_suffix):/, 'the reply writes a name');
});

test('3 · "Wrong name? Tell the couple" writes ONLY guests.guest_note — one line, whether or not the note is asked', () => {
  const line = `${NAME_CORRECTION_PREFIX}Maria Teresita Aquino`;
  assert.equal(withNameCorrection(null, 'Maria Teresita Aquino'), line, 'no note: the line alone');
  assert.equal(withNameCorrection('See you!', 'Maria Teresita Aquino'), `See you!\n${line}`, 'a note: the line under it');
  assert.equal(withNameCorrection(`See you!\n${line}`, 'Maria Teresita Aquino'), `See you!\n${line}`, 'sent twice: the line twice');
  assert.equal(withNameCorrection('See you!', ''), 'See you!', 'no correction changed the note');
  assert.equal(withNameCorrection(undefined, 'Maria'), undefined, 'a note it could not read is replaced by the line');
  assert.equal(readNameCorrection('  Maria   Teresita  '), 'Maria Teresita');
  assert.equal(readNameCorrection(null), '');
  const action = read('[slug]/actions.ts');
  const fn = action.slice(action.indexOf('export async function submitRsvp('));
  assert.match(fn, /const nameCorrection = readNameCorrection\(formData\.get\(NAME_CORRECTION_FIELD\)\);/);
  // Read once, used once — into the note, and nowhere else.
  assert.equal((fn.match(/\bnameCorrection\b/g) ?? []).length, 2, 'the correction is used somewhere other than the note');
  assert.match(fn, /const guestNoteWritten = withNameCorrection\(guestNoteToWrite, nameCorrection\);/);
  assert.match(fn, /guest_note: guestNoteWritten,/);
  // The sheet posts the field the save reads — and only once "Add to my reply" set it.
  const sheet = read('[slug]/_components/rsvp-name-correction.tsx');
  assert.match(sheet, /<input type="hidden" name=\{NAME_CORRECTION_FIELD\} value=\{sent\} \/>/);
  assert.doesNotMatch(sheet, /id="rsvp_name_correction_draft"[^>]*\bname=/, 'the draft box posts before "Add to my reply"');
  assert.equal(NAME_CORRECTION_FIELD, 'name_correction');
});

test('4 · the YES order is Seats → You → +1s → tagging → the rest; a No keeps its contact step after the note', async () => {
  const html = await yes(2);
  const order = ['name="rsvp_status"', 'data-rsvp-seats=', 'data-rsvp-you', 'id="plus-ones"', 'data-face-tagging-choice', 'name="meal_preference"', 'name="dietary_restrictions"', 'name="song_title"', 'name="guest_note"', 'name="declined_contact_display_name"', 'name="terms_agreed"'];
  const at = order.map((k) => html.indexOf(k));
  for (const [i, k] of order.entries()) assert.ok(at[i]! > -1, `${k} is not drawn`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `out of order: ${order.filter((_, i) => at[i] !== [...at].sort((a, b) => a - b)[i]).join(', ')}`);
  // The YES steps wait on "attending"; the No's contact step waits on "declined".
  assert.match(stepAt(html, 'data-rsvp-seats='), /class="attending-reveal /);
  assert.match(stepAt(html, 'data-rsvp-you'), /class="attending-reveal /);
  assert.match(html, /\.rsvp-form:has\(input\[name="rsvp_status"\]\[value="declined"\]:checked\) \.declined-reveal\{display:block\}/);
  // The No's boxes are read back as the reply's own — and only on a No.
  const f = new FormData();
  f.set('contact_mobile', '0917 000 0000');
  f.set('contact_display_name', 'Ana');
  f.set(DECLINED_CONTACT_FIELDS.contact_mobile, '0918 111 1111');
  f.set(DECLINED_CONTACT_FIELDS.contact_display_name, 'Annie');
  const yesForm = new FormData();
  for (const [k, v] of f.entries()) yesForm.set(k, v);
  adoptDeclinedContactArm(yesForm, 'attending');
  assert.equal(yesForm.get('contact_mobile'), '0917 000 0000', 'a Yes read the No’s boxes');
  adoptDeclinedContactArm(f, 'declined');
  assert.equal(f.get('contact_mobile'), '0918 111 1111', 'a No did not read its own mobile');
  assert.equal(f.get('contact_display_name'), 'Annie', 'a No did not read its own nickname');
  const noMobile = new FormData();
  noMobile.set('contact_mobile', '0917 000 0000');
  noMobile.set(DECLINED_CONTACT_FIELDS.contact_display_name, '');
  adoptDeclinedContactArm(noMobile, 'declined');
  assert.equal(noMobile.get('contact_mobile'), null, 'a No posted the hidden You step’s mobile');
  assert.match(read('[slug]/actions.ts'), /adoptDeclinedContactArm\(formData, status\);\s*const contactMobile = clean\(formData\.get\('contact_mobile'\)\) \|\| null;/);
  // A closed list for a guest not coming draws no You step — its one contact step posts the plain names.
  const locked = await renderReplyCard({ ...BASE, replyLocked: true, guest: { ...GUEST, rsvp_status: 'declined' } });
  assert.doesNotMatch(locked, /data-rsvp-you|data-rsvp-seats=|declined_contact_/);
  assert.match(locked, /name="contact_display_name"/);
});

test('5 · a seat list that failed to read claims no count on the +1 step and offers one box (scenario E)', async () => {
  const html = await yes(2, { plus_one_seats: undefined });
  assert.ok(stepAt(html, 'data-rsvp-seats=').includes('We reserved three seats for you'), 'the Seats step lost the true count — it reads the guest’s own row');
  const plus = html.slice(html.indexOf('id="plus-ones"'), html.indexOf('data-face-tagging-choice'));
  assert.ok(plus.includes('Your seat list didn’t load.'), 'the +1 step does not say the list failed');
  assert.doesNotMatch(plus, /\+1 and \+2|a seat for one more|\d seats|two seats|three seats/, 'the failed step claims a count');
  assert.equal((plus.match(/data-plus-one-seat="/g) ?? []).length, 1, 'more than the one box a failed read can support');
  // A read seat list gives each seat its own screen, and each says which seat it is (2026-10-25, owner "one at a time").
  const ok = await yes(2);
  const okPlus = ok.slice(ok.indexOf('id="plus-ones"'), ok.indexOf('data-face-tagging-choice'));
  for (const tag of ['+1', '+2']) assert.ok(okPlus.includes(`${tag} · Not sure yet? Leave the name empty.`), `the ${tag} screen does not name its seat`);
});

test('6 · after Send: Save hands over their card and each +1 ticket, and the Wallet slot is marked', () => {
  const enter = read('[slug]/invite/enter/page.tsx');
  assert.match(enter, /const plusOneCardHrefs = seats\s*\.filter\(\(s\) => plusOneTicketIds\.has\(s\.guest_id\)\)/);
  assert.match(enter, /hrefs=\{\[PASS_CARD_ROUTE, \.\.\.plusOneCardHrefs\]\}/);
  assert.match(enter, /label=\{plusOneCardHrefs\.length > 0 \? PASS_CARD_WORDS\.saveAll : /);
  assert.match(enter, /<div data-landing-wallet-slot="" className="!mt-2 empty:hidden">\s*<AppleWalletButton link=\{appleWallet\} \/>/, 'the Apple Wallet slot (PR #6548) is not filled with its button');
  assert.match(read('../lib/guest-landing.ts'), /replied: 'You’re on the list\.',/, 'the after-Send default is not "You’re on the list."');
});

/** Where each piece of the full ticket section starts, in source order — -1 when missing. */
function ticketOrder(src: string, sectionStart: RegExp, ticket: RegExp) {
  const from = src.search(sectionStart);
  assert.ok(from >= 0, 'the full ticket section is gone');
  const section = src.slice(from, src.indexOf('</section>', from));
  const at = (re: RegExp) => section.search(re);
  return {
    ticket: at(ticket),
    save: at(/<SavePassCardButton\b/),
    wallet: at(/data-landing-wallet-slot=""/),
    plusOnes: at(/<PlusOneSeatList\b/),
  };
}

test('6b · the order is ticket → Save → Wallet slot → +1 list, on the page and in its lab (owner-approved, 2026-10-25)', () => {
  const pages = {
    'invite/enter': ticketOrder(read('[slug]/invite/enter/page.tsx'), /data-landing-ticket="full"/, /<TicketPicture src=\{PASS_CARD_ROUTE\}/),
    'maker-lab thank-you': ticketOrder(read('dev/maker-lab/guest/page.tsx'), /data-lab-guest-pass=""/, /<TicketPicture src=\{labPass\}/),
  };
  console.log('[ticket-order]', JSON.stringify(pages));
  for (const [where, o] of Object.entries(pages)) {
    for (const [k, v] of Object.entries(o)) assert.ok(v >= 0, `${where}: the ${k} is missing from the ticket section`);
    assert.ok(o.ticket < o.save, `${where}: Save no longer comes after the ticket`);
    assert.ok(o.save < o.wallet, `${where}: the Wallet slot no longer comes directly after Save`);
    assert.ok(o.wallet < o.plusOnes, `${where}: the +1 list is above Save and Wallet — the owner put it below them`);
  }
});
