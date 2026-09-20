'use client';

import { useRef, useState } from 'react';
import { Check, Undo2, UploadCloud } from 'lucide-react';
import { fileToMarkSvg } from '@/lib/monogram-studio/upload';
import { StudioRevealPlayer } from '@/app/_components/studio-reveal-player';
import type { StudioAnimKind } from '@/lib/monogram-studio-shared';
import { saveUploadedMarkAction, clearUploadedMarkAction } from './upload-actions';
import { InkCompare } from './ink-compare';
import { UploadTips } from './upload-tips';
import { markInks, type MarkInkMode } from '@/lib/monogram-ink';

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
  paletteInk,
  savedSvg,
  savedIsLive,
}: {
  eventId: string;
  /** An uploaded mark is currently live (events.monogram_uploaded_svg set). */
  hasUpload: boolean;
  monogramText: string;
  /** Upload-flow status banner (success/error), routed here by page.tsx. */
  notice?: { tone: 'ok' | 'error'; text: string } | null;
  /** Whether the couple owns the paid Animated Monogram (gates the LIVE reveal). */
  ownsAnimated?: boolean;
  /** The couple's reception colour from their mood board, or null when they
   *  have not chosen one — <InkCompare> withholds the comparison rather than
   *  previewing against a colour that is not theirs. */
  paletteInk?: string | null;
  /** The mark ALREADY saved on this event, gated + ink-resolved by the page.
   *  Without it this panel showed a couple nothing but a green banner and a
   *  dropzone: to see their own logo, or how it animates, they had to upload it
   *  again (owner 2026-09-20: "i do not see the logo. and what it looks like as
   *  a converted svg to be able to animate"). */
  savedSvg?: string | null;
  /** Is that saved mark the one guests see, or has it been switched off in
   *  favour of the designed one? */
  savedIsLive?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<{ svg: string; elements: number; traced: boolean } | null>(null);
  const [revealKind, setRevealKind] = useState<StudioAnimKind>('handwriting');
  const [replay, setReplay] = useState(0);
  /* Default 'file': never silently repaint somebody's existing brand mark. The
   * couple opts INTO the mood board, having seen both. */
  const [inkMode, setInkMode] = useState<MarkInkMode>('file');

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

      {/* YOUR LOGO, SHOWN. The panel used to prove an upload existed with a
          sentence and nothing else — no mark, no pieces, no reveal — so the one
          screen for your uploaded logo was the one screen that never displayed
          it. Rendered here from the SAVED svg, with the same piece and colour
          counts a fresh upload reports, and the same player, so "what it looks
          like as a converted svg to be able to animate" is answerable without
          uploading the file a second time. */}
      {hasUpload && savedSvg && !decoded ? (
        <SavedMark svg={savedSvg} live={savedIsLive !== false} monogramText={monogramText} />
      ) : null}

      {hasUpload ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            {savedIsLive === false
              ? 'Kept, but not in use — your designed mark is the live one.'
              : 'Your uploaded mark is live — it outranks the designed mark everywhere.'}
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

      {/* Open while there is nothing to look at, collapsed once a mark is on
          screen — NN/g's mobile-accordion rule, applied to the moment rather
          than the breakpoint: guidance first, then get out of the way. */}
      <UploadTips open={!decoded} />

      {decoded ? (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep" data-testid="upload-elements">
            {decoded.traced
              ? `Deciphered into ${decoded.elements} ${decoded.elements === 1 ? 'piece' : 'pieces'} — traced to crisp vector`
              : `${decoded.elements} vector ${decoded.elements === 1 ? 'element' : 'elements'} found`}
          </p>

          <div
            className={`mx-auto h-56 max-w-[320px]${
              revealKind === 'molten' || revealKind === 'flip3d' ? ' rounded-2xl p-4' : ''
            }`}
            style={
              revealKind === 'molten' || revealKind === 'flip3d'
                ? {
                    background: 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)',
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

          <InkCompare
            svg={decoded.svg}
            paletteInk={paletteInk ?? null}
            value={inkMode}
            onChange={setInkMode}
          />

          {/* ONE free/paid line on this page, and it is the unlock row below
              (<AnimatedMonogramUpgrade>, compact). This panel used to carry a
              SECOND, differently-worded copy of it — two sentences making the
              same promise in two voices, which is how they drift apart. Only
              the owned confirmation stays, because it is a status, not a
              pitch. */}
          {ownsAnimated ? (
            <p className="text-xs text-success-800">The reveal you pick here plays live for your guests.</p>
          ) : null}

          <form action={saveUploadedMarkAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="svg" value={decoded.svg} />
            <input type="hidden" name="anim_kind" value={revealKind} />
            {/* The colour choice rides with the mark: the action stamps it onto
                the SVG's root tag, so every read site inherits it without
                asking. */}
            <input type="hidden" name="ink_mode" value={inkMode} />
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

/**
 * <SavedMark> — the logo you already uploaded, actually on screen: the mark
 * itself, how many pieces it was deciphered into, how many colours it carries,
 * and every reveal playing on it.
 *
 * This is the same information a FRESH upload shows. It was missing for a saved
 * one purely because the preview block was gated on `decoded`, which only
 * exists after picking a file in this session — so the state a couple is in
 * every time they come back was the state that displayed nothing.
 */
function SavedMark({
  svg,
  live,
  monogramText,
}: {
  svg: string;
  live: boolean;
  monogramText: string;
}) {
  const [revealKind, setRevealKind] = useState<StudioAnimKind>('handwriting');
  const [replay, setReplay] = useState(0);

  // Counted from the SAME svg that renders, so the numbers cannot describe a
  // different file from the one on screen.
  const pieces = (svg.match(/<path[\s>]/gi) ?? []).length;
  const colours = markInks(svg).length;

  return (
    <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep">
          {live ? 'Your logo, in use' : 'Your logo, kept'}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
          {pieces} {pieces === 1 ? 'piece' : 'pieces'} · {colours} {colours === 1 ? 'colour' : 'colours'}
        </p>
      </header>

      {/* ONE frame, PLAYING — the same shape as the Save-the-Date opening
          picker (reveal-preview-card.tsx): tiles choose, and a single shared
          frame plays the choice. It auto-plays rather than waiting for a press,
          because the whole complaint was "i cannot see the different monogram
          animation effects" — a still frame answers nothing. Safe to auto-play:
          StudioRevealPlayer honours prefers-reduced-motion itself and renders
          the mark static for anyone who asked for less motion (WCAG 2.3.3). */}
      <div className="mx-auto h-56 max-w-[320px]">
        <StudioRevealPlayer
          key={`${revealKind}-${replay}`}
          svg={svg}
          monogram={monogramText}
          anim={{ kind: revealKind, dur: 6, smooth: 0.9, delay: 0.3 }}
          allowWebgl={false}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/55">Try each one</span>
        {REVEALS.map((r) => (
          <button
            key={r.kind}
            type="button"
            aria-pressed={revealKind === r.kind}
            onClick={() => {
              setRevealKind(r.kind);
              setReplay((n) => n + 1);
            }}
            className={`min-h-[44px] rounded-lg border px-3 text-xs font-medium transition-colors ${
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
          className="min-h-[44px] rounded-lg border border-ink/15 bg-white px-3 text-xs font-medium text-ink/70 hover:bg-ink/5"
        >
          ↻ Play again
        </button>
      </div>
    </section>
  );
}
