/**
 * THE COVER — the one picture a story is known by.
 *
 * `02_The_Story_Maker.md` §6 · `08` step 1.5 · `03` §2.6.
 *
 * One picture, three jobs: the top of the story, the card on
 * `setnayan.com/realstories`, and the 1200×630 thumbnail when the link is
 * shared. Before this module there was no cover CONCEPT at all — all three
 * surfaces independently inherited the LIVING hero through
 * `loadEditorialData`'s four-rung ladder (the couple's own upload → a curated
 * capture → the Papic auto-pick → `landing_page_hero_image_url`), so a host
 * could not choose the picture and could not see what they were choosing.
 *
 * ⚠ `showcase_photo_r2_key` IS ON VENDOR SERVICES, A DIFFERENT TABLE. Not this.
 *
 * ── THE STORED PAIR IS A POINTER, NOT A PICTURE, AND THAT IS THE WHOLE POINT ──
 * 🔑 `story_cover_ref` HOLDS AN ID WHEREVER ONE EXISTS, NEVER A BAKED KEY.
 * A capture stores its `photo_id`; a supplier's frame stores its `media_id`.
 * Only an upload — which has no row and no consent of its own to withdraw —
 * stores an object key. The reason is the whole of `04`: a capture can be
 * vetoed by a guest, taken down by the screen or hidden by the host TOMORROW,
 * and a supplier's frame can be withdrawn or its supplier dropped as the
 * recommended pick. **Baking the key at the moment of choosing would freeze a
 * permission that is not frozen** — the cover would keep publishing a
 * photograph the person in it had since said no to, on the most visible surface
 * the product has.
 *
 * ⚠ S4's migration comment says the pair holds "the supplier frame's key". It
 * is the media_id here instead, deliberately, for the reason above. That
 * migration explicitly left the pairing rule to this session ("a pairing rule
 * guessed now is a rule S7 would have to loosen"), and this is that rule.
 *
 * ── A COVER THAT NO LONGER QUALIFIES IS SIMPLY ABSENT ────────────────────────
 * `resolveStoryCover` returns `null` when the pointer no longer passes the same
 * checks it passed when it was chosen. Every caller then falls through to the
 * behaviour it has today — the living-hero ladder — which is why this is safe
 * to consult first on a public surface: it can only ever REPLACE the ladder's
 * answer with a picture the host chose, or step out of the way. It can never
 * turn nothing into something.
 */

/*
  TYPE-ONLY IMPORT — erased at runtime, so this module pulls in no `server-only`
  client and its unit test can hand it a stand-in. The house pattern is the EXACT
  `SupabaseClient` type (`lib/story-edition.ts`, `lib/panood-control.ts`): a
  hand-rolled structural type for "a thing with .from().select().eq()" makes tsc
  give up with TS2589 at the call site.
*/
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadConsentVetoedPapicIds,
  publicKeyForCapture,
} from '@/app/[slug]/_components/editorial/consent-veto';
import { PUBLIC_SAFE_MODERATION_STATE } from './public-media-visibility';

/**
 * The five candidates `02` §6 offers, and the exact vocabulary the database
 * CHECK admits (`events_story_cover_kind_check`, applied in prod). A sixth
 * value written here would be refused by the database, not silently stored.
 */
export const STORY_COVER_KINDS = [
  'hero',
  'capture',
  'vendor_frame',
  'monogram',
  'upload',
] as const;

export type StoryCoverKind = (typeof STORY_COVER_KINDS)[number];

/**
 * Which kinds carry a pointer — THE PAIRING RULE S4 DEFERRED TO THIS SESSION.
 *
 * `hero` and `monogram` need none: the living hero is a column the event
 * already has, and the monogram is drawn from the couple's own mark. The other
 * three are meaningless without one, and a kind stored without its ref is not a
 * "partial choice" — it is a cover that cannot be drawn, so it is not a cover.
 */
export const COVER_KINDS_NEEDING_REF: ReadonlySet<StoryCoverKind> = new Set<StoryCoverKind>([
  'capture',
  'vendor_frame',
  'upload',
]);

export type StoryCover = { kind: StoryCoverKind; ref: string | null };

function isCoverKind(v: unknown): v is StoryCoverKind {
  return typeof v === 'string' && (STORY_COVER_KINDS as readonly string[]).includes(v);
}

