import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEntourage, entourageLines, type EntourageGuestRow } from '@/lib/entourage';
import { marchSections, printedSectionOrder } from '@/lib/march-sections';
import { ENTOURAGE_GROUP_KEYS, entourageLines, orderedGroupKeys } from '@/lib/entourage';
import { nextSectionOrder } from '@/lib/march-moves';
import { keyTarget, planMove, planSectionsDefault, sectionsMoved, planDrop, readSource, readTarget, type MarchSection, type MarchStep } from '@/lib/march-drag';

/*
 * ⚖ Owner 2026-10-06 — the Wedding March is a drag-and-drop maker. Each drag is
 * one or two SHIPPED march actions; these pin which ones, and — the part a
 * screen cannot fake — that what the drop SHOWS at once is what the march
 * prints after the server has done it.
 *
 * `serverDoes` replays a step the way its SQL function does (migration
 * `march_is_its_own_table`: join_entourage_line · swap_entourage_places ·
 * unpair_guest · set_entourage_order, + the actions' `pinLineOrder`), then the
 * march is rebuilt by the PRINTER (`buildEntourage(…, { march: true })`). The
 * prediction must equal that rebuild, row for row and column for column.
 */

type Spot = { walk_no: number; place_in_walk: number };
type G = EntourageGuestRow & { guest_id: string };

function guest(id: string, first: string, last: string, role: string, spot?: Spot): G {
  return { guest_id: id, first_name: first, last_name: last, role, extra_roles: [], march: spot ?? null };
}
const at = (walk_no: number, place_in_walk = 0): Spot => ({ walk_no, place_in_walk });

/** maria-and-jose's shape: the couple (unplaced — nobody has placed them yet), parents, sponsors, bearers. */
function fixture(): G[] {
  return [
    guest('groom', 'Jose', 'Dela Cruz', 'groom'),
    guest('gdad', 'Manuel', 'Dela Cruz', 'groom_parents', at(0, 0)),
    guest('gmom', 'Rosa', 'Dela Cruz', 'groom_parents', at(0, 1)),
    guest('bride', 'Maria', 'Santos', 'bride'),
    guest('bmom', 'Lita', 'Santos', 'bride_parents', at(9, 0)),
    guest('bdad', 'Ramon', 'Santos', 'bride_parents', at(9, 1)),
    guest('n1', 'Ricardo', 'Villahermosa', 'principal_sponsor_ninong', at(2, 0)),
    guest('a1', 'Jessica', 'Villahermosa', 'principal_sponsor_ninang', at(2, 1)),
    guest('n2', 'Cesar', 'Lim', 'principal_sponsor_ninong', at(3, 0)),
    guest('a2', 'Pilar', 'Lim', 'principal_sponsor_ninang', at(3, 1)),
    guest('n3', 'Ben', 'Ocampo', 'principal_sponsor_ninong', at(4, 0)),
    guest('c1', 'Paolo', 'Tan', 'candle_sponsor', at(5, 0)),
    guest('c2', 'Ivy', 'Tan', 'candle_sponsor', at(5, 1)),
    guest('v1', 'Karl', 'Lim', 'veil_sponsor', at(6, 0)),
    guest('rb', 'Joaquin', 'Buanhog', 'ring_bearer', at(7, 0)),
    guest('cb', 'Enzo', 'Bautista', 'coin_bearer', at(8, 0)),
  ];
}

/** The march as the maker receives it — the printer's own march groups, through `marchSections`. */
function sectionsOf(rows: readonly G[]): MarchSection[] {
  return marchSections(buildEntourage(rows, null, {}, undefined, { march: true }));
}
const shape = (ss: readonly MarchSection[]) => ss.map((s) => `${s.key}: ${s.rows.map((r) => `[${r[0]?.id ?? '-'} ${r[1]?.id ?? '-'}]`).join(' ')}`);

