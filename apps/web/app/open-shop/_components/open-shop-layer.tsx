'use client';

/**
 * ⤴ OPEN A SHOP IS ONE LAYER (final check B1–B3, drawing `prototypes/final-check-area-5_2026-11-25/` § B1 · B2 · B3,
 * approved by the owner 25 Nov). The five steps, "Add your logo" and "Invite shops you trust" draw inside ONE shared
 * layer — the shipped `ShopDoorScreen`: the `RiseScreen` on a phone and a tablet, the large centred form dialog (`Sheet`
 * `page`) from the desktop line. It is mounted by `app/open-shop/layout.tsx`, so it stays up while the steps change
 * underneath it (the layer rises once; a step swaps only its content).
 *
 * THE HEAD carries each step's title and its one line (the drawing: the in-body title went into the head). A step names
 * its head with `useOpenShopHead`; until it does, the head is the one its address implies (`headForPath`), so the first
 * paint already has a title.
 *
 * ✕ leaves to where the person came from (`router.back()`), or Home on a direct visit. A step that has opened the shop
 * (the logo, the invite) names its own way out (`leaveTo`): the shop is open, so ✕ lands on Today like Later and Done.
 *
 * The page's own `<main>` shells and the desktop brand strip are gone; the SETNAYAN line stays above the step bars
 * (owner 25 Nov: keep the 21 Oct "make sure there is Setnayan" rule). 🔒 app/open-shop/one-layer.test.ts
 */
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShopDoorScreen } from '@/app/vendor-dashboard/_components/shop-door-screen';
import { INVITE_SHOPS_HEAD, OPEN_YOUR_SHOP_HEAD } from '@/lib/supplier-onboarding';

export type OpenShopHead = {
  title: string;
  line?: string | null;
  /** The head's own action (the desktop "Have an account? Sign in"). */
  actions?: ReactNode;
  /** Where ✕ lands once the shop is open. Absent: back to where the person came from, or Home. */
  leaveTo?: string | null;
};

const SetHead = createContext<((head: OpenShopHead) => void) | null>(null);

/** The head the address implies, before the step names its own (the first paint). */
export function headForPath(path: string): OpenShopHead {
  if (path.startsWith('/open-shop/logo')) return { title: 'Add your logo' };
  if (path.startsWith('/open-shop/invite')) return { title: INVITE_SHOPS_HEAD[0], line: INVITE_SHOPS_HEAD[1] };
  return { title: OPEN_YOUR_SHOP_HEAD[0], line: OPEN_YOUR_SHOP_HEAD[1] };
}

/** A step names the layer's head (title · line · action · where ✕ lands). Outside the layer it does nothing. */
export function useOpenShopHead(head: OpenShopHead): void {
  const set = useContext(SetHead);
  const { title, line, actions, leaveTo } = head;
  useLayoutEffect(() => {
    set?.({ title, line, actions, leaveTo });
  }, [set, title, line, actions, leaveTo]);
}

/** Home on a direct visit: the history holds nothing of ours before this layer. */
const HOME = '/';

export function OpenShopLayer({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/open-shop';
  const router = useRouter();
  const [head, setHead] = useState<OpenShopHead>(() => headForPath(path));
  const leave = () => {
    if (head.leaveTo) router.replace(head.leaveTo);
    // The layer's own Back entry is already off (the close played); more than the first page and ours means a page
    // the person came from.
    else if (window.history.length > 2) router.back();
    else router.replace(HOME);
  };
  return (
    <SetHead.Provider value={setHead}>
      <ShopDoorScreen
        at="lg"
        page
        fill
        kind="stack"
        title={head.title}
        line={head.line ?? undefined}
        actions={head.actions}
        onClose={leave}
        data="open-shop"
      >
        {children}
      </ShopDoorScreen>
    </SetHead.Provider>
  );
}

/** The same, for a server page: draws nothing, names the head. */
export function OpenShopHeadMark(head: OpenShopHead) {
  useOpenShopHead(head);
  return null;
}
