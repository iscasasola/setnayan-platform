/**
 * apps/web/lib/patiktok-booth-templates.ts — the booth's PRIMARY + BACKUP
 * template pick, and where it is kept.
 *
 * THE BUG THIS FIXES (audit 2026-09-29): the booth's "Change primary" linked to
 * the template gallery with `?role=primary&other=…`, and the gallery ignored
 * both — so a couple could browse, tap "Choose template", and land on a render
 * page with the booth still showing the defaults. The choice never saved.
 *
 * WHERE IT IS KEPT — a per-event cookie on the device that chose it. Honest
 * scope: there is no column for this pick (no `patiktok_*` table carries it) and
 * this change adds no migration, so another phone opening the booth sees the
 * defaults until it chooses too. A shared, cross-device pick needs a column —
 * an owner/controller decision, not something to smuggle into a copy fix.
 *
 * Pure (no `next/headers`), so the parse is unit-tested without a request.
 */

import { PATIKTOK_TEMPLATES, findPatiktokTemplate, type PatiktokTemplate } from '@/lib/patiktok';

/**
 * One cookie per event; the event id is a UUID, safe in a cookie name.
 *
 * 🏠 SCOPED TO THE EVENT, NOT THE BOOTH (2026-10-24): Home's Video booth card shows and changes the same pick (owner
 * 2026-10-23, `home_service_widgets_2026-10-23.html` frame 8: "Primary template ▾ · Backup template ▾"), so the cookie
 * lives at `/dashboard/<event>`. It has a NEW name (`_v2_`) because the old one sat at the narrower Patiktok path: a
 * browser sends the narrower cookie FIRST, so re-using the name would let an old pick shadow every new one on the
 * booth pages, and one response cannot both set and clear one name. The old one is still READ as a fallback
 * (`patiktokBoothLegacyCookieName`) and simply expires.
 */
export function patiktokBoothCookieName(eventId: string): string {
  return `sn_patiktok_booth_v2_${eventId}`;
}

/** The pick's cookie before 2026-10-24 (the Patiktok pages only) — read as a fallback on those pages, never written. */
export function patiktokBoothLegacyCookieName(eventId: string): string {
  return `sn_patiktok_booth_${eventId}`;
}

export function patiktokBoothCookiePath(eventId: string): string {
  return `/dashboard/${eventId}`;
}

export const PATIKTOK_BOOTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function serializeBoothTemplates(primary: string, backup: string): string {
  return `${primary}|${backup}`;
}

export type BoothTemplates = { primary: PatiktokTemplate; backup: PatiktokTemplate };

/**
 * Resolve the booth's two templates. Precedence: an explicit `?primary=&backup=`
 * (older links, the swap preview) → the saved cookie → the catalogue's first two.
 * Unknown slugs fall through; a backup equal to the primary is replaced so the
 * booth never offers the same template twice.
 */
export function resolveBoothTemplates(input: {
  primaryParam?: string | null;
  backupParam?: string | null;
  saved?: string | null;
}): BoothTemplates {
  const [savedPrimary, savedBackup] = (input.saved ?? '').split('|');
  const pick = (...slugs: Array<string | null | undefined>) => {
    for (const s of slugs) {
      const t = s ? findPatiktokTemplate(s) : null;
      if (t) return t;
    }
    return null;
  };
  const primary = pick(input.primaryParam, savedPrimary) ?? PATIKTOK_TEMPLATES[0];
  let backup = pick(input.backupParam, savedBackup) ?? PATIKTOK_TEMPLATES[1];
  if (backup.slug === primary.slug) {
    backup = PATIKTOK_TEMPLATES.find((t) => t.slug !== primary.slug) ?? backup;
  }
  return { primary, backup };
}
