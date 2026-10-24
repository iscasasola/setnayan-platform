/**
 * THE SWITCH ITSELF — the one decision `app/auth/accounts/switch/route.ts` makes, with the network handed in so a
 * test can hold it to its promises (`lib/account-jars.ts` for the jar design).
 *
 *   1. Refresh the TARGET's jar into a fresh session — and refuse unless its user IS the target (a jar is a cookie;
 *      a cookie can be swapped).
 *   2. Only then park the CURRENT session (its refresh token) — a failed switch leaves you exactly where you were.
 *   3. Write the target's session as the active one, and refuse unless what was written verifies as the target.
 *
 * After a successful switch every later request carries only the target's session: `auth.uid()` is the target in
 * every RLS check, and the previous account's credential lives only in its jar, sent to the account routes alone.
 */
import { parkInList, unparkFromList, type Jar, type ParkedAccount } from '@/lib/account-jars';

export type FreshSession = { uid: string; access: string; refresh: string };
export type CurrentSession = { uid: string; email: string; name: string | null; refresh: string };

export type SwitchDeps = {
  /** Exchange a parked refresh token for a fresh session (a client that stores nothing). */
  refresh: (refreshToken: string) => Promise<FreshSession | null>;
  /** The signed-in session (verified user + its refresh token), or null when nobody is signed in. */
  current: () => Promise<CurrentSession | null>;
  /** Make this the active session; answers the VERIFIED user id it now carries, or null. */
  activate: (s: { access: string; refresh: string }) => Promise<string | null>;
};

export type SwitchResult =
  | { ok: true; uid: string; park: Jar | null; list: ParkedAccount[] }
  | { ok: false; reason: 'no-jar' | 'expired' | 'not-the-target' | 'not-activated'; list: ParkedAccount[] };

export async function performSwitch(
  deps: SwitchDeps,
  input: { target: string; jar: Jar | null; list: readonly ParkedAccount[] },
): Promise<SwitchResult> {
  const target = input.target.toLowerCase();
  const dropTarget = unparkFromList(input.list, target);
  if (!input.jar || input.jar.uid !== target) return { ok: false, reason: 'no-jar', list: dropTarget };

  const fresh = await deps.refresh(input.jar.refresh);
  if (!fresh) return { ok: false, reason: 'expired', list: dropTarget };
  if (fresh.uid.toLowerCase() !== target) return { ok: false, reason: 'not-the-target', list: dropTarget };

  const current = await deps.current();
  const activated = await deps.activate({ access: fresh.access, refresh: fresh.refresh });
  if (!activated || activated.toLowerCase() !== target) {
    return { ok: false, reason: 'not-activated', list: [...input.list] };
  }

  let list = unparkFromList(input.list, target);
  let park: Jar | null = null;
  if (current && current.uid.toLowerCase() !== target) {
    park = { uid: current.uid.toLowerCase(), refresh: current.refresh };
    list = parkInList(list, { uid: park.uid, email: current.email, name: current.name }) ?? list;
  }
  return { ok: true, uid: target, park, list };
}
