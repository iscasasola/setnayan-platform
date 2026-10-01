import Link from 'next/link';
import type { EntourageGroup, EntouragePerson, EntourageRoleLayout } from '@/lib/entourage';
import {
  roleLabel,
  peopleOf,
  roleBesideName,
  roleBlocks,
  lineNames,
  pairsShareALine,
  DEFAULT_ENTOURAGE_ROLE_LAYOUT,
} from '@/lib/entourage';
import { EntourageMarch, EntourageTwoSides, entourageHasTwoSides } from './entourage-styles';

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
 * The owner asked for "names with roles". A role prints beside a name only
 * where nothing else on the page says it — `roleBesideName` in
 * `lib/entourage.ts` decides, this file only draws. ⚖ Owner 2026-09-30, on the
 * Principal Sponsors: *"the sub text Ninong can be removed"* — the heading
 * names them, so the grey word under every name went (it stays as
 * visually-hidden text, so a screen reader still hears "…, Ninong"). Groups
 * whose heading cannot say which is which (Parents, Bearers) keep it.
 *
 * ── SECONDARY SPONSORS PRINT BY ROLE ─────────────────────────────────────
 * ⚖ Owner 2026-09-30: one small sub-heading per role ("Candle"), the pair or
 * pairs under it, and no role beside any name. `roleLayout` picks the owner's
 * two drawings — `stacked` (default) or `inline` ("Candle: names").
 */
export function EntourageSection({
  groups,
  id,
  previewHref,
  previewGroups = 2,
  roleLayout = DEFAULT_ENTOURAGE_ROLE_LAYOUT,
  sceneStyle = null,
  myGuestId = null,
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
  /** How a by-role group (Secondary Sponsors) is drawn. Nothing sets it yet — the Maker's Entourage preset will. */
  roleLayout?: EntourageRoleLayout;
  /**
   * 🎨 `roll-call` (this, the default) · `two-sides` · `march`
   * (`entourage-styles.tsx`). "Two sides" draws only when the roles put
   * someone on each side; otherwise this, the roll call, draws.
   */
  sceneStyle?: string | null;
  /** The signed-in guest's own id — the march marks their line. */
  myGuestId?: string | null;
}) {
  // Nothing assigned, or a read that did not happen — either way there is no
  // heading over an empty list. See `loadEntourage` on why a failed read draws
  // nothing rather than an apology on somebody's wedding invitation.
  if (groups.length === 0) return null;
  if (sceneStyle === 'two-sides' && entourageHasTwoSides(groups)) return <EntourageTwoSides groups={groups} id={id} />;
  if (sceneStyle === 'march') {
    return <EntourageMarch groups={groups} id={id} myGuestId={myGuestId} previewHref={previewHref} />;
  }

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
          <span>The entourage</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          Standing with us
        </h3>
      </header>

      <div className="space-y-8">
        {shown.map((group) => {
          const blocks = roleBlocks(group);
          if (blocks) return <ByRoleGroup key={group.key} group={group} blocks={blocks} layout={roleLayout} />;
          if (pairsShareALine(group)) return <OneLinePairs key={group.key} group={group} />;
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
                        <Cell person={row[0]} group={group} />
                        <Cell person={row[1]} group={group} />
                      </>
                    ) : (
                      <Cell person={row[0] ?? row[1]} group={group} />
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
function Cell({ person, group }: { person: EntouragePerson | null; group: EntourageGroup }) {
  if (!person) return <span aria-hidden className="hidden sm:block" />;
  const beside = roleBesideName(group, person);
  const spoken = beside ? null : roleLabel(person.role, group.names);
  return (
    <span>
      <span className="text-base text-ink">{person.name}</span>
      {beside ? <span className="ml-2 text-sm text-ink/55">{beside}</span> : null}
      {/* Not drawn, still read: the heading says it to the eye, this says it to a screen reader. */}
      {spoken ? <span className="sr-only">, {spoken}</span> : null}
    </span>
  );
}

/**
 * A group whose data-paired couples share ONE line — Principal Sponsors and
 * the crews. ⚖ Owner 2026-09-30, option 1: "Hon. Ricardo & Mrs. Jessica
 * Villahermosa" on every screen size (`lineNames` decides the words). An
 * unpaired sponsor is a line of their own; the order is the march order the
 * rows already carry.
 */
function OneLinePairs({ group }: { group: EntourageGroup }) {
  return (
    <div className="space-y-3">
      <h4 className="pahina-eyebrow">
        <span>{group.label}</span>
      </h4>
      <ul className="space-y-2">
        {group.rows.map((row, i) => {
          const people = row.filter((p): p is EntouragePerson => p !== null);
          const beside = people.map((p) => roleBesideName(group, p)).filter(Boolean);
          const spoken = people
            .filter((p) => !roleBesideName(group, p))
            .map((p) => roleLabel(p.role, group.names))
            .filter(Boolean);
          return (
            <li key={`${group.key}-${i}`} className="leading-snug" data-pair-line={people.length > 1 ? '' : undefined}>
              <span className="text-base text-ink">{lineNames(row)}</span>
              {beside.length ? <span className="ml-2 text-sm text-ink/55">{beside.join(' & ')}</span> : null}
              {spoken.length ? <span className="sr-only">, {spoken.join(' & ')}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A group drawn BY ROLE — the Secondary Sponsors. ⚖ Owner 2026-09-30.
 *
 *   stacked (B, default)      inline (A)
 *   Candle                    Candle: Ana & Ben Cruz
 *   Ana & Ben Cruz            Veil: Carla & Dan Reyes
 *   Veil
 *   Carla & Dan Reyes
 *
 * A pair is ONE line ("Ana Cruz & Ben Cruz"), never split across two cells —
 * on a 375 phone the two-column grid stacks anyway, and a pair that stacks
 * reads as two strangers.
 */
function ByRoleGroup({
  group,
  blocks,
  layout,
}: {
  group: EntourageGroup;
  blocks: NonNullable<ReturnType<typeof roleBlocks>>;
  layout: EntourageRoleLayout;
}) {
  return (
    <div className="space-y-3" data-role-layout={layout}>
      <h4 className="pahina-eyebrow">
        <span>{group.label}</span>
      </h4>
      {layout === 'inline' ? (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li key={b.key} className="leading-snug">
              <span className="text-sm text-ink/55">{b.label}:</span>{' '}
              <span className="text-base text-ink">{b.rows.map(lineNames).join(' · ')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          {blocks.map((b) => (
            <div key={b.key} className="space-y-1">
              <p className="text-sm text-ink/55">{b.label}</p>
              <ul className="space-y-1">
                {b.rows.map((row, i) => (
                  <li key={`${b.key}-${i}`} className="text-base leading-snug text-ink">
                    {lineNames(row)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
