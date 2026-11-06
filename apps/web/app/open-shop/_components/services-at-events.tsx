'use client';

import { Check, Info } from 'lucide-react';

import { formatCount } from '@/lib/format-number';
import { eventsForService, offeredAt } from '@/lib/open-shop-more-services';
import type { EventTileOption } from './event-tiles';
import type { PickedService } from './service-cards';

/**
 * ④ WHAT YOU OFFER AT EACH EVENT (prototype v16 `zXEv`; owner 6 Nov: *"when they have services that are not allowed for
 * specific [events] we give a note … or allow them to pick on each event what service do they want"*). One shape
 * covers both: under every TICKED event, the picked services as chips — all on, untick per event ("3 of 4 services");
 * a service that event does not offer (its leaf's `allowedEventTypes`) is greyed with "X isn't offered for ‹event›".
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
  const shown = events.filter((e) => ticked.includes(e.key));
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
        <small className="font-normal" style={{ color: 'var(--m-slate-3)' }}>
          · all on to start — untick what you don’t do there
        </small>
      </span>
      {shown.map((e, i) => {
        const offered = services.filter((s) => offeredAt(allowedOf(s.key), e.key));
        const not = services.filter((s) => !offeredAt(allowedOf(s.key), e.key));
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
              <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                {formatCount(onCount)} of {formatCount(services.length)} {services.length === 1 ? 'service' : 'services'}
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
              {not.map((s) => (
                <span
                  key={s.key}
                  aria-disabled="true"
                  className="inline-flex min-h-9 items-center rounded-full border border-dashed px-3 text-[13.5px] leading-tight"
                  style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-3)' }}
                >
                  {s.label}
                </span>
              ))}
            </div>
            {not.length ? (
              <span className="text-[12.5px]" style={{ color: 'var(--m-slate-3)' }}>
                {not.map((s) => `${s.label} isn’t offered for ${e.label}`).join(' · ')}
              </span>
            ) : null}
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
