'use server';

/**
 * The PAID render path for Mood Board section 04 (MB8).
 *
 * MB2 built the money substrate, MB7 built the free surface with a simulated
 * "Generate". This file is the wire between them: one credit becomes one
 * photograph, or nothing happens and the couple is told so.
 *
 * ── THE ORDER OF OPERATIONS IS THE WHOLE DESIGN ───────────────────────────
 *   1. read the config (never assume 1/5 — an assumed cost is a charge nobody
 *      authorised)
 *   2. `moodboard_begin_render` — the debit AND the in-flight row, atomically.
 *      NULL here means the event cannot pay; we return `insufficient` and the
 *      surface offers the pack.
 *   3. call the model
 *   4. on an image: upload to R2, then `moodboard_finish_render`
 *   5. on ANYTHING else: `moodboard_fail_render`, which marks the row failed
 *      AND hands the credits back in one transaction, and return the failure
 *      code so the tile says what happened
 *
 * 🔑 STEP 5 HAS NO `catch {}` THAT SWALLOWS. Every exit from this action is
 * either an image or a named failure. There is no path that returns success
 * with no image, and no path that returns "" or `null` for a caller to
 * misread — the return type is a discriminated union and the failure branches
 * carry a `code` that `RENDER_FAILURE_COPY` turns into words.
 *
 * ⚠ AND STEP 4's UPLOAD IS INSIDE THE FAILURE NET. An image the model produced
 * but that we could not STORE is still a render the couple cannot see, so it
 * refunds like any other failure. Getting this wrong would be the meanest
 * version of the bug: the render genuinely happened, the money is genuinely
 * gone, and the tile is genuinely empty.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { r2Upload, r2SignedGet, R2_BUCKETS, isR2Configured } from '@/lib/r2';
import { RENDER_BUCKET_KEY } from '@/lib/bucket-routing';
import { safeFetchImageBytes } from '@/lib/safe-image-fetch';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { sanitizeReceptionDesign, renderVenueSvg } from '@/lib/reception-scene';
import { readMoodboardRenderConfig } from '@/lib/moodboard-render-credits';
import {
  creditsForPart,
  isRenderPartId,
  inspirationSlotsForPart,
} from '@/lib/moodboard-render-parts';
import { buildRenderPrompt, renderConfigDigest } from '@/lib/moodboard-render-prompt';
import {
  generateRenderImage,
  sniffImageMime,
  MAX_REFERENCE_IMAGES,
  type ReferenceImage,
  type RenderFailureCode,
} from '@/lib/gemini-image';
import { buildGalleryCopy } from '@/lib/moodboard-gallery-copy';

/**
 * What the tile gets back. Three outcomes, all of them visible:
 *   · `rendered` — there is an image, here is its URL
 *   · `insufficient` — no credits; the surface offers the pack. NOT a failure
 *     of the render, and deliberately a separate branch so it never shows the
 *     couple an error about our provider when the answer is "buy a pack".
 *   · `failed` — a named code. The credit is back.
 */
export type RenderActionResult =
  /**
   * `imageUrl` is nullable: the photo exists and is the couple's, but the
   * short-lived viewing link is minted separately and can fail on its own.
   * A null URL means "saved, reload to see it" — never "no render happened".
   */
  | { status: 'rendered'; renderId: string; imageUrl: string | null; creditsLeft: number | null }
  | { status: 'insufficient'; creditsNeeded: number; creditsLeft: number | null }
  | { status: 'failed'; code: RenderFailureCode | 'unavailable'; renderId: string | null };

/**
 * Where a render's bytes live: `renders/<eventId>/<renderId>.<ext>` in the
 * PRIVATE bucket.
 *
 * 🔒 `threadFiles`, not `media`. `media` is the public bucket — anything in it
 * is readable by URL by anyone who has one. A render is the couple's own
 * creation and stays theirs until an admin features it, which is gated on
 * their explicit consent; a public object key would hand that decision to
 * whoever found the link. Read back only through short-lived presigned GETs,
 * the same posture as the payment proofs. `bucket-routing.ts` carries the
 * matching prefix rule so this cannot regress by omission.
 */
function renderObjectKey(eventId: string, renderId: string, mimeType: string): string {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
  return `renders/${eventId}/${renderId}.${ext}`;
}

// The private bucket every render is written to and read back from. NOT
// exported: a 'use server' file may export only async functions. The key
// itself lives in lib/bucket-routing.ts, beside the `renders/` prefix rule.
const RENDER_BUCKET = R2_BUCKETS[RENDER_BUCKET_KEY];

