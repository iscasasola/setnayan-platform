/**
 * march-drag.ts — what one DRAG in the Wedding March means, and which shipped
 * march actions carry it out.
 *
 * ⚖ Owner 2026-10-06 (DECISION_LOG "THE WEDDING MARCH ITEM IS A DRAG-AND-DROP
 * MARCH MAKER — NOT A LIST OF NAMES"): *"no need to the toolbar. we can just
 * drag the names"* · *"wedding should be the 2 columns that can drag names on
 * both sides"* · *"walk alone will separate the 2 guests"*.
 *
 *   drag a name onto another name      → they trade places           swapEntouragePlaces
 *   … onto the empty spot beside one   → they walk together          joinEntourageLine
 *   … into a gap between walks         → its own walk, there         setEntourageLineOrder
 *       (out of a pair: the pair SPLITS into two walks first)        (+ unpairGuestAction)
 *   … into the gap right below its pair → the pair splits, in place  unpairGuestAction
 *   drag a walk by its number to a gap → the walk moves               setEntourageLineOrder
 *
 * 🔑 +0 WRITERS. Every step is one of the shipped actions, and every "may it
 * go there?" is `lib/march-moves.ts` — the SAME rule each action asks again on
 * a fresh read before it writes. This module only PREDICTS the result (so the
 * drop shows at once) and names the steps; the server decides.
 *
 * 🔑 THE PREDICTION IS THE PRINTER'S LAYOUT (`pairUp` in lib/entourage.ts): a
 * pair's columns are its people's roles where the section has sides (Ninong
 * left, Ninang right), else who is first in the walk; anyone walking alone
 * stands in their role's column, else on the left. A drop that would need any
 * other layout — a lone walker on the right of a section with no sides, two
 * people of one walk trading sides — has no shipped writer and is refused in
 * words, never faked on screen.
 *
 * ⚖ Pairs are NOT couples (2026-10-01 "A WALK AND A COUPLE ARE INDEPENDENT"):
 * no word here says one.
 *
 * Pure: no React, no I/O — `march-drag.test.ts` drives every gesture.
 */
import type { GuestRole } from '@/lib/guests';
import { columnOfRole, ENTOURAGE_GROUP_KEYS, isMarchOnlyGroup, type EntourageRow } from '@/lib/entourage';
import { joinVerdict, nextSectionOrder, swapVerdict } from '@/lib/march-moves';

/**
 * One person as the maker draws them. `tag` names the groom / the bride.
 * `tied`: their walk's other person stands in ANOTHER section (`marchSections`).
 */
export type MarchPerson = {
  id: string;
  name: string;
  role: string;
  tag?: string | null;
  tied?: boolean;
  /** `guests.side` ('groom' · 'bride' · 'both') — which side of the aisle they walk on (`walkSideOf`). */
  side?: string | null;
};
/**
 * 🚶 Someone in the "Not walking" tray (owner 2026-10-06, `march_not_walking`):
 * a role, no walk. `section` is the march section their role puts them in — where
 * a drag back into the march lands them.
 */
export type MarchOut = MarchPerson & { section: string; sectionLabel: string };
/** One walk: [left, right] — either may be empty. */
export type MarchRow = readonly [MarchPerson | null, MarchPerson | null];
export type MarchSection = { key: string; label: string; rows: readonly MarchRow[] };

/** What is being dragged. */
export type MarchSource =
  | { kind: 'name'; id: string }
  /** A whole walk, by its step number. */
  | { kind: 'walk'; section: string; lead: string }
  /** A whole section, by its header (never the groom's or the bride's side). */
  | { kind: 'section'; key: string }
  /** 🚶 A name in the "Not walking" tray. */
  | { kind: 'out'; id: string };

/** Where it was dropped. */
export type MarchTarget =
  | { kind: 'name'; id: string }
  /** The empty spot beside someone walking alone. */
  | { kind: 'beside'; anchor: string }
  /** The gap before row `index` of a section (`index` = rows.length → after the last). */
  | { kind: 'gap'; section: string; index: number }
  /** Another section's header — the dragged section takes its place. */
  | { kind: 'section'; key: string }
  /** 🚶 The "Not walking" tray — anywhere on it. */
  | { kind: 'tray' };

