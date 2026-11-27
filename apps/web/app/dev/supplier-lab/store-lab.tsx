/**
 * 🧪 THE STORE + THE BADGES PAGE, from fixtures (drawing `supplier_store_graphs_badges_2026-11-23` v12).
 * `/dev/supplier-lab?s=store` · `store-tools` · `store-cake` · `store-graphs` · `store-graph` · `store-badges` ·
 * `badges-page` · 🧩 `store-plans` · `store-av` · `store-plan` (installed, the plan editor) · `store-plan-new` ·
 * `store-av-item` (dispatched through `shop-tab-lab.tsx`). No database: the SAME screens the Store pages mount
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

export const STORE_LAB_STATES = ['store', 'store-tools', 'store-cake', 'store-graphs', 'store-graph', 'store-badges', 'badges-page', 'store-plans', 'store-av', 'store-plan', 'store-plan-new', 'store-av-item'] as const;

/** 🧩 The lab's installed template: "Reserve with 20%", saved as the shop's plan, on two cards. */
const LAB_PLAN_ID = '0f000000-0000-4000-8000-000000000020';
export type StoreLabState = (typeof STORE_LAB_STATES)[number];


function labStore(fail: boolean, none: boolean, tiles: ShelfTile[] | null): StoreData {
  const on: CardKey[] = fail ? ['opened', 'asked', 'booked'] : none ? ['opened', 'asked'] : ['opened', 'asked', 'booked', 'reply', 'slow'];
  return {
    layout: fail
      ? null
      : {
          graphs: on,
          badges: null,
          tools: none ? null : ['scanner', 'headcount', 'run_of_show'],
          toolsOff: [],
          qrs: null,
          templates: none ? { pay: {}, av: [] } : { pay: { reserve_20: LAB_PLAN_ID }, av: ['order_14'] },
        },
    tools: {
      // "none" doubles as the shop that is not Verified yet: its free widgets say "Free once you’re Verified".
      freeOpen: fail ? null : none ? false : true,
      owned: fail ? null : none ? new Set() : new Set(['cake_tool']),
      pending: fail ? null : new Set(),
      subscribed: true,
      prices: fail ? null : {},
      picked: fail ? null : none ? null : ['scanner', 'headcount', 'run_of_show'],
      toolsOff: [],
      categoryLabels: ['Live Band', 'Photo Booth'],
      services: ['live_band'],
      cards: fail ? null : ['live_band', 'photo_booth'],
    },
    badges: tiles,
    unlocks: { hidden: new Set(['gifts', 'invites']), locked: [], unsure: [] },
    on,
    plans: fail
      ? { status: 'unread' }
      : {
          status: 'ok',
          plans: none
            ? []
            : [
                {
                  id: LAB_PLAN_ID,
                  name: 'Reserve with 20%',
                  cardCount: 2,
                  items: [
                    { seq: 0, label: 'Reservation', amount_kind: 'percent', percent: 20, amount_php: null, due_anchor: 'on_lock', due_offset_days: 0, cancellation_terms: null, downpayment_non_refundable: false, refund_window_days: null, no_show_forfeit: false },
                    { seq: 1, label: 'Final balance', amount_kind: 'percent', percent: 80, amount_php: null, due_anchor: 'before_event', due_offset_days: 7, cancellation_terms: null, downpayment_non_refundable: false, refund_window_days: null, no_show_forfeit: false },
                  ],
                },
              ],
        },
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
    ) : state === 'store-plans' ? (
      <StoreShelfScreen shelf="payment_plans" d={d} />
    ) : state === 'store-av' ? (
      <StoreShelfScreen shelf="availability" d={d} />
    ) : state === 'store-plan' ? (
      <StoreItemScreen shelf="payment_plans" itemKey="reserve_20" d={d} />
    ) : state === 'store-plan-new' ? (
      <StoreItemScreen shelf="payment_plans" itemKey="deposit_monthly" d={d} />
    ) : state === 'store-av-item' ? (
      <StoreItemScreen shelf="availability" itemKey="order_14" d={d} />
    ) : (
      <>
        <ToolPin route="/vendor-dashboard/shop/badges" title="Badges" sub="Every badge, its seven steps and what is left." />
        <BadgesList tiles={tiles} />
      </>
    );
  return (
    <div className="min-h-screen bg-cream pb-40 text-ink" data-store-lab={state}>
      {/* The front takes the body's width, as the page does (final check B12); the other screens keep the column. */}
      {state === 'store' ? <div className="mx-auto w-full px-4 pb-16 sm:px-6" data-tool-page="store">{body}</div> : <ToolPage name={state}>{body}</ToolPage>}
      {bar}
    </div>
  );
}
