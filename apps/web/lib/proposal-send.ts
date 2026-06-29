import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { notifyOtherParty } from '@/lib/chat-actions';
import { tierCaps } from '@/lib/vendor-tier-caps';
import { resolveTokens, formatCentavos } from '@/lib/vendor-proposals';
import {
  resolveProposalValues,
  resolvePackageLineItems,
  minimalBrief,
  type ProposalBrief,
} from '@/lib/proposal-merge';

/**
 * Shared CORE for the in-chat vendor proposal (a "quote" is simply a proposal
 * with a total). Split out of the collocated server action so the SAME
 * ownership + accepted-thread gating + draft→sent freeze runs under both the
 * web action (sendProposalFromChat) and the native endpoint
 * (api/vendor/chat/[threadId]/proposal). The caller passes its OWN RLS-scoped
 * client; we never write a price the couple didn't accept — acceptance still
 * goes through the DB-guarded respond_vendor_proposal RPC.
 */

export type SendProposalError =
  | 'unauthenticated'
  | 'not_owner'
  | 'thread_closed'
  | 'tier_free'
  | 'needs_template'
  | 'failed';

export type SendProposalResult =
  | { ok: true; proposalId: string; publicId: string; cardPosted: boolean; priceLabel: string }
  | { ok: false; code: SendProposalError; message: string };

export interface SendProposalInput {
  threadId: string;
  templateId: string;
  /** Optional — falls back to the template's default package. */
  packageId?: string | null;
  /** Optional manual total (PHP) used only when no package priced it. */
  totalPhp?: number | null;
  /** Optional YYYY-MM-DD quote expiry. */
  validUntil?: string | null;
  /** Optional custom title. */
  title?: string | null;
}

