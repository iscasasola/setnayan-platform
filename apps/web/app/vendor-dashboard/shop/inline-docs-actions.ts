'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  APPLICATION_FEE_CENTAVOS,
  DOC_SLOTS,
  VENDOR_DOC_SLOTS,
  countCompleteSlots,
  countCompleteVendorSlots,
  fetchLatestApplication,
  parseVerificationState,
  recommendedApplicationType,
  type ApplicationStatus,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import { DOC_SLOT_KEYS, buildSlotValue } from '@/lib/vendor-verification-slots';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server actions behind the INLINE verification documents row on My Shop (owner
 * 2026-07-02: surface the 12-doc checklist inline instead of a deep-link). They
 * are the non-redirecting twins of `verify/actions.ts` — that page's actions
 * `redirect()` to /verify, which would navigate away from My Shop, so these
 * return values for `useActionState` instead. The redirecting /verify flow is
 * untouched; both share `buildSlotValue` + `DOC_SLOT_KEYS`.
 */

const VENDOR_TOTAL = VENDOR_DOC_SLOTS.length;
const VENDOR_SLOT_KEYS: ReadonlySet<string> = new Set(VENDOR_DOC_SLOTS.map((s) => s.key));

export type InlineDocsPayload = {
  applicationId: string | null;
  status: ApplicationStatus | null;
  /** Draft or fresh → the vendor can still upload. Submitted/approved → read-only. */
  editable: boolean;
  docMap: DocUploadMap;
  /** r2 ref → presigned display URL, for the FileUpload thumbnails. */
  seedDisplayUrls: Record<string, string>;
  /** How many of the vendor's own 8 items are in. */
  vendorComplete: number;
  vendorTotal: number;
  /** docs_complete — all 12 incl. the 4 Setnayan-run slots (the publish gate). */
  allComplete: boolean;
};

export type DocSlotSaveResult =
  | { ok: true; vendorComplete: number; vendorTotal: number; allComplete: boolean }
  | { ok: false; error: string };

async function requireVendorId(): Promise<{
  supabase: SupabaseClient;
  vendorProfileId: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return null;
  return { supabase, vendorProfileId: profile.vendor_profile_id };
}

const LOCKED_STATUSES: ReadonlySet<ApplicationStatus> = new Set<ApplicationStatus>([
  'pending_review',
  'in_review',
  'approved',
]);

