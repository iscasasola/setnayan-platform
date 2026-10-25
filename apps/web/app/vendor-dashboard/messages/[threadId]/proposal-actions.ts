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
import { createAdminClient } from '@/lib/supabase/admin';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import {
  fetchVendorServices,
  fetchInclusionsByService,
  fetchBracketsByService,
  fetchDiscountsByService,
} from '@/lib/vendor-services';
import { fetchAddonsByService } from '@/lib/vendor-service-addons';
import { fetchOwnSchedulesByService } from '@/lib/vendor-service-payment-schedules';
import {
  quoteFromServiceCards,
  type QuoteSeedLine,
  type ServiceCardQuoteSeed,
} from '@/lib/quote-from-service-card';
import { parseSavedQuoteDraft, type SavedQuoteDraft } from '@/lib/saved-quote';

// The builder imports the seed-line shape from here; it is now defined once,
// in the pure module both seeds share.
export type { QuoteSeedLine } from '@/lib/quote-from-service-card';

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
  fee_unpaid: 'proposal_fee_unpaid',
  // S5 · the ACCEPTED quote cannot be superseded once the couple has asked to
  // lock at it, or the booking is confirmed. The notice names the next door.
  deal_locked: 'proposal_deal_locked',
  lock_requested: 'proposal_lock_requested',
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

/* ──────────────────────────────────────────────────────────────────────── */
/* The one-screen quote (simpler supplier dashboard step 4, 2026-10-14)      */
/* ──────────────────────────────────────────────────────────────────────── */

/** One catalogue extra — a package item the shop marked NOT included by default, offered as a switch. */
export type QuoteCatalogueExtra = {
  id: string;
  /** The item's own words, with the package it belongs to when the shop has more than one. */
  label: string;
  line: QuoteSeedLine;
};

/**
 * "FROM YOUR CATALOGUE" — the shop's optional package items (`vendor_package_items.is_default_included = false`).
 *
 * Rule 0's worked example, verbatim: the catalogue picker "turned out to be `vendor_package_items` rows with
 * `is_default_included = false`, which vendors already author and `lock-modal.tsx` deliberately hides". Nothing new is
 * stored: the quote shows them as switches, and a switch on adds the item as a line priced by its own basis.
 *
 * Read ONCE, when the supplier opens the quote — never on the thread's own load (free plan: a thread that is only
 * read costs no catalogue read). Under the supplier's own session; RLS returns only their packages. Empty on any
 * refusal — the section then says nothing, the same as a shop with no optional items.
 */
export async function loadCatalogueExtrasForQuote(): Promise<QuoteCatalogueExtra[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return [];
  const { data, error } = await supabase
    .from('vendor_packages')
    .select(
      'package_id, package_name, vendor_package_items ( item_id, service_description, is_default_included, display_order, pricing_basis, replacement_value_centavos, per_pax_price_centavos, min_pax, hour_base_centavos, min_hours, extra_hour_centavos )',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('is_active', true);
  if (error) console.error('[supabase-error] app/vendor-dashboard/messages/[threadId]/proposal-actions.ts · from:vendor_packages.select (catalogue extras)', error);
  if (error || !data) return [];
  type Item = {
    item_id: string;
    service_description: string | null;
    is_default_included: boolean;
    display_order: number;
    pricing_basis: 'fixed' | 'per_pax' | 'per_hour' | null;
    replacement_value_centavos: number | null;
    per_pax_price_centavos: number | null;
    min_pax: number | null;
    hour_base_centavos: number | null;
    min_hours: number | null;
    extra_hour_centavos: number | null;
  };
  const pkgs = data as { package_id: string; package_name: string | null; vendor_package_items: Item[] | null }[];
  const named = pkgs.filter((p) => (p.vendor_package_items ?? []).some((i) => !i.is_default_included)).length > 1;
  const peso = (c: number | null | undefined) => Math.round((Number(c) || 0) / 100);
  const out: QuoteCatalogueExtra[] = [];
  for (const p of pkgs) {
    const items = (p.vendor_package_items ?? []).filter((i) => !i.is_default_included).sort((a, b) => a.display_order - b.display_order);
    for (const i of items) {
      const basis = i.pricing_basis === 'per_pax' || i.pricing_basis === 'per_hour' ? i.pricing_basis : 'flat';
      const label = (i.service_description ?? '').trim() || 'Extra';
      const flatPhp = peso(i.replacement_value_centavos);
      out.push({
        id: i.item_id,
        label: named && p.package_name ? `${label} · ${p.package_name}` : label,
        line: {
          label,
          basis,
          free: basis === 'flat' && flatPhp === 0,
          flatPhp,
          ratePhp: peso(i.per_pax_price_centavos),
          minPax: Number(i.min_pax) || 0,
          basePhp: peso(i.hour_base_centavos),
          inclHours: Number(i.min_hours) || 0,
          extraPhp: peso(i.extra_hour_centavos),
        },
      });
    }
  }
  return out;
}

/**
 * "SAVE THIS QUOTE" — writes the builder's draft as a saved quote (`vendor_proposal_templates`, with its lines in
 * `quote_draft`, migration `…_saved_quote_draft`). The body is the note, so a saved quote still reads sensibly
 * everywhere the old templates are listed (`/vendor-dashboard/proposals`).
 *
 * The draft is re-parsed HERE (`parseSavedQuoteDraft`) — the browser's copy is a suggestion; what is stored is what
 * the parser keeps. RLS (`vendor_proposal_templates_org_all`) is the fence: the row is the caller's own shop's.
 */
export async function saveQuoteAsTemplate(input: {
  name: string;
  draft: SavedQuoteDraft;
}): Promise<{ ok: true; id: string; name: string } | { ok: false; reason: 'name' | 'empty' | 'failed' }> {
  const name = String(input?.name ?? '').trim().slice(0, 120);
  if (!name) return { ok: false, reason: 'name' };
  const draft = parseSavedQuoteDraft(input?.draft);
  if (!draft) return { ok: false, reason: 'empty' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'failed' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, reason: 'failed' };
  const { data, error } = await supabase
    .from('vendor_proposal_templates')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      template_name: name,
      body: draft.note,
      terms: '',
      quote_draft: draft,
    })
    .select('template_id')
    .single();
  if (error || !data) {
    console.error('[supabase-error] proposal-actions.ts · from:vendor_proposal_templates.insert (saveQuoteAsTemplate)', error);
    return { ok: false, reason: 'failed' };
  }
  revalidatePath('/vendor-dashboard/proposals');
  return { ok: true, id: (data as { template_id: string }).template_id, name };
}

