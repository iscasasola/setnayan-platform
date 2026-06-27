'use client';

import { useState } from 'react';
import { ArrowUpRight, MonitorPlay } from 'lucide-react';

/**
 * WebsiteLaunchPreview — the "see what each part of your website looks like"
 * panel on the Launch surface (/dashboard/[eventId]/website/launch).
 *
 * Mirrors the site-editor's per-phase preview (owner 2026-06-11 "can you always
 * preview that?") but standalone: a row of phase tabs over a live preview iframe
 * of the couple's own public page. Each non-live tab loads the page with the
 * host-only `?phase=` override — honored because this host's session rides into
 * the same-origin iframe and the [slug] page verifies host membership before
 * applying the param (a guest can never force a phase). "Live" shows the real
 * page as it stands today (whatever phase the calendar resolves).
 *
 * The iframe is pointer-events-none (it's a preview, not an interactive editor —
 * editing lives in the full site editor); an "Open in new tab" link lets the
 * couple view any phase full-screen.
 */

type PhaseKey = 'live' | 'rsvp' | 'event' | 'editorial';

const PHASES: { key: PhaseKey; label: string; caption: string }[] = [
  { key: 'live', label: 'Live now', caption: 'Your page exactly as anyone you share it with sees it today.' },
  { key: 'rsvp', label: 'Invitation', caption: 'The run-up invitation — your names, the details, and the RSVP.' },
  { key: 'event', label: 'Wedding day', caption: 'The live day-of page guests open on the wedding day itself.' },
  { key: 'editorial', label: 'After', caption: 'The story page guests revisit after the day — photos and highlights.' },
];

function srcFor(publicLandingUrl: string, key: PhaseKey): string {
  return key === 'live' ? publicLandingUrl : `${publicLandingUrl}?phase=${key}`;
}

export function WebsiteLaunchPreview({ publicLandingUrl }: { publicLandingUrl: string }) {
  const [active, setActive] = useState<PhaseKey>('live');
  const current = PHASES.find((p) => p.key === active) ?? PHASES[0];
  const src = srcFor(publicLandingUrl, active);

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

      {/* Live preview frame */}
      <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <span className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-ink/45 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-cream backdrop-blur-sm">
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
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink/45 px-3 py-1.5 text-[11px] font-medium text-cream backdrop-blur-sm transition hover:bg-ink/65"
        >
          Open {current.label} full-screen
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink/45">
        <MonitorPlay aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        This is a preview. To edit any part, open your website editor.
      </p>
    </div>
  );
}
