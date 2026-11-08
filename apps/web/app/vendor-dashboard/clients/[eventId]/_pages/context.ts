/**
 * 🗂 WHAT EVERY PICKED-CLIENT PAGE IS HANDED (THE ONE BUILD, 8 Nov 2026).
 *
 * The nine page bodies (`_pages/<page>.tsx`) are owned by different lanes — Details · Chat · Schedule by L2,
 * Quotation · Chat · Hub by C2, Payment · Files by C1, Forms · Report by C3 — and mounted by ONE file,
 * `clients/[eventId]/page.tsx` (L2 only). So the mount never has to change when a lane fills its body, each
 * body receives the SAME context object plus, while it is still a stub, the `shipped` node the client page drew
 * for that section before this build (relocated, never redrawn — Rule 0). A lane that needs more than the
 * context reads it inside its own async body (one batched read per page) — or lists the prop it needs in its
 * notes, and L2 adds it here.
 *
 * Every fact here is already resolved by the client page; none of it is a new read.
 */
import type { ReactNode } from 'react';

export type PickedClientStage = 'booked' | 'inquiry' | 'requested';

export type PickedPageContext = {
  eventId: string;
  /** The shop being looked at — the supplier's OWN profile, never a URL param. */
  vendorProfileId: string;
  /** The signed-in person (owner, admin or agent seat). */
  viewerUserId: string;
  /** This shop's conversation on this event, when there is one. */
  threadId: string | null;
  /** The event's display name, or "This couple". */
  eventName: string;
  stage: PickedClientStage;
  isBooked: boolean;
  /** False while the booking fee withholds the operating detail (`redactBriefForStage`). */
  feeUnlocked: boolean;
  /** `event_vendors.vendor_id` of this shop's row on the event, when there is one. */
  eventVendorId: string | null;
  eventDate: string | null;
};

export type PickedPageProps = {
  ctx: PickedPageContext;
  /**
   * The node the client page drew for this section before THE ONE BUILD. A stub renders it unchanged; the lane
   * that owns the page replaces the stub body and may keep, reuse or drop it.
   */
  shipped?: ReactNode;
};
