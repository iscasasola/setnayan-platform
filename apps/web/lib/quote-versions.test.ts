/**
 * EVERY VERSION OF A QUOTE, AND WHAT CHANGED (owner, 4 Nov 2026 — "do we see the changes
 * made in each quotation? for both sides?" → "Yes, build both").
 *
 * 1 · `quoteChanges` executed: add · remove · price change · plan change · unchanged → empty.
 * 2 · `orderQuoteVersions` executed: drafts are not versions, order is by send time, each
 *     version links its predecessor, pairs never mix.
 * 3 · Only the latest version offers Accept (incl. "Accept the update"); a superseded one never.
 * 4 · ONE DIFF: the couple's card, the supplier's card (one stream component, both viewers),
 *     the versions sheet and Admin › Disputes all draw `<QuoteWhatChanged>` from
 *     `quoteChanges` — no second comparison anywhere. Counted, comment-free.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  changesSincePrevious,
  orderQuoteVersions,
  quoteChanges,
  quotePlanText,
  versionSummary,
  versionsNewestFirst,
  versionsOldestFirst,
  versionsSideBySide,
  type QuoteVersionRow,
} from './quote-versions';
import { quoteCardState } from './quote-card-state';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const L = (label: string, pesos: number | null) => ({
  label,
  detail: null,
  amount_centavos: pesos == null ? null : pesos * 100,
});
const PLAN = '30% to book · balance 30 days before the event';

/* ── 1 · quoteChanges ─────────────────────────────────────────────────────── */

test('an added line is "added" with its price', () => {
  const c = quoteChanges(
    { lines: [L('Full coordination', 30000)], plan: PLAN, totalCentavos: 3_000_000 },
    { lines: [L('Full coordination', 30000), L('Rehearsal dinner', 10000)], plan: PLAN, totalCentavos: 4_000_000 },
  );
  assert.deepEqual(c.lines, [{ kind: 'added', label: 'Rehearsal dinner', to: 1_000_000 }]);
  assert.equal(c.plan, null);
  assert.deepEqual(c.total, { from: 3_000_000, to: 4_000_000 });
  assert.equal(c.count, 1);
});

test('a dropped line is "removed" with its old price', () => {
  const c = quoteChanges(
    { lines: [L('Full coordination', 30000), L('Day-of styling', 15000)], plan: PLAN, totalCentavos: 4_500_000 },
    { lines: [L('Full coordination', 30000)], plan: PLAN, totalCentavos: 3_000_000 },
  );
  assert.deepEqual(c.lines, [{ kind: 'removed', label: 'Day-of styling', from: 1_500_000 }]);
  assert.equal(c.count, 1);
});

test('a re-priced line is "changed" old → new, matched by name regardless of case and spacing', () => {
  const c = quoteChanges(
    { lines: [L('Full coordination', 30000)], plan: PLAN, totalCentavos: 3_000_000 },
    { lines: [L('  full   Coordination ', 35000)], plan: PLAN, totalCentavos: 3_500_000 },
  );
  assert.deepEqual(c.lines, [{ kind: 'changed', label: 'full   Coordination', from: 3_000_000, to: 3_500_000 }]);
});

test('a line with a service/card id is matched by that id, even renamed', () => {
  const c = quoteChanges(
    { lines: [{ ...L('Photo', 20000), service_card_id: 'S1' }], plan: null, totalCentavos: 2_000_000 },
    { lines: [{ ...L('Photo coverage', 20000), service_card_id: 'S1' }], plan: null, totalCentavos: 2_000_000 },
  );
  assert.deepEqual(c.lines, []);
});

test('a changed payment plan is one change, old → new', () => {
  const c = quoteChanges(
    { lines: [L('A', 100)], plan: PLAN, totalCentavos: 10_000 },
    { lines: [L('A', 100)], plan: '50% to book · balance on the event day', totalCentavos: 10_000 },
  );
  assert.deepEqual(c.plan, { from: PLAN, to: '50% to book · balance on the event day' });
  assert.equal(c.count, 1);
});

test('an unchanged quote has NO changes — empty lines, no plan, count 0', () => {
  const side = { lines: [L('A', 100), L('B', null)], plan: PLAN, totalCentavos: 10_000 };
  const c = quoteChanges(side, { ...side, lines: [...side.lines] });
  assert.deepEqual(c.lines, []);
  assert.equal(c.plan, null);
  assert.equal(c.count, 0);
});

