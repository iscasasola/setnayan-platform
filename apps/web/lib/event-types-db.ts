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
 * await it. Server-only — reads cookies via the Supabase client.
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
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
    const sb = await createClient();
    const { data, error } = await sb
      .from('event_type_vocab')
      .select(
        'event_type, label_en, emoji, enabled, status, sort_order, onboarding_href, hero_photo_url, description',
      )
      .eq('status', 'active')
      .order('sort_order', { ascending: true });
    if (error) console.error('[supabase-error] lib/event-types-db.ts · from:event_type_vocab.select', error);
    if (error || !data || data.length === 0) return [...EVENT_TYPES_FALLBACK];
    return (data as VocabRow[]).map(toRow);
  } catch {
    return [...EVENT_TYPES_FALLBACK];
  }
});

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
    const sb = await createClient();
    const { data, error } = await sb
      .from('event_type_profiles')
      .select('event_type, marketplace_enabled');
    if (error) throw error;
    for (const r of (data ?? []) as { event_type: string; marketplace_enabled: boolean | null }[]) {
      flags.set(r.event_type, r.marketplace_enabled);
    }
  } catch (err) {
    console.error('[supabase-error] lib/event-types-db.ts · from:event_type_profiles.select (marketplace_enabled)', err);
    for (const t of vocab) flags.set(t.key, (await resolveProfile(t.key)).marketplaceEnabled);
  }
  return vendorServableEventTypes(vocab, flags);
});
