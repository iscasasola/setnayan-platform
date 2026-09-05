/**
 * venue-avatars — the READ side of `guests.avatar_config` for the guest 3D
 * walk (C5, "people in the 3D room look like themselves").
 *
 * Pure — NO three.js, NO React — so the fallback rule can be asserted under
 * `tsx --test` without a GPU (the `lib/figure-rig.ts` discipline).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 THE GUARANTEE THIS MODULE EXISTS TO KEEP
 *
 * A guest who never made an avatar must render EXACTLY as they did before this
 * feature. The failure mode being guarded is not "the avatar looks wrong"; it
 * is silently changing the room for everyone who never opted in — and every
 * guest in production today has `avatar_config IS NULL`. So `selfFigureAvatar`
 * returns `null` for every one of them, the caller keeps its existing
 * `selfSpec` blob figure untouched, and `venue-avatars.test.ts` pins that
 * against the shipped spec over the whole input matrix.
 *
 * Two independent switches both collapse this to the old behaviour:
 *   1. `NEXT_PUBLIC_FIGURE_CHIBI` unset (the code DEFAULT) — nothing resolves,
 *      whatever the payload carries.
 *      ⚠ THIS LINE USED TO SAY "the only state production has ever been in".
 *      FALSE since 2026-08-31: the flag is `"true"` in Vercel Production
 *      (pulled with `vercel env pull` 2026-09-05), the maker at /[slug]/avatar
 *      is reachable, and a guest's own figure DOES resolve. A flag's default in
 *      code is not its value in production — read the env, not this comment.
 *   2. No stored `avatar_config` — every guest who has not opened the maker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🚧 SCOPE: THE VIEWER'S OWN FIGURE ONLY — and why
 *
 * The walk draws the viewer as a STANDING figure that runs, stands and dances
 * (it never sits: arriving at a seat parks the figure beside the chair and
 * marks the chair with a gold ring). A standing chibi is therefore exactly what
 * the rig already renders, and swapping it in is honest.
 *
 * SEATED occupants are a different matter and are deliberately NOT handled
 * here. `lib/chibi-geometry.ts` bakes legs, shoes and the outfit into MERGED,
 * JOINTLESS buffers — a chibi cannot bend at the hip, so "seated" is new
 * geometry, not a pose, and it belongs in that module behind its
 * `chibiJunctionAudit` merge gate (rig spec § 11 / the declared PR-2). Until
 * that lands there is nothing that could draw a seated guest's avatar, so the
 * RPC does not ship their configs either — shipping a payload ahead of its
 * reader is exactly the inert-column problem this change exists to fix.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛡 PRIVACY POSTURE (reused, NOT invented)
 *
 * `avatar_config` is a guest-authored CARTOON: whitelisted catalog ids from
 * `lib/chibi-config.ts`. It is NOT a photograph, NOT a face vector, and NEVER
 * derived from one — chibi-config's privacy fence (`bodyType` may not be read
 * from `users.sex`) carries straight through, and nothing here touches
 * `guest_face_enrollments` / `user_face_profiles`.
 *
 * What this module reads is the viewer's OWN config, which the RPC puts on the
 * `you` block — populated only when a personal token matched a live seated
 * guest of that event. Per-event scope (the column is on `guests`), no
 * cross-event reuse (there is no account-level avatar column), revocable (the
 * maker's Reset writes NULL), never required (NULL is the default).
 */

import {
  FIGURE_CHIBI_ENABLED,
  resolveChibiConfig,
  type ChibiAvatarConfig,
} from '@/lib/chibi-config';

/**
 * Is the guest-avatar read path live? Reuses the EXISTING chibi flag
 * (`NEXT_PUBLIC_FIGURE_CHIBI`, owned by lib/chibi-config.ts per
 * `env-flag.test.ts`'s file→flag table) rather than adding a second switch for
 * the same character system — the C5 brief's explicit instruction. Default OFF.
 */
export function guestAvatarsEnabled(): boolean {
  return FIGURE_CHIBI_ENABLED;
}

/** The shape the walk needs off the RPC's `you` block. Everything is optional
 *  because an older cached payload has none of it. */
export type VenueSelfAvatar = {
  /** RAW stored `guests.avatar_config` (or junk, or absent). */
  avatarConfig?: unknown;
};

/**
 * Resolve the viewer's own chibi, or `null` to leave the shipped blob figure
 * exactly as it is.
 *
 * `null` — the fallback — is returned for ALL of:
 *   · the flag off (whatever the payload says)
 *   · no `you` block at all (a tokenless visitor, who has no own figure config
 *     to speak of)
 *   · `avatarConfig` absent (an older cached payload predating this change)
 *   · `avatarConfig` null (every guest today)
 *
 * ⚠ THE TRAP THIS SIGNATURE AVOIDS: `resolveChibiConfig(id, null)` happily
 * returns a complete hash-default config. Calling it unconditionally would give
 * EVERY guest an avatar the moment the flag flipped — the exact silent change
 * this module exists to prevent. So the null check comes FIRST and the resolver
 * is only reached once there is something stored to resolve.
 *
 * When there IS something stored, `resolveChibiConfig` never throws: a value
 * from an older `v`, or junk, repairs field-by-field to the figure's hash
 * defaults rather than crashing the room.
 *
 * `figureId` is the walk's own stable, opaque self id (`'guest-self'`) — no
 * personal data enters the hash.
 */
export function selfFigureAvatar(
  you: VenueSelfAvatar | null | undefined,
  figureId: string,
  enabled: boolean,
): ChibiAvatarConfig | null {
  if (!enabled) return null;
  if (!you) return null;
  const stored = you.avatarConfig;
  if (stored == null) return null;
  return resolveChibiConfig(figureId, stored);
}
