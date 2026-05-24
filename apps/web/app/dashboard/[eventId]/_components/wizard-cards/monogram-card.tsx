'use client';

/**
 * WAVE 2 · Card 11 Design Monogram · inline initials + style + color.
 *
 * Iteration 0016 · CLAUDE.md Sixth 2026-05-23 row (V1 SCOPE EXPANSION).
 * Hard constraint per the wave brief: NO LINK to /add-ons/mood-board or
 * /website. Hosts design their monogram INLINE inside the wizard card ·
 * 1-2 initials + 4-style picker + optional accent color + live SVG
 * preview · save advances the wizard past Card 11.
 *
 * Reuses existing schema · NO new migration. Writes events.monogram_text
 * (existing column from migration 20260513060000_iteration_0002_monogram.sql)
 * and events.monogram_color (same migration, default terracotta
 * #C97B4B). Stores the style choice inside wizard_state.monogram.style ·
 * downstream renderers can read it from there or default to
 * classic_serif when absent (the QR overlay in lib/monogram.ts already
 * uses serif italic which is the closest default).
 *
 * The four styles map to web-safe font stacks that match what every
 * downstream surface can render without loading additional webfonts:
 *   - classic_serif → ui-serif, Georgia (matches the existing QR overlay)
 *   - modern_sans   → ui-sans-serif, Inter, system-ui
 *   - script        → "Brush Script MT", Caveat, cursive
 *   - calligraphy   → "Allura", "Brush Script MT", cursive (italic)
 *
 * Pre-population: when the host re-edits, the card reads
 * events.monogram_text + monogram_color + wizard_state.monogram.style
 * so the inputs reflect the last save.
 */

import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { completeMonogramTask } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** events.monogram_text · pre-fills the initials when the host re-edits. */
  initialText: string | null;
  /** events.monogram_color · pre-fills the color picker. Defaults to
   *  terracotta when null (matching the column default). */
  initialColor: string | null;
  /** wizard_state.monogram.style · pre-fills the style picker. Defaults
   *  to classic_serif when null (matches the QR-overlay default font). */
  initialStyle: 'classic_serif' | 'modern_sans' | 'script' | 'calligraphy' | null;
};

type StyleOption = {
  id: 'classic_serif' | 'modern_sans' | 'script' | 'calligraphy';
  label: string;
  hint: string;
  /** CSS font-family stack used in the live SVG preview AND on the
   *  downstream renderers (QR center · save-the-date · invitations ·
   *  signage). Web-safe stacks · no webfont load. */
  fontStack: string;
  /** Whether the style renders italic by default. */
  italic: boolean;
  /** Optional letter-spacing tweak for the preview SVG. */
  letterSpacing: number;
};

const STYLE_OPTIONS: ReadonlyArray<StyleOption> = [
  {
    id: 'classic_serif',
    label: 'Classic serif',
    hint: 'Timeless, editorial — the Setnayan default.',
    fontStack: '"Cormorant Garamond", ui-serif, Georgia, serif',
    italic: true,
    letterSpacing: 0,
  },
  {
    id: 'modern_sans',
    label: 'Modern sans',
    hint: 'Clean, geometric, contemporary.',
    fontStack: 'Manrope, ui-sans-serif, Inter, system-ui, sans-serif',
    italic: false,
    letterSpacing: 0.5,
  },
  {
    id: 'script',
    label: 'Script',
    hint: 'Flowing, intimate — handwritten feel.',
    fontStack: '"Allura", "Brush Script MT", cursive',
    italic: false,
    letterSpacing: 1,
  },
  {
    id: 'calligraphy',
    label: 'Calligraphy',
    hint: 'Heritage, formal, ceremonial.',
    fontStack: '"Cormorant SC", "Allura", ui-serif, cursive',
    italic: true,
    letterSpacing: 2,
  },
];

/** Parse the host's existing monogram_text into 1 or 2 initials.
 *   "M & J" → ["M", "J"]
 *   "M"     → ["M", ""]
 *   "MJ"    → ["M", "J"] (legacy from deriveMonogram before & format)
 *   null    → ["", ""]
 */
function parseInitials(text: string | null): [string, string] {
  if (!text) return ['', ''];
  const cleaned = text.trim();
  // Format "M & J" — the canonical shape from completeMonogramTask.
  const ampMatch = cleaned.match(/^([A-ZÑÖÜ])\s*[&+]\s*([A-ZÑÖÜ])$/iu);
  if (ampMatch && ampMatch[1] && ampMatch[2]) {
    return [ampMatch[1].toUpperCase(), ampMatch[2].toUpperCase()];
  }
  // Single initial.
  if (cleaned.length === 1 && /^[A-ZÑÖÜ]$/iu.test(cleaned)) {
    return [cleaned.toUpperCase(), ''];
  }
  // Legacy 2-char concat ("MJ").
  if (cleaned.length === 2 && /^[A-ZÑÖÜ]{2}$/iu.test(cleaned)) {
    return [
      (cleaned[0] ?? '').toUpperCase(),
      (cleaned[1] ?? '').toUpperCase(),
    ];
  }
  // Fallback · first char only.
  const ch = cleaned.charAt(0);
  return [/^[A-ZÑÖÜ]$/iu.test(ch) ? ch.toUpperCase() : '', ''];
}