/* ── the SQL functions, replayed ───────────────────────────────────────── */
function serverDoes(rows: G[], step: MarchStep): G[] {
  const m = new Map(rows.map((g) => [g.guest_id, g.march ? { ...(g.march as Spot) } : null]));
  const spot = (id: string) => m.get(id) ?? null;
  const lines = () => entourageLines(rows.map((g) => ({ ...g, march: m.get(g.guest_id) })), step.section);
  const setOrder = (leads: readonly string[]) => {
    const cur = lines();
    const byLead = new Map(cur.map((l) => [(l[0] ?? l[1])!.id!, l]));
    const ordered = leads.map((id) => byLead.get(id)!);
    assert.equal(ordered.length, cur.length);
    assert.ok(ordered.every(Boolean), `the order names a line the server does not have: ${leads.join(',')}`);
    let max = Math.max(-1, ...[...m.values()].filter(Boolean).map((s) => s!.walk_no));
    const claimed: number[] = [];
    const olds = ordered.map((l) => {
      const ws = l.filter(Boolean).map((p) => spot(p!.id!)?.walk_no).filter((w): w is number => typeof w === 'number');
      const old = ws.length ? Math.min(...ws) : null;
      if (old !== null && !claimed.includes(old)) { claimed.push(old); return old; }
      return null;
    });
    // The section's own numbers, lowest first, then fresh ones above every walk — line i takes the i-th.
    const pool = [...claimed].sort((x, y) => x - y);
    for (const o of olds) if (o === null) pool.push(++max);
    const news = olds.map((_, i) => pool[i]!);
    const before = new Map([...m].map(([k, v]) => [k, v ? { ...v } : null]));
    for (const [id, s] of before) {
      const i = olds.findIndex((o) => o !== null && s?.walk_no === o);
      if (i !== -1) m.set(id, { walk_no: news[i]!, place_in_walk: s!.place_in_walk });
    }
    ordered.forEach((l, i) => {
      l.filter(Boolean).forEach((p, k) => {
        if (spot(p!.id!)?.walk_no !== news[i]) m.set(p!.id!, { walk_no: news[i]!, place_in_walk: k });
      });
    });
  };
  const pin = () => {
    const cur = lines();
    if (cur.some((l) => l.every((p) => !p || !spot(p.id!)))) setOrder(cur.map((l) => (l[0] ?? l[1])!.id!));
  };
  const shiftAfter = (v: number) => { for (const [k, s] of m) if (s && s.walk_no > v) m.set(k, { ...s, walk_no: s.walk_no + 1 }); };

  if (step.kind === 'order') setOrder(step.leads);
  if (step.kind === 'swap') {
    pin();
    const a = spot(step.a)!, b = spot(step.b)!;
    m.set(step.a, { ...b }); m.set(step.b, { ...a });
  }
  if (step.kind === 'join') {
    pin();
    const v = spot(step.anchor)!.walk_no;
    const others = [...m].filter(([k, s]) => s?.walk_no === v && k !== step.anchor);
    if (others.length) { shiftAfter(v); for (const [k, s] of others) m.set(k, { ...s!, walk_no: v + 1 }); }
    const place = Math.max(0, ...[...m].filter(([k, s]) => s?.walk_no === v && k !== step.joiner).map(([, s]) => s!.place_in_walk)) + 1;
    m.set(step.joiner, { walk_no: v, place_in_walk: place });
  }
  if (step.kind === 'unpair') {
    const s = spot(step.guest);
    if (s && [...m].some(([k, x]) => x?.walk_no === s.walk_no && k !== step.guest)) {
      shiftAfter(s.walk_no);
      m.set(step.guest, { walk_no: s.walk_no + 1, place_in_walk: 0 });
    }
  }
  return rows.map((g) => ({ ...g, march: m.get(g.guest_id) ?? null }));
}

/** Plan a drop, replay its steps on the "server", and require the screen to have shown exactly that. */
function drop(rows: G[], source: Parameters<typeof planDrop>[1], target: Parameters<typeof planDrop>[2]) {
  const before = sectionsOf(rows);
  const plan = planDrop(before, source, target);
  assert.ok(plan && plan.ok, `refused: ${plan && !plan.ok ? plan.reason : 'no move'}`);
  let after = rows;
  for (const step of plan.steps) after = serverDoes(after, step);
  assert.deepEqual(shape(plan.next), shape(sectionsOf(after)), 'the drop showed something the march does not print');
  // …and Undo puts back exactly what was there.
  let undone = after;
  for (const step of plan.undo) undone = serverDoes(undone, step);
  assert.deepEqual(shape(sectionsOf(undone)), shape(before), 'Undo did not put the march back');
  return { plan, before, after: sectionsOf(after) };
}

