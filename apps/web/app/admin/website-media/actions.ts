'use server';

/**
 * Server actions for /admin/website-media.
 *
 * Two actions, both single-file by design. There is no "delete all
 * left-over files" control anywhere on this surface, and adding one would be a
 * mistake: the left-over verdict comes from a database read, and a read that
 * breaks or gets scoped wrong reports every file as left-over at once. One
 * keystroke should never be able to act on that.
 *
 * The page is gated by app/admin/layout.tsx, but a server action can be invoked
 * on its own, so each re-verifies admin access. `assertDeletableKey` then
 * re-checks the key against the same allowlist the page renders from — the key
 * arrives in a form field, and a form field is user input, not a permission.
 */

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/admin/require-admin';
import { R2_BUCKETS, r2Delete, r2SignedGet } from '@/lib/r2';
import { assertDeletableKey } from '@/lib/website-media';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Mints a short-lived download link for one file.
 *
 * Ten minutes: long enough to click, short enough that a link pasted into a
 * chat is dead before it travels. Downloading is how a file leaves R2 for the
 * owner's own storage before he removes it here.
 */
export async function getDownloadUrlAction(
  key: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    assertDeletableKey(key);
    const url = await r2SignedGet({
      bucket: R2_BUCKETS.media,
      key,
      expiresIn: 60 * 10,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not build the link.' };
  }
}

/**
 * Deletes ONE file from the media bucket.
 *
 * Irreversible — R2 has no undo and these buckets are not versioned. The UI
 * asks for confirmation naming the file, and the download link sits next to the
 * button so a copy can be taken first.
 */
export async function deleteWebsiteMediaAction(key: string): Promise<Result> {
  try {
    await requireAdmin();
    assertDeletableKey(key);
    await r2Delete({ bucket: R2_BUCKETS.media, key });
    revalidatePath('/admin/website-media');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not delete that file.',
    };
  }
}
