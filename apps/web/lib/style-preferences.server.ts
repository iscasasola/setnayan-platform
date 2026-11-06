import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { updateJsonColumn, type JsonColumnClient } from '@/lib/update-json-column';

/**
 * ONE KEY OF `events.style_preferences`, READ-MERGE-WRITTEN.
 *
 * `style_preferences` is one JSON blob that several features share — the
 * onboarding picks, the QR look (`.qr`), the scene styles of the fixed parts
 * (`.scene_styles`), a pending inquiry. A writer that replaced the blob would
 * erase every other feature's keys, so every writer goes through here: read
 * the row, change ONE key (`next(current)`; `undefined` takes the key off),
 * write the whole blob back only if it is still the blob read (built again if
 * not — `updateJsonColumn`), and prove a row changed.
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
  /* 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18, round 2): the ONE key is changed on the blob AS IT IS
     when the write lands (`updateJsonColumn`, a compare-and-set on the value) — another feature's key (the QR look,
     a pending inquiry) written between this read and this write stays. Its write proves its row. */
  let before: unknown;
  try {
    const wrote = await updateJsonColumn(
      admin as unknown as JsonColumnClient,
      { table: 'events', row: { event_id: eventId }, column: 'style_preferences', what: 'Your style' },
      (raw) => {
        const prefs: Record<string, unknown> =
          raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
        before = prefs[key];
        const value = next(before);
        if (value === undefined) delete prefs[key];
        else prefs[key] = value;
        return { next: prefs };
      },
    );
    if (!wrote.found) return { ok: false, stage: 'read', message: 'no event row' };
    if (!wrote.written) return { ok: false, stage: 'write', message: 'no row was written' };
  } catch (e) {
    return { ok: false, stage: 'write', message: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, before };
}
