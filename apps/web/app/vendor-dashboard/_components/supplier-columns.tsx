'use client';

/**
 * 🖥 TWO COLUMNS — the list left · the opened item / chat / sheet right (supplier dashboard v13, owner 2026-10-29
 * "TWO columns filling the window (list · opened item/chat)"; DECISION_LOG "SUPPLIER DASHBOARD — LAST ROUND" item 12;
 * prototype `.work` + `.pane`). The frame's one shape for it, so every page that opens rows drops into the SAME two
 * columns instead of drawing its own:
 *
 *   · from 701 the window is split 1 : 1, from 1100 5 : 6; the right column rides under everything pinned at the top
 *     (`--sn-pin-top`, the shared pin line), fills the rest of the window and scrolls on its own;
 *   · below 701 there is ONE column and the pane is not drawn — on a phone an opened row expands in place (controller
 *     call 5, v13 notes: "Today rows: phone = expand inline; ≥700 px = open in the right column");
 *   · 🔒 NEVER AN EMPTY RIGHT COLUMN: `pane` is required — the page's DEFAULT for it (the prototype's per-page pane:
 *     the first waiting row opened on Today, the first event on Customers, the map on Shop › Details, the live card on
 *     Hub) until the supplier opens something else. A page with nothing honest to put there does NOT use this; it keeps
 *     its own full-width body.
 *
 * The page owns what is open (its state, its address); this owns only where it is drawn. 🔒 the-supplier-frame-holds.test.ts
 */
import type { ReactNode } from 'react';
import { usePinLine } from '@/app/_components/pinned-row/pin-line';

export function SupplierColumns({
  list,
  pane,
  paneLabel,
  name,
}: {
  /** The page's list — every row, as on the phone. */
  list: ReactNode;
  /** What is open on the right — the page's default until the supplier opens something else. Never empty. */
  pane: ReactNode;
  /** What the right column is, for a screen reader ("Kat Arroyo · Debut"). */
  paneLabel: string;
  /** Which page — the guard's and the walk's handle (`data-supplier-cols`). */
  name: string;
}) {
  usePinLine();
  return (
    <div className="sn-cols" data-supplier-cols={name}>
      <div className="sn-cols-list" data-supplier-cols-list="">
        {list}
      </div>
      <section className="sn-cols-pane" aria-label={paneLabel} data-supplier-cols-pane="">
        {pane}
      </section>
    </div>
  );
}
