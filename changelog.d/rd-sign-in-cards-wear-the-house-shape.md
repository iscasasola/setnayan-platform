## 2026-10-22 · fix(auth): the sign-in, create-account and You cards wear the house shape; the Terms tick sits just above "Create user account"

Owner 2026-10-22, on the live /signup at 375 px — "do both":

- **Shape.** /login, /signup and /signup/you had square corners, square email / password fields and a 3px
  terracotta stripe on top. Nobody chose square: `.hr-ov-card` asks for `var(--hr-r22)` and `.hr-si-input`
  for `var(--hr-r10)`, but that scale is declared on `.home-reskin` only, and the cards render inside
  `.home-reskin-ov` outside it — the vars were undefined, so both radii computed to 0. Scoped under
  `.sn-signin-terra`, the card now takes the app's popup radius `--m-r-lg` (= `rounded-2xl`, ConfirmDialog)
  and the fields + status banners the app's field radius `--m-r-sm` (= `rounded-md`, `.input-field`, and
  the Google / Apple buttons on the same card). The top stripe is gone, light and dark. The SETNAYAN
  wordmark (`FirstRunBrand`) stays on top of /signup and the You card. Measured in Chromium + WebKit at
  320 / 375 / 430: card 22px, fields 8px, no stripe, no horizontal scroll.
- **Tick placement.** /signup's one Terms tick (#6764) moved inside the email form, just above
  "Create user account · free": choose how (Google · Apple · or email + password) → agree → create.
  Google / Apple stay dimmed until it is ticked; pressing one unticked still says "Tick the Terms first."
  and now scrolls the box into view (smooth unless reduced motion) and focuses it. The box is still
  unticked, `required`, server-checked, never `data-password-only`. /login has no tick and gets none.
  The phone app's native Google / Apple code is untouched.
- Guards: new `app/signup/the-sign-in-cards-wear-the-house-shape.test.ts` (radii read from ConfirmDialog /
  `.input-field` through tailwind.config, tokens on `:root`, no stripe, all three cards, the gate scrolls
  and the dim stays pressable); `one-tick-covers-every-door.test.ts` positions updated (box below every
  door and both fields, above the submit, inside the form, label never folds away);
  `seam-invariants.test.ts` drops the 3:1 check on the retired stripe. 14 sabotages, all red.

SPEC IMPACT: DECISION_LOG.md row 2026-10-22 "sign-in cards wear the house shape; the Terms tick sits just above Create" (owner "do both").