const DEFAULT_COLOR = '#C97B4B'; // terracotta — events.monogram_color default

export function MonogramCard({
  eventId,
  initialText,
  initialColor,
  initialStyle,
}: Props) {
  const [parsed1, parsed2] = useMemo(
    () => parseInitials(initialText),
    [initialText],
  );

  const [initial1, setInitial1] = useState<string>(parsed1);
  const [initial2, setInitial2] = useState<string>(parsed2);
  const [styleId, setStyleId] = useState<StyleOption['id']>(
    initialStyle ?? 'classic_serif',
  );
  const [color, setColor] = useState<string>(
    initialColor ?? DEFAULT_COLOR,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Live preview · always reflects current inputs.
  const previewText = useMemo(() => {
    const a = initial1.trim().charAt(0).toUpperCase();
    const b = initial2.trim().charAt(0).toUpperCase();
    if (a && b) return `${a} & ${b}`;
    if (a) return a;
    return '—'; // Em-dash placeholder until host picks an initial.
  }, [initial1, initial2]);

  const activeStyle = useMemo(
    () => STYLE_OPTIONS.find((s) => s.id === styleId) ?? STYLE_OPTIONS[0]!,
    [styleId],
  );

  function handleInitialChange(
    setter: (v: string) => void,
    value: string,
  ): void {
    // Accept the first letter only; uppercase; allow Ñ for Filipino names.
    const ch = value.charAt(0);
    if (ch === '' || /^[A-ZÑÖÜa-zñöü]$/u.test(ch)) {
      setter(ch.toUpperCase());
    }
  }

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    if (!initial1) {
      setErrorMessage("Pick at least the first partner's initial");
      return;
    }

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('initial_1', initial1);
    if (initial2) formData.set('initial_2', initial2);
    formData.set('style', styleId);
    formData.set('color', color);

    startTransition(async () => {
      try {
        await completeMonogramTask(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your monogram. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Initials inputs · two single-char text inputs side by side ·
          uppercase auto-normalized · max length 1 enforced. */}
      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Your initials
        </legend>
        <div className="flex items-center gap-3">
          <label className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink/45">
              Partner 1
            </span>
            <input
              type="text"
              value={initial1}
              onChange={(e) => handleInitialChange(setInitial1, e.target.value)}
              maxLength={1}
              className="h-14 w-14 rounded-lg border-2 border-ink/15 bg-white text-center font-display text-2xl italic text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              aria-label="First initial"
              autoComplete="off"
            />
          </label>
          <span aria-hidden className="pt-5 font-display text-2xl italic text-ink/40">
            &amp;
          </span>
          <label className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-ink/45">
              Partner 2 <span className="normal-case tracking-normal text-ink/35">(optional)</span>
            </span>
            <input
              type="text"
              value={initial2}
              onChange={(e) => handleInitialChange(setInitial2, e.target.value)}
              maxLength={1}
              className="h-14 w-14 rounded-lg border-2 border-ink/15 bg-white text-center font-display text-2xl italic text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              aria-label="Second initial"
              autoComplete="off"
            />
          </label>
        </div>
      </fieldset>

      {/* Style picker · 4 tiles in a 2×2 grid · each tile renders a tiny
          preview of the picked initials in that style's font stack. */}
      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Style
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {STYLE_OPTIONS.map((option) => {
            const isSelected = styleId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setStyleId(option.id)}
                aria-pressed={isSelected}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 bg-cream p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-terracotta'
                    : 'border-ink/10 hover:border-ink/25'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {option.label}
                  </p>
                  {isSelected ? (
                    <CheckCircle2
                      aria-hidden
                      className="h-4 w-4 text-terracotta"
                      strokeWidth={2}
                    />
                  ) : null}
                </div>
                <p
                  aria-hidden
                  className="text-xl"
                  style={{
                    fontFamily: option.fontStack,
                    fontStyle: option.italic ? 'italic' : 'normal',
                    letterSpacing: `${option.letterSpacing}px`,
                    color,
                  }}
                >
                  {previewText}
                </p>
                <p className="text-xs leading-relaxed text-ink/55">
                  {option.hint}
                </p>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Color picker · native input with hex chip beside it. */}
      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60">
          Accent color
        </legend>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            className="h-10 w-16 cursor-pointer rounded-md border border-ink/15 bg-white p-0"
            aria-label="Monogram color"
          />
          <span className="font-mono text-xs text-ink/60">{color}</span>
        </div>
      </fieldset>

      {/* Large live preview · the host sees the monogram exactly as it
          will render on the QR center + save-the-date + signage. */}
      <div className="rounded-xl border border-ink/10 bg-cream/60 p-6">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Live preview
        </p>
        <svg
          viewBox="0 0 200 100"
          aria-label={`Monogram preview: ${previewText}`}
          className="mx-auto block h-24 w-full max-w-xs"
        >
          <text
            x="100"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={activeStyle.fontStack}
            fontStyle={activeStyle.italic ? 'italic' : 'normal'}
            fontSize="60"
            letterSpacing={activeStyle.letterSpacing}
            fontWeight="600"
            fill={color}
          >
            {previewText}
          </text>
        </svg>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending || !initial1}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
              Save monogram
            </>
          )}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        Your monogram lives in your QR codes, your save-the-date video,
        your invitations, and your signage — pick what feels lasting.
      </p>
    </form>
  );
}
