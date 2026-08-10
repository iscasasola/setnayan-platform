## 2026-08-10 · fix(vendors): the vendor's name and their account name are one value

Owner-locked: *"vendor's name is their account name. so it should not be editable."* The signup half shipped separately; this is the half that makes the rule true everywhere and for vendors who already exist.

### 🔑 The obvious reading would have been a dead end

*"Not editable"* sounds like: lock the box on My Shop, point at the account profile. **A vendor cannot reach that page.** `/vendor-dashboard/profile` permanently redirects to My Shop, and the couple-side profile sits under a layout that bounces anyone who owns a shop back to the vendor tree.

Locking would have left the name **uneditable everywhere, by anyone, forever** — the failure this repo keeps recording as *a fix nobody can reach is no fix*. Checked before building, which is the only reason it did not ship that way.

So My Shop's box **is** the account name editor for a vendor — the one surface they can actually reach. It now writes both rows, so the two cannot drift into disagreeing about the same person, which is the entire point of the rule. The field is relabelled **"Your name"** and says *"This is your account name"*, because a relationship the database knows and the screen does not is one the person will contradict.

### The backfill is part of the rule, not housekeeping

Measured in production: `users.display_name` was **NULL for every account**, the owner's included, while `vendor_profiles` carried real typed names (`setnaprod` → *Ice Casasola*).

🔑 **A rule that only applies to rows created after it is not in force.** Without the backfill, "your name comes from your account" would be true for the next vendor and false for every existing one — and the signup code that prefers the account name would keep falling through to the typed one, which is the state that allowed a hand-typed name in the first place.

It never overwrites a name the person set themselves, never invents one, and trims. Six database tests cover each of those.

### 🪤 Two of my own mistakes, both caught

- **My comment broke my own test.** The guard sliced the branch body up to the next `case `, and the branch's comment contains *"Worst case the two disagree"* — so it truncated before the line under test and failed on correct code. **A guard that fails on prose is the exact hazard recorded twice already today.** Now sliced on `case '` with its quote.
- **A fixture inserted a row the product never produces.** `on_auth_user_created` already creates the `users` row, so inserting it by hand collided with the trigger — and would have been testing a shape that cannot exist.

Mutation-tested: removing the account-row write turns the guard red.

Verified: **7436/7436** unit · 6 database tests · 20/20 `lint-*.mjs` · `tsc` clean.

SPEC IMPACT: recorded with the ruling.
