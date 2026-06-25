'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { notifyOtherParty } from '@/lib/chat-actions';
import { resolveTokens, formatCentavos } from '@/lib/vendor-proposals';
import {
  resolveProposalValues,
  resolvePackageLineItems,
  minimalBrief,
  type ProposalBrief,
} from '@/lib/proposal-merge';

/**
 * In-chat proposal — send a full structured vendor_proposals proposal straight
 * from the conversation, so a vendor can quote (and re-quote) without leaving
 * the thread. Owner-authorized 2026-06-26 to work at the INQUIRY stage too
 * (not only booked) — see migration 20270225000000. Booked threads still get
 * the richer auto-filled brief; inquiry threads get a minimal token set (the
 * couple's private planning data isn't shared until they book).
 *
 * The proposal lands as a CARD in the thread (chat_messages.proposal_id), and
 * the couple accepts via the existing DB-guarded respond_vendor_proposal RPC
 * (which prices their event_vendors row). We never write a price here.
 */
export async function sendProposalFromChat(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const threadId = String(formData.get('thread_id') ?? '');
  const back = `/vendor-dashboard/messages/${threadId}`;

  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    redirect('/vendor-dashboard/messages');
  }
  // A proposal is a real reply — only on an open (accepted) conversation.
  if (thread.inquiry_status !== 'accepted') redirect(`${back}?notice=proposal_thread_closed`);

  const templateId = String(formData.get('template_id') ?? '');
  const packageIdRaw = String(formData.get('package_id') ?? '');
  const totalPhpRaw = Number(formData.get('total_php'));
  const validUntil = String(formData.get('valid_until') ?? '');
  if (!templateId) redirect(`${back}?notice=proposal_needs_template`);

  const eventId = thread.event_id;

  // 1 · Template (RLS: own org only).
  const { data: template } = await supabase
    .from('vendor_proposal_templates')
    .select('template_id, body, terms, default_package_id')
    .eq('template_id', templateId)
    .maybeSingle();
  if (!template) redirect(`${back}?notice=proposal_needs_template`);

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
  const packageId = packageIdRaw || template.default_package_id || null;
  const {
    packageName,
    totalCentavos: pkgTotal,
    lineItems,
  } = await resolvePackageLineItems(supabase, profile.vendor_profile_id, packageId);
  let totalCentavos = pkgTotal;
  if (totalCentavos === 0 && Number.isFinite(totalPhpRaw) && totalPhpRaw > 0) {
    totalCentavos = Math.round(totalPhpRaw * 100);
  }

  // 4 · Resolve merge tokens (shared resolver) + title.
  const values = resolveProposalValues(brief, {
    businessName: profile.business_name ?? null,
    packageName,
    totalCentavos,
  });
  const titleRaw = String(formData.get('title') ?? '').trim().slice(0, 160);
  const title =
    titleRaw ||
    `${profile.business_name ?? 'Proposal'} — ${brief.event.display_name ?? 'your event'}`.slice(0, 160);

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
  if (insErr || !inserted) redirect(`${back}?notice=proposal_failed`);

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
    redirect(`${back}?notice=proposal_failed`);
  }

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

  revalidatePath(back);
  redirect(`${back}?notice=${msgErr ? 'proposal_sent_no_card' : 'proposal_sent'}`);
}
