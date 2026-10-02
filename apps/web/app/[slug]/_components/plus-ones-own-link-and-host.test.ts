/**
 * PLUS-ONES — NAMED IN PLACE, THEIR OWN LINK, THE HOST'S NUMBER.
 * Prototype `rsvp_plus_ones_2026-09-29.html`, frames E · F · G (frames A–D are
 * `every-plus-one-is-named.test.ts`).
 *
 * Owner, verbatim, 2026-09-29: *"plus guests are only minimum questions. they
 * don't need to recommend songs and notes to the couple. They also get their
 * own QR Code. they can also link it to their account."* · *"adding +1-4
 * should be a host decision. and their QR auto adapts to it?"*
 *
 *   E · Me → Your guests → "Add name" opens the four boxes IN PLACE (never a
 *       link back to the reply), saved through the reply's ONE seat rule.
 *   F · a plus-one opening THEIR OWN link meets a minimal door: what the
 *       bringer filled, marked "from Maria"; ONLY what is missing of the four;
 *       the Terms; ONE "Save to my account" (the shipped SaveToAccount, the
 *       device's method); "Not now — just show my pass". No attendance, song,
 *       note or selfie — and never the full reply.
 *   G · the host's number is never refused: lowered below the named seats it
 *       is saved, nobody named is removed, and the row says "3 named · 1
 *       allowed" with a Remove per name (the host's own remove, its own
 *       confirm). "+3 (2 named)"; an unnamed seat is "+2 · TBA".
 *
 * 🪤 Harness as `every-plus-one-is-named.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { bringerSeatsFrom, planExtraSeats, seatPlaceholderLabel, type ExtraSeatRow } from '@/lib/extra-seats';
import {
  plusOneFilled,
  plusOneGate,
  plusOneMissing,
  plusOneWelcomeDue,
  type PlusOneRow,
} from '@/lib/plus-one-welcome';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
const SLUG = ['app', '[slug]'];
const G = ['app', 'dashboard', '[eventId]', 'guests'];

/** A function's body, from its signature to the next top-level declaration. */
function bodyOf(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.ok(at > -1, `${signature} is gone`);
  const next = src.slice(at + signature.length).search(/\n(?:export )?(?:async )?function /);
  return next > -1 ? src.slice(at, at + signature.length + next) : src.slice(at);
}

// ═══════════════════════════════════════════════════════════════════════════
// E · "Add name" opens IN PLACE on Me
// ═══════════════════════════════════════════════════════════════════════════

async function renderYourGuests(withAddName: boolean) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { YourGuests } = await import('./your-guests');
  return renderToStaticMarkup(
    React.createElement(YourGuests as never, {
      guests: [
        { guestId: 's1', name: 'Ben Reyes', inviteUrl: 'https://x/ben' },
        { guestId: 's2', name: null, inviteUrl: null },
        { guestId: 's3', name: null, inviteUrl: null },
      ],
      eventName: 'Indalecio & Claire',
      addNamesHref: '/ic/invite/reply#plus-ones',
      ...(withAddName
        ? { addName: { eventId: 'e-1', guestId: 'maria', askMeal: true, askDietary: true } }
        : {}),
    } as never),
  );
}

test('E · on Me, a TBA seat offers "Add name" in place — never a link back to the reply', async () => {
  const html = await renderYourGuests(true);
  assert.equal((html.match(/data-add-name-in-place/g) ?? []).length, 2, 'each TBA seat needs its own in-place Add name');
  assert.ok(!html.includes('/invite/reply'), 'Me still links a TBA seat back to the reply form');
  // Numbered by SEAT: the second and third seats.
  assert.match(html, /\+2 · TBA/);
  assert.match(html, /\+3 · TBA/);
});

test('E · the thank-you (no addName) keeps its link back to the reply boxes one screen behind', async () => {
  const html = await renderYourGuests(false);
  assert.ok(html.includes('/ic/invite/reply#plus-ones'), 'the thank-you lost its way to name a seat');
  assert.ok(!html.includes('data-add-name-in-place'));
});

