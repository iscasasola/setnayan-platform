import { redirect } from 'next/navigation';

/**
 * /vendor-dashboard/locked-qr — the ledger of issued one-use codes now lives INSIDE the one QR codes page, as its
 * Issued fold (S-PR3; plan § 2: "`/invite` (Shortlist / Locked QR toggle) + `/locked-qr` ledger — Merge: one 'QR
 * codes' (Shortlist · Booked — one dropdown), ledger inside"). Every old link lands on Booked with Issued open.
 */
export default function RedirectLockedQr(): never {
  redirect('/vendor-dashboard/invite?mode=locked&ledger=1#issued');
}
