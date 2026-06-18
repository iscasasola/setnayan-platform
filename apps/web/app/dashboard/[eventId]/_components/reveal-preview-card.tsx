'use client';

/**
 * "Opening reveal" chooser for the Save-the-Date builder (Step 1).
 *
 * The couple picks one of the reveal-library openings (envelopes · church doors ·
 * bridal veil) and sees it AUTO-PLAY inside a device frame they can toggle
 * between iPhone and MacBook Pro 16" — exactly how a guest opens their page on
 * phone vs laptop. The preview is small, low-resolution and watermarked (too
 * small to screen-record); the full-quality interactive opening ships on the
 * live guest page. "Make this mine" persists the choice (events.std_reveal_template).
 *
 * Reuses the exact reveal components that render live, via RevealPreview (which
 * forces auto-play + low-res + non-interactive). three.js (the veil) is lazy-loaded.
 */

import { useState, useTransition } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { chooseRevealTemplate } from '@/app/dashboard/[eventId]/add-ons/save-the-date/actions';
import {
  REVEAL_LIBRARY,
  type RevealTemplate,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import type { WaxSealConfig } from '@/lib/wax-seal/types';
import { DeviceFrame, DeviceToggle, type PreviewDevice } from './device-frame';
import { RevealPreview } from './reveal-preview';

function monogram(name: string): string {
  const p = name
    .split(/\s*&\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const a = p[0] ?? '';
  const b = p[1] ?? '';
  if (a && b) return `${a.charAt(0)} & ${b.charAt(0)}`.toUpperCase();
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

type Props = {
  displayName: string;
  /** Kept for caller compatibility; the preview no longer renders a dated card. */
  dateIso?: string | null;
  /** The couple's monogram SVG markup — pressed into the wax seal. */
  markSvg?: string | null;
  /** Wax seal colour — Mood-Board deep accent (mulberry fallback). */
  waxColor?: string;
  /** The minted wax-seal recipe (candle-stamp maker). Null → default levers. */
  sealConfig?: WaxSealConfig | null;
  /** Stable seed for an un-minted seal (public_id-derived). */
  sealFallbackSeed?: number;
  /** Veil tulle colour — Mood-Board driven (ivory fallback). */
  veilColor?: string;
  /** The event whose chosen opening this persists. */
  eventId: string;
  /** The couple's currently-saved opening (events.std_reveal_template). */
  chosenTemplate?: RevealTemplate | null;
};

export function RevealPreviewCard({
  displayName,
  markSvg = null,
  waxColor = '#5c2542',
  sealConfig = null,
  sealFallbackSeed,
  veilColor = '#f3ece1',
  eventId,
  chosenTemplate = null,
}: Props) {
  const [chosen, setChosen] = useState<RevealTemplate | null>(chosenTemplate);
  const [device, setDevice] = useState<PreviewDevice>('iphone');
  const [previewing, setPreviewing] = useState<RevealTemplate>(
    chosenTemplate ?? REVEAL_LIBRARY[0]!.id,
  );
  const [pending, startTransition] = useTransition();

  const mono = monogram(displayName || 'A & J');

  const saveChoice = (t: RevealTemplate) =>
    startTransition(async () => {
      const r = await chooseRevealTemplate(eventId, t);
      if (r.ok) setChosen(t);
    });

  const isChosen = previewing === chosen;
  const previewedItem = REVEAL_LIBRARY.find((t) => t.id === previewing);

  return (
    <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
      <div className="space-y-5 p-6 sm:p-8">
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Step 1 · Opening reveal
          </p>
          <h2 className="font-serif text-xl italic">How your page opens</h2>
          <p className="max-w-prose text-sm text-ink/70">
            When a guest opens your invitation it begins with a reveal that uncovers your Save the
            Date. Pick an opening — it plays here on phone and laptop, and recolours to your Mood
            Board.
          </p>
        </div>

        {/* Device toggle */}
        <div className="flex justify-center">
          <DeviceToggle device={device} onChange={setDevice} />
        </div>

        {/* Auto-playing device preview */}
        <div className="py-1">
          <DeviceFrame device={device}>
            <RevealPreview
              key={`${device}-${previewing}`}
              template={previewing}
              markSvg={markSvg}
              monogram={mono}
              waxColor={waxColor}
              sealConfig={sealConfig}
              sealFallbackSeed={sealFallbackSeed}
              veilColor={veilColor}
            />
          </DeviceFrame>
        </div>

        {/* What this opening does — the previews are tiny + un-recordable, so
            this line is how the couple tells the five openings apart. */}
        {previewedItem ? (
          <p className="mx-auto max-w-prose text-center text-sm text-ink/70">
            <span className="font-medium text-ink">{previewedItem.label}</span>
            {' — '}
            {previewedItem.blurb}
          </p>
        ) : null}

        {/* Opening picker */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {REVEAL_LIBRARY.map((t) => {
            const active = previewing === t.id;
            const saved = chosen === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreviewing(t.id)}
                aria-pressed={active}
                className={`relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
                  active
                    ? 'border-terracotta bg-terracotta/5 text-ink ring-2 ring-terracotta/15'
                    : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
                }`}
              >
                {saved ? (
                  <Check
                    aria-hidden
                    className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-terracotta"
                    strokeWidth={2.5}
                  />
                ) : null}
                <span className="text-sm font-medium leading-tight">{t.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-55">
                  {t.motion}
                </span>
              </button>
            );
          })}
        </div>

        {/* Commit + status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {isChosen ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-700">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              This is your opening
            </span>
          ) : (
            <button
              type="button"
              onClick={() => saveChoice(previewing)}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Make this mine'}
            </button>
          )}
          <p className="text-xs text-ink/50">
            This preview is intentionally small.{' '}
            <span className="text-ink/70">Your chosen opening plays at full quality on your page.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