test('E · Me passes the in-place naming, gated on the couple’s plus-ones switch', () => {
  const me = read(...SLUG, '_components', 'guest-me.tsx');
  assert.match(me, /addName=\{askPlusOnes \? \{ eventId, guestId, askMeal, askDietary \} : undefined\}/);
  const page = read(...SLUG, 'page.tsx');
  assert.match(page, /<GuestMe[\s\S]{0,400}guestId=\{guest\.guest_id\}/, 'Me is not told whose key it holds');
});

test('E · the in-place boxes are the reply’s four, posted through the reply’s own save', () => {
  const src = read(...SLUG, '_components', 'add-name-in-place.tsx');
  assert.match(src, /<PlusOneSeatPanels/, 'the in-place form is not the reply’s own four boxes');
  assert.match(src, /name="seat_names_only" value="1"/, 'the in-place save is not the seat-only branch');
  assert.match(src, /await submitRsvp\(eventId, guestId, fd\)/, 'the in-place save is not the guest’s own save');
  // The REAL reason is shown — never a stock "check your connection" (audit 2026-09-30).
  assert.match(src, /catch \(err\) \{[\s\S]{0,200}setFailed\(seatNameFailure\(err\)\)/, 'the reason a name did not save never reaches the guest');
  assert.match(src, /idPrefix=\{`me-\$\{seatId\}-`\}/, 'the boxes would share ids with the reply on the same page');
  for (const extra of ['song_title', 'guest_note', 'rsvp_status', 'selfie']) {
    assert.ok(!src.includes(extra), `the in-place naming asks for ${extra}`);
  }
  // A failure is SAID, never a closed form that looks saved.

  assert.match(src, /role="alert"/);
});

test('E · an id prefix never renames a field the seat rule reads', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PlusOneSeatPanels } = await import('./rsvp-plus-ones');
  const html = renderToStaticMarkup(
    React.createElement(PlusOneSeatPanels, {
      slots: [{ seatId: 's2', first: '', last: '', meal: 'no_preference', dietary: '' }],
      active: 0,
      arranged: false,
      askMeal: true,
      askDietary: true,
      idPrefix: 'me-s2-',
    }),
  );
  for (const f of ['plus_one_first_name_1', 'plus_one_last_name_1', 'plus_one_meal_1', 'plus_one_dietary_1']) {
    assert.match(html, new RegExp(`id="me-s2-${f}"`), `${f} id not prefixed`);
    assert.match(html, new RegExp(`name="${f}"`), `${f} name changed`);
  }
  assert.match(html, /name="plus_one_seat_id_1" value="s2"/, 'the box does not say which seat it names');
});

