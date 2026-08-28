import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { regionLabel } from '@/lib/region-source';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';

/**
 * inquiry-mask.server.ts — server-only companions to lib/inquiry-mask.ts for
 * vendor inquiry anonymization-until-accept (Glass PR-6b). Region resolution +
 * the admin-scoped, non-identifying fact read live here so the pure primitives
 * stay dependency-free + unit-testable. Re-exports the pure predicate/placeholder
 * for one-stop imports on the server.
 */
export {
  isInquiryRevealed,
  inquiryPlaceholderLabel,
  INQUIRY_MASK_UNKNOWN,
  GENERIC_HOST_NOUN,
} from '@/lib/inquiry-mask';

/** City/area-level label from a region slug — never a venue name or address. */
export function inquiryCityLabel(region: string | null | undefined): string | null {
  return regionLabel(region);
}

/**
 * THE ORGANISER NOUN FOR A MASKED INQUIRY — the single place that decides what
 * "we do not know the event type" means for this sentence.
 *
 * 🔑 IT IS DELIBERATELY *NOT* `eventWordsFor(type ?? 'wedding')`. Every guest-tree
 * caller resolves a null type as a wedding, which is right there — the guest is
 * standing on a wedding's page. Here a null type means the batched fact read
 * came back without one, and answering "couple" would re-introduce the exact
 * assumption this function exists to remove. Unknown returns `null`, and the
 * placeholder renders the generic noun.
 *
 * ⚠ THE HOST NOUN, NOT THE ORGANISER NOUN. Four seeded types carry an
 * `organizer_noun` that names the person the event is ABOUT rather than the one
 * planning it — birthday and anniversary and debut are all 'celebrant',
 * graduation is 'graduate'. A supplier reading "A celebrant planning a debut"
 * is being told the debutante booked her own party; her parents did. The
 * profile's `hostNoun` is the axis that already answers "who does the admin
 * work", and for a wedding both nouns are 'couple' — which is what keeps this
 * change byte-identical on the only type anyone has booked in production.
 *
 * The profile read is public: `event_type_profiles` carries a `USING (true)`
 * SELECT policy for PUBLIC and grants SELECT on all 17 columns to `anon` and
 * `authenticated` (measured in prod 2026-08-27), so this resolves from any
 * session. It does NOT read `public.events` — every caller already holds the
 * event type from an admin-scoped read, because a vendor holds no `events` RLS.
 */
export async function inquiryHostNoun(
  eventType: string | null | undefined,
): Promise<string | null> {
  if (!eventType) return null;
  return (await eventWordsFor(eventType)).host;
}

/**
 * Host nouns for a batch of event types, keyed by type. `resolveProfile` is
 * React-`cache()`d per request, so repeated types cost one read between them
 * and there are at most seventeen distinct types in existence.
 */
export async function inquiryHostNounsByType(
  eventTypes: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const types = Array.from(
    new Set(eventTypes.filter((t): t is string => typeof t === 'string' && t.length > 0)),
  );
  for (const t of types) {
    const noun = await inquiryHostNoun(t);
    if (noun) out.set(t, noun);
  }
  return out;
}

/** The non-identifying facts needed to render a masked inquiry placeholder. */
export type InquiryMaskMeta = {
  eventType: string | null;
  city: string | null;
  /** The organiser noun for this event's type. `null` when unresolved. */
  hostNoun: string | null;
};

/**
 * Batched, admin-scoped read of the non-identifying facts (event type +
 * city-level region) for a set of PENDING inquiries' events. The caller passes
 * the event ids of its OWN unrevealed vendor threads; a vendor holds no `events`
 * RLS (not an event_members row until they've booked), so this mirrors the same
 * admin-scoped read pattern already used by vendor-overview.ts / the customers
 * hub — but deliberately selects ONLY `event_type` + `region`, never
 * `display_name` / `venue` / any PII. Best-effort: any error → empty map, and
 * the surface falls back to the generic "A host planning an event" — the
 * organiser noun degrades with everything else rather than guessing a wedding.
 */
export async function fetchInquiryMaskMeta(
  admin: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, InquiryMaskMeta>> {
  const out = new Map<string, InquiryMaskMeta>();
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return out;
  try {
    const { data } = await admin
      .from('events')
      .select('event_id, event_type, region')
      .in('event_id', ids);
    const rows = (data ?? []) as Array<{
      event_id: string;
      event_type: string | null;
      region: string | null;
    }>;
    const nounByType = await inquiryHostNounsByType(rows.map((r) => r.event_type));
    for (const row of rows) {
      out.set(row.event_id, {
        eventType: row.event_type,
        city: regionLabel(row.region),
        hostNoun: row.event_type ? (nounByType.get(row.event_type) ?? null) : null,
      });
    }
  } catch {
    // Best-effort — never let placeholder enrichment break the inbox.
  }
  return out;
}
