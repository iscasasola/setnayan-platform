'use server';

/**
 * 🎟 THE SUPPLIER CLAIM SCANNER — the ONE server action every side calls (DECISION_LOG 2026-09-25 "SUPPLIERS CLAIM A
 * GUEST'S SERVICE BY SCANNING…", 2026-10-03 "SUPPLIER SCAN … APPROVED", 2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE
 * SET ONCE PER SERVICE"):
 *
 *   { op: 'set_scanner' }   Shop › Services — a service's scanner Off · <mode>, set once for every event booked for it
 *   { op: 'claim' }         the Event Hub's Scanner view — one QR or tag → "✓ #0042 · Claimed 142 of 176"
 *   { op: 'ready' }         Ordered → Received — the supplier taps Ready on #0042; its guests are told on their Event Hub
 *   { op: 'numbers' }       "Your numbers" — number · guests · state, counts only
 *   { op: 'session_open' }  Group session — New shot: one number for everyone scanned into it
 *   { op: 'session_done' }  Group session — Done: the shot closes with its prints (default one per guest)
 *   { op: 'guest_review' }  the guest's optional "How was the Photo booth?" — rating or skip; WHO is their pass, never the request
 *   { op: 'admin_review' }  Admin › Reviews — publish or hide a guest's rating (audited; never on a public page yet)
 *   { op: 'admin_remove' }  Admin › the event — Setnayan takes back a claim recorded in error (audited)
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a Vercel route, and the repo budget
 * (`scripts/lint-server-action-budget.mjs`) sat at its ceiling. The later slices (Ordered → Received, group sessions,
 * roaming, the guest's review) add OPS here, never exports.
 *
 * 🔑 Every rule that matters is in SQL (migration 20271320327933) and each op runs under the CALLER'S OWN session,
 * so `auth.uid()` is the person pressing: the scan checks the shop (or its day-of grantee), the booking, the booked
 * service, the scanner, and that the code is a guest of THIS event; the setting is the shop's own RLS. Admin's op is
 * the only service-role write, behind `requireAdminAction`, and it is written to `admin_audit_log`.
 *
 * 👤 THE NUMBER AND THE GUEST'S FIRST NAME (owner 2026-11-05: *"name is fine"*, settling the 2026-10-28 row against the
 * older "count only"). The claim itself never hands back a name. After a recorded scan the claim op asks two things:
 *   · the guest list, under the SCANNER'S OWN access — a coordinator the hosts approved (an accepted, non-removed seat
 *     with the guest list shared) reads the full name, exactly as on the hosts' guest list (DECISION_LOG 2026-09-25
 *     "A HOST-APPROVED COORDINATOR SCANS WITH THE HOST'S VIEW"); the consent-gate flag is never consulted — the seat is;
 *   · otherwise `supplier_scan_first_name` — the FIRST name only, and only for a guest this shop has just claimed.
 *
 * 📶 Nothing is queued: the number is allocated by the database, so a scan with no signal is not a claim.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { parseGuestQrPayload } from '@/lib/checkin';
import { readGuestSession } from '@/lib/guest-session';
import { realNameParts, withoutPlaceholderWord } from '@/lib/seat-placeholder-words';
import {
  scanRefusalWords,
  scannerChoiceToSetting,
  type ScanAnswer,
  type ScanMode,
  type ScanNumberRow,
  type ScannerSaveResult,
  type SupplierScanReply,
  type SupplierScanRequest,
} from '@/lib/supplier-scan';

export async function supplierScan(req: SupplierScanRequest): Promise<SupplierScanReply> {
  switch (req.op) {
    case 'set_scanner':
      return { op: 'set_scanner', result: await setServiceScanner(req.coverageId, req.choice) };
    case 'claim':
      return { op: 'claim', result: await claim(req.eventId, req.coverageId, req.raw, req.via) };
    case 'ready':
      return { op: 'ready', result: await markReady(req.eventId, req.coverageId, req.number) };
    case 'numbers':
      return { op: 'numbers', result: await readNumbers(req.eventId, req.coverageId) };
    case 'session_open':
      return { op: 'session_open', result: await sessionOpen(req.eventId, req.coverageId) };
    case 'session_done':
      return { op: 'session_done', result: await sessionDone(req.eventId, req.coverageId, req.prints) };
    case 'guest_review':
      return { op: 'guest_review', result: await guestReview(req.eventId, req.coverageId, req.stars, req.line) };
    case 'admin_review':
      return { op: 'admin_review', result: await adminReview(req.reviewId, req.state) };
    case 'admin_remove':
      return { op: 'admin_remove', result: await adminRemove(req.eventId, req.kind, req.claimId) };
  }
}

async function setServiceScanner(coverageId: number, choice: string): Promise<ScannerSaveResult> {
  if (!Number.isSafeInteger(coverageId) || coverageId <= 0) return { ok: false, error: 'That service could not be found.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const { data: current, error: readError } = await supabase
    .from('supplier_scan_settings')
    .select('enabled, mode')
    .eq('coverage_id', coverageId)
    .maybeSingle();
  if (readError) {
    logQueryError('supplierScan.set_scanner.read', readError, { coverageId });
    return { ok: false, error: 'Couldn’t save just now. Try again.' };
  }
  const next = scannerChoiceToSetting(choice, (current as { enabled: boolean; mode: ScanMode } | null) ?? null);
  if (!next) return { ok: false, error: 'That scanner mode isn’t available yet.' };

  // vendor_profile_id is filled by the table's trigger from the coverage itself — never taken from here — and the
  // shop's own RLS admits only the shop that owns the coverage (owner + admin team members).
  const { error } = await supabase
    .from('supplier_scan_settings')
    .upsert({ coverage_id: coverageId, enabled: next.enabled, mode: next.mode, updated_by_user_id: user.id }, { onConflict: 'coverage_id' });
  if (error) {
    logQueryError('supplierScan.set_scanner.write', error, { coverageId });
    return { ok: false, error: 'Couldn’t save — only the shop’s owner or an admin can change a service’s scanner.' };
  }
  revalidatePath('/vendor-dashboard/shop');
  return { ok: true, choice: next.enabled ? next.mode : 'off' };
}

async function claim(eventId: string, coverageId: number, raw: string, via: 'qr' | 'nfc'): Promise<ScanAnswer> {
  const token = parseGuestQrPayload(raw);
  if (!token) return { outcome: 'unreadable' };
  if (!Number.isSafeInteger(coverageId) || coverageId <= 0) return { outcome: 'refused', message: scanRefusalWords('') };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { outcome: 'refused', message: 'Please sign in again.' };

  const { data, error } = await supabase.rpc('supplier_scan_claim', {
    p_event_id: eventId,
    p_coverage_id: coverageId,
    p_token: token,
    p_method: via === 'nfc' ? 'supplier_nfc' : 'supplier_qr',
  });
  if (error) {
    logQueryError('supplierScan.claim', error, { eventId, coverageId });
    return { outcome: 'refused', message: scanRefusalWords(`${error.message ?? ''} ${error.code ?? ''}`) };
  }
  const a = (data ?? {}) as {
    outcome?: string;
    number?: number | null;
    claimed?: number | null;
    total?: number | null;
    served?: number;
    unique?: number;
    guests?: number;
    of?: number;
  };
  if (a.outcome === 'not_guest') return { outcome: 'not_guest' };
  if (a.outcome === 'no_session') return { outcome: 'no_session' };
  const known = ['claimed', 'already', 'ordered', 'not_ready', 'received', 'served', 'added', 'in_session', 'picked_up', 'no_session'];
  if (!a.outcome || !known.includes(a.outcome)) return { outcome: 'refused', message: scanRefusalWords('') };

  // Host read parity — the guest list's own RLS decides, never this code. The two name columns only: this line on the
  // scanner is a confirmation ("Ana Reyes" / "Ana"), not a guest card.
  const { data: g } = await supabase.from('guests').select('first_name, last_name').eq('event_id', eventId).eq('qr_token', token).maybeSingle();
  const row = g as { first_name: string | null; last_name: string | null } | null;
  let name = row ? realGuestName(row.first_name, row.last_name) : null;
  if (!name) {
    // Every other booked supplier: the first name only, asked for after the claim is recorded.
    const { data: first, error: firstError } = await supabase.rpc('supplier_scan_first_name', {
      p_event_id: eventId,
      p_coverage_id: coverageId,
      p_token: token,
    });
    if (firstError) logQueryError('supplierScan.first_name', firstError, { eventId, coverageId });
    name = typeof first === 'string' ? withoutPlaceholderWord('first', first) || null : null;
  }

  if (a.outcome === 'already') return { outcome: 'already', number: a.number ?? null, name };
  if (a.outcome === 'ordered') return { outcome: 'ordered', number: Number(a.number), name };
  if (a.outcome === 'not_ready') return { outcome: 'not_ready', number: Number(a.number), name };
  if (a.outcome === 'served') return { outcome: 'served', number: Number(a.number), served: Number(a.served ?? 0), unique: Number(a.unique ?? 0), name };
  if (a.outcome === 'added') return { outcome: 'added', number: Number(a.number), guests: Number(a.guests ?? 0), name };
  if (a.outcome === 'in_session') return { outcome: 'in_session', number: Number(a.number), guests: Number(a.guests ?? 0), name };
  if (a.outcome === 'picked_up') return { outcome: 'picked_up', number: Number(a.number), claimed: Number(a.claimed ?? 0), of: Number(a.of ?? 0), name };
  if (a.outcome === 'received') {
    return { outcome: 'received', number: Number(a.number), claimed: Number(a.claimed ?? 0), total: Number(a.total ?? 0), name };
  }
  return { outcome: 'claimed', number: Number(a.number), claimed: Number(a.claimed ?? 0), total: Number(a.total ?? 0), name };
}

/** Ready on one number: its ordered guests go ready and each is told on their Event Hub — the database writes both. */
async function markReady(
  eventId: string,
  coverageId: number,
  number: number,
): Promise<{ ok: true; told: number } | { ok: false; error: string }> {
  if (!Number.isSafeInteger(number) || number <= 0) return { ok: false, error: 'That number could not be found.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('supplier_scan_ready', { p_event_id: eventId, p_coverage_id: coverageId, p_number: number });
  if (error) {
    logQueryError('supplierScan.ready', error, { eventId, coverageId });
    return { ok: false, error: scanRefusalWords(`${error.message ?? ''} ${error.code ?? ''}`) };
  }
  return { ok: true, told: Number(data ?? 0) };
}

/** "Your numbers" — counts only (no guest id crosses). null = the read failed. */
async function readNumbers(eventId: string, coverageId: number): Promise<ScanNumberRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('supplier_scan_numbers', { p_event_id: eventId, p_coverage_id: coverageId });
  if (error) {
    logQueryError('supplierScan.numbers', error, { eventId, coverageId });
    return null;
  }
  type Row = {
    scan_number: number;
    guests: number;
    ordered: number;
    ready: number;
    received: number;
    first_at: string;
    ready_at: string | null;
    received_at: string | null;
    prints?: number | null;
    open?: boolean;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    number: r.scan_number,
    guests: r.guests,
    ordered: r.ordered,
    ready: r.ready,
    received: r.received,
    firstAt: r.first_at,
    readyAt: r.ready_at,
    receivedAt: r.received_at,
    prints: r.prints ?? null,
    open: r.open === true,
  }));
}

