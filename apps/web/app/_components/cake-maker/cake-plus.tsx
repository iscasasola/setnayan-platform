'use client';

/**
 * 🎂 THE CAKE MAKER'S TWO ＋ TILES (Cake Maker v6, `prototypes/cake_maker_2026-11-21/cake_maker_fable.html`):
 *   · couple — ＋ › "Design a cake", ONE full-width tile at the end of Ask (cake shops only), opens the designer;
 *   · supplier — ＋ › For your service › "Ask for a cake design", posts the invite card the couple taps.
 *
 * Whether to draw either is the shop's own switch, read once per chat through the ONE existing server action
 * (`cakeAction` op `status`, via `cakeChatStatus`) — no new action. A failed read draws neither tile (never a dead door).
 * The designer is lazy (three.js loads only when it opens) and is portalled to the body: the chat's frame keeps a
 * transform, which would otherwise be the containing block of its fixed layer.
 */
import { Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CAKE_TILE_WORDS, CakeDesignerSheet, askForCakeDesign, cakeChatStatus } from './index';

/** One read per chat per page life — reopening the ＋ does not ask again. */
const SEEN = new Map<string, 'couple' | 'vendor' | 'off'>();

/** True when this chat's shop has its Cake Maker on and this viewer is on `side` (false while unread or on a failed read). */
export function useCakeTile(threadId: string | undefined, side: 'couple' | 'vendor'): boolean {
  const [on, setOn] = useState(() => (threadId ? SEEN.get(threadId) === side : false));
  useEffect(() => {
    if (!threadId) return;
    const known = SEEN.get(threadId);
    if (known) {
      setOn(known === side);
      return;
    }
    let live = true;
    void cakeChatStatus(threadId).then((r) => {
      // A failed read is not remembered (the next open asks again) and draws nothing.
      if (!r) return;
      const v = r.on ? r.side : 'off';
      SEEN.set(threadId, v);
      if (live) setOn(v === side);
    });
    return () => {
      live = false;
    };
  }, [threadId, side]);
  return on;
}

/** The couple's designer, opened from the ＋ tile. */
export function CakeDesignerFromPlus({ threadId, onClose }: { threadId: string; onClose: () => void }) {
  const router = useRouter();
  return createPortal(
    <Suspense fallback={null}>
      <CakeDesignerSheet threadId={threadId} onClose={onClose} onSent={() => router.refresh()} />
    </Suspense>,
    document.body,
  );
}

export { CAKE_TILE_WORDS, askForCakeDesign };
export const CAKE_TILE_LINES = {
  couple: 'Shape, tiers, colours · send it to the shop',
  vendor: 'They design it in your Cake Maker · it lands here',
} as const;
