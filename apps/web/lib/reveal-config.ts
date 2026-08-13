/**
 * Reveal Studio config — the admin-managed house defaults for the Save-the-Date
 * opening reveal (bridal-veil / envelope / doors).
 *
 * Setnayan HQ edits this at /admin/reveal-studio; it persists as a single JSONB
 * row (`reveal_studio_config`, id=1, read-all RLS, admin-write via service role —
 * the platform_settings / homepage_hero_config recipe). The public couple site
 * reads the row and merges it over the LOCKED code defaults below (the
 * owner-tuned 2026-06-17 settings, spec `0024_Veil_Reveal_Spec_2026-06-17.md`
 * §6), so a missing or partial row always resolves to the signed-off look.
 *
 * ⚠ THE SHAPE ITSELF NO LONGER LIVES HERE — it is in `./reveal-config-pure`,
 * because this module reaches `createAdminClient` and the renderers that need
 * DEFAULT_VEIL_LOOK / DEFAULT_EFFECTS_LOOK / REVEAL_TEMPLATE_IDS as VALUES are
 * `'use client'` components. This file is now just the READER: the row fetch
 * plus a re-export, so every server import path stays exactly as it was.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_REVEAL_CONFIG,
  mergeRevealConfig,
  type RevealStudioConfig,
} from '@/lib/reveal-config-pure';

/**
 * The shape, the locked defaults and the merge live in `./reveal-config-pure`
 * so `'use client'` renderers can import them as values. Re-exported here so
 * every existing server import path (`@/lib/reveal-config`) keeps working.
 */
export * from '@/lib/reveal-config-pure';

/**
 * Read the single reveal-studio row and resolve the effective config. Public
 * (read-all RLS) — read via the service-role client so it never depends on a
 * visitor session, exactly like the hero-video read path. Always falls back to
 * the locked defaults (never throws on the couple page).
 */
export const fetchRevealConfig = cache(async (): Promise<RevealStudioConfig> => {
  try {
    const db = createAdminClient();
    const { data } = await db.from('reveal_studio_config').select('config').eq('id', 1).maybeSingle();
    return mergeRevealConfig((data as { config?: unknown } | null)?.config);
  } catch {
    return DEFAULT_REVEAL_CONFIG;
  }
});