async function buildSeedDisplayUrls(docMap: DocUploadMap): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = [];
  await Promise.all(
    Object.values(docMap).flatMap((entry) => {
      if (!entry) return [];
      if (Array.isArray(entry)) {
        return entry
          .filter((e) => typeof e?.r2_key === 'string')
          .map(async (e) => {
            const ref = e.r2_key as string;
            const url = await displayUrlForStoredAsset(ref);
            if (url) entries.push([ref, url]);
          });
      }
      if (typeof entry === 'object' && 'r2_key' in entry && entry.r2_key) {
        const ref = entry.r2_key as string;
        return [
          displayUrlForStoredAsset(ref).then((url) => {
            if (url) entries.push([ref, url]);
          }),
        ];
      }
      return [];
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Lazy loader for the inline Documents row — called on FIRST expand only, so My
 * Shop never presigns doc thumbnails unless the vendor opens Documents.
 *
 * For an EDITABLE vendor it FIND-OR-CREATES the single draft HERE, on expand, so
 * every subsequent per-slot auto-save writes into the same row. Creating it once
 * on expand (rather than per-upload) closes the concurrent-double-insert race:
 * two back-to-back uploads (or a multi-file slot firing onChange per file) each
 * used to run their own `resolveEditableDraft`, find no draft, and INSERT their
 * own — silently splitting the documents across two drafts. At most one draft
 * per vendor: an existing draft is reused; a submitted/approved application is
 * shown read-only and never gets a new draft. (The client `!loading` guard
 * prevents a double-click from calling this twice concurrently.)
 */
export async function loadInlineDocs(): Promise<InlineDocsPayload> {
  const empty: InlineDocsPayload = {
    applicationId: null,
    status: null,
    editable: false,
    docMap: {},
    seedDisplayUrls: {},
    vendorComplete: 0,
    vendorTotal: VENDOR_TOTAL,
    allComplete: false,
  };
  const auth = await requireVendorId();
  if (!auth) return empty;

  const app = await fetchLatestApplication(auth.supabase, auth.vendorProfileId).catch(() => null);
  const status = (app?.status as ApplicationStatus | undefined) ?? null;

  // Submitted / approved → read-only view of that application's own docs.
  if (status != null && LOCKED_STATUSES.has(status) && app) {
    const docMap = (app.doc_uploads ?? {}) as DocUploadMap;
    return {
      applicationId: app.application_id,
      status,
      editable: false,
      docMap,
      seedDisplayUrls: await buildSeedDisplayUrls(docMap),
      vendorComplete: countCompleteVendorSlots(docMap),
      vendorTotal: VENDOR_TOTAL,
      allComplete: Boolean(app.docs_complete),
    };
  }

  // Existing draft → reuse it (we already fetched it as the latest row).
  if (status === 'draft' && app) {
    const docMap = (app.doc_uploads ?? {}) as DocUploadMap;
    return {
      applicationId: app.application_id,
      status: 'draft',
      editable: true,
      docMap,
      seedDisplayUrls: await buildSeedDisplayUrls(docMap),
      vendorComplete: countCompleteVendorSlots(docMap),
      vendorTotal: VENDOR_TOTAL,
      allComplete: Boolean(app.docs_complete),
    };
  }

  // Fresh / rejected / withdrawn → create the single draft NOW so uploads share
  // one row (starts empty). A transient insert failure degrades to an empty
  // editable view; the first upload will retry the create.
  const draft = await resolveEditableDraft(auth.supabase, auth.vendorProfileId);
  if (!draft.ok) return { ...empty, editable: true };
  return {
    applicationId: draft.applicationId,
    status: 'draft',
    editable: true,
    docMap: {},
    seedDisplayUrls: {},
    vendorComplete: 0,
    vendorTotal: VENDOR_TOTAL,
    allComplete: false,
  };
}

/**
 * Find the vendor's editable draft, or create a fresh one. A submitted/approved
 * application blocks edits (they continue on /verify). rejected/withdrawn/none
 * → a new draft, typed + priced by the vendor's verification state (mirrors the
 * /verify page's ensureDraftApplication).
 */
async function resolveEditableDraft(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }> {
  const app = await fetchLatestApplication(supabase, vendorProfileId).catch(() => null);
  const status = (app?.status as ApplicationStatus | undefined) ?? null;
  if (status === 'draft' && app) {
    return { ok: true, applicationId: app.application_id };
  }
  if (status != null && LOCKED_STATUSES.has(status)) {
    return {
      ok: false,
      error: 'Your verification is already submitted — continue on the verification page.',
    };
  }
  // Fresh / rejected / withdrawn → start a new draft with the right type.
  const { data: vp } = await supabase
    .from('vendor_profiles')
    .select('verification_state, last_verified_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const verState = parseVerificationState(
    (vp as { verification_state?: string } | null)?.verification_state,
  );
  const recType =
    recommendedApplicationType(
      verState,
      (vp as { last_verified_at?: string | null } | null)?.last_verified_at ?? null,
    ) ?? 'initial';
  const { data: inserted, error } = await supabase
    .from('vendor_verification_applications')
    .insert({
      vendor_profile_id: vendorProfileId,
      application_type: recType,
      fee_php_centavos: APPLICATION_FEE_CENTAVOS[recType],
      status: 'draft',
      doc_uploads: {},
    })
    .select('application_id')
    .maybeSingle();
  if (error || !inserted) {
    return { ok: false, error: error?.message ?? 'Could not start your application.' };
  }
  return { ok: true, applicationId: (inserted as { application_id: string }).application_id };
}

/**
 * Non-redirecting per-slot save for the inline Documents row (for `useActionState`).
 * Only vendor-actionable slots (uploads + the social URL) — the 4 Setnayan-run
 * slots are rejected server-side too. Creates the draft on the first save.
 */
export async function updateDocUploadInline(
  _prev: DocSlotSaveResult | null,
  formData: FormData,
): Promise<DocSlotSaveResult> {
  const auth = await requireVendorId();
  if (!auth) return { ok: false, error: 'Please sign in again.' };

  const slotKey = String(formData.get('slot_key') ?? '').trim();
  if (!DOC_SLOT_KEYS.has(slotKey)) return { ok: false, error: 'Unknown document.' };
  if (!VENDOR_SLOT_KEYS.has(slotKey)) {
    return { ok: false, error: 'Setnayan verifies this document — no upload needed.' };
  }

  const draft = await resolveEditableDraft(auth.supabase, auth.vendorProfileId);
  if (!draft.ok) return { ok: false, error: draft.error };

  // Re-read for a clean JSONB merge + a fresh draft-gate check.
  const { data: app, error: readErr } = await auth.supabase
    .from('vendor_verification_applications')
    .select('application_id,vendor_profile_id,status,doc_uploads')
    .eq('application_id', draft.applicationId)
    .maybeSingle();
  if (readErr || !app) return { ok: false, error: 'Could not load your application.' };
  if (app.vendor_profile_id !== auth.vendorProfileId || app.status !== 'draft') {
    return { ok: false, error: 'This application can no longer be edited.' };
  }

  const r2Ref = String(formData.get('r2_ref') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const currentUploads = (app.doc_uploads ?? {}) as DocUploadMap;
  const nextUploads: DocUploadMap = {
    ...currentUploads,
    [slotKey]: buildSlotValue(slotKey, {
      r2Ref: r2Ref || null,
      url: url || null,
      scheduledAt: null,
    }),
  };
  const completeCount = countCompleteSlots(nextUploads);

  const { error: updErr } = await auth.supabase
    .from('vendor_verification_applications')
    .update({
      doc_uploads: nextUploads,
      docs_complete: completeCount >= DOC_SLOTS.length,
      updated_at: new Date().toISOString(),
    })
    .eq('application_id', draft.applicationId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/vendor-dashboard/shop');
  revalidatePath('/vendor-dashboard/verify');
  revalidatePath('/vendor-dashboard');
  return {
    ok: true,
    vendorComplete: countCompleteVendorSlots(nextUploads),
    vendorTotal: VENDOR_TOTAL,
    allComplete: completeCount >= DOC_SLOTS.length,
  };
}
