/**
 * 🧪 THE STORE + THE BADGES PAGE, from fixtures (drawing `supplier_store_graphs_badges_2026-11-23` v12).
 * `/dev/supplier-lab?s=store` · `store-tools` · `store-cake` · `store-graphs` · `store-graph` · `store-badges` ·
 * `badges-page` (dispatched through `shop-tab-lab.tsx`). No database: the SAME screens the Store pages mount
 * (`store-screens.tsx`, `badges-list.tsx`), handed the shop-tab lab's sample shop.
 *   default     the shop bought the Cake Maker (Owned); the other paid tools have no catalog price in the lab — "Price
 *               not set yet" (never ₱0).
 *   `&none=1`   a new shop: nothing bought, the default tools.
 *   `&unread=1` every read refused — the honest words.
 * The lab holds no price: a price is the catalog row's, and the lab has no catalog.
 * Dev only (the lab page 404s in production).
 */
import type { ReactNode } from 'react';
import { ToolPage } from '@/app/vendor-dashboard/_components/tool-page';
import { StoreFront, StoreItemScreen, StoreShelfScreen } from '@/app/vendor-dashboard/shop/store/_components/store-screens';
import type { StoreData } from '@/app/vendor-dashboard/shop/store/_components/store-data';
import { BadgesList } from '@/app/vendor-dashboard/shop/_components/badges-list';
import { ToolPin } from '@/app/vendor-dashboard/_components/tool-page';
import type { CardKey } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import type { ShelfTile } from '@/lib/shop-badge-shelf';

export const STORE_LAB_STATES = ['store', 'store-tools', 'store-cake', 'store-graphs', 'store-graph', 'store-badges', 'badges-page'] as const;
export type StoreLabState = (typeof STORE_LAB_STATES)[number];


function labStore(fail: boolean, none: boolean, tiles: ShelfTile[] | null): StoreData {
  const on: CardKey[] = fail ? ['opened', 'asked', 'booked'] : none ? ['opened', 'asked'] : ['opened', 'asked', 'booked', 'reply', 'slow'];
  return {
    layout: fail ? null : { graphs: on, badges: null, tools: none ? null : ['scanner', 'headcount', 'run_of_show'], toolsOff: [] },
    tools: {
      // "none" doubles as the shop that is not Verified yet: its free widgets say "Free once you’re Verified".
      freeOpen: fail ? null : none ? false : true,
      owned: fail ? null : none ? new Set() : new Set(['cake_tool']),
      pending: fail ? null : new Set(),
      planOpen: { cake_tool: false, song_bank: false, papic_challenge: false, plan_3d: false },
      prices: fail ? null : {},
      picked: fail ? null : none ? null : ['scanner', 'headcount', 'run_of_show'],
      toolsOff: [],
      categoryLabels: ['Live Band', 'Photo Booth'],
      services: ['live_band'],
    },
    badges: tiles,
    unlocks: { hidden: new Set(['gifts', 'invites']), locked: [], unsure: [] },
    on,
  };
}

export function StoreLab({ state, fail, none, tiles, bar }: { state: StoreLabState; fail: boolean; none: boolean; tiles: ShelfTile[] | null; bar: ReactNode }) {
  const d = labStore(fail, none, tiles);
  const body =
    state === 'store' ? (
      <StoreFront d={d} />
    ) : state === 'store-tools' ? (
      <StoreShelfScreen shelf="tools" d={d} />
    ) : state === 'store-graphs' ? (
      <StoreShelfScreen shelf="graphs" d={d} />
    ) : state === 'store-badges' ? (
      <StoreShelfScreen shelf="badges" d={d} />
    ) : state === 'store-cake' ? (
      <StoreItemScreen shelf="tools" itemKey="cake_tool" d={d} />
    ) : state === 'store-graph' ? (
      <StoreItemScreen shelf="graphs" itemKey="replyvs" d={d} />
    ) : (
      <>
        <ToolPin route="/vendor-dashboard/shop/badges" title="Badges" sub="Every badge, its seven steps and what is left." />
        <BadgesList tiles={tiles} />
      </>
    );
  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-store-lab={state}>
      <ToolPage name={state}>{body}</ToolPage>
      {bar}
    </div>
  );
}