/** One call of a shipped march action. */
export type MarchStep =
  | { kind: 'swap'; section: string; a: string; b: string }
  | { kind: 'join'; section: string; anchor: string; joiner: string }
  | { kind: 'unpair'; section: string; guest: string }
  | { kind: 'order'; section: string; leads: string[] }
  /** One step of a whole section (`moveEntourageSection`). */
  | { kind: 'section'; section: string; direction: 'up' | 'down' }
  /** The built-in section order back (`resetEntourageSections`). */
  | { kind: 'sections-default' }
  /** 🚶 Into (`walks: false`) or out of (`walks: true`) the "Not walking" tray (`setMarchWalking`). */
  | { kind: 'walking'; section: string; guest: string; walks: boolean };

export type MarchPlan =
  | { ok: true; next: MarchSection[]; steps: MarchStep[]; said: string; undo: MarchStep[] }
  | { ok: false; reason: string };

/* ── reading the model ─────────────────────────────────────────────────── */

/** A walk's lead — the id `setEntourageLineOrder` names it by (the server's own rule). */
export function leadOf(row: MarchRow): string {
  return (row[0] ?? row[1])?.id ?? '';
}

type Where = { s: number; r: number; c: 0 | 1; person: MarchPerson };

function locate(sections: readonly MarchSection[], id: string): Where | null {
  for (const [s, sec] of sections.entries()) {
    for (const [r, row] of sec.rows.entries()) {
      for (const c of [0, 1] as const) {
        const person = row[c];
        if (person && person.id === id) return { s, r, c, person };
      }
    }
  }
  return null;
}

function partnerOf(row: MarchRow, id: string): MarchPerson | null {
  const other = row[0]?.id === id ? row[1] : row[0];
  return other ?? null;
}

/** The step a row walks at, across the whole march (1-based). */
export function stepOf(sections: readonly MarchSection[], s: number, r: number): number {
  let n = 0;
  for (let i = 0; i < s; i++) n += sections[i]!.rows.length;
  return n + r + 1;
}

/** The rows as `lib/march-moves.ts` reads them. */
function asLines(rows: readonly MarchRow[]): EntourageRow[] {
  const p = (x: MarchPerson | null) =>
    x ? { id: x.id, name: x.name, role: x.role as GuestRole, walk: null, place: 0, ceremonyOnly: false } : null;
  return rows.map((r) => [p(r[0]), p(r[1])] as const);
}

/* ── the printer's layout, predicted ───────────────────────────────────── */

/** Someone walking alone, in the column the printer puts them in. */
function alone(section: string, p: MarchPerson): MarchRow {
  return columnOfRole(section, p.role) === 1 ? [null, p] : [p, null];
}

/** A row with `id` taken out: the one left walks alone, or the row is gone. */
function without(section: string, row: MarchRow, id: string): MarchRow | null {
  const left = partnerOf(row, id);
  return left ? alone(section, left) : null;
}

function withRows(sections: readonly MarchSection[], s: number, rows: MarchRow[]): MarchSection[] {
  return sections.map((sec, i) => (i === s ? { ...sec, rows } : sec));
}

/** `swap_entourage_places`: each takes the other's walk AND place — a cell swap. */
export function simulateSwap(section: MarchSection, a: string, b: string): MarchSection {
  const pa = section.rows.flat().find((p) => p?.id === a);
  const pb = section.rows.flat().find((p) => p?.id === b);
  if (!pa || !pb) return section;
  const cell = (p: MarchPerson | null) => (p?.id === a ? pb : p?.id === b ? pa : p);
  return { ...section, rows: section.rows.map((r) => [cell(r[0]), cell(r[1])] as const) };
}

