## 2026-08-10 · fix(guests): a private event handed out a shared QR that answers "Link not found"

Found by the owner on the live site: he opened his own event's shared guest QR
and got **"Link not found."**

`/{slug}/invite` refuses a PRIVATE event on purpose — hardened 2026-08-06,
because a stranger who guessed the address could otherwise type a name, join the
guest list, receive a guest session and use it to open the couple's private page.
That fix is right and stays. **The defect was that six screens kept printing the
QR anyway, from the slug alone, with no explanation**: the Papic crew poster, the
printable poster, the guest list's Share-invite, and the guest-invite page (the
other two matches were the dashboard's own `/guests/invite` route — false
positives, now excluded from the scan). Three of the owner's five events are
private, so the code was dead on all three and nothing said so.

🔑 **A DOOR THAT REFUSES AND A DOOR THAT IS BROKEN LOOK IDENTICAL FROM OUTSIDE.**
The refusal is deliberate; the SILENCE was the defect. Same family as the phantom
column, the phantom enum value, the phantom RPC argument, the blocked iframe and
the unresolved `r2://` reference — something declines and the only symptom is an
absence.

**What changed.** New `lib/shared-join-link.ts` — `sharedJoinLinkState()` — one
answer for all four surfaces, with the host's sentence attached. It **delegates
to the existing `resolveSiteReachability`** rather than re-deriving visibility: a
second copy of that rule is exactly the "second door" this codebase keeps paying
for, and it would drift the day a visibility state is added. All this adds is the
one thing reachability cannot know (the join token) and the wording for this link.

* Papic crew page — the QR is replaced by a plain explanation and a link to the
  screen that fixes it. It does not merely vanish: hiding it would be the same
  silence one step earlier, and the host would print an old one.
* Printable poster — **refuses to render** and bounces back to the crew page. A
  poster goes on a table at a real party; there is no way to correct a printed
  sheet.
* Guest list — Share-invite is withheld rather than offering a dead link.
* Guest-invite page — its fallback used to say *"try again in a moment… your
  event may still be setting up"*, i.e. it told a host with a private event to
  wait for something that would never happen. Now names the real reason.

Also verified while here: `/join/[eventId]`'s action refuses private events too
("a page gate is not an API gate"), so both doors are consistently closed — no
hole, and the fallback link would have been dead as well.

**The guard's call-site list is DERIVED FROM DISK**, and it immediately found two
call sites beyond the four already known. Mutation-tested five ways, baseline
green, every sabotage verified applied — including the one that beat the first
version of the guard: **keep the call, discard its result** (reverting the crew
page to `eventSlug ? …` left `sharedJoinLinkState(` sitting there unused and
stayed green). The guard now requires the answer to gate the URL.

SPEC IMPACT: None — the privacy refusal was already the decision; only its
silence changed.
