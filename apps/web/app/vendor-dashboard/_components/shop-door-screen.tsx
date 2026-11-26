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
/**
 * 🖥 The other line a door may switch at: the desktop line (1024), where a surface OUTSIDE the supplier dashboard (no
 * `tab` boundary mounted — Open a shop) turns its sheets into panels. Final check B1 (drawing
 * `final-check-area-5_2026-11-25.html` § B1: phone full screen, desktop a large centred dialog).
 */
export const SHOP_DOOR_DESKTOP_QUERY = `(min-width: ${BREAKPOINTS.lg}px)`;

/** Where a door stops rising and becomes the panel: 701 (the supplier dashboard, the default) or the desktop line. */
export type ShopDoorAt = 'tab' | 'lg';
const QUERY_AT: Record<ShopDoorAt, string> = { tab: SHOP_DOOR_PANEL_QUERY, lg: SHOP_DOOR_DESKTOP_QUERY };

function subscribeAt(query: string) {
  return (onChange: () => void): (() => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
}
const SUBSCRIBE: Record<ShopDoorAt, (onChange: () => void) => () => void> = { tab: subscribeAt(QUERY_AT.tab), lg: subscribeAt(QUERY_AT.lg) };
const PANEL_NOW: Record<ShopDoorAt, () => boolean> = {
  tab: () => window.matchMedia(QUERY_AT.tab).matches,
  lg: () => window.matchMedia(QUERY_AT.lg).matches,
};
const panelOnServer = () => false;

export type ShopDoorScreenProps = Omit<RiseScreenProps, 'info'> & {
  /** The line it becomes the panel at. Default `tab` (701) — every Shop door as shipped. */
  at?: ShopDoorAt;
  /** From that line, the centred form page (`Sheet` `page`) instead of the 440 right panel. Default false. */
  page?: boolean;
};

/** A Shop door's screen. Same props as `RiseScreen` (no ⓘ — no Shop door carries one). */
export function ShopDoorScreen(props: ShopDoorScreenProps) {
  const at = props.at ?? 'tab';
  const panel = useSyncExternalStore(SUBSCRIBE[at], PANEL_NOW[at], panelOnServer);
  /* ↘ A door that opened as the panel STAYS the panel until it closes: when the window narrows below 701 the panel
     shuts itself (below), so its Sheet takes its own history entry off and the caller unmounts the door. Swapping to
     RiseScreen mid-open would hand that entry to a full-screen door the supplier never opened. */
  const [wasPanel, setWasPanel] = useState(false);
  useEffect(() => {
    if (panel) setWasPanel(true);
  }, [panel]);
  // `at` / `page` ride along unused: RiseScreen has no panel.
  if (!panel && !wasPanel) return <RiseScreen {...props} />;
  return <ShopDoorPanel {...props} />;
}

export function ShopDoorPanel({ title, line, labelledById, actions, thumb, fill = false, onClose, data, children, at = 'tab', page = false }: ShopDoorScreenProps) {
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
  /* ↘ The window narrowed below 701 while the panel was open → close it the ordinary way (no back-button entry is
     left behind; the caller's onClose runs once the Sheet has taken its entry off). */
  useEffect(() => {
    const mql = at === 'lg' ? window.matchMedia(SHOP_DOOR_DESKTOP_QUERY) : window.matchMedia(SHOP_DOOR_PANEL_QUERY);
    const onChange = () => {
      if (!mql.matches) setOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [at]);

  return (
    <Sheet
      open={open}
      onClose={shut}
      labelledById={title ? headingId : (labelledById ?? headingId)}
      rise
      page={page}
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
