import Link from 'next/link';

import type { EntourageGroup, EntouragePerson } from '@/lib/entourage';
import { peopleOf, roleLabel } from '@/lib/entourage';

/**
 * THE ENTOURAGE'S OTHER TWO STYLES — B · Two sides and C · The march
 * (prototype `every_scene_three_styles_2026-09-29.html` §8). A · Roll call is
 * `EntourageSection` itself.
 *
 * Presentational and pure, like A: the groups arrive built and ordered by
 * `lib/entourage.ts`; nothing here decides who is in them.
 *
 * ── TWO SIDES ──────────────────────────────────────────────────────────────
 * The side is read from the ROLE the couple gave — a maid of honour, a
 * bridesmaid, a ninang, the bride's parents and family on one side; the best
 * man, a groomsman, a ninong, the groom's parents and family on the other.
 * A role that does not say (a principal sponsor not yet marked ninong or
 * ninang, the candle and veil pairs, the bearers) prints once, under the
 * rule, as the pairs the couple made. No side is guessed. The two columns
 * carry no heading — the roles above each name already say whose side it is,
 * and a heading would need a word we would have to type.
 *
 * ── THE MARCH ──────────────────────────────────────────────────────────────
 * Owner 2026-09-29: "the wedding march on the invitation tells each entourage
 * member their role and how they are presented". Numbered lines, in walking
 * order, each role under its names; a signed-in member's own line is lifted
 * and says where they walk. ⏭ The walking order is the GROUPS' printed order
 * until the saved march order (Details › the march, part 2a) lands on main —
 * then `groups` arrives in that order and nothing here changes.
 */

type SideKey = 0 | 1;

const SIDE_OF_ROLE: Readonly<Record<string, SideKey>> = {
  bride_parents: 0,
  bride_immediate_family: 0,
  maid_of_honor: 0,
  matron_of_honor: 0,
  bridesmaid: 0,
  principal_sponsor_ninang: 0,
  groom_parents: 1,
  groom_immediate_family: 1,
  best_man: 1,
  groomsman: 1,
  principal_sponsor_ninong: 1,
};

/** Which side a role stands on, or null when the role does not say. */
export function sideOfRole(role: string): SideKey | null {
  return SIDE_OF_ROLE[role] ?? null;
}

/** Does this cast have someone on EACH side? "Two sides" is offered only then. */
export function entourageHasTwoSides(groups: readonly EntourageGroup[]): boolean {
  const sides = new Set(groups.flatMap((g) => peopleOf(g).map((p) => sideOfRole(p.role))));
  return sides.has(0) && sides.has(1);
}

type Cluster = { label: string; names: string[] };

function clustersFor(groups: readonly EntourageGroup[], side: SideKey): Cluster[] {
  const out: Cluster[] = [];
  for (const g of groups) {
    for (const p of peopleOf(g)) {
      if (sideOfRole(p.role) !== side) continue;
      const label = roleLabel(p.role, g.names) ?? g.label;
      const last = out[out.length - 1];
      if (last && last.label === label) last.names.push(p.name);
      else out.push({ label, names: [p.name] });
    }
  }
  return out;
}

const pairName = ([l, r]: readonly [EntouragePerson | null, EntouragePerson | null]) =>
  [l?.name, r?.name].filter(Boolean).join(' & ');

