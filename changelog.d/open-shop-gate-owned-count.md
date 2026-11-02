## 2026-08-10 · fix(vendor): the shop door is gated on shops you OWN, not on shop ACCESS

Third and final follow-up to the `/open-shop` doorway (PRs #4328, #4332). This
one fixes a defect in my own work from the same day, found while answering the
owner's question *"we do have options for 1 account to have multiple shops?"*.

**The bug.** Both new doorways were gated on `!hasVendorAccess`. That flag is
true when the user owns a shop **OR sits on any `vendor_team_members` row**.
So a team member who owns nothing — a second shooter, an assistant, anyone a
vendor added to their team — had the "Create your shop" door hidden from them,
even though `MAX_SHOPS_PER_USER` allows them one. Exactly the people most
likely to want their own shop.

**The fix.** Both gates now read `canOpenShop`, which counts only shops the
user OWNS against the cap. That flag already existed and its own docblock says
it is the thing that "gates the visible '+ Open a business' action" — it simply
had no consumer until now. Plumbed through `SwitcherContext` for the switcher;
`roles.canOpenShop` was already on the launcher's role summary. All six
degraded-read fallback contexts fail closed (`canOpenShop: false`).

Prod impact: **none**. 1 team seat total, 0 people owning no shop. Latent, and
caught the same day it shipped.

**Also corrects a stale readiness claim in `lib/shop-limits.ts`.** It said the
resolver seam for multi-shop was "already in place". Measured instead:

- `fetchOwnVendorProfile`, the named seam, **does not exist** — no such export
  anywhere. It survives only in comments. There is no active-shop resolver and
  no `/vendor-dashboard/[shopId]` segment.
- **43 call sites** app-wide (14 inside `/vendor-dashboard`) each resolve "my
  shop" independently with `.eq('user_id', …)`. Each returns exactly one row
  today and becomes ambiguous the moment a user owns two.
- **26** prod policies scope by single ownership; 37 already use
  `current_vendor_ids`. So the doc's "~28" was sound — the "seam is in place"
  sentence was not.

🔑 A comment claiming readiness is not readiness. Having the LIST of your shops
is not the same as the app knowing WHICH shop you are acting as.

⚠ My own first count of those policies was over-broad (66) because it matched
any policy mentioning the shop table. The accurate figure is 26. Reported and
corrected in-session rather than left standing — an inflated number in a
readiness note is the same failure as a stale one.

**Owner decision, recorded:** multi-shop stays at **1** (re-confirmed
2026-08-10 after reading the above: *"ok. let's leave it to 1."*), consistent
with the original 2026-07-09 lock. No code change — the dial already reads 1.

SPEC IMPACT: None. Re-confirms an existing lock; no price, scope, or decision
changed.
