## 2026-08-26 · feat(papic): four facts at the top — a couple can finally see where they stand

Third slice of the control-centre rearrange. The screen still could not answer the first question a person asks on opening it: **where do I stand?** It opened on decisions — a look picker, then photo quality — while everything about the couple's own celebration sat inside a card further down, or in a room they were not in.

`WhereYouStand` renders **above every room and above the ask**, in the Detail archetype's key-facts treatment:

| fact | what it says |
|---|---|
| **In your library** | how much has been collected — or *"Empty — yours to start"* |
| **Ways in** | how many cameras exist — or *"Just you, for now"* |
| **Still coming** | the capture window, or **"Cameras — set the dates"** in the attention colour |
| **Credits** | how many are left |

The order is deliberate: **a person is told the state of their celebration BEFORE anything asks them to decide something.** Reversing that is how this screen came to open on a look picker.

**🚨 AN UNREAD COUNT IS NOT ZERO — this is the whole risk of the feature.** Every read checks its own error and falls back to an em dash, never to `0`. A failed read that renders *"Empty — yours to start"* tells a couple their wedding photographs are gone; it is the most alarming sentence this strip can produce, and a network blip is enough to produce it. **There is no user-visible difference between "we could not read it" and "there is nothing there" unless the code makes one.**

🔑 **Supabase does not throw on a failed read** — it resolves with `{ error }`, so a `try/catch` around one is decoration. And **`{ count }` is a different shape from `{ data }`**: a guard written for `data` cannot see a count read fail. In this repo an invented zero has already triggered a *write*.

⚠ **One camera source, deliberately.** The page separately counts GUEST cameras, and a guest camera is also a `paparazzi_seats` row — adding the two would double-count every guest who has one. The strip counts seats once: how many cameras exist.

🎨 The attention fact uses `mulberry-600`, not `-700`. The 700 slot flips to the light theme's `#C24E25` on a dark panel and measures **3.05:1** there — a fail a light-only check waves straight through.

**🛡 Guard `_lib/an-unread-count-is-not-zero.test.ts`** — 6 rules, with an anti-vacuum floor (the strip must still make ≥3 reads): every read checks its own error · a failed read resolves to `null`, never a number · every fact has a dash fallback · **"Empty" is gated on an exact `=== 0`, never a falsy check a `null` would satisfy** · the strip sits above the rooms · the attention colour passes in both themes.

**Mutations**, counts printed before → after: a read stops checking its error (1→0) 🔴 · a failed read invents a 0 (2→1) 🔴 · `null` renders "Empty" (1→0) 🔴 · the strip moves inside a room 🔴.

🪤 **That fourth mutation reported a PASS on its first run and meant nothing.** It moved the strip to just *before* the first room instead of *inside* one — so the rule it was aiming at was still satisfied and the green was honest but irrelevant. Re-run with the mount position printed against the first room's position (`29323` vs `29294` — inside), it went red. **An unmeasured mutation proves nothing, and "the sabotage landed" is a claim that needs its own measurement.**

**SPEC IMPACT:** None — under the purpose lock already in `DECISION_LOG.md` 2026-08-26.
