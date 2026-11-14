'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Copy, LayoutGrid, Link2, Navigation, Share, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { directionApps, mapDeviceFrom, type DirectionLinks, type MapDevice } from '@/lib/map-directions';

/**
 * 🧭 "GET DIRECTIONS" — ONE BUTTON, ONE SHEET NAMED AFTER THE PLACE (map card + Get directions, owner-approved
 * 2026-11-14 on `prototypes/map_card_open_in_maps_2026-11-14_fable.html`; it replaces the "Directions ▾" dropdown).
 *
 * The sheet: "Get directions to" · the place's name · its address · ✕, then the map apps this device most likely has
 * (`directionApps` — Android's own chooser first, Apple Maps first on an iPhone, Google Maps on a computer), then
 * Copy address · Copy map link · Share… (only where the browser can share), and a Close at the foot. It exits by ✕,
 * Close, a tap outside, Esc or the phone's Back, and focus returns to the button (the shared `Sheet`).
 *
 * A press answers at once: the button reads pressed while its sheet is open, an app row says what is loading
 * ("Opening Waze…") with a spinner, a copy row says "Copied ✓".
 *
 * 🔒 NO LINK IS BUILT HERE. `DirectionsMenu` (nav-links.tsx) builds every map-app link and hands them in ready; this
 * file only orders them. The device is read when the sheet OPENS (never in render), so the server's HTML and the
 * first client render are the same closed button — no hydration mismatch.
 */

export type DirectionsLook = 'couple' | 'template';

type Props = {
  /** The sheet's title: the place's name (or, with none, its address). */
  title: string;
  /** The line under the title; null when the title already is the address. */
  address: string | null;
  /** What "Copy address" copies; null hides the row. */
  copyText: string | null;
  links: DirectionLinks;
  /**
   * `couple` — the Event Hub / The Day: the couple's own page look (ink pill on the venue plate, whose ground is the
   * plate's paper — `VENUE_CHIP_GROUND`). `template` — the supplier page: the template's main ActionButton.
   */
  look: DirectionsLook;
};

type Busy = { key: string; line: string } | null;

