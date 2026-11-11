import { createClient } from '@/lib/supabase/server';
import { readCoupleApprovals } from '@/lib/supplier-files.server';
import { CouplePhotoApprovalsSheet } from './couple-photo-approvals-sheet';

/**
 * 📸 "<Shop> wants to show these on her shop as from your wedding" — the couple's side of the three guards (Piece 3b ·
 * DECISION_LOG 2026-11-12 + FIVE GUARDS 4: the couple's approval is ALWAYS required; prototype legend row 150).
 *
 * Reads the shop's service photos for THIS event that could list (they count — first copy, not already on the
 * portfolio), waiting ones first. Nothing asked → nothing drawn. A refused read SAYS so.
 */
export async function CouplePhotoApprovals({
  eventId,
  vendorProfileId,
  shopName,
}: {
  eventId: string;
  vendorProfileId: string;
  shopName: string;
}) {
  const supabase = await createClient();
  const { data: evRow } = await supabase.from('events').select('event_date, display_name').eq('event_id', eventId).maybeSingle();
  const ev = evRow as { event_date: string | null; display_name: string | null } | null;
  const read = await readCoupleApprovals(supabase, { eventId, vendorProfileId, eventDate: ev?.event_date ?? null });
  if (read.status !== 'ok') {
    return (
      <p role="alert" className="text-sm text-ink/70">
        We couldn&rsquo;t load the photos {shopName} wants to show. Reload in a moment.
      </p>
    );
  }
  if (read.files.length === 0) return null;
  return (
    <CouplePhotoApprovalsSheet
      eventId={eventId}
      shopName={shopName}
      coupleName={ev?.display_name ?? ''}
      returnPath={`/dashboard/${eventId}`}
      rows={read.files.map((f) => ({
        fileId: f.fileId,
        name: f.name,
        url: f.url,
        kind: f.kind,
        service: f.serviceId ? (read.serviceTitles[f.serviceId] ?? 'Service') : 'Service',
        takenAt: f.takenAt,
        decision: f.decision,
      }))}
    />
  );
}