/** `join_entourage_line`: the joiner takes the empty place beside the anchor; their old walk-mate walks alone. */
export function simulateJoin(section: MarchSection, anchor: string, joiner: string): MarchSection {
  const pj = section.rows.flat().find((p) => p?.id === joiner);
  if (!pj) return section;
  const rows: MarchRow[] = [];
  for (const row of section.rows) {
    if (row.some((p) => p?.id === joiner)) {
      const rest = without(section.key, row, joiner);
      if (rest) rows.push(rest);
    } else if (row.some((p) => p?.id === anchor)) {
      const a = (row[0] ?? row[1])!;
      // The empty place is whichever column the anchor is not in.
      rows.push(row[0] ? [a, pj] : [pj, a]);
    } else rows.push(row);
  }
  return { ...section, rows };
}

/** `unpair_guest`: they step out into a walk of their own, right behind; the walk-mate keeps the walk. */
export function simulateUnpair(section: MarchSection, id: string): MarchSection {
  const rows: MarchRow[] = [];
  for (const row of section.rows) {
    const me = row.find((p) => p?.id === id) ?? null;
    if (me && partnerOf(row, id)) {
      rows.push(without(section.key, row, id)!, alone(section.key, me));
    } else rows.push(row);
  }
  return { ...section, rows };
}

/* ── the plan for one drop ─────────────────────────────────────────────── */

const order = (section: string, rows: readonly MarchRow[]): MarchStep => ({
  kind: 'order',
  section,
  leads: rows.map(leadOf),
});

/**
 * 🔗 Before a section's order is written, every TIED walk in it is split: the
 * order write carries a whole walk to its new number, so a walk whose other
 * person stands in another section would move THEM too, somewhere nobody
 * dropped them. Splitting changes nothing on screen — a tied person is already
 * drawn walking alone here.
 */
function untie(sec: MarchSection, steps: MarchStep[]): MarchStep[] {
  if (!steps.some((s) => s.kind === 'order' && s.section === sec.key)) return steps;
  const tied = sec.rows.flat().filter((p): p is MarchPerson => Boolean(p?.tied));
  return [...tied.map((p): MarchStep => ({ kind: 'unpair', section: sec.key, guest: p.id })), ...steps];
}

/**
 * The steps that take one section from `from` back to `to` — Undo. Only the
 * shipped moves: split the walks `to` does not have, join the ones it does,
 * then set the order. A swap undoes itself and is handled by the caller.
 */
export function restoreSteps(key: string, from: readonly MarchRow[], to: readonly MarchRow[]): MarchStep[] {
  const pairKey = (r: MarchRow) => (r[0] && r[1] ? [r[0].id, r[1].id].sort().join('|') : null);
  const want = new Set(to.map(pairKey).filter(Boolean));
  const steps: MarchStep[] = [];
  let cur: MarchSection = { key, label: '', rows: from };
  for (const row of from) {
    const k = pairKey(row);
    if (k && !want.has(k)) {
      steps.push({ kind: 'unpair', section: key, guest: row[1]!.id });
      cur = simulateUnpair(cur, row[1]!.id);
    }
  }
  const have = new Set(cur.rows.map(pairKey).filter(Boolean));
  for (const row of to) {
    const k = pairKey(row);
    if (k && !have.has(k)) {
      steps.push({ kind: 'join', section: key, anchor: row[0]!.id, joiner: row[1]!.id });
      cur = simulateJoin(cur, row[0]!.id, row[1]!.id);
    }
  }
  const same = cur.rows.length === to.length && cur.rows.every((r, i) => leadOf(r) === leadOf(to[i]!));
  if (!same) steps.push(order(key, to));
  return steps;
}

/** A refusal said to the person dragging. */
const no = (reason: string): MarchPlan => ({ ok: false, reason });

/**
 * What dropping `source` on `target` does. `null` = nothing (a drop where it
 * already stands — no ring is shown there); `ok: false` = refused, in words.
 */
