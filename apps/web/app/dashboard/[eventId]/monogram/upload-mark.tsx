'use client';

import { useRef, useState } from 'react';
import { Check, Undo2, UploadCloud } from 'lucide-react';
import { fileToMarkSvg } from '@/lib/monogram-studio/upload';
import { StudioRevealPlayer } from '@/app/_components/studio-reveal-player';
import type { StudioAnimKind } from '@/lib/monogram-studio-shared';
import { saveUploadedMarkAction, clearUploadedMarkAction } from './upload-actions';
import { formatPhp } from '@/lib/orders';

/**
 * <UploadMark> — "upload your own mark" on the Monogram Maker (owner
 * 2026-07-17, overriding the benchmark council's §9 upload deferral).
 *
 * Drop an SVG or a transparent PNG → the browser DECIPHERS it into vector
 * elements (SVG: the author's own paths; PNG: our dependency-free tracer,
 * one path per connected piece) → preview any reveal playing on the REAL
 * uploaded mark (the same player the live site runs) → Save writes the
 * long-dormant events.monogram_uploaded_svg, which already outranks every
 * other mark on the hero, plus the reveal choice.
 *
 * EPS/AI are declined honestly (browsers can't read PostScript) with
 * convert-first guidance. This is the only upload door; the studio's curated
 * path stays the default (verdict §1).
 */

const REVEALS: { kind: StudioAnimKind; label: string }[] = [
  { kind: 'handwriting', label: 'Handwriting' },
  { kind: 'droplet', label: 'Bloom' },
  { kind: 'petalfall', label: 'Petal Fall' },
  { kind: 'molten', label: 'Molten Gold' },
  { kind: 'flip3d', label: 'Medallion Turn' },
];

export function UploadMark({
  eventId,
  hasUpload,
  monogramText,
  notice,
  ownsAnimated,
  animatedPricePhp,
}: {
  eventId: string;
  /** An uploaded mark is currently live (events.monogram_uploaded_svg set). */
  hasUpload: boolean;
  monogramText: string;
  /** Upload-flow status banner (success/error), routed here by page.tsx. */
  notice?: { tone: 'ok' | 'error'; text: string } | null;
  /** Whether the couple owns the paid Animated Monogram (gates the LIVE reveal). */
  ownsAnimated?: boolean;
  /** Catalog price for the honesty line when unowned; null hides the price. */
  animatedPricePhp?: number | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<{ svg: string; elements: number; traced: boolean } | null>(null);
  const [revealKind, setRevealKind] = useState<StudioAnimKind>('handwriting');
  const [replay, setReplay] = useState(0);

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    const res = await fileToMarkSvg(file);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setDecoded(null);
      return;
    }
    setDecoded({ svg: res.svg, elements: res.elements, traced: res.traced });
    setReplay((n) => n + 1);
  }

  return (
    <section id="upload-mark" className="scroll-mt-24 space-y-4 border-t border-ink/10 pt-8">
      <header className="space-y-1.5">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
          <UploadCloud aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Upload your own
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Already have a mark?</h2>
        <p className="max-w-prose text-sm text-ink/65">
          Upload an SVG, a transparent-background PNG, or a scan. We decipher it into its pieces — each
          piece becomes an element every reveal can animate — and it takes over as your monogram
          everywhere. EPS/AI files can&rsquo;t be read by browsers; export them as SVG or PNG first.
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-terracotta/30 bg-terracotta/10 text-terracotta-700'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {hasUpload ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            Your uploaded mark is live — it outranks the studio mark everywhere.
          </p>
          <form action={clearUploadedMarkAction}>
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
            >
              <Undo2 aria-hidden className="h-3 w-3" strokeWidth={2} />
              Remove upload
            </button>
          </form>
        </div>
      ) : null}

      <label className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gold/60 bg-cream/60 px-4 py-6 text-center transition-colors hover:bg-cream">
        <UploadCloud aria-hidden className="h-5 w-5 text-gold-deep" strokeWidth={1.75} />
        <span className="text-sm font-medium text-ink/80">
          {busy ? 'Deciphering…' : decoded ? 'Choose a different file' : 'Tap to upload · SVG or transparent PNG'}
        </span>
        <span className="text-xs text-ink/50">Up to 8MB · your file never leaves the page until you save</span>
        <input
          ref={fileRef}
          type="file"
          accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
          className="sr-only"
          data-testid="upload-mark-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>

      {error ? <p className="text-sm text-terracotta-700">{error}</p> : null}

      {decoded ? (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep" data-testid="upload-elements">
            {decoded.traced
              ? `Deciphered into ${decoded.elements} ${decoded.elements === 1 ? 'piece' : 'pieces'} — traced to crisp vector`
              : `${decoded.elements} vector ${decoded.elements === 1 ? 'element' : 'elements'} found`}
          </p>

          <div
            className="mx-auto h-56 max-w-[320px]"
            style={
              revealKind === 'molten' || revealKind === 'flip3d'
                ? {
                    background: 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)',
                    borderRadius: 16,
                    padding: 16,
                  }
                : undefined
            }
          >
            <StudioRevealPlayer
              key={`${revealKind}-${replay}`}
              svg={decoded.svg}
              monogram={monogramText}
              anim={{ kind: revealKind, dur: 6, smooth: 0.9, delay: 0.3 }}
              allowWebgl={false}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">Animate it</span>
            {REVEALS.map((r) => (
              <button
                key={r.kind}
                type="button"
                onClick={() => {
                  setRevealKind(r.kind);
                  setReplay((n) => n + 1);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  revealKind === r.kind
                    ? 'border-ink bg-ink text-cream'
                    : 'border-ink/15 bg-white text-ink/70 hover:bg-ink/5'
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReplay((n) => n + 1)}
              className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
            >
              ↻ Replay
            </button>
          </div>

          {/* The free/paid line, said where the reveal is chosen — matching the
              studio's §5.3 honesty (gap audit 2026-07-17): the pick previews
              free, but plays live for guests only with Animated Monogram. */}
          {ownsAnimated ? (
            <p className="text-xs text-success-800">The reveal you pick here plays live on your wedding website.</p>
          ) : (
            <p className="text-xs text-ink/60">
              Previewing the reveal is free — guests see it play live with{' '}
              <a href="#animated-monogram" className="font-medium text-mulberry underline underline-offset-2 hover:text-mulberry-700">
                Animated Monogram{animatedPricePhp != null ? ` · ${formatPhp(animatedPricePhp)}` : ''}
              </a>
              . Your mark still shows everywhere without it.
            </p>
          )}

          <form action={saveUploadedMarkAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="svg" value={decoded.svg} />
            <input type="hidden" name="anim_kind" value={revealKind} />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700"
            >
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              Use this as my monogram
            </button>
            <span className="text-xs text-ink/55">Takes over your QR codes, website, and save-the-date.</span>
          </form>
        </div>
      ) : null}
    </section>
  );
}
