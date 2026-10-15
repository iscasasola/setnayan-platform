import Link from 'next/link';
import type { EntourageGroup, EntouragePerson, EntourageRoleLayout, EntourageRow } from '@/lib/entourage';
import {
  entourageCellWord,
  roleLabel,
  peopleOf,
  roleBesideName,
  roleBlocks,
  lineNames,
  DEFAULT_ENTOURAGE_ROLE_LAYOUT,
} from '@/lib/entourage';
import { EntourageMarch } from './entourage-styles';

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
   * 🎨 `roll-call` — On the axis (this, the default) · `lines` — Lines (this) ·
   * `march` (`entourage-styles.tsx`). Owner 2026-10-15. 🚫 `two-sides` is
   * withdrawn: anything else draws On the axis.
   */
  sceneStyle?: string | null;
  /** The signed-in guest's own id — the march marks their line. */
  myGuestId?: string | null;
}) {
  // Nothing assigned, or a read that did not happen — either way there is no
  // heading over an empty list. See `loadEntourage` on why a failed read draws
  // nothing rather than an apology on somebody's wedding invitation.
  if (groups.length === 0) return null;
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
  const look: Look = sceneStyle === 'lines' ? 'lines' : 'axis';
  const shown = previewHref ? groups.slice(0, previewGroups) : groups;
  const hidden = previewHref
    ? groups.slice(previewGroups).reduce((n, g) => n + peopleOf(g).length, 0)
    : 0;

  return (
    <section id={id} className="scroll-mt-6 space-y-6" data-scene-style={look === 'lines' ? 'lines' : 'roll-call'}>
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span>The entourage</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          Standing with us
        </h3>
      </header>

      <div className={look === 'lines' ? 'divide-y divide-ink/12' : 'space-y-4'}>
        {shown.map((group) => {
          const blocks = roleBlocks(group);
          return (
            <div
              key={group.key}
              className={look === 'lines' ? 'space-y-3 py-4 first:pt-0' : 'space-y-3 pt-2'}
              {...(blocks ? { 'data-role-layout': roleLayout } : {})}
            >
              <GroupHeading label={group.label} look={look} />
              {blocks ? (
                <ByRoleRows group={group} blocks={blocks} layout={roleLayout} look={look} />
              ) : (
                <>
                  {group.sideWords && (look === 'axis' || group.rows.some(([l, r]) => l !== null && r !== null)) ? (
                    <ColumnWords words={group.sideWords} look={look} />
                  ) : null}
                  <ul className="space-y-3">
                    {group.rows.map((row, i) => (
                      <PairRow key={`${group.key}-${i}`} row={row} group={group} look={look} />
                    ))}
                  </ul>
                </>
              )}
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
 * 👫 THE TWO LOOKS (owner 2026-10-15, `prototypes/entourage_two_columns_2026-10-15_fable.html` styles 4 and 5;
 * DECISION_LOG "ENTOURAGE STYLES 4 AND 5 APPROVED"):
 *
 *   axis  — ON THE AXIS (`roll-call`, the default). Every group is the same two-column grid at 375. The LEFT cell
 *           is set RIGHT and the right cell left, so each pair meets at the centre of the page — where the printed
 *           invitation puts the "&" the owner removed (2026-10-14). A single keeps his side, the partner cell blank
 *           (owner 2026-09-14, "keep that line blank"). Group headings are centred between two hairlines.
 *   lines — LINES. Pairs flush-left in two columns, a hairline between groups; anyone who walks ALONE is centred
 *           across both columns with their role word — a centred name has no column to say it, so the word must.
 *
 * 🔑 THE RIGHT CELL IS ALWAYS THE LEFT CELL'S PARTNER (owner 2026-10-15: *"the counter column must have
 * significance to the first column"*). Both looks draw `group.rows` exactly as `buildEntourage` paired them — a row
 * is one walk, or one person alone in the column the group's own sides give him — and never move anybody into an
 * empty cell to fill it. Held by `lib/the-entourage-second-column-is-the-partner.test.ts`.
 */
type Look = 'axis' | 'lines';

/*
  The prototype sets these small caps at 9.5–10 px; the Guest Legibility Floor (`lint-guest-legibility.mjs`,
  2026-06-20) holds small labels at 12 px (`text-xs`) — the role word is how a guest tells "Father of the Groom"
  from "Mother of the Bride", so it is load-bearing. Muted words are `text-ink/65`, the faintest tint that reads in
  every look (`lint-label-on-fill-contrast.mjs`).
*/
/** The small-caps word UNDER a name (never beside it — owner 2026-10-15). */
const UNDER = 'mt-0.5 block font-sans text-xs uppercase tracking-[0.16em]';
/** The small-caps words of the column row and a by-role sub-heading. */
const SMALL_CAPS = 'font-sans text-xs uppercase tracking-[0.16em] text-ink/65';

/** A group's heading: On the axis — centred between two hairlines; Lines — the page's own eyebrow. */
function GroupHeading({ label, look }: { label: string; look: Look }) {
  if (look === 'lines') {
    return (
      <h4 className="pahina-eyebrow">
        <span>{label}</span>
      </h4>
    );
  }
  return (
    <h4
      data-entourage-divider=""
      className="flex items-center gap-3.5 text-center text-[0.66rem] uppercase tracking-[0.28em] text-gild"
      style={{ fontFamily: 'var(--font-editorial-mono), ui-monospace, monospace' }}
    >
      <i aria-hidden className="h-px flex-1 bg-ink/15" />
      <span>{label}</span>
      <i aria-hidden className="h-px flex-1 bg-ink/15" />
    </h4>
  );
}

/** The two columns' words, said ONCE at the head of a sided group ("Ninong | Ninang"). The ear hears each role per row. */
function ColumnWords({ words, look }: { words: readonly [string, string]; look: Look }) {
  return (
    <p aria-hidden data-entourage-sides="" className={`grid grid-cols-2 ${look === 'axis' ? 'gap-x-7' : 'gap-x-6'} ${SMALL_CAPS}`}>
      <span className={look === 'axis' ? 'text-right' : ''}>{words[0]}</span>
      <span>{words[1]}</span>
    </p>
  );
}

/** One name and, only where the heading cannot say it, its role UNDER it in small caps. */
function Person({ person, word, muted = false }: { person: EntouragePerson; word: string | null; muted?: boolean }) {
  return (
    <>
      <span className="text-base text-ink" data-person="">
        {person.name}
      </span>
      {word ? <span className={`${UNDER} ${muted ? 'text-ink/65' : 'text-gild'}`}>{word}</span> : null}
    </>
  );
}

/**
 * ONE ROW — one walk, or one person alone. ⚖ Owner 2026-10-14: two columns, no "&", holding at 375 (`grid-cols-2`
 * is `minmax(0, 1fr)` twice: a long name wraps INSIDE its own cell; `items-baseline` keeps the two first lines level).
 * A screen reader still hears a pair: the left cell ends in a hidden " and", then the roles the heading names.
 */
function PairRow({
  row,
  group,
  look,
  speakRoles = true,
}: {
  row: EntourageRow;
  group: EntourageGroup;
  look: Look;
  /** False under a by-role sub-heading ("Candle"): the sub-heading already says it, to the eye and the ear alike. */
  speakRoles?: boolean;
}) {
  const people = row.filter((p): p is EntouragePerson => p !== null);
  if (people.length === 0) return null;
  const spoken = people
    .filter((p) => speakRoles && !roleBesideName(group, p))
    .map((p) => roleLabel(p.role, group.names))
    .filter(Boolean);
  const said = spoken.length ? <span className="sr-only">, {spoken.join(' and ')}</span> : null;
  const gap = look === 'axis' ? 'gap-x-7' : 'gap-x-6';
  if (people.length === 1) {
    const one = people[0]!;
    if (look === 'lines') {
      /* Alone, centred across both columns, carrying the word its column would have said. */
      const word = speakRoles ? entourageCellWord(group, one) : null;
      return (
        <li className="break-words text-center leading-snug" data-solo-row="centre">
          <Person person={one} word={word} muted />
          {word ? null : said}
        </li>
      );
    }
    /* On the axis: he keeps the cell the pairing gave him; the partner cell stays blank. */
    const right = row[0] === null;
    return (
      <li className={`grid grid-cols-2 items-baseline ${gap} leading-snug`} data-solo-row={right ? 'right' : 'left'}>
        {right ? <span aria-hidden /> : null}
        <span className={`min-w-0 break-words ${right ? '' : 'text-right'}`}>
          <Person person={one} word={roleBesideName(group, one)} />
          {said}
        </span>
        {right ? null : <span aria-hidden />}
      </li>
    );
  }
  return (
    <li className={`grid grid-cols-2 items-baseline ${gap} leading-snug`} data-pair-row="">
      <span className={`min-w-0 break-words ${look === 'axis' ? 'text-right' : ''}`} data-pair-cell="">
        <Person person={people[0]!} word={roleBesideName(group, people[0]!)} />
        <span className="sr-only"> and </span>
      </span>
      <span className="min-w-0 break-words" data-pair-cell="">
        <Person person={people[1]!} word={roleBesideName(group, people[1]!)} />
        {said}
      </span>
    </li>
  );
}

/**
 * A group drawn BY ROLE — the Secondary Sponsors. ⚖ Owner 2026-09-30.
 *
 *   stacked (B, default)        inline (A)
 *   CANDLE                      Candle: Ana Cruz & Ben Cruz
 *   Ana Cruz      Ben Cruz      Veil: Carla Reyes & Dan Reyes
 *
 * Stacked, the sub-heading is small caps (centred On the axis) and each pair is a `PairRow`. Inline (A) is one line
 * by its nature ("Candle: names") and keeps the " & " — nothing sets it yet.
 */
function ByRoleRows({
  group,
  blocks,
  layout,
  look,
}: {
  group: EntourageGroup;
  blocks: NonNullable<ReturnType<typeof roleBlocks>>;
  layout: EntourageRoleLayout;
  look: Look;
}) {
  if (layout === 'inline') {
    return (
      <ul className="space-y-2">
        {blocks.map((b) => (
          <li key={b.key} className="leading-snug">
            <span className="text-sm text-ink/70">{b.label}:</span>{' '}
            <span className="text-base text-ink">{b.rows.map(lineNames).join(' · ')}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-4">
      {blocks.map((b) => (
        <div key={b.key} className="space-y-1.5">
          <p className={`${SMALL_CAPS} ${look === 'axis' ? 'text-center' : ''}`}>{b.label}</p>
          <ul className="space-y-3">
            {b.rows.map((row, i) => (
              <PairRow key={`${b.key}-${i}`} row={row} group={group} look={look} speakRoles={false} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
