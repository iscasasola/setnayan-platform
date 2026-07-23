'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveTokens, type ProposalLineItem } from '@/lib/vendor-proposals';
import {
  bookingFeeSendGate,
  bookingFeeAttribution,
  isBookingFeeEnforcedServer,
} from '@/lib/booking-fee-charge';
import {
  resolveProposalValues,
  resolvePackageLineItems,
  type ProposalBrief,
} from '@/lib/proposal-merge';
import { resolveVendorCategory } from '@/lib/vendor-packages';

/**
 * Proposal auto-fill — Vendor Portal data-link program ③ (corpus
 * 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 3).
 *
 * createProposal is the resolver: merge tokens fill from the SAME two RPCs
 * every other vendor surface reads (get_vendor_event_brief — booked-gated —
 * and get_vendor_catering_metrics) plus the vendor's own packages. Never a
 * new privilege; unresolvable tokens stay as explicit placeholders.
 *
 * V1 scope: BOOKED clients only (DB gate in the INSERT policy). Inquiry-
 * stage proposals are parked pending the owner's proposal=answer ruling.
 */

const BACK = '/vendor-dashboard/proposals';

export async function saveTemplate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const name = String(formData.get('template_name') ?? '').trim().slice(0, 120);
  const body = String(formData.get('body') ?? '').slice(0, 20000);
  const terms = String(formData.get('terms') ?? '').slice(0, 20000);
  const packageId = String(formData.get('default_package_id') ?? '');
  if (!name) redirect(`${BACK}?notice=template_needs_name`);

  const { error } = await supabase.from('vendor_proposal_templates').insert({
    vendor_profile_id: profile.vendor_profile_id,
    template_name: name,
    body,
    terms,
    default_package_id: packageId || null,
  });

  revalidatePath(BACK);
  redirect(`${BACK}?notice=${error ? 'save_failed' : 'template_saved'}`);
}

export async function deleteTemplate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const templateId = String(formData.get('template_id') ?? '');
  // RLS scopes the delete to the caller's own org.
  await supabase.from('vendor_proposal_templates').delete().eq('template_id', templateId);
  revalidatePath(BACK);
  redirect(BACK);
}

export async function createProposal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const eventId = String(formData.get('event_id') ?? '');
  const templateId = String(formData.get('template_id') ?? '');
  const packageIdRaw = String(formData.get('package_id') ?? '');
  const totalPhpRaw = Number(formData.get('total_php'));
  const validUntil = String(formData.get('valid_until') ?? '');
  if (!eventId || !templateId) redirect(`${BACK}?notice=pick_event_and_template`);

  // 1 · Template (RLS: own org only).
  const { data: template } = await supabase
    .from('vendor_proposal_templates')
    .select('template_id, template_name, body, terms, default_package_id')
    .eq('template_id', templateId)
    .maybeSingle();
  if (!template) redirect(`${BACK}?notice=pick_event_and_template`);

  // 2 · Event brief — the booked-gated aggregate read. An error here means
  // the org isn't booked on this event; the INSERT policy would also refuse.
  const { data: briefData, error: briefError } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (briefError || !briefData) redirect(`${BACK}?notice=not_booked`);
  const brief = briefData as ProposalBrief;

  // 3 · Package line items (own org; optional) + manual-total fallback.
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

  // 4 · Resolve merge tokens — deterministic substitution over authorized
  // aggregates (§ 3.3), shared with the in-chat proposal path.
  const values = resolveProposalValues(brief, {
    businessName: profile.business_name ?? null,
    packageName,
    totalCentavos,
  });

  const titleRaw = String(formData.get('title') ?? '').trim().slice(0, 160);
  const title =
    titleRaw ||
    `${profile.business_name ?? 'Proposal'} — ${brief.event.display_name ?? 'your event'}`.slice(
      0,
      160,
    );

  const { data: inserted, error } = await supabase
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
    .select('public_id')
    .single();

  if (error || !inserted) redirect(`${BACK}?notice=save_failed`);
  revalidatePath(BACK);
  redirect(`/proposals/${inserted.public_id}`);
}

