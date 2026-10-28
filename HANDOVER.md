# HANDOVER — claude/chat-messenger-look (Builder C1 · chat look, 2026-10-28)

Contract: corpus `prototypes/chat_messenger_2026-10-28/` (frames A–F; J/K for pickers; L = isolation per event) +
DECISION_LOG 2026-10-27 chat rows + 2026-10-28 "CHAT APPROVED". Coordinator rulings relayed mid-build: compress every
chat file (C2's `lib/chat-file-prepare.ts` — not on main yet; the composer still uses the shipped compressImageForWeb,
never a "send original"), supplier chat only inside an event, ONE search in the thumb row (name now, message text = C5),
isolation per event (event line on every row), "Seen", staff name on supplier messages (stored per message → built).

## State — 2026-10-28 (resumed, CI green)
- PR #7004 is a draft (do-not-auto-merge, autoMerge null). Head ad75448ea2: CI 26 pass · 0 fail · 1 skipping.
- Built since the resume:
  - ONE chat look. The shared `ChatThreadHead` plus `thread-kit.ts` (ChatBox · ChatThreadHead · ChatMessageStream ·
    ChatSendForm) are mounted by both thread routes and the lab; guard `one-chat-look-on-every-thread`.
  - Supplier side lists EVENTS. Rows read "<first name>'s <Kind> (<Mon D>)" from `lib/event-chat-title.ts`, used in the
    Customers row, the supplier inbox row and the supplier thread head; guard `one-event-one-chat-title`.
  - A Customers row with a chat opens it full screen. The supplier head title opens the customer card (`?tab=details`).
  - ‹ (`ChatBack`) is history.back() when this tab came from a chat list (`ChatOriginMark`), else the link.
- Walk (lab, Chromium + WebKit, light + dark):
  - click-all: 176 ✅ · 8 ⚠ · 0 ❌. Full-screen check: points at the top, middle and bottom of the screen are all the
    thread.
  - "Sending…" now paints in 61–74 ms in Chromium; WebKit passes too.
  - Open time (lab, Suspense fallback, 4 runs each): delay 0 — first visit 1716 ms, again 863 ms. Delay 1200 — first
    visit 2203 ms, again 1051 ms to the remembered bubbles (1351 ms to the server's thread).
- Dev server stopped, .next removed, no lock entry.

## NOT DONE / NEXT
- #7014 (lib/page-home.ts + BackButton route=) is still OPEN. When it lands: merge main, set the supplier thread's home
  to `/vendor-dashboard/customers` (People), and swap `ChatBack` for `BackButton route=` (keep the in-place return).
- Removing the Customers "Messages" fold (MessagesSurface) is not done. It would orphan surface.tsx and drop the
  archive toggle + outcomes rollup. Better done in the Customers redesign PR.
- Lab: no tap row → full screen on the real Customers page (needs a session/DB). Covered by the hrefFor guard instead.

## Decisions taken (not covered by the record)
- Couple per-event inbox: "Suppliers" chip = every row (all are supplier chats here); Groups/People chips not drawn (C4).
- Row tag = the thread's own stage (Quote / Booked); no "Meeting" tag (no cheap read — would be a new fact).
- Supplier inbox (`vendor-dashboard/messages/surface.tsx`) NOT restyled in C1 — rows already carry the couple+event.
- Booking-fee lines in the supplier's quote composer / booking-ask panel left as shipped (monetization lock; flag on in
  prod env list) — surfaced to the owner, not removed. No Google Drive door exists in chat (nothing to remove).
- Lock-handshake flag: set in Vercel Production (encrypted); its value is NOT readable from public bundles (only signed-in
  thread chunks inline it) — reported as unverified.

---


---

# HANDOVER — claude/guest-hub-cacheable (Builder EV1, 2026-10-28) · PR #7016 (draft, do-not-auto-merge)

Contract: DECISION_LOG 2026-10-28 "NO EVENT HUB MAY CRASH" + "EVENT DAY NEVER FAILS" (EV1). Owner: *"Our priority is not
crash any event hub most specially during their event"*. Offline caching is EV2 — not here.

## State
- Cache: `middleware.ts` → `lib/hub-view-route.ts` (stamp RPC memo 3 s, pass → seal) → `/{slug}/cached/{key}`
  (`app/[slug]/cached/[key]/page.tsx`, ISR 60 s). Key codec + shape rule: `lib/hub-view-key.ts`. Viewer held per render:
  `lib/hub-request.ts`; readers that ask it first: `lib/auth.ts`, `lib/supabase/server.ts`, `lib/guest-session.ts`
  (`readHeldPass`, `signedInAccountId`), `lib/request-platform.ts`, `lib/view-as-free.server.ts`, `app/[slug]/page.tsx`.
  Off switch: `HUB_CACHE_DISABLED=1`.
- Layout reads no viewer. Announcement: `app/[slug]/announcement/route.ts` + `_lib/latest-announcement.server.ts`
  (gate) + `_lib/announcement-stage.ts` (stage rule). Card polls 30 s ± 20 %, visible only, back-off. No channel, no ping.
- Guests' run of show: `app/api/live/run-of-show/[eventId]/route.ts`; `run-of-show-header.tsx` polls when `forGuests`.
- Guard: `lib/the-guest-hub-stays-cacheable.test.ts` (14 tests; sabotage script in the session scratchpad, 9/9 red).
- Lab: `apps/web/scripts/event-day-lab-stub.mjs` (stand-in, counts DB round trips + max open) and
  `apps/web/scripts/load-test-event-day.mjs` (500 guests, polls, scans, an announcement). Local build only.

## Decisions taken (not covered by the record)
- Signed-in accounts, any query the page reads (except `tab`), the Terms / view-as / host-preview / demo cookies and the
  native shells keep the LIVE render (unchanged). A pass for ANOTHER event keeps it live too (the pass-book rules).
- Freshness: the event stamp (`event_public_revs`) is part of the key, so every write the guest page's shared reads see
  is immediate; anything else (a purchase, a gift setting, the clock's phase) shows within `revalidate` (60 s — the
  2026-05-22 owner-accepted window). A guest's OWN write (any non-GET with a pass) moves `sn_hub_bust` → fresh copy.
- The announcement now appears after the page paints (one small fetch) instead of in the server HTML — the layout can
  no longer know who is looking. Same words, same gate, same look.

## Next (EV2)
Build offline on top of the cached copy: the service worker can keep the guest's own `/{slug}` response (one stable,
cacheable document per guest key) + `/{slug}/announcement` + `/api/live/run-of-show/<event>` JSON.
