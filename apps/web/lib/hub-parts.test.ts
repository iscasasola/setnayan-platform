/**
 * hub-parts.test.ts — 💎 EVENT HUB PRO, PART BY PART (owner 2026-10-22, DECISION_LOG "EVENT HUB PRO, PART BY PART";
 * prototype `prototypes/pro_part_by_part_2026-10-22.html`; gate inventory PRO-GATES.md, 37 gates → 11 parts).
 *
 * Properties, not phrasings:
 *   (A) every one of the 37 gates has EXACTLY ONE home — a part, `full` (the footer only) or `free`;
 *   (B) the cap: what the parts paid reaches the Full Pro price → everything; below it → only what is held;
 *       an unread price never reaches it; a part bought twice counts once;
 *   (C) ✓ Apply's buttons: the prototype's three frames, by their own numbers;
 *   (D) THROUGH THE ONE GATE (`planHubDraftApply`) and THE ONE LIST (`hubDraftProEffects`): owning a part lets
 *       exactly that part's effects through — every other part's stay held and named; owning every part (or Full Pro)
 *       holds nothing;
 *   (E) the footer comes off only with everything.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_PARTS,
  HUB_PART_IDS,
  HUB_PRO_GATES,
  NO_HUB_PARTS,
  everyHubPart,
  hubApplyOffer,
  hubOwnershipFrom,
  hubRestToEverything,
  ownsHubPart,
  type HubOwnership,
  type HubPartId,
} from './hub-parts';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, hubDraftItemParts, type HubLiveState } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';
import { INVITE_THEMES } from './invite-themes';
import type { InvitationWidgetRow } from './invitation-widgets';

/* ── (A) THE GATES ──────────────────────────────────────────────────────── */

test('(A) all 37 gates of PRO-GATES.md are here, each once, each with exactly one home', () => {
  const ids = HUB_PRO_GATES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'a gate id is listed twice');
  const rows = new Set(ids.map((id) => Number.parseInt(id, 10)));
  for (let n = 1; n <= 37; n += 1) assert.ok(rows.has(n), `gate ${n} of PRO-GATES.md has no home`);
  assert.equal(rows.size, 37, `only the 37 rows of PRO-GATES.md, got ${rows.size}`);
  const homes = new Set<string>([...HUB_PART_IDS, 'full', 'free']);
  for (const g of HUB_PRO_GATES) assert.ok(homes.has(g.home), `gate ${g.id} lives nowhere real: ${g.home}`);
  /* A split row's halves are a letter apart and nothing else — a row is never split by accident. */
  for (const id of ids.filter((x) => /[a-z]$/.test(x))) {
    const n = id.replace(/[a-z]$/, '');
    assert.ok(ids.filter((x) => x.replace(/[a-z]$/, '') === n).length >= 2, `gate ${id} is a half with no other half`);
  }
});

test('(A) the footer (37) is the ONLY gate that needs everything; tickets and the QR sheet are free', () => {
  assert.deepEqual(HUB_PRO_GATES.filter((g) => g.home === 'full').map((g) => g.id), ['37']);
  assert.deepEqual(HUB_PRO_GATES.filter((g) => g.home === 'free').map((g) => g.id).sort(), ['35', '36b']);
});

test('(A) eleven parts — five big, six small — each opens at least one gate, each its own catalogue row', () => {
  assert.equal(HUB_PARTS.length, 11);
  assert.deepEqual(HUB_PARTS.filter((p) => p.size === 'big').map((p) => p.name), ['Reveal', 'Background', 'Photos', 'Style', 'Motion']);
  assert.deepEqual(HUB_PARTS.filter((p) => p.size === 'small').map((p) => p.name), ['Logo & QR', 'Music', 'Prints', 'Post Event', 'Your own scenes', 'Custom address']);
  assert.equal(new Set(HUB_PARTS.map((p) => p.sku)).size, 11, 'two parts share a catalogue row');
  for (const p of HUB_PARTS) {
    assert.match(p.sku, /^COUPLE_HUB_PART_[A-Z_]+$/);
    /* Custom address is the one part with no row in PRO-GATES.md (it was ungated) — it is the new gate itself. */
    if (p.id !== 'address') assert.ok(HUB_PRO_GATES.some((g) => g.home === p.id), `${p.name} opens nothing`);
  }
});

/* ── (B) THE CAP ────────────────────────────────────────────────────────── */

/** Prices are HANDED in, as the catalogue read would hand them — the owner's sample sheet. */
const PRICES = new Map<string, number>(HUB_PARTS.map((p) => [p.sku, p.size === 'big' ? 1000 : 500]));
const FULL = 5000;
const own = (paid: HubPartId[], opts: { held?: HubPartId[]; full?: boolean; fullPrice?: number | null; prices?: Map<string, number> } = {}): HubOwnership =>
  hubOwnershipFrom({
    fullHeld: opts.full ?? false,
    partHeld: (id) => (opts.held ?? paid).includes(id),
    paidParts: paid,
    prices: opts.prices ?? PRICES,
    fullPrice: opts.fullPrice === undefined ? FULL : opts.fullPrice,
  });