/**
 * "START FROM · A SAVED QUOTE" — one saved quote, as the builder loads it. A quote saved from the builder comes back
 * whole (`quote_draft`); an old-style template comes back as its package's lines (the shipped package seed) and its
 * body as the note — exactly what sending it as a template would have priced.
 */
export async function loadSavedQuote(
  templateId: string,
): Promise<{ draft: SavedQuoteDraft | null; packageSeed: QuoteSeed | null; note: string; name: string } | null> {
  if (!templateId) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('vendor_proposal_templates')
    .select('template_name, body, default_package_id, quote_draft')
    .eq('template_id', templateId)
    .maybeSingle();
  if (error) console.error('[supabase-error] app/vendor-dashboard/messages/[threadId]/proposal-actions.ts · from:vendor_proposal_templates.select (saved quote)', error);
  if (error || !data) return null;
  const row = data as { template_name: string; body: string | null; default_package_id: string | null; quote_draft: unknown };
  const draft = parseSavedQuoteDraft(row.quote_draft);
  const packageSeed = !draft && row.default_package_id ? await loadPackageLinesForQuote(row.default_package_id) : null;
  return { draft, packageSeed, note: draft ? draft.note : (row.body ?? ''), name: row.template_name };
}

/**
 * LOAD ONE OR SEVERAL OF THE SHOP'S SERVICE CARDS INTO THE QUOTE (owner,
 * 2026-09-22: *"load 1 or multiple service cards combined"*).
 *
 * The sibling of `loadPackageLinesForQuote`, for the thing suppliers actually
 * author. Production on the day this was written: 0 packages, 0 templates,
 * 2 service cards — so this is the seed every real shop can use. Reads the
 * card and its five sibling tables under the SUPPLIER'S OWN session (RLS
 * scopes every read to their shop; a card id that is not theirs simply does
 * not come back), then hands everything to the pure `quoteFromServiceCards`.
 *
 * ⚠ THE EVENT DATE IS READ HERE, NOT TRUSTED FROM THE BROWSER. It decides
 * whether an early-booking rung applies and whether the last-minute window is
 * open — both move money. A vendor holds no `events` RLS (measured 2026-09-08),
 * so the date is read with the admin client AFTER the thread is proven to be
 * theirs — the same bypass-after-ownership the thread page uses.
 *
 * Returns null when nothing could be loaded (no such card of theirs, not their
 * thread, signed out) — the builder then keeps what it had, exactly as the
 * package seed behaves.
 */
