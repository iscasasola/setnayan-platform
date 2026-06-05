'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { saveMonogram } from './actions';

/**
 * MonogramMaker — the couple's standalone monogram editor
 * (`/dashboard/[eventId]/monogram`). Pick initials + one of the 5 curated
 * lockups; persists via saveMonogram() which mirrors the onboarding columns
 * (monogram_text/color/style/font_key/frame_key) so the design round-trips
 * everywhere (chrome switcher · QR center · landing hero).
 *
 * The 5 designs MUST mirror MONO_DESIGNS in lib/monogram.ts. font is a CSS var
 * loaded globally in app/layout.tsx (next/font/google).
 */

type MonoStyle = 'bar' | 'script' | 'duo' | 'framed' | 'infinity';

type Design = {
  label: string;
  hint: string;
  font: string; // CSS var
  fontStyle: 'italic' | 'normal';
  ink: string; // hex
  frame: string | null; // public asset url or null
};

const STYLES: MonoStyle[] = ['bar', 'script', 'duo', 'framed', 'infinity'];

const DESIGNS: Record<MonoStyle, Design> = {
  bar: { label: 'Bar', hint: 'Serif capitals with a divider', font: 'var(--font-display)', fontStyle: 'italic', ink: '#5C2542', frame: null },
  script: { label: 'Script', hint: 'Flowing calligraphy', font: 'var(--font-script)', fontStyle: 'normal', ink: '#5C2542', frame: null },
  duo: { label: 'Duo', hint: 'Overlapping capitals', font: 'var(--font-playfair)', fontStyle: 'italic', ink: '#5C2542', frame: null },
  framed: { label: 'Framed', hint: 'Inside a gold filigree frame', font: 'var(--font-cinzel)', fontStyle: 'normal', ink: '#A88340', frame: '/onboarding/mono/filigree.svg' },
  infinity: { label: 'Infinity', hint: 'Linked by a gold infinity', font: 'var(--font-display)', fontStyle: 'italic', ink: '#5C2542', frame: null },
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
    >
      {pending ? 'Saving…' : 'Save monogram'}
    </button>
  );
}

export function MonogramMaker({
  eventId,
  initialInitials,
  initialStyle,
}: {
  eventId: string;
  initialInitials: string;
  initialStyle: MonoStyle;
}) {
  const [initials, setInitials] = useState(initialInitials);
  const [style, setStyle] = useState<MonoStyle>(initialStyle);

  const design = DESIGNS[style];
  const a = initials[0] ?? '';
  const b = initials[1] ?? '';
  const markText = b ? `${a} & ${b}` : a || 'S';

  function onInitials(value: string) {
    const letters = (value.match(/\p{L}/gu) ?? []).slice(0, 2).join('').toUpperCase();
    setInitials(letters);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* ── Live preview ── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-ink/10 bg-cream p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Live preview
          </p>
          <div className="mt-6 flex min-h-[150px] items-center justify-center">
            {/* key remounts so the draw-on replays on every change */}
            <AnimatedMonogramHero
              key={`${markText}-${design.ink}`}
              text={markText}
              color={design.ink}
              size="lg"
            />
          </div>
          <p className="mt-5 text-sm font-medium text-ink">{design.label} lockup</p>
          <p className="mt-1 text-xs text-ink/55">
            This is how your initials draw themselves in.
          </p>
        </div>
      </div>

      {/* ── Controls ── */}
      <form action={saveMonogram} className="space-y-7">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="initials" value={initials} />
        <input type="hidden" name="style" value={style} />

        {/* Initials */}
        <section className="space-y-2">
          <label htmlFor="mono-initials" className="block text-sm font-semibold text-ink">
            Your initials
          </label>
          <input
            id="mono-initials"
            inputMode="text"
            autoComplete="off"
            value={initials}
            onChange={(e) => onInitials(e.target.value)}
            placeholder="AK"
            className="w-32 rounded-lg border border-ink/15 bg-white px-4 py-3 text-center font-serif text-2xl tracking-[0.15em] text-ink focus:border-mulberry focus:outline-none focus:ring-1 focus:ring-mulberry"
          />
          <p className="text-xs text-ink/55">
            One or two letters — your initials. Shows as &ldquo;{markText}&rdquo;.
          </p>
        </section>

        {/* Lockup picker */}
        <section className="space-y-3">
          <p className="text-sm font-semibold text-ink">Choose a lockup</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STYLES.map((s) => {
              const d = DESIGNS[s];
              const selected = s === style;
              const pa = a || 'A';
              const pb = b || 'K';
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  aria-pressed={selected}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border bg-white p-3 text-center transition-colors ${
                    selected
                      ? 'border-mulberry ring-2 ring-mulberry/15'
                      : 'border-ink/10 hover:border-ink/25'
                  }`}
                >
                  {selected ? (
                    <Check
                      aria-hidden
                      className="absolute right-2 top-2 h-3.5 w-3.5 text-mulberry"
                      strokeWidth={2.5}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className="flex h-16 w-full items-center justify-center"
                    style={
                      d.frame
                        ? {
                            backgroundImage: `url(${d.frame})`,
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                          }
                        : undefined
                    }
                  >
                    <span
                      style={{
                        fontFamily: d.font,
                        fontStyle: d.fontStyle,
                        color: d.ink,
                        fontSize: s === 'framed' ? '15px' : '26px',
                        fontWeight: 600,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {s === 'duo' || s === 'framed'
                        ? `${pa}${pb}`
                        : `${pa} ${s === 'infinity' ? '∞' : '&'} ${pb}`}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-ink">{d.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink/55">{design.hint}.</p>
        </section>

        <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink/55">
            Saves to your wedding website, QR codes, and dashboard.
          </p>
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
