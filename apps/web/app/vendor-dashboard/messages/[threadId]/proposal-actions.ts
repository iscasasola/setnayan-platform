'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  sendProposalCore,
  sendCustomProposalCore,
  type SendProposalError,
} from '@/lib/proposal-send';
import type { ProposalLineItem } from '@/lib/vendor-proposals';

/**
 * In-chat proposal — send a full structured vendor_proposals proposal straight
 * from the conversation, so a vendor can quote (and re-quote) without leaving
 * the thread. The gating + insert now lives in sendProposalCore
 * (lib/proposal-send.ts) so the native endpoint
 * (api/vendor/chat/[threadId]/proposal) shares it. This action is the FormData
 * + redirect-notice wrapper.
 *
 * The proposal lands as a CARD in the thread (chat_messages.proposal_id), and
 * the couple accepts via the existing DB-guarded respond_vendor_proposal RPC
 * (which prices their event_vendors row). We never write a price here.
 */
const NOTICE_BY_CODE: Record<Exclude<SendProposalError, 'unauthenticated' | 'not_owner'>, string> = {
  thread_closed: 'proposal_thread_closed',
  needs_template: 'proposal_needs_template',
  tier_free: 'proposal_tier_free',
  failed: 'proposal_failed',
};

export async function sendProposalFromChat(formData: FormData) {
  const supabase = await createClient();
  const threadId = String(formData.get('thread_id') ?? '');
  const back = `/vendor-dashboard/messages/${threadId}`;

  const totalPhpRaw = Number(formData.get('total_php'));
  const result = await sendProposalCore(supabase, {
    threadId,
    templateId: String(formData.get('template_id') ?? ''),
    packageId: String(formData.get('package_id') ?? ''),
    totalPhp: Number.isFinite(totalPhpRaw) ? totalPhpRaw : null,
    validUntil: String(formData.get('valid_until') ?? ''),
    title: String(formData.get('title') ?? ''),
  });

  if (!result.ok) {
    if (result.code === 'unauthenticated') redirect('/login');
    if (result.code === 'not_owner') redirect('/vendor-dashboard/messages');
    redirect(`${back}?notice=${NOTICE_BY_CODE[result.code]}`);
  }

  revalidatePath(back);
  redirect(`${back}?notice=${result.cardPosted ? 'proposal_sent' : 'proposal_sent_no_card'}`);
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Vendor Proposal Maker (PR 3) — in-thread quote editor                    */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * One seeded line for the Proposal Maker editor — the package's own pricing
 * basis + fields converted from centavos to the editor's peso-facing inputs.
 */
export type QuoteSeedLine = {
  label: string;
  basis: 'flat' | 'per_pax' | 'per_hour';
  free: boolean;
  flatPhp: number;
  ratePhp: number;
  minPax: number;
  basePhp: number;
  inclHours: number;
  extraPhp: number;
};

export type QuoteSeed = {
  lines: QuoteSeedLine[];
  crew: { mode: 'included' | 'charge' | 'offset'; size: number; perHeadPhp: number } | null;
  transport: { mode: 'included' | 'flat' | 'distance'; flatPhp: number } | null;
};

/**
 * Load a vendor package's default-included items into Proposal Maker seed lines
 * (rule 3: a bundle seeds the line items). RLS-scoped to the caller's own org.
 * Reads the per-line pricing basis added in migration
 * 20270713100000_vendor_package_item_pricing_basis so a bundle's per-pax /
 * per-hour lines resolve against the event's pax + hours in the editor. Returns
 * null if the package isn't the vendor's or has no default items.
 */
export async function loadPackageLinesForQuote(packageId: string): Promise<QuoteSeed | null> {
  if (!packageId) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const { data: pkg } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, vendor_package_items ( service_description, is_default_included, display_order, pricing_basis, replacement_value_centavos, per_pax_price_centavos, min_pax, hour_base_centavos, min_hours, extra_hour_centavos, crew_meal_mode, crew_size, crew_per_head_centavos, transport_mode, transport_flat_centavos )',
    )
    .eq('package_id', packageId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!pkg) return null;

  type Item = {
    service_description: string;
    is_default_included: boolean;
    display_order: number;
    pricing_basis: 'fixed' | 'per_pax' | 'per_hour' | null;
    replacement_value_centavos: number | null;
    per_pax_price_centavos: number | null;
    min_pax: number | null;
    hour_base_centavos: number | null;
    min_hours: number | null;
    extra_hour_centavos: number | null;
    crew_meal_mode: 'included' | 'charge' | 'offset' | null;
    crew_size: number | null;
    crew_per_head_centavos: number | null;
    transport_mode: 'included' | 'flat' | 'distance' | null;
    transport_flat_centavos: number | null;
  };

  const peso = (c: number | null | undefined) => Math.round((Number(c) || 0) / 100);
  const items = ((pkg.vendor_package_items ?? []) as Item[])
    .filter((i) => i.is_default_included)
    .sort((a, b) => a.display_order - b.display_order);

  const lines: QuoteSeedLine[] = items.map((i) => {
    const basis = i.pricing_basis === 'per_pax' || i.pricing_basis === 'per_hour' ? i.pricing_basis : 'flat';
    const flatPhp = peso(i.replacement_value_centavos);
    return {
      label: i.service_description || 'Line item',
      basis,
      // A fixed ₱0 line is a freebie (the "thrown in" move, rule 2).
      free: basis === 'flat' && flatPhp === 0,
      flatPhp,
      ratePhp: peso(i.per_pax_price_centavos),
      minPax: Number(i.min_pax) || 0,
      basePhp: peso(i.hour_base_centavos),
      inclHours: Number(i.min_hours) || 0,
      extraPhp: peso(i.extra_hour_centavos),
    };
  });

  // Lift the first line that overrides crew / transport into the editor-level
  // controls (the editor carries one crew + one transport, matching the
  // prototype). Best-effort — per-line crew/transport is not otherwise surfaced.
  const crewItem = items.find((i) => i.crew_meal_mode && i.crew_meal_mode !== 'included');
  const transportItem = items.find((i) => i.transport_mode && i.transport_mode !== 'included');

  return {
    lines,
    crew: crewItem
      ? {
          mode: crewItem.crew_meal_mode as 'charge' | 'offset',
          size: Number(crewItem.crew_size) || 0,
          perHeadPhp: peso(crewItem.crew_per_head_centavos),
        }
      : null,
    transport: transportItem
      ? {
          mode: transportItem.transport_mode as 'flat' | 'distance',
          flatPhp: peso(transportItem.transport_flat_centavos),
        }
      : null,
  };
}

