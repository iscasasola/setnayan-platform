import { createClient } from '@/lib/supabase/server';
import { readShownMarch } from '@/lib/guests-march-read';
/* ⚡ The march maker loads when the March is opened — never with the Guest list (`details-lazy.tsx`, its lazy chunk). */
import { MarchMaker } from '../../launch/_components/details-lazy';

/**
 * 🗂 R4 · GUESTS › MARCH — THE SHIPPED WEDDING MARCH MAKER, RENDERED WHOLE (owner 2026-10-27/28, DECISION_LOG "GUESTS =
 * LIST · MAP · SEATS · MARCH"; *"On guests we have things to move there: March, Seat, Rsvp"*).
 *
 * Nothing here is new: the march is the Maker's own drag-and-drop maker (`details-march.tsx`, owner 2026-10-06 "THE
 * WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH MAKER"), fed the very reads its Maker item was fed — `loadMarch` (the
 * march and the "Not walking" tray), the saved section order, and the Event Hub draft's drafted moves — laid on by
 * the one builder (`lib/march-as-drafted.ts`). Its one door to the server is still the Event Hub draft's save: a move
 * shows at once here and reaches guests with ✓ Apply (owner 2026-10-06, *"Wait for apply"*) — said under ⓘ, never
 * hidden. Its "Not walking" tray is drawn into the slot below, as the Maker's lower third held it.
 *
 * 🔒 Only the couple is offered this view (`guests/page.tsx`): the march's draft is the couple's Event Hub draft, and
 * `loadMarch` reads with the service client — so it is called only for a viewer the page already let read the list.
 * Every read that fails is SAID (`draftUnread` / `marchUnread` → the maker's own "The march couldn't load — Retry"),
 * never drawn as "Nobody walks yet".
 */
export async function GuestsMarch({ eventId }: { eventId: string }) {
  // 🚶 The one read of the march as shown (lib/guests-march-read.ts) — the march's PDF reads the same.
  const shown = await readShownMarch(await createClient(), eventId);
  return (
    /* 🖥 The width is used (owner 2026-10-29, *"always maximize the screen use"*): from 1024 the "Not walking" tray is the
       side panel beside the walks, never under a centred strip; on a phone it follows the walks. */
    <div data-guests-march="" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <MarchMaker eventId={eventId} sections={shown.sections} printed={shown.printed} out={shown.out} draftUnread={shown.draftUnread === true} guests />
      {/* 🚶 The "Not walking" tray's place — the maker draws the tray INTO it (one state, one drag). */}
      <div data-march-tray-slot="" className="flex min-h-0 flex-col lg:sticky lg:top-4" />
    </div>
  );
}
