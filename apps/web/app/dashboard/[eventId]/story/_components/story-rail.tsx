'use client';

/**
 * THE STORY MAKER'S RAIL — the six steps, ported from `prototypes/story-maker.html`.
 *
 * 🔴 WHY THIS EXISTS. The desk, theme, cover, what's-next and publish steps were all BUILT and all
 * CORRECT, and then appended to the bottom of the old single-scroll editorial editor. Measured in
 * the live browser at 1907px on 2026-09-10: no rail anywhere, and the headings ran
 * `The desk · What goes in · The words · Your photos · Section order · Your own columns ·
 * What they said · What shows · Theme · The cover · What's next · Publish` — twelve headings for
 * six steps, with "The story" existing only as seven loose sections. The owner, who approved the
 * prototype, said it plainly: *"this looks like the old editorial setup page."* He was right.
 * **A checklist of capabilities is not a port.**
 *
 * ── IT IS A TAB SWITCHER, NOT A SCROLL-SPY ─────────────────────────────────────────────────────
 * Read out of the prototype rather than assumed: `.panel{display:none} .panel.on{display:block}`,
 * `show()` toggles `.on` onto exactly ONE panel, and its last line is
 * `window.scrollTo({top:0})`. There is no IntersectionObserver, no `scrollIntoView` and no hash
 * routing in the file. A rail that highlighted sections as you scrolled would never reset scroll.
 *
 * ── THE PANELS ARE HIDDEN, NEVER UNMOUNTED — AND THAT IS A DATA-LOSS RULE ──────────────────────
 * 🔴 The story, theme and publish steps share ONE unsaved form: twelve pieces of state in
 * `editorial-editor.tsx`, no autosave, saved only when a publish rung is pressed. Swapping panels
 * with `{step === 'story' && …}` unmounts the subtree, so **everything the host had typed would
 * vanish the moment they tapped "Theme"** — silently, with `dirty` still true. This app already
 * solved the same problem the same way in `service-wizard.tsx` (*"All step sections live in the
 * DOM (so every field submits); only the active one is shown"*). The switching lives in the
 * editor; this component only says which step is chosen.
 *
 * ── COLOUR ─────────────────────────────────────────────────────────────────────────────────────
 * ⚠ In this repo the slot named `terracotta` IS the atelier gold (`text-terracotta` measures
 * 3.37:1 on cream — below AA), and the action colour lives in the slot named `mulberry`. The
 * active row's LABEL therefore uses ink, and the 3px active edge uses `mulberry-600` (a non-text
 * bar clears the 3:1 rule, and 600 measures 4.92 light / 5.78 dark where 700 drops to 3.05 dark).
 */
import type { ReactElement } from 'react';

export const STORY_STEPS = ['desk', 'story', 'theme', 'cover', 'next', 'publish'] as const;
export type StoryStepKey = (typeof STORY_STEPS)[number];

export type StoryStep = {
  key: StoryStepKey;
  label: string;
  /** The rail's count/state chip — `null` draws no chip at all. */
  chip: string | null;
  /** Draws the chip filled: something is waiting on the host here. */
  hot?: boolean;
};

/**
 * The rail (≥1000px) and the phone's chip strip (<1000px) are ONE component and ONE selection.
 * The prototype drives both from the same `show()`, and a second copy of "which step is open" is
 * how two surfaces come to disagree about one fact.
 */
export function StoryRail({
  steps,
  active,
  onSelect,
  percentDecided,
}: {
  steps: readonly StoryStep[];
  active: StoryStepKey;
  onSelect: (key: StoryStepKey) => void;
  /** Already computed by the page — the rail does not recount anything. */
  percentDecided: number;
}): ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round(percentDecided)));

  return (
    <>
      {/* ── the phone strip ─────────────────────────────────────────────────── */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4 min-[1000px]:hidden">
        <div className="flex w-max gap-1.5" role="tablist" aria-label="Story Maker steps">
          {steps.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active === s.key}
              onClick={() => onSelect(s.key)}
              className={`min-h-[44px] whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition ${
                active === s.key
                  ? 'border-ink/25 bg-white text-ink shadow-sm'
                  : 'border-ink/12 bg-cream/60 text-ink/60'
              }`}
            >
              {s.label}
              {s.chip ? (
                <span className="ml-2 font-mono text-xs tabular-nums text-ink/60">{s.chip}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* ── the rail ────────────────────────────────────────────────────────── */}
      <aside className="hidden self-start min-[1000px]:sticky min-[1000px]:top-20 min-[1000px]:block">
        <nav className="flex flex-col gap-0.5" aria-label="Story Maker steps">
          {steps.map((s) => {
            const on = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-current={on ? 'step' : undefined}
                onClick={() => onSelect(s.key)}
                className={`relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${
                  on
                    ? 'bg-white font-semibold text-ink shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-mulberry-600'
                    : 'text-ink/60 hover:text-ink'
                }`}
              >
                <span className="flex-1">{s.label}</span>
                {s.chip ? (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 font-mono text-xs tabular-nums ${
                      s.hot ? 'bg-mulberry-600 text-white' : 'bg-ink/[0.06] text-ink/60'
                    }`}
                  >
                    {s.chip}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/*
          The meter. Its number comes from the page — this does not recount the desk, because two
          places counting one thing is how they come to disagree.
        */}
        <div className="mt-5 rounded-xl border border-dashed border-ink/15 p-3">
          <p className="font-display text-xl italic text-ink">
            {pct}%<span className="ml-1.5 font-sans text-xs not-italic text-ink/60">of the desk decided</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
            <i className="block h-full rounded-full bg-mulberry-600" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink/60">
            Nothing goes into the story until you say so.
          </p>
        </div>
      </aside>
    </>
  );
}
