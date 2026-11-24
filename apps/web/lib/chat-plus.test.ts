/**
 * ＋ THE (+)'S ROWS ARE THE APPROVED ONES — IN THE MENU'S ORDER (Supplier Build 3 · lane B; DECISION_LOG 📌 2026-11-08 ·
 * 2026-11-11 "THE PICKED-CLIENT MENU AND THE CHAT (+) FOLLOW ONE ORDER").
 *
 * 🧰 20 NOV 2026 — UNICHAT PART B (owner, approving the live drawing `UNICHAT-LIVE-2026-11-19.html`: "build it now, I am
 * happy with the design"; the approval settles the build plan's conflicts 1 and 2 and supersedes the rulings named):
 *   · SEVERAL (+) CARDS MAY BE OPEN AT ONCE — supersedes 8 Nov "one (+) at a time": the gate never shuts (test 3);
 *   · THE (+) HOLDS ONLY THINGS YOU SEND — supersedes 9 Nov "Report a problem back into the (+)": Report a problem
 *     lives in the ⋯, and See every version is the strip's Deal box and the quote card's own row (tests 1 · 1b · 9);
 *   · A TYPED PRICE OR DAY OFFERS ITS TOOL (test 10).
 *
 * ✅ 21 NOV 2026 — ＋ FINAL (owner "yes." on `chat_plus_final_v1_fable.html`, DECISION_LOG "CHAT ＋ FINAL — APPROVED"):
 *   ONE tray, two tiles per row, FIXED places in the deal's order — it supersedes the 11 Nov "the (+) follows the menu"
 *   order and the 19 Nov plain-word groups (the old 1d · 1f), and brings Every version back as the supplier's LAST tile.
 *   The host's tray is two jobs, Ask · Share. Tests 1 · 1w · 1v · 1b · 1c · 8 · 9 hold it.
 *
 * What would silently undo it:
 *   1. a row the prototype names drops out or changes order — or a place to go (Report a problem, See every version)
 *      creeps back into the (+);
 *   1d. the (+) and the picked client's menu drift apart — a row sits under a page that comes LATER in the menu than the
 *       page of the row above it (the order is DERIVED here from `PICKED_CLIENT_PAGES`, never hand-copied), or a row
 *       names a page the menu does not have;
 *   1e. the dupe comes back — two rows on the supplier's (+) that both pick from the phone's gallery (owner 11 Nov:
 *       *"The (+) has dupes?"*), or the one Photos & files row stops saying it takes the phone's photos;
 *   2. what the app pins by itself (booking ask, confirm a payment, call time, guest count) creeps back in as a row;
 *   3. the (+) SHUTS again while a card waits for its answer (the 8 Nov rule the 20 Nov approval superseded);
 *   4. a card wears a glyph of its own instead of its topic's.
 *
 * SABOTAGE (11 Nov): swapping Quote above Ask for access in `supplierPlusRows` → 1 and 1d RED; mapping `decision` to
 * 'files' in `PLUS_ROW_PAGE` → 1d RED; adding a `photo` row back to the supplier → 1e RED.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-plus.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AFTER_BOOKING,
  NEGOTIATE_GROUP,
  NO_VERSIONS_YET,
  ONE_POLL_REASON,
  PLUS_CARD_TOPIC,
  PLUS_ROW_PAGE,
  PLUS_TRAY_UNVERIFIED,
  PLUS_TRAY_WORD,
  filterSlash,
  withTrayWidths,
  hostPlusRows,
  plusGate,
  typedOffer,
  slashPick,
  slashQuery,
  sheetSlashRows,
  slashRows,
  supplierPlusRows,
  type PlusRow,
  type RunningTopic,
} from './chat-plus';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { CHAT_TOPICS } from './topic-icons';

test('1 · ＋ FINAL — supplier tiles in their fixed places: the quote first · money · time & files · questions · the tools that wait for booking · Every version last', () => {
  // Owner 21 Nov 2026, "CHAT ＋ FINAL — APPROVED" (frozen drawing `chat_plus_final_v1_fable.html`). The drawing draws
  // neither Drop an offer nor Camera and lists no removal, so both are KEPT in fixed places by the same order. Partner
  // card is drawn before Every version once its card exists — never a dead tile. Ask for access LEFT the ＋ (the later
  // 21 Nov row, "NO 'ASK FOR ACCESS' TILE ON THE CHAT ＋"): asking lives in the Their event list.
  const FINAL = ['Change quote', 'Drop an offer', 'Payment plan', 'Ask for a payment', 'Dates & times', 'Photos & files', 'Camera', 'Decision', 'Poll', 'Form', 'Share from your widgets', 'Every version'];
  for (const opts of [{ paid: false }, { paid: true }, { paid: false, booked: true }, { paid: false, pollOpen: true }, { paid: false, verified: false }]) {
    assert.deepEqual(supplierPlusRows(opts).map((r) => r.label), FINAL, `places moved for ${JSON.stringify(opts)}`);
  }
  // No quote yet: the first tile is Make a quote, in the SAME place; Every version stays, shut with its reason.
  const none = supplierPlusRows({ paid: false, hasQuote: false });
  assert.deepEqual(none.map((r) => r.key), supplierPlusRows({ paid: false }).map((r) => r.key));
  assert.deepEqual(none.at(-1)!.shutNow, { reason: NO_VERSIONS_YET });
  assert.deepEqual(none.find((r) => r.key === 'offer')!.shutNow, { reason: NO_VERSIONS_YET }, 'an offer with no quote to apply it to is open');
  const booked = supplierPlusRows({ paid: false, booked: true });
  assert.deepEqual(booked.find((r) => r.key === 'offer')!.shutNow, booked.find((r) => r.key === 'quote')!.shutNow);
  assert.ok(!hostPlusRows({ canLogPayment: true }).some((r) => r.key === 'offer'), 'the hosts never drop an offer — it is the shop’s');
  assert.equal(supplierPlusRows({ paid: true }).find((r) => r.key === 'quote')!.line, 'A new version · the paid one is the floor');
  assert.equal(supplierPlusRows({ paid: false }).find((r) => r.key === 'photos')!.card, 'photos', 'Photos & files drops the card whose phone path is the composer’s own picker');
});

test('1w · two tiles per row: the first tile is full width, and the last when it would sit alone', () => {
  const sup = supplierPlusRows({ paid: false });
  assert.deepEqual(sup.filter((r) => r.wide).map((r) => r.key), sup.length % 2 === 0 ? ['quote', 'versions'] : ['quote']);
  const host = hostPlusRows({ canLogPayment: true });
  assert.deepEqual(host.filter((r) => r.wide).map((r) => r.key), ['counter'], 'the host’s first ask is the wide one');
  assert.deepEqual(withTrayWidths([1, 2, 3].map((n) => ({ key: 'poll', label: String(n), line: '', card: 'poll', door: null }))).map((r) => Boolean(r.wide)), [true, false, false]);
  assert.deepEqual(withTrayWidths([1, 2].map((n) => ({ key: 'poll', label: String(n), line: '', card: 'poll', door: null }))).map((r) => Boolean(r.wide)), [true, true]);
});

test('1v · an unverified shop: every tile locked, the fix said once by the tray (owner 21 Nov)', () => {
  const rows = supplierPlusRows({ paid: false, verified: false });
  for (const r of rows) assert.deepEqual(r.shutNow, { reason: PLUS_TRAY_UNVERIFIED }, `${r.label} is open on an unverified shop`);
  // Unknown (a failed read) draws open — the server's gate decides each send (lib/shop-plus-gate.server.ts).
  assert.ok(supplierPlusRows({ paid: false, verified: null }).some((r) => !r.shutNow));
  const sheet = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx'), 'utf8');
  assert.match(sheet, /data-plus-unverified=""/);
  assert.match(sheet, /\{PLUS_TRAY_UNVERIFIED_CTA\}/);
});

test('1a · the host’s (+) has no generic Ask for a change — and the slash list has no /ask (ruling 6076)', () => {
  for (const rows of [hostPlusRows({ canLogPayment: true }), hostPlusRows({ canLogPayment: false })]) {
    assert.equal(rows.some((r) => r.key === 'ask' || r.card === 'ask' || /ask for a change/i.test(r.label)), false);
    assert.equal(slashRows(rows, true).some((r) => r.card === 'ask'), false);
  }
});

test('1b · ＋ FINAL — the host’s tray is two jobs, Ask and Share; no Every version on the host ＋ (controller call, 21 Nov)', () => {
  const host = hostPlusRows({ canLogPayment: true });
  assert.deepEqual(host.map((r) => [r.tray, r.label]), [
    ['ask', 'Counter'],
    ['ask', 'Payment plan'],
    ['ask', 'Dates & times'],
    ['ask', 'Decision'],
    ['ask', 'Poll'],
    ['share', 'Photos & files'],
    ['share', 'Camera'],
    ['share', 'Log a payment'],
  ]);
  assert.deepEqual(PLUS_TRAY_WORD, { ask: 'Ask', share: 'Share' });
  // A coordinator for the hosts drops Log a payment — only hosts log their own money.
  assert.ok(!hostPlusRows({ canLogPayment: false }).some((r) => r.key === 'logpay'));
  assert.ok(!host.some((r) => r.key === 'versions' || r.opensVersions), 'Every version is on the host ＋');
  // ONE phone picker on the host side too (11 Nov dupe).
  assert.deepEqual(host.filter((r) => r.attach === 'photo' || r.card === 'file' || r.card === 'photos').map((r) => r.key), ['file']);
});

test('1c · a tool that waits for booking is a normal tile, dimmed, with “After booking” under its name — never hidden', () => {
  const shut = supplierPlusRows({ paid: false }).filter((r) => r.shutUntilAgreement);
  assert.deepEqual(shut.map((r) => r.key), ['payment', 'form']);
  for (const r of shut) assert.equal(r.shutUntilAgreement!.reason, AFTER_BOOKING);
  assert.equal(AFTER_BOOKING, 'After booking');
  assert.deepEqual(hostPlusRows({ canLogPayment: true }).find((r) => r.key === 'logpay')!.shutUntilAgreement, { reason: AFTER_BOOKING });
});

test('1e · ONE phone picker on the supplier’s ＋ — Photos & files, and no second gallery row', () => {
  const rows = supplierPlusRows({ paid: false });
  const fromPhone = rows.filter((r) => r.attach === 'photo' || r.card === 'photos' || r.card === 'file');
  assert.deepEqual(fromPhone.map((r) => r.key), ['photos'], 'two rows pick from the phone again — the 11 Nov dupe');
  assert.ok(!rows.some((r) => r.key === 'photo'), 'the separate Photo row is back');
  assert.equal(rows.filter((r) => r.attach === 'camera').length, 1, 'Camera (take one now) stays — it is a different act');
});

test('2 · what pins by itself is NOT a (+) row', () => {
  const all = [...supplierPlusRows({ paid: false }), ...hostPlusRows({ canLogPayment: true })].map((r) => r.label.toLowerCase());
  for (const gone of ['answer their booking ask', 'confirm a payment', 'your call time', 'guest count changed', 'won', 'lost']) {
    assert.ok(!all.some((l) => l.includes(gone)), gone);
  }
});

test('3 · SEVERAL (+) CARDS MAY BE OPEN AT ONCE — the gate never shuts (owner 20 Nov 2026, approving the live drawing; it supersedes 8 Nov "one (+) at a time")', () => {
  const mine: RunningTopic = { key: 'k', card: 'meeting', title: 'Meeting', by: 'you', status: 'draft', anchorId: 'a' };
  assert.deepEqual(plusGate(null), { shut: false });
  // A card you sent that still waits for its answer does not stop the next one — nor does a draft, nor theirs.
  assert.deepEqual(plusGate({ ...mine, status: 'sent' }), { shut: false });
  assert.deepEqual(plusGate(mine), { shut: false });
  assert.deepEqual(plusGate({ ...mine, by: 'them' }), { shut: false });
  // The (+) button and the composer no longer ask the gate at all — a tool in the box turns the ＋ into ← instead.
  const here = dirname(fileURLToPath(import.meta.url));
  const sheet = stripComments(readFileSync(join(here, '..', 'app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx'), 'utf8'));
  const composer = stripComments(readFileSync(join(here, '..', 'app/_components/chat-send-form.tsx'), 'utf8'));
  assert.ok(!/plusGate|Finish or close/.test(sheet), 'the (+) is gated on an open card again');
  assert.ok(!/plusGate|Finish or close/.test(composer), 'the composer gates "/" or the suggested step on an open card again');
  assert.match(sheet, /aria-label=\{back \? 'Back to message' : 'Add to the chat'\}/, 'the ＋ does not turn into ← while a tool is open');
});

test('4 · every card wears a known topic (its icon is TOPIC_ICON[topic])', () => {
  for (const [card, topic] of Object.entries(PLUS_CARD_TOPIC)) {
    assert.ok((CHAT_TOPICS as readonly string[]).includes(topic), `${card} → ${topic}`);
  }
  assert.equal(PLUS_CARD_TOPIC.meeting, 'schedule');
  assert.equal(PLUS_CARD_TOPIC.photos, 'files');
});

// ── 🗳 THE POLL ROW AND ⌨ THE SLASH LIST (owner 11 Nov 2026) ─────────────────────────────────────────────────────────
// What would silently undo it:
//   5. the Poll row stops sitting under Chat right after Decision on either side, or stops going grey (with its reason,
//      never hidden) while a poll is open — or goes grey when none is;
//   6. the slash list stops being the (+)'s own rows: a card row missing, an extra row, another order, other words, or a
//      shut row losing its reason;
//   7. Enter picks a greyed row.
// SABOTAGE (11 Nov): dropping `pollRow(opts.pollOpen)` from hostPlusRows → 1b and 5 RED; `shutNow` ignored in slashRows
// → 6 and 7 RED.

test('5 · the Poll tile sits right after Decision on both sides, greyed with its reason only while a poll is open', () => {
  for (const [side, rowsOf] of [
    ['supplier', (pollOpen: boolean) => supplierPlusRows({ paid: false, pollOpen })],
    ['host', (pollOpen: boolean) => hostPlusRows({ canLogPayment: true, pollOpen })],
  ] as const) {
    const keys = rowsOf(false).map((r) => r.key);
    assert.equal(keys.indexOf('poll'), keys.indexOf('decision') + 1, `${side}: Poll is not right after Decision`);
    const poll = rowsOf(false).find((r) => r.key === 'poll')!;
    assert.equal(poll.card, 'poll');
    assert.equal(poll.shutNow, undefined, `${side}: the Poll row is shut with no poll open`);
    assert.deepEqual(rowsOf(true).find((r) => r.key === 'poll')!.shutNow, { reason: ONE_POLL_REASON });
    assert.equal(ONE_POLL_REASON, 'One poll at a time · close the open one first');
    // Only the Poll tile — an open poll shuts nothing else.
    assert.deepEqual(rowsOf(true).filter((r) => r.shutNow).map((r) => r.key), ['poll']);
  }
  assert.equal(PLUS_CARD_TOPIC.poll, 'poll');
});

test('6 · the slash list IS the (+): the same card rows, order, words and reasons — both sides, every state', () => {
  const cases = [
    ['supplier · asked', supplierPlusRows({ paid: false }), false],
    ['supplier · booked', supplierPlusRows({ paid: false }), true],
    ['supplier · paid · poll open', supplierPlusRows({ paid: true, pollOpen: true }), true],
    ['host', hostPlusRows({ canLogPayment: true }), true],
    ['host · coordinator · poll open', hostPlusRows({ canLogPayment: false, pollOpen: true }), true],
  ] as const;
  for (const [side, rows, booked] of cases) {
    const list = slashRows(rows, booked);
    const cards = rows.filter((r) => r.card);
    assert.deepEqual(list.map((r) => r.key), cards.map((r) => r.key), `${side}: the slash list is not the (+)'s card rows in order`);
    assert.deepEqual(list.map((r) => r.label), cards.map((r) => r.label), `${side}: other words`);
    assert.deepEqual(list.map((r) => r.line), cards.map((r) => r.line), `${side}: other lines`);
    for (const [i, r] of cards.entries()) {
      const want = r.shutNow ?? (r.shutUntilAgreement && !booked ? r.shutUntilAgreement : null);
      assert.deepEqual(list[i]!.shut, want, `${side}: '${r.label}' shut reason differs from the (+)`);
    }
  }
  // The composer's list is published from the rows the (+) SHEET draws (its shut already decided) — the same list.
  for (const [side, rows, booked] of cases) {
    const drawn = rows.map((r) => ({ ...r, shut: r.shutNow ?? (r.shutUntilAgreement && !booked ? r.shutUntilAgreement : null) }));
    assert.deepEqual(sheetSlashRows(drawn), slashRows(rows, booked), `${side}: the composer's list is not the sheet's`);
  }
  // The words the ruling names (M14 + /meeting /decision /poll), Negotiate's first (12 Nov: /quote · /plan; the hosts' /ask · /counter).
  assert.deepEqual(slashRows(supplierPlusRows({ paid: false }), true).map((r) => `/${r.word}`), [
    '/quote', '/offer', '/plan', '/payment', '/meeting', '/file', '/decision', '/poll', '/form',
  ]);
  assert.deepEqual(slashRows(hostPlusRows({ canLogPayment: true }), true).slice(0, 2).map((r) => `/${r.word}`), ['/counter', '/plan']); // no /ask — ruling 6076
  // "/p" → Payment plan (its word /plan) · Ask for a payment · Photos & files · Poll.
  assert.deepEqual(filterSlash(slashRows(supplierPlusRows({ paid: false }), false), 'p').map((r) => r.label), ['Payment plan', 'Ask for a payment', 'Photos & files', 'Poll']);
  assert.equal(slashQuery('/po'), 'po');
  assert.equal(slashQuery('/'), '');
  assert.equal(slashQuery('hello /poll'), null, 'a slash that is not the first character is just a character');
  assert.equal(slashQuery('/poll now'), null, 'a space ends the shortcut');
});

test('7 · Enter never picks a greyed row', () => {
  const asked = slashRows(supplierPlusRows({ paid: false, pollOpen: true }), false);
  const byKey = (k: string) => asked.findIndex((r) => r.key === k);
  assert.equal(slashPick(asked, byKey('poll')), null, 'Enter opened a second poll');
  assert.equal(slashPick(asked, byKey('payment')), null, 'Enter picked a row shut until they book you');
  assert.equal(slashPick(asked, byKey('decision')), 'decision');
  assert.equal(slashPick(asked, 99), null);
});

// ── ＋ FINAL: the first place is the deal's own move — the supplier's quote, the host's counter (owner 21 Nov) ──────────
test('8 · the first tile is the deal’s move, full width — Change quote (supplier), Counter (host)', () => {
  for (const [side, rows, want] of [
    ['supplier', supplierPlusRows({ paid: false }), 'quote'],
    ['supplier · booked', supplierPlusRows({ paid: false, booked: true }), 'quote'],
    ['host', hostPlusRows({ canLogPayment: true }), 'counter'],
    ['host · coordinator', hostPlusRows({ canLogPayment: false }), 'counter'],
  ] as const) {
    assert.equal(rows[0]!.key, want, `${side}: the first tile moved`);
    assert.equal(rows[0]!.wide, true, `${side}: the first tile is not full width`);
    assert.equal(PLUS_ROW_PAGE[rows[0]!.key], NEGOTIATE_GROUP);
  }
});

test('9 · THE (+) HOLDS ONLY THINGS YOU SEND — no row lives in both the (+) and the ⋯ or the pinned strip (owner 20 Nov 2026)', () => {
  const every = [
    ...supplierPlusRows({ paid: false }),
    ...supplierPlusRows({ paid: true, booked: true }),
    ...supplierPlusRows({ paid: false, hasQuote: false }),
    ...hostPlusRows({ canLogPayment: true }),
    ...hostPlusRows({ canLogPayment: false, booked: true }),
  ];
  for (const r of every) {
    // A thing you send is a card dropped into the chat, or a picture taken now. The ONE place to go is the supplier's
    // Every version, last (＋ FINAL, owner 21 Nov — it supersedes the 20 Nov removal for the supplier only).
    if (r.opensVersions) {
      assert.equal(r.key, 'versions');
      continue;
    }
    // 🧰 Share from your widgets (DECISION_LOG 2026-11-23 dee66686) opens the picker of the shop's tools — every pick SENDS
    // a card. It is the one row that is a picker, not a card or a place to go.
    if (r.opensTools) {
      assert.equal(r.key, 'share');
      continue;
    }
    assert.ok(r.card !== null || r.attach !== undefined, `'${r.label}' sends nothing — it is a place to go`);
    assert.ok(!/report|every version/i.test(r.label), `'${r.label}' is back in the (+)`);
  }
  for (const rows of [supplierPlusRows({ paid: false }), supplierPlusRows({ paid: false, hasQuote: false })]) {
    assert.equal(rows.filter((r) => r.opensVersions).length, 1);
    assert.equal(rows.at(-1)!.key, 'versions', 'Every version is not last');
  }
  for (const rows of [hostPlusRows({ canLogPayment: true }), hostPlusRows({ canLogPayment: false, booked: true })]) {
    assert.ok(!rows.some((r) => r.opensVersions), 'Every version is on the host ＋');
  }
  // The ⋯ is where Report lives on the supplier's client page (part G, `picked-client-more.ts`) — so it is not lost, only moved.
  const more = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app/vendor-dashboard/clients/[eventId]/_components/picked-client-more.ts'), 'utf8');
  assert.match(more, /rows\.push\(\{ id: 'report', label: 'Report a problem'/, 'Report left the (+) and is not in the ⋯ either');
});

test('10 · a typed price or day offers its tool — the row the (+) has open for this reader, never a shut or absent one', () => {
  const host = slashRows(hostPlusRows({ canLogPayment: true }), true);
  const supplier = slashRows(supplierPlusRows({ paid: false }), true);
  assert.deepEqual(typedOffer('Can you do ₱38,000?', host), { card: 'counter', lead: 'Make this a counter,', figure: '₱38,000', button: 'Counter' });
  assert.deepEqual(typedOffer('we can do ₱ 42000 all in', supplier), { card: 'quote', lead: 'Make this a new quote,', figure: '₱42,000', button: 'Change quote' });
  assert.deepEqual(typedOffer('See you Fri 27 Nov at the venue', host), { card: 'meeting', lead: 'Set a meeting,', figure: 'Fri 27 Nov', button: 'Dates & times' });
  assert.equal(typedOffer('27 November works', supplier)?.figure, '27 November');
  // A price wins over a day; small change and plain talk offer nothing.
  assert.equal(typedOffer('₱38,000 by 27 Nov?', host)?.card, 'counter');
  assert.equal(typedOffer('₱50 for parking', host), null);
  assert.equal(typedOffer('thank you so much', host), null);
  // Booked at the quote: Counter and Change quote are shut — never offered (the day still is).
  assert.equal(typedOffer('Can you do ₱38,000?', slashRows(hostPlusRows({ canLogPayment: true, booked: true }), true)), null);
  assert.equal(typedOffer('₱38,000', slashRows(supplierPlusRows({ paid: false, booked: true }), true)), null);
  // Nothing published yet (no (+) on this chat) → nothing offered.
  assert.equal(typedOffer('₱38,000 on 27 Nov', []), null);
});
