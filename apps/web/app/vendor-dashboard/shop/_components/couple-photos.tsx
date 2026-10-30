/**
 * 📸 PHOTOS COUPLES SHARED — the server half of the shop's Approve screen (owner 2026-10-30). ONE read: the
 * `vendor_couple_photo_shares()` door, which answers only for the caller's own shops (owner/admin team): the snapshot
 * key of a waiting share, the frozen copy of an approved one. Nothing waiting and nothing approved → nothing is drawn. A refused read is SAID, never
 * drawn as "none".
 */
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { couplePhotoShare } from '@/app/_actions/couple-photo-share-actions';
import { coupleLookUrl, coupleLookUrlFor } from '@/lib/couple-photo-share.server';
import { COUPLE_PHOTO_AUDIENCE_LABEL, isCouplePhotoAudience } from '@/lib/couple-photo-share';
import { CouplePhotosList, type ShopCouplePhoto } from './couple-photos-list';

type Row = { share_id: string; state: string; photo_key: string | null; audience: string; credit_line: string; service_title: string | null };

export async function CouplePhotosToAnswer() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('vendor_couple_photo_shares');
  if (error) {
    logQueryError('CouplePhotosToAnswer', error, {}, 'graceful_degrade');
    return (
      <p role="alert" className="mx-auto w-full max-w-3xl text-[13px] text-danger-700" data-couple-photos-unread="">
        Photos couples shared with you could not be read just now — nothing was answered. Reopen this page in a moment.
      </p>
    );
  }
  const rows = ((data ?? []) as Row[]).filter((r) => r.state === 'waiting' || r.state === 'approved');
  // The SNAPSHOT the shop is approving (waiting — the couple's upload, a plain URL) or the frozen copy on its card
  // (approved — public bucket for Public, else a short-lived signed URL). A KEY mapped to its URL here, never a URL
  // read off the couple's board row (security review #7089).
  const photos: ShopCouplePhoto[] = [];
  for (const r of rows) {
    const audience = isCouplePhotoAudience(r.audience) ? r.audience : 'exclusive';
    const url = r.state === 'waiting' ? coupleLookUrl(r.photo_key) : await coupleLookUrlFor(r.photo_key, audience === 'public');
    if (!url) continue;
    photos.push({
      shareId: r.share_id,
      state: r.state as ShopCouplePhoto['state'],
      imageUrl: url,
      creditLine: r.credit_line,
      serviceTitle: (r.service_title ?? '').trim() || 'your service card',
      audienceLabel: COUPLE_PHOTO_AUDIENCE_LABEL[audience],
    });
  }
  if (photos.length === 0) return null;
  return <CouplePhotosList photos={photos} couplePhotoShare={couplePhotoShare} />;
}
