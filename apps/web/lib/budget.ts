import type { SupabaseClient } from '@supabase/supabase-js';
import { VENDOR_CATEGORY_LABEL, type EventVendorRow } from './vendors';

export type LineItemRow = {
  line_item_id: string;
  event_id: string;
  vendor_id: string;
  label: string;
  amount_php: number;
  due_date: string | null;
  sort_order: number;
  created_at: string;
};

export type PaymentRow = {
  payment_id: string;
  event_id: string;
  vendor_id: string;
  line_item_id: string | null;
  amount_php: number;
  paid_at: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

/**
 * Read-only vendor-controlled line item surfaced on the budget page when
 * the host has contracted a marketplace vendor that has published pricing
 * (either vendor_packages with vendor_package_items, or vendor_services
 * with a starting_price_php for the vendor's category).
 *
 * Owner directive 2026-05-22: "budget should be entered by vendor. but if
 * there is no vendor account, we can place it manually." This type is the
 * "entered by vendor" half — sourced from the marketplace's vendor-side
 * pricing surfaces, not from event_vendor_line_items (which the host owns).
 *
 * Distinct from LineItemRow above (which the host writes to) so the UI
 * can render them differently (no Delete button on vendor-controlled
 * items, terracotta accent vs. cream) and so payment-logging UX can
 * reference them via a synthetic id ("pkg:<item_id>" or "svc:<service_id>")
 * even though they don't live in event_vendor_line_items.
 */
export type VendorControlledLineItem = {
  /** Synthetic ID — `pkg:<vendor_package_items.item_id>` or `svc:<vendor_services.vendor_service_id>` */
  source_id: string;
  /** 'package' = from vendor_package_items, 'service' = from vendor_services */
  source_kind: 'package' | 'service';
  label: string;
  amount_php: number;
  /** Vendor's name on this item — surfaced as a small badge in the UI */
  vendor_business_name: string;
};

export type VendorPriceSource = 'manual' | 'package' | 'service' | 'pending';

export type VendorBudgetSummary = {
  vendor: EventVendorRow;
  lineItems: LineItemRow[];
  payments: PaymentRow[];
  itemizedTotal: number;
  paidTotal: number;
  remaining: number;
  /**
   * Where this vendor's pricing comes from. Drives the UI on the budget
   * card:
   *  - 'manual': legacy host-entered line items only. Off-platform /
   *    pre-marketplace vendors hit this path.
   *  - 'package': vendor has a vendor_packages booking on this event.
   *    `vendorControlledItems` carries the read-only items.
   *  - 'service': vendor has no package on this event but has a published
   *    vendor_services row for this category. `vendorControlledItems`
   *    carries a single synthetic "Service fee" row.
   *  - 'pending': marketplace vendor, host has contracted them, but
   *    vendor hasn't published any pricing yet. UI renders a polite
   *    "ask the vendor to send their pricing" CTA.
   */
  priceSource: VendorPriceSource;
  /** Read-only line items sourced from the vendor's published catalog. */
  vendorControlledItems: VendorControlledLineItem[];
};

export type BudgetSnapshot = {
  vendors: VendorBudgetSummary[];
  totals: {
    budget: number;
    paid: number;
    remaining: number;
    upcomingDueAmount: number;
    upcomingDueCount: number;
  };
};

/**
 * Per-vendor lookup table mapping event_vendors.vendor_id to the vendor's
 * marketplace identity + pricing source. Built once per fetchBudgetSnapshot
 * call by joining event_vendors → vendor_profiles → vendor_packages /
 * vendor_services. Used to decide whether each per-vendor card renders
 * vendor-controlled items, falls back to host-manual entry, or shows the
 * "pending vendor pricing" empty state.
 */
type VendorPricingLookup = Map<
  string,
  {
    priceSource: VendorPriceSource;
    items: VendorControlledLineItem[];
  }
>;

/**
 * Graceful-degrade Postgres lookup. When a table doesn't exist yet (code
 * 42P01) — e.g. before the vendor_packages migration has been applied to
 * prod — return an empty fallback so the budget page keeps rendering.
 * Matches the pattern established by PR #380 and noted in
 * [[feedback_setnayan_latest_spec_priority]].
 */
function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01';
}

