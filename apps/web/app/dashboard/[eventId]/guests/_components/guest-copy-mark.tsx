'use client';

import { createPortal } from 'react-dom';
import { LastSeenMark } from '@/app/_components/last-seen/last-seen-mark';
import { useHydrated } from '@/lib/use-hydrated';
import type { GuestsCopyState } from './guest-list-copy';

/**
 * 📋 The one last-seen mark over the Guest list's LAST COPY ("Showing your last copy · updating…" /
 * "Couldn't update — showing your last copy from <when>…"). The mark is `fixed` under the top bar; drawn
 * inside the list's screen it would be pinned to that screen's own transformed box, so it goes to the body.
 * A copy only ever appears after hydration — `hydrated` is false only in a server/static render, which draws
 * it in place.
 */
export function GuestCopyMark({ copy }: { copy: GuestsCopyState }) {
  const hydrated = useHydrated();
  const mark = <LastSeenMark phase={copy.freshness} savedAt={copy.savedAt} />;
  return hydrated ? createPortal(mark, document.body) : mark;
}
