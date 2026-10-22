import type { SupabaseClient } from '@supabase/supabase-js';
import { isDependentId } from '@/lib/honoree-dependent-link';

/* ══════════════════════════════════════════════════════════════════════════
 * lib/event-subjects.ts — WHO AN EVENT IS FOR, FOR THE ACCOUNT THAT HOLDS THE SUBJECT
 * (owner 22 Oct 2026, "yes to all": prototypes/for_tag_on_event_cards_2026-10-22.html)
 *
 * `lib/honoree-dependent-link.ts` WRITES `events.honoree_dependent_id`. This answers the
 * question the Events board and the event Home now ask of it: "is this event
 * FOR somebody I hold — my shop, a loved one — and what is their name?"
 *
 * ⚠ THE SAME OWNERSHIP BOUNDARY, READ THE OTHER WAY. The id is re-read from
 * `dependents` under `owner_user_id = <viewer>` (and not handed over), exactly
 * as `resolveHonoreeDependentId` checks it on the way in. So the answer exists
 * ONLY for the account that holds the subject — a helper, a guest or a co-host
 * who does not own the record gets nothing, and their card keeps its own
 * stance chip ("You help with this", "You're invited").
 *
 * ⚠ READ THROUGH `events_host`, NEVER `events`. `authenticated` holds no SELECT
 * on `events.honoree_dependent_id` (migration 20271025120000, deliberately), so
 * naming it on `events` errors for everyone. `events_host` is the couple /
 * moderator-scoped view the People page and the life-event guard already use.
 *
 * ⚠ A FAILED READ IS "NOT KNOWN", AND NOT KNOWN DRAWS NOTHING NEW. Every refusal
 * resolves to "no subject", which keeps the card's stance chip — a true sentence.
 * The one thing this must never do is print a WRONG name, so nothing here
 * guesses one: no record back → no tag.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The subject an event is for, as the account holding it may see it. */
export type EventForSubject = {
  /** The shop's current name (vendor_profiles.business_name) or the record's name. */
  name: string;
  /** `dependents.dependent_kind` — 'business' carries a logo; everyone else, initials. */
  kind: string;
  /** The shop's stored `r2://` logo ref — sign it before drawing (`lib/uploads.ts`). */
  logoRef: string | null;
};

type SubjectEventRow = { event_id: string; honoree_dependent_id: string | null };
type SubjectDependentRow = {
  dependent_id: string;
  name: string | null;
  dependent_kind: string | null;
  vendor_profile_id: string | null;
};
type SubjectShopRow = { vendor_profile_id: string; business_name: string | null; logo_url: string | null };

/**
 * `event_id → EventForSubject` for the events in `eventIds` that are FOR a record
 * `userId` holds. An event absent from the map is for nobody the viewer holds —
 * OR its read failed; both keep the stance chip, which is why they need not be
 * told apart here.
 *
 * `client` is the VIEWER's client (RLS on, `dependents_owner_all` + the explicit
 * owner predicate both apply). No admin client: this is a read for the viewer's
 * own screen, and a service-role read is the wrong tool for "what may I see".
 */
export async function readEventSubjects(
  client: SupabaseClient,
  { userId, eventIds }: { userId: string; eventIds: readonly string[] },
): Promise<Map<string, EventForSubject>> {
  const out = new Map<string, EventForSubject>();
  const ids = [...new Set(eventIds.filter(Boolean))];
  if (!userId || ids.length === 0) return out;
  try {
    const { data: evRows, error: evError } = await client
      .from('events_host')
      .select('event_id, honoree_dependent_id')
      .in('event_id', ids)
      .not('honoree_dependent_id', 'is', null);
    if (evError) {
      console.error('[supabase-error] lib/event-subjects.ts · from:events_host.select', evError);
      return out;
    }
    const linked = ((evRows ?? []) as SubjectEventRow[]).filter(
      (r) => r.event_id && isDependentId(r.honoree_dependent_id),
    );
    if (linked.length === 0) return out;

    const { data: depRows, error: depError } = await client
      .from('dependents')
      .select('dependent_id, name, dependent_kind, vendor_profile_id')
      .in('dependent_id', [...new Set(linked.map((r) => r.honoree_dependent_id as string))])
      // ⚠ THE OWNERSHIP BOUNDARY — the same predicate the write path checks.
      .eq('owner_user_id', userId)
      .is('handed_over_at', null);
    if (depError) {
      console.error('[supabase-error] lib/event-subjects.ts · from:dependents.select', depError);
      return out;
    }
    const deps = new Map(((depRows ?? []) as SubjectDependentRow[]).map((d) => [d.dependent_id, d]));
    if (deps.size === 0) return out;

    // The shop's current name + logo. A refused read keeps the RECORD's name (true, if
    // perhaps older than a rename) and draws initials — never a wrong name, never no tag.
    const shopIds = [...new Set([...deps.values()].map((d) => d.vendor_profile_id).filter((v): v is string => !!v))];
    const shops = new Map<string, SubjectShopRow>();
    if (shopIds.length > 0) {
      const { data: shopRows, error: shopError } = await client
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name, logo_url')
        .in('vendor_profile_id', shopIds);
      if (shopError) {
        console.error('[supabase-error] lib/event-subjects.ts · from:vendor_profiles.select', shopError);
      } else {
        for (const s of (shopRows ?? []) as SubjectShopRow[]) shops.set(s.vendor_profile_id, s);
      }
    }

    for (const r of linked) {
      const dep = deps.get(r.honoree_dependent_id as string);
      if (!dep) continue; // not the viewer's record — their stance chip stays
      const kind = dep.dependent_kind ?? 'person';
      const shop = kind === 'business' && dep.vendor_profile_id ? shops.get(dep.vendor_profile_id) : undefined;
      const name = ((shop?.business_name ?? '').trim() || (dep.name ?? '').trim()).replace(/\s+/g, ' ');
      if (!name) continue; // a nameless record is drawn nowhere — `dependentSubjects` drops it too
      out.set(r.event_id, { name, kind, logoRef: shop?.logo_url ?? null });
    }
    return out;
  } catch (caught) {
    console.error('[supabase-error] lib/event-subjects.ts · readEventSubjects threw', caught);
    return new Map();
  }
}

/**
 * Does THIS card's stance slot say "For <name>" instead of its stance?
 *
 * Only an ORGANISER's card, and only with a subject in hand. A helper's or a
 * guest's card keeps "You help with this" / "You're invited" — for them the
 * subject never resolves anyway (it is not their record), and this says so a
 * second time, so a widened read can never put a name on somebody else's card.
 * Holding the subject means you organise it, so the replaced chip loses nothing.
 */
export function cardShowsForTag(
  stance: 'organiser' | 'invited' | 'helper' | null | undefined,
  subject: { name: string } | null | undefined,
): boolean {
  return stance === 'organiser' && !!subject && subject.name.trim().length > 0;
}
