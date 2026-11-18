'use client';

import { Check, Info } from 'lucide-react';

import { Count } from '@/components/count';
import { formatCount } from '@/lib/format-number';
import { eventsForService, offeredAt } from '@/lib/open-shop-more-services';
import type { EventTileOption } from './event-tiles';
import type { PickedService } from './service-cards';

/**
 * The event types a set of picked services can serve — the ones at least one of them is offered for (prototype v19
 * `shownEvents`; owner 7 Nov: *"the event that is not compatible to what they picked should not show as well"*). With
 * nothing picked, every event. The wizard keeps its full ticked set, so a service added later brings its events back
 * ticked.
 */
export function eventsTheyCanServe(
  events: readonly EventTileOption[],
  services: readonly PickedService[],
  allowedOf: (key: string) => string[] | null,
): EventTileOption[] {
  if (!services.length) return [...events];
  return events.filter((e) => services.some((s) => offeredAt(allowedOf(s.key), e.key)));
}

/**
 * ④ WHAT YOU OFFER AT EACH EVENT (prototype v16 `zXEv`, v19). Under every TICKED event, the picked services it TAKES as
 * chips — all on, untick per event ("2 of 2 services"). v19 (owner 7 Nov): inside each event, only the services offered
 * there — no greyed chips, no "isn't offered" lines; the count is of the offered ones. An event none of the services is
 * offered for is not drawn at all (the tiles above drop it too — `eventsTheyCanServe`).
 *
 * `off[event]` = the services unticked under that event. A service left on for NO ticked event is refused by Continue
 * (and by the server), and the sentence under the list names it.
 */
export function ServicesAtEvents({
  events,
  ticked,
  services,
  allowedOf,
  off,
  onOffChange,
  refused,
}: {
  events: EventTileOption[];
  ticked: string[];
  services: PickedService[];
  allowedOf: (key: string) => string[] | null;
  off: Record<string, string[]>;
  onOffChange: (next: Record<string, string[]>) => void;
  /** Continue was refused for a service on no event — say which. */
  refused: boolean;
}) {
  if (!services.length || !ticked.length) return null;
  const shown = events
    .filter((e) => ticked.includes(e.key))
    .map((e) => ({ e, offered: services.filter((s) => offeredAt(allowedOf(s.key), e.key)) }))
    .filter((x) => x.offered.length > 0);
  if (!shown.length) return null;
  const dead = services.filter((s) => eventsForService(s.key, allowedOf(s.key), ticked, off).length === 0);
  const toggle = (event: string, key: string) => {
    const cur = off[event] ?? [];
    const next = { ...off, [event]: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] };
    if (!next[event]!.length) delete next[event];
    onOffChange(next);
  };
  return (
    <div className="grid gap-0 pt-1" data-open-shop-services-at-events="">
      <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        What you offer at each event{' '}
        <small className="font-normal" style={{ color: 'var(--m-slate-2)' }}>
          · untick what you don’t do there
        </small>
      </span>
      {shown.map(({ e, offered }, i) => {
        const onCount = offered.filter((s) => !(off[e.key] ?? []).includes(s.key)).length;
        return (
          <div
            key={e.key}
            className={`grid gap-1.5 pb-2 pt-2.5 ${i ? 'border-t' : ''}`}
            style={{ borderColor: 'var(--m-line)' }}
            data-open-shop-event-services={e.key}
          >
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                {e.label}
              </b>
              <span className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                <Count value={onCount} id={`open-shop-ev-${e.key}`} /> of {formatOffered(offered.length)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Your services at ${e.label}`}>
              {offered.map((s) => {
                const on = !(off[e.key] ?? []).includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(e.key, s.key)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-left text-[13.5px] leading-tight"
                    style={
                      on
                        ? { background: 'var(--m-orange-4)', borderColor: 'var(--m-orange-3)', color: 'var(--m-orange-deep)', fontWeight: 500 }
                        : { background: 'var(--m-paper)', borderColor: 'var(--m-line)', color: 'var(--m-ink)' }
                    }
                  >
                    {on ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> : null}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {refused && dead.length ? (
        <span
          id="open-shop-err-extras"
          className="flex items-start gap-1.5 text-xs"
          style={{ color: 'var(--m-mulberry-deep)' }}
          role="alert"
          data-open-shop-field-error="extras"
        >
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>
            {dead.map((s) => s.label).join(', ')} {dead.length === 1 ? 'isn’t' : 'aren’t'} on for any event you picked —
            tick an event where it is offered, or remove it.
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** "2 services" — the offered count's word (the count itself is drawn by `Count`). */
function formatOffered(n: number): string {
  return `${formatCount(n)} ${n === 1 ? 'service' : 'services'}`;
}
