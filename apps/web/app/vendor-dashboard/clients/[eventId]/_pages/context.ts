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

import type { CoordinatorRow, TheirEventPart, TheirEventRow } from '@/lib/their-event';
import type { BookingGroupRead } from '@/lib/their-event.server';
import type { TheirEventPartBrief } from '../_components/their-event-part-body';

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
  /**
   * The thread page's notice params on this request (`supplierThreadNoticeSearch`) — an action taken inside this
   * client's Chat returns here with them, and every thread embed hands them to the ONE draw so the notice is said in
   * the chat box (owner 17 Nov). Empty on a plain open.
   */
  threadSearch?: Record<string, string>;
  /**
   * 🚪 "Their event" — a booked supplier's links to their open parts (owner 2026-11-21), drawn above the chat. Null for
   * the coordinator (who has the dashboard), before booking, and while the fee withholds the event.
   */
  theirEventRows?: readonly TheirEventRow[] | null;
  /**
   * 🖥 THE CHAT'S RIGHT COLUMN ON A COMPUTER (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE EDITOR PER PART").
   * A booked supplier: the part opened in the column (`?part=`, Schedule · Numbers · Guests) and what its body draws —
   * facts the page already read (the brief, the booking group). Null when there is no "Their event" list.
   */
  theirEventColumn?: { open: TheirEventPart | null; brief: TheirEventPartBrief; group: BookingGroupRead } | null;
  /** 🖥 The booked coordinator: the hosts' dashboard in the right column — rows, the event's date and place line. */
  coordinatorPane?: { rows: readonly CoordinatorRow[]; dateLine: string | null; placeLine: string | null } | null;
  /** 🧾 Details › Agreed now's plain rows (Venue · Hosts · Coordinator · Supplier · Stage) — `agreedFacts`, part G. */
  agreedFacts?: readonly { label: string; value: string }[];
};

export type PickedPageProps = {
  ctx: PickedPageContext;
  /**
   * The node the client page drew for this section before THE ONE BUILD. A stub renders it unchanged; the lane
   * that owns the page replaces the stub body and may keep, reuse or drop it.
   */
  shipped?: ReactNode;
};
