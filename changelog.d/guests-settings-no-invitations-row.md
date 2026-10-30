## 2026-10-30 · feat(guests): the Guests ⚙ holds settings only — the Invitations row leaves (slice 11)

R4 slice 11 (HANDOVER "SLICES 9–11": *"remove the Guests ⚙ Invitations row (sendHref / SETTINGS_ROWS / pick-who / tour
ripples)"*). Sending invitations lives where the guests are: the List's **To invite** count door (its Invite N ›, the
one send run `/guests/send`) and **Select › ✉ Invite N**. The ⚙ keeps How guests get in · Your one link · the reply
settings · Requests to join · Finalize.

- `guest-setup-rows.tsx`: `InvitationsRow` (Send to N · Pick who) and its words removed; `GuestSetupRows` no longer
  takes `toInvite` (its two callers — the Guests ⚙'s `InvitePanel` and the guests lab — stop computing it).
- `lib/event-settings-record.ts`: the `invitations` row key is gone from `SETTINGS_ROWS`.
- The Maker's guided Details "Send" link (`maker-details.tsx` `sendHref`) opens the send run itself (`/guests/send`)
  instead of `?settings=1&row=invitations`.
- The Guests tour: the ⚙ step says "Your RSVP settings" (it no longer sends), and the views step no longer says
  "⚙ sends the invitations".
- Kept: the cold `?select=to-invite` landing (Select on, narrowed to To invite) and the screen's own `pickWho` — other
  doors still lead there.
- Tests re-aimed to the new property (each asserts the ⚙ draws no Send / Pick who): one-link-row-only-for-open ·
  setup-wears-the-form-rows · setup-controls-are-the-templates · counts-equal-the-rows · to-invite-is-one-rule ·
  pick-who-narrows-in-place · the-lab-cannot-reach-the-database.

SPEC IMPACT: None — the controller's Guests queue (owner notes 2026-10-29) lists this removal.
