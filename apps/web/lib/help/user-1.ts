/**
 * HELP SLOT H3 — host areas U1–U11.
 *
 * Owned by ONE answer-writing session (H3); no other session edits this file.
 * Covers: Home · guests · check-in · sponsors · join requests · schedule · the date finder · budget · suppliers · contracts · messages.
 * Where those live in the app: app/dashboard/[eventId] (page, guests, sponsors, access-requests, schedule, find-date, date-selection, budget, vendors, contracts, messages, event-qr).
 *
 * Rules every answer here obeys (each is held by a guard that reads this file):
 * - say what ships on main today, in the app's own words — no future, no typed
 *   price, credit count or tier boundary (read prices from the catalogue; point
 *   at setnayan.com/pricing or the supplier billing hub);
 * - "supplier", never "vendor"; plans are Event Plus · Event Pro · Event Ultra
 *   and Supplier Plus · Supplier Pro · Supplier Ultra;
 * - every slug is globally unique across lib/help/ and lib/help-admin/
 *   (lib/help-slugs-are-unique.test.ts);
 * - give an `appBody` where the web answer points at buying, Android or desktop
 *   (lib/help-in-the-app-sells-nothing.test.ts).
 *
 * lib/help.ts appends this file's topics after topics-existing.ts, in slot order.
 */
import type { HelpTopic } from '@/lib/help';

/*
 * H3 · 2026-11-14 — every answer below was checked against origin/main; the code that proves it is named in the comment
 * above it (a greppable string, never a line number). Left out on purpose:
 *   U9 the Suppliers tab itself (Find · Build · Booked, the card buttons, Book this build, saved builds, cancelling a
 *     booking) and chat Deals — behind NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED and NEXT_PUBLIC_CHAT_NEGOTIATION_V1, whose
 *     production values cannot be read from a session.
 *   The Sponsors page — it has no way in except a paid Setnayan AI row; guest-list roles stay the way to name sponsors.
 *   NFC tag check-in (NEXT_PUBLIC_NFC_WRITE_ENABLED), and every paid row (◆ Pro, Your services, Release) — those are
 *     other slots' plans-and-payments answers and are hidden in the iPhone app.
 * Existing answers found stale (left untouched — topics-existing.ts is shared): import-csv ("tap ＋" → Add guests ›
 * Import a file), start-thread-with-vendor ("Tap Message" → Ask for a quote / Chat), budget-line-items ("your
 * Setnayan services" → Bought on Setnayan). See the PR body.
 */
