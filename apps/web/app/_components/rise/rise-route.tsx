'use client';

/**
 * ⤴ A PAGE THAT RISES — the ONE `RiseScreen` around a page reached by a soft tap (owner 2026-11-10 *"fullscreen
 * everything"*; build-sessions/RISE-AUDIT-2026-11-13.md § H, batch 3).
 *
 * An intercepted route (`@rise/(.)<page>`) draws the SAME page inside this wrapper, over the page you were on, which
 * never unmounts — so ✕ falls back into the row you tapped and the page under it keeps its scroll. A hard load of the
 * URL is not intercepted and draws the full page, as it always did.
 *
 * Two Back entries, in order: `RiseScreen`'s own (✕ · Esc · the phone's Back pop it, then the fall plays), then the
 * route's — popped here with `router.back()` once the fall has finished. A tab re-tap closes the screen WITHOUT popping
 * ours (RiseScreen's `sn:tab-reselect`), so then both entries go at once (`history.go(-2)`) and the page under it is the
 * page again; a tab that navigates instead lands on its own page, and the slot's catch-all clears the slot.
 * 🔒 app/_components/rise/the-rise-screen-is-one-full-screen.test.ts § 7
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { ShopDoorScreen } from '@/app/vendor-dashboard/_components/shop-door-screen';
import type { RiseKind } from '@/lib/rise-screen';

/**
 * True inside a risen page (either frame). A page that also loads whole (a hard load: no ✕) keeps its own "‹ Back" link
 * and hides it here, where ✕ is the way out — `BackWhenNotRisen` reads it. Final check B8.
 */
const InRiseRoute = createContext(false);

/**
 * ‹ A SECTION THAT OPENS IN PLACE names the risen screen's head while it is open: its title over the screen's own name,
 * and ‹ in ✕'s place (final check B9 — "Tell us what you do" inside the card maker; one level, never a popup on a
 * popup). `null` puts the screen's own head back. Outside a risen page there is no head to name: null.
 */
export type RiseHeadOverride = { title: string; back: { label: string; onBack: () => void } };
const RiseRouteHead = createContext<{ title: string; set: (head: RiseHeadOverride | null) => void } | null>(null);
export function useRiseRouteHead() {
  return useContext(RiseRouteHead);
}

/** True inside a page risen by `RiseRoute` — the phone's full screen AND the dialog from 701 (`BackWhenNotRisen`). */
export function useInRiseRoute(): boolean {
  return useContext(InRiseRoute);
}

/** `useBackCloses`' mark on the history entry it pushes (lib/use-back-closes.ts). */
const LAYER_MARK = 'snLayer';

export function RiseRoute({
  title,
  line,
  data,
  kind,
  page = false,
  children,
}: {
  title: string;
  line?: string;
  data: string;
  /** The full-screen map's kind for this page (`RiseScreen`'s `kind`). */
  kind?: RiseKind;
  /**
   * 🖥 From the supplier dashboard's 701 line, the large centred dialog (`ShopDoorScreen` `page` → `Sheet` `page`) over
   * the page you were on, instead of full screen — the service card maker (final check B8, drawing
   * `final-check-area-5_2026-11-25.html` § B8). Default false: every risen page as shipped.
   */
  page?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const leave = () => {
    const st = window.history.state as Record<string, unknown> | null;
    // Our own entry is still on top: closed by a tab re-tap, not by ✕ / Back — step over both entries at once.
    if (st?.[LAYER_MARK]) window.history.go(-2);
    else router.back();
  };
  const [over, setOver] = useState<RiseHeadOverride | null>(null);
  const body = (
    <InRiseRoute.Provider value>
      <RiseRouteHead.Provider value={{ title, set: setOver }}>{children}</RiseRouteHead.Provider>
    </InRiseRoute.Provider>
  );
  // An open section's head: its title over this screen's own name, ‹ in ✕'s place.
  const headTitle = over ? over.title : title;
  const headLine = over ? title : line;
  if (page) {
    return (
      <ShopDoorScreen page title={headTitle} line={headLine} back={over?.back} onClose={leave} data={data} kind={kind}>
        {body}
      </ShopDoorScreen>
    );
  }
  return (
    <RiseScreen title={headTitle} line={headLine} back={over?.back} onClose={leave} data={data} kind={kind}>
      {body}
    </RiseScreen>
  );
}
