'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession, clearGuestSession } from '@/lib/guest-session';
import { recordScan } from '@/lib/scan-trail';
import { envFlagEnabled } from '@/lib/env-flag';
import { saveMethodFor } from '@/lib/guest-one-path';
import { MEAL_PREFERENCES, type MealPreference } from '@/lib/guests';
import { resolveRsvpAsk } from '@/lib/rsvp-ask';
import {
  hasAgreedToTerms,
  RSVP_TERMS_COOKIE,
  RSVP_TERMS_COOKIE_MAX_AGE,
  rsvpTermsCarried,
  TERMS_FIELD,
  TERMS_VERSION,
} from '@/lib/terms-agreement';
import { PLUS_ONE_WELCOMED_COOKIE, PLUS_ONE_WELCOMED_MAX_AGE, plusOneUnnamed } from '@/lib/plus-one-welcome';
import { signInWithApple, signInWithGoogle } from '@/app/auth/oauth-actions';

/**
 * THE PLUS-ONE'S OWN DOOR — the save (prototype `rsvp_plus_ones_2026-09-29.html`,
 * frame F; owner 2026-09-29: *"plus guests are only minimum questions … They
 * also get their own QR Code. they can also link it to their account."*).
 *
 * One form, three ways out (`then`):
 *   · `keep` — "Save to my account": saves the answers and the Terms tick, then
 *     takes the DEVICE's method, re-decided here (`saveMethodFor`) — Apple or
 *     Google through `/join/{eventId}/connect`. The shipped doors, reused.
 *     📵 Never an emailed link (owner 2026-09-29, "NO EMAIL TO GUESTS").
 *   · `pass` — "Not now — just show my pass": saves whatever was typed (nothing
 *     is required) and shows their QR on this same door.
 *   · absent — the older name-only form ("Correct — that's me"): name required,
 *     then the Event Hub, as it always did.
 *
 * 🔒 ONLY THE FOUR, ONLY THEIR OWN ROW. The guest is the one this browser's
 * pass names (never a form field), and must be a plus-one of THIS event. What
 * is written: first + last name, meal (a known value, only when the couple asks
 * it), dietary (only when asked). Never an answer, a song, a note, a selfie.
 * Their attendance is not touched — it follows their own reply if they give one.
 */
