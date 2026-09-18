# AREA-CHAT · click-test checklist — the chat box and the Event Hub

Written 2026-09-19 by AREA-CHAT. Measured on `origin/main` + #5614, with the
production flags read from Vercel (`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED`,
`NEXT_PUBLIC_CHAT_NEGOTIATION_V1`, `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`,
`NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` — all `"true"`).

Test data: the **Rosa & Ben** event (`2d4f1144-…`, slug `rosa-ben`, 2026-10-30) ·
couple **testnayan3** · supplier **Saysay Host and Band** = **testnayan2** ·
thread `24516d5c-…` (accepted, 4 messages) · one quote **₱10,170, accepted** ·
booking `contracted`, deposit acknowledged 2026-09-18 13:51.

Sign in by **email + password**, never the Google button (`is_internal` passes
every paid gate and hides what a real couple sees).

PRs this checklist depends on: **#5614** (one chat box everywhere), **#5677**
(doors off the frame), **#5682** (one quote tool), **#5683** (Event Hub next
step). Wait for `/api/health` to serve a sha at or past the last of them.

## A · The supplier's chat box — as testnayan2

1. Open **Clients → Rosa & Ben** (`/vendor-dashboard/clients/2d4f1144-…`).
   Expect: you land on the **conversation** (`/vendor-dashboard/messages/24516d5c-…`),
   ONE bordered frame — header · one privacy line · Chat / Decisions / Files ·
   the messages · the composer with 🧾 and 📞 icons. No second navigation row.
2. Read the privacy line. Expect: *"Everything you need for this event is already
   in Setnayan — their profile and this conversation carry it. Never ask for
   private info in chat."* — never *"your vendor sees…"*.
3. Press **More** on that line, then **Less**. Expect: the full text opens and
   closes in place; there is no ×.
4. In the right-hand rail (desktop) or the ⓘ button (phone), press the black
   **Full customer profile** button. Expect: the client page opens on the
   **Details** tab (completion card, the brief, activity) — it must NOT bounce
   back to the conversation. (#5677)
5. On that Details tab, in the action bar under the brief, press **Quote**.
   Expect: back on the conversation with the **"Send a quote"** panel OPEN under
   the composer: the line-item builder first, then a smaller card
   **"Send from a saved template"** (or, with no template, *"Quote the same thing
   often? Save a proposal template…"*). (#5682)
6. In the rail's tools list, count the quote entries. Expect: exactly one —
   **Send a quote** (primary). No separate "Send proposal". (#5682)
7. Press the frame's **⋮**. Expect: Quote & payments · Files & contracts ·
   Schedule · Full customer profile · Report · Block. Press **Schedule**.
   Expect: the client page on the Schedule tab, painted on the Schedule tab
   from the first frame (no flash of Quote first). (#5677)
8. On the client page's strip, press **Chat**. Expect: the conversation again.
9. In the rail, the **Your next move** tile on the client page (`?tab=details`,
   desktop only): expect *"You're booked"* for Rosa & Ben, and the strip's
   current rung reading **Booked** — never "Quote sent — follow up".
10. Press 📞 on the composer row. Expect: the call panel opens in the tray under
    the composer (Voice / Video), with a **Close** — the conversation is not
    covered.

## B · The couple's chat box — as testnayan3

11. Open **Vendors** (the bench) → Saysay's row → **Open conversation**.
    Expect: the one frame at `/dashboard/2d4f1144-…/messages/24516d5c-…`, with
    the quote **₱10,170 · Accepted** in the stream (line items visible) and NO
    "Review & accept" on it.
12. Press the frame's **⋮**. Expect: Quote · Payments · Files · Schedule ·
    Booking details · Report · Block. Press **Payments**. Expect: the workspace
    on its **Payments** tab — not the conversation again. (#5677)
13. On the workspace strip press **Chat**. Expect: the conversation.
14. Open the workspace bare (`/dashboard/2d4f1144-…/vendors/f03c8386-…/workspace`).
    Expect: you land on the conversation — a bare workspace landing IS a chat
    landing by design (#5614).
15. ⚠ The one state I could not reach on Rosa & Ben (already booked): an
    ACCEPTED quote whose lock has not yet been asked shows **"🔒 Ask <shop> to
    lock"** on the quote card. Press it. Expect: the **Vendors page (bench)**
    opens on that shop's category tile, where the row's **Lock** button is —
    NOT the workspace, and NOT the conversation again. (#5677) To reach it:
    send a new quote from a second shop to a fresh event and accept it as the
    couple.

## C · The Event Hub Controller — as testnayan3

16. Open **Go live → Event Hub Controller** (`/dashboard/2d4f1144-…/launch`).
    Expect: the obsidian stage *"setnayan.com/rosa-ben"*, **Active now · Stage 2
    of 4 · RSVP**, four facts (the date · replies "2 of 4 in" · quiet · days).
17. The **Right now** tile. With 4 invited / 2 replied it reads *"2 guests have
    not replied yet"* → **See who** → the Guests page. Mark the other two as
    replied (or add none and reply all), reload: expect *"Every reply is in"* →
    **Open as a guest** — which opens `/rosa-ben` in a NEW tab and does NOT
    reload the controller. (#5683)
18. **View as** chips under the facts: press each. Expect: the card below changes
    to that role's read, and the **Preview** button opens the public page in a
    new tab.
19. The four stage cards: **Preview** on each opens `/rosa-ben?phase=…` in a new
    tab; Editorial's card also carries **Open the workroom** → `/story`.
20. **On the day** rows: Live Studio — livestream · Live Photo Wall · Papic.
    Owned rows show a filled button (**Go live** / **Open the wall** / **Hand out
    cameras**); unowned rows show **+ Add** before the day. Press **Go live**
    if owned: expect the Live Studio controller at `/panood/control/…`.
21. **Set once** doors: The page itself · The story · Our story · Guest columns
    (only if the flag is on) · Guests and replies · The running order · E-Gifts.
    Each opens its page; none 404s.
22. Phone (≤ 414px): the bottom bar's fourth tab. ⚠ Expect it to read
    **"Event Hub Co…"** — the owner-ruled label "Event Hub Controller" is 20
    characters in a 10px, 5-tab bar and truncates on every phone. Not fixed:
    the wording is the owner's (LS8, 2026-09-03). See the owner-decision
    line in AREA-CHAT's report.

## What was NOT verified live

- Anything behind sign-in was traced in code and data (SQL, read-only) — this
  session cannot type a password. Steps 1–21 are what to click; the code path
  for each was read end to end.
- The mobile tools sheet (ⓘ) and the tray heights were measured by #5586/#5614;
  not re-measured here.
