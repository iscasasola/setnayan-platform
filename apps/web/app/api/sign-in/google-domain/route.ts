import { NextResponse, type NextRequest } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { rateLimit } from '@/lib/rate-limit';
import { normalizeDomain } from '@/lib/google-address';
import { isGoogleMailDomain } from '@/lib/google-address.server';

/**
 * GET /api/sign-in/google-domain?domain=example.com → { google: boolean }
 *
 * Asked by the sign-in and sign-up cards (`GoogleAddressDoor`) while a person
 * types, so a Google Workspace address goes through the SAME Google door as the
 * "Continue with Google" button (owner 2026-10-18). gmail.com / googlemail.com
 * never reach here — the card knows those by name.
 *
 * 🔒 ONLY A DOMAIN. Never the address: the card strips everything before the @
 * (an address is personal data and does not belong in a URL). And the answer is
 * public DNS about the domain — it says nothing about any account, so this is
 * not an "is this email registered" oracle (lib/google-address.ts).
 *
 * A static route, not a server action: the action budget counts every export
 * (scripts/lint-server-action-budget.mjs). Cached at the edge per domain; a
 * best-effort per-IP cap blunts a scan. Fails closed to `false` — the ordinary
 * email + password form stays, which is today's behaviour.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const domain = normalizeDomain(new URL(request.url).searchParams.get('domain'));
  if (!domain) return NextResponse.json({ google: false }, { status: 400 });

  if (!rateLimit(`google-domain:${clientIp(request.headers) ?? 'unknown'}`, 30, 60_000).ok) {
    return NextResponse.json({ google: false }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const google = await isGoogleMailDomain(domain);
  return NextResponse.json(
    { google },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=21600' } },
  );
}
