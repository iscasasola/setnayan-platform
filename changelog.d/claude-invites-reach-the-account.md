## 2026-09-28 · feat(invites): an invitation reaches the account — Incoming requests (YES / NO / mute)

Owner: *"if they have an account. it must show on their event page. as incoming requests"* · *"You are
invited to {user name}'s {event name} {event type} event. (YES/NO)"* · *"accepting means they are also
going automatically"* · *"Don't show me invites from this person"*. Approved prototype
`incoming-requests-delta.html` ("the prototype looks correct").

- **Incoming requests** at the top of the Events page, only while one is waiting: the owner's sentence,
  **Yes** / **No**, "Saying yes follows {co-hosts} — you can unfollow any time", and "Don't show me
  invites from {name}". Computed, never stored (`incoming_requests_for_me()`): a guest row whose email
  is this account's CONFIRMED email, unanswered, not yet linked, from a creator not muted or blocked — so
  an account made later with that email sees it at once, and an answered one is gone.
- **Yes** (`answer_incoming_request`) links the account to its guest row, then marks Attending — so a
  waiting co-host pick goes live and the guest follows the co-hosts — then opens the event's RSVP page
  (their key), which asks only what the account does not already hold. **No** declines; nothing joins.
- **Mute** (`invite_mutes`) is private to the muter (unlike `blocked_users`, a chat block the blocked
  person can read); an existing chat block also hides invitations.
- **Bell:** one `event_invitation` notice per person per event, written by a trigger when a guest row
  gets an account's email; a guest import can never fail because of it. The bell refreshes an open Events
  page when it lands.
- ⚖ **Owner/DPO ruling** overrides the counsel hold on the in-account guest notice
  (`FEATURE_ACCOUNT_AUTOSURFACE`) for this surface — recorded in DECISION_LOG 2026-09-28.

SPEC IMPACT: None beyond the 2026-09-28 DECISION_LOG rows already recorded.
