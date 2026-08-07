# Resume here — 2026-08-07

> **Start with this file, not `HANDOFF.md`.** That one is structurally sound but
> was last touched 2026-06-15 and does not know what shipped since.
>
> ⚠️ **Written for a DIFFERENT CLAUDE ACCOUNT, possibly a different machine.**
> `~/.claude/.../memory/` does **not** travel. Everything needed is inlined
> below — where you see a trap stated in full rather than linked, that is why.
> Do not go looking for a memory note; it will not be there.

---

## 0 · The one rule that saves the most time

**Verify before you build, and verify before you ask the owner.**

Authority order, highest first:
**live site `www.setnayan.com` → shipped code at `origin/main` → live prod DB →
docs.** A written row — including in this file — is a **claim**, not a fact.

Three failures on 2026-08-06/07, all the same shape, all avoidable:

- **A status code is not a page.** `/v/setnaprod` returned **HTTP 200** and I
  reported the page as working. The body was the not-found screen. Read the
  body.
- **An in-code flag default is not what production runs.** `experienceQuizEnabled`
  reads `=== 'true'` (OFF) — prod serves that route fine. Checking the live site
  reversed a wrong conclusion. Note also `flag !== 'false'` **defaults ON**.
- **A task he already decided is not a decision to re-ask.** Three items were put
  to the owner that he had already ruled on; one was my own unfinished work.
  Before asking: *has he already decided this?* If yes it is a task — say
  *"you decided X on <date>; the doing is outstanding."*

---

## 1 · Verified production state (queried 2026-08-07)

| | |
|---|---|
| Events | **5** |
| Vendors | **2** — `SetnaProd`, `Saysay Live Band (FIXTURE)` |
| Vendors publicly visible | **0** — both hidden |
| Papic photos | **0** |
| Booking-fee charges | **0** |
| Live Studio channels | **0** |

**Nothing is live to a stranger.** No shop is visible, no photo exists, no money
has moved. This is the single most useful fact for judging risk: almost anything
is still cheap to change, and "it works in prod" cannot be inferred from
"nothing has broken".

⚠ `vendor_profiles` has **no `slug` column** — it is `business_slug` /
`screen_name_slug`. A phantom column makes PostgREST reject the whole query and
return `data: null`, which reads exactly like "no rows".

---

## 2 · The URL scheme — the live decision

**Owner, 2026-08-07:** *"setnayan.com/setnaprod for vendors remove the '/v'"*, and
events to move to `setnayan.com/{user tag}/{event tag}` so people can name events
freely.

🔴 **THE VENDOR HALF IS ALREADY BUILT. DO NOT "MOVE" ANYTHING.**
`app/[slug]/page.tsx:219` already calls `renderVendorBySlug({ slug, searchParams })`
whenever the slug is not a renderable event, and
`app/sitemap-vendors.xml/route.ts:123` already emits `${baseUrl}/${business_slug}`
— the bare root. `/v/[slug]` is the **legacy** path, still resolving.

`setnayan.com/setnaprod` 404s **only** because SetnaProd is
`verification_state='unverified'` + `public_visibility='hidden'`. That is the
approval gate working.

⚠ **I twice reported this backwards.** The shop dashboard's displayed address
`www.setnayan.com/setnaprod` is **correct**; I filed it as a defect and nearly
shipped a "fix" replacing a right address with the legacy one. Read
`app/[slug]/page.tsx` before touching any of this.

### What actually needs doing (40 traps found, 24 severe)

Ordered — flipping the order turns a code change into a cleanup of live pages.

1. **One shared name registry.** Weddings, shops and people each keep a private
   list and never check the others. A couple renaming their wedding can black out
   a shop, silently, with no error. **Zero collisions today, 7 names total** — so
   this is free now and a migration after launch.
2. **Fix the reserved-word list.** 14 route words unprotected, including
   `creators` and `open-shop`, both **live and in our sitemap**. A shop minting
   that name is handed our own marketing page as its address. The couple's rename
   form validates **nothing**. Generate the list from real routes; do not hand-type
   it (see §4).
3. **Rename-forwarding: on, permanent, everywhere.** It exists, has **never once
   run in production**, covers only the main page, and **expires after 90 days** —
   while save-the-dates go out 6–12 months ahead.
