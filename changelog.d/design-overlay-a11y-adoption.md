# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-02 · fix(a11y): four overlays promised `aria-modal` and never kept it — plus the guard that stops the fifth

`design#2` of the Design Programme, executed against what the code actually is rather than what the contract assumed.

**The contract's premise was stale, and this is the finding.** `WHATS_NEXT_Design_Programme_2026-08-01.md` §2 says design#2 "replaces ~55 ad-hoc dialog call sites". Measured against `origin/main`: 53 files render a dialog, and **43 of them already route through the shipped primitives** (`Sheet`, `ConfirmDialog`, `useModalA11y`). The overlay grammar is not missing — it shipped in the 2026-06-25 audit. What was missing is **adoption in the overlays written since**. So this PR is ~50 lines of adoption plus a guard, not a new primitive set.

**The defect.** `aria-modal="true"` is a promise to assistive technology that nothing outside the element exists. Four overlays made that promise with no Escape handler, no Tab trap, and no focus restore — so a keyboard or screen-reader user tabs out of a "modal" onto controls they cannot see, with no way back:

- `app/papic/_components/papic-buy-shell.tsx` — **the worst one, and guest-facing.** It opens *by itself* over the viewfinder at the out-of-shots moment, and had no Escape at all.
- `app/_components/report-page-button.tsx` — public pages (`/[slug]`, `/u/[slug]`), signed-out visitors included. Close is held while a submit is in flight, matching the existing backdrop behaviour.
- `app/admin/fraud/_components/wipe-ban-dialog.tsx` — a destructive two-admin flow.
- `app/vendor-dashboard/on-the-day/_components/guest-review-qr.tsx` — had Escape and scroll-lock but neither the trap nor the restore; the hand-rolled effect is replaced by the hook (net −4 lines).

Each now calls the existing `useModalA11y({ open, onClose, containerRef })`. No new primitive, no visual change, no copy change.

**The guard** — `lib/modal-a11y-adoption.test.ts` walks `app/` and `components/` and fails on any `.tsx` rendering `aria-modal` without evidence of shared focus management. It pins a floor of 20 scanned files so a mis-pointed walk cannot pass silently, and its one exemption (`life-flash/flash.tsx`, which hand-rolls the complete contract correctly and predates the hook) carries a written reason that a second test re-validates.

**Mutation-verified twice**: the guard was watched failing on the two files it genuinely found, and again after removing the Papic fix. Full suite 6,267/6,267, `tsc` clean, `next lint` clean (no new warnings).

SPEC IMPACT: `WHATS_NEXT_Design_Programme_2026-08-01.md` — design#2's "~55 ad-hoc call sites" figure is wrong; the primitives ship and 43/53 surfaces already use them. Item re-scoped to adoption + guard, and closed.
