import type { SupabaseClient } from '@supabase/supabase-js';

export type ActivityItem = {
  id: string;
  at: string;
  description: string;
  href: string;
};

type Row = Pick<ActivityItem, 'id' | 'at' | 'description' | 'href'>;

export async function fetchEventActivity(
  supabase: SupabaseClient,
  eventId: string,
  limit: number,
): Promise<ActivityItem[]> {
  const perSource = Math.min(Math.max(limit, 20), 200);

  const [guestsRes, vendorsRes, ordersRes, blocksRes] = await Promise.all([
    supabase
      .from('guests')
      .select('guest_id, first_name, last_name, rsvp_status, created_at, updated_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(perSource),
    supabase
      .from('event_vendors')
      .select('vendor_id, vendor_name, category, status, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(perSource),
    supabase
      .from('orders')
      .select('order_id, description, status, requested_total_php, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(perSource),
    supabase
      .from('event_schedule_blocks')
      .select('block_id, label, start_at, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(perSource),
  ]);

  const rows: Row[] = [];

  for (const g of guestsRes.data ?? []) {
    const name = [g.first_name, g.last_name].filter(Boolean).join(' ').trim() || 'Guest';
    const rsvp =
      g.rsvp_status === 'pending' ? 'awaiting RSVP'
      : g.rsvp_status === 'attending' ? 'confirmed attending'
      : g.rsvp_status === 'declined' ? 'declined'
      : g.rsvp_status ?? '';
    rows.push({
      id: `guest-${g.guest_id}`,
      at: g.created_at,
      description: `${name} added · ${rsvp}`,
      href: `/dashboard/${eventId}/guests/${g.guest_id}`,
    });
  }

  for (const v of vendorsRes.data ?? []) {
    rows.push({
      id: `vendor-${v.vendor_id}`,
      at: v.created_at,
      description: `Vendor added · ${v.vendor_name} (${v.category})`,
      href: `/dashboard/${eventId}/vendors`,
    });
  }

  for (const o of ordersRes.data ?? []) {
    const peso = formatPeso(o.requested_total_php);
    rows.push({
      id: `order-${o.order_id}`,
      at: o.created_at,
      description: `Order placed · ${o.description}${peso ? ` · ${peso}` : ''}`,
      href: `/dashboard/${eventId}/orders`,
    });
  }

  for (const b of blocksRes.data ?? []) {
    rows.push({
      id: `block-${b.block_id}`,
      at: b.created_at,
      description: `Schedule added · ${b.label}`,
      href: `/dashboard/${eventId}/schedule`,
    });
  }

  rows.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return rows.slice(0, limit);
}

function formatPeso(value: number | null): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
