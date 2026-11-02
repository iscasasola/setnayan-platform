## 2026-08-06 · fix(vendor-page): ask a first-time enquirer what kind of event, instead of assuming a wedding

A visitor with no account who inquires from a vendor's public page was always
routed to `/onboarding/wedding`. Someone asking a caterer about their mother's
60th birthday was marched into planning a **wedding** — and nothing failed: the
flow completed, the vendor received the inquiry, the event was simply the wrong
kind. There is no natural detector for a silent wrong answer, so it got one.

Owner ruling 2026-08-06, verbatim shape: *"logged in? if yes proceed. if no,
create account · for what type of event? then onboarding."*

**What changed**

- `anon-inquiry-composer.tsx` asks **"What kind of event"**, fed from the LIVE
  vocab (`getCreatableEventTypes()`) — 16 active types in prod today, never a
  hard-coded list. The field starts EMPTY and an unanswered one is refused, so
  an untouched dropdown can't silently become whatever sorts first.
- Non-wedding types hand off to the create-event picker with `?event_type=<key>`
  rather than to `/onboarding/<key>` directly. **Why:** resolving a type's
  onboarding is a three-branch rule (explicit `onboardingHref` → the generic
  experience flow when its flag is on → the inline name form) that already lives
  in `event-type-picker.tsx` and auto-advances on its `preselect` prop. The third
  branch **is not a URL at all**, so a naive `/onboarding/${key}` 404s for every
  type whenever `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` is off. Handing over the key
  reuses the live rule including its fallback.
- An empty vocab keeps the previous wedding path rather than dead-ending behind a
  question with no answers in it.

**Verified**

- `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` was checked against **live prod**, not its
  default: `/onboarding/birthday` returns 200 and renders "Plan your event". The
  in-code default is OFF, so trusting it would have wrongly ruled this fix unsafe.
- `safeNext()` preserves a query string, and signup threads `next` through the
  form and OAuth to its final redirect — the chosen type survives the round trip.
- Typecheck clean (exit 0, 0 errors) with deps installed in the worktree.
- 🛡 `anon-inquiry-event-type.test.ts` (5 assertions) — and **each was broken on
  purpose to prove it fires**. The first cut of the "starts empty" assertion used
  a bare `useState('')`, which also matched the email and message fields and
  stayed green through the exact bug it guarded. Tightened to name
  `eventTypeKey` specifically; re-sabotaged; it now fails.

**Not changed, deliberately:** the account requirement itself. The owner
re-affirmed that Get in touch needs an account. The known cost stands and is
recorded here rather than silently accepted — a composed inquiry lives only in
the visitor's own browser for 48h and nothing server-side records that they
existed, so anyone who abandons signup is lost with no trace for the vendor to
follow up.

SPEC IMPACT: DECISION_LOG.md — new row 2026-08-06 recording the owner's
account-required flow and the event-type question replacing the wedding
assumption.

## 2026-08-06 · fix(vendor-page): the CTA is "Inquire" — one word, matching Share

Owner, verbatim: *"inquire and share buttons are the buttons CTA. Inquire instead
of Get in touch."*

- The three CTA buttons read **Inquire** (were "Inquire Now") so they sit level
  with **Share** — two one-word actions, not one verb phrase and one word.
- The section they scroll to is headed **Inquire** (was "Get in touch"). The
  "Not yet bookable" alternate heading is unchanged.
- The `#get-in-touch` anchor id is deliberately UNCHANGED — five places link to
  it and it is never read by a visitor, so renaming it would risk five dead
  in-page jumps to change nothing anyone can see.
- Three stale comments describing the old label were corrected in the same pass;
  a comment that names a button that no longer exists is how the next reader
  learns the wrong name.

SPEC IMPACT: None — copy only, no decision or price changes.

## 2026-08-06 · fix(vendor-page): a top-plan shop showed TWO Inquire buttons

Owner, on seeing the page: *"why is there 2 inquire buttons?"* He was right, and
it is the shipped page, not the mockup.

When the **cinematic hero** renders (Enterprise + a chosen hero photo) it carries
its own Inquire. The action row a few centimetres below carried a second,
identical one. The block between them already suppresses the **name and tagline**
when that hero renders — precisely because the hero shows them — and the BUTTON
was simply missed when that suppression was written.

So the shops paying the MOST were the only ones with a duplicated call to action,
and nothing failed: both buttons worked and scrolled to the same place.

- The action-row Inquire is now dropped when the cinematic hero renders.
- 🔑 **Share is deliberately NOT dropped with it.** The hero has no Share button,
  so suppressing the whole row would leave a top-plan shop with no way to be
  shared at all — trading a cosmetic duplicate for a lost feature.

🛡 `one-inquire-button.test.ts` — pins the count at exactly three (hero · action
row · desktop sticky rail), pins the mutual exclusion, and pins Share OUTSIDE the
guard. **Both failure modes were reproduced on purpose to prove it fires:**
ungating the duplicate fails 2 of 3; widening the guard to swallow Share fails 1.

A visual duplicate has no natural detector — CI cannot look at a page — which is
why this one survived to be caught by eye.

SPEC IMPACT: None — a rendering fix, no decision or price changes.
