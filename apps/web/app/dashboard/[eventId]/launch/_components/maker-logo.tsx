'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { StudioConfig } from '@/lib/monogram-studio-shared';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { VectorStudio } from '../../monogram/studio';
import { currentMark } from '../../monogram/mark-bench';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * THE LOGO, INSIDE THE MAKER — and it never loses work (Phase 6).
 *
 * Owner, 2026-09-25 (FINAL_PLAN_INPUTS 29): he designed "A&B" in the Monogram
 * Maker, left without pressing one of its two buttons, and the design was gone —
 * the studio had no Save and no autosave. Here the studio (`VectorStudio`, the
 * same engine, mounted as a sheet over the Maker) AUTOSAVES INTO THE DRAFT:
 *
 *   · a short pause after any change on the canvas (pointer / key / input),
 *   · on "Back to scenes" (and Esc),
 *   · when the tab is hidden or the page is left (`visibilitychange`, `pagehide`),
 *   · when the sheet unmounts.
 *
 * Each save posts `hubDraftAction` intent=save with `monogram_custom_svg` +
 * `monogram_studio_config` — the draft sanitises both with the studio's own
 * `sanitizeStudioSvg` / `sanitizeStudioConfig`, exactly as `saveStudioAction`
 * does. Guests keep the live logo until Apply; letters, frame and ink are free
 * (the animation plays for guests only with Pro — gated where it plays).
 *
 * 🔎 THE STATUS IS ALWAYS ON SCREEN: "Saving…", "Saved to your draft", or the
 * error in words — never a silent failure.
 */
type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string } | { kind: 'error'; text: string };

const PAUSE_MS = 2500;

export function MakerLogoDoor({
  eventId,
  initialConfig,
  initialNames,
  initialUploadSvg,
  markUri,
  drafted,
}: {
  eventId: string;
  initialConfig: StudioConfig | null;
  initialNames: string | null;
  initialUploadSvg: string | null;
  /** The logo as guests (or the draft) draw it now, as an inert data: URI. */
  markUri: string | null;
  drafted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const lastSvg = useRef<string | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  /** Put what is on the canvas into the draft — only when it changed. */
  const flush = useCallback(
    async (opts: { refresh?: boolean } = {}) => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const m = currentMark();
      if (!m.ok || m.mark.source !== 'studio' || !m.mark.svg) return;
      if (m.mark.svg === lastSvg.current || inFlight.current) return;
      inFlight.current = true;
      setSave({ kind: 'saving' });
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set(
          'patch',
          JSON.stringify({ events: { monogram_custom_svg: m.mark.svg, monogram_studio_config: m.mark.config ?? null } }),
        );
        const r = await hubDraftAction(eventId, fd);
        if (r.ok) {
          lastSvg.current = m.mark.svg;
          setSave({
            kind: 'saved',
            at: new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
          });
          if (opts.refresh) router.refresh();
        } else {
          setSave({ kind: 'error', text: r.error });
        }
      } catch {
        setSave({ kind: 'error', text: 'Your logo could not be saved to your draft. Keep this open and try again.' });
      } finally {
        inFlight.current = false;
      }
    },
    [eventId, router],
  );

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), PAUSE_MS);
  }, [flush]);

  const close = useCallback(() => {
    void flush({ refresh: true });
    setOpen(false);
  }, [flush]);

  useModalA11y({ open, onClose: close, containerRef: sheetRef });

  /* Any change on the canvas schedules a save after a short pause. */
  useEffect(() => {
    if (!open) return;
    const host = hostRef.current;
    if (!host) return;
    const onChange = () => schedule();
    host.addEventListener('pointerup', onChange);
    host.addEventListener('keyup', onChange);
    host.addEventListener('input', onChange);
    host.addEventListener('change', onChange);
    return () => {
      host.removeEventListener('pointerup', onChange);
      host.removeEventListener('keyup', onChange);
      host.removeEventListener('input', onChange);
      host.removeEventListener('change', onChange);
    };
  }, [open, schedule]);

  /* Leaving — the tab hidden, the page closed, the sheet gone — saves first. */
  useEffect(() => {
    if (!open) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onLeave = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      void flush();
    };
  }, [open, flush]);

  const status =
    save.kind === 'saving' ? (
      <span className="text-ink/60">Saving…</span>
    ) : save.kind === 'saved' ? (
      <span className="text-ink/70" data-logo-saved="">
        Saved to your draft · {save.at}
      </span>
    ) : save.kind === 'error' ? (
      <span role="alert" className="text-terracotta-700">
        {save.text}
      </span>
    ) : (
      <span className="text-ink/60">Every change saves to your draft by itself.</span>
    );

  return (
    <section className="flex flex-col gap-3 px-1" data-made-once="logo">
      <p className="text-[13.5px] text-ink/75">
        Your logo — on your hero, your seal, your poster and every page — designed once. Every change saves to your
        draft by itself, so leaving never loses it.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-white p-2 shadow-sm">
          {markUri ? (
            // eslint-disable-next-line @next/next/no-img-element -- inert data: URI of the sanitised mark
            <img src={markUri} alt="Your logo" className="max-h-full max-w-full" data-made-once-logo="" />
          ) : (
            <span className="text-center text-[11px] text-ink/55">Your initials, set for you</span>
          )}
        </div>
        <div className="min-w-0 space-y-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[13.5px] font-semibold text-cream hover:bg-ink/90"
          >
            Design your logo
          </button>
          {drafted ? (
            <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
              In your draft — guests see it after you Apply.
            </p>
          ) : null}
          <p className="text-[12px]">{status}</p>
        </div>
      </div>
      <p className="text-[12px] text-ink/60">
        Have a logo already?{' '}
        <Link href={`/dashboard/${eventId}/monogram?mode=upload`} className="font-semibold text-ink underline underline-offset-2">
          Upload it instead
        </Link>
        {' '}— the studio then builds from your file.
      </p>

      {open ? (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Logo"
          className="fixed inset-0 z-[90] flex flex-col bg-cream"
          data-maker-logo-sheet=""
        >
          <header className="sn-glass-bare flex shrink-0 items-center gap-2 px-2 py-1.5 md:px-3">
            <button
              type="button"
              onClick={close}
              className="sn-press inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13.5px] font-semibold text-ink hover:bg-ink/5"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
              Back to scenes
            </button>
            <p className="font-serif text-lg text-ink">Logo</p>
            <p className="ml-auto truncate text-[12px]">{status}</p>
          </header>
          <div ref={hostRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
            <div className="mx-auto max-w-3xl">
              <VectorStudio
                eventId={eventId}
                initialConfig={initialConfig}
                initialNames={initialNames}
                initialUploadSvg={initialUploadSvg}
                /* The live "Remove" form is the Monogram Maker page's; inside the
                   Maker every change goes to the draft, so it is not mounted. */
                hasStudio={false}
                notice={null}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
