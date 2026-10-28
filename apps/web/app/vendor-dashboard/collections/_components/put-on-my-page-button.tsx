'use client';

import { useActionState, useEffect } from 'react';
import { Check, Clock, Store } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { putAlbumPhotoOnMyPage, type PutOnPageResult } from '../actions';
import { supplierTileLabel, type SupplierPageNoticeState } from '@/lib/supplier-page-notice';

/**
 * "Put on my page" — the one tap on a photo in the private album (owner 2026-10-15, "SIX OWNER ANSWERS" (3)). Posts
 * `putAlbumPhotoOnMyPage`; the result is said once as a toast.
 *
 * ⏳ The tap no longer publishes (owner 2026-10-03, the 7-day guest notice): once filed, the tile stops being a button
 * and says where the photo stands — "Goes up Nov 4" while the guests' notice runs, "On your page" after, or "A guest
 * asked to keep it off". A status is not pressable, so it wears no frame. The screen never resets: the state comes
 * back from the action and is drawn in place.
 */
export function PutOnMyPageButton({
  photoId,
  notice = null,
}: {
  photoId: string;
  /** The photo's notice, when one exists (read by the album section under the supplier's own session). */
  notice?: { state: SupplierPageNoticeState; publicFrom: string } | null;
}) {
  const toast = useToast();
  const [state, run] = useActionState<PutOnPageResult | null, FormData>(putAlbumPhotoOnMyPage, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.text);
    else toast.error(state.error);
  }, [state, toast]);

  const now = state?.ok ? { state: state.state, publicFrom: state.publicFrom ?? '' } : notice;
  if (now && now.state !== 'taken_down') {
    const Icon = now.state === 'on_page' ? Check : Clock;
    return (
      <p
        data-put-on-my-page={photoId}
        data-page-notice-state={now.state}
        className="flex min-h-11 items-center justify-center gap-1.5 text-center text-xs"
        style={{ color: 'var(--m-slate-2)' }}
      >
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
        {supplierTileLabel(now.state, now.publicFrom)}
      </p>
    );
  }

  return (
    <form action={run} data-put-on-my-page={photoId}>
      <input type="hidden" name="photo_id" value={photoId} />
      <SupplierSubmit
        tone="neutral"
        icon={<Store aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
        label="Put on my page"
        pendingLabel="Putting it on…"
        overlay={false}
        className="!min-h-11 w-full"
      />
    </form>
  );
}
