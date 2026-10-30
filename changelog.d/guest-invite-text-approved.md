## 2026-10-30 · feat(guests): the guest invite message is Setnayan's own — the approved 2026-10-30 wording

The couple's default invite (`lib/guest-invite-message.ts` `defaultInviteTemplate`, hosts' voice) is now the text
the owner approved on 2026-10-30 (DECISION_LOG "THE INVITE TEXTS — GUEST AND SELF-ADDED SUPPLIER — APPROVED";
owner: *"this is another website's message. we want our own"* → *"english. but a more wow approach"* → *"perfect"*):

> Hi {name}! 💌 / You're invited to {event} on {date}, and it simply wouldn't be the same without you. / Your
> invitation is ready. Tap to open it and let us know if you're coming — it only takes a minute: / {link} / Inside is
> your ticket: it opens our Event Hub anytime, and it's your pass at the door. / This link was made just for you, so
> please keep it to yourself. / We can't wait to see you there. ✨ / {hosts}

- Placeholders unchanged: {name} {event} {date} {link} {hosts}. With no names to sign, the {hosts} line goes whole
  (no trailing blank line); a couple's own older wording with "With love,\n{hosts}" still drops its sign-off whole.
- ⚖ The ticket line stays true when the share sheet attaches the Digital ticket: "Your ticket is attached: …"
  instead of "Inside is your ticket: …" (the 2026-09-30 rule). Builder's call, flagged.
- Kept as they were: the solemn wording and the guest-voice wording (a guest passing an invite to their +1).
- The personal landing shows the new opening ("Hi …! 💌 You're invited to … without you."), via `landingMessage`.
- Tests: `lib/guest-invite-message.test.ts` pins the whole message; the landing test pins the new opening.

SPEC IMPACT: None — the DECISION_LOG row of 2026-10-30 already records the approved text.
