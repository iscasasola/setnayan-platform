# Setnayan — Owner Walkthrough

> Day-in-the-life reference for every kind of person who uses Setnayan, plus
> how the handoffs between them work. Written for the owner — you can play
> any of these roles from your own account, and you need to know what each
> one feels like to operate the platform.
>
> Companion docs:
> - `OWNER_ACTIONS.md` — one-time setup steps (BIR info, Sentry, etc.)
> - `STATUS.md` — current shipping state, decision log
> - `/how-it-works` — public version of this doc, lives at setnayan.com
> - `/help` — user-facing help articles by role
>
> Last refreshed: 2026-05-19.

---

## The cast

Six kinds of people on Setnayan. Three of them have logins (couple, vendor,
admin). Three are visitor-mode (guest, public-landing visitor, event-landing
visitor — the last two are different pages, both unauthenticated).

| Role | Entry path | Logged in? | Built and shipped |
|---|---|---|---|
| **Couple** | `/signup` → `/dashboard/[eventId]` | Yes | V1 |
| **Vendor** | `/signup?as=vendor` → `/vendor-dashboard` | Yes | V1 |
| **Guest** | personal QR or slug link → `/[slug]` | Cookie session | V1 |
| **Admin** | `/login` (gated by `is_internal`) → `/admin` | Yes | V1 |
| **Public landing** | `setnayan.com/` | No | V1 |
| **Event landing** | `setnayan.com/[slug]` | No (or guest cookie) | V1 |

