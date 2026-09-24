# S38 · A BIRTHDAY, end to end — the owner's click-path run sheet

> Written 2026-09-19 by session S38 against `origin/main` at `edc95a6d3` and the live database.
> Served build at the time of writing: `/api/health` → `9e4f443`.
> **The owner clicks. S38 confirms every step by SQL and prints the numbers.**
> You never type credentials for me; I never touch the screen.

---

## 0 · Why a BIRTHDAY, and not a debut, christening or "simple event"

Measured live (`event_type_vocab` · `event_type_profiles` · `events`):

| fact | measurement |
|---|---|
| kinds of celebration enabled in the vocab | 17 (wedding · debut · gender_reveal · birthday · celebration · travel · corporate · tournament · christening · anniversary · graduation · reunion · gala_night · simple_event · date · hangout · wake) |
| events that exist today, by type | wedding 8 · simple_event 1 · date 1 · **every other kind: 0** |
| `birthday` profile surfaces | budget · day_of · gallery · rsvp · schedule · seating · website · livestream · song — `marketplace_enabled = true` |
| `debut` / `christening` profile | identical surface set to birthday; only the words differ (debut → "celebrant", "Court of honor"; christening → "host", "Godparents") |
| `simple_event` profile | **no `budget` surface, `marketplace_enabled = false`, no `song`** — it cannot run the supplier path at all |
| generic onboarding `/onboarding/birthday` | returns **200 anonymously** in prod, so the experience-quiz flag is ON and a birthday gets the 12-screen guided flow (welcome · name · date · pax · region · 5 experience questions · plan · congrats), not the inline name form |

**Birthday** is the one families actually run, it carries the full surface set (budget + marketplace + song desk), and it exercises the two non-wedding-only mechanisms the wedding run never touched: the **honoree link** ("Para kanino?" → an alaga) and the **celebrant noun** (the person the event is *about* is not the person *running* it — a seven-year-old arranges no venue). A debut would prove nothing a birthday does not; a christening proves less (its celebrant word is just "host").

Re-measure: `select event_type, enabled_surfaces, marketplace_enabled from event_type_profiles where event_type in ('birthday','debut','christening','simple_event');`

---

## 1 · Accounts and the state they are in RIGHT NOW

| role | account | measured 2026-09-19 |
|---|---|---|
| **host** (the family) | `testnayan3@test.com` | `is_internal = false` · `account_type = customer` · already a member of 2 events (`rosa-ben` as couple-member, and the Papic pool test simple event) · **0 events of its own that are a birthday** |
| **supplier** | `testnayan2@test.com` | owns **Saysay Host and Band** (`S89B-THD5QCKPWM`, slug `saysay-live-band-and-hosting-fix`) · published · verified · tier `solo` (expires 2027-07-30) · **2 active services**: Host/MC ₱40,000 fixed (`S89S-811M6SWNPK`) and Live Band ₱35,000 fixed (`S89S-GZ6GJB1K5N`) · 0 packages · **0 payment methods** · **`event_types = ['wedding','date']`** · **0 coverage rows** |
| never | `iscasasolaii@gmail.com` | `is_internal = TRUE` — passes every paid gate; a green here proves nothing |
| never | the Google button | sign in by email + password only |

Platform-wide, before the run: `orders 6 · event_vendors 49 · vendor_lock_proposals 0 · booking_fee_charges 0 · vendor_payment_methods 0`.

🔑 **The one thing that will stop the run cold if it is not done first is in § 2.**

---

## 2 · STEP 0 — the supplier tags "Birthday" (supplier, ~2 minutes) — DO THIS FIRST

**Why:** `/explore` auto-scopes a signed-in birthday host to `?event_type=birthday` (`lib/explore-event-type-scope.ts`), and the filter is `vendor_profiles.event_types @> ['birthday']`. Saysay is tagged `['wedding','date']`, so a birthday host sees **zero cards and a "COMING SOON" panel** — the marketplace is empty for them, not broken. There is an escape link ("browse all vendors instead"), but a family will not know to look for it.

**Where:** `event_types` is **coverage-owned** (owner-locked 2026-07-02): the profile form deliberately does not write it. The only writer is the Coverage panel under **Vendor dashboard → Services**, and it writes `event_types = UNION of every coverage's event types` (an empty union falls back to `['wedding']`).