export const USER_1_TOPICS: HelpTopic[] = [
  {
    key: 'host-today',
    label: 'Your event’s Today',
    roles: ['couple'],
    articles: [
      {
        // app/dashboard/[eventId]/_components/home-first-screen.tsx "Your event", "tap a name to open it"; home-control-faces.ts HOME_CONTROL_KEYS
        slug: 'what-is-on-today',
        title: 'What is on my event’s Today page?',
        body: 'At the top, your event’s name, the countdown to your date and the one thing to do now. Under it, your next to-dos and anything waiting on you. Then Your event — Countdown, Schedule, Guests, Event Hub, Suppliers, To do and Budget — where tapping a name opens its page.',
      },
      {
        // lib/home-first-screen.ts HOME_NEXT_ORDER, pickHomeNext ("Add your guests", "You are on track")
        slug: 'how-today-picks-the-next-thing',
        title: 'How does Today pick the one thing to do?',
        body: 'It shows the first that applies: finish your Event Hub, set your date, add your guests, send your invitations, and so on. When nothing is waiting, it says You are on track.',
      },
      {
        // home-first-screen.tsx '"Later" beside a widget's verb folds Now for today, on this device'; home-parts.tsx HomeLater
        slug: 'hide-a-suggestion-for-today',
        title: 'Can I put a suggestion away for today?',
        body: 'Yes. Tap Later beside it and it folds away for the rest of today, on this phone or computer only.',
      },
      {
        // home-control-faces.ts countdownTile ("No date yet", 'Set your date')
        slug: 'countdown-without-a-date',
        title: 'What does the countdown show if we have no date yet?',
        body: 'It reads No date yet, with a Set your date button that helps you choose one.',
      },
      {
        // home-control-row.tsx hub: 'Which of the four pages your guests see now…' ("View Event Hub", "Pick what shows", "Edit in Maker")
        slug: 'today-event-hub-widget',
        title: 'What does the Event Hub on Today do?',
        body: 'It shows which of your Event Hub’s pages your guests see right now. View Event Hub opens it as they see it, Pick what shows chooses its pages, and Edit in Maker opens the Event Hub Maker.',
      },
    ],
  },
  {
    key: 'host-guest-list',
    label: 'Your guest list',
    roles: ['couple'],
    articles: [
      {
        // lib/guests-views.ts GUESTS_VIEW_LABEL, SEAT_MODE_MENU_LABEL, GUESTS_TOP_LABEL
        slug: 'guests-views',
        title: 'What are the views on Guests?',
        body: 'The menu at the top switches between your guests — as a list or on a map — your seats (a list, the 2D floor plan or the 3D room) and the march.',
      },
      {
        // guests-screen.tsx label: 'Search guests or add' ("SEARCH OR ADD, ONE ENTER"); add-guest-sheet.tsx ADD_WAYS
        slug: 'add-a-guest-quickly',
        title: 'How do I add a guest quickly?',
        body: 'Type their name in Search guests or add and press Enter: if it matches one guest, that guest opens; if nobody matches, they are added. Add guests also lets you type a name, add from your people on Setnayan, or import a file.',
      },
      {
        // lib/guests-filter.ts GUESTS_SHOW, GUESTS_SORTS; lib/guest-roster-view.ts ROSTER_VIEWS
        slug: 'filter-group-sort-guests',
        title: 'How do I filter, group or sort my guests?',
        body: 'Show narrows the list by reply — everyone, attending, no reply, declined — or to the guests still to invite. Group by role, last name, side, group or reply, and sort by importance, name or table.',
      },
      {
        // guest-card-body.tsx label="Reply", "Answer recorded", 'Marked by you'; guests-screen.tsx setOptions reply:attending
        slug: 'record-a-reply-for-a-guest',
        title: 'Can I record a guest’s reply myself?',
        body: 'Yes. Open their card and set Reply — it then shows the answer was marked by you. For many guests at once, select them and set their reply together.',
      },
      {
        // guests-screen.tsx setOptions; `Invite ${selected.size}`
        slug: 'change-many-guests',
        title: 'What can I change for many guests at once?',
        body: 'Select the guests, then set their reply, their group (or a new group), their table (or Not seated) or their side — or invite them all in one go.',
      },
      {
        // guest-card-body.tsx label="Group", label="Side"; checkin-desk.tsx SIDE_LABELS
        slug: 'guest-groups-and-sides',
        title: 'Can I put guests in families or sides?',
        body: 'Yes. Every guest can have a Group — make a new one from the card — and, for a wedding, a Side: the bride’s, the groom’s or both.',
      },
      {
        // guest-card-body.tsx label="…" list ("Note for them", "Private note"); the-fable-card-and-rows.test.ts "no email anywhere a couple can see"
        slug: 'what-is-on-a-guest-card',
        title: 'What is on a guest’s card?',
        body: 'Their name (title, first, middle, last, suffix and how it is shown), mobile, side, group, role, extra seats, reply, what they are invited to, meal and dietary needs, table, a note they can see, a private note only you see, and Passed Away for someone you remember.',
      },
      {
        // guest-card-body.tsx label="Invited to" ("INVITED TO ▾ — THE EVENT'S CHAPTERS")
        slug: 'invite-to-part-of-the-day',
        title: 'Can a guest be invited to only part of the day?',
        body: 'Yes. Invited to on their card lists your event’s chapters, all ticked at first. Untick the ones they are not invited to, and they see only their part.',
      },
      {
        // guest-setup/rsvp-asks.tsx RSVP_ASKS_TITLE; lib/rsvp-ask.ts RSVP_ASK_LABEL; guest-setup/reply-by.tsx REPLY_BY_LABEL
        slug: 'what-the-reply-asks',
        title: 'What can I ask guests when they reply?',
        body: 'In Guests settings › RSVP asks, whether they are attending is always asked. Tick any of: plus-ones, meal, dietary needs, a song request, a note and their mobile. Reply by sets the day your invitation asks them to answer by.',
      },
      {
        // lib/who-can-reply.ts GUESTS_GET_IN_LABEL; lib/rsvp-ask.ts GUEST_ENTRY_RULE
        slug: 'how-guests-get-in',
        title: 'Who can reply to my event?',
        body: 'You choose in Guests settings › How guests get in. Only my list — just your guests, replying or simply holding their QR as their ticket. My list + requests — anyone with your link can ask to join, and you say yes. Open — whoever opens the link is in.',
      },
      {
        // lib/headcount-row.ts FINALIZE_NOW_LABEL, FINALIZE_SHEET, REOPEN_LABEL
        slug: 'finalize-the-headcount',
        title: 'Can I close replies once my count is final?',
        body: 'Yes. Finalize now closes replies at your current headcount, so guests can no longer answer. Reopen guest list undoes it at any time.',
      },
      {
        // guest-setup/guest-setup-rows.tsx "Download as Excel"; guests/export/route.ts
        slug: 'download-guest-list',
        title: 'Can I download my guest list?',
        body: 'Yes. In Guests settings, Download as Excel gives you every guest in one spreadsheet, in the same columns as the import template.',
      },
      {
        // guests/send/page.tsx; send/_components/send-run.tsx ("Copy message", "Send again"); invitation/actions.ts markGuestInvitationSent
        slug: 'send-invitations-one-by-one',
        title: 'How do I send my invitations?',
        body: 'Send the invitations takes you through every guest not yet sent to, one at a time. Each Send opens your phone’s share sheet with your message and their QR — or tap Copy message — and marks them sent. Setnayan does not send them for you: they go from your own apps. A guest with no number is shared by link.',
      },
      {
        // guests/tea-ceremony/page.tsx title 'Tea ceremony serving order'
        slug: 'tea-ceremony-order',
        title: 'Is there a tea ceremony serving order?',
        body: 'Yes, for a Chinese wedding: the Tea ceremony serving order lists the elders to serve, the groom’s side first. Set each one’s place with Tea-ceremony order on their card.',
      },
    ],
  },
  {
    key: 'host-check-in',
    label: 'Check-in and join requests',
    roles: ['couple'],
    articles: [
      {
        // guests/checkin/page.tsx title 'Check-in desk'; checkin/_components/checkin-desk.tsx ("Mark arrived", "No QR on hand? Search their name…")
        slug: 'check-guests-in',
        title: 'How do I check guests in at the door?',
        body: 'Open the Check-in desk and scan a guest’s QR — or, with no QR on hand, search their name — then tap Mark arrived. The desk counts who has arrived and lists the latest arrivals, and a mistake can be undone.',
      },
      {
        // checkin/page.tsx .in('member_type', ['couple','coordinator']), isDelegateWithoutArea(viewer, 'guest_list')
        slug: 'who-can-check-guests-in',
        title: 'Who can check guests in?',
        body: 'You, your co-hosts and your coordinator. Anyone else helping needs the guest list shared with them first.',
      },
      {
        // checkin-desk.tsx "saved on this phone"; lib/offline-copies.ts; page.tsx readyRows
        slug: 'check-in-without-signal',
        title: 'Can I check guests in with no signal?',
        body: 'Yes. The desk keeps your list on the phone, so a scan with no signal is saved there and sent when the signal returns; only Undo needs a connection. On the day, Today shows whether your guest list, seat plan, run of show and check-in desk are ready for no signal.',
      },
      {
        // guest-setup/guest-setup-rows.tsx REQUESTS_TITLE; guests/claims/page.tsx ("Add to my list", "Link", "Decline", "Nothing is emailed."); lib/request-key.ts REQUEST_WORDS
        slug: 'answer-join-requests',
        title: 'People asked to join through my link — where do I answer?',
        body: 'In Guests settings › Requests to join. For each person: Add to my list, Link them to a guest already on your list, or Decline. They see that they are waiting for you to confirm them, and their QR works once you do. Nothing is emailed.',
      },
      {
        // access-requests/page.tsx title="Access requests"; _components/request-card.tsx; lib/delegate-areas.ts DELEGATE_AREA_LABEL
        slug: 'answer-access-requests',
        title: 'A supplier asked to see part of my event — how do I answer?',
        body: 'Access requests lists each part they asked for — the guest list, seat plan, the day, suppliers, the Event Hub, the mood board, budget and payments (to view only), or photos — and you Share or Decline each one. You can take any of it back later, and they lose it straight away.',
      },
    ],
  },
  {
    key: 'host-schedule-and-date',
    label: 'Schedule and date',
    roles: ['couple'],
    articles: [
      {
        // lib/schedule DEFAULT_CHAPTER_LABELS; schedule/every-new-event-starts-with-four-chapters.test.ts; chapters-host.tsx "+ New chapter"
        slug: 'schedule-chapters',
        title: 'How is my schedule organised?',
        body: 'In chapters. A new wedding starts with four — Prep, Ceremony, Cocktail + Reception and After Party — and you can add a chapter with + New chapter or swipe one away (with Undo). Chapters may overlap.',
      },
      {
        // _components/schedule-mode-toggle.tsx
        slug: 'planning-stage-and-event-day',
        title: 'What are Planning Stage and Event Day?',
        body: 'The two views of your schedule: Planning Stage is your dated to-do list before the day, and Event Day is the timeline of the day itself.',
      },
      {
        // _components/ask-supplier-section.tsx ("Ask a supplier to change their times", "Send ask")
        slug: 'ask-a-supplier-to-change-time',
        title: 'Can I ask a booked supplier to change their time?',
        body: 'Yes. On a moment in your schedule, tap Ask a supplier to change their times, pick the supplier and the new time, add a note, and Send ask. You see whether they said yes.',
      },
      {
        // schedule/page.tsx "Share your schedule (PDF)"; _components/emcee-script-button.tsx "Generate emcee script"
        slug: 'share-the-schedule',
        title: 'Can I share or print my schedule?',
        body: 'Yes. Share your schedule (PDF) makes a file to send or print, and Generate emcee script turns your timeline into a script your host can read from.',
      },
      {
        // date-selection/page.tsx title 'Pick your date' (three paths); four-question-flow.tsx
        slug: 'pick-your-date',
        title: 'We have no date yet — where do we start?',
        body: 'Pick your date gives three ways in: I have a date in mind (pick it on the calendar), Help me pick a meaningful one (four short questions — your tradition, indoor or outdoor, dates close to your heart, and siblings marrying the same year — then suggested dates), or I’m not ready yet, and come back any time from your event.',
      },
    ],
  },
  {
    key: 'host-budget-and-contracts',
    label: 'Budget and contracts',
    roles: ['couple'],
    articles: [
      {
        // budget/_components/budget-screen.tsx (All · Owing · Paid; GroupHead titles)
        slug: 'budget-filter-and-groups',
        title: 'How is the budget page laid out?',
        body: 'In three groups — booked suppliers, what you bought on Setnayan, and your own expenses — with Show (all, owing or paid) and search. The totals at the top stay the same whatever you show.',
        appBody: 'In groups — your booked suppliers and your own expenses — with Show (all, owing or paid) and search. The totals at the top stay the same whatever you show.',
      },
      {
        // budget/_components/budget-sheets.tsx HOW, "Record a payment", "Add expense"
        slug: 'record-a-payment',
        title: 'How do I record something I paid?',
        body: 'On a supplier’s row, tap Record a payment: the amount, the date and how you paid — GCash, bank transfer, cash or card. For anything not booked through Setnayan, use ＋ Add expense.',
      },
      {
        // budget/_components/budget-file-actions.tsx
        slug: 'export-the-budget',
        title: 'Can I export my budget?',
        body: 'Yes: Share your budget (PDF) for a file to send or print, or Spreadsheet (.csv) to open in Excel or Google Sheets.',
      },
      {
        // budget/_components/share-budget-band-toggle.tsx
        slug: 'suppliers-see-my-budget',
        title: 'Can suppliers see my budget?',
        body: 'Not unless you turn on Share budget ranges with suppliers. Then a supplier you talk to sees a range for their own category only — never your exact numbers. It is off until you turn it on.',
      },
      {
        // vendors/_components/suppliers-settings-rows.tsx COSTS_OPTIONS
        slug: 'costs-follow-headcount',
        title: 'How do supplier costs follow my guest count?',
        body: 'In Suppliers ⚙ › How you see costs: Realtime shows each supplier’s cost adjust as your confirmed count grows; Final only holds the base and shows the change once, when you finalize.',
      },
      {
        // contracts/page.tsx title="Supplier contracts"; contracts/[contractId]/page.tsx (hosting disclosure)
        slug: 'supplier-contracts-for-hosts',
        title: 'Where are my supplier contracts, and do I sign them here?',
        body: 'In Supplier contracts, from Documents or a booked supplier. A supplier uploads the PDF once you agree on terms in chat, and you open it with View / download. Setnayan keeps the file so both of you have a copy — signing happens between you and the supplier, so keep a signed copy.',
      },
    ],
  },
  {
    key: 'host-chats',
    label: 'Chats',
    roles: ['couple'],
    articles: [
      {
        // messages/[threadId]/page.tsx canFollowUpWhilePending ("Withdraw inquiry", "See similar suppliers")
        slug: 'waiting-for-supplier-to-accept',
        title: 'Why can’t I keep writing to a supplier?',
        body: 'Your chat opens once the supplier accepts your inquiry. Until then you can send one follow-up, and you are told the moment they reply. You can also Withdraw inquiry. If they decline, See similar suppliers shows others.',
      },
      {
        // messages/_components/chat-inbox.tsx "Search chats"; start-thread-picker.tsx "Message one of your suppliers"
        slug: 'find-or-start-a-chat',
        title: 'How do I find or start a chat?',
        body: 'Chats has Search chats and shows all, unread or supplier chats. ✎ New message lets you message one of this event’s suppliers.',
      },
      {
        // lib/chat-groups.ts; messages/_components/event-groups.tsx ("Groups", "New group")
        slug: 'event-group-chats',
        title: 'What are the group chats?',
        body: 'Above your supplier chats: General (you and every guest attending, with no suppliers), a group for each role on your guest list, and any group you make with New group. Quotes and payments stay in each supplier’s own chat.',
      },
    ],
  },
];
