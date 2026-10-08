import 'server-only';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { isPabuyaPublicRouteEnabled } from '@/lib/egift';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import { recordGift } from '@/lib/gift-record.server';
import { GIFT_NOT_ACCEPTING, GIFT_NOT_KEPT, GIFT_NOT_RECOGNISED, GIFT_SHOT_REFUSED, GIFT_TOO_FAST } from '@/lib/gift-record';
import { R2_BUCKETS, isR2Configured } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import { encodeR2Ref, presignUploadUrl } from '@/lib/uploads';
import { enforceRateLimit } from '@/lib/with-rate-limit';

/**
 * apps/web/lib/gift-door.server.ts (server-only)
 *
 * THE GUEST'S TWO GIFT REQUESTS, behind the guest upload route
 * (`POST /api/guest-selfie`, `purpose: 'gift-shot' | 'gift-record'`) — owner
 * 2026-10-08, E-Gifts › "I sent it".
 *
 * ── WHY IT RIDES THAT ROUTE ────────────────────────────────────────────────
 * The design puts the screenshot on "the guest-selfie presign route (own prefix
 * `gift-shots/<event>/`)", and every route file is one Vercel route against a
 * hard ceiling (`scripts/lint-server-action-budget.mjs`, `check-vercel-route-count.mjs`).
 * So both of a guest's gift requests go through the ONE guest-session door that
 * already ships: +0 routes, +0 server actions. A request with no `purpose` is
 * the RSVP selfie, exactly as before.
 *
 * ── WHO IS ASKING ──────────────────────────────────────────────────────────
 * `readGuestSessionForEvent(eventId)` — the RSVP's own identity read (this
 * browser's invitation for THIS event, or the signed-in account's own seat at
 * it). No new token. `eventId` comes from the body, but it cannot widen
 * anything: the read answers only for a guest OF that event.
 *
 * Every refusal is returned in words (`{ error }`) for the sheet to say in
 * place. Fails CLOSED: no session, gifts off, an unreadable check, a limiter
 * refusal — none of them writes.
 */

const MAX_SHOT_BYTES = 8 * 1024 * 1024; // the guest upload route's own ceiling
const SHOT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Per guest: 10 records and 20 screenshot uploads in ten minutes — far past a person, well short of a script. */
const RECORD_LIMIT = { limit: 10, windowSecs: 600 };
const SHOT_LIMIT = { limit: 20, windowSecs: 600 };

export type GiftPurpose = 'gift-shot' | 'gift-record';

export function giftPurposeOf(body: unknown): GiftPurpose | null {
  const p = (body as { purpose?: unknown } | null)?.purpose;
  return p === 'gift-shot' || p === 'gift-record' ? p : null;
}

const said = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function giftDoor(purpose: GiftPurpose, body: Record<string, unknown>): Promise<NextResponse> {
  /* The gift page's own rollout switch: no page, no door. */
  if (!isPabuyaPublicRouteEnabled()) return said(GIFT_NOT_ACCEPTING, 404);

  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  if (!UUID.test(eventId)) return said(GIFT_NOT_KEPT, 400);

  const session = await readGuestSessionForEvent(eventId);
  if (!session) return said(GIFT_NOT_RECOGNISED, 401);

  if (purpose === 'gift-shot') {
    if (!isR2Configured()) return said(GIFT_SHOT_REFUSED, 503);
    const contentType = typeof body.contentType === 'string' ? body.contentType : '';
    const baseType = contentType.split(';')[0]?.trim() ?? '';
    const sizeBytes = typeof body.sizeBytes === 'number' ? body.sizeBytes : NaN;
    if (!SHOT_MIME.has(baseType)) return said('Add a picture — a JPEG, PNG or WebP screenshot.', 400);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return said(GIFT_SHOT_REFUSED, 400);
    if (sizeBytes > MAX_SHOT_BYTES) return said(`That picture is too large — keep it under ${MAX_SHOT_BYTES / 1024 / 1024} MB.`, 413);

    const burst = await enforceRateLimit('gift_shot', session.guest_id, SHOT_LIMIT);
    if (!burst.ok) return said(GIFT_TOO_FAST, 429);

    /* PRIVATE bucket, own root, THIS guest's folder — minted here from the session, never
       chosen by the browser (`giftShotPolicy` is what the record write then holds it to). */
    const ext = baseType === 'image/png' ? 'png' : baseType === 'image/webp' ? 'webp' : 'jpg';
    const bucket = R2_BUCKETS.threadFiles;
    const key = `gift-shots/${session.event_id}/${session.guest_id}/${randomUUID()}.${ext}`;
    try {
      const uploadUrl = await presignUploadUrl({ bucket, key, contentType, sizeBytes });
      return NextResponse.json({ uploadUrl, r2Ref: encodeR2Ref(bucket, key) }, { status: 200 });
    } catch (err) {
      Sentry.captureException(err, { tags: { route: 'api/guest-selfie', purpose }, extra: { event_id: session.event_id } });
      return said(GIFT_SHOT_REFUSED, 500);
    }
  }

  const burst = await enforceRateLimit('gift_record', session.guest_id, RECORD_LIMIT);
  if (!burst.ok) return said(GIFT_TOO_FAST, 429);

  let result: Awaited<ReturnType<typeof recordGift>>;
  try {
    result = await recordGift(createAdminClient(), session, eventId, {
      wishId: body.wishId,
      amount: body.amount,
      message: body.message,
      name: body.name,
      shotRef: body.shotRef,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'api/guest-selfie', purpose }, extra: { event_id: eventId } });
    return said(GIFT_NOT_KEPT, 500);
  }
  if (!result.ok) return said(result.error, 422);

  /* The guest's pages show the new sum (and a wish that reached its price) on their next read. */
  if (result.slug) {
    revalidatePath(`/${result.slug}/pabuya`);
    revalidatePath(`/${result.slug}`);
  }
  const { slug: _slug, ...shown } = result;
  void _slug;
  return NextResponse.json(shown, { status: 200 });
}
