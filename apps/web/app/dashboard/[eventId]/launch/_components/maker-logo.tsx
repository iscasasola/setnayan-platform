'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioConfig } from '@/lib/monogram-studio-shared';
import { createLogoSaveGate } from '@/lib/maker-logo-save-gate';
import { VectorStudio } from '../../monogram/studio';
import { currentMark } from '../../monogram/mark-bench';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * THE LOGO, INSIDE THE MAKER — and it never loses work (Phase 6).
 *
 * Owner, 2026-09-25 (FINAL_PLAN_INPUTS 29): he designed "A&B" in the Monogram
 * Maker, left without pressing one of its two buttons, and the design was gone —
 * the studio had no Save and no autosave. Here the studio (`VectorStudio`, the
 * same engine) AUTOSAVES INTO THE DRAFT:
 *
 *   · a short pause after any change on the canvas (pointer / key / input),
 *   · when the tab is hidden or the page is left (`visibilitychange`, `pagehide`),
 *   · when the page unmounts — picking any other bar item.
 *
 * 🛑 …BUT NEVER ON OPEN (owner 2026-09-27). Every one of those used to save
 * whatever the canvas held the first time — so merely opening this page and
 * leaving it put the studio's untouched starting design into the draft, over
 * the couple's real logo. `createLogoSaveGate` (`lib/maker-logo-save-gate.ts`)
 * now takes the canvas as it stood when the couple FIRST reached for it as the
 * baseline, and saves only a canvas that differs from it.
 *
 * 🖼 THE COUPLE'S OWN LOGO FIRST. An event whose mark is an uploaded logo (and
 * no design yet) opens on THAT logo, as it is — "Upload a different one" /
 * "Design one instead". The studio mounts only when they ask to design.
 *
 * ⛔ No "Back to …" button (owner 2026-09-27: *"no need for this"*) — the
 * Maker bar already goes anywhere, and leaving still saves a real edit.
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
  uploadedLogoSrc = null,
  drafted,
}: {
  eventId: string;
  initialConfig: StudioConfig | null;
  initialNames: string | null;
  initialUploadSvg: string | null;
  /** The couple's uploaded logo (a sanitised data URI) when it is their mark
   *  and no design exists yet — shown as it is, never re-drawn by the studio
   *  until they ask to design one. */
  uploadedLogoSrc?: string | null;
  drafted: boolean;
}) {
  const [designing, setDesigning] = useState(!uploadedLogoSrc);
  if (!designing && uploadedLogoSrc) {
    return (
      <UploadedLogo eventId={eventId} src={uploadedLogoSrc} drafted={drafted} onDesign={() => setDesigning(true)} />
    );
  }
  return (
    <LogoStudio
      eventId={eventId}
      initialConfig={initialConfig}
      initialNames={initialNames}
      /* "Design one instead" starts from the couple's initials, not the upload. */
      initialUploadSvg={uploadedLogoSrc ? null : initialUploadSvg}
      drafted={drafted}
    />
  );
}

/** The couple's uploaded logo, as it is — nothing mounts that could save. */
function UploadedLogo({
  eventId,
  src,
  drafted,
  onDesign,
}: {
  eventId: string;
  src: string;
  drafted: boolean;
  onDesign: () => void;
}) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col"
      data-made-once="logo"
      data-maker-logo-page=""
      data-maker-logo-uploaded=""
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/10 bg-cream px-3 py-1.5">
        <p className="font-serif text-lg text-ink">Logo</p>
        {drafted ? (
          <p className="text-[12px] font-semibold text-terracotta-700" data-made-once-drafted="">
            In your draft — guests see it after you Apply.
          </p>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-4 py-6">
        <div className="flex h-56 w-full max-w-[320px] items-center justify-center rounded-2xl bg-white/70 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a sanitised data: URI, not a remote image */}
          <img src={src} alt="Your logo" className="max-h-full max-w-full object-contain" data-maker-logo-current="" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/dashboard/${eventId}/monogram?mode=upload`}
            className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-cream hover:bg-ink/90"
          >
            Upload a different one
          </Link>
          <button
            type="button"
            onClick={onDesign}
            className="sn-press inline-flex min-h-11 items-center rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink hover:bg-ink/10"
          >
            Design one instead
          </button>
        </div>
      </div>
    </section>
  );
}

function LogoStudio({
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
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  /* 🛑 Nothing saves until the couple has touched the studio AND the canvas
     differs from how it stood then — see `lib/maker-logo-save-gate.ts`. */
  const gate = useRef(createLogoSaveGate());
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
      if (!gate.current.shouldSave(m.mark.svg) || inFlight.current) return;
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
          gate.current.saved(m.mark.svg);
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

  /* The couple reaching for the studio — their own pointer, key or typing,
     caught BEFORE the edit lands (capture phase) — records the canvas as it
     stood: the baseline a save must differ from. A script-made event is not
     the couple (`isTrusted`). */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onReach = (e: Event) => {
      if (!e.isTrusted) return;
      const m = currentMark();
      if (m.ok && m.mark.source === 'studio') gate.current.touch(m.mark.svg);
    };
    const REACH = ['pointerdown', 'keydown', 'beforeinput'] as const;
    for (const t of REACH) host.addEventListener(t, onReach, true);
    return () => {
      for (const t of REACH) host.removeEventListener(t, onReach, true);
    };
  }, []);

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

  return (
    <section className="flex min-h-0 flex-1 flex-col" data-made-once="logo" data-maker-logo-page="">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/10 bg-cream px-2 py-1.5 md:px-3">
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
