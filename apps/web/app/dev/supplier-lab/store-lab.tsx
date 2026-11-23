/**
 * 🧪 THE STORE + THE BADGES PAGE, from fixtures (drawing `supplier_store_graphs_badges_2026-11-23` v12).
 * `/dev/supplier-lab?s=store` · `store-tools` · `store-cake` · `store-song` · `store-papic` · `store-3d` · `store-graphs` ·
 * `store-graph` · `store-badges` · `badges-page` (dispatched through `shop-tab-lab.tsx`). No database: the SAME screens the Store pages mount
 * (`store-screens.tsx`, `badges-list.tsx`), handed the shop-tab lab's sample shop.
 *   default     the 30-day trial is running (24 days left) — every paid tool reads "Free trial · 24 days left".
 *   `&none=1`   a new shop: no trial, no catalog price yet — paid tools read "Price not set yet" (never ₱0).
 *   `&unread=1` every read refused — the honest words.
 * `store-song` · `store-papic` · `store-3d` are the three paid tools' items; their "Open the demo" opens the same
 * demo screen the Store does (`tool-demos.tsx`), on `lib/store-tool-demos.ts`'s sample — nothing to read or write.
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

export const STORE_LAB_STATES = ['store', 'store-tools', 'store-cake', 'store-song', 'store-papic', 'store-3d', 'store-graphs', 'store-graph', 'store-badges', 'badges-page'] as const;
export type StoreLabState = (typeof STORE_LAB_STATES)[number];

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-23T12:00:00+08:00');

function labStore(fail: boolean, none: boolean, tiles: ShelfTile[] | null): StoreData {
  const on: CardKey[] = fail ? ['opened', 'asked', 'booked'] : none ? ['opened', 'asked'] : ['opened', 'asked', 'booked', 'reply', 'slow'];
  return {
    layout: fail ? null : { graphs: on, badges: null, tools: none ? null : ['scanner', 'headcount', 'run_of_show'], toolsOff: [] },
    tools: {
      owned: fail ? null : new Set(),
      pending: fail ? null : new Set(),
      trialEndsAt: fail ? 'unread' : none ? null : new Date(NOW + 24 * DAY).toISOString(),
      planOpen: { cake_tool: false, song_bank: false, papic_challenge: false, plan_3d: false },
      prices: fail ? null : {},
      picked: fail ? null : none ? null : ['scanner', 'headcount', 'run_of_show'],
      toolsOff: [],
      categoryLabels: ['Live Band', 'Photo Booth'],
      services: ['live_band'],
      nowMs: NOW,
    },
    badges: tiles,
    unlocks: { hidden: new Set(['gifts', 'invites']), locked: [], unsure: [] },
    on,
    shopName: 'SetnaProd',
  };
}

/** The paid tools' items in the lab, by state. */
const LAB_TOOL_ITEM: Partial<Record<StoreLabState, string>> = { 'store-cake': 'cake_tool', 'store-song': 'song_bank', 'store-papic': 'papic_challenge', 'store-3d': 'plan_3d' };

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
    ) : LAB_TOOL_ITEM[state] ? (
      <StoreItemScreen shelf="tools" itemKey={LAB_TOOL_ITEM[state]!} d={d} />
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
