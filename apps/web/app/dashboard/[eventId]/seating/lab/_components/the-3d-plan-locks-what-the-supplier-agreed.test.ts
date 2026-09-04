/**
 * MB15 · A PART THE SUPPLIER AGREED TO STOPS MOVING IN BOTH SURFACES.
 *
 * MB12 built the handshake and put its panel on the mood board — section 02 for
 * attire roles, section 03 for room zones. Section 03 does not edit the design;
 * it links to the Seat Plan. And the Reception Designer it links to, the ONE
 * editor of `events.reception_design`, knew nothing about finalization: a couple
 * could re-dress a ceiling their stylist had already signed off, in the only
 * place that value is editable, and neither surface said a word.
 *
 * That is two mechanisms disagreeing about one fact. Both pass their own tests;
 * the couple is told two different things; the supplier builds what they agreed
 * to and it is wrong on the day.
 *
 * ── WHAT THIS FILE PROVES ─────────────────────────────────────────────────
 *   1 · ONE PREDICATE. For every value `moodboard_part_finalizations.state` can
 *       hold, "the panel says locked" and "the room says frozen" are the SAME
 *       answer — asserted behaviourally, over the whole vocabulary, not by
 *       grepping for the function's name. Lock it in one surface only and this
 *       goes red.
 *   2 · THE WIRING. The prop chain page → loader → lab → Hud → editor, and the
 *       refusal at the one funnel every chip passes through. This arc's single
 *       most repeated defect is a correct predicate and a correct component with
 *       the one line joining them free to break silently.
 *   3 · The reference photos beside a zone are the LIVE ones — the read that
 *       feeds them filters soft-deleted rows, which it did not.
 *
 * ⚠ THE UI IS NOT THE LOCK, AND THIS FILE DOES NOT CLAIM IT IS.
 * `events_hold_part_finalization_design` (migration 20271203855754) re-asserts
 * an agreed zone on every write to `reception_design`, from every writer. That
 * half is proven in `tests/db/a-finalized-zone-cannot-be-re-dressed.db.test.ts`
 * against a real Postgres. What is here is the half that makes the refusal
 * LEGIBLE rather than a silent revert.
 *
 * Run from `apps/web` (`pnpm test:unit`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { partFinalizationStateOf, isPartFinalized } from '@/lib/lock-request-state';
import {
  finalizedPartsNow,
  type PartFinalizationRecord,
} from '@/lib/moodboard-finalization-rows';
import { renderPartById } from '@/lib/moodboard-render-parts';
import { RECEPTION_PARTS } from '@/lib/reception-scene';

const HERE = dirname(fileURLToPath(import.meta.url));
const EDITOR = join(HERE, 'reception-design-editor.tsx');
const LAB = join(HERE, 'seating-lab-3d.tsx');
const LOADER = join(HERE, 'seating-lab-loader.tsx');
const PAGE = join(HERE, '..', 'page.tsx');
const PANEL = join(
  HERE, '..', '..', '..', 'studio', 'mood-board', '_components', 'part-finalization-panel.tsx',
);

const src = (p: string) => stripComments(readFileSync(p, 'utf8'));

/**
 * One row. `agreedAt` is a SEPARATE knob on purpose: a row that reached
 * `agreed` and was later re-opened still carries the agreed-at of the round
 * before, so "has an agreed_at" and "is agreed" are genuinely independent —
 * and confusing them is the exact wrong predicate this file blocks.
 */
function row(state: string, agreedAt: string | null = state === 'agreed' ? '2026-09-04T02:00:00Z' : null): PartFinalizationRecord {
  return {
    finalization_id: 'f1',
    part_id: 'room:ceiling',
    vendor_id: 'v1',
    state,
    expires_at: null,
    agreed_at: agreedAt,
    declined_at: null,
    decline_reason: null,
    reopen_state: null,
    reopen_expires_at: null,
    reopen_decline_reason: null,
    frozen_palette_keys: null,
    frozen_dressing_fields: null,
  };
}

/* ══ 1 · ONE PREDICATE, TWO SURFACES ══════════════════════════════════════ */

test('the panel and the room give the SAME answer for every state the column holds', () => {
  /*
    THE SABOTAGE THIS BLOCKS: freezing the room on `state === 'agreed'` spelled
    out again, or on `agreed_at !== null`. Both look right. `agreed_at` in
    particular survives its own round — a re-opened row still carries the
    agreed-at of the round before — so a re-opened zone would stay frozen in the
    room while the panel offered it back. Asserted over the WHOLE vocabulary,
    including a value the column cannot hold, because "unknown" must not read as
    "agreed".
  */
  for (const state of ['pending', 'agreed', 'declined', 'cancelled', 'expired', '', 'wat']) {
    // BOTH histories: a row that never reached agreed, and one that did and was
    // then closed. A predicate reading `agreed_at` passes the first column and
    // fails the second — which is why both are walked.
    for (const agreedAt of [null, '2026-09-01T00:00:00Z']) {
      const r = row(state, agreedAt);
      const panelSaysLocked = partFinalizationStateOf(r) === 'locked';
      const roomSaysFrozen = finalizedPartsNow([r]).has(r.part_id);
      assert.equal(
        roomSaysFrozen,
        panelSaysLocked,
        `state='${state}' agreed_at=${agreedAt}: the mood board's panel and the 3D Plan ` +
          'disagree. One of them is reading something other than isPartFinalized, and a ' +
          'couple is being told two different things about one part.',
      );
      assert.equal(roomSaysFrozen, isPartFinalized(r));
    }
  }
});

