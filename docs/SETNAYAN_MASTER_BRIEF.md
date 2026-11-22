# Setnayan — Master Brief for Claude Chat

> **What this file is.** One file that holds the whole product: what Setnayan is, who uses it,
> how it looks, how every part connects, and how an idea becomes a build. Upload it to a Claude
> Chat (claude.ai) to brainstorm features and write specs that fit the product exactly.
>
> **Written 22 Nov 2026.** It replaces the 19 Nov planning brief. It is drawn from the specs
> corpus (North Star, House Design Standard, Build Rules, House Templates, Feature Catalog,
> Supplier Connection Map, the newest Decision Log rows) and from the shipped code.
>
> **The reader has no repo access.** Everything needed is in here. Where a fact could not be
> confirmed, it is marked **(check)**. Do not treat a (check) item as settled.
>
> **No prices appear in this file, on purpose.** Every price lives in the admin-managed catalog:
> `platform_retail_catalog_v2` (hosts) and `vendor_billing_catalog` (suppliers). In a spec,
> write "price from the catalog". Never type a peso amount.

---

## 0 · How to use this file in Claude Chat

1. Upload this file. Say: *"Read the Setnayan Master Brief first. Follow it."*
2. Describe the idea in plain words.
3. Ask Claude to **find the existing page it extends** (section 4 lists them) before proposing anything new.
4. Ask for a spec in the shape of section 6.4.
5. Paste the spec into a Fable drawing session (section 6) or send it to the owner's tracker.

The template prompt is at the very end (section 9).

---

## 1 · What Setnayan is

### 1.1 One line

**Setnayan is the home of every Filipino celebration: where you plan it, where your guests live
it, and where you keep it for life.**

- Website: **setnayan.com**. One Next.js web app, also shipped as a desktop app (Mac, Windows)
  and an installable phone app (iPhone, Android, iPad).
- Tagline: **"Set na 'yan. Every celebration, all in one place, for life."**
- "Set na 'yan" means "let's get that set". It is a call to action. Use it on buttons and closings.
- The **unique selling point** (ruled 20 Nov): *the only place where the host, the guests and the
  suppliers share one event, from the first idea to the memories.*

### 1.2 The three pillars

| Pillar | What it covers | Its job in the business |
|---|---|---|
| **Plan it** | Guests, RSVP, seat plan, budget, schedule, suppliers, Event Hub | Free forever. The way in. |
| **Live it** | Event Hub on the day, QR pass, door check-in, Papic cameras, Live Watch | The growth engine. Everyone in the room sees it. |
| **Keep it** | Memories, keepsakes (Magazine, Recap, Flash, Thank You), the event's Story, Loved Ones | The moat. A lifetime record nobody else keeps. |

### 1.3 Product philosophy

| Setnayan is | Setnayan is not |
|---|---|
| The home of a celebration, for every role in it | Another planning checklist app |
| A guest experience everyone in the room sees | A tool only the host ever opens |
| A lifelong record of a person's celebrations | A one-time event page that dies after the day |
| The medium for photographers, coordinators and suppliers | A competitor to photographers or coordinators |
| The source of what gets shared to Facebook, Messenger and Viber | A replacement for those apps |

**The real competitor is habit:** Facebook groups for planning, Messenger for RSVPs, Canva for
invitations, a Google Drive link nobody uploads to, and an Excel seat plan. Setnayan wins with
one moment that is clearly better and that everyone sees, not with more features.

**The growth loop.** A host brings 150 guests. Each guest keeps their share of the day in their
own Memories. Some of those guests host next. A debut, then a wedding, then a christening, all
on one person's Memories page.

**How Setnayan earns.** Charge for the day, not for planning.
- Hosts: planning is free with no guest limit. Paid value sits around the day: Papic credits,
  Live Watch, prints, the full Event Hub, Setnayan AI.
- Suppliers: shop, website, verification and core tools are free. Setnayan earns a **booking fee**
  on bookings it brings (section 5.3) and from paid supplier plans that sell scale and special tools.
- Hosts pay **0% commission**.

**Event types.** All 19 are supported. Weddings, debuts and christenings/birthdays lead the
marketing. There are also faith-specific flows (for example a Nikah page) **(check: full list)**.

### 1.4 The house beliefs (apply to every idea)

1. **Find it before you build it.** The product is about two years of design and code. Almost
   every idea already exists in some form. Extend it; never draw a second one.
2. **Honest states.** A failure never looks like success or like emptiness. If something cannot
   be read, say "Couldn't read", never "0", "Free" or "No bookings yet".
3. **Free is very easy, Pro is easy to medium, nothing is ever hard.**
4. **We handle the chaos.** Fewest screens, no confirm dialogs, a save never resets the screen.
5. **Never guess a number that governs money.** Read it from the catalog or an admin setting.
6. **Every capability has one reachable home per role,** and every way in is mapped.
7. **Phone first** (375 px), then use the width on desktop.
8. **Only show what works today.** No public "Coming soon" features (except where the owner kept
   one, such as the supplier Gift line on For Suppliers).

---

## 2 · Every user role and their journey

### 2.1 Role summary

| Role | Who they are | Logs in? | Main home |
|---|---|---|---|
| **Host** | The couple, the debutante's family, the parents. One or more per event. | Yes, but not to start (account asked at save) | Event dashboard `/dashboard/[eventId]` |
| **Co-host** | A second host on the same event (e.g. the other half of the couple) | Yes | Same event dashboard, full host rights |
| **Helper** | A person a host lets help (a sibling, a planner friend) | Yes | Same dashboard, only the areas granted |
| **Guest** | Anyone invited | **Never needs to** | The Event Hub link + their QR pass |
| **Supplier** | A business: caterer, venue, stylist, florist, hair and makeup, band, emcee, cake, transport, and more | Yes | Supplier dashboard `/vendor-dashboard` |
| **Coordinator** | A supplier whose service is coordination. A distribution partner. | Yes | Supplier dashboard + "Events you run" |
| **Photographer** | A supplier in the Photo and video trade | Yes | Supplier dashboard + client galleries |
| **Admin** | The owner and Setnayan staff | Yes | `/admin` (Focus, payments, verification, catalog) |

### 2.2 Host journey (end to end)

1. **Start.** From the front page, pick an event type and start. **No account is needed to
   start.** The account is asked for when the host saves.
2. **Event Today.** The event home: the event card (names, countdown, date, ⚙) then **one list
   by urgency** (red overdue/today · amber soon · normal) holding late payments, plan tasks,
   access asks, schedule approvals, supplier picks and setup steps. Tap opens in place. Drag
   right goes to its page. Drag left = **Do it tomorrow**, per host (never red).
3. **Guests.** Build the guest list (type in search to add; import; from People; scan). Groups,
   entourage, sponsors, the Wedding March. Send invites.
4. **Event Hub.** Make the guest page in the **Maker** (Edit · Style · Animate). Stages:
   Save the Date · RSVP · Invitation · The Day.
5. **RSVP.** Guests answer on the Event Hub. Answers flow back into the guest list.
6. **Seat plan.** List, 2D floor or 3D room. "Seat everyone for me" drafts it. Pending guests
   hold seats until a person releases them.
7. **Budget.** Set a target. Watch agreed, paid and owed fill in as suppliers are booked.
8. **Suppliers.** Find suppliers for each category, Save, Compare, add to a Build, chat, get
   quotes, book. **Only a host books or pays a supplier.**
