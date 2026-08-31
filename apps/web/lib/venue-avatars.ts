/**
 * venue-avatars — the ONE seat-routing rule for the guest 3D walk, and the
 * read side of `guests.avatar_config` (C5, "people in the 3D room look like
 * themselves").
 *
 * Pure — NO three.js, NO React — so the routing rule that decides which seats
 * render individually and which collapse into the instanced anonymous crowd
 * can be asserted under `tsx --test` without a GPU (the `lib/figure-rig.ts`
 * discipline). `app/[slug]/venue/_components/guest-venue-3d.tsx` consumes it
 * from BOTH of its seat loops, so the two can never disagree about a seat.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 THE GUARANTEE THIS MODULE EXISTS TO KEEP
 *
 * A guest who never made an avatar must render EXACTLY as they did before this
 * feature — same figure, same batch, same draw. The failure mode being guarded
 * against is not "the avatar looks wrong"; it is silently changing the room for
 * every guest who never opted in. So `seatRenderKind` is written so that with
 * `avatarConfig` absent it reduces, term for term, to the rule the file already
 * had, and `venue-avatars.test.ts` pins that against a verbatim copy of the old
 * rule over the whole seat matrix. If you change the order of the branches
 * below, that test is the one that should stop you.
 *
 * Two independent switches both collapse the feature to the old behaviour:
 *   1. `NEXT_PUBLIC_FIGURE_CHIBI` unset (the DEFAULT, and the only state
 *      production has ever been in) — `avatarsBySeat` returns an EMPTY map
 *      whatever the payload carries, so no seat can ever resolve an avatar.
 *   2. No stored `avatar_config` for that seat — every guest today.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🛡 PRIVACY POSTURE (reused, NOT invented — the C5 brief's standing rule)
 *
 * `avatar_config` is a guest-authored CARTOON: a whitelisted set of catalog ids
 * (body/hair/eyes/outfit/colour) from `lib/chibi-config.ts`. It is NOT a
 * photograph, NOT a face vector, and it is NEVER derived from one — the privacy
 * fence in chibi-config's header (bodyType may not be read from `users.sex`)
 * carries straight through here, and nothing in this module touches
 * `guest_face_enrollments` / `user_face_profiles`.
 *
 * Even so it names a person at a seat, so it rides EXACTLY the gate the seat
 * PHOTOS already ride — `public_venue_scene`'s personal-token requirement plus
 * the host's own `venue_photo_visibility` ('none' | 'table' | 'all'). No third
 * consent surface: a guest who can see a tablemate's face can see their avatar,
 * and nobody else ever can. Per-event scope (the column is on `guests`, which
 * is per-event), no cross-event reuse (there is no account-level avatar column
 * to reuse from), revocable (the maker's Reset writes NULL), and never required
 * (NULL is the default and renders the anonymous mannequin).
 */

import {
  FIGURE_CHIBI_ENABLED,
  resolveChibiConfig,
  type ChibiAvatarConfig,
} from '@/lib/chibi-config';

/** One row of the RPC's `avatars` block — the same (table, seatNumber) key
 *  shape `photos` uses, so the client indexes both the same way. `config` is
 *  the RAW stored JSONB (or junk): it is sanitized here, never trusted. */
export type VenueAvatarRow = {
  table: string;
  seatNumber: number;
  config?: unknown;
};

/**
 * Is the guest-avatar read path live? Reuses the EXISTING chibi flag
 * (`NEXT_PUBLIC_FIGURE_CHIBI`, owned by lib/chibi-config.ts per
 * `env-flag.test.ts`'s file→flag table) rather than adding a second switch for
 * the same character system — the C5 brief's explicit instruction. Default OFF.
 */
export function guestAvatarsEnabled(): boolean {
  return FIGURE_CHIBI_ENABLED;
}

/**
 * Index the RPC's `avatars` rows as table → (seat number → resolved config),
 * mirroring `photoByTable` in the walk.
 *
 * Returns an EMPTY map when the feature is off, when the payload has no
 * `avatars` block (every cached payload predating this change), or when a row
 * carries no config — so the caller's lookup misses and the seat takes the old
 * path. `enabled` is a parameter rather than a direct flag read so the test can
 * drive both states without touching `process.env`.
 *
 * Each surviving row is run through `resolveChibiConfig`, which NEVER throws:
 * a stale or hand-edited stored value repairs field-by-field to that seat's
 * hash defaults rather than crashing the room. The hash id is the seat key —
 * stable per seat, and opaque (a table public_id + a seat index carries no
 * personal data into the hash).
 */
