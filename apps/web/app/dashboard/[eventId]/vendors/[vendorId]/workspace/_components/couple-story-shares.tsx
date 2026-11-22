import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { signStoredRef } from '@/lib/supplier-file-sign.server';
import { storyShareState } from '@/lib/today-wrap-up';
import { readStorySilenceDays } from '@/lib/story-silence.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CoupleStorySharesCard } from './couple-story-shares-card';

/**
 * ✓ "<Shop> shared N photos · for your story" — the couple's side of the supplier's wrap-up (Today v3 part 3, owner
 * 19 Nov 2026, drawing V3 · 1 frame 5). Approve all · Hide some. A hidden photo leaves THEIR story only (owner: "only on
 * couple's"); no answer after the owner's days counts as accepted; nothing is removed. The words are the shipped ones —
 * "Approve all" and "Hide", never "Accept".
 *
 * Nothing shared → nothing drawn. A refused read SAYS so.
 */
export async function CoupleStoryShares({ eventId, vendorProfileId, shopName }: { eventId: string; vendorProfileId: string; shopName: string }) {
  const supabase = await createClient();
  const r = await supabase
    .from('event_supplier_story_shares')
    .select('file_id, couple_decision, shared_at, event_supplier_files(portfolio_ref, supplier_media(r2_ref))')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .order('shared_at', { ascending: true })
    .limit(200);
  if (r.error) {
    logQueryError('CoupleStoryShares', r.error, { event_id: eventId }, 'graceful_degrade');
    return (
      <p role="alert" className="py-2 text-sm text-warn-800">
        Couldn&rsquo;t load the photos {shopName} shared for your story. Reload in a moment.
      </p>
    );
  }
  type Row = { file_id: string; couple_decision: string; shared_at: string; event_supplier_files: { portfolio_ref: string | null; supplier_media: { r2_ref: string | null } | null } | null };
  const rows = (r.data ?? []) as unknown as Row[];
  if (rows.length === 0) return null;
  const silence = await readStorySilenceDays(createAdminClient()).catch(() => null);
  const now = Date.now();
  const photos = (
    await Promise.all(
      rows.map(async (row) => ({
        fileId: row.file_id,
        state: storyShareState(row, now, silence),
        url: await signStoredRef(row.event_supplier_files?.portfolio_ref ?? row.event_supplier_files?.supplier_media?.r2_ref ?? null, vendorProfileId).catch(() => null),
      })),
    )
  ).filter((p): p is { fileId: string; state: 'accepted' | 'waiting' | 'hidden'; url: string } => typeof p.url === 'string');
  if (photos.length === 0) return null;
  return <CoupleStorySharesCard eventId={eventId} vendorProfileId={vendorProfileId} shopName={shopName} photos={photos} silenceDays={silence} />;
}