test('a repeated name is matched by occurrence — a second "Extra hour" is an added line', () => {
  const c = quoteChanges(
    { lines: [L('Extra hour', 2000)], plan: null, totalCentavos: 200_000 },
    { lines: [L('Extra hour', 2000), L('Extra hour', 2000)], plan: null, totalCentavos: 400_000 },
  );
  assert.deepEqual(c.lines, [{ kind: 'added', label: 'Extra hour', to: 200_000 }]);
});

test('the plan line is read from the frozen schedule — and no schedule is no plan, never a guess', () => {
  assert.equal(quotePlanText({}), null);
  const plan = quotePlanText({
    version: 1,
    installments: [
      { seq: 1, label: 'Balance', kind: 'auto', amount_centavos: 70, raw_centavos: 70, percent_bps: null, due: 'before_event', offset_days: 30, is_downpayment: false, is_auto_balance: true, credit_applied_centavos: 0 },
      { seq: 0, label: 'Down', kind: 'percent', amount_centavos: 30, raw_centavos: 30, percent_bps: 3000, due: 'on_lock', offset_days: 0, is_downpayment: true, is_auto_balance: false, credit_applied_centavos: 0 },
    ],
  });
  assert.equal(plan, '30% to book · balance 30 days before the event');
});

/* ── 2 · orderQuoteVersions ──────────────────────────────────────────────── */

const row = (id: string, status: string, sent: string | null, lines: ReturnType<typeof L>[], pair = 'E1'): QuoteVersionRow => ({
  proposal_id: id,
  public_id: `S89J-${id}`,
  event_id: pair,
  vendor_profile_id: 'V1',
  status,
  sent_at: sent,
  created_at: sent ?? '2026-10-01T00:00:00Z',
  total_centavos: lines.reduce((s, l) => s + (l.amount_centavos ?? 0), 0),
  line_items: lines,
  payment_schedule: {},
});

test('versions number by send time; drafts are not versions; each links its predecessor; pairs never mix', () => {
  const vs = orderQuoteVersions([
    row('b', 'sent', '2026-11-02T03:00:00Z', [L('Full coordination', 35000), L('Day-of styling', 15000), L('Rehearsal dinner', 10000)]),
    row('d', 'draft', null, [L('X', 1)]),
    row('a', 'superseded', '2026-10-20T03:00:00Z', [L('Full coordination', 30000), L('Day-of styling', 15000)]),
    row('z', 'sent', '2026-10-25T03:00:00Z', [L('Other', 1)], 'E2'),
  ]);
  const a = vs.find((v) => v.proposalId === 'a')!;
  const b = vs.find((v) => v.proposalId === 'b')!;
  const z = vs.find((v) => v.proposalId === 'z')!;
  assert.equal(vs.length, 3, 'a draft became a version');
  assert.equal(a.version, 1);
  assert.equal(b.version, 2);
  assert.equal(z.version, 1, 'another event’s quote shared the numbering');
  assert.equal(b.previous?.proposalId, 'a');
  assert.equal(changesSincePrevious(a), null);
  assert.equal(changesSincePrevious(b)?.count, 2);
  assert.deepEqual(versionsNewestFirst(vs, 'a').map((v) => v.version), [2, 1]);
  assert.equal(versionSummary(b), 'Nov 2 · 3 lines · 2 changes');
  assert.equal(versionSummary(a), 'Oct 20 · 2 lines · first quote');
});

/* ── 3 · only the latest offers Accept ───────────────────────────────────── */

test('🔴 "Accept the update" — only the couple, only the live pending update; never a superseded or earlier card', () => {
  let checked = 0;
  for (const status of ['sent', 'viewed', 'accepted', 'declined', 'expired', 'superseded'])
    for (const viewer of ['couple', 'vendor'] as const)
      for (const isLatest of [true, false])
        for (const version of [null, 1, 2, 5]) {
          const s = quoteCardState({ status, viewer, isLatest, version });
          const live = isLatest && status !== 'superseded' && (status === 'sent' || status === 'viewed');
          const expect = live && viewer === 'couple' && typeof version === 'number' && version > 1;
          assert.equal(s.offerAcceptUpdate, expect, `${viewer}/${status}/${isLatest}/${version}`);
          if (!live) assert.notEqual(s.primary.kind, 'review_accept', `${viewer}/${status}/${isLatest}: offers accept`);
          if (status === 'superseded' || !isLatest) assert.equal(s.badge, null);
          checked += 1;
        }
  assert.equal(checked, 6 * 2 * 2 * 4);
});

