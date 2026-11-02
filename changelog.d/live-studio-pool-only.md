## 2026-07-27 · feat(live-studio): pool-only — close the BYO consent door so Google verification is not required

Owner: *"we want this fixed"* — the fix for needing Google OAuth verification at all.

**The mechanism, in one line.** Google waives verification (brand, sensitive-scope,
the unverified-app screen, the 100-user cap) when the consent screen's audience is
**Internal** — and Internal means *only members of your own Google organisation may
authorise*. Live Studio can satisfy that under the pool model, because only Setnayan's
admin account grants consent. **The entire exemption hangs on one door:**
`/api/oauth/youtube/start`, where a couple connects their OWN channel and a
`@gmail.com` user reaches the consent screen. That door is the difference between "no
verification, ever" and the full review pipeline on a SENSITIVE scope, re-triggered by
every branding change.

`NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY` closes it.

- **Refused by the ROUTE, ahead of auth and ahead of any Google call** (409, not an
  error page). A UI-only hide would leave the URL reachable by hand — and the property
  being protected is "no non-org user reaches the consent screen", not "who may click".
  With an Internal client Google would refuse them anyway with `org_internal`; this
  turns that dead end into a plain sentence.
- **Neither couple-facing surface renders a Connect button the server would refuse** —
  the setup page and the Wave 8 controller sheet both read the same shared notice
  constant, so the copy cannot drift between them or from what the route returns.
- **The notice is not an error and asks nothing of the couple.** Nothing went wrong,
  there is no retry, and there is no support action — Setnayan supplies the channel
  now, which is less work for them. Tested for the absence of "try again"/"contact us".

**🚨 SEQUENCING — the flag is DEFAULT OFF and must stay off for now.** Production holds
**0 pool channels and 0 platform grants**, and the only YouTube grant that ever existed
is revoked — so BYO is the only path that has EVER run. Flipping this on today would
leave Live Studio with **no route to air at all**: it would close the only working door
in the name of closing the door. Flip only once (1) a Setnayan channel is phone-verified
with live streaming enabled (gate G1, includes YouTube's 24-hour wait), (2) it is
connected at `/admin/live-studio-channels` so both pool tables hold a row, and (3) the
OAuth client belongs to an Internal-audience project. That ordering is written into the
module header and pinned by a test.

**Existing consents are NOT revoked.** This closes the door to NEW connections only;
`goLivePanood` keeps its BYO fallback, so a couple who connected before the flip keeps
broadcasting — the same grandfathering shape as the Cast SKU retirement (#3716: hide the
buy, honour the order). A test pins that go-live does not consult this flag.

**⚠ The trade, stated:** on a Setnayan channel the couple is not the channel owner, so
they cannot download the recording from YouTube Studio. That is the open pool-side
file-handoff question (spec § 4k) and this makes it more pressing, not less.

6 new tests, **neutralisation-verified** (deleting the gate fails the test that guards
it). 4246/4246 unit green with the flag OFF **and** ON, typecheck + lint + production
build pass. No migration.

SPEC IMPACT: `DECISION_LOG.md` 2026-07-27 — the verification requirement is now a
product boundary we control rather than a Google queue we wait in.