async function buildVendorPricingLookup(
  supabase: SupabaseClient,
  eventId: string,
  eventVendors: EventVendorRow[],
): Promise<VendorPricingLookup> {
  const lookup: VendorPricingLookup = new Map();

  // Only marketplace-linked finalized vendors are candidates for
  // vendor-controlled line items. Off-platform vendors (no
  // marketplace_vendor_id) keep the existing manual flow — their lookup
  // entry stays 'manual' by absence (the budget page treats absence as
  // 'manual' downstream).
  const marketplaceVendors = eventVendors.filter(
    (v) => v.marketplace_vendor_id !== null,
  );
  if (marketplaceVendors.length === 0) return lookup;

  // Resolve vendor business names — surfaced as a small "from {vendor}"
  // badge on each read-only line item so the host knows the line came
  // from the vendor's catalog, not their own entry.
  const profileIds = Array.from(
    new Set(marketplaceVendors.map((v) => v.marketplace_vendor_id as string)),
  );
  const profilesRes = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .in('vendor_profile_id', profileIds);

  // vendor_profiles is established + RLS-safe; missing-relation here would
  // be a deeper problem than this PR can rescue, so we just bail to all-
  // manual + let the budget page render the existing flow.
  if (profilesRes.error && !isMissingRelation(profilesRes.error)) {
    return lookup;
  }
  const profileNameById = new Map<string, string>();
  for (const row of (profilesRes.data ?? []) as {
    vendor_profile_id: string;
    business_name: string;
  }[]) {
    profileNameById.set(row.vendor_profile_id, row.business_name);
  }

  // (1) Pull active event_vendor_packages bookings for this event +
  //     their package_id, items, replacement values. The cascade-lock
  //     flow (PR #340 lineage) populates event_vendors.event_vendor_package_id
  //     so each cascade-created event_vendor row knows which booking it
  //     belongs to.
  const packageBookings: {
    booking_id: string;
    package_id: string;
    status: string;
  }[] = [];
  const eventVendorPackageIds = Array.from(
    new Set(
      eventVendors
        .map((v) => (v as { event_vendor_package_id?: string | null }).event_vendor_package_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  if (eventVendorPackageIds.length > 0) {
    const bookingsRes = await supabase
      .from('event_vendor_packages')
      .select('booking_id, package_id, status')
      .in('booking_id', eventVendorPackageIds);
    // Graceful-degrade — if event_vendor_packages doesn't exist in prod
    // yet (it shipped via 20260604110000_vendor_packages.sql), skip the
    // package branch entirely. Service-fee fallback below still fires.
    if (!bookingsRes.error || isMissingRelation(bookingsRes.error)) {
      for (const row of (bookingsRes.data ?? []) as {
        booking_id: string;
        package_id: string;
        status: string;
      }[]) {
        // Only 'locked' bookings drive vendor-controlled items. A
        // 'considering' booking is still a draft from the host's side;
        // 'released' means the host backed out and the items should
        // disappear from budget tracking.
        if (row.status === 'locked') {
          packageBookings.push(row);
        }
      }
    }
  }

  // Resolve package items for every locked booking in one query.
  const packageIds = Array.from(new Set(packageBookings.map((b) => b.package_id)));
  const itemsByPackageId = new Map<
    string,
    Array<{
      item_id: string;
      canonical_service: string;
      service_description: string;
      replacement_value_centavos: number;
      display_order: number;
    }>
  >();
  if (packageIds.length > 0) {
    const itemsRes = await supabase
      .from('vendor_package_items')
      .select(
        'item_id, package_id, canonical_service, service_description, replacement_value_centavos, display_order',
      )
      .in('package_id', packageIds)
      .order('display_order', { ascending: true });
    if (!itemsRes.error || isMissingRelation(itemsRes.error)) {
      for (const row of (itemsRes.data ?? []) as Array<{
        item_id: string;
        package_id: string;
        canonical_service: string;
        service_description: string;
        replacement_value_centavos: number;
        display_order: number;
      }>) {
        const arr = itemsByPackageId.get(row.package_id) ?? [];
        arr.push(row);
        itemsByPackageId.set(row.package_id, arr);
      }
    }
  }

  // Also resolve which items the host REMOVED from each booking via the
  // customization modal — those line items should NOT appear in budget
  // tracking even though they're still in vendor_package_items. We re-read
  // the bookings to get customizations_json.
  const removedItemIdsByBookingId = new Map<string, Set<string>>();
  if (packageBookings.length > 0) {
    const customRes = await supabase
      .from('event_vendor_packages')
      .select('booking_id, customizations_json')
      .in(
        'booking_id',
        packageBookings.map((b) => b.booking_id),
      );
    if (!customRes.error) {
      for (const row of (customRes.data ?? []) as Array<{
        booking_id: string;
        customizations_json: { removed_item_ids?: string[] } | null;
      }>) {
        const removed = row.customizations_json?.removed_item_ids ?? [];
        removedItemIdsByBookingId.set(row.booking_id, new Set(removed));
      }
    }
  }

  // For each event_vendor with an event_vendor_package_id, walk the items
  // for that booking, skip removed ones, and stamp the lookup entry.
  for (const ev of eventVendors) {
    const bookingId = (ev as { event_vendor_package_id?: string | null })
      .event_vendor_package_id;
    if (!bookingId) continue;
    const booking = packageBookings.find((b) => b.booking_id === bookingId);
    if (!booking) continue;
    const items = itemsByPackageId.get(booking.package_id) ?? [];
    const removed = removedItemIdsByBookingId.get(bookingId) ?? new Set<string>();
    const vendorBusinessName =
      profileNameById.get(ev.marketplace_vendor_id as string) ?? ev.vendor_name;
    const controlled: VendorControlledLineItem[] = items
      .filter((it) => !removed.has(it.item_id))
      .map((it) => ({
        source_id: `pkg:${it.item_id}`,
        source_kind: 'package' as const,
        label: it.service_description || it.canonical_service,
        // vendor_package_items.replacement_value_centavos is BIGINT
        // centavos; convert to PHP for the budget snapshot's NUMERIC PHP
        // semantics (matches event_vendor_line_items.amount_php).
        amount_php: Number(it.replacement_value_centavos) / 100,
        vendor_business_name: vendorBusinessName,
      }));
    if (controlled.length > 0) {
      lookup.set(ev.vendor_id, {
        priceSource: 'package',
        items: controlled,
      });
    }
  }

  // (2) Service fallback — for any marketplace vendor that has NO package
  //     booking but DOES have a published vendor_services row matching
  //     their category, surface one synthetic "Service fee" line item
  //     from starting_price_php.
  const serviceCandidates = marketplaceVendors.filter(
    (v) => !lookup.has(v.vendor_id),
  );
  if (serviceCandidates.length > 0) {
    const servicesRes = await supabase
      .from('vendor_services')
      .select('vendor_service_id, vendor_profile_id, category, starting_price_php, is_active')
      .in(
        'vendor_profile_id',
        serviceCandidates.map((v) => v.marketplace_vendor_id as string),
      )
      .eq('is_active', true);
    if (!servicesRes.error || isMissingRelation(servicesRes.error)) {
      type ServiceRow = {
        vendor_service_id: string;
        vendor_profile_id: string;
        category: string;
        starting_price_php: number | null;
        is_active: boolean;
      };
      const services = (servicesRes.data ?? []) as ServiceRow[];
      // Build a (profile_id, category) → service map for O(1) lookup. A category
      // can now hold MULTIPLE service listings (#1 multi-service-per-leaf), so
      // keep the CHEAPEST priced one per key — a deterministic "from" price
      // (matches the marketplace card's min-price reducer) instead of letting
      // the last row silently win.
      const serviceByKey = new Map<string, ServiceRow>();
      for (const s of services) {
        const key = `${s.vendor_profile_id}:${s.category}`;
        const cur = serviceByKey.get(key);
        if (
          !cur ||
          (s.starting_price_php !== null &&
            (cur.starting_price_php === null ||
              s.starting_price_php < cur.starting_price_php))
        ) {
          serviceByKey.set(key, s);
        }
      }
      for (const ev of serviceCandidates) {
        const key = `${ev.marketplace_vendor_id}:${ev.category}`;
        const svc = serviceByKey.get(key);
        if (!svc || svc.starting_price_php === null) continue;
        const vendorBusinessName =
          profileNameById.get(ev.marketplace_vendor_id as string) ?? ev.vendor_name;
        lookup.set(ev.vendor_id, {
          priceSource: 'service',
          items: [
            {
              source_id: `svc:${svc.vendor_service_id}`,
              source_kind: 'service',
              label: `Service fee — ${VENDOR_CATEGORY_LABEL[ev.category]}`,
              amount_php: Number(svc.starting_price_php),
              vendor_business_name: vendorBusinessName,
            },
          ],
        });
      }
    }
  }

  // (3) Pending — marketplace vendor with neither package nor service.
  //     Surface a polite empty-state on the card so the host knows to
  //     poke the vendor in chat instead of typing the pricing themselves.
  for (const ev of marketplaceVendors) {
    if (!lookup.has(ev.vendor_id)) {
      lookup.set(ev.vendor_id, { priceSource: 'pending', items: [] });
    }
  }

  // Silence unused warning while keeping the read for future use (the
  // event_id parameter scopes the package-booking lookup; the marketplace
  // vendor profile lookup is event-agnostic).
  void eventId;

  return lookup;
}

/**
 * Single-vendor variant of fetchBudgetSnapshot. Fetches ONLY this vendor's
 * row + line items + payments (+ only this vendor's pricing lookup) and
 * returns its VendorBudgetSummary — so per-vendor surfaces (e.g. the service
 * workspace page) don't pull the whole event's budget just to render one card.
 *
 * The summary math mirrors the per-vendor block inside fetchBudgetSnapshot;
 * kept inline (not extracted) so fetchBudgetSnapshot — which powers the budget
 * page — stays byte-for-byte unchanged. Returns null when the event_vendors
 * row is missing or RLS-denied.
 */
export async function fetchVendorBudgetSummary(
  supabase: SupabaseClient,
  eventId: string,
  vendorId: string,
): Promise<VendorBudgetSummary | null> {
  const [vendorRes, lineItemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('event_vendors')
      .select(
        'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,total_cost_php,deposit_paid_php,notes,created_at,marketplace_vendor_id,event_vendor_package_id',
      )
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .maybeSingle(),
    supabase
      .from('event_vendor_line_items')
      .select('line_item_id,event_id,vendor_id,label,amount_php,due_date,sort_order,created_at')
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('event_vendor_payments')
      .select(
        'payment_id,event_id,vendor_id,line_item_id,amount_php,paid_at,method,reference,notes,created_at',
      )
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .order('paid_at', { ascending: false }),
  ]);

  if (vendorRes.error || !vendorRes.data) return null;
  const vendor = vendorRes.data as EventVendorRow;
  const myLineItems = (lineItemsRes.data ?? []) as LineItemRow[];
  const myPayments = (paymentsRes.data ?? []) as PaymentRow[];

  const pricingLookup = await buildVendorPricingLookup(supabase, eventId, [vendor]);
  const pricing = pricingLookup.get(vendor.vendor_id);
  const priceSource: VendorPriceSource = pricing?.priceSource ?? 'manual';
  const vendorControlledItems = pricing?.items ?? [];

  const vendorControlledTotal = vendorControlledItems.reduce((acc, item) => acc + item.amount_php, 0);
  const manualItemized = myLineItems.reduce((acc, li) => acc + Number(li.amount_php), 0);
  const headline = Number(vendor.total_cost_php ?? 0);
  let itemizedTotal: number;
  if (vendorControlledTotal > 0 && manualItemized > 0) {
    itemizedTotal = vendorControlledTotal + manualItemized;
  } else if (vendorControlledTotal > 0) {
    itemizedTotal = vendorControlledTotal;
  } else if (manualItemized > 0) {
    itemizedTotal = manualItemized;
  } else {
    itemizedTotal = headline;
  }
  const paidTotal = myPayments.reduce((acc, p) => acc + Number(p.amount_php), 0);

  return {
    vendor,
    lineItems: myLineItems,
    payments: myPayments,
    itemizedTotal,
    paidTotal,
    remaining: Math.max(0, itemizedTotal - paidTotal),
    priceSource,
    vendorControlledItems,
  };
}

export async function fetchBudgetSnapshot(
  supabase: SupabaseClient,
  eventId: string,
): Promise<BudgetSnapshot> {
  const [vendorsRes, lineItemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('event_vendors')
      .select(
        // Extended to include marketplace_vendor_id (PR #340 lineage) +
        // event_vendor_package_id (vendor_packages cascade-lock PR
        // lineage). Both fields are nullable + non-breaking — when the
        // column is missing in prod, Supabase returns undefined and the
        // downstream code treats it as null + falls back to 'manual'.
        'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,total_cost_php,deposit_paid_php,notes,created_at,marketplace_vendor_id,event_vendor_package_id',
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
    supabase
      .from('event_vendor_line_items')
      .select('line_item_id,event_id,vendor_id,label,amount_php,due_date,sort_order,created_at')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('event_vendor_payments')
      .select(
        'payment_id,event_id,vendor_id,line_item_id,amount_php,paid_at,method,reference,notes,created_at',
      )
      .eq('event_id', eventId)
      .order('paid_at', { ascending: false }),
  ]);

  if (vendorsRes.error) throw new Error(vendorsRes.error.message);
  if (lineItemsRes.error) throw new Error(lineItemsRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);

  const vendors = (vendorsRes.data ?? []) as EventVendorRow[];
  const lineItems = (lineItemsRes.data ?? []) as LineItemRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];

  // Build the per-vendor pricing-source lookup BEFORE summarizing so each
  // VendorBudgetSummary can carry priceSource + vendor-controlled items.
  // Graceful-degrade — if any of the joined tables don't exist in prod
  // yet, this returns an empty/partial lookup and every vendor falls
  // through to 'manual' (the legacy behavior).
  const pricingLookup = await buildVendorPricingLookup(supabase, eventId, vendors);

  const summaries: VendorBudgetSummary[] = vendors.map((vendor) => {
    const myLineItems = lineItems.filter((li) => li.vendor_id === vendor.vendor_id);
    const myPayments = payments.filter((p) => p.vendor_id === vendor.vendor_id);
    const pricing = pricingLookup.get(vendor.vendor_id);

    // priceSource resolution order:
    //   1. If the vendor has a package booking (priceSource='package')
    //      OR a matching vendor_services row (priceSource='service'), use
    //      those — vendor-controlled pricing wins.
    //   2. If the vendor is marketplace-linked but vendor hasn't
    //      published anything yet (priceSource='pending'), surface the
    //      polite empty-state on the card.
    //   3. Otherwise (off-platform OR no marketplace_vendor_id),
    //      priceSource='manual' — legacy host-entered flow.
    //
    // BUT if the host has ALSO manually entered line items on a
    // marketplace vendor (legacy data from before vendor pricing was
    // wired up, or override entries), preserve them — those land in
    // `lineItems` as before. The UI surfaces both lists, clearly labeled.
    const priceSource: VendorPriceSource =
      pricing?.priceSource ?? 'manual';
    const vendorControlledItems = pricing?.items ?? [];

    const vendorControlledTotal = vendorControlledItems.reduce(
      (acc, item) => acc + item.amount_php,
      0,
    );
    const manualItemized = myLineItems.reduce((acc, li) => acc + Number(li.amount_php), 0);
    const headline = Number(vendor.total_cost_php ?? 0);

    // Itemized total — vendor-controlled items take precedence; manual
    // items add on top (rare, but handled cleanly when both exist);
    // headline total_cost_php is the legacy fallback for vendors with
    // neither source.
    let itemizedTotal: number;
    if (vendorControlledTotal > 0 && manualItemized > 0) {
      itemizedTotal = vendorControlledTotal + manualItemized;
    } else if (vendorControlledTotal > 0) {
      itemizedTotal = vendorControlledTotal;
    } else if (manualItemized > 0) {
      itemizedTotal = manualItemized;
    } else {
      itemizedTotal = headline;
    }

    const paidTotal = myPayments.reduce((acc, p) => acc + Number(p.amount_php), 0);
    return {
      vendor,
      lineItems: myLineItems,
      payments: myPayments,
      itemizedTotal,
      paidTotal,
      remaining: Math.max(0, itemizedTotal - paidTotal),
      priceSource,
      vendorControlledItems,
    };
  });

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30);
  let upcomingDueAmount = 0;
  let upcomingDueCount = 0;
  for (const s of summaries) {
    for (const li of s.lineItems) {
      if (!li.due_date) continue;
      const d = new Date(`${li.due_date}T00:00:00`);
      if (d >= now && d <= horizon) {
        upcomingDueAmount += Number(li.amount_php);
        upcomingDueCount += 1;
      }
    }
  }

  const totals = {
    budget: summaries.reduce((acc, s) => acc + s.itemizedTotal, 0),
    paid: summaries.reduce((acc, s) => acc + s.paidTotal, 0),
    remaining: summaries.reduce((acc, s) => acc + s.remaining, 0),
    upcomingDueAmount,
    upcomingDueCount,
  };

  return { vendors: summaries, totals };
}

