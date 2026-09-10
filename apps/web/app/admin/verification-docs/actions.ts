'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { R2_BUCKETS, r2Delete, r2SignedGet } from '@/lib/r2';
import { contentDispositionAttachment } from '@/lib/content-disposition';
import { referencedVerificationKeys } from '@/lib/verification-docs-server';
import { performVerificationDelete } from '@/lib/verification-docs';

/**
 * /admin/verification-docs — the ONLY write path against the vendor
 * verification bucket.
 *
 * These objects are government IDs, business permits and bank proofs. Deletion
 * is irreversible: R2 has no undo and this bucket is not versioned. So every
 * gate below is deliberate, and none of them may be relaxed for convenience.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');
  const { data } = await supabase
    .from('users')
    .select('is_internal')
    .eq('user_id', user.id)
    .maybeSingle();
  if ((data as { is_internal?: boolean } | null)?.is_internal !== true) {
    redirect('/');
  }
}

/**
 * A short-lived link to look at one document before deciding anything.
 *
 * `attachment` on purpose: a browser that renders a JPEG inline turns "check
 * what this is" into "a government ID is now sitting in the tab history". The
 * media page learned the same lesson — without a content disposition, files
 * play instead of download.
 */
export async function viewVerificationDoc(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  if (!key) redirect('/admin/verification-docs?error=nokey');

  const url = await r2SignedGet({
    bucket: R2_BUCKETS.vendorVerification,
    key,
    expiresIn: 120,
    responseContentDisposition: contentDispositionAttachment(key.split('/').pop() || 'document'),
  });
  redirect(url);
}

/**
 * Delete ONE left-over document, and only if it is provably unreferenced.
 *
 * ── THE GATES, AND WHY EACH ONE EXISTS ──────────────────────────────────────
 * 1. Admin only.
 * 2. **The reference set is re-read AT PRESS TIME** — never trusted from the
 *    page. The listing in front of a person may be minutes old, and a vendor
 *    can attach a document in between. A stale "left over" label must not be
 *    able to authorise a delete.
 * 3. **If the reference read fails, nothing is deleted.** An empty set from a
 *    failed query looks identical to "nothing points at this" — that is the
 *    RLS-denial-reads-as-empty trap, and here it would erase a live ID.
 * 4. A key we could not parse a vendor out of is refused. If we cannot say
 *    whose it is, we do not remove it.
 * 5. **An EMPTY reference set is refused too.** A read that succeeds and
 *    returns nothing looks byte-identical to "nothing points at this", and that
 *    is precisely how this page shipped. Gate 3 cannot see it — there is no
 *    error. Gate 5 is what does.
 * 6. **A reference read that stopped EARLY is refused like a failed one.**
 *    PostgREST caps what it returns; a capped read comes back large, non-empty
 *    and incomplete with NO error, clearing gates 3 and 5 at once. The danger
 *    on this page is always a reference set SMALLER than the truth.
 *
 * ⚖ **EVERY ONE OF THEM, AND THE BRANCH THAT ACTS ON THEM, LIVES IN
 * `performVerificationDelete` — in the pure module, where a test CALLS it and
 * watches whether the object was deleted.** This file is a `'use server'`
 * module no `node:test` can load, so a condition written HERE could only ever
 * be guarded by matching this file's text — and on this branch
 * `if (verdict !== 'ok')` was replaced with `if (false)` while all three text
 * guards kept passing and the suite stayed GREEN at 90/90. Do not bring a
 * decision back into this file.
 *
 * 🛡 What is left is wiring, and it is pinned WHOLE — see
 * `R6 · the delete action has NO body of its own beyond the pin`. The bucket
 * below is part of that pin: pointing it at the wrong bucket deletes nothing
 * and still reports "Deleted. That file is gone from storage."
 *
 * ONE object per call. There is no bulk delete on this page and there should
 * not be: the whole value of the gate is that a person looked at each file.
 */
export async function deleteVerificationDoc(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  if (!key) redirect('/admin/verification-docs?error=nokey');

  const outcome = await performVerificationDelete({
    key,
    readReferences: referencedVerificationKeys,
    deleteObject: (k) => r2Delete({ bucket: R2_BUCKETS.vendorVerification, key: k }),
  });
  if (outcome !== 'deleted') {
    redirect(`/admin/verification-docs?error=${outcome}`);
  }

  revalidatePath('/admin/verification-docs');
  redirect('/admin/verification-docs?deleted=1');
}
