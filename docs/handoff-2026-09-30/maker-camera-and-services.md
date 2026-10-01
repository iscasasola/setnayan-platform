# Handoff — Maker camera prompt · Our Services trim · Add-from-people · the sidebar "More Services" row

**From:** cloud session "Camera access prompts on event hub maker" (2026-09-30)
**Branch:** `claude/serene-planck-shg2bn` — pushed, **NO PR opened**, auto-merge NOT armed.
**For:** the Setnayan handoff / controller session, to fold into the train and finish item 5.

> ⚠ A handoff is not evidence. Every claim below names a greppable anchor — re-measure before acting.

---

## ✅ DONE on the branch (commits `64133b79`, `dd869f0d`)

### 1 · The Maker kept asking Safari for camera + microphone — FIXED
Owner: *"why is camera repeatedly asking me for access on my event hub maker"* →
*"we do not need camera on event hub maker because it just fix details and design."*

- **Cause:** the Maker canvas is an iframe of the couple's own `/[slug]` page. The couple holds a seat on their
  own guest list, so the page resolved them as a guest and drew the inline Papic camera
  (`site-body.tsx` → `<PapicGuestCapture` behind `{papicGuest ? (`). That component calls
  `usePapicCamera({ enabled: accepted && !blocked && !enrolling })`, which asks for **audio + video at mount**
  (`lib/use-papic-camera.ts` → `acquire(true)`). The Maker re-keys/reloads canvas frames on edits
  (`buffered-canvas-frame.tsx`), so every reload re-prompted.
- **Fix:** `app/[slug]/page.tsx` → `papicGuest: isEditorCanvas ? null : papicGuest,` inside `guestIdentity({…})`.
  Real guests on the real page are unchanged.
- **Guard:** `app/[slug]/_components/the-maker-canvas-draws-no-camera.test.ts`.
- **Not changed (flag only):** a host opening their own LIVE hub outside the Maker still gets the auto-on camera
  if they accepted Papic terms — that is the existing "auto-shown" design, not touched.

### 2 · Our Services cards — `lib/our-services.ts`
Owner, 2026-09-30, verbatim: *"gallery inside Papic"* · *"Editorial inside Post Event in Event Hub Maker"* ·
*"Event Hub Pro has its own place too"* · *"so it will be Setnayan AI, Papic, Live Studio, Music Maker, then Patiktok"*.

- Order: **Setnayan AI (SAI) · Papic · Live Studio · Music Maker · Patiktok** (`const SERVICES`).
- **Gallery** is a part under Papic, after Thank-You Video (`galleryPart`). It stands as its own card, in Papic's
  slot, only when there is no Papic card (never unreachable).
