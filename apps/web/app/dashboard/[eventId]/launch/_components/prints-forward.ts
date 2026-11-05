'use client';

import { useEffect } from 'react';
import { detailsItemHref, isPrintsItem, type DetailsItemKey } from '@/lib/maker-details-items';

/**
 * 🖨 ONE DOOR EACH WAY BETWEEN THE MAKER AND THE PRINTS PAGE (R8, owner 2026-10-27 "PRINTS LEAVES STUDIO" — `lib/prints-page.ts`).
 *
 * A print opened in the Maker — an old door, a tour, a tab that came back — is the Prints page's; anything but a print opened
 * on the Prints page (an empty slide's "Add your Love Story") is the Maker's. Each lands on its own page AT THE SAME ITEM
 * (`detailsItemHref` names both). This is NOT a switch: a stage or a page of the Maker stays client state
 * (`lib/switching-stage-or-page-never-navigates.test.ts`); this fires only when an item crosses from one page to the other.
 *
 * Read from the ITEM alone, never whether Details is still open: the Stages side's landing rule (`makerDoorLanding`) drops
 * the selection in the same commit a cold door names its item, and the forward must not lose that race. The item is only
 * ever set while Details is open (the workspace tells it), so nothing stale can trigger it.
 *
 * A whole-page load, never the router: the two are different pages of the app. The Maker's history entry is REPLACED (it
 * never held a print); the Prints page's is kept, so Back returns to Prints.
 */
export function printsItemElsewhere(input: { hasWork: boolean; printsPage: boolean; detailsItem: DetailsItemKey | null }): DetailsItemKey | null {
  const { hasWork, printsPage, detailsItem } = input;
  return hasWork && detailsItem !== null && isPrintsItem(detailsItem) !== printsPage ? detailsItem : null;
}

export function usePrintsForward(eventId: string, input: { hasWork: boolean; printsPage: boolean; detailsItem: DetailsItemKey | null }): void {
  const itemElsewhere = printsItemElsewhere(input);
  const { printsPage } = input;
  useEffect(() => {
    if (!itemElsewhere) return;
    const to = detailsItemHref(eventId, itemElsewhere);
    if (printsPage) window.location.assign(to);
    else window.location.replace(to);
  }, [itemElsewhere, printsPage, eventId]);
}
