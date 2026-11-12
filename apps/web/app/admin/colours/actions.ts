'use server';

import { revalidateTag } from 'next/cache';
import { GLOBAL_SETTINGS_TAGS } from '@/lib/global-settings-tags';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import {
  appColoursEqual,
  invalidAppColourFields,
  isDefaultAppColours,
  judgeAppColours,
  parseAppColours,
  type AppColours,
} from '@/lib/app-colours';

/** What a save answers. `saved` is the set now in force (so the screen's "saved" baseline moves with it). */
export type ColoursActionState = { ok: boolean; message: string | null; saved: AppColours | null };

/**
 * 🎨 SAVE THE APP'S COLOURS — Admin › Colours (owner 12 Nov 2026; corpus Design_App_Colours_2026-11-12).
 *
 * The ONE writer of `platform_settings.app_colours`. Copies `saveGiftLimitPct` (app/admin/gifts/gift-limit-actions.ts):
 * admin-gated; the set re-judged HERE with the editor's own rules (`judgeAppColours`), so an unreadable set or two
 * button kinds that look alike are REFUSED with the same words the editor showed; a no-op when unchanged; an
 * `admin_audit_log` row (`app_colours_edit`, before → after); the platform-settings tag cleared and the root layout
 * cleared so the next page wears it (the root layout reads through that tag — no layout-wide revalidatePath, which would re-inflate the vendor dashboard layout). A set equal to today's colours is stored as NULL (nothing to emit).
 */
export async function saveAppColours(_prev: ColoursActionState, formData: FormData): Promise<ColoursActionState> {
  const { userId } = await requireAdminAction();

  // "Reset to current" — the app goes back to today's colours: the column is set to NULL (the code defaults). One
  // exported action for both buttons: every exported server action is a Vercel route (lint-server-action-budget).
  if (formData.get('op') === 'reset') return writeColours(userId, null, 'Back to the app’s current colours. Saved.');

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('app_colours') ?? ''));
  } catch {
    return { ok: false, message: 'Not saved — the colours did not arrive whole. Try again.', saved: null };
  }
  const bad = invalidAppColourFields(raw);
  if (bad.length) return { ok: false, message: `Not saved — these are not colours we can use: ${bad.join(', ')}.`, saved: null };

  const next = parseAppColours(raw);
  const verdict = judgeAppColours(next);
  if (verdict.refusals.length) return { ok: false, message: `Not saved. ${verdict.refusals[0]}`, saved: null };

  return writeColours(userId, isDefaultAppColours(next) ? null : next, 'Saved. Every screen except the guest Event Hub.');
}

async function writeColours(adminUserId: string, next: AppColours | null, said: string): Promise<ColoursActionState> {
  const admin = createAdminClient();
  const { data: prior, error: readError } = await admin
    .from('platform_settings')
    .select('app_colours')
    .eq('id', 1)
    .maybeSingle();
  if (readError) return { ok: false, message: `Couldn't read the current colours — ${readError.message}`, saved: null };
  const beforeRaw = (prior as { app_colours?: unknown } | null)?.app_colours ?? null;
  const before = beforeRaw == null ? null : parseAppColours(beforeRaw);
  const nextFull = next ?? parseAppColours(null);
  if ((before == null && next == null) || (before != null && next != null && appColoursEqual(before, next))) {
    return { ok: true, message: 'No changes to save.', saved: nextFull };
  }

  const { error } = await admin
    .from('platform_settings')
    .update({ app_colours: next, updated_at: new Date().toISOString() })
    .eq('id', 1);
  revalidateTag(GLOBAL_SETTINGS_TAGS.platformSettings);
  if (error) return { ok: false, message: `Couldn't save — ${error.message}`, saved: null };

  const audit = await admin.from('admin_audit_log').insert({
    action: 'app_colours_edit',
    target_id: 'app_colours',
    actor_user_id: adminUserId,
    metadata: { table: 'platform_settings', before: beforeRaw, after: next },
  });
  // The setting moved; an unwritten audit row is said, never swallowed (Supabase resolves with { error }).
  if (audit.error) {
    console.error('[admin colours] app_colours_edit audit row refused', audit.error);
    return { ok: true, message: `${said} But the audit row did not write — tell the team.`, saved: nextFull };
  }
  return { ok: true, message: said, saved: nextFull };
}
