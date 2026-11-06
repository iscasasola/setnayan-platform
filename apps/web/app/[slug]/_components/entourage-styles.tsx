import { Fragment } from 'react';
import Link from 'next/link';

import type { EntourageGroup, EntouragePerson } from '@/lib/entourage';
import { marchLineWords } from '@/lib/entourage';
import { MineName, YourPlaceLine, anchorOnce, entourageMeOf } from './entourage-you';

/**
 * THE ENTOURAGE'S MARCH STYLE — C · The march (prototype
 * `every_scene_three_styles_2026-09-29.html` §8). On the axis and Lines are
 * `EntourageSection` itself (owner 2026-10-15).
 *
 * 🚫 B · Two sides lived here until 2026-10-15 — withdrawn by the owner: *"two
 * sides feels messy. the counter column must have significance to the first
 * column."* It sorted everyone onto a family side by role, so a Ninong stood
 * beside an unrelated name. A saved `two-sides` pick now resolves to the
 * default (`lib/scene-styles-stages.ts`).
 *
 * Presentational and pure: the groups arrive built and ordered by
 * `lib/entourage.ts`; nothing here decides who is in them.
 *
 * ── THE MARCH ──────────────────────────────────────────────────────────────
 * Owner 2026-09-29: "the wedding march on the invitation tells each entourage
 * member their role and how they are presented". Numbered lines, in walking
 * order, each role under its names; a signed-in member's own line is lifted
 * and says where they walk. ⏭ The walking order is the GROUPS' printed order
 * until the saved march order (Details › the march, part 2a) lands on main —
 * then `groups` arrives in that order and nothing here changes.
 */

/** One walking line: its names and the roles under them. */
export type MarchLine = {
  key: string;
  names: string;
  roles: string;
  ids: string[];
  /** The line's people, in name order — so the viewer's own name can be marked and their partner's not. */
  people: ReadonlyArray<{ id: string | null; name: string }>;
};

/** The cast as numbered walking lines, in the order the groups arrive. */
export function marchLines(groups: readonly EntourageGroup[]): MarchLine[] {
  const out: MarchLine[] = [];
  for (const g of groups) {
    g.rows.forEach((row, i) => {
      const people = row.filter((p): p is EntouragePerson => p !== null);
      if (people.length === 0) return;
      out.push({
        key: `${g.key}-${i}`,
        names: people.map((p) => p.name).join(' & '),
        /* 👪 Each parent named per person, in name order (owner 2026-10-17) — `marchLineWords`. */
        roles: marchLineWords(people, g),
        ids: people.map((p) => p.id).filter((x): x is string => Boolean(x)),
        people: people.map((p) => ({ id: p.id, name: p.name })),
      });
    });
  }
  return out;
}

/**
 * C · The march — numbered, in walking order, each role under its names; your line lifted.
 *
 * 🫵 Owner 2026-10-17 (`entourage-you.tsx`): the gold rule still lifts the viewer's LINE (each line they walk in — two
 * roles, two lines), and their own NAME carries the one mark every look draws, "You" after it — never the partner's.
 * Where they walk is said under the heading by the shipped `marchPlaceLine` ("You walk 4th, with …") — the same
 * sentence Me reads, so the page and Me cannot disagree.
 */
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
  const me = entourageMeOf(myGuestId, shown.flatMap((l) => l.people), id);
  const anchor = anchorOnce(me);
  return (
    <section id={id} className="scroll-mt-6 space-y-5" data-scene-style="march">
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span>The entourage</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">The march</h3>
        <p className="text-sm text-ink/65">In the order you walk.</p>
        <YourPlaceLine me={me} groups={groups} />
      </header>
      <ol className="divide-y divide-ink/10 border-y border-ink/10">
        {shown.map((l, i) => {
          const isMine = me !== null && l.ids.includes(me.id);
          return (
            <li
              key={l.key}
              data-march-line={isMine ? 'mine' : 'other'}
              className={`flex items-baseline gap-4 py-3 ${isMine ? 'border-l-2 border-l-gild pl-3' : ''}`}
            >
              <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-gild">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-pahina text-lg leading-snug text-ink">
                  {isMine
                    ? l.people.map((p, j) => (
                        <Fragment key={j}>
                          {j > 0 ? ' & ' : ''}
                          {me && p.id === me.id ? <MineName anchor={anchor()}>{p.name}</MineName> : p.name}
                        </Fragment>
                      ))
                    : l.names}
                </p>
                <p className="text-sm text-ink/65">{l.roles}</p>
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
