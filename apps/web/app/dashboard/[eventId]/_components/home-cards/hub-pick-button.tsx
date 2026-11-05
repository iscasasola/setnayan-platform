'use client';

/**
 * 🎛 "PICK WHAT SHOWS" — the Event Hub tile's small button (owner 2026-10-24, on the live Home; narrowed 2026-10-25:
 * *"pick what shows makes them choose between Save the Date, Invitation, The Day, Post Event only"*). It opens, IN
 * PLACE, the shared bottom sheet (`Sheet`) with ONE choice of four rows — which stage guests see — written by the shipped
 * `setLaunchPhase` (`hub-pick-body.tsx`; the pin is read when the sheet opens). Two looks, one door: the compact tile's 32-px icon (`hc-tiny`, the label in `aria-label`) and the
 * detail card's icon + word.
 *
 * Portalled to <body>: the dashboard's page-enter transform would otherwise pin a fixed sheet to the page, not the
 * screen (as `PapicBuySheet`).
 */
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import HubPickBody from './hub-pick-body';
import type { HomeHubPickRead } from './hub-pick-types';

/* A STATIC import, on purpose (2026-10-24, CI "bundle size check"): a `next/dynamic` chunk adds an entry to webpack's
   runtime — a SHARED chunk every page loads — and main's shared budget had 0.0 KB headroom, so the lazy chunk alone
   pushed it over (only `webpack-*.js` changed hash; every other shared chunk was byte-identical). The body rides Home's
   own page chunk instead; its DATA is still read only on the tap (`readHomeHubPick`). */
export const HUB_PICK_LABEL = 'Pick what shows';

/** The title's ⓘ — that the pick is live, and where the parts are. Each stage's own line is in its row's ⓘ. */
const STAGE_INFO = 'Tap the page guests should see. It changes right away; the parts of each page are in the Maker.';

export function HubPickButton({
  eventId,
  look = 'tiny',
  preset = null,
}: {
  eventId: string;
  /** `tiny` — the compact tile's icon; `button` — the detail card's icon + word. */
  look?: 'tiny' | 'button';
  /** The read, when the caller already holds it (the dev lab) — else read on the tap. */
  preset?: HomeHubPickRead | null;
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
          {STAGE_INFO}
        </InfoTip>
        <HubPickBody eventId={eventId} preset={preset} />
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
