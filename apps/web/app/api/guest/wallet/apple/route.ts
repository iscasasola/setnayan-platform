import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { PASS_CARD_REFUSED, PASS_CARD_WORDS } from '@/lib/pass-card';
import { asPassCardRow, loadPassCardKit, readPassCardGuest } from '@/lib/pass-card.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { applePassJson, decideWalletPassAccess, walletBackPath, walletNoticeHtml, walletPassContent } from '@/lib/wallet-pass';
import { buildPkpass, WalletSigningError } from '@/lib/wallet-pass-pkpass';
import { readAppleWalletConfig } from '@/lib/wallet-pass-config.server';
import { walletPassFactsFor, walletPassFileNameFor, walletPassImages } from '@/lib/wallet-pass.server';

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
 * 🍎 ON FOR EVERYONE (owner 2026-10-25 — no switch, no `is_internal`). The
 * page draws the button only while the set can sign (`appleWalletOffered`). If
 * a pass still cannot be made here — a value missing, or signing failing — the
 * guest gets a small PAGE that says so in words ("Couldn't make your Wallet
 * pass — Save my ticket instead") with the way back, never a broken download.
 * Its log line names the STEP (`WalletSigningError`) or the missing NAMES,
 * never a value.
 *
 * `private, no-store` — the code on the pass signs its holder in.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const config = readAppleWalletConfig();
  if (!config.ok) {
    // Names only — which variables are absent, never what any of them hold.
    logQueryError('wallet-pass.apple.config', 'missing', { missing: config.missing }, 'graceful_degrade');
    return couldNotMakeIt(request);
  }

  const session = await readGuestSession();
  if (!session?.guest_id) {
    // 🔑 SIGNED OUT ON THIS PHONE (owner 2026-10-25) — the same words and the same ONE way back in as "Save my ticket"
    // (#6910): back to the Event Hub path they pressed from, which then shows its own sign-in door. Never bare text.
    return walletNotice(request, 401, {
      line: PASS_CARD_WORDS.walletSignedOut,
      why: PASS_CARD_WORDS.walletGetBackInWhy,
      button: PASS_CARD_WORDS.walletGetBackIn,
    });
  }

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
    return couldNotMakeIt(request);
  }
}

/** 🗣 THE HONEST FAILURE — a page, not a file: says it in words, and hands them back to "Save my ticket". */
function couldNotMakeIt(request: Request): NextResponse {
  return walletNotice(request, 503, { line: PASS_CARD_WORDS.walletFailed, button: PASS_CARD_WORDS.saveOwn });
}

/** The route's small page (`walletNoticeHtml`), its one button to the page the guest came from (`walletBackPath`). */
function walletNotice(request: Request, status: number, n: { line: string; button: string; why?: string }): NextResponse {
  const href = walletBackPath(request.headers.get('referer'), request.url);
  return new NextResponse(walletNoticeHtml({ ...n, href }), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}
