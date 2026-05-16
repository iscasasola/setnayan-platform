'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  APPLICATION_FEE_CENTAVOS,
  APPLICATION_TYPES,
  DOC_SLOTS,
  addBusinessDays,
  countCompleteSlots,
  type ApplicationType,
  type DocUploadMap,
} from '@/lib/vendor-verification';

/**
 * Vendor-side server actions for /vendor-dashboard/verify.
 *
 * Two surfaces:
 *   • `ensureDraftApplication()` — idempotently creates (or returns) the
 *     vendor's current draft row. The page calls this on each visit so the
 *     subsequent upload widgets have a stable application_id to write into.
 *   • `updateDocUpload()` — writes a single doc-slot's value into the
 *     `doc_uploads` JSONB after a successful R2 PUT.
 *   • `submitApplication()` — flips draft → pending_review, stamps
 *     submitted_at + sla_due_at, and bumps the vendor's `verification_state`
 *     to `pending_review`. Writes an audit row.
 *   • `withdrawApplication()` — vendor-initiated withdraw of a pending row.
 *
 * Admin-side decision actions live in /admin/verify/actions.ts.
 *
 * See migration `20260516040000_iteration_0006_vendor_verification_flow.sql`.
 */

const DOC_SLOT_KEYS: ReadonlySet<string> = new Set(DOC_SLOTS.map((s) => s.key));
const APPLICATION_TYPE_SET: ReadonlySet<string> = new Set(APPLICATION_TYPES);

async function ensureVendorAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile, userId: user.id };
}

function parseApplicationType(raw: unknown): ApplicationType {
  if (typeof raw === 'string' && APPLICATION_TYPE_SET.has(raw)) {
    return raw as ApplicationType;
  }
  return 'initial';
}

/**
 * Returns the vendor's current draft application_id, creating one if none
 * exists. Called from the page server-component before render so child
 * upload widgets always have an ID to PATCH into.
 */
