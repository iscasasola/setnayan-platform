/**
 * HELP SLOT H2 — supplier areas S10–S21.
 *
 * Owned by ONE answer-writing session (H2); no other session edits this file.
 * Covers: Clients · inquiries · quotes and proposals · the negotiation chat · bookings · payments and getting paid · schedules and the calendar · files and contracts · portfolio and albums · QR · reviews · team and crew · storage.
 * Where those live in the app: app/vendor-dashboard (clients, customers, proposals, offers, messages, bookings, payday, earnings, payment-options, calendar, on-the-day, contracts, forms, real-stories, recaps, locked-qr, reviews, team, manpower, branches).
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
import { HELP_NOT_IN_THE_APP } from './not-in-the-app';

/*
 * H2 · 2026-11-14 — every answer below was checked against origin/main; the code that proves it is named in the comment
 * above it (a greppable string, never a line number). Left out on purpose, because each sits behind a switch whose
 * production value cannot be read from here (a flag's default in code is not its value in production):
 *   the client's own pages (Chat · Details · Quotation · Payment · Forms · Schedule · Files · Hub · Report) —
 *     NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED; the ask-then-agree booking — NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED;
 *     Deal cards and meetings — NEXT_PUBLIC_CHAT_NEGOTIATION_V1; the Auto-Reply Assistant — NEXT_PUBLIC_VENDOR_AUTOREPLY_V1;
 *     the chat contact filter — NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED; any per-plan line under VENDOR_TIER_FEATURE_GATE.
 *   Manpower gigs (no way in from the app). No size, day count, price or seat count is typed.
 */
