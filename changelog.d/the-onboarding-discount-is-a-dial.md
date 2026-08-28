## 2026-08-28 · feat(admin): the set-up discount is a dial you can turn any day

Owner: *"we want the onboarding discount to be editable on admin."* then, on
seeing the first attempt: *"I want to be able to change 10% anytime. so I can set
discount on onboarding today and change it tomorrow. or anytime i want."*

The price screen had never heard of `onboarding_price_php` — the column that
decides what anything costs during the create flow. It does now, per row. But the
first answer to "editable" was a one-shot sweep, and that is a **stamp, not a
dial**: it does not follow a reprice, it never shows what the discount currently
is, and it can only ever deepen — a stored 10%-off price is cheaper than a 5%-off
calculation, so turning it down does nothing, silently.

So the **percentage is the stored rule** (`platform_settings.onboarding_discount_pct`,
default 10, beside the Setnayan Pay fee it copies) and every set-up price derives
from it. Change it today, change it tomorrow; every price moves in the same
instant. The sixteen stamped Papic prices are cleared, because a stored copy of a
derived value is exactly what stops a rule being editable. Setnayan AI's four
overrides survive — those are decisions somebody made, and clearing them would
silently raise four prices.

One shared function prices the card and the charge, so a screen cannot quote a
figure the checkout will not honour.

SPEC IMPACT: `Pricing.md` § 00 — the sign-up discount is now an admin-editable
setting rather than sixteen stored prices. No amount changes today.