export function planDrop(
  sections: readonly MarchSection[],
  source: MarchSource,
  target: MarchTarget,
): MarchPlan | null {
  if (source.kind === 'section' || target.kind === 'section') return null; // `planSectionDrop`
  if (source.kind === 'out' || target.kind === 'tray') return null; // `planTray`
  if (source.kind === 'walk') {
    if (target.kind !== 'gap') return null;
    const s = sections.findIndex((x) => x.key === source.section);
    if (s === -1) return null;
    const sec = sections[s]!;
    if (target.section !== sec.key) return no(`This walk belongs to ${sec.label} — it moves within that section.`);
    const r = sec.rows.findIndex((row) => leadOf(row) === source.lead);
    if (r === -1 || target.index === r || target.index === r + 1) return null;
    const rows = [...sec.rows];
    const [moved] = rows.splice(r, 1);
    const at = target.index > r ? target.index - 1 : target.index;
    rows.splice(at, 0, moved!);
    const next = withRows(sections, s, rows);
    const who = moved!.filter((p) => p !== null).map((p) => p!.name).join(' and ');
    return {
      ok: true,
      next,
      steps: untie(sec, [order(sec.key, rows)]),
      said: `${who} now walk${moved![0] && moved![1] ? '' : 's'} at step ${stepOf(next, s, at)}`,
      undo: [order(sec.key, sec.rows)],
    };
  }

  const a = locate(sections, source.id);
  if (!a) return null;
  const sec = sections[a.s]!;
  const A = a.person.name;

  if (target.kind === 'name') {
    if (target.id === source.id) return null;
    const b = locate(sections, target.id);
    if (!b) return null;
    if (b.s !== a.s) return no(`${A} walks in ${sec.label} — only names in the same section trade places.`);
    const verdict = swapVerdict(asLines(sec.rows), sec.key, source.id, target.id);
    if (!verdict.ok) return no(verdict.reason);
    const step: MarchStep = { kind: 'swap', section: sec.key, a: source.id, b: target.id };
    return {
      ok: true,
      next: withRows(sections, a.s, [...simulateSwap(sec, source.id, target.id).rows]),
      steps: [step],
      said: `${A} and ${b.person.name} traded places`,
      undo: [step],
    };
  }

  if (target.kind === 'beside') {
    if (target.anchor === source.id) return null;
    const b = locate(sections, target.anchor);
    if (!b) return null;
    if (b.s !== a.s) return no(`Only someone from ${sections[b.s]!.label} can walk beside ${b.person.name}.`);
    const verdict = joinVerdict(asLines(sec.rows), sec.key, target.anchor, source.id);
    if (!verdict.ok) return no(verdict.reason);
    const left = partnerOf(sec.rows[a.r]!, source.id);
    const rows = [...simulateJoin(sec, target.anchor, source.id).rows];
    return {
      ok: true,
      next: withRows(sections, a.s, rows),
      steps: [{ kind: 'join', section: sec.key, anchor: target.anchor, joiner: source.id }],
      said: `${A} walks with ${b.person.name}${left ? ` · ${left.name} walks alone` : ''}`,
      undo: restoreSteps(sec.key, rows, sec.rows),
    };
  }

  // A gap between walks.
  if (target.section !== sec.key) return no(`${A} walks in ${sec.label} — their role on the guest list decides the section.`);
  const row = sec.rows[a.r]!;
  const mate = partnerOf(row, source.id);
  const i = target.index;
  if (!mate) {
    if (i === a.r || i === a.r + 1) return null;
    const rows = [...sec.rows];
    const [moved] = rows.splice(a.r, 1);
    const at = i > a.r ? i - 1 : i;
    rows.splice(at, 0, moved!);
    const next = withRows(sections, a.s, rows);
    return {
      ok: true,
      next,
      steps: untie(sec, [order(sec.key, rows)]),
      said: `${A} now walks at step ${stepOf(next, a.s, at)}`,
      undo: [order(sec.key, sec.rows)],
    };
  }
  // Out of a pair: the pair splits into two walks; this one stands at the gap.
  const rows = [...sec.rows];
  rows.splice(a.r, 1, without(sec.key, row, source.id)!);
  rows.splice(i, 0, alone(sec.key, a.person));
  const next = withRows(sections, a.s, rows);
  const behind = i === a.r + 1;
  const steps: MarchStep[] = [{ kind: 'unpair', section: sec.key, guest: source.id }];
  if (!behind) steps.push(order(sec.key, rows));
  return {
    ok: true,
    next,
    steps: untie(sec, steps),
    said: behind
      ? `${A} walks alone, right behind ${mate.name}`
      : i === a.r
        ? `${A} walks alone, right before ${mate.name}`
        : `${A} walks alone at step ${stepOf(next, a.s, i)} · ${mate.name} walks alone too`,
    undo: restoreSteps(sec.key, rows, sec.rows),
  };
}

