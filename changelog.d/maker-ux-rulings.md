## 2026-07-28 · fix(vendor-services): two owner UX rulings on the maker family

**Every canvas sheet closes with an explicit "Update card" button** (owner: "pop
ups must have update button to avoid confusion"). Edits were already live-applied,
but a pop-up whose only exit is × left vendors unsure their input was taken. The
confirm renders in `CanvasSheet` itself so every sheet gets it uniformly;
`type="button"` is load-bearing (most sheets sit inside the one card form — a
default-submit would submit the card); the audience sheet opts out because it
carries its own real "Save who it's for" submit. Pinned in
`lib/canvas-sheet-confirm.test.ts`.

**A ₱0 choice option shows a BLANK, never the word "included"** (owner: "included
makes it seem like this is included whether they pick it or not"). Flipped at the
one constant (`INCLUDED_PLACEHOLDER = ''` in `lib/service-customization-draft.ts`),
plus the couple-side lock modal (the option price line simply doesn't render at
₱0) and the package editor's default-pick placeholder. The never-a-value rule
stands: prose typed into an amount field still parses to 0.

SPEC IMPACT: None
