## 2026-08-10 · fix(auth): the Facebook sign-in button is off the front door — it answered 400

Owner 2026-08-10: *"we will add this but after all is built."*

### Measured on the live site, not read from the code

All three buttons render at `https://www.setnayan.com/login`. Probed directly
against the auth server:

| provider | response |
|---|---|
| google | **302** — configured |
| apple | **302** — configured |
| **facebook** | **400** — a first-time visitor fails at the FIRST screen |

Nobody had pasted the Meta credentials into Supabase. The flag was offering a
door with no room behind it.

⚠ **Reading the code would never have caught this.** `oauth-button-row.tsx`'s own
docblock says the flag "ships OFF" — true of the default, false of production,
where it is ON. Only asking the live server settled it.

### 🔑 A flag says "show it"; it cannot say "it works"

Two different facts, so now two different switches. The env flag carries the
OWNER'S INTENT; the new `FACEBOOK_PROVIDER_CONFIGURED` constant carries WHETHER
THE PROVIDER EXISTS. Both must be true to render the button, so an env var set in
a hurry can never again put a dead door on the first screen a stranger sees.

**Fixed in code rather than by flipping the flag** deliberately: a code change
deploys on merge, while an env change needs the owner in the dashboard *and* a
redeploy. This removes the broken button today without waiting for anyone.

**To re-enable:** paste the Meta credentials into Supabase Studio, confirm
`…/auth/v1/authorize?provider=facebook` answers 302, then set the constant to
`true` on BOTH surfaces in the same change. That instruction lives next to the
constant, where the next person will read it.

### Guard — mutation-tested

| sabotage | result |
|---|---|
| flip one surface's constant on | ❌ 2 fail (including the two-surfaces-agree check) |
| revert a surface to the flag alone | ❌ 1 fail |
| baseline | ✅ 4/4 |

One test exists purely to stop the phone row and the desktop row disagreeing —
that would show the button on one device and not the other. Another stops a
future sweep dragging Google and Apple into the same hard-off: both answered 302
and must stay.

### Verified

**7291 / 7291** unit tests · `tsc --noEmit` clean · 19 lint scripts pass.

SPEC IMPACT: None — the owner ruling is already in `DECISION_LOG.md` 2026-08-10.
