## 2026-07-26 · feat(guest-site): Pahina wave A PR-4b — the RSVPed keepsake fork

Fifth PR of the Pahina wave-A reskin (design §11, build plan §4). Targets the wave branch.

Once a guest has replied "attending", the ask stops shouting and the same stock they replied on
comes back as a **stamped keepsake** — rotated "Joyfully accepted" rubber stamp, gild `Nº`, roman
date stub, "{Name} — one seat, reserved" in the display face, perforation rule, and the
table/venue/date meta. Per the owner's five-timeline model this is the page a guest re-opens weekly
until the wedding, so it is built to be screenshot-worthy.

**No new `LifecyclePhase`.** "RSVPed" is a per-GUEST render fork inside the existing `rsvp` phase,
keyed on this guest's own `rsvp_status`. `resolveSiteBodyPlan` is not consulted and
`plan.rsvpShouldRender` is untouched — which is why the plan goldens don't move. Anonymous visitors
have no guest identity, so the fork is structurally unreachable for them; the RA 10173
zero-guest-bytes fence is untouched.

Per-status behaviour:

| Status | What renders |
|---|---|
| `attending` | Keepsake ticket + the form demoted into a quiet disclosure |
| `declined` | A quiet "We'll miss you." line (never a keepsake — the ticket is for people who are coming) + the same disclosure |
| `maybe`, `pending` | The reply card exactly as today — an undecided guest still has a question to answer |

### ⚠ One deliberate departure from the design spec

Spec §11 says the ask is **"Gone. The ask never reappears once answered."** Taken literally that
would DROP the guest's ability to change their reply, meal preference, or dietary notes — a
functional regression the reskin-never-drop rule (build plan §5) forbids, and a real one: people
change their plans, and RSVP is the only place those fields can be edited.

So the form stays, demoted into a `<details>` disclosure headed "Need to change your reply?"
beneath the keepsake. The ask no longer competes with the reward — which is the design's actual
intent — but nothing a guest could do before is lost. Flagged for owner sign-off.

### Deferred out of this PR (both need a decision, see the PR body)

- **The After-Event memento** ("You were there"). The `PahinaKeepsake` component already supports
  it via `variant="attended"` — but the editorial takeover (`phasedBody`) is SHARED by both identity
  tiers, so mounting a guest-only memento there means branching a shared code path that also serves
  anonymous visitors. Worth doing carefully rather than at the end of a long PR.
- **The unified editor's fifth preview tab.** Deferred for a substantive reason, not scope: the
  build spec says to "mirror how the sample event fakes guest context", but investigation found
  **no such mechanism exists** — the sample event is real seeded DB rows, and there is exactly one
  `kind: 'guest'` construction site in the whole route, fed only by `loadGuestContext` past a
  verified guest cookie. A fifth tab therefore requires fabricating a full 15-field
  `GuestSiteIdentity` and rendering guest-tier UI to a viewer holding no guest cookie, gated by a
  new public-route param. That is a new security surface and wants the owner's eyes first.

Verified: `tsc --noEmit` clean · `next lint` 0 errors · **3356/3356** unit + golden tests pass ·
production build compiles (352 static pages). Still no visual pass — owed on the wave preview.

SPEC IMPACT: `Premium_Guest_Site_Design_Spec_2026-07-25.md` §11's "the ask never reappears" line is
amended in practice (see above); logged at the bottom of `DECISION_LOG.md`.
