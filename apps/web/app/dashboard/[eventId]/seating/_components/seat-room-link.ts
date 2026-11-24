'use client';

/**
 * seat-room-link.ts — WHAT THE SEAT PLAN HANDS ITS 3D ROOM (owner 2026-11-20, "Yes, your picks"; drawing § 6).
 *
 * In Guests › Seats the 3D room is drawn INSIDE the seat plan (`seating-editor.tsx` keeps the 2D plan mounted under it),
 * and the room itself takes no lock and writes nothing (`room-is-view-only.test.ts`). Two things it shows belong to the
 * plan, so the plan hands them down here — never a second lock, never a second search:
 *
 *   · `lock` — who holds the ONE editor lock (`useSeatingLock`), and the plan's own take-over (`lock.acquire`, the same
 *     press as the plan's "Take over"). The room's "View only" card says "<Name> is editing" and offers it.
 *   · `guide` — the thumb row's search, Entered on 3D: the room walks that guest to their seat (the room's own Guide me).
 *     `at` counts the asks, so the same name searched twice walks twice.
 *
 * Null outside Guests (a room drawn on its own keeps its own Guide me and says View only).
 */
import { createContext } from 'react';

export type SeatRoomLock = {
  /** This person holds the editor lock. */
  holding: boolean;
  /** Who does, when somebody else does ("Jose") — null when nobody can be named. */
  holder: string | null;
  /** The take-over is on its way. */
  waiting: boolean;
  /** The plan's own take-over — the same press as its "Take over". */
  onTakeOver: () => void;
};

export type SeatRoomLink = {
  lock: SeatRoomLock | null;
  guide: { guestId: string; at: number } | null;
};

export const SeatRoomLinkContext = createContext<SeatRoomLink | null>(null);
