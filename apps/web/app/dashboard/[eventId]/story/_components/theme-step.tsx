'use client';

/**
 * THEME — the Story Maker's third step. PORTED from `prototypes/story-maker.html`
 * (`#p-theme`), not redrawn: the three mode cards, their words, the locked-swatch
 * line, the six-cell light strip and the contrast note are the prototype's, and a
 * delta between this screen and that file is a defect in the port.
 * `02_The_Story_Maker.md` §5 · `08` step 1.4.
 *
 * The host has already chosen their colours once, on the mood board, for the
 * napkins and the flowers. This step is not a second colour exercise; it is the
 * one question the board cannot answer — *does the story follow you, or does it
 * go its own way from here?*
 *
 * ── THE SWATCHES ARE NOT EDITABLE WHILE THE STORY FOLLOWS THE BOARD ─────────
 * 🔑 TWO EDITABLE SOURCES IS HOW A BOARD AND A STORY DRIFT APART. An edit here
 * would either write back to the board (silently restyling the 3D room, the
 * attire cards and the renders) or diverge from it while still claiming to
 * follow — and the host would have no way to tell which. So "follow my mood
 * board" shows them and offers the one honest way to change them: switch to
 * "make my own", which says out loud that following has stopped.
 *
 * ── ONE PICKER, THE BOARD'S OWN ─────────────────────────────────────────────
 * `<SwatchPopover>` is the mood board's component, imported, not reimplemented:
 * the native colour input, the hex field, the colour's NAME (`lib/color-names`),
 * search by colour name (`lib/color-search`) and the "from your mood board" row.
 * A second picker would be a second set of behaviours for a gesture the host has
 * already learned. It renders outside the board's provider on purpose —
 * `usePaletteBoard()` returns null there, which correctly withholds
 * copy/paste/swap-between-roles: there are no other roles on this page to swap
 * with.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { nearestColorName } from '@/lib/color-names';
import { SwatchPopover } from '@/app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover';
import {
  receptionSlotLabel,
  resolveStoryPalette,
  storyLightStages,
  type StoryTheme,
  type StoryThemeMode,
} from '@/lib/story-light';

/** The prototype's three cards, verbatim. */
const MODES: Array<{ key: StoryThemeMode; label: string; blurb: string }> = [
  {
    key: 'board',
    label: 'Follow my mood board',
    blurb: 'Change the board and the story follows.',
  },
  {
    key: 'own',
    label: 'Make my own',
    blurb:
      'Start from the board and change any colour. The story stops following the board from then on.',
  },
  {
    key: 'neutral',
    label: 'Neutral',
    blurb: 'Warm paper and ink. What every story gets when no theme was saved.',
  },
];

/** The prototype's `themeWhy` line — one per mode. */
const WHY: Record<StoryThemeMode, string> = {
  board: 'You are following the board, so nothing here to decide.',
  own: 'You are on your own colours — the mood board can change without touching the story.',
  neutral: 'Neutral is a real choice, not a fallback. Nothing about your day is guessed at.',
};