test('a re-opened part is not frozen by a stale agreed_at', () => {
  // The trap the booking handshake's own docblock opens with, re-checked here
  // because this file is what a future session will read before touching it.
  const reopened: PartFinalizationRecord = {
    ...row('agreed'),
    state: 'cancelled',
    agreed_at: '2026-09-01T00:00:00Z',
  };
  assert.equal(finalizedPartsNow([reopened]).size, 0);
});

test('the agreement carries who and when, and invents neither', () => {
  const names = new Map([['v1', 'Sampaguita Studio']]);
  const who = finalizedPartsNow([row('agreed')], names).get('room:ceiling')!;
  assert.equal(who.vendorName, 'Sampaguita Studio');
  assert.equal(who.agreedAt, '2026-09-04T02:00:00Z');
  // No name on file → null, never a placeholder. "Agreed with your supplier"
  // with no name is honest; a made-up name is not.
  assert.equal(finalizedPartsNow([row('agreed')]).get('room:ceiling')!.vendorName, null);
});

test('only room parts reach the design editor — people and place freeze colours', () => {
  // A `people:bride` agreement freezes colours in role_palette. It has no design
  // chip in the Reception Designer, and claiming one would freeze a zone nobody
  // agreed to.
  const zones = new Set(RECEPTION_PARTS.map((p) => p.id as string));
  for (const id of ['room:ceiling', 'people:bride', 'place:cake']) {
    const part = renderPartById(id);
    assert.ok(part, `${id} is not in the render-part registry`);
    if (part!.group === 'room') {
      assert.ok(zones.has(part!.sourceKey), `${id} maps to '${part!.sourceKey}', not a reception part`);
    }
  }
  assert.equal(renderPartById('people:bride')!.group, 'people');
  assert.equal(renderPartById('place:cake')!.group, 'places');
});

/* ══ 2 · THE WIRING — EVERY LINE THAT JOINS THEM ═════════════════════════ */

test('the mood board panel still reads the shared vocabulary', () => {
  assert.match(
    src(PANEL),
    /import \{[\s\S]*?\bpartFinalizationStateOf\b[\s\S]*?\} from '@\/lib\/lock-request-state'/,
    'section 02/03 stopped reading lock-request-state — the two surfaces are now free to drift',
  );
});

test('the Seat Plan resolves the freeze through the same predicate, on the server', () => {
  const page = src(PAGE);
  assert.match(page, /finalizedPartsNow\(/, 'the lab page no longer resolves who agreed to what');
  assert.match(
    page,
    /\.from\('moodboard_part_finalizations'\)/,
    'the lab page stopped reading the handshake rows at all',
  );
  // Resolved to reception zone ids through the REGISTRY, never by slicing the
  // string by hand — `room:` is a shape the registry owns.
  assert.match(page, /renderPartById\(partId\)/);
  assert.match(page, /part\.group !== 'room'/);
});

test('the prop chain from the page to the chips is unbroken, link by link', () => {
  /*
    Each of these is ONE line, and any one of them can be deleted while every
    other test in this file still passes. That is the shape this repo keeps
    shipping: a correct resolver, a correct component, and nothing joining them.
  */
  assert.match(src(PAGE), /finalizedByPart=\{finalizedByPart\}/, 'page → loader');
  assert.match(src(LOADER), /finalizedByPart\?: Record<string,/, 'the loader does not carry it');
  const lab = src(LAB);
  assert.match(lab, /\bfinalizedByPart,/, 'SeatingLab3D does not destructure it');
  assert.equal(
    (lab.match(/finalizedByPart=\{finalizedByPart\}/g) ?? []).length,
    2,
    'expected exactly 2 forwards inside seating-lab-3d (SeatingLab3D → Hud, Hud → the ' +
      'Reception Designer). A COUNT, not a spot-check: a file-level match cannot say WHICH ' +
      'hop still carries it, and the broken hop is the regression.',
  );
  assert.match(src(EDITOR), /\bfinalizedByPart,\n\}: Props\) \{/, 'the editor does not accept it');
});