test('the badge: couple "Updated", supplier "Waiting for them" — version 2+ pending only; unknown version says nothing', () => {
  assert.equal(quoteCardState({ status: 'sent', viewer: 'couple', isLatest: true, version: 2 }).badge, 'Updated');
  assert.equal(quoteCardState({ status: 'viewed', viewer: 'vendor', isLatest: true, version: 3 }).badge, 'Waiting for them');
  assert.equal(quoteCardState({ status: 'sent', viewer: 'couple', isLatest: true, version: 1 }).badge, null);
  assert.equal(quoteCardState({ status: 'sent', viewer: 'couple', isLatest: true }).badge, null);
  assert.equal(quoteCardState({ status: 'accepted', viewer: 'couple', isLatest: true, version: 2 }).badge, null);
  assert.equal(quoteCardState({ status: 'sent', viewer: 'vendor', isLatest: true, version: 2 }).reviseLabel, 'Update again');
  assert.equal(quoteCardState({ status: 'sent', viewer: 'vendor', isLatest: true, version: 1 }).reviseLabel, 'Update this quote');
});

/* ── 4 · one diff, every surface ─────────────────────────────────────────── */

const STREAM = 'app/_components/chat-message-stream.tsx';
const SHEET = 'app/_components/quote-versions-sheet.tsx';
const ADMIN = 'app/admin/disputes/_components/quote-versions-evidence.tsx';
const BLOCK = 'app/_components/quote-what-changed.tsx';

