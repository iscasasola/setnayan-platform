## 2026-09-17 · feat(vendor): a shop page says how long it has been on the marketplace

"On the marketplace since ⟨Month Year⟩" on the public shop page, from
`vendor_profiles.created_at`.

### ⚠ The thing it must never be mistaken for

Two tenures exist for a shop and the product already treats them as different:
`in_business_since_year` is the CREDENTIAL (the experience pill, admin
verifiable against a DTI registration), and `created_at` is only how long they
have been on Setnayan.

🔑 `lib/vendor-milestone.ts` already records the house position on confusing the
two: *"an established shop that merely joined Setnayan recently shows its real
'11th year in business', never '3rd month in business'."* A florist of eleven
years who signed up last month must not be made to look new by a line we added.

⇒ So **the wording carries the distinction, not the placement.**
`marketplaceTenureLine` returns a whole labelled sentence rather than a date: a
bare "Since September 2026" beside "11 yrs in business" reads as a founding date
and actively misleads. A test asserts the qualifier is present and that the
string claims no business experience.

### ⚠ Never hidden to flatter a new shop

Suppressing it for a recent joiner would make its presence a badge and its
absence a tell — a worse dishonesty than the one it avoids. The shop page
already takes this position out loud for the experience tier: *"we render the
tier even for 'New to Setnayan' (honest, not negative)."*

### ⚠ And deliberately NOT behind the flag next to it

The obvious place to read the date was the existing experience probe — which
sits inside `vendorExperienceEnabled()`. Putting it there would have shipped the
line dark behind a switch whose production value nobody can read: the exact
defect fixed the same day in the guest-session token check. `created_at` now
arrives with the page's own select (added to BOTH the main and legacy-fallback
column lists, so the fallback cannot silently drop it), costing no extra query,
and a test asserts the compute happens BEFORE the gate.

### Refusals are refusals

An unusable date renders nothing — never a guess. A FUTURE join date (clock
skew, a bad backfill) is refused rather than clamped: clamping would invent a
date we have no basis for. Month boundaries are read in UTC, matching the stored
value, so a shop that joined on the 1st does not slide into the previous month
for half the world.

Guarded by `lib/marketplace-tenure.test.ts` — 13 EXECUTED decisions, count
printed. Sabotage: dropping the label reds 4, hiding a new shop reds 4, clamping
a future date reds 1, and moving the compute inside the flag gate reds 1.

⚠ RULE 0 note: the brief said there was "no match anywhere in apps/web". `git
grep` found five files — the shell's `grep` is a ugrep shim that hides
gitignored paths on recursive sweeps. The exact line was indeed absent, but one
of those files held the decision this feature had to respect.

SPEC IMPACT: None — new copy on an existing page, consistent with the recorded
position on platform-vs-business tenure.
