import { envFlagEnabled } from '@/lib/env-flag';

/**
 * 📱 May a crew phone with NO account join by anonymous sign-in ("no account: first scan asks a name" — owner
 * 2026-10-29, controller call 3)? OFF until the owner switches it on in Vercel (`NEXT_PUBLIC_CREW_PASS_ANON_ENABLED`):
 * until then the crew phone is sent to sign in first, then lands back on the same QR. It is a switch and not a default
 * because anonymous sign-in must also be enabled in Supabase Auth — a flag that is on while Auth refuses would turn
 * every scan into an error. The Papic seat claim keeps its own switch (`papicSeatAnonEnabled`) for the same reason.
 */
export function crewPassAnonEnabled(): boolean {
  return envFlagEnabled(process.env.NEXT_PUBLIC_CREW_PASS_ANON_ENABLED);
}