/**
 * Make one render.
 *
 * `partId` is validated against the DERIVED registry (`isRenderPartId`), not a
 * list here — so a new zone becomes renderable with no edit to this file, and
 * a bogus part id cannot reach the `event_renders` CHECK as a raw string.
 */
export async function requestRender(args: {
  eventId: string;
  partId: string;
  note?: string | null;
}): Promise<RenderActionResult> {
  const { eventId, partId } = args;

  if (!isRenderPartId(partId)) {
    return { status: 'failed', code: 'unavailable', renderId: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ---- 1. the board, and what a render costs -------------------------------
  //
  // Read server-side rather than trusted from the client: the prompt, the
  // snapshot and the digest are what the couple is charged for, and a
  // client-supplied design would let a page state one board and bill for
  // another.
  const [{ data: event }, config] = await Promise.all([
    supabase
      .from('events')
      .select('role_palette, reception_design, venue_setting')
      .eq('event_id', eventId)
      .maybeSingle(),
    readMoodboardRenderConfig(supabase),
  ]);

  // `config === null` is a REFUSED or inactive read, and MB2's contract is
  // explicit that a caller must then say "unavailable" rather than assume
  // 1/5/50. Nothing is debited on this branch because nothing was begun.
  if (!config || !event) {
    return { status: 'failed', code: 'unavailable', renderId: null };
  }

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const design = sanitizeReceptionDesign(event.reception_design);
  const reception = palette.reception ?? [];
  const venueSetting = (event as { venue_setting?: string | null }).venue_setting ?? null;
  // The same shape the concept PDF and the scene SVG already use, so the
  // render, the PDF and the on-screen room cannot disagree about attire.
  const roleColors = {
    bride: palette.bride?.[0],
    groom: palette.groom?.[0],
    party: palette.wedding_party?.[0],
    guest: palette.guest?.[0],
    guestPalette: palette.guest ?? [],
  };

  const credits = creditsForPart(partId, config);
  const prompt = buildRenderPrompt({
    partId,
    design,
    palette: reception,
    roleColors,
    venue: { setting: venueSetting, chosen: Boolean(venueSetting) },
    note: args.note,
    maxNoteChars: config.maxNoteChars,
  });
  const digest = renderConfigDigest({ partId, design, palette: reception, venueSetting });

  // ---- the couple's own reference photos for THIS part ---------------------
  //
  // `inspirationSlotsForPart` is the derived join (SLOT_ROLE in the registry),
  // so a room zone gets the slots that alias it and a place gets its own —
  // and a part with no category of its own falls back to the overall vibe,
  // matching the gate MB7 already shows the couple.
  const wantedSlots = inspirationSlotsForPart(partId);
  const slotFilter = wantedSlots.length > 0 ? wantedSlots : ['overall'];
  // `inspiration_id`, NOT `asset_id` — the PK of event_inspiration_assets
  // (migration 20260625000000). Selecting a column that does not exist returns
  // a PostgREST error and `data: null`, which would have degraded every render
  // to "no reference photos" SILENTLY: the couple's uploads would stop
  // conditioning the image, `inspiration_asset_ids` would store an empty array,
  // and the render would still arrive looking like a success. Caught by
  // reading the migration rather than by any test — the fallback `?? []` is
  // exactly what would have hidden it.
  const { data: inspirationRows, error: inspirationError } = await supabase
    .from('event_inspiration_assets')
    .select('inspiration_id, image_url')
    .eq('event_id', eventId)
    .in('slot_key', partId === 'whole_look' ? ['overall'] : slotFilter)
    .is('removed_at', null)
    .limit(MAX_REFERENCE_IMAGES);

  // A FAILED read of the couple's references is not the same as their having
  // none, and it must not quietly produce a weaker render they still pay for.
  // Nothing has been debited at this point, so refusing costs them nothing.
  if (inspirationError) {
    return { status: 'failed', code: 'unavailable', renderId: null };
  }
  const inspirationAssetIds = (inspirationRows ?? [])
    .map((r) => (r as { inspiration_id: string }).inspiration_id)
    .filter(Boolean);

  // ---- 2. THE WELD: debit and row, together or not at all ------------------
  const { data: beganId, error: beginError } = await supabase.rpc('moodboard_begin_render', {
    p_event_id: eventId,
    p_part_id: partId,
    p_prompt: prompt,
    p_design_snapshot: {
      role_palette: palette,
      reception_design: design,
      venue_setting: venueSetting,
    },
    p_config_digest: digest,
    p_credits: credits,
    p_note: args.note ?? null,
    p_inspiration_asset_ids: inspirationAssetIds,
  });

  if (beginError) {
    return { status: 'failed', code: 'unavailable', renderId: null };
  }
  const renderId = typeof beganId === 'string' ? beganId : null;
  if (!renderId) {
    // NULL from `begin_render` = could not pay, or may not act. Either way
    // NOTHING was debited and no row exists — the function returns before the
    // INSERT. Offer the pack.
    return {
      status: 'insufficient',
      creditsNeeded: credits,
      creditsLeft: await readBalanceLeft(supabase, eventId),
    };
  }

  // From here on the credit IS SPENT and a row EXISTS. Every exit below either
  // finishes that row or fails it — `fail` is what returns the credit, so
  // there is no early `return` past this point that skips it.
  const fail = async (code: RenderFailureCode | 'unavailable', detail: string) => {
    // Best-effort, and its own failure is not allowed to hide the original
    // one: if the refund RPC itself errors, the couple still sees the failure
    // (and the in-flight row is left for the stalled-render read to surface),
    // rather than a success.
    await supabase
      .rpc('moodboard_fail_render', { p_render_id: renderId, p_reason: `${code}: ${detail}` })
      .then(
        () => undefined,
        () => undefined,
      );
    revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
    return { status: 'failed' as const, code, renderId };
  };

  // ---- 3. the model -------------------------------------------------------
  const sceneSvg = (() => {
    try {
      return renderVenueSvg(design, reception, roleColors);
    } catch {
      // The structure reference is an ENHANCEMENT; a brief without it still
      // describes the room in words. Losing it must not cost the render.
      return null;
    }
  })();

  const references: ReferenceImage[] = [];
  for (const row of inspirationRows ?? []) {
    const url = (row as { image_url?: string | null }).image_url;
    if (!url) continue;
    const bytes = await safeFetchImageBytes(url);
    // The type is SNIFFED from the bytes, not assumed: `safeFetchImageBytes`
    // discards the content-type, and declaring image/jpeg over PNG bytes is a
    // mismatch a provider can reject — which would fail every render for any
    // couple whose uploads are PNG, visibly but for the wrong stated reason.
    if (bytes) references.push({ bytes, mimeType: sniffImageMime(bytes) });
  }

  const image = await generateRenderImage({ prompt, sceneSvg, references });
  if (!image.ok) {
    return fail(image.code, image.detail);
  }

  // ---- 4. store it, THEN mark it done -------------------------------------
  //
  // Order matters: `finish_render` attaches the key, so writing the row first
  // would advertise an object that might not exist. A key in the database with
  // nothing behind it is a broken image on a tile the couple paid for.
  if (!isR2Configured()) {
    // An image we cannot keep is an image the couple cannot see. Refund.
    return fail('unavailable', 'R2 is not configured in this environment');
  }
  const key = renderObjectKey(eventId, renderId, image.mimeType);
  try {
    await r2Upload({
      bucket: RENDER_BUCKET,
      key,
      body: image.bytes,
      contentType: image.mimeType,
    });
  } catch (err) {
    return fail('unavailable', err instanceof Error ? err.message : 'upload failed');
  }

  const { data: finished, error: finishError } = await supabase.rpc('moodboard_finish_render', {
    p_render_id: renderId,
    p_image_key: key,
  });
  if (finishError || finished !== true) {
    // The bytes are in R2 but the row would not accept them, so no reader can
    // ever find this image. That is a failed render from the couple's side and
    // is refunded as one.
    return fail('unavailable', finishError?.message ?? 'the render row would not accept the image');
  }

  // ---- 4b. THE WATERMARKED GALLERY COPY (MB9) ------------------------------
  //
  // A SECOND OBJECT, at a key that is not the couple's, holding bytes that are
  // not the couple's. `buildGalleryCopy` returns the key and the marked bytes
  // together precisely so this call site cannot pair a `render-gallery/` key
  // with unmarked bytes — and `image_key` above was written from
  // `image.bytes`, which never passes through the marker. That is the whole
  // "we did not deface what they paid for" guarantee, and it is structural.
  //
  // ⚠ EVERY FAILURE HERE IS SWALLOWED, AND THAT IS THE CORRECT DIRECTION.
  // The render succeeded; the couple has their photograph. A gallery copy that
  // could not be made simply means this render is not in the pool — a render
  // with no `gallery_image_key` is not in the pool's partial index at all.
  // Routing this through `fail` would refund and mark-failed a render that was
  // delivered, which is the meanest possible reading of "the watermark step
  // broke".
  try {
    const gallery = await buildGalleryCopy({ eventId, renderId, bytes: image.bytes });
    await r2Upload({
      bucket: RENDER_BUCKET,
      key: gallery.key,
      body: gallery.bytes,
      contentType: gallery.contentType,
    });
    await supabase
      .rpc('moodboard_attach_gallery_copy', {
        p_render_id: renderId,
        p_gallery_image_key: gallery.key,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch (err) {
    // 🪤 NOT A BARE SWALLOW — `moodboard-render-failure-reaches-the-box.test.ts`
    // forbids one in this file, and it is right to: a `catch {}` here is the
    // literal mechanism of the disease this whole arc is about.
    //
    // The couple is unaffected and must stay so; what is lost is only pool
    // eligibility, and that IS recorded — a row with an `image_key` and a NULL
    // `gallery_image_key` is exactly the population of renders that never got
    // marked, findable with one query. The line below names the reason the row
    // alone cannot.
    console.warn(
      `[mb9] render ${renderId} has no gallery copy and will not enter the inspiration pool:`,
      err instanceof Error ? err.message : err,
    );
  }

  // A short-lived presigned GET, minted here so the tile can show the photo
  // the instant it exists. The object itself stays private — see RENDER_BUCKET.
  //
  // ⚠ A FAILURE HERE IS NOT A FAILED RENDER, AND MUST NOT REFUND. The image
  // exists, it is stored, and `finish_render` has already accepted it — the
  // couple OWNS it. Only the viewing link failed, and the gallery mints a
  // fresh one on the next page load. Routing this through `fail` would take
  // back a render they now have, and mark a delivered row as failed. So
  // `imageUrl` is nullable and the tile says "saved — reload to see it",
  // which is the true statement.
  let imageUrl: string | null = null;
  try {
    imageUrl = await r2SignedGet({ bucket: RENDER_BUCKET, key, expiresIn: 60 * 60 });
  } catch {
    imageUrl = null;
  }

  revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  return {
    status: 'rendered',
    renderId,
    imageUrl,
    creditsLeft: await readBalanceLeft(supabase, eventId),
  };
}

/**
 * The balance after the fact, for the surface's counter.
 *
 * `null` means the read was refused — MB2's contract — and the surface shows
 * "not available", never a fabricated zero. The couple's counter must never
 * read 0 because a read failed; that is the guest-list bug with a number.
 */
async function readBalanceLeft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('moodboard_render_balance', { p_event_id: eventId });
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { credits_left?: number };
  return typeof row.credits_left === 'number' ? row.credits_left : null;
}

/**
 * Re-read the balance for the surface's counter.
 *
 * Exists as its own action because the counter must be refreshed after a
 * FAILURE too — the refund has landed, and a tile saying "your credit is
 * back" beside a counter that still shows it spent is a contradiction that
 * makes a couple distrust both numbers.
 *
 * `null` propagates as `null`: a refused read is never rendered as zero.
 */
export async function readRenderBalance(args: {
  eventId: string;
}): Promise<{ creditsLeft: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { creditsLeft: await readBalanceLeft(supabase, args.eventId) };
}

/**
 * Give up on a render that stopped without ever reporting.
 *
 * The one failure the action above cannot report itself: if the process is
 * killed mid-render, nobody writes `failed_at`, and the row sits in flight
 * forever. `isStalledRender` makes the surface show it as a failure; this is
 * how the couple actually gets the credit back.
 *
 * Safe by construction rather than by trust: `moodboard_fail_render` REFUSES
 * on a render that has an image and is idempotent on one already failed, so
 * this can neither refund a delivered photo nor refund twice.
 */
export async function abandonStalledRender(args: {
  eventId: string;
  renderId: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('moodboard_fail_render', {
    p_render_id: args.renderId,
    p_reason: 'timeout: abandoned by the couple after it stalled',
  });
  revalidatePath(`/dashboard/${args.eventId}/studio/mood-board`);
  return { ok: !error && data === true };
}

/**
 * The consent toggle — "let Setnayan feature your creation → +1 render".
 *
 * The grant is inside the RPC, so consent and the bonus cannot come apart:
 * a couple can never end up consenting without the render they were promised,
 * and the partial UNIQUE index means they cannot collect it twice.
 */
export async function setShareConsent(args: {
  eventId: string;
  consented: boolean;
}): Promise<{ ok: boolean; creditsLeft: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('moodboard_set_share_consent', {
    p_event_id: args.eventId,
    p_consented: args.consented,
  });
  revalidatePath(`/dashboard/${args.eventId}/studio/mood-board`);
  return {
    ok: !error && data === true,
    creditsLeft: await readBalanceLeft(supabase, args.eventId),
  };
}