/** Parse a drop zone's `data-march-drop` value. */
export function readTarget(v: string | undefined | null): MarchTarget | null {
  if (!v) return null;
  const [kind, x, y] = v.split('|');
  if (kind === 'name' && x) return { kind: 'name', id: x };
  if (kind === 'beside' && x) return { kind: 'beside', anchor: x };
  if (kind === 'gap' && x && y !== undefined && /^\d+$/.test(y)) return { kind: 'gap', section: x, index: Number(y) };
  if (kind === 'section' && x) return { kind: 'section', key: x };
  if (kind === 'tray') return { kind: 'tray' };
  return null;
}

/** Parse a draggable's `data-march-drag` value. */
export function readSource(v: string | undefined | null): MarchSource | null {
  if (!v) return null;
  const [kind, x, y] = v.split('|');
  if (kind === 'name' && x) return { kind: 'name', id: x };
  if (kind === 'walk' && x && y) return { kind: 'walk', section: x, lead: y };
  if (kind === 'section' && x) return { kind: 'section', key: x };
  if (kind === 'out' && x) return { kind: 'out', id: x };
  return null;
}

/**
 * ⌨ The keyboard's drop for ↑ / ↓ on a held name or walk — the gap one walk
 * earlier or later. A name in a pair steps out of it first (the gap right
 * before / right behind its pair: it walks alone). Null at either end.
 */
export function keyTarget(sections: readonly MarchSection[], source: MarchSource, dir: -1 | 1): MarchTarget | null {
  if (source.kind === 'out') return null;
  if (source.kind === 'section') {
    const keys = movable(sections);
    const to = keys[keys.indexOf(source.key) + dir];
    return to ? { kind: 'section', key: to } : null;
  }
  let s = -1;
  let r = -1;
  let paired = false;
  if (source.kind === 'walk') {
    s = sections.findIndex((x) => x.key === source.section);
    r = s === -1 ? -1 : sections[s]!.rows.findIndex((row) => leadOf(row) === source.lead);
  } else {
    const at = locate(sections, source.id);
    if (at) {
      s = at.s;
      r = at.r;
      paired = partnerOf(sections[s]!.rows[r]!, source.id) !== null;
    }
  }
  if (s === -1 || r === -1) return null;
  const n = sections[s]!.rows.length;
  const index = paired ? (dir < 0 ? r : r + 1) : dir < 0 ? r - 1 : r + 2;
  if (index < 0 || index > n) return null;
  return { kind: 'gap', section: sections[s]!.key, index };
}

/* ── SECTIONS — drag a header (owner/controller 2026-10-06) ─────────────────
 * The section order is ONE per-event value (`events.entourage_section_order`)
 * over the PRINTED groups; the march draws them between the groom's side
 * (always first) and the bride's side (always last). Its only writer moves one
 * section one place among the printed groups that have someone in them
 * (`moveEntourageSection` → `nextSectionOrder`) — so a drag is planned as the
 * run of those single steps, simulated with that SAME rule.
 *
 * `printed` is the printed groups with someone in them, in the saved order —
 * exactly the list the action reads (`readAllGroups`' visible keys).
 */

export type SectionPlan =
  | { ok: true; sections: MarchSection[]; printed: string[]; steps: MarchStep[]; said: string; undo: MarchStep[] }
  | { ok: false; reason: string };

/**
 * The single-section steps that make `printed`, read through `want`'s keys,
 * come out in `want`'s order. Insertion order: each key in turn rises until it
 * stands where `want` puts it — passing a printed group the march does not draw
 * (Parents) only when it must.
 */
