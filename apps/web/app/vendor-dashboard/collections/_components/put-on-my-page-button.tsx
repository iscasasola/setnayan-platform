'use client';

import { useActionState, useEffect } from 'react';
import { Check, Store } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { putAlbumPhotoOnMyPage, type PutOnPageResult } from '../actions';

/**
 * "Put on my page" — the one tap on a photo in the private album (owner 2026-10-15, "SIX OWNER ANSWERS" (3)). Posts
 * `putAlbumPhotoOnMyPage`; the result is said once as a toast and the button turns into "On your page".
 */
export function PutOnMyPageButton({ photoId }: { photoId: string }) {
  const toast = useToast();
  const [state, run] = useActionState<PutOnPageResult | null, FormData>(putAlbumPhotoOnMyPage, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.text);
    else toast.error(state.error);
  }, [state, toast]);
  const done = state?.ok === true;
  return (
    <form action={run} data-put-on-my-page={photoId}>
      <input type="hidden" name="photo_id" value={photoId} />
      <SupplierSubmit
        tone="neutral"
        icon={done ? <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> : <Store aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
        label={done ? 'On your page' : 'Put on my page'}
        pendingLabel="Putting it on…"
        overlay={false}
        className="!min-h-11 w-full"
      />
    </form>
  );
}