⚠ **Saysay has 0 coverage rows today.** The first coverage you create REPLACES `['wedding','date']` with whatever you tick. **Tick Wedding + Date + Birthday** so `rosa-ben` and `movie-night` stay discoverable.

1. Sign in as `testnayan2@test.com`.
2. `https://www.setnayan.com/vendor-dashboard/services` → the Coverage panel ("Event types you cater · couples planning these find you").
3. Create a coverage for the Live Band category, tick **Wedding · Date · Birthday**, save. Repeat for Host/MC if the panel is per category.
4. *(Optional, tests the S19 deposit path properly)* `https://www.setnayan.com/vendor-dashboard/payment-options` → add one GCash method. The wedding run recorded its deposit with `deposit_method_id = NULL` (proof only); this run can prove the method-select path.

**Tell me when done. I confirm:**
```sql
select event_types, (select count(*) from vendor_coverages c where c.vendor_profile_id = v.vendor_profile_id) as coverages
from vendor_profiles v where v.public_id = 'S89B-THD5QCKPWM';
select count(*) from vendor_payment_methods where vendor_profile_id = 'd266c234-3aca-46c3-b1c8-6a5c78e3f310';
```
Expected: `event_types` contains `birthday`; coverages ≥ 1.

---

## 3 · STEP 1 — create the birthday (host)

1. Sign in as `testnayan3@test.com` (email + password).
2. `https://www.setnayan.com/dashboard/create-event` → pick **Birthday** 🎂.
   - You should be sent to `/onboarding/birthday` (the guided flow). If you land on an inline "name" form instead, tell me — that means the flag reads differently for a signed-in account than for an anonymous visitor.
3. Walk the 12 screens. On **name**: name it something greppable, e.g. **"Lolo Ben turns 70"**. On **who / Para kanino?**: name the celebrant (e.g. `Ben`). On **date**: pick **2026-09-19 (today)** — that puts the site in its live window for § 9 without waiting. Pax: `40`. Region: anything.
4. Answer the 5 experience questions any way. Land on **plan → congrats**, then the event home.

**Watch for and tell me verbatim:** any screen that says *wedding*, *couple*, *bride*, *groom*, or asks something only a wedding needs (ceremony, faith, two names, love story).

**I confirm:**
```sql
select public_id, slug, event_type, display_name, event_date, honoree_label, honoree_dependent_id, celebrant_shape,
       estimated_pax, region, experience_persona, landing_page_visibility, created_at
from events where event_type = 'birthday' order by created_at desc limit 1;
select m.member_type, m.role from event_members m join events e on e.event_id = m.event_id
where e.event_type = 'birthday' and m.user_id = 'a0325a43-d1fb-4ce7-afda-8b79d381b813';
```
Expected: 1 row, `event_type = birthday`, `honoree_label` set, a member row for testnayan3.

---

## 4 · STEP 2 — guests and the invitation site (host)

1. **Guests:** `/dashboard/<eventId>/guests/new` → add 3 guests with real-looking emails you control (you will RSVP as one of them in § 9). Note whether the form asks for a **side** (bride/groom) — a birthday has no sides, so it should not.
2. **Guest list:** `/dashboard/<eventId>/guests` → look at the mind-map root. ⚠ Until PR **#5676** merges it will read **"Your wedding"** on every non-wedding event. That PR is open and mergeable; it is not this run's defect.
3. **Site:** `/dashboard/<eventId>/website` → open the site editor, then **privacy** → set visibility to **unlisted** (so I can open it without it being indexed).
4. **Invitation:** `/dashboard/<eventId>/invitation` → mark the invitation as sent (the "sent" control writes `guests.invitation_sent_at`).

**I confirm:**
```sql
select count(*) filter (where deleted_at is null) as guests,
       count(*) filter (where invitation_sent_at is not null) as invited,
       count(*) filter (where side is not null) as with_side
from guests where event_id = '<eventId>';
select landing_page_visibility, launch_mode, manual_phase, slug from events where event_id = '<eventId>';
```
Expected: guests 3 · invited 3 · **with_side 0** · visibility `unlisted`.

---

## 5 · STEP 3 — find the supplier and inquire (host)

