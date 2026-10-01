import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveProfile } from '@/lib/event-type-profile';
import { parsePrintDetails } from '@/lib/print-pieces';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { InviteEventFacts } from '@/lib/guest-invite-message';

/**
 * EVERYTHING A "SEND INVITE" NEEDS THAT IS NOT THE GUEST — read once per page.
 *
 * The event's facts (its name, its type's word, the solemn register, the date)
 * and the couple's own wording, if they reworded it
 * (`events.print_details.invite_message`, the Maker's Details › Words jsonb —
 * see `StoredPrintDetails.inviteMessage`).
 *
 * 🔑 READ ON THE CALLER'S OWN SESSION. Every column here is granted to
 * `authenticated` (display_name/event_type/event_date/event_date_precision in
 * 20271007100000, print_details in 20271247112792), and the callers are the
 * guest card and the one-by-one run — host screens, already gated.
 *
 * ⚠ A REFUSED READ DEGRADES TO OUR WORDING, never to a broken message: the
 * builder still writes "Hi Maria! … our wedding …" with the guest's own link.
 * It is logged so "no facts" and "couldn't read them" never look alike in
 * Sentry.
 */
export type InviteSetup = {
  facts: InviteEventFacts;
  /** The couple's own wording, or null = ours. */
  template: string | null;
  slug: string | null;
};

export async function loadInviteSetup(
  supabase: SupabaseClient,
  eventId: string,
): Promise<InviteSetup> {
  const { data, error } = await supabase
    .from('events')
    .select('display_name, event_type, event_date, event_date_precision, slug, print_details')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    logQueryError('loadInviteSetup (events)', error, { event_id: eventId }, 'graceful_degrade');
  }
  const row = (data ?? null) as {
    display_name?: string | null;
    event_type?: string | null;
    event_date?: string | null;
    event_date_precision?: string | null;
    slug?: string | null;
    print_details?: unknown;
  } | null;
  // `resolveProfile` degrades itself (wedding → WEDDING_PROFILE, anything else
  // → the generic 'host'/'event' words), so this never throws a page.
  const profile = await resolveProfile(row?.event_type ?? 'wedding');
  const stored = parsePrintDetails(row?.print_details ?? null);
  return {
    facts: {
      hostsName: row?.display_name ?? null,
      eventWord: profile.terminology.eventWord,
      solemn: profile.terminology.register === 'solemn',
      eventDate: row?.event_date ?? null,
      datePrecision: row?.event_date_precision ?? null,
      // 🔤 The event's Name style — `{name}` is composed in it (owner 2026-09-30).
      nameStyle: stored.nameStyle,
    },
    template: stored.inviteMessage,
    slug: row?.slug ?? null,
  };
}