test('🚶 the couple are in the march — the groom and his parents FIRST, the bride and her parents LAST', () => {
  const s = sectionsOf(fixture());
  assert.equal(s[0]!.key, 'groom_side');
  assert.equal(s.at(-1)!.key, 'bride_side');
  assert.deepEqual(shape([s[0]!, s.at(-1)!]), ['groom_side: [gdad gmom] [groom -]', 'bride_side: [bmom bdad] [bride -]']);
  // Every parent walks — the four of them, as two walks of two.
  const people = s.flatMap((x) => x.rows.flat()).filter(Boolean).map((p) => p!.id);
  for (const id of ['gdad', 'gmom', 'bmom', 'bdad', 'groom', 'bride']) assert.ok(people.includes(id), `${id} is not in the march`);
  // "Parents" is not drawn twice in the march…
  assert.ok(!s.some((x) => x.key === 'parents'));
  // …and what PRINTS is unchanged: Parents, never the couple.
  const printed = buildEntourage(fixture());
  assert.ok(printed.some((g) => g.key === 'parents'));
  assert.ok(!printed.some((g) => g.rows.flat().some((p) => p?.id === 'groom' || p?.id === 'bride')));
});

test('a name onto another name → they trade places (swapEntouragePlaces), across the aisle too', () => {
  const { plan } = drop(fixture(), { kind: 'name', id: 'c1' }, { kind: 'name', id: 'v1' });
  assert.deepEqual(plan.steps.map((s) => s.kind), ['swap']);
  assert.match(plan.said, /traded places/);
  // Unsided section: the right-hand candle sponsor onto the lone veil sponsor — she crosses to the left.
  const across = drop(fixture(), { kind: 'name', id: 'c2' }, { kind: 'name', id: 'v1' });
  assert.deepEqual(across.after.find((x) => x.key === 'secondary_sponsors')!.rows.map((r) => [r[0]?.id ?? null, r[1]?.id ?? null]), [['c1', 'v1'], ['c2', null]]);
  // The groom — who has no walk row yet — trades with his father; the action pins the order first.
  drop(fixture(), { kind: 'name', id: 'groom' }, { kind: 'name', id: 'gdad' });
});

test('a name onto the empty spot beside a lone walker → they walk together (joinEntourageLine)', () => {
  const { plan } = drop(fixture(), { kind: 'name', id: 'cb' }, { kind: 'beside', anchor: 'rb' });
  assert.deepEqual(plan.steps.map((s) => s.kind), ['join']);
  assert.equal(plan.said, 'Enzo Bautista walks with Joaquin Buanhog');
  // Out of a pair: the one left behind walks alone, and the toast says so.
  const left = drop(fixture(), { kind: 'name', id: 'c2' }, { kind: 'beside', anchor: 'v1' });
  assert.match(left.plan.said, /Paolo Tan walks alone$/);
  // The bride walks with her father.
  drop(fixture(), { kind: 'name', id: 'bdad' }, { kind: 'beside', anchor: 'bride' });
});

test('a name dragged out of its pair → the pair SPLITS into two walks, one after the other (unpairGuestAction)', () => {
  const { plan, after } = drop(fixture(), { kind: 'name', id: 'gmom' }, { kind: 'gap', section: 'groom_side', index: 1 });
  assert.deepEqual(plan.steps.map((s) => s.kind), ['unpair']);
  assert.equal(plan.said, 'Rosa Dela Cruz walks alone, right behind Manuel Dela Cruz');
  assert.deepEqual(shape([after[0]!]), ['groom_side: [gdad -] [gmom -] [groom -]']);
  // Right ABOVE its pair → she walks first: unpair, then the order.
  const above = drop(fixture(), { kind: 'name', id: 'gmom' }, { kind: 'gap', section: 'groom_side', index: 0 });
  assert.deepEqual(above.plan.steps.map((s) => s.kind), ['unpair', 'order']);
  assert.deepEqual(shape([above.after[0]!]), ['groom_side: [gmom -] [gdad -] [groom -]']);
  // A Ninang out of her pair keeps HER column (the section has sides).
  const ninang = drop(fixture(), { kind: 'name', id: 'a1' }, { kind: 'gap', section: 'principal_sponsors', index: 1 });
  assert.deepEqual(shape([ninang.after.find((x) => x.key === 'principal_sponsors')!]), ['principal_sponsors: [n1 -] [- a1] [n2 a2] [n3 -]']);
});

