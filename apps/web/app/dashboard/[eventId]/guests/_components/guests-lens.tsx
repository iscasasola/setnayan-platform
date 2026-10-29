'use client';

/**
 * guests-lens.tsx — WHAT THE GUESTS SCREEN HANDS ITS VIEWS (R4 slice 1, owner 2026-10-29: "the thumb row on every view").
 *
 * The Guests screen (`guests-screen.tsx`) owns the ONE ⇅ state (`lib/guests-filter.ts`, kept in the address) and the ONE
 * thumb-row seat at the foot of the screen (`.lower`). List and Map draw their row there themselves; Seats and March are
 * the shipped makers, drawn whole by the page — so they read this context and draw THE SAME `ThumbRow` into that seat
 * (a portal into `slot`), only while their view is the one on screen. Their ⇅ is the shared Show (`setFilter` writes it
 * for every view), never a copy.
 *
 * Outside Guests (the Studio, the lab's other parts) there is no lens: a maker draws its own shipped chrome.
 */
import { createContext, useContext } from 'react';
import type { GuestsFilter } from '@/lib/guests-filter';
import type { ThumbRow } from '@/components/thumb-row';
import type { GuestsView, SeatMode } from '@/lib/guests-views';
import type { SectionHeadToolbar } from './section-head-toolbar';

export type GuestsLens = {
  /** The view on screen — a kept-hidden maker draws no row. */
  view: GuestsView;
  /** The element the thumb row is drawn into (null until mounted). */
  slot: HTMLElement | null;
  filter: GuestsFilter;
  setFilter: (next: GuestsFilter) => void;
  hasSides: boolean;
  /**
   * Does this guest pass the shared Show? Read off the Guests screen's own list (every field `replyFilterMatches`
   * needs), so a seat or a walk is judged by the same rule as the carousel's count. A guest the list does not hold
   * (removed since) is never dimmed — the lens does not judge what it cannot read.
   */
  shows: (guestId: string) => boolean;
  /**
   * THE shared row component, handed down — so a maker draws it without importing it (the march and the seat plan are
   * also the Maker's lazy pieces; importing the row there would pull its CSS module into every place they load).
   */
  ThumbRow: typeof ThumbRow;
  /** The guests the shipped search finds for these words (`rosterSearchMatches` — names, nickname, role, group…). */
  find: (words: string) => ReadonlySet<string>;
  /**
   * 🏷 R4 slice 5 — the SELECTED header's toolbar, handed down like `ThumbRow` (the List's own, `section-head-toolbar.tsx`),
   * and the one door that renames an entourage section's heading (`renameSection`, the ONE writer of `events.role_names`,
   * the list taking the word at once). Absent = no toolbar (a viewer who may only look).
   */
  HeadToolbar?: typeof SectionHeadToolbar;
  sectionWords?: (key: string) => { current: string; usual: string | null } | null;
  renameSection?: (key: string, text: string) => Promise<string | null>;
  /**
   * 🎚 R4 slice 2 — THE TOP ROW'S REVERSE CHANNEL. Seats' mode (List · 2D · 3D) is picked in the Guests top row, but its
   * ONE state stays the seat plan's (`seating-editor.tsx`): the plan tells the screen its mode and how to change it —
   * never a second state. Null = the plan has gone (or another view is on screen).
   */
  registerSeats?: (api: SeatsChannel | null) => void;
  /** The top row's seat for the view's own rounds (Seats' Edit · ⋯), left of the ⚙ — null until mounted. */
  toolsSlot?: HTMLElement | null;
};

export type SeatsChannel = { mode: SeatMode; setMode: (mode: SeatMode) => void; show3D: boolean };

export const GuestsLensContext = createContext<GuestsLens | null>(null);

/** The lens for one maker view — null when this maker is not inside Guests, or its view is not the one on screen. */
export function useGuestsLens(view: GuestsView): GuestsLens | null {
  const lens = useContext(GuestsLensContext);
  return lens && lens.view === view ? lens : null;
}
