/**
 * A REVISED QUOTE MUST BE ACCEPTED AGAIN — and an accepted one is not offered
 * "accept" twice. (S5 · 2026-09-18)
 *
 * ── THE TWO DEFECTS ─────────────────────────────────────────────────────────
 * 1. Owner, live, after #5586 served: the quote card read "₱10,170 · Accepted"
 *    and STILL showed "Review & accept". The label was picked by the viewer,
 *    never by the status.
 * 2. Owner, testing: "vendor cannot edit the proposal." No path existed to
 *    revise a sent quote; the supersede RPC skipped accepted ones by design.
 *
 * ── THE RULING (owner, option a) ────────────────────────────────────────────
 * A new quote supersedes the live one, including an accepted one; the old one
 * stays as history; the acceptance resets to pending. One thread, one live
 * quote.
 *
 * ── HOW THIS GUARD IS BUILT ─────────────────────────────────────────────────
 * The decision that CAN be executed is executed: `quoteCardState` is run over
 * every status × viewer × latest × handshake and its answers asserted; the
 * revision seed is run over a real stored line-item shape including the
 * negative line that cannot round-trip. What must be read from source is read
 * comment-free and COUNTED: the card must draw its label from the rule and
 * nowhere else, and the two pages must actually pass what the card needs.
 * `a-single-green-measurement-is-a-hypothesis`: each source claim also states
 * the number it found.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { quoteCardState, type QuoteCardInput } from './quote-card-state';
import { seedQuoteRevision } from './quote-revision-seed';
import type { LockRequestState } from './lock-request-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const STREAM = 'app/_components/chat-message-stream.tsx';
const COUPLE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const VENDOR = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const MAKER = 'app/_components/proposal-maker.tsx';
const SEND = 'lib/proposal-send.ts';
const DASH_SEND = 'app/vendor-dashboard/proposals/actions.ts';

const STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'superseded'] as const;
const VIEWERS = ['couple', 'vendor'] as const;
const HANDSHAKES: Array<LockRequestState | null> = [
  null, 'none', 'requested', 'declined', 'cancelled', 'expired', 'locked',
];

function every(): Array<{ label: string; input: QuoteCardInput }> {
  const out: Array<{ label: string; input: QuoteCardInput }> = [];
  for (const status of STATUSES)
    for (const viewer of VIEWERS)
      for (const isLatest of [true, false])
        for (const handshake of HANDSHAKES)
          out.push({
            label: `${viewer}/${status}/${isLatest ? 'latest' : 'older'}/${handshake ?? 'unknown'}`,
            input: { status, viewer, isLatest, handshake },
          });
  return out;
}

/* ── 1 · THE RULE, EXECUTED ─────────────────────────────────────────────── */

test('the sweep is not empty and covers every status the schema allows', () => {
  const all = every();
  assert.equal(all.length, STATUSES.length * VIEWERS.length * 2 * HANDSHAKES.length);
  assert.ok(all.length >= 190, `swept ${all.length} combinations — did a list go empty?`);
});

test('🔴 an accepted quote is NEVER offered "Review & accept" — for anyone, in any state', () => {
  let checked = 0;
  for (const { label, input } of every()) {
    if (input.status !== 'accepted') continue;
    const s = quoteCardState(input);
    assert.notEqual(s.primary.kind, 'review_accept', `${label}: offers accept on an accepted quote`);
    assert.equal(s.offerCounter, false, `${label}: offers Counter-offer on an accepted quote`);
    checked += 1;
  }
  assert.ok(checked >= 28, `checked ${checked} accepted combinations`);
});

test('a superseded quote — or any earlier quote — is history: view only, no actions', () => {
  let checked = 0;
  for (const { label, input } of every()) {
    if (input.status !== 'superseded' && input.isLatest) continue;
    const s = quoteCardState(input);
    assert.equal(s.history, true, `${label}: not drawn as history`);
    assert.equal(s.primary.kind, 'view', `${label}: offers more than a view`);
    assert.equal(s.offerCounter, false, `${label}: offers Counter-offer`);
    assert.equal(s.offerRevise, false, `${label}: offers Update this quote`);
    assert.equal(s.offerLock, false, `${label}: offers Lock`);
    checked += 1;
  }
  assert.ok(checked >= 100, `checked ${checked} history combinations`);
  // The superseded marker names what happened, and only the superseded row wears it.
  assert.equal(
    quoteCardState({ status: 'superseded', isLatest: true, viewer: 'couple' }).note,
    'Replaced by a newer quote',
  );
  assert.equal(quoteCardState({ status: 'sent', isLatest: false, viewer: 'couple' }).note, null);
});