test('the editor refuses the tap at the one funnel every chip goes through', () => {
  const s = src(EDITOR);
  const fn = s.slice(s.indexOf('function choose('), s.indexOf('\n  }', s.indexOf('function choose(')));
  assert.ok(fn.length > 40, 'the choose() window is empty — has the function been renamed?');
  assert.match(
    fn,
    /if \(finalizedByPart\?\.\[part\]\) return;/,
    'choose() is the single funnel both the single-select and the multi-select chips pass ' +
      'through. Refusing only in the JSX leaves any future control free to route around it.',
  );
  // …and it is the FIRST thing the function does, before either branch.
  assert.ok(
    fn.indexOf('finalizedByPart') < fn.indexOf('attrDef.multi'),
    'the refusal runs after the multi-select branch — a multi-select chip on a frozen zone ' +
      'would still toggle',
  );
});

test('a frozen zone disables every chip, selected or not', () => {
  const s = src(EDITOR);
  assert.match(
    s,
    /const blocked =\s*Boolean\(activeFinalized\) \|\| \(atCap && !selected && opt\.exclusive !== true\)/,
    'turning the agreed treatment OFF is as much a change as turning another one on, so a ' +
      'frozen zone must block the selected chip too',
  );
  assert.match(s, /disabled=\{blocked\}/, 'the computed refusal never reaches the button');
});

test('the room says WHO agreed and WHEN — never a control that just stops responding', () => {
  const s = src(EDITOR);
  assert.match(s, /\{activeFinalized \? \(/, 'the agreed notice is not rendered');
  assert.match(s, /Agreed\{activeFinalized\.vendorName \? ` with \$\{activeFinalized\.vendorName\}` : ''\}/);
  assert.match(s, /activeFinalizedOn \? ` on \$\{activeFinalizedOn\}` : ''/);
  // The notice sits with the zone's own controls, not adrift at the top of the
  // panel — same placement rule MB1's disclosure follows.
  const notice = s.indexOf('{activeFinalized ? (');
  const chips = s.indexOf('activeDef.attributes.map');
  // ~3.3k today: the inspiration strip and the people-layer note sit between
  // them. The bound is a drift alarm, not a byte count — a notice pushed to the
  // other end of the panel stops explaining the disabled chips.
  assert.ok(
    notice > 0 && chips > notice && chips - notice < 5000,
    `the notice has drifted ${chips - notice} chars from the chips it explains`,
  );
});

/* ══ 3 · THE REFERENCE PHOTOS BESIDE A ZONE ARE THE LIVE ONES ════════════ */

test('the zone reference strip reads only photos that have not been removed', () => {
  /*
    `event_inspiration_assets` replaces a cell by SOFT-DELETING the row that held
    it — the partial UNIQUE(event_id, slot_key, slot_position) WHERE removed_at
    IS NULL requires it. This read shipped without the filter, so a couple who
    replaced their ceiling photo saw BOTH beside the ceiling zone, with nothing
    saying which was current. The mood board's own read has always filtered.
  */
  const page = src(PAGE);
  const q = page.slice(page.indexOf("from('event_inspiration_assets')"));
  const stmt = q.slice(0, q.indexOf(';'));
  assert.match(
    stmt,
    /\.is\('removed_at', null\)/,
    'the Seat Plan is showing the couple photos they deleted, next to the zone they deleted ' +
      'them from',
  );
});

test('a render pick and an upload are the same row, so both reach the zone', () => {
  // MB9's pool pick writes ONE row in event_inspiration_assets with
  // `source_kind='render_pick'` and no other table touched. The Seat Plan's read
  // filters by event and slot only — so a picked render surfaces beside the zone
  // exactly as an upload does, and MUST NOT grow a source_kind filter.
  const page = src(PAGE);
  const q = page.slice(page.indexOf("from('event_inspiration_assets')"));
  const stmt = q.slice(0, q.indexOf(';'));
  assert.doesNotMatch(
    stmt,
    /source_kind/,
    "filtering by source would drop the couple's own picked renders and their supplier " +
      'gallery picks from the zone they chose them for',
  );
});

/* ══ 4 · THE COUPLE'S OWN NAME FOR THE ROOM ══════════════════════════════ */

test("the theme name reaches the room's legend, not merely the page", () => {
  assert.match(src(PAGE), /moodboard_theme_name/, 'the lab page never reads the theme name');
  assert.match(src(PAGE), /themeName=\{themeName\}/, 'page → loader');
  assert.match(src(LOADER), /themeName\?: string \| null;/, 'the loader does not carry it');
  const lab = src(LAB);
  assert.match(lab, /themeName=\{themeName\}/, 'SeatingLab3D → Hud');
  // And it is PAINTED, in the legend block, beside the disclosure — a prop
  // threaded to a component that never renders it is the Panood shape.
  const at = lab.indexOf('{themeName ? (');
  assert.ok(at > 0, 'the room legend never renders the theme name');
  const legend = lab.indexOf('SIDE_COLOR.both');
  assert.ok(
    legend > at && legend - at < 3000,
    'the theme name has drifted away from the room legend it is supposed to label',
  );
  // Null means NO title, never "Untitled event".
  assert.doesNotMatch(lab, /Untitled event/);
});