test('a name into a gap → it walks there on its own (setEntourageLineOrder), a partner left behind walks alone', () => {
  const lone = drop(fixture(), { kind: 'name', id: 'cb' }, { kind: 'gap', section: 'bearers', index: 0 });
  assert.deepEqual(lone.plan.steps.map((s) => s.kind), ['order']);
  assert.match(lone.plan.said, /^Enzo Bautista now walks at step \d+$/);
  const far = drop(fixture(), { kind: 'name', id: 'n1' }, { kind: 'gap', section: 'principal_sponsors', index: 3 });
  assert.deepEqual(far.plan.steps.map((s) => s.kind), ['unpair', 'order']);
  assert.match(far.plan.said, /Ricardo Villahermosa walks alone at step \d+ · Jessica Villahermosa walks alone too/);
});

test('a whole walk, dragged by its number → the walk moves (setEntourageLineOrder)', () => {
  const s = sectionsOf(fixture());
  const lead = s.find((x) => x.key === 'principal_sponsors')!.rows[2]![0]!.id;
  const { plan } = drop(fixture(), { kind: 'walk', section: 'principal_sponsors', lead }, { kind: 'gap', section: 'principal_sponsors', index: 0 });
  assert.deepEqual(plan.steps.map((s) => s.kind), ['order']);
});

test('refused in words, never faked: across sections, two sides that cannot swap, a pair with itself', () => {
  const s = sectionsOf(fixture());
  const refuse = (src: Parameters<typeof planDrop>[1], tgt: Parameters<typeof planDrop>[2]) => {
    const p = planDrop(s, src, tgt);
    assert.ok(p && !p.ok, 'a move with no shipped writer was accepted');
    return p.reason;
  };
  assert.match(refuse({ kind: 'name', id: 'rb' }, { kind: 'name', id: 'c1' }), /same section/);
  assert.match(refuse({ kind: 'name', id: 'rb' }, { kind: 'gap', section: 'secondary_sponsors', index: 0 }), /decides the section/);
  assert.match(refuse({ kind: 'name', id: 'n2' }, { kind: 'name', id: 'a1' }), /different sides/);
  assert.match(refuse({ kind: 'name', id: 'c1' }, { kind: 'name', id: 'c2' }), /already walk together/);
  // A drop where it already stands is nothing at all (no ring).
  assert.equal(planDrop(s, { kind: 'name', id: 'rb' }, { kind: 'gap', section: 'bearers', index: 0 }), null);
  assert.equal(planDrop(s, { kind: 'name', id: 'rb' }, { kind: 'name', id: 'rb' }), null);
});

test('no word says couple or solo', () => {
  const s = sectionsOf(fixture());
  const all: string[] = [];
  for (const [src, tgt] of [
    [{ kind: 'name', id: 'c2' }, { kind: 'beside', anchor: 'v1' }],
    [{ kind: 'name', id: 'gmom' }, { kind: 'gap', section: 'groom_side', index: 1 }],
    [{ kind: 'name', id: 'n1' }, { kind: 'gap', section: 'principal_sponsors', index: 3 }],
    [{ kind: 'name', id: 'c1' }, { kind: 'name', id: 'v1' }],
  ] as const) {
    const p = planDrop(s, src, tgt);
    all.push(p && 'said' in p ? p.said : p && 'reason' in p ? p.reason : '');
  }
  assert.ok(all.every((w) => w.length > 0));
  assert.doesNotMatch(all.join(' '), /\bcouple\b|\bsolo\b/i);
});

test('the drop zones round-trip', () => {
  assert.deepEqual(readTarget('gap|bearers|2'), { kind: 'gap', section: 'bearers', index: 2 });
  assert.deepEqual(readTarget('beside|abc'), { kind: 'beside', anchor: 'abc' });
  assert.deepEqual(readSource('walk|bearers|abc'), { kind: 'walk', section: 'bearers', lead: 'abc' });
  assert.equal(readTarget('gap|bearers|x'), null);
});

test('⌨ the keyboard moves a held name or walk one step — out of its pair first', () => {
  const s = sectionsOf(fixture());
  // A lone bearer one step down: the gap after the next walk.
  const down = keyTarget(s, { kind: 'name', id: 'rb' }, 1);
  assert.deepEqual(down, { kind: 'gap', section: 'bearers', index: 2 });
  drop(fixture(), { kind: 'name', id: 'rb' }, down!);
  // A name in a pair: ↓ splits it right behind its pair, ↑ right before.
  assert.deepEqual(keyTarget(s, { kind: 'name', id: 'gmom' }, 1), { kind: 'gap', section: 'groom_side', index: 1 });
  assert.deepEqual(keyTarget(s, { kind: 'name', id: 'gmom' }, -1), { kind: 'gap', section: 'groom_side', index: 0 });
  // Nowhere above the first walk.
  assert.equal(keyTarget(s, { kind: 'name', id: 'rb' }, -1), null);
});