test('(B) reaching the Full Pro price through parts is everything — footer included', () => {
  const five = own(['reveal', 'background', 'photos', 'style', 'motion']);
  assert.equal(five.paidPhp, 5000);
  assert.equal(five.full, true, '₱5,000 of parts did not unlock everything');
  for (const id of HUB_PART_IDS) assert.ok(five.parts.has(id), `${id} is not owned at the cap`);
  assert.equal(hubRestToEverything(five), 0);
});

test('(B) below the cap only what is held is owned, and the rest is the Full price less what was paid', () => {
  const o = own(['reveal', 'background', 'photos', 'music']);
  assert.equal(o.paidPhp, 3500);
  assert.equal(o.full, false);
  assert.deepEqual([...o.parts].sort(), ['background', 'music', 'photos', 'reveal']);
  assert.equal(hubRestToEverything(o), 1500, 'frame 2: ₱5,000 − ₱3,500');
  assert.equal(ownsHubPart(o, 'style'), false);
});

test('(B) a part bought twice counts once; an unread price never reaches the cap (fail-closed)', () => {
  const twice = own(['reveal', 'reveal', 'reveal', 'reveal', 'reveal']);
  assert.equal(twice.paidPhp, 1000);
  assert.equal(twice.full, false);
  const noFullPrice = own(['reveal', 'background', 'photos', 'style', 'motion', 'music'], { fullPrice: null });
  assert.equal(noFullPrice.full, false, 'an unread Full Pro price reached the cap');
  const noPartPrices = own(['reveal', 'background', 'photos', 'style', 'motion'], { prices: new Map() });
  assert.equal(noPartPrices.paidPhp, 0);
  assert.equal(noPartPrices.full, false, 'unread part prices reached the cap');
});

test('(B) Full Pro held outright is everything without a single part paid', () => {
  const o = own([], { full: true });
  assert.equal(o.full, true);
  assert.equal(o.parts.size, 11);
  /* …and a part held by a comp (not paid) is owned but never counted toward the cap. */
  const comp = own([], { held: ['style'] });
  assert.equal(comp.paidPhp, 0);
  assert.ok(comp.parts.has('style'));
});

/* ── (C) ✓ APPLY'S BUTTONS ──────────────────────────────────────────────── */

test('(C) frame 1 — two parts (₱2,000), nothing paid: parts lead, everything is ₱3,000 more', () => {
  const offer = hubApplyOffer(2000, 5000);
  assert.deepEqual(offer, { lead: 'parts', showParts: true, showEverything: true, more: 3000 });
});

test('(C) frame 1-closer — four parts (₱3,500): everything leads, only ₱1,500 more', () => {
  const offer = hubApplyOffer(3500, 5000);
  assert.deepEqual(offer, { lead: 'everything', showParts: true, showEverything: true, more: 1500 });
});

test('(C) frame 2 — ₱3,500 paid, two parts (₱2,000) > the ₱1,500 rest: ONE button, never above the rest', () => {
  const offer = hubApplyOffer(2000, 1500);
  assert.equal(offer.showParts, false, 'the parts were offered for more than everything costs');
  assert.equal(offer.lead, 'everything');
  /* An unread Full price offers the parts only — never an invented everything figure. */
  assert.deepEqual(hubApplyOffer(2000, null), { lead: 'parts', showParts: true, showEverything: false, more: null });
});

/* ── (D) THROUGH THE ONE GATE ───────────────────────────────────────────── */

const E = 'E1';
const ref = (path: string) => `r2://setnayan-media/events/${E}/${path}`;
const row = (type: string, config: unknown = null): InvitationWidgetRow =>
  ({ widget_id: `W-${type}`, event_id: E, widget_type: type, is_visible: true, is_always_on: false, display_order: 1, mode: 'auto', config_json: config }) as unknown as InvitationWidgetRow;

const PRO_THEME = Object.values(INVITE_THEMES).find((t) => t.tier === 'pro')!.id;

/** A bare free page. */
const LIVE: HubLiveState = {
  events: { style_preferences: {}, rsvp_ask_config: {} },
  widgets: [row('schedule', {}), row('venue_map', {}), row('custom_1', null)],
  editorial: null,
  fixedStyles: {},
};

