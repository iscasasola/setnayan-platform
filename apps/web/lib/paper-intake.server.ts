import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import { parseClientRef, vendorVerificationDocPolicy } from '@/lib/r2-client-ref';
import { r2Delete, r2GetBytes } from '@/lib/r2';
import { receiptReaderConfigured } from '@/lib/payment-receipt-read.server';
import { resolveGuestSessionSecret } from '@/lib/guest-session';
import { geocodeAddressWithCity } from '@/lib/geo';
import { checkPaperFile, readPaperQr } from '@/lib/verification-paper-file';
import { transcribe } from '@/lib/verification-paper-read.server';
import { parseModelPaperJson } from '@/lib/verification-paper-read';
import {
  casMerge,
  mergeIntake,
  type IntakeReport,
  type IntakeSlot,
  type PageRead,
} from '@/lib/paper-intake';

/**
 * paper-intake.server.ts — ONE UPLOAD PLACE, the server half.
 *
 * Reads each uploaded file IN THE REQUEST (owner: "one paper at a time"; target
 * under ~20 s), files it with `mergeIntake` under a compare-and-set, and DELETES
 * from storage every file that was not kept (owner: "we only accept clean
 * files"). It writes ONLY `vendor_verification_applications.doc_uploads` — never
 * a profile column, never a status. The permit's address becomes a PIN
 * PROPOSAL inside the permit's slot; the shop's pin and `registered_address` are
 * written only when the supplier confirms it (`confirmPermitPin`).
 */

/** How long the whole request may spend reading. Past it, a page reads as "reader unavailable" — never a try. */
const INTAKE_BUDGET_MS = 18_000;
/** A PDF is split page by page; past this many pages the rest are not read. */
const MAX_PDF_PAGES = 4;
/** Files per request (the ruling: 1–3). */
export const MAX_FILES_PER_INTAKE = 3;

/** The paper-seal key, derived from the server secret; null when none is configured. */
export function paperSealKey(): Buffer | null {
  const r = resolveGuestSessionSecret();
  if (!r.ok) return null;
  return createHmac('sha256', r.material).update('setnayan-paper-seal-key:v1').digest();
}

/** Today in Manila, `YYYY-MM-DD`. */
export function todayManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Each page of a PDF as its own one-page PDF (so one PDF can hold two papers). */
async function splitPdf(bytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const n = Math.min(src.getPageCount(), MAX_PDF_PAGES);
  if (n <= 1) return [bytes];
  const out: Uint8Array[] = [];
  for (let i = 0; i < n; i++) {
    const one = await PDFDocument.create();
    const [p] = await one.copyPages(src, [i]);
    one.addPage(p);
    out.push(await one.save());
  }
  return out;
}

/**
 * Classify and read ONE file: every page of a PDF on its own. NEVER THROWS.
 * A refused file returns one page carrying `fileProblem`.
 */
export async function classifyAndRead(r2Key: string, bytes: Uint8Array, timeoutMs = INTAKE_BUDGET_MS): Promise<PageRead[]> {
  const check = await checkPaperFile(bytes);
  if (!check.ok) return [{ r2Key, page: null, fileProblem: check.reason, model: null, qrTexts: [] }];
  let parts: Uint8Array[] = [bytes];
  if (check.kind === 'pdf') {
    try {
      parts = await splitPdf(bytes);
    } catch {
      parts = [bytes];
    }
  }
  const configured = receiptReaderConfigured();
  return Promise.all(
    parts.map(async (part, i): Promise<PageRead> => {
      const [qr, transcript] = await Promise.all([
        readPaperQr(part),
        configured ? transcribe(part, timeoutMs) : Promise.resolve(null),
      ]);
      return {
        r2Key,
        page: check.kind === 'pdf' && parts.length > 1 ? i : null,
        fileProblem: null,
        model: transcript ? parseModelPaperJson(transcript) : null,
        qrTexts: qr.qrTexts,
      };
    }),
  );
}

export type IntakeResponse =
  | { ok: true; reports: IntakeReport[] }
  | { ok: false; error: string };

/**
 * Read 1–3 files and file them. The caller has ALREADY checked that this is the
 * signed-in supplier's own editable draft. `admin` is the service-role client.
 */
