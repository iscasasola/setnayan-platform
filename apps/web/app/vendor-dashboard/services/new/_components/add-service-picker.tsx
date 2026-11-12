'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, Layers } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { ServicePicker, type PickerParentView } from '@/app/_components/service-picker';
import { cardMakerQueueHref, CARD_QUEUE_MAX } from '@/lib/card-queue';
import { countNoun } from '@/lib/format-number';

/**
 * ➕ ADD A SERVICE — THE ONE PICKER (ruling 5820, owner Nov 2026).
 *
 * The dashboard's "New service" draws the SAME picker `/open-shop` draws (`app/_components/service-picker.tsx`):
 * search with the reviewed aliases and "Close matches — did you mean", the category photo tiles, a category's services
 * as rows, a one-service category added on the tap. What this door adds, and only this door:
 *
 *   · the services ALREADY ON YOUR SHOP (a card of that service exists) are shown in the rows, marked "On your shop",
 *     and are not pickable twice (`onShop`);
 *   · the picks gather above the picker as rows (the house swipe removes one), and ONE "Make N cards" opens the shipped
 *     Card Maker for the first, the rest queued behind it (`lib/card-queue.ts`) — each card is made, priced and saved by
 *     the supplier exactly as before; nothing is written for a card they have not made;
 *   · per-service Specialties stay OPTIONAL — each card's Details fold asks them, as it always has.
 *
 * The blank maker stays one press away ("Start a blank card"), and opens straight away when the supplier came from a
 * quote (`startOnMaker`) — that door is "make a card and come back", not "choose services".
 */
export function AddServicePicker({
  tree,
  onShop,
  maker,
  startOnMaker = false,
}: {
  tree: PickerParentView[];
  /** Service keys that already have a card on this shop. */
  onShop: readonly string[];
  /** The shipped Card Maker, drawn — the blank-card door. */
  maker: ReactNode;
  startOnMaker?: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<{ key: string; label: string; path: string }[]>([]);
  const [showMaker, setShowMaker] = useState(startOnMaker || tree.length === 0);
  const [going, setGoing] = useState(false);
  const onShopSet = useMemo(() => new Set(onShop), [onShop]);
  const pickedSet = useMemo(() => new Set(picked.map((p) => p.key)), [picked]);
  const pathOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of tree) for (const b of p.branches) for (const l of b.leaves) m.set(l.canonicalService, `${p.label} › ${b.label}`);
    return m;
  }, [tree]);
  const full = picked.length >= CARD_QUEUE_MAX;

  if (showMaker) return <div data-add-service-maker="">{maker}</div>;

  const make = () => {
    const href = cardMakerQueueHref(picked.map((p) => p.key));
    if (!href) return;
    setGoing(true);
    router.push(href);
  };

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3" data-add-service-picker="">
      <p className="text-[15px] text-ink/70">Pick what you offer. Each one becomes its own card.</p>

      {picked.length > 0 ? (
        <div className="grid gap-2" data-add-service-picked={picked.map((p) => p.key).join(',')}>
          {/* No box (lint:no-card): the picks are rows between two hairlines, the picker's own row grammar. */}
          <div>
            <ul className="divide-y border-y" style={{ borderColor: 'var(--m-line)' }}>
              {picked.map((p) => (
                <li key={p.key}>
                  <SwipeToDelete
                    label={`Remove ${p.label}`}
                    word="Remove"
                    onDelete={() => setPicked((all) => all.filter((x) => x.key !== p.key))}
                    radiusClass="rounded-none"
                    surfaceClass="bg-[var(--m-paper)]"
                  >
                    <div className="flex min-h-[50px] items-center px-3.5 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]" style={{ color: 'var(--m-ink)' }}>
                          {p.label}
                        </span>
                        <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
                          {p.path}
                        </span>
                      </span>
                    </div>
                  </SwipeToDelete>
                </li>
              ))}
            </ul>
          </div>
          <ActionButton
            tone="brand"
            main
            icon={Layers}
            label={`Make ${countNoun(picked.length, 'card', 'cards')}`}
            onClick={make}
            waiting={going}
            data-testid="add-service-make-cards"
          />
          {full ? (
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              That is as many as one press makes — make these, then add more.
            </p>
          ) : null}
        </div>
      ) : null}

      {full ? null : (
        <ServicePicker
          tree={tree}
          excludeServices={pickedSet}
          onShop={onShopSet}
          onPick={(leaf) =>
            setPicked((all) =>
              all.some((x) => x.key === leaf.canonicalService) || onShopSet.has(leaf.canonicalService)
                ? all
                : [...all, { key: leaf.canonicalService, label: leaf.label, path: pathOf.get(leaf.canonicalService) ?? '' }],
            )
          }
        />
      )}

      <p className="flex flex-wrap items-center gap-2 pt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Not on the list?
        <ActionButton tone="neutral" icon={FilePlus2} label="Start a blank card" onClick={() => setShowMaker(true)} data-testid="add-service-blank-card" />
      </p>
    </div>
  );
}
