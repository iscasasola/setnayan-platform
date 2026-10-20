/**
 * event-types-db.ts — the DB-backed read-through for the event-type roster.
 *
 * Owner directive 2026-06-13: event types are admin-driven. The single source
 * is `event_type_vocab` (public read · is_admin() write, migration
 * 20261104000000; presentation columns + the `enabled` launch lever added by
 * 20261204000000). Admins create / launch / retire event types from
 * /admin/event-types (Setnayan HQ) and every consumer — the create-event
 * picker, the EventSwitcher add-event sheet, the vendor "event types you
 * serve" checkboxes, the marketplace ?event_type= filter — adjusts with zero
 * deploys.
 *
 * Two lifecycle fields, two different gates:
 *   - `status`  active/retired — retired types vanish everywhere EXCEPT
 *     historical events (events.event_type keeps an FK, not an active CHECK).
 *   - `enabled` TRUE = appears in the couple-side create-event picker. The
 *     launch lever. Vendors may serve any ACTIVE type regardless of enabled
 *     (pre-tagging coverage before a public unlock) — EXCEPT a type whose
 *     profile says `marketplace_enabled = FALSE` (a vendor-free type, 0053):
 *     supplier readers go through `getVendorServableEventTypes` below, which
 *     drops those. Owner 2026-09-23: "simple event will not show on the
 *     events they serve because simple event does not have a vendor."
 *
 * SAFETY: every read falls back to the EVENT_TYPES_FALLBACK constant (the
 * pre-cutover hardcoded roster) on error or empty result, so a DB hiccup
 * degrades to yesterday's behavior instead of an empty picker — the same
 * contract as lib/taxonomy-db.ts.
 *
 * Cached per request via React `cache()` (same pattern as lib/taxonomy-db) —
 * one vocab read per render tree regardless of how many server components
 * await it — and, since 2026-10-20, remembered ACROSS requests too
 * (`lib/global-settings-cache.ts`), read with the service client: the table is
 * public-read, so no viewer's session is involved.
 */
import { cache } from 'react';

import { createAdminClient } from './supabase/admin';
import { GLOBAL_SETTINGS_TAGS, rememberedGlobalRead } from './global-settings-cache';
import { resolveProfile } from './event-type-profile';
import { vendorServableEventTypes } from './vendor-servable-event-types';
import {
  EVENT_TYPES_FALLBACK,
  type EventTypeRow,
} from '@/app/dashboard/(account)/create-event/_components/event-types';

export type { EventTypeRow };

type VocabRow = {
  event_type: string;
  label_en: string;
  emoji: string | null;
  enabled: boolean | null;
  status: string;
  sort_order: number;
  onboarding_href: string | null;
  hero_photo_url: string | null;
  description: string | null;
};

function toRow(v: VocabRow): EventTypeRow {
  return {
    key: v.event_type,
    label: v.label_en,
    emoji: v.emoji ?? '🎉',
    enabled: v.enabled === true,
    onboardingHref: v.onboarding_href,
    heroPhotoUrl: v.hero_photo_url,
    description: v.description,
  };
}

/**
 * All ACTIVE event types, ordered by sort_order — the roster vendors can
 * serve / the marketplace can filter on. Falls back to the constant.
 */
export const getEventTypeVocab = cache(async (): Promise<EventTypeRow[]> => {
  try {
    // 🧊 Remembered across requests (`lib/global-settings-cache.ts`, 2026-10-20) under
    // `GLOBAL_SETTINGS_TAGS.eventTypeVocab`, which every app writer of the table clears
    // (`lib/global-settings-cache.test.ts` §4). The table is public-read (`USING (TRUE)`), the
    // same rows for every reader, so it is read with the SERVICE client — never the viewer's
    // session, which a remembered read must not touch. A refused read throws inside, is never
    // remembered, and lands on the fallback roster for this page only — as before.
    const data = await rememberedGlobalRead('event_type_vocab-active-v1', GLOBAL_SETTINGS_TAGS.eventTypeVocab, async () => {
      const { data: rows, error } = await createAdminClient()
        .from('event_type_vocab')
        .select(
          'event_type, label_en, emoji, enabled, status, sort_order, onboarding_href, hero_photo_url, description',
        )
        .eq('status', 'active')
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('[supabase-error] lib/event-types-db.ts · from:event_type_vocab.select', error);
        throw error;
      }
      return (rows ?? []) as VocabRow[];
    });
    if (data.length === 0) return [...EVENT_TYPES_FALLBACK];
    return data.map(toRow);
  } catch {
    return [...EVENT_TYPES_FALLBACK];
  }
});

/**
 * The same roster from rows SOMEBODY ELSE ALREADY READ — the viewer-free sibling
 * of `getEventTypeVocab`, for a caller that holds the ACTIVE `event_type_vocab`
 * rows in roster order (the home page remembers them). The table is public-read
 * (`USING (TRUE)`), so these are the rows the session read returns; they go
 * through the same `toRow`, and an empty result is the same fallback roster.
 * Pure: no read, no session.
 */
export function eventTypesFromPublicRows(
  rows: ReadonlyArray<Record<string, unknown> & { event_type: string }>,
): EventTypeRow[] {
  if (rows.length === 0) return [...EVENT_TYPES_FALLBACK];
  return rows.map((r) => toRow(r as unknown as VocabRow));
}

/**
 * The couple-side create-event roster: ACTIVE + ENABLED only. What the
 * full-page picker, the EventSwitcher add-event sheet, and the create-event
 * server action accept.
 */
export const getCreatableEventTypes = cache(async (): Promise<EventTypeRow[]> => {
  const all = await getEventTypeVocab();
  return all.filter((t) => t.enabled);
});

/**
 * The roster a SUPPLIER may claim — the active vocab minus every type whose
 * `event_type_profiles.marketplace_enabled` is FALSE. Use this for every
 * vendor-side picker and validator ("Events you serve", a service card's
 * audience, coverage). The couple side keeps `getEventTypeVocab`: a
 * vendor-free type must still be creatable, it just has no suppliers.
 *
 * Fails toward the profile's own fallback: if the profiles read errors, each
 * type is resolved through `resolveProfile` (which degrades to its code
 * fallback), so a DB hiccup never re-opens the picker to a vendor-free type.
 */
export const getVendorServableEventTypes = cache(async (): Promise<EventTypeRow[]> => {
  const vocab = await getEventTypeVocab();
  const flags = new Map<string, boolean | null>();
  try {
    // 🧊 Remembered (`lib/global-settings-cache.ts`), cleared by the profile writer
    // (app/admin/categories/event-type-actions.ts → `GLOBAL_SETTINGS_TAGS.eventTypeProfiles`).
    // Public-read rows, read with the service client; a refused read throws inside and is
    // never remembered.
    const data = await rememberedGlobalRead('event_type_profiles-marketplace-v1', GLOBAL_SETTINGS_TAGS.eventTypeProfiles, async () => {
      const { data: rows, error } = await createAdminClient()
        .from('event_type_profiles')
        .select('event_type, marketplace_enabled');
      if (error) throw error;
      return (rows ?? []) as { event_type: string; marketplace_enabled: boolean | null }[];
    });
    for (const r of data) {
      flags.set(r.event_type, r.marketplace_enabled);
    }
  } catch (err) {
    console.error('[supabase-error] lib/event-types-db.ts · from:event_type_profiles.select (marketplace_enabled)', err);
    for (const t of vocab) flags.set(t.key, (await resolveProfile(t.key)).marketplaceEnabled);
  }
  return vendorServableEventTypes(vocab, flags);
});
