'use client';

/**
 * ‹ TELL US WHAT YOU DO, IN PLACE (final check B9, drawing `final-check-area-5_2026-11-25.html` § B9, approved 25 Nov).
 *
 * Wraps the card maker. Opening it (`useTellUs().open()` — the maker's "Ask us" row and its reason sentence) hides the
 * maker WITHOUT unmounting it — every field typed there stays — remembers where the maker was scrolled, and draws the
 * three steps in the same layer: no popup on a popup (Add 1; RiseScreen is one level). While it is open the layer's head
 * reads "‹ Tell us what you do" over the screen's own name (`useRiseRouteHead`); ‹ steps back one step, and from step 1
 * back to the maker, at the same scroll. On a hard load (no risen layer) the section draws that ‹ row itself.
 *
 * The old address `/vendor-dashboard/services/requests/new` forwards here (`?tell=1`, with its group / tile / error), so
 * every way in — the Services page's links, a request's error, a bookmark — opens the maker with this section open.
 * 🔒 app/vendor-dashboard/services/requests/tell-us-opens-in-place.test.ts
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { useRiseRouteHead } from '@/app/_components/rise/rise-route';
import type { RequestGroup } from '@/lib/service-requests.server';
import { TellUsWhatYouDoView, type TellUsAt } from './tell-us-view';

export const TELL_US_TITLE = 'Tell us what you do';

const TellUs = createContext<{ open: () => void } | null>(null);

/** The maker's door: inside a host, `open()` draws the steps in place; outside one, null (the link navigates). */
export function useTellUs() {
  return useContext(TellUs);
}

/** The nearest box that scrolls (the risen layer's body, the dialog's body, or the page). */
function scrollerOf(el: HTMLElement | null): HTMLElement {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const y = getComputedStyle(n).overflowY;
    if ((y === 'auto' || y === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

export function TellUsHost({
  groups,
  initial,
  retry,
  children,
}: {
  /** The categories (`loadRequestTree().groups`); null = they could not be read. */
  groups: readonly RequestGroup[] | null;
  /** Opened on arrival — the old address forwarding here (`?tell=1`), with where it stood. */
  initial?: { open: boolean; at?: TellUsAt; error?: string | null };
  /** Where Try again re-reads the categories (this page, with the section open). */
  retry: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(initial?.open));
  const [at, setAt] = useState<TellUsAt>(initial?.at ?? {});
  const [error, setError] = useState<string | null>(initial?.error ?? null);
  /** Which way the last step moved — the new step slides in from that side (`.os-in-r` / `.os-in-l`). */
  const [dir, setDir] = useState<'fwd' | 'back' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const makerScroll = useRef(0);
  const head = useRiseRouteHead();

  const openIt = useCallback(() => {
    makerScroll.current = scrollerOf(root.current).scrollTop;
    setAt({});
    setError(null);
    setDir('fwd');
    setOpen(true);
  }, []);

  const go = useCallback((to: TellUsAt) => {
    setError(null);
    setDir(to.tile ? 'fwd' : to.group ? 'fwd' : 'back');
    setAt(to);
  }, []);

  /** ‹ — one step back; from step 1, back to the maker as it was. */
  const back = useCallback(() => {
    setError(null);
    setDir('back');
    if (at.tile) {
      const groupOfTile = groups?.find((g) => g.categories.some((c) => c.tileId === at.tile))?.id;
      setAt(groupOfTile ? { group: groupOfTile } : {});
      return;
    }
    if (at.group) {
      setAt({});
      return;
    }
    setOpen(false);
  }, [at, groups]);

  // Back on the maker: the same scroll place it was left at.
  useLayoutEffect(() => {
    if (open) {
      scrollerOf(root.current).scrollTop = 0;
      return;
    }
    if (dir === 'back') scrollerOf(root.current).scrollTop = makerScroll.current;
  }, [open, dir]);

  // The risen layer's head while the section is open: "‹ Tell us what you do" over the screen's own name.
  const setHead = head?.set;
  useEffect(() => {
    if (!setHead) return;
    setHead(open ? { title: TELL_US_TITLE, back: { label: 'Back', onBack: back } } : null);
  }, [setHead, open, back]);
  useEffect(() => () => setHead?.(null), [setHead]);

  return (
    <TellUs.Provider value={{ open: openIt }}>
      <div ref={root} data-tell-us-host={open ? 'open' : 'shut'}>
        {/* The maker stays mounted under the section — hidden, never unmounted — so nothing typed there is lost. */}
        <div hidden={open} data-tell-us-maker="">
          {children}
        </div>
        {open ? (
          <section aria-label={TELL_US_TITLE} data-tell-us-section="">
            {head ? null : (
              // A hard load has no risen head to name: the section draws its own ‹ row.
              <div className="flex min-h-[60px] items-center gap-2.5 border-b border-ink/10 px-4 py-2" data-tell-us-own-head="">
                <ActionButton tone="neutral" iconOnly icon={ChevronLeft} label="Back" onClick={back} />
                <b className="truncate text-sn-xl font-bold text-ink">{TELL_US_TITLE}</b>
              </div>
            )}
            <div key={`${at.group ?? ''}|${at.tile ?? ''}`} className={dir === 'back' ? 'os-in-l' : dir === 'fwd' ? 'os-in-r' : undefined}>
              <TellUsWhatYouDoView groups={groups} at={at} go={go} searchAgain={() => { setDir('back'); setOpen(false); }} error={error} fromMaker retry={retry} />
            </div>
          </section>
        ) : null}
      </div>
    </TellUs.Provider>
  );
}
