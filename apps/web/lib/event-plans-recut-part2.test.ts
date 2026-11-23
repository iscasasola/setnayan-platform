import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HUB_EVENT_COLUMN_GATE,
  HUB_PARTS,
  HUB_PLAN_GATES,
  HUB_PRO_GATES,
  NO_HUB_PARTS,
  coverOwnershipFrom,
  hubOwnershipFrom,
  hubOwnershipOfView,
  hubOwnershipView,
  hubPlanGateHome,
  hubSummaryFor,
  ownsHubGate,
  ownsHubPart,
  type HubOwnership,
  type HubPartId,
} from '@/lib/hub-parts';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, summarizeHubDraft, type HubLiveState } from '@/lib/hub-draft';
import { hubDraftChangeLines } from '@/lib/hub-draft-change-lines';
import { hubDraftProEffects } from '@/lib/hub-pro-effects';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { SKU_OWNERSHIP_ALIASES } from '@/lib/entitlements';
import { STD_PREMIUM_OPENINGS_SERVICE_KEY } from '@/lib/std-openings';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';

/**
 * 🎟 THE 18 NOV 2026 EVENT PLAN RE-CUT, PART 2 (owner, PLAN_RULINGS_2026-11-18 rulings 34 · 36 · 38).
 *
 *   · Event Plus gets the ready-made premium themes  = gate 13 ("A Pro theme"), and ONLY gate 13 of the Style part;
 *   · Event Plus gets the premium Save the Date      = gate 1 (a Cinematic Reveal opening, `STD_PREMIUM_OPENINGS`);
 *     gates 2 (effects) and 3 (own film) stay with the Reveal part;
 *   · every consumer of either gate asks ONE helper (`ownsHubGate`), never a copy of the rule.
 *
 * 🏛 20 Nov 2026 (owner, "EVENT PLUS = 1,000 PAPIC CREDITS + THE WHOLE EVENT HUB"): a held Event Plus is now the WHOLE
 *   Hub (test H, `eventHubOwnership` step 1), so it no longer reaches the gates alone. The gate mechanism stays — the
 *   openings' own unlock still passes gate 1 — and the pure tests below hold it with a hand-built gate input.
 *
 * The catalogue's numbers (Pro 3,000 credits + 6 months · Ultra 6,000) are held by the DB tests
 * `event-ultra-keeps-originals-12-months.db.test.ts` and `a-badge-climbs-one-ladder.db.test.ts`.
 *
 * SABOTAGE, measured by hand on 2026-11-19 (each alone turns this file red):
 *   · drop `plan: 'plus'` from gate 13 in HUB_PRO_GATES                   → 4 red (A, both B, C)
 *   · let the theme / opening fall through to `partsWriteAllowed` at Apply → 3 red (C, D, G)
 *   · remove 'EVENT_PLUS' from STD_PREMIUM_OPENINGS's aliases               → 1 red (F)
 *   · drop `plusHeldOutright ||` from eventHubOwnership's step 1            → 1 red (H)
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, '..', rel), 'utf8');

/** An ownership holding only the two plan gates (the shape the gate mechanism hands a render). */
const plusEvent = (): HubOwnership =>
  hubOwnershipFrom({ fullHeld: false, partHeld: () => false, paidParts: [], prices: new Map(), fullPrice: null, gates: ['1', '13'] });

test('(A) the plan gates are exactly 1 and 13, read from HUB_PRO_GATES — and each keeps its one home', () => {
  assert.deepEqual([...HUB_PLAN_GATES].sort(), ['1', '13']);
  assert.equal(hubPlanGateHome('13'), 'style');
  assert.equal(hubPlanGateHome('1'), 'reveal');
  assert.deepEqual(
    HUB_PRO_GATES.filter((g) => g.plan === 'plus').map((g) => g.id).sort(),
    ['1', '13'],
    'only the theme and the opening pass on Event Plus — never another gate of the Style or Reveal part',
  );
  assert.equal(HUB_EVENT_COLUMN_GATE.invite_theme, '13');
  assert.equal(HUB_EVENT_COLUMN_GATE.std_reveal_template, '1');
});

