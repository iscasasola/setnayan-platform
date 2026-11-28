# NPC registration pack — Setnayan Event Platform

> **Status: DRAFT for the owner's review. Not filed. Not legal advice.**
> Prepared 24 Nov 2026 under NPC Circular 2022-04 (registration of personal data processing systems and DPOs).
>
> **How this was made.** Every line was read from the shipped code on `origin/main` at commit `5f6a351d3`: the app (`apps/web`), the 2,004 database migrations (`supabase/migrations`), config, CI, and the live legal pages in that code. **No production data was read.** Where a feature runs only when a switch is on, this pack says so; whether each switch is on in production cannot be seen from code.
>
> **Earlier work.** A full pack already exists in the specs corpus (`NPC_Compliance/`, last revised 22 Oct 2026, versions v1.1, none signed). This file re-measures it against today's code and does not replace the Privacy Manual, ROPA, Breach Policy or DPIAs. Where this file and that pack disagree, this file is the newer measurement. The differences are listed in `gaps.md` § 0.
>
> **Words.** Supplier, never "vendor" (table names keep `vendor_` because they are code). Event Hub = the event's public page. "Host" = the person who owns an event (couple, celebrant's family, organiser).
>
> Unknowns are marked **UNKNOWN – ask Ice**. Nothing here is invented: no security measure, retention period or processor appears unless the code shows it.

---

## A. Registrant (Personal Information Controller)

| NPCRS field | Value |
|---|---|
| Type of registrant | Personal Information Controller (PIC). Individual / sole proprietorship. |
| Name of PIC | **INDALECIO S. CASASOLA II** (the proprietor; a sole proprietorship has no separate legal personality) |
| Business name | **SETNAYAN SOFTWARE DEVELOPMENT SERVICE** |
| DTI Business Name No. | **8297508** (registered 2026-06-25, national scope — per the live `/privacy` page) |
| Principal office | Quezon City, Metro Manila. Street, barangay, ZIP: **UNKNOWN – ask Ice** |
| TIN | The proprietor's existing TIN (per `/privacy`). Number: **UNKNOWN – ask Ice** (enter at filing only) |
| Sector / industry | Information technology — online platform for planning and running personal celebrations (software publisher) |
| Website | https://setnayan.com |
| Number of employees | **UNKNOWN – ask Ice.** The adopted Breach Policy describes a two-person team; the code shows team-member and internal-staff accounts but not headcount. |
| Head of organisation | Indalecio S. Casasola II, Proprietor |

## B. Data Protection Officer

| NPCRS field | Value |
|---|---|
| DPO | **Indalecio S. Casasola II** — the individual controller acting as his own DPO |
| Designation basis | Individual PIC; DPO function held directly (stated on `/privacy`) |
| Official DPO email | **dpo@setnayan.com** (printed on `/privacy`, `/terms`, `/cookies`) |
| Phone | **UNKNOWN – ask Ice** (NPCRS asks for one) |
| Postal address | Same as the principal office — **UNKNOWN – ask Ice** |
| DPO already on the NPC DPO system? | The specs corpus records a DPO registration on 2026-07-07. **Confirm it is still active, and that its email reads dpo@setnayan.com – ask Ice.** |
| Compliance Officer for Privacy (COP) | None. Not needed while one person is both PIC and DPO. |

## C. Data processing system

| NPCRS field | Value |
|---|---|
| Name of DPS | **Setnayan Event Platform** (setnayan.com) |
| Type | Automated, online (web app, installable PWA, Tauri desktop app; iPhone app wrapper code exists) |
| Purpose | To let a host plan, run and keep a personal celebration (wedding, birthday, debut, christening, wake/funeral and others) together with the event's guests and the suppliers the host books: guest list and RSVP, seating, door check-in, budget, schedule, supplier marketplace and chat, event photos and video (Papic, Live Studio/Live Watch), the public Event Hub, family and group features, and payment for Setnayan's own services. |
| Description | One Next.js application hosted on Vercel (Singapore functions), one Supabase Postgres database with Supabase Auth, and five Cloudflare R2 storage buckets. Hosts start an event with no account and are asked for one at save. Guests never log in: they use one Event Hub link plus a personal QR pass (a 60-day signed guest cookie). Suppliers run a shop console. Setnayan staff run an admin console. Money between hosts and suppliers is paid directly, off-platform; Setnayan takes payment only for its own services (bank / e-wallet transfer with a screenshot, checked by a person). |
| Legal bases relied on | Contract (RA 10173 § 12(b)) for running the account, events and orders; consent (§ 12(a), § 13(a)) for face matching and optional sensitive profile fields; legitimate interest (§ 12(f)) for fraud prevention, Deep Search sign-up suggestions and the daily visit count; legal obligation (§ 12(c)) for BIR receipts. These are the bases the live `/privacy` page states. |
| Processing outside the Philippines | **Yes — all of it.** Nothing is stored in the Philippines. See § G. |
| Processors | See § F. |
| Is this the only DPS? | Yes. One system: the platform plus its admin console. **Confirm no separate HR/payroll or accounting system holds personal data – ask Ice.** |

