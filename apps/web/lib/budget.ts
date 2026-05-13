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

export type VendorBudgetSummary = {
  vendor: EventVendorRow;
  lineItems: LineItemRow[];
  payments: PaymentRow[];
  itemizedTotal: number;
  paidTotal: number;
  remaining: number;
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

export async function fetchBudgetSnapshot(
  supabase: SupabaseClient,
  eventId: string,
): Promise<BudgetSnapshot> {
  const [vendorsRes, lineItemsRes, paymentsRes] = await Promise.all([
    supabase
      .from('event_vendors')
      .select(
        'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,total_cost_php,deposit_paid_php,notes,created_at',
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

  const summaries: VendorBudgetSummary[] = vendors.map((vendor) => {
    const myLineItems = lineItems.filter((li) => li.vendor_id === vendor.vendor_id);
    const myPayments = payments.filter((p) => p.vendor_id === vendor.vendor_id);
    const itemized = myLineItems.reduce((acc, li) => acc + Number(li.amount_php), 0);
    const headline = Number(vendor.total_cost_php ?? 0);
    const itemizedTotal = itemized > 0 ? itemized : headline;
    const paidTotal = myPayments.reduce((acc, p) => acc + Number(p.amount_php), 0);
    return {
      vendor,
      lineItems: myLineItems,
      payments: myPayments,
      itemizedTotal,
      paidTotal,
      remaining: Math.max(0, itemizedTotal - paidTotal),
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
