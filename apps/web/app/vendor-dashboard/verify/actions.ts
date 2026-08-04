'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { businessProfileChecklist, fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  markVendorPendingReview,
  revertVendorPendingReview,
} from '@/lib/vendor-verification-state';
import { notifyAdminsApplicationSubmitted } from '@/lib/vendor-status-notify';
import {
  APPLICATION_TYPES,
  DOC_SLOTS,
  VENDOR_DOC_SLOTS,
  addBusinessDays,
  countCompleteSlots,
  countCompleteVendorSlots,
  resolveApplicationFeeCentavos,
  verificationSubmitMissing,
  type ApplicationType,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import { DOC_SLOT_KEYS, buildSlotValue } from '@/lib/vendor-verification-slots';
import {
  parseClientRef,
  vendorOwnedMediaPolicy,
  vendorVerificationDocPolicy,
} from '@/lib/r2-client-ref';

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

  // Fee is resolved from service_catalog, not hardcoded — an inactive/missing
  // SKU (verification went free via the 20260702 migration) resolves to ₱0.
  const feeCentavos = await resolveApplicationFeeCentavos(supabase, requestedType);

  const { error } = await supabase
    .from('vendor_verification_applications')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      application_type: requestedType,
      fee_php_centavos: feeCentavos,
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

  // SEC-1: `r2_ref` is a raw form field that lands in `doc_uploads` JSONB and
  // is presigned back later (verify/page.tsx + the admin review surface) out of
  // the PRIVATE vendor-verification bucket. Unpinned, it would sign another
  // vendor's DTI / BIR 2303 / Mayor's Permit. Pin it to this vendor's own
  // folder; grandfather a ref already stored on this slot, which the edit form
  // echoes back. Mirrors the shop-side sibling in shop/inline-docs-actions.ts.
  if (r2Ref) {
    const storedSlot = currentUploads[slotKey];
    const storedRef =
      storedSlot && typeof storedSlot === 'object' && 'r2_key' in storedSlot
        ? (storedSlot.r2_key as string | null)
        : null;
    const owned =
      !r2Ref.startsWith('r2://') ||
      r2Ref === storedRef ||
      parseClientRef(r2Ref, vendorVerificationDocPolicy(profile.vendor_profile_id)) !== null ||
      parseClientRef(r2Ref, vendorOwnedMediaPolicy(profile.vendor_profile_id)) !== null;
    if (!owned) {
      redirect(
        `/vendor-dashboard/verify?error=${encodeURIComponent('That file reference isn’t valid — re-upload and try again.')}`,
      );
    }
  }

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

/**
 * Submit the draft → pending_review. Stamps submitted_at + sla_due_at
 * (5 business days out) and advances vendor_profiles.verification_state to
 * 'pending_review'. Writes a vendor_tier_history audit row.
 *
 * The profile flip goes through `markVendorPendingReview` (service_role) — a
 * vendor's own client is refused by `guard_vendor_profiles_entitlement`, and
 * that refusal used to be swallowed. It is a NO-OP for an already-verified shop
 * submitting an `annual_renewal`, which keeps its badge while the application
 * sits in the queue.
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

  // V1 launch-soft gate: the vendor submits once all of THEIR items (the
  // VENDOR_DOC_SLOTS uploads) are filled. The 4 external/manual slots (Persona,
  // Google Meet, SMS/email OTP, AMLC) are admin-flipped post-submit — counting
  // them here is what produced the deceptive "8 of 12" gate. Once integrations
  // ship, the gate moves to "12-doc complete required".
  const uploads = (app.doc_uploads ?? {}) as DocUploadMap;

  // Profile-completeness gate (2026-07-21). The My Shop inline twin
  // (`submitInlineForReview`) has always enforced `verificationSubmitMissing`,
  // which requires a COMPLETE business profile — logo included. This path did
  // not, so it could flip verification_state → 'pending_review' with a NULL
  // logo. That divergence became load-bearing the moment the logo stopped
  // being mandatory at registration (owner decision 4: "shop logo is only
  // required before verification"), so both submit routes now read the one
  // shared gate.
  //
  // Only the PROFILE reason is taken from the shared gate here: this page's
  // document rule is deliberately the launch-soft VENDOR_DOC_SLOTS count
  // below, not the 4-required-docs rule, and folding them together would
  // tighten a second thing this change is not authorised to touch.
  const checklist = businessProfileChecklist(profile);
  const gateReasons = verificationSubmitMissing({
    profileComplete: checklist.complete,
    uploads,
  });
  if (gateReasons.includes('Finish your business profile')) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(
        `Finish your business profile before submitting — still missing: ${checklist.missing.join(', ')}.`,
      )}`,
    );
  }

  // Anti-farm identity gate (migration 20270925937630): a shop cannot start its
  // verification (and its perk window) with no government registration number
  // on file. Soft-probe so a pre-migration DB degrades to "not present" rather
  // than crashing; a collided number keeps raw (needs_review) → still counts.
  const { data: regRow } = await supabase
    .from('vendor_profiles')
    .select('registration_number_raw')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle()
    .then((r) => (r.error ? { data: null } : r));
  const registrationNumberOnFile = Boolean(
    (regRow as { registration_number_raw?: string | null } | null)?.registration_number_raw,
  );
  if (!registrationNumberOnFile) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(
        'Add your government registration number (BIR TIN, DTI, SEC, or permit) before submitting.',
      )}`,
    );
  }

  const completeCount = countCompleteVendorSlots(uploads);
  const REQUIRED_TO_SUBMIT = VENDOR_DOC_SLOTS.length;
  if (completeCount < REQUIRED_TO_SUBMIT) {
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(
        `Finish all ${REQUIRED_TO_SUBMIT} of your items to start review (currently ${completeCount} of ${REQUIRED_TO_SUBMIT}). The other 4 checklist items are ones our team runs for you.`,
      )}`,
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const slaDue = addBusinessDays(now, 5);

  // ── Step 1: the PRIVILEGED flip, first and fail-loud ──────────────────────
  // P0 2026-07-27: this used to run LAST, through the vendor's own session
  // client, with its result discarded. `guard_vendor_profiles_entitlement`
  // refuses any vendor-authored `verification_state` change, so the write
  // failed 100% of the time and the vendor was told nothing — the application
  // row said pending_review while the profile stayed 'unverified' forever.
  // Now it goes through service_role (the guard's own sanctioned path, see
  // lib/vendor-verification-state.ts) and runs BEFORE the application row, so
  // a refusal aborts with ZERO writes instead of leaving the two disagreeing.
  const flip = await markVendorPendingReview(createAdminClient(), {
    vendorProfileId: profile.vendor_profile_id,
    userId,
    nowIso,
  });
  if (!flip.ok) {
    redirect(`/vendor-dashboard/verify?error=${encodeURIComponent(flip.error)}`);
  }
  const fromState = flip.fromState;

  // ── Step 2: the application row ───────────────────────────────────────────
  const { error: updErr } = await supabase
    .from('vendor_verification_applications')
    .update({
      status: 'pending_review',
      submitted_at: nowIso,
      sla_due_at: slaDue.toISOString(),
      updated_at: nowIso,
    })
    .eq('application_id', applicationId);
  if (updErr) {
    // Compensate: step 1 already landed, so put the profile back rather than
    // leaving a shop "pending_review" with no submitted application behind it.
    if (flip.changed) {
      await revertVendorPendingReview(createAdminClient(), {
        vendorProfileId: profile.vendor_profile_id,
        userId,
        toState: fromState,
        nowIso,
      });
    }
    redirect(
      `/vendor-dashboard/verify?error=${encodeURIComponent(updErr.message)}`,
    );
  }

  // tier_history insert (best-effort). RLS allows owner SELECT but writes
  // go through the same session — there's no INSERT policy so writes need
  // service-role. We instead let the admin-side actions take ownership of
  // history rows on decision; for vendor-initiated submit we write via
  // admin_audit_log (which has SECURITY DEFINER paths in the schema). For
  // V1 we skip the tier_history insert here (idempotent — the admin
  // decision will write the next transition row).
  //
  // Best-effort is EXPLICIT here (`.then(noop, noop)`, matching the inline twin)
  // rather than an unchecked `await`. An audit row genuinely must not block a
  // submit that already landed — but "we chose to ignore this" and "we forgot to
  // check this" have to look different in the source, because the second one is
  // what broke the profile flip above.
  await supabase
    .from('admin_audit_log')
    .insert({
      action: 'vendor_verification_submit',
      target_table: 'vendor_verification_applications',
      target_id: applicationId,
      before_json: { status: 'draft', verification_state: fromState },
      after_json: {
        status: 'pending_review',
        // A renewal submitted by an already-verified shop keeps its badge, so
        // record what the profile ACTUALLY reads now, not an assumed value.
        verification_state: flip.changed ? 'pending_review' : fromState,
      },
      actor_user_id: userId,
      reason: null,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  // Cross-account signal (Phase B · 2026-06-19): fan out to the admin queue so
  // the SLA-started application is surfaced (and emailed). Best-effort — never
  // blocks the submit that already landed.
  await notifyAdminsApplicationSubmitted({
    vendorProfileId: profile.vendor_profile_id,
    applicationId,
    applicationType: app.application_type as string | null | undefined,
  }).catch(() => undefined);

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
