'use client';

/**
 * papic-home-card.tsx — PAPIC ON HOME: one head with its ON/OFF switch, and the camera settings opening UNDER it.
 *
 * Owner 2026-10-26, on the Home card: *"name it Papic and not Guest Photos."* · *"the gallery should not be there."* ·
 * *"it just needs to have a quick on off button and expand for more settings for papic"* — superseding the 2026-10-23/24
 * quick view (coverage · credits meter · the latest five · Add more) and the phone's own closed tile face.
 *
 *   CLOSED   the head only — the camera mark · "Papic" (small line "Guest photos") · the Papic switch · › to expand.
 *            Nothing else: no coverage, no credits, no meter, no photos, no Add more.
 *   OPEN     a tap on the head reveals the camera settings directly under it, inline — the height grows and the
 *            settings fade in (420 ms, the house ease; reduced motion: at once). No navigation, no overlay, the address
 *            does not change; the head (⌄) folds it back. Credits, Add more and the dates live in the settings; after
 *            the day, the Thank-You Video door is the open card's first row.
 *
 * ONE card, everywhere (owner ruling 2026-10-24): Home on the phone and the desktop, and the Papic page, which draws it
 * open. The settings are the server's (`PapicCameraSettings`), handed in as `settings`.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Clapperboard } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { PapicCardPhase } from '@/lib/papic-home-card';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';

export function PapicHomeCard({
  name,
  brand,
  icon,
  phase,
  thankYouHref,
  settings,
  marker,
  defaultOpen = false,
  headControl = null,
}: {
  name: string;
  brand?: string;
  icon: ReactNode;
  /** Where the capture window stands — after the day, the open card leads with the Thank-You Video door. */
  phase: PapicCardPhase | null;
  /** The Thank-You Video door, offered after the day (null: not offered). */
  thankYouHref?: string | null;
  /** The camera settings, drawn by the server — revealed under the head. */
  settings: ReactNode;
  marker?: Record<string, string>;
  /** Open on arrival — the Papic page draws this same card, open (owner ruling 2026-10-24: one card, everywhere). */
  defaultOpen?: boolean;
  /**
   * The Papic ON/OFF switch, in the head beside the › — shown closed AND open (owner 2026-10-26: "a quick on off
   * button"). A SIBLING of the head's button, never inside it (a switch in a button is invalid HTML).
   */
  headControl?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // 🔒 ONE OPEN AT A TIME on Home (owner-approved 2026-10-24): opening Papic closes the service open before.
  const oneOpenId = useOneOpen(open, setOpen);
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
    <div ref={root} className="col-span-full flex min-w-0 scroll-mt-20 flex-col md:col-span-1" data-papic-home-card={open ? 'open' : 'rest'}>
      <OneOpenScope id={oneOpenId}>
        <div className="sg-row relative" {...marker}>
          {/* THE SWITCH — in the head, closed and open, over the head's right edge beside the ›. */}
          {headControl ? (
            <div className="absolute right-12 top-[7px] z-[1] [&_[data-form-row-name]]:sr-only [&_[data-form-row]]:!min-h-0 [&_[data-form-row]]:!p-0" data-papic-head-switch="">
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
            data-tour="home-papic-card"
          >
            <span className="sg-head">
              <span className="sg-mark" aria-hidden>
                {icon}
              </span>
              <span className={`min-w-0 ${headControl ? 'pr-16' : ''}`}>
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
          </button>

          {/* THE SETTINGS, INSIDE THE CARD'S OWN FRAME — the height grows, the settings fade in; folded, they are inert. */}
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
              {/* After the day, the Thank-You Video door leads the open card (it lived on the closed card until 2026-10-26). */}
              {phase === 'after' && thankYouHref ? (
                <div className="sg-acts" data-papic-thank-you="">
                  <ActionButton tone="brand" icon={<Clapperboard aria-hidden="true" strokeWidth={1.9} />} label="Thank-You Video" href={thankYouHref} />
                </div>
              ) : null}
              <div className="pt-4">{settings}</div>
            </div>
          </div>
        </div>
      </OneOpenScope>
    </div>
  );
}
