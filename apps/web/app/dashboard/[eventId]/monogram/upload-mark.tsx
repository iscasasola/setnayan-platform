'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload, UploadCloud } from 'lucide-react';
import { fileToMarkSvg } from '@/lib/monogram-studio/upload';
import { StudioRevealPlayer } from '@/app/_components/studio-reveal-player';
import { clearUploadedMarkAction } from './upload-actions';
import { provideMark, onPlay, type PlayDetail } from './mark-bench';
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
 * uploaded mark (the same player the live site runs). There is no save button
 * in here: the page's "Use Static Image" / "Unlock Animation & Apply" ask for
 * the mark through mark-bench.ts and write events.monogram_uploaded_svg.
 *
 * EPS/AI are declined honestly (browsers can't read PostScript) with
 * convert-first guidance. This is the only upload door; the studio's curated
 * path stays the default (verdict §1).
 */

export function UploadMark({
  eventId,
  hasUpload,
  monogramText,
  notice,
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
  /* The effect tapped in the row below, played on the mark shown here. null =
   * the mark sits still. `n` restarts the player when the same one is tapped. */
  const [playing, setPlaying] = useState<(PlayDetail & { n: number }) | null>(null);
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
  }

  /** The Upload icon opens the same hidden file input the dropzone uses. */
  function pick() {
    if (!busy) fileRef.current?.click();
  }

  useEffect(() => onPlay((d) => setPlaying((p) => ({ ...d, n: (p?.n ?? 0) + 1 }))), []);

  /* What "Use Static Image" / "Unlock Animation & Apply" save from this side:
   * a freshly decoded file, else the logo already saved (left as it is). */
  useEffect(
    () =>
      provideMark(() =>
        decoded
          ? { ok: true, mark: { source: 'upload', svg: decoded.svg, inkMode } }
          : hasUpload
            ? { ok: true, mark: { source: 'none' } }
            : { ok: false, error: 'Upload your monogram first.' },
      ),
    [decoded, inkMode, hasUpload],
  );

  return (
    <section id="upload-mark" className="scroll-mt-24 space-y-4">
      {/* No heading: the page's <MarkToggle> already says which side this is.
          What the heading used to explain (SVG / PNG / scan, EPS and AI must be
          converted first) is in <UploadTips>, which says it better and before
          the upload rather than above it. */}

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
        <SavedMark
          svg={savedSvg}
          live={savedIsLive !== false}
          monogramText={monogramText}
          playing={playing}
          tools={<MarkTools eventId={eventId} busy={busy} onUpload={pick} canRemove />}
        />
      ) : null}

      {/* A freshly chosen file sits where the saved logo was — the mark is the
          first thing on this side, as in the concept, with the file controls
          under it. */}
      {decoded ? (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
          <header className="flex items-center justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep" data-testid="upload-elements">
              {decoded.traced
                ? `Deciphered into ${decoded.elements} ${decoded.elements === 1 ? 'piece' : 'pieces'} — traced to crisp vector`
                : `${decoded.elements} vector ${decoded.elements === 1 ? 'element' : 'elements'} found`}
            </p>
            <MarkTools eventId={eventId} busy={busy} onUpload={pick} canRemove={false} />
          </header>

          <MarkStage svg={decoded.svg} monogramText={monogramText} playing={playing} />

          <InkCompare
            svg={decoded.svg}
            paletteInk={paletteInk ?? null}
            value={inkMode}
            onChange={setInkMode}
          />
        </div>
      ) : null}

      {/* ONE CARD (owner 2026-09-21, pointing at the "in use" card, the green
          banner and the dropzone under it: "we can integrate these 2 on the
          actual your logo, in use area with icons of upload and remove
          image"). Upload and Remove are icons in the card's header; the
          dropzone shows only while there is no logo to put a header on. */}
      <input
        ref={fileRef}
        id="upload-mark-file"
        type="file"
        accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg"
        className="sr-only"
        data-testid="upload-mark-input"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {!decoded && !(hasUpload && savedSvg) ? (
        <label
          htmlFor="upload-mark-file"
          className="flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gold/60 bg-cream/60 px-4 py-6 text-center transition-colors hover:bg-cream"
        >
          <UploadCloud aria-hidden className="h-5 w-5 text-gold-deep" strokeWidth={1.75} />
          <span className="text-sm font-medium text-ink/80">
            {busy ? 'Deciphering…' : 'Tap to upload · SVG or transparent PNG'}
          </span>
          <span className="text-xs text-ink/50">Up to 8MB · your file never leaves the page until you save</span>
        </label>
      ) : null}

      {error ? <p className="text-sm text-terracotta-700">{error}</p> : null}

      {/* Collapsed once a logo is on screen — saved or freshly chosen — so the
          effects and the two buttons are not pushed a screen further down. */}
      <UploadTips open={!decoded && !hasUpload} />

    </section>
  );
}