/** B · Two sides — the two sides as two columns; the pairs whose role names no side under a rule. */
export function EntourageTwoSides({ groups, id }: { groups: readonly EntourageGroup[]; id?: string }) {
  if (groups.length === 0) return null;
  const left = clustersFor(groups, 0);
  const right = clustersFor(groups, 1);
  // What no role places on a side, kept as the couple paired it, per group.
  const together = groups
    .map((g) => ({
      key: g.key,
      label: g.label,
      rows: g.rows
        .map(([l, r]) => [l && sideOfRole(l.role) === null ? l : null, r && sideOfRole(r.role) === null ? r : null] as const)
        .filter(([l, r]) => l !== null || r !== null),
    }))
    .filter((g) => g.rows.length > 0);
  return (
    <section id={id} className="scroll-mt-6 space-y-6" data-scene-style="two-sides">
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span>The entourage</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">Standing with us</h3>
      </header>
      <div className="grid grid-cols-2 gap-x-5">
        {[left, right].map((col, ci) => (
          <div key={ci} className="min-w-0 space-y-4" data-entourage-side={ci}>
            {col.map((c, i) => (
              <div key={`${c.label}-${i}`} className="space-y-1">
                <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">{c.label}</p>
                <ul className="space-y-0.5">
                  {c.names.map((n, ni) => (
                    <li key={ni} className="break-words font-pahina text-lg leading-snug text-ink">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
      {together.length > 0 ? (
        <div className="space-y-4 border-t border-ink/12 pt-5 text-center">
          <p aria-hidden className="text-gild">✦</p>
          {together.map((g) => (
            <div key={g.key} className="space-y-1">
              <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">{g.label}</p>
              <p className="text-base leading-relaxed text-ink">
                {g.rows.map((row) => pairName(row)).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** One walking line: its names and the roles under them. */
export type MarchLine = { key: string; names: string; roles: string; ids: string[] };

/** The cast as numbered walking lines, in the order the groups arrive. */
export function marchLines(groups: readonly EntourageGroup[]): MarchLine[] {
  const out: MarchLine[] = [];
  for (const g of groups) {
    g.rows.forEach((row, i) => {
      const people = row.filter((p): p is EntouragePerson => p !== null);
      if (people.length === 0) return;
      const roles = [...new Set(people.map((p) => roleLabel(p.role, g.names) ?? g.label))];
      out.push({
        key: `${g.key}-${i}`,
        names: people.map((p) => p.name).join(' & '),
        roles: roles.join(' · '),
        ids: people.map((p) => p.id).filter((x): x is string => Boolean(x)),
      });
    });
  }
  return out;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** C · The march — numbered, in walking order, each role under its names; your line lifted. */
export function EntourageMarch({
  groups,
  id,
  myGuestId = null,
  previewHref,
  previewLines = 8,
}: {
  groups: readonly EntourageGroup[];
  id?: string;
  /** The signed-in guest's own id — their line is marked. A stranger sees no mark. */
  myGuestId?: string | null;
  /** When set, the first `previewLines` lines, then a door to the full list (as Roll call's preview). */
  previewHref?: string;
  previewLines?: number;
}) {
  const lines = marchLines(groups);
  if (lines.length === 0) return null;
  const shown = previewHref ? lines.slice(0, previewLines) : lines;
  const hidden = lines.length - shown.length;
  const mine = myGuestId ? lines.findIndex((l) => l.ids.includes(myGuestId)) : -1;
  return (
    <section id={id} className="scroll-mt-6 space-y-5" data-scene-style="march">
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span>The entourage</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">The march</h3>
        <p className="text-sm text-ink/65">
          In the order you walk.{mine >= 0 ? ' Your line is marked.' : ''}
        </p>
      </header>
      <ol className="divide-y divide-ink/10 border-y border-ink/10">
        {shown.map((l, i) => {
          const isMine = i === mine;
          return (
            <li
              key={l.key}
              data-march-line={isMine ? 'mine' : 'other'}
              className={`flex items-baseline gap-4 py-3 ${isMine ? 'border-l-2 border-l-gild bg-veil/60 pl-3' : ''}`}
            >
              <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-gild">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-pahina text-lg leading-snug text-ink">{l.names}</p>
                <p className="text-sm text-ink/65">
                  {l.roles}
                  {isMine ? ` · you walk ${ordinal(i + 1)}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {previewHref && hidden > 0 ? (
        <p>
          <Link
            href={previewHref}
            className="inline-flex items-center gap-1.5 text-sm text-ink/70 underline underline-offset-4 hover:text-ink"
          >
            See everyone — {hidden} more
            <span aria-hidden>&rarr;</span>
          </Link>
        </p>
      ) : null}
    </section>
  );
}
