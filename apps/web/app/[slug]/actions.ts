'use server';

import { redirect } from 'next/navigation';
import { parseClientRef, guestSelfiePolicy } from '@/lib/r2-client-ref';
import { revalidatePath } from 'next/cache';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { deletePublicAsset } from '@/lib/storage';
import { r2Delete } from '@/lib/r2';
import { parseStoredAsset } from '@/lib/uploads';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { guestDetailsChanged } from './_lib/guest-details-changed';
import { createClient } from '@/lib/supabase/server';
import { VECTOR_MODEL } from '@/lib/face-embed-core';
import {
  FACE_CONSENT_COPY_VERSION,
  resolvePapicFaceMode,
  faceVectorForMode,
} from '@/lib/papic-face-mode';
import { readGuestSession } from '@/lib/guest-session';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { emitNotification } from '@/lib/notification-emit';
import { sendEventAccountMagicLink } from '@/lib/event-account-link';
import type { MealPreference, RsvpStatus } from '@/lib/guests';
import { isKnownMinorGuest } from '@/lib/face-enrolment-age';

const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
const MEAL_VALUES: MealPreference[] = [
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
  'no_preference',
];

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

/**
 * Invite/Join v2 — a guest saves a vendor they liked at this event to THEIR own
 * account, for future planning (`guest_saved_vendors`). Account-required: it's a
 * personal bookmark, so an accountless guest is routed to make one (the
 * claim-account box on the page). Idempotent (one bookmark per vendor per user).
 */
