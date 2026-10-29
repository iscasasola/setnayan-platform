'use client';

import { useId, useState } from 'react';
import { Sheet } from '@/app/_components/sheet';
import { eventsCountLabel, type EventsByKind } from '@/lib/shop-events-by-kind';

/**
 * "120+ events ›" on the shop page — a tap shows the total by kind (owner 2026-10-30, OWNER-NOTES item 114:
 * *"count events and clicking it will show what kind of events total"*). The counting is `lib/shop-events-by-kind.ts`;
 * this only draws it. The ones done through Setnayan are receipt-backed and are the same rows the Track record lists.
 */
export function EventsByKindButton({ events, shopName }: { events: EventsByKind; shopName: string }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const label = eventsCountLabel(events);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label} — see what kind`}
        data-shop-events-by-kind=""
        className="inline-flex min-h-[44px] items-center font-medium text-link hover:underline"
      >
        {label} ›
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} title={label} rise>
        <div className="space-y-4 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
          <h2 id={headingId} className="sr-only">
            {label} by kind
          </h2>
          <dl className="divide-y divide-ink/10">
            {events.kinds.map((k) => (
              <div key={k.key || 'event'} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <dt className="text-sm font-medium text-ink">{k.label}</dt>
                <dd className="text-right text-sm text-ink">
                  {k.count.toLocaleString('en-PH')}
                  {k.atLeast ? '+' : ''}
                  {k.viaSetnayan > 0 ? (
                    <span className="text-ink/55"> · {k.viaSetnayan.toLocaleString('en-PH')} through Setnayan</span>
                  ) : null}
                </dd>
              </div>
            ))}
            <div className="flex min-h-12 items-center justify-between gap-3 py-2">
              <dt className="text-sm font-semibold text-ink">Total</dt>
              <dd className="text-sm font-semibold text-ink">
                {events.total.toLocaleString('en-PH')}
                {events.atLeast ? '+' : ''}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-relaxed text-ink/60">
            {events.kinds.some((k) => k.atLeast)
              ? `The wedding count is ${shopName}’s own. `
              : null}
            {events.viaSetnayan > 0
              ? `The ${events.viaSetnayan.toLocaleString('en-PH')} done through Setnayan are receipt-backed and listed under Track record.`
              : 'None were done through Setnayan yet.'}
          </p>
        </div>
      </Sheet>
    </>
  );
}
