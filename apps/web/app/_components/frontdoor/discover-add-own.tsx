'use client';

/**
 * DiscoverAddOwn — the last row of Discover's search when nothing matched: "＋ Add “…” as your own supplier"
 * (owner 2026-10-24: *"So it searches what we already have … or add my own new supplier's service card manually that
 * i can give the supplier itself"*; *"the add manually is the one with QR"*).
 *
 * NOTHING HERE IS NEW. It is the Suppliers page's own door, copied:
 *   · the row is `SearchAddRow` — the same button the Suppliers and Guests searches end with;
 *   · "What they do" first — ONE dropdown (`PickMenu`) in a `Sheet`, the Suppliers page's "Add your own" ask, byte
 *     for byte in shape (its list is the event's own scope, `readAddOwnCategories`);
 *   · then the SHIPPED `AddYourOwnWalk`, name filled in: step 1 checks Setnayan by name ("Is it one of these?"),
 *     step 4 is the supplier's link and QR, with Download and Copy link.
 * In place — a sheet over Discover, never a page. When the walk is done the results re-read, so the supplier just
 * added is the answer to the same search ("Your own supplier · on …").
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/app/_components/sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { AddYourOwnWalk } from '@/app/dashboard/[eventId]/_components/add-your-own-walk';
import { SearchAddRow } from '@/components/search-add-row';

type Category = { category: string; tile: string; label: string; group?: string };

export function DiscoverAddOwn({
  query,
  eventId,
  eventName,
  categories,
}: {
  query: string;
  eventId: string;
  eventName: string;
  /** The event's "What they do" list (`readAddOwnCategories`) — one entry per row. */
  categories: readonly Category[];
}) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [picked, setPicked] = useState<Category | null>(null);
  return (
    <div className="fd-grid" data-discover-add-own="">
      <SearchAddRow className="col-span-full" query={query} as="your own supplier" onAdd={() => setAsk(true)} />
      {ask && typeof document !== 'undefined'
        ? createPortal(
            <Sheet open onClose={() => setAsk(false)} labelledById="discover-add-own-ask" title="Add your own">
              <div className="space-y-3 px-1 pb-4">
                <p id="discover-add-own-ask" className="text-sm text-ink/70">
                  What they do · for {eventName}
                </p>
                <PickMenu
                  label="What they do"
                  value={null}
                  buttonText="Pick a category"
                  dataAttr="data-add-own-category"
                  stickyGroups
                  options={categories.map((c) => ({ key: c.tile, label: c.label, group: c.group }))}
                  onPick={(tile) => {
                    setAsk(false);
                    setPicked(categories.find((c) => c.tile === tile) ?? null);
                  }}
                  className="w-full border border-ink/15"
                />
              </div>
            </Sheet>,
            document.body,
          )
        : null}
      {picked ? (
        <AddYourOwnWalk
          eventId={eventId}
          category={picked.category}
          tile={picked.tile}
          categoryLabel={picked.label}
          initialName={query}
          categories={categories}
          onClose={() => setPicked(null)}
          // The record exists — re-read the results behind the link step, so the answer is there on Done.
          onRecorded={() => router.refresh()}
          onDone={(outcome) => {
            setPicked(null);
            if (outcome.kind === 'asked') router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
