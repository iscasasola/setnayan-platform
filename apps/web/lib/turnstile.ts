/**
 * Cloudflare Turnstile — shared, framework-agnostic helpers.
 *
 * WHY: Supabase Auth has a single, GLOBAL captcha switch. Once it's enabled in
 * the Supabase dashboard, GoTrue rejects EVERY password sign-in, sign-up, OTP,
 * and anonymous sign-in that doesn't carry a valid `captchaToken`. So enabling
 * it protects the anonymous-sign-in endpoint from bot abuse (the reason the
 * dashboard nags you to turn captcha on) — but it also means every one of OUR
 * auth calls must thread a token through, or that flow starts failing.
 *
 * This module is the ONE source of truth for the token plumbing:
 *   - `captchaOptions(token)` builds the `{ captchaToken }` fragment merged into
 *     a `supabase.auth.*` `options` object. An empty/undefined token yields `{}`
 *     — a STRICT no-op, identical to today's behavior.
 *   - `captchaTokenFromForm(fd)` reads the hidden `captcha_token` field that
 *     `<TurnstileField>` writes into every auth form.
 *
 * GRACEFUL-OFF INVARIANT (critical): with `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * unset, `<TurnstileField>` renders nothing, forms submit no token, and every
 * `captchaOptions()` call returns `{}`. The whole feature is therefore inert
 * until (a) the site key is set in the app AND (b) captcha is enabled in
 * Supabase. Shipping this code changes nothing until both are done — see
 * OWNER_ACTIONS.md for the safe activation order.
 *
 * NEXT_PUBLIC_ so the client widget and the server actions read the SAME key.
 * The Turnstile *secret* is never in the app — it lives only in Supabase's
 * captcha config, which is where GoTrue verifies the token.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

/** True once a site key is present. Used to conditionally render the widget. */
export function turnstileConfigured(): boolean {
  return TURNSTILE_SITE_KEY.length > 0;
}

/**
 * Build the `options.captchaToken` fragment for a `supabase.auth.*` call.
 * Spread it into an existing options object:
 *   supabase.auth.signUp({ email, password, options: { data, ...captchaOptions(token) } })
 * Empty/undefined token → `{}` → strict no-op (current behavior).
 */
export function captchaOptions(
  token: string | null | undefined,
): { captchaToken?: string } {
  const t = (token ?? '').trim();
  return t ? { captchaToken: t } : {};
}

/** Read the hidden `captcha_token` field `<TurnstileField>` writes into a form. */
export function captchaTokenFromForm(formData: FormData): string | undefined {
  const t = String(formData.get('captcha_token') ?? '').trim();
  return t || undefined;
}
