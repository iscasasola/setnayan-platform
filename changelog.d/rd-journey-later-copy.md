## 2026-10-22 · fix(copy): four journey words say what happens — sign-up, supplier Email line, welcome email, "For whom?"

Owner 2026-10-22, "yes to all" on `prototypes/journey_fixes_later_2026-10-22.html`:

- **Sign-up copy (A).** The card says **Your account · Create your account. · Create account · free**; the email
  example is **you@email.com** (the sign-in card's own). "User account" was our internal tier word and the card
  also serves `?as=vendor`. The forgot-password door carried the same `you@setnayan.com` example and now matches,
  so every account door shows one example (same ruling, one more door).
- **Supplier 4a (A).** Settings › Notifications › Email reads **Bookings · payments · messages after your yes** —
  what `EMAIL_ENABLED_TYPES` really emails. The old line promised mail "when a couple writes" (the first inquiry
  is app + phone only) and "when a fee is due" (no such notification exists), and truncated on a phone.
- **Supplier 4b.** The existing welcome email's one bullet links to Today (`/vendor-dashboard`, where
  `becomeVendor` lands a new shop) and says Today shows the next step. Same email, no new email.
- **"Para kanino?" → "For whom?"** on the create-event picker's gated life-type sub-field (2026-10-07 English ruling).

Guard: `apps/web/lib/the-journey-words-say-what-happens.test.ts` — properties, not phrasings: one email example
across the account doors and not on our domain · the sign-up card names no tier · every part of the Email line maps
to allowlisted notification types (read from source) and fits a 375 px row · the welcome link is `becomeVendor`'s
landing · no Tagalog ask in the picker's labels. Sabotaged 7 ways, each red, restored green.

SPEC IMPACT: None (copy to an approved prototype; DECISION_LOG row "JOURNEY FIXES — THE LATER LIST" records the ruling).
