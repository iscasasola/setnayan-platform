import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchClaimLandingByToken, isCoupleMadeInvite, readInviteOffer, type ClaimLandingData } from '@/lib/vendor-invites';
import { doorOffer, offerFromInvite } from '@/lib/personal-invite-offer';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { claimDatePhrase } from '@/lib/claim-invite-words';
import { displayServiceLabel } from '@/lib/vendors';
import { agreedTotalNow, CHANGE_LINES_EMBED, type ChangeLineRow } from '@/lib/agreed-total-and-its-changes';
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
  if (!data || data.invite.status !== 'pending') return { open: false };
  // 🎁 Setnayan's own personal invite (owner 7 Nov: "yes") — its own record: the invite + the shop the admin staged.
  if (data.invite.source === 'admin') return { open: true, record: await readSetnayanInvite(admin, token, data) };
  if (!isCoupleMadeInvite(data.invite.source) || !data.parentVendor) {
    return { open: false };
  }
  const parent = data.parentVendor;
  const event = data.event;

  const [siblingsRes, planRes, eventRes, cardRes, words] = await Promise.all([
    admin
      .from('event_vendors')
      .select(`vendor_id, category, category_key, vendor_name, total_cost_php, host_inclusions, manual_vendor_id, created_at, ${CHANGE_LINES_EMBED}`)
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
    change_lines?: ChangeLineRow[] | null;
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
      // The agreed total NOW — the headline plus any change the couple has logged since.
      price: peso(agreedTotalNow(r.total_cost_php, r.change_lines)),
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
      from: 'couple',
      offer: null,
      inviterName: event?.couple_display_name ?? 'A Setnayan couple',
      hostNoun: words?.host ?? 'host',
      eventWord: words?.eventWord ?? 'event',
      eventType: (eventRes.data as { event_type?: string | null } | null)?.event_type ?? null,
      datePhrase: date ? `${date.preposition} ${date.label}` : null,
      business: parent.vendor_name || data.invite.business_name || '',
      contactPerson: parent.contact_person,
      contactPhone: parent.contact_phone,
      inviteEmail: (data.invite.email || parent.contact_email || '').trim().toLowerCase() || null,
      services,
      price: total > 0 ? total : null,
      inclusions,
      plan,
    },
  };
}

/**
 * 🎁 SETNAYAN'S OWN INVITE, as the door reads it (owner 7 Nov: "yes" — the personal invite moves to the claim door,
 * pre-filled and keeping the offer). No couple, no event, no booking: the details are the shop the admin STAGED
 * (`vendor_invites.claimed_vendor_profile_id`, a row with no owner yet), else the invite's own snapshot; the offer is
 * the claim page's own read (`readInviteOffer` → `doorOffer`). The claim itself — handing the staged shop over and
 * applying the offer — stays the shipped `claim_ready_the_invited_shop`, called by the finish.
 *
 * A refused staged-shop read is logged and the door falls back to the invite's snapshot (name + service), which is
 * what the claim page shows too; a refused offer read draws no offer rows, exactly as the claim page does — the SQL
 * claim reads the offer from the invite row itself, so nothing is lost.
 */
async function readSetnayanInvite(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
  data: ClaimLandingData,
): Promise<ClaimDoorRecord> {
  const inv = data.invite;
  type Staged = { business_name: string | null; business_owner_name: string | null; contact_phone: string | null; services: string[] | null };
  let staged: Staged | null = null;
  if (inv.claimed_vendor_profile_id) {
    const { data: row, error } = await admin
      .from('vendor_profiles')
      .select('business_name, business_owner_name, contact_phone, services')
      .eq('vendor_profile_id', inv.claimed_vendor_profile_id)
      .is('user_id', null)
      .maybeSingle();
    if (error) console.error('[supabase-error] lib/claim-door.server.ts · from:vendor_profiles.select (staged shop)', error);
    staged = (row as Staged | null) ?? null;
  }
  const stored = await readInviteOffer(admin, inv.invite_id);
  const keys = [...new Set([...(staged?.services ?? []), ...(inv.service_category ? [inv.service_category] : [])].map((x) => String(x).trim()).filter(Boolean))];
  return {
    token,
    from: 'setnayan',
    offer: stored ? doorOffer(offerFromInvite(stored)) : null,
    inviterName: 'the Setnayan team',
    hostNoun: 'Setnayan',
    eventWord: 'event',
    eventType: null,
    datePhrase: null,
    business: (staged?.business_name || inv.business_name || '').trim(),
    contactPerson: staged?.business_owner_name?.trim() || null,
    contactPhone: staged?.contact_phone?.trim() || null,
    inviteEmail: (inv.email || '').trim().toLowerCase() || null,
    services: keys.map((category) => ({ category, tileId: null, label: displayServiceLabel(category), price: null, inclusions: [] })),
    price: null,
    inclusions: [],
    plan: [],
  };
}
