/**
 * supplier-card-verbs.test.ts — THE VERBS ON A SUPPLIER'S CARD, BY STEP (owner
 * 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2 "Verbs by
 * step"; the prototype's `verbs()`), EXECUTED against the one table.
 *
 *   T1  each step shows exactly the prototype's verbs, in its order, with ONE
 *       main verb at most;
 *   T2  a verb is never offered without the thing it needs — no Chat, Nudge or
 *       "Read their reply" without a conversation, no Book without a lock id,
 *       no Remove on a booked or asked supplier, no Pay unless one is due;
 *   T3  one colour per meaning, and the words are the prototype's;
 *   T4  the card draws the table through the shipped buttons: `ActionButton`,
 *       the one lock path, the one inquiry path, the one withdraw path — and a
 *       press that fails says so;
 *   T5  Nudge posts ONE line in the existing conversation through the same
 *       door a typed message uses, inside the existing action (no new export).
 *
 * SABOTAGE, each seen red (2026-10-08; the PR body has the runs):
 *   T1 two main verbs · T2 Chat without a thread · Remove on a booked card ·
 *   Pay when nothing is due · T3 Remove in the brand colour
 *   T4 a hand-made button · a silent failed removal · T5 a nudge that starts a
 *   new inquiry · a nudge reported as sent when the core refused it
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import type { BenchCardActions } from './bench-card-actions';
import { NUDGE_MESSAGE, cardVerbWords, cardVerbs, type CardVerbInput, type CardVerbKey } from './supplier-card-verbs';

const NONE: BenchCardActions = {
  build: null,
  buildGroupId: null,
  inquiry: null,
  withdraw: null,
  lockGroupId: null,
  lockWithheld: null,
  connect: false,
};
const THREAD = { kind: 'check', threadId: 't1' } as const;
const at = (actions: Partial<BenchCardActions>, rest: Partial<Omit<CardVerbInput, 'actions'>> = {}) =>
  cardVerbs({ actions: { ...NONE, ...actions }, booked: false, hasPrice: false, quoteIn: false, payDue: false, ...rest });
const keys = (v: ReturnType<typeof cardVerbs>) => v.map((x) => x.key);
const mains = (v: ReturnType<typeof cardVerbs>) => v.filter((x) => x.main).map((x) => x.key);

/* ── T1 · the table ──────────────────────────────────────────────────────── */

const STEPS: Array<[name: string, verbs: ReturnType<typeof cardVerbs>, want: CardVerbKey[], main: CardVerbKey[]]> = [
  ['saved, never asked', at({ inquiry: { kind: 'inquire' } }), ['ask', 'remove'], ['ask']],
  ['asked for a quote', at({ inquiry: THREAD, build: { kind: 'needs_price' }, buildGroupId: 'g' }), ['nudge', 'chat', 'remove'], []],
  ['their quote is in', at({ inquiry: THREAD, build: { kind: 'needs_price' }, buildGroupId: 'g' }, { quoteIn: true }), ['read_reply', 'remove'], ['read_reply']],
  ['taken on the date', at({ inquiry: THREAD, build: { kind: 'not_available', inBuild: false }, buildGroupId: 'g' }, { hasPrice: true }), ['another_day', 'remove'], ['another_day']],
  ['priced', at({ inquiry: THREAD, build: { kind: 'add' }, buildGroupId: 'g', lockGroupId: 'g' }, { hasPrice: true }), ['add', 'book', 'chat', 'remove'], ['add']],
  ['in the build', at({ inquiry: THREAD, build: { kind: 'in_build' }, buildGroupId: 'g', lockGroupId: 'g' }, { hasPrice: true }), ['in_build', 'book', 'chat', 'remove'], ['in_build']],
  ['priced, added by you', at({ connect: true, build: { kind: 'add' }, buildGroupId: 'g', lockGroupId: 'g' }, { hasPrice: true }), ['add', 'book', 'record', 'remove'], ['add']],
  ['added by you, no price', at({ connect: true, build: { kind: 'set_price' }, buildGroupId: 'g' }), ['record', 'remove'], ['record']],
  ['does not fit the build', at({ inquiry: THREAD, build: { kind: 'schedule_clash', clashWith: 'Seda' }, buildGroupId: 'g' }, { hasPrice: true }), ['chat', 'remove'], []],
  ['asked to book', at({ inquiry: THREAD, withdraw: { kind: 'withdraw' } }, { hasPrice: true }), ['nudge', 'chat', 'withdraw'], []],
  ['booked, a payment due', at({ inquiry: THREAD }, { booked: true, hasPrice: true, payDue: true }), ['pay', 'chat', 'workspace'], ['pay']],
  ['booked, nothing due', at({ inquiry: THREAD }, { booked: true, hasPrice: true }), ['payments', 'chat', 'workspace'], ['payments']],
  ['booked, no price', at({ inquiry: THREAD }, { booked: true }), ['set_price', 'chat', 'workspace'], ['set_price']],
  ['booked, added by you, no price', at({ connect: true }, { booked: true }), ['record', 'workspace'], ['record']],
  ['booked, added by you, priced', at({ connect: true }, { booked: true, hasPrice: true }), ['payments', 'record', 'workspace'], ['payments']],
];

