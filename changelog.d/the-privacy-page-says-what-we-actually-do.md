## 2026-09-14 · fix(privacy): /privacy stops claiming analytics are anonymous, and names four processors it never named

`/privacy` is public (HTTP 200 to anyone), it is a statement under RA 10173, and the owner is the
registered Data Protection Officer personally. It had drifted from the code for four months and
**nothing could have told us** — a privacy page is prose, and prose has no test.

### One claim that was false

> Anonymized product analytics … (via PostHog · **no personal identifiers**)

`lib/analytics.ts` sets `distinctId` to the Supabase `user_id`, and its own docblock says the browser
SDK calls `posthog.identify(user.id)`. Events are keyed to a named account. The page now says so, and
says the part that is genuinely protective: nothing is captured at all unless analytics are allowed in
the cookie banner — the server half has been consent-gated since 2026-08-25.

### Four processors that receive user data and were never named

| | what it receives |
|---|---|
| **OpenAI** | the TEXT of an event editorial or guest column, sent to the Moderation API before the couple sees the draft (`lib/editorial-scan.ts`) |
| **LanguageTool** | the same editorial text, for spelling and grammar (`lib/editorial-scan.ts`) |
| **OpenStreetMap / Nominatim** | a venue or shop address, to turn it into a map pin; and a dropped pin, to find its city (`lib/geo.ts`) |
| **Vimeo** | a shop's Vimeo link, sent to the public oEmbed endpoint for the poster image (`lib/vendor-microsite.ts`) |

The **Gemini image model** was also added to the existing Google entry — it receives the pictures on a
mood board when a couple pays to render one. The cross-border paragraph, which enumerates
destinations, was extended to match. `last updated` moved to today: leaving it stale would be the same
defect this PR fixes.

⚠ **Whisper is NOT claimed.** `api/upload/route.ts` has a comment about Taglish transcription by
OpenAI Whisper, but no such call exists — the only live OpenAI endpoint in the tree is
`/v1/moderations`. A comment is not a measurement, in both directions.

### The guard: a processor must be named, or carry a reason

`every-outbound-host-is-disclosed.test.ts` collects every host the app actually `fetch`es and fails on
any that `/privacy` does not name and `EXEMPT` does not excuse — the published-or-baselined-with-a-
reason shape. Adding a processor tomorrow turns it red, and the only two honest ways to green it are
to disclose it or to write down why it needs none.

🔑 **The first version of that collector was a false-positive machine** and is worth recording. It
matched every `https://` string and flagged 16 hosts that receive nothing: Waze and Apple Maps links a
user taps, the DTI/SEC/BIR pages our help text points at, a `picsum.photos` fixture, `x.invalid`
inside a CSP example. **A guard that cries wolf teaches you to skim past the one time it is right** —
this repo's own words about a different guard. Narrowed to two shapes that mean "our server sent a
request": a literal `fetch('https://…')`, and `const NAME = 'https://…'` where `NAME` is later used in
a `fetch(`. That cut 16 noise hits to 2 real ones — Vimeo, which was genuinely undisclosed, and
TikTok's API host, which is disclosed by company name and is exempt for **that** reason, not because
it is harmless.

The guard states what it cannot see rather than leaving it to be found: a host assembled at runtime,
or one reached through an SDK that never names its endpoint in our source.

🛡 Mutation-checked, counts printed so each sabotage is proven to have landed: a fake
`fetch('https://api.example-tracker.com')` in `lib/geo.ts` → RED naming that host · un-naming OpenAI
on the page (3 mentions → 0) → RED naming `api.openai.com` · restoring "no personal identifiers" →
RED with the reason. Control green after each restore.

SPEC IMPACT: None in the corpus — this makes a published page match shipped code. The four newly
named processors and the Gemini disclosure are recorded in `DECISION_LOG.md`.

### Follow-up — `tsx --test` runs a file, it does not TYPECHECK it

The guard passed locally (2/2, three sabotages red) and then failed CI on
`Typecheck` with two `TS2345`s: under `noUncheckedIndexedAccess` a regex capture
group is `string | undefined` to the compiler even where the pattern guarantees a
value. Narrowed at both sites rather than asserted with `!`.

🔑 **A green `tsx --test` is not a green build.** The runner executes; the
compiler is a separate gate, and a source-scanning guard — which lives on regex
captures and array indexing — is exactly the shape that trips strict null checks
while running perfectly.

⚠ Two traps this repo already records, both hit while fixing it: a typecheck run
from the MAIN checkout does not see a file that only exists in a worktree, so it
reports success about a tree that does not contain your change; and `PIPESTATUS`
is **bash-only**, so `TSC_EXIT=${PIPESTATUS[0]}` in zsh prints nothing and the
exit check is vacuous. Verified instead by compiling the single file with the
flags that produced the error and confirming the ONLY remaining diagnostic is the
expected `TS2307` for `@/lib/...` outside the project tsconfig.

### Follow-up 2 — the last-updated guard caught this PR, exactly as designed

`privacy-live-flow-disclosure.test.ts` pins the policy's own currency date as a LITERAL, so it fails
on **any** edit to the page until the editor consciously moves it. That is not a chore — it is the
only thing standing between "the policy changed" and "the policy still claims it last changed in
August". It fired on this PR and I had to decide, rather than drift.

Both moved together, to the day the change **ships** rather than the day it was written, and the
guard now says in its own comment that both must move in the same commit and why.