/** New shot: one number, allocated now (an already-open shot is joined, never doubled). */
async function sessionOpen(eventId: string, coverageId: number): Promise<{ ok: true; number: number; guests: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('supplier_scan_session_open', { p_event_id: eventId, p_coverage_id: coverageId });
  if (error) {
    logQueryError('supplierScan.session_open', error, { eventId, coverageId });
    return { ok: false, error: scanRefusalWords(`${error.message ?? ''} ${error.code ?? ''}`) };
  }
  const d = (data ?? {}) as { number?: number; guests?: number };
  return { ok: true, number: Number(d.number), guests: Number(d.guests ?? 0) };
}

/** Done: the shot closes with its prints (null = one per guest); an empty shot is cancelled. */
async function sessionDone(
  eventId: string,
  coverageId: number,
  prints: number | null,
): Promise<Extract<SupplierScanReply, { op: 'session_done' }>['result']> {
  if (prints !== null && (!Number.isInteger(prints) || prints < 1 || prints > 99)) return { ok: false, error: scanRefusalWords('bad_prints') };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('supplier_scan_session_done', { p_event_id: eventId, p_coverage_id: coverageId, p_prints: prints });
  if (error) {
    logQueryError('supplierScan.session_done', error, { eventId, coverageId });
    return { ok: false, error: scanRefusalWords(`${error.message ?? ''} ${error.code ?? ''}`) };
  }
  const d = (data ?? {}) as { outcome?: string; number?: number; guests?: number; prints?: number };
  if (d.outcome === 'done') return { ok: true, outcome: 'done', number: Number(d.number), guests: Number(d.guests), prints: Number(d.prints) };
  if (d.outcome === 'cancelled') return { ok: true, outcome: 'cancelled', number: Number(d.number) };
  return { ok: true, outcome: 'none_open' };
}