**Coming in V1.2:** multi-moderator event access (sharing your event with a
co-couple, parent, or coordinator). Today every event has exactly one owner —
see [Multi-moderator section](#multi-moderator-v12--whats-not-yet-supported)
below.

---

## The couple journey

The largest role by interaction surface. A couple owns one event and works on
it for months.

### 1 · First sign-up

`https://setnayan.com/signup` with role=couple. Email + password, ≥ 8
characters. V1 auto-confirms — no email round-trip needed (Resend SMTP is
wired but auto-confirm is on for the duration of the soft-launch). On
submit they land at `/dashboard`.

### 2 · Create the event

`/dashboard` shows an empty state with one big CTA: **Create event**.
Required fields:
- Event type (Weddings only in V1 — other types are "Coming Soon" on the
  homepage; the picker only shows Wedding)
- Display name (this is what guests and vendors see — usually
  "Maria & Juan" or "The Cruz Wedding")
- Event date

The event gets a public ID like `S89E-AB12CD3456` and a slug like
`maria-and-juan`. Slug is editable on the Invitation tab; old slugs
auto-redirect for 90 days. On submit they land on `/dashboard/[eventId]`.

### 3 · The 9 surfaces

Inside `/dashboard/[eventId]/*` the couple navigates between nine sub-surfaces.
The left sidebar (desktop) or bottom tab bar (mobile) persists across them.

| Surface | Route | What it does |
|---|---|---|
| Overview | `/dashboard/[eventId]` | Home base — countdown, today's actions, recent activity |
| Guest list | `/dashboard/[eventId]/guests` | Add guests, 18 canonical roles, plus-ones, CSV import |
| Invitation | `/dashboard/[eventId]/invitation` | Branding, monogram, print QR sheet, share links |
| Vendors | `/dashboard/[eventId]/vendors` | 6-stage tracker per vendor + budget rollup |
| Budget | `/dashboard/[eventId]/budget` | Line items, payments, .ics export of due dates |
| Seating | `/dashboard/[eventId]/seating` | Drag tables, seat guests, publish to mint QR seat-cards |
| Mood board | `/dashboard/[eventId]/mood-board` | Three palette tiers (venue / couple / role) |
| Messages | `/dashboard/[eventId]/messages` | Threads with vendors — couple-initiated only |
| Day-of | `/dashboard/[eventId]/activity` | T-1h → T+8h activates live mode (table, schedule, photo wall) |
| Add-ons | `/dashboard/[eventId]/add-ons` | LED, Papic, Panood, Patiktok, photo delivery, supplies marketplace |

Plus `/dashboard/profile` for account settings and theme picker, and
`/dashboard/notifications` for the unified inbox.

### 4 · Adding vendors

Two paths today:

- **Browse the marketplace** at `/vendors` — filter by city, category,
  price, rating. Click a vendor → land on `/v/[slug]` → "Start a thread"
  pops a confirm dialog → message appears in your `/dashboard/[eventId]/messages`.
- **Add a tracked vendor manually** in `/dashboard/[eventId]/vendors` — for
  vendors who haven't joined Setnayan. You pick from 28 canonical
  categories (or "Miscellaneous"), enter their total cost + deposit. Off-platform
  vendors can be invited to Setnayan via the Invite CTA on the card (added
  in PR #137, 2026-05-19).

Only couples can open threads with vendors. Vendors cannot DM cold — they
can only reply. This is intentional: it protects couples from unsolicited
sales pitches.

### 5 · Building the guest list

`/dashboard/[eventId]/guests`. Two modes:
- **One at a time** via the Add Guest form. 18 canonical roles, plus-one
  toggle, side (bride/groom/both), group category (family/work/friends/etc.),
  meal preference, dietary notes.
- **CSV import** — paste a spreadsheet (max 200 rows). Required columns:
  `first_name`, `last_name`. Optional: `side`, `role`, `email`, `mobile`,
  `meal_preference`, `plus_one_allowed`. Bad rows are flagged; valid rows
  insert atomically.

Each guest gets a personal URL with their QR token. On the Invitation tab
the couple can print the full A4 QR sheet (one per guest) or copy individual
links from the guest table.

### 6 · Seating

`/dashboard/[eventId]/seating`. Drag-and-drop floor plan:
1. Pick a table shape from the palette (round, rectangular, king's, etc.)
2. Drop on the canvas — rotate, resize, label
3. Tap a chair to seat a single guest
4. Tap the table body to swap whole tables (e.g. swap principal-sponsors table
   with bride's family table)
5. Click **Publish** to mint per-guest QR seat-cards

The Day-of card on each guest's personal page shows their table number
automatically after publish. Re-publish anytime; QRs update on next scan.

### 7 · Day-of mode

`/dashboard/[eventId]/activity` becomes "live" from T-1 hour to T+8 hours on
the event date. The same page also auto-prefetches assets at T-24h →
T+12h via the service worker (PR #12, iteration 0037).

The same time-window flips every guest's personal page into day-of mode
with 6 cards: What's happening · Your table · Live photo wall · Video
guestbook · Live schedule · Coordinator broadcast (some cards are stubs
pending iterations 0009/0011/0012).

### 8 · Post-event

24 hours after the event date, an email goes out to the couple asking them
to review each vendor they used. Reviews are permanent and surface
publicly on the vendor's `/v/[slug]` page. The 4-stage flow is in
iteration 0006.

Force-majeure disputes (typhoon, illness, venue closure) can be filed
from `/dashboard/[eventId]/disputes` — see [Cross-role handoffs](#cross-role-handoffs).

---

## The vendor journey

Two-sided platform — half the work is making vendors feel served. Free
tier covers most needs; Pro at ₱499/wk unlocks scale.

### 1 · First sign-up

`/signup?as=vendor`. Same form, picks "Vendor" instead of "Couple". Lands
on `/vendor-dashboard` with a profile editor and a guided tour.

### 2 · Fill in the profile

Required for marketplace visibility:
- Business name
- Contact email (this is how couples find them — they search by this exact
  string)
- City + 10-50 km radius
- At least one published service
- Logo (PNG with transparent background works best — couples see it in
  their thread list and on `/v/[slug]`)

### 3 · The 11 vendor surfaces

| Surface | Route | What it does |
|---|---|---|
| Profile | `/vendor-dashboard` | Business name, services, contact email, logo |
| Services | `/vendor-dashboard/services` | Add / edit / publish-toggle services |
| Bookings | `/vendor-dashboard/bookings` | Incoming + accepted + completed bookings |
| Contracts | `/vendor-dashboard/contracts` | Dual-sign contracts with couples |
| Messages | `/vendor-dashboard/messages` | Reply to couple-initiated threads |
| Reviews | `/vendor-dashboard/reviews` | Couple reviews + appeal flow |
| Team | `/vendor-dashboard/team` | 4 roles: Owner / Admin / Agent / Viewer |
| Earnings | `/vendor-dashboard/earnings` | Per-month rollup, expected vs received |
| Verify | `/vendor-dashboard/verify` | 12-doc verification checklist |
| Marketing | `/vendor-dashboard/marketing` | Boosted Ads (5/10/20 km) + Sponsored Boost |
| Tax docs | `/vendor-dashboard/tax-documents` | BIR 2307 quarterly + receipts |

### 4 · The reply-only inbox

Vendors cannot start cold chats. Their inbox is reply-only:
- A couple opens a thread first (from their own dashboard or `/v/[slug]`)
- The vendor sees the thread in `/vendor-dashboard/messages`
- They reply with text, files, quotes
- Couple's identity stays masked until the couple chooses to share — vendors
  see "Maria & Juan · 2026-12-12" not personal email or phone

This is locked behavior — see Vendor Agreement § 3.10. The "no cold DM" rule
is what makes couples comfortable engaging vendors here.

### 5 · Free vs Pro

| Capability | Free | Pro (₱499/wk) |
|---|---|---|
| Verified profile | ✅ | ✅ |
| In-app chat with couples | ✅ | ✅ |
| Manual booking tracking | ✅ | ✅ |
| BIR-compliant receipts | ✅ | ✅ |
| Single service | ✅ | — |
| **Unlimited services** | — | ✅ |
| **Auto-disbursement T+1** | — | ✅ |
| **Proposal builder** | — | ✅ |
| **Team invites** | — | ✅ |

Pro is currently free until **Mar 31, 2027** for early-adopters (PR
launch-promo). Boosted Ads and Sponsored Boost are separate add-ons on top
of Pro.

### 6 · Verification

Optional but high-leverage. 12-document checklist:
DTI / BIR 2303 / Mayor's Permit / gov ID via Persona/Veriff/Onfido / bank
micro-deposit / portfolio + reverse image search / 3-5 references / live
selfie + liveness / 15-min Google Meet / SMS OTP + email / social presence
verification / AMLC sanctions screen.

All-or-nothing — submit everything, then 3-5 BD SLA. Free initial; ₱1,499
annual renewal; ₱2,499 re-verification after demotion. Verified vendors get
the badge on their public profile, eligibility for Sponsored Boost, and
immediate full payout T+1 (vs 3-stage milestone release for unverified
"coming soon" vendors).

### 7 · Earnings + payouts

`/vendor-dashboard/earnings` rolls up per-month gross vs net. Setnayan keeps
5.0% as a flat convenience fee (covers gateway + BIR 0.5% pass-through +
Setnayan margin). Vendors absorb gateway fees; Setnayan absorbs ₱15-25
disbursement fees on each payout.

---

## The guest journey

No login. The whole experience runs off a personal QR or a shared link.

### 1 · Receive the invite

Two formats:
- **Printed QR card** — physical invitation card with a QR. Guest scans it
  with their phone camera, browser opens the URL.
- **Digital link** — the couple shares `setnayan.com/[slug]?invite=[token]`
  via Messenger, WhatsApp, email, etc.

Either way, the redirect handler at `/[slug]/redeem` sets a guest-session
cookie scoped to that event and bounces the guest to `/[slug]`.

### 2 · The invitation page

Lives at `setnayan.com/[slug]`. Auto-shifts through 4 phases depending on
where you are in the event lifecycle (per iteration 0002):

| Phase | When | What guest sees |
|---|---|---|
| Save-the-Date | > 90 days before | Date + venue + countdown + minimal RSVP |
| Invitation | 90 → 7 days before | Full details, dress code, RSVP form, plus-one naming |
| Logistics | 7 days → T-1h | Schedule preview, venue map, meal selection |
| Post-event | T+1d onwards | Thank-you note, photo gallery (if enabled), review prompt |

The page is personalized with the guest's name, role (e.g. "Principal
Sponsor"), and side (bride / groom / both). The QR card shown on the page
is the same QR they bring on the day to find their seat.

### 3 · RSVP

Tap the RSVP button → pick Yes / No / Maybe. If their invite allows a
plus-one, they name them inline (or "TBA" → name later). They can change
their answer up to the couple's cutoff (usually 1-2 weeks before).

When a guest RSVPs, the couple gets an in-app notification. The aggregate
counts on the couple's Guests page update instantly.

### 4 · Day-of mode

From T-1h to T+8h on the event date, the personal page flips to live mode
with 6 cards. The most important ones:
- **Your table** — table number + small venue map + (if uploaded) seat
  photo. No need to ask the host.
- **Live schedule** — what's happening right now and what's next. Auto-advances
  as the day moves.
- **Photo wall** — upload photos from their phone. They land in the couple's
  gallery for everyone to see.

### 5 · Lost link

If a guest loses their link, only the couple can re-issue it (from the
Invitation admin → guest row → "Re-issue token"). Old QR stops working
immediately. Setnayan support cannot share links directly — couples
control the guest list.

---

## The admin journey

Setnayan operations. Gated behind `is_internal=TRUE` or `is_team_member=TRUE`
on your user row. Non-admins who hit `/admin` get a 404 (the route doesn't
even reveal it exists, on purpose).

### 1 · Entry

Sign in normally at `/login`. If you have admin access, an "Admin console
↗" button appears on `/dashboard/profile`. Click it to land on `/admin`.

Alternatively, the role-switch pill in the header lets you flip between
Customer / Vendor / Admin views (when you have multiple roles — dual-role
pattern).

### 2 · The 17 admin surfaces

The admin nav has a lot of tabs. The 8 daily-drivers come first:

| Surface | Daily? | What it does |
|---|---|---|
| Overview | ✅ | Today's metrics, pending two-admin approvals |
| Users | ✅ | Search / delete / blacklist / restore users |
| Events | ✅ | Look up event by ID or slug |
| Vendors | ✅ | Search / change visibility / approve verification |
| Verification | ✅ | Queue of pending verification applications |
| Payments | ✅ | Match BDO/GCash payments to orders |
| Payouts | ✅ | Vendor payouts T+1 / 3-stage milestones |
| Receipts | ✅ | Search ORs by reference code |
| Ads | — | AdSense activation (gated) + boosted ads moderation |
| BIR 2307 | — | Quarterly form generation |
| Reviews | — | Moderation queue + appeal handling |
| Help inbox | — | Tickets from the public /help form |
| Funnels | — | 7 V1 conversion funnels |
| Force majeure | ✅ | Escalation queue (7-day clock) |
| Concierge abuse | — | Setnayan Concierge anti-abuse signals |
| Website | — | Reorder marketing-site widgets |
| Settings | — | Platform-level config (BIR TIN, bank details, theme defaults) |

### 3 · Two-admin major decisions

Per Vendor Agreement § 9.1. Routine ops (review moderation, user lookup,
manual help reply) are single-admin. Major decisions need two admins to
both click Approve:

- Ad-revenue activation (AdSense, sponsored articles)
- Vendor verification override (force-approve or force-reject)
- Refund > ₱100,000
- Force-majeure bulk resolution
- Payment-method config change
- Any blanket policy update

When admin A proposes one of these, it lands in admin B's queue
(`/admin` overview shows pending). Admin B reviews the rationale + linked
evidence, then clicks Approve or Reject. Both identities are recorded in
`admin_audit_log` permanently.

### 4 · Force-majeure escalations

When a couple files a force-majeure flag, the 7-day clock starts. Couple
and vendor have those 7 days to settle in chat. If day 7 passes with no
resolution, the flag shows up in `/admin/force-majeure` tagged ESCALATED.

Four resolution paths:
1. **Refund** — vendor returns deposit minus documented expenses
2. **Reschedule** — services move to a mutually agreed new date
3. **Substitute** — vendor provides an equivalent service later
4. **Partial** — some services delivered, some refunded

Pick one, both parties get an email with the outcome. The audit row
records who decided.

### 5 · Audit log

Every meaningful action writes to `admin_audit_log` (actor + target + action
+ before/after JSON + timestamp). The Audit tab on every user / vendor /
event detail page shows the history. Useful when investigating "who did this
and when".

### 6 · Delete vs blacklist

- **Delete** = soft-delete + 30-day restore window. RA 10173 right-to-erasure
  compliant. Default action for legitimate "please remove my data" requests.
- **Blacklist** = permanent ban on re-signing-up with the same email or
  device fingerprint. Used only after confirmed fraud / abuse pattern.

When in doubt, delete. Blacklist is harder to reverse.

---

## Public landing — `setnayan.com/`

Marketing site. No login. Funnel target for both couples (waitlist) and
vendors (pre-register).

Sections (left to right, top to bottom):
1. Hero with dual CTA — "I'm a couple / I'm a vendor"
2. Problem statement — fragmented planning workflow
3. Feature comparison — separate tools for couples vs vendors
4. Interactive demo — Maria & Juan dashboard walkthrough
5. Four core tabs — Guest List · Vendors · Schedule · In-App Services
6. On-the-day apparatus — Papic, Panood, Pamahiya, etc.
7. Transparent pricing — 5.0% Setnayan Pay convenience fee
8. Event-type roadmap — Wedding live, 8 more "Coming Soon"
9. Geographic coverage — city pins
10. Device availability — web + Mac + iPhone/Android PWA + V1.5 native apps

The owner-facing edit lives at `/admin/website` — drag-drop reorder of
widget cards. Two-admin gated for changes that affect public copy.

---

## Event landing — `setnayan.com/[slug]`

Per-couple public page. Distinct from the marketing site. This is what
the couple shares with everyone they invite. See [Guest journey](#the-guest-journey)
for details — that's where this page actually gets used.

The couple controls everything on this page from
`/dashboard/[eventId]/invitation`.

---

## Cross-role handoffs

The interesting flows happen between roles. Here's what each handoff looks
like end-to-end.

### Couple → vendor (first contact)

1. Couple browses `/vendors`, finds a vendor they like, clicks through to
   `/v/[slug]`.
2. Clicks "Start a thread" → confirm modal → server action creates a
   `chat_threads` row linking the event to the vendor profile.
3. Vendor sees a new thread in `/vendor-dashboard/messages` with the
   couple's masked identity (event name + date only).
4. Vendor replies, optionally attaching files or a quote.
5. Threads are idempotent — couple re-opening the same vendor reuses the
   existing thread.

### Vendor invite (off-platform vendor)

PR #137 (2026-05-19) added this. Couple has a vendor they like who isn't
on Setnayan yet:

1. Couple adds the vendor manually to `/dashboard/[eventId]/vendors` (cost,
   deposit, contact email).
2. The vendor card shows an "Invite to Setnayan" CTA.
3. Click → an invite token is created; an email lands at the vendor's
   contact email with a sign-up link.
4. Vendor signs up via that link; their first profile is auto-linked to
   the inviting couple's event.

### Couple → admin (force majeure)

1. Couple opens `/dashboard/[eventId]/disputes` → "Flag force majeure".
2. Picks a type (typhoon / illness / venue closure / vendor non-delivery /
   other), uploads evidence files, names affected vendors.
3. A 7-day clock starts. Vendors get an in-app notification + an email.
4. If couple + vendor resolve in chat within 7 days, the flag closes.
5. If day 7 passes, the flag escalates to `/admin/force-majeure` tagged
   ESCALATED.
6. Admin opens it, reviews the evidence + chat, picks one of 4 resolution
   paths.

### Couple → guest (invitation)

1. Couple builds guest list at `/dashboard/[eventId]/guests`.
2. Each guest gets a unique `qr_token`. The Invitation tab generates a
   personal URL: `setnayan.com/[slug]?invite=[token]`.
3. Couple shares the URL — printed QR card, Messenger, WhatsApp, email.
4. Guest opens the URL → `/[slug]/redeem` sets the session cookie →
   redirect to `/[slug]` showing the personalized page.
5. Guest RSVPs from there. Couple sees the RSVP in `/dashboard/[eventId]/guests`
   immediately.

### Post-event review (couple → vendor → public)

1. 24 hours after the event date, an email lands in the couple's inbox
   asking them to review each vendor they used.
2. Couple opens `/v/[slug]/review` → 5-star rating + free-text review.
3. Review posts immediately on the vendor's public `/v/[slug]` page.
4. Vendor sees the review in `/vendor-dashboard/reviews`. They can post a
   public reply (one per review).
5. If the vendor believes the review is unfair, they file an appeal — admin
   reviews and either lets the review stand or removes it. The appeal
   verdict is permanent.

Reviews are PERMANENT. The couple cannot edit or delete after posting.
This is a deliberate trade-off — protects vendors from review-bombing while
forcing couples to think before posting.

---

## Multi-moderator (V1.2) — what's not yet supported

Spec iteration 0048 (V1.2, draft locked 2026-05-19). Today every event has
exactly one owner. Sharing access with a partner, parent, or coordinator
is NOT supported in V1.

If you (the owner) hit this constraint with a real couple, the V1
workaround is: they share login credentials within a trusted household.
Not ideal but it works.

What V1.2 will bring:
- Invite by email — partner gets a "join event" link
- Role-scoped permissions: Editor (full access except billing), Viewer
  (read-only), Coordinator (limited write — schedule + day-of only)
- Role-aware notifications — coordinators get vendor-thread updates;
  partners get RSVP digests
- Multi-payer cart support (V1.2 iteration 0049) so a parent can pay for
  one vendor without inheriting full event access

Until this ships, every dashboard interaction is "the one owner" doing
something.

---

## The owner's dual-role pattern

You (`iscasasolaii@gmail.com`) have all three role flags set on your user
row: `account_type='couple'` + `is_internal=TRUE` + a `vendor_profile`
linked. This means:

- You can plan your own wedding through the couple dashboard like any other
  user.
- You can browse the vendor side via the role-switch pill in the header.
- You have admin access at `/admin`.

When testing flows, pick the right view first. The role-switch pill (top
header) is the single source of truth for which surface you're on.

**Hard-gated against self-review.** Even though you can purchase a Setnayan
service through your own account (with a confirm modal — "Pay full price /
Comp for myself"), you cannot review yourself. The `block_related_account_review()`
trigger blocks any review where the reviewer + reviewee share an owner,
team membership, payment account, device fingerprint, or household. This
is intentional — protects review integrity at the database level.

---

## What to check weekly / monthly

### Daily (operator-on-call)

- `/admin/force-majeure` — anything escalated today? Resolve within 1 BD.
- `/admin/payments` — match new BDO/GCash payments to orders.
- `/admin/verify` — process the queue if vendors are waiting > 3 BD.
- `/admin/help` — reply to any inbox tickets older than 24h.

### Weekly

- `/admin/funnels` — week-over-week signup → first event → first paid
  order rates. Look for sharp drops.
- `/admin/users` — search for any new signups with suspicious patterns
  (no display name, throwaway email).
- `/admin/reviews` — moderation queue + appeals.
- Recent commits / PRs on `main` — what shipped this week? Read CHANGELOG.md.

### Monthly

- `/admin/payouts` — vendor payouts dispatched. Reconcile any failures.
- BIR 2307 — quarterly form generation at `/admin/bir/2307`.
- AdSense daily revenue (if activated) — check the trend.
- Vendor Sponsored Boost subscriptions — anyone cancelled?
- Read STATUS.md and update if anything is stale.

### As-needed

- Force a tour re-fire if a major change shipped — bump the TourKey version
  in `apps/web/lib/tours.ts` (`v1` → `v2`) and the welcome tour will fire
  for everyone on their next visit.
- Two-admin major decision pending in your queue → review the rationale
  thoroughly before approving. The audit log is forever.

---

## Where to look for more

| Topic | File |
|---|---|
| Decision log | `CLAUDE.md` (at the spec corpus root) — chronological |
| What's shipped vs spec'd | `App_Build_Status.md` (spec corpus) |
| Stack inventory | `Installed_Stack_Inventory.md` (spec corpus) |
| External service prerequisites | `API_Integration_Checklist.md` (spec corpus) |
| Per-iteration spec | Each `00NN_*` folder under spec corpus |
| Owner setup tasks | `OWNER_ACTIONS.md` (this repo) |
| Living state | `STATUS.md` (this repo) |
| Public role map | `setnayan.com/how-it-works` |
| User-facing help | `setnayan.com/help?role=...` |

---

## Glossary

- **V1** — the launch scope, locked 2026-05-12.
- **V1.1** — first polish wave (Aug 2026 target). Vendor taxonomy, real
  weddings showcase, style-driven marketplaces.
- **V1.2** — multi-moderator + multi-payer (Sep 2026 target).
- **V1.5+** — Papic (native iOS/Android), Patiktok, Panood live streaming,
  Photo Delivery, Supplies Marketplace, LED Backgrounds. Spec'd but
  intentionally not built in V1.
- **Add-on** — what was previously called "Service". Renamed 2026-05-13.
  Web routes under `/add-ons/*`; old `/services/*` URLs 308-redirect for 90
  days.
- **Concierge** — paid wizard ($2,499) that drives a couple through their
  vendor stack with templated recommendations. Different from DIY browse.
- **Pakanta / Papic / Panood / Pamahiya / Pakulay / Pailaw / Pareto** — the
  on-the-day apparatus. Setnayan-owned in-app services that vendors
  resell. Listed on the homepage.
- **Dual-role** — one user, multiple account types (couple + vendor +
  admin). Self-purchase is allowed with a confirm modal; self-review is
  hard-gated.
- **Setnayan Pay** — the unified payment rail. Flat 5.0% convenience fee on
  top of vendor price (BIR 0.5% pass-through included).
