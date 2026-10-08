import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import { readHubDraft } from '@/lib/hub-draft-store';
import { readFinalizeState, resolveLivePax } from '@/lib/pax';
import { resolveReplyBy, sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { toInviteCount } from '@/lib/guest-roster-view';
import { GuestSetupRows } from '../../../_components/guest-setup/guest-setup-rows';
import { readOneLink } from '../../../_components/guest-setup/one-link.server';

/**
 * invite-panel.tsx — GUESTS › SETUP, the guest list's third segment
 * (`?gview=share`, labelled **Setup**).
 *
 * ⚖ Owner 2026-10-07 (DECISION_LOG "GUESTS › SETUP"): *"Setup?"* · *"do we
 * place here the information we need per guest? how to get in? The replies will
 * be at the event hub maker. but guests settings is here."* The Share-the-link
 * panel that lived here moved WHOLE to `share-link-panel.tsx` (the invite page
 * `/guests/invite` still renders it, with Regenerate); this file is now the
 * settings the Maker reads, drawn by `GuestSetupRows`.
 *
 * Every read here has its own failure word — a refused read never renders as
 * a default ("Only my list") or a zero ("0 to invite"):
 *   · `rsvp_ask_config` (drafted over live — the Maker's own reading) → the rows
 *     are not offered at all when it cannot be read;
 *   · the guest list → "We couldn't count who is left to invite";
 *
 * 🔒 Couple-only, like the panel it replaces: these are the couple's settings,
 * and Finalize is money. A non-couple viewer gets a note, never the controls.
 */
export async function InvitePanel({ eventId }: { eventId: string }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: membership } = user
    ? await supabase
        .from('event_members')
        .select('member_type')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .eq('member_type', 'couple')
        .maybeSingle()
    : { data: null };
  if (!membership) {
    return <p className="mt-6 text-center text-sm text-ink/70">Only the couple can change the guest setup.</p>;
  }

  const [eventRes, draft, guests, finalize, oneLink, livePax] = await Promise.all([
    supabase
      .from('events')
      .select('rsvp_ask_config, guest_list_edit_deadline, adaptive_pricing_mode, event_date')
      .eq('event_id', eventId)
      .maybeSingle(),
    readHubDraft(supabase, eventId).catch(() => undefined),
    fetchGuestsByEventMeasured(supabase, eventId),
    readFinalizeState(supabase, eventId),
    readOneLink(supabase, eventId),
    resolveLivePax(supabase, eventId).catch(() => null),
  ]);
  if (eventRes.error || !eventRes.data || draft === undefined) {
    if (eventRes.error) logQueryError('GuestSetup (events)', eventRes.error, { event_id: eventId }, 'graceful_degrade');
    return (
      <p role="alert" className="mt-6 text-sm text-terracotta-700">
        We couldn&rsquo;t read your guest setup just now. Nothing was changed — try again in a moment.
      </p>
    );
  }
  const row = eventRes.data as {
    rsvp_ask_config: unknown;
    guest_list_edit_deadline: string | null;
    adaptive_pricing_mode: string | null;
    event_date: string | null;
  };
  /* The Maker's own reading: the draft's config when it holds one, else the live one. */
  const drafted = Boolean(draft && 'rsvp_ask_config' in draft.events);
  const config = sanitizeRsvpAskConfig(drafted ? draft!.events.rsvp_ask_config : row.rsvp_ask_config);

  /* "Send to N" — the ONE "to invite" rule (`isToInvite`): the List's number, and the
     send run's. A refused read is null ("We couldn't count…"), never 0. */
  const toInvite = toInviteCount(guests.rows, guests.measured);
  const attending = guests.measured ? guests.rows.filter((g) => g.rsvp_status === 'attending').length : null;

  return (
    <GuestSetupRows
      eventId={eventId}
      config={config}
      drafted={drafted}
      reply={{
        own: row.guest_list_edit_deadline,
        pricingMode: row.adaptive_pricing_mode === 'final_only' ? 'final_only' : 'realtime',
        fallback: resolveReplyBy({ deadline: null, eventDate: row.event_date })?.date ?? null,
      }}
      toInvite={toInvite}
      passSrc={`/api/hub-print/pass?event=${eventId}&mode=screen&pass_guest=first`}
      oneLink={oneLink}
      headcount={{ locked: finalize.locked, attending, heads: finalize.locked ? finalize.finalPax : livePax }}
    />
  );
}
