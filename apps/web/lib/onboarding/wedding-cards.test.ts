/**
 * GUARDS — the approved wedding onboarding (Lane 1).
 *
 * ⚖ Owner 2026-10-01 (WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC, THE
 * MAP): one question per card, every answer stored where its app already reads
 * it. Two kinds of test:
 *   · the pure rules (order · kind mapping · the 10–500 estimate · the budget
 *     rows) — executed;
 *   · THE PREFILL GUARD — each card writes the wizard field the shipped commit
 *     turns into the Maker's own column, and the commit writes that column.
 *     Read as source because the commit needs a database.
 *
 * Run from apps/web:  npx tsx --test lib/onboarding/wedding-cards.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../security/source-text';
import { ALLOWED_CEREMONY_VALUES } from '../faith-registry';
import { BUDGET_BANDS_FALLBACK } from '../budget-bands-shared';
import { applyGuestsIn, guestsInOf, sanitizeSetupAnswers, setupDefaults, type SetupView } from './setup-answers';
import { setupColumns } from './event-insert';
import {
  CEREMONY_CHOICES,
  CHURCH_FAITHS,
  ESTIMATE_MAX,
  ESTIMATE_MIN,
  WEDDING_CARD_IDS,
  WEDDING_ENGINE_CARDS,
  WEDDING_FLOW_ORDER,
  budgetRows,
  ceremonyChoiceOf,
  ceremonyChoiceToState,
  snapEstimate,
  stepEstimate,
  weddingFlowScreens,
} from './wedding-cards';

const WEB = dirname(fileURLToPath(import.meta.url)).replace(/\/lib\/onboarding$/, '');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

const VIEW: SetupView = {
  eventType: 'wedding',
  solemn: false,
  guestWord: 'guests',
  giftsMode: 'gifts',
  cameraDefault: 'on',
  looks: [
    { id: 'classic', name: 'Classic', pro: false, own: true },
    { id: 'rustic', name: 'Rustic', pro: true, own: false },
  ],
  replyDefault: 'yes',
  guestList: true,
  logoRow: true,
  skin: 'wedding',
};

// ── the order ─────────────────────────────────────────────────────────────

test('the approved order — names · kind · date · area · guests-in · estimate · budget · … · services', () => {
  const all = weddingFlowScreens({
    engineCards: ['setup_where', 'setup_photo', 'setup_look', 'setup_entry', 'setup_guests', 'setup_more'],
    skipAccount: false,
    services: true,
  });
  assert.deepEqual(all, [
    'w_names',
    'w_kind',
    'date',
    'w_area',
    'setup_entry',
    'w_pax',
    'w_budget',
    'account',
    'setup_photo',
    'setup_look',
    'w_colours',
    'services_step',
    'congrats',
  ]);
});

test('the engine cards a wedding does NOT keep (where · guests · more) never appear', () => {
  const all = weddingFlowScreens({ engineCards: ['setup_where', 'setup_guests', 'setup_more'], skipAccount: true, services: false });
  for (const gone of ['setup_where', 'setup_guests', 'setup_more']) assert.ok(!all.includes(gone), gone);
  assert.deepEqual(all, ['w_names', 'w_kind', 'date', 'w_area', 'w_pax', 'w_budget', 'w_colours', 'congrats']);
});

test('the account gate and the services step drop out when they should', () => {
  const base = { engineCards: [...WEDDING_ENGINE_CARDS] };
  assert.ok(weddingFlowScreens({ ...base, skipAccount: false, services: false }).includes('account'));
  assert.ok(!weddingFlowScreens({ ...base, skipAccount: true, services: true }).includes('account'));
  assert.ok(!weddingFlowScreens({ ...base, skipAccount: true, services: false }).includes('services_step'));
});

test('every wedding card id is in the order, once', () => {
  for (const id of WEDDING_CARD_IDS) assert.equal(WEDDING_FLOW_ORDER.filter((x) => x === id).length, 1, id);
});

// ── 2 · what kind of wedding ──────────────────────────────────────────────

test('every kind answer lands on a ceremony type the commit and the DB accept', () => {
  for (const c of CEREMONY_CHOICES) {
    const s = ceremonyChoiceToState(c);
    if (s.kind === 'civil') {
      assert.ok(ALLOWED_CEREMONY_VALUES.includes('civil'));
      continue;
    }
    assert.ok(s.faith.length === 1, c);
    assert.ok((ALLOWED_CEREMONY_VALUES as readonly string[]).includes(s.faith[0]!), `${c} → ${s.faith[0]}`);
  }
});

test('the kind answer round-trips through the wizard state', () => {
  for (const c of CEREMONY_CHOICES) {
    const s = ceremonyChoiceToState(c);
    assert.equal(ceremonyChoiceOf(s), c);
  }
  assert.equal(ceremonyChoiceOf({ kind: null, faith: [], ceremonyUndecided: false }), null);
});

test('only "Not decided yet" leaves the ceremony unlocked; a church pick keeps the chosen church', () => {
  for (const c of CEREMONY_CHOICES) assert.equal(ceremonyChoiceToState(c).ceremonyUndecided, c === 'undecided', c);
  assert.deepEqual(ceremonyChoiceToState('church', 'inc').faith, ['inc']);
  assert.deepEqual(ceremonyChoiceToState('church', 'muslim').faith, ['catholic'], 'a non-church faith never rides the church row');
  assert.ok(CHURCH_FAITHS.includes('catholic') && CHURCH_FAITHS.includes('christian') && CHURCH_FAITHS.includes('inc'));
});

// ── 6 · the guest estimate ────────────────────────────────────────────────

test('the estimate runs 10 to 500 in steps of 10 and never wraps', () => {
  assert.equal(ESTIMATE_MIN, 10);
  assert.equal(ESTIMATE_MAX, 500);
  assert.equal(stepEstimate(10, -1), 10);
  assert.equal(stepEstimate(500, 1), 500);
  assert.equal(stepEstimate(150, 1), 160);
  assert.equal(stepEstimate(150, -1), 140);
  assert.equal(snapEstimate(null), 150);
  assert.equal(snapEstimate(7), 10);
  assert.equal(snapEstimate(499), 500);
  assert.equal(snapEstimate(1234), 500);
  assert.equal(snapEstimate(152), 150);
});

// ── 7 · the budget ────────────────────────────────────────────────────────

test('budget rows are per-head median × the estimate; no band is ever hidden by price', () => {
  const rows = budgetRows(BUDGET_BANDS_FALLBACK, 150);
  assert.equal(rows.length, BUDGET_BANDS_FALLBACK.length, 'every band is offered — budget never narrows a choice');
  assert.equal(rows.find((r) => r.value === 'classic')!.pesos, 5000 * 150);
  assert.equal(rows.find((r) => r.value === 'essentials')!.pesos, 2000 * 150);
  assert.equal(rows.find((r) => r.value === 'no_limit')!.pesos, null);
  // the figures follow the estimate
  assert.equal(budgetRows(BUDGET_BANDS_FALLBACK, 10).find((r) => r.value === 'classic')!.pesos, 50_000);
  assert.equal(budgetRows(BUDGET_BANDS_FALLBACK, 500).find((r) => r.value === 'classic')!.pesos, 2_500_000);
});

// ── 5 · how do guests get in ──────────────────────────────────────────────

test('"How do guests get in?" is one three-way answer over fields the engine already holds', () => {
  for (const g of ['list', 'requests', 'open'] as const) {
    const a = { ...setupDefaults(VIEW), ...applyGuestsIn(g) };
    assert.equal(guestsInOf(a), g);
  }
  assert.equal(guestsInOf(setupDefaults(VIEW)), 'list', 'a wedding opens on the guest list');
});

test('each guests-in answer lands in rsvp_ask_config — the field the Guest list already reads', () => {
  const col = (g: 'list' | 'requests' | 'open') => setupColumns({ ...setupDefaults(VIEW), ...applyGuestsIn(g) }).rsvp_ask_config;
  assert.equal(col('list'), null, 'the Guest list\'s own first-visit pop-up asks "Who can reply?"');
  assert.deepEqual(col('requests'), { whoCanRsvp: 'anyone' });
  assert.deepEqual(col('open'), { guestsReply: false, whoCanRsvp: 'anyone' });
});

test('the wire cannot invent a requests flag — only a literal true counts', () => {
  assert.equal(sanitizeSetupAnswers({ requests: 'yes' }, VIEW)!.requests, false);
  assert.equal(sanitizeSetupAnswers({ requests: true }, VIEW)!.requests, true);
});

// ── THE PREFILL GUARD ─────────────────────────────────────────────────────

test('🔑 each approved card writes a wizard field, and the wedding commit writes its Maker column', () => {
  const cards = code('app/onboarding/wedding/_components/wedding-cards.tsx');
  const shell = code('app/onboarding/wedding/_components/onboarding-shell.tsx');
  const actions = code('app/onboarding/wedding/actions.ts');
  const rows: ReadonlyArray<{ card: string; writes: RegExp; payload: RegExp; column: RegExp }> = [
    { card: 'names', writes: /brideFirstName/, payload: /brideFirstName:\s*s\.brideFirstName/, column: /bride_name:\s*brideFullName/ },
    { card: 'names (groom)', writes: /groomFirstName/, payload: /groomFirstName:\s*s\.groomFirstName/, column: /groom_name:\s*groomFullName/ },
    { card: 'kind', writes: /ceremonyChoiceToState/, payload: /faith:\s*s\.faith/, column: /ceremony_type:\s*ceremonyType/ },
    { card: 'area', writes: /region: resolvePick/, payload: /region:\s*/, column: /region:\s*payload\.region/ },
    { card: 'estimate', writes: /patch\(\{ pax:/, payload: /pax:\s*/, column: /estimated_pax:/ },
    { card: 'budget', writes: /budgetBand: r\.value, budgetAmount: r\.pesos/, payload: /budgetBand:\s*/, column: /budget_band:\s*budgetBand/ },
    { card: 'colours', writes: /prefs: \{ \.\.\.state\.prefs, feel/, payload: /moodFeelKey:\s*s\.prefs\.feel/, column: /mood_feel_key:\s*payload\.moodFeelKey/ },
  ];
  for (const r of rows) {
    assert.match(cards, r.writes, `${r.card}: the card does not write the wizard field`);
    assert.match(shell, r.payload, `${r.card}: the shell's payload does not carry it`);
    assert.match(actions, r.column, `${r.card}: the commit does not write the Maker's column`);
  }
  // the engine's own cards: look → invite_theme, guests-in → rsvp_ask_config (setupColumns)
  const ev = code('lib/onboarding/event-insert.ts');
  assert.match(ev, /invite_theme:\s*a\.look/);
  assert.match(ev, /rsvp_ask_config:\s*rsvp/);
  assert.match(actions, /invite_theme:\s*setup\.invite_theme/);
  assert.match(actions, /rsvp_ask_config:\s*setup\.rsvp_ask_config/);
});

