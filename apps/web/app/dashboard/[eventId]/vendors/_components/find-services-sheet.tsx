'use client';

/**
 * find-services-sheet.tsx — "SERVICES TO SHOW", the ✎ on an open category's row (owner 2026-10-29: *"on the suppliers
 * find, we want an edit icon as well. pop up will show to uncheck services they do not want to see"*; then *"just start
 * with all checked. and they just uncheck or check anything. search result will not update until … pressed done"*;
 * then *"we only show services with counts. hide them if there is none"*). Prototype `find-scale-proto` v4.4–v4.5.
 *
 *   · One row per service that HAS cards, its count beside it ("36 cards") — a service with none is not listed.
 *   · Opens as last applied (all ticked the first time). Ticks are a DRAFT: the list behind does not move.
 *   · "Tick all" ticks every box and applies nothing. "Done" applies — and only Done; closing any other way (the dim
 *     area, ✕, Esc, the phone's Back) drops the draft. Nothing is asked of the server either way: the category's cards
 *     are already on the page.
 *
 * v4.11 (owner 2026-10-29, *"Maybe we can combine the services and inspiration to 1 popup?"*): the sheet is titled by
 * the CATEGORY, sub-line "What to show", a search on top ("Search services and looks"), and each service is a PARENT
 * row with a slot under it for its looks. 💡 Since 2026-11-06 (reorg R5, "INSPIRATION LIVES IN SUPPLIERS › FIND") the
 * slot holds them: the parts the service supplies (`inspiration_part_services`) that hold the couple's photos, each with
 * its count (`looksForService`, `lib/find-inspiration.ts`), nested in `data-find-looks` and greyed while the service is
 * unticked. A look is shown, not ticked — the ticks stay the services' (the count still says cards only).
 *
 * Built from the house pieces only: the shared `Sheet` (frame, backdrop, Back, focus) and the house `TickBox`.
 */
import { useEffect, useId, useState } from 'react';
import { Sheet } from '@/app/_components/sheet';
import { TickBox } from '@/app/[slug]/_components/tick-box';
import { ActionButton } from '@/components/action-button';
import { Check, CheckCheck, Search } from 'lucide-react';
import { cardsWord, type FindService } from '@/lib/find-service-cards';
import { looksForService, partCountLine, type FindInspiration } from '@/lib/find-inspiration';

export function FindServicesSheet({
  open,
  category,
  listed,
  hidden,
  onDone,
  onClose,
  inspiration = null,
}: {
  open: boolean;
  /** The category's name — the sheet's second line. */
  category: string;
  /** The services with cards, each with its count (`servicesWithCards`). */
  listed: readonly { service: FindService; count: number }[];
  /** The services hidden NOW (as last applied). */
  hidden: readonly string[];
  /** Done — the services to hide from now on. */
  onDone: (hidden: string[]) => void;
  /** Any other way out — nothing changes. */
  onClose: () => void;
  /** 💡 The couple's inspiration board — each service's looks nest under it (`data-find-looks`). */
  inspiration?: FindInspiration | null;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState<ReadonlySet<string>>(() => new Set(hidden));
  const [find, setFind] = useState('');
  // Every opening starts from what is applied — a draft dropped by a dismiss never comes back.
  useEffect(() => {
    if (open) {
      setDraft(new Set(hidden));
      setFind('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const toggle = (key: string) =>
    setDraft((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <Sheet open={open} onClose={onClose} labelledById={titleId} rise>
      <div className="px-5 pb-[calc(1rem+var(--sn-safe-b,0px))] pt-5" data-find-services-sheet="">
        <h2 id={titleId} className="pr-12 text-[17px] font-semibold text-ink">
          {category}
        </h2>
        <p className="mt-0.5 text-[13px] text-ink/70">What to show</p>
        {listed.length > 4 ? (
          // A long list is searched, never scrolled through blind. Short ones need no box.
          <label className="mt-3 flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-cream px-3.5">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-ink/70" strokeWidth={1.9} />
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Search services and looks"
              aria-label="Search services and looks"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/45"
            />
          </label>
        ) : null}
        {listed.length === 0 ? (
          // The counts could not be read — said plainly; a service is hidden only for a real zero (owner 2026-10-29).
          <p role="status" className="mt-3 text-[14px] text-ink/70" data-find-services-unread="">
            We couldn&rsquo;t read this category&rsquo;s services — reload in a moment.
          </p>
        ) : null}
        <ul className="mt-3">
          {listed
            .filter(({ service }) => {
              const q = find.trim().toLowerCase();
              if (!q) return true;
              // "Search services and looks" — a service is found by its own name or by one of its looks'.
              return service.label.toLowerCase().includes(q) || looksForService(inspiration, service.key).some((l) => l.label.toLowerCase().includes(q));
            })
            .map(({ service, count }) => {
            const id = `${titleId}-${service.key}`;
            const looks = looksForService(inspiration, service.key);
            return (
              <li key={service.key} className="flex min-h-[52px] flex-wrap items-center gap-1 border-t border-ink/10 first:border-t-0" data-find-service-row="">
                <TickBox
                  press="-ml-3"
                  id={id}
                  checked={!draft.has(service.key)}
                  onChange={() => toggle(service.key)}
                  data-find-service={service.key}
                />
                <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-3 py-3">
                  <span className="text-[15px] font-medium text-ink">{service.label}</span>
                  <span className="shrink-0 text-[13px] text-ink/70">{cardsWord(count)}</span>
                </label>
                {/* 💡 Its looks — the parts this service supplies that hold the couple's photos, greyed while the service
                    is unticked (v4.11, owner 2026-10-29: *"combine the services and inspiration to 1 popup"*). */}
                {looks.length > 0 ? (
                  <ul
                    className={`mb-2 ml-9 flex w-full flex-wrap gap-1.5 ${draft.has(service.key) ? 'opacity-40' : ''}`}
                    data-find-looks={service.key}
                  >
                    {looks.map((l) => (
                      <li key={l.slotKey} className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[12.5px] text-ink/75" data-find-look={l.slotKey}>
                        {l.label} · {partCountLine(l.count)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex items-center justify-end gap-2">
          {listed.length > 0 ? <ActionButton tone="neutral" icon={CheckCheck} label="Tick all" onClick={() => setDraft(new Set())} data-testid="find-services-all" /> : null}
          <ActionButton
            tone="brand"
            main
            icon={Check}
            label="Done"
            data-testid="find-services-done"
            onClick={() => {
              // Hiding every service would leave an empty list that looks like "nobody" — Done with none ticked
              // shows them all again, the only reading of "none" that is not a false empty.
              const next = listed.map((l) => l.service.key).filter((k) => draft.has(k));
              onDone(next.length >= listed.length ? [] : next);
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}
