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
 * ⚠ AND THE OWNER SHOULD KNOW THIS BEFORE RULING: a preview of a REAL, NAMED
 * guest ALREADY SHIPS ELSEWHERE. `app/dashboard/[eventId]/website/widgets/
 * page.tsx` selects one real guest — `first_name`, `last_name`, `display_name`,
 * `qr_token` — and offers the host "Preview as <that person's name>", opening
 * `/{slug}?invite=<their real token>`. So the question is not "may we build
 * this"; it is "that already happens on the widgets page — is it intended, and
 * should the Hub match it?" Measured on origin/main 2026-09-02. This flag stays
 * off regardless: widening a privacy surface is not a thing to do on the
 * owner's behalf because a neighbouring page already does it.
 *
 * `NEXT_PUBLIC_` for the same reason every other launch flag here is
 * (`card-record-flag.ts`, `canvas-maker-flag.ts`): it is read by a server
 * component to decide whether to OFFER the role, so it must survive the client
 * bundle boundary if the switcher ever moves. Only the exact truthy strings
 * enable it; anything else, a missing var included, is OFF.
 */
export function hubNamedGuestPreviewEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_HUB_NAMED_GUEST_PREVIEW_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