export function sectionSteps(printed: readonly string[], want: readonly string[]): { steps: MarchStep[]; printed: string[] } {
  const keep = new Set(want);
  let cur = [...printed];
  const steps: MarchStep[] = [];
  const seen = (order: readonly string[]) => order.filter((k) => keep.has(k));
  for (const [i, key] of want.entries()) {
    for (let guard = 0; guard < cur.length * cur.length; guard++) {
      const at = seen(cur).indexOf(key);
      if (at === -1 || at <= i) break;
      const next = nextSectionOrder(cur, new Set(cur), key, 'up');
      if (!next) break;
      cur = next;
      steps.push({ kind: 'section', section: key, direction: 'up' });
    }
  }
  return { steps, printed: cur };
}

const movable = (sections: readonly MarchSection[]) => sections.filter((x) => !isMarchOnlyGroup(x.key)).map((x) => x.key);
const inOrder = (sections: readonly MarchSection[], keys: readonly string[]): MarchSection[] => {
  const byKey = new Map(sections.map((x) => [x.key, x]));
  const middle = keys.map((k) => byKey.get(k)!).filter(Boolean);
  const first = sections.filter((x) => isMarchOnlyGroup(x.key) && sections.indexOf(x) === 0);
  const last = sections.filter((x) => isMarchOnlyGroup(x.key) && !first.includes(x));
  return [...first, ...middle, ...last];
};

/** Drop section `from` on section `to`'s header: it takes that place (before it going up, after it going down). */
export function planSectionDrop(
  sections: readonly MarchSection[],
  printed: readonly string[],
  from: string,
  to: string,
): SectionPlan | null {
  if (from === to) return null;
  const label = (k: string) => sections.find((x) => x.key === k)?.label ?? k;
  if (isMarchOnlyGroup(to)) {
    const first = sections[0]?.key === to;
    return { ok: false, reason: `${label(to)} always walk${first ? ' first' : ' last'} — move ${label(from)} between them.` };
  }
  const keys = movable(sections);
  const a = keys.indexOf(from);
  const b = keys.indexOf(to);
  if (a === -1 || b === -1) return null;
  const want = [...keys];
  want.splice(a, 1);
  want.splice(b, 0, from);
  const { steps, printed: next } = sectionSteps(printed, want);
  if (steps.length === 0) return null;
  return {
    ok: true,
    sections: inOrder(sections, want),
    printed: next,
    steps,
    said: `${label(from)} now walk${a > b ? ' before' : ' after'} ${label(to)}`,
    undo: sectionSteps(next, printed).steps,
  };
}

/** Is the saved order anything but the built-in one? (Shows the one-line "Default order".) */
export function sectionsMoved(printed: readonly string[]): boolean {
  const built = ENTOURAGE_GROUP_KEYS.filter((k) => printed.includes(k));
  return built.some((k, i) => k !== printed[i]);
}

/** "Default order" — the built-in section order back (`resetEntourageSections`), undone step by step. */
export function planSectionsDefault(sections: readonly MarchSection[], printed: readonly string[]): SectionPlan | null {
  if (!sectionsMoved(printed)) return null;
  const built = ENTOURAGE_GROUP_KEYS.filter((k) => printed.includes(k));
  return {
    ok: true,
    sections: inOrder(sections, built.filter((k) => movable(sections).includes(k))),
    printed: built,
    steps: [{ kind: 'sections-default' }],
    said: 'The sections are back in their usual order',
    undo: sectionSteps(built, printed).steps,
  };
}

/* ── THE "NOT WALKING" TRAY (owner 2026-10-06) ─────────────────────────────
 * *"Just show screen for those not added or will not walk the isle."*
 *   drag a name onto the tray          → they do not walk; a walk-mate walks alone   setMarchWalking(false)
 *   drag a tray name into its section  → they walk again, where it was dropped        setMarchWalking(true)
 *       (a gap or a name: that place — beside a lone walker: with them)               + setEntourageLineOrder / joinEntourageLine
 *   … anywhere else in the march       → at the end of their own section (their role decides it)
 * The couple always walk: the groom and the bride never go to the tray.
 */