test('🔑 the printed Parents keep the groom’s side first, whatever the march numbers say', () => {
  // The groom has no walk yet; dragging him ahead of his parents hands THEM a fresh, highest number.
  const { after } = drop(fixture(), { kind: 'name', id: 'groom' }, { kind: 'gap', section: 'groom_side', index: 0 });
  assert.deepEqual(shape([after[0]!]), ['groom_side: [groom -] [gdad gmom]']);
  let rows = fixture();
  for (const step of planDrop(sectionsOf(rows), { kind: 'name', id: 'groom' }, { kind: 'gap', section: 'groom_side', index: 0 })!.ok ? (planDrop(sectionsOf(rows), { kind: 'name', id: 'groom' }, { kind: 'gap', section: 'groom_side', index: 0 }) as { steps: MarchStep[] }).steps : []) rows = serverDoes(rows, step);
  const parents = buildEntourage(rows).find((g) => g.key === 'parents')!;
  assert.deepEqual(parents.rows.map((r) => r.map((p) => p?.id ?? null)), [['gdad', 'gmom'], ['bmom', 'bdad']], 'the bride’s parents print first');
});

test('🔗 a walk that spans two sections is split before a reorder — the other side never moves', () => {
  // The groom's father walks with the bride's mother (one walk, two march sections).
  const rows = fixture().map((g) =>
    g.guest_id === 'gdad' ? { ...g, march: at(0, 0) } : g.guest_id === 'bmom' ? { ...g, march: at(0, 1) } : g.guest_id === 'gmom' ? { ...g, march: at(1, 0) } : g,
  );
  const s = sectionsOf(rows);
  const groomSide = s.find((x) => x.key === 'groom_side')!;
  assert.ok(groomSide.rows.flat().find((p) => p?.id === 'gdad')?.tied, 'the tie is not seen');
  const { plan, after } = drop(rows, { kind: 'name', id: 'groom' }, { kind: 'gap', section: 'groom_side', index: 0 });
  assert.equal(plan.steps[0]!.kind, 'unpair', 'the tied walk is not split first');
  assert.deepEqual(shape([after.at(-1)!]), shape([s.at(-1)!]), 'the bride’s side moved');
});

test('one person, one place — a second role does not draw them twice', () => {
  const rows = fixture().map((g) => (g.guest_id === 'rb' ? { ...g, extra_roles: ['candle_sponsor'] } : g));
  const ids = sectionsOf(rows).flatMap((x) => x.rows.flat()).filter(Boolean).map((p) => p!.id);
  assert.equal(ids.filter((id) => id === 'rb').length, 1);
});

/* ── SECTIONS — drag a header (controller 2026-10-06: "restore section reordering the drag way") ── */

/** `moveEntourageSection` / `resetEntourageSections`, replayed exactly: `readAllGroups` + `nextSectionOrder`. */
function serverSections(rows: readonly G[], saved: string[] | null, step: MarchStep): string[] | null {
  if (step.kind === 'sections-default') return null;
  assert.equal(step.kind, 'section');
  if (step.kind !== 'section') return saved;
  const full = orderedGroupKeys(saved);
  const visible = new Set(full.filter((k) => entourageLines(rows, k).length > 0));
  return nextSectionOrder(full, visible, step.section, step.direction) ?? full;
}
const marchOf = (rows: readonly G[], saved: string[] | null) => {
  const groups = buildEntourage(rows, saved, {}, undefined, { march: true });
  return { sections: marchSections(groups), printed: printedSectionOrder(groups, saved) };
};
const keysOf = (ss: readonly MarchSection[]) => ss.map((x) => x.key);

