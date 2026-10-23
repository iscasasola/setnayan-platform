'use client';

/**
 * home-service-card.tsx — ONE CARD SHAPE FOR EVERY SERVICE ON HOME (owner 2026-10-23: *"just like what we are doing
 * with papic, we want to do the same for these"*; approved `prototypes/home_service_widgets_2026-10-23.html`, "The one
 * card shape").
 *
 *   QUICK VIEW   mark · plain name · brand · the dot lines (the state) · one status line (the one number) · a meter only
 *                where the number has a true total · at most one primary and one secondary action.
 *   OPEN         a tap on the head grows the card IN PLACE (grid-rows 0fr → 1fr, 420 ms, the house ease; reduced motion:
 *                at once) — Home moves down, the address never changes, the ⌄ folds it back. Inside: that service's own
 *                controls, then one quiet door to its full page.
 *   FAILED       a read that failed says so on the dot line, in red, with ⟳ Reload — and nothing else of the card is
 *                drawn: no "Off", no 0, no switch to flip over a refusal.
 *
 * Papic keeps its approved face (`papic-home-card.tsx`) — the same grow, its own lines. Each card's controls are the
 * server's (the service's shipped actions), handed in as `settings`.
 */

import { useId, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, RotateCw } from 'lucide-react';
import { GlanceDot, GlanceLineText, GlanceMeter } from '@/app/_components/service-glance';
import { ActionButton } from '@/components/action-button';
import type { GlanceLine, ServiceMood } from '@/lib/service-glance';

/** One dot line of the quick view — the service's state, in its own words. */
export type HomeCardDotLine = { mood: ServiceMood; words: string; marker?: string };

export function HomeServiceCard({
  name,
  brand,
  icon,
  dots,
  status,
  statusMood = 'plain',
  meter,
  body,
  actions,
  settings,
  door,
  failed = false,
  marker,
}: {
  name: string;
  brand?: string;
  icon: ReactNode;
  /** The state lines, first to last (each with its dot). */
  dots: HomeCardDotLine[];
  /** The one number — absent when the service has none to say. */
  status?: GlanceLine | null;
  statusMood?: ServiceMood;
  /** Only where the number has a true total. */
  meter?: { pct: number; label: string } | null;
  /** A line the quick view carries under the status (a player, a link). */
  body?: ReactNode;
  actions?: ReactNode;
  /** The service's own controls, drawn by the server — revealed under the head. */
  settings?: ReactNode;
  /** The quiet door to the full page, last inside the card. */
  door: { label: string; href: string };
  /** The card's read failed: it says so and draws nothing it does not know. */
  failed?: boolean;
  marker?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const router = useRouter();
  const [reloading, startReload] = useTransition();

  if (failed) {
    return (
      <div className="sg-row" data-mood="gone" data-home-card="failed" {...marker}>
        <span className="sg-head">
          <span className="sg-mark" aria-hidden>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="sg-name block truncate">{name}</span>
            {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
          </span>
        </span>
        <span className="sg-status" data-mood="gone" role="status">
          <GlanceDot mood="gone" />
          <span>Couldn’t load</span>
        </span>
        <div className="sg-acts">
          <ActionButton
            tone="neutral"
            icon={<RotateCw aria-hidden="true" strokeWidth={1.9} className={reloading ? 'animate-spin' : undefined} />}
            label="Reload"
            onClick={() => startReload(() => router.refresh())}
            disabled={reloading}
          />
        </div>
      </div>
    );
  }

  const grows = settings != null;
  const head = (
    <>
      <span className="sg-head">
        <span className="sg-mark" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="sg-name block truncate">{name}</span>
          {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
        </span>
        {grows ? (
          <ChevronDown
            aria-hidden
            className={`sg-arrow h-[18px] w-[18px] transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            strokeWidth={1.9}
          />
        ) : (
          <ChevronRight aria-hidden className="sg-arrow h-[18px] w-[18px]" strokeWidth={1.9} />
        )}
      </span>
      {dots.map((d, i) => (
        <span key={i} className="sg-status" data-mood={d.mood} data-home-card-dot={d.marker ?? ''}>
          <GlanceDot mood={d.mood} />
          <span>{d.words}</span>
        </span>
      ))}
      {status ? (
        <span className="sg-status" data-mood={statusMood} data-glance-status="">
          <span>
            <GlanceLineText line={status} />
          </span>
        </span>
      ) : null}
      {meter ? <GlanceMeter mood={statusMood === 'plain' ? 'ok' : statusMood} pct={meter.pct} label={meter.label} /> : null}
    </>
  );

  return (
    <div className="col-span-full flex min-w-0 flex-col" data-home-card={open ? 'open' : 'rest'}>
      <div className="sg-row" data-mood={statusMood} {...marker}>
        {/* THE HEAD — its one press grows the card in place (never another page); a card with nothing to grow is a door. */}
        {grows ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={regionId}
            onClick={() => setOpen((v) => !v)}
            className="block w-full min-w-0 text-left"
            data-home-card-head=""
          >
            {head}
          </button>
        ) : (
          <Link href={door.href} className="block min-w-0" data-home-card-head="">
            {head}
          </Link>
        )}
        {body}
        {actions ? <div className="sg-acts">{actions}</div> : null}
        {grows ? (
          /* THE SERVICE'S OWN CONTROLS, INSIDE THE CARD'S FRAME (prototype frame 2: the card itself grows) — the height
             grows, they fade in; folded, they are inert. */
          <div
            id={regionId}
            role="region"
            aria-label={`${name} settings`}
            inert={!open}
            data-home-card-settings={open ? 'open' : 'closed'}
            className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${
              open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-3 flex flex-col gap-4 border-t border-ink/10 pt-2">
                <div className="divide-y divide-ink/10">{settings}</div>
                <Link href={door.href} className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-ink/65 hover:text-ink" data-home-card-door="">
                  {door.label}
                  <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** One row inside an open card: its words, its ⓘ line, and its one control on the right. */
export function HomeCardRow({ label, hint, control, marker }: { label: string; hint?: string | null; control?: ReactNode; marker?: string }) {
  return (
    <div className="flex items-center gap-3 py-3" data-home-card-row={marker ?? ''}>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        {hint ? <span className="block text-[12.5px] text-ink/60">{hint}</span> : null}
      </span>
      {control}
    </div>
  );
}