1. `https://www.setnayan.com/explore` — first, **before** you click anything, tell me what you see. If § 2 was done you should see Saysay's card under a **Birthday** chip. If you see "COMING SOON", § 2 did not take.
2. Open the shop: `https://www.setnayan.com/v/saysay-live-band-and-hosting-fix` → the **Live Band** service → **Inquire**. Write one line ("Live band for Lolo Ben's 70th, 40 pax, Sept 19").
3. This should open the one chat box at `/dashboard/<eventId>/messages/<threadId>`.

**I confirm:**
```sql
select ev.public_id, ev.vendor_name, ev.status, ev.category, ev.service_id, ev.total_cost_php, ev.created_at
from event_vendors ev where ev.event_id = '<eventId>' order by created_at desc;
```
Expected: 1 row, `status` = considering/shortlisted, `service_id = db383ac7-5683-4e47-91ad-52e825131e7a`.

---

## 6 · STEP 4 — quote → accept (supplier, then host)

1. **Supplier** (`testnayan2`): `/vendor-dashboard/messages` → the new thread → tray → **Quote & payment** (it opens `/vendor-dashboard/clients/<eventId>?tab=quote`). Send a quote for the live band: ₱35,000 — or price it lower to prove the number on the host's budget is the quote and not the service's starting price.
2. **Host** (`testnayan3`): the quote arrives *in* the thread as a message with line items. Press **Accept**.
   - Per the owner's ruling, accepting commits NOTHING: no budget line, no schedule lock, no locked customer. Check `/dashboard/<eventId>/budget` — it should still be empty. That is correct.

**I confirm:**
```sql
select public_id, status, total_centavos, sent_at, resolved_at, viewed_at from vendor_proposals
where event_id = '<eventId>' order by created_at desc;
select status, total_cost_php, lock_request_state, lock_requested_at from event_vendors where event_id = '<eventId>';
```
Expected: proposal `accepted`; `event_vendors.total_cost_php` = the quote; `lock_requested_at` still NULL.

---

## 7 · STEP 5 — lock: the host asks, the supplier agrees

🔑 The handshake is **host asks → supplier agrees** (not the other way round). The host's Lock lives on the **bench**, not the workspace.

1. **Host:** `/dashboard/<eventId>/vendors` (the bench) → Saysay's card → **Ask them to lock** (`requestLock` in `accordion-lock.tsx`). ⚠ The confirm dialog and toast say **"This locks your wedding date." / "Your wedding date is now locked in."** until #5676 merges — expected, not this run's defect.
2. **Supplier:** `/vendor-dashboard/clients/<eventId>` → the lock request → **Agree** (`vendor_agree_to_lock`: writes `lock_request_state = 'agreed'`, `status = 'contracted'`, and narrows the event date).

**I confirm:**
```sql
select status, lock_request_state, lock_requested_at, lock_requested_by_user_id, lock_agreed_at, lock_answered_by_user_id
from event_vendors where event_id = '<eventId>';
select event_date, date_status, date_forced_by_lock_of from events where event_id = '<eventId>';
```
Expected: `agreed` · `contracted` · `lock_requested_by` = testnayan3's uuid · `lock_answered_by` = testnayan2's uuid.

---

## 8 · STEP 6 — payment ask → deposit → acknowledge (the moment everything fires)

1. **Supplier:** same client page → **Ask for payment** (`vendorAskForPayment` → `vendor_payment_asks`). Ask for ₱10,000.
2. **Host:** `/dashboard/<eventId>/vendors/<vendorId>/workspace` → record the deposit: pick the method (if § 2.4 was done, the GCash method should appear), amount ₱10,000, upload any image as proof.
3. **Supplier:** client page → **Acknowledge deposit** (`acknowledge_vendor_deposit` RPC → `runDepositAcknowledgedEffects`).