test('the live pending quote: the couple reviews & accepts or counters; the supplier updates', () => {
  for (const status of ['sent', 'viewed'] as const) {
    for (const handshake of HANDSHAKES) {
      const couple = quoteCardState({ status, isLatest: true, viewer: 'couple', handshake });
      assert.equal(couple.primary.kind, 'review_accept', `${status}/${handshake}: couple not offered accept`);
      assert.equal(couple.primary.label, 'Review & accept');
      assert.equal(couple.offerCounter, true);
      assert.equal(couple.offerRevise, false, 'a couple is offered Update this quote');
      assert.equal(couple.offerLock, false, 'a pending quote offers Lock');

      const vendor = quoteCardState({ status, isLatest: true, viewer: 'vendor', handshake });
      assert.equal(vendor.primary.kind, 'view');
      assert.equal(vendor.offerRevise, true, `${status}/${handshake}: supplier cannot update their own live quote`);
      assert.equal(vendor.offerCounter, false);
      assert.equal(vendor.offerLock, false);
    }
  }
});

test('the live accepted quote: the couple is pointed at Lock only when no lock is asked; the supplier may still update until one is', () => {
  const asked = new Set<LockRequestState | null>(['requested', 'locked']);
  for (const handshake of HANDSHAKES) {
    const couple = quoteCardState({ status: 'accepted', isLatest: true, viewer: 'couple', handshake });
    const vendor = quoteCardState({ status: 'accepted', isLatest: true, viewer: 'vendor', handshake });
    // Lock is offered on exactly one known state: 'none'. Unknown stays quiet.
    assert.equal(couple.offerLock, handshake === 'none', `couple/accepted/${handshake}: offerLock`);
    assert.equal(vendor.offerLock, false, `vendor/accepted/${handshake}: a supplier is offered Lock`);
    // Update is withdrawn the moment the couple has asked to lock, or it is booked.
    assert.equal(vendor.offerRevise, !asked.has(handshake), `vendor/accepted/${handshake}: offerRevise`);
    assert.equal(couple.offerRevise, false);
    // Both are told where it stands, in their own voice.
    assert.ok(couple.note && /^Accepted/.test(couple.note), `couple/accepted/${handshake}: "${couple.note}"`);
    assert.ok(vendor.note && /^Accepted/.test(vendor.note), `vendor/accepted/${handshake}: "${vendor.note}"`);
    // Booked is booked for both; every other state is told in its own voice.
    if (handshake !== 'locked') {
      assert.notEqual(couple.note, vendor.note, `${handshake}: both sides read the same sentence`);
    }
  }
  assert.match(quoteCardState({ status: 'accepted', isLatest: true, viewer: 'couple', handshake: 'locked' }).note ?? '', /booked/);
  assert.match(quoteCardState({ status: 'accepted', isLatest: true, viewer: 'vendor', handshake: 'requested' }).note ?? '', /asked you to lock/);
});

test('every combination has exactly one primary, and it is one of the two known labels', () => {
  const labels = new Set<string>();
  for (const { input } of every()) labels.add(quoteCardState(input).primary.label);
  assert.deepEqual([...labels].sort(), ['Review & accept', 'View proposal']);
});

/* ── 2 · THE REVISION SEED, EXECUTED ────────────────────────────────────── */

test('a stored quote seeds the builder line for line — and a negative line becomes the Discount, never a ₱0 line', () => {
  const seed = seedQuoteRevision({
    public_id: 'S89J-ABCDEFGHJK',
    title: 'Full-day coverage',
    total_centavos: 1_017_000,
    status: 'accepted',
    sent_at: '2026-09-18T06:00:00.000Z',
    rendered_body: 'Thanks for asking us.',
    valid_until: '2026-10-01',
    line_items: [
      { label: 'Photography · 8h', detail: null, amount_centavos: 900_000 },
      { label: 'Crew meal', detail: '3 crew × ₱350/head', amount_centavos: 105_000 },
      { label: 'Same-day edit', detail: null, amount_centavos: null },
      { label: 'Discount', detail: null, amount_centavos: -150_000 },
      { label: 'Viewer promo', detail: 'promo', amount_centavos: -8_000 },
      { label: '   ', detail: null, amount_centavos: 1 },
    ],
    payment_method_ids: ['pm_1', 7, '', 'pm_2'],
  });
  assert.equal(seed.lines.length, 3, `seeded ${seed.lines.length} lines (blank label dropped, negatives folded)`);
  assert.deepEqual(seed.lines.map((l) => [l.label, l.free, l.flatPhp]), [
    ['Photography · 8h', false, 9_000],
    ['Crew meal', false, 1_050],
    ['Same-day edit', true, 0],
  ]);
  assert.equal(seed.discountPhp, 1_580, 'the two negative lines fold into one Discount');
  assert.ok(seed.lines.every((l) => l.basis === 'flat' && l.flatPhp >= 0), 'a seeded line is flat and non-negative');
  assert.equal(seed.title, 'Full-day coverage');
  assert.equal(seed.note, 'Thanks for asking us.');
  assert.equal(seed.validUntil, '2026-10-01');
  assert.deepEqual(seed.paymentMethodIds, ['pm_1', 'pm_2']);
  assert.equal(seed.of.status, 'accepted');
  assert.equal(seed.of.totalCentavos, 1_017_000);
});

