'use server';

/**
 * Server actions for /admin/website-media.
 *
 * Two actions, both single-file by design. There is no "delete all left-over
 * files" control anywhere on this surface, and adding one would be a mistake:
 * the left-over verdict comes from a database read, and a read that breaks or
 * gets scoped wrong reports every file as left-over at once. One keystroke
 * should never be able to act on that.
 *
 * THREE GATES, IN ORDER, ALL SERVER-SIDE:
 *   1. `requireAdminAction()` — the ACTION gate, not the page gate. A server
 *      action has no page to redirect, so the page variant's thrown
 *      `redirect()` / `notFound()` would be caught by the try below and
 *      rendered as a framework digest string instead of sending an expired
 *      session to login.
 *   2. `assertDeletableKey()` — the same prefix allowlist the page renders
 *      from, re-checked here because the key arrives in a form field and a form
 *      field is user input, not a permission.
 *   3. `usageForKey()` — the file must be PROVEN unreferenced right now. The
 *      client disables Delete for anything else, but `disabled` is a hint to a
 *      browser; it is not enforcement, and the verdict behind it may be stale.
 *
 * Gate 3 is the one an earlier revision lacked. It is the difference between
 * "the UI didn't offer it" and "the server refused it".
 */

import { revalidatePath } from 'next/cache';

import { requireAdminAction } from '@/lib/admin/require-admin';
import { R2_BUCKETS, r2Delete, r2SignedGet } from '@/lib/r2';
import { contentDispositionAttachment } from '@/lib/content-disposition';
import { assertDeletableKey, isDeletableUsage } from '@/lib/website-media';
import { usageForKey } from '@/lib/website-media-server';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Next signals redirect/notFound by THROWING. Catching those turns a working
 * auth bounce into an error message, so they are rethrown untouched.
 */
function isFrameworkControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_');
}

/**
 * Mints a short-lived download link for one file.
 *
 * Ten minutes: long enough to click, short enough that a link pasted into a chat
 * is dead before it travels. Downloading is how a file leaves R2 for the owner's
 * own storage before it is removed here.
 */
export async function getDownloadUrlAction(
  key: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireAdminAction();
    assertDeletableKey(key);
    const url = await r2SignedGet({
      bucket: R2_BUCKETS.media,
      key,
      expiresIn: 60 * 10,
      // Force a SAVE, not a preview. Without this the browser plays the clip or
      // shows the image in a tab and nothing lands on disk — which would quietly
      // hollow out the one step that makes deleting safe.
      responseContentDisposition: contentDispositionAttachment(
        key.split('/').pop() || 'website-media',
      ),
    });
    return { ok: true, url };
  } catch (err) {
    if (isFrameworkControlFlow(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : 'Could not build the link.' };
  }
}

/**
 * Deletes ONE file from the media bucket, and only if it is provably unused.
 *
 * Irreversible — R2 has no undo and these buckets are not versioned. The UI asks
 * for confirmation naming the file, and the download link sits next to the
 * button so a copy can be taken first.
 */
export async function deleteWebsiteMediaAction(key: string): Promise<Result> {
  try {
    await requireAdminAction();
    assertDeletableKey(key);

    // Re-derive usage NOW rather than trusting what the page rendered.
    const lookup = await usageForKey(key);
    if (!lookup.ok) {
      return {
        ok: false,
        error:
          'Nothing was deleted. We could not confirm whether this file is still ' +
          `being used, so it was left alone. (${lookup.reason})`,
      };
    }
    const usage = lookup.keys.has(key) ? 'in-use' : 'unreferenced';
    if (!isDeletableUsage(usage)) {
      return {
        ok: false,
        error:
          'Nothing was deleted. This file is still being used on the site. ' +
          'Replace it from its own admin page instead.',
      };
    }

    await r2Delete({ bucket: R2_BUCKETS.media, key });
    revalidatePath('/admin/website-media');
    return { ok: true };
  } catch (err) {
    if (isFrameworkControlFlow(err)) throw err;
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not delete that file.',
    };
  }
}
