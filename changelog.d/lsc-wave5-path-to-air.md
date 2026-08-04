## 2026-07-25 · feat(live-studio): path to air from the unified controller + program-output paywall (wave 5, dark)

**The gap this closes.** Wave 4 ended with a stated hole: the unified controller had
**no path to air.** `/panood/program/[eventId]` — the chrome-less pop-out the couple's
encoder window-captures, and the REAL encode surface per spec § 4c — reads frames from
its opener over `panood-program-bridge`, and that bridge was installed by exactly ONE
caller: the LEGACY Cast control room. The new controller installed nothing, so a cut
reached the host's monitor and stopped there. Nothing an encoder could capture, no
YouTube, no broadcast.

**The path to air.** `_components/program-bridge.tsx` installs the SAME bridge from the
unified controller (not a second one) and opens the SAME program route, and it
subscribes to Wave 4's shared WebRTC viewer (`useCameraFeed`) rather than opening its
own — the transport is one-publisher → one-viewer per slot, so a second viewer would
steal the phones' pictures from the host's own monitor mid-ceremony. The pop-out shows
the on-air channel with the § 4c overlay set already wired there (monogram · lower
third · event QR, plus the forced "POWERED BY SETNAYAN" bar on free), resolved
server-side from the real entitlement. It does NOT close the pop-out on unmount — the
legacy control room learned that the hard way (an ordinary in-app link used to kill a
live output).

**⭐ AND IT CLOSES A PAYWALL BYPASS THE PATH ITSELF OPENS.** Wave 3 moved the paywall to
publication, but it stands on surfaces Setnayan owns: the `live_studio_roam_manifest`
write gate and the public read gate. **The program output is a publication path we do
not own** — the host's own OBS, the host's own YouTube. Under "rehearse free" a host may
legitimately cut between eight cameras; if those cuts reached the encoder, a free host
could broadcast a full multi-camera wedding for ₱0. **Rehearse-free would have meant
broadcast-free via OBS**, and the ₱2,999 product would be gone.

So the SOURCE is reduced, exactly as the manifest is:

- **Un-entitled event → the program frame carries ONE camera**, pinned to the host's ★
  default channel and **cut-blind**. Their cuts still work everywhere else and the
  controller monitor still follows every one of them at full brightness (§ 4d is not
  walked back) — the cuts simply do not move what the encoder sees. If the pin followed
  the cut, a free host would have a live vision mixer, which *is* the paid product.
- **Entitled event → unrestricted.** `enforced: false` short-circuits every check, so no
  path can block a paid broadcast — including legacy wall sources the unified controller
  does not know about.
- **Free single-camera broadcasting is untouched.** One camera is never withheld,
  `events.panood_watch_url` is not touched, and the live `/pricing` promise stands.

**Enforced server-side, twice, from one helper.** `decideProgramAir` /
`programSourceAllowed` live in `lib/live-studio-publish.ts` beside `decidePublish`, which
they reuse for the count — one answer to "may this host broadcast multi-cam", not two.
The controller resolves it server-side and only ever publishes a permitted slot; the
**pop-out independently re-resolves it server-side on its own render and refuses to
paint any other source**, because the bridge is a plain `window` property in the host's
own browser and treating whatever arrives over it as authorised would make the paywall a
suggestion. `orders` is the entitlement source and a host cannot forge it
(`orders_insert_status_guard` / `orders_update_status_guard`, migration
`20270920010000`). `live_studio_roam_zones` UPDATE RLS *is* row-level and the anon key
*is* public, so a host can PATCH `is_featured` / `is_main_stage` / `status` on their own
rows straight through PostgREST — and they may: those columns only choose WHICH channel
the pin lands on. The COUNT comes from the entitlement, and one is one however the rows
are rewritten.