test('every surface draws What changed from the one function, through the one component', () => {
  for (const rel of [STREAM, SHEET, ADMIN]) {
    const s = read(rel);
    assert.ok(count(s, /<QuoteWhatChanged\b/g) >= 1, `${rel} does not draw <QuoteWhatChanged>`);
    assert.ok(count(s, /changesSincePrevious\(/g) >= 1, `${rel} does not take its diff from changesSincePrevious`);
  }
  // The stream is ONE component for both viewers: one mount, not one per side.
  assert.equal(count(read(STREAM), /<QuoteWhatChanged\b/g), 1, 'the stream mounts the block more than once — a per-side copy');
  // The block itself draws what it is handed — it never compares two quotes.
  assert.equal(count(read(BLOCK), /quoteChanges\(|\.lines\.filter\(|new Map\(/g), 0, 'the block computes a diff of its own');
});

test('🔴 no second diff anywhere in the app — quoteChanges is called only in lib/quote-versions.ts', () => {
  const hits: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) {
        scanned += 1;
        const s = stripComments(readFileSync(p, 'utf8'));
        if (/\bquoteChanges\(/.test(s)) hits.push(p.slice(WEB.length + 1));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.ok(scanned > 500, `scanned only ${scanned} files`);
  assert.deepEqual(hits, ['lib/quote-versions.ts']);
});

test('the couple accepts the update through the existing respondToProposal, and only when the rule says', () => {
  const s = read(STREAM);
  assert.equal(count(s, /\{quoteState\.offerAcceptUpdate \? \(/g), 1, 'Accept the update is not gated on the rule exactly once');
  /* Saves in place (A SAVE NEVER RESETS THE SCREEN): the same action, posted through its stay door. */
  assert.equal(count(s, /<StayForm door="svProposals\.respondToProposal" action=\{respondToProposal\}/g), 1);
  assert.equal(count(s, /Accept the update/g), 1);
});

test('a replaced quote is compact — no lines, no buttons, no "· Superseded" beside the price (prototype)', () => {
  const s = read(STREAM);
  assert.equal(count(s, /const replaced = card\?\.status === 'superseded';/g), 1);
  assert.equal(count(s, /\{replaced \? null : <QuoteCardLines items=\{items\} \/>\}/g), 1, 'a replaced card draws its lines');
  assert.equal(count(s, /\{replaced \? null : \(\s*<div className="mt-2 flex flex-wrap items-center gap-2">/g), 1, 'a replaced card draws buttons');
  assert.equal(count(s, /\{replaced \? null : \(\s*<>\s*\{quoteState\.note\?\.startsWith/g), 1, 'a replaced card repeats its status');
});

/* ── 5 · SEE EVERY VERSION · SIDE BY SIDE (PR-4, owner 2026-11-12) ─────────────
 * The comparison marks EXACTLY the lines quoteChanges lists — never more, never fewer — plus the plan when it
 * differs and the total when it moved. SABOTAGE (seen red, restored): mark every line `changed: true`; and mark
 * changed only when the amount differs (an added/removed line then goes unmarked). */
const vRow = (id: string, at: string, lines: ReturnType<typeof L>[], total: number, extra: Partial<QuoteVersionRow> = {}): QuoteVersionRow => ({
  proposal_id: id,
  public_id: `S89P-${id}`,
  event_id: 'ev',
  vendor_profile_id: 'shop',
  status: 'superseded',
  sent_at: at,
  created_at: at,
  total_centavos: total * 100,
  line_items: lines,
  payment_schedule: null,
  ...extra,
});

test('side by side: the marked lines are exactly quoteChanges, in the newer order, removed last; plan + total rows', () => {
  const rows = [
    vRow('a', '2026-11-01T00:00:00Z', [L('Garden buffet', 90000), L('Cocktail hour', 20000), L('Grazing table', 15000)], 125000),
    vRow('b', '2026-11-05T00:00:00Z', [L('Garden buffet', 81000), L('Cocktail hour', 20000), L('Photo booth', 12000)], 113000, { status: 'sent' }),
  ];
  const [v1, v2] = orderQuoteVersions(rows);
  const side = versionsSideBySide(v1!, v2!);
  const changes = quoteChanges({ lines: v1!.lines, plan: v1!.plan, totalCentavos: v1!.totalCentavos }, { lines: v2!.lines, plan: v2!.plan, totalCentavos: v2!.totalCentavos });
  const markedLines = side.filter((r) => r.kind === 'line' && r.changed).map((r) => r.label);
  assert.deepEqual(markedLines, changes.lines.map((c) => c.label), 'the sheet marks a different set of lines than What changed lists');
  assert.deepEqual(side.filter((r) => r.kind === 'line').map((r) => r.label), ['Garden buffet', 'Cocktail hour', 'Photo booth', 'Grazing table']);
  const cocktail = side.find((r) => r.label === 'Cocktail hour')!;
  assert.equal(cocktail.changed, false, 'an unchanged line is marked');
  assert.equal(side.find((r) => r.label === 'Photo booth')!.a, undefined, 'an added line has a value on the older side');
  assert.equal(side.find((r) => r.label === 'Grazing table')!.b, undefined, 'a removed line has a value on the newer side');
  const total = side.find((r) => r.kind === 'total')!;
  assert.deepEqual([total.a, total.b, total.changed], [12500000, 11300000, true]);
  assert.equal(side.find((r) => r.kind === 'plan')!.changed, false, 'the same (no) plan is marked changed');
});

test('side by side: two identical versions mark nothing; the pickers list oldest → newest', () => {
  const rows = [
    vRow('a', '2026-11-01T00:00:00Z', [L('Garden buffet', 90000)], 90000),
    vRow('b', '2026-11-05T00:00:00Z', [L('Garden buffet', 90000)], 90000, { status: 'accepted' }),
  ];
  const vs = orderQuoteVersions(rows);
  assert.deepEqual(versionsSideBySide(vs[0]!, vs[1]!).filter((r) => r.changed), []);
  assert.deepEqual(versionsOldestFirst(vs, 'b').map((v) => v.version), [1, 2]);
});

test('side by side is drawn from versionsSideBySide only — the sheet never compares two quotes itself', () => {
  const sheet = read('app/_components/quote-versions-compare.tsx');
  assert.equal(count(sheet, /versionsSideBySide\(/g), 1);
  assert.equal(count(sheet, /quoteChanges\(|\.lines\.filter\(|new Map\(/g), 0, 'the comparison sheet computes a diff of its own');
  assert.match(read('app/_components/quote-version-line.tsx'), /<QuoteVersionsCompareDoor versions=\{versionsOldestFirst\(versions, latest\.proposalId\)\} \/>/);
});
