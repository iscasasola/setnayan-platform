'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Sparkles, Check } from 'lucide-react';
import { readMonogramDraft, clearMonogramDraft, type MonogramDraft } from '@/lib/monogram-studio/draft';
import { saveStudioAction } from './studio-actions';

/**
 * MonogramDraftRestore — the dashboard half of the public→couple carry-through.
 *
 * A couple who designed a monogram on the FREE public studio
 * (setnayan.com/monogram) before signing up gets a "pick up your design" card
 * the first time they open the Monogram maker, restoring it from localStorage.
 * Apply submits the stashed mark + config to the SAME saveStudioAction the
 * studio uses — which re-sanitizes the SVG server-side and enforces couple
 * membership, so a tampered localStorage payload can't become an unsafe or
 * cross-account mark.
 *
 * Shows ONLY when (a) a valid, un-expired draft exists and (b) the event has no
 * custom mark yet (so it never silently competes with a mark the couple already
 * set). Renders nothing otherwise — no layout cost. The preview is an inert
 * data-URI <img> (the saved SVG is pure paths, no webfonts).
 */

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
      {pending ? 'Applying…' : 'Make it my monogram'}
    </button>
  );
}

export function MonogramDraftRestore({ eventId, hasCustomMark }: { eventId: string; hasCustomMark: boolean }) {
  const [draft, setDraft] = useState<MonogramDraft | null>(null);

  useEffect(() => {
    if (hasCustomMark) {
      // A mark is now set — including right after this draft is Applied (the
      // save redirects here with the mark live). The one-shot bridge is done:
      // drop the stash so it can never re-surface (e.g. if the couple later
      // clears their mark and hasCustomMark flips back to false).
      clearMonogramDraft();
      setDraft(null);
    } else {
      setDraft(readMonogramDraft());
    }
  }, [hasCustomMark]);

  if (hasCustomMark || !draft) return null;

  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(draft.svg)}`;

  return (
    <section className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- inert data-URI preview; next/image can't optimise data-URIs */}
          <img src={dataUri} alt="The monogram you designed" className="max-h-full max-w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            From setnayan.com
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Pick up the monogram you designed</h2>
          <p className="mt-1 max-w-prose text-sm text-ink/65">
            You started this on our free studio before signing up. Make it your wedding&rsquo;s official mark — it
            shows on your website, QR codes, and save-the-date.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <form action={saveStudioAction}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="svg" value={draft.svg} />
              <input type="hidden" name="config" value={JSON.stringify(draft.config)} />
              <ApplyButton />
            </form>
            <button
              type="button"
              onClick={() => {
                clearMonogramDraft();
                setDraft(null);
              }}
              className="text-sm font-medium text-ink/55 hover:text-ink"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