export function vendorLabel(vendor: EventVendorRow): string {
  return `${vendor.vendor_name} · ${VENDOR_CATEGORY_LABEL[vendor.category]}`;
}

/**
 * Escape ICS TEXT values per RFC 5545 §3.3.11.
 * Backslash, comma, and semicolon are escaped; newlines become "\\n".
 */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDate(date: string): string {
  return date.replace(/-/g, '');
}

function icsTimestampNow(): string {
  const now = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${z(now.getUTCMonth() + 1)}${z(now.getUTCDate())}` +
    `T${z(now.getUTCHours())}${z(now.getUTCMinutes())}${z(now.getUTCSeconds())}Z`
  );
}

/**
 * Render a VCALENDAR with one VEVENT per upcoming-or-unpaid line item that
 * has a due_date. Past + fully-paid line items are skipped so the calendar
 * stays useful.
 */
export function renderBudgetIcs(args: {
  eventName: string;
  vendors: VendorBudgetSummary[];
}): string {
  const { eventName, vendors } = args;
  const stamp = icsTimestampNow();
  const events: string[] = [];

  for (const summary of vendors) {
    for (const li of summary.lineItems) {
      if (!li.due_date) continue;
      // Skip line items that are fully covered by payments to keep the
      // calendar focused on still-owed money.
      const paidForLine = summary.payments
        .filter((p) => p.line_item_id === li.line_item_id)
        .reduce((acc, p) => acc + Number(p.amount_php), 0);
      const isFullyPaid = paidForLine >= Number(li.amount_php) && Number(li.amount_php) > 0;
      if (isFullyPaid) continue;

      const summaryText = `Payment due: ${summary.vendor.vendor_name} — ${li.label}`;
      const description =
        `Amount: ₱${Number(li.amount_php).toLocaleString('en-PH')}\n` +
        `Vendor: ${vendorLabel(summary.vendor)}\n` +
        `Event: ${eventName}\n` +
        (paidForLine > 0
          ? `Already paid against this line: ₱${paidForLine.toLocaleString('en-PH')}`
          : 'No payments yet against this line.');

      events.push(
        [
          'BEGIN:VEVENT',
          `UID:lineitem-${li.line_item_id}@setnayan.com`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${icsDate(li.due_date)}`,
          `SUMMARY:${icsEscape(summaryText)}`,
          `DESCRIPTION:${icsEscape(description)}`,
          'END:VEVENT',
        ].join('\r\n'),
      );
    }
  }

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Setnayan//Budget//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(`${eventName} · Setnayan Budget`)}`,
    ...events,
    'END:VCALENDAR',
  ];

  // RFC 5545 requires CRLF line endings.
  return cal.join('\r\n') + '\r\n';
}

export function formatPhp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `₱${Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
