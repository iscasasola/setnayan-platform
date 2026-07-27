import type { ReactNode } from 'react';
import type { VendorSpecializationSet } from '@/lib/vendor-specialization-gate';
import { FloorCommand } from './floor-command/floor-command';
import { SongDesk } from './song-desk/song-desk';
import { StageScript } from './stage-script/stage-script';

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  THE SPECIALIZATION REGISTRY — the one file a specialization PR edits.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * The live day-of console renders a generic kit every vendor gets, plus ONE
 * specialization section for the vendor's trade. This registry is the seam
 * between the frame (already built, already gated) and the three specialist
 * surfaces (each its own PR, each its own subdirectory).
 *
 * ── HOW TO PLUG IN A SPECIALIZATION ────────────────────────────────────────
 *
 * Two steps. Neither touches `page.tsx`, `specialization-slot.tsx`, or
 * `lib/vendor-dayof-frame.ts`.
 *
 *   1. Build your surface in your OWN new subdirectory, so the three PRs never
 *      collide on a file:
 *
 *          live/[eventId]/_components/song-desk/song-desk.tsx
 *          live/[eventId]/_components/stage-script/stage-script.tsx
 *          live/[eventId]/_components/floor-command/floor-command.tsx
 *
 *      Export a component taking {@link SpecializationSurfaceProps}. It may be
 *      `async` and read the DB — it is rendered as a Server Component inside an
 *      already-authorised page.
 *
 *          export async function SongDesk({ eventId, vendorProfileId }: SpecializationSurfaceProps) {
 *            const rows = await fetchSetlist(eventId, vendorProfileId);
 *            return <div className="space-y-3">…</div>;
 *          }
 *
 *   2. Import it and add ONE line to SPECIALIZATION_SURFACES below:
 *
 *          song_desk: SongDesk,
 *
 * That is the whole integration. Registering the component is what flips the
 * section from its "coming soon" placeholder to your surface. Everything else —
 * the section header, the jump-nav entry, the entitlement check, the upsell for
 * vendors below the tier floor — is already wired.
 *
 * ── WHAT THE REGISTRY IS NOT ───────────────────────────────────────────────
 *
 * It is NOT a permission list. Membership here cannot grant anything: the page
 * resolves `resolveVendorSpecializationAccessForVendor` on the SERVER and only
 * renders a registered surface when `access.unlockedSet` matches. A set that is
 * registered but not held renders the upsell, never the surface — pinned by
 * "being REGISTERED does not unlock" in `lib/vendor-dayof-frame.test.ts`.
 *
 * So an absent entry is not a hole to be plugged with a permission; it simply
 * means "no surface built yet", which the frame renders as an honest, named
 * placeholder rather than a broken section.
 *
 * ── YOUR SURFACE STILL OWNS ITS OWN DATA BOUNDARY ──────────────────────────
 *
 * The frame guarantees your component is only MOUNTED for an entitled, booked,
 * authenticated vendor on the day of their event. It does not authorise your
 * queries. Scope every read to the `eventId` + `vendorProfileId` you are handed
 * and let RLS do its job — hiding a section is not a boundary (2026-07-26
 * security review).
 */

/**
 * The stable props contract every specialization surface receives. Additive
 * only: a later PR may ADD an optional field, but removing or narrowing one
 * breaks every registered surface at once.
 */
export type SpecializationSurfaceProps = {
  /** The event being run today. Already verified booked + dated today. */
  eventId: string;
  /** The vendor whose console this is — their own profile, or the profile that
   *  granted day-of access to this user. Scope your reads to it. */
  vendorProfileId: string;
  /** Display name of the couple/event, for headings. Already resolved. */
  coupleName: string;
};

/**
 * A specialization surface. Typed to allow `Promise<ReactNode>` so an `async`
 * Server Component registers without a cast (React 19 / Next 15).
 */
export type SpecializationSurface = (
  props: SpecializationSurfaceProps,
) => ReactNode | Promise<ReactNode>;

/**
 * THE REGISTRY. Add one line per specialization; leave the others alone.
 *
 * `Partial` is deliberate — an unregistered set is the normal, expected state
 * and renders the "coming soon" placeholder. Do not add a stub component just
 * to fill a slot: an absent entry is already the honest answer.
 */
export const SPECIALIZATION_SURFACES: Partial<
  Record<VendorSpecializationSet, SpecializationSurface>
> = {
  song_desk: SongDesk, //       ← band / singer / choir / orchestra / DJ
  stage_script: StageScript, // ← host / MC
  floor_command: FloorCommand, // ← coordinator
};

/**
 * Which sets currently have a surface. Fed to `buildDayOfFrame` as a
 * PRESENTATION input — it moves a held section between `ready` and
 * `coming_soon` and can never grant entitlement.
 */
export function registeredSpecializationSets(): ReadonlySet<VendorSpecializationSet> {
  return new Set(
    Object.keys(SPECIALIZATION_SURFACES) as VendorSpecializationSet[],
  );
}
