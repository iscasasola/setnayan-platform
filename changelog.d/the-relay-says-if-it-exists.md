## 2026-09-01 · fix(live-studio): the host is told whether a camera relay exists

**Measured on the live platform.** Every camera failed with *"couldn't reach the controller on
this network — try the same Wi-Fi as the operator"* — with **all devices already on the same
Wi-Fi** — and there was no way, anywhere in the product, to learn whether a TURN relay was
configured.

`turnConfigured()` had existed in `lib/turn.ts` since TURN landed and was **called by nobody**:

```
grep -rn "turnConfigured" apps/web  →  the definition, and nothing else
```

A gate with no handle. The answer was one boolean away and no surface asked for it.

🔑 **"Same network" is not enough without a relay.** Client/AP isolation — which every guest
Wi-Fi does — and blocked mDNS both defeat host candidates on a single LAN, and STUN cannot
rescue either. So a missing relay is a rule the host must know BEFORE the day, not a
venue-only nicety.

**The controller now says it**, beside the cameras it governs: *"No camera relay is set up.
Every camera phone must be on the same Wi-Fi as this controller — and on a network that lets
devices talk to each other, which guest Wi-Fi usually does not. If a camera says it can't reach
the controller, this is why."*

⚠ **A notice, never a blocker.** Cameras still connect on a network that permits peer traffic;
hiding the grid would take away something that works. Only the boolean crosses to the render —
`CLOUDFLARE_TURN_*` are server-only secrets and stay server-side.

**And a broken relay no longer looks like an absent one.** `mintTurnIceServers` had three silent
`return []` paths — non-OK response, empty body, thrown error — so a rotated key, a revoked
token or a Cloudflare outage was indistinguishable from never having configured it. Each is now
named in the log.

**Sabotage-checked:** pinning `relayConfigured = true` turns the dead-read assertion red
(4 pass / 1 fail).

SPEC IMPACT: None. This surfaces an existing configuration fact; no product decision changes.
Whether to configure TURN — Cloudflare bills per GB, roughly ₱28–56 for a fully-relayed 4-hour
event by the Wave 10 estimate — remains an owner call and touches the ₱0 marginal-cost lock.
