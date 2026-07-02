'use server';

import { after } from 'next/server';
import {
  createDemoSession,
  markDemoSessionJoined,
  purgeExpiredDemoSessions,
  resolveDemoToken,
  type DemoKind,
  type DemoRole,
} from '@/lib/demo-sessions';
import { renderUrlQrSvg } from '@/lib/qr';

/**
 * Server actions behind the homepage dock-tile live demos (Papic today —
 * `PapicDemoOverlay`). Kept in `app/_actions/` (not `app/papic/actions.ts`)
 * because this is homepage-owned plumbing, not part of the real Papic
 * product surface — a demo session is never a real event, seat, or guest.
 */

export type DemoQrPair = {
  sessionId: string;
  demoKind: DemoKind;
  expiresAt: string;
  /** Inline SVG markup, pre-rendered server-side — same renderer + palette as every other Setnayan QR. */
  qrSvgA: string;
  qrSvgB: string;
};

/** Mints a fresh session + renders both QR codes. Called every time the demo overlay opens — tokens are NEVER reused. */
export async function startDemoSession(demoKind: DemoKind, appUrl: string): Promise<DemoQrPair> {
  const session = await createDemoSession(demoKind);
  const joinPath = demoKind === 'papic' ? '/papic/demo' : `/${demoKind}/demo`;
  const [qrSvgA, qrSvgB] = await Promise.all([
    renderUrlQrSvg(`${appUrl}${joinPath}/${session.tokenA}`, 220),
    renderUrlQrSvg(`${appUrl}${joinPath}/${session.tokenB}`, 220),
  ]);

  // Piggyback cleanup of long-expired rows on real traffic instead of a
  // polling cron (project convention) — fires after the response is sent.
  after(() => purgeExpiredDemoSessions());

  return { sessionId: session.id, demoKind: session.demoKind, expiresAt: session.expiresAt, qrSvgA, qrSvgB };
}

export type JoinDemoResult =
  | { ok: true; sessionId: string; demoKind: DemoKind; role: DemoRole }
  | { ok: false; reason: 'expired_or_invalid' };

/** Resolves a scanned demo QR token and marks that side joined. */
export async function joinDemoSession(token: string): Promise<JoinDemoResult> {
  const clean = token?.trim();
  const resolved = clean ? await resolveDemoToken(clean) : null;
  after(() => purgeExpiredDemoSessions());
  if (!resolved) return { ok: false, reason: 'expired_or_invalid' };
  await markDemoSessionJoined(resolved.sessionId, resolved.role);
  return { ok: true, sessionId: resolved.sessionId, demoKind: resolved.demoKind, role: resolved.role };
}
