'use server';

/**
 * 📱 THE CREW PHONE'S ACTION (owner 2026-10-29, DECISION_LOG "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE
 * ONLY THE EVENT HUB"). Thin: every rule is the database's.
 *
 *   · `joinCrew` — "no account: first scan asks a name". A phone with no session gets an ANONYMOUS one (the shipped
 *     Papic seat-claim pattern, `app/papic/actions.ts`), behind its own switch (`crewPassAnonEnabled`, OFF until the
 *     owner turns it on — then the phone signs in instead), and asks `crew_pass_request` to put it on the shop's Allow
 *     list. It is never allowed by this; it waits.
 *   · the crew's scanner is NOT here: it is the shipped seat lookup (`floorSeatByQr(…, 'crew')`), which asks
 *     `crew_seat_by_guest_qr` — ONE table label only for a phone the shop allowed, on its own event, before the pass
 *     ends, under the coordinator scanner's own gates. (Every export is a route; the budget is shared.)
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { captchaOptions, captchaTokenFromForm, isCaptchaRefusal } from '@/lib/turnstile';
import { crewJoinPath, isCrewToken } from '@/lib/crew-pass';
import { crewPassAnonEnabled } from '@/lib/crew-pass-flag';

export async function joinCrew(formData: FormData): Promise<void> {
  const raw = formData.get('token');
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!isCrewToken(token)) redirect('/');
  const name = String(formData.get('name') ?? '').trim().slice(0, 60);
  const back = crewJoinPath(token);
  if (!name) redirect(`${back}?state=name`);

  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (!crewPassAnonEnabled()) redirect(`/login?next=${encodeURIComponent(back)}`);
    const { data: anon, error } = await supabase.auth.signInAnonymously({
      options: captchaOptions(captchaTokenFromForm(formData)),
    });
    if (error || !anon.user) redirect(`${back}?state=${isCaptchaRefusal(error) ? 'verify' : 'error'}`);
    user = anon.user;
  }

  const { error } = await supabase.rpc('crew_pass_request', { p_token: token, p_name: name });
  if (error) redirect(`${back}?state=error`);
  redirect(back);
}
