import 'server-only';
import { uploadPublicAsset } from '@/lib/storage';
import { R2_BUCKETS, displayUrlForPrivateStoredAsset, encodeR2Ref } from '@/lib/uploads';
import { depositProofFolder, depositProofPolicy, parseClientRef } from '@/lib/r2-client-ref';

/**
 * A couple's deposit receipt — the ONE way it is written and the ONE way it is
 * read (`event_vendors.deposit_proof_url`).
 *
 * 🔒 THE HOLE THIS CLOSES (N5, 2026-09-11 · found by N4). Both writers in
 * `vendors/actions.ts` — the lock that carries a downpayment, and "record a
 * deposit" — filed the screenshot under `deposit-proof/<eventId>/`, which the
 * prefix router sends to the PUBLIC media bucket, and stored the permanent
 * public URL. A bank or GCash screenshot (account name, reference, sometimes a
 * balance) was readable by anyone the link ever reached, forever.
 *
 * Now the file goes to the PRIVATE thread-files bucket under the event's own
 * deposit folder, the column stores the `r2://` REF (never a URL), and every
 * reader signs a short-lived link through the scoped private signer.
 *
 * ⚖ READ IS AN ALLOW-LIST, NOT A PASS-THROUGH. The scoped signer hands a
 * non-`r2://` value back verbatim (its legacy contract). That is wrong here:
 * the couple's session can write this column (measured, the replay, 2026-09-11),
 * so a value like `https://wa.me/…` would render on the SUPPLIER'S client page
 * as a "View proof" link — a door out of the app. So a value is shown only when
 * it is a ref inside THIS event's deposit folder; anything else shows nothing.
 * Production held no deposit receipt at all when this landed (0 rows), so no
 * old public URL is lost by refusing them.
 */

export type DepositProofUpload = { ok: true; ref: string } | { ok: false; error: string };

/** Upload the receipt privately and return the ref to store. Never a URL. */
export async function uploadDepositProof(eventId: string, file: File): Promise<DepositProofUpload> {
  const up = await uploadPublicAsset({ pathPrefix: depositProofFolder(eventId), file });
  if (!up.ok) return up;
  // The dev fallback (no R2 credentials) writes to a PUBLIC Supabase bucket and
  // hands back a public URL. A receipt must never be stored that way.
  if (up.bucket !== R2_BUCKETS.threadFiles) {
    console.error('[deposit-proof] receipts need the private R2 bucket; refusing the fallback upload');
    return { ok: false, error: 'We couldn’t store your receipt privately just now. Please try again.' };
  }
  const ref = encodeR2Ref(up.bucket, up.key);
  // The writer and the reader agree, or the receipt could never be shown.
  if (!parseClientRef(ref, depositProofPolicy(eventId))) {
    console.error('[deposit-proof] the stored ref does not satisfy its own read policy', { eventId });
    return { ok: false, error: 'We couldn’t store your receipt. Please rename the file and try again.' };
  }
  return { ok: true, ref };
}

/**
 * A short-lived link to the receipt, or `null` — for anything that is not a
 * ref inside this event's deposit folder (see the header: no pass-through).
 * `eventId` comes from the row the caller was allowed to read.
 */
export async function depositProofDisplayUrl(
  value: string | null | undefined,
  eventId: string | null | undefined,
): Promise<string | null> {
  if (!eventId || typeof value !== 'string') return null;
  const policy = depositProofPolicy(eventId);
  if (!parseClientRef(value.trim(), policy)) return null;
  return await displayUrlForPrivateStoredAsset(value, policy);
}