export async function saveAttendedVendorAction(
  eventId: string,
  slug: string,
  vendorProfileId: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    // No real account (signed-out OR an unsecured anon-draft) → can't bookmark
    // for "their future plans" yet; nudge them to make/secure one. Saving a
    // vendor persists vendor-discovery intent to the user, so an anon guest
    // converts first via the page's claim-account box.
    return redirect(`/${slug}?save=needs_account`);
  }
  if (!vendorProfileId) {
    return redirect(`/${slug}?save=error`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('guest_saved_vendors').upsert(
    { user_id: user.id, vendor_profile_id: vendorProfileId, source_event_id: eventId },
    { onConflict: 'user_id,vendor_profile_id', ignoreDuplicates: true },
  );

  return redirect(`/${slug}?save=${error ? 'error' : 'ok'}`);
}

/**
 * Invite/Join v2 — an accountless guest on the lifecycle site claims a real
 * Setnayan account. Reads the SIGNED guest-session cookie (never a form field)
 * to identify the guest, then emails a passwordless sign-in link that connects
 * this event to the account (sendEventAccountMagicLink). Bound with the slug so
 * we can return to the event page if the cookie's gone stale.
 */
export async function claimAccountAction(eventId: string, slug: string, formData: FormData) {
  const email = clean(formData.get('email'));
  const session = await readGuestSession();
  if (!email || !session || session.event_id !== eventId) {
    return redirect(`/${slug}`);
  }
  await sendEventAccountMagicLink({ eventId, guestId: session.guest_id, email });
  return redirect(`/join/${eventId}/check-email?email=${encodeURIComponent(email)}`);
}

export async function submitRsvp(
  eventId: string,
  guestId: string,
  formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    // Session got out of sync — kick them back to the slug landing.
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    redirect(ev?.slug ? `/${ev.slug}` : '/');
  }

  const status = clean(formData.get('rsvp_status')) as RsvpStatus;
  const meal_raw = clean(formData.get('meal_preference'));
  const meal = (meal_raw || 'no_preference') as MealPreference;
  const dietary = clean(formData.get('dietary_restrictions')) || null;
  // ⚠ `guest_note`, NOT `notes`. `guests.notes` is the COUPLE'S private note
  // about this guest; this action runs as the GUEST. Until 2026-08-06 it read
  // `notes` from the form and wrote it straight back, so every RSVP erased what
  // the couple had written about that person.
  const guestNote = clean(formData.get('guest_note')) || null;
  // The guest's OWN contact details. Named `contact_*` on the form so nothing
  // here can ever collide with the sign-in-link box elsewhere on this page,
  // which posts `email` to a completely different action.
  const contactEmail = clean(formData.get('contact_email')) || null;
  const contactMobile = clean(formData.get('contact_mobile')) || null;
  const contactName = clean(formData.get('contact_display_name')) || null;

  if (meal && !MEAL_VALUES.includes(meal)) {
    return;
  }

  const admin = createAdminClient();

  // ── ONLY THE ANSWER FREEZES ───────────────────────────────────────────────
  // Owner, 2026-08-20: the invitation link exists so guests "update their
  // info", so the host can "see who will go and not go", and so guests can
  // preview the event hub. Once the guest list is final only the MIDDLE one is
  // settled. The other two are the reason the link exists at all.
  //
  // 🔑 THIS FORM IS NOT A HEADCOUNT. It carries five things and only one is
  // the count: the answer · the selfie that makes their photos findable ·
  // their meal · their dietary notes · a note to the host. The list finalizes
  // about two weeks out — exactly when "nut allergy" matters most. So a closed
  // list drops the ANSWER from this write and saves everything else.
  //
  // 🔑 AND THE DATABASE WILL NOT DRAW THIS LINE FOR US.
  // `guard_guest_edits_when_locked` draws it correctly — it blocks only
  // count-affecting writes and lets meal / photo / seating through by design —
  // but its first branch exempts `auth.role() = 'service_role'`, and this
  // action writes with the ADMIN client. Its own header names "the guest
  // self-RSVP portal" as a path it covers; that is the one path it cannot fire
  // on. Until that is reconciled at the database, this IS the enforcement.
  const { data: evRsvp } = await admin
    .from('events')
    .select('slug, event_date, guest_list_edit_deadline, guest_count_locked_at')
    .eq('event_id', eventId)
    .maybeSingle();
  const replyLocked = guestListIsClosed({
    lockedAt: evRsvp?.guest_count_locked_at,
    editDeadline: evRsvp?.guest_list_edit_deadline,
    eventDate: evRsvp?.event_date,
  });

  // A locked reply renders NO rsvp_status control, so an ordinary save posts
  // nothing here — and the old `!RSVP_VALUES.includes(status) → return` would
  // then drop the guest's meal and allergy on the floor IN SILENCE. The status
  // check therefore only guards the path that actually writes a status.
  if (!replyLocked && !RSVP_VALUES.includes(status)) {
    return;
  }

  // Did somebody POST a DIFFERENT answer into a closed list — a tab that was
  // open when the deadline passed, or a crafted request? Then say so. A submit
  // that quietly ignores half of what was sent is indistinguishable from one
  // that worked.
  //
  // ⚠ It must be a real CHANGE. A stale tab still carries the guest's own
  // answer pre-checked, so it reposts it unchanged on an ordinary details save
  // — telling that guest "your reply was refused" would be alarming and false.
  // The stored values BEFORE this write — the only way to tell a real change
  // from an idle Save. Every field on the reply card is `defaultValue=`, so a
  // guest who opens the card and taps Save reposts their own answer, meal,
  // allergy and note byte-for-byte.
  // ⚠ A READ, deliberately — never a write. The guard in
  // only-the-answer-freezes.test.ts locates the answer-freezing statement by
  // finding the first writing call after the closed-list check, so a write here
  // would silently retarget it onto the wrong one.
  // 🪤 And this comment may not SPELL that call: naming it here is enough for
  // the guard to find the comment instead of the code, which is how an earlier
  // draft of this very note turned the guard red.
  const { data: before } = await admin
    .from('guests')
    .select('rsvp_status, rsvp_responded_at, meal_preference, dietary_restrictions, guest_note, email, mobile, display_name')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();

  let answerRefused = false;
  if (replyLocked && RSVP_VALUES.includes(status)) {
    answerRefused = Boolean(before) && before!.rsvp_status !== status;
  }

  const { error } = await admin
    .from('guests')
    .update({
      // The count is frozen: the stored answer is left exactly as it is.
      ...(replyLocked
        ? {}
        : {
            rsvp_status: status,
            // 🔴 ONLY A CHANGED ANSWER MOVES THE DATE. Every field on this card
            // is `defaultValue=`, so a guest correcting their phone number
            // reposts the answer they already gave — and this used to restamp
            // it as though they had just replied. The host's twin of this bug
            // was fixed the same day; this is the guest-side one.
            // An unchanged answer keeps its own date, INCLUDING null: stamping
            // an untouched answer invents one.
            // ⚖ A failed `before` read stamps, deliberately — a stale date is
            // wrong, a deleted date is gone.
            rsvp_responded_at:
              status === 'attending' || status === 'declined'
                ? before?.rsvp_status === status
                  ? ((before?.rsvp_responded_at as string | null) ?? null)
                  : new Date().toISOString()
                : null,
          }),
      meal_preference: meal,
      dietary_restrictions: dietary,
      guest_note: guestNote,
      // ⚠ OUTSIDE the frozen branch on purpose. Only the ANSWER freezes: a
      // phone number corrected the week of the event is worth more then than
      // at any other time.
      email: contactEmail,
      mobile: contactMobile,
      display_name: contactName,
      updated_at: new Date().toISOString(),
    })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);

  if (error) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Submit guest RSVP',
      file_path: 'app/[slug]/actions.ts',
      error_message: error.message,
      payload_snapshot: { eventId, guestId, status, meal },
    });
    // 🔴 THIS USED TO `return` SILENTLY — "a toast UI lands with the polish
    // pass", which it never did. The guest tapped Save, the button stopped
    // spinning, the page came back looking exactly as before, and nothing was
    // written. They walk away believing they have replied.
    //
    // Nobody finds out. The guest thinks they are counted; the couple's list
    // says they never answered; the caterer's headcount is short by however
    // many people hit a bad second. A silent write failure on an RSVP is the
    // one failure with no natural discovery path — the guest has no reason to
    // check again, and the couple cannot tell "did not reply" from "replied
    // and we dropped it".
    //
    // The fault log is for us. This redirect is for them.
    const { data: evFail } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    redirect(evFail?.slug ? `/${evFail.slug}?rsvp=error` : '/');
  }

  // Smart seat-plan Phase 5 (gap G2): a guest confirming from their own invite
  // should get a seat if they don't have one (e.g. added before any tables
  // existed, or self-joined). Gap-fill only — NO reseat, so a confirmed guest's
  // existing chair never jumps just because they replied. Reconcile on any
  // NON-declined reply (declined is handled DB-side by free_seat_on_decline).
  // Admin client — the guest session has no RLS write on event_seat_assignments.
  // Best-effort; no-op if autoplace is off or they're already seated.
  // ⚠ On a locked save `status` is EMPTY (no control is rendered), and `'' !==
  // 'declined'` is TRUE — so this would run a seat reconcile on every details
  // edit for a finalized event. Harmless but pointless work; the answer, and
  // therefore the seating question, cannot have changed.
  if (!replyLocked && status !== 'declined') {
    await applyReconcileForEvent(admin, eventId);
  }

  // Persist the RSVP selfie + face-recognition enrollment (owner directive
  // 2026-06-05). Gated on EXPLICIT biometric consent (RA 10173): no consent →
  // no photo, no enrollment. Best-effort + non-fatal — a selfie/enrollment
  // failure must NEVER roll back the RSVP that already succeeded above.
  // ── 🔴 SEC-1: the selfie ref is GUEST-SUPPLIED, so it is pinned before use ──
  //
  // `guestSelfiePolicy` already existed for exactly this flow and was already
  // wired in `papic/face-enroll-actions.ts` — but NOT here, on the RSVP path. Same
  // column, same renderers, one writer guarded and one not.
  //
  // Why that mattered: this write uses the ADMIN client (RLS cannot help), and
  // `guests.photo_url` is resolved through `displayUrlForStoredAsset` on at least
  // five surfaces — the guest list, both seating views, the 3D plan and the guest
  // avatar. So a crafted RSVP post naming
  // `r2://setnayan-vendor-verification/vendors/X/verification/dti.pdf` (or another
  // event's selfie, or a payment screenshot in thread-files) would be stored as
  // that guest's avatar and SIGNED for the couple — a cross-tenant read out of a
  // private bucket, through a form any invited guest can submit. The consent and
  // age booleans gating the block below are themselves client-supplied, so they
  // are no obstacle.
  //
  // A ref that fails the policy is treated as ABSENT rather than fatal: this
  // file's own rule is that a selfie problem must never roll back an RSVP that
  // already succeeded, and `null` simply skips the enrollment block below.
  const selfieRefRaw = clean(formData.get('selfie_ref'));
  const selfieRef =
    selfieRefRaw && parseClientRef(selfieRefRaw, guestSelfiePolicy(eventId, guestId))
      ? selfieRefRaw
      : null;
  const biometricConsent = clean(formData.get('biometric_consent')) === '1';
  // Adults-only gate (RA 10173 · NPC — minors scoped OUT of biometric
  // enrollment for V1). The client blocks capture until both boxes are ticked;
  // this is the server-side backstop so a crafted POST can't enroll without the
  // 18+ affirmation. No age is stored — this is a boolean attestation only.
  const ageAffirmed = clean(formData.get('age_affirmation')) === '1';
  // Minor safeguard (DPIA BV-8, 2026-07-05): a host can mark a guest excluded
  // from face recognition (typically a minor). Never enrol an excluded guest,
  // regardless of the consent checkbox.
  const { data: fx } = await admin
    .from('guests')
    .select('face_recognition_excluded')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .maybeSingle();
  const faceExcluded = (fx as { face_recognition_excluded: boolean } | null)?.face_recognition_excluded === true;
  // Owner 2026-08-05: "under 18 will not allow face tagging." The attestation is
  // the enabler; this is the refusal that does not depend on it. Where the guest
  // list already records a birth date showing a child, no tickbox overrides it.
  const knownMinor = await isKnownMinorGuest(admin, eventId, guestId);
  if (selfieRef && biometricConsent && ageAffirmed && !faceExcluded && !knownMinor) {
    try {
      // Selfie is the highest-priority display photo — it always wins over a
      // Gmail avatar / couple upload.
      await admin
        .from('guests')
        .update({
          photo_url: selfieRef,
          photo_source: 'selfie',
          photo_updated_at: new Date().toISOString(),
          photo_consent: true,
        })
        .eq('guest_id', guestId)
        .eq('event_id', eventId);

      // Advisory quality meta from the in-browser gate (may be absent if the
      // gate couldn't run — that's fine, we enroll without it).
      let qualityScore: number | null = null;
      let qualityMeta: Record<string, unknown> = {};
      const rawQuality = clean(formData.get('selfie_quality'));
      if (rawQuality) {
        try {
          const parsed = JSON.parse(rawQuality) as {
            score?: number | null;
          } & Record<string, unknown>;
          if (typeof parsed.score === 'number') qualityScore = parsed.score;
          qualityMeta = parsed;
        } catch {
          // malformed quality blob — enroll without it
        }
      }

      // Optional on-device face descriptor (dlib via face-api.js) — the guest's
      // face fingerprint for gallery auto-tagging. Absent until the embedder +
      // a hosted model are live → enroll image-only exactly as before.
      let faceVector: number[] | null = null;
      const rawVector = clean(formData.get('selfie_vector'));
      if (rawVector) {
        try {
          const v = JSON.parse(rawVector) as unknown;
          if (
            Array.isArray(v) &&
            v.length > 0 &&
            v.every((n) => typeof n === 'number' && Number.isFinite(n))
          ) {
            faceVector = v as number[];
          }
        } catch {
          // malformed vector — enroll without it
        }
      }

      // BIOMETRIC WRITE GUARD (One-Pool spec §3.4). Resolve the EFFECTIVE face
      // mode server-side (christening/debut forced to mode_b; fail-closed) and
      // HARD-NULL the descriptor unless this is an explicit mode_a event — so a
      // crafted POST carrying `selfie_vector` on a mode_b / forced-mode_b event
      // can NEVER persist a biometric. The selfie image + consent row below are
      // still written (profile photo / day-of features are preserved); only the
      // vector is dropped. This is the write that makes the migration's
      // "no face descriptor … stored" guarantee true at the DB boundary.
      const faceMode = await resolvePapicFaceMode(admin, eventId);
      const stored = faceVectorForMode(faceMode, faceVector, VECTOR_MODEL);

      // Upsert: the partial unique index allows only one non-revoked enrollment
      // per (event, guest), so retire any live row before inserting the fresh
      // one (re-RSVP with a new selfie supersedes the old).
      await admin
        .from('guest_face_enrollments')
        .update({ revoked_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .is('revoked_at', null);

      await admin.from('guest_face_enrollments').insert({
        event_id: eventId,
        guest_id: guestId,
        asset_url: selfieRef,
        source: 'rsvp_selfie',
        quality_score: qualityScore,
        quality_meta: qualityMeta,
        face_vector: stored.face_vector,
        vector_model: stored.vector_model,
        consent_at: new Date().toISOString(),
        consent_source: 'rsvp',
        // Consent evidence (One-Pool spec §3.3): pin WHAT disclosure was shown.
        consent_copy_version: FACE_CONSENT_COPY_VERSION,
      });
    } catch {
      // Selfie/enrollment failure never blocks the RSVP.
    }
  }

  const { data: ev } = await admin
    .from('events')
    .select('slug, display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  // TELL THE COUPLE WHAT MOVED ON THIS GUEST'S CARD — the answer, or the
  // details only they can act on. emitNotification handles the in-app row and
  // the email; failures here never roll back the RSVP.
  //
  // 🔴 UNTIL 2026-08-21 THIS FIRED ONLY ON `attending` / `declined`, and that
  // omitted far more than "maybe". Once the guest list is final the answer
  // control is not rendered AT ALL, so `status` arrives EMPTY — a guest typing
  // "severe nut allergy" twelve days out reached nobody, in the exact fortnight
  // a caterer needs it. The action already knew the control was gone; every
  // other branch was taught to cope and this one was never revisited.
  //
  // 🔑 AND IT FIRES ON THE CHANGE, NEVER ON THE WRITE. The update above runs on
  // every submit and `updated_at` always moves, while every field on the card
  // is `defaultValue=` — so neither is a change signal. Only the comparison is.
  //
  // ⚠ DELIBERATE REMOVAL: reposting an unchanged `attending` used to notify the
  // couple again. It is now silent. That is the point.
  const changed = guestDetailsChanged(before, {
    meal,
    dietary,
    guestNote,
    email: contactEmail,
    mobile: contactMobile,
    displayName: contactName,
  });
  // Only a change that was actually STORED counts. When the list is locked the
  // answer is not written at all, so a stale tab posting a different one must
  // never be reported to the host as a reply that moved.
  const answerChanged = !replyLocked && before?.rsvp_status !== status;

  if (answerChanged || changed.length > 0) {
    try {
      const { data: guest } = await admin
        .from('guests')
        .select('first_name, last_name, display_name')
        .eq('guest_id', guestId)
        .maybeSingle();
      const guestName =
        (guest?.display_name ?? '').trim() ||
        `${guest?.first_name ?? ''} ${guest?.last_name ?? ''}`.trim() ||
        'A guest';
      // 🪤 'maybe' can reach here now. It never could before, so the old label
      // mapped everything-not-attending to "not attending" — which would report
      // an UNDECIDED guest to the couple as a NO.
      const statusLabel =
        status === 'attending'
          ? 'attending'
          : status === 'declined'
            ? 'not attending'
            : 'undecided';
      const title = answerChanged
        ? `${guestName} RSVP'd: ${statusLabel}`
        : `${guestName} updated their details`;
      const parts: string[] = [];
      // ⚠ EVERY MEMBER OF `changed` MUST PRODUCE A SENTENCE, or the couple gets
      // a heading with nothing under it. Clearing a meal (beef → no preference)
      // used to yield changed=['meal'] and parts=[] — an email whose entire
      // content was "Ana updated their details", from a change the couple can
      // only discover by opening the app. Same missing set/clear branch the
      // dietary line below always had, on a third field.
      if (changed.includes('meal')) {
        parts.push(
          meal !== 'no_preference'
            ? `Meal preference: ${meal}.`
            : 'They cleared their meal preference.',
        );
      }
      // 🔒 THE DIETARY VALUE IS NAMED, NEVER QUOTED. The compliance record
      // classes dietary notes as data that may reveal health or religious
      // belief; the deep link keeps the words inside the app rather than in an
      // inbox.
      if (changed.includes('dietary')) {
        parts.push(dietary ? 'Their dietary notes changed.' : 'They cleared their dietary notes.');
      }
      // ⚠ The note branch must answer the SAME question the dietary branch above
      // already answers: set or CLEARED. It said "They left you a note" either
      // way, so deleting a note sent the couple to open a note that is not
      // there — a trip made for nothing, and the second time it teaches them to
      // ignore the notification.
      if (changed.includes('note')) {
        parts.push(guestNote ? 'They left you a note.' : 'They removed their note.');
      }
      // The three the guest could never give until 2026-08-21. Each says WHICH
      // detail moved and never the value: a phone number and an email address
      // in an inbox are contact data leaving the app, and the deep link keeps
      // them inside it — the same line already drawn on dietary notes.
      if (changed.includes('email')) {
        parts.push(contactEmail ? 'They added their email.' : 'They removed their email.');
      }
      if (changed.includes('mobile')) {
        parts.push(contactMobile ? 'They added their mobile number.' : 'They removed their mobile number.');
      }
      if (changed.includes('name')) {
        parts.push(contactName ? 'They told you what to call them.' : 'They cleared what to call them.');
      }

      const { data: coupleMembers } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      // ⚠ Two rows can carry the same user_id. Without this the couple gets the
      // same allergy twice.
      const seen = new Set<string>();
      for (const m of coupleMembers ?? []) {
        if (!m.user_id || seen.has(m.user_id as string)) continue;
        seen.add(m.user_id as string);
        await emitNotification({
          userId: m.user_id,
          type: 'rsvp_received',
          title,
          body: parts.length ? parts.join(' ') : null,
          relatedUrl: `/dashboard/${eventId}/guests/${guestId}`,
        });
      }
    } catch {
      // Notification failures must not break the guest-side RSVP submit.
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  // `details` = their information was saved and their answer was left alone
  // (the list is final). `refused` additionally says an attempted CHANGE of
  // answer did not take — the one outcome a guest would otherwise never learn.
  const outcome = answerRefused ? 'refused' : replyLocked ? 'details' : 'ok';
  redirect(ev?.slug ? `/${ev.slug}?rsvp=${outcome}` : '/');
}

/**
 * Guest withdraws face-recognition consent (RA 10173 — the data subject's
 * right to withdraw / erasure). This is a real erasure, not just a revoke:
 * we (1) null the biometric `face_vector`, (2) delete the enrolled selfie
 * object from R2, and (3) tombstone the enrollment via `revoked_at`, so the
 * privacy policy's promise that withdrawal "permanently deletes your face
 * vector and enrolled selfie" is literally true. The selfie display photo is
 * also cleared (reverting to initials); a Gmail avatar, being display-only
 * and non-biometric, is left intact. Admin-client + guest-session authorized,
 * the same trust model as submitRsvp.
 */
export async function withdrawFaceConsent(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    return;
  }
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Grab the live enrollment rows FIRST so we can erase the R2 selfie objects
  // they point at. (Read before we tombstone — after revoke we still could
  // read them, but this keeps the asset list crisp.)
  const { data: liveEnrollments } = await admin
    .from('guest_face_enrollments')
    .select('id, asset_url')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('revoked_at', null);

  // Erase the biometric: null the face vector AND tombstone the row. Nulling
  // face_vector is the actual biometric deletion; revoked_at keeps the matcher
  // excluding it and preserves an audit trail of the withdrawal.
  await admin
    .from('guest_face_enrollments')
    .update({ revoked_at: now, face_vector: null, vector_model: null })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('revoked_at', null);

  // Best-effort R2 delete of each enrolled selfie. asset_url is stored as an
  // `r2://bucket/key` ref (see /api/guest-selfie → encodeR2Ref) — parse it and
  // hand the (bucket, key) to r2Delete. A legacy plain-URL row (pre-r2:// era)
  // routes through deletePublicAsset instead. Both are wrapped: a stale/absent
  // object (or unconfigured R2) must never abort the rest of the withdrawal.
  for (const row of liveEnrollments ?? []) {
    const assetUrl = (row as { asset_url: string | null }).asset_url;
    if (!assetUrl) continue;
    const parsed = parseStoredAsset(assetUrl);
    try {
      if (parsed?.kind === 'r2') {
        await r2Delete({ bucket: parsed.bucket, key: parsed.key });
      } else if (parsed?.kind === 'legacy_url') {
        await deletePublicAsset({ publicUrl: parsed.url });
      }
    } catch (err) {
      // Idempotent + non-fatal: log and continue. An orphaned object is
      // reaped later by the R2 lifecycle rule; the withdrawal still completes.
      console.warn('[withdrawFaceConsent] selfie R2 delete failed (continuing)', {
        eventId,
        guestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If this guest is linked to a real Setnayan account, null the dormant
  // account-level face vector too (feature ships DORMANT, but erase what
  // exists). The guest→account bridge is event_members.guest_id → user_id.
  const { data: linkedMember } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .not('user_id', 'is', null)
    .maybeSingle();
  const linkedUserId = (linkedMember as { user_id: string | null } | null)?.user_id;
  if (linkedUserId) {
    await admin
      .from('user_face_profiles')
      .update({ face_vector: null, vectors: null, revoked_at: now })
      .eq('user_id', linkedUserId);
  }

  await admin
    .from('guests')
    .update({
      photo_url: null,
      photo_source: null,
      photo_updated_at: now,
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('photo_source', 'selfie');

  // Revoking the enrollment stops FUTURE auto-tags, but the photos this guest is
  // ALREADY auto-tagged in would otherwise stay tagged — a full RA 10173 "remove
  // me from face recognition" must also pull those. Soft-tombstone every live
  // auto_face tag of this guest (human QR/manual tags are left — those are the
  // couple/photographer's assertion, not a face guess). The removed_at rows keep
  // excluding the guest in alreadyTaggedGuestIds, so nothing re-tags later.
  await admin
    .from('photo_tags')
    .update({ removed_at: now, removed_by: 'guest' })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('source', 'auto_face')
    .is('removed_at', null);

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(ev?.slug ? `/${ev.slug}?face_removed=1` : '/');
}

/**
 * Guest removes a single incorrect auto_face tag of THEMSELVES ("Not me" on one
 * candid). Narrower than withdrawFaceConsent: the guest stays enrolled and keeps
 * auto-finding their other photos; only this one shot is dropped.
 *
 * Soft tombstone (removed_at), not a delete — see the migration header: a hard
 * delete would be re-added by the next auto-tag pass. The WHERE clause is pinned
 * to source='auto_face' + the cookie's own guest_id, so a guest can only drop a
 * FACE guess of themselves — never a photographer's QR/manual tag, never another
 * guest's tag. Works for both papic_photos and papic_guest_captures (keyed on
 * source_table + source_id). Admin-client + guest-session authorized, the same
 * trust model as submitRsvp / withdrawFaceConsent.
 */
export async function removeMyTag(
  eventId: string,
  sourceTable: 'papic_photos' | 'papic_guest_captures',
  sourceId: string,
  _formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) {
    return;
  }
  const admin = createAdminClient();
  await admin
    .from('photo_tags')
    .update({ removed_at: new Date().toISOString(), removed_by: 'guest' })
    .eq('event_id', eventId)
    .eq('guest_id', session.guest_id)
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .eq('source', 'auto_face')
    .is('removed_at', null);

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (ev?.slug) revalidatePath(`/${ev.slug}`);
}
