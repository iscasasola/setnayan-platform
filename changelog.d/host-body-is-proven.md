## 2026-08-17 · test(event-hub): prove the host body variant, and make the ribbon and the body ask ONE question

**The brief for this asked me to build the host body variant. It already ships — I built it myself in PR #4483 earlier today, and verified that here against `origin/main` before writing any code:** `viewerIsHost` at `site-body.tsx:431`, the host copy at 799 and 946. **Nothing was rebuilt.**

What was actually missing is worse than the feature being absent, and it was mine:

### 🚨 It shipped with NO test — a mechanism never proven reachable

Nothing anywhere named `viewerIsHost` or either piece of host copy. Deleting the branch would have gone green, and the couple would have been back to being told to scan their own invitation QR with nothing to catch it. That is the sixth time this repo has recorded that failure shape, and this one was written three hours after I wrote the same warning into a changelog.

### The delta

**One rule, one place.** `viewerIsEventHost(ownerCapability, eventId)` is now a real exported function in `_lib/site-identity.ts`, used by BOTH `buildOwnerRibbon` and the body's `viewerIsHost`. They were two implementations of one question — "is this viewer a verified host of THIS event?" — which is how a later edit tightens the ribbon and leaves the body addressing a host it no longer recognises. An inline expression also cannot be asserted; a function can.

⚠ **Still deliberately NOT derived from `buildOwnerRibbon(...) !== null`** — that is also null for the unrelated reason of a missing slug, so a host of a slugless event would silently lose the copy fix along with the ribbon. Pinned by its own test.

**12 tests, in three layers:**
1. *The decision* — a host of this event is recognised; null is never read as host; **a host of another event is refused** (a grant is spendable only where it was minted); ribbon and body give the same answer for the same person.
2. *The boundary* — the owner capability carries exactly its declared keys and no guest name, seat, RSVP or QR; the body a host renders is the **anonymous** one, asserted by poisoning it with guest-shaped data and proving none survives. A host is not a guest: owner-ness is additive and orthogonal to the identity tier.
3. *The caller, not the primitive* — source assertions that the page actually asks the shared question, that the stranger sentence sits behind the host branch, and that the host's Me-tab panel exists. Testing the primitive is not testing the caller.

🔒 **Read-only stays read-only, and it is now enforced rather than promised:** a test fails if the host branch ever grows a `<form>`, `<button>`, `onClick`, `action={` or `<input>`. Every real control stays in `/dashboard/[eventId]`.

### Proof

**5 mutations shaped like the real regressions** — delete the host copy branch · delete the host Me-tab panel · drop the event check · re-type the rule instead of sharing it · put a control in the host branch. **Every one verified to have landed by occurrence count printed before → after, and every one turned the suite red.** Baseline restored and re-run green.

8483 unit tests pass · typecheck clean · all 24 lint scripts pass.

### What is test-proved vs observed

**Test-proved only.** The host path needs authenticating as a real account, which I do not do, so nothing here was watched working on the live site. The sweep for *other* host-untrue copy WAS measured against `origin/main` and came back clean: the claim-account prompt is gated on `!viewerAccount` so it cannot reach a signed-in host; `GuestDoorwayStrip`'s `personalised` flag only changes one line about the 3D room; the day-of bar says only "Live hub / Camera / Photos". **The two sites fixed in #4483 were the only ones lying to a host.**

SPEC IMPACT: None. No migration, no schema, no pricing, no copy change to any surface a guest or stranger sees.
