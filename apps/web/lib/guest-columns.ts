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
 * on merge).
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
