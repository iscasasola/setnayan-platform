import type { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadEntourageSectionOrder, loadMarch } from '@/app/[slug]/_lib/loaders';
import { readHubDraft } from '@/lib/hub-draft-store';
import { marchSections, marchTray, printedSectionOrder } from '@/lib/march-sections';
import { marchAsDrafted, type MarchShown } from '@/lib/march-as-drafted';
import type { MarchStep } from '@/lib/march-drag';

/**
 * 🚶 THE MARCH AS GUESTS › MARCH SHOWS IT — the live march with the Event Hub draft's moves laid on. ONE read for the two
 * places that show it: the March view (`guests/_components/guests-march.tsx`) and its "Wedding march order" PDF
 * (`guests/share`, R4 slice 8) — so the file is the march on the screen, never a second reading of it.
 *
 * 🔒 Couple only: `loadMarch` reads with the service client; both callers let only the couple in. A read that failed is
 * said (`draftUnread` / `marchUnread`), never drawn as "Nobody walks yet".
 */
export async function readShownMarch(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string): Promise<MarchShown & { drafted: boolean }> {
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
  return { ...shown, drafted: Boolean(drafted?.some((d) => d.length > 0)) };
}