test('🔑 "Not decided yet" leaves the ceremony UNLOCKED at commit', () => {
  const actions = code('app/onboarding/wedding/actions.ts');
  assert.match(actions, /ceremony_type_locked_at:\s*payload\.ceremonyUndecided === true \? null : now/);
});

test('the approved wedding opens its estimate on the drawn 150, not the legacy 200', () => {
  const shell = code('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.match(shell, /setupSteps\.length > 0 \? \{ \.\.\.EMPTY_ONBOARDING_STATE, pax: ESTIMATE_START \}/);
});

test('🔑 the shell draws the approved flow from the ONE list and only once the engine is on', () => {
  const shell = code('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.match(shell, /if \(setupSteps\.length > 0\)\s*\{[\s\S]*?weddingFlowScreens\(/, 'the sequence must come from weddingFlowScreens');
  assert.match(shell, /const approvedFlow = setupSteps\.length > 0/);
  assert.match(shell, /approvedFlow\s*\n?\s*\?\s*WEDDING_CARD_IDS\.map/, 'the wedding cards render only with the engine on');
});

test('the wedding cards offer no pill row, no confirm dialog, no link-out', () => {
  const cards = code('app/onboarding/wedding/_components/wedding-cards.tsx');
  assert.ok(!/confirm\(|window\.confirm|↗/.test(cards));
  assert.ok(!/\bvendor/i.test(cards), 'supplier, never vendor, in UI copy');
});