## D. Data subjects and personal data categories

Field names are database columns. "Live" columns only (not dropped by a later migration). The machine register that the admin data sheet reads is `apps/web/lib/data-subject-register.ts`.

| Data subject | Personal data collected | Where collected | Why |
|---|---|---|---|
| **Account holders** — hosts, co-hosts, helpers; also suppliers and staff | Email, password (hashed by Supabase Auth), display, first, middle and last name, name prefix/suffix, phone, profile photo, address, locale, marketing opt-in, meal preference. Optional: **birth date, sex, religion, civil status, dietary restrictions**. A salted hash of a browser device ID (`user_devices.device_hash`, only while the device-fingerprint control is on). Event roles. Google/Apple sign-in identity (name, email, provider ID). | Sign-up, profile (`app/dashboard/(account)/profile`, `app/signup/you`), Google/Apple sign-in | Run the account; personalise; event roles; fraud prevention |
| **Event details** (about the host and others) | Names of the couple or celebrants, event date, venue and ceremony addresses with map pins, budget, schedule, story. Ceremony type (implies religion); Muslim-ceremony fields (`gender_separation`, `mahr_description`). Optional partner birth dates and times (with consent time). Honoree details in `events.signature_details` (e.g. a christening child's birth date and sex, a due date). | Event creation and onboarding (`app/onboarding/[type]`), event dashboard | Plan the event; show the Event Hub |
| **Guests** (including plus-ones) | Names, title-derived gender, email, mobile, address, photo, relation, side, role, group, **dietary restrictions**, meal preference, attire, notes, host's note, RSVP status, plus-one name, QR token, photo and face-tagging choices, QR-scan opt-out, "passed away" marker. Check-ins. QR-scan records (`scan_events`: IP cut to its first 3 octets, browser user-agent). | Entered by the host (`app/dashboard/[eventId]/guests`, import); by the guest on the Event Hub RSVP (`app/[slug]`) | Invitations, RSVP, seating, door check-in, photo delivery |
| **Sponsors** (ninong/ninang) | Full name, email, phone, relationship note, side, tier | Host (`app/dashboard/[eventId]/sponsors`) | Entourage and ceremony roles |
| **Dependents** (children and elders, held by a guardian) | Name, relationship, **birth date, sex, religion**, minor marker | Guardian (`app/claim/[token]`, hub). All writes behind `NEXT_PUBLIC_DEPENDENT_PEOPLE`; whether it is on in production: **UNKNOWN – ask Ice** | Family milestones (e.g. a coming christening) |
| **People without an account** (relatives in the connection tree) | Display, first and last name, email, phone, photo, **birth date**, in-memoriam marker | Person and connection features | A lasting identity for relatives |
| **Day-of contacts** | Name, phone (`event_schedule_task_contacts`) | Event schedule | Day-of logistics (e.g. the bridal-car driver) |
| **Gift givers** (Pabuya) | Giver name, amount, note, payment method, transfer screenshot. Separately, the host's own receiving handle and QR (GCash/Maya/bank/PayPal). | Event Hub gift flow; host's Pabuya page | Gift ledger seen by the hosts only. Setnayan holds no money. |
| **Buyers of Setnayan services** (incl. guest buyers with no account) | Payer name, order, reference code, payment screenshot (may show an account name and part of an account number), receipt name, email, **TIN** (optional), Maya payment method once Maya is on | `/pay/[reference]`, checkout, `app/papic/buy` | Confirm payment; BIR receipts |
| **Suppliers** (shop owners) | Owner name and position, contact email and phone, registered and HQ addresses with map pins, registered business name, **TIN** and TIN type, registration numbers. Verification papers: DTI certificate, BIR 2303 (shows TIN), Mayor's Permit, references, social links. Legacy rows from retired collection: **government ID, live selfie, bank-account proof** (collection retired 2026-07-03 and 2026-11-14; columns and old rows remain). Payout account name and number. Portfolio, Instagram posts (if connected), chat, reviews received. | Supplier console (`app/vendor-dashboard/shop`), reviewed at `app/admin/verify` | Verification, public profile, billing |
| **Supplier team, crew and their clients** | Team role and label; crew display name and role; a supplier's own off-platform client's name, contact and note (`vendor_client_invites`) | Supplier console | Staff access; inviting a supplier's own clients |
| **Coordinators** | Email, label, granted scopes; announcements they post | Coordinator invite and consent screen | Helping a host run the event |
| **Camera holders** (Papic and Live Studio) | Account ID or guest ID linked to a claimed camera seat | `/papic/seat/[token]`, `/panood/cam/[token]` | Running a camera at the event |
| **People in photos and videos** | Images and clips; capture time, device model, GPS in the original file; FaceBlock blur data; photo tags | Papic cameras, guest capture, supplier capture, samahan stories | Collect and deliver the event's photos |
| **Face-matching participants** (adults 18+ who opt in) | Selfie, face vector, consent and 18+ affirmation time | Event Hub RSVP, guest photo page, check-in (`selfie-capture.tsx`, `face-enroll-actions.ts`) | Find a guest's own photos within one event |
| **Group (samahan) members and creators** | Role, chat messages, 24-hour stories; creator chapters and replies | Samahan and creator pages | Group chat; public posts |
| **Reviewers and reporters** | Rating and review text; report details | Reviews, reports | Trust and moderation |
| **Website visitors** | No cookie analytics. A daily count keyed on a one-day salted hash of IP + browser (salt deleted next day; only daily totals kept: page type, source, device, country, signed-in yes/no). Hashed IP in abuse throttles. Sentry error reports with a masked replay (signed-in screens only). | Middleware, `lib/visits/record-visit.ts` | Count visits; stop abuse; fix bugs |
| **Setnayan staff** | Staff flags; a log of every staff view or export of a person's data (`admin_data_access_log`); admin action log | Admin console | Accountability |

## E. Sensitive personal information (RA 10173 § 3(l))

**Processed: YES.**

| Sensitive data | Whose | Required? | Consent recorded? |
|---|---|---|---|
| Birth date / age (`users.birth_date`, `people.birth_date`, `dependents.birth_date`, partner birth dates, honoree details) | Account holders, relatives, minors, honorees | Optional | Partner and dependent birth dates: yes. **`users.birth_date`: no consent timestamp.** People and honoree data: no. |
| Religion (`users.religion`, `dependents.religion`) and religion implied by ceremony type and Muslim-ceremony fields | Account holders, minors, hosts | Optional, except ceremony type, which onboarding asks for (whether it is required: **UNKNOWN**) | Profile and dependent religion: yes. Ceremony type: no separate consent. |
| Civil (marital) status (`users.civil_status`); a wedding itself implies marital status | Account holders, couples | Optional | Yes (profile field) |
| Sex (`users.sex`, `dependents.sex`, `guests.gender`, honoree sex) | Account holders, minors, guests | Optional | Profile: yes. Guest gender (set by the host's choice of title): no. |
| Health-related: dietary restrictions (`users.`, `guests.`) | Account holders, guests | Optional | Account: yes. Guests: entered by the host, so no guest consent. |
| Government-issued numbers: TIN (`vendor_profiles.tin_number`, BIR 2303 paper, `receipts.issued_to_tin`); legacy government-ID images | Suppliers, payers | Required for supplier verification; optional on receipts | Not consent-based (contract / legal obligation) |
| **Biometric**: face vectors (`guest_face_enrollments.face_vector`, `user_face_profiles`) and the source selfies | Adult guests and account holders who opt in | Opt-in only | Yes: separate default-off tick plus 18+ affirmation, stamped. Face tagging is off per event unless the host turns it on. The account-wide face profile is behind `NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED` (status: **UNKNOWN – ask Ice**). |
| Information about **minors** (dependents, honorees such as a christened child; minors appearing in event photos) | Children | Optional | Entered by the parent/guardian. Face matching refuses known minors. |

**Estimated volume.** Production counts were not read (rule of this task). The last recorded count in the corpus was **48 people and 0 face vectors (17 Aug 2026)**. By design one event carries a whole guest list, and every guest row can hold dietary data and a sex value. At a typical Filipino wedding of 150–300 guests, **4–7 events would pass 1,000 people with sensitive data**. Treat the 1,000 threshold as **likely to be crossed within the first months of real use, if it has not been already.** Re-count on the day of filing at `/admin/compliance/data-sheet`. Note that page adds `users` + `guests` only; it leaves out `people`, `dependents`, `event_sponsors`, guest buyers, day-of contacts and supplier clients, so it **undercounts**.

## F. Recipients and processors

"Gate" = the switch the code needs before any data flows. A DPA (data processing / sharing agreement) is **not signed with any of these** (corpus pack v1.1, B.8; nothing in code changes that).

| Recipient | Personal data shared | Purpose | Country / region | Gate | Agreement needed |
|---|---|---|---|---|---|
| **Supabase** | Everything in the database, incl. face vectors; sign-in | Database and authentication | Singapore (per `/privacy`; region not stated in code) | Always | **Yes – DPA** (processor) |
| **Vercel** | All request data passes through | Hosting | Singapore functions (`vercel.json` → `sin1`); company in the US | Always | **Yes – DPA** |
| **Cloudflare** (R2 storage; Realtime TURN relay; STUN; Turnstile) | Photos, clips, selfies, chat files, contracts, supplier papers; relayed call and camera video (transit only); IP; browser signals | Storage; live video relay; bot check | R2: APAC (code comment). Relay and Turnstile: **UNKNOWN** | R2 always. TURN: `CLOUDFLARE_TURN_*`. Turnstile: `TURNSTILE_*` (a code comment says no site key yet) | **Yes – DPA** |
| **Resend** | Recipient email, name, email content; also sign-in emails via its SMTP | Transactional email (hosts, suppliers; no guest email since 29 Sep 2026) | **UNKNOWN** (US company) | `RESEND_API_KEY` | **Yes – DPA** |
| **Sentry** | Error reports, breadcrumbs, IP; screen replay on error only, all text masked and all media blocked, signed-in screens only; face vectors scrubbed | Error monitoring | Likely US (CSP allows `*.ingest.us.sentry.io`) – **UNKNOWN, confirm** | `SENTRY_DSN`, production only | **Yes – DPA** |
| **Anthropic** (Claude) | (a) Supplier name, website, social links, location for Deep Search web research; (b) **supplier verification papers — DTI certificate, BIR 2303 (shows TIN), Mayor's Permit**; (c) supplier mood-board gallery photos (screened for logos, contact details, QR codes); (d) a host's free-text theme description; (e) a supplier's category-proposal text; (f) admin search phrases | AI assistance, always advisory | United States | `ANTHROPIC_API_KEY` | **Yes – DPA** |
| **OpenAI** (Moderation API only) | A couple's editorial/story text; guest-written columns | Screen for abusive content | United States | `OPENAI_API_KEY` | **Yes – DPA** |
| **Google** — sign-in; Drive; YouTube; STUN | Sign-in: name, email, photo, Google ID (typed email sent as a login hint). Drive: event photos and clips written to the host's own Drive; OAuth tokens. YouTube: broadcast setup on the host's or Setnayan's channel. STUN: IP. | Optional sign-in, photo delivery, Live Watch | US / global | Sign-in: `NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED` (off by default). Drive and YouTube: only when a host connects | Drive/YouTube: the host connects their own account (Google is an independent controller). Google sign-in: Google terms. Review with counsel. |
| **Apple** — sign-in; in-app purchase; push (APNs) | Sign-in: name, email (may be a relay address), Apple ID, sealed revocation key. Purchases: Apple transaction data. Push: device token, notification text. | Sign-in, iPhone purchases, iPhone notifications | US / global | Sign-in: `NEXT_PUBLIC_OAUTH_APPLE_ENABLED` (off by default). Purchases: `NEXT_PUBLIC_APPLE_IAP_ENABLED` (off). Push: `APNS_*` keys | Apple developer terms. Review with counsel. |
| **Browser push services** (Google FCM, Mozilla, Apple) | Push endpoint, notification text | Web notifications | Global | `VAPID_*` keys; only if a person allows notifications | No DPA possible; disclose |
| **Meta** (Setnayan's own Facebook Page and Instagram) | Event-recap and badge cards, which can show a couple's or shop's names and photos | Showcasing finished work | US / global | `META_*` tokens, plus database switches `recap_autopost_enabled` and `badge_autopost_enabled` **(default ON)**. A recap is never posted for a private Event Hub or after an opt-out. | Setnayan is the controller of its own posts; consent from the people shown is the issue (see gaps) |
| **Instagram** (supplier sync) | A supplier's own Instagram OAuth; their posts pulled in | Supplier portfolio | US / global | `IG_APP_*`; only if the supplier connects | Supplier's own choice; disclose |
| **TikTok** | A couple's TikTok OAuth (open ID, handle, tokens); booth videos posted to the couple's handle or to Setnayan's own handle | Patiktok video booth | **UNKNOWN** | `TIKTOK_*` | Disclose; TikTok terms |
| **OpenStreetMap / Nominatim** | Venue or supplier address text (no name); map tiles fetched from the viewer's IP | Address → map pin | UK / EU – **UNKNOWN, confirm** | Always | Disclose; no DPA offered |
| **Maya (PayMaya)** — built, **off** | Order total, reference, item name. No buyer name or email in the request; Maya collects card/e-wallet details itself. Inbound webhook. | Optional card / e-wallet payment | Philippines | `platform_settings.maya_checkout_enabled` (**default FALSE**) + `MAYA_*` keys | **Yes – before switching on** |
| **Jitsi** (`meet.jit.si`) | Whatever people share in a call; Setnayan only makes the link | Virtual meetings between host and supplier | **UNKNOWN** | Always available | Disclose |
| **Embedded players** (Vimeo, YouTube, Instagram, TikTok) | Viewer IP and those services' own cookies, when an embed is shown | Showing supplier videos | US / global | When a page carries an embed | Disclose |
| **Code and model hosts** (jsDelivr, unpkg, Google Cloud Storage) | Viewer IP only. They serve the face-check, receipt-reader and video-compression files; the selfie and the receipt are processed **on the person's own device** and not sent | Downloading on-device models | Global | When the feature is used | Disclose |
| **Have I Been Pwned** | First 5 characters of a password's SHA-1 hash (k-anonymity) | Refuse leaked passwords | Global | Always | Not identifiable |
| **Philippine government registry pages** (DTI / SEC / BIR / LGU) | The registration URL read from a QR on a supplier's paper | Checking a supplier's paper is real | Philippines | During a paper read | No |
| **Suppliers** (other users) | A host's event name, date, guest count, budget per head and venue; never the host's email or personal name unless the host shares it | Running a booking | Philippines | When a host contacts or books them | Joint use under the Terms; consider a supplier data-sharing clause |
| **Coordinators** (other users) | Guest list, seating, schedule, the host's supplier chats — only the scopes the host grants | Helping run the event | Philippines | When a host invites one | Covered by the host's consent screen |

**Not used (verified absent or switched off in code):** PostHog and every other analytics/pixel (removed 22 Oct 2026; no GA, GTM, Meta Pixel, Plausible, Hotjar). LanguageTool (removed 23 Oct 2026; a test fails if it returns). Google Gemini (mood-board renders retired). Suno (no runtime calls). Persona and Veriff (inbound webhook stubs only; nothing sent out). Identity-check companies. SMS of any kind. A CSAM hash-match provider (hook exists, `CSAM_HASH_MATCH_ENABLED` off, no provider wired).

## G. Cross-border transfers

**Yes. No Setnayan data is stored in the Philippines.** Every location is a third-party provider; Setnayan runs no servers of its own.

| Data | Destination |
|---|---|
| The database, incl. biometric face vectors | Singapore (Supabase) |
| Photos, videos, selfies, chat files, contracts, supplier papers | Asia-Pacific (Cloudflare R2; exact country not published by Cloudflare) |
| App processing | Singapore (Vercel `sin1`); Vercel is a US company |
| AI processing (Anthropic, OpenAI) | United States |
| Error reports (Sentry) | Likely United States – confirm |
| Email (Resend) | UNKNOWN – confirm |
| Google, Apple, Meta, TikTok, push services, OSM | US / global / EU |

Safeguard in place today: provider terms only. **No DPA, standard contractual clauses or NPC-approved transfer instrument is signed with any recipient.** RA 10173 § 21 keeps Setnayan accountable for data it transfers; see `gaps.md` G-2.

## H. Retention and disposal

**Read this first: Setnayan has no scheduler.** `vercel.json` has no crons, and the one database cron ever made was removed. Every clean-up job runs when a page is opened and claims a slot in the database (`lib/periodic-job-registry.ts`: 44 jobs, 12 of them retention jobs). Almost all retention jobs start from the **admin console layout**, so they run only while staff use the console. The face-selfie erase also starts from the public home page. Describe these as "run about weekly while the admin console is in use", not as automatic. Run log: `cron_job_runs`.

| Record | Retention rule in code | Disposal |
|---|---|---|
| Full-resolution photo and clip originals | Until **92 days after the event's last day** (`FULL_RES_POST_EVENT_GRACE_DAYS`), then replaced by a 720p copy (`papic-fullres-drop`). Originals are never dropped before the host has received them where Drive sync is on. | Original file deleted; compressed copy kept |
| Compressed photo copies (Memories) | **Kept for life.** No job deletes them. | Only by host "delete forever" or event deletion |
| Face selfie + face vector (per event) | Erased **12 hours after the event's photo window closes** (job every 30 min); backstop at **92 days** after the event; at once on withdrawal | Hard delete (database row + R2 file); photo tags kept |
| Account-wide face profile | No timer; deleted at account erasure or when switched off | Hard delete |
| Couple–supplier chat | **5 years after the event** (`RETENTION_YEARS=5`) — **except any event with an order, which is skipped entirely** | Thread deleted |
| Chat file attachments | 90 days after the event — **ships OFF** (`CHAT_FILE_EXPIRY_ENABLED`) | — |
| Supplier raw identity uploads | 90 days after the verification decision (`VENDOR_IDENTITY_RETENTION_DAYS`) | File deleted |
| Deep Search dossiers | 180 days (`DEEP_SEARCH_KEEP_DAYS`) | Row deleted |
| Anonymous unsaved drafts (and their anonymous sign-ins) | 30 days (`ANON_DRAFT_TTL_DAYS`) | Hard delete |
| Unanswered / declined connection requests | 30 days | Hard delete |
| Group (samahan) stories | 24 hours | Hard delete |
| Download-all zips; unsaved form uploads | 48 hours; 24 hours | Hard delete |
| Daily visit salt and codes | Next day (database) | Hard delete; daily totals kept indefinitely |
| Payments, receipts, orders, contracts | **NONE – kept with no end date.** The 10-year BIR / Civil Code figure is a floor stated on `/privacy`, not a job. Payment screenshots in R2 are never deleted, even when an admin deletes an event. | — |
| Support messages (`help_messages`) | **NONE – decision needed.** Text blanked at account erasure only. | — |
| App error log table (`app_telemetry_logs`) | **NONE – decision needed** | — |
| Sentry error reports | Sentry's own plan limit (`ERROR_LOG_RETENTION_DAYS=90` is a recorded figure, not a job) | By Sentry |
| Fraud device hash (`user_devices`) | **NONE – decision needed.** Kept after account deletion on purpose. | — |
| Admin audit and data-access logs | **NONE – decision needed** | — |
| QR-scan records (truncated IP) | **NONE** on a timer; deleted with the event | Cascade |
| Notifications | No timer; deleted at erasure and with the event | — |
| Pabuya gift records and screenshots | Until the event is deleted | Cascade |
| Removed guests | **Soft-deleted only (`guests.deleted_at`); never purged** until the event is deleted. Seat assignments cleared; photo tags, QR scans and face rows stay (face sweeps still apply). | — |
| Database backups | Provider setting: daily, **kept 7 days** (owner's Supabase screenshot, 2026-10-23; `DB_BACKUP_RETENTION_DAYS`). Not in code. | Age out |
| R2 files (photos, documents) | **No backup, no versioning** | — |

**Deletion that exists in code:**
- **Account:** the person types DELETE on Profile → a request row → a staff member approves at `/admin/account-deletions` (24-hour target, not enforced; day-3 reminder email) → `eraseUserAccount` blanks name, phone, photo, birth date, religion, civil status, sex, address and slug, tombstones the email, revokes sessions and Apple sign-in, scrubs the sign-in email and metadata, purges chat bodies, verification documents, face data and support-message text, and deletes the profile photo and logo files. Business records are kept. **`auth.users` is blanked, not deleted. `auth.identities` (the Google/Apple link) is not blanked** — a known, listed gap. 82 tables holding people's data have no erasure decision yet (a counter stops the number growing). No waiting "tail" exists.
- **Event ("Remove for good"):** refused while a paid supplier or an unconfirmed payment proof is attached; a database trigger cancels unpaid bills and waitlist entries and clears notifications; the event's R2 files are deleted by key; bookings, contracts, confirmed payments and reviews survive for the supplier; chat attachments are kept (owner ruling). Direct deletes through the database API are revoked.
- **Photo:** host "delete forever" removes the row and every file. A guest can remove their own tag at once and ask for the photo to come down (a person decides), or hide it from the wall. **No supplier-side delete of a supplier capture was found.**
- **Data export:** JSON from Profile (`/api/profile/export`), 63 tables included, 38 excluded with a written reason, 3 undecided (`fraud_enforcement_audit`, `user_devices`, `vendor_client_notes`). Face vectors are not exported, only the consent records.

## I. Automated decision-making and profiling (separate notification)

**Yes — Setnayan carries out automated processing that can significantly affect people.** The decisions with real effect:

| System | Data used | Automated decision | Effect | Human review / appeal |
|---|---|---|---|---|
| **Supplier fraud auto-suspend** (`lib/fraud-detection.ts`, `fraud-enforcement*.ts`) | Review rings, posting speed, isolated reviewers, rating patterns, device-hash clusters | Score ≥ 60 → admin queue. Score ≥ 95 with enough signals → **listing hidden and badges frozen automatically**. Runs after every review. No off switch found. | **Significant** (a business stops being visible) | Reversible by one admin; wipe or ban needs two admins. Appeal "via Help Center" is written on `/privacy`, but **no formal appeal process exists in code.** |
| **Self-review block** (database trigger) | Is the reviewer the owner, a team member, or linked by payment, device or household? | **Review refused** | The person cannot post | The error names an appeal route; an owner reviewing their own shop can never be overridden |
| **NSFW screening** (`lib/nsfw-screen.ts`, self-hosted nsfwjs model) | Every uploaded photo and clip | Blocked content is **withheld from display** | Content withheld | The host can restore one at a time |
| **Face auto-tagging** (`lib/face-match-core.ts`, on-device face-api.js) | Face descriptors of consenting adults | Distance ≤ 0.50 → tag; 0.50–0.60 → suggested tag a person confirms; > 0.60 → untagged | Decides who receives which photos (biometric) | Opt-in per event and per guest; tags can be fixed by hand |
| **Guest message filter** (word lists, not AI) | Guest's message text | Blocked messages refused; flagged ones (swearing, phone numbers, emails) held for the host | Content refused | Host approves flagged; **blocked has no appeal** |
| **Supplier card contact filter** | Text a supplier types | Contact details refused | Content refused | None |
| **Mood-board photo screen** (Anthropic) | Supplier's photo | Refused or held if it shows QR codes, contact details or a logo | Content refused | Admin approval is the backstop; if the check fails to run, the photo goes through |
| **Editorial moderation** (OpenAI) | A couple's story text | Flags hold the draft until an admin clears it | Delays publication | Admin |

**Profiling (no decision about the person, but declare it):**
- **Marketplace ranking** (`lib/compat-score.ts` and lenses): uses the host's venue, budget, date, headcount and style, and the supplier's distance, reviews, newness, verification, reply speed and a paid boost (`ad_rank`) to order results and show a match %. It never hides a supplier. Hosts can switch between 5 sort modes.
- **Same-date demand counts** ("N other couples are asking about this date"): de-identified, suppressed below 3, opt-out per event.
- **Unanswered-inquiry reminders**, which may feed the reply-speed signal used in ranking.

**Advisory only (a person decides):** Deep Search background report for verification (Anthropic web search); verification-paper reader (Anthropic; writes what it read, decides nothing); on-phone payment-receipt reader (Tesseract, on the buyer's device; can never approve a payment); review-fraud screener, plausibility scanner, ghost-listing and image-repost watches (flags only); supplier AI auto-reply (deterministic rules, labelled "⚡ AI auto-reply"); Setnayan AI planner (fixed rules, no AI model); admin search assistant.

## J. Security measures (only what is real)

### Organisational
- PIC and DPO are the same identified person; DPO email published on every legal page.
- A Privacy Manual, Breach Management Policy and DPO Designation exist as v1.1 drafts in the specs corpus. **None is signed.**
- A DPO console at `/admin/data-privacy`: about 32 privacy controls that switch features on or off, a privacy coverage panel, the NPC document library, deletion queues, job health, and the 15-item `npc_filing_tasks` checklist.
- Deletion queues with a 24-hour staff target (`account_deletion_requests`, `event_deletion_requests`).
- Every staff view or export of a person's data is logged (`admin_data_access_log`); staff actions are logged (`admin_audit_log`, written from ~100 places).
- Permanent enforcement against a supplier (wiping reviews, banning) requires two staff members.
- Staff confidentiality agreements and privacy training: **UNKNOWN – ask Ice** (listed as owed in the filing tasks).

### Physical
- Setnayan runs no servers and no office data room. Physical security is the providers' (Supabase, Vercel, Cloudflare). Their certifications are not provable from code — **attach their published SOC 2 / ISO reports if counsel wants them.**
- Staff devices (laptop encryption, screen lock): **UNKNOWN – ask Ice.**

### Technical
- **In transit:** HTTPS with HSTS (`max-age=63072000; includeSubDomains`, no preload), `nosniff`, `X-Frame-Options: SAMEORIGIN`, strict referrer policy, Permissions-Policy limiting camera, microphone and location to the site itself. An **enforced** Content-Security-Policy covers framing only; the full CSP runs in report-only mode.
- **At rest:** provider-level encryption is the providers' default (not provable from code). In the app, OAuth refresh tokens and integration secrets are sealed with AES-256-GCM with key rotation (`lib/encryption.ts`, `lib/secrets/reencrypt.ts`). Device IDs, viewer IDs and throttle IPs are stored only as salted SHA-256 hashes. QR-scan IPs are cut to 3 octets. Location is stripped from every photo download and share (a file is dropped if the strip fails).
- **Access control:** Postgres Row-Level Security with policies, plus table and column grants. CI fails if what the public or signed-in roles can reach widens (`exposure-freeze.db.test.ts` and related grant tests). Admin pages return 404 to non-staff (`requireAdmin`), staff permissions are scoped by area (`admin_scopes`), and a lint stops browser code importing server-only (service-role) modules. Private files are served only through short-lived signed links. Guest access uses a signed, httpOnly, Secure, 60-day cookie and per-event QR tokens.
- **Authentication:** email + password (minimum 8 characters, checked against known leaked passwords via a k-anonymous lookup); optional Google, Apple and Facebook sign-in behind switches. **No two-factor sign-in exists for anyone, including staff.**
- **Abuse limits:** per-event, per-hashed-IP throttles on joining, venue and anonymous-session doors; a burst limit on photo capture; an in-memory rate limiter on uploads and other routes (best effort — it does not hold across server instances). Cloudflare Turnstile is built (whether a key is set: UNKNOWN).
- **Secrets:** environment variables in the hosting settings only; `.env` files are git-ignored; gitleaks secret scanning is a required CI check; a rotation registry exists.
- **Monitoring:** Sentry error monitoring (masked replay, face vectors scrubbed).
- **Content safety:** NSFW screening on every capture, which cannot be switched off.
- **Backups:** daily database backups kept 7 days (provider setting). **Photos and files on R2 are not backed up.**
- **Privacy-specific CI guards:** a test fails if a new outside host receiving user data is not named on `/privacy`; a test holds every retention promise on the legal pages to a named mechanism; a test fails if face tagging stops being opt-in; a test checks the NPC pack against the product.

**Not in place (do not claim):** two-factor sign-in · a breach register or incident tool · R2 file backup or versioning · an automated check that every table has RLS on (`scripts/rls-audit.sql` exists but CI does not run it) · a fully enforced CSP · rate limits shared across instances.

## K. Mandatory or voluntary?

NPC Circular 2022-04 makes registration **mandatory** for a PIC or PIP that meets any one of: (a) 250 or more employees; (b) processing sensitive personal information of **1,000 or more** individuals; or (c) processing likely to pose a risk to the rights and freedoms of data subjects. *(Check the circular's exact wording and its list of sectors that must register regardless — counsel or the NPC help desk.)*

| Test | Assessment |
|---|---|
| (a) 250+ employees | **No** (headcount UNKNOWN, but a small team) |
| (b) Sensitive data of 1,000+ people | **Likely yes, or soon.** Each event's guest list can carry dietary data and sex for every guest; profiles hold religion, civil status and birth dates; suppliers' TINs are required. A handful of real events crosses 1,000. Last recorded count: 48 (Aug 2026). |
| (c) Risk to rights and freedoms | **Yes, on its own.** Biometric face matching; data about minors; religion; automated suspension of businesses; public Event Hubs and photos of people; all data stored and processed outside the Philippines; AI processors in the US. |

**Recommendation: register as MANDATORY now, under criterion (c).** Do not wait for the 1,000 count. Biometric processing and automated decisions alone make "likely to pose a risk" hard to argue against, and criterion (b) is expected to follow shortly after launch. File the DPO registration (or confirm the existing one) and this one DPS, and include the automated-decision notification in § I.
