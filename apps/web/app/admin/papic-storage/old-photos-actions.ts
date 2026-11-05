'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { makeSmallCopies, type CopyRun } from '@/lib/old-photo-copies.server';

/**
 * "Make small copies of old photos" (owner 2026-10-23) — the ONE write, and only from an admin's press. The page's
 * dry run (`listOldPhotos`) has already shown what this will touch; each press makes a few copies, largest first,
 * and reports what is left. The original of every photo stays where it is (`lib/old-photo-copies.server.ts`).
 */
export async function makeSmallCopiesOfOldPhotosAction(): Promise<CopyRun> {
  const { userId } = await requireAdminAction();
  try {
    const run = await makeSmallCopies(createAdminClient(), userId);
    revalidatePath('/admin/papic-storage');
    return run;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
