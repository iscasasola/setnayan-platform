'use server';

/**
 * Iteration 0053 Phase 3 — the GENERIC (non-wedding) onboarding commit. A SEPARATE
 * server action from `commitOnboardingWedding` (which stays byte-identical): the
 * wedding wizard is untouched. This reuses the same proven spine — anon-draft
 * session mint, unique slug, single events INSERT, event_members ownership — but
 * for a non-wedding type, with every wedding-only CHECK column NULL (built by the
 * pure `buildGenericEventInsert`). Inert until PR2's `/onboarding/[type]` route
 * calls it.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { anonOnboardingEnabled } from '@/lib/anon-onboarding';
import { allowAnonMint } from '@/lib/anon-mint-throttle';
import { captchaOptions } from '@/lib/turnstile';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { generateUniqueSlug } from '@/lib/slugs';
import { resolveProfile } from '@/lib/event-type-profile';
import { buildGenericEventInsert } from '@/lib/onboarding/event-insert';
import { sanitizeSetupAnswers } from '@/lib/onboarding/setup-answers';
import { defaultNeedsFor, needsColumns, sanitizeNeeds, applyNeedsToSetup } from '@/lib/event-needs';
import { setupArmsPapic } from '@/lib/event-answers';
import { setupViewForProfile } from '@/lib/onboarding/setup-view';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import { mintOnboardingServiceOrders } from '@/lib/onboarding-services-orders';
import { setnayanAiOffered } from '@/lib/setnayan-ai';
import { getBlockingLifeEvent } from '@/app/dashboard/(account)/create-event/life-event-guard';
import {
  resolveEventHonoree,
} from '@/lib/honoree-dependent-link';
import type { GenericOnboardingPayload, GenericCommitResult } from '@/lib/onboarding/types';
import { accountMayNotCreateEvents } from '@/lib/vendor-event-creation';

export async function commitOnboardingEvent(
  payload: GenericOnboardingPayload,
): Promise<GenericCommitResult> {
  // The generic flow NEVER commits a wedding — that has its own dedicated commit
  // (commitOnboardingWedding) with the wedding CHECK columns + bride/groom seeds.
  if (!payload.eventType || payload.eventType === 'wedding') {
    return { ok: false, error: 'invalid_event_type' };
  }

  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Anon-draft onboarding (flag-gated): mint a Supabase NATIVE anonymous session
    // so the events + event_members insert + all RLS work unchanged. Same contract
    // as the wedding commit; OFF → unchanged not_authenticated.
    if (anonOnboardingEnabled()) {
      // Per-IP flood guard: anonymous sign-in mints a real account + event from
      // nothing, so cap it per IP before minting. Fail-open on a missing IP or
      // infra error (see allowAnonMint) so a real couple is never locked out.
      if (!(await allowAnonMint(createAdminClient()))) {
        return { ok: false, error: 'rate_limited' };
      }
      const { data: anon, error: anonError } = await supabase.auth.signInAnonymously({
        // Global Supabase captcha gates anonymous sign-in. Token comes from the
        // funnel client (mintTurnstileToken); empty → {} → no-op.
        options: captchaOptions(payload.captchaToken),
      });
      if (anonError || !anon.user) {
        console.error('[commitOnboardingEvent] anon sign-in failed:', anonError?.message);
        return { ok: false, error: 'not_authenticated' };
      }
      user = anon.user;
    } else {
      return { ok: false, error: 'not_authenticated' };
    }
  }

  /*
    The one creation gate (lib/vendor-event-creation.ts). This is one of the
    creation paths that live OUTSIDE `/dashboard`, which is why the rule lives
    on the doors and not in a layout. Owner 2026-10-22: one account is both — a
    shop account creates its own events here like any host — so today nobody is
    refused; the call stays so a future rule has one home.
  */
  if (await accountMayNotCreateEvents(supabase, user.id)) {
    return { ok: false, error: 'not_allowed' };
  }

  // Life-event cardinality (2026-07-17): one IN-PLANNING life event per
  // (account × type × honoree). The generic onboarding collects no honoree yet,
  // so a life-type commit contends for the per-type singleton slot; lifestyle
  // types return null immediately. Anonymous drafts have no prior events by
  // construction but run the guard anyway (it's one indexed read).
  // The honoree is now COLLECTED by the generic onboarding (2026-07-31), so a
  // second birthday for a different child no longer collides with the first.
  // Passing it here is the whole fix: `blocksLifeEventCreation` compares
  // normalized honoree keys and only treats two UNLABELED events as the same
  // singleton slot.
  //
  // The STRONGER half of that key — WHICH alaga — rides along from the create
  // step's who question. It arrives from the client, so it is re-read here under
  // `owner_user_id = you` and dropped unless the caller owns it AND the typed
  // label still matches its name; anything else resolves to NULL and the label
  // keys the cap exactly as it does today. This is a refinement of the cap, so
  // it must never become a new way to fail: a missing service key is already
  // fatal further down (server_config_error) and is swallowed here rather than
  // moved earlier.
  //
  // ⚠ THE TYPE GATE IS ON THE SERVER, NOT ONLY IN THE WIZARD. Until 2026-08-31
  // this branch ran for ANY type, because the client was the only thing deciding
  // which types collect an honoree — and a server action is reachable by direct
  // POST. The type gate lives inside `resolveEventHonoree`, so a WEDDING (which
  // names nobody, and holds its own guard) cannot name a dependent through this
  // door either.
  //
  // 2026-10-22 (owner "yes"): a SHOP's business alaga is linked on EVERY type the
  // picker offers for it, not only the named ones — the same `resolveEventHonoree`
  // the inline create action calls, so the two doors answer identically. The
  // LABEL is overwritten from it too: on a business-only type it survives only
  // beside a verified shop, so a person's name never lands on a trip.
  const { honoreeLabel, honoreeDependentId } = await resolveEventHonoree(createAdminClient, {
    userId: user.id,
    eventType: payload.eventType,
    honoreeLabel: payload.honoreeLabel,
    dependentId: payload.honoreeDependentId,
  });

  const blockingLifeEvent = await getBlockingLifeEvent(supabase, user.id, {
    eventType: payload.eventType,
    honoreeLabel,
    honoreeDependentId,
  });
  if (blockingLifeEvent) {
    // Hand back WHICH event conflicts. The client walks the user to the
    // honoree question with this name in the copy — previously this returned a
    // bare error string that surfaced as "Something went wrong saving your
    // plan. Please try again.", which was untrue (nothing went wrong) and
    // unactionable (retrying fails identically, forever).
    return {
      ok: false,
      error: 'life_event_exists',
      blocking: {
        eventId: blockingLifeEvent.eventId,
        displayName: blockingLifeEvent.displayName,
      },
    };
  }

  // Resolve the profile for a sensible display-name fallback + to confirm the type
  // is real (degrades to GENERIC_PROFILE on a missing row, which is fine).
  const profile = await resolveProfile(payload.eventType);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'server_config_error' };
  }

  // 🎟 The setup cards (G1). Read ONLY for a type its seed has admitted to the
  // engine, and re-read key by key against that type's own view — the theme
  // fence, the reply default and the rows offered come from the profile, never
  // from the wire.
  const sanitizedSetup = profile.onboardingEngine
    ? sanitizeSetupAnswers(payload.setup, setupViewForProfile(profile))
    : null;

  // 🚪 What the event needs (Level 1, owner 2026-10-08). Re-read against the TYPE — the wire is never
  // trusted — then the answers that already have a home follow it: no guest list = "Will guests
  // reply? No" + one QR + no guests card; a list = replies on (+ requests when One QR is on too).
  // Papic is always on from that screen. Absent (the engine did not run) = nothing written: NULL = on.
  const needsScope = { marketplace: profile.marketplaceEnabled === true };
  const needs =
    profile.onboardingEngine && payload.needs !== undefined
      ? sanitizeNeeds(payload.needs, defaultNeedsFor(payload.eventType, needsScope), needsScope)
      : null;
  const setup =
    sanitizedSetup && needs
      ? applyNeedsToSetup(sanitizedSetup, needs)
      : sanitizedSetup;

  const displayName =
    payload.displayName?.trim() ||
    `Our ${profile.terminology.eventWord || 'Event'}`;
  const slug = await generateUniqueSlug(admin, displayName);
  const now = new Date().toISOString();

  const row = buildGenericEventInsert(
    // `honoreeDependentId` is OVERWRITTEN with the server-verified value, never
    // merged with the client's — a forged id must not survive the spread.
    { ...payload, displayName, honoreeLabel, honoreeDependentId },
    {
      slug,
      now,
      userId: user.id,
      isAnonymous: Boolean(user.is_anonymous),
      experienceEnabled: experienceQuizEnabled(),
      homeSignalsEnabled: await isDataPrivacyControlActive('home_activity_signals'),
      setup,
    },
  );

  // events.event_id is the UUID every FK + the dashboard route use (events.id is
  // the internal bigserial). The on_event_created trigger mints the join token.
  const { data: insertedEvent, error: insertError } = await admin
    .from('events')
    .insert(needs ? { ...row, ...needsColumns(needs) } : row)
    .select('event_id')
    .single();
  if (insertError || !insertedEvent) {
    console.error(
      '[commitOnboardingEvent] events INSERT failed:',
      insertError?.message,
      insertError?.code,
      insertError?.details,
    );
    return { ok: false, error: insertError?.message ?? 'event_insert_failed' };
  }

  // Arm the free Papic pool (owner-locked 2026-07-27 · 50 pts). Papic is switched
  // ON free for every new event, so the metering fence must exist from the moment
  // the event does — an event with no grant takes papic_event_pool_status()'s
  // applies=FALSE branch and captures UNMETERED. Idempotent + non-fatal by design:
  // a miss here is self-healed on the first Papic-studio render, and must never
  // cost the couple their event.
  //
  // 🗂 …UNLESS THE ANSWER WAS NO (owner 2026-10-02, "EVERY ANSWER … LIVES IN
  // EVENT DETAILS"): "Photos from your guests? — No" is `papic_on = false`, so
  // nothing is armed and no capture is taken there (`eventAcceptsNewCaptures`).
  // Turning it on later in Your info arms both at Apply.
  if (setupArmsPapic(setup)) {
    await ensureFreePapicPoolGrantAdmin(admin, insertedEvent.event_id, user.id);
    // 🔌 No free "One" camera call (owner 2026-10-13, "drop the retired free-camera call"):
    // `free_one_camera_points` is 0 by migration 20271130515135 (owner 2026-08-11), so
    // `papic_ensure_free_one_camera` armed nothing and cost a request per new event.
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.event_id,
    user_id: user.id,
    member_type: 'couple', // the canonical "organizer" member_type (same as a non-wedding create)
    joined_via: 'created_event',
  });
  if (memberError) {
    console.error('[commitOnboardingEvent] event_members INSERT failed:', memberError.message);
    return { ok: false, error: memberError.message };
  }

  // ── what the couple picked on the Papic services step (owner 2026-08-11) ──
  // LAST, and deliberately so: the event, its ownership row and BOTH free
  // grants are already committed by this point, so nothing below can cost the
  // couple their event. `mintOnboardingServiceOrders` never throws — a rung that
  // went inactive mid-flow, a failed insert, a camera that could not be
  // provisioned all come back as `paymentPath: null`, which lands them on the
  // ordinary dashboard with a working, free Papic and no charge.
  //
  // Nothing is granted here either. The orders are minted `submitted` and the
  // shots appear only when an admin approves the payment — which is exactly why
  // this step must not gate the finish (see services-step.tsx's docblock:
  // reconciliation is manual and takes up to a day).
  const papic = await mintOnboardingServiceOrders(admin, {
    eventId: insertedEvent.event_id,
    userId: user.id,
    // 🧭 Suppliers switched off on "What do you need?" ⇒ Setnayan AI was not offered (`setnayanAiOffered`,
    // owner 2026-10-26) — a pick the wire still carries is dropped, never charged.
    rawSelection:
      needs && !setnayanAiOffered(needs) && payload.servicesSelection && typeof payload.servicesSelection === 'object'
        ? { ...(payload.servicesSelection as Record<string, unknown>), ai: false }
        : payload.servicesSelection,
  });

  return { ok: true, eventId: insertedEvent.event_id, paymentPath: papic.paymentPath };
}
