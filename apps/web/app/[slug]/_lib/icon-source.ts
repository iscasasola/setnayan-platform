import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { canViewSlugEvent } from '@/lib/slug-access';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { deriveMonogram } from '@/lib/monogram';
import { buildSitePaletteVars } from '@/lib/site-palette';
import type { RolePalette } from '@/lib/mood-board';

/**
 * The facts the per-event icon and manifest routes need, read once.
 *
 * 🔒 EVERY ONE OF THOSE ROUTES IS A PUBLIC URL, so each asks the same
 * visibility question the invitation itself asks (`canViewSlugEvent`). A
 * private wedding's icon would otherwise answer "this couple exists, here are
 * their names and their mark" to anyone who guessed the address — the same
 * leak the `/api/og/*` routes had to be taught about, for the same reason:
 * they read with the ADMIN client, which has no RLS to fall back on.
 *
 * Returns null for "no such event, or not yours to see". The caller answers 404
 * — never a placeholder icon, which would confirm the address exists.
 */

export type EventIconSource = {
  slug: string;
  displayName: string | null;
  eventDate: string | null;
  markSvg: string | null;
  initials: string;
  background: string;
};

/** The ground for the tile: the couple's own paper, else the app's. */
function paperFromPalette(rolePalette: unknown): string {
  const vars = buildSitePaletteVars((rolePalette ?? null) as RolePalette | null);
  const channels = vars?.['--color-cream'];
  if (typeof channels !== 'string') return '#FBFBFA';
  const parts = channels.trim().split(/\s+/).map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return '#FBFBFA';
  return `#${parts.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export async function loadEventIconSource(slug: string): Promise<EventIconSource | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('events')
    .select(
      'event_id, slug, display_name, event_date, landing_page_visibility, monogram_uploaded_svg, monogram_custom_svg, monogram_text, role_palette',
    )
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] app/[slug]/_lib/icon-source.ts · event read', error);
    return null;
  }
  if (!data) return null;

  const row = data as {
    event_id: string;
    slug: string | null;
    display_name: string | null;
    event_date: string | null;
    landing_page_visibility: string | null;
    monogram_text: string | null;
    role_palette: unknown;
  };

  if (!(await canViewSlugEvent(row.event_id, row.landing_page_visibility))) return null;

  return {
    slug: row.slug ?? slug,
    displayName: row.display_name,
    eventDate: row.event_date,
    // Already sanitized by safeMonogramSvg inside the resolver.
    markSvg: resolveEventMonogramSvg(data as never),
    initials: row.monogram_text?.trim() || deriveMonogram(row.display_name),
    background: paperFromPalette(row.role_palette),
  };
}
