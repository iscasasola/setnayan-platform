## 2026-11-10 · feat(onboarding): "Which one is you?" fills your side · the shared step parts (Build 5 Lane P, slice 1)

Owner, 10 Nov: *"It asked me who i am and it did not fill it up."* · *"inconsistent design template on the
onboarding. Like the text of the names."* Step 0 rows 33–35; approved prototype
`prototypes/onboarding_every_step_2026-11-10` (artifact DYyuJ17CSrq5TmCF5T3itT) § B wedding 1 of 10.

- **The picked side fills from the account, even when it was already picked.** `selectRole` seated your row
  only at the moment of a pick, so a resumed draft (or a role carried from the old role screen) showed
  "Groom" with the GROOM · YOU boxes empty. The wedding shell now seats once on arrival, after the draft
  is read, through the SAME `seatSelf` / `seatCouple` (own row only, empty boxes only, never the partner's).
- **The formal name first.** `getSelfPersonalization` also reads `users.first_name` / `last_name`; the
  wedding page hands them to the shell as one `SelfName` (`couple-handoff.ts`), taken as written ("Maria
  Clara" + "dela Cruz" never splits on the first space), falling back to the display name as before.
- **The names are the ONE Field template.** `TypedRow` (`app/_components/form-row.tsx`) gains a one-line `boxed`
  look (T32): the name above, a 48 px box, radius 12, 14 px inner padding, 16 px text; open, the box keeps its shape
  with ONE ✕ inside (Step 0 row 35's "two outlines and two ✕" was the inner clear + the outer leave-as-it-was ✕).
  No second input: `app/onboarding/_shared/step-field.tsx` keeps only `StepField` (label above), `StepPick` (the
  house PickMenu at full width in the same box), `StepRows` (FormRows inside the tab scope) and `StepGroup`.
  `field-template.baseline.txt` shrinks by one (`wedding-cards.tsx` 1 → 0 raw boxes).
- **Wedding 1 · Who's getting married?** on those parts: "Which one is you?" is the full-width dropdown,
  your side first, each name a labelled field; the serif "&" divider is gone.
- **SetupFrame's title** is the template's 22 px / 600 house sans on every skin (no serif italic wedding
  title, no light serif) — every setup card, one look.
- Guards: `app/onboarding/the-steps-wear-one-template.test.ts` (T32's missing guard — the parts' measurements;
  per-step anchors for migrated steps, grows per slice; one ✕ in the open boxed field — sabotaged with a second ✕, red),
  `lib/onboarding/the-picked-side-fills-from-the-account.test.ts`; `wedding-cards.render.test.ts` reads the rows as
  TypedRows. Both new tests fail on origin/main.

Left for the next slices: wedding "Name your wedding" step + required parts + "Not decided yet" inside the
dropdowns (rows 36–37), the other steps onto the parts, then the open-shop notes (Claim it ⇒ Owner,
uniform ActionButtons, Customize ›).

SPEC IMPACT: None — builds the approved prototype. (HOUSE_TEMPLATES T32's "Guard: NO GUARD" line can name
`app/onboarding/the-steps-wear-one-template.test.ts` once this ships — left to the controller's corpus pass.)
