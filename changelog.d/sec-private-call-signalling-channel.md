## 2026-08-06 · sec(calls): the couple↔vendor call channel was PUBLIC — a missed back-port, now closed

### The hole

`lib/call-webrtc.ts` opened its Supabase Realtime signalling channel
(`call:{threadId}`) as a **public** channel. Supabase evaluates RLS on
`realtime.messages` for **private channels only** — a public channel bypasses it
entirely. So anyone who learned a thread id could subscribe to that
conversation's SDP offer/answer and ICE candidate exchange, and publish into it.

It is live: the in-thread **Call** tab and the **appointment join** button.

### 🔑 This was a missed edit, not a decision

The identical exposure was found and fixed on the Live Studio transport on
**2026-07-21** (`c98636b2a` + migration `20270829134804`), whose own docblock
states that `private: true` is *"a SECURITY REQUIREMENT, not a preference."*

That fix was correctly carried into the **newer** sibling
`lib/panood-guest-webrtc.ts` (created 2026-07-26) — and never reached
`lib/call-webrtc.ts`, which is **older** (2026-07-10) and was last touched
2026-07-14, a week before the fix existed.

**Five near-identical WebRTC transports. The security edit landed on two.**
Nothing failed, because nothing tested the other three.

### Both halves, together

1. **Migration `20271118012278`** — `call:%` policies on `realtime.messages`.
2. **`private: true`** on the client channel.

⚠ **One alone is worse than neither.** The flag without the policy authorises
nobody and takes every call down; the policy without the flag is inert. Both are
in this PR, and both files say so.

### The predicate delegates rather than restates

`call_rtc_can_access()` is **SECURITY INVOKER** and simply asks whether the
caller can `SELECT` the thread row — so the answer is decided by
`chat_threads_member_read`, the policy that already defines who may read this
conversation. Restating that rule here would create a second copy that drifts the
first time thread access changes, and this repo has a documented history of
exactly that. Delegating makes *"can join the call"* definitionally equal to
*"can read the conversation."*

⚠ **Deliberately NOT `SECURITY DEFINER`.** The panood equivalent had to be —
a camera operator cannot read the rows proving their own membership. No such
asymmetry exists here, and definer would silently widen this to anyone who can
name a thread id. The test asserts `prosecdef = false` for exactly that reason.

### 🚨 Found on the way: a canonical helper is a live stub

`public.current_thread_ids()` — one of the four documented canonical RLS helpers
— is **still the placeholder in production**: `SELECT NULL::UUID WHERE FALSE`.
It returns nothing, to everyone, today. **Zero policies currently use it**, so
nothing is broken — but any future policy written against it would authorise
nobody, silently. Not touched here (a security migration should change exactly
what it claims to); flagged for its own change.

### Verification

New `tests/db/call-rtc-authorization.db.test.ts` — 5 tests asserting the
predicate **refuses**: anon, another transport's topic, malformed ids, an
unanchored prefix lookalike, a well-formed id the caller cannot read. Plus both
policies present and gating, and the client flag set.

**Sabotage-verified, both halves:** reverting the client to public fails it;
switching the predicate to `SECURITY DEFINER` fails it; restoring passes.

`tsc` exit 0 · migration guard passes · full migration replay applies cleanly.

⚠ **Not covered, on purpose:** `lib/mesh-call-webrtc.ts` (`mesh:{room}`) is also
public, but its only consumers are `/prototype/mesh-call`. Worth closing when
that prototype ships.

SPEC IMPACT: None — closes an exposure, changes no product behaviour.
