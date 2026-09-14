import type { EntourageGroup } from '@/lib/entourage';
import { roleLabel } from '@/lib/entourage';

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
export function EntourageSection({ groups, id }: { groups: readonly EntourageGroup[]; id?: string }) {
  // Nothing assigned, or a read that did not happen — either way there is no
  // heading over an empty list. See `loadEntourage` on why a failed read draws
  // nothing rather than an apology on somebody's wedding invitation.
  if (groups.length === 0) return null;

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

      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {groups.map((group) => {
          /* Does this group hold more than one role? Computed per group, from
             the people actually in it — never assumed from the group's key, so
             a group whose couple only filled in one of its roles reads as
             cleanly as a single-role one. */
          const distinctRoles = new Set(group.people.map((p) => p.role));
          const showRole = distinctRoles.size > 1;
          return (
            <div key={group.key} className="space-y-3">
              <h4 className="pahina-eyebrow">
                <span>{group.label}</span>
              </h4>
              <ul className="space-y-2">
                {group.people.map((person, i) => (
                  <li key={`${person.role}-${person.name}-${i}`} className="leading-snug">
                    <span className="text-base text-ink">{person.name}</span>
                    {showRole ? (
                      <span className="ml-2 text-sm text-ink/55">{roleLabel(person.role)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
