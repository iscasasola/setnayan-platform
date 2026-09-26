'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { StudioConfig } from '@/lib/monogram-studio-shared';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { VectorStudio } from '../../monogram/studio';
import { currentMark } from '../../monogram/mark-bench';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { useMaker } from './maker-context';

/**
 * THE LOGO, INSIDE THE MAKER — and it never loses work (Phase 6).
 *
 * Owner, 2026-09-25 (FINAL_PLAN_INPUTS 29): he designed "A&B" in the Monogram
 * Maker, left without pressing one of its two buttons, and the design was gone —
 * the studio had no Save and no autosave. Here the studio (`VectorStudio`, the
 * same engine) AUTOSAVES INTO THE DRAFT:
 *
 *   · a short pause after any change on the canvas (pointer / key / input),
 *   · on "Back" (to the stage),
 *   · when the tab is hidden or the page is left (`visibilitychange`, `pagehide`),
 *   · when the page unmounts — picking any other bar item.
 *
 * 🖼 THE STUDIO IS THE MAKER'S BODY, NOT A SHEET OVER IT (owner 2026-09-25: *"we
 * do not want a pop up for details, logo, hero, reveal and love story. we want
 * their actual page to be on the body of the editor"*). Picking Logo in the bar
 * draws this page where a stage's canvas sits: the studio's own canvas fills the
 * body and its own panel sits beside it on a wide screen (the studio's container
 * query lays them side by side from ~700px), under it on a phone. No dialog, no
 * portal, no focus trap — the bar stays live above it.
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
  drafted,
}: {
  eventId: string;
  initialConfig: StudioConfig | null;
  initialNames: string | null;
  initialUploadSvg: string | null;
  drafted: boolean;
}) {
  const router = useRouter();
  const maker = useMaker();
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const lastSvg = useRef<string | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
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

  /* Back to the stage: save first, then show the stage (its canvas reloads on
     the refresh, so the new logo is on the page at once). */
  const close = useCallback(() => {
    void flush({ refresh: true });
    maker?.select(null);
  }, [flush, maker]);

  /* Any change on the canvas schedules a save after a short pause. */
  useEffect(() => {
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
  }, [schedule]);

  /* Leaving — the tab hidden, the page closed, another bar item picked (this
     page unmounts) — saves first. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onLeave = () => void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
      void flush({ refresh: true });
    };
  }, [flush]);

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

  const back = maker ? PUBLIC_STAGE_LABELS[maker.stage] : 'your page';

  return (
    <section className="flex min-h-0 flex-1 flex-col" data-made-once="logo" data-maker-logo-page="">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/10 bg-cream px-2 py-1.5 md:px-3">
        <button
          type="button"
          onClick={close}
          className="sn-press inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-ink hover:bg-ink/5"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          Back to {back}
        </button>
        <p className="font-serif text-lg text-ink">Logo</p>
        {drafted ? (
          <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
            In your draft — guests see it after you Apply.
          </p>
        ) : null}
        <p className="text-[12px]">{status}</p>
        <p className="ml-auto text-[12px] text-ink/60">
          Have a logo already?{' '}
          <Link href={`/dashboard/${eventId}/monogram?mode=upload`} className="font-semibold text-ink underline underline-offset-2">
            Upload it instead
          </Link>
        </p>
      </header>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 md:px-4">
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
    </section>
  );
}
