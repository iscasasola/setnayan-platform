/**
 * Reminders — the couple's own lines for their guests ("Arrive by 2:30",
 * "Bring your ticket", "Wear flat shoes for the garden"). Stored where it always
 * was, `events.what_to_bring` (Increment A.3), and written in the Maker in place;
 * renders nothing when blank so the section hides.
 *
 * 🏠 CALLED "REMINDERS" TO GUESTS (owner 2026-09-30: *"on invitation we can set
 * the reminders"* — DECISION_LOG "THE INVITATION'S HOME IS THE GUEST'S OWN PAGE"
 * reuses this scene rather than adding a store). It sits on the Invitation's
 * Welcome page now (`lib/invitation-welcome.ts`), not under Details.
 */
export function WhatToBringWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  // Pahina (design 2026-07-25 §7): the second "Good to know" plate — same
  // grammar as SpecialMessageWidget, likewise unnumbered.
  return (
    <section className="space-y-3">
      <p className="pahina-eyebrow">
        <span>Reminders</span>
      </p>
      <div className="pahina-plate">
        <p className="max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/80">
          {msg}
        </p>
      </div>
    </section>
  );
}