4. **A retired slug must stay owned, not just forwarded.** It is re-claimable
   today, so on day 91 a printed invitation QR silently opens a stranger's shop.
   **One such name is free right now.**
5. **Shops have no rename forwarding at all** — and this address is about to be
   printed on tarpaulins.
6. **`/v/...` → bare root, permanently, as a whole-branch rule** (the booth page
   lives deeper and would be orphaned by a single-line redirect).
7. **~28 in-app links still point at `/v/`**, and the two shop-settings tabs show
   the vendor **two different addresses for the same shop**.
8. **Loose matching at the front door** — eleven underscores opens a real wedding;
   upper/lower case duplicates every page.

### 🔴 Blocked on the owner — the only real question

**What should a person's tag look like, and where does it come from?**
Nobody has one. The single account that does reads `s89u-kemmf2adck`. Flipping
event-nesting today would print a machine code on invitations **forever**.

- **(a)** Ask at signup — "claim your name", suggested from their name.
- **(b)** Derive silently from their name, editable later.

Steps 1–8 do **not** need this answer. Event nesting does.

---

## 3 · Other open work

### 🖼 The vendor logo is missing on 16 surfaces

🪤 **`logo_url` DOES NOT HOLD A URL.** It holds `r2://bucket/key` by design.
`displayUrlForStoredAsset()` converts it. Hand the raw value to an `<img>` and
the browser fails **silently** — a broken image is not an exception, so no test
catches it. The owner uploaded his logo, saw a generic glyph, and reported it.

