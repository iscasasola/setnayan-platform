## 2026-08-10 · fix(reliability): a tab left open across a deploy said the site was broken

The owner opened the site and got **"Application error: a client-side exception has occurred while loading www.setnayan.com"** and could not sign in.

**The site was serving perfectly the entire time.** Verified while the message was on his screen: the homepage returned **200** with its real title, the login page returned **200**, and **every JavaScript file the fresh page asks for resolved** — checked one by one, not sampled. The production build was `READY` and the runtime-error log held three entries, all last seen *before* the day's merges.

### What actually happened

We deploy on every merge. A page already open keeps asking for the JavaScript filenames that existed when it loaded, and after a deploy those are gone. The browser cannot fetch them, React throws, and the boundary mounts. **Three production deploys landed in half an hour while his page sat open.**

🔑 **THIS IS INDISTINGUISHABLE FROM AN OUTAGE FROM THE OUTSIDE AND IS THE EXACT OPPOSITE OF ONE.** A reload fixes it completely — but the message says the opposite, so the reasonable reaction is to conclude the site is down and stop. **It cost the owner a session twice in one day**, and every vendor or couple with a tab open during a deploy sees the same screen. We cannot deploy less; we can stop it reading as a failure.

### The fix

Both error boundaries now recognise a stale bundle and reload **once** to pick up the current build.

- **Once, and the guard is the whole point.** If the new build throws too, reloading on every failure is an infinite refresh on a page nobody can read or leave — worse than the message it replaces. The marker is written **before** the reload, because a reload never returns and anything after the call never runs; setting it afterwards would mean it is never set and the loop is unbounded — the exact bug, hidden inside the guard.
- **Cleared on a healthy render**, so a genuine second occurrence after some later deploy still gets its own reload. Placed in a component the root tree already mounts rather than adding a second always-on client chunk for one key.
- 🔑 **A real crash must not be swallowed.** Reloading on a genuine bug hides it behind a refresh and loses the error someone could have reported. Detection keys on `ChunkLoadError` first, with text patterns only as a fallback for engines that do not set the name — Safari and dynamic-import failures word it differently, and there is no error code for this. A false positive costs one reload, which is what the person was about to do by hand; a false negative is today's behaviour. The asymmetry is why matching on message text is acceptable here and rarely elsewhere.
- The early `return` matters: without it the boundary would go on to file the deploy with Sentry as a crash.

Mutation-tested: removing the once-guard (1 fail) · treating every error as stale (1 fail).

🪤 **One test of mine failed on correct code** — a regex spanning the call's own parentheses. Rewritten to assert the shape that matters, because a brittle assertion is how a guard gets weakened to make it pass.

Verified: **7395/7395** unit · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: None.
