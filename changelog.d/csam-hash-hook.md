## 2026-08-01 · feat(safety): the CSAM known-hash hook — the plumbing, and an honest "not enrolled"

**This does NOT close the CSAM gap. It closes the plumbing.** The control is inert
until the owner enrols with a hash provider and signs the NPC Circular 16-02
processor agreement. Both are owner/DPO acts, not code. Read that sentence before
reading anything else here.

### What was actually true before this PR

Papic Phase 3 (`corporate` · `tournament`) was gated on "a CSAM known-hash matcher
+ an NPC Circular 16-02 processor agreement". On 2026-08-01 the owner widened Papic
to all 16 event types and waived that gate. Reading the code then established what
the gate language had hidden: **the matcher was never built for any phase.** The
only occurrence of "CSAM" in `apps/web` was the comment describing the gate. The
gap was therefore never Phase-3-specific — it applied to weddings, and had since
Papic shipped.

### Why this PR builds an integration and not a matcher

Known-hash matching (PhotoDNA · NCMEC · IWF) cannot be implemented from inside a
pull request. The hash list is not public and not obtainable: the *organisation*
enrols with a provider and receives it under agreement. No sample hashes, no test
vectors purporting to be real, no third-party list — any of those would make an
inert control look live, which is worse than no control at all because it converts
a known gap into an assumed one.

### What ships

- **`lib/known-hash-match.ts`** — a real perceptual hash (64-bit dHash over a 9×8
  greyscale downscale, via the `sharp` already on this path), a provider-agnostic
  `KnownHashProvider` interface, and `resolveKnownHashProvider()` that **returns
  `null` on purpose**.
- **The hook lives inside `lib/nsfw-screen.ts`**, on the same still the NSFW
  classifier reads — in `screenCapture` (which both Papic capture routes already
  funnel through), `screenEditorialVendorMedia`, and `screenStdVideo`. Putting it
  at the screen rather than at the call sites means no capture route can skip it
  and none can be added that does.
- **`public.media_hash_checks`** (migration `20271029279897`) — per-object record
  of what happened. Deny-all: RLS on with zero policies, every privilege revoked
  from `anon` *and* `authenticated` by name (the default ACL grant is not removed
  by `REVOKE … FROM PUBLIC`), with post-conditions that `RAISE` if the end state
  is not true per role.
- **An admin-console card** at `/admin/integrations` that reads **"Not enrolled"**
  and says plainly that no known-hash matching is running on any upload.

### The one rule the design enforces

**There is no status value meaning "clean" or "pass."** The vocabulary is
`not_enrolled` · `no_match` · `match` · `unavailable` · `unsupported`, and
`no_match` — reachable only after a real provider returned it — is the *only*
affirmative member. That is enforced by `isAffirmativeHashCheck()` rather than left
to callers, precisely so nobody writes `status !== 'match'` and silently turns
"nobody checked" into "checked and fine". The test file pins the union and asserts
the predicate exhaustively over it.

The console headline is derived from **provider + flag, never from row counts**, and
an unreadable `media_hash_checks` renders as `unknown`, not `0`. An empty read and a
denied read are the same value; "0 unchecked" would be the exact wrong reading.

### The fail policy, stated rather than buried

When the matcher is unenrolled (today, always) or unavailable, **the upload
proceeds** under today's behaviour — the always-on NSFW classifier and nothing
more. It is not blocked. Blocking every upload on a control the organisation has
not procured would take a live, selling product offline for a protection that would
still not exist. What changes is that the absence is now recorded per object and
counted in the console, so "how much media went through with no hash check?" has an
answer, which it did not before.

A positive `match` reuses the shipped `nsfw_blocked` terminal state rather than
inventing one, so every existing display gate (all of which allowlist `clean`)
already withholds it — no surface has to learn a new value to be safe.

### Flag

`CSAM_HASH_MATCH_ENABLED` — **default off**, server-only (never `NEXT_PUBLIC_`).
Off ⇒ nothing is written and behaviour is byte-identical to before this PR. On ⇒
every upload records `not_enrolled`. **Turning the flag on does not turn protection
on**, and the console says so in both states.

### Privacy note for the DPO

`perceptual_hash` is a 16-hex-char structural digest of a downscaled greyscale
frame. It is not reversible to the picture and is not a biometric template (it
describes the whole frame, not a face). It is stored so the backlog captured
*before* enrolment can be swept afterwards without re-downloading every object —
that backlog being exactly the population the missing control failed to protect. It
is written only while the flag is on.

SPEC IMPACT: `DECISION_LOG.md` + `lib/papic-event-access.ts`'s standing note that
the CSAM matcher and the NPC Circular 16-02 processor agreement remain OPEN
compliance debt. This PR does not discharge either; it makes the absence visible and
countable, and gives enrolment a single seam (`resolveKnownHashProvider`) to land in.
