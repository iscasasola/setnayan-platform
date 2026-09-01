## 2026-09-01 · fix(live-studio): the signalling channel says when it is refused, and is given the JWT it is judged on

**Measured on the only live transport this platform has.** A camera with a healthy
heartbeat, bound to Channel 1, publishing from the SAME BROWSER as the controller — no
network in between — produced no video, no error, and an empty console. Both pages read
*"connecting to the controller…"* for as long as anyone waited.

**Two defects, and the second is why the first cost an hour.**

**1. The private channel was never given the user's token.** `signalChannelConfig()` sets
`private: true`, so Supabase evaluates RLS on `realtime.messages` via
`public.panood_rtc_can_access(topic)` — whose first line is
`IF auth.uid() IS NULL THEN RETURN FALSE`. That uid resolves from the token held by the
**realtime socket**, which is not the session the REST client uses. `realtime.setAuth()`
was called **nowhere in the app** (`grep` returns one unrelated crypto hit), so the socket
carried the anon key and every subscribe on this topic could be refused — publisher and
viewer alike. Both now prime the socket before subscribing, and re-prime per call so a
token refresh mid-ceremony cannot silently downgrade a reconnect to anon.

**2. Both ends discarded the answer:**

```js
.subscribe((status) => { if (status === 'SUBSCRIBED') … })
```

`CHANNEL_ERROR`, `TIMED_OUT` and `CLOSED` were dropped on the floor. Supabase reports them
once and goes quiet, so **a refused channel and a slow one rendered identically, forever.**
Now each is reported — and, on the camera page, *rendered*: the operator reads a sentence
naming one cause and one action instead of an optimistic "connecting…" that never resolves.
🔑 A log line never changed a pixel.

⚠ Failure detection is an **allow-list** of the three terminal statuses, not
`!== 'SUBSCRIBED'` — a status Supabase adds later must not be guessed at as fatal and tear
down a working broadcast mid-ceremony.

**Structure.** The two pure exports live in the new `lib/panood-signal-status.ts` because
`lib/panood-webrtc.ts` reaches `lib/analytics.ts` (`import 'server-only'`) transitively and
is therefore unimportable under `tsx --test`. Same pure/server split as
`live-studio-readiness(.ts/-server.ts)`.

**Sabotage-checked:** neutering the viewer's failure branch turns the wiring assertion red
(5 pass / 1 fail). The pure predicate alone would have proved nothing — the bug was never
in a function, it was two call sites saying nothing.

SPEC IMPACT: None. This is transport correctness and failure legibility; no product
decision changes.
