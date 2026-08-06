/**
 * Guest Columns — shared flag + types (OnTheDay BUILD ① · studies doc § 1).
 *
 * Every guest may write ONE short op-ed ("column") for the couple's paper:
 * title ≤60 + body ≤280 · couple approves before publish · edit-until-approved
 * · decline returns it · submissions close at the 'editorial' lifecycle phase
 * (server-enforced inside the guest_submit_column RPC; the UI close-state here
 * is a courtesy mirror via getLifecyclePhase).
 *
 * ROLLOUT: everything (guest form, public renders, review queue, editorial
 * section) is gated behind GUEST_COLUMNS_ENABLED — a server-side env flag,
 * default OFF. The schema is inert until this flips (the PABUYA_PUBLIC_ROUTE
 * precedent: flag default-off IS the go-live hold, since migrations auto-apply
 * on merge). On top of the flag, every server surface ALSO requires the
 * 'guest_columns' Data-Privacy control to be Active (/admin/data-privacy —
 * see lib/guest-columns-gate.ts; env short-circuits first, control
 * fail-closed).
 */

export const GUEST_COLUMN_TITLE_MAX = 60;
export const GUEST_COLUMN_BODY_MAX = 280;

export function guestColumnsEnabled(): boolean {
  const v = process.env.GUEST_COLUMNS_ENABLED;
  return v === '1' || v === 'true';
}

export type GuestColumnStatus = 'pending' | 'approved' | 'rejected' | 'user_deleted';

/** The guest's own column as surfaced to the guest-site form. */
export type OwnGuestColumn = {
  title: string;
  body: string;
  status: GuestColumnStatus;
  declineNote: string | null;
  editCount: number;
};

/** An approved column on a public render (byline resolved from guests). */
export type PublishedGuestColumn = {
  title: string;
  body: string;
  author: string | null;
};

/**
 * DPO RULING 2026-08-06 — a guest's name is published only if they asked for it.
 *
 * The byline is the guest's roster name, typed by the COUPLE. Publishing it on
 * the open web beside the guest's words is a disclosure the guest never made
 * about themselves, so the default is no byline and `author_named_publicly` is
 * the opt-in.
 *
 * ⚠ DO NOT "FIX" THIS BY FLIPPING `author_publicly_hidden`. Despite its name it
 * is not a byline switch: every read path filters `author_publicly_hidden =
 * false`, so setting it removes the WHOLE MESSAGE from publication. Changing
 * its default would have silently unpublished every guest message rather than
 * anonymising it. The two columns answer different questions.
 *
 * This helper exists so the rule lives in ONE place. Four separate surfaces
 * resolve guest bylines, each with its own hand-rolled name lookup; if each also
 * decided the opt-in for itself, one of them would eventually decide it
 * differently and publish a name nobody agreed to. `guest-columns-byline.test.ts`
 * fails if a surface resolves a byline without coming through here.
 */
export function bylineFor(row: {
  author_named_publicly?: boolean | null;
  guest_id?: string | null;
}, nameOf: Map<string, string>): string | null {
  // Fail closed on a pre-migration read: `undefined` means the column is not
  // there yet, which must read as "not opted in", never as "publish the name".
  if (row.author_named_publicly !== true) return null;
  const id = row.guest_id;
  if (!id) return null;
  return nameOf.get(id) ?? null;
}
