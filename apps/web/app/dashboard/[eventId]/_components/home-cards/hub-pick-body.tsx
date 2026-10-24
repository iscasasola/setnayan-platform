'use client';

/**
 * hub-pick-body.tsx — the "Pick what shows" sheet's body, mounted only when the sheet opens; its table is read then
 * (`readHomeHubPick`). It draws the SHIPPED pieces, unchanged:
 *
 *   · `HubPartsSwitches` — the page picker (which of the four pages, "Now" on the live one) and a switch per part,
 *     each tap written into the Maker's DRAFT with its ↺;
 *   · the Apply bar the Maker and Home's Event Hub card carry (↺ · ✓ Apply, Pro asked for there) — `HubDraftDock`,
 *     RENDERED by Home and handed in as `apply` (its loader reads the view switch, which no server action may).
 *
 * The table is read on the tap (`readHomeHubPick`), or handed in by the dev lab (`preset`).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { HubPartsSwitches } from './hub-parts-switches';
import { readHomeHubPick } from './hub-pick-actions';
import type { HomeHubPickRead } from './hub-pick-types';

export default function HubPickBody({
  eventId,
  preset = null,
  apply = null,
}: {
  eventId: string;
  preset?: HomeHubPickRead | null;
  /** The shipped Apply bar, rendered by the page (`HubDraftDock`). */
  apply?: ReactNode;
}) {
  const [read, setRead] = useState<HomeHubPickRead | null>(preset);
  useEffect(() => {
    if (read) return;
    let live = true;
    readHomeHubPick(eventId)
      .then((r) => {
        if (live) setRead(r);
      })
      .catch(() => {
        if (live) setRead({ ok: false, reason: 'unread' });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the sheet opens
  }, []);

  if (!read) {
    return (
      <p className="sg-step" aria-live="polite">
        Loading your page’s parts…
      </p>
    );
  }
  if (!read.ok) {
    return (
      <p role="status" className="py-3 text-[13px] text-ink/65" data-home-hub-pick-refused={read.reason}>
        {read.reason === 'not_host'
          ? 'Only the hosts can change what your Event Hub shows.'
          : 'The parts of your page couldn’t load. Open the Maker to change them.'}
      </p>
    );
  }
  return (
    <div data-home-hub-pick="">
      {read.draftUnread ? (
        <p role="status" className="py-3 text-[13px] text-ink/65" data-home-hub-draft-unread="">
          Your waiting changes couldn’t load — these switches show your live page.
        </p>
      ) : null}
      {read.table ? (
        <HubPartsSwitches eventId={eventId} table={read.table} now={read.stage} />
      ) : (
        <p role="status" className="py-3 text-[13px] text-ink/65" data-home-hub-parts-unread="">
          The parts of your page couldn’t load. Open the Maker to change them.
        </p>
      )}
      {apply ? (
        /* The Apply bar stays in the thumb zone while the list scrolls (the 23 Oct prototype: "↺ · ✓ in the thumb zone"). */
        <div className="sticky bottom-[calc(-1*max(env(safe-area-inset-bottom),16px))] z-10 -mx-4 flex items-center justify-end gap-1.5 border-t border-ink/10 bg-cream px-4 pb-[calc(0.75rem+max(env(safe-area-inset-bottom),16px))] pt-3" data-home-hub-apply="">
          {apply}
        </div>
      ) : null}
    </div>
  );
}
