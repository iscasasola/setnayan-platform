/**
 * "AS <A REAL NAMED GUEST>" — the one privacy surface in the Hub's View-as
 * switcher, shipped DARK.
 *
 * The four generic roles (host · coordinator · supplier · guest) and the
 * STRANGER describe a CLASS of viewer. Nothing about them names a person, so
 * they ship unconditionally. The sixth role does not: "As Ana Reyes" renders
 * one real, named guest's personal view — her seat, the walk to it, the photos
 * of her, her bound QR — to the host.
 *
 * It is almost certainly fine: the host issued her QR, and the four cells that
 * are hers are hers BECAUSE the host put her on the list. But it is a personal
 * -data surface under RA 10173 and the design flagged it as the owner's call as
 * DPO, not engineering's (`EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 7.5).
 * So the role exists, is resolved by the same pure function as the other five,
 * is tested, and is NOT OFFERED until the owner says so.
 *
 * OFF (the default, and the value in production) ⇒ the switcher offers five
 * chips, the named role is absent from `hubPreviewRoles`, and NOTHING on this
 * page reads a guest's name. The absence is provable rather than promised: the
 * launch page performs no per-guest name read at all.
 *
 * `NEXT_PUBLIC_` because the switcher is a client component reading a
 * server-computed list — the same shape every other launch flag here uses
 * (`card-record-flag.ts`, `canvas-maker-flag.ts`). Only the exact truthy
 * strings enable it; anything else, a missing var included, is OFF.
 */
export function hubNamedGuestPreviewEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_HUB_NAMED_GUEST_PREVIEW_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
