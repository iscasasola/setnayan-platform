'use server';

/**
 * 🎟 THE SUPPLIER CLAIM SCANNER — the ONE server action every side calls (DECISION_LOG 2026-09-25 "SUPPLIERS CLAIM A
 * GUEST'S SERVICE BY SCANNING…", 2026-10-03 "SUPPLIER SCAN … APPROVED", 2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE
 * SET ONCE PER SERVICE"):
 *
 *   { op: 'set_scanner' }   Shop › Services — a service's scanner Off · <mode>, set once for every event booked for it
 *   { op: 'claim' }         the Event Hub's Scanner view — one QR or tag → "✓ #0042 · Claimed 142 of 176"
 *   { op: 'admin_remove' }  Admin › the event — Setnayan takes back a claim recorded in error (audited)
 *
 * 🔢 ONE EXPORT ON PURPOSE: every exported server action is a Vercel route, and the repo budget
 * (`scripts/lint-server-action-budget.mjs`) sat at its ceiling. The later slices (Ordered → Received, group sessions,
 * roaming, the guest's review) add OPS here, never exports.
 *
 * 🔑 Every rule that matters is in SQL (migration 20271309463657) and each op runs under the CALLER'S OWN session,
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
import { realNameParts, withoutPlaceholderWord } from '@/lib/seat-placeholder-words';
import {
  scanRefusalWords,
  scannerChoiceToSetting,
  type ScanAnswer,
  type ScanMode,
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
  const a = (data ?? {}) as { outcome?: string; number?: number | null; claimed?: number | null; total?: number | null };
  if (a.outcome === 'not_guest') return { outcome: 'not_guest' };
  if (a.outcome !== 'claimed' && a.outcome !== 'already') return { outcome: 'refused', message: scanRefusalWords('') };

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
  return { outcome: 'claimed', number: Number(a.number), claimed: Number(a.claimed ?? 0), total: Number(a.total ?? 0), name };
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
