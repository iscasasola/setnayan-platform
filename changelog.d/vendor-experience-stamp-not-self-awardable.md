## 2026-08-12 · fix(vendor): a shop cannot award itself the "Setnayan checked this" mark

Fourth instance of the shape fixed three times on 2026-08-11 (`20271132839561`
chat sender · `20271132843141` broadcast sender · `20271132891176`
self-promotion to admin): a policy that says *this row is yours* —
`vendor_profiles_owner`, PERMISSIVE FOR ALL on `user_id = auth.uid()` — never had
an opinion about what is **in** the row, and a field recording somebody else's
decision was left writable.

Found by the re-run authority-column sweep (36 targets, 33 agents, two
independent adversarial lenses per claim), then re-proved by hand before any
code was written.

| | before | after |
|---|---|---|
| vendor sets `experience_verified_at` + `_by` on their own shop | **ACCEPTED** | refused |
| vendor sets `last_verified_at` | **ACCEPTED** | refused |
| profile created already carrying the stamp | **ACCEPTED** | refused |
| admin stamps, then vendor changes `in_business_since_year` | stamp **SURVIVED** | stamp cleared |
| vendor's own year-change unverify (writes NULLs) | worked | still works |
| ordinary profile edit · admin/service-role stamp | worked | still works |

**What a person could do.** `app/v/[slug]/page.tsx:901` derives the public badge
from `experience_verified_at`, and its tooltip tells couples the years-in-business
figure was checked against the vendor's government business registration. A
vendor could put that green check on their own shop with one request. It also
hides the Confirm-against-DTI control on `/admin/verify`, so our own reviewer is
told the check is already done.

**The second hole, which the sweep did not find and the planning pass did.** The
app clears the stamp when the year changes (`vendor-dashboard/actions.ts:637`) —
but that is an *app courtesy*. A vendor PATCHing the year directly kept the
stamp, so the badge went on attesting to a number the admin had never seen. The
clear is now enforced in the database.

**Why the guard missed it.** `guard_vendor_profiles_entitlement` already fired
`BEFORE INSERT OR UPDATE` — unlike the admin case, the *verbs* were covered here.
What was wrong was the **list**: it blocked ten columns, called two of them
"Trust columns" in its own comment, and never gained the three that shipped
later (`20270209420471`, described there as "purely additive"). A deny-list is a
bill you have to keep paying, and this was the payment that was missed.

**Why a trigger and not a grant revoke** (the shape the two sender fixes used):
the vendor's own session legitimately **names** these columns — the year-change
unverify writes `experience_verified_at = NULL` through the caller's RLS client.
Postgres checks column privileges against the columns *named in the statement*,
not the values, so a revoke would break every vendor year edit while looking
like a clean security win. The trigger can tell clearing from setting; the grant
cannot. A META test asserts the grant is deliberately still present, so a future
revoke tells whoever does it that these tests stop probing what they claim to.

Deliberately **not** in scope: the structural events-style computed
all-columns-minus-deny-set grant pass for this very wide table. It is the right
follow-up, needs its own app change, and is not smuggled in here.

**Guards.** New `apps/web/tests/db/vendor-experience-not-self-verifiable.db.test.ts`
— 14 tests: anti-vacuity META (the guard names all three trust columns — the exact
regex probe that *found* the hole becomes the tripwire; it still names what it
guarded before, so a `CREATE OR REPLACE` from a stale body fails; the trigger
covers both verbs; the owner policy is still FOR ALL; a real unprivileged probing
role; the ACL is intentionally untouched), behavioural coverage of all six rows
in the table above, and two NEUTRALISATION tests that restore the pre-fix guard
and separately strip only the auto-clear, each showing the outcome flip — so
neither half is decorative.

No exposure-baseline regeneration: this migration changes a trigger function
only, adding no grant, policy or RPC surface.

SPEC IMPACT: None. No product rule, price, SKU or copy changes — the badge's
meaning is unchanged; it is now only awardable by the party the product always
said awarded it.
