import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  decideAutoVerify,
  digitsOnly,
  maskTin,
  officialQrLink,
  type AutoVerifyDecision,
  type PaperEvidence,
} from '@/lib/auto-verify';
import { openSealedSlot, type IntakeSlot } from '@/lib/paper-intake';
import { paperSealKey, todayManila } from '@/lib/paper-intake.server';
import { liveCheckRegistryPage } from '@/lib/qr-live-check.server';
import type { LivePageResult } from '@/lib/qr-live-check';
import { parseRegistrationNumber } from '@/lib/vendor-registration-number';
import { applyApplicationDecision } from '@/lib/verification-decision.server';
import type { ReadableSlotKey } from '@/lib/verification-paper-read';

/**
 * auto-verify.server.ts — CLEAN PAPERS VERIFY THE SHOP ON SUBMIT, the server half.
 *
 * Called ONCE, from the supplier's Submit, AFTER the application has moved to
 * `pending_review`. It gathers the evidence on the server and only from the
 * server:
 *   · each paper's read — from its SEALED slot (`paper-intake.ts`). A slot the
 *     supplier could have edited does not open, and counts as not read;
 *   · the DTI/SEC registry page — opened only through the allowlist;
 *   · whether the number or TIN is on another shop — service-role lookups.
 * Nothing in the request body reaches the decision.
 *
 * `verify` → the SAME engine the admin's Approve button uses
 * (`applyApplicationDecision`), recorded as `approved_by: 'automatic'` with
 * every check. `to_admin` → nothing changes: the application is waiting for a
 * person, as it always was. EITHER WAY one JSON log is written to
 * `admin_audit_log` (action `vendor_verification_auto_check`): the fields read,
 * the QR links, the page result, per-field confidence, the decision and its
 * reason. No file bytes, no signed URLs, the TIN masked.
 *
 * NEVER THROWS; any failure is `to_admin`.
 */

export const AUTO_CHECK_AUDIT_ACTION = 'vendor_verification_auto_check';

const SLOTS: readonly ReadableSlotKey[] = ['dti_certificate', 'bir_2303', 'mayors_permit'];

async function duplicateLookups(
  vendorProfileId: string,
  regNumber: string | null,
  tinRaw: string | null,
): Promise<{ registrationNumber: boolean | null; tin: boolean | null }> {
  // The SERVICE ROLE, inline: another shop's tax identity is never readable by a
  // session (20271217955839), and this is a lookup ACROSS shops.
  const admin = createAdminClient();
  let registrationNumber: boolean | null = null;
  let tin: boolean | null = null;
  try {
    const parsed = regNumber ? parseRegistrationNumber(regNumber) : null;
    if (parsed && parsed.ok) {
      const { data, error } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id')
        .eq('registration_number_normalized', parsed.normalized)
        .neq('vendor_profile_id', vendorProfileId)
        .limit(1);
      registrationNumber = error ? null : (data ?? []).length > 0;
    }
  } catch {
    registrationNumber = null;
  }
  try {
    const base = tinRaw ? digitsOnly(tinRaw).slice(0, 9) : '';
    if (base.length === 9) {
      const pattern = `%${base.slice(0, 3)}%${base.slice(3, 6)}%${base.slice(6, 9)}%`;
      const { data, error } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id,tin_number')
        .ilike('tin_number', pattern)
        .neq('vendor_profile_id', vendorProfileId)
        .limit(50);
      tin = error
        ? null
        : (data ?? []).some((r) => digitsOnly(String((r as { tin_number: string | null }).tin_number ?? '')).slice(0, 9) === base);
    }
  } catch {
    tin = null;
  }
  return { registrationNumber, tin };
}

