'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus, createPortal } from 'react-dom';
import { Check, Undo2, Wand2 } from 'lucide-react';
import type { StudioConfig } from '@/lib/monogram-studio-shared';
import { mountStudio } from '@/lib/monogram-studio/engine';
import { STUDIO_HTML, STUDIO_CSS } from '@/lib/monogram-studio/markup';
import { STUDIO_HTML_V2, STUDIO_CSS_V2 } from '@/lib/monogram-studio/markup-v2';
import { monogramStudioV2Enabled } from '@/lib/monogram-studio/flag';
import { GoldMonogramReveal } from '@/app/_components/gold-monogram-reveal';
import { MoltenMonogramInline } from '@/app/_components/molten-monogram-inline';
import { StudioRevealPlayer, type StudioAnim } from '@/app/_components/studio-reveal-player';
import type { StudioAnimKind } from '@/lib/monogram-studio-shared';
import { saveStudioAction, clearStudioAction } from './studio-actions';

/**
 * VectorStudio — the couple's Vector Monogram Studio (Phase 5 of the monogram
 * overhaul). Real font outlines, directly manipulated (drag · pinch · twist),
 * interlocked with true booleans (per-crossing Combine / Cut / Delete), framed
 * with a mirrored fountain-pen, and stamped with vector symbols. Everything is
 * vector — the saved mark is PURE PATHS, so "Save as my monogram" writes the
 * single canonical events.monogram_custom_svg that every Setnayan surface reads
 * (chrome icon, QR centre, landing hero, save-the-date, PDFs, social cards).
 *
 * The editor DOM + styling are the verified prototype (injected as inert HTML);
 * the imperative paper.js/opentype.js engine (monogram-studio-engine) runs
 * against it after a client-only dynamic import (so paper.js never touches the
 * server render). Save reads the engine's tight-viewBox export + re-editable
 * config into the hidden form, posted to the sanitizing server action.
 */


type StudioApi = { getExport: () => { svg: string; config: StudioConfig } | null; destroy: () => void };

function SaveButton({ onArm }: { onArm: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      onClick={onArm}
      disabled={pending}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
      {pending ? 'Saving…' : 'Save as my monogram'}
    </button>
  );
}

