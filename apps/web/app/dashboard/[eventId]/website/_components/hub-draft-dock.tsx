import { loadHubDraftBarData } from '@/lib/hub-draft-store';
import { hubDraftSaveFailureText } from '@/lib/hub-draft';
import { HubDraftToolbar } from './hub-draft-bar';
import { MiniTour } from '@/app/_components/mini-tour';

/**
 * THE ONE MOUNT for the Event Hub Maker's toolbar (Phase 2):
 *
 *   <MakerShell … applySlot={<HubDraftDock eventId={eventId} />}>
 *
 * A server component: it resolves the draft summary, the store-shell posture and
 * the live catalogue price (`loadHubDraftBarData`) once, and hands them to the
 * compact client toolbar (`HubDraftToolbar`), which reads the stage the couple
 * is on from the Maker's own state (`useMaker()`) for Reset. Everything it
 * prints comes from that one server read — no price is typed, and in the store
 * shell none is fetched.
 */
export async function HubDraftDock({ eventId, saveError }: { eventId: string; saveError?: string }) {
  const bar = await loadHubDraftBarData(eventId);
  /* `?draft_error=` — a form's draft save that did not land came back here
     instead of crashing the page; only the two known words become text. */
  return (
    <HubDraftToolbar
      {...bar}
      /* 🍎 Where Apple sells Pro (owner 2026-10-18), the toolbar treats Pro as the
         web does — Apply asks for it, and "Unlock Pro and Apply" opens Apple's page
         (`bar.proHref`). Decided HERE, on the server, so the toolbar (the Maker's
         first load) carries no new code. Prices stay withheld in every store shell
         by the loaders (`priceLabel` null). */
      storeShell={bar.storeShell && !bar.appleIap}
      saveError={hubDraftSaveFailureText(saveError)}
      /* 💎 First visit to the Apply sheet — drawn only inside the open sheet,
         which never opens in the app-store shell (no effects reach it there). */
      applyTour={bar.proEffects.length > 0 ? <MiniTour tourKey="customer_apply_pro_v1" storeShell={bar.storeShell} /> : null}
    />
  );
}