9. **Schedule (The Day).** Chapters and moments, the emcee script, songs, supplier times.
10. **The day.** Door check-in desk, the QR passes, Papic cameras live for everyone, Live Watch
    for family abroad, the schedule running.
11. **After.** Memories fills with every photo. Keepsakes: Magazine · Recap · Flash · Thank You.
    When every payment is confirmed and everything is settled, the host can make **the
    event's Story** (its own interactive page, not part of the Event Hub).
12. **Next event.** Saved guests carry over. The next event starts half done.

### 2.3 Co-host and helper journey

- **Co-host:** a full host. Has their own "Do it tomorrow" list. Reads and writes the hosts'
  **whisper** in chats (the supplier never sees it). A removed co-host leaves the event's group
  chats; their old messages stay, marked *left*.
- **Helper (delegate):** the host grants areas, each at **View** or **Edit**. The areas are:
  Guest list · Seat plan · The Day (schedule, emcee script, songs) · Suppliers · Event Hub ·
  Mood Board · Budget · Photos. A "limited helper" views and never edits.
- At the **door desk**, helpers default to the Guests part only.
- Access can have a time window **(check: how hosts set it)**.

### 2.4 Guest journey

1. **Gets the link or QR** (by message, print or invitation). The Event Hub opens with no login.
2. **RSVP** on the Event Hub. No account needed. A Terms tick on the send step. They can link an
   account if they want; "Not now" still counts.
3. **Before the day.** The Event Hub shows Save the Date, then the Invitation. In the last 30
   days each identified guest sees **"Your checklist"** (outfit, motif, how to get there, table,
   QR pass saved, gift) and ticks what is ready.
4. **QR pass.** Their personal QR, saved to Photos or Wallet. It opens their Event Hub view and
   is scanned at the door.
