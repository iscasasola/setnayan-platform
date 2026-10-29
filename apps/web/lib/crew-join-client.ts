import type { SupabaseClient } from '@supabase/supabase-js';
import { captchaOptions, isCaptchaRefusal } from '@/lib/turnstile';

/**
 * 📱 A crew phone asks to join a shop's crew (owner 2026-10-29). In the browser, on purpose — no server action (every
 * export is a Vercel route and the budget is at its ceiling): a phone with no session signs in ANONYMOUSLY with the
 * captcha token its caller minted on the same tap (`mintTurnstileToken`, inert until captcha is on), then asks
 * `crew_pass_request` — the database's one door (a live QR, a booked shop, a name, nobody let in).
 */
export async function askToJoinCrew(
  supabase: SupabaseClient,
  { token, name, anonymous, captchaToken }: { token: string; name: string; anonymous: boolean; captchaToken: string | undefined },
): Promise<'asked' | 'sign-in' | 'verify' | 'error'> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    if (!anonymous) return 'sign-in';
    const { error } = await supabase.auth.signInAnonymously({ options: captchaOptions(captchaToken) });
    if (error) return isCaptchaRefusal(error) ? 'verify' : 'error';
  }
  const { error } = await supabase.rpc('crew_pass_request', { p_token: token, p_name: name });
  return error ? 'error' : 'asked';
}