**Nothing is faked.** A refused source shows a named "Unlock to broadcast all your
cameras" card, never a black frame (a black rectangle going out live is
indistinguishable from a crash). A permitted-but-not-the-cut frame carries a small
honest line naming the channel actually on air, so the controller and the broadcast can
never disagree in silence. The controller states the same thing in plain words beside
the transport.

**Also:** the program route's entitlement is now resolved with the **service-role**
client — `orders` RLS is purchaser-scoped, so a coordinator running the encoder for a
couple who paid was reading "not owned" and would have been silently downgraded to the
free bar mid-wedding. Its host gate now also accepts the unified controller's predicate
(`isLiveStudioSetupHost`, which adds a legacy `coordinator`), so a pop-out can never be
stricter than the screen that opened it. `selectFeaturedZone` now delegates to a new
generic `selectDefaultChannel`, so "which channel is the default" has one definition
across the manifest and the raw channel rows.

**Deliberate abstention — the § 4c open owner decision is NOT resolved here.** The
unified controller does not publish the legacy full-screen SETNAYAN paywall overlay
(`lib/panood-watermark.ts`, owner-locked 2026-07-21) onto the bridge, for two reasons:
its 24-hour window is anchored on `panood_control_state.first_live_at`, which the
unified go-live path never writes (feeding it would put a full-screen watermark over a
host who PAID ₱2,999), and free-tier branding on this surface is already the Wave 2
forced "POWERED BY SETNAYAN" lower third, derived from the entitlement and unstrippable.
The legacy control room's watermark is untouched. **The two contradictory owner locks on
free-tier branding still need settling before this flag flips.**

**Known limits, stated not hidden.** (1) The video is the host's own cameras arriving in
the host's own browser — that is what makes rehearsal free and costs ₱0 — so a host who
rewrites their own browser's JavaScript can composite their own feeds. What is closed is
the product path: no shipped Setnayan surface will hand an un-entitled event a multi-cam
program window. (2) A technical host could window-capture the *controller* and crop to
the CH 1 monitor, which follows every cut by owner lock (§ 4d, "no dimming"). That yields
a chrome-cropped, low-resolution and **silent** feed — the controller's monitors are
`muted` by construction, and the program pop-out is the only surface that carries audio.
Blanking the controller monitor for free hosts would reverse the owner lock and recreate
the exact defect § 4d exists to fix, so it was not done. (3) A pure legacy Cast event
(no Live Studio channels) is deliberately not gated by this — it is a different, shipped
product and keeps its own paywall.

Flag-dark behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`; with the flag off the program
surface is byte-for-byte as today. No migration.

Tests: **20 new unit tests** — 17 in `live-studio-publish.test.ts` §§ 5–6 (the free pin
is cut-blind under every cut · a direct-PATCH of every host-writable flag on every row
still yields ONE camera · a tampered console cannot paint a forbidden camera · a paid
host is never blocked by any source · nothing-cut airs nothing · unbound channels do not
inflate the count · a lapsed entitlement bites on the next render · wiring at both
enforcement points and on the bridge/viewer reuse), 2 on the bridge's `requestedSource`
contract, 1 on the shared default-channel rule. Full unit suite: **3335 passing**;
typecheck, `next lint` and a local production build all clean.

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` — § 4c/§ 4d gain a THIRD
publication path. The paywall is no longer only "the manifest write + read gates": the
**program output itself now enforces the entitlement** (un-entitled → one cut-blind
pinned camera, server-decided at both the controller and the capture surface). § 4c's
"the unified controller has no path to air" is resolved. § 4c's open owner decision
(full-screen watermark vs. "POWERED BY SETNAYAN" lower third) is explicitly NOT resolved
and still blocks the flag flip. New owner question: an event holding the RETIRED
`PANOOD_SYSTEM` / `PANOOD_SYSTEM_MOBILE` Cast unlock but not `LIVE_STUDIO` is treated as
un-entitled by this gate — § 3 says those SKUs "fold into `LIVE_STUDIO`", so whether they
grandfather into multi-cam is a money decision left to the owner rather than taken here.
