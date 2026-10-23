'use client';

/**
 * papic-home-card.tsx — PAPIC ON HOME: the quick view, and the camera settings opening UNDER it (owner 2026-10-23:
 * *"a smaller widget on home. Then we can expand it"* → *"does not open to a new page. just expands on home"* →
 * *"expanding opens the rest of the settings under it not open a new page"*; approved
 * `prototypes/papic_controller_one_page_2026-10-23.html`, "Home — the Papic widget").
 *
 *   QUICK VIEW   the shipped Papic row (name · status · the credits meter) + two lines: the coverage ("Fri, Dec 11 →
 *                Sun, Dec 13, 12 noon" · "Open now → …" · "Closed …") and the latest five photos with "See all ›",
 *                which opens the event's MEMORIES tab (Papic is the camera, Memories the photos) — and Add more (the
 *                same sheet); after the day, Thank-You Video.
 *   OPEN         a tap on the card's head reveals the camera settings directly under it, inline on Home — the
 *                height grows and the settings fade in (420 ms, the house ease; reduced motion: at once). No
 *                navigation, no overlay, the address does not change; the head (⌃) folds it back.
 *
 * The settings themselves are the server's (`PapicCameraSettings` — the same component `/studio/papic` draws), handed
 * in as `settings`. A failed photo read says so; it never draws an empty strip.
 */

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Clapperboard } from 'lucide-react';
import { GlanceDot, GlanceLineText, GlanceMeter } from '@/app/_components/service-glance';
import { ActionButton } from '@/components/action-button';
import type { GlanceLine, ServiceMood } from '@/lib/service-glance';
import type { PapicCardPhase } from '@/lib/papic-home-card';


export function PapicHomeCard({
  name,
  brand,
  icon,
  mood,
  pct,
  line,
  meterLabel,
  coverage,
  phase,
  strip,
  actions,
  thankYouHref,
  settings,
  marker,
}: {
  name: string;
  brand?: string;
  icon: ReactNode;
  mood: ServiceMood;
  pct: number;
  line: GlanceLine;
  meterLabel: string;
  /** The coverage in words (`papicCoverageWords`) — null when the window cannot be read. */
  coverage: string | null;
  phase: PapicCardPhase | null;
  /** The latest five and the count (`PapicCardStrip`, streamed) — null when the viewer may not see the photos. */
  strip: ReactNode;
  /** Add more (the shipped sheet) — and anything else the row already offers. */
  actions?: ReactNode;
  /** After the day, the Thank-You Video door replaces Add more (null: not offered). */
  thankYouHref?: string | null;
  /** The camera settings, drawn by the server — revealed under the card. */
  settings: ReactNode;
  marker?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const regionId = useId();

  return (
    <div className="flex flex-col" data-papic-home-card={open ? 'open' : 'rest'}>
      <div className="sg-row" data-mood={mood} {...marker}>
        {/* THE HEAD — the card's one press: it opens the settings under the card, never another page. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((v) => !v)}
          className="block w-full min-w-0 text-left"
          data-papic-card-head=""
        >
          <span className="sg-head">
            <span className="sg-mark" aria-hidden>
              {icon}
            </span>
            <span className="min-w-0">
              <span className="sg-name block truncate">{name}</span>
              {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
            </span>
            <ChevronDown
              aria-hidden
              className={`sg-arrow h-[18px] w-[18px] transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
              strokeWidth={1.9}
            />
          </span>
          {coverage ? (
            <span className="sg-status" data-mood={phase === 'live' ? 'ok' : 'plain'} data-papic-coverage="">
              <GlanceDot mood={phase === 'live' ? 'ok' : phase === 'after' ? 'plain' : 'wait'} />
              <span>{coverage}</span>
            </span>
          ) : null}
          <span className="sg-status" data-mood={mood} data-glance-status="">
            {mood !== 'plain' ? <GlanceDot mood={mood} /> : null}
            <span>
              <GlanceLineText line={line} />
            </span>
          </span>
          <GlanceMeter mood={mood} pct={pct} label={meterLabel} />
        </button>

        {/* THE LATEST FIVE — "See all ›" opens Memories (the photos live there). Drawn by the server, streamed. */}
        {strip}

        {phase === 'after' && thankYouHref ? (
          <div className="sg-acts">
            <ActionButton tone="brand" icon={<Clapperboard aria-hidden="true" strokeWidth={1.9} />} label="Thank-You Video" href={thankYouHref} />
          </div>
        ) : actions ? (
          <div className="sg-acts">{actions}</div>
        ) : null}
      </div>

      {/* THE SETTINGS, UNDER THE CARD — the height grows, the settings fade in; folded, they are inert. */}
      <div
        id={regionId}
        role="region"
        aria-label="Papic settings"
        inert={!open}
        data-papic-home-settings={open ? 'open' : 'closed'}
        className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-5">{settings}</div>
        </div>
      </div>
    </div>
  );
}
