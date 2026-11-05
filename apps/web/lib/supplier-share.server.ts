import 'server-only';

/**
 * readSupplierShareFacts — everything the self-added supplier's invite says, read ONCE for both the message and the
 * digital card (DECISION_LOG 2026-10-30, "THE INVITE TEXTS — GUEST AND SELF-ADDED SUPPLIER — APPROVED; A SELF-ADDED
 * SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL CARD").
 *
 * Under the CALLER'S session (the couple's RLS is the ownership check — a supplier row that is not theirs reads as
 * nothing). It only READS — and never the link: making or finding it is `createManualVendorInvite`'s job (the one
 * writer), never this file's — that writer calls `supplierSharePayload`
 * below when the Share asks it to (`withShare`), so the Share is ONE request: link, message and card together.
 *
 *   · the supplier row — must be one the couple added and who is not on Setnayan (`canInviteSupplier`, the one gate);
 *   · their record — the shop's name and the contact person (`event_manual_vendors`);
 *   · the event — the hosts (`display_name`), its type's word, its date;
 *   · the rows they are filed under and also cover, NAMED as the Suppliers page names them (`readCoverCatalog` — the
 *     admin taxonomy, the one source), the home row first.
 *
 * 🔑 A REFUSED READ IS NOT A BLANK CARD. Any read that fails returns `refused` — a card or a message with the
 * contact or the date silently missing would read as a couple who never entered them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { canInviteSupplier } from '@/lib/supplier-invite-eligibility';
import { readCoverCatalog } from '@/lib/cover-catalog.server';
import { resolveProfile } from '@/lib/event-type-profile';
import { coverKeyForTile, homeTileForRow } from '@/lib/shortlist-taxonomy';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildSupplierInviteMessage, supplierGreetingName, type SupplierInviteFacts } from '@/lib/supplier-invite-message';
import { supplierCardDate, supplierCardEventLabel, supplierCardFileName, type SupplierCardFacts } from '@/lib/supplier-card';
import { renderSupplierCardPng } from '@/lib/supplier-card-render';
import type { SupplierSharePayload } from '@/lib/supplier-share';

export type SupplierShareFacts = SupplierInviteFacts & { card: SupplierCardFacts };

export type SupplierShareRead =
  | { status: 'ok'; facts: SupplierShareFacts }
  | { status: 'refused' };

export async function readSupplierShareFacts(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
): Promise<SupplierShareRead> {
  const { data: ev, error: evErr } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, category, category_key, covers_plan_groups, manual_vendor_id, marketplace_vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (evErr) {
    logQueryError('supplier-share.row', evErr, { event_id: eventId, vendor_id: vendorId }, 'graceful_degrade');
    return { status: 'refused' };
  }
  const row = ev as {
    vendor_name: string | null;
    category: string | null;
    category_key: string | null;
    covers_plan_groups: string[] | null;
    manual_vendor_id: string | null;
    marketplace_vendor_id: string | null;
  } | null;
  if (!row || !canInviteSupplier(row)) return { status: 'refused' };

  const [manualRes, eventRes, catalog] = await Promise.all([
    row.manual_vendor_id
      ? supabase
          .from('event_manual_vendors')
          .select('business_name, contact_person')
          .eq('manual_vendor_id', row.manual_vendor_id)
          .eq('event_id', eventId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('events').select('display_name, event_type, event_date, event_date_precision').eq('event_id', eventId).maybeSingle(),
    readCoverCatalog(eventId),
  ]);
  if (manualRes.error || eventRes.error || !eventRes.data) {
    logQueryError('supplier-share.facts', manualRes.error ?? eventRes.error ?? 'no event', { event_id: eventId, vendor_id: vendorId }, 'graceful_degrade');
    return { status: 'refused' };
  }
  const m = (manualRes.data ?? null) as { business_name: string | null; contact_person: string | null } | null;
  const e = eventRes.data as {
    display_name: string | null;
    event_type: string | null;
    event_date: string | null;
    event_date_precision: string | null;
  };
  const profile = await resolveProfile(e.event_type ?? 'wedding');

  // The rows, named as the page names them: the home row first, then what they also cover.
  const named = new Map<string, string>();
  if (catalog.ok) for (const f of catalog.catalog) for (const o of f.options) {
    named.set(o.key, o.label);
    named.set(o.tile, o.label);
  }
  const home = homeTileForRow({ category: row.category ?? '', category_key: row.category_key });
  const homeLabel =
    (home ? (named.get(home) ?? named.get(coverKeyForTile(home))) : null) ??
    VENDOR_CATEGORY_LABEL[(row.category ?? '') as VendorCategory] ??
    null;
  const services: string[] = [];
  for (const s of [homeLabel, ...(row.covers_plan_groups ?? []).map((k) => named.get(k) ?? null)]) {
    if (s && !services.includes(s)) services.push(s);
  }

  const shopName = ((m?.business_name ?? row.vendor_name ?? '').trim() || 'Supplier').replace(/\s+/g, ' ');
  const contactPerson = (m?.contact_person ?? '').trim() || null;
  const hostsName = (e.display_name ?? '').trim() || null;
  const facts: SupplierShareFacts = {
    shopName,
    contactPerson,
    eventWord: profile.terminology.eventWord,
    eventDate: e.event_date,
    datePrecision: e.event_date_precision,
    service: homeLabel,
    hostsName,
    card: {
      shopName,
      contactPerson,
      services,
      invitedBy: hostsName,
      eventLabel: supplierCardEventLabel(profile.terminology.eventWord),
      dateLabel: supplierCardDate(e.event_date, e.event_date_precision),
    },
  };
  return { status: 'ok', facts };
}

/**
 * The Share's payload for a link the writer has just made or found: the approved message and the digital card,
 * drawn here (`renderSupplierCardPng` — the guest ticket's flattener) and handed back as a data address, so the
 * Share needs no second request and the platform no new route. Null when the facts cannot be read — the button then
 * says so; a card that cannot be DRAWN is `card: null` and the message still goes.
 */
export async function supplierSharePayload(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
  url: string,
): Promise<SupplierSharePayload | null> {
  const read = await readSupplierShareFacts(supabase, eventId, vendorId);
  if (read.status !== 'ok') return null;
  const message = buildSupplierInviteMessage({ ...read.facts, link: url });
  if (!message) return null;
  let card: string | null = null;
  try {
    card = `data:image/png;base64,${Buffer.from(await renderSupplierCardPng(read.facts.card, url)).toString('base64')}`;
  } catch (err) {
    logQueryError('supplier-share.card', err, { vendor_id: vendorId }, 'graceful_degrade');
  }
  return { url, message, card, fileName: supplierCardFileName(read.facts.shopName), greeting: supplierGreetingName(read.facts) };
}
