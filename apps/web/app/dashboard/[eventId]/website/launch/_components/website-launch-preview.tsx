'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Pencil } from 'lucide-react';

/**
 * WebsiteLaunchPreview — "see what each part looks like", and go straight into
 * the website to change it (owner 2026-06-28 "direct to website").
 *
 * Each phase tab shows a live preview of the couple's own public page (the
 * non-live phases use the host-only `?phase=` override — honored because this
 * host's session rides into the same-origin iframe and the [slug] page verifies
 * host membership before applying the param). The preview itself is a DIRECT
 * gateway: clicking it opens that part in the website editor (the combined
 * editor for "Live", the per-phase editor routes for the others). A secondary
 * "view live" link opens the real public page full-screen.
 */

type PhaseKey = 'live' | 'rsvp' | 'event' | 'editorial';
type Phase = { key: PhaseKey; label: string; caption: string };

// 'live' is the definite fallback (referenced directly so `current` is never
// typed `undefined` under noUncheckedIndexedAccess — no non-null assertion).
const LIVE_PHASE: Phase = {
  key: 'live',
  label: 'Live now',
  caption: 'Your page exactly as anyone you share it with sees it today.',
};

const PHASES: Phase[] = [
  LIVE_PHASE,
  { key: 'rsvp', label: 'Invitation', caption: 'The run-up invitation — your names, the details, and the RSVP.' },
  { key: 'event', label: 'Wedding day', caption: 'The live day-of page guests open on the wedding day itself.' },
  { key: 'editorial', label: 'After', caption: 'The story page guests revisit after the day — photos and highlights.' },
];

/** Live preview URL for a phase — same-origin so the host session + ?phase ride along. */
function viewSrc(publicLandingUrl: string, key: PhaseKey): string {
  return key === 'live' ? publicLandingUrl : `${publicLandingUrl}?phase=${key}`;
}

/** The website-editor route that edits this part directly. "Live" = the combined
 *  editor; the others = their per-phase editor routes (/site-editor/[id]/<phase>). */
function editHref(eventId: string, key: PhaseKey): string {
  return key === 'live' ? `/site-editor/${eventId}` : `/site-editor/${eventId}/${key}`;
}

export function WebsiteLaunchPreview({
  eventId,
  publicLandingUrl,
}: {
  eventId: string;
  publicLandingUrl: string;
}) {
  const [active, setActive] = useState<PhaseKey>('live');
  const current: Phase = PHASES.find((p) => p.key === active) ?? LIVE_PHASE;
  const src = viewSrc(publicLandingUrl, active);
  const edit = editHref(eventId, active);

  return (
    <div className="space-y-3">
      {/* Phase tabs */}
      <div role="tablist" aria-label="Preview each part of your website" className="flex flex-wrap gap-2">
        {PHASES.map((p) => {
          const on = p.key === active;
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(p.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                on
                  ? 'bg-mulberry text-cream shadow-sm'
                  : 'border border-ink/15 bg-cream text-ink/70 hover:border-mulberry/40 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-ink/60">{current.caption}</p>

      {/* Live preview frame — the whole frame is a DIRECT link into the website
          editor for this part (the iframe is pointer-events-none, so the
          covering <Link> takes the click). A hover overlay makes that explicit. */}
      <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <span className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-ink/45 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-cream backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger-400" />
          {active === 'live' ? 'Live preview' : `Previewing · ${current.label}`}
        </span>

        <iframe
          key={`launch-preview-${active}`}
          title={active === 'live' ? 'Live preview of your wedding website' : `Preview of your ${current.label} page`}
          src={src}
          className="pointer-events-none h-[60vh] min-h-[420px] w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
        />

        {/* Direct-to-website: the covering link opens the editor for this part.
            The group/hover overlay surfaces the affordance without hiding the
            preview underneath. */}
        <Link
          href={edit}
          aria-label={`Edit your ${current.label} page in the website editor`}
          className="group absolute inset-0 z-10 flex items-end justify-center bg-ink/0 transition-colors hover:bg-ink/15 focus-visible:bg-ink/15 focus-visible:outline-none"
        >
          <span className="mb-5 inline-flex translate-y-2 items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            Edit this in your website
          </span>
        </Link>

        {/* Secondary: open the real public page full-screen (read, don't edit). */}
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-ink/45 px-3 py-1.5 text-[11px] font-medium text-cream backdrop-blur-sm transition hover:bg-ink/65"
        >
          View live
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </div>

      {/* Explicit primary action under the frame (mobile-friendly — the hover
          overlay isn't reachable on touch). */}
      <Link
        href={edit}
        className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
      >
        <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Edit your {current.label} page
      </Link>
    </div>
  );
}