export async function sendProposal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const proposalId = String(formData.get('proposal_id') ?? '');
  const publicId = String(formData.get('public_id') ?? '');

  // Booking-fee prepaid gate — skipped entirely unless ENFORCED (env flags OR the
  // admin DB toggle + PayMongo creds). Resolve the (vendor, event) thread for
  // attribution, then block the send (no flip) when the fee is unpaid; the draft
  // persists so the vendor can pay via checkout and re-send this same draft.
  const admin = createAdminClient();
  if (await isBookingFeeEnforcedServer(admin)) {
    const { data: prop } = await admin
      .from('vendor_proposals')
      .select('event_id, vendor_profile_id')
      .eq('proposal_id', proposalId)
      .eq('status', 'draft')
      .maybeSingle();
    if (prop) {
      const { data: thread } = await admin
        .from('chat_threads')
        .select('thread_id, inquiry_source')
        .eq('event_id', prop.event_id)
        .eq('vendor_profile_id', prop.vendor_profile_id)
        .maybeSingle();
      const feeGate = await bookingFeeSendGate(admin, {
        proposalId,
        attribution: bookingFeeAttribution(thread?.inquiry_source ?? null),
        threadId: thread?.thread_id ?? null,
      });
      if (!feeGate.cleared) {
        revalidatePath(`/proposals/${publicId}`);
        redirect(`/proposals/${publicId}?notice=fee_unpaid`);
      }
    }
  }

  // RLS: only the org's own DRAFT rows are updatable — the flip freezes it.
  // Return the keys so we can retire any earlier live proposal for this pair.
  const { data: sent, error } = await supabase
    .from('vendor_proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
    .eq('status', 'draft')
    .select('event_id, vendor_profile_id')
    .maybeSingle();

  // #8 (money bug-hunt): retire any earlier still-live proposal for this
  // (event, vendor) so the couple can't accept a stale quote. DEFINER RPC —
  // RLS blocks the vendor from updating non-draft rows directly. Best-effort.
  if (!error && sent) {
    await supabase.rpc('supersede_prior_vendor_proposals', {
      p_event_id: sent.event_id,
      p_vendor_profile_id: sent.vendor_profile_id,
      p_keep_proposal_id: proposalId,
    });
  }

  revalidatePath(`/proposals/${publicId}`);
  revalidatePath(BACK);
  redirect(`/proposals/${publicId}${error ? '?notice=send_failed' : ''}`);
}

export async function deleteDraftProposal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const proposalId = String(formData.get('proposal_id') ?? '');
  // RLS: drafts of the caller's own org only.
  await supabase.from('vendor_proposals').delete().eq('proposal_id', proposalId).eq('status', 'draft');
  revalidatePath(BACK);
  redirect(BACK);
}

export async function respondToProposal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const proposalId = String(formData.get('proposal_id') ?? '');
  const publicId = String(formData.get('public_id') ?? '');
  const response = String(formData.get('response') ?? '');

  // On accept, resolve the coarse VendorCategory in TS so the RPC can stamp it
  // on a fresh event_vendors row (the case where the couple accepts before ever
  // Saving the vendor — there's no row yet to read the category from). The
  // proposal's line_items store the canonical_service as `detail` with
  // underscores swapped for spaces at create time (createProposal:171), so we
  // reverse that to recover the key. Decline passes NULL.
  let coarseCategory: string | null = null;
  if (response === 'accepted') {
    const { data: proposal } = await supabase
      .from('vendor_proposals')
      .select('line_items')
      .eq('proposal_id', proposalId)
      .maybeSingle();
    const items = (proposal?.line_items ?? []) as ProposalLineItem[];
    const firstDetail = items[0]?.detail;
    if (firstDetail) {
      coarseCategory = resolveVendorCategory(firstDetail.replace(/ /g, '_'));
    }
  }

  // SECURITY DEFINER RPC validates couple/delegate membership + the
  // sent/viewed → accepted/declined transition, and (on accept) upserts the
  // couple's priced event_vendors shortlist pick.
  const { error } = await supabase.rpc('respond_vendor_proposal', {
    p_proposal_id: proposalId,
    p_response: response,
    p_coarse_category: coarseCategory,
  });

  revalidatePath(`/proposals/${publicId}`);
  redirect(`/proposals/${publicId}${error ? '?notice=respond_failed' : ''}`);
}