export function VectorStudio({
  eventId,
  initialConfig,
  initialNames,
  hasStudio,
  notice,
}: {
  eventId: string;
  initialConfig: StudioConfig | null;
  /** The event's initials (e.g. "A & B") — seeds a FIRST design so the editor
   *  opens on the couple's mark, not the built-in "Maria & Juan" placeholder. */
  initialNames: string | null;
  hasStudio: boolean;
  notice: { tone: 'ok' | 'error'; text: string } | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<StudioApi | null>(null);
  const svgRef = useRef<HTMLInputElement>(null);
  const cfgRef = useRef<HTMLInputElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // gold/molten reveal preview — the engine can't render React components on its
  // paper.js canvas, so it calls onPreviewKind and we portal the REAL shipping
  // component (GoldMonogramReveal / MoltenMonogramInline) over the canvas. This is
  // WYSIWYG with the live surfaces (same components). null = canvas kinds (no overlay).
  const [previewKind, setPreviewKind] = useState<StudioAnimKind | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewAnim, setPreviewAnim] = useState<StudioAnim | null>(null);
  const [swEl, setSwEl] = useState<HTMLElement | null>(null);

  // The portal preview auto-dismisses after the reveal has finished + settled,
  // returning the canvas — the preview is a moment, not a mode.
  useEffect(() => {
    if (!previewKind || !previewAnim) return;
    const t = window.setTimeout(
      () => {
        setPreviewKind(null);
        setPreviewSvg(null);
        setPreviewAnim(null);
      },
      Math.round(previewAnim.dur * 1000) + 4500,
    );
    return () => window.clearTimeout(t);
  }, [previewKind, previewAnim]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Idempotency guard — never inject two engines into one live root.
    if (apiRef.current) return;
    let alive = true;
    let api: StudioApi | null = null;
    // The editor DOM is built imperatively here (NOT via React
    // dangerouslySetInnerHTML) so React never owns or re-touches this subtree.
    //
    // Why this matters in PRODUCTION (not just dev StrictMode): when the markup
    // was a `dangerouslySetInnerHTML={{ __html: STUDIO_HTML }}` prop, React's
    // reconciler re-applies that prop whenever its object reference changes — and
    // an inline `{{ __html }}` literal is a NEW object every render. So an
    // ordinary re-render (e.g. this effect's own setReady(true)) re-set the
    // host's innerHTML, re-creating the #cv/#load/#names nodes. The engine's
    // async boot (a font fetch) then resolved against the now-DETACHED nodes it
    // had captured — hiding a detached overlay + drawing on a detached canvas,
    // so the VISIBLE editor sat stuck on "Loading the typeface…" with a blank
    // canvas while the name still wrote to the surviving input. Owning the markup
    // imperatively removes the subtree from React's vdom entirely, so no re-render
    // can clobber the engine's nodes. (The engine also self-guards its async
    // callbacks via a `destroyed` flag for the unmount-mid-fetch case.)
    // monogram_studio_v2 (council verdict §2): the flag picks which editor DOM
    // is injected — v1 stays byte-identical when OFF. NEXT_PUBLIC_, so the
    // value is inlined at build time and identical on server + client.
    root.innerHTML = monogramStudioV2Enabled() ? STUDIO_HTML_V2 : STUDIO_HTML;
    // The canvas wrapper (.sw2) is the portal host for the gold/molten overlay.
    setSwEl(root.querySelector<HTMLElement>('.sw2'));
    // Safety net: if the engine/typeface never finishes (a hung dynamic import or
    // font fetch), don't sit on "Loading the typeface…" forever.
    const failTimer = window.setTimeout(() => {
      if (!alive || apiRef.current) return;
      const load = root.querySelector<HTMLElement>('#load');
      if (load) {
        load.classList.remove('off');
        load.textContent = 'Still loading — please refresh the page.';
      }
    }, 15000);
    (async () => {
      try {
        const [paperMod, offsetMod, otMod] = await Promise.all([
          import('paper'),
          import('paperjs-offset'),
          import('opentype.js'),
        ]);
        if (!alive) return;
        const paper: any = (paperMod as any).default ?? paperMod;
        const off: any = offsetMod as any;
        const PaperOffset = off.PaperOffset ?? off.default?.PaperOffset ?? off.default ?? off;
        const ot: any = otMod as any;
        const opentype = ot.parse ? ot : (ot.default ?? ot);
        api = mountStudio({
          root,
          paper,
          opentype,
          PaperOffset,
          initialConfig,
          initialNames,
          // Universal portal preview (benchmark §3): EVERY reveal kind renders
          // the identical live-site player over the canvas; null clears it.
          portalPreview: true,
          appFrame: true,
          onPreviewKind: (kind: StudioAnimKind | null, svg: string | null, animInfo?: StudioAnim) => {
            if (!alive) return;
            setPreviewKind(kind);
            setPreviewSvg(svg);
            setPreviewAnim(animInfo ?? null);
          },
        }) as StudioApi;
        apiRef.current = api;
        setReady(true);
        window.clearTimeout(failTimer);
      } catch {
        window.clearTimeout(failTimer);
        const load = root.querySelector<HTMLElement>('#load');
        if (load) load.textContent = 'Could not start the studio.';
      }
    })();
    return () => {
      alive = false;
      window.clearTimeout(failTimer);
      try {
        api?.destroy();
      } catch {
        /* noop */
      }
      apiRef.current = null;
      root.innerHTML = '';
    };
    // Mount once — initialConfig is the first-render value (re-edit a saved mark).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function armSubmit(e: React.MouseEvent<HTMLButtonElement>) {
    const res = apiRef.current?.getExport();
    if (!res || !res.svg) {
      e.preventDefault();
      setExportError('Add at least one initial before saving.');
      return;
    }
    if (svgRef.current) svgRef.current.value = res.svg;
    if (cfgRef.current) cfgRef.current.value = JSON.stringify(res.config);
    setExportError(null);
  }

  return (
    <section
      id="vector-studio"
      className="vsroot scroll-mt-24 space-y-4"
    >
      <style dangerouslySetInnerHTML={{ __html: monogramStudioV2Enabled() ? STUDIO_CSS_V2 : STUDIO_CSS }} />

      <header className="space-y-1.5">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
          <Wand2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Vector studio
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Design your mark from scratch</h2>
        <p className="max-w-prose text-sm text-ink/65">
          Your real initials, freely composed — drag to move, resize with the gold handle, weave or merge
          where they cross, and frame them with a mirrored pen. Save it and it becomes your monogram everywhere:
          your dashboard, QR codes, wedding website, and save-the-date.
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

      {hasStudio ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-success-800">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
            This studio mark is your active monogram.
          </p>
          <form action={clearStudioAction}>
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
            >
              <Undo2 aria-hidden className="h-3 w-3" strokeWidth={2} />
              Remove
            </button>
          </form>
        </div>
      ) : null}

      {/* The editor markup is injected imperatively by the effect (see above), so
          React leaves this container empty and never re-touches the subtree. */}
      <div ref={rootRef} className="vs" />

      {/* Gold/Molten reveal preview — portaled over the paper.js canvas (.sw2) on
          the reveal's own dark stage so the metal reads. The SAME shipping
          components render here and on the live website (WYSIWYG). Ways out:
          the ✕ below, switching Arrange/Draw (engine clears via onPreviewKind),
          or picking a canvas kind (handwriting/trace/droplet). */}
      {swEl && previewKind
        ? createPortal(
            <div
              className="absolute inset-0 z-[5]"
              style={{
                // metal reveals stage on dark; draw-on reveals keep the paper
                background:
                  previewKind === 'molten' || previewKind === 'flip3d' || previewKind === 'gold'
                    ? 'radial-gradient(120% 90% at 50% 32%, #2b2638 0%, #14111c 58%, #0a0810 100%)'
                    : '#FBFBFA',
              }}
            >
              {previewKind === 'molten' ? (
                <MoltenMonogramInline markSvg={previewSvg} monogram={initialNames ?? 'M & J'} />
              ) : previewKind === 'gold' && !previewAnim ? (
                <GoldMonogramReveal markSvg={previewSvg} monogram={initialNames ?? 'M & J'} inline />
              ) : (
                <div className="absolute inset-[8%]">
                  <StudioRevealPlayer
                    key={`${previewKind}-${previewAnim?.dur ?? 0}-${previewAnim?.delay ?? 0}`}
                    svg={previewSvg}
                    monogram={initialNames ?? 'M & J'}
                    anim={previewAnim ?? { kind: previewKind, dur: 6, smooth: 0.9, delay: 0.3 }}
                    allowWebgl={false}
                  />
                </div>
              )}
              <button
                type="button"
                aria-label="Close the reveal preview"
                onClick={() => {
                  setPreviewKind(null);
                  setPreviewSvg(null);
                  setPreviewAnim(null);
                }}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-base leading-none text-white/85 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
            </div>,
            swEl,
          )
        : null}

      {exportError ? <p className="text-sm text-terracotta-700">{exportError}</p> : null}

      {/* v2 (§2.3): the save form rides a bottom-sticky bar on phones so "Save
          as my monogram" is always a thumb away — desktop and v1 stay static.
          React territory, outside the inert editor subtree. */}
      <form
        action={saveStudioAction}
        className={
          monogramStudioV2Enabled()
            ? 'sticky bottom-20 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none'
            : 'flex flex-wrap items-center gap-3'
        }
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="svg" ref={svgRef} />
        <input type="hidden" name="config" ref={cfgRef} />
        <SaveButton onArm={armSubmit} />
        <span className="text-xs text-ink/55">{ready ? 'Saved as a crisp vector — it scales to any size.' : 'Starting the studio…'}</span>
      </form>
    </section>
  );
}
