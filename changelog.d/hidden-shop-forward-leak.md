## 2026-08-12 · fix(routing): a suspended shop's retired address disclosed where the shop had moved

Found while verifying the shop forward on the live site, not by a test.

The person branch of the forwarding resolver was taught (2026-08-12) not to
forward a **hidden** profile, because a `307` discloses in its `Location` header
regardless of what the target then returns. **The shop branch was left with the
same hole** — and `app/v/[slug]/page.tsx` already states the rule it was
breaking: *"Hidden + archived vendors 404 from the public surface (don't leak
the existence of suspended / closed profiles)."*

So anyone probing a suspended shop's old address learned its **current** one —
precisely what that 404 exists to withhold. `hidden` is also the resting state
of every shop awaiting approval.

Not a permanent loss: the ledger row is untouched, so the moment the shop is
approved its old address forwards again.

⚠ **Deliberately NOT applied to the event branch.** A private event is not
existence-gated — its address renders a lock screen rather than a 404 (measured
live: an anonymous request to a real event returns 200), so forwarding to it
discloses nothing a direct visit would not. Same-looking values, different
meanings; the comment says so at the site.

**Verified live before and after** with reversible probes on production, then
the probe rows deleted:
- `/v/{oldShopAddress}` → `307 /setnaprod` ✅ (the legacy shop route forwards —
  the fix from the previous PR, now proven on the real site)
- `/u/{oldHandle}` and `/{oldHandle}` for a **hidden** profile → **404**, no
  `Location` header ✅ (no disclosure)

🛡 Guard added and mutation-proved with the sabotage confirmed applied
(`isPubliclyVisible(` occurrences 2 → 0 → one failing test → restored).

SPEC IMPACT: None.
