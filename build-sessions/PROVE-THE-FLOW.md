# PROVE THE FLOW — the two-sided live test, and how to resume it

> **The goal, in the owner's words (2026-09-07):** *"what i want to do is you be a
> vendor/user with an event. then you communicate with me as the other end… so it will be
> us 2 trying the app."* And: *"i want to prove and experience it."*
>
> This is not an audit and not a test suite. It is **two real accounts using the live
> product against each other**, end to end: find a supplier → inquire → chat → get a price
> → lock. Nothing in `apps/web/**/*.test.ts` can produce the evidence this is after,
> because every one of those runs against a fixture. The thing being proved is that a
> couple and a supplier who have never met can complete a booking on `setnayan.com`.

**⚠ EVERY NUMBER BELOW IS A MEASUREMENT WITH ITS RE-MEASURE COMMAND ATTACHED, NOT A
CLAIM.** Re-run them before acting. CLAUDE.md rule 7: an anchor is a string, never a
number, and this file is four hours old the moment it is written.

---

## § 0 · THE SIDES

| | who | account | what they hold |
|---|---|---|---|
| **Supplier** | the owner, at his own keyboard | `testnayan2@test.com` | `Saysay Live Band & Hosting (FIXTURE)` |
| **Couple** | the Claude Code session | `testnayan4@test.com` | event `Ana & Miguel` (wedding) |

🔑 **A SESSION CANNOT TAKE THE SUPPLIER SIDE, AND THIS IS NOT A PREFERENCE.** Claude Code
does not create accounts, does not sign up, and does not enter or handle passwords — held
on 2026-09-07 even when the owner said, correctly, that earlier sessions had seeded the
`testnayan*` rows. Seeding rows in a database is not signing a person up. **The supplier
side is the owner's to drive; the couple side is the session's.** Any plan that has a
session logging in as the supplier is not a plan.

---

## § 1 · WHERE THE TEST ACTUALLY STANDS

Measured against **prod** (`njrupjnvkjkitfctetvi`) on **2026-09-08**:

```sql
select
  (select count(*) from public.vendor_profiles where is_published) as shops_published, -- 1
  (select count(*) from public.vendor_services where is_active)    as services_active, -- 2
  (select count(*) from public.chat_threads)                       as chat_threads,    -- 0
  (select count(*) from public.chat_messages)                      as chat_messages,   -- 0
  (select count(*) from public.orders)                             as orders;          -- 6
```

**`chat_threads = 0` and `chat_messages = 0`. The inquiry→chat half of the flow has never
once been exercised on this database.** That — not the shop, not the search — is the
frontier. Everything in § 3 exists to get the first row into `chat_threads`.

### The supplier's two service cards, measured

```sql
select vp.business_name, vp.is_published, vp.verification_state,
       s.category, s.title, s.starting_price_php,
       (s.exclusive_perk_text is not null and length(trim(s.exclusive_perk_text))>0) as has_perk,
       (s.primary_photo_r2_key is not null) as has_cover
from public.vendor_profiles vp
left join public.vendor_services s on s.vendor_profile_id = vp.vendor_profile_id
order by vp.business_name;
```

| category | title | price | perk | cover |
|---|---|---|---|---|
| `live_band` | **null** | **null** | **no** | **no** |
| `host_mc` | **null** | **null** | **no** | **no** |

Shop: `is_published = true`, `verification_state = 'verified'`.

**So the shop is live and findable, and both its cards are empty.** A card with no title,
no price and no cover is not something a couple can act on — which is precisely where the
session stalled on 2026-09-07, and § 3 step 1 is the owner filling them in.

