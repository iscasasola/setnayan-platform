import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * ONE KEY OF `events.style_preferences`, READ-MERGE-WRITTEN.
 *
 * `style_preferences` is one JSON blob that several features share — the
 * onboarding picks, the QR look (`.qr`), the scene styles of the fixed parts
 * (`.scene_styles`), a pending inquiry. A writer that replaced the blob would
 * erase every other feature's keys, so every writer goes through here: read
 * the row, change ONE key (`next(current)`; `undefined` takes the key off),
 * write the whole blob back, and prove a row changed.
 *
 * Admin client, deliberately: `authenticated` holds no UPDATE grant on this
 * column. Every caller has already run the host check (and any entitlement
 * check) before it gets here — this function asks neither.
 */
export type StylePreferenceWrite =
  | { ok: true; before: unknown }
  | { ok: false; stage: 'read' | 'write'; message: string };

export async function writeStylePreferenceKey(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  key: string,
  next: (current: unknown) => unknown,
): Promise<StylePreferenceWrite> {
  const { data: row, error: readErr } = await admin
    .from('events')
    .select('style_preferences')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readErr || !row) return { ok: false, stage: 'read', message: readErr?.message ?? 'no event row' };
  const raw = (row as { style_preferences?: unknown }).style_preferences;
  const prefs: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
  const before = prefs[key];
  const value = next(before);
  if (value === undefined) delete prefs[key];
  else prefs[key] = value;
  // 🔑 A zero-row UPDATE returns no error — "saved" over an untouched row is the
  // failure that looks exactly like success, so the row must come back.
  const { data: rows, error: writeErr } = await admin
    .from('events')
    .update({ style_preferences: prefs })
    .eq('event_id', eventId)
    .select('event_id');
  if (writeErr || !Array.isArray(rows) || rows.length === 0) {
    return { ok: false, stage: 'write', message: writeErr?.message ?? 'no row was written' };
  }
  return { ok: true, before };
}
