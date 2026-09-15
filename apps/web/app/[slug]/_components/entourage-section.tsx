import Link from 'next/link';
import type { EntourageGroup, EntouragePerson } from '@/lib/entourage';
import { roleLabel, peopleOf } from '@/lib/entourage';

/**
 * THE ENTOURAGE — the people standing up with the couple, on the invitation.
 *
 * Presentational and pure: the groups arrive already built and already ordered
 * by `lib/entourage.ts`, and this file decides nothing about who is in them.
 *
 * ── WHERE IT LIVES, AND WHY IT IS NOT A TAB ────────────────────────────────
 * Owner ruling 2026-09-14. The bottom bar is a budgeted FIVE slots and the
 * pre-day shape is already full (Home · Details · Story · Camera · Me) —
 * `_lib/site-nav.ts` and `guest-doorway-strip.tsx` both call a sixth tab "a
 * redesign of an owner-locked shape". Asked to choose, the owner kept the five
 * and put the entourage UNDER Details, with its own anchor. So: a section, an
 * `id`, and no change to the bar.
 *
 * ── THE ROLE BESIDE THE NAME, EXCEPT WHERE THE HEADING ALREADY SAYS IT ─────
 * The owner asked for "names with roles". A group that holds ONE role prints
 * the role once, as its heading — eight rows each reading "Bridesmaid" under a
 * heading reading "Bridesmaids" is noise, not information. A group that holds
 * SEVERAL (the secondary sponsors, the bearers, the honour attendants, the two
 * sets of parents) prints the role beside every name, because there the heading
 * cannot say which is which.
 */
export function EntourageSection({
  groups,
  id,
  previewHref,
  previewGroups = 2,
}: {
  groups: readonly EntourageGroup[];
  id?: string;
  /**
   * When set, this is the PREVIEW: the first `previewGroups` groups, then a
   * door to the full list. Omit it and the whole cast renders — which is what
   * `/[slug]/everyone` passes, so one component draws both and they cannot
   * drift into two different-looking entourages.
   */
  previewHref?: string;
  previewGroups?: number;
}) {
  // Nothing assigned, or a read that did not happen — either way there is no
  // heading over an empty list. See `loadEntourage` on why a failed read draws
  // nothing rather than an apology on somebody's wedding invitation.
  if (groups.length === 0) return null;

  /*
    ⚖ OWNER 2026-09-15: *"Both — a preview that opens the full list."* The
    invitation shows the first groups and a door; the full page shows
    everything.

    🔑 THE DOOR COUNTS WHAT IT HIDES, and counts PEOPLE rather than groups — "and
    52 more" is a promise a reader can check when they arrive, where "see more"
    is not. If nothing is hidden, there is no door: a link that opens the same
    list the reader is already looking at is a dead end with good manners.
  */
  const shown = previewHref ? groups.slice(0, previewGroups) : groups;
  const hidden = previewHref
    ? groups.slice(previewGroups).reduce((n, g) => n + peopleOf(g).length, 0)
    : 0;

  return (
    <section id={id} className="scroll-mt-6 space-y-6">
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span aria-hidden>№ 08</span>
          <span>The entourage</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          Standing with us
        </h3>
      </header>

      <div className="space-y-8">
        {shown.map((group) => {
          /* Does this group hold more than one role? Computed per group, from
             the people actually in it — never assumed from the group's key, so
             a group whose couple only filled in one of its roles reads as
             cleanly as a single-role one. */
          const distinctRoles = new Set(peopleOf(group).map((p) => p.role));
          const showRole = distinctRoles.size > 1;
          /* Does ANY line in this group hold two people? A group nobody paired
             prints as one column — two columns of names with every right-hand
             cell empty is a table pretending to be a pairing. */
          const paired = group.rows.some(([l, r]) => l !== null && r !== null);
          return (
            <div key={group.key} className="space-y-3">
              <h4 className="pahina-eyebrow">
                <span>{group.label}</span>
              </h4>
              <ul className="space-y-2">
                {group.rows.map((row, i) => (
                  <li
                    key={`${group.key}-${i}`}
                    className={
                      paired
                        ? 'grid grid-cols-1 items-baseline gap-x-8 gap-y-1 leading-snug sm:grid-cols-2'
                        : 'leading-snug'
                    }
                  >
                    {paired ? (
                      <>
                        <Cell person={row[0]} showRole={showRole} />
                        <Cell person={row[1]} showRole={showRole} />
                      </>
                    ) : (
                      <Cell person={row[0] ?? row[1]} showRole={showRole} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {previewHref && hidden > 0 ? (
        <p className="mt-2">
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

/**
 * One cell of a printed line.
 *
 * 🔑 A NULL RENDERS AN EMPTY CELL, NOT NOTHING. Owner 2026-09-14: *"if the
 * other side is left blank, then keep that line blank."* Returning `null` here
 * would collapse the grid column and slide the next name up into the gap, which
 * is precisely the re-flow the two-column layout exists to prevent.
 */
function Cell({ person, showRole }: { person: EntouragePerson | null; showRole: boolean }) {
  if (!person) return <span aria-hidden className="hidden sm:block" />;
  return (
    <span>
      <span className="text-base text-ink">{person.name}</span>
      {showRole ? <span className="ml-2 text-sm text-ink/55">{roleLabel(person.role)}</span> : null}
    </span>
  );
}