export async function sendProposalCore(
  supabase: SupabaseClient,
  input: SendProposalInput,
): Promise<SendProposalResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: 'unauthenticated', message: 'Sign in again to send a proposal.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, code: 'not_owner', message: 'No vendor profile for this account.' };

  const thread = await fetchThreadById(supabase, input.threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    return { ok: false, code: 'not_owner', message: 'This conversation isn’t yours.' };
  }
  // A proposal is a real reply — only on an open (accepted) conversation.
  if (thread.inquiry_status !== 'accepted') {
    return {
      ok: false,
      code: 'thread_closed',
      message: 'You can only send a proposal on an open conversation.',
    };
  }

  // FREE-tier block — a proposal posts a vendor chat_messages row, so it must
  // clear the SAME in-app messaging gate sendChatMessageCore enforces. Without
  // this, a FREE vendor on an admin-accepted thread (accepted via the
  // service-role path that skips unlock_vendor_event's TIER_FREE_NO_INAPP) could
  // post a proposal card here, bypassing the FREE in-app block. Isolated tier
  // probe (tier_state is excluded from the full profile select).
  // NOTE: mirrors the probe in lib/chat-send.ts — worth extracting into one
  // shared vendor-chat tier-gate helper so the two can't drift.
  {
    let tier: string | null = null;
    try {
      const { data: tierRow } = await supabase
        .from('vendor_profiles')
        .select('tier_state')
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle();
      tier = (tierRow as { tier_state?: string } | null)?.tier_state ?? null;
    } catch {
      tier = null;
    }
    if (tierCaps(tier).chat === 'none') {
      return {
        ok: false,
        code: 'tier_free',
        message: 'Get your account verified to message couples in the app.',
      };
    }
  }

  const templateId = input.templateId?.trim() ?? '';
  if (!templateId) return { ok: false, code: 'needs_template', message: 'Pick a template to send a proposal.' };

  const eventId = thread.event_id;

  // 1 · Template (RLS: own org only).
  const { data: template } = await supabase
    .from('vendor_proposal_templates')
    .select('template_id, body, terms, default_package_id')
    .eq('template_id', templateId)
    .maybeSingle();
  if (!template) return { ok: false, code: 'needs_template', message: 'Pick a template to send a proposal.' };

  // 2 · Brief — booked threads resolve the rich auto-fill; inquiry threads fall
  // back to a minimal brief (event identity only, no shared planning data).
  let brief: ProposalBrief;
  const { data: briefData } = await supabase.rpc('get_vendor_event_brief', { p_event_id: eventId });
  if (briefData) {
    brief = briefData as ProposalBrief;
  } else {
    const { data: ev } = await supabase
      .from('events')
      .select('display_name, event_date, venue_name, venue_address')
      .eq('event_id', eventId)
      .maybeSingle();
    brief = minimalBrief({
      display_name: ev?.display_name ?? null,
      event_date: ev?.event_date ?? null,
      venue_name: ev?.venue_name ?? null,
      venue_address: ev?.venue_address ?? null,
    });
  }

  // 3 · Package line items + manual-total fallback (mirrors createProposal).
  const packageId = (input.packageId ?? '').trim() || template.default_package_id || null;
  const {
    packageName,
    totalCentavos: pkgTotal,
    lineItems,
  } = await resolvePackageLineItems(supabase, profile.vendor_profile_id, packageId);
  let totalCentavos = pkgTotal;
  const totalPhpRaw = Number(input.totalPhp);
  if (totalCentavos === 0 && Number.isFinite(totalPhpRaw) && totalPhpRaw > 0) {
    totalCentavos = Math.round(totalPhpRaw * 100);
  }

  // 4 · Resolve merge tokens (shared resolver) + title.
  const values = resolveProposalValues(brief, {
    businessName: profile.business_name ?? null,
    packageName,
    totalCentavos,
  });
  const titleRaw = (input.title ?? '').trim().slice(0, 160);
  const title =
    titleRaw ||
    `${profile.business_name ?? 'Proposal'} — ${brief.event.display_name ?? 'your event'}`.slice(0, 160);

  const validUntil = (input.validUntil ?? '').trim();

  // 5 · Insert as draft, then flip to sent (the draft→sent freeze is what the
  // UPDATE-draft RLS allows; inserting 'sent' directly would fail the policy).
  const { data: inserted, error: insErr } = await supabase
    .from('vendor_proposals')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      event_id: eventId,
      template_id: template.template_id,
      title,
      merge_snapshot: {
        values,
        confirmed_guests: brief.pax.attending,
        resolved_at: new Date().toISOString(),
      },
      rendered_body: resolveTokens(template.body, values),
      rendered_terms: resolveTokens(template.terms, values),
      line_items: lineItems,
      total_centavos: totalCentavos,
      valid_until: /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null,
      status: 'draft',
    })
    .select('proposal_id, public_id')
    .single();
  if (insErr || !inserted) return { ok: false, code: 'failed', message: 'Couldn’t send that proposal. Please try again.' };

  const { error: sendErr } = await supabase
    .from('vendor_proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('proposal_id', inserted.proposal_id)
    .eq('status', 'draft');
  if (sendErr) {
    // Don't strand the just-created draft — couples can't see drafts, but a
    // retry would otherwise pile up orphans. Best-effort cleanup (RLS scopes
    // the delete to the vendor's own draft).
    await supabase
      .from('vendor_proposals')
      .delete()
      .eq('proposal_id', inserted.proposal_id)
      .eq('status', 'draft');
    return { ok: false, code: 'failed', message: 'Couldn’t send that proposal. Please try again.' };
  }

  // Retire any earlier still-live proposal for this (event, vendor) so the
  // couple can't accept a stale quote. DEFINER RPC — RLS blocks the vendor from
  // updating non-draft rows directly. Best-effort.
  await supabase.rpc('supersede_prior_vendor_proposals', {
    p_event_id: eventId,
    p_vendor_profile_id: profile.vendor_profile_id,
    p_keep_proposal_id: inserted.proposal_id,
  });

  // 6 · Post the proposal AS a message into the thread (the in-thread card).
  // sender_role='vendor' also stamps vendor_first_reply_at via the DB trigger.
  const priceLabel = totalCentavos > 0 ? formatCentavos(totalCentavos) : 'Price on request';
  const body = `📄 Proposal — “${title}” · ${priceLabel}. Tap to review and accept.`;
  const { error: msgErr } = await supabase.from('chat_messages').insert({
    thread_id: thread.thread_id,
    event_id: eventId,
    vendor_profile_id: thread.vendor_profile_id,
    sender_user_id: user.id,
    sender_role: 'vendor',
    body,
    proposal_id: inserted.proposal_id,
  });

  // 7 · Notify the couple, same path as a normal vendor message — fire even if
  // the in-thread card failed to post (msgErr), so they still learn a proposal
  // arrived (it's live at /proposals/{public_id} regardless of the card).
  await notifyOtherParty({
    threadId: thread.thread_id,
    eventId,
    vendorProfileId: thread.vendor_profile_id,
    senderRole: 'vendor',
    senderUserId: user.id,
    body,
    isFirstMessage: false,
  });

  return {
    ok: true,
    proposalId: inserted.proposal_id,
    publicId: inserted.public_id,
    cardPosted: !msgErr,
    priceLabel,
  };
}