export async function confirmPlusOneName(slug: string, formData: FormData): Promise<void> {
  const then = String(formData.get('then') ?? '');
  const first_name = String(formData.get('first_name') ?? '').trim();
  const last_name = String(formData.get('last_name') ?? '').trim();

  const session = await readGuestSession();
  if (!session) redirect(`/${slug}`);

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [{ data: event }, { data: guest }] = await Promise.all([
    admin.from('events').select('event_id, slug, rsvp_ask_config').eq('event_id', session.event_id).maybeSingle(),
    admin
      .from('guests')
      .select('guest_id, first_name, plus_one_of_guest_id, plus_one_name_confirmed_at')
      .eq('guest_id', session.guest_id)
      .eq('event_id', session.event_id)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);
  if (!event?.slug || !guest?.guest_id) redirect(`/${slug}`);
  const home = event.slug as string;
  const ask = resolveRsvpAsk(event.rsvp_ask_config);

  const unnamed = plusOneUnnamed({
    first_name: (guest.first_name as string | null) ?? null,
    plus_one_name_confirmed_at: (guest.plus_one_name_confirmed_at as string | null) ?? null,
  });
  // A name is REQUIRED only to save an unnamed seat (the older form, and "Save
  // to my account"). "Not now" never demands one.
  if (then !== 'pass' && unnamed && (!first_name || !last_name)) {
    redirect(`/${home}/welcome?error=missing`);
  }
  if (first_name.length > 80 || last_name.length > 80) {
    redirect(`/${home}/welcome?error=too_long`);
  }

  const patch: Record<string, string | null> = {};
  if (first_name && last_name) {
    patch.first_name = first_name;
    patch.last_name = last_name;
    // 🔴 CLEARING THIS IS THE HALF THAT WAS MISSING, AND WITHOUT IT THE WHOLE
    // SCREEN ACHIEVED NOTHING VISIBLE. An unnamed plus-one was minted with a
    // placeholder `display_name` ("+2 · TBA", formerly "+ TBA · brought by …"),
    // and `guestDisplayName` PREFERS display_name over first/last. Setting it
    // null lets the real name through, on the seating chart and the emcee
    // script alike.
    patch.display_name = null;
    patch.plus_one_name_confirmed_at = now;
  }
  const meal = String(formData.get('meal_preference') ?? '').trim();
  if (ask.meal && meal && (MEAL_PREFERENCES as string[]).includes(meal)) {
    patch.meal_preference = meal as MealPreference;
  }
  if (ask.dietary && formData.get('dietary_restrictions') !== null) {
    const dietary = String(formData.get('dietary_restrictions') ?? '').trim().slice(0, 500);
    // A blank box is not a removal — only something typed is saved.
    if (dietary) patch.dietary_restrictions = dietary;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin
      .from('guests')
      .update({ ...patch, updated_at: now })
      .eq('guest_id', guest.guest_id)
      .eq('event_id', event.event_id)
      // Only ever a plus-one's own row — this door is theirs.
      .not('plus_one_of_guest_id', 'is', null);
    if (error) {
      redirect(`/${home}/welcome?error=${encodeURIComponent('Your details did not save — please try again.')}`);
    }
  }

  // Record the naming as its own scan event, as this door always did — through
  // the one door (lib/scan-trail.ts), so an opted-out guest gets no row.
  if (unnamed && patch.first_name) {
    await recordScan(admin, {
      eventId: session.event_id,
      guestId: session.guest_id,
      entry: 'plus_one_onboarded',
    });
  }

  const jar = await cookies();
  const secure = process.env.NODE_ENV === 'production';
  if (then === 'keep' || then === 'pass') {
    // Either button ends the welcome for this browser.
    jar.set(PLUS_ONE_WELCOMED_COOKIE, guest.guest_id as string, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: PLUS_ONE_WELCOMED_MAX_AGE,
    });
  }
  const agreed = hasAgreedToTerms(formData.get(TERMS_FIELD));
  if (agreed) {
    // Carried to the account door exactly as the RSVP page carries it.
    jar.set(RSVP_TERMS_COOKIE, TERMS_VERSION, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: RSVP_TERMS_COOKIE_MAX_AGE,
    });
  }

  if (then === 'pass') redirect(`/${home}/welcome?pass=1`);
  if (then !== 'keep') redirect(`/${home}`);

  // ── "SAVE TO MY ACCOUNT" — the device's method, the shipped doors.
  const termsOk = agreed || rsvpTermsCarried(jar.get(RSVP_TERMS_COOKIE)?.value);
  if (!termsOk) redirect(`/${home}/welcome?error=terms`);
  const method = saveMethodFor((await headers()).get('user-agent'), {
    apple: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED),
    google: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED),
  });
  if (method === 'apple' || method === 'google') {
    const next = new FormData();
    next.set('next', `/join/${event.event_id}/connect`);
    return method === 'apple' ? signInWithApple(next) : signInWithGoogle(next);
  }
  // 📵 No provider on this device (an in-app browser): there is no email link
  // any more (owner 2026-09-29, "NO EMAIL TO GUESTS"). The answers are saved;
  // the door hands over "Open in your browser" under its plain Save.
  redirect(`/${home}`);
}

export async function abandonPlusOneInvite(
  slug: string,
  _formData: FormData,
): Promise<void> {
  // "This isn't me — I scanned the wrong code". Clear the cookie so no row is
  // mutated, then drop them on the public landing.
  await clearGuestSession();
  redirect(`/${slug}`);
}
