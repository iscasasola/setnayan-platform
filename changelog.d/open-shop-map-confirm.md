## 2026-08-10 · fix(open-shop): Enter created the shop · the map never repainted · confirm the location before continuing

Owner, walking the live flow: *"my issue is on the maps. it does not update realtime as I type. so when i tried searching on the map and pressed enter, it just completed without me seeing if the address was correct."* Then: *"once i place the map, maybe we can ask if they are located in x city and to accept."*

Three defects, found by one person using it.

### 🔴 Enter submitted the form — and created the shop

A form implicitly submits on Enter. All four steps live on ONE form and the real submit button belongs to the LAST step, so Enter in the **address box** did not search — **it created the shop**, at an address the vendor had not yet checked, from a control that looks exactly like a search field. The lookup is debounced and automatic, so Enter had nothing legitimate to do there at all.

Enter now advances instead, running the same validation Continue does, and on the last step it does nothing: **the shop is only ever created by pressing the button that says so.** Textareas keep their newline; real buttons keep their own Enter behaviour.

### 🔴 The map was created inside a hidden panel, so it never repainted

All four panels are always mounted; step 4 is `display:none` until reached. **Leaflet measures its container once at creation** — a map born at 0×0 believes it is 0×0 forever. No tiles, no pin, nothing moves when the view changes. To the vendor that is *"the map does not update as I type"*, with no error to explain it.

Fixed with a `ResizeObserver` → `invalidateSize()`, which fires at the moment the panel stops being hidden. **This is not a new invention** — the shipped My Shop pin picker already carries exactly this fix; `CityPin` was written from its interaction grammar and did not inherit it.

### A machine guess is now a proposal, not a decision

Owner: *"we can ask if they are located in x city and to accept."*

When a lookup resolves, the vendor is asked **"Are you in Quezon City?"** with the full matched address underneath — because a city name alone cannot tell you whether it found *your* street. Nothing passes step 4 until they answer.

Deliberate details:
- **Any new lookup or pin drag clears the confirmation.** It is a different place; the old agreement was about the old spot.
- **It is required only when a pin exists.** A vendor whose address the geocoder cannot find types their city by hand and passes — demanding confirmation of a guess that was never made would trap exactly the people the lookup already failed. A guard asserts this conditionality, because making it unconditional is the natural "tighten it up" edit and it locks those vendors out.
- The hidden `location_confirmed` field exists **only** once they have agreed, so a geocode nobody looked at cannot carry a shop past the step — which is precisely how one just was.

### Also fixed

- **The refusal named a field that is not on screen.** *"Add the owner name."* while the label says **Your name** — owner noticed. The string dates from when the field was called owner name; the label moved and the message did not. Now *"Add your name."*
- 🪤 **The error banner could never be cleared.** It rendered `stepError ?? error`, where `error` is a prop fed from `?error=` that nothing can clear — so a vendor bounced by the server, who then fixed the field and passed the step, watched the identical red sentence stay on screen, indistinguishable from still being refused. One value now, seeded from the server and owned by the client. This mattered more the moment step 3 started working, because the vendor can finally reach the submit.

### On the two bugs reported before these

Both were **already fixed and deployed**; the owner's open tab was still running the previous build. Production serves `21f77ae35`, which contains the fix; the build before it (`392c17381`) lacks the form ref and reproduces the symptoms exactly. `testnayan4` completed onboarding after a reload, which settles it.

🔑 **The tell was that two unrelated things failed together** — the round logo preview and step 3 shipped in the same commit. When two independent features break at once, suspect the build before the code.

Verified: **7313/7313** unit · 12/12 the step-machine guard · all 20 `lint-*.mjs` · `tsc` clean · eslint clean.

SPEC IMPACT: None.
