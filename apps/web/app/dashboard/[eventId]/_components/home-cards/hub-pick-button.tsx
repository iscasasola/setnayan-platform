'use client';

/**
 * 🎛 "PICK WHAT SHOWS" — the Event Hub tile's small button (owner 2026-10-24, on the live Home: *"on home, we can
 * pick what part of event hub will be active"* — 23 Oct — now on the tile itself). It opens, IN PLACE, the shared
 * bottom sheet (`Sheet`) with the shipped part switches, page picker and Apply bar (`hub-pick-body.tsx`, loaded on
 * the tap). Two looks, one door: the compact tile's 32-px icon (`hc-tiny`, the label in `aria-label`) and the
 * detail card's icon + word.
 *
 * Portalled to <body>: the dashboard's page-enter transform would otherwise pin a fixed sheet to the page, not the
 * screen (as `PapicBuySheet`).
 */
import dynamic from 'next/dynamic';
import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import type { HomeHubPickRead } from './hub-pick-types';

const HubPickBody = dynamic(() => import(/* webpackChunkName: "home-hub-pick" */ './hub-pick-body'), {
  ssr: false,
  loading: () => (
    <p className="sg-step" aria-live="polite">
      Loading your page’s parts…
    </p>
  ),
});

export const HUB_PICK_LABEL = 'Pick what shows';

export function HubPickButton({
  eventId,
  look = 'tiny',
  preset = null,
  apply = null,
}: {
  eventId: string;
  /** `tiny` — the compact tile's icon; `button` — the detail card's icon + word. */
  look?: 'tiny' | 'button';
  /** The read, when the caller already holds it (the dev lab) — else read on the tap. */
  preset?: HomeHubPickRead | null;
  /** The shipped Apply bar, rendered by the page (`HubDraftDock`) — the sheet draws it under the switches. */
  apply?: ReactNode;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(false);

  const sheet = open ? (
    <Sheet open onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-4 pb-4 pt-3.5" data-home-hub-pick-sheet="">
        <InfoTip
          label={HUB_PICK_LABEL}
          labelAs="h3"
          labelId={headingId}
          labelClassName="text-[19px] font-semibold tracking-tight text-ink"
          align="start"
        >
          Choose which parts each page of your Event Hub shows. Guests see a change only after you press Apply; ↺ puts a
          switch back.
        </InfoTip>
        <HubPickBody eventId={eventId} preset={preset} apply={apply} />
      </div>
    </Sheet>
  ) : null;

  return (
    <>
      {look === 'tiny' ? (
        <button
          type="button"
          className="hc-tiny"
          aria-label={HUB_PICK_LABEL}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          data-hc-act=""
          data-home-hub-pick-open="tile"
        >
          <SlidersHorizontal aria-hidden strokeWidth={1.9} />
        </button>
      ) : (
        <ActionButton
          tone="neutral"
          icon={<SlidersHorizontal aria-hidden="true" strokeWidth={1.9} />}
          label={HUB_PICK_LABEL}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="home-hub-pick-open-card"
        />
      )}
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
