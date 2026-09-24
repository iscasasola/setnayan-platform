# P6 · The reception will trip the bot check — the venue-NAT throttle

> **Model: Fable · effort: high.** **Build it behind an OFF flag.**

## The problem, and how it was proved

Cloudflare demands an interactive solve when one IP makes many requests quickly.
**That is exactly what a wedding reception is** — 150 guests joining from one
venue WiFi, one public IP.

It was proved **by accident**: a session's own Turnstile probes made Cloudflare
treat the owner's IP as a bot. 🔑 **A probe can change the system it measures.**

## The pattern already exists — copy it, do not invent one

`apps/web/lib/join-door-throttle.ts`, whose own comment says it is **"sized for a
VENUE, not a laptop."** Open it first.

```bash
git grep -n "sized for a VENUE" origin/main -- apps/web/lib
git grep -l "seatClaimability\|join-door-throttle" origin/main -- apps/web
```

## ⚠ This is entangled with an OPEN owner decision — do not resolve it yourself

**Owner decision 2** (see `05_OWNER_DECISIONS.md`): *is a scarce, single-claim,
event-scoped token plus a venue-sized throttle sufficient, given
`seatClaimability()` already checks the token with the admin client and captcha is
a second lock on the same door?*

The join door **already made this exact trade**. That is an argument, not a
ruling. **Build behind an OFF flag** (standing authorisation covers ⚖-rows behind
an OFF flag) and put the question on his desk with what you measured.

## Also relevant, and currently OFF

Turnstile is configured (both hostnames, site key in Vercel, secret in Supabase)
but **switched OFF in Supabase** right now. The mobile lockout that forced it off
is fixed and served (#5581), so turning it back on is **owner decision 1**.

🔑 **Order matters: #5581 served → captcha on → the `/verify` gating question
becomes answerable → then decision 2.** Do not try to answer decision 2 first.

## One more trap specific to this area

🔑 **A control verified outside your app vanishes when the flow moves.** Turnstile
is verified by **GoTrue**, not by us. When password reset moved off GoTrue, the
widget kept rendering with **nobody checking it** — which reads as *more*
protected than having none at all. If you move a flow, enumerate what the managed
provider was doing incidentally.

---

## The rules every one of these prompts inherits

- Read `04_TRAPS.md` before running anything.
- **Never read code from `/Users/icecasasola`** or the primary checkout — both are
  hundreds of commits behind. `git worktree add --detach /tmp/wt-<name> origin/main`.
- **RULE 0** — paste the four searches into your first reply before building.
- **Auto-merge immediately**: `gh pr merge <N> --auto --merge`. Never ask.
- Add a `changelog.d/<branch-slug>.md` fragment with a `SPEC IMPACT:` line.
- **Never weaken a guard to go green** — fix its window, keep its assertion.
- **Probe your runner with a deliberate failure first.** Print the numbers.
- Prune the worktree when the PR merges.
- Test as `testnayan1`, **email + password, never the Google button.**
