## 2026-08-12 · fix(live-studio): when going live fails, say what YouTube actually said

**The owner created the Setnayan YouTube channel and requested live-streaming access
(12 Aug, 4:33 PM — YouTube's 24-hour counter unlocks ~13 Aug 4:33 PM). This is the
work that makes the first attempt afterwards diagnosable instead of a mystery.**

**🔴 THE REASON WAS BEING DESTROYED AT THE MOMENT IT MATTERED.** `goLivePanood`
wrapped all three YouTube calls in a **bare `} catch {`**. `youtubeFetch` already
throws an Error carrying YouTube's status and the first 300 characters of its JSON
body; dropping the binding threw that away, and there is **no logging anywhere on
this path** — zero `console.*`, zero error reporting, in `setup/actions.ts`,
`panood-youtube.ts` or `panood-broadcast.ts`.

That is not theoretical. Prod holds **zero `panood_broadcasts` rows — no broadcast
has ever been created by anyone.** A grant existed 2026-07-25 for channel
`UC_npqywLsskk_m81lllOjxQ` (independently verified: that id resolves to
`/@Setnayan`, title "Setnayan"), with scopes `auth/youtube` + `auth/youtube.upload`
and a stored refresh token — then revoked ~14 hours later with nothing to show.
**Nobody can say why, because the sentence that said why was discarded.**

Now classified and logged. `classifyGoLiveFailure` maps YouTube's own `reason` to
copy that names ONE cause and ONE next action:

| reason | what the host is told |
|---|---|
| `liveStreamingNotEnabled` | YouTube hasn't switched live streaming on yet — check the countdown in YouTube Studio. **Reconnecting will not speed it up.** |
| `livePermissionBlocked` | YouTube is blocking this channel — a restriction or strike. Reconnecting will not change it. |
| `quotaExceeded` | rate-limited; wait a few minutes. |
| auth failures | **the only class where "reconnect" is the right instruction.** |
| anything else | honest generic: the exact reason was recorded, send it to Setnayan. |

🔑 **THE OLD COPY ADVISED RECONNECTING FOR EVERYTHING** — hedging across three
unrelated causes — which is the wrong move for two of the three: it burns a working
connection and changes nothing. A test asserts "reconnect" now appears in **exactly
one** class.

⚠ **Matches on raw text, not parsed JSON, deliberately** — the body is truncated at
300 chars so it is frequently *invalid* JSON; a parse would throw, and a parse in a
try/catch would silently degrade every classification to `unknown`. A test covers a
body cut mid-JSON.

**🚨 THE APP TOLD THE OWNER TO CONTACT HIMSELF.** The no-token branch picked its
message from `liveStudioRoamEnabled()` alone. That flag is on while the Setnayan
channel pool holds **0 channels and 0 grants**, so every host with no connection got
*"This is on our side — please contact Setnayan"* while the Connect button sat
rendered on the page they were reading.

🔑 **The Wave 9 promise is real and is NOT broken here** — a host who *cannot*
connect their own account must never be told to. The roam flag was simply the wrong
way to ask it. The one thing that closes the BYO door is `liveStudioPoolOnly()`: it
removes the Connect button and makes `/api/oauth/youtube/start` refuse with `409`.
So the copy now branches on **that**. Measured live: that endpoint returns `400`,
not `409`, and the check runs ahead of auth — pool-only is OFF, so BYO is the only
route to air today and "press Connect" is the truth.

🛡 **Two existing guards had to be re-pointed, neither weakened.** One pinned the
copy to the exact `liveStudioRoamEnabled() ? … : …` ternary — it was holding the
wrong question in place, so it now asserts the pool-only branch *and* that the roam
flag never decides this message again. The other was a **whole-file** ban on the
string `liveStudioPoolOnly`, guarding a genuinely important property: pool-only must
never influence whether an *existing* grant can still put a host on air. A
whole-file ban cannot tell that apart from wording a message after the token lookup
already failed, so it is narrowed to the **token-resolution region** — where it
means something. Mutation-proved: letting pool-only gate the token moves its count
in that region 0 → 1 and turns the guard red.

**⭐ THE GOOGLE ACCOUNT CHOOSER IS NOW FORCED.** `buildYoutubeAuthorizeUrl` passed no
`prompt`, defaulting to `consent`, so Google silently reuses whichever session the
browser is signed into — someone signed into several Google accounts can authorise
the **wrong channel**, and we would store it, show its name and report "Connected".
`lib/papic-drive.ts` already passes `select_account consent` with that exact
reasoning in its comment; the YouTube builder never got it.

**🪤 AND A FIX FROM EARLIER TODAY WAS ITSELF THE TRAP.** `shouldOfferManualAir`
withdrew the by-hand on-air switch the moment a channel was connected — which is
precisely the wrong moment. Tomorrow's sequence is: connect → press Go live →
YouTube possibly refuses → and the only remaining way to light the control room has
just been removed **because** they connected. **Connecting is not broadcasting.** It
is now withdrawn only by a real running broadcast, and the parameters the first cut
consulted are gone rather than left unread.

⚠ **I wrote `|| true` into that predicate on the first pass** — a tautology that made
every other input dead while still looking considered. Caught before commit; a test
now asserts both outcomes are reachable.

Verified: 11 + 13 unit tests green. Live probe of production shows the connect door
is open (`/api/oauth/youtube/start` → `400 event_id required`, not `409 pool_only`,
and that check runs ahead of auth — so pool-only is OFF).

SPEC IMPACT: None.
