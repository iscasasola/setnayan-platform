## 2026-08-05 · fix(guest-site): the door stops lying about who you are and why you were turned away

**SPEC IMPACT:** None (three read paths; no schema, no pricing, no SKU).

Three reads decide whether a person gets into an invitation. All three gave a
confident wrong answer.

1. **`loadEventShell` discarded its error.** A failed read returns `data = null`
   — indistinguishable from "no event has this slug" — and every caller answers
   that with `notFound()`. So a database hiccup told a guest standing at the
   venue that their printed link was wrong, offered them a sign-in button for a
   site that was working fine, and told Google the page did not exist.
2. **`loadGuestContext` did the same with the guest row**, producing the
   `not_found` branch that renders *"we couldn't find that invitation"* — a real
   accusation to make at someone holding a printed QR.
3. 🔴 **`loadHostMembership` selected `member_type` and never compared it.**
   `event_members` is the event's PEOPLE table, not a host table, and `'guest'`
   is one of its values — a person who scans the event QR gets a row. So any row
   counted as a host: a guest could open a site the couple had set to **private**,
   and use `?phase=` to jump ahead to phases the couple had not launched yet.

Both loaders now throw on a failed read, and `app/[slug]/error.tsx` is the guest
half of that — *"Your link is fine, something on our end is having trouble"* with
a retry, rather than the root boundary's "Take me home", which for a wedding
guest means leaving the invitation they were sent for a page about buying a
product.

The host rule moved to `_lib/host-scope.ts` as `HOST_MEMBER_TYPES` —
`('couple','coordinator')`, the pair the check-in desk, the checklist RLS and
the couple-scope helpers already gate on. One reader quietly holding a different
definition of "host" is the whole bug; naming it once is what stops a third.

Guarded by `_lib/door-truth.test.ts`, mutation-verified. It is explicit about
what it does not prove: `loaders.ts` is `server-only`, so the rule is run for
real and the query that applies it is read from source — a proof that Postgres
filters the row belongs in a db test.