function maskedPaperLog(slot: ReadableSlotKey, s: IntakeSlot | null) {
  const m = s?.evidence?.model ?? null;
  return {
    slot,
    sealed: Boolean(s),
    manual: s?.manual === true,
    attempts: s?.attempts ?? null,
    kind: s?.kind ?? null,
    fields: m
      ? {
          account_name: m.accountName,
          owner_name: m.ownerName,
          // The BIR number IS the TIN — masked. Other numbers are registry numbers.
          registration_number: slot === 'bir_2303' ? maskTin(m.registrationNumber) : m.registrationNumber,
          tin: maskTin(m.tin),
          city: m.city,
          expiration_date: m.expirationDate,
        }
      : null,
    confidence: m ? { unsure: m.unsure, could_not_read: m.couldNotRead } : null,
    qr_urls: s?.evidence?.qrTexts ?? [],
  };
}

export async function runAutoVerifyOnSubmit(args: {
  /** Service-role client. */
  admin: SupabaseClient;
  applicationId: string;
  vendorProfileId: string;
}): Promise<AutoVerifyDecision> {
  const fallback = (reason: string): AutoVerifyDecision => ({ decision: 'to_admin', checks: [], reason });
  let decided: AutoVerifyDecision = fallback('The automatic check did not run.');
  let papersLog: unknown[] = [];
  let live: LivePageResult | null = null;
  try {
    const key = paperSealKey();
    if (!key) {
      decided = fallback('The automatic check is not configured — a person checks.');
    } else {
      const { data, error } = await args.admin
        .from('vendor_verification_applications')
        .select('vendor_profile_id,doc_uploads,status')
        .eq('application_id', args.applicationId)
        .maybeSingle();
      const row = data as { vendor_profile_id: string; doc_uploads: Record<string, unknown> | null; status: string } | null;
      if (error || !row || row.vendor_profile_id !== args.vendorProfileId) {
        decided = fallback('The application could not be read for the automatic check.');
      } else {
        const sealed = new Map(SLOTS.map((k) => [k, openSealedSlot(k, row.doc_uploads?.[k], key)] as const));
        papersLog = SLOTS.map((k) => maskedPaperLog(k, sealed.get(k) ?? null));
        const papers: PaperEvidence[] = SLOTS.map((k) => {
          const s = sealed.get(k) ?? null;
          return {
            slotKey: k,
            model: s?.evidence?.model ?? null,
            qrTexts: s?.evidence?.qrTexts ?? [],
            fileProblem: s ? null : row.doc_uploads?.[k] ? 'its read could not be confirmed' : null,
            manual: s?.manual === true,
          };
        });
        const dti = papers[0]!.model;
        const link = dti ? officialQrLink(papers[0]!.qrTexts, dti.registry) : null;
        const [livePage, duplicates] = await Promise.all([
          link
            ? liveCheckRegistryPage(link.href, { name: dti?.accountName ?? dti?.ownerName ?? null, number: dti?.registrationNumber ?? null })
            : Promise.resolve(null),
          duplicateLookups(args.vendorProfileId, dti?.registrationNumber ?? null, papers[1]!.model?.registrationNumber ?? null),
        ]);
        live = livePage;
        decided = decideAutoVerify({ papers, livePage, duplicates, todayManila: todayManila() });
      }
    }
  } catch {
    decided = fallback('The automatic check stopped part-way — a person checks.');
  }

  // ── One JSON log per submission — masked, no bytes, no signed URLs ───────
  try {
    await args.admin.from('admin_audit_log').insert({
      action: AUTO_CHECK_AUDIT_ACTION,
      target_table: 'vendor_verification_applications',
      target_id: args.applicationId,
      actor_user_id: null,
      reason: decided.reason,
      metadata: {
        decision: decided.decision,
        reason: decided.reason,
        checks: decided.checks,
        papers: papersLog,
        live_page: live,
      },
    });
  } catch {
    // The log never decides anything; a failed write must not change the outcome.
  }

  if (decided.decision !== 'verify') return decided;

  const approved = await applyApplicationDecision({
    actor: { user_id: null },
    automatic: { checks: decided.checks, reason: decided.reason },
    applicationId: args.applicationId,
    decision: 'approved',
    reason: 'Verified automatically — every check passed.',
  }).catch(() => ({ ok: false as const, error: 'engine' }));
  if (!approved.ok) {
    return { ...decided, decision: 'to_admin', reason: 'Every check passed, but the approval could not be written — a person finishes it.' };
  }
  return decided;
}
