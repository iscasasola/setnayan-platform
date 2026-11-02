## 2026-10-21 · feat(guests): a guest who keeps their invitation can ask the hosts to connect — one tick, on by default

Owner, verbatim: *"Yes, build it: when a guest links their account, a default-on tick "Also connect with <hosts>"
sends a connect request I accept in People → Requests."*

- **The tick** — "Also connect with Ice and Claire" — is drawn ON inside the two link steps, in the same form as the
  press that keeps the invitation: the signed-in "Yes, save to my account" (`save-to-account.tsx`,
  `linkThisSeatAction`) and "Save this invitation?" → Yes (`/join/{id}/connect/confirm`, which every Apple / Google /
  sign-in return from an invitation passes through). Component: `app/[slug]/_components/connect-hosts-tick.tsx`.
- **Who is asked** (`lib/guest-connects-hosts.server.ts` `hostsToAsk`): the event's `couple` members (creator,
  partner, co-hosts), named by the event's own guest list, skipping any host the guest already has a live row with in
  either direction (pending, confirmed or declined). Hidden when connections are off, when the guest is a host, or when
  nobody is left to ask. All hosts are accounts by construction, so the tick says nothing about anybody's account.
- **The send** happens only after the seat is bound, only when the tick was drawn and left on, and only through the
  one writer — `requestConnection`, moved out of the People `actions.ts` into `lib/people-connection-request.server.ts`
  (a `'use server'` export would have been a public route) with its email made the caller's choice. The guest path
  passes no email sender: 📵 in-app only (bell + People → Requests, which already reads "<guest> is trying to add you
  from your <event> wedding event"). Unlabelled; Accept and Decline are the shipped ones. Never throws, never changes
  where the guest lands.
- **Not covered:** the scan-to-join door (`/join/{id}`, signed-in email fast path and one-QR join) binds a seat too, but
  it has five forms of its own and is not a "keep my invitation" step; named in the PR, not built.
- Guards: `lib/a-guest-asks-the-hosts-to-connect.test.ts` (10 tests, 10 sabotages red) ·
  `tests/db/a-guest-asks-the-hosts.db.test.ts` (4) · `people-redesign-holds.test.ts` re-anchored on the writer's new home.

SPEC IMPACT: DECISION_LOG.md row 2026-10-21 "A GUEST WHO KEEPS THEIR INVITATION ASKS THE HOSTS TO CONNECT — ONE TICK,
ON BY DEFAULT" (amends 2026-09-28 FOLLOWERS vs CONNECTED PEOPLE rule 1 "never auto-connects": still never a
connection — a request the host accepts).
