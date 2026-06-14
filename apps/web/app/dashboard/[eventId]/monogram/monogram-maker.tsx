'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, RotateCcw } from 'lucide-react';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import {
  MONOGRAM_MOTIONS,
  type MonogramMotionKey,
} from '@/lib/monogram-motion';
import { saveMonogram } from './actions';

/**
 * MonogramMaker — the couple's standalone monogram editor
 * (`/dashboard/[eventId]/monogram`). Pick initials + one of the 5 curated
 * lockups + one of the 6 motion signatures; persists via saveMonogram() which
 * mirrors the onboarding columns (monogram_text/color/style/font_key/
 * frame_key) plus monogram_motion_key, so the design round-trips everywhere
 * (chrome switcher · QR center · landing hero).
 *
 * The 5 designs MUST mirror MONO_DESIGNS in lib/monogram.ts. font is a CSS var
 * loaded globally in app/layout.tsx (next/font/google). The 6 motions come
 * from lib/monogram-motion.ts (the Motion Library). Every motion previews
 * free in here; WHETHER the landing hero animates stays gated by the paid
 * ANIMATED_MONOGRAM SKU — picking a motion now just means buying later
 * "just works".
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

/**
 * The typeface picker (2026-06-11 expansion — owner picks from the font
 * specimen session: Libre Caslon Display · Tangerine · Luxurious Script ·
 * Vidaloka join the original four). Keys MUST mirror MonoFontKey /
 * MONO_FONT_STACK in lib/monogram.ts and FONT_KEYS in ./actions.ts; the CSS
 * vars are loaded globally in app/layout.tsx (next/font/google).
 */
export type MonoFontOption = {
  key: string;
  label: string;
  css: string; // CSS var stack
  fontStyle: 'italic' | 'normal';
};

export const MONO_FONT_OPTIONS: MonoFontOption[] = [
  { key: 'cormorant', label: 'Cormorant', css: 'var(--font-display)', fontStyle: 'italic' },
  { key: 'playfair', label: 'Playfair', css: 'var(--font-playfair)', fontStyle: 'italic' },
  { key: 'cinzel', label: 'Cinzel', css: 'var(--font-cinzel)', fontStyle: 'normal' },
  { key: 'script', label: 'Great Vibes', css: 'var(--font-script)', fontStyle: 'normal' },
  { key: 'libre_caslon', label: 'Libre Caslon', css: 'var(--font-libre-caslon)', fontStyle: 'normal' },
  { key: 'tangerine', label: 'Tangerine', css: 'var(--font-tangerine)', fontStyle: 'normal' },
  { key: 'luxurious', label: 'Luxurious Script', css: 'var(--font-luxurious)', fontStyle: 'normal' },
  { key: 'vidaloka', label: 'Vidaloka', css: 'var(--font-vidaloka)', fontStyle: 'normal' },
];

/** Each lockup's default face — what saveMonogram stores when the couple never
 *  touches the typeface row (mirrors DESIGNS in ./actions.ts). */
export const DEFAULT_FONT_FOR_STYLE: Record<MonoStyle, string> = {
  bar: 'cormorant',
  script: 'script',
  duo: 'playfair',
  framed: 'cinzel',
  infinity: 'cormorant',
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
  initialFont,
  initialMotion,
}: {
  eventId: string;
  initialInitials: string;
  initialStyle: MonoStyle;
  initialFont: string;
  initialMotion: MonogramMotionKey;
}) {
  const [initials, setInitials] = useState(initialInitials);
  const [style, setStyle] = useState<MonoStyle>(initialStyle);
  const [font, setFont] = useState(initialFont);
  // Until the couple explicitly picks a typeface, the font follows the chosen
  // lockup's default (so the 5 lockups still feel like complete designs). A
  // stored override (initialFont ≠ the lockup default) counts as touched.
  const [fontTouched, setFontTouched] = useState(
    initialFont !== DEFAULT_FONT_FOR_STYLE[initialStyle],
  );
  const [motion, setMotion] = useState<MonogramMotionKey>(initialMotion);
  // Bumping replay remounts the preview so the chosen motion plays again.
  const [replay, setReplay] = useState(0);

  const design = DESIGNS[style];
  const activeFace =
    MONO_FONT_OPTIONS.find((f) => f.key === font) ?? MONO_FONT_OPTIONS[0]!;

  function pickStyle(s: MonoStyle) {
    setStyle(s);
    if (!fontTouched) setFont(DEFAULT_FONT_FOR_STYLE[s]);
  }

  function pickFont(key: string) {
    setFont(key);
    setFontTouched(true);
  }
  const activeMotion = MONOGRAM_MOTIONS.find((m) => m.key === motion) ?? {
    key: 'draw' as const,
    label: 'Drawn',
    hint: 'Traced in by an invisible pen',
    description: '',
  };
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
            {/* key remounts so the chosen motion replays on every change */}
            <AnimatedMonogramHero
              key={`${markText}-${style}-${design.ink}-${font}-${motion}-${replay}`}
              text={markText}
              color={design.ink}
              fontFamily={activeFace.css}
              fontStyle={activeFace.fontStyle}
              /* Animate the couple's REAL lockup for the four type-only styles;
                 framed / single-initial fall back to the text circle inside
                 AnimatedMonogramHero (unchanged). */
              lockupStyle={style}
              size="lg"
              motion={motion}
            />
          </div>
          <p className="mt-5 text-sm font-medium text-ink">
            {design.label} lockup · {activeFace.label} · {activeMotion.label} motion
          </p>
          <p className="mt-1 text-xs text-ink/55">{activeMotion.hint}.</p>
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <RotateCcw aria-hidden className="h-3 w-3" strokeWidth={2} />
            Replay
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <form action={saveMonogram} className="space-y-7">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="initials" value={initials} />
        <input type="hidden" name="style" value={style} />
        <input type="hidden" name="font" value={font} />
        <input type="hidden" name="motion" value={motion} />

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
                  onClick={() => pickStyle(s)}
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

        {/* Typeface picker (2026-06-11 expansion) — overrides the lockup's
            default face; until touched it follows the lockup. */}
        <section className="space-y-3">
          <p className="text-sm font-semibold text-ink">Choose a typeface</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MONO_FONT_OPTIONS.map((f) => {
              const selected = f.key === font;
              const pa = a || 'A';
              const pb = b || 'K';
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => pickFont(f.key)}
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
                    className="flex h-12 w-full items-center justify-center"
                  >
                    <span
                      style={{
                        fontFamily: f.css,
                        fontStyle: f.fontStyle,
                        color: design.ink,
                        fontSize: '24px',
                        fontWeight: 600,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {pa} &amp; {pb}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-ink">{f.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink/55">
            Your monogram&rsquo;s lettering — it follows the lockup until you pick
            one yourself.
          </p>
        </section>

        {/* Motion picker */}
        <section className="space-y-3">
          <p className="text-sm font-semibold text-ink">Choose a motion</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MONOGRAM_MOTIONS.map((m) => {
              const selected = m.key === motion;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMotion(m.key);
                    setReplay((n) => n + 1);
                  }}
                  aria-pressed={selected}
                  className={`relative flex flex-col items-start gap-1 rounded-xl border bg-white p-3 text-left transition-colors ${
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
                  <span className="text-sm font-semibold text-ink">{m.label}</span>
                  <span className="text-xs leading-snug text-ink/55">{m.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink/55">
            Every motion previews here free — the one you save plays on your
            wedding website with the Animated Monogram upgrade.
          </p>
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
