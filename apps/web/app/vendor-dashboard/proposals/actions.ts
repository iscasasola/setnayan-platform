'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { blockRelevance, deriveCallTime, type LensBlock } from '@/lib/vendor-timeline';
import {
  resolveTokens,
  formatCentavos,
  type ProposalLineItem,
  type ProposalTokenKey,
} from '@/lib/vendor-proposals';
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

function fmtLongDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

type Brief = {
  event: {
    display_name: string | null;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
  };
  booked_categories: string[];
  pax: { invited: number; attending: number; maybe: number; pending: number };
  dietary: { meal_counts: Record<string, number> } | null;
  timeline: { label: string; block_type: string; start_at: string | null }[];
  seat_plan: { table_count: number };
};

const MEAL_LABELS: Record<string, string> = {
  beef: 'beef',
  chicken: 'chicken',
  fish: 'fish',
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  kids: 'kids meal',
  no_preference: 'no preference',
};

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
  const brief = briefData as Brief;

  // 3 · Package line items (own org; optional).
  const packageId = packageIdRaw || template.default_package_id || null;
  let lineItems: ProposalLineItem[] = [];
  let totalCentavos = 0;
  let packageName: string | null = null;
  if (packageId) {
    const { data: pkg } = await supabase
      .from('vendor_packages')
      .select(
        'package_id, package_name, total_price_centavos, vendor_package_items ( service_description, canonical_service, replacement_value_centavos, is_default_included, display_order )',
      )
      .eq('package_id', packageId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (pkg) {
      packageName = pkg.package_name as string;
      totalCentavos = Number(pkg.total_price_centavos) || 0;
      type PkgItem = {
        service_description: string;
        canonical_service: string;
        replacement_value_centavos: number;
        is_default_included: boolean;
        display_order: number;
      };
      lineItems = ((pkg.vendor_package_items ?? []) as PkgItem[])
        .filter((i) => i.is_default_included)
        .sort((a, b) => a.display_order - b.display_order)
        .map((i) => ({
          label: i.service_description,
          detail: i.canonical_service.replace(/_/g, ' '),
          amount_centavos: Number(i.replacement_value_centavos) || null,
        }));
    }
  }
  if (totalCentavos === 0 && Number.isFinite(totalPhpRaw) && totalPhpRaw > 0) {
    totalCentavos = Math.round(totalPhpRaw * 100);
  }

  // 4 · Resolve merge tokens — deterministic substitution over authorized
  // aggregates (§ 3.3). Counts come straight off the brief.
  const { pax } = brief;
  const mealBreakdown = brief.dietary
    ? Object.entries(brief.dietary.meal_counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n} ${MEAL_LABELS[k] ?? k.replace(/_/g, ' ')}`)
        .join(' · ')
    : null;
  const timeline = brief.timeline as LensBlock[];
  const mySlot = timeline
    .filter((b) => b.start_at && blockRelevance(b, brief.booked_categories) === 'primary')
    .sort((a, b) => (a.start_at as string).localeCompare(b.start_at as string))[0];
  const callTime = deriveCallTime(timeline, brief.booked_categories);

  const values: Partial<Record<ProposalTokenKey, string | null>> = {
    couple_name: brief.event.display_name,
    event_date: fmtLongDate(brief.event.event_date),
    venue_name: brief.event.venue_name,
    venue_address: brief.event.venue_address,
    guest_count: pax.invited > 0 ? String(pax.attending) : null,
    guest_count_expected: pax.invited > 0 ? String(pax.attending + pax.maybe) : null,
    guest_count_ceiling: pax.invited > 0 ? String(pax.attending + pax.maybe + pax.pending) : null,
    meal_breakdown: mealBreakdown,
    table_count: brief.seat_plan.table_count > 0 ? String(brief.seat_plan.table_count) : null,
    my_slot: mySlot ? `${mySlot.label} · ${fmtTime(mySlot.start_at)}` : null,
    call_time: callTime ? fmtTime(callTime.call_time) : null,
    package_name: packageName,
    package_price: totalCentavos > 0 ? formatCentavos(totalCentavos) : null,
    business_name: profile.business_name ?? null,
  };

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
        confirmed_guests: pax.attending,
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

  // RLS: only the org's own DRAFT rows are updatable — the flip freezes it.
  const { error } = await supabase
    .from('vendor_proposals')
    .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
    .eq('status', 'draft');

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