export function avatarsBySeat(
  rows: readonly VenueAvatarRow[] | null | undefined,
  enabled: boolean,
): Map<string, Map<number, ChibiAvatarConfig>> {
  const out = new Map<string, Map<number, ChibiAvatarConfig>>();
  if (!enabled || !rows) return out;
  for (const r of rows) {
    // An absent config is the whole point of the fallback — skip it rather
    // than resolving hash defaults, or EVERY seat would sprout an avatar.
    if (r.config == null) continue;
    if (typeof r.table !== 'string' || !Number.isInteger(r.seatNumber)) continue;
    let seats = out.get(r.table);
    if (!seats) {
      seats = new Map<number, ChibiAvatarConfig>();
      out.set(r.table, seats);
    }
    seats.set(r.seatNumber, resolveChibiConfig(`${r.table}:${r.seatNumber}`, r.config));
  }
  return out;
}

/** How one seat renders in the guest walk.
 *  · 'empty'  — nothing drawn (unoccupied, and not the viewer's own seat)
 *  · 'self'   — the viewer's own seat: individual, accent-tinted, gold ring
 *  · 'photo'  — host-opt-in selfie: individual, GuestPhotoAvatar billboard head
 *  · 'avatar' — NEW: the guest's own chibi, individual
 *  · 'crowd'  — the anonymous neutral mannequin, batched into ONE
 *               InstancedSeatedCrowd for the whole room */
export type SeatRenderKind = 'empty' | 'self' | 'photo' | 'avatar' | 'crowd';

/**
 * THE routing rule. Both seat loops in the walk call this and switch on the
 * result, so an individually-drawn seat can never also be pushed into the
 * instanced batch (drawing the guest twice) and an occupied seat can never fall
 * out of both (a hole where a person is sitting).
 *
 * BRANCH ORDER IS LOAD-BEARING and reproduces the shipped rule exactly:
 *   · `mine` wins first — the old code tested `mine` before anything else and
 *     drew the own seat individually whether or not it was in `occupied`. The
 *     caller still builds the spec itself, so an own seat that ALSO has a photo
 *     keeps its photo head and its accent tint, exactly as today.
 *   · then occupancy — the old `if (!taken && !mine) return null`.
 *   · then photo — the old `if (!mine && !photoUrl) return null` (i.e. a photo
 *     seat is individual, everything else batches).
 *   · then avatar — the ONLY new branch, and the last one before the default.
 *     It can only fire on a seat that the old rule sent to 'crowd', which is
 *     why an absent avatar leaves every other seat's answer untouched.
 *   · then 'crowd' — the default, and where every guest without an avatar still
 *     lands.
 *
 * ⚠ A photo BEATS an avatar deliberately. A guest who gave the couple a real
 * selfie already renders as themselves; swapping that for a cartoon because
 * they also made one would be a downgrade nobody asked for.
 */
export function seatRenderKind(seat: {
  occupied: boolean;
  mine: boolean;
  photoUrl?: string | null;
  avatarConfig?: ChibiAvatarConfig | null;
}): SeatRenderKind {
  if (seat.mine) return 'self';
  if (!seat.occupied) return 'empty';
  if (seat.photoUrl) return 'photo';
  if (seat.avatarConfig) return 'avatar';
  return 'crowd';
}

/** Does this seat draw its own meshes (rather than joining the instanced
 *  batch)? The GuestTable loop's early-out. */
export function seatIsIndividual(kind: SeatRenderKind): boolean {
  return kind === 'self' || kind === 'photo' || kind === 'avatar';
}

/** Does this seat belong to the room-level InstancedSeatedCrowd? The crowd
 *  loop's `continue` condition, expressed as the complement of the above so
 *  the two loops cannot drift apart. */
export function seatJoinsCrowd(kind: SeatRenderKind): boolean {
  return kind === 'crowd';
}
