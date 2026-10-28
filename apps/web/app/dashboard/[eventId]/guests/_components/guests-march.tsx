import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadEntourageSectionOrder, loadMarch } from '@/app/[slug]/_lib/loaders';
import { readHubDraft } from '@/lib/hub-draft-store';
import { marchSections, marchTray, printedSectionOrder } from '@/lib/march-sections';
import { marchAsDrafted } from '@/lib/march-as-drafted';
import type { MarchStep } from '@/lib/march-drag';
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
  const supabase = await createClient();
  const admin = createAdminClient();
  const [march, savedSections, drafted] = await Promise.all([
    loadMarch(admin, eventId),
    loadEntourageSectionOrder(admin, eventId),
    /* A draft that could not be read is `null` (said), never "no moves". */
    readHubDraft(supabase, eventId).then(
      (d): MarchStep[][] => d?.march ?? [],
      (e: unknown) => {
        console.error('[guests › march] the Event Hub draft could not be read:', e instanceof Error ? e.message : e);
        return null;
      },
    ),
  ]);
  const shown = marchAsDrafted(
    {
      sections: marchSections(march.walking),
      // A section whose people are all in the tray still prints — it is still a step the header drag passes.
      printed: printedSectionOrder([...march.walking, ...(march.out ?? [])], savedSections),
      out: march.out ? marchTray(march.out) : null,
    },
    drafted,
    march.unread === true,
  );
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
