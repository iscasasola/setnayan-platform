## 2026-08-17 · test(event-hub): guard the host's own body copy, which already shipped

**RULE 0 outcome: the feature was already built.** A brief asked for an "owner
body variant" because a signed-in couple opening their own wedding address was
said to get the stranger's page telling them to "scan your personal QR".

Measured on `origin/main`: `viewerIsHost` in `site-body.tsx` already swaps that
copy, and it landed in **`3f0e7fef6`** — *"fix(event-hub): admit a booked
supplier past the private-event gate"*, i.e. PR #4483, the same PR the brief
described as having shipped only its first half. **Both halves shipped
together.** A host reads "This is your event page — the view your guests get",
and the Me tab says "You're the host" instead of offering `FindModeCard`'s
"Open my invitation" dead end. Nothing was rebuilt and no shipped file is
touched by this PR.

**What was actually missing: any test naming it.** No file in the repo asserted
"your event page" or "You're the host", so the whole host body could be deleted
and every suite would stay green — a working mechanism indistinguishable from one
that was never built. The brief itself is the evidence: from outside the code
there was no way to tell it existed.

Adds `the-host-sees-their-own-page.test.ts`, 7 assertions: the capability is
server-verified and event-bound · `ownerCapability` reaches the anonymous render
path · the host branch is the chain HEAD and precedes every `reason` variant ·
the stranger sentence exists exactly once · `FindModeCard` stays behind a host
guard with one render site · the `?as=replied` preview stays gated and separate.

⛔ Deliberately does NOT re-assert that the host acquires no guest data —
`lib/anonymous-zero-guest.test.ts` already covers that with ten tests including
owner-capability key-poisoning in both identity tiers, reading the forbidden key
list from the module's own export.

Comments are stripped before matching, which here is load-bearing: the file's own
docblock quotes the stranger sentence while explaining why a host must never see
it, so an unstripped guard would be satisfied by prose about the thing it checks.

Mutation-tested 7 ways with occurrence counts. Two findings about my own guard:
one assertion **stayed green with the sabotage landed** (a 4000-char window
matched `ownerCapability` in the neighbouring `?as=replied` call — a guard
matching a string, not the act; now scoped to the object literal), and a reorder
mutation first degenerated into a deletion, so the ordering anchor was split from
the head anchor to make it independently testable.

SPEC IMPACT: None.
