## 2026-08-17 · fix(event-hub): the page's client surfaces speak the event's own word

**What a person gets.** At a graduation or a birthday, the video greeting, the
selfie step, the face opt-in, the photo wall and the guest column form stop
talking about *"the couple"*. So do the two seat screens that the first pass
missed. **A wedding reads byte-identically** and it is asserted.

**New:** `_components/event-words-provider.tsx` — one provider mounted once in
the body, so the five CLIENT surfaces read the organiser noun from context
instead of having a string threaded through files that have nothing else to do
with it. The server half keeps using `_lib/event-words.ts` directly.

🔒 **The fallback is "the couple", and the first draft of that decision was the
opposite.** A neutral default ("the host") would mean that if the provider ever
went missing, **every real couple's live invitation starts calling them the
host** — a regression to the only case that exists in production. So the default
preserves today. The cost is that a missing provider is INVISIBLE on a wedding;
that cost is paid by `event-words-mounted.test.ts` rather than by a scary value.
🔑 **A silent fallback is only acceptable when something else is watching.**

**Also fixed:** `seat/page.tsx` and `find-my-table/page.tsx` each had a SECOND
code path the previous PR never reached — *"Once the couple seats you…"*.

🚨 **AND I BROKE AN EXISTING GUARD, WHICH TOLD ME EXACTLY WHAT I HAD DONE.**
Mounting the provider around `<InvitationShell>` broke
`doorways-before-the-day.test.ts`, which anchors on the literal text
`return (\n    <InvitationShell` to prove the doorway strip sits outside both
identity trees. It failed with *"the shell return moved — this scan is now
blind"*. It was right, so **the mount moved rather than its anchor** — the
provider now sits INSIDE the shell, still wrapping both trees. My own guard now
asserts that anchor is intact, so the next person cannot re-break it silently.

🛡 `event-words-mounted.test.ts` — 5 assertions: the provider is mounted and
wraps both identity trees; it is handed the RESOLVED per-type words and not a
hardcoded object; every consumer handles a missing provider; the fallback is
byte-identical to what a wedding reads (and pinned literally, so both sides
cannot drift together); and no consumer has reverted to a hardcoded *"the
couple"* — comments stripped first, because several of these files now EXPLAIN
the defect and prose about it must not read as it.

**Mutation-proved, occurrence counts printed before → after:** provider
unmounted (1→0) **2 fail** · provider handed a hardcoded object (landed)
**1 fail** · one consumer reverted to a literal (1→1) **1 fail** · a consumer
drops its fallback (landed) **1 fail** · restored **5 pass**.

⏭ **This is a slice, not the finish. ~40 of the 53 measured strings remain** —
mostly the post-event story pages and the printable keepsake, which are a
self-contained surface with their own data layer and are their own change. The
provider makes the client half of the rest mechanical.

⚠ **NOT OBSERVED** — every launched production event is a wedding, so no
non-wedding wording can be seen working. Test-proved only.

SPEC IMPACT: None.