/** `steps`, ending with the section's order written as `rows` (unless they already do). */
function withOrder(key: string, steps: MarchStep[], rows: readonly MarchRow[]): MarchStep[] {
  return steps.some((x) => x.kind === 'order' && x.section === key) ? steps : [...steps, order(key, rows)];
}

/** Out of the march: the march without them, the steps, the Undo. */
function planOut(sections: readonly MarchSection[], out: readonly MarchOut[], id: string): MarchMove | null {
  const a = locate(sections, id);
  if (!a) return null;
  const sec = sections[a.s]!;
  const p = a.person;
  if (p.role === 'groom' || p.role === 'bride') return { ok: false, reason: `${p.name} walks in every march — the ${p.role} always walks.` };
  const row = sec.rows[a.r]!;
  const mate = partnerOf(row, id);
  const rows = [...sec.rows];
  const rest = without(sec.key, row, id);
  if (rest) rows.splice(a.r, 1, rest);
  else rows.splice(a.r, 1);
  const next = rows.length ? withRows(sections, a.s, rows) : sections.filter((_, i) => i !== a.s);
  const back: MarchStep = { kind: 'walking', section: sec.key, guest: id, walks: true };
  return {
    ok: true,
    sections: next,
    printed: [],
    // First in the tray: the name just dropped is the one most likely dragged back.
    out: [{ ...p, section: sec.key, sectionLabel: sec.label }, ...out],
    steps: [{ kind: 'walking', section: sec.key, guest: id, walks: false }],
    said: `${p.name} is not walking${mate ? ` · ${mate.name} now walks alone` : ''}`,
    // Back in, then the section exactly as it was. They come back UNPLACED — where the server sorts
    // them among other unplaced lines nobody can predict — so the order is always written.
    undo: [back, ...withOrder(sec.key, restoreSteps(sec.key, [...rows, alone(sec.key, p)], sec.rows), sec.rows)],
  };
}

/** Back into the march from the tray. */
function planIn(sections: readonly MarchSection[], out: readonly MarchOut[], id: string, target: MarchTarget): MarchMove | null {
  const o = out.find((x) => x.id === id);
  if (!o || target.kind === 'tray') return null;
  const person: MarchPerson = { id: o.id, name: o.name, role: o.role, tag: o.tag ?? null, side: o.side ?? null };
  let s = sections.findIndex((x) => x.key === o.section);
  let base = sections;
  if (s === -1) {
    // Their section has nobody walking yet: it comes back with them, before the bride's side (the server draws its true place).
    const last = sections.length > 0 && isMarchOnlyGroup(sections[sections.length - 1]!.key) && sections.length > 1 ? sections.length - 1 : sections.length;
    base = [...sections.slice(0, last), { key: o.section, label: o.sectionLabel, rows: [] }, ...sections.slice(last)];
    s = last;
  }
  const sec = base[s]!;
  const restOut = out.filter((x) => x.id !== id);
  const steps: MarchStep[] = [{ kind: 'walking', section: sec.key, guest: id, walks: true }];
  const undo: MarchStep[] = [{ kind: 'walking', section: sec.key, guest: id, walks: false }];
  const at = (rows: MarchRow[], said: string, more: MarchStep[]): MarchMove => ({
    ok: true,
    sections: withRows(base, s, rows),
    printed: [],
    out: restOut,
    steps: [...steps, ...untie(sec, more)],
    said,
    undo,
  });
  const inOwn =
    (target.kind === 'gap' && target.section === sec.key) ||
    (target.kind === 'name' && sec.rows.some((r) => r.some((p) => p?.id === target.id))) ||
    (target.kind === 'beside' && sec.rows.some((r) => r.some((p) => p?.id === target.anchor)));
  if (inOwn && target.kind === 'beside') {
    // Walks WITH the lone walker — the server's join, asked of the same rule on the march with them back in.
    const withMe: MarchSection = { ...sec, rows: [...sec.rows, alone(sec.key, person)] };
    const verdict = joinVerdict(asLines(withMe.rows), sec.key, target.anchor, id);
    if (!verdict.ok) return { ok: false, reason: verdict.reason };
    const anchor = locate([sec], target.anchor)!.person;
    return at([...simulateJoin(withMe, target.anchor, id).rows], `${o.name} walks with ${anchor.name}`, [
      { kind: 'join', section: sec.key, anchor: target.anchor, joiner: id },
    ]);
  }
  const index = !inOwn
    ? sec.rows.length
    : target.kind === 'gap'
      ? target.index
      : sec.rows.findIndex((r) => r.some((p) => p?.id === (target as { id: string }).id));
  const rows = [...sec.rows];
  rows.splice(index, 0, alone(sec.key, person));
  const next = withRows(base, s, rows);
  return at(
    rows,
    inOwn ? `${o.name} added · walks alone at step ${stepOf(next, s, index)}` : `${o.name} added to ${sec.label} · walks alone at its end`,
    [order(sec.key, rows)],
  );
}

