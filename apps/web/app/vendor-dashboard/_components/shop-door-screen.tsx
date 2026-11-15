'use client';

/**
 * 🚪 A SHOP DOOR — RISEN FULL SCREEN ON A PHONE, THE 440px RIGHT PANEL FROM 701 (owner 2026-11-16, DECISION_LOG
 * "FROM 701px THE SHOP DOORS OPEN AS THE 440px RIGHT PANEL"; W1 tablet/desktop walk RW-352 — Share opened full screen
 * at 768 and 1280 while every other sheet on the supplier dashboard is the right panel).
 *
 * Below 701 this IS `RiseScreen`, with exactly the props it was given — the phone is byte-for-byte what shipped
 * (owner 2026-11-10 "fullscreen everything" still holds there). From 701 it is the shared `Sheet` in its right-panel
 * mode: the supplier dashboard mounts the `tab` boundary, so the panel is the system's 440px drawer with the Shop page
 * dimmed behind it (the Sheet's own backdrop). The head is the rise head's grammar (✕ · title over its line · the
 * door's own action) and the thumb action sits pinned at the foot.
 *
 * Which one is decided by `useSyncExternalStore` against the 701 line: a door opened by a tap reads the real width on
 * its FIRST render (no full-screen flash on a laptop); a door open in the server HTML (a deep link, a reload) hydrates
 * as the phone screen, then becomes the panel.
 *
 * 🔒 app/vendor-dashboard/shop/each-shop-door-is-the-panel-from-701.test.ts
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { RiseScreen, type RiseScreenProps } from '@/app/_components/rise/rise-screen';
import { BREAKPOINTS } from '@/lib/use-responsive';

/** The supplier dashboard's phone/tablet line — the same 701 its shell and every sheet switch at. */
export const SHOP_DOOR_PANEL_QUERY = `(min-width: ${BREAKPOINTS.tab}px)`;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(SHOP_DOOR_PANEL_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
const panelNow = () => window.matchMedia(SHOP_DOOR_PANEL_QUERY).matches;
const panelOnServer = () => false;

/** A Shop door's screen. Same props as `RiseScreen` (no ⓘ — no Shop door carries one). */
export function ShopDoorScreen(props: Omit<RiseScreenProps, 'info'>) {
  const panel = useSyncExternalStore(subscribe, panelNow, panelOnServer);
  if (!panel) return <RiseScreen {...props} />;
  return <ShopDoorPanel {...props} />;
}

export function ShopDoorPanel({ title, line, labelledById, actions, thumb, fill = false, onClose, data, children }: Omit<RiseScreenProps, 'info'>) {
  const headingId = useId();
  /* The panel closes through its own `open` (✕ · Esc · the backdrop · Back), and only THEN tells the caller, so the
     Sheet's history entry is taken off before the caller unmounts the door. */
  const [open, setOpen] = useState(true);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) onCloseRef.current();
  }, [open]);
  const shut = () => setOpen(false);

  return (
    <Sheet
      open={open}
      onClose={shut}
      labelledById={title ? headingId : (labelledById ?? headingId)}
      rise
      head={
        title ? (
          <div className="flex min-h-[60px] items-center gap-2.5 border-b border-ink/10 px-4 py-2" data-shop-door-head="">
            <span className="inline-flex shrink-0">
              <ActionButton tone="neutral" iconOnly icon={X} label="Close" onClick={shut} />
            </span>
            <span className="min-w-0 flex-1">
              <b id={headingId} className="block truncate text-[17px] font-bold leading-tight text-ink">
                {title}
              </b>
              {line ? <small className="block truncate text-[12.5px] text-ink/60">{line}</small> : null}
            </span>
            {actions ? <span className="flex shrink-0 items-center gap-1.5">{actions}</span> : null}
          </div>
        ) : undefined
      }
      foot={thumb ? <div className="px-4 pb-4 pt-2" data-shop-door-thumb="">{thumb}</div> : undefined}
    >
      <div data-shop-door-panel={data} className={fill ? 'flex h-full min-h-0 flex-col' : undefined}>
        {children}
      </div>
    </Sheet>
  );
}
