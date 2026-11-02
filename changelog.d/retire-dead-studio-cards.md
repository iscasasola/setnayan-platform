## 2026-08-06 · fix(live-studio): retire the dead "Live Studio Cast" card — and rehome the only Google-disconnect control before it went with it

The couple's Studio showed **two** live-streaming tiles for one product:

| tile | destination | SKU | catalog state (prod, checked 2026-08-06) |
|---|---|---|---|
| **Live Studio** | `/studio/live-studio-control` | `LIVE_STUDIO` ₱2,999 | `is_active = true` · listed on the public `/pricing` page |
| **Live Studio Cast** | `/studio/panood` | `PANOOD_SYSTEM` ₱2,500 | `is_active = false` since 2026-07-26 · **zero orders, ever** |

The second was a full App Store detail page for something nobody can buy. Its own
2026-07-26 guard already hid the buy button (checkout refuses a retired SKU), so what a
couple actually met was a second Live Studio page with no working control, whose primary
CTA dropped them into the legacy Cast setup tree.

### 1 · The revoke control was wired FIRST, because retiring the page would have taken it

The **only** place in the entire product where a host could disconnect their Google/YouTube
account was a `<form action="/api/oauth/youtube/disconnect">` on
`/studio/panood/setup` — inside the tree being retired. The unified controller
(`/panood/control/[eventId]`) offers **Connect** and no way back out;
`/admin/live-studio-channels` revokes *Setnayan's* pool channels, not a couple's. And
`/privacy` tells the public that control exists.

So `/studio/live-studio-control` — the page the **surviving** tile opens — now carries a
"Your YouTube channel" panel: pool-only notice → not-available-yet → **Connected +
Disconnect** → Connect, plus the `youtube_connected` / `youtube_disconnected` /
`youtube_error` banners the OAuth routes send. The `pool_only` branch is checked before the
generic error branch and reuses `POOL_ONLY_CONNECT_NOTICE`, so the new Connect door
respects the same compliance boundary `lib/live-studio-pool-only.test.ts` pins on the other
two surfaces.

🔑 **The port guard could never have caught this.** `scripts/port-control-baseline.json`
records the legacy setup route's destinations as `[start, /studio/panood, /privacy]` — the
extractor reads `href=`, and Disconnect is a `<form action=…>`. A control no guard can see
is the one to pin by hand.

### 2 · `/studio/panood` is retired — it forwards instead of selling

Replaced with a redirect: flag on → `/studio/live-studio-control`; flag off → the free
single-camera setup screen (what its own CTA did in that state anyway). The retirement is a
fact about a **database row**, not about the flag.

It is a redirect and not a deletion because this path is a live **landing**, not just a card
target: `api/oauth/youtube/callback` and `api/oauth/youtube/disconnect` both send the host
back here by name. Deleting it would 404 someone halfway through connecting — or revoking —
their own Google account. The three `youtube_*` keys are forwarded by name (rebuilt, not
passed through, so it cannot smuggle arbitrary query onward).

`/studio/panood/reviews` is **deleted**: its only doorway was the page above, and nothing
else in the app passes `AppStoreLayout`'s `reviews` prop.

### 3 · A couple who had just paid ₱2,999 was told they were on the free plan

`resolvePanoodTier()` resolves only `PANOOD_SYSTEM` / `PANOOD_SYSTEM_MOBILE`, and the
`SKU_OWNERSHIP_ALIASES` entry is deliberately **one-directional** (a Cast buyer owns Live
Studio; a Live Studio buyer does not own Cast). So `/studio/panood/cameras` greeted a
LIVE_STUDIO owner with *"You have **3 cameras free** to test with. Every feed carries the
Setnayan mark until you unlock Live Studio"* — about the thing they had already unlocked —
and capped them at 3 seats instead of 8.

Both camera surfaces (`cameras/` and `cameras/print/`) now ask the second question too, via
the **admin** client — `orders` RLS is purchaser-scoped, so a co-host who did not place the
order would have read "free" under their own session and seen the same false sentence.

⚠ **Not overstated:** the unified controller mints its own seat per channel
(`bindChannelCamera`, no cap check), so this never capped the live product. It was a false
statement to a paying customer on a legacy screen, not a lost entitlement.

### Verified, not assumed

Prod DB: `LIVE_STUDIO` ₱2,999 active · `PANOOD_SYSTEM` ₱2,500 and `PANOOD_SYSTEM_MOBILE`
₱1,500 both inactive · **0 orders across all four keys** (so no Cast buyer is stranded by
any of this). Public `/pricing` lists "Live Studio ₱2,999" and no Cast row, which is how
`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` was confirmed ON in production rather than inferred
from a changelog.

**The suspended-Google-account claim checked out and changed nothing here.** It gates
`oauthReady`, i.e. whether the *Connect* button lights up. Nothing retired in this PR looks
dead only because of it — the Cast SKU is dead in the catalog, and the duplicate tile is
dead in the UI, both independent of Google.

### Tests

- **New** `lib/live-studio-cast-retirement.test.ts` — 9 assertions, **watched failing 7/9
  before the fix**: the retired page sells nothing and forwards; the `youtube_*` landing is
  not swallowed; the free-tier sentence consults `LIVE_STUDIO`; the print sheet agrees with
  the screen; **and a surface outside the legacy Cast tree still posts to
  `/api/oauth/youtube/disconnect`** — the guard that stops the revoke control disappearing
  again. Opens with a non-vacuity check, because every assertion is text-matched against a
  file path.
- **Updated** `lib/panood-retirement.test.ts` (2 tests) — they described the *conditional*
  buy guard on a page that no longer has one. Rewritten to the stronger property (a page
  that cannot render a buy control cannot render a fake one) plus the half that still
  matters: the ownership alias is intact and the surviving surface still opens the room, so
  a historical Cast buyer keeps their access.

Full suite 6823/6823 · typecheck clean · all 12 lint scripts + `next lint` (0 errors) pass.
`lint:port-controls` needs no baseline regeneration — the retired route lost no recorded
control, and a route that no longer exists is explicitly out of that guard's scope.

SPEC IMPACT: None. No price, SKU, flag or locked decision moves — the Cast SKU was already
retired in the catalog (2026-07-26) and this is the UI catching up. Two follow-ups belong to
other owners and are deliberately untouched here: `lib/routes.ts` still exports an unused
`addOns.panood.reviews` builder for the deleted route, and `lib/add-ons-catalog.ts` still
carries the `panood` "Live Studio Cast" tile itself (it now lands on the real Live Studio,
but the duplicate tile is still drawn).
