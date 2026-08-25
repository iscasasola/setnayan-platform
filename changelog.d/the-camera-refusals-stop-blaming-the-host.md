## 2026-08-25 · fix(papic): a camera refusal stops inventing a reason (C7 + C8)

W6 item 4c. Both were "re-opened for DIAGNOSIS, never diagnosed". Diagnosed
against **production**, then fixed.

**C8 — the personal QR sent 40 of 40 guests away from an open camera.**
`/papic/me/[token]` — the page a guest's PRINTED QR opens — resolved only the
paid Limited ROLL camera. Production holds **zero** `papic_limited_snapshots`,
ever, so `resolveGuestCamera` returned `'none'` for every one of the **40**
guests on all **5** events, and each was told *"The host hasn't turned on Papic
for the guest list yet."* Measured the same minute:
`papic_event_pool_status(event_id).applies` is **true on all five events** — the
guest camera was OPEN. The page asked the wrong question and blamed the host for
its own answer.

**C7 — a failed read wearing a sentence about the host.** `/papic/decorate` read
the RIGHT gate, but `eventPapicGuestActive` collapses "we could not find out"
into `false`: the pool reader returns its ABSENT sentinel on any RPC error, and
the call wrapped it in a second `.catch(() => null)`. Since the pool applies on
every production event the refusal is unreachable through the gate — so every
time it HAS rendered, it was the read failing.

🔑 One defect in two costumes: a state nobody chose, and a state we could not
determine, both printed as somebody's decision.

- `eventPapicGuestAccess()` → `'on' | 'off' | 'unknown'`.
  `eventPapicGuestActive` is now `=== 'on'`, so all ten existing callers still
  fail closed and behave identically. **'unknown' is wording, never permission.**
- `readEventPoolStatus()` reports whether the read SUCCEEDED, separately from
  whether a pool exists. `fetchEventPoolStatus` delegates to it, unchanged.
- `resolveGuestCamera`'s `'none'` carries `reason: 'not_offered' | 'no_seat'` —
  "nobody has a camera" and "you have no camera" are different facts. Additive,
  so its other two callers are untouched.
- When the roll has nothing but the camera IS open, `/papic/me/[token]` now hands
  the guest that camera, via the existing token→session bridge (`?next=guest`,
  added to the fixed allowlist — no guest token in the destination URL, no open
  redirect).

Guard `lib/a-camera-refusal-never-blames-the-host.test.ts`: the surface list is
DERIVED by walking `app/papic` and floored, so a sixth page is policed the day it
lands. 4 assertions, 6 mutations, all measured before → after, all red.
🪤 **Rev 1 of its central pattern was DECORATIVE and only the mutation run said
so**: it excluded `'` in a character class, and the very sentence it bans is "The
host hasn't turned on…" — re-injecting the exact string left it GREEN at 0 → 1.
The pattern is now proved against three known probes before being trusted.

SPEC IMPACT: None — the 2026-08-02 owner lock ("free guests can shoot") is what
these screens were failing to honour; nothing about it changes.