Fixed on the account launcher (PR #4215). **16 more are baselined** in
`apps/web/scripts/lint-stored-asset-refs.mjs` — including **the public shop
page**, the marketplace card, the home spotlight strip and the vendor-invite
page. Delete a line from `BASELINE` when you fix its file; the guard fails if a
listed file is fixed but left listed, so the count cannot quietly lie.

### 📤 90 kinds of personal data are missing from "download my data"

A person asking for everything we hold gets a file that omits **90 record types**
— their own erasure requests, block list, read receipts, comp grants, music
picks, appointments, civil-registry documents. Under RA 10173 the export is the
portability right; an incomplete one is a compliance gap, not a nicety.

### 🧱 Six design primitives shipped with ZERO importers

`design#1` is recorded as done in both planning docs. Nothing renders those
components — `git grep -l "_components/states"` over `apps/web/app` and
`apps/web/lib` returns **nothing**. A fourth instance of built-with-no-handle.

⚠ And before porting ANY screen: an audit found the design port would drop **89
real capabilities**, 76 confirmed, 18 of them touching money or law. Deleting two
real controls from a live page passed every check byte-identically. That finding
lives only in `DECISION_LOG.md` 2026-08-06 — it is not in either planning doc.

### 🔎 The vendor route soft-404s

`app/v/[slug]/loading.tsx` forces Next to stream, so the shell ships with **200**
and a later `notFound()` **cannot set the status**. Every mistyped or unapproved
shop URL tells Google *"success"* and is indexable. `/nonexistent-page-xyz` and
`/explore/nope` hard-404 correctly — only this route is affected.
**`generateMetadata` (page.tsx:471) runs before the stream** and is where the gate
belongs. Replicate the owner-preview carve-out there or you will 404 a vendor's
own preview.

### 🗄 Photo retention — the model, now stated truthfully

**Owner:** *"6 months are initially kept as original. they can sync with their
google drive."*

Full-resolution originals are dropped **6 months from the event's FIRST capture**
(an engagement shoot starts the clock), floored at 30 days after the event. The
compressed gallery stays online **indefinitely**. Google Drive is the only way to
keep originals past six months. **The drop is DEFAULT-ON**
(`papic-fullres-drop.ts` — `!== 'false'`).

Copy corrected in PR #4208 and the privacy notice in #4209. Still owed:
- The **archive download silently stops at 1,000 items** (guests: 500).
- The warning email **fires ~3.5 months early** and says "in about two weeks".
- **Guests are never warned at all**, and their own paid-for originals die on the
  couple's clock.
- **Face vectors have no automatic end date** — only erasure-on-request deletes
  them. Whether one is *required* is a DPO call, flagged, deliberately unanswered.

### 💰 Paid preservation — shelved, not missing

🔴 **"Keep Full-Res" ₱999/`per_year` already exists in the live catalog with
`is_active=false`.** The question was always *un-retire, yes or no*. Owner
2026-08-07: **not selling yet.** Do not design it as a new product, and do not
re-ask the four unset numbers (price · period · grace · lapse) until he reopens it.

---

## 4 · Traps that cost real time (inlined — no memory files travel)

- **A convention is not a control.** "Legal copy is opened, never auto-merged"
  was enforced by nothing; `auto-merge.yml` arms **every** non-draft PR and armed
  the privacy PR one minute after it was verified unarmed. Now held by a
  `do-not-auto-merge` label + `lint-automerge-hold.mjs`.
- **CI guards are `continue-on-error` and aggregated separately.** A guard needs
  its **step id · env var · check call** — miss one and it passes silently
  forever. Grep all three before trusting it.
- **Break a guard on purpose or it is decoration.** Three guards written on
  2026-08-07 passed while their bug was present: one exempted any file containing
  the resolver (blind to the very bug), one matched JSX only while the code used
  an object literal, one used a regex that also matched sibling fields. **Narrow
  is right; narrower than the code is useless.**
- **A guard that cries wolf gets ignored.** A first pattern set fired on
  Pakanta's *"an original song… yours, forever"* — 3 false positives in 4.
- **Supabase resolves `{ error }`, it does not throw.** A `catch` block for a
  failed read never runs. A phantom **enum value** kills a query exactly like a
  phantom column.
- **A migration below the applied head DOES apply.** `db push --include-all`
  exists for that. The real cost of a low prefix is the PGlite replay, which
  sorts by filename. Allocate forward with `pnpm migration:new`.
- **Typecheck locally with deps installed**, or you get ~80,000 meaningless
  errors: `pnpm install` then
  `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit`. CI's `tsc` is
  **stricter** (`noUncheckedIndexedAccess`).
- **Branch, THEN `git worktree add`.** Agents clobber a shared checkout. Prune
  each worktree as its PR merges — they are 1–2 GB each and a full disk makes
  *every* Bash call fail, including the `rm` needed to recover.

---

## 5 · Owner-only — nothing here is code

1. **Approve a vendor shop.** Zero are visible; the marketplace shows nothing to
   anyone. This also unblocks looking at the shop page on a real phone.
2. **Create the Setnayan YouTube channel.** Zero exist. Live Studio is finished
   and unusable without one. Decided 2026-08-06 — this is the doing, not a
   decision.
3. **Child-safety enrolment + signed processor agreement.** The plumbing merged
   (#4004) and is **inert**; merging it did **not** close the gap. The Cloudflare
   route was investigated and does not exist for us.
4. **Eleven processors, zero signed data agreements.** Verified live in the
   compliance record (updated 2026-08-06): Vercel · Supabase · Cloudflare ·
   Resend · Sentry · PostHog · Anthropic · Suno · Google · TikTok · in-house face
   matching. **Every one reads `dpa_on_file: false`.** The *list* is now correct;
   the *signatures* are the outstanding work.

8. **The booking fee needs TWO switches, not one.** The owner ruled it ON
   (2026-08-06) and nothing has ever been charged. Setting only the feature
   switch charges nobody — it is ANDed with a separate "payment rail is live"
   switch, and that one is off. Both go in hosting **Production** settings and
   need a **redeploy** (they inline at build time). ✅ The disclosure landed
   first: `/pricing` already names the fee and no longer says "no hidden fees".
5. **Rule on tiered reviews** — the shop page says *"Reviews unlock when this
   vendor upgrades their Setnayan plan"*, which contradicts the never-tier
   principle. No vendor has a review yet, so nothing is affected today.
6. **Answer the personal-tag question** in §2.
9. **Rule whether a stranger's email may be held** before they finish signing up
   — today an abandoned enquiry vanishes and the supplier never learns it existed.
10. **Whether every booked supplier may read the couple's song picks** — the
    couple-sees-their-own half shipped; this half was never ruled.
11. **Whether the hidden-name rule covers photo captions** — it was ruled for
    guestbook messages only; captions are a different feature and were never asked.
12. **The corrected lawyer letter** — nobody can confirm it was ever sent, and
    "the lawyer said yes" never records what the yes covered.
13. **The business is registered to 2031** — any decades-long safekeeping promise
    outlives the entity and becomes a debt against the owner's estate.

7. **Look at things on a phone.** Three real defects in ~10 minutes last time,
   all green in CI. Claude cannot sign in.
