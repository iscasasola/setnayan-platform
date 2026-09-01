## 2026-09-01 · fix(live-studio): a camera's picture reaches the controller

**One missing GRANT was the whole defect.** No camera had ever put a picture on the Live
Studio controller — `panood_broadcasts` and `live_studio_roam_streams` are both 0 and
always have been. Claim, binding and heartbeat all worked; media never arrived.

Measured against prod (`origin/main` @ `7d6206679`), both ends of the private signalling
channel were refused:

```
CHANNEL_ERROR — Unauthorized: You do not have permissions to read from
                this Channel topic: panood-rtc:044f7e64-…
```

…while `public.panood_rtc_can_access()` returned TRUE for the exact uid being refused.
The predicate was never the problem. Running the check the way Realtime runs it — as role
`authenticated`, with `realtime.topic` set to a `panood-rtc:` topic — gives the answer:

```
ERROR: 42501: permission denied for function live_studio_guest_rtc_can_access
```

Every private topic shares one table (`realtime.messages`) and therefore one set of
policies. Postgres OR-evaluates the permissive policies on a table, and a policy that
RAISES is not "this policy said no" — it fails the whole check. `authenticated` had lost
EXECUTE on `live_studio_guest_rtc_can_access`, the predicate behind a *different* topic
family, so it refused **every** private channel the product has: Live Studio cameras
(`panood-rtc:`), guest-pick (`panood-guest:`) and 1:1 calls (`call:`). The homepage
two-phone demo kept working because `lib/demo-webrtc.ts` uses a PUBLIC channel, which
consults no policy at all — which is exactly why the network, STUN/TURN and the camera
hardware each exonerated themselves: none of them was ever involved.

The grant was removed by `20271031571953_sec_close_final_anon_rpc_survivors.sql`, whose
header records the reason: *"live_studio_guest_rtc_can_access NO caller → closed
completely"*. 🔑 **It has no caller in TypeScript. Its caller is an RLS policy, written in
SQL, on a table in another schema** — so a grep of `apps/` found nothing and read as proof
of absence.

**Proof (same script, same two authorized sessions, eleven seconds apart, one GRANT
between them):**

| | subscribe | signalling messages delivered |
|---|---|---|
| private `panood-rtc:` before | CHANNEL_ERROR / CHANNEL_ERROR | 0 |
| private `panood-rtc:` after | SUBSCRIBED / SUBSCRIBED | 2 |
| public `demo-rtc:` control | SUBSCRIBED / SUBSCRIBED | 2 (both runs) |

**Shipped**

- `supabase/migrations/20271187719883_realtime_policy_predicates_are_callable.sql` —
  restores `GRANT EXECUTE … TO authenticated` (and only `authenticated`; the `anon`
  revocation stands). Idempotent.
- `apps/web/tests/db/realtime-policy-predicates-are-callable.db.test.ts` — guards the
  CLASS: every predicate any `realtime.messages` policy names is discovered from the
  migrations and asserted EXECUTE-able by `authenticated`. A fourth private topic family
  is covered the day it lands. The three existing authz db-tests call their predicate as
  the replay owner, so they prove its LOGIC and never the caller's PRIVILEGE — all three
  stayed green throughout the period in which no transport could carry a frame.
- `apps/web/lib/panood-signal-status.ts` · `cameraLinkNotice()` — the operator's footer
  sentence, moved out of nested JSX ternaries. **The refusal branch shipped inert:**
  `publishPanoodCamera` reports a refusal through `onSignalRefused` *and* `onState('failed')`,
  and the page tested `link === 'failed'` first, so `SIGNAL_REFUSED_NOTICE` could not render
  on any input. The old guard asserted that `signalRefused` appeared *before* the
  "connecting…" copy — true, and blind to the branch above both. 🔑 **A guard on adjacency
  cannot see precedence.** The replacement asserts the returned sentence across all 20
  input combinations.
- The network sentence is gone. *"couldn't reach the controller on this network — try the
  same Wi-Fi as the operator"* named a cause nobody had measured and prescribed an action
  TURN exists to make unnecessary; two sessions went into AP isolation and TURN pricing,
  and the fault was authorization both times.

**THE EXPOSURE BASELINE MOVES BY ONE LINE, DELIBERATELY.** `exposure-freeze.db.test.ts`
caught this fix re-widening the anon/authenticated surface and refused to go green — which is
the guard working. The regenerated baseline adds exactly one fact and nothing else:

```
func  public.live_studio_guest_rtc_can_access(p_topic text)  secdef=yes exec=authenticated search_path=public, pg_temp
```

That is the whole trade, in the file built so a human can see it: Realtime evaluates policies
as `authenticated`, so the predicate must be EXECUTE-able by that role, and PostgREST then also
publishes it at `/rest/v1/rpc/`. What an authenticated caller gains there is **one boolean** —
whether guest-pick is live for an event id they already hold. The capability to watch comes
from the RLS policy, which exists either way. `anon` stays revoked, and this is the same
posture the sibling `panood_rtc_can_access` has had in the baseline all along.

**RECOMMENDED FOLLOW-UP (its own PR, needs owner sign-off):** if that boolean should not be
REST-callable, the fix is to move these predicates into a schema PostgREST does not publish and
repoint the policies at them — RLS can still call them, `curl` cannot. That is a change to the
security model for all three private-channel predicates, not a bug fix, so it is not bundled
here.

**OWNER QUESTION (surfaced, not decided):** `20271031571953`'s *other* concern is real and
is not resolved by a grant — `live_studio_guest_rtc_can_access` returns TRUE for any
signed-in session (native-anonymous included) while a roam zone is live and guest-pick is
on, so an event id from a guest-facing URL is enough to watch. It applies equally to the
two sibling predicates. Revoking EXECUTE did not answer it either; it silently broke all
three transports instead. The real fix, if the owner wants it closed, is to move these
predicates out of the PostgREST-exposed `public` schema so RLS can still call them while
REST cannot.

SPEC IMPACT: None — no product behaviour, price, SKU or copy decision changes; this
restores the authorization posture migration `20271006520000` shipped.
