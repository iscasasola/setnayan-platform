# Privacy gaps before NPC filing — Setnayan Event Platform

> **DRAFT for the owner's review.** Measured on `origin/main` `5f6a351d3`, 24 Nov 2026. No production data read. Not legal advice.
> Companion to [`npc-registration.md`](npc-registration.md) and [`policy-corrections.md`](policy-corrections.md).
> Ranked by risk to the people whose data we hold and to the filing. Each gap gives the **smallest fix**.

## 0 · What changed since the 22 Oct 2026 pack (corpus `NPC_Compliance/`)

The pack's processor table and two retention lines are now out of date:

- **Anthropic now reads supplier verification papers** (DTI certificate, BIR 2303 showing the TIN, Mayor's Permit) and supplier mood-board photos. It **no longer reads payment receipts** — those are read on the buyer's own phone since 17 Nov 2026.
- **LanguageTool and Google Gemini are gone.** Both are still named in the pack; Gemini is still on `/privacy`.
- **Maya checkout is built (off)** and so is **Apple push (APNs)**. Neither is in the pack.
- The full-resolution photo rule is now **92 days after the event's last day**. The "6 months from the first photo" clock is retired.
- Account `sex` has its own consent time; **`users.birth_date` has none** (the pack says it does).
- New personal-data tables since the pack: guest gender, day-of contacts, a supplier's own clients, crew passes, guest reviews of suppliers, visitor-count totals.

## 1 · HIGH risk

| # | Gap | Why it matters | Smallest fix |
|---|---|---|---|
| **G-1** | **No breach register and no incident tool.** The Breach Policy exists in draft only, unsigned. | Circular 16-03 needs a breach record and notification within 72 h. With no register there is no evidence, and no annual security incident report. | Add one table and one admin page (date found, what, who affected, NPC notified at, people notified at). Until it ships, keep a dated log in a private document. Sign the Breach Policy. |
| **G-2** | **No data processing agreement with any processor**, and no transfer instrument. All data leaves the Philippines. | § 21 accountability and § 44 (IRR) need a contract with every processor. This is the first thing NPC will ask for. | Accept each provider's published DPA (Supabase, Vercel, Cloudflare, Resend, Sentry, Anthropic, OpenAI all offer one online — most are click-through). Save signed copies with the pack. Do Maya's before switching it on. |
| **G-3** | **No two-factor sign-in for staff.** Admins can see every guest list, supplier paper and payment proof. | One stolen password exposes the whole system. NPC expects "appropriate" access controls for sensitive data. | Turn on Supabase Auth MFA (TOTP) and require it in `requireAdmin` (check `aal2`). Staff only; customers can follow later. |
| **G-4** | **Retention jobs run only when staff open the admin console.** There is no scheduler. | If nobody opens `/admin` for weeks, face data and full-resolution photos outlive what `/privacy` promises. | Add one Vercel cron (or GitHub Actions schedule) that calls the existing `app/api/cron/*` routes daily. The routes and their secret already exist. |
| **G-5** | **Records with no retention rule:** payments, receipts and payment screenshots (kept with no end date), support messages, app error log table, admin audit and data-access logs, the fraud device hash, QR-scan records, removed guests (soft-deleted, never purged). **NONE – decision needed.** | § 11(e): keep no longer than needed. `/privacy` says "10 years" for payments, but nothing ever deletes them. | Decide one number for each (suggestion: payments and receipts 10 years then delete; support messages 2 years; error logs 90 days; audit logs 5 years; device hash 24 months unused; removed guests 30 days). Then add each to the existing retention-sweep pattern. |
| **G-6** | **Anthropic receives supplier verification papers (TIN on the BIR 2303)** — not disclosed on `/privacy`, which says Anthropic only does Deep Search. | A government number goes to a US AI company without telling the supplier. | Add one line to `/privacy` (see `policy-corrections.md` C-2) and to the supplier upload screen. Or switch the reader off until disclosed. |
| **G-7** | **Fraud auto-suspend has no formal appeal and no balancing test (LIA).** Score ≥ 95 hides a supplier's listing automatically. | IRR § 34 / right to object: a person affected by an automated decision must be able to contest it. | Add a "Request a review" button on the supplier's suspended notice that opens a help ticket tagged `fraud-appeal`, and write the one-page LIA (filing task t1-4). |

## 2 · MEDIUM risk

| # | Gap | Smallest fix |
|---|---|---|
| **G-8** | **Photos and files on R2 have no backup or versioning.** A bad delete or a compromised key loses event photos for good. | Turn on R2 object versioning (or a lifecycle copy to a second bucket) for `setnayan-media`. Say so in the Breach Policy § 7.3. |
| **G-9** | **Guest data entered by the host has no guest consent:** dietary restrictions (health), gender from the title, address, phone. | Tell the host on the guest form that dietary notes are sensitive; show guests on the RSVP what the host entered and let them remove it. Lawful basis: the host's event contract, not guest consent — state that on `/privacy`. |
| **G-10** | **`users.birth_date` has no consent timestamp**, unlike religion, sex, civil status and dietary. | Add `birth_date_consent_at` and stamp it in `lib/profile-personal-info-patch.ts`, like the other four. |
| **G-11** | **`auth.identities` (Google/Apple link) is not blanked at erasure**, and `auth.users` is blanked, not deleted. 82 person tables have no erasure decision yet. | Delete the identities row in `eraseUserAccount`. Work the 82-table backlog down before filing, or list them in the ROPA as "kept, reason …". |
| **G-12** | **Meta auto-posting defaults ON** (`recap_autopost_enabled`, `badge_autopost_enabled`). Recaps are opt-out, and cards can show names and photos of people who did not consent (guests in photos). | Default both to off, or make recap posting opt-in. At minimum, never include guest photos in an auto-post. |
| **G-13** | **Data export is incomplete:** 3 tables undecided (`fraud_enforcement_audit`, `user_devices`, `vendor_client_notes`), plus a known-gaps list. | Decide the three; export `user_devices` (it is the person's own data). |
| **G-14** | **No supplier-side delete of a supplier's own captures**, and a guest cannot file a takedown against a supplier-held photo from the screen (promised on `/privacy`). | Wire the existing takedown (`askToTakeMyPhotoDown`) to supplier captures. |
| **G-15** | **Minors:** dependents (birth date, sex, religion) and honoree details. Consent is the guardian's; no DPIA exists for minors' data. | Write a short DPIA entry (filing task t2-9). Keep the dependents switch off until it is signed. |
| **G-16** | **Admin data-subject count undercounts.** `/admin/compliance/data-sheet` adds `users` + `guests` only. | Add `people`, `dependents`, `event_sponsors`, guest buyers and supplier clients to the count before filing. |
| **G-17** | **No RLS completeness check in CI.** `scripts/rls-audit.sql` exists but nothing runs it, and the test database cannot detect RLS being off. | Run the audit SQL against a fresh replay in CI and fail on any table without RLS. |

## 3 · LOW risk / paperwork

| # | Gap | Smallest fix |
|---|---|---|
| **G-18** | The Privacy Manual, DPO Designation and Breach Policy v1.1 are **unsigned**; six owner fields are blank (barangay + ZIP, TIN, DPO title, phone, DPA status, signature date). | Fill and sign (owner). |
| **G-19** | **Data subject request process** at dpo@setnayan.com is a promise ("15 business days") with no log. | Keep a simple log (date received, request type, date answered) — a table or a spreadsheet. |
| **G-20** | Staff confidentiality agreements and privacy training: not evidenced. | One-page NDA per staff member; one recorded training session (filing task t2-11). |
| **G-21** | Rate limiter is per server instance (best effort). | Acceptable for now; note it honestly. Move to a database or Redis counter when traffic grows. |
| **G-22** | The enforced CSP covers framing only. | Promote the report-only CSP to enforced once its reports are clean. |
| **G-23** | Chat retention skips every event with an order — kept forever. | Decide whether money-linked chats follow the 10-year rule instead. |
| **G-24** | `/terms` still says a "verified" supplier had a credential "checked separately"; identity-check companies are retired, and the check is a person reading business papers. | Reword (see `policy-corrections.md`). |

## 4 · Decisions only the owner can make

1. Retention numbers for every G-5 record type.
2. Whether to accept the providers' click-through DPAs (G-2), and whether to keep Jitsi and the Anthropic paper reader.
3. Recap auto-posting: opt-in or opt-out (G-12).
4. Whether the dependents (minors) feature stays off until its DPIA is signed (G-15).
5. Headcount, office address, phone and TIN for the form.