export function ThemeStep({
  eventId,
  boardColors,
  boardThemeName,
  theme,
  onChange,
}: {
  eventId: string;
  /** `sanitizeRolePalette(events.role_palette).reception` — the saved board. */
  boardColors: string[];
  /** `events.moodboard_theme_name`, so the mode card can name the theme the host
   *  actually saved rather than describing a board in the abstract. */
  boardThemeName: string | null;
  theme: StoryTheme;
  onChange: (next: StoryTheme) => void;
}) {
  const resolved = useMemo(
    () => resolveStoryPalette(theme, { reception: boardColors }),
    [theme, boardColors],
  );
  const stages = useMemo(() => storyLightStages(resolved.colors), [resolved.colors]);

  const hasBoard = boardColors.length > 0;
  const editable = theme.mode === 'own';

  /*
    "Make my own" STARTS FROM THE BOARD (§5). Seeding it from the neutral paper
    instead would make detaching feel like losing the colours rather than taking
    them with you — and a host who then switched back would find the board
    untouched and wonder which of the two they had been editing.
  */
  const chooseMode = (mode: StoryThemeMode) => {
    if (mode === 'own') {
      const seed = theme.colors.length > 0 ? theme.colors : resolved.colors;
      onChange({ mode: 'own', colors: [...seed] });
      return;
    }
    onChange({ mode, colors: [] });
  };

  const setColor = (index: number, hex: string) => {
    const next = [...theme.colors];
    next[index] = hex.toUpperCase();
    onChange({ mode: 'own', colors: next });
  };

  const card = 'rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6';

  return (
    <section className={card}>
      <h2 className="font-display text-lg italic text-ink">Theme</h2>
      <p className="mt-0.5 text-sm text-ink/60">
        The story takes its colours from your day. It runs them as light: morning
        at the top of the page, night at the bottom.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {MODES.map((m) => {
          const chosen = theme.mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => chooseMode(m.key)}
              aria-pressed={chosen}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                chosen
                  ? 'border-burgundy/40 bg-burgundy/5'
                  : 'border-ink/10 bg-white hover:border-ink/25'
              }`}
            >
              <span className="block text-sm font-medium text-ink">{m.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink/55">
                {/* The prototype names the saved theme here. It only does so when
                    there IS one — "Your saved theme — , saved" with the middle
                    missing is worse than not mentioning it. */}
                {m.key === 'board' && boardThemeName ? (
                  <>
                    Your saved theme &mdash; <em>{boardThemeName}</em>. {m.blurb}
                  </>
                ) : (
                  m.blurb
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── The swatches ─────────────────────────────────────────────────── */}
      <div className="mt-5">
        {theme.mode === 'board' && !hasBoard ? (
          /*
            NO SAVED BOARD IS NOT A FAILURE (`01` §4). It is said as a fact, with
            the door to fix it, and what the story uses meanwhile is shown rather
            than described — a host told "no palette found" and shown nothing
            cannot tell whether their story is broken or simply plain.
          */
          <div className="rounded-xl border border-dashed border-ink/20 bg-white/60 px-4 py-3">
            <p className="text-sm text-ink/70">
              You haven&rsquo;t saved a palette on your mood board yet, so your story
              is set in warm paper and ink for now. Save one and it will follow.
            </p>
            <Link
              href={`/dashboard/${eventId}/studio/mood-board`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 underline-offset-4 hover:text-burgundy hover:underline"
            >
              Open your mood board
              <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-3">
              {resolved.colors.map((hex, i) => {
                const name = nearestColorName(hex) ?? hex.toUpperCase();
                return (
                  <div key={`${hex}-${i}`} className="w-[104px]">
                    {editable ? (
                      <SwatchPopover
                        paletteKey="reception"
                        index={i}
                        hex={hex}
                        onChange={(next) => setColor(i, next)}
                        slotLabel={receptionSlotLabel(i)}
                        moodBoardColors={boardColors}
                        interactive={{ enabled: false }}
                      />
                    ) : (
                      <span
                        className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-1.5"
                        title={`${hex} — ${name}`}
                      >
                        <span
                          aria-hidden
                          className="h-9 w-9 shrink-0 rounded-md border border-ink/10"
                          style={{ background: hex }}
                        />
                        <span className="min-w-0 truncate font-mono text-[10px] uppercase text-ink/45">
                          {hex}
                        </span>
                      </span>
                    )}
                    {/* The board's OWN slot names, and the colour's own name —
                        `PALETTE_LIMITS.reception.slotLabels` + `lib/color-names`.
                        Never invented ones: these are the words the host has
                        already read beside these five colours. Neutral is not the
                        host's board, so it carries no slot names. */}
                    {theme.mode === 'neutral' ? null : (
                      <span className="mt-1 block text-center text-[10px] font-mono uppercase tracking-[0.14em] text-ink/45">
                        {receptionSlotLabel(i)}
                      </span>
                    )}
                    <span className="mt-0.5 block text-center text-[10.5px] leading-tight text-ink/55">
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* The prototype's `lockMsg` — and its offer of the ONE honest way to
                change a followed colour. */}
            <p className="mt-3 text-xs leading-relaxed text-ink/55">
              {theme.mode === 'board' ? (
                <>
                  These are your mood board&rsquo;s colours.{' '}
                  <button
                    type="button"
                    onClick={() => chooseMode('own')}
                    className="font-medium text-ink/75 underline underline-offset-2 hover:text-burgundy"
                  >
                    Make my own
                  </button>{' '}
                  to change any of them here &mdash; the board stays as it is.
                </>
              ) : theme.mode === 'neutral' ? (
                'Neutral is the same for every story — nothing to pick.'
              ) : (
                'These started from your mood board. From here they are the story’s own — changing your board won’t move them.'
              )}
            </p>
          </>
        )}
      </div>

      {/* ── The six stages, live ─────────────────────────────────────────── */}
      <div className="mt-4">
        <ul className="flex overflow-hidden rounded-[10px] border border-ink/15">
          {stages.map((s) => (
            <li
              key={s.key}
              className="min-w-0 flex-1 px-2 py-4 text-center font-mono text-[9.5px] font-bold uppercase tracking-[0.1em]"
              style={{ background: s.ground, color: s.ink }}
            >
              {s.label}
            </li>
          ))}
        </ul>
        <p className="mt-3.5 max-w-[66ch] text-xs leading-relaxed text-ink/55">
          Every colour is checked for contrast before it is used, and corrected if
          it would be hard to read &mdash; a colour off a mood board is never
          trusted to be legible on its own. {WHY[theme.mode]}
        </p>
      </div>
    </section>
  );
}