/** A draft that tries something Pro from as many parts as the Maker drafts. */
function triedEverything() {
  let d = emptyHubDraft();
  d = mergeHubDraft(d, {
    events: {
      invite_theme: PRO_THEME, // style
      std_reveal_template: 'four-flap', // reveal
      site_bg_music_r2_key: ref('site-music/ours.mp3'), // music
      rsvp_backdrop: { theme: 'petals', intensity: 'soft' }, // background
      site_magic_traveller: 'bar', // logo & qr
      our_photos: [ref('our-photos/one.jpg')], // photos
      style_preferences: { qr: { shape: 'circle' }, camera_look: 'brand', block_looks: { entourage: { motion: { in: { fade: true } } } } },
      rsvp_ask_config: { look: { lines: { 'rsvp.question': { c: '#8a1c2b', i: { fade: true } } } } },
    },
    widgets: {
      schedule: { canvas: { focal: 2, preset: 'rise', elements: { heading: { font: 'script', motion: { during: 'glow' } } } } },
      custom_1: { custom: { title: 'Ours', body: 'A scene of our own.' }, mode: 'shown' },
    },
    fixedStyles: { hero_names: 'one-line' },
  } as never);
  return d;
}

const partsNamed = (o: HubOwnership | boolean) => new Set(hubDraftProEffects(triedEverything(), LIVE, o).map((e) => e.part));
const ALL_NAMED = partsNamed(false);

test('(D) anti-vacuity: a free couple’s held effects span most of the parts', () => {
  console.log(`[hub-parts] parts named for a free couple: ${[...ALL_NAMED].sort().join(', ')}`);
  assert.ok(ALL_NAMED.size >= 8, `only ${ALL_NAMED.size} parts reached the Apply sheet — the fixture tries too little`);
  /* Every held item's parts are named; nothing is held that no effect names. */
  const plan = planHubDraftApply(triedEverything(), LIVE, false);
  const heldParts = new Set(plan.refused.flatMap((i) => hubDraftItemParts(i, LIVE)));
  assert.deepEqual([...heldParts].sort(), [...ALL_NAMED].sort(), 'the plan holds a part the sheet does not name, or the reverse');
});

for (const part of HUB_PART_IDS) {
  test(`(D) owning ${part} lets exactly ${part} through — every other part stays held and named`, () => {
    const owned = hubOwnershipFrom({ fullHeld: false, partHeld: (id) => id === part, paidParts: [], prices: PRICES, fullPrice: FULL });
    const named = partsNamed(owned);
    assert.ok(!named.has(part), `${part} is owned and still named at ✓ Apply`);
    for (const other of ALL_NAMED) if (other !== part) assert.ok(named.has(other), `owning ${part} released ${other}`);
    /* …and what it released is WRITTEN: no held item still needs this part. */
    const plan = planHubDraftApply(triedEverything(), LIVE, owned);
    for (const i of plan.refused) {
      const needs = hubDraftItemParts(i, LIVE);
      assert.ok(needs.some((p) => p !== part), `an item needing only ${part} is still held: ${JSON.stringify(i.kind === 'event' ? i.column : i.kind)}`);
    }
  });
}

test('(D) every part one by one (no Full Pro) holds nothing — and so does Full Pro', () => {
  const allParts = hubOwnershipFrom({ fullHeld: false, partHeld: () => true, paidParts: [], prices: PRICES, fullPrice: FULL });
  assert.equal(allParts.full, false, 'owning every part by comp is not the footer');
  assert.equal(planHubDraftApply(triedEverything(), LIVE, allParts).refused.length, 0);
  assert.equal(planHubDraftApply(triedEverything(), LIVE, everyHubPart()).refused.length, 0);
  assert.equal(planHubDraftApply(triedEverything(), LIVE, true).refused.length, 0, 'the old boolean "owns Pro" no longer means everything');
  assert.deepEqual(
    planHubDraftApply(triedEverything(), LIVE, NO_HUB_PARTS).refused.length,
    planHubDraftApply(triedEverything(), LIVE, false).refused.length,
    'the old boolean "no Pro" no longer means nothing',
  );
});

test('(D) a scene holding two parts writes the owned one now and holds only the other', () => {
  const styleOnly = hubOwnershipFrom({ fullHeld: false, partHeld: (id) => id === 'style', paidParts: [], prices: PRICES, fullPrice: FULL });
  const plan = planHubDraftApply(triedEverything(), LIVE, styleOnly);
  const written = plan.apply.find((i) => i.kind === 'widget' && i.widgetType === 'schedule' && i.field === 'canvas');
  assert.ok(written, 'the Style half of the scene was not written');
  const canvas = written!.value as { elements?: { heading?: { font?: string; motion?: unknown } }; preset?: string };
  assert.equal(canvas.elements?.heading?.font, 'script', 'the owned font did not go live');
  assert.equal(canvas.elements?.heading?.motion, undefined, 'the unowned motion leaked out');
  assert.equal(canvas.preset, undefined, 'the unowned scene animation leaked out');
});

/* ── (E) THE FOOTER ─────────────────────────────────────────────────────── */

test('(E) every part held one by one is still not the footer; only `full` is', () => {
  const allHeld = hubOwnershipFrom({ fullHeld: false, partHeld: () => true, paidParts: ['music'], prices: PRICES, fullPrice: FULL });
  assert.equal(allHeld.full, false);
  assert.equal(own(['reveal', 'background', 'photos', 'style', 'motion']).full, true);
});