/** Setnayan takes back one claim recorded in error. The number is not reused — a gap here is a visible correction. */
async function adminRemove(eventId: string, kind: 'scan' | 'souvenir', claimId: string): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireAdminAction();
  const admin = createAdminClient();
  // Two named reads, never `.from(<variable>)` — each one is a select the column guard can check.
  const cols = 'claim_id, guest_id, scan_number, vendor_profile_id, coverage_id';
  const { data: gone, error } =
    kind === 'souvenir'
      ? await admin.from('guest_souvenir_claims').delete().eq('claim_id', claimId).eq('event_id', eventId).select(cols)
      : await admin.from('supplier_scan_claims').delete().eq('claim_id', claimId).eq('event_id', eventId).select(cols);
  const table = kind === 'souvenir' ? 'guest_souvenir_claims' : 'supplier_scan_claims';
  if (error) {
    logQueryError('supplierScan.admin_remove', error, { eventId, kind });
    return { ok: false, error: 'Couldn’t remove it just now.' };
  }
  const row = (gone ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: 'That claim was already gone.' };
  const { error: auditError } = await admin.from('admin_audit_log').insert({
    action: 'supplier_scan_claim_remove',
    target_table: table,
    target_id: claimId,
    actor_user_id: userId,
    metadata: { event_id: eventId, ...row },
  });
  if (auditError) console.error('[supplierScan.admin_remove] audit log insert failed', auditError.message);
  // The admin page is opened by either the event's public id or its uuid — revalidate the route, not one address.
  revalidatePath('/admin/events/[eventId]', 'page');
  return { ok: true };
}