export async function loadServiceCardLinesForQuote(input: {
  threadId: string;
  vendorServiceIds: string[];
  /** Add-on ids the supplier ticked (across all loaded cards). */
  chosenAddonIds: number[];
  pax: number;
  hours: number;
}): Promise<ServiceCardQuoteSeed | null> {
  const ids = Array.from(new Set(input.vendorServiceIds.filter((v) => typeof v === 'string' && v)));
  if (ids.length === 0) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;

  const { data: thread } = await supabase
    .from('chat_threads')
    .select('thread_id, event_id, vendor_profile_id')
    .eq('thread_id', input.threadId)
    .maybeSingle();
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) return null;

  const [own, inclusions, brackets, discounts, addons, schedules, labeller, eventRow] = await Promise.all([
    fetchVendorServices(supabase, profile.vendor_profile_id),
    fetchInclusionsByService(supabase, ids),
    fetchBracketsByService(supabase, ids),
    fetchDiscountsByService(supabase, ids),
    fetchAddonsByService(supabase, ids),
    fetchOwnSchedulesByService(supabase, ids),
    cardKindLabeller(),
    thread.event_id
      ? createAdminClient()
          .from('events')
          .select('event_date')
          .eq('event_id', thread.event_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Keep the supplier's own order of picking, and refuse anything not theirs.
  const byId = new Map(own.map((r) => [r.vendor_service_id, r]));
  const cards = ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      card: r,
      // The kind in the shop's own words — never the raw key, never "Untitled".
      label: r.title?.trim() || labeller(r.category),
      inclusions: inclusions.get(r.vendor_service_id) ?? [],
      brackets: brackets.get(r.vendor_service_id) ?? [],
      discounts: discounts.get(r.vendor_service_id) ?? [],
      addons: addons.get(r.vendor_service_id) ?? [],
      chosenAddonIds: input.chosenAddonIds,
      schedule: schedules.get(r.vendor_service_id) ?? [],
    }));
  if (cards.length === 0) return null;

  const eventDate = (eventRow?.data as { event_date: string | null } | null)?.event_date ?? null;
  return quoteFromServiceCards({
    cards,
    pax: Number(input.pax) || 0,
    hours: Number(input.hours) || 0,
    eventDate,
    now: new Date(),
  });
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
  let schedule: unknown = null;
  let paymentMethodIds: string[] = [];
  // The quote's own Setnayan-gift switch (owner 2026-09-22). `null` = the quote
  // says nothing and the booking keeps falling back to the service card.
  let includesSetnayanGift: boolean | null = null;
  // Which service cards the quote was built from. `null` = an older client that
  // never said, which the thread reads as "fall back to the timestamp rule".
  // `[]` is a real answer: built from no card.
  let serviceCardIds: string[] | null = null;
  try {
    const parsed = JSON.parse(String(formData.get('payload') ?? '{}')) as {
      lineItems?: ProposalLineItem[];
      validUntil?: string;
      title?: string;
      note?: string;
      schedule?: unknown;
      paymentMethodIds?: string[];
      includesSetnayanGift?: boolean | null;
      serviceCardIds?: unknown;
    };
    lineItems = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    validUntil = parsed.validUntil ?? null;
    title = parsed.title ?? null;
    note = parsed.note ?? null;
    schedule = parsed.schedule ?? null;
    paymentMethodIds = Array.isArray(parsed.paymentMethodIds) ? parsed.paymentMethodIds : [];
    // Only a real boolean is a decision; anything else leaves the card deciding.
    includesSetnayanGift =
      typeof parsed.includesSetnayanGift === 'boolean' ? parsed.includesSetnayanGift : null;
    // An ARRAY is the statement — including an empty one. Anything else (absent,
    // a string, junk) is "never said", so the reader keeps today's behaviour
    // rather than asserting the quote covered nothing.
    serviceCardIds = Array.isArray(parsed.serviceCardIds)
      ? parsed.serviceCardIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : null;
  } catch {
    redirect(`${back}?notice=proposal_failed`);
  }

  const result = await sendCustomProposalCore(supabase, {
    threadId,
    lineItems,
    validUntil,
    title,
    note,
    schedule,
    paymentMethodIds,
    includesSetnayanGift,
    serviceCardIds,
  });

  if (!result.ok) {
    if (result.code === 'unauthenticated') redirect('/login');
    if (result.code === 'not_owner') redirect('/vendor-dashboard/messages');
    redirect(`${back}?notice=${NOTICE_BY_CODE[result.code]}`);
  }

  revalidatePath(back);
  redirect(`${back}?notice=${result.cardPosted ? 'proposal_sent' : 'proposal_sent_no_card'}`);
}
