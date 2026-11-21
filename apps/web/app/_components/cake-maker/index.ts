/**
 * 🎂 THE CAKE MAKER'S DOORS — what the chat's ＋ tray imports (the Unichat builder wires the tiles; Cake Maker v6).
 *
 *   · `cakeChatStatus(threadId)` — is this chat's shop's Cake Maker on, and which side is asking? Draw the couple's
 *     ＋ "Design a cake" tile (full width, at the end of Ask) only when `on && side === 'couple'`; draw the shop's
 *     ＋ › For your service › "Ask for a cake design" only when `on && side === 'vendor'`. A failed read draws neither.
 *   · `<CakeDesignerSheet threadId onClose onSent />` — the couple's designer (lazy: three.js loads only when it opens).
 *   · `askForCakeDesign(threadId)` — posts the shop's invite card ("Design your cake for us").
 *   · The cards (`CakeDesignCard`, `CakeInviteCard`, lazy in `chat/cards/lazy-cards.tsx`) are already drawn by the chat
 *     stream — import them from there, never statically, so the tray stays light.
 */
import { lazy } from 'react';
import { cakeAction } from './cake-actions';

export const CakeDesignerSheet = lazy(() => import('./cake-designer').then((m) => ({ default: m.CakeDesigner })));
export const CAKE_TILE_WORDS = { couple: 'Design a cake', vendor: 'Ask for a cake design' } as const;

export async function cakeChatStatus(threadId: string): Promise<{ on: boolean; side: 'couple' | 'vendor' } | null> {
  try {
    const r = await cakeAction({ op: 'status', threadId });
    return r.ok && r.op === 'status' ? { on: r.on, side: r.side } : null;
  } catch {
    return null;
  }
}

/** The shop's ＋ › For your service › Ask for a cake design. Null = posted; otherwise the sentence to show. */
export async function askForCakeDesign(threadId: string): Promise<string | null> {
  try {
    const r = await cakeAction({ op: 'invite', threadId });
    return r.ok ? null : r.message;
  } catch {
    return 'The invite didn’t send — try again.';
  }
}
