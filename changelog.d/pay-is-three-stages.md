## 2026-09-20 · feat(pay): the payment page is three stages, one at a time

Owner ruling, 2026-09-20. Measured that day: three `section.sn-tile` blocks rendered at
once, **~2,039px tall** — numbered like steps but shown together, **including the
proof-upload form for a payment nobody had made yet**.

1. **What you're paying** — the item, the exact amount, the reference, who it goes to.
2. **Pay** — the code, the manual account details, the copy controls, and the honest line
   about what the code carries.
3. **Send your proof** — the screenshot and the reference digits.

**RULE 0** — `app/open-shop` is this repo's stage flow and its `?step=` spelling is reused
rather than a second one invented. New `lib/pay-stages.ts` holds the rules as functions that
can be RUN: `parseStage`, `nextStage`/`prevStage`, `stageHref`, `advanceLabel`,
`shouldMountProof`.

**The stage lives in the URL**, and three things fall out of that with no code written for
them: **browser Back works**, each stage is **linkable**, and with JavaScript off or still
loading the **server** paints the right stage — every advance control is a real `<a href>`
that the component only intercepts once it is interactive.

**⚠ Nothing is unmounted on the way back.** `shouldMountProof` keeps the proof form in the
document from the moment its stage is first reached, so going back to re-read the code and
returning does not empty the picked file and the typed digits — a file input and React state
both die on unmount and neither says so. Before that stage it is genuinely **absent**, which
is the other half of the ruling.

**Nothing was lost in the split**, and it is asserted rather than asserted-to-be: the manual
account numbers, the ₱10–15 transfer-fee warning, the "save it to your photos" note and the
honest QR line all stay on stage 2; the 24-hour promise stays on stage 3; `?setup=1`,
`?recheck=` and `?error=` ride along every stage link. Stage 1 gained **"Show all the payment
details"** so nobody who just wants a number is forced through three taps.

Two things were deleted as **second derivations of one fact**: the sticky bar's scroll
listener (it guessed the step from scroll position because every step was on one page — the
stage IS the answer now) and `jump(id)` (there is nothing to scroll to).

**Guards** — `app/pay/[reference]/_components/one-stage-at-a-time.test.ts` (12). It **mounts
the panel** and reads the emitted HTML, because the ruling is about what is on screen.
Sabotage-proven five ways: dropping `hidden` from a stage → 1 fail; mounting the proof form
from the start → 3; unmounting it on the way back → 1; renaming `href` to `data-href` so the
control needs JavaScript → 2; `stageHref` dropping the carried query → 1.

🪤 **Two assertions were measured to prove nothing before they were fixed.** `screenshot_ref`
is absent at *every* stage — `<FileUpload>` only mirrors its value into a hidden input once a
file exists — so that check would have passed on its own stage too; it is anchored on the
dropzone's label and `type="file"` instead. And `href="…"` is a **substring of**
`data-href="…"`, so the JavaScript-off sabotage first read green; both guards now require the
leading space.

`app/pay/one-payment-page.test.ts`: "every step is reachable" re-anchored — the old literals
("Show me the QR code") describe a page that no longer exists, but the property is identical
and is now asserted against `PAY_STAGES` plus the presence of real links.

🪤 The advance label was written twice and the copies differed by **one invisible character**
(`’` vs `&rsquo;`). `advanceLabel()` is the one source now.

SPEC IMPACT: None — the payment flow, its action, its validation and the booking-fee
reference rule are unchanged. Only the order things appear in.
