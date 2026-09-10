/**
 * lib/moodboard-render-keys.ts — WHICH OBJECT A RENDER ROW MAY NAME.
 *
 * Pure (no `server-only`, no SDK, no I/O) so the rule is a real unit test. The
 * serving half is `lib/moodboard-render-serve.ts`; the database half is the
 * CHECKs + RPC refusals in migration 20271220579615_a_render_key_is_its_own.
 *
 * ── THE CLASS THIS CLOSES ──────────────────────────────────────────────────
 * "THE ROW IS YOURS, THE FIELD IS NOT" + A SERVICE-CREDENTIAL READ. Every render
 * key lives in the PRIVATE `setnayan-thread-files` bucket — the same bucket that
 * holds payment-proof screenshots and chat attachments — and is read back with
 * the ADMIN R2 credentials: presigned for the couple's gallery and the admin
 * all-creations page, presigned for OTHER couples in the inspiration pool, and
 * COPIED into the public bucket when another couple picks it. Until 2026-09-10
 * nothing asked whether the key was the render's own, so any event member could
 * stamp `payment-proof/…` onto a render and be handed a signed link to it.
 *
 * ── THE RULE: EQUALITY, NOT A PREFIX ───────────────────────────────────────
 * A render names exactly ONE object, and it is derived from the row itself:
 *
 *   image_key          renders/<event_id>/<render_id>.(png|jpg|webp)
 *   gallery_image_key  render-gallery/<event_id>/<render_id>.jpg
 *
 * So the test is "is this the string this row would have minted?" — byte for
 * byte. No trim, no case fold, no pattern: a leading space, `R2://`, a `..`
 * segment or a lookalike character is simply not equal. The builders and the
 * checks below share one derivation, and the SQL restates the same three
 * strings, so the writer, the database and every reader agree by construction
 * (`moodboard-render-keys.test.ts` holds them together).
 *
 * Ids are lowercased before use: Postgres renders a uuid as lowercase, and the
 * event id in a dashboard URL is whatever the browser typed.
 */

/** A canonical uuid, any case on the way in. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The three extensions the render writer can produce, and nothing else. */
export const RENDER_IMAGE_EXTENSIONS = ['png', 'jpg', 'webp'] as const;
export type RenderImageExtension = (typeof RENDER_IMAGE_EXTENSIONS)[number];

/** `uuid` in the form Postgres prints it, or null for anything that is not one. */
export function canonicalRenderId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const lower = id.toLowerCase();
  return UUID_RE.test(lower) ? lower : null;
}

/** The extension the writer files a render of `mimeType` under. */
export function renderImageExtension(mimeType: string): RenderImageExtension {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
}

/**
 * `renders/<eventId>/<renderId>.<ext>` — the couple's own, UNMARKED copy.
 * Throws on a non-uuid id: an id that cannot be canonicalised would mint a key
 * the database then refuses, and the caller must learn that before uploading.
 */
export function renderImageKey(eventId: string, renderId: string, mimeType: string): string {
  const e = canonicalRenderId(eventId);
  const r = canonicalRenderId(renderId);
  if (!e || !r) throw new Error('renderImageKey: event and render ids must be uuids');
  return `renders/${e}/${r}.${renderImageExtension(mimeType)}`;
}

/** `render-gallery/<eventId>/<renderId>.jpg` — the WATERMARKED copy; always .jpg. */
export function renderGalleryKey(eventId: string, renderId: string): string {
  const e = canonicalRenderId(eventId);
  const r = canonicalRenderId(renderId);
  if (!e || !r) throw new Error('renderGalleryKey: event and render ids must be uuids');
  return `render-gallery/${e}/${r}.jpg`;
}

/** Is `key` exactly the unmarked image THIS render (of THIS event) may name? */
export function isOwnRenderImageKey(
  key: unknown,
  row: { eventId: unknown; renderId: unknown },
): key is string {
  if (typeof key !== 'string') return false;
  const e = canonicalRenderId(row.eventId);
  const r = canonicalRenderId(row.renderId);
  if (!e || !r) return false;
  return RENDER_IMAGE_EXTENSIONS.some((ext) => key === `renders/${e}/${r}.${ext}`);
}

/** Is `key` exactly the watermarked copy THIS render (of THIS event) may name? */
export function isOwnRenderGalleryKey(
  key: unknown,
  row: { eventId: unknown; renderId: unknown },
): key is string {
  if (typeof key !== 'string') return false;
  const e = canonicalRenderId(row.eventId);
  const r = canonicalRenderId(row.renderId);
  if (!e || !r) return false;
  return key === `render-gallery/${e}/${r}.jpg`;
}

/**
 * The inspiration pool's variant: the pool deliberately does NOT return the
 * source event id (a reference photo must not say whose wedding it was), so the
 * event segment can only be held to "a uuid" — while the render segment is held
 * to THIS row's id. That is still a pin to one object: the only writer files a
 * gallery copy under its own render id, and the database (CHECK
 * event_renders_gallery_image_key_is_its_own) holds the event segment to the
 * row's own event, so no other object is named `…/<this render id>.jpg`.
 */
export function isPooledRenderGalleryKey(key: unknown, renderId: unknown): key is string {
  if (typeof key !== 'string') return false;
  const r = canonicalRenderId(renderId);
  if (!r) return false;
  const prefix = 'render-gallery/';
  const suffix = `/${r}.jpg`;
  if (!key.startsWith(prefix) || !key.endsWith(suffix)) return false;
  const middle = key.slice(prefix.length, key.length - suffix.length);
  // Exactly one segment, and it must be a canonical (lowercase) uuid.
  return UUID_RE.test(middle);
}