/** "Ben" for a +1 named Ben (the stored "+1" stand-in is never read out) — the guest list's own rule. */
function realGuestName(first: string | null, last: string | null): string | null {
  const p = realNameParts(first, last);
  return `${p.first} ${p.last}`.trim() || null;
}

/**
 * ⭐ The guest's answer. WHO is the pass this browser holds for THIS event (`readGuestSession` — the account outranks
 * the pass), never an id from the request; the database refuses unless that guest RECEIVED from that service.
 */
async function guestReview(
  eventId: string,
  coverageId: number,
  stars: number | null,
  line: string | null,
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  const session = await readGuestSession({ eventId });
  if (!session || session.event_id !== eventId) return { ok: false, error: 'Open your invitation again to answer.' };
  if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) return { ok: false, error: 'Pick a rating.' };
  const words = line?.trim() ? line.trim().slice(0, 140) : null;
  const { data, error } = await createAdminClient().rpc('supplier_scan_review_submit', {
    p_event_id: eventId,
    p_guest_id: session.guest_id,
    p_coverage_id: coverageId,
    p_stars: stars,
    p_line: words,
  });
  if (error) {
    logQueryError('supplierScan.guest_review', error, { eventId, coverageId });
    return { ok: false, error: 'Couldn’t send just now. Try again.' };
  }
  return { ok: true, saved: data === 'saved' };
}

/** Admin publishes or hides a guest's rating. Published shows on the supplier's page under Guest ratings (owner 2026-11-05). */
async function adminReview(reviewId: string, state: 'published' | 'hidden'): Promise<{ ok: boolean; error?: string }> {
  const { userId } = await requireAdminAction();
  if (state !== 'published' && state !== 'hidden') return { ok: false, error: 'Unknown state.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('supplier_scan_reviews')
    .update({ state, moderated_at: new Date().toISOString(), moderated_by_user_id: userId })
    .eq('review_id', reviewId)
    .select('review_id, vendor_profile_id, stars');
  if (error || !data?.length) {
    if (error) logQueryError('supplierScan.admin_review', error, { reviewId });
    return { ok: false, error: 'Couldn’t save that just now.' };
  }
  const { error: auditError } = await admin.from('admin_audit_log').insert({
    action: `supplier_scan_review_${state}`,
    target_table: 'supplier_scan_reviews',
    target_id: reviewId,
    actor_user_id: userId,
    metadata: data[0],
  });
  if (auditError) console.error('[supplierScan.admin_review] audit log insert failed', auditError.message);
  revalidatePath('/admin/reviews');
  return { ok: true };
}