test('(B) Event Plus passes gates 1 and 13 — and NO part', () => {
  const plus = plusEvent();
  assert.equal(ownsHubGate(plus, '13'), true, 'Event Plus does not pass the Pro theme');
  assert.equal(ownsHubGate(plus, '1'), true, 'Event Plus does not pass the Cinematic Reveal opening');
  for (const p of HUB_PARTS) assert.equal(ownsHubPart(plus, p.id), false, `Event Plus unlocked the whole ${p.id} part`);
  // A free event passes neither; owning the part or everything passes both of its gates.
  assert.equal(ownsHubGate(NO_HUB_PARTS, '13'), false);
  assert.equal(ownsHubGate(NO_HUB_PARTS, '1'), false);
  assert.equal(ownsHubGate(true, '13'), true);
  const styleOnly = hubOwnershipFrom({ fullHeld: false, partHeld: (id) => id === 'style', paidParts: [], prices: new Map(), fullPrice: null });
  assert.equal(ownsHubGate(styleOnly, '13'), true, 'owning the Style part stopped passing its own gate 13');
  assert.equal(ownsHubGate(styleOnly, '1'), false, 'the Style part passed the Reveal part’s gate');
  // An unknown gate handed in is dropped, never held.
  const bogus = hubOwnershipFrom({ fullHeld: false, partHeld: () => false, paidParts: [], prices: new Map(), fullPrice: null, gates: ['14' as never] });
  assert.equal(bogus.gates, undefined, 'a gate outside HUB_PLAN_GATES was carried');
});

test('(B) the gates cross to the client and back, and the cover reads gate 13', () => {
  const back = hubOwnershipOfView(hubOwnershipView(plusEvent()));
  assert.equal(ownsHubGate(back, '13'), true, 'the gates were lost crossing to the client');
  assert.equal(ownsHubGate(back, '1'), true);
  assert.deepEqual(hubOwnershipView(NO_HUB_PARTS), { full: false, parts: [], paidPhp: 0, fullPricePhp: null }, 'a free view grew a field');
  assert.deepEqual(coverOwnershipFrom(plusEvent()), { style: true, background: false }, 'a Plus cover lost its Pro theme, or gained a background');
  assert.deepEqual(coverOwnershipFrom(NO_HUB_PARTS), { style: false, background: false });
});

/* ── (C) THROUGH THE MAKER'S ✓ APPLY ─────────────────────────────────────── */

const E = 'E1';
const row = (type: string, config: unknown = null): InvitationWidgetRow =>
  ({ widget_id: `W-${type}`, event_id: E, widget_type: type, is_visible: true, is_always_on: false, display_order: 1, mode: 'auto', config_json: config }) as unknown as InvitationWidgetRow;
const PRO_THEME = Object.values(INVITE_THEMES).find((t) => t.tier === 'pro')!.id;
const LIVE: HubLiveState = {
  events: { style_preferences: {}, rsvp_ask_config: {} },
  widgets: [row('schedule', {})],
  editorial: null,
  fixedStyles: {},
};
/** A Pro theme, a Reveal opening — and, beside them, Candlelight (14, Style) and a Reveal effect change (2, Reveal). */
function drafted() {
  return mergeHubDraft(emptyHubDraft(), {
    events: {
      invite_theme: PRO_THEME,
      std_reveal_template: 'four-flap',
      site_art_direction: 'candlelight',
      std_reveal_effects: { petals: true },
    },
  } as never);
}
const heldColumns = (o: HubOwnership) =>
  new Set(planHubDraftApply(drafted(), LIVE, o).refused.flatMap((i) => (i.kind === 'event' ? [i.column] : [])));

test('(C) anti-vacuity: a free couple holds all four at Apply', () => {
  const free = heldColumns(NO_HUB_PARTS);
  for (const c of ['invite_theme', 'std_reveal_template', 'site_art_direction'] as const) assert.ok(free.has(c), `${c} was not Pro for a free couple — the fixture proves nothing`);
});

test('(C) an Event Plus event applies the theme and the opening — and still holds Candlelight and the Reveal effects', () => {
  const free = heldColumns(NO_HUB_PARTS);
  const plus = heldColumns(plusEvent());
  assert.ok(!plus.has('invite_theme'), 'Event Plus is still asked to pay for a Pro theme at Apply');
  assert.ok(!plus.has('std_reveal_template'), 'Event Plus is still asked to pay for a Cinematic Reveal opening at Apply');
  assert.ok(plus.has('site_art_direction'), 'Event Plus passed Candlelight (gate 14) — only gate 13 of the Style part is Plus’s');
  if (free.has('std_reveal_effects')) assert.ok(plus.has('std_reveal_effects'), 'Event Plus passed the Reveal effects (gate 2)');
  // The sheet's lines and its named effects agree with the plan.
  const effects = hubDraftProEffects(drafted(), LIVE, plusEvent());
  assert.ok(!effects.some((e) => e.id === 'event:invite_theme' || e.id === 'event:std_reveal_template'), 'the Apply sheet still names a Plus gate');
  assert.ok(effects.some((e) => e.id === 'event:site_art_direction'), 'the Apply sheet lost Candlelight');
});

