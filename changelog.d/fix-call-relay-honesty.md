## 2026-08-06 · fix(calls): tell the truth about why a call didn't connect

Two hardcoded claims in the call room, both shown to a couple, both destined to
become lies the moment the relay keys are set:

- the status line: *"Couldn't connect — try again, or get on the same Wi-Fi
  **(no TURN yet)**."*
- the explanation below it: *"Media is peer-to-peer with **STUN only** … a
  **TURN relay** later fixes those."*

`STUN` and `TURN` are engineering words on a screen a couple reads. Worse, both
sentences assert a permanent fact about the deployment — so the day someone adds
`CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN`, the app keeps telling
people there is no relay. The transport's own docblock carried the same stale
claim ("STUN-only, no TURN").

### Derived, not declared

`getCallIceServers()` now returns `relayAvailable`, and the copy is built from
it. A failure with a relay says *"try again"* — that IS the honest advice, since
the failure is a transient. A failure without one gives the same-network hint,
which is the only thing that will actually work.

🔑 **MEASURED, not configured.** `turnConfigured()` in `lib/turn.ts` answers "are
the keys present" — and **had zero callers**, so nothing ever asked it. Measuring
the actual mint is the better question anyway: keys can be set while Cloudflare
errors, the membership check can fail, or the mint can time out. All three end
with no relay, and the person on the call experiences them identically.

Defaults to `true` on a failed ICE fetch, so a transient error never accuses the
deployment of a misconfiguration it may not have.

### ⚠ The real blocker is not code

TURN is fully built and wired. It needs two secrets set in the deployment
(`.env.example` documents both as an owner action). **Without them there is no
relay at all** — and calls fail for anyone behind carrier-grade NAT, which is
most mobile data in the Philippines. This PR makes that state *honest*; it cannot
make it *work*.

SPEC IMPACT: None — copy and a derived flag; no product decision changed.
