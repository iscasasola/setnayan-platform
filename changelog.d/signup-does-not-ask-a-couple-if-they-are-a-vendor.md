## 2026-09-20 · fix(signup): the sign-up door stops asking a couple whether they are a vendor

The owner tapped one of our NFC vendor cards on his own phone. It landed on
`/vendor-invite/<slug>`, he followed **"Sign up free & add this vendor"**, and
`/signup` asked him whether he was a couple or a vendor. Verbatim: *"you
shouldn't ask if they are a vendor since it should be directly as a user."*

🔑 **THE LINK HAD ALREADY SAID SO, AND NOTHING READ IT.** Five call sites have
been sending `?as=couple` for months — `/vendor-invite/[slug]` (page + action),
`/vendor/lock/[token]` (page + action) and `/vendor/fit/[ref]` — while
`app/signup/page.tsx` only ever tested `params.as === 'vendor'`. So `as=couple`
did exactly one thing: leave the couple pill pre-ticked. A parameter that is
written, carried and ignored is indistinguishable, from the outside, from a
screen that was designed to ask. It wasn't; it was a dead branch.

**The rule, owner-locked 2026-09-20 and widened by him to the bare door as
well:** signing up is signing up as a person. `?as=vendor` — set only by the
deliberate "Register your business" entries (`/vendors`, `/open-shop`,
`/vendor/claim/[token]`, the front door) — is the one way to arrive as a vendor.
The Couple/Vendor chooser is removed from the screen entirely, because under
that rule it has nothing left to ask. `account_type` still posts, from one
hidden input, so `signUp`'s `formData.get('account_type')` contract is unchanged.

⚠ **THE VENDOR DOOR MOVED INSIDE; IT DID NOT CLOSE.** Owner, same conversation:
*"we should also have the direct to vendor application app as well, but not
there."* `/signup?as=vendor` is untouched, and a signed-in customer reaches
`/open-shop` from the account switcher's "Create your shop" — where
`becomeVendor` already self-heals `users.account_type` from `customer` to
`vendor`. Nobody is filed into the wrong account permanently by this change.

**Two things that would have broken silently, fixed in the same commit:**

- **The OAuth mirror would have undone it.** `OAuthAccountTypeMirror` re-synced
  the hidden OAuth `account_type` on mount by reading
  `input[name="account_type"][type="radio"]:checked`. With the radio deleted
  that query returns `null` and its `?? 'customer'` fallback would have
  **overwritten a correct SSR'd `vendor`** the instant the page hydrated — a
  vendor at `/signup?as=vendor` choosing "Continue with Google" filed as a
  customer, with no error and no failing build. Nothing can change the field
  now, so nothing re-syncs it: the component is deleted.
- **The couple consent block would have shown to vendors.** It hid itself with
  `[data-couple-only]` + a `:has(input[value='vendor']:checked)` rule aimed at
  the radio. A selector matching nothing does not fail — it silently stops
  hiding, asking a photography studio to consent to showcasing *its wedding*.
  The block is gated on the server now, by the same helper that picks the
  account type, so the two cannot disagree.

**Where the rule lives, and why it is not a ternary.** `/signup` is a server
component: a guard cannot render it, so a guard written against the page can
only grep it — and a grep cannot tell `'customer'` from `'vendor'` inside a
branch it never takes, which is the exact shape of the bug being fixed. The
decision is a pure module, `lib/signup-intent.ts`, and `lib/signup-intent.test.ts`
EXECUTES it. Five sabotages were run against the pair and each one goes red:
`as=couple` producing a vendor · a hard-coded `value="customer"` · the rule
re-derived inline in the page · a second `account_type` field · the consent
block ungated.

`scripts/port-control-baseline.json` is regenerated in this commit so the removed
`<AccountTypeOption>` appears as one readable line — that is the guard's whole
mechanism. The regeneration also folds in blocks added by work merged since the
baseline's previous ref (`9c0bed938` → `b85d6996d`); those are additions, which
the guard passes either way.

SPEC IMPACT: DECISION_LOG.md — new locked row (2026-09-20) recording that
sign-up no longer asks for an account type: the link decides, `?as=vendor` is
the only vendor entry, and vendor access from inside a customer account is
`/open-shop`.
