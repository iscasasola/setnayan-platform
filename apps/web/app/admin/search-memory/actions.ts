'use server';

/**
 * Server actions for /admin/search-memory.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `admin_search_phrases` had no surface at all: a phrase the AI got wrong was
 * wrong FOREVER, silently, and `learned_from` admitted the value `'admin'` —
 * "a person taught it" — with nothing anywhere that ever wrote it. Both close
 * here: Delete removes a row outright, and "Teach it this instead" corrects
 * the destination and stamps `learned_from: 'admin'`, which is the writer that
 * value was missing (the 2026-08-26 audit's own recommendation: "build the
 * teach-it door or drop the value" — this builds it).
 *
 * ── SAFETY ───────────────────────────────────────────────────────────────────
 * Both actions gate with `requireAdminAction()` and both re-validate the href
 * against the scanned route map before writing it — the same check
 * `ask-the-admin.ts` applies to a model's own answer. A person correcting a
 * phrase is not exempt from the rule that keeps this table honest.
 */

import { revalidatePath } from 'next/cache';

import { requireAdminAction } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { isKnownAdminHref, normalisePhrase } from '@/lib/admin-map/ask-the-admin';

type Result = { ok: true } | { ok: false; error: string };

export async function deleteSearchPhraseAction(phrase: string): Promise<Result> {
  await requireAdminAction();
  const normalised = normalisePhrase(phrase);
  if (!normalised) return { ok: false, error: 'No phrase given.' };

  const admin = createAdminClient();
  const { error } = await admin.from('admin_search_phrases').delete().eq('phrase', normalised);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/search-memory');
  return { ok: true };
}

export async function teachSearchPhraseAction(
  phrase: string,
  href: string,
  label: string,
): Promise<Result> {
  await requireAdminAction();
  const normalised = normalisePhrase(phrase);
  if (!normalised) return { ok: false, error: 'No phrase given.' };
  if (!label.trim()) return { ok: false, error: 'No destination chosen.' };
  // The same floor the AI's own answer is held to — a page that moved, or a
  // hand-typed address that never existed, is refused here too.
  if (!isKnownAdminHref(href)) return { ok: false, error: 'That is not a page this admin has.' };

  const admin = createAdminClient();
  const { error } = await admin.from('admin_search_phrases').upsert(
    {
      phrase: normalised,
      href,
      label: label.trim(),
      learned_from: 'admin',
      // A correction is not a first use — leave times_used as it stands (the
      // upsert's own DEFAULT only applies on a brand-new row) rather than
      // resetting a count that was true a moment ago.
    },
    { onConflict: 'phrase' },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/search-memory');
  return { ok: true };
}