/** Any drop, as one shape: what the march looks like after it, the steps, the words, the Undo. */
export type MarchMove =
  | { ok: true; sections: MarchSection[]; printed: string[]; out?: MarchOut[]; steps: MarchStep[]; said: string; undo: MarchStep[] }
  | { ok: false; reason: string };

export function planMove(
  sections: readonly MarchSection[],
  printed: readonly string[],
  source: MarchSource,
  target: MarchTarget,
  /** 🚶 The "Not walking" tray as drawn now. */
  out: readonly MarchOut[] = [],
): MarchMove | null {
  if (source.kind === 'section') return target.kind === 'section' ? planSectionDrop(sections, printed, source.key, target.key) : null;
  if (source.kind === 'out') {
    const p = planIn(sections, out, source.id, target);
    return p && p.ok ? { ...p, printed: [...printed] } : p;
  }
  if (target.kind === 'tray') {
    if (source.kind !== 'name') return null;
    const p = planOut(sections, out, source.id);
    return p && p.ok ? { ...p, printed: [...printed] } : p;
  }
  const p = planDrop(sections, source, target);
  if (!p) return null;
  if (!p.ok) return p;
  return { ok: true, sections: p.next, printed: [...printed], steps: p.steps, said: p.said, undo: p.undo };
}

/* ── WHICH SIDE OF THE AISLE (owner 2026-10-06) ───────────────────────────
 * *"Walk side ninong left ninang right"* · *"Brides crew should be on right and
 * grooms crew on the left."* DERIVED, never stored: sponsors by role (Ninong
 * LEFT, Ninang RIGHT); the crew by side — the groom's crew (best man, best
 * woman, groomsmen) LEFT, the bride's crew (maid / matron of honor,
 * bridesmaids) RIGHT; anyone else by their guest side (the bride's → RIGHT,
 * the groom's → LEFT); everyone else LEFT. When both people of a walk land on
 * one side, the first keeps theirs and the partner takes the other.
 *
 * 🔑 THE MARCH'S PICTURE ONLY. Who walks with whom, and in what order, is the
 * printer's (`pairUp`) — and every plan above reasons on that; this lays each
 * walk's two names across the aisle when the maker DRAWS it. The printed card
 * keeps its own columns.
 */
const LEFT_ROLES = new Set(['principal_sponsor_ninong', 'principal_sponsor', 'best_man', 'best_woman', 'groomsman']);
const RIGHT_ROLES = new Set(['principal_sponsor_ninang', 'maid_of_honor', 'matron_of_honor', 'bridesmaid']);

export function walkSideOf(p: Pick<MarchPerson, 'role' | 'side'>): 0 | 1 {
  if (LEFT_ROLES.has(p.role)) return 0;
  if (RIGHT_ROLES.has(p.role)) return 1;
  return p.side === 'bride' ? 1 : 0;
}

/** One walk laid across the aisle by `walkSideOf`. */
export function acrossTheAisle(row: MarchRow): MarchRow {
  const [x, y] = row[0] && row[1] ? [row[0], row[1]] : [row[0] ?? row[1], null];
  if (!x) return row;
  const cx = walkSideOf(x);
  if (!y) return cx === 0 ? [x, null] : [null, x];
  // Different sides: each on their own. The same side: the first keeps it, the partner takes the other.
  return cx === 0 ? [x, y] : [y, x];
}
