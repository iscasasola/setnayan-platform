## 2026-11-14 · feat(notices): every notice of the inventory onto the one notice system, and the guard that keeps it one

Builds on `claude/one-notice-system` (the rules, the `notice_closes` memory, the bell's "Waiting on this page", Today +
admin). This moves the rest of the 46-notice inventory onto that component and memory, as the approved prototype
(`prototypes/notices_system_2026-11-14_fable.html`, DECISION_LOG 2026-11-14) sorts them:

- **Couple** — set the date (#12), Papic is ready (#13), Setnayan AI offer at the end of Home (#14), the free-window deal
  merged for both sides (#3 · #15), event day mode (#16), save the originals (#17), plan not saved (#18), co-host welcome
  as a line with Got it (#19, still marks the notification read), invites with Yes · No (#20), guest-reply alerts ask as a
  line, no longer a sheet (#21), plan with peace of mind (#22), guests see this live (#24), date specialist (#25), the
  three Event Hub Pro lines as one offer line (#26–28), the free venue shortlist (#29), no shared free day (#32).
- **Supplier / public** — payout missing (#4, inline on a client page, top on Today), website suggests (#7), get verified
  (#8), pick which stay on (#9), who can see this page (#11), not yet verified (#42).
- **Guest** — seat alerts ask (#33), booth review (#34), use on profile (#35), new on your invitation (#36), the supplier
  will show photos (#37), coordinator announcement banner (#38), live now / thank you (#39), shoot from the app (#41).
- **Everyone / admin** — "Setnayan was updated" is a live band at the very top, no longer a fixed bottom bar (#46);
  demo mode (#45). Both lazy-loaded so the shared bundle does not grow.
- `InlineNotice` — the one look and the one memory for the notices the prototype keeps where they stand (no fork: it
  draws `NoticeLine` and reads `notice_closes` through `lib/notice-memory.ts`).
- `closeWord`: a news line whose own answers are its close (`closable: false`) has no "Got it" (#20 · #36 · #37).
- Top notices wait while a spotlight tour runs (`html[data-tour-running]`).
- Slots: the event pages (top + end), the supplier pages (top everywhere but Today, end), via the layouts.
- 🔒 `lib/there-is-one-notice-system.test.ts` — fails a new dismiss store, a new hand-drawn close word, or an inventory
  notice that stops rendering through the system (each sabotage-checked red).

Older hand-written closes are honoured once through each notice's `legacy`, never written again.

SPEC IMPACT: None — implements the approved prototype; the corpus row "one notice system approved" stands. Leftovers are
listed on the PR.
