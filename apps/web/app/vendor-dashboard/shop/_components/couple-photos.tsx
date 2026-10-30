/**
 * 📸 PHOTOS COUPLES SHARED — the server half of the shop's Approve screen (owner 2026-10-30). ONE read: the
 * `vendor_couple_photo_shares()` door, which answers only for the caller's own shops (owner/admin team) and only rows
 * still on the couple's board. Nothing waiting and nothing approved → nothing is drawn. A refused read is SAID, never
 * drawn as "none".
 */
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { couplePhotoShare } from '@/app/_actions/couple-photo-share-actions';
import { CouplePhotosList, type ShopCouplePhoto } from './couple-photos-list';

type Row = { share_id: string; state: string; image_url: string; credit_line: string; service_title: string | null };

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
  const photos: ShopCouplePhoto[] = ((data ?? []) as Row[])
    .filter((r) => r.state === 'waiting' || r.state === 'approved')
    .map((r) => ({
      shareId: r.share_id,
      state: r.state as ShopCouplePhoto['state'],
      imageUrl: r.image_url,
      creditLine: r.credit_line,
      serviceTitle: (r.service_title ?? '').trim() || 'your service card',
    }));
  if (photos.length === 0) return null;
  return <CouplePhotosList photos={photos} couplePhotoShare={couplePhotoShare} />;
}
