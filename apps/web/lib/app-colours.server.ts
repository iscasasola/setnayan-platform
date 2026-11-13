import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { GLOBAL_SETTINGS_TAGS, rememberedGlobalRead } from '@/lib/global-settings-cache';
import { APP_COLOURS_DEFAULT, parseAppColours, type AppColours } from '@/lib/app-colours';

/**
 * 🎨 THE LIVE APP COLOURS — Admin › Colours (owner 12 Nov 2026; corpus Design_App_Colours_2026-11-12).
 *
 * One admin setting, `platform_settings.app_colours` (JSONB, NULL = the code defaults), written only from Admin ›
 * Colours (`saveAppColours`, audited). The ROOT LAYOUT reads it for every page, so it is the same shape as
 * `getGiftLimitPct`: remembered across requests under `GLOBAL_SETTINGS_TAGS.platformSettings` (the save clears that
 * tag in the same action, so a new set is worn on the next page) — one cached read, never one request per page.
 *
 * ⚠ FAILS TOWARD TODAY'S COLOURS. A refused read is not remembered and returns `APP_COLOURS_DEFAULT` for this page
 * only; a malformed field fails toward its own default (`parseAppColours`). The worst a bad read can do is paint the
 * app as it looked before the setting existed.
 *
 * Service-role read, like the gift limit: the row is the same for every reader, so it is cache-safe (the
 * `global-settings-cache` rule — rows, never an answer about somebody).
 */
export async function getAppColours(): Promise<AppColours> {
  try {
    const raw = await rememberedGlobalRead('platform_settings-app-colours-v1', GLOBAL_SETTINGS_TAGS.platformSettings, async () => {
      const admin = createAdminClient();
      const res = await admin.from('platform_settings').select('app_colours').eq('id', 1).maybeSingle();
      // ⚠ Supabase RESOLVES with `{ error }`; it does not throw. Checked explicitly so a refused read is never cached.
      if (res.error) throw res.error;
      return ((res.data as { app_colours?: unknown } | null)?.app_colours ?? null) as unknown;
    });
    return parseAppColours(raw);
  } catch {
    return APP_COLOURS_DEFAULT;
  }
}
