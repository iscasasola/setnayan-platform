import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { PASS_CARD_REFUSED, PASS_CARD_WORDS } from '@/lib/pass-card';
import { asPassCardRow, loadPassCardKit, readPassCardGuest } from '@/lib/pass-card.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { applePassJson, decideWalletPassAccess, walletPassContent } from '@/lib/wallet-pass';
import { buildPkpass, WalletSigningError } from '@/lib/wallet-pass-pkpass';
import {
  isWalletPassEnabled,
  readAppleWalletConfig,
  walletPassFactsFor,
  walletPassFileNameFor,
  walletPassImages,
} from '@/lib/wallet-pass.server';

/**
 * GET /api/guest/wallet/apple — the guest's OWN ticket as an Apple Wallet pass
 * (`application/vnd.apple.pkpass`). Plan of record:
 * controller-2026-10-12/WALLET_PASS_PLAN_2026-10-13.md, Phase A ("tap again to
 * update": the serial is stable, so a second add REPLACES the pass).
 *
 * 🔒 WHO — the signed guest session (`setnayan_guest_session`, httpOnly — the
 * credential /api/guest/pass-card trusts), for ITSELF only. Nothing in the
 * address names anybody: no `?guest=`, no token, no slug. No host, no plus-one
 * (`decideWalletPassAccess`). Every refusal after sign-in is the PNG's ONE 404.
 *
 * 🚦 OFF unless `WALLET_PASS_ENABLED` is on AND every Apple value is present —
 * then the same 404 as "no ticket here", so the route says nothing about the
 * set-up. A value that is present but unreadable is a 503 whose log line names
 * the STEP (`WalletSigningError`), never a value.
 *
 * `private, no-store` — the code on the pass signs its holder in.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  if (!isWalletPassEnabled()) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });
  const config = readAppleWalletConfig();
  if (!config.ok) {
    // Names only — which variables are absent, never what any of them hold.
    logQueryError('wallet-pass.apple.config', 'missing', { missing: config.missing }, 'graceful_degrade');
    return new NextResponse(PASS_CARD_REFUSED, { status: 404 });
  }

  const session = await readGuestSession();
  if (!session?.guest_id) return new NextResponse('Open your invitation link first.', { status: 401 });

  const admin = createAdminClient();
  const { target, bringer, failed } = await readPassCardGuest(admin, session.guest_id);
  const verdict = decideWalletPassAccess({
    session,
    target: target ? asPassCardRow(target) : null,
    bringer: bringer ? asPassCardRow(bringer) : null,
    readFailed: failed,
  });
  if (!verdict.allow) return new NextResponse(verdict.message, { status: verdict.status });
  if (!target) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  const kit = await loadPassCardKit(admin, target.event_id, { seatsFor: [target.guest_id] });
  const facts = kit ? walletPassFactsFor(kit, target) : null;
  if (!kit || !facts) return new NextResponse(PASS_CARD_REFUSED, { status: 404 });

  try {
    const pass = applePassJson(walletPassContent(facts), config.ids);
    const pkpass = await buildPkpass(pass, await walletPassImages(kit), config.signer);
    return new NextResponse(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${walletPassFileNameFor(kit, target)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    // 🔒 A signing failure is logged by its STEP only; anything else by its name.
    const step = err instanceof WalletSigningError ? err.step : err instanceof Error ? err.name : 'unknown';
    logQueryError('wallet-pass.apple.build', step, { guest_id: target.guest_id }, 'graceful_degrade');
    return new NextResponse(`Could not make your Wallet ${PASS_CARD_WORDS.noun} just now. Try again.`, { status: 503 });
  }
}