**I confirm — this is the one that matters:**
```sql
select deposit_recorded_at, deposit_method_id, deposit_method_label, deposit_paid_php, deposit_proof_url is not null as proof,
       deposit_acknowledged_at, status, workspace_status from event_vendors where event_id = '<eventId>';
select count(*) from vendor_payment_asks where event_id = '<eventId>';
-- the seven effects
select total_cost_php as budget_line from event_vendors where event_id = '<eventId>';            -- 4 budget planner
select count(*) from vendor_calendar_blocks where vendor_profile_id = 'd266c234-3aca-46c3-b1c8-6a5c78e3f310'
  and '<event_date>' between starts_on and ends_on;                                              -- 2 schedule lock (columns re-checked at run time)
select event_date, date_status from events where event_id = '<eventId>';                        -- 3 date finalised
select count(*) from vendor_completed_events where vendor_profile_id = 'd266c234-3aca-46c3-b1c8-6a5c78e3f310'; -- 5 locked customer (table re-checked at run time)
select count(*) from booking_fee_charges;                                                        -- was 0 before the run
select count(*) from email_deliveries where created_at > now() - interval '1 hour';             -- did anybody get told
```
Then `/dashboard/<eventId>/budget` as the host: the tile must NOT read "₱0 committed".

---

## 9 · STEP 7 — the guest site on the day (a guest, in a private window)

The date is today, so the site is in its live window. If it is not (a wrong date), the host can pin the phase from the launch page (`launch_mode` / `manual_phase`, PR #5641).

1. Open `https://www.setnayan.com/<slug>` in a **private window** (not signed in).
   - Read the masthead. A wedding shows two names; a birthday should show the celebrant. Tell me every line that says *couple / wedding / bride / groom*.
2. **RSVP** as one of the 3 guests (the invite/RSVP widget → `submitRsvp`). Say "attending".
3. **Papic:** the site's camera button → `/papic/guest?from=<slug>`. The camera opens on a free pool (owner-locked 2026-08-02: "free guests can shoot"). Take one shot.
   - ⚠ testnayan3 already has 2 events, so this birthday is **not** its first event: the free grant is first-event-*sized*, so expect **1 credit**, not the full pool.
4. **Song request:** Saysay is `solo` tier with `live_band` + `host_mc` services, which holds the `song_desk` specialization, and it is now booked (contracted + acknowledged) — so the "Ask the band for a song" card should render in the live window. Request one.
   - As the **supplier**: `/vendor-dashboard/on-the-day/live/<eventId>` → the song inbox should show it.

**I confirm:**
```sql
select display_name, rsvp_status, rsvp_responded_at from guests where event_id = '<eventId>' and deleted_at is null;
select count(*) from papic_event_pool_config where event_id = '<eventId>';   -- pool exists
select count(*) from vendor_papic_captures where event_id = '<eventId>';      -- (or the guest-capture table; re-checked at run time)
select title, artist, requester_name, created_at from song_requests where event_id = '<eventId>' order by created_at desc;
```

---

## 10 · What I already know will leak (measured before the run)

| # | where the family/supplier reads it | what it says on a birthday | who owns the fix |
|---|---|---|---|
| L1 | event home, no date yet | **"Set your wedding date"** — and promises "your Save-the-Date", a surface a birthday does not have | **S38 — PR #5712, auto-merge armed** (`set-date-nudge.tsx`) |
| L2 | bench → budget accordion, empty folder | **"Nothing here yet for your wedding."** | **S38 — PR #5712** (`plan-budget-accordion.tsx`) |
| L3 | guests mind-map root · schedule empty state · lock confirm + toast · workspace invite link · guest role picker | "Your wedding" · "Set your wedding date first" · "This locks your wedding date." · "…for our wedding" · "Role in wedding" | **PR #5676, open, mergeable** — do not rebuild |
| L4 | supplier's client page (`vendor-dashboard/clients/[eventId]/page.tsx`) | **"Wrapped up this wedding?"** · "The couple reported a problem" · "A couple recorded a deposit." · "The couple hasn't set their palettes yet." · signoff: "agreed — the couple cannot change it" — the page **never reads `event_type`** (0 references), so it cannot know | **controller** — the file is being edited by open PRs #5677 and #5651; S38 stays out of it |
| L5 | supplier's coverage panel | "Event types you cater · **couples** planning these find you" | supplier-side copy; small, report only |
| L6 | `/explore` for a birthday host | "COMING SOON" until a supplier tags birthday | **not a defect — supplier recruitment.** No amount of building shortens it |

Everything else the run turns up goes in the findings table at the end of this file.

---

## 11 · Findings from the run (filled in as we go)

| step | what happened | SQL result | verdict |
|---|---|---|---|
| | | | |
