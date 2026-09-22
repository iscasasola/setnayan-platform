import 'server-only';

/**
 * open-shop-account.server.ts — create the Setnayan account that step 3 of the shop
 * wizard asked for, then sign it in, so the SAME submit can go on to open the shop.
 *
 * Owner 2026-09-22: "account inside step 3". The decision of whether to create at all
 * is `decideOpenShopAccount` in `./open-shop-account.ts` (pure, executed by a test);
 * this file is the I/O half.
 *
 * ── THE SHAPE IS `/signup`'s, ON PURPOSE ─────────────────────────────────────
 * Every rule a new account passes on `/signup` it passes here too, in the same order,
 * by calling the SAME helpers: breach check (`lib/leaked-password`), blacklist
 * (`lib/blacklist`), Turnstile (`lib/turnstile`), `auth.signUp` with
 * `account_type: 'vendor'` in the metadata the DB trigger reads, the V1 admin
 * auto-confirm, the welcome email, then a direct sign-in so nobody retypes the
 * password they chose ten seconds ago. What is NOT shared is the orchestration
 * itself — `app/signup/actions.ts` ends in `redirect()` and cannot be called for an
 * answer. When that action is next opened it should import THIS function for the
 * vendor case rather than keep its own copy; two copies of one door drift.
 *
 * ⚠ `email_confirm: true` is the standing V1 work-around (Supabase's own mailer lands
 * in spam). PR #5872 puts that flip behind `isEmailVerificationRequired`; when it
 * lands, the same gate belongs in front of the flip below.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { isEmailBlacklisted } from '@/lib/blacklist';
import { isPasswordLeaked } from '@/lib/leaked-password';
import { captchaOptions, captchaTokenFromForm } from '@/lib/turnstile';
import { OPEN_SHOP_ACCOUNT_ERRORS, signUpSaysEmailTaken } from './open-shop-account';

export type CreateVendorAccountResult =
  /** Signed in; `becomeVendor` continues as this user. */
  | { ok: true; user: { id: string; email: string } }
  /** Created and confirmed, but the direct sign-in failed — send them to /login?ready=. */
  | { ok: 'created-not-signed-in'; email: string }
  /** Refused, with the step that owns the field and the sentence to show. */
  | { ok: false; step: 3; error: string };

export async function createVendorAccountForShop(input: {
  email: string;
  password: string;
  /** The name typed on step 3, already title-cased — becomes `users.display_name`. */
  displayName: string | null;
  /** Recorded on the new `users` row: the agreement the person just made. */
  terms: { acceptedAt: string; version: string };
  /** The wizard's own FormData — for the Turnstile token. */
  formData: FormData;
}): Promise<CreateVendorAccountResult> {
  const { email, password, displayName, terms, formData } = input;

  // Same refusals as /signup, same sentences (OPEN_SHOP_ACCOUNT_ERRORS mirrors its
  // ERROR_COPY). The breach check fails OPEN when the service is unreachable — by
  // design, see lib/leaked-password.ts.
  if ((await isPasswordLeaked(password)).leaked) {
    return { ok: false, step: 3, error: OPEN_SHOP_ACCOUNT_ERRORS.passwordLeaked };
  }
  if (await isEmailBlacklisted(email)) {
    return { ok: false, step: 3, error: OPEN_SHOP_ACCOUNT_ERRORS.blacklisted };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent('/open-shop')}`,
      // The trigger reads raw_user_meta_data->>'account_type'. A shop owner is a
      // vendor from the first row — no later self-heal needed for this path.
      data: { account_type: 'vendor' },
      ...captchaOptions(captchaTokenFromForm(formData)),
    },
  });

  // "That email already has an account" — told to sign in, and what they typed stays
  // (the wizard keeps its state across the popup). Read from BOTH shapes Supabase
  // uses, because with enumeration protection on there is no error at all.
  if (signUpSaysEmailTaken({ error, identities: data?.user?.identities })) {
    return { ok: false, step: 3, error: OPEN_SHOP_ACCOUNT_ERRORS.emailTaken };
  }
  if (error || !data.user?.id) {
    console.warn('[open-shop] auth.signUp failed:', error?.message ?? 'no user returned');
    return { ok: false, step: 3, error: OPEN_SHOP_ACCOUNT_ERRORS.accountFailed };
  }
  const userId = data.user.id;

  let confirmed = false;
  try {
    const admin = createAdminClient();
    const profilePromise = (async () => {
      // The DB trigger that creates public.users runs on another connection; racing
      // it makes the UPDATE hit zero rows and drop the name silently. Poll briefly.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: row } = await admin.from('users').select('user_id').eq('user_id', userId).maybeSingle();
        if (row) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const { error: profileErr } = await admin
        .from('users')
        .update({
          ...(displayName ? { display_name: displayName } : {}),
          // Both columns together — a timestamp alone says somebody clicked, not
          // what they agreed to (lib/terms-agreement.ts).
          terms_accepted_at: terms.acceptedAt,
          terms_version: terms.version,
        })
        .eq('user_id', userId);
      if (profileErr) console.warn('[open-shop] profile (name/terms) update failed:', profileErr.message);
    })();

    const [confirmResult, profileResult, emailResult] = await Promise.allSettled([
      admin.auth.admin.updateUserById(userId, { email_confirm: true }),
      profilePromise,
      sendEmail({
        to: email,
        subject: 'Welcome to Setnayan',
        text: [
          `Welcome to Setnayan.`,
          ``,
          `Your vendor account is ready. Sign in here:`,
          `${appUrl}/login`,
          ``,
          `What's next:`,
          `• Open ${appUrl}/vendor-dashboard/shop and finish your business profile — couples find you on Setnayan and message you there.`,
          ``,
          `Need help? ${appUrl}/help`,
          ``,
          `—`,
          `Set na 'yan.`,
        ].join('\n'),
      }),
    ]);
    if (confirmResult.status === 'rejected') console.warn('[open-shop] updateUserById failed:', confirmResult.reason);
    if (profileResult.status === 'rejected') console.warn('[open-shop] profile IIFE threw:', profileResult.reason);
    if (emailResult.status === 'rejected') console.warn('[open-shop] welcome email failed:', emailResult.reason);
    confirmed = confirmResult.status === 'fulfilled';
  } catch (err) {
    console.warn('[open-shop] auto-confirm path threw:', err);
  }

  if (!confirmed) {
    // The account exists but is not confirmed; the direct sign-in would 401. Hand them
    // to the same "check your email" path /signup uses — never a dead end.
    return { ok: 'created-not-signed-in', email };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { ok: 'created-not-signed-in', email };
  return { ok: true, user: { id: userId, email } };
}