/**
 * <SavedMark> — the logo you already uploaded, actually on screen: the mark
 * itself, and how many pieces and colours it carries.
 *
 * It was missing entirely because the preview block was gated on `decoded`,
 * which only exists after picking a file in this session — so the state a
 * couple is in every time they come back was the state that displayed nothing
 * (owner: "i do not see the logo").
 *
 * ⛔ NO REVEAL CHIPS HERE ANY MORE. They used to live in this panel AND inside
 * the Vector Studio — two pickers writing one field, neither visible from the
 * other door. The effects are one row of their own under whichever editor is
 * open (mark-bench.tsx) and play ON this mark. Adding a second picker back
 * here would recreate exactly the split the owner asked to remove.
 */
function SavedMark({
  svg,
  live,
  monogramText,
  playing,
  tools,
}: {
  svg: string;
  live: boolean;
  monogramText: string;
  playing: (PlayDetail & { n: number }) | null;
  tools: React.ReactNode;
}) {
  // Counted from the SAME svg that renders, so the numbers cannot describe a
  // different file from the one on screen.
  const pieces = (svg.match(/<path[\s>]/gi) ?? []).length;
  const colours = markInks(svg).length;

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep">
          {live ? 'Your logo, in use' : 'Your logo, kept'}
        </p>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
            {pieces} {pieces === 1 ? 'piece' : 'pieces'} · {colours} {colours === 1 ? 'colour' : 'colours'}
          </p>
          {tools}
        </div>
      </header>
      <MarkStage svg={svg} monogramText={monogramText} playing={playing} />
    </section>
  );
}

/**
 * <MarkStage> — the logo, still, until an effect is tapped in the row below;
 * then that effect plays on it right here, through the same player the live
 * site runs. Metal reveals get their dark stage so the gold reads.
 */
function MarkStage({
  svg,
  monogramText,
  playing,
}: {
  svg: string;
  monogramText: string;
  playing: (PlayDetail & { n: number }) | null;
}) {
  const dark = playing?.kind === 'molten' || playing?.kind === 'flip3d';
  return (
    <div
      className={`mx-auto h-56 max-w-[320px]${dark ? ' rounded-2xl p-4' : ''}`}
      style={
        dark ? { background: 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)' } : undefined
      }
    >
      {playing ? (
        <StudioRevealPlayer
          key={`${playing.kind}-${playing.n}`}
          svg={svg}
          monogram={monogramText}
          anim={{ kind: playing.kind, dur: playing.dur, smooth: playing.smooth, delay: playing.delay }}
          allowWebgl={false}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-full items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}

/**
 * <MarkTools> — Upload and Remove as two icons in the logo card's header.
 * Icon-only, so each carries an aria-label and a title, and both are 44px
 * targets. Remove deletes the logo for good (the original photo was never
 * kept), so it asks first.
 */
function MarkTools({
  eventId,
  busy,
  onUpload,
  canRemove,
}: {
  eventId: string;
  busy: boolean;
  onUpload: () => void;
  canRemove: boolean;
}) {
  const ICON =
    'inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ink/15 bg-white text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onUpload}
        disabled={busy}
        aria-label={busy ? 'Deciphering your file' : 'Upload a different logo'}
        title="Upload a different logo"
        className={ICON}
      >
        <Upload aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>
      {canRemove ? (
        <form
          action={clearUploadedMarkAction}
          onSubmit={(e) => {
            if (!window.confirm('Remove your uploaded logo? This cannot be undone.')) e.preventDefault();
          }}
        >
          <input type="hidden" name="event_id" value={eventId} />
          <button type="submit" aria-label="Remove uploaded logo" title="Remove uploaded logo" className={ICON}>
            <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </form>
      ) : null}
    </div>
  );
}
