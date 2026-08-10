/**
 * SEC-1 deferred lane #1 — tenancy for the `/api/upload` GENERIC branch.
 *
 * Pure, client-safe (no `server-only`, no SDK, no I/O) so it unit-tests under
 * `tsx --test`, mirroring `lib/r2-client-ref.ts` and `lib/bucket-routing.ts`.
 * The enforcement half lives in `app/api/upload/route.ts`.
 *
 * # The hole
 *
 * The generic branch takes a client-chosen `bucket` + `pathPrefix`. The bucket
 * is whitelisted and the prefix is sanitised (plus SEC-6's structural refusals),
 * and the final key gets a server-side `randomUUID()` — so this is **write
 * pollution, not disclosure, and not overwrite**. But *any* signed-in user can
 * presign a PUT under *any* prefix, including one naming **another couple's
 * event** or **another pair's chat thread**: `deposit-proof/<their-event-id>`,
 * `chat/<their-thread-id>`. The bytes land in a space the victim's own surfaces
 * read from.
 *
 * # What this module does, and deliberately does not
 *
 * It closes the **cross-tenant** half, which is the half with a victim. When a
 * prefix NAMES an id, the caller must be entitled to that id — verified at the
 * route against the caller's own RLS-scoped client, which is the same "let RLS
 * be the tenancy check" pattern `r2-client-ref.ts` documents.
 *
 * It does **not** try to allowlist every prefix in the app. `<FileUpload>` takes
 * `pathPrefix` as a prop, so the caller set is open-ended; an allowlist built by
 * grep would be a guess, and a wrong guess breaks uploads on a surface nobody
 * tested. Flat prefixes (`locked-qr-proof`, admin video, editorial-vendor —
 * itself separately tenanted by key layout in SEC-1 lane #3) keep today's
 * behaviour: authenticated, sanitised, UUID-suffixed, non-overwriting.
 *
 * So the invariant is narrow and true: **you may not name an id you do not
 * hold.** A caller passing their own ids is unaffected.
 *
 * # Why matching is shape-based, not name-based
 *
 * Rules key off *"a segment that is a UUID"*, not off a list of prefix names.
 * A new surface inventing `receipts/<eventId>` is covered the day it ships,
 * with no registry to update — the failure mode of an allowlist is silence,
 * and silence is what created this lane.
 */

/** A UUID v1–v5 in canonical form. `events.event_id` and `chat_threads.thread_id`
 *  are both `uuid`, which is what makes the shape rule safe. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(segment: string): boolean {
  return UUID_RE.test(segment);
}

/**
 * What the caller must be entitled to before this prefix may be presigned.
 *
 * `null` = the prefix names no id, so this module has nothing to assert and the
 * route proceeds on the existing checks alone.
 */
export type UploadTenancy =
  | { kind: 'event'; id: string }
  | { kind: 'thread'; id: string }
  | { kind: 'order'; id: string }
  | { kind: 'vendor'; id: string }
  | { kind: 'user'; id: string }
  | null;

/**
 * Prefix families whose FIRST segment means the UUID after it is a chat thread
 * rather than an event. Everything else that carries a UUID is treated as an
 * event id — the conservative direction, because an event check is the stricter
 * one for every current caller and a wrong guess here fails CLOSED (refusal),
 * never open.
 */
const THREAD_ROOTS = new Set(['chat']);

/**
 * Prefix families whose UUID is an ORDER id, not an event id.
 *
 * 🚨 THE LIVE BREAK THIS FIXES. `payments/<orderId>` is where the couple's
 * order page and the vendor's booking-fee page file a payment screenshot. The
 * "everything else is an event" default read that order id as an event id,
 * checked the payer against a wedding that does not exist, and refused —
 * **fail-closed working exactly as designed, on a legitimate path.**
 *
 * What that cost: from those two screens the upload box turned red and said
 * the location was not allowed. There is NO other way to send the picture from
 * them, nothing was logged, and the form still submitted happily without one.
 * The first screenshot of a purchase still arrived (a different screen files it
 * under a different prefix) — so what broke was the SECOND chance: an admin
 * asking *"send me a clearer picture"* addressed it to someone who could not.
 *
 * 🔑 THE CONSERVATIVE DEFAULT WAS ONLY CONSERVATIVE FOR THE CALLERS THAT
 * EXISTED WHEN IT WAS WRITTEN. Its own comment says "an event check is the
 * stricter one for every current caller" — true then, and this prefix made it
 * false without changing a line of this file.
 */