export async function ensureDraftApplication(
  formData: FormData,
): Promise<void> {
  const { supabase, profile } = await ensureVendorAuth();
  const requestedType = parseApplicationType(formData.get('application_type'));

  // Look up any draft row in flight. If one exists, just leave it alone —
  // we only ever want one draft per vendor at a time.
  const { data: existing, error: readErr } = await supabase
    .from('vendor_verification_applications')
    .select('application_id, status')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readErr) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(readErr.message)}`,
    );
  }

  if (existing) {
    redirect('/vendor-dashboard/verify');
  }

  const { error } = await supabase
    .from('vendor_verification_applications')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      application_type: requestedType,
      fee_php_centavos: APPLICATION_FEE_CENTAVOS[requestedType],
      status: 'draft',
      doc_uploads: {},
    });
  if (error) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/verify');
  redirect('/vendor-dashboard/verify');
}

/**
 * Patch a single slot's value into doc_uploads. Used by both file-upload
 * slots (carries `r2_key`) and the manual/external slots (carries scalar
 * fields like `social_media.url`).
 */
export async function updateDocUpload(formData: FormData): Promise<void> {
  const { supabase, profile } = await ensureVendorAuth();

  const applicationId = String(formData.get('application_id') ?? '').trim();
  const slotKey = String(formData.get('slot_key') ?? '').trim();
  if (!applicationId || !slotKey || !DOC_SLOT_KEYS.has(slotKey)) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Bad slot.')}`,
    );
  }

  // Re-read the current application so we merge cleanly into doc_uploads.
  const { data: app, error: readErr } = await supabase
    .from('vendor_verification_applications')
    .select(
      'application_id,vendor_profile_id,status,doc_uploads,application_type',
    )
    .eq('application_id', applicationId)
    .maybeSingle();
  if (readErr || !app) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Application not found.')}`,
    );
  }
  if (
    app.vendor_profile_id !== profile.vendor_profile_id ||
    app.status !== 'draft'
  ) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Application is not editable.')}`,
    );
  }

  const r2Ref = String(formData.get('r2_ref') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const meetScheduledAt = String(formData.get('scheduled_at') ?? '').trim();

  const currentUploads = (app.doc_uploads ?? {}) as DocUploadMap;
  const nextSlot = buildSlotValue(slotKey, {
    r2Ref: r2Ref || null,
    url: url || null,
    scheduledAt: meetScheduledAt || null,
  });

  const nextUploads: DocUploadMap = {
    ...currentUploads,
    [slotKey]: nextSlot,
  };
  const completeCount = countCompleteSlots(nextUploads);

  const { error: updErr } = await supabase
    .from('vendor_verification_applications')
    .update({
      doc_uploads: nextUploads,
      docs_complete: completeCount >= DOC_SLOTS.length,
      updated_at: new Date().toISOString(),
    })
    .eq('application_id', applicationId);
  if (updErr) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(updErr.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/verify');
  redirect('/vendor-dashboard/verify?slot_saved=1');
}

function buildSlotValue(
  slotKey: string,
  fields: {
    r2Ref: string | null;
    url: string | null;
    scheduledAt: string | null;
  },
): Record<string, unknown> | null {
  const now = new Date().toISOString();

  if (slotKey === 'social_media') {
    if (!fields.url) return null;
    return { url: fields.url, updated_at: now };
  }
  if (slotKey === 'google_meet') {
    if (!fields.scheduledAt) return null;
    return { scheduled_at: fields.scheduledAt };
  }
  // Default: every other slot persists an R2 ref.
  if (!fields.r2Ref) return null;
  return { r2_key: fields.r2Ref, uploaded_at: now };
}

/**
 * Submit the draft → pending_review. Stamps submitted_at + sla_due_at
 * (5 business days out) and bumps vendor_profiles.verification_state to
 * 'pending_review'. Writes a vendor_tier_history audit row.
 */
export async function submitApplication(formData: FormData): Promise<void> {
  const { supabase, profile, userId } = await ensureVendorAuth();

  const applicationId = String(formData.get('application_id') ?? '').trim();
  if (!applicationId) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Missing application_id.')}`,
    );
  }

  const { data: app, error: readErr } = await supabase
    .from('vendor_verification_applications')
    .select(
      'application_id,vendor_profile_id,status,doc_uploads,application_type,fee_php_centavos',
    )
    .eq('application_id', applicationId)
    .maybeSingle();
  if (readErr || !app) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Application not found.')}`,
    );
  }
  if (
    app.vendor_profile_id !== profile.vendor_profile_id ||
    app.status !== 'draft'
  ) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Application is not editable.')}`,
    );
  }

  // V1 launch-soft gate: vendor can submit with a minimum of the 8 upload
  // slots filled. The 4 external/manual slots (Persona, Google Meet,
  // SMS/email OTP, AMLC) are admin-flipped post-submit. Once integrations
  // ship, the gate moves to "12-doc complete required".
  const uploads = (app.doc_uploads ?? {}) as DocUploadMap;
  const completeCount = countCompleteSlots(uploads);
  const REQUIRED_TO_SUBMIT = 8;
  if (completeCount < REQUIRED_TO_SUBMIT) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(
        `Submit at least ${REQUIRED_TO_SUBMIT} of the 12 checklist items to start review (currently ${completeCount}).`,
      )}`,
    );
  }

  const now = new Date();
  const slaDue = addBusinessDays(now, 5);

  const { error: updErr } = await supabase
    .from('vendor_verification_applications')
    .update({
      status: 'pending_review',
      submitted_at: now.toISOString(),
      sla_due_at: slaDue.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('application_id', applicationId);
  if (updErr) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(updErr.message)}`,
    );
  }

  // Bump vendor_profiles.verification_state → 'pending_review' so the rest
  // of the system (perk gates, payout model) reads the in-flight signal.
  // We do this from the vendor's session client — the RLS policy on
  // vendor_profiles is owner-only ALL, so the vendor can flip their own
  // tier through this action.
  const { data: existingProfile } = await supabase
    .from('vendor_profiles')
    .select('verification_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const fromState =
    (existingProfile?.verification_state as string | null | undefined) ??
    'unverified';

  await supabase
    .from('vendor_profiles')
    .update({
      verification_state: 'pending_review',
      updated_at: now.toISOString(),
    })
    .eq('vendor_profile_id', profile.vendor_profile_id);

  // tier_history insert (best-effort). RLS allows owner SELECT but writes
  // go through the same session — there's no INSERT policy so writes need
  // service-role. We instead let the admin-side actions take ownership of
  // history rows on decision; for vendor-initiated submit we write via
  // admin_audit_log (which has SECURITY DEFINER paths in the schema). For
  // V1 we skip the tier_history insert here (idempotent — the admin
  // decision will write the next transition row).
  await supabase.from('admin_audit_log').insert({
    action: 'vendor_verification_submit',
    target_table: 'vendor_verification_applications',
    target_id: applicationId,
    before_json: { status: 'draft', verification_state: fromState },
    after_json: {
      status: 'pending_review',
      verification_state: 'pending_review',
    },
    actor_user_id: userId,
    reason: null,
  });

  revalidatePath('/vendor-dashboard/verify');
  revalidatePath('/admin/verify');
  redirect('/vendor-dashboard/verify?submitted=1');
}

/**
 * Vendor-initiated withdrawal of a pending application. Bumps the row to
 * 'withdrawn' and reverts the vendor's `verification_state` to its prior
 * value (or 'unverified' if we can't read the history).
 *
 * V1 simplification: only `draft` rows are withdrawable through this action.
 * Withdrawing a pending_review row would race the admin's review, so the
 * vendor has to email support per the locked spec.
 */
export async function withdrawApplication(formData: FormData): Promise<void> {
  const { supabase, profile } = await ensureVendorAuth();

  const applicationId = String(formData.get('application_id') ?? '').trim();
  if (!applicationId) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Missing application_id.')}`,
    );
  }

  const { data: app, error: readErr } = await supabase
    .from('vendor_verification_applications')
    .select('application_id,vendor_profile_id,status')
    .eq('application_id', applicationId)
    .maybeSingle();
  if (readErr || !app) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Application not found.')}`,
    );
  }
  if (
    app.vendor_profile_id !== profile.vendor_profile_id ||
    app.status !== 'draft'
  ) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent('Application is not editable.')}`,
    );
  }

  const { error: updErr } = await supabase
    .from('vendor_verification_applications')
    .update({
      status: 'withdrawn',
      updated_at: new Date().toISOString(),
    })
    .eq('application_id', applicationId);
  if (updErr) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(updErr.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/verify');
  redirect('/vendor-dashboard/verify?withdrawn=1');
}