- **Editorial** is not drawn here (home = Maker › Post Event, `post-event-scene-panel.tsx` edits `editorial`).
- **Event Hub Pro** card removed (home = the Maker's "Unlock Pro and Apply"). `website-pro` + `editorial` stay in
  `OUR_SERVICE_ADD_ON_KEYS` so the lower lists never bring them back.
- Type change: `OurService.part` → `parts: readonly OurServicePart[]`; `suite/_components/our-services-grid.tsx`
  maps them.
- Tests rewritten in `lib/our-services.test.ts` (order, Gallery-in-Papic, no-Papic fallback, no Pro card).

### 3 · "More for your event" — `app/dashboard/[eventId]/suite/page.tsx` + `TOOL_HOMES`
Owner: *"find your date is inside event hub maker. so we don't need it here"* · *"Photo Delivery is inside Papic?"*

- `TOOL_HOMES['find-date']` → Details › Date (`needsWebsite`). Proof in `our-services.test.ts` `HOME_PROOF`:
  `launch/_components/details-your-event.tsx` draws `<FindDateCandidates`.
- "Recommended for you now" (`recommendStudioAddOns` `isEligible`) now requires `e.studioGroup !== 'utility'`.
  That retires **Event** and **Photo Delivery** there — both were already `utility` (Photo Delivery "delivered
  through Papic" since 2026-07-22) and already dropped from every other list on the page; only the lead leaked.
  Answer to the owner: **yes, Photo Delivery is inside Papic.**

### 4 · Add from your people — connected people only (`lib/people-you-can-invite.ts`)
Owner: *"when adding people. i should only see the people that are connected to me. not the guest from events.
only connected people, samahan (that is connected people to me), and my beloved (which has either dependents or
valuables)"*. Screenshot showed 34 "Maria & Jose" guests from another event.

- Removed the 2026-08-21 `event` source (guests of the host's OTHER events). Remaining: `people`
  (connections + alaga = "my beloved") and `samahan`.
- Sheet copy (`add-from-people-sheet.tsx`): *"The people you are connected to — your people, your beloved, and your samahan."*
- Guard `add-from-people-is-scoped.test.ts` first test replaced: exactly ONE `from('guests')` read (this event's
  own, `.eq('event_id', eventId)`) and no `source: 'event'`. **Verified it fails on the old code.**
- Left alone: the `'event'` member of the `InvitableSource` union in `people-you-can-invite-core.ts` and the
  sheet's prop type — harmless, now never produced. Delete in a tidy-up if wanted.
- ⚠ Owner said beloved = "dependents or valuables". The roster's alaga carries `dependent_kind`; whether
  "valuables" (non-person alaga) exist as roster rows was **not checked**. If they do, they probably should NOT be
  offered as guests — worth one look at `lib/people-roster.ts` (`kind: 'alaga'`, `dependent_kind`).

### Checks run
- `pnpm typecheck` clean (both commits) · `next lint --file …` clean on touched files.
- Full `pnpm test:unit` on `64133b79`: **20,930 tests, 0 failed**.
- On `dd869f0d`: touched folders 105/105 — full suite NOT re-run after the second commit.
- 🪤 A bracketed test path passed alone runs ZERO tests — use `?` in the glob:
  `npx tsx --test 'app/dashboard/?eventId?/guests/_components/*.test.ts'`.
- Not run: DB replay, e2e, the port-control baseline regeneration. This branch will need the baseline regen like
  any other in the train.

---

## ⏭ NOT DONE — 5 · The sidebar row becomes "More Services", expanding to the five services

Owner, verbatim, in order:
1. *"so it will be Setnayan AI, Papic, Live Studio, Music Maker, then Patiktok"*
2. *"the sidebar will expand and collapse to show these"*
3. *"and name the side menu as More"* → *"or More Services?"*
4. *"it cannot be our services since we have the guestlist, your team and event hub maker on the sidebar which is also our services"*

**Name is NOT decided.** This session recommended **"More Services"** (rail + ☰ drawer) with the phone bar short
word **"More"** (`PHONE_BAR_SHORT.studio`, today `'Services'`). Confirm with the owner before building.

**It overrides a lock — the owner is doing so knowingly:** `event-rail-context.tsx` header,
*"🔒 EVERY ROW IS A PLAIN LEAF — 'solid menu with no submenus' (owner-locked 2026-07-15). `NavItem.children` is
deliberately NOT rendered here."* Record the reversal in DECISION_LOG.

Where it lives (read before building — RULE 0):
- `lib/customer-menu.ts` → `buildEventMenuSections` → the `put({ key: 'studio', label: SUITE_NAV_ON ? 'Our Services' : 'Studio', … })` row.
  🔒 Keep the KEY `studio` (registry slots / badges fail silently on a rename — see the `CustomerMenuKey` note).
- Rail: `app/dashboard/[eventId]/_components/event-rail-context.tsx` (+ `customer-nav-config.ts`
  `buildCustomerNavGroups`, `customer-sidebar.tsx` `applyRegistry`). ☰ drawer and phone bar:
  `app/_components/nav/bottom-nav.tsx`.
- The children should be the SAME five cards `buildOurServices` builds (names + `href` = `addOnHref`), computed
  **server-side in `layout.tsx`** and passed as plain data — `customer-menu.ts` warns not to pull the add-on
  catalogue into a client bundle.
- Tests that pin labels and will need updating: `the-event-menu-is-one-tree.test.ts`,
  `the-phone-has-one-bottom-bar.test.ts`, `lib/the-maker-is-one-row.test.ts`, `lib/our-services.test.ts`
  (it imports `buildEventMenuSections`). Grep `'Our Services'` across `app/` `lib/` for copy (masthead
  `metadata = { title: 'Our Services' }` in `suite/page.tsx`, tours in `lib/tours.ts`).
- Open design questions for the owner: does tapping the row navigate to the page AND expand, or only expand?
  Remember the open/closed state? Phone: the bar has no sub-rows (owner 2026-09-29 "no sub bottom nav"), so on
  phones the tab just opens the page — confirm.

---

## Spec corpus — NOT updated (cloud container cannot reach `~/Documents/Claude/Projects/Setnayan/`)
DECISION_LOG rows owed, 2026-09-30:
- No camera in the Maker canvas.
- Our Services: order · Gallery in Papic · Editorial → Post Event · Event Hub Pro → Apply · Find your date → Details.
- Add from your people: connected people + beloved + Samahan only; other events' guests removed.
- The sidebar "Our Services" row → "More Services" (pending name) with expand/collapse — reverses the 2026-07-15
  no-submenu lock.

## Merge
Fold `claude/serene-planck-shg2bn` into the train (it touches `lib/our-services.ts`, `suite/page.tsx`,
`app/[slug]/page.tsx`, `lib/people-you-can-invite.ts`, the guests sheet, and `changelog.d/claude-serene-planck-shg2bn.md`).
Per the 2026-09-29 rule: merge only through auto-merge after every check passes.
