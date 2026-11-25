# Offline beyond the five: merged list for the owner (25 Nov)

Sources: `origin/final-check/area-1..8:build-sessions/final-check/area-N.md` (each file's "Offline — beyond the five" section, plus the offline findings it cites) and the brief `origin/final-check/brief:build-sessions/FINAL-CHECK-OWNER-ADDS-2026-11-25.md` (Add 10, Add 10b). Read-only; nothing in a repo was changed.

The five FULL places (owner, 24 Nov): guests at the venue (Event Hub + walk-in hub) · supplier on the day · supplier at an expo · couple at an expo · coordinator on the day. Everything else is a saved read-only copy unless the owner adds it here.

---

## 1 · Coverage

| Area | Role(s) | Wrote "beyond the five"? | Tried offline on the copy? | Add 10b (QR)? |
|---|---|---|---|---|
| 1 · public front door | couple (signed out), guest, supplier public pages | yes, 3 tables | yes: help/public pages (A1-166); shop pages not tried (A1-154) | n/a |
| 2 · host / couple dashboard | couple | yes, 1 table | yes: check-in desk, dashboard reloads, Event Hub (A2-P22) | "nothing to add" (couple only scans) |
| 3 · Maker, Memories, Papic studio, Panood | couple + guest Hub parts | yes, 2 tables | yes: Memories open + reload; Event Hub NOT tested (answered 500, B-02) | n/a |
| 4 · guest | guest | yes, 1 table (Hub/seat/camera left out as part of the five) | yes: Hub copies, /seat, /find-seat, worker count; Papic from code | n/a (notes A4-B02) |
| 5 · supplier shop / QR makers | supplier | yes, 1 table | yes, but only "open fresh" (all fail); "QR page already open" not finished (sign-in failed, B5-19) | yes, full |
| 6 · supplier clients / on the day | supplier | yes, 1 table | yes: on-the-day + chat reload (A6-B22); on-the-day copy not tried (no booked event, A6-B12) | yes, full |
| 7 · coordinator, Spaces, venue | coordinator, couple, guest | yes, 3 small tables | yes: /venue, /pa3d, /for-coordinators | yes (demo QR, payment QR) |
| 8 · admin | admin (not in the role list) | yes, 1 table | yes: /admin/work (P-B-17, P-B-18) | n/a |

All 8 wrote the section. Gaps: no area wrote an **Event Hub host-side** table beyond what the five cover (area 4: "covered by the five"); the **coordinator** got only two rows (area 7), because the coordinator's day-of tools were locked on the seed. Every in-browser test used a headless offline switch; areas 2, 3 and 5 each say a real phone (DevTools offline) must confirm before a fix.

---

## 2 · Proposed additions beyond the five (de-duplicated)

Sorted inside each role by number of areas, then by how bad the break is. "Areas" = which area files raised it.

### Every role (cross-cutting)

| Part | Moment | Level | Why | Areas |
|---|---|---|---|---|
| Any page opened or reloaded with no signal → **Setnayan's own offline page**, not the browser's blank error | anywhere | floor (not a level: the minimum) | today every dashboard, supplier, admin, help and public page gives `ERR_INTERNET_DISCONNECTED`; `sw.js` leaves "every other navigation" to the browser | 1, 2, 3, 5, 6, 7, 8 (7) |
| Chat: read the last messages, queue a typed reply (`/messages/[threadId]` couple · `/vendor-dashboard/messages/[threadId]` supplier · `/samahan/chat/[threadId]` day-of crew · admin help replies) | venue on the day, on the road, expo | READ-ONLY + SAVE AND SYNC send. Money cards (Ask for ₱, Confirm received) must NOT queue | a reply typed in a dead zone is lost today | 1, 2, 6, 8 (4) |
| Run of show readable (couple `/schedule` · supplier `clients/[eventId]/their-event/schedule` · crew `/join/crew/[token]` · Papic `studio/papic/run-of-show`) | venue on the day | READ-ONLY (couple "done" ticks and Papic "happening now": SAVE AND SYNC) | everyone re-checks the call time and the next moment | 2, 3, 4, 6 (4) |

### Supplier

| Part | Moment | Level | Why | Areas |
|---|---|---|---|---|
| **QR** `/vendor-dashboard/shop/qrs/[code]` show one code (+ the list `/shop/qrs`) | expo booth, venue | **FULL** to show (list READ-ONLY) | the code is drawn on the server (`renderUrlQrSvg`): no signal = no code at all. Shop-link codes never change, so a kept copy is safe | 5 (6 via the booked QR) |
| **QR** `/vendor-dashboard/invite` (Add a client · Booked one-use) make a deal at the booth | expo booth, on the road | SAVE AND SYNC (this is #8284's job) | a deal agreed at the booth waits for signal; today a server action refuses offline | 5, 6 |
| Day-of client pack: `clients/[eventId]` (contact, venue, headcount, agreed amount), `production-sheet`, `their-event/schedule · numbers`, `cocktail · mood-board`, `seat-plan` (covers per table) | venue on the day | READ-ONLY | the caterer cooks and plates from it; only print saves it today; seat-plan not saved | 6, 7 (2) — arguably inside "supplier on the day" |
| Dates "is this date open?" (`/vendor-dashboard/customers` › Dates) | expo booth | READ-ONLY, marked "as of …" | answer a walk-up couple | 6 (1 also wants the couple's side, below) |
| Bookings list (`customers` › Events), Today (`/vendor-dashboard`) | venue, road, province | READ-ONLY | the week's plan as last seen | 5, 6 |
| Price list: `packages`, Shop cards; Portfolio `collections` | expo booth | READ-ONLY "as of last sync" | quote and show past work at the table | 5 |
| Cash on the day: client › Payments "Confirm received" | venue (cash) | SAVE AND SYNC, amount re-checked at sync | mark cash on the spot | 6 (2 raised the couple's side) |
| Booking fees, contracts, profile | province, road | READ-ONLY | see what is owed / read own details | 5, 6 |
| Public `/for-suppliers`, `/features/supplier-*` | expo, showing a couple | READ-ONLY | a blank page at the booth looks bad | 1 |
| Plan, Team, Toolkit, Your page, Deep Search, Spaces | — | NOT NEEDED | buying/editing needs network by rule | 5, 7 |

### Couple / host

| Part | Moment | Level | Why | Areas |
|---|---|---|---|---|
| Guests list + guest card (`/guests`, `?inspect=`) | venue on the day, parish | READ-ONLY | find a guest's table, phone, plus-ones | 2 |
| **Souvenir desk** `/guests/souvenirs` | venue on the day | SAVE AND SYNC (like check-in) | the giveaway table runs like check-in; not in `OFFLINE_COPY_SHAPES` today | 2 |
| Record a cash payment (`/budget`, supplier payment record) | venue, province | READ-ONLY + SAVE AND SYNC for "record cash" | pays cash at the venue, must log it before forgetting | 2 (6 supplier side) |
| Contract `/contracts/[contractId]` | venue on the day | READ-ONLY | settle "what was agreed" | 2 (6 supplier side) |
| Memory lane: hide a photo, guests' phones off (`/dashboard/[eventId]/live`) | venue on the day | SAVE AND SYNC, says "will hide when back online" | a wrong photo on the venue screen must come down now | 3 |
| Panood program window `/panood/program/[eventId]` (keep last scene); controller `/panood/control` | venue on the day | FULL (program) · SAVE AND SYNC (settings) | a reload error page goes out live; each tap is a form POST with no queue, a dropped tap looks done | 3 |
| Papic challenges "Ask now/Stop", run-of-show "happening now" | venue on the day | SAVE AND SYNC | today reports "saved" after a failed write (P-01) | 3 |
| Memories credits + Papic switch (`/memories`) | venue | READ-ONLY (switch SAVE AND SYNC) | balance must show last copy with its time, never 0 | 3 |
| Crew pairing QR `/event-qr` | venue door | READ-ONLY | crew scan it at the door | 3 |
| Guests › Send run `/guests/send` ("Mark sent") | province, weak data | SAVE AND SYNC | lost marks between invites | 3 |
| 3D room `/plan3d`; supplier Workspace Details | venue; on the road | READ-ONLY | show the room to venue staff; call the supplier from the car | 7 |
| Print sheets (invitation print, crew poster) | print shop | READ-ONLY | print on weak data | 3 |
| Paperwork `/paperwork` | parish / LGU window | READ-ONLY | tracking numbers at the window | 2 |
| Saved comparison `/explore/compare`; supplier page `/{shop}` last copy | expo | READ-ONLY | re-open the two suppliers being weighed (couple-at-expo place covers the action; the page needs a copy) | 1 |
| Check a date `/{shop}?dates=1` | expo, from printed QR | SAVE AND SYNC ("We'll send this when you're back") | the couple's question is lost | 1 |
| Maker `/launch` draft kept on the phone | province | READ-ONLY + local draft | typed story lost on weak data | 3 |
| `/start` onboarding draft | road | SAVE AND SYNC (area 1) vs NOT NEEDED (area 2: already in the browser's draft) | **areas disagree** — owner call | 1 vs 2 |
| Galleries, alaala, story, download-all | road | READ-ONLY | looking back; can wait | 3 |
| Event home `/dashboard/[eventId]` | anywhere | READ-ONLY (built; but see A2-P22: not served on reload) | — | 2 |

### Guest

| Part | Moment | Level | Why | Areas |
|---|---|---|---|---|
| Table review QR `/v/[slug]/guest-review` | venue on the day | SAVE AND SYNC | review written at the table vanishes | 1, 6 (2) |
| `/[slug]/venue` (3D walk to your seat) | venue | READ-ONLY | find-my-table is saved, this is not | 7 |
| RSVP `/[slug]/invite/reply`; plus-one name `/[slug]/welcome` | road, province, days before | SAVE AND SYNC | a lost reply is a guest the hosts chase by hand | 4 |
| `/papic/me/[token]` (door to my camera from the pass) | venue door, tables | READ-ONLY | the pass QR opens the browser's error page | 4 |
| `/join/crew/[token]` crew run of show | back of house | READ-ONLY | re-check the call time | 4 |
| E-Gifts details `/[slug]/pabuya` | money dance | READ-ONLY | show GCash/bank to send later | 4 |
| `/help/*` answers | venue, province | READ-ONLY | "what if the venue has no signal" gets a blank page | 1 |
| `/[slug]/print`, `/login`, `/signup`, `/pricing` | — | NOT NEEDED (login: say "You're offline") | — | 1, 4 |

### Event Hub

Area 4: covered by the five. Two extras inside the five that areas flagged: the saved Hub copy must carry the opening reveal's art or open straight to the page (area 3); Memory lane on guests' phones READ-ONLY (area 3).

### Coordinator

| Part | Moment | Level | Why | Areas |
|---|---|---|---|---|
| `/vendor-dashboard/clients/[eventId]/seat-plan` | venue on the day | READ-ONLY | covers per table at the door; not saved | 7 |
| Papic run-of-show "happening now" | venue | SAVE AND SYNC | marks the moment as it happens | 3 |

### Admin (not a listed role; area 8 only)

Focus/Work queue and Money › To approve READ-ONLY; help replies SAVE AND SYNC; BDO screenshot matcher reads on the phone, confirms online. Everything else NOT NEEDED.

---

## 3 · What ships today, tested offline

| Piece | Result | Words shown | Findings |
|---|---|---|---|
| Check-in desk, **already open**, signal drops | **works**: search still finds guests with tables ("Josefa": 5); catches up back online with no reload. No scan was made (seed) | "No signal · scans will be saved on this phone" | A2-P22 (WHAT WORKS) |
| Check-in desk / Home / Schedule / Souvenirs / Budget / Suppliers **reopened or reloaded** | **broken**: browser's own "no internet"; `setnayan-offline-pages-v1` held 1 entry. A desk phone that reloads, or crew opening the desk link at the venue, gets nothing | browser error | A2-P22 (broken, SEEN; Playwright caveat) |
| Supplier on-the-day + client chat, reloaded | **broken**: browser error, no offline page; back online needs a manual reload (area 5 instead saw an open page catch up by itself) | open page: "You're offline" | A6-B22 (skipped by fixer: needs a SW offline page); area 5 Add 10 note |
| Souvenir desk | no saved copy at all (not in `OFFLINE_COPY_SHAPES`) | — | area 2 table |
| Event Hub `/<slug>`, `?tab=program`, `/find-my-table` | **works** (kept, network-first, 2-day cache, only what this phone opened) | a 500'd bare slug falls back to offline.html (right) | area 4 phase B line |
| Event Hub `/seat`, `/find-seat` (opened, then offline) | **broken**: not kept → browser error | — | A4-01 (confirmed SEEN) |
| `?tab=me` signed out, offline | browser error, not offline.html | — | area 4 phase B line |
| Home-screen Hub tile, offline | **broken** (code): tile starts at `/redeem?…&to=hub`, which the worker leaves to the browser | browser error | A4-24 (not fixed: design call, touches sign-in) |
| Papic capture | **works** (code-read, not walked): shot saved to IndexedDB, sends when a camera for that event is open (no Background Sync on iOS); dropped after 7 days as "Couldn't save N". Camera page cannot be opened with no signal; ✕ lands on offline.html | "Offline · N waiting … Keep this page open" (match the code) | A4-70 (in fixer batch 2, PR #8319) |
| Guest writes (RSVP, guestbook) | **none queued**: `guestbook-sync` has no caller and posts to a non-existent `/api/guestbook`; media queue worker `sw-offline.js` only with `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED` (off) | — | area 4 "Offline today" |
| Two service workers on one scope if the daemon flag is turned on | latent **broken**: `sw-offline.js` has no fetch handler, so every guest copy stops being served | — | A4-02 (not fixed: design call) |
| Offline bar | **works** on an open page | "You're offline" / "Back online ✓" (honest) | areas 3, 5, 6, 8 |
| Offline bar on admin | covers the top bar (mark, Focus/Full) | — | P-B-17 |
| **Words wrong**: offline.html | promises "Any pages and event details you've already opened are still available" — false for /seat, /find-seat, every dashboard/supplier page | — | A4-01 (fix in batch 4, preflight) |
| **Words wrong**: day-of banner on the Hub | "Your schedule, QR, and venue info are pinned below — they work offline" — QR is only on Me; find-seat, venue, papic have no copy | — | A4-23 (fix in batch 4) |
| Help, public, admin, coordinator, supplier pages | browser error, never offline.html | — | A1-166, P-B-18, area 7 Add 10 note, area 5 Add 10 note |
| Memories (couple) reload | browser error despite active SW | open page: "You're offline" | area 3 offline note |

Biggest broken thing: inside the five themselves, a **reloaded or freshly opened day-of desk (check-in, supplier on-the-day) shows the browser's blank error** (A2-P22, A6-B22). The desk only survives if it was already open when the signal dropped.

---

## 4 · The supplier QR challenge (Add 10b)

### The list (areas 5, 6, 7)

| QR | Kind | Made where | Scanner sees | Offline today |
|---|---|---|---|---|
| Your page | shop link | Shop › Promote › My QRs (`/shop/qrs/page`) | `/{shop}?src=own&via=link` | cannot make or open fresh; static, so a printed/downloaded copy works |
| Reviews | shop link | My QRs | `/{shop}/review` | same |
| Shortlist · free | invite | My QRs | `/{shop}/invite` "Save … to your event" | same |
| Check a date · free | date check (read) | My QRs | `/{shop}?dates=1` (500 on copy, B5-03) | same |
| Invite shops you trust | partner invite | `/open-shop/invite`, Partnerships | partner join page | same |
| Add a client (+ gift) | invite with gift from stock | `/vendor-dashboard/invite` | `/{shop}/invite?ci=…` | cannot make (server action) |
| Booked · one-use (Locked QR) | date + price + first payment | `/invite?mode=locked`; from Clients › Dates "Book a client"/"Show a QR", client "Send their code" | `/vendor/lock/[token]` | cannot make (`issueLockedQr` server action) |
| Print your QR | same codes on paper | Promote › Prints | `via=print` | paper works |
| Crew QR | crew pass | On the day › event › Crew | join page, waits for Allow | shown only from a saved On-the-day copy (`supplierOfflinePaths`) |
| Guest review QR | review form | On the day › Reviews (Print · fullscreen) | guest review form | shown from saved On-the-day copy; guest needs signal to send |
| Payment QR (BDO/GCash image) | payment | Profile › How clients pay you; shown in the couple's Workspace | the image | depends on browser cache; Workspace not saved |
| 3D demo guest QR | demo (not supplier) | `/pa3d` | `/3d_plan/demo/<token>` | cannot make |

A couple scanning while offline themselves reaches nothing: every landing is a server page.

### Sync risks and whether today's code catches them

| Case | QR | Caught today? | Words | Source |
|---|---|---|---|---|
| **Same date held twice** | Booked | **NO.** Checked only at make time, and that check **fails open** on a read error; the claim RPC `vendor_claim_locked_qr` checks only the token (void/taken), never day capacity or blocks — two codes for one date both book it. Open **online too**. Worse: a booked date can read "0 booked · Still has room", inviting a second QR | make-time: "That date is already booked or blocked on your calendar — you can't lock a second booking on it." | A6-71 (🟠 owner: needs RPC + migration), A6-B20, area 5 table |
| Price changed in between | Booked | not checked: the quote rides the token, the old (booth) price books. Fine if "booth price stands" is the rule — owner to confirm | none | areas 5, 6 |
| Account changed in between | Payment QR | not checked; a stale page could show an old account; nothing warns | none | area 7 |
| Gift ran out | Add a client | **yes** (stock checked at scan; couple still lands on the shortlist) | couple is **not told** the gift did not come; supplier sees it only in gift history | area 5 |
| Code shown / scanned twice | Booked | **yes** (`taken`) | "This Locked QR has already been used." — calls it "Locked QR" while the supplier's screen says "Booked · one-use" | area 5, 6 |
| Dead or unknown token | Booked | was a generic 404 | "This page doesn't exist on Setnayan." (area 6 second pass says a new "not valid / couldn't read" state was added) | A6-B23 |
| Code changed while scanning | Booked | **yes** (`replaced_claimed`) | "The code you were changing was scanned a moment ago — it is a booking now…" | area 5 |
| Made on a phone since removed | all | n/a today (server makes every code); must be in #8284 | — | areas 5, 6 |
| Review sent twice | Guest review | not checked | — | area 6 |
| Guest checked in twice from two phones | Scanner | not checked here | — | area 6 (points to 3/7) |

Ease: 3 taps from Today to a code. Code ~170 px on 375 (~4.5 cm): scans phone-to-phone, small for arm's length (no "Show big"). Shop name is under it. Dark: card stays white (right for scanning). Centre mark is a letter tile, not the brand icon (SP5-09).

For #8284's builder: A6-71 must be fixed in the claim RPC first, otherwise the offline engine inherits a double-booking hole that already exists online.

---

## 5 · Recommendation

**Before adding anything: make the five actually work offline** (these are bugs, not additions): reopen/reload of check-in and supplier on-the-day (A2-P22, A6-B22); guest /seat, /find-seat, Hub tile, camera ✕ (A4-01, A4-24, A4-70); the two wrong promises (A4-01 offline.html, A4-23 banner). And fix A6-71 + A6-B20 online before #8284 resumes.

**Add now (8):**
1. **A Setnayan offline page on every navigation** (all roles; 7 areas). Cheapest, biggest honesty win; also covers help/login.
2. **Supplier: show shop-link QRs with no signal** (`/shop/qrs/[code]` FULL, list READ-ONLY) plus a "Show big" view. Static codes, zero sync risk; this is the expo booth.
3. **Supplier day-of client pack READ-ONLY**: client details, production sheet, schedule/numbers, seat plan (areas 6, 7). Natural part of "supplier on the day".
4. **Chat: last copy READ-ONLY + queued text replies** (couple, supplier, day-of crew; money cards excluded) (areas 1, 2, 6, 8).
5. **Souvenir desk SAVE AND SYNC** like check-in (area 2).
6. **Couple day-of READ-ONLY**: guests list + guest card, schedule, contract (areas 2, 6).
7. **Guest RSVP + plus-one name SAVE AND SYNC**, and the table review QR (areas 1, 4, 6).
8. **Memory lane "hide photo" queued** + Panood program window keeps the last scene (area 3: a wrong photo or an error page goes out live).

**Can wait:** Booked QR made offline (wait for A6-71 fix, then #8284) · cash payment records on either side (money, re-check rules first) · Dates "as of" at the booth · price list / portfolio copies · Papic challenges/run-of-show queue · `/papic/me`, `/join/crew`, `/[slug]/venue`, pabuya, 3D room copies · print sheets, paperwork, galleries, compare, Maker draft · `/start` draft (areas 1 and 2 disagree) · admin.

**Owner calls:** does the booth price stand if the shop changes its price before the scan? · should the couple be told when a gift ran out? · one name: "Locked QR" or "Booked · one-use"?