function trimmed(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * The stored pair → a cover, or `null` for "no cover was ever chosen".
 *
 * Pure, and the ONE place the pairing rule lives — the writer validates through
 * it before the insert and every reader validates through it after the read, so
 * a pair the database would refuse can never reach a render either.
 *
 * NULL, deliberately, for every malformed shape: an unknown kind, a kind that
 * needs a pointer and has none. A cover that cannot be drawn must read as
 * "never chosen", because that is the state whose behaviour is already
 * defined — the living hero, exactly as today.
 */
export function sanitizeStoryCover(kind: unknown, ref: unknown): StoryCover | null {
  if (!isCoverKind(kind)) return null;
  const pointer = trimmed(ref);
  if (COVER_KINDS_NEEDING_REF.has(kind)) {
    return pointer ? { kind, ref: pointer } : null;
  }
  // A stray pointer on `hero`/`monogram` is dropped rather than refused: the
  // kind is unambiguous on its own, and carrying the orphan would let two
  // readers disagree about which half to believe.
  return { kind, ref: null };
}

/**
 * What a surface should draw.
 *
 * `key` is an R2 object key (or a passthrough URL) for the four picture kinds.
 * For `monogram` it is `null` and the surface draws the couple's own mark —
 * which every one of the three surfaces already knows how to do
 * (`renderCoupleMonogramOgJpeg` on the share card, the monogram lockup on the
 * page), so the cover names the choice rather than baking an image for it.
 */
export type ResolvedStoryCover = { kind: StoryCoverKind; key: string | null };

/** The events columns `resolveStoryCover` needs. Read them once, pass them in. */
export type StoryCoverEventRow = {
  story_cover_kind?: unknown;
  story_cover_ref?: unknown;
  landing_page_hero_image_url?: unknown;
};

/**
 * The host's chosen cover, RE-CHECKED against the same gates it passed when it
 * was chosen — or `null`, which means "draw what you draw today".
 *
 * ⚖ THE ELIGIBILITY CHECK IS NOT REPEATED HERE, IT IS DELEGATED. A capture goes
 * back through `publicKeyForCapture` — the one gate `04` rule 6 names, the same
 * one the public page's ten read sites consult — so the 2026-08-18 blur ruling
 * applies to a cover exactly as it applies to a gallery photograph: a vetoed
 * capture with a baked all-faces-blurred stand-in resolves to the stand-in, and
 * one without resolves to nothing.
 *
 * 🔑 IT MUST BE ASKED AT READ TIME, NOT AT WRITE TIME. Everything this function
 * checks can change after the host chooses: a guest can withdraw, the screen can
 * reclassify, the host can hide the capture, a supplier can be dropped as the
 * recommended pick. A cover resolved once and stored would outlive every one of
 * those decisions on the most-shared surface the product has.
 */
export async function resolveStoryCover(
  admin: SupabaseClient,
  eventId: string,
  event: StoryCoverEventRow,
): Promise<ResolvedStoryCover | null> {
  const cover = sanitizeStoryCover(event.story_cover_kind, event.story_cover_ref);
  if (!cover) return null;

  if (cover.kind === 'monogram') return { kind: 'monogram', key: null };

  if (cover.kind === 'hero') {
    const key = trimmed(event.landing_page_hero_image_url);
    // The host asked for the living hero and the event has none. Falling through
    // is right: the ladder's later rungs are exactly what "the living hero"
    // resolves to when that column is empty.
    return key ? { kind: 'hero', key } : null;
  }

  if (cover.kind === 'upload') {
    // The host's own file. No row, no third party, nothing to re-check — the
    // only thing that can invalidate it is the host replacing it, which
    // rewrites this pair.
    return { kind: 'upload', key: cover.ref };
  }

  if (cover.kind === 'capture') return resolveCaptureCover(admin, eventId, cover.ref as string);

  return resolveVendorFrameCover(admin, eventId, cover.ref as string);
}

/**
 * A capture cover — screened, not hidden, still this event's, and past the
 * consent veto. Any refusal resolves to `null`.
 *
 * ⚠ A REJECTED QUERY IS AN ABSENCE, NOT A THROW. `error` is checked as its own
 * failure arm beside the `catch`, because a phantom column, a missing grant or
 * an RLS refusal all arrive as `{ data: null, error }` and none of them throws.
 * Reading only the `catch` would turn every refusal into "no cover", which is
 * the safe direction here but for the wrong reason — and the wrong reason stops
 * being safe the first time somebody reuses this shape somewhere it is not.
 */
async function resolveCaptureCover(
  admin: SupabaseClient,
  eventId: string,
  photoId: string,
): Promise<ResolvedStoryCover | null> {
  try {
    const { data, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, poster_r2_key, photo_type, moderation_state')
      .eq('event_id', eventId)
      .eq('photo_id', photoId)
      .is('hidden_at', null)
      .eq('moderation_state', PUBLIC_SAFE_MODERATION_STATE)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as Record<string, unknown>;
    // A clip's cover is its poster frame — a cover is a still on all three
    // surfaces, and the OG card cannot render video at all.
    const original =
      row.photo_type === 'clip'
        ? trimmed(row.poster_r2_key)
        : trimmed(row.r2_object_key);
    if (!original) return null;

    const veto = await loadConsentVetoedPapicIds(admin, eventId);

    /*
      ⚖ A VETOED CAPTURE IS DROPPED HERE, NEVER SOFTENED — and this is the ONE
      place in this module that does not simply delegate to the gate.

      `publicKeyForCapture` is monotone and correct, but it implements the
      2026-08-17 blur ruling: a vetoed capture with a baked all-faces-blurred
      stand-in resolves to the STAND-IN rather than to nothing. That ruling
      exists so a group photograph is not DELETED — it still appears, blurred,
      in the gallery and the timeline.

      🔑 THE LEAD IMAGE IS THE ONE SITE THE OWNER EXEMPTED, and a cover is a lead
      image on three surfaces at once. `data.ts`'s hero rung keeps the old drop
      for exactly this reason, in its own words: *"the hero is a single curated
      lead image, and an all-faces-blurred photograph is not a thing to open a
      wedding recap with. Softening here would gain no photo — it would only
      make the front door worse."*

      🔴 THIS WAS A REAL DEFECT, CAUGHT IN REVIEW BEFORE MERGE. Delegating to
      the gate here read as the careful choice — it is the gate `04` rule 6
      names — but it would have made the three surfaces DISAGREE ABOUT ONE
      PHOTOGRAPH: the story's own top would drop it (that path goes through the
      hero rung) while the shelf card and the share card published it blurred.
      An inconsistency is worse than either answer alone, and the blurred half
      was the one the owner had already ruled out.

      ⚠ SO THE VETO IS CONSULTED, NOT THE SOFTENER. `publicKeyForCapture` still
      guards the not-vetoed path below, so a change to what "vetoed" MEANS
      reaches this file for free; only the softening is refused.
    */
    if (veto.failed || veto.ids.has(photoId)) return null;

    const shown = publicKeyForCapture(veto, photoId, original);
    return shown ? { kind: 'capture', key: shown } : null;
  } catch {
    return null;
  }
}

/**
 * A supplier's frame — clean, accepted by the host at the desk, not hidden, and
 * its supplier still the recommended pick.
 *
 * 🔑 ALL FOUR CONDITIONS ARE THE PUBLIC READ'S OWN, NOT A NEW SET. `data.ts`
 * §6d publishes a supplier frame on exactly these terms; a cover that qualified
 * on looser terms would put on the share card a frame the page below it
 * withholds. The recommended-pick re-check is the one that is easy to forget and
 * the one that matters most: swapping the supplier drops their media everywhere
 * else, and it must drop it here too.
 */
async function resolveVendorFrameCover(
  admin: SupabaseClient,
  eventId: string,
  mediaId: string,
): Promise<ResolvedStoryCover | null> {
  try {
    const { data, error } = await admin
      .from('editorial_vendor_media')
      .select('media_id, event_vendor_id, still_r2_key')
      .eq('event_id', eventId)
      .eq('media_id', mediaId)
      .eq('moderation_state', 'clean')
      .eq('status', 'approved')
      .eq('hidden_by_couple', false)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as Record<string, unknown>;
    const still = trimmed(row.still_r2_key);
    const eventVendorId = trimmed(row.event_vendor_id);
    if (!still || !eventVendorId) return null;

    const { data: vendor, error: vendorError } = await admin
      .from('event_vendors')
      .select('vendor_id')
      .eq('vendor_id', eventVendorId)
      .eq('selection_match_rank', 1)
      .maybeSingle();
    // Not (or no longer) the recommended pick → the frame is not publishable,
    // so it is not a cover either. A refused read fails the same way, closed.
    if (vendorError || !vendor) return null;

    return { kind: 'vendor_frame', key: still };
  } catch {
    return null;
  }
}
