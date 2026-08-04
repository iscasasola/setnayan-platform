'use server';

/**
 * Server actions for /admin/website-media.
 *
 * Two single-file actions, plus ONE bulk action added 2026-08-04.
 *
 * ⚠ THIS HEADER USED TO FORBID THE BULK ACTION, and its reasoning was right:
 * the left-over verdict comes from a database read, and a read that breaks or
 * gets scoped wrong reports every file as left-over at once — one keystroke
 * should never be able to act on that. That danger is not dismissed; it is now
 * CAUGHT, by gates 3 and 4 on `clearLeftoverMediaAction` below. The rule
 * changed because the page reported 1,878 deletable files: a surface that can
 * only be cleared one confirmation at a time never gets cleared, and
 * "impossible to do safely" and "impossible to do" are different problems.
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
import { usageForKey, loadWebsiteMedia } from '@/lib/website-media-server';

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

/**
 * Clear every file in ONE folder that a FRESH read proves is left over.
 *
 * ─── THIS FILE USED TO FORBID EXACTLY THIS, AND THE REASON WAS SOUND ──────
 * The header above said a bulk control "would be a mistake: the left-over
 * verdict comes from a database read, and a read that breaks or gets scoped
 * wrong reports every file as left-over at once. One keystroke should never be
 * able to act on that."
 *
 * That danger is real and is NOT dismissed here — it is what the extra gates
 * below exist to catch. The prohibition is lifted only because the alternative
 * became worse: `/admin/website-media` reports **1,878** deletable files, and a
 * surface that can only be cleared one confirmation at a time is a surface that
 * never gets cleared. "Impossible to do safely" and "impossible to do" are
 * different problems.
 *
 * ─── THE FIVE GATES ──────────────────────────────────────────────────────
 *   1. `requireAdminAction()`                                    — as before.
 *   2. A FRESH `loadWebsiteMedia()`. The screen's verdict is never trusted;
 *      every key is re-classified now, and only rows THIS read calls left-over
 *      are eligible.
 *   3. ⛔ REFUSE A BROKEN READ. If the folder's reference lookup failed, or its
 *      listing failed, or it was truncated, nothing is deleted. A failed read
 *      and an empty result are the same value — that is the whole hazard.
 *   4. ⛔ REFUSE AN IMPLAUSIBLE VERDICT — the specific signature the header
 *      warns about. If a read breaks or is mis-scoped it marks EVERYTHING left
 *      over. So: if not one single file in the entire bucket is still in use,
 *      that is not a tidy bucket, it is a broken query. Setnayan always has
 *      live media (the logo set, the menu icons, the onboarding music — this
 *      page's own copy says so). Refuse.
 *   5. `expectedCount` must match what this read found. The caller passes the
 *      number it showed the admin; a mismatch means the bucket moved between
 *      render and click, and the admin is confirming a figure that no longer
 *      exists.
 *
 * Deletes one object at a time through the same key allowlist as the
 * single-file path. A failure on one file is reported, not fatal — the rest
 * still clear, and the count returned is what actually happened, not what was
 * attempted.
 */
export async function clearLeftoverMediaAction(args: {
  prefix: string;
  expectedCount: number;
}): Promise<Result & { deleted?: number; failed?: number }> {
  try {
    await requireAdminAction();

    const report = await loadWebsiteMedia();
    if (!report.configured) {
      return { ok: false, error: 'Nothing was deleted. Storage is not configured.' };
    }

    const group = report.groups.find((g) => g.prefix === args.prefix);
    if (!group) {
      return { ok: false, error: 'Nothing was deleted. That folder is not on this page.' };
    }

    // GATE 3 — a read that did not complete cannot authorise a deletion.
    if (group.lookupFailure) {
      return {
        ok: false,
        error:
          'Nothing was deleted. We could not confirm which files are still in use ' +
          `(${group.lookupFailure}), and a check that did not finish is not a "no".`,
      };
    }
    if (group.listingError) {
      return { ok: false, error: `Nothing was deleted. That folder could not be listed (${group.listingError}).` };
    }
    if (group.truncated) {
      return {
        ok: false,
        error:
          'Nothing was deleted. This folder has more files than one listing returns, ' +
          'so the verdict below is not the whole folder.',
      };
    }

    // GATE 4 — the broken-read signature: everything left over, nothing in use.
    const inUseEverywhere = report.groups.reduce((n, g) => n + (g.counts['in-use'] ?? 0), 0);
    if (inUseEverywhere === 0) {
      return {
        ok: false,
        error:
          'Nothing was deleted. Not one file in the whole bucket reads as still in ' +
          'use, which is far more likely to be a broken check than a tidy bucket — ' +
          'the logo set and menu icons alone are always in use.',
      };
    }

    const leftover = group.rows.filter((r) => isDeletableUsage(r.usage)).map((r) => r.key);

    // GATE 5 — the admin confirmed a number; it must still be that number.
    if (leftover.length !== args.expectedCount) {
      return {
        ok: false,
        error:
          `Nothing was deleted. You confirmed ${args.expectedCount} files, but this ` +
          `folder now has ${leftover.length} left over. Reload and check again.`,
      };
    }
    if (leftover.length === 0) {
      return { ok: true, deleted: 0, failed: 0 };
    }

    let deleted = 0;
    let failed = 0;
    for (const key of leftover) {
      try {
        assertDeletableKey(key);
        await r2Delete({ bucket: R2_BUCKETS.media, key });
        deleted += 1;
      } catch {
        failed += 1;
      }
    }

    revalidatePath('/admin/website-media');
    return { ok: true, deleted, failed };
  } catch (err) {
    if (isFrameworkControlFlow(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : 'Could not clear that folder.' };
  }
}
