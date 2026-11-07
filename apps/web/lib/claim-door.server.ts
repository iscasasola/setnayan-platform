import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken, isCoupleMadeInvite } from '@/lib/vendor-invites';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { claimDatePhrase } from '@/lib/claim-invite-words';
import { displayServiceLabel } from '@/lib/vendors';
import type { ClaimDoorPayment, ClaimDoorRecord, ClaimDoorService } from './claim-door';

/**
 * The couple's record, as the claim door reads it — through the SHIPPED token check, `fetchClaimLandingByToken`
 * (the token IS the access gate; the same read `/vendor/claim/<token>` and its finalize make, including the lazy
 * expiry sweep and the first-opened stamp). Nothing here decides who may claim: a link that is not a pending,
 * couple-made invite answers `{ open: false }` and the door sends the visitor back to `/vendor/claim/<token>`, whose
 * dead ends (claimed · expired · revoked · declined · not found) already say the right sentence.
 *
 * The extra reads are the rest of the contact card the couple filed (owner 2026-11-06: *"they have a price, and
 * services"*): every `event_vendors` row of the same manual contact card on that event — one per service — with its
 * price (`total_cost_php`) and inclusions (`host_inclusions`), and the parent row's payment plan. A refused extra read
 * is not "nothing recorded": the door then shows only what the shipped landing read returned, and says nothing it
 * cannot stand behind.
 */
export async function readClaimDoor(
  token: string,
): Promise<{ open: true; record: ClaimDoorRecord } | { open: false }> {
  if (!token || token.length > 200) return { open: false };
  const admin = createAdminClient();
  const data = await fetchClaimLandingByToken(admin, token).catch(() => null);
  if (!data || data.invite.status !== 'pending' || !isCoupleMadeInvite(data.invite.source) || !data.parentVendor) {
    return { open: false };
  }
  const parent = data.parentVendor;
  const event = data.event;

  const [siblingsRes, planRes, eventRes, cardRes, words] = await Promise.all([
    admin
      .from('event_vendors')
      .select('vendor_id, category, category_key, vendor_name, total_cost_php, host_inclusions, manual_vendor_id, created_at')
      .eq('event_id', parent.event_id)
      .order('created_at', { ascending: true }),
    admin
      .from('event_vendor_payment_plan')
      .select('instances_json')
      .eq('event_id', parent.event_id)
      .eq('event_vendor_id', parent.vendor_id)
      .maybeSingle(),
    admin.from('events').select('event_type').eq('event_id', parent.event_id).maybeSingle(),
    admin.from('event_vendors').select('manual_vendor_id').eq('vendor_id', parent.vendor_id).maybeSingle(),
    eventWordsForEvent(parent.event_id).catch(() => null),
  ]);
  if (siblingsRes.error) console.error('[supabase-error] lib/claim-door.server.ts · from:event_vendors.select', siblingsRes.error);
  if (planRes.error) console.error('[supabase-error] lib/claim-door.server.ts · from:event_vendor_payment_plan.select', planRes.error);

  type Row = {
    vendor_id: string;
    category: string | null;
    category_key: string | null;
    vendor_name: string | null;
    total_cost_php: number | string | null;
    host_inclusions: string[] | null;
    manual_vendor_id: string | null;
  };
  const card = (cardRes.data as { manual_vendor_id?: string | null } | null)?.manual_vendor_id ?? null;
  const all = (siblingsRes.data ?? []) as Row[];
  // The parent row always; its siblings only when they hang off the SAME manual contact card.
  const rows = card ? all.filter((r) => r.manual_vendor_id === card) : all.filter((r) => r.vendor_id === parent.vendor_id);
  if (!rows.some((r) => r.vendor_id === parent.vendor_id)) {
    rows.unshift({
      vendor_id: parent.vendor_id,
      category: parent.category,
      category_key: null,
      vendor_name: parent.vendor_name,
      total_cost_php: null,
      host_inclusions: null,
      manual_vendor_id: card,
    });
  }
  // The invite's own row first — it is the service the link was made for.
  rows.sort((a, b) => (a.vendor_id === parent.vendor_id ? -1 : b.vendor_id === parent.vendor_id ? 1 : 0));

  const peso = (v: number | string | null) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const seen = new Set<string>();
  const services: ClaimDoorService[] = [];
  for (const r of rows) {
    const category = (r.category ?? '').trim();
    if (!category || seen.has(category)) continue;
    seen.add(category);
    services.push({
      category,
      tileId: r.category_key ?? null,
      label: displayServiceLabel(category),
      price: peso(r.total_cost_php),
      inclusions: (r.host_inclusions ?? []).map((s) => String(s).trim()).filter(Boolean),
    });
  }
  const total = services.reduce((s, x) => s + (x.price ?? 0), 0);
  const inclusions = [...new Set(services.flatMap((s) => s.inclusions))];

  const raw = (planRes.data as { instances_json?: unknown } | null)?.instances_json;
  const plan: ClaimDoorPayment[] = (Array.isArray(raw) ? raw : [])
    .map((x) => x as { seq?: number; label?: string; amount_php?: number | null; due_date?: string | null })
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    .filter((x) => (x.amount_php ?? 0) > 0)
    .map((x) => ({ label: String(x.label ?? 'Payment'), due: x.due_date ?? null, amount: Math.round(Number(x.amount_php)) }));

  const date = claimDatePhrase(event?.event_date, event?.event_date_precision);
  return {
    open: true,
    record: {
      token,
      inviterName: event?.couple_display_name ?? 'A Setnayan couple',
      hostNoun: words?.host ?? 'host',
      eventWord: words?.eventWord ?? 'event',
      eventType: (eventRes.data as { event_type?: string | null } | null)?.event_type ?? null,
      datePhrase: date ? `${date.preposition} ${date.label}` : null,
      business: parent.vendor_name || data.invite.business_name || '',
      contactPerson: parent.contact_person,
      contactPhone: parent.contact_phone,
      services,
      price: total > 0 ? total : null,
      inclusions,
      plan,
    },
  };
}
