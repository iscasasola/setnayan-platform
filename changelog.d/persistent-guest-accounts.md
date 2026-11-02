### Persistent guest accounts — link the guest session on signup/login (PR-E)

The growth prerequisite: a wedding guest's tagged photos now follow them into their own Account hub. When a guest who holds a signed `setnayan_guest_session` cookie signs up (or logs back in), we create the `event_members(member_type='guest', guest_id=…)` row that the Account hub's "attended" path already keys off — so their `/dashboard/library` Photos tab shows the events they attended, not just the ones they host. Makes guests persistent + addressable (the guest→host loop's other half).

- **`lib/link-guest-account.ts`** (NEW, `server-only`) — `linkGuestSessionToUser(userId)`. Authorization is the **signed** session JWT only (never URL params); uses the admin client because the hardened `member_can_self_join` RLS forbids self-inserting a `guest_id` binding. Defense-in-depth re-validates the guest row + event match; idempotent upsert (won't clobber a couple's row); a `(event_id, guest_id)` partial-unique violation → `guest_already_claimed` (a stale shared-device cookie can't steal a binding). **Never throws** — auth-flow contract.
- Hooked into **signup** (both the auto-confirm and anon-draft-convert branches) + **login**, each awaited so the write lands before redirect, each firing a no-PII `guest_account_linked` PostHog event only when the link succeeds.
- **Signup page** shows a calm "✓ Your event photos will be saved to your new account." only when a guest session is present.
- **Migration `20270220958755`** — adds `'guest_signup'` to the `join_method` enum (provenance/analytics). Applied to prod; ledger version aligned to the file.

SPEC IMPACT: None new (extends the guest-membership model; 0001/0000).