/**
 * Send a vendor-AUTHORED quote from the Proposal Maker. The editor composes the
 * line items client-side (through the shared pure resolver) and posts them here
 * as JSON. sendCustomProposalCore enforces the SAME ownership + accepted-thread
 * + FREE-tier gate as the package path and re-sums the total from the lines.
 */
export async function sendCustomProposalFromChat(formData: FormData) {
  const supabase = await createClient();
  const threadId = String(formData.get('thread_id') ?? '');
  const back = `/vendor-dashboard/messages/${threadId}`;

  let lineItems: ProposalLineItem[] = [];
  let validUntil: string | null = null;
  let title: string | null = null;
  let note: string | null = null;
  try {
    const parsed = JSON.parse(String(formData.get('payload') ?? '{}')) as {
      lineItems?: ProposalLineItem[];
      validUntil?: string;
      title?: string;
      note?: string;
    };
    lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    validUntil = parsed.validUntil ?? null;
    title = parsed.title ?? null;
    note = parsed.note ?? null;
  } catch {
    redirect(`${back}?notice=proposal_failed`);
  }

  const result = await sendCustomProposalCore(supabase, {
    threadId,
    lineItems,
    validUntil,
    title,
    note,
  });

  if (!result.ok) {
    if (result.code === 'unauthenticated') redirect('/login');
    if (result.code === 'not_owner') redirect('/vendor-dashboard/messages');
    redirect(`${back}?notice=${NOTICE_BY_CODE[result.code]}`);
  }

  revalidatePath(back);
  redirect(`${back}?notice=${result.cardPosted ? 'proposal_sent' : 'proposal_sent_no_card'}`);
}
