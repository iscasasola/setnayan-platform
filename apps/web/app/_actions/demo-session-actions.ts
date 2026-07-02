'use server';

import { after } from 'next/server';
import {
  claimDemoCamSlot,
  createDemoSession,
  incrementDemoShot,
  markDemoSessionJoined,
  purgeExpiredDemoSessions,
  resolveDemoToken,
  type DemoKind,
  type DemoRole,
  type DemoShotResult,
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

/**
 * Record one shot against the session's 3-per-session cap (PR-2). Token-gated
 * exactly like joining — only a phone holding a live QR token can count a
 * shot. The frame itself never reaches the server (peer-to-peer relay only).
 */
export async function recordDemoShot(token: string): Promise<DemoShotResult> {
  const clean = token?.trim();
  const result = clean ? await incrementDemoShot(clean) : ({ ok: false, reason: 'expired_or_invalid' } as const);
  after(() => purgeExpiredDemoSessions());
  return result;
}

export type ClaimCamResult =
  | { ok: true; sessionId: string; slot: DemoRole }
  | { ok: false; reason: 'expired_or_invalid' | 'full' };

/**
 * Live Studio demo: both phones scan the SAME QR, so the camera slot is
 * assigned by claim order, not by which token was scanned (owner spec,
 * DECISION_LOG 2026-07-03). Called from the phone page right before it starts
 * publishing — after the visitor granted the camera, so a scan that never
 * gets that far doesn't burn a slot.
 */
export async function claimPanoodDemoCamera(token: string): Promise<ClaimCamResult> {
  const clean = token?.trim();
  const resolved = clean ? await resolveDemoToken(clean) : null;
  after(() => purgeExpiredDemoSessions());
  if (!resolved || resolved.demoKind !== 'panood') return { ok: false, reason: 'expired_or_invalid' };
  const slot = await claimDemoCamSlot(resolved.sessionId);
  if (!slot) return { ok: false, reason: 'full' };
  return { ok: true, sessionId: resolved.sessionId, slot };
}

// ── 3D Plan demo (owner spec, DECISION_LOG 2026-07-03) ──────────────────────

export type Plan3dDemoStart = { sessionId: string; token: string; expiresAt: string };

/** Mint the 3D Plan demo session (fresh on every overlay open; QR renders per guest click). */
export async function startPlan3dDemo(): Promise<Plan3dDemoStart> {
  const session = await createDemoSession('3d_plan');
  after(() => purgeExpiredDemoSessions());
  return { sessionId: session.id, token: session.tokenA, expiresAt: session.expiresAt };
}

export type Plan3dGuestQrResult = { ok: true; svg: string } | { ok: false };

/**
 * Render the QR for one clicked guest — the join URL carries the guest id, so
 * the phone opens the room AS that person ("the click on a person shows qr",
 * owner). Token-validated; the guest id is allowlisted against the fictional
 * demo roster (it's cosmetic — every guest is sample data).
 */
export async function renderPlan3dGuestQr(
  appUrl: string,
  token: string,
  guestId: string,
): Promise<Plan3dGuestQrResult> {
  const clean = token?.trim();
  const resolved = clean ? await resolveDemoToken(clean) : null;
  if (!resolved || resolved.demoKind !== '3d_plan') return { ok: false };
  const { plan3dGuestById } = await import('@/app/_components/home/plan3d-demo-scene');
  if (!plan3dGuestById(guestId)) return { ok: false };
  const svg = await renderUrlQrSvg(`${appUrl}/3d_plan/demo/${clean}?g=${encodeURIComponent(guestId)}`, 200);
  return { ok: true, svg };
}