test('E · the seat-only branch: same key check, the ONE seat rule, returns before the reply, thrown on failure', () => {
  const actions = read(...SLUG, 'actions.ts');
  const submit = bodyOf(actions, 'export async function submitRsvp(');
  const branch = submit.indexOf("clean(formData.get('seat_names_only')) === '1'");
  const keyCheck = submit.indexOf('session.guest_id !== guestId');
  const reply = submit.indexOf("clean(formData.get('rsvp_status'))");
  assert.ok(branch > -1, 'the in-place naming has no branch');
  assert.ok(keyCheck > -1 && keyCheck < branch, 'the branch runs before THIS guest’s key is checked');
  assert.ok(branch < reply, 'the branch runs after the reply is read — it must touch nothing of it');
  const seg = submit.slice(branch, reply);
  assert.match(seg, /await nameTheSeats\(seatAdmin, eventId, guestId, formData, resolveRsvpAsk\(/, 'not the reply’s seat rule');
  assert.match(seg, /if \(!saved\.ok\) throw new Error/, 'a failed name is not said');
  assert.match(seg, /revalidatePath\(`\/\$\{evAsk\.slug\}`\)/, 'Me does not re-render the seat as named');
  assert.match(seg, /return;/);
  // The reply path uses the SAME rule — one mechanism, never two.
  assert.match(submit, /await nameTheSeats\(admin, eventId, guestId, formData, ask\);/);
  // One rule, wrapped since 2026-09-29 by the linked-name lock (a-linked-plus-one-keeps-their-name.test.ts).
  assert.equal((actions.match(/planSeatNames\(seatNames,/g) ?? []).length, 1, 'a second seat writer appeared');
});

// ═══════════════════════════════════════════════════════════════════════════
// F · a plus-one's OWN link — minimal, prefilled, no extras
// ═══════════════════════════════════════════════════════════════════════════

const BEN: PlusOneRow = {
  first_name: 'Ben',
  last_name: 'Reyes',
  plus_one_name_confirmed_at: '2026-09-29T00:00:00Z',
  meal_preference: 'beef',
  dietary_restrictions: null,
};
const ASK_ALL = { meal: true, dietary: true };

test('F · only what is MISSING of the four is asked; what the bringer filled is shown', () => {
  assert.deepEqual(plusOneMissing(BEN, ASK_ALL), { name: false, meal: false, dietary: true });
  assert.deepEqual(plusOneFilled(BEN, ASK_ALL), { name: true, meal: true, dietary: false });
  const tba: PlusOneRow = { ...BEN, first_name: 'TBA', last_name: '+1', plus_one_name_confirmed_at: null, meal_preference: null };
  assert.deepEqual(plusOneMissing(tba, ASK_ALL), { name: true, meal: true, dietary: true });
  // A switch the couple turned off is neither asked nor shown.
  assert.deepEqual(plusOneMissing(tba, { meal: false, dietary: false }), { name: true, meal: false, dietary: false });
  assert.deepEqual(plusOneFilled(BEN, { meal: false, dietary: false }), { name: true, meal: false, dietary: false });
});

test('F · the key gate for a plus-one: name and (asked) meal only — never attendance, never dietary', () => {
  assert.equal(plusOneGate(BEN, ASK_ALL, false), 'inside', 'a named plus-one with a meal was held at the door');
  assert.equal(plusOneGate({ ...BEN, meal_preference: null }, ASK_ALL, false), 'welcome');
  assert.equal(plusOneGate({ ...BEN, meal_preference: null }, { meal: false, dietary: true }, false), 'inside');
  assert.equal(plusOneGate({ ...BEN, meal_preference: null }, ASK_ALL, true), 'inside', 'a final list still gates');
});

test('F · the welcome shows once per browser, and never to a seat already kept in an account', () => {
  assert.equal(plusOneWelcomeDue({ guestId: 'ben', welcomedCookie: undefined, seatHeld: false }), true);
  assert.equal(plusOneWelcomeDue({ guestId: 'ben', welcomedCookie: 'ben', seatHeld: false }), false);
  assert.equal(plusOneWelcomeDue({ guestId: 'ben', welcomedCookie: 'carmen', seatHeld: false }), true);
  assert.equal(plusOneWelcomeDue({ guestId: 'ben', welcomedCookie: undefined, seatHeld: true }), false);
});

test('F · their OWN link routes a named plus-one to their door, not the Event Hub or the reply', () => {
  const redeem = read(...SLUG, 'redeem', 'route.ts');
  const at = redeem.indexOf('plusOneWelcomeDue({');
  assert.ok(at > -1, 'the link never asks whether the welcome is due');
  assert.match(redeem.slice(at - 200, at + 500), /guest\.plus_one_of_guest_id !== null/);
  assert.match(redeem.slice(at, at + 500), /\/welcome`/);
});

test('F · the Event Hub gates a plus-one to THEIR door, and spares them the full reply', () => {
  const page = read(...SLUG, 'page.tsx');
  const plus = page.indexOf('plusOneGate(');
  const reply = page.indexOf('redirect(inviteReplyPath(event.slug ?? slug))');
  assert.ok(plus > -1 && reply > plus, 'the plus-one gate is gone or runs after the reply gate');
  assert.match(page.slice(plus, plus + 600), /=== 'welcome'\s*\)\s*\{\s*redirect\(`\/\$\{event\.slug \?\? slug\}\/welcome`\)/);
  assert.match(page, /if \(!isPlusOne && keyGate\.kind === 'ask'/, 'a plus-one is still sent to the full reply');
});

const DOOR = () => read(...SLUG, 'welcome', '_components', 'plus-one-door.tsx');

async function renderDoor(row: PlusOneRow, extra: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  // A provider is on, as in production — without one the Save is the guest's own link.
  process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';
  const { PlusOneDoor } = await import('../welcome/_components/plus-one-door');
  return renderToStaticMarkup(
    React.createElement(PlusOneDoor as never, {
      home: 'ic',
      eventId: 'e-1',
      primaryFirst: 'Maria',
      theOrganizerPossessive: 'the couple’s',
      row,
      missing: plusOneMissing(row, ASK_ALL),
      filled: plusOneFilled(row, ASK_ALL),
      inside: plusOneGate(row, ASK_ALL, false) === 'inside',
      account: { kind: 'offer' },
      personalLink: 'https://www.setnayan.com/ic?invite=0123456789abcdef0123456789abcdef',
      userAgent: null,
      termsCarried: false,
      passSvg: null,
      showPass: false,
      confirmAction: async () => {},
      abandonAction: async () => {},
      ...extra,
    } as never),
  );
}

test('F · Ben’s door: his name and meal shown "from Maria", ONLY dietary asked, the Terms, one Save', async () => {
  const html = await renderDoor(BEN);
  assert.equal((html.match(/from Maria/g) ?? []).length, 2, 'the prefilled name and meal are not both marked');
  assert.match(html, /Ben Reyes/);
  assert.match(html, />Beef</);
  // The missing section asks dietary alone.
  const missing = html.slice(html.indexOf('data-plus-one-missing'));
  assert.match(missing, /One more thing/);
  assert.match(missing, /name="dietary_restrictions"/);
  assert.ok(!/name="first_name"/.test(missing), 'the name Maria gave is asked again');
  assert.ok(!/name="meal_preference"/.test(missing), 'the meal Maria gave is asked again');
  assert.match(html, /name="terms_agreed"/);
  assert.equal((html.match(/Save to my account/g) ?? []).length, 1, 'not ONE save button');
  assert.match(html, /just show my ticket/);
});

test('F · an unnamed seat’s door asks the name (required) — and "Not now" still skips it', async () => {
  const html = await renderDoor({ ...BEN, first_name: 'TBA', last_name: '+1', plus_one_name_confirmed_at: null, meal_preference: null });
  const missing = html.slice(html.indexOf('data-plus-one-missing'));
  /** The one tag carrying `name="…"`, whatever order React wrote its attributes in. */
  const tag = (src: string, name: string) => src.match(new RegExp(`<[a-z]+[^>]*name="${name}"[^>]*>`))?.[0] ?? '';
  assert.match(tag(missing, 'first_name'), /required=""/, 'an unnamed seat can save with no name');
  assert.match(tag(missing, 'meal_preference'), /required=""/);
  const notNow = html.match(/<button[^>]*value="pass"[^>]*>/)?.[0] ?? '';
  assert.match(notNow, /formNoValidate=""/, '"Not now" is blocked by the boxes it exists to skip');
  assert.match(notNow, /name="then"/);
});

test('F · the door asks nothing beyond the four — no attendance, song, note, selfie or mobile', async () => {
  const page = read(...SLUG, 'welcome', 'page.tsx');
  const actions = read(...SLUG, 'welcome', 'actions.ts');
  for (const src of [page, DOOR(), actions]) {
    for (const extra of ['rsvp_status', 'song_title', 'guest_note', 'selfie', 'contact_mobile']) {
      assert.ok(!src.includes(extra), `the plus-one's door touches ${extra}`);
    }
  }
  const html = await renderDoor({ ...BEN, meal_preference: null });
  for (const extra of ['rsvp_status', 'song_title', 'guest_note', 'contact_mobile', 'type="file"']) {
    assert.ok(!html.includes(extra), `the rendered door asks ${extra}`);
  }
});

test('F · ONE "Save to my account" — the shipped SaveToAccount — and "Not now — just show my pass"', () => {
  const door = DOOR();
  assert.match(door, /<SaveToAccount[\s\S]{0,400}through=\{\{ action: confirmAction, fields, after:/, 'the door does not use the shipped button');
  assert.match(door, /name="then"\s+value="pass"\s+formNoValidate/, '"Not now" must skip what the save requires');
  const page = read(...SLUG, 'welcome', 'page.tsx');
  assert.match(page, /passSvg = await renderInvitationQrSvg\(/, '"just show my pass" shows no pass');
  assert.match(page, /<PlusOneDoor/);
});

test('F · the save writes only their own four, then takes the device’s method through the shipped doors', () => {
  const actions = read(...SLUG, 'welcome', 'actions.ts');
  const save = bodyOf(actions, 'export async function confirmPlusOneName(');
  assert.match(save, /\.not\('plus_one_of_guest_id', 'is', null\)/, 'the door can write a row that is not a plus-one');
  assert.match(save, /\.eq\('guest_id', guest\.guest_id\)/);
  assert.match(save, /session\.guest_id/, 'the guest is not the one the pass names');
  assert.match(save, /saveMethodFor\(/, 'the method is not the device’s');
  assert.match(save, /signInWithApple\(next\)/);
  // 📵 No emailed link any more (owner 2026-09-29, "NO EMAIL TO GUESTS").
  assert.doesNotMatch(save, /claimAccountAction|sendEmail|sendEventAccountMagicLink/, 'the plus-one door mails a sign-in link again');
  assert.match(save, /PLUS_ONE_WELCOMED_COOKIE/);
  // "Not now" never demands a name.
  assert.match(save, /if \(then !== 'pass' && unnamed && \(!first_name \|\| !last_name\)\)/);
});

test('F · SaveToAccount’s through-mode is ONE form: the fields, the tick, the device’s button', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveToAccount } = await import('./save-to-account');
  process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED = 'true';
  const html = renderToStaticMarkup(
    React.createElement(SaveToAccount as never, {
      state: { kind: 'offer' },
      eventId: 'e-1',
      slug: 'ic',
      personalLink: 'https://www.setnayan.com/ic?invite=0123456789abcdef0123456789abcdef',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1',
      termsCarried: false,
      through: {
        action: async () => {},
        fields: React.createElement('input', { name: 'dietary_restrictions' }),
        after: React.createElement('button', { name: 'then', value: 'pass' }, 'just show my pass'),
      },
    } as never),
  );
  assert.equal((html.match(/<form/g) ?? []).length, 1, 'the answers and the button are not one form');
  assert.match(html, /name="dietary_restrictions"/);
  assert.match(html, /name="terms_agreed"/, 'the Terms are not asked with the save');
  assert.match(html, /data-save-method="apple"/, 'an iPhone is not given Apple — the tick rides the same form');
  assert.match(html, /just show my pass/);
  delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
});

test('F · 📵 inside Messenger the door saves the answers and hands over "Open in your browser" — never an email', async () => {
  const html = await renderDoor(BEN, {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430.0]',
  });
  assert.equal((html.match(/Save to my account/g) ?? []).length, 1, 'the sheet eyebrow aside, no provider button may show');
  assert.match(html, /data-save-open-in-browser=""/, 'Messenger is not handed "Open in your browser"');
  assert.match(html, />Open in your browser</);
  assert.match(html, /<button[^>]*value="done"[^>]*>Save<\/button>|>Save<\/button>/, 'the answers have no plain Save');
  assert.doesNotMatch(html, /type="email"|Check your email/);
});

// ═══════════════════════════════════════════════════════════════════════════
// G · the host's number — never refused, a warning, a Remove per name
// ═══════════════════════════════════════════════════════════════════════════

const named = (id: string, at: string): ExtraSeatRow => ({ guest_id: id, first_name: 'Nora', confirmed_at: at, created_at: at });

test('G · lowering below the named seats is SAVED — no refusal, and nobody named is removed', () => {
  const plan = planExtraSeats(1, [named('nora', '1'), named('jun', '2'), named('bea', '3')]);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.remove, [], 'a named person was removed by a number');
  assert.equal(plan.over, 2);
  const sync = read('lib', 'extra-seats-sync.ts');
  const check = bodyOf(sync, 'export async function checkExtraSeats(');
  assert.ok(!/named/.test(check.replace(/Named seats beyond/g, '')), 'checkExtraSeats refuses on named seats again');
  assert.ok(!sync.includes('plan.reason'), 'a named-seat refusal is back');
});

test('G · an unnamed seat reads "+2 · TBA" — new rows and old ones alike, numbered by seat', () => {
  const sync = read('lib', 'extra-seats-sync.ts');
  assert.match(sync, /display_name: seatPlaceholderLabel\(seats\.length \+ i\)/);
  assert.ok(!/brought by/.test(sync), 'the placeholder still says "brought by"');
  const seats = bringerSeatsFrom([
    { guest_id: 'maria', plus_one_of_guest_id: null, first_name: 'Maria', last_name: 'Santos', display_name: null, created_at: '0' },
    { guest_id: 'c', plus_one_of_guest_id: 'maria', first_name: 'TBA', last_name: '+1', display_name: '+ TBA 3 · brought by Maria', created_at: '3' },
    { guest_id: 'a', plus_one_of_guest_id: 'maria', first_name: 'Ben', last_name: 'Reyes', display_name: null, created_at: '1' },
    { guest_id: 'b', plus_one_of_guest_id: 'maria', first_name: 'Carmen', last_name: 'Santos', display_name: null, created_at: '2' },
  ]);
  assert.deepEqual(seats.maria, [
    { guest_id: 'a', named: true, label: 'Ben Reyes' },
    { guest_id: 'b', named: true, label: 'Carmen Santos' },
    { guest_id: 'c', named: false, label: seatPlaceholderLabel(2) },
  ]);
  assert.equal(seatPlaceholderLabel(2), '+3 · TBA');
});

test('G · the row says "+3 (2 named)", and "3 named · 1 allowed" with a Remove per name when over', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PlusOneSeatsSummary, PlusOneOverNote } = await import(
    '../../dashboard/[eventId]/guests/_components/plus-one-seats-note'
  );
  const two = [
    { guest_id: 'a', named: true, label: 'Ben Reyes' },
    { guest_id: 'b', named: true, label: 'Carmen Santos' },
    { guest_id: 'c', named: false, label: '+3 · TBA' },
  ];
  assert.match(
    renderToStaticMarkup(React.createElement(PlusOneSeatsSummary, { count: 3, seats: two })),
    />\+3 \(2 named\)<\/span>$/,
  );
  // Everyone fits: no warning.
  assert.equal(
    renderToStaticMarkup(React.createElement(PlusOneOverNote, { eventId: 'e', guestName: 'Maria Santos', count: 3, seats: two })),
    '',
  );
  const three = [
    { guest_id: 'n', named: true, label: 'Nora Santos' },
    { guest_id: 'j', named: true, label: 'Jun Santos' },
    { guest_id: 'b', named: true, label: 'Bea Santos' },
  ];
  const over = renderToStaticMarkup(
    React.createElement(PlusOneOverNote, { eventId: 'e', guestName: 'Tito Boy Santos', count: 1, seats: three }),
  );
  assert.match(over, /3 named · 1 allowed\./);
  assert.equal((over.match(/aria-label="Delete /g) ?? []).length, 3, 'not one Delete per name');
});

test('G · Delete is the host’s own delete-a-guest, behind the one warning — no second delete', () => {
  // ⤷ 2026-10-03 (owner, DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
  // ACCEPTED"): `RemoveGuestConfirm` + `softDeleteGuest` were retired; every
  // delete is the one warning + `useGuestRemoval` (with Undo).
  const note = read(...G, '_components', 'plus-one-seats-note.tsx');
  assert.match(note, /<DeleteGuestButton eventId=\{eventId\} guestId=\{s\.guest_id\} guestName=\{s\.label\} \/>/);
  const del = read(...G, '_components', 'guest-delete.tsx');
  assert.match(del, /export function DeleteGuestButton\(/);
  assert.match(del, /useGuestRemoval\(eventId\)/);
  assert.match(del, /<DeleteGuestSheet\b/);
});

test('G · both roster rows draw the summary and the warning, from the FULL roster', () => {
  const list = read(...G, '_components', 'guest-list-multiselect.tsx');
  for (const row of ['function DesktopRow(', 'function MobileListRow(']) {
    // ⤷ 2026-09-30, the full-width list: the desktop row draws its +N column
    // through RosterCell, so its baseline is the row plus the cells it draws.
    const body =
      row === 'function DesktopRow(' && /<RosterCell\b/.test(bodyOf(list, row))
        ? bodyOf(list, row) + bodyOf(list, 'function RosterCell(')
        : bodyOf(list, row);
    assert.match(body, /<PlusOneSeatsSummary count=\{plusOneSeats\(guest\)\} seats=\{extraSeats\} \/>/, `${row} lacks "+N (k named)"`);
    assert.match(body, /<PlusOneOverNote/, `${row} lacks the "named · allowed" warning`);
    assert.match(body, /const shownName = seatLabel \?\? /, `${row} does not label an unnamed seat "+N · TBA"`);
  }
  const page = read(...G, 'page.tsx');
  assert.match(page, /seatsByBringer=\{bringerSeatsFrom\(guests\)\}/, 'seats are counted from a filtered view');
});
