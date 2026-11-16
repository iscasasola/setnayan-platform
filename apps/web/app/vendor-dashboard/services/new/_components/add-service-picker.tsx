'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2, Layers, RotateCw } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { ServicePicker, type PickerParentView } from '@/app/_components/service-picker';
import {
  CoverageMeter,
  Specialties,
  placeIndex,
  type SpecialtyField,
  type SpecialtyPicks,
} from '@/app/open-shop/_components/service-cards';
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
 *   · 🏷 SPECIALTIES BELONG TO EACH SERVICE (prototype `makers_match_2026-11-07` §2): "+ Specialties (optional)" under
 *     every picked service — the sign-up's own chips (`Specialties`, the service's own schema). Nothing is picked for
 *     them, nothing blocks Make N cards; the picks ride to THAT service's card (`lib/card-queue.ts`), pre-ticked in its
 *     Details fold, and are saved only with that card;
 *   · 📏 THE PLAN METER — the sign-up's own line (`CoverageMeter`): the shop's services plus the new ones, the plan that
 *     holds them named from `TIER_CAPS` (never a typed number). A meter, not a gate — nothing here refuses a pick;
 *   · 🔒 HONEST READS — if the shop's own services could not be read (`onShop === null`) the picker is NOT drawn: it
 *     says so, with Try again, rather than offer what may already be on the shop as if nothing were there. If the tree
 *     could not be read (`tree` empty — the live taxonomy is never empty) it says so too, never a blank picker.
 *
 * The blank maker stays one press away ("Start a blank card"), and opens straight away when the supplier came from a
 * quote (`startOnMaker`) — that door is "make a card and come back", not "choose services".
 */
export function AddServicePicker({
  tree,
  specialties = {},
  onShop,
  maker,
  startOnMaker = false,
}: {
  tree: PickerParentView[];
  /** Each service's own specialty questions (`getServicePickerSpecialties`) — none = no "+ Specialties" on it. */
  specialties?: Record<string, SpecialtyField[]>;
  /** Service keys that already have a card on this shop — `null` = that read was refused (said, never shown as none). */
  onShop: readonly string[] | null;
  /** The shipped Card Maker, drawn — the blank-card door. */
  maker: ReactNode;
  startOnMaker?: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<{ key: string; label: string; path: string }[]>([]);
  const [showMaker, setShowMaker] = useState(startOnMaker);
  const [going, setGoing] = useState(false);
  const [picks, setPicks] = useState<SpecialtyPicks>({});
  const [openSpecialty, setOpenSpecialty] = useState<string | null>(null);
  const onShopSet = useMemo(() => new Set(onShop ?? []), [onShop]);
  const places = useMemo(() => placeIndex(tree), [tree]);
  const pickedSet = useMemo(() => new Set(picked.map((p) => p.key)), [picked]);
  const pathOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of tree) for (const b of p.branches) for (const l of b.leaves) m.set(l.canonicalService, `${p.label} › ${b.label}`);
    return m;
  }, [tree]);
  const full = picked.length >= CARD_QUEUE_MAX;

  if (showMaker) return <div data-add-service-maker="">{maker}</div>;

  const blankCard = (
    <p className="flex flex-wrap items-center gap-2 pt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
      Not on the list?
      <ActionButton tone="neutral" icon={FilePlus2} label="Start a blank card" onClick={() => setShowMaker(true)} data-testid="add-service-blank-card" />
    </p>
  );
  /** A read that failed: the words, Try again (re-reads the page), and the blank card one press away. Never a blank picker. */
  const unread = (words: string, data: Record<string, string>) => (
    <div className="mx-auto grid w-full max-w-xl gap-3" data-add-service-picker="" {...data}>
      <p className="text-[15px]" role="alert" style={{ color: 'rgb(var(--color-danger))' }}>
        {words}
      </p>
      <span>
        <ActionButton
          tone="neutral"
          icon={RotateCw}
          label="Try again"
          onClick={() =>
            // one-render: keep (retry) — nothing was written here; a read failed and Try again re-asks for it.
            router.refresh()
          }
          data-testid="add-service-try-again"
        />
      </span>
      {blankCard}
    </div>
  );
  // 🔒 The tree is read first: without it there is nothing to pick from. The live taxonomy is never empty, so an empty
  // tree is a read that failed (`getServicePickerTree` fails soft to []).
  if (tree.length === 0) return unread('Couldn’t load the list of services. Try again.', { 'data-add-service-tree-unread': '' });
  // 🔒 The shop's own services unread: never draw the picker as if the shop had none.
  if (onShop === null) return unread('Couldn’t load your services. Try again.', { 'data-add-service-on-shop-unread': '' });

  const remove = (key: string) => {
    setPicked((all) => all.filter((x) => x.key !== key));
    setPicks((all) => {
      if (!(key in all)) return all;
      const next = { ...all };
      delete next[key];
      return next;
    });
    if (openSpecialty === key) setOpenSpecialty(null);
  };
  /** The meter's list: what is already on the shop, then the new picks — each under its own category. */
  const meterList = [...onShop, ...picked.map((p) => p.key)].map((key) => {
    const at = places.get(key);
    return { categoryId: at?.categoryId ?? key, categoryLabel: at?.categoryLabel ?? key };
  });

  const make = () => {
    const href = cardMakerQueueHref(
      picked.map((p) => p.key),
      picks,
    );
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
                    onDelete={() => remove(p.key)}
                    // ONE remove control: while this service's specialties are open, their bar carries the red Remove
                    // (prototype `fvBlock`: ⌃ Specialties · Remove · ✓ Done), so the computer's hover trash steps aside.
                    // The phone's swipe stays.
                    hover={openSpecialty !== p.key}
                    radiusClass="rounded-none"
                    surfaceClass="bg-[var(--m-paper)]"
                  >
                    <div className="grid min-h-[50px] gap-1.5 px-3.5 py-2.5" data-add-service-picked-row={p.key}>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]" style={{ color: 'var(--m-ink)' }}>
                          {p.label}
                        </span>
                        <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
                          {p.path}
                        </span>
                      </span>
                      {/* 🏷 THIS service's own specialties — optional, the sign-up's chips. */}
                      {specialties[p.key]?.length ? (
                        <Specialties
                          service={{ key: p.key, label: p.label }}
                          fields={specialties[p.key]!}
                          picks={picks}
                          onPicksChange={setPicks}
                          open={openSpecialty === p.key}
                          onOpen={setOpenSpecialty}
                          onRemove={remove}
                        />
                      ) : null}
                    </div>
                  </SwipeToDelete>
                </li>
              ))}
            </ul>
          </div>
          <CoverageMeter list={meterList} />
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

      {picked.length === 0 && meterList.length > 0 ? <CoverageMeter list={meterList} /> : null}

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

      {blankCard}
    </div>
  );
}