test('T1 · every step shows the prototype’s verbs, in its order', () => {
  for (const [name, verbs, want] of STEPS) assert.deepEqual(keys(verbs), want, name);
});

test('T1 · at most ONE main verb per row — and it is the first', () => {
  for (const [name, verbs, , main] of STEPS) {
    assert.deepEqual(mains(verbs), main, name);
    if (main.length) assert.equal(verbs[0]!.key, main[0], `${name}: the main verb is not first`);
  }
  // "Payments" and "Ask about another day" are main but quiet: nothing is being asked for.
  assert.equal(at({ inquiry: THREAD }, { booked: true, hasPrice: true })[0]!.quiet, true);
  assert.equal(at({ inquiry: THREAD, build: { kind: 'not_available', inBuild: false }, buildGroupId: 'g' })[0]!.quiet, true);
});

/* ── T2 · never a verb without what it needs ─────────────────────────────── */

test('T2 · no conversation → no Chat, no Nudge, no "Read their reply"', () => {
  const talk: CardVerbKey[] = ['chat', 'nudge', 'read_reply', 'another_day'];
  const without = [
    at({ build: { kind: 'add' }, buildGroupId: 'g', lockGroupId: 'g' }, { hasPrice: true }),
    at({ build: { kind: 'needs_price' }, buildGroupId: 'g' }, { quoteIn: true }),
    at({ withdraw: { kind: 'withdraw' } }),
    at({ build: { kind: 'not_available', inBuild: false }, buildGroupId: 'g' }),
    at({}, { booked: true, hasPrice: true }),
  ];
  for (const verbs of without) for (const k of talk) assert.ok(!keys(verbs).includes(k), `${k} offered with no conversation`);
});

test('T2 · Book only with a lock id; Remove never on a booked or asked supplier; Pay only when one is due', () => {
  assert.ok(!keys(at({ build: { kind: 'add' }, buildGroupId: 'g' }, { hasPrice: true })).includes('book'));
  assert.ok(!keys(at({ inquiry: THREAD }, { booked: true, hasPrice: true, payDue: true })).includes('remove'));
  assert.ok(!keys(at({ inquiry: THREAD, withdraw: { kind: 'withdraw' } })).includes('remove'));
  assert.ok(!keys(at({ inquiry: THREAD }, { booked: true, hasPrice: true })).includes('pay'));
  // A supplier the date rules out cannot be added or booked, whatever else is true.
  const taken = keys(at({ inquiry: THREAD, build: { kind: 'not_available', inBuild: true }, buildGroupId: 'g', lockGroupId: 'g' }, { hasPrice: true }));
  assert.ok(!taken.includes('add') && !taken.includes('in_build') && !taken.includes('book'));
  // Nothing at all to offer still offers the way out.
  assert.deepEqual(keys(at({})), ['remove']);
});

