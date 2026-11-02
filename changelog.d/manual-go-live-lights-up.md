## 2026-08-12 · fix(live-studio): a host who streams by hand now gets their red light and their paid Moment button

**Three ways to go on air ship today.** Setnayan's one-tap go-live, pasting your own
YouTube watch link, and pasting a Facebook Live link. Only the first left a trace the
control room could read: `isLive` was derived purely from an active `panood_broadcasts`
row, and that table has exactly ONE writer — inside the automatic go-live. The two
paste-a-link routes write only `events.panood_watch_url[_facebook]`.

So a host who started their own stream got **no red "On air" tally** and **no ⚡ Moment
button** — a control they PAID for, gated on `canMarkHighlight()` which requires
`isLive`. Meanwhile the controller's own copy ("Start your broadcast on YouTube, then
paste the watch link") sends them down exactly that route, and until Setnayan's own
YouTube channel exists and its app review clears, `TransportRow` renders **prose
instead of a button** for every host — so by-hand is the only route that works at all.
This is the path a first real customer takes.

**Added:** `events.panood_manual_on_air_at` (migration `20271137667349`) — the instant
the host said, by hand, "we are on air". A new "We're on air / We're off air" switch
under the programme monitor sets and clears it.

**⚠ A TIMESTAMP, NOT A BOOLEAN, AND THAT IS LOAD-BEARING.** `isLive` is an input to the
paid multi-cam window. Its never-interrupt rule is BOUNDED by when the run started, and
`decideBroadcastWindow` treats `isLive` *without* a start as PROTECTED — a deliberate
fail-open so an unreadable clock never cuts a live ceremony down to one camera. Correct
for a real broadcast row; catastrophic for a self-set flag, which is why the module's
own header warns a host could otherwise "let their day expire, press Go live again, and
be handed unlimited multi-cam for as long as they never pressed stop." Storing the
instant means the existing bound applies unchanged.

**🔒 And the instant is stamped by the database, never chosen by the caller.** A
backdated value would buy free multi-cam, so a `BEFORE INSERT OR UPDATE OF` trigger
forces `now()` on every off→on transition and pins it thereafter (re-pressing must not
restart the clock). The column deliberately carries **no** column grant, so the server
actions use the service role behind the existing host check. Turning off is always
allowed — a state you cannot leave is a gate with no handle, which is also why the
switch stays on screen whenever it is ON, even after a host later connects YouTube.

**🪤 The first draft of this migration was a live grenade.** It carried a defensive
`REVOKE INSERT, UPDATE ON public.events`. On this table UPDATE is held
**column-by-column** (147 of 201 columns for `authenticated`; there is no table-level
UPDATE), and in Postgres a table-level REVOKE also drops every column-level grant — it
would have stripped all 147 and broken every write the app makes to events. What is
actually true is simpler: a newly added column inherits **no** grant, which is why 54
existing columns here (`papic_face_mode`, `photo_delivery_oauth_token_encrypted`,
`setnayan_ai_active`, …) are already unreachable from a browser. Read the default
before you revoke.

**🪤 And the new column could not be read from the host session either.** With no SELECT
grant, naming it in the page's existing session select would get that ENTIRE query
rejected — the event read returns null, `notFound()` fires, and the controller 404s for
everyone. Rejected, not thrown; the only symptom an absence. It gets its own fail-soft
service-role read.

**One gate, not three checks.** `lib/live-studio-manual-air.ts` fuses the two routes
into a single `resolveLiveAir()` that always returns `isLive` and `startedAt` together,
so no call site can hand the window one without the other. A real broadcast outranks a
stale manual flag and keeps ITS start (preferring the earlier manual instant could only
move the bound backwards, the direction that gives multi-cam away), and an unparseable
stored instant reads OFF air rather than "live with unknown start" — the one place the
fail-open is deliberately reversed, because that state is exactly what the window
protects. `automaticGoLiveAvailable()` is exported so the button and the page cannot
drift on whether one-tap is possible.

**Nothing was removed.** All three existing ways to go on air still work; an earlier
investigation that recommended deleting the free single-camera path was wrong.

Tests: 12 unit + 9 db, including a neutralisation test that drops the trigger and shows
the backdate landing — a guard never observed failing is decoration.

SPEC IMPACT: None. No price, SKU, or locked decision changes; the paid window's rules
are unchanged and this only stops a new way of reaching them dishonestly.