test('(D) the toolbar derives the same answer after a save (`hubSummaryFor`) — the gate lines go live, Candlelight stays held', () => {
  const free = { ...summarizeHubDraft(drafted(), LIVE, false), changes: hubDraftChangeLines(drafted(), LIVE, false) };
  const owned = { ...summarizeHubDraft(drafted(), LIVE, true), changes: hubDraftChangeLines(drafted(), LIVE, true) };
  const lines = free.changes ?? [];
  assert.ok(lines.some((l) => l.gate === '13' && l.held), 'the theme line carries no gate — the toolbar cannot release it');
  const derived = hubSummaryFor(free, owned, plusEvent());
  const rendered = summarizeHubDraft(drafted(), LIVE, plusEvent());
  assert.equal(derived.proCount, rendered.proCount, 'the toolbar after a save counts a different number of Pro changes than the render');
  assert.ok(derived.proCount > 0, 'Candlelight went live with the theme');
  // The client half of the Apply sheet: the saved effects (asked of nobody) filtered by what is owned.
  const fromSave = hubDraftProEffects(drafted(), LIVE, false);
  const theme = fromSave.find((e) => e.id === 'event:invite_theme');
  assert.equal(theme?.gate, '13', 'the theme effect carries no gate — the bar after a save keeps asking for it');
  assert.equal(fromSave.find((e) => e.id === 'event:std_reveal_template')?.gate, '1');
});

test('(E) the gate still sells under its part — the theme is priced as Style, the opening as Reveal', () => {
  const lines = hubDraftChangeLines(drafted(), LIVE, false);
  const theme = lines.find((l) => l.gate === '13');
  assert.deepEqual(theme?.parts, ['style'] satisfies HubPartId[]);
  assert.deepEqual(lines.find((l) => l.gate === '1')?.parts, ['reveal'] satisfies HubPartId[]);
});

test('(F) gate 1 — an Event Plus ORDER confers the Cinematic Reveal openings; the openings never confer Plus', () => {
  assert.equal(STD_PREMIUM_OPENINGS_SERVICE_KEY, 'STD_PREMIUM_OPENINGS');
  assert.ok(SKU_OWNERSHIP_ALIASES.STD_PREMIUM_OPENINGS?.includes('EVENT_PLUS'), 'an Event Plus order does not open the Cinematic Reveal');
  assert.ok(SKU_OWNERSHIP_ALIASES.STD_PREMIUM_OPENINGS?.includes('COUPLE_WEBSITE_PRO'), 'Event Pro lost the openings');
  assert.ok(SKU_OWNERSHIP_ALIASES.STD_PREMIUM_OPENINGS?.includes('EVENT_ULTRA'), 'Event Ultra lost the openings');
  assert.ok(!SKU_OWNERSHIP_ALIASES.EVENT_PLUS?.includes('STD_PREMIUM_OPENINGS'), 'the alias runs backwards');
  // The ownership read spells the same code (it cannot import std-openings: that module asks it for the gate).
  assert.match(read('lib/couple-website-pro.ts'), /const STD_PREMIUM_OPENINGS_SKU = 'STD_PREMIUM_OPENINGS';/);
});

/* ── (G) EVERY CONSUMER ASKS THE ONE HELPER ───────────────────────────────── */