/* ── T3 · words and colours ──────────────────────────────────────────────── */

test('T3 · the words are the prototype’s, and one colour per meaning', () => {
  const want: Record<CardVerbKey, [string, string]> = {
    ask: ['Ask for a quote', 'info'],
    nudge: ['Nudge', 'warn'],
    chat: ['Chat', 'info'],
    read_reply: ['Read their reply', 'info'],
    another_day: ['Ask about another day', 'warn'],
    add: ['Add to build', 'brand'],
    in_build: ['In your build', 'ok'],
    book: ['Book', 'ok'],
    record: ['Your record', 'neutral'],
    withdraw: ['Withdraw', 'danger'],
    pay: ['Pay', 'ok'],
    payments: ['Payments', 'ok'],
    set_price: ['Set price', 'neutral'],
    workspace: ['Workspace', 'neutral'],
    remove: ['Remove', 'danger'],
  };
  for (const [k, [label, tone]] of Object.entries(want)) {
    assert.deepEqual(cardVerbWords(k as CardVerbKey), { label, tone }, k);
  }
  // No verb says "vendor" or "lock".
  for (const k of Object.keys(want)) assert.doesNotMatch(cardVerbWords(k as CardVerbKey).label, /vendor|lock/i);
});

/* ── T4 · the card draws the table through the shipped buttons ───────────── */

