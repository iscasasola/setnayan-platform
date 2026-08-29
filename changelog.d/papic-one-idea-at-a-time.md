## 2026-08-29 · feat(papic): one idea at a time, and the set-up price is shown

Owner, pointing at a rival's features page: *"this is the style i want. simple,
easy to understand, clean output."*

**Measured what that actually is** rather than guessing at a mood. Their whole
features page is **seven blocks** — a chip, a short name, ONE sentence, and one
picture of the product. No lists, no tables, no numbers, one action at the end.

Ours was **twenty-five features in five dense definition lists with no picture on
any of them** — a specification sheet, not a story. The six strongest now get a
block each with a photograph; the rest survive as one quiet list beneath.

⛔ **The breadth is not deleted** — the same owner asked for exactly that
inventory hours earlier. This is a change of ORDER and WEIGHT, never a cut.
⛔ **The dark gradient, the pinned scroll and the copy are NOT taken.** The
palette is owner-locked and a scroll-jacked hero is the opposite of "simple".
What is borrowed is the STRUCTURE.

### The regular price is crossed out, and the set-up price is shown

Owner: *"we show them the Regular price crossed out and the discounted on
boarding price to be available."* The dial now shows ~~₱1,400~~ **₱980**.

🔑 **It is the SAME function the charge uses** — `setupPricePhp`, which takes the
house percentage and the per-row override and returns whichever is cheaper. The
page does not compute a discount of its own, so it cannot quote a figure the
checkout will not honour, and `hasSetupSaving` means a rung with no real saving
prints nothing rather than a fake strike-through.

⚠ **The saving is CONDITIONAL and the page says so** — *"while you are setting
your celebration up"*. That is the owner's own rule (2026-08-28: *"they can order
later, but they will lose the discount"*). A struck-through price with no
condition attached reads as a permanent sale and would be false the moment
somebody tops up mid-party — which the panel directly above it invites them to do.

⚠ **Nothing is hardcoded.** The percentage is read from
`platform_settings.onboarding_discount_pct` on every request, through the shipped
`readOnboardingDiscountPct`, which fails to the module's default rather than to
zero — a read error must not silently retract a saving the page is advertising.

✅ **THE PERCENTAGE IS THE OWNER'S, AND IT IS 30 — a correction to my own first
reading of this.** I checked `platform_settings.onboarding_discount_pct` (10) and
told him the value had not changed. That is the HOUSE/AI setting. Papic has its
own, set on the very tab he pointed at: **`platform_settings.papic_signup_discount_pct`
= 30.00**, and it is the one that produces each rung's stored
`onboarding_price_php` on save (owner 2026-08-28: *"Papic will also have that 1
discount savings instead of each row"*).

So the chain is: **his 30% dial → each rung's stored sign-up price → the page.**
Nothing is hardcoded and nothing is stale; I had simply read the wrong column and
reported a stale value that was not stale.

🔑 **The call itself was right for a different reason, and is left exactly as
written:** `setupPricePhp(retail, onboarding_price_php, housePct)` is
**byte-identical to the charge path** in `onboarding-services-orders.ts` — same
function, same two inputs, same house percentage. That is the point. A page that
reproduces the charge's own call cannot quote a figure the checkout will not
honour, whichever layer moves next.

⏭ **NOT BUILT — the 100,000-credit rung.** It does not exist (the ladder stops at
50,000) and adding one is three places, not a page edit: the catalog row, the tier
row, and a line in `sku-activation.ts` — a sellable rung missing from that map
takes the money and grants zero credits, silently. It also needs a PRICE, which is
the owner's to set; and another session is actively repricing this catalog right
now (retail moved under this page mid-session: 100 credits went ₱50 → ₱70).

11,355 unit tests green (exit 0) · typecheck exit 0 · every blocking lint green.

SPEC IMPACT: None — no price is changed here, only displayed.
