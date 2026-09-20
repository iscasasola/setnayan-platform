'use client';

import { useId, useState } from 'react';
import { markInks, markToCurrentColor, type MarkInkMode } from '@/lib/monogram-ink';

/**
 * <InkCompare> — whose colours should this uploaded mark wear: the file's own,
 * or the couple's mood board?
 *
 * ── WHY A WIPE AND NOT A TOGGLE ───────────────────────────────────────────
 * The owner asked for "a toggle so they can choose and compare". A toggle does
 * the CHOOSING well and the COMPARING badly: NN/g's finding is that a toggle
 * forces you to hold one state in memory while looking at the other, which is
 * exactly the judgement being made here. So both are present, doing the job
 * each is good at — a drag handle wipes between the two marks at full size
 * (one mark, never two thumbnails, which matters most on a phone), and two
 * plain buttons below record the decision.
 *
 * The handle is a native `<input type="range">` held at opacity 0 over the
 * frame: draggable, keyboard-operable and announced to a screen reader with no
 * work of ours. A div with a pointer listener would be none of those things.
 *
 * ── WHAT IT IS ACTUALLY SHOWING ───────────────────────────────────────────
 * Left is the stored SVG untouched. Right is `markToCurrentColor(svg)` inside a
 * box whose text colour is the couple's REAL reception colour — the same
 * `currentColor` mechanism the live surfaces use, not a mock-up of it. If they
 * have not picked a palette yet, `paletteInk` is null and the right side is
 * withheld rather than faked against a stand-in colour, because a comparison
 * against a colour that is not theirs answers the wrong question.
 */
export function InkCompare({
  svg,
  paletteInk,
  value,
  onChange,
}: {
  /** The decoded, sanitized mark — the same bytes the save will store. */
  svg: string;
  /** The couple's reception colour, or null when no mood board exists yet. */
  paletteInk: string | null;
  value: MarkInkMode;
  onChange: (next: MarkInkMode) => void;
}) {
  const [wipe, setWipe] = useState(50);
  const id = useId();

  const inks = markInks(svg);
  const recoloured = markToCurrentColor(svg);

  // A mark with no flat colour at all (every fill a gradient or `none`) cannot
  // be recoloured, so offering the choice would be a lie. Say nothing.
  if (inks.length === 0) return null;

  if (!paletteInk) {
    return (
      <div className="rounded-xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/65">
        Your mark keeps its own {inks.length === 1 ? 'colour' : `${inks.length} colours`}. Once you
        choose your mood board, you can have it follow those colours instead — everywhere it appears.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep">Whose colours?</p>
        <p className="mt-1 max-w-prose text-sm text-ink/65">
          Drag to compare. Your file is never changed — this is only how your mark is painted, and you
          can switch back any time.
        </p>
      </div>

      <div className="relative h-64 overflow-hidden rounded-2xl border border-ink/10 bg-cream">
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center p-8 [&_svg]:max-h-full [&_svg]:max-w-full"
          style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center p-8 [&_svg]:max-h-full [&_svg]:max-w-full"
          style={{ clipPath: `inset(0 0 0 ${wipe}%)`, color: paletteInk }}
          dangerouslySetInnerHTML={{ __html: recoloured }}
        />

        <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-cream/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
          Your file
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-cream/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
          Mood board
        </span>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
          style={{ left: `${wipe}%` }}
        />

        <label htmlFor={id} className="sr-only">
          Compare your file&rsquo;s colours with your mood-board colours
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={wipe}
          onChange={(e) => setWipe(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0 focus-visible:opacity-100"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InkChoice
          active={value === 'file'}
          onClick={() => onChange('file')}
          title="Keep our file&rsquo;s colours"
          hint={inks.length === 1 ? 'Exactly as it was made' : `All ${inks.length} colours, exactly as made`}
        />
        <InkChoice
          active={value === 'palette'}
          onClick={() => onChange('palette')}
          title="Follow our mood board"
          hint="Changes with the palette, everywhere"
        />
      </div>
    </section>
  );
}

function InkChoice({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[48px] rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? 'border-gold bg-gold/10' : 'border-ink/15 bg-cream hover:bg-ink/5'
      }`}
    >
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-ink/55">{hint}</span>
    </button>
  );
}