const V = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const CARD = stripComments(readFileSync(join(V, '_components', 'bench-vendor-actions.tsx'), 'utf8'));
const ACTION = stripComments(readFileSync(join(V, '_actions', 'contact-shortlist-vendor.ts'), 'utf8'));
const BENCH = stripComments(readFileSync(join(V, '_components', 'shortlist-categories.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(V, 'page.tsx'), 'utf8'));

test('T4 · the card’s verbs come from the table — one row, one fit state', () => {
  assert.match(CARD, /const verbs = cardVerbs\(\{ actions, booked, hasPrice, quoteIn, payDue: Boolean\(payHref\) \}\);/);
  assert.match(CARD, /const rowRef = useRef<HTMLDivElement>\(null\);\s*useFitRow\(rowRef\);/);
  assert.match(CARD, /<div ref=\{rowRef\} className="verbs" data-card-verbs=\{verbs\.map\(\(v\) => v\.key\)\.join\(' '\)\}>\s*\{verbs\.map\(draw\)\}/);
  // Every control is the shipped button — nothing hand-made, no › in a control.
  assert.doesNotMatch(CARD, /<button\b|<a\b|›/);
  // The one lock path, the one inquiry path, the one withdraw path — wearing the pill.
  assert.equal((CARD.match(/<AccordionLockButton\b/g) ?? []).length, 1);
  assert.equal((CARD.match(/<ContactShortlistVendorButton\b/g) ?? []).length, 1);
  assert.equal((CARD.match(/<WithdrawAskButton\b/g) ?? []).length, 1);
  assert.match(CARD, /const pill = \(v: CardVerb\) => actionButtonClass\(v\.tone, \{ main: v\.main, quiet: v\.quiet \}\);/);
  assert.equal((CARD.match(/className=\{pill\(v\)\}/g) ?? []).length, 3);
  // …and each of those three carries its word in the label span the fit pass hides.
  for (const f of ['accordion-lock.tsx', 'contact-shortlist-vendor-button.tsx', 'withdraw-ask-button.tsx']) {
    assert.match(stripComments(readFileSync(join(V, '_components', f), 'utf8')), /<span className="lbl">/, `${f}: the word is not in .lbl`);
  }
});

test('T4 · the facts are the card’s own; Pay is the Booked row’s Pay', () => {
  assert.match(BENCH, /booked=\{v\.status === 'locked'\}\s*hasPrice=\{v\.totalCostPhp != null\}\s*quoteIn=\{standing\?\.needsYou === true\}\s*payHref=\{payHrefs\[v\.vendorId\] \?\? null\}\s*workspaceHref=\{v\.href\}\s*onRecord=\{selfAdded \? loadDetails : undefined\}/);
  assert.match(PAGE, /payHrefByVendorId=\{Object\.fromEntries\(\s*teamRowList\.flatMap\(\(r\) => \(r\.action\?\.kind === 'pay' \? \[\[r\.vendorId, r\.action\.href\] as const\] : \[\]\)\),\s*\)\}/);
  assert.match(CARD, /case 'pay':\s*return payHref \? /);
});

test('T4 · Remove asks first, and a refusal is said — never a silent no-op', () => {
  const remove = CARD.slice(CARD.indexOf('const remove = () => {'), CARD.indexOf('const nudge = () => {'));
  assert.match(remove, /const ok = await confirm\(\{/);
  assert.match(remove, /if \(!ok\) return;/);
  assert.match(remove, /await deleteVendor\(fd\);\s*router\.refresh\(\);/);
  assert.match(remove, /if \(isRedirect\(e\)\) throw e;/, 'a signed-out redirect is swallowed as a failure');
  assert.match(remove, /setSaid\(\{ tone: 'error', text: `\$\{vendorName\} could not be removed\. Nothing changed\.` \}\);/);
  assert.match(CARD, /\{said \? \(\s*<p className=\{said\.tone === 'error' \? 'verb-err' : 'verb-ok'\} role="status">/);
});

/* ── T5 · Nudge ──────────────────────────────────────────────────────────── */

test('T5 · Nudge posts one line in the existing conversation — through the typed message’s own door', () => {
  assert.equal(NUDGE_MESSAGE, 'Hi! Just checking on the quote — any update?');
  const nudge = ACTION.slice(ACTION.indexOf('const nudgeThreadId'), ACTION.indexOf("const { data: row } = await supabase"));
  assert.ok(nudge.length > 0, 'the nudge branch moved — re-anchor');
  // The conversation must be this event's.
  assert.match(nudge, /\.from\('chat_threads'\)\s*\.select\('thread_id'\)\s*\.eq\('thread_id', nudgeThreadId\)\s*\.eq\('event_id', eventId\)/);
  assert.match(nudge, /if \(!thread\) return \{ status: 'error'/);
  // The one send door — so the one-follow-up rule applies to a nudge too.
  assert.match(nudge, /const sent = await sendChatMessageCore\(supabase, \{ threadId: nudgeThreadId, body: NUDGE_MESSAGE \}\);/);
  assert.match(nudge, /return sent\.ok \? \{ status: 'nudged' \} : \{ status: 'error', message: sent\.message \};/);
  // It never starts a second inquiry, and it returns before the inquiry path.
  assert.doesNotMatch(nudge, /startServiceInquiry/);
  // No new exported action: the file still exports exactly the ones it had.
  assert.deepEqual(
    [...ACTION.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]).sort(),
    ['contactShortlistVendor', 'contactVendorProfile'],
  );
});

test('T5 · the card says what the nudge came back with', () => {
  const nudge = CARD.slice(CARD.indexOf('const nudge = () => {'), CARD.indexOf('const pill = '));
  assert.match(nudge, /const res = await contactShortlistVendor\(\{ eventId, vendorId, nudgeThreadId: threadId \}\);/);
  assert.match(nudge, /if \(res\.status === 'nudged'\) setSaid\(\{ tone: 'ok', text: `Nudged \$\{vendorName\}\.` \}\);/);
  assert.match(nudge, /else setSaid\(\{ tone: 'error', text: res\.status === 'error' \? res\.message : 'That did not send\. Nothing changed\.' \}\);/);
});