test('(G) every theme and opening consumer asks ownsHubGate / the gate readers — never the part alone', () => {
  const cases: Array<{ file: string; must: RegExp; never?: RegExp }> = [
    { file: 'app/[slug]/_lib/hub-look.ts', must: /hubGateActiveFor\(event\.event_id, '13'\)/, never: /hubPartActiveFor\(event\.event_id, 'style'\)/ },
    { file: 'lib/hub-parts.ts', must: /style: ownsHubGate\(own, '13'\)/ },
    { file: 'app/dashboard/[eventId]/details/page.tsx', must: /ownsHubGate\(proRead\.v, '13'\)/, never: /parts\.has\('style'\)/ },
    { file: 'app/dashboard/[eventId]/guests/invite/_components/share-link-panel.tsx', must: /ownsHubGate\(ownership, '13'\)/, never: /parts\.has\('style'\)/ },
    { file: 'app/dashboard/[eventId]/launch/page.tsx', must: /ownsPro: ownsGate\('13'\),/, never: /ownsPro: ownsPart\('style'\)/ },
    { file: 'lib/std-openings.ts', must: /eventHubGateActive\(supabase, eventId, '1'\)/, never: /eventHubPartActive\(supabase, eventId, 'reveal'\)/ },
    { file: 'lib/std-openings.ts', must: /eventOwnsHubGate\(supabase, eventId, '1'\)/, never: /eventOwnsHubPart\(supabase, eventId, 'reveal'\)/ },
    { file: 'app/dashboard/[eventId]/website/editor/page.tsx', must: /MakerRevealPanel eventId=\{eventId\} ownsPro=\{ownsOpenings\}/ },
    { file: 'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx', must: /e\.gate \? ownsHubGate\(owned, e\.gate\)/ },
    { file: 'lib/hub-draft.ts', must: /if \(gate\) return item\.change === 'none' \|\| item\.change === 'remove' \|\| ownsHubGate\(own, gate\)/ },
  ];
  for (const c of cases) {
    const src = read(c.file);
    assert.match(src, c.must, `${c.file} no longer asks the one gate helper`);
    if (c.never) assert.doesNotMatch(src, c.never, `${c.file} asks the part again — Event Plus would be refused`);
  }
});

test('(H) eventHubOwnership: Event Plus, Pro and Ultra are the whole Hub; the openings’ own unlock passes gate 1', () => {
  const src = read('lib/couple-website-pro.ts');
  // 🏛 Owner 20 Nov 2026: Event Plus is the whole Event Hub (Pro and Ultra include it), read in the gate's own mode.
  assert.match(src, /holds\(EVENT_PLUS_SKU\),\s*holds\(FULL_PRO_SKU\),\s*holds\(EVENT_ULTRA_PLAN_SKU\),/, 'Event Plus is not read as the whole Hub');
  assert.match(src, /if \(proHeld \|\| ultraHeld\) return everyHubPartHeld\(true\);/, 'Pro / Ultra no longer hold the whole Hub and the Pro plan');
  // 💳 A held Plus is the whole Hub WITHOUT the Pro plan — and a PAID one carries its price in `paidPhp`, so Pro and
  // Ultra are sold at the difference (#8004 review, 20 Nov). Paired with the replay-backed figures in
  // tests/db/event-hub-pro-parts-and-the-cap.db.test.ts (₱2,500 and ₱7,000).
  const step1 = src.slice(src.indexOf('if (plusHeldOutright) {'), src.indexOf('// 2. Each part on its own.'));
  assert.ok(step1.length > 100, 'the paid-Plus branch of step 1 is gone');
  assert.match(step1, /eventSkuLinesFor\(supabase, eventId, \[EVENT_PLUS_SKU\]\)/, 'the Plus payment is not read');
  assert.match(step1, /counts\(r\.status\)/, 'the Plus payment is not read in the gate’s own mode');
  assert.match(step1, /if \(!plusPaidHere\) return everyHubPartHeld\(false\);/, 'a gifted / comped Plus earns a credit, or gets the Pro plan');
  assert.match(step1, /fullHeld: true,[\s\S]{0,600}plusPaid: true,/, 'a paid Plus is not carried as paid toward Pro and Ultra');
  assert.match(step1, /eventSkuLinesFor\(supabase, eventId, HUB_PART_PAID_CODES, HUB_PARTS_ORDER_KEY\)/, 'Hub parts paid before the Plus no longer count toward Pro and Ultra');
  assert.doesNotMatch(step1, /proPlan/, 'a Plus was handed the Pro plan');
  assert.match(src, /holds\(STD_PREMIUM_OPENINGS_SKU\)/, 'the openings’ own unlock is not read for gate 1');
  assert.match(src, /if \(openingsHeld\) gates\.push\('1'\);/);
  assert.match(src, /mode === 'active' \? eventSkuActive\(supabase, eventId, sku\) : eventOwnsSku\(supabase, eventId, sku\)/);
  // Both returns of the parts branch carry them.
  assert.equal((src.match(/^\s+gates,$/gm) ?? []).length, 2, 'one of the two hubOwnershipFrom calls drops the gates');
});
