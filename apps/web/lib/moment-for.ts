import { normalizeSearchText } from './guest-search';
import type { TaskRow } from './schedule-chapters';

/**
 * 👷 A HOST'S MOMENT FOR ONE SUPPLIER OR ONE OF THEIR CREW — the pure half (owner 2026-11-01: *"but for owners, they can
 * also create a moment that is for a specific supplier/coordinator/ or a supplier or coordinator's crew/their own moment,
 * etc"*; corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md "A host's moment for one supplier, coordinator or crew").
 *
 * 🔑 EXTEND, DO NOT REBUILD — NO CREW TABLE. Measured first (Rule 0): a crew on a moment is ALREADY a row of
 * `event_schedule_tasks` — `vendor_id` (their booking) + `crew` (the name) — the shape migration 20271300072429 chose
 * and the supplier's "Who on our side" writes on approval (#7161, `setCrewTasks`, `what` = the moment's name). The crew
 * list the host picks from is the names that supplier's crew already carries on this event's moments, and a new name is
 * typed in the same search. A supplier is "on" a moment through `responsible_vendor_ids` — the column the supplier's day
 * reads as "yours" (`buildSupplierDay`). So this dropdown writes only those two things, never a third source of truth.
 *
 * Keys: `s:<booking>` a supplier · `c:<booking>:<crew>` one of their crew · `n:<booking>:<name>` a crew name typed now.
 */

export type ForSupplier = { id: string; name: string };
export type ForCrew = { vendorId: string; crew: string };
export type ForPick = { kind: 'supplier'; vendorId: string } | { kind: 'crew'; vendorId: string; crew: string };
export type ForOption = { key: string; label: string; group: 'Suppliers' | 'Crew' };

/** A crew's name, as `event_schedule_tasks.crew` holds it (1–60 letters). */
export const CREW_NAME_MAX = 60;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function forKey(p: ForPick): string {
  return p.kind === 'supplier' ? `s:${p.vendorId}` : `c:${p.vendorId}:${p.crew.trim()}`;
}

/** A key → what it picks. A typed name (`n:`) is a crew like any other; a name too long or blank is no pick. */
export function forPickOf(key: string): ForPick | null {
  const [k, vendorId, ...rest] = key.split(':');
  if (!vendorId) return null;
  if (k === 's' && rest.length === 0) return { kind: 'supplier', vendorId };
  if (k === 'c' || k === 'n') {
    const crew = rest.join(':').trim();
    return crew && crew.length <= CREW_NAME_MAX ? { kind: 'crew', vendorId, crew } : null;
  }
  return null;
}

/** The crews on ONE moment — each supplier's crew names on its tasks, in the order written, once each. */
export function crewsOnMoment(momentTasks: readonly Pick<TaskRow, 'vendor_id' | 'crew'>[]): ForCrew[] {
  const out: ForCrew[] = [];
  for (const t of momentTasks) {
    if (!t.vendor_id || !t.crew?.trim()) continue;
    if (out.some((c) => c.vendorId === t.vendor_id && same(c.crew, t.crew!))) continue;
    out.push({ vendorId: t.vendor_id, crew: t.crew.trim() });
  }
  return out;
}

/** What is ticked: the suppliers on the moment (`responsible_vendor_ids`), and every crew with a line on it. */
export function forPicked(vendorIds: readonly string[], momentTasks: readonly Pick<TaskRow, 'vendor_id' | 'crew'>[]): string[] {
  return [
    ...[...new Set(vendorIds)].map((v) => forKey({ kind: 'supplier', vendorId: v })),
    ...crewsOnMoment(momentTasks).map((c) => forKey({ kind: 'crew', ...c })),
  ];
}

/**
 * The dropdown's options — two sections, Suppliers and Crew, narrowed by what is typed. A typed name that is not yet
 * one of a supplier's crew is offered as a new crew under each booked supplier ("＋ Jubert — Lumina Studio crew").
 */
export function forOptions(input: { suppliers: readonly ForSupplier[]; crews: readonly ForCrew[]; query: string }): ForOption[] {
  const q = normalizeSearchText(input.query);
  const hit = (s: string) => !q || normalizeSearchText(s).includes(q);
  const names = new Map(input.suppliers.map((s) => [s.id, s.name]));
  const crews = crewsOnMoment(input.crews.map((c) => ({ vendor_id: c.vendorId, crew: c.crew }))).filter((c) => names.has(c.vendorId));
  const typed = input.query.trim().slice(0, CREW_NAME_MAX);
  return [
    ...input.suppliers.filter((s) => hit(s.name)).map((s): ForOption => ({ key: forKey({ kind: 'supplier', vendorId: s.id }), label: s.name, group: 'Suppliers' })),
    ...crews
      .filter((c) => hit(`${c.crew} ${names.get(c.vendorId) ?? ''}`))
      .map((c): ForOption => ({ key: forKey({ kind: 'crew', ...c }), label: `${c.crew} · ${names.get(c.vendorId)}`, group: 'Crew' })),
    ...(typed
      ? input.suppliers
          .filter((s) => !crews.some((c) => c.vendorId === s.id && same(c.crew, typed)))
          .map((s): ForOption => ({ key: `n:${s.id}:${typed}`, label: `＋ ${typed} — ${s.name} crew`, group: 'Crew' }))
      : []),
  ];
}

/** "Lumina Studio · Jubert" — what the pill says; "Nobody in particular" when the moment is nobody's. */
export function forWords(vendorIds: readonly string[], momentTasks: readonly Pick<TaskRow, 'vendor_id' | 'crew'>[], suppliers: readonly ForSupplier[]): string {
  const name = new Map(suppliers.map((s) => [s.id, s.name]));
  const crews = crewsOnMoment(momentTasks);
  const parts = [...new Set([...vendorIds, ...crews.map((c) => c.vendorId)])].map((v) => {
    const theirs = crews.filter((c) => c.vendorId === v).map((c) => c.crew);
    const who = name.get(v) ?? 'A supplier';
    return theirs.length > 0 ? `${who} · ${theirs.join(', ')}` : who;
  });
  if (parts.length === 0) return 'Nobody in particular';
  return parts.length <= 2 ? parts.join('; ') : `${parts.slice(0, 2).join('; ')} +${parts.length - 2}`;
}

/** The lines on a moment that ARE that crew (any spelling of the name) — what unticking them removes. */
export function crewLines<T extends Pick<TaskRow, 'task_id' | 'vendor_id' | 'crew'>>(momentTasks: readonly T[], vendorId: string, crew: string): T[] {
  return momentTasks.filter((t) => t.vendor_id === vendorId && typeof t.crew === 'string' && same(t.crew, crew));
}
