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

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Clapperboard } from 'lucide-react';
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
  defaultOpen = false,
  headControl = null,
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
  /** Open on arrival — the Papic page draws this same card, open (owner ruling 2026-10-24: one card, everywhere). */
  defaultOpen?: boolean;
  /**
   * The Papic main switch, in the card's head beside the ⌄ (owner 2026-10-24). A SIBLING of the head's button, never
   * inside it (a switch in a button is invalid HTML), placed over the head's right edge.
   */
  headControl?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();
  const root = useRef<HTMLDivElement>(null);
  // 🔗 An old link to the retired Papic page lands on Home as `?papic=open` (owner 2026-10-24: "the controller page is
  // retired; its contents live inside the expanded card"): the card opens itself, scrolls into view, and the address
  // goes back to Home's own — opening never navigates.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('papic') !== 'open') return;
      setOpen(true);
      url.searchParams.delete('papic');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      /* no window history — stay as drawn */
    }
  }, []);

  return (
    <div ref={root} className="col-span-full flex min-w-0 scroll-mt-20 flex-col" data-papic-home-card={open ? 'open' : 'rest'}>
      <div className="sg-row relative" data-mood={mood} {...marker}>
        {/* The switch shows with the card OPEN (the approved sketch: closed › · open [switch] ⌄). Folded, it is not drawn. */}
        {headControl && open ? (
          <div className="absolute right-12 top-3.5 z-[1] [&_[data-form-row-name]]:sr-only [&_[data-form-row]]:!min-h-0 [&_[data-form-row]]:!p-0" data-papic-head-switch="">
            {headControl}
          </div>
        ) : null}
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
            <span className={`min-w-0 ${headControl && open ? 'pr-16' : ''}`}>
              <span className="sg-name block truncate">{name}</span>
              {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
            </span>
            {/* › turns to ⌄ as the card grows in place (owner 2026-10-24). */}
            <ChevronRight
              aria-hidden
              className={`sg-arrow h-[18px] w-[18px] transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
              strokeWidth={1.9}
            />
          </span>
          {/* THE QUICK VIEW folds away as the card opens — open, the controller below says the same facts in full
              (owner 2026-10-24: "the same card collapsed and expanded, not two drawings"). */}
          <span className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} data-papic-quick-view={open ? 'folded' : 'shown'}>
          <span className="block min-h-0 overflow-hidden">
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
          </span>
          </span>
        </button>

        <div className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`} inert={open}>
          <div className="min-h-0 overflow-hidden">
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
        </div>
        {/* THE SETTINGS, INSIDE THE CARD'S OWN FRAME (the approved controller: "the card's own frame expands") — the
            height grows, the settings fade in; folded, they are inert. */}
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
            <div className="pt-4">{settings}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