export function GetDirections({ title, address, copyText, links, look }: Props) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<MapDevice>('computer');
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const show = () => {
    // 📱 THE SEAM: the device is read here, at the press — fake it by giving the page another user agent.
    setDevice(mapDeviceFrom(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    setCanShare(typeof navigator.share === 'function');
    setBusy(null);
    setCopied(null);
    setOpen(true);
  };
  const close = () => {
    clearTimers();
    setBusy(null);
    setCopied(null);
    setOpen(false);
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing more a page can do */
      }
      ta.remove();
    }
    setCopied(key);
    later(() => setCopied((k) => (k === key ? null : k)), 1900);
  };

  const share = async () => {
    setBusy({ key: 'share', line: 'Opening your share list…' });
    try {
      await navigator.share({ title, text: address ?? title, url: links.mapLink });
    } catch {
      /* the guest closed the share list — nothing went wrong */
    }
    close();
  };

  const apps = directionApps(device, links);
  const pressed = open ? 'scale-[.97] brightness-90' : '';

  return (
    <>
      {look === 'template' ? (
        <ActionButton
          tone="brand"
          main
          icon={Navigation}
          label="Get directions"
          onClick={show}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-get-directions=""
          className={`mt-3 w-full min-h-12 text-[15px] ${pressed}`}
        />
      ) : (
        <button
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-get-directions=""
          className={`mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-[15px] font-semibold text-cream transition-[transform,filter] duration-150 active:scale-[.97] active:brightness-90 ${pressed}`}
        >
          <Navigation aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
          Get directions
        </button>
      )}
      <Sheet
        open={open}
        onClose={close}
        labelledById={headingId}
        rise
        head={
          <div className="flex items-start gap-2 py-1.5 pl-4 pr-1.5">
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink/70">Get directions to</p>
              <h2 id={headingId} className="mt-0.5 text-lg font-semibold leading-tight text-ink [overflow-wrap:anywhere]">
                {title}
              </h2>
              {address ? <p className="mt-0.5 text-[13.5px] text-ink/70">{address}</p> : null}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-ink/5"
            >
              <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
          </div>
        }
        foot={
          <div className="border-t border-ink/10 px-4 pb-4 pt-2.5">
            <button
              type="button"
              onClick={close}
              className="flex min-h-12 w-full items-center justify-center rounded-full border border-ink/40 bg-ink/5 text-[15px] font-semibold text-ink active:scale-[.97]"
            >
              Close
            </button>
          </div>
        }
      >
        <div data-directions-sheet="" data-device={device}>
          <p className="px-4 pb-1.5 pt-3 text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink/70">Open in</p>
          {apps.map((a) => {
            const isBusy = busy?.key === a.key;
            return (
              <a
                key={a.key}
                href={a.href}
                {...(a.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                data-map-app={a.key}
                data-busy={isBusy ? '' : undefined}
                aria-busy={isBusy || undefined}
                onClick={(e) => {
                  if (busy) {
                    e.preventDefault();
                    return;
                  }
                  setBusy({ key: a.key, line: a.loading });
                  later(close, 1100);
                }}
                className="flex min-h-[58px] w-full items-center gap-3 border-t border-ink/10 px-4 py-2 text-left transition-colors first-of-type:border-t-0 active:bg-ink/5 data-[busy]:bg-ink/5"
              >
                <span aria-hidden className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border border-ink/15 bg-ink/5 text-ink/70">
                  {a.key === 'geo' ? <LayoutGrid className="h-5 w-5" strokeWidth={1.9} /> : <Navigation className="h-5 w-5" strokeWidth={1.9} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[15.5px] font-semibold leading-tight text-ink">
                    {a.name}
                    {a.best && device !== 'computer' && device !== 'mac' ? (
                      <span className="inline-flex min-h-[22px] items-center rounded-full bg-success-100 px-2 text-[11.5px] font-semibold text-success-800">
                        Best on this phone
                      </span>
                    ) : null}
                  </span>
                  <span className={`mt-px block text-[13px] leading-snug ${isBusy ? 'font-semibold text-ink' : 'text-ink/70'}`}>
                    {isBusy ? busy.line : a.sub}
                  </span>
                </span>
                {isBusy ? (
                  <span aria-hidden className="h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-[2.5px] border-ink/20 border-t-terracotta" />
                ) : (
                  <span aria-hidden className="shrink-0 text-xl leading-none text-terracotta">
                    ›
                  </span>
                )}
              </a>
            );
          })}
          <p className="border-t border-ink/10 px-4 pb-1.5 pt-3 text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink/70">Or send it</p>
          {copyText ? (
            <SendRow
              icon={<Copy className="h-5 w-5" strokeWidth={1.9} />}
              label={copied === 'address' ? 'Copied ✓' : 'Copy address'}
              done={copied === 'address'}
              sub={copyText}
              onPress={() => copy('address', copyText)}
              first
            />
          ) : null}
          <SendRow
            icon={<Link2 className="h-5 w-5" strokeWidth={1.9} />}
            label={copied === 'link' ? 'Copied ✓' : 'Copy map link'}
            done={copied === 'link'}
            sub="A link anyone can open"
            onPress={() => copy('link', links.mapLink)}
            first={!copyText}
          />
          {canShare ? (
            <SendRow
              icon={<Share className="h-5 w-5" strokeWidth={1.9} />}
              label="Share…"
              sub={busy?.key === 'share' ? busy.line : 'Messenger, Viber, Messages and more'}
              busy={busy?.key === 'share'}
              onPress={share}
            />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

function SendRow({
  icon,
  label,
  sub,
  onPress,
  done = false,
  busy = false,
  first = false,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
  done?: boolean;
  busy?: boolean;
  first?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-busy={busy || undefined}
      className={`flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left transition-colors active:bg-ink/5 ${first ? '' : 'border-t border-ink/10'} ${busy ? 'bg-ink/5' : ''}`}
    >
      <span aria-hidden className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg border border-ink/15 bg-ink/5 text-ink/70">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span aria-live="polite" className={`block text-[15.5px] font-semibold leading-tight ${done ? 'text-success-800' : 'text-ink'}`}>
          {label}
        </span>
        <span className={`mt-px block text-[13px] leading-snug [overflow-wrap:anywhere] ${busy ? 'font-semibold text-ink' : 'text-ink/70'}`}>{sub}</span>
      </span>
    </button>
  );
}