const ORDER_ROOTS = new Set(['payments']);

/**
 * ── 🔴 THE SECOND TIME THE FALL-THROUGH DEFAULT BROKE A LIVE UPLOAD ─────────
 *
 * Everything a vendor sends about their own shop is filed under
 * `vendors/<vendorProfileId>/…` — the logo on My Shop, portfolio and service
 * photos, the payment QR code, the booth poster, and **the DTI registration,
 * BIR 2303 and Mayor's Permit that verification runs on.**
 *
 * `vendors` was in neither set above, so it fell through to `kind: 'event'`
 * carrying a **vendor** id, and the route checked that id against `events`.
 * A vendor_profile_id is `gen_random_uuid()` and has nothing to do with the
 * events table, so the read returned nothing every single time and the endpoint
 * answered **403 "That upload location isn't allowed."** — for a vendor
 * uploading to their own shop.
 *
 * 🔑 THE COST WAS THE WHOLE PIPELINE, NOT ONE BUTTON. Documents are the gate to
 * approval, and approval is the gate to a shop being public — the owner's model
 * is *"their website will be live upon verification."* With the document upload
 * refused, **no vendor could ever be verified**, so no shop could ever go live.
 * Nothing threw and nothing logged: the box turned red on one screen.
 *
 * ⚠ MEASURED, NOT REASONED. Production holds
 * `r2://setnayan-media/vendors/51858369-…/logo/…` for the shop `setnaprod`.
 * That UUID is its **vendor_profile_id**, and it matches no row in `events` or
 * `chat_threads`. The object exists only because it was uploaded before this
 * guard shipped; the identical upload is refused today.
 *
 * 🔑 SAME LESSON AS `payments/<orderId>`, ONE PREFIX LATER: *"an event check is
 * the stricter one for every current caller"* was true when written and is
 * falsified by every new prefix, without a line of this file changing. A
 * fall-through default is a claim about callers that do not exist yet.
 */
const VENDOR_ROOTS = new Set(['vendors']);

/**
 * ── AND THE THIRD ONE, FOUND BY SWEEPING INSTEAD OF STOPPING ────────────────
 *
 * `profile-photo/<authUserId>` carries a **user** id. Same fall-through, same
 * outcome: checked against `events`, matched nothing, refused 403 — so
 * **nobody could change their profile picture**, couple or vendor, on the one
 * screen that offers it.
 *
 * 🔑 THIS IS THE ARGUMENT FOR SWEEPING EVERY ROOT RATHER THAN FIXING THE ONE
 * THAT WAS REPORTED. `vendors` was found because a vendor's logo key looked odd
 * in a database row I happened to be reading. Nothing pointed at profile
 * photos; the same audit found it only because the next step was to enumerate
 * all eighteen prefix roots and ask what id each one actually carries. Sixteen
 * were fine — fourteen genuinely carry an event id, and `merchant-qr/<kind>`,
 * `onboarding/background-music`, `papic/seat-N`, `taxonomy/<slug>` and
 * `refinements/<leafKey>` carry no UUID at all, so this module correctly says
 * nothing about them.
 */
const USER_ROOTS = new Set(['profile-photo']);

/**
 * Resolve the tenancy a sanitised `pathPrefix` implies.
 *
 * Takes the **first** UUID segment. A prefix carrying two ids
 * (`a/<uuid>/b/<uuid>`) is not a shape any caller uses today; if one appears,
 * asserting the first is still strictly better than asserting none, and the
 * repo-scan test will surface it.
 */
export function tenancyForPathPrefix(sanitizedPrefix: string): UploadTenancy {
  const segments = sanitizedPrefix.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const idIndex = segments.findIndex((s) => isUuid(s));
  if (idIndex === -1) return null;

  const root = segments[0]?.toLowerCase() ?? '';
  const id = segments[idIndex]!;
  if (THREAD_ROOTS.has(root)) return { kind: 'thread', id };
  if (ORDER_ROOTS.has(root)) return { kind: 'order', id };
  if (VENDOR_ROOTS.has(root)) return { kind: 'vendor', id };
  if (USER_ROOTS.has(root)) return { kind: 'user', id };
  return { kind: 'event', id };
}

/**
 * The refusal message. Deliberately non-specific, in the house style of
 * `lib/r2-client-ref.ts`: the caller learns the location was refused, never
 * whether the id they named exists. A specific message ("no such event") would
 * turn this guard into the existence oracle it was written to remove.
 */
export const UPLOAD_TENANCY_REFUSAL = 'That upload location isn’t allowed.';