export async function intakePapers(args: {
  admin: SupabaseClient;
  applicationId: string;
  vendorProfileId: string;
  r2Refs: readonly string[];
}): Promise<IntakeResponse> {
  const key = paperSealKey();
  if (!key) return { ok: false, error: 'We couldn’t read papers just now. Try again in a minute.' };
  const refs = args.r2Refs.slice(0, MAX_FILES_PER_INTAKE);
  const policy = vendorVerificationDocPolicy(args.vendorProfileId);

  // ── Read every file (in parallel) ─────────────────────────────────────────
  const located = refs.map((ref) => ({ ref, asset: parseClientRef(ref, policy) }));
  if (located.some((l) => !l.asset)) return { ok: false, error: 'That file reference isn’t valid — re-upload and try again.' };
  const pages = (
    await Promise.all(
      located.map(async ({ ref, asset }) => {
        try {
          const { bytes } = await r2GetBytes({ bucket: asset!.bucket, key: asset!.key });
          return await classifyAndRead(ref, bytes);
        } catch {
          return [{ r2Key: ref, page: null, fileProblem: 'We couldn’t open that file — upload it again.', model: null, qrTexts: [] } satisfies PageRead];
        }
      }),
    )
  ).flat();

  // ── The permit locates the shop: a PROPOSAL only ─────────────────────────
  const permitPage = pages.find((p) => p.model?.registry === 'lgu' && p.model.address);
  let proposal: IntakeSlot['pin_proposal'] = null;
  if (permitPage?.model?.address) {
    try {
      const g = await geocodeAddressWithCity(
        [permitPage.model.address, permitPage.model.city].filter(Boolean).join(', '),
      );
      if (g) proposal = { lat: g.latitude, lng: g.longitude, address: permitPage.model.address, city: g.city || permitPage.model.city };
    } catch {
      proposal = null;
    }
  }

  // ── File them: ONE row update per request, compare-and-set ───────────────
  const nowIso = new Date().toISOString();
  const today = todayManila();
  const out = await casMerge({
    load: async () => {
      const { data, error } = await args.admin
        .from('vendor_verification_applications')
        .select('doc_uploads,updated_at,status')
        .eq('application_id', args.applicationId)
        .maybeSingle();
      if (error) console.error('[intakePapers] application read failed', error.message);
      if (error || !data || (data as { status: string }).status !== 'draft') return null;
      const row = data as { doc_uploads: unknown; updated_at: string | null };
      return { docUploads: row.doc_uploads ?? {}, version: row.updated_at };
    },
    save: async (next, version) => {
      let q = args.admin
        .from('vendor_verification_applications')
        .update({ doc_uploads: next, updated_at: new Date().toISOString() })
        .eq('application_id', args.applicationId)
        .eq('status', 'draft');
      q = version === null ? q.is('updated_at', null) : q.eq('updated_at', version);
      const { data, error } = await q.select('application_id');
      return !error && Array.isArray(data) && data.length === 1;
    },
    merge: (cur) => {
      const r = mergeIntake(cur, pages, { nowIso, todayManila: today, key });
      if (proposal && r.touched.includes('mayors_permit')) {
        const permit = r.next.mayors_permit as IntakeSlot;
        if (permit.r2_key) {
          // The proposal sits beside the seal (it is not evidence); still re-sealed for one shape.
          r.next.mayors_permit = { ...permit, pin_proposal: proposal };
        }
      }
      return r;
    },
  });
  if (!out) {
    // Nothing filed: every file this request brought is unkept.
    await discard(refs, policy);
    return { ok: false, error: 'Your papers could not be saved just now — upload them again.' };
  }

  // ── Only clean files are kept: delete the rest from storage ──────────────
  await discard(out.discard, policy);
  return { ok: true, reports: out.reports };
}

async function discard(refs: readonly string[], policy: ReturnType<typeof vendorVerificationDocPolicy>): Promise<void> {
  await Promise.all(
    refs.map(async (ref) => {
      const asset = parseClientRef(ref, policy);
      if (!asset) return;
      try {
        await r2Delete({ bucket: asset.bucket, key: asset.key });
      } catch (e) {
        // Best effort by contract (r2.ts): an orphan is cleaned by the lifecycle rule. No key or TIN in the log.
        console.error('[intakePapers] discard failed', e instanceof Error ? e.name : 'error');
      }
    }),
  );
}