export const SUPPLIER_2_TOPICS: HelpTopic[] = [
  {
    key: 'supplier-clients',
    label: 'Suppliers: Clients',
    roles: ['vendor'],
    articles: [
      {
        // vendor-nav-destinations.ts label: 'Clients'; customers/segments.ts CUSTOMER_SEGMENT_LABEL
        slug: 'supplier-clients-tab',
        title: 'Suppliers: what is the Clients tab?',
        body: 'Clients holds everyone you work with, in three views: Events (one row for each event, not each person), Dates (your calendar and days off) and Money (what has come in and what is still to come).',
      },
      {
        // customers/_components/customers-roster.tsx LANE_BADGE, nextStepLabel, 'Date not set'
        slug: 'supplier-client-stages',
        title: 'Suppliers: what do Asking, Holding, Talking, Booked and Done mean?',
        body: 'Each row carries where that client is. Asking — a couple asked and is waiting for you. Holding — you answered and nothing has happened since. Talking — you are in conversation. Booked — the booking is made. Done — the event is over. Each row also shows the event, its date (or Date not set), the venue and one next step, such as Reply, Send a quote or Follow up.',
      },
      {
        // customers/page.tsx placeholder="Search clients"; customers/clients-show-sort.ts CLIENTS_SHOW, CLIENTS_GROUP, CLIENTS_SORT
        slug: 'supplier-find-a-client',
        title: 'Suppliers: how do I find a client?',
        body: 'Type in Search clients, or use Show & sort: show All, Asked, Booked, Done, Schedules, To collect, Overdue or Unread; group by status, by day or by who handles it; and sort by Waiting first, event date, newest message or name.',
      },
      {
        // customers/_components/outside-client-add.tsx "Add a booking from outside", "Holds the day so nothing double-books it."
        slug: 'supplier-add-outside-booking',
        title: 'Suppliers: can I add a booking that didn’t come through Setnayan?',
        body: 'Yes. In Clients tap ＋ Add › Add a booking from outside. It holds that day on one of your schedules so nothing double-books it, and it costs nothing. Make a schedule first if you have none.',
      },
      {
        // lib/vendor-thread-tools.ts key 'log-outcome' "Mark won or lost"
        slug: 'supplier-won-or-lost',
        title: 'Suppliers: can I note whether I won or lost an inquiry?',
        body: 'Yes. In the chat’s ＋ tools, Mark won or lost records it. It is private to you — the couple never sees it.',
      },
    ],
  },
  {
    key: 'supplier-inquiries',
    label: 'Suppliers: inquiries',
    roles: ['vendor'],
    articles: [
      {
        // lib/chat-actions.ts type 'vendor_inquiry_received', title "New booking inquiry"
        slug: 'supplier-new-inquiry',
        title: 'Suppliers: how will I know a couple asked me?',
        body: 'You get a New booking inquiry notice in Setnayan and on your phone, and the ask waits on Today and in Clients. Opening it takes you to that couple’s chat.',
      },
      {
        // _components/overview-sections.tsx (messageExcerpt, AgeLine); identity-masking covers the hidden name
        slug: 'supplier-inquiry-details',
        title: 'Suppliers: what do I see before I answer an inquiry?',
        body: 'The job: the date, the kind of service, roughly how many guests, how long they have waited, and their message word for word. The couple’s contact details stay hidden, as always.',
      },
      {
        // _components/event-lines.tsx InquiryAnswers "Decline" · "Ask a question" · "Accept"; lib/chat-actions.ts acceptInquiry ("can't reply before accepting"), unlock_vendor_event_free
        slug: 'supplier-answer-an-inquiry',
        title: 'Suppliers: how do I answer an inquiry?',
        body: 'Three choices: Accept, Ask a question, or Decline. Accepting opens the chat so you can reply, and the couple then sees your shop name. Answering an inquiry costs nothing, whatever your plan.',
      },
      {
        // lib/chat-actions.ts declineInquiry, notifyCoupleOfInquiryOutcome('inquiry_declined')
        slug: 'supplier-decline-inquiry',
        title: 'Suppliers: what happens when I decline?',
        body: 'The couple is told you can’t take it — with your reason, if you give one — and pointed to other suppliers. Your shop name stays hidden from them.',
      },
      {
        // lib/vendor-reply-time.ts REPLY_TIME_MIN_SAMPLE, FAST_REPLY_THRESHOLD_MIN; explore/_components/vendor-card.tsx "Usually responds in"
        slug: 'supplier-reply-time',
        title: 'Suppliers: do couples see how fast I reply?',
        body: 'Yes, once you have answered enough inquiries: your card can show “Usually responds in …”, worked out from how quickly you really reply.',
      },
    ],
  },
  {
    key: 'supplier-quotes',
    label: 'Suppliers: quotes',
    roles: ['vendor'],
    articles: [
      {
        // lib/vendor-thread-tools.ts key 'build-quote' "Send a quote"; app/_components/proposal-maker.tsx (the steps)
        slug: 'supplier-send-a-quote',
        title: 'Suppliers: how do I send a quote?',
        body: 'In the chat’s ＋ tools, tap Send a quote and start from your card, a saved quote or a blank one. Pick the service cards, what is included, any gift, travel and crew meals, a discount, the payment schedule and how they can pay, set Valid until, then send. A quote goes to a couple you are already chatting with.',
        appBody: 'In the chat’s ＋ tools, tap Send a quote and start from your card, a saved quote or a blank one. Pick the service cards, what is included, the payment schedule and how they can pay, set Valid until, then send. A quote goes to a couple you are already chatting with.',
      },
      {
        // proposal-maker.tsx "Set Valid until first — it is required to send"; app/_components/valid-until-picker.tsx
        slug: 'supplier-quote-valid-until',
        title: 'Suppliers: why do I have to set Valid until?',
        body: 'Every quote needs a date it is good until — you cannot send one without it. Pick one of the suggested lengths or your own date; it can never be after the event itself.',
      },
      {
        // proposal-maker.tsx "Payment schedule", "How they pay", "Final balance", "Accepted payment methods"
        slug: 'supplier-quote-payment-schedule',
        title: 'Suppliers: how do I set how the couple pays?',
        body: 'Under Payment schedule, choose how they pay — a ready-made split or your own — and add payments as you like; the Final balance always settles the rest. Under Accepted payment methods, tick only the ways you want this quote to show; untick them all to show every way you have set up.',
        appBody: 'Under Payment schedule, choose how they pay — a ready-made split or your own — and add payments as you like; the Final balance always settles the rest. Under Accepted payment methods, tick the ways this quote shows.',
      },
      {
        // proposal-maker.tsx "Save this quote · reuse it next time", "As they see it"; lib/saved-quote.ts
        slug: 'supplier-reuse-a-quote',
        title: 'Suppliers: can I reuse a quote, or see it as the couple will?',
        body: 'Yes to both. Save this quote keeps its lines and terms — never the couple’s details — so it shows under Start from next time. As they see it shows the quote exactly as the couple will.',
      },
      {
        // proposal-maker.tsx data-quote-send-note ("It books nothing and pays nothing"); app/proposals/[publicId]/page.tsx
        slug: 'supplier-couple-accepts-quote',
        title: 'Suppliers: what happens when a couple accepts my quote?',
        body: 'The quote shows in your chat and the couple reviews it. Accepting adds you to their shortlist at that amount so they can compare suppliers — it does not book you and no money moves. The booking comes after, when you both agree to it.',
      },
      {
        // lib/vendor-proposals.ts PROPOSAL_STATUS_LABEL; app/_components/quote-version-line.tsx, quote-versions-sheet.tsx; chat/cards/ask-change-card.tsx
        slug: 'supplier-change-a-quote',
        title: 'Suppliers: how do I change a quote I already sent?',
        body: 'Send a new version — the one before it is marked Superseded, and Every version lets you compare them side by side. A couple cannot change your quote themselves: they tap Ask for a change, and you revise it or decline. A quote reads Draft, Sent, Viewed, Accepted, Declined, Expired or Superseded.',
      },
    ],
  },
  {
    key: 'supplier-bookings',
    label: 'Suppliers: bookings and the day',
    roles: ['vendor'],
    articles: [
      {
        // bookings/booking-list-status.ts BOOKING_LIST_LABEL; lib/vendor-thread-stage.ts THREAD_STAGE_LABEL
        slug: 'supplier-booking-statuses',
        title: 'Suppliers: where do I see all my bookings?',
        body: 'In Clients › Money › Bookings: each booking with its status and what is left to prepare. Filter by All, New, In progress or Closed.',
      },
      {
        // clients/[eventId]/actions.ts vendorRaiseChangeOrder; clients/[eventId]/page.tsx "Log a change order"
        slug: 'supplier-change-order',
        title: 'Suppliers: the couple added something after booking — how do I record it?',
        body: 'Log a change order on that client: what was added or dropped. The couple accepts or declines it, so you both keep the same record of what was agreed.',
      },
      {
        // clients/[eventId]/page.tsx completion card, vendorMarkServiceComplete
        slug: 'supplier-mark-complete',
        title: 'Suppliers: how do I finish a job?',
        body: 'After the event, tap Mark service complete. The couple confirms they got everything — or it confirms on its own after the days the card states — and their review opens.',
      },
      {
        // customers/_components/dates-folds.tsx "Phone calendar"; customers/calendar.ics/route.ts
        slug: 'supplier-phone-calendar',
        title: 'Suppliers: can I put my bookings on my phone’s calendar?',
        body: 'Yes. In Clients ⚙, Phone calendar downloads every booking as a calendar file to open on your phone. It is a copy taken at that moment, so download it again after new bookings.',
      },
      {
        // customers/_components/dates-folds.tsx "Not available", "How many a day"; day-sheet.tsx
        slug: 'supplier-days-off',
        title: 'Suppliers: how do I block days I can’t work?',
        body: 'In Clients › Dates, mark the days as Not available — once, on repeat, or for certain hours. Each day reads Free, Still has room, Full or Not available.',
      },
      {
        // on-the-day/_components/crew-panel.tsx "Make the crew QR", "Replace the QR", "Turn the crew QR off"
        slug: 'supplier-crew-qr',
        title: 'Suppliers: how does my crew get into an event on the day?',
        body: 'Make the crew QR in the event’s Hub. Each phone that scans it waits for you to allow it. You can replace the QR or turn it off at any time.',
      },
      {
        // on-the-day/_components/access-grants.tsx "Your team on this event"
        slug: 'supplier-team-on-an-event',
        title: 'Suppliers: which of my team can open an event?',
        body: 'You and your admins always can. Give anyone else on your staff an event from that event’s Hub.',
      },
    ],
  },
  {
    key: 'supplier-getting-paid',
    label: 'Suppliers: getting paid',
    roles: ['vendor'],
    articles: [
      {
        // payment-options/surface.tsx TYPE_META; _components/payout-method-nudge.tsx "Couples pay you directly"
        slug: 'supplier-how-couples-pay',
        title: 'Suppliers: how do couples pay me?',
        body: 'Directly, to you — Setnayan never holds your money. Add the ways you take payment in How clients pay you: a bank or e-wallet account, a QR code, or a payment link. A new way may show In review until Setnayan checks it.',
      },
      {
        // lib/vendor-thread-tools.ts "Ask for a payment"; chat/cards/payment-step-card.tsx "Which payment?", "Another amount"
        slug: 'supplier-ask-for-payment',
        title: 'Suppliers: how do I ask a couple for a payment?',
        body: 'Once they have booked you, use Ask for a payment in the chat’s ＋ tools. Pick which payment from the schedule you agreed, or another amount, and when it is due. You can take the ask back if you sent it by mistake.',
      },
      {
        // messages/[threadId]/_components/vendor-payment-live.tsx "Confirm received", "Not received", "All payments confirmed."
        slug: 'supplier-confirm-payment',
        title: 'Suppliers: how do I record that a couple paid?',
        body: 'When a couple sends a payment, check your account and tap Confirm received — or Not received if it has not arrived. When every payment is in, the booking reads All payments confirmed.',
      },
      {
        // customers/money-pin-figures.ts; customers/_components/money-view.tsx; clients/[eventId]/_components/client-refunds.tsx "Record a refund"
        slug: 'supplier-money-view',
        title: 'Suppliers: where do I see what I have been paid and what is owed?',
        body: 'In Clients › Money: what you have received, what is still to come and what is overdue, the next payments due, and your booking fees. A refund you give a couple is kept on that client with Record a refund.',
      },
    ],
  },
  {
    key: 'supplier-files-and-forms',
    label: 'Suppliers: contracts, files and forms',
    roles: ['vendor'],
    articles: [
      {
        // contracts/surface.tsx "does not facilitate signatures"; contracts/[contractId]/page.tsx "Make visible to couple"
        slug: 'supplier-contracts',
        title: 'Suppliers: can I share a contract with a couple?',
        body: 'Yes. Upload the PDF in Clients › Money › Contracts and tap Make visible to couple. Setnayan keeps the file for both of you to refer to; signing it happens between you and the couple.',
      },
      {
        // lib/vendor-thread-tools.ts "Share a file"; lib/chat-attachment-limits.ts CHAT_ATTACHMENT_MIME; lib/chat-file-rules.ts
        slug: 'supplier-share-files',
        title: 'Suppliers: what files can I send in a chat?',
        body: 'Photos, videos, PDFs, Word and Excel files and text — use Share a file in the chat’s ＋ tools. Photos and videos are made smaller on your phone before they send; documents go as they are. Chat files are kept for a time after the event, while contracts and payment proofs are kept for good.',
      },
      {
        // clients/[eventId]/_pages/forms.tsx "Questions for the couple", "Load a form"
        slug: 'supplier-forms',
        title: 'Suppliers: can I send a couple my questions or forms?',
        body: 'Yes. Questions for the couple sends your question set into their event, and you see what they told you. You can also keep forms in your library and load one for any client.',
      },
    ],
  },
  {
    key: 'supplier-portfolio-and-reviews',
    label: 'Suppliers: portfolio, QR codes and reviews',
    roles: ['vendor'],
    articles: [
      {
        // lib/supplier-collections.ts; collections/_components/portfolio-view.tsx "Add photos", "Search photos"
        slug: 'supplier-portfolio',
        title: 'Suppliers: what is in Portfolio?',
        body: 'Everything you show and deliver: the photos and videos on your page, your service card photos, albums by event, your own shots at events, what you delivered to couples, and your mood board library. Add photos, search them, and add video links.',
      },
      {
        // shop/promote/_components/share-your-work.tsx "Share your work"
        slug: 'supplier-stories-and-recaps',
        title: 'Suppliers: where are the stories and recaps about my work?',
        body: 'In Shop › Promote › Share your work — the stories and recaps of the events you were part of, ready to share.',
      },
      {
        // shop/promote/page.tsx (Check a date · Shortlist · My page · Reviews; "Write to NFC")
        slug: 'supplier-qr-codes',
        title: 'Suppliers: what QR codes do I get?',
        body: 'Shop › Promote has four: Check a date, Shortlist, My page and Reviews. Each can be shared, copied as a link, downloaded, written to an NFC tag or printed. A couple who reaches you through them is your own client.',
      },
      {
        // app/vendor-dashboard/invite/page.tsx; lib/vendor-verification.ts LOCKED_QR_NEEDS_VERIFIED
        slug: 'supplier-booked-qr',
        title: 'Suppliers: what is a booked QR?',
        body: 'A one-use code that records a booking you made with a couple directly — its total, the first payment, the schedule and the proof — so it sits in Setnayan with your other bookings. Make one in Clients › Dates › QR codes. Only verified shops can make them.',
      },
      {
        // dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx "Leave a review"; guest-review-qr.tsx
        slug: 'supplier-get-reviews',
        title: 'Suppliers: how do couples review me?',
        body: 'After you mark the service complete and the couple confirms it, they can leave a review — only a completed booking can. Guests can review you too, from your Reviews QR.',
      },
      {
        // website/_components/review-replies.tsx "One public reply per review", "From the hosts", "From guests"; reviews/actions.ts submitFlagAsFake
        slug: 'supplier-reply-to-review',
        title: 'Suppliers: can I reply to a review, or report a fake one?',
        body: 'Reply in Shop › Page › Reviews and stories. You get one public reply per review: every couple sees it, and it is final once posted, so take your time. A host’s review you believe is fake can be flagged once with Flag as fake. Guest reviews never move your overall stars.',
      },
    ],
  },
  {
    key: 'supplier-team',
    label: 'Suppliers: your staff and storage',
    roles: ['vendor'],
    articles: [
      {
        // lib/vendor-team.ts VENDOR_TEAM_ROLE_LABEL, VENDOR_TEAM_ROLE_BLURB; team/_components/helpers-view.tsx "Two admins agree"
        slug: 'supplier-team-roles',
        title: 'Suppliers: what can each person on my team do?',
        body: 'An Admin runs the shop with you — team, plan and everything else. A Team member works the services you give them and sees only their own work. A Helper sees the schedule and bookings and changes nothing. Changing who is an admin needs two admins to agree.',
      },
      {
        // _components/branch-manager.tsx "included in your plan", "Branches come with Supplier Pro and Supplier Ultra." (plan-dependent — not typed)
        slug: 'supplier-branches',
        title: 'Suppliers: can I add branches?',
        body: 'Branches are added in Your details › Where you work, which shows how many branches your plan includes and what to do when they are all in use.',
      },
      {
        // subscription/_components/plan-rows.tsx Storage row; lib/supplier-storage.ts storageRowLine
        slug: 'supplier-storage',
        title: 'Suppliers: how much storage do I have?',
        body: 'Your Plan page has a Storage row showing how much of your space is used. How much you get depends on your plan.',
        appBody: HELP_NOT_IN_THE_APP,
      },
    ],
  },
];