function dropSection(saved: string[] | null, from: string, to: string) {
  const rows = fixture();
  const before = marchOf(rows, saved);
  const plan = planMove(before.sections, before.printed, { kind: 'section', key: from }, { kind: 'section', key: to });
  assert.ok(plan && plan.ok, `refused: ${plan && !plan.ok ? plan.reason : 'no move'}`);
  let after = saved;
  for (const step of plan.steps) after = serverSections(rows, after, step);
  const now = marchOf(rows, after);
  assert.deepEqual(keysOf(plan.sections), keysOf(now.sections), 'the drop showed a section order the march does not have');
  assert.deepEqual(plan.printed, now.printed, 'the predicted saved order is not the one written');
  let undone = after;
  for (const step of plan.undo) undone = serverSections(rows, undone, step);
  assert.deepEqual(keysOf(marchOf(rows, undone).sections), keysOf(before.sections), 'Undo did not put the sections back');
  assert.deepEqual(marchOf(rows, undone).printed, before.printed, 'Undo did not put the printed order back');
  return { plan, now };
}

test('🚶 a section dragged by its header moves whole — the groom’s side stays first, the bride’s last', () => {
  const { plan, now } = dropSection(null, 'bearers', 'principal_sponsors');
  assert.deepEqual(keysOf(now.sections), ['groom_side', 'bearers', 'principal_sponsors', 'secondary_sponsors', 'bride_side']);
  assert.ok(plan.steps.every((s) => s.kind === 'section'), 'a section move used something other than moveEntourageSection');
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.said, 'Bearers now walk before Principal Sponsors');
  // The printed Parents never moved — the drag stopped once the march order was right.
  assert.equal(now.printed[0], 'parents');
  // Down, too.
  const down = dropSection(null, 'principal_sponsors', 'bearers');
  assert.deepEqual(keysOf(down.now.sections), ['groom_side', 'secondary_sponsors', 'bearers', 'principal_sponsors', 'bride_side']);
  // From an arranged order where Parents sits between them, it passes Parents only because it must.
  dropSection(['principal_sponsors', 'parents', 'bearers', 'secondary_sponsors'], 'bearers', 'principal_sponsors');
});

test('the couple’s sides never move and nothing lands before or after them', () => {
  const m = marchOf(fixture(), null);
  const into = planMove(m.sections, m.printed, { kind: 'section', key: 'bearers' }, { kind: 'section', key: 'groom_side' });
  assert.ok(into && !into.ok && /always walk first/.test(into.reason));
  const last = planMove(m.sections, m.printed, { kind: 'section', key: 'bearers' }, { kind: 'section', key: 'bride_side' });
  assert.ok(last && !last.ok && /always walk last/.test(last.reason));
  // A section never lands on a name or in a gap, and a name never on a header.
  assert.equal(planMove(m.sections, m.printed, { kind: 'section', key: 'bearers' }, { kind: 'gap', section: 'bearers', index: 0 }), null);
  assert.equal(planMove(m.sections, m.printed, { kind: 'name', id: 'rb' }, { kind: 'section', key: 'bearers' }), null);
});

test('one line puts the usual order back (resetEntourageSections), and Undo puts yours back', () => {
  const rows = fixture();
  const saved = ['bearers', 'parents', 'secondary_sponsors', 'principal_sponsors'];
  const m = marchOf(rows, saved);
  assert.equal(sectionsMoved(m.printed), true);
  assert.equal(sectionsMoved(marchOf(rows, null).printed), false, 'the line shows on the usual order');
  const plan = planSectionsDefault(m.sections, m.printed)!;
  assert.ok(plan.ok);
  assert.deepEqual(plan.steps, [{ kind: 'sections-default' }]);
  let after: string[] | null = saved;
  for (const step of plan.steps) after = serverSections(rows, after, step);
  assert.deepEqual(keysOf(plan.sections), keysOf(marchOf(rows, after).sections));
  let undone = after;
  for (const step of plan.undo) undone = serverSections(rows, undone, step);
  assert.deepEqual(marchOf(rows, undone).printed, m.printed, 'Undo of the usual order lost the couple’s order');
  assert.equal(ENTOURAGE_GROUP_KEYS[0], 'parents');
});

test('⌨ a held header moves one section with the arrow keys', () => {
  const m = marchOf(fixture(), null);
  assert.deepEqual(keyTarget(m.sections, { kind: 'section', key: 'bearers' }, -1), { kind: 'section', key: 'secondary_sponsors' });
  assert.equal(keyTarget(m.sections, { kind: 'section', key: 'principal_sponsors' }, -1), null, 'it can rise above the groom’s side');
});