test('the seed round-trips the total the builder will show: lines minus discount equals the stored total', () => {
  const stored = [
    { label: 'A', detail: null, amount_centavos: 500_000 },
    { label: 'B', detail: null, amount_centavos: 250_000 },
    { label: 'Discount', detail: null, amount_centavos: -50_000 },
  ];
  const total = stored.reduce((s, l) => s + (l.amount_centavos ?? 0), 0);
  const seed = seedQuoteRevision({
    public_id: 'x', title: 't', total_centavos: total, status: 'sent', sent_at: null,
    rendered_body: '', valid_until: null, line_items: stored, payment_method_ids: [],
  });
  const rebuilt = seed.lines.reduce((s, l) => s + Math.round(l.flatPhp * 100), 0) - Math.round(seed.discountPhp * 100);
  assert.equal(rebuilt, total, `rebuilt ${rebuilt} ≠ stored ${total}`);
});

/* ── 3 · THE WIRING, READ AND COUNTED ───────────────────────────────────── */

test('the scan reads every file (an empty read is a green lie)', () => {
  for (const rel of [STREAM, COUPLE, VENDOR, MAKER, SEND, DASH_SEND]) {
    assert.ok(read(rel).length > 500, `${rel} read as too short`);
  }
});

test('the card draws its label from the rule — the literal "Review & accept" is gone from the stream', () => {
  const s = read(STREAM);
  assert.equal(count(s, /quoteCardState\(/g), 1, 'quoteCardState must be called exactly once, in the proposal branch');
  assert.equal(count(s, /quoteState\.primary\.label/g), 1, 'the primary button must render the rule’s label, once');
  assert.equal(count(s, /Review & accept/g), 0, 'a hard-coded accept label is back in the stream');
  assert.equal(count(s, /viewerRole === 'couple' \? 'Review & accept'/g), 0, 'the viewer-only label is back');
  // Each affordance is gated on the rule, and the gate sits inside the proposal branch.
  const branch = s.slice(s.indexOf('if (m.proposal_id) {'), s.indexOf('if (negotiationOn && m.appointment_id)'));
  assert.ok(branch.length > 1000, `proposal branch window is ${branch.length} chars — slid?`);
  assert.equal(count(branch, /quoteState\.offerCounter \?/g), 1, 'Counter-offer is not gated on the rule');
  assert.equal(count(branch, /quoteState\.offerRevise && reviseHref \?/g), 1, 'Update this quote is not gated on the rule');
  assert.equal(count(branch, /quoteState\.offerLock && lockHref \?/g), 1, 'Lock is not gated on the rule');
  assert.equal(count(branch, /Update this quote/g), 1);
  assert.equal(count(branch, /to lock/g), 1, 'the couple’s lock pointer must render once');
  assert.match(branch, /handshake: lockHandshake\?\.state \?\? null/, 'the rule is not told the handshake');
  assert.match(branch, /isLatest: isLatestProposal/, 'the rule is not told which card is the live one');
  // And the old cards repaint: every quote id is refetched on every message change.
  assert.equal(count(s, /requestedProposalsRef/g), 0, 'the fetch-once set is back — a superseded card would never repaint');
});

test('the supplier’s page sends the revise destination, opens the panel for it, and seeds the builder', () => {
  const v = read(VENDOR);
  assert.equal(count(v, /reviseHref=\{`\?compose=quote`\}/g), 1, 'reviseHref not passed exactly once');
  assert.match(v, /sp\?\.compose === 'quote' \? 'quote'/, '?compose=quote is not parsed on the server');
  assert.match(v, /t\.id === 'build-quote' && composeMode === 'quote'/, 'the Build-a-quote panel does not open for ?compose=quote');
  assert.equal(count(v, /revision=\{quoteRevision\}/g), 1, 'ProposalMaker is not handed the revision seed exactly once');
  assert.match(v, /seedQuoteRevision\(/, 'the seed is not built from the live quote');
  assert.match(v, /\.in\('status', \['sent', 'viewed', 'accepted'\]\)/, 'the live quote is not selected by the live statuses');
  // The couple's page never offers Update this quote — it has no builder.
  assert.equal(count(read(COUPLE), /reviseHref/g), 0, 'the couple page passes reviseHref');
});

test('the couple’s page resolves the Lock destination from event_vendors and passes it', () => {
  const c = read(COUPLE);
  assert.equal(count(c, /lockHref=\{quoteLockHref\}/g), 1);
  assert.match(c, /eq\('marketplace_vendor_id', thread\.vendor_profile_id\)/, 'resolved by a guessed key');
  assert.match(c, /\/dashboard\/\$\{eventId\}\/vendors\/\$\{pick\.vendor_id\}\/workspace/, 'not the workspace route');
  // The thread NEVER books a quote itself: no lockDeal form is mounted on the card.
  const s = read(STREAM);
  const branch = s.slice(s.indexOf('if (m.proposal_id) {'), s.indexOf('if (negotiationOn && m.appointment_id)'));
  assert.equal(count(branch, /action=\{lockDeal\}/g), 0, 'the quote card mounts a Lock form — a second lock mechanism');
});

test('the builder opens expanded and seeded when given a revision, and says what sending does', () => {
  const m = read(MAKER);
  assert.match(m, /useState\(revision != null\)/, 'a revision does not open the builder');
  assert.match(m, /revision\.lines\.map\(/, 'the lines are not seeded');
  assert.match(m, /useState\(revision\?\.discountPhp \?\? 0\)/, 'the folded discount is not seeded');
  assert.match(m, /Sending replaces that quote/, 'the banner does not say sending replaces the quote');
  assert.match(m, /must review and accept the new one/, 'the banner does not say the couple must accept again');
});

test('both send paths ask whether the supplier may re-quote BEFORE writing, and read the supersede error', () => {
  const s = read(SEND);
  const gateAt = s.indexOf("rpc('vendor_may_requote'");
  const insertAt = s.indexOf(".from('vendor_proposals')\n    .insert(");
  assert.ok(gateAt > 0, 'sendProposalCore never asks vendor_may_requote');
  assert.ok(insertAt > 0, 'no insert found — window slid');
  assert.ok(gateAt < insertAt, 'the pre-check runs AFTER the first insert');
  assert.equal(count(s, /rpc\('vendor_may_requote'/g), 1, 'the gate is asked once, in the shared gate');
  assert.match(s, /code: 'deal_locked'/);
  assert.match(s, /code: 'lock_requested'/);
  assert.match(s, /const \{ error: supersedeErr \} = await supabase\.rpc\('supersede_prior_vendor_proposals'/, 'the supersede error is swallowed');
  assert.match(s, /replacesAccepted/, 'the card does not say the acceptance no longer stands');
  assert.match(s, /please review and accept again/, 'the couple is not told to accept again');

  const d = read(DASH_SEND);
  const dGate = d.indexOf("rpc('vendor_may_requote'");
  const dFlip = d.indexOf("update({ status: 'sent'");
  assert.ok(dGate > 0 && dFlip > 0 && dGate < dFlip, 'the dashboard send flips to sent before asking');
  assert.match(d, /const \{ error: supersedeErr \}/, 'the dashboard swallows the supersede error');
});

test('the migration exists once and defines the rule, the pre-check and the widened supersede', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('_a_revised_quote_must_be_accepted_again.sql'));
  assert.equal(files.length, 1, `found ${files.length} migrations for this change`);
  const sql = readFileSync(join(dir, files[0]!), 'utf8');
  assert.match(sql, /create or replace function public\.vendor_requote_blocker/);
  assert.match(sql, /create or replace function public\.vendor_may_requote/);
  assert.match(sql, /create or replace function public\.supersede_prior_vendor_proposals/);
  assert.match(sql, /status in \('sent','viewed','accepted'\)/, 'supersede does not retire accepted quotes');
  assert.match(sql, /set status = 'considering'::public\.vendor_status/, 'the shortlist the accept wrote is not reverted');
  assert.match(sql, /'deal_locked'/);
  assert.match(sql, /'lock_requested'/);
  assert.ok(existsSync(join(WEB, 'tests', 'db', 'a-revised-quote-must-be-accepted-again.db.test.ts')), 'the db test is missing');
});