5. **On the day.** Scanned at the door. **Find my seat.** The **Papic camera** on their phone
   (credits come from the event's shared pool). Live Watch if they are far away. Cash gifts
   (**Pabuya**) and the gift wish list where the host turned them on.
6. **After.** Every photo they are in, by face tagging (needs no account for that event).
   FaceBlock blurs anyone who opted out. If they have an account, the event joins their own
   **Memories** page for life.
7. **Becomes a host.** The loop closes when a guest starts their own event.

### 2.5 Supplier journey

1. **Join** through one of **three doors**:
   - **Door A, the host's QR claim:** a host added the supplier; the supplier scans, claims the
     Supplier Card, corrects info and service cards.
   - **Door B, self-serve** from the front page. It creates the first service card.
   - **Door C, coordinator:** coordination service pre-picked; ends with a QR to invite shops
     they trust.
2. **Set up the shop.** Shop page (`/v/[slug]`, also its own website), **service cards** made
   in the Card Maker, availability, packages, payment schedule per service, portfolio.
3. **Get verified** (free). Verified unlocks: real name shown, reach (sets its own range; no ring
   = nationwide), chat ＋ tools, the AI chatbot, the detailed Card Maker. An unverified shop
   reaches **0 km** (link and QR only).
4. **Today.** One list by urgency. An unanswered inquiry turns amber after 24 hours. "This week:
   N events" opens the calendar.
5. **Inquiry → quote → booking** (all in chat, see section 4.6). Accept the inquiry, send a quote,
   the host accepts and asks to book, the supplier **Agrees** (must pick at least one Setnayan
   gift for the client), and the booking is made.
6. **Their event.** A booked supplier opens a small dashboard for that event with only the parts
   their trade needs (section 4.10), their numbers, the monogram download, and notifications.
   **Event Details** is a briefing with "To talk about" items and their own due payments
   ("Remind the hosts" once a day).
7. **Money.** The host pays per the payment plan and logs it; the supplier confirms. The booking
   fee (if any) is charged with the client's first payment.
8. **The day.** Status presets: On site · Setup done · Ready to start · Packed up. They show on
   the hosts' door desk.
9. **After.** Handover, review, badges. **Trusted partners** form with shops they served the same
   completed, paid event with. Trusted shops rank higher in search.
10. **Grow.** Supplier plans (section 5.2), partnerships, the share card, the door sticker and QR
    (every shop has one, verified or not).

### 2.6 Coordinator journey

- Coordinators are **distribution partners**: each client they bring arrives with the
  coordinator already attached.
- Before booking: they chat with the couple like any supplier (supplier ＋ tray).
- **Once booked** (access is automatic when the shop is booked for its coordination service):
  - Opens the **hosts' own dashboard** via **"Events you run"** (each row: Dashboard · Chats · Hub).
    No separate coordinator dashboard.
  - **Edit and view:** Guests · Seats · March · Schedule · Event Hub · Event Details · Build.
  - **Build:** may use Find, Recommend a partner, and save shops to the event's shortlist.
    **No booking, no paying.**
  - **View only:** the Budget planner.
  - **Due payments:** viewable, with **"Remind the hosts"** once a day per payment. Never log or pay.
  - **No access:** Memories, Payments.
  - Reads every supplier chat on the event and whispers with the hosts.
  - Has the **coordinator scanner**: marks a guest arrived, shows their details and seat.
- The hosts keep one off switch for the coordinator's access.

### 2.7 Photographer journey

- A supplier in the Photo and video trade; follows the supplier journey.
- Booked default parts: Mood Board + Guest list (to know who is who).
- **Delivers galleries straight into the client's event**, where the work lives in the hosts'
  Memories, **credited**.
- Delivered photos stay full size until the event's compression date **(check: the exact window)**.
- A face pass tags faces the photographer did not tag. FaceBlock applies to their photos too.
- Papic is a partner, not a competitor: guests' phone photos and the photographer's work sit in
  one album. Supplier Papic "missions" exist in the data **(check: live UI)**.

### 2.8 Admin journey

- **Focus** (one list by urgency, like supplier Today), payments and approvals, verification,
  the **catalog** (all prices), discount codes, platform settings (booking fee rates, payment
  ceiling, the Maya switch, special-tool start date), disputes, refunds, email delivery, the
  **Ugat** console (the connection map, section 4.13).
- Admin screens are **monochrome** (buttons keep their colour).

---

## 3 · The visual design template and UI standards

Source: `HOUSE_DESIGN_STANDARD_2026-11-20.md` (it outranks generic style guides). Order of
authority: the owner's words → a newer Decision Log row → the topic standard → the House
Design Standard → anything else.

### 3.1 The ten laws

1. **Find it before you build it.** Extend the shipped component.
2. **Phone first.** Design at 375–390 px, cover 320, then use the width. No centred phone strip on desktop.
3. **One of each.** One accent colour, one main button per screen, one pinned row per page, one shared component per pattern.
4. **Everything by job, never by value.** Named tokens only. Never a hex, px radius, raw ms or bezier in a component.
5. **Same piece, same place, same words** on every surface (host · supplier · admin · public).
6. **Read moves, do stays still.** Content may arrive with motion; controls never dance.
7. **Honest states.** Loading, empty and failure never look alike.
8. **Fastest load, fewest requests.** One batched read per screen. Every load under 0.7 s wherever possible.
9. **Every capability has one reachable home.** A redesign moves every way in.
10. **Prove it.** 375 px light and dark, desktop, drawing parity, every way in walked.

### 3.2 Colour (light, the app)

Token names are legacy. **Choose by job, not by name.**

| Job | Token | Value |
|---|---|---|
| Page | `--sn-page-bg` | `#F7F5F4` (guest Event Hub forces white) |
| Card / frame | `--color-raised` | `#FFFFFF` |
| Words (ink) | `--color-ink` | `#2C2A29` |
| Accent: on, picked, pressable, main button | `--sn-accent` / `--color-mulberry` | `#C24E25` terracotta, white label |
| Accent as a word on a tint | `--color-mulberry-700` | `#9D3F1E` |
| Gold (marks only, never small text or charts) | `--color-terracotta` | `#A9834B` |
| Link, secondary, info | `--color-link` | `#3B4E67` |
| OK / money | `--color-ok` | `#2B744A` |
| Warn | `--color-warn` | `#965A00` |
| Danger (wrong only) | `--color-danger` | `#B3261E` |
| Header band | `--sn-band-from` → `--sn-band-to` | `#FAE0D1` → `#FFFFFF` |
| Secondary button | `--sn-btn-secondary-bg` | ink at 6%, no outline |

**Families by surface:**

| Surface | Look |
|---|---|
| Events / hosts | Light terracotta wash |
| Supplier | Light blue wash (page `#EEF2F8`), white cards, blue accent |
| Admin | Monochrome |
| Guest Event Hub | The hosts' own 5-colour theme (Dominant · Supporting · Accent · Neutral · Accent 2), never the app look |

**Colour rules:** terracotta = on/picked/pressable, grey = off. Red only for *wrong*, said in
words. Colour never carries meaning alone. Text contrast ≥ 4.5:1. QR codes always near-black
on white, dark mode too.

### 3.3 Colour (dark — dark is part of done)

The page is **flat dark**. A soft tone **glow lives only on the top block** (hero card, header
band, chat header), lit from the top-right.

| Job | Events (terracotta) | Supplier (navy) |
|---|---|---|
| Page | `#121110` | `#0D1626` |
| Card | `#1C1A16` | `#172338` |
| Tile | `#26231E` | `#1F2F4A` |
| Words 1 · 2 · 3 | `#F7F4EE` · `#D2CCC1` · `#A49E93` | `#EEF2F8` · `#B4BECE` · `#9AA6B9` |
| Main button + its words | `#EE8456` + `#1A120C` | `#2272E6` + white |
| Accent as a word | `#F2A07D` | `#7DB1FF` |

One bright pill per screen. Grey active tab. Depth comes from a lighter card, not shadows.
Hosts open to dark; suppliers get navy; admin is monochrome; the guest Hub has no glow.

### 3.4 Type

- **Hanken Grotesk** (400–800) for the app. Space Mono for mono. Cormorant Garamond only on the guest Event Hub.
- **Scale (px):** 9 · 10 · 11 · 12 · 13 · 14 · **15** · 17 · 19 · 22 · **30**. One 30/700 title per screen.
- Inputs ≥ 16 px on touch. Nav labels ≥ 11 px. Never lock zoom.
- Money in Hanken **bold**. Three text strengths only.
- Icons: **Lucide**, stroke about 1.75. One share icon. Sort/show = `SlidersHorizontal`.

### 3.5 Shape, space and layout

| Thing | Value |
|---|---|
| Spacing scale | 4 · 8 · 12 · 16 · 24 (desktop gutters 32) |
| Radius scale | 4 · 8 · 14 · 22 · 36 · full. Sheets 22. One-line field = pill. |
| Card | Floating white card, soft warm lift, **no 1 px border, no lines between rows**; space separates. Never a card in a card. |
| Card padding | 18 |
| Phone gutter | 16 px, left equals right, `max(16px, safe-area)` |
| Breakpoints | 640 · 701 · 768 · **1024 (bottom nav ⇄ sidebar)** · 1280 |
| Desktop | Most pages one 760 px column; Home, Guests, Suppliers use the full width. Sidebar rail, never a hamburger. |
| Press target | ≥ 44 × 44 px |
| Z-layers | base · raised · sticky · thumb · nav · pop · modal · toast · scrim · panel (tokens only) |

**Screen shape, top to bottom:** pinned row → fixed count/card row → working surface →
contextual toolbar (only while something is selected) → frosted thumb row.

- **One pinned row per page** (44 px): selector · live counts as filter doors · ONE main action · ⚙.
- **Tools live in the lower third** (the thumb zone). Never add a top toolbar.
- **Rise full screen** for opened things. Re-tapping the current tab goes to the top.
- **Empty dashboards still draw every section** with an honest empty state.
- Below 1024 px each section picks one axis: a vertical stack, or a horizontal snap row with a peek.
- Service cards: 2 across on a phone, 4 across on desktop.
- **One switch per drawing.** No stacked toggles.

### 3.6 The one-of-each components (extend, never re-make)

| Need | The one component | Rule |
|---|---|---|
| A button | `ActionButton` | Icon + word, 40 px paint inside a 44 px press, a `tone` (brand · ok · info · warn · danger · neutral). Main verb filled. Equal-weight buttons share one row at equal widths. |
| 3+ choices | `PickMenu` | Any set of choices is a dropdown, never a pill row. Rises as a sheet on a phone. "Not decided yet" lives inside it. |
| 2–3 sections | `PillSelector` | Max 3 on a phone, 4 on desktop. Sliding thumb. |
| Yes / no | Switch | Accent on, grey off. |
| A floating surface | `Sheet` | Grows from what was pressed; opens at half on a phone. |
| Open full screen | `RiseScreen` | One level only. |
| Tools at the thumb | `ThumbRow` | Frosted glass, 44 px rounds, one main verb. |
| Search | `search-add` / `search-box` | A round icon until tapped; one tap opens it with the keyboard up. Typing can add. |
| Sort / show | `SortFace` | `SlidersHorizontal` in a 44 px circle; accent dot only when not default. |
| More detail | `InfoTip` (ⓘ) | Title + one short line visible; the rest behind ⓘ. |
| Remove a row | `SwipeToDelete` | Swipe left; Delete is immediate with **Undo** in a toast. No ✕ on rows. |
| Bottom nav | `BottomNav` | ≤ 5 cells + one round action. |
| Empty / error | `EmptyState` / `ErrorState` | See 3.8. |
| The one date picker | Bottom sheet, quick choices first | |
| Skeleton | `Ghost` | See 3.8. |
| Service card | **Card 14, the "Mall card"** | One card everywhere. 2 across in Find and Discover. Shows distance from the venue **(check: straight line vs driving distance — a 20 Nov row says driving, the build rules say straight line with no paid map service)**. |

### 3.7 Behaviour rules

- **Text boxes:** buttons live **inside** the box (send, search, add, sort). **Enter sends,
  Shift+Enter makes a new line**, everywhere.
- **Rows:** tap opens (preview + edit in place); swipe left removes. No Edit/Remove buttons on rows.
- **A save never resets the screen.** Save in place.
- **No confirm dialogs** except for the irreversible, once. Buying is always confirm + pay.
- **Every lock shows 🔒.** A tap shows Problem → Solution → preview → price (from the catalog) → one button.
- **Never "Edit in X ↗".** Put the field right there.
- **Upload opens the device picker in place**, compresses in the browser, and has a cleanup.
- **One open at a time.** Opening one menu closes the others.
- **Ask:** one question per card, a quick answer for each, pre-fill what we know, never ask twice.
- **Words:** lines ≤ 12 words, titles ≤ 5 words, labels 1–3 words. Details inside ⓘ.

### 3.8 Loading, empty, error

- **Ghost skeleton:** what is already known shows as itself at once; unknown parts are grey
  blocks with a 1.4 s sheen. Shows after 150 ms, stays ≥ 400 ms. Mirrors the loaded layout.
  Never shows a wrong number as real.
- **Last-seen data:** the host's own most-used pages show instantly from the device, then
  refresh. **Never cached: money, admin, anyone else's data.**
- **Empty:** states the fact, never apologises, one accent action. A new empty part draws the
  real component with faded sample rows marked "Example", never on a failed read.
- **Error:** what broke → what survived → what to do. Failed save: *"That did not save. Nothing
  changed — please try again."* Chat: *"Not sent · tap to try again."*
- **The measurement must reach the render.** A log line never changed a pixel.

### 3.9 Motion

| Name | Value | Use |
|---|---|---|
| Tap | 100 ms | Press-in, outgoing content |
| Quick | 200 ms | Scrim, pops, small changes, exits |
| Release | 280 ms | Press spring-back |
| Move | 320 ms | Sheets, full-screen opens, toasts, tab content |
| Rise | 700 ms | Counts, hero settle |
| Sheen | 1.4 s loop | Skeleton only |
| Settle easing | `cubic-bezier(.2,.8,.2,1)` | Opacity, colour, closes |
| Spring easing | about 5% overshoot | Position and size |

Animate transform and opacity only. A press scales to 0.97. Toasts come from the bottom.
Every motion has a reduced-motion fallback (a short fade). Celebrate only payments and badges.

### 3.10 Speed

- Loads under 0.7 s wherever possible. A press looks pressed within ~100 ms.
- One batched read per screen. Shared bars never remount. Public pages are cached.
- **No Event Hub may crash.** Guests get no live connection.
- Budgets only shrink (shared JS, server actions, routes, stylesheet size).

### 3.11 The public website

Pages: **Home · For Suppliers · For Coordinators · Pricing · Features.** Static, cached,
script-free. Signed-out visitors see the promotional front page at `setnayan.com/`; signed-in
users see **Discover** at the same address. Home order: hero ("The home of every Filipino
celebration.") → event types → Live it → Papic → Plan it → Suppliers you can trust → Keep it →
three doors (host · supplier · coordinator) → plans → close ("Set na 'yan.").

---

## 4 · The data and feature connection map

How to read it: each module lists **what it is**, **where it lives**, **what it reads and
writes**, and **what it connects to**. Table names are given so a spec can name them.

### 4.1 The spine

```
User ──(event_members)── Event ──(guests)── Guest ──(QR pass)── Door desk · Seat · Papic
  │                        │
  │                        ├──(event_vendors)── Supplier booking ──(chat_threads)── Chat
  │                        │                         │
  │                        │                         ├─ quotes (vendor_proposals)
  │                        │                         ├─ payment plan + payments
  │                        │                         └─ booking fee + Setnayan gift
  │                        ├── Budget (one money resolver)
  │                        ├── Seat plan (one engine, shared with supplier Spaces)
  │                        ├── Schedule (chapters → moments) ── Papic chapters
  │                        ├── Event Hub (Maker → guest pages)
  │                        └── Orders (plans, credits, prints) ── Pay page
  └──(vendor_team_members)── Supplier shop ── service cards · availability · plans
```

- **`event_members`** links a user to an event as host (couple), guest, supplier (stored as `vendor`) or coordinator.
  Most event security rides on it (`current_event_ids()`).
- **A guest is not a user.** `guests` has no user link. A guest who wants an account makes a
  **claim** (`guest_claims`); approval links them through `event_members.guest_id`.
- **Security:** row-level security on every table, using 8 canonical patterns and 4 helper
  functions (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`).
- **IDs:** public IDs look like `S89<TYPE>-<10 chars>`; internal joins use hidden numbers.

### 4.2 Event Hub

- **What:** the guest-facing page for one event, at `setnayan.com/{slug}`. Never call it a
  "website" in the app.
- **Stages:** Save the Date · RSVP · Invitation · The Day. (Post Event left the Hub; it is now
  **the event's Story**, its own page, opened only when the event is settled.)
- **The Maker:** one toolbar, full screen. **Edit** (what it says) · **Style** (how it looks) ·
  **Animate** (how it moves). One global theme for the whole Hub. Built-in guest pages (RSVP,
  Login, Me, Camera, Live).
- **The full Event Hub (◆):** the 11 premium parts, Editorial, the guest columns, every theme and
  all Style choices. Included in **Event Plus, Pro and Ultra**. On Free: the theme's own look and
  3 free themes.
- **Paywall rule:** nothing is greyed out. The host tries any ◆ choice in the draft; the paywall
  is at **✓ Apply** ("Get the full Event Hub and apply" or "Apply without the ◆ changes").
  Guests see nothing until Apply.
- **Guest surfaces on the Hub:** RSVP, the personal checklist (last 30 days), find my seat, the
  Papic camera, Live Watch, gifts and Pabuya, photos after.
- **Reads:** event, guests (by QR token), schedule, Papic state, theme. **Writes:** RSVP answers,
  guest captures, gift records (`event_gift_records`), Hub views (`hub_guest_views`).
- **Connects to:** Guests (RSVP), Papic (camera), Schedule (The Day), Memories, monogram.

### 4.3 Guest list, RSVP, roles

- **Where:** `/dashboard/[eventId]/guests`. Pill at the top: **Guests · Seats · March** (each
  with its count). A round thumb-row button picks the look: **List · 2D floor · 3D room**.
- **Adding:** type in search to add; drag the thumb-row box right to switch to Add; a small
  "Guest ▾ / Table ▾ / Walk ▾" pick holds other ways to add. From People, Import, Scan.
- **Row colours:** "Coming" is a quiet green tick. Only *No reply · Can't come · No seat yet*
  carry colour. "Send invite" lives on the guest card; "Send N invites" in the list summary.
- **RSVP status:** pending (no reply) · attending · declined (plus maybe) **(check: exact set)**.
  RSVP needs no account.
- **Roles on the guest list:** groups (`guest_groups`), entourage, sponsors (cord, veil, coin,
  candle and more), **Wedding March** walks (`march_walks`; a walk is tied to guests, not only
  the couple).
- **Booking groups:** a per-head booking (caterer packs, hair-and-makeup faces, booth guests)
  creates its own group named for that supplier. Hosts and coordinator fill it. The supplier sees
  **only that group** and its live count. A drift from the booked count is shown to both sides
  and never changes the price by itself.
- **Saved guests carry over** to the host's next event (People).

### 4.4 QR passes and door check-in

- **QR pass:** each guest has a token (`guests.qr_token`). It appears on invitations
  (`{slug}?invite=…`) and on the seating print pack (`{slug}?g=…`). Guests save it to Photos or
  Wallet. **Guests never log in;** the QR and the Hub link are their keys.
- **QR rules:** always dark on white, also in dark mode. Printables exist (place cards, door sticker for shops).
- **Door check-in desk:** `/dashboard/[eventId]/guests/checkin`. One desk, three parts picked from
  one dropdown: **Guests · Suppliers · Team.**
  - Guests: scan QR, NFC or name. Writes `guest_checkins`.
  - **"Expected" counts attending guests only.**
  - Suppliers: arrivals board from their day status (On time · Late · Not yet · Packed up).
  - Team: who is on the desk now.
  - Who runs it: hosts always; coordinator sees all three; helpers Guests only; a supplier at
    the door is off until the host turns them on.
- **Coordinator scanner:** marks arrived, shows the guest's details and seat.
- **Offline:** the phone remembers scans and syncs when back online; a double claim shows as
  "claimed twice".
- **Supplier scans:** a supplier can scan guests for a service (e.g. a booth). One claim, one
  shared number (`supplier_scan_claims`).

### 4.5 Seat plan (2D and 3D)

- **One engine** (`plan-maker`) for the host's seat plan and the supplier's **Spaces** floor plan.
  Same room, tables, doors, grid, move, line up, alignment, fit. **Never two editors.**
- **Two kinds of occupant:** on an event, seats are filled **from the guest list**. On a
  supplier's Spaces, a seat, table or room is filled **by a booking**.
- **Venue halls:** when the booked venue drew its hall, "Start from this hall" comes first. The
  hall itself (walls, stage, doors, pillars) is fixed; the host may move, add and remove tables.
  The venue's own drawing never changes. Hall size lives on the **space** row.
- **Empty floor:** "Seat everyone for me" (main) and "Add a table" (second).
- **Pending guests hold seats** until a person releases them. Auto-seat treats anyone not
  declined as needing a seat.
- **Tables:** shape and seats in one row above the Add box (Round · 10 by default). Seats › List
  shows each table as a card ("7 of 10", faces, empty chairs).
- **Data:** `event_tables`, `event_seat_assignments`, `event_floor_plan`, zones, booths, signs.
- **One editor per part:** a part locks while someone edits; frees 5 seconds after they stop; a
  host can always take over; the other person's unsaved change is kept.
- **Plan gate:** Free has the seat plan. The units Floor plan view for suppliers is Pro and up.

### 4.6 Suppliers, quotes, payment cards in chat, compare

**Finding (host side, Event › Suppliers):**
- **Find:** suppliers per category, as Card 14. Filters behind the sliders icon.
- **Save** (bookmark): belongs to the person, always linked to an event (no event yet → start or
  pick one first). **Saved suppliers show first in Find** for that event, only if the venue is in
  their area and they are free on the date.
- **Compare** suppliers side by side. **Build:** the host's private plan of picks (`event_build_picks`).
- **Inspiration / Mood Board:** library photos credited to shops; a booked supplier can suggest photos.

**Chat ("Unichat") — one chat app, like Messenger:**
- One Chats list over every inbox, with a switcher at the top (each event, each shop, or All).
  Rows show the **next step**, not the last message.
- Every quote, payment, form, decision, meeting and file is an **actionable card** in the chat.
- Filter chips (Decisions · Forms · Money · Dates · Files) grow from the sliders icon.
- **＋ tools open inside the text box** (on desktop, in a third column).
  - **Supplier tray:** Change quote first, then money, time and files, questions, tools that wait
    for booking (locked with "After booking"), Every version last. **Every ＋ tool needs a verified shop.**
  - **Host / coordinator tray:** two groups, **Ask** (counter, a change, a meeting) and **Share**
    (event details, guest count, venue, timeline, seat plan, files).
  - **Recommend a partner** (share another shop's card): locked until the host has booked this supplier.
  - **Cake Maker** (the first special tool) lives in the chat, not on service cards.
- **Whisper:** drag the box to whisper. Hosts' whisper is read by co-hosts and the coordinator,
  never the supplier. A shop's whisper stays in its own team.
- **Desktop:** three columns (Chats · the chat · whatever is opened). Cards cap at about 500 px.
- Search, edit/unsend, seen-by, failed-send retry, voice notes, reminders.

**The booking path (both sides meet on the same rows):**

| Step | Host | Data | Supplier |
|---|---|---|---|
| 1 Ask | "Ask for a quote" | `chat_threads.inquiry_status = pending` | Today row "Reply to a new inquiry" |
| 2 Accept | — | `inquiry_status = accepted` | Accept / Decline |
| 3 Quote | Reads the quote card | `vendor_proposals` draft → sent → viewed | Sends quote (quote maker, mini receipt) |
| 4 Counter | Counter: their ask vs the quote, suggested chips | `proposal_amendments` | Change quote |
| 5 Book it | "Book it" = accept the full quote; terms shown | `event_vendors.lock_request_state = pending` | "Agree to this booking" (48 h answer window) |
| 6 Agree | Row flips to Booked ✓ | `event_vendors.status = contracted` | Agree; must pick ≥ 1 Setnayan gift |
| 7 Payment plan | Sees the plan (must balance) | `event_vendor_payment_plan` | Authored per service |
| 8 Pay | Logs a payment | `event_vendor_payments` | Confirms or refuses |
| 9 Day | Desk shows arrivals | day status | On site · Setup done · Ready · Packed up |
| 10 After | Review | `vendor_reviews` | Handover, receipt |

- **Booking statuses:** considering · shortlisted · contracted · deposit_paid · delivered · complete.
- **Date change:** hosts ask to move; each booked supplier answers Move or Unlock
  (`event_date_change_requests`).
- **Accepting a quote is not booking it.** Only the Agree step books.
- **A service card cannot be edited** while a booked, unfinished event uses it (🔒 with: finish or
  move the booking, or duplicate the card as a new version).
- **Partnering between shops carries no fee.** Trusted partners need one completed, paid event
  the two shops served together.

### 4.7 Budget (target, agreed, paid, owed, in ₱)

**One money resolver** computes every money figure on every screen. No screen does its own math.

| Figure | Meaning |
|---|---|
| **Target** | The host's budget goal (`events.estimated_budget_centavos`). Empty = no target set. |
| **Estimated** | Guesses (published starting prices, typical prices). **Never** part of agreed or owed. Always marked as estimates. |
| **Agreed** (committed) | What the host has actually agreed to pay: agreed package totals, line items, transport, crew meals, Setnayan orders, and costs with no supplier (`event_costs`: rings, licence fee, tips, honeymoon). |
| **Paid** | What has actually been handed over. |
| **Owed** (still owed) | Agreed minus paid, never below zero per supplier. |
| **Overpaid** | Money paid beyond what was agreed. |
| **Over budget** | One meaning only: agreed is more than the target. |
| **Due** | Dated payments, banded into due soon and overdue. |

- **The invariant:** agreed + overpaid = paid + owed. Always.
- **Unknown is unknown, never ₱0.** If a read failed, the figures are a floor and the page says
  "Couldn't read", not "₱0 committed".
- Archived, fraud-voided and "covered" package rows never count; anything dropped is named.
- All money is in Philippine pesos (₱), computed exactly in centavos.
- **Who sees it:** hosts edit. A booked coordinator views only. A supplier sees **only their own
  booking money** (quote, plan, paid, left). The host's planned amount for a service is private
  unless the host turns on a per-supplier share switch (off by default).

### 4.8 Papic cameras, credits, Live Watch, Memories

**Papic = "Guest photo album (Papic)".** Every guest's phone becomes a camera; every photo lands
in one album.

- **Credits are the only currency.** One **event pool**, shared by the hosts, guests and anyone
  connected through the Event Hub (suppliers excluded). There are no dedicated per-camera shots;
  the old per-camera hand-out is **retired**.
- **Where credits come from:** plans (Event Plus, Pro, Ultra include credits), top-ups (buy more),
  and **Setnayan gifts** from booked suppliers (Papic packs). Credits never expire; top-ups add
  to the event. Amounts and prices come from the catalog.
- **The switch:** one dropdown in Memories: **Off · On — event day · On — everyone, now.** It
  takes effect the moment it is picked (no Apply).
- **Rates:** a live shot (guest or host, through the camera) costs the camera's normal rate. A
  photo **added by hand** from the device costs more **(rate from the price source)**.
- **Sorting:** photos with a schedule file into chapters and moments by time
  (`papic_chapter_captures`). Photos with none are **Unsorted**. **Auto albums** (group Unsorted
  by time gap + place, named after the nearest venue, guest cameras ask for location once) are
  **ruled but not drawn or built**.
- **Faces:** face tagging finds each guest's photos. **FaceBlock** (opt-out blur) is free and never sold.
- **Live Watch:** livestream of the day for people far away. Sold separately; a hosted channel
  option exists. Prices from the catalog. **(check: which plans include it)**
- **Memories page** (`/dashboard/[eventId]/memories`), in order:
  1. **Papic block:** the switch, one state line, one big "N credits left", **Add photos** (main)
     and **Add more** (buy), "All Papic settings ›" (rises full screen).
  2. **Keepsakes row:** Magazine · Recap · Flash · Thank You.
  3. Filter row, then the photo grid.
- **Hosts only** add to Memories by hand. Coordinators and suppliers never see Memories.
- **For life:** a person with an account keeps every event's photos on their own Memories page.
  Loved Ones and the people tree connect people across events.
- **Retired:** Patiktok and Music Maker. Never mention them.

### 4.9 Schedule (The Day)

- Chapters → moments (`event_schedule_blocks`), with suggestions, supplier scripts and tasks.
- A booked supplier sees the whole schedule and edits only items attributed to their service.
  They can mark Seen, confirm their times, and lock their times (a locked part refuses host
  changes until unlocked).
- The emcee / band / DJ edit only their own parts of the script and song list.
- The chat's Schedule view shows today → event day with the venue's ingress · event · egress bar.

### 4.10 Booked-supplier access ("Their event")

| Trade | Opens by default (view) |
|---|---|
| Everybody | Schedule + the monogram download + Numbers (headcount, packs) |
| Caterer | + Guest list (their group only) + Seat plan |
| Venue | + Guest list (their group) + Seat plan + Mood Board |
| Stylist | + Mood Board + Guest list |
| Hair and makeup | + Guest list (their group only) |
| Florist · decor · lights and sound | + Mood Board + Seat plan |
| Photo and video | + Mood Board + Guest list |
| Emcee · band · DJ | + the script and songs (edit own parts) |
| Invitations | + Guest list + Event Hub |
| Cake · transport | Schedule + monogram only |

- **No supplier ever sees** Budget, Payments or Memories.
- Hosts can switch any part off or add more. Hosts can share specific files with specific suppliers.
- A booked supplier can ask for parts or propose changes; a host or the coordinator decides
  (`event_change_requests`).

### 4.11 Payments and orders

- **Apply-then-pay.** The token wallet is retired.
- **Orders** (`orders`) hold everything bought from Setnayan: plans, credits, prints, Live Watch,
  supplier plans, gifts. Each goes to the shared pay page `/pay/[reference]`.
- **Maya is the main way to pay:** QR Ph first, then Apple Pay (Apple devices) or Google Pay
  (Android), then card, then ShopeePay. Approved automatically once Maya confirms the exact
  reference and amount. A mismatch goes to the admin queue.
- **BDO QR is not an option.** It appears only as the safety route when the admin turns Maya off
  (QR, receipt, manual approval).
- **Every payment wall takes a code** ("Have a code?"). A code that covers the whole price goes
  to admin confirmation.
- Refunds of Maya-paid orders run from Setnayan's admin for as long as Maya allows.
- A single payment to Setnayan has an admin-set ceiling.
- Paying **suppliers** for their services: the host pays per the payment plan and logs it; the
  supplier confirms **(check: whether supplier payments also route through Maya)**.
- iPhone: some digital items are App Store products (e.g. Event Ultra and an upgrade-from-Pro product).

### 4.12 Notifications

- In-app tray, push and **email only (no SMS)**. Email goes through one provider.
- **A notification and the email allowlist are two halves of one mechanism.** A notification type
  not on the allowlist reaches nobody away from the app. Every spec that adds a notification must
  say whether it emails.
- Reminders between roles are rate-limited (e.g. "Remind the hosts" once a day per payment).

### 4.13 The connection joints (from the Ugat map)

The code keeps a map of every bond between entities. The main ones:

| Joint | Table | Meaning |
|---|---|---|
| User ↔ Event | `event_members` | Membership as couple, guest, supplier or coordinator |
| Guest → User | `guest_claims` | A guest becomes a user only by claiming |
| User ↔ Supplier shop | `vendor_team_members` | Shop team and roles |
| Event ↔ Supplier (conversation) | `chat_threads` | One thread per event + shop |
| Event ↔ Supplier (booking) | `event_vendors` | The booking row and its status |
| Quote → Amendment | `proposal_amendments` | Counter and change quote |
| Package → items → options | `vendor_package_items` | What a package contains |
| Order → feature | `event_software_activations_v2` | A paid plan or add-on switched on |
| Event → plan order | `orders.service_key` | Event Plus · Pro · Ultra |
| Supplier → plan | `vendor_subscriptions` | The shop's plan |
| Availability | `vendor_schedule_pools`, `vendor_schedule_pool_bookings` | The held date and pools |
| Seat ↔ Guest | `event_seat_assignments` | A person in a chair |
| Seat plan → room | `event_floor_plan` | Geometry, zones, locks |
| Schedule blocks | `event_schedule_blocks` | Chapters, moments, scripts, tasks |
| Papic → event / guest | `paparazzi_seats`, `papic_guest_captures` | Cameras and captures |
| Papic → chapter | `papic_chapter_captures` | Which chapter a photo belongs to |
| Wedding March ↔ Guest | `march_walks` | Who walks |
| Date change | `event_date_change_requests` | Move or Unlock |
| Gifts and wishes | `event_gift_records` | A gift a guest says they sent |
| Self-added supplier | `event_manual_vendors` | A supplier the host brought (not on Setnayan) |
| Supplier scan → guest | `supplier_scan_claims` | One claim, one shared number |
| Shop forms → answers | `event_form_sends` | Forms a shop sends an event |
| Booked QR → quote | `vendor_locked_qr_tokens` | A shop's booked QR copies an accepted quote |
| Supplier asks → host decides | `event_change_requests` | Access and change requests |
| Files per event | `event_supplier_files` | A shop's files for one event |
| Notifications | `notifications` | A notice to one person |
| Groups (community) | `samahan_*` | Group chat, stories, reads |
| People | `person_connections`, `dependents` | Loved Ones and family tree |

**Rule:** any new subsystem must be added to this map in the same PR (a check fails otherwise).

---

## 5 · Plans and money rules

### 5.1 Host plans: Free · Event Plus · Event Pro · Event Ultra

| Plan | What it adds (prices and exact credit counts from the catalog) |
|---|---|
| **Free** | Planning, guests, RSVP, seat plan, budget, schedule, basic Event Hub (3 free themes), Papic usable with credits bought or gifted. **No guest limit.** |
| **Event Plus** | Papic credits included + **the whole Event Hub** (all 11 parts, Editorial, guest columns, every theme) + upload your own song. |
| **Event Pro** | Everything in Plus + **Setnayan AI** + no Setnayan mark + more credits. |
| **Event Ultra** | The "Everything" card: everything in Pro + the most credits + extras such as canvas prints and longer originals **(check: exact Ultra list now that Patiktok is retired and the Hub moved to Plus)**. |

- Ruled included credits (20 Nov): Plus 1,000 · Pro 3,000 · Ultra 6,000. **The code reads them
  from the catalog** (`included_papic_credits`); a spec must too.
- Upload allowance per event: Free 10 MB · Plus 500 MB · Pro 1 GB · Ultra 2 GB.
- Upgrading from Plus or Pro to Ultra pays the difference.
- Orders placed before a plan re-cut keep what they were sold with (grandfathering).
- Event plans and supplier plans must never share names in one sentence without "Event".

### 5.2 Supplier plans: Free · Plus · Pro · Ultra

Public words: **Free · Plus · Pro · Ultra.** **Verified is part of Free** (a verified shop).
There is **no "Max" plan** and never write "Supplier Plus".

| Public name | Code tier | Notes |
|---|---|---|
| Free (unverified) | `free` | 0 km reach (link and QR only); basic Card Maker; no chat ＋ tools; no AI chatbot |
| Free · Verified | `verified` | Real name, sets its own reach, detailed Card Maker + all availability styles, chat ＋ tools, the AI chatbot, basic graphs |
| **Plus** | `solo` | More cards, categories and a team seat; storage; enhanced search visibility; own website name |
| **Pro** | `pro` | **Special tools** (Cake Maker first), smarter chatbot, photo challenge, 3D booth, floor plan view, advanced analytics, market intel, branches, video links |
| **Ultra** | `enterprise` | Everything in Pro + the most cards, seats, branches and storage; photo uploads in forms; top search priority; the **Ultra Add-on** (extra branch, cards, people, storage per period) |

- **Allowances** (cards active, main categories, team seats, branches, storage) grow with the
  plan. They are admin-editable (`vendor_plan_contents`) and mirrored in code. **(check: the code
  table and the 19 Nov plan ladder disagree on exact numbers; read the live values.)**
- **Reach is not a plan allowance.** Unverified = 0 km. Verified on any plan sets its own range;
  no ring drawn = nationwide.
- **Every plan:** chat with couples, unlimited inquiries, the waitlist, client import (free), reviews
  (never ranked by plan), being credited in a story.
- **Special tools** are included on **Pro and Ultra only**. A locked tool shows its front-end
  experience with the bar *"This special tool is available on Pro and Ultra · Upgrade."* Until an
  admin start date, special tools are open to all shops **(check: start date)**.
- **AI chatbot:** Verified and up. **Smarter chatbot:** Pro and Ultra.
- A shop that drops below a plan keeps saved work; extra staff seats pause (nothing deleted).
- **Supplier roles** inside a shop: Shop Manager · Branch Manager · Account Manager · Marketing ·
  Event Crew · Helper. The role shows on the person's card and applies at every permission gate.

### 5.3 The Booking Fee (suppliers pay Setnayan per booking)

Described without amounts. Rates, band edge, floor and lock are **admin settings**.

- **Who pays:** the supplier, never the host. Hosts pay 0% commission.
- **When it applies:** only on bookings Setnayan brought (attributed "sourced"). A client the
  supplier brought themselves is their own.
- **The schedule:** a percentage of the booking. A **higher rate on the first band**, a **lower
  rate on the part above it**, a small minimum fee, and a **lock**: the fee never goes above a set
  maximum, so its share keeps falling on very large bookings. The taper is always a discount,
  never a surcharge.
- **Unverified shops** pay a flat rate on the whole booking, also locked.
- **When it is charged:** with the client's first payment.
- **Free bookings:**
  - A client **new to Setnayan** whose account a shop's import created books **that shop free**
    for a window (admin setting, named only in the supplier's own app).
  - The **first supplier to import a new event** books that event free.
  - **Free booking-fee tickets** (earned from badges) are **auto-claimed** on the next booking that
    carries a fee. Never "redeem".
  - **Every 100,000th booking fee across all of Setnayan is free.**
  - There is **no** "first booking free".
- **The Setnayan gift:** every booking carries **at least one** exclusive Setnayan gift the
  supplier picks for the client (e.g. a Papic pack). No exceptions, even when the fee is free.
  Gifts bill on their own bill. Out of stock: the supplier jumps to buy, then returns.
- **Partnering between shops** carries no fee.

---

## 6 · How planning and building work

### 6.1 The flow

```
Idea (Claude Chat)
  → Spec (this file's section 6.4)
  → Fable drawing (HTML prototype, published as an Artifact)
  → Owner approves (on his phone)
  → DECISION_LOG row (dated, owner's words verbatim)
  → Opus 5.5 builder builds it 1:1
  → Full preflight (proof in STATUS)
  → Hands over to the ship controller
  → Ship controller batches, merges when every check clears
  → Live (confirmed served, not just deployed)
```

### 6.2 Who does what

| Step | Who | Rule |
|---|---|---|
| Idea and spec | Owner + Claude Chat | Find the existing page first. Functions and rules only. |
| Drawing | **Fable** (design and planning only) | Script-free HTML, real tokens, Now beside Proposed. |
| Approve | **Owner** | He decides **functions and rules** (prices, fees, who can do what, new or removed capabilities). Look and consistency calls belong to the drawing session. **Praise is not a pick:** "Perfect" on an A/B/C drawing still needs a choice. |
| Record | Controller | One DECISION_LOG row: date · decision (owner verbatim) · why / files. |
| Build and fix | **Opus 5.5** | Build EXACTLY the approved drawing. No skipping, no reinventing. |
| Ship | Ship controller | Builders never touch the PR again after handover and never regenerate baselines. |

### 6.3 The rules of each stage

**Drawing (Fable):**
- Capture the real page first; redraw it, change only the delta.
- **Script-free** (the owner's phone viewer runs no JavaScript). Use the app's real `:root` tokens.
- **Now beside Proposed**, one switch per drawing (Proposed / Now / Notes).
- **List what it removes** from earlier approvals.
- Draw light **and** dark, a keyboard-up frame, gutters at 320 / 360 / 375 / 390.
- Label every control with its kind; name every motion from the standard.
- Publish as an Artifact; the owner reviews on his phone.

**Building (Opus 5.5):**
- Read `BUILD_RULES.md` first. Check open PRs and worktrees first (somebody may be building it).
- Schema migrations land first, with row-level security at create time, using the canonical patterns.
- **Migrations reach production only through the pipeline**, never applied by hand. A migration
  ships only on the owner's go. Production SQL from a session is SELECT only.
- Never guess a number that governs money.
- Merge commits only. One PR per area; feedback in rounds.
- Maps ship in the same PR (page homes, admin tabs, the Ugat map, design baselines).

**Preflight proof (every "ready"):**
1. Screenshots at 375 px **light and dark**, plus desktop, from real data.
2. Drawing parity: every difference listed.
3. Every way in walked (rows, notifications, links) for each role it touches.
4. Guards run (unit, lint, typecheck) with results.
5. Files that overlap other open PRs.
6. Any build rule not followed, and why.

**Ship:** CI green is not done. Never merge before every check clears; no bypass. Shipped is
not live until the served commit is confirmed.

**Current state (22 Nov):** the owner said *"stop adding after the Cake Maker — just building and
fixing."* New ideas from Claude Chat are written up as proposals and wait for the owner's word.
The owner may still add items himself.

### 6.4 What a good spec must contain

Use these headings. A spec missing any of them is not ready to draw.

1. **Name** — plain English first, brand name second, e.g. "Guest photo album (Papic)".
2. **Who** — every role it touches (Host · Co-host · Helper · Guest · Supplier by trade ·
   Coordinator · Photographer · Admin), and what each may **see** and **do**.
3. **What exists** — the shipped page and component it **extends** (route + component), the
   existing design file, and any DECISION_LOG rows already on it. If none can be named, search more.
4. **What is missing** — the delta, in one or two lines.
5. **Every way in** — rows, tiles, notifications, deep links, emails, QR. And where its one home is.
6. **Data read** — tables and fields. **Data written** — tables, fields, and who may write
   (which RLS pattern). New columns only if no existing column already encodes it.
7. **Money** — any number that governs money names its source (catalog row, admin setting). No typed prices.
8. **Plan gate** — which plan unlocks it (host or supplier ladder), and the 🔒 Problem → Solution text.
9. **States** — loading (Ghost skeleton), empty (honest, or "Example" preview), error (what broke →
   what survived → what to do), "Couldn't read", offline if it runs on the day.
10. **Light and dark** — both described; which surface family (events · supplier · admin · guest Hub).
11. **Phone first** — the 375 px layout (pinned row, tools in the lower third, rise full screen),
    then desktop (760 px column or full width; three columns for chat).
12. **Controls** — each one mapped to the one-of-each components (section 3.6). No new kinds.
13. **Motion** — named from the motion tokens.
14. **Words** — the exact copy, ≤ 12 words a line, house words (section 7).
15. **Notifications** — which types, and whether each is on the email allowlist. No SMS.
16. **What it removes** — anything an earlier approval had that this changes.
17. **Speed** — one batched read; capacity on the day if guests use it.
18. **Open questions for the owner** — functions and rules only, one per line, each with a recommended answer.
19. **Acceptance checks** — how a tester proves it works, per role.

---

## 7 · Words and hard rules (never break)

| Say | Never say |
|---|---|
| Supplier | vendor |
| Event Hub | website, site (in the app) |
| event (app UI) | celebration (in the app UI) |
| celebration (brand lines only: tagline, hero, share card, email footer, site title and description) | — |
| the full Event Hub | Event Hub Pro, Event Pro (for the Hub unlock) |
| Free · Plus · Pro · Ultra (suppliers) | Max, Supplier Plus, Verified as a separate paid plan |
| Free · Event Plus · Event Pro · Event Ultra (hosts) | — |
| Seat Plan · Live Watch · Memories · Group | Seating Chart, Alaala, Samahan (user-facing) |
| price from the catalog | any typed peso price |
| Hosts pay 0% commission | "0% commission" alone |

- Plain English first, brand name second. Only **Papic** keeps a custom name (and Pabuya for cash gifts).
- Never mention retired things: **Patiktok, Music Maker**, the token wallet, the per-camera hand-out.
- **Email only. No SMS.**
- **No public API endpoints** in V1.
- **No manual video editor.** Renders are template-driven.
- Taglish where warm, English where precise. No programmer captions.
- Front-page copy speaks to the feeling, not a problem → fix story.

**Locked platform facts:** web-first single Next.js codebase; Supabase database (Singapore);
Cloudflare R2 for media storage only (no traffic routed through Cloudflare); Vercel hosting.

---

## 8 · Open items and (check) list

These are known gaps or conflicts. Do not build on them without the owner's word.

1. **Card 14 distance:** straight line (build rules) vs driving distance (20 Nov row). (check)
2. **Supplier plan allowances:** code table vs the 19 Nov ladder disagree on exact numbers. (check)
3. **Event Ultra's exact inclusions** after Patiktok retired and the Hub moved to Plus. (check)
4. **Live Watch:** which plans include it vs sold alone. (check)
5. **Supplier payments:** whether they route through Maya or stay off-platform with a logged
   receipt. (check)
6. **Special-tool start date** (January, admin setting). (check)
7. **RSVP status set** (does "maybe" exist as a separate status). (check)
8. **Photographer photo compression window** after the event. (check)
9. **Auto albums for Papic:** ruled, not drawn, not built.
10. **Supplier "Their event" dashboard and Event Details:** ruled, Fable drawing pending.
11. **Guide & Help (the "i" button):** drawing approved; guides wait for the new page designs.
12. **Website dark mode:** the public site ships light-only for now.
13. **Free booking-fee tickets:** which badge steps give a ticket is still open.
14. **Event type list** (all 19) and faith-specific pages. (check)

---

## 9 · How to ask Claude Chat

Copy, fill the brackets, paste.

```text
You are helping me, the owner of Setnayan (setnayan.com), plan a feature.
Read the attached "Setnayan Master Brief" first and follow it exactly.

THE IDEA
[Describe it in plain words. Who wants it, what they are trying to do, and why now.]

WHAT I THINK IT TOUCHES
[Pages or modules you suspect: e.g. Guests, Seat plan, Budget, Chat, Papic, Event Hub, supplier Today.]

WHAT I NEED FROM YOU
1. First, tell me what ALREADY EXISTS in the brief that this extends. Name the page and
   module. Say "exists · missing · delta" in one line each. If it already exists, say so and stop.
2. Then write a spec using the brief's section 6.4 headings, all 19 of them.
3. Keep to the house rules: phone first at 375 px, light and dark, one-of-each components,
   honest empty/error/loading states, tools in the lower third, no confirm dialogs,
   lines of 12 words or fewer.
4. Use the house words: Supplier (never vendor), Event Hub (never website), "event" in the app.
   Supplier plans are Free · Plus · Pro · Ultra; host plans are Free · Event Plus · Event Pro ·
   Event Ultra.
5. Never type a price or a money number. Write "price from the catalog" or name the admin setting.
6. List every role it touches and what each can see and do. Remember: guests never log in;
   only a host books or pays a supplier; a booked coordinator gets the hosts' dashboard minus
   Memories and paying; suppliers never see Budget, Payments or Memories.
7. List every way in (rows, tiles, notifications, links, emails) and its one home.
8. End with open questions for me, ONLY about functions and rules (who can do what, prices,
   fees, new or removed capabilities). Give your recommended answer for each.
   Do not ask me about looks; the drawing session decides those.
9. Mark anything you are unsure of as "(check)". Do not guess.

AFTER THE SPEC
Write a short brief for the Fable drawing session: which screen to capture first, the Now vs
Proposed frames to draw (375 px, light and dark, keyboard-up), and what the proposal removes.
```

**Shorter follow-ups that work well:**
- *"Before anything: which existing Setnayan page does this extend? Quote the brief."*
- *"Rewrite this spec so a Free host finds it very easy. Cut every step you can."*
- *"Check this spec against section 7 and the (check) list. What breaks a rule?"*
- *"List every way in for each role, and where the notifications go."*
- *"Turn the open questions into yes/no cards with your recommendation first."*