⚠ **`verification_state = 'verified'` on Saysay was set deliberately, by decision, on
2026-09-07** — the owner's words: *"we did set that that shop is a legitimate shop."* It
is not evidence that a document review happened. No application was ever filed. The
`vendor_verification_bypasses` mechanism (PR #5298) is the durable, dated form of that
same decision for the next supplier; use it rather than editing `verification_state`
by hand.

### The couple's event, measured

`Ana & Miguel`, `event_type = 'wedding'`, **`event_date IS NULL`**.

⚠ **A wedding with no date may not be able to complete a lock.** Availability, the
date-convergence banner and the whole build-date window read `event_date`. Before
declaring the lock step broken, check whether it is refusing because the date is absent —
that is correct behaviour, not a defect. Setting a date is § 3 step 2.

---

## § 2 · WHAT BLOCKED THIS FOR SIX HOURS, AND IS NOW FIXED

Recorded because a future session will otherwise re-derive it from scratch. Every item
below is MERGED and live; **do not rebuild any of it.**

| what was broken | the fix, by greppable anchor |
|---|---|
| The card editor's sheet opened clipped under the top nav — unreadable, uneditable. `position: fixed` resolves against the nearest **transformed** ancestor, not the viewport. | portalled to `<body>`; `apps/web/lib/a-sheet-must-escape-the-page-transform.test.ts` |
| Save stayed enabled with a blank price or perk, so a card could be published unusable. | `apps/web/app/vendor-dashboard/services/_components/publish-gate-submit.tsx` |
| `403 / 42501` on `onboarding_order_items` since 2026-08-11 — a couple who had PAID for Setnayan AI read as not owning it. | RPC `public.event_basket_orders_granting`; `apps/web/tests/db/the-couple-can-read-their-own-bill.db.test.ts` |
| `platform_settings` read with the ANONYMOUS caller's client on `/onboarding/wedding`, degrading silently to the default discount. | `createAdminClient()` in `apps/web/lib/onboarding/services-step-server.ts` |
| 30 of 78 bench tiles had no ⓘ. | `apps/web/lib/category-hints.ts` |
| **Production served a build from 18:43 for six hours while every PR said green.** | `--max-old-space-size=12288`; `apps/web/lib/the-build-has-headroom-ci-cannot-prove.test.ts` |

🔑 **THE SIX-HOUR ONE IS THE LESSON THAT OUTLIVES THIS FILE.** Four production builds died
on Vercel with `Ineffective mark-compacts near heap limit … exited (137)` while CI's own
`production build` job PASSED on the same commits (#5287: 7m38s, green). **CI's build
passing is not evidence that Vercel's build passes** — they ran different Node majors,
because `engines.node` said `">=22.0.0"` and Vercel resolves a range to the newest
supported major. Every fix above was merged, green, and invisible to the person testing
the product. Verify a fix against **what the domain actually serves**:

```bash
curl -s "https://www.setnayan.com/?cb=$RANDOM" | grep -o 'dpl_[A-Za-z0-9]*' | sort -u
node scripts/deploy-drift-doctor.mjs        # needs VERCEL_TOKEN
```

⚠ **A deployment's `alias` array in Vercel's API does NOT list custom domains for these
builds.** Reading it produced a confident, wrong "production is frozen, no deployment holds
the domain" on 2026-09-08. The served `?dpl=` is the truth; that field is not.

---

## § 3 · THE RESUME PATH — in order, and the first two are the owner's

Nothing after step 3 can be attempted until steps 1–2 are done, and neither is a session's
to do.

1. **OWNER · fill in both Saysay cards.** `https://www.setnayan.com/vendor-dashboard/services`
   — for each of `live_band` and `host_mc`: a title, a price, an exclusive perk, a cover
   photo. Price **and** perk together: the publish gate now refuses one without the other,
   deliberately. Confirm with the § 1 query that `starting_price_php` and `has_perk` both
   turn true.
2. **OWNER or session · give `Ana & Miguel` an event date.** See the warning in § 1.
3. **SESSION (couple) · find the supplier.** From `testnayan4`, search the marketplace for
   a live band. **If Saysay does not appear, that is the first real finding** — the shop is
   published and verified, so a miss means the search path, not the data. Do not assume;
   capture the query and what came back.
4. **SESSION (couple) · inquire.** This is the step that must move `chat_threads` off zero.
   Re-run the § 1 count immediately after and say the number.
5. **OWNER (supplier) · reply from the vendor side.** Both halves of one thread is the
   point; a session talking to itself proves nothing about the two-sided plumbing.
6. **SESSION · request a quote / price.** Then lock.
7. **BOTH · watch what each side is told.** The failure this codebase keeps producing is
   not a crash — it is a refused read rendered as an empty state. If either side sees
   "nothing yet" at any step, check whether it is *empty* or *refused* before believing it.

---

## § 4 · TRAPS MEASURED ON 2026-09-07/08 — each cost real time

- **`for x in $LIST` does not word-split in zsh.** A PR watcher iterated ONCE with the whole
  string, matched nothing, and printed **"still open: none → ALL MERGED"** while five PRs
  were open and blocked. It said it twice. Inline the items or use a real array, and make
  the loop print what it matched *against*, not only its conclusion.
- **`gh` returning an empty list reads exactly like "nothing left to do."** Fail closed: an
  empty answer is *unknown*, never *done*.
- **A source guard over migration text cannot see who ends up holding a privilege.** The
  first fix for the refused bill read granted `SELECT` on `onboarding_order_items` to every
  signed-in user, and **its own test passed** — it read the SQL and agreed with it. Two
  shipped db guards caught it: a bill's contents are readable by no session role, and a
  `*_couple_*` policy must not resolve through the member-wide `current_event_ids()`. Use
  `current_couple_event_ids()`; an invited guest is not the couple.
- **A test can encode the bug as correct.** `coverage-strip.test.ts` asserted
  `categoryHintForTile('perfume_bar') === null` — that assertion *was* the missing-ⓘ defect,
  written down and passing.
- **`claude/*` preview builds are cancelled by the project's Ignored Build Step and report
  PASS.** So the Vercel check proves nothing on those branches; the production build after
  merge is the only proof.
- **Never read code from `/Users/icecasasola`** — it is a stale checkout of this repo. Use
  `git worktree add --detach /tmp/wt-x origin/main`, and symlink `node_modules` from a
  worktree that has them or every `@/…` import dies.

---

## § 5 · OPEN — the owner's calls, not engineering's

1. **The `Vercel` check is not required on `main`.** Measured: 13 required contexts, and
   `Vercel` is not one — which is why four known-broken builds merged. Adding it is
   **GitHub → Settings → Branches → `main` → Require status checks**, *not* a Vercel
   setting. ⚠ Partial value only: it catches branches whose previews really build
   (`ra2/*`), and nothing on `claude/*`, whose previews are cancelled-as-pass.
2. **`deploy-drift-monitor` alerts nowhere but the Actions tab.** It called the six-hour
   outage correctly on five consecutive runs and nobody saw it.
3. **The Vercel project's Node setting still reads `24.x`.** `engines.node: "22.x"` (PR
   #5305) overrides it at build time, so they now disagree on paper and agree in practice.
   Setting the project to `22.x` removes the last inconsistency — one click, not required.

---

## § 6 · RE-MEASURE BEFORE YOU TRUST THIS FILE

```bash
gh pr list --state open --limit 40 --json number,title,headRefName   # who is mid-flight
git log origin/main --oneline -15                                    # what landed
node scripts/deploy-drift-doctor.mjs                                 # is prod current
curl -s "https://www.setnayan.com/?cb=$RANDOM" | grep -o 'dpl_[A-Za-z0-9]*' | sort -u
```

🔑 **A HANDOFF IS NOT EVIDENCE — including this one.** CLAUDE.md's own "what is left"
block pointed at two finished jobs for an unknown stretch of sessions, because a handoff
decays fastest exactly where it is read most. The §1 queries are here so this file can be
disproved in under a minute. Disprove it.
