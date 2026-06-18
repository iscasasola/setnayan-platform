'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Undo2, Wand2 } from 'lucide-react';
import type { StudioConfig } from '@/lib/monogram-studio-shared';
import { mountStudio } from '@/lib/monogram-studio/engine';
import { STUDIO_HTML, STUDIO_CSS } from '@/lib/monogram-studio/markup';
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

  useEffect(() => {
    let alive = true;
    let api: StudioApi | null = null;
    (async () => {
      try {
        const [paperMod, offsetMod, otMod] = await Promise.all([
          import('paper'),
          import('paperjs-offset'),
          import('opentype.js'),
        ]);
        if (!alive || !rootRef.current) return;
        const paper: any = (paperMod as any).default ?? paperMod;
        const off: any = offsetMod as any;
        const PaperOffset = off.PaperOffset ?? off.default?.PaperOffset ?? off.default ?? off;
        const ot: any = otMod as any;
        const opentype = ot.parse ? ot : (ot.default ?? ot);
        api = mountStudio({ root: rootRef.current, paper, opentype, PaperOffset, initialConfig, initialNames }) as StudioApi;
        apiRef.current = api;
        setReady(true);
      } catch {
        if (rootRef.current) {
          const load = rootRef.current.querySelector<HTMLElement>('#load');
          if (load) load.textContent = 'Could not start the studio.';
        }
      }
    })();
    return () => {
      alive = false;
      try {
        api?.destroy();
      } catch {
        /* noop */
      }
      apiRef.current = null;
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
      className="vsroot scroll-mt-24 space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-7"
    >
      <style dangerouslySetInnerHTML={{ __html: STUDIO_CSS }} />

      <header className="space-y-1.5">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
          <Wand2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Vector studio
        </p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Design your mark from scratch</h2>
        <p className="max-w-prose text-sm text-ink/65">
          Your real initials, freely composed — drag to move, pinch to size, twist to rotate, weave or merge
          where they cross, and frame them with a mirrored pen. Save it and it becomes your monogram everywhere:
          your dashboard, QR codes, wedding website, and save-the-date.
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-terracotta/30 bg-terracotta/10 text-terracotta-700'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      {hasStudio ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
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

      <div ref={rootRef} className="vs" dangerouslySetInnerHTML={{ __html: STUDIO_HTML }} />

      {exportError ? <p className="text-sm text-terracotta-700">{exportError}</p> : null}

      <form action={saveStudioAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="svg" ref={svgRef} />
        <input type="hidden" name="config" ref={cfgRef} />
        <SaveButton onArm={armSubmit} />
        <span className="text-xs text-ink/55">{ready ? 'Saved as a crisp vector — it scales to any size.' : 'Starting the studio…'}</span>
      </form>
    </section>
  );
}
