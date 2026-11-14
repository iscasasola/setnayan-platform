/**
 * HELP SLOT H5 — host areas U19, U20, U25–U30, U32, U36, U37.
 *
 * Owned by ONE answer-writing session (H5); no other session edits this file.
 * Covers: Live Watch · Patiktok · plans and payments (Event Plus · Event Pro · Event Ultra) · Setnayan AI · co-hosts · manpower · close-out · paperwork · Groups · refer · Life-Flash.
 * Where those live in the app: app/dashboard/[eventId] (live, studio/live-studio-control, studio/patiktok, orders, checkout, hosts, manpower, archive, paperwork, nikah, refer) · app/samahan.
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
 * H5 · 2026-11-14 — every answer below was checked against origin/main; the code that proves it is named in the comment
 * above it (a greppable string, never a line number). Left out on purpose:
 *   How long Live Watch lasts — what-is-panood says it "stays with the event" while Event Ultra says "for one day"
 *     (lib/event-ultra.ts) — owner ruling; the hosted channel; Live Watch's own "early access" page wording.
 *   Who gets Setnayan AI — SETNAYAN_AI_PAYWALL_ENABLED / platform_settings.setnayan_ai_paywall_enabled decides it.
 *   How to start a plan from inside an event (no single entry found), receipts (the checkout says an Official Receipt
 *     arrives by email; the order page says it is not a BIR Official Receipt) and any confirmation time (four screens
 *     give four different times).
 *   Refer a couple (platform_settings.referral_program_enabled; the reward defaults to nothing), Life-Flash
 *     (NEXT_PUBLIC_LIFE_STORY is off), Manpower (no way in for a host), TikTok auto-post (TIKTOK_CLIENT_KEY).
 *   Buying in the iPhone app — NEXT_PUBLIC_APPLE_IAP_ENABLED + the app build's marker (lib/iap/iap-gate.ts), and any
 *     in-app answer about it would name a purchase (help-in-the-app-sells-nothing).
 *   No price, VAT rate, bank fee, camera count, reel cap, hour or validity window is typed.
 * Existing answers found stale (left untouched — topics-existing.ts is shared): how-to-order (one fixed price; a
 * screenshot "and the reference number"; New order is retired), create-your-youtube-live-link step 7 (the Live stream
 * card shows only once Live Watch is owned). See the PR body.
 */
export const USER_3_TOPICS: HelpTopic[] = [
  {
    key: 'host-live-and-patiktok',
    label: 'Live stream and Patiktok',
    roles: ['couple'],
    articles: [
      {
        // app/panood/control/[eventId]/page.tsx "How guests watch"; home-live-card.tsx "Copy watch link", "Remove link"
        slug: 'how-guests-watch-the-stream',
        title: 'How do our guests watch the live stream?',
        body: 'Start your broadcast on YouTube, then paste its watch link under How guests watch. During the event your Event Hub plays it. Copy watch link shares it anywhere; Remove link takes it down.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // lib/live-studio-pool-only.ts POOL_ONLY_DEFAULT_NOTICE
        slug: 'connect-youtube-account',
        title: 'Do I need to connect my YouTube account?',
        body: 'No — there is nothing to connect. Start your own broadcast on YouTube (or in OBS) and paste the watch link so guests can watch.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // studio/panood/cameras/page.tsx; panood/control/[eventId]/_components/venue-screens-section.tsx
        slug: 'stream-on-a-tv-or-led-wall',
        title: 'Can we show the stream on a TV or LED wall at the venue?',
        body: 'Yes. Any TV, projector or LED wall with a browser can show your live stream or your logo — add and pair them under Venue screens in the controller. Showing the stream there needs your YouTube watch link saved first.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // studio/panood/cameras/page.tsx "Camera link"; app/panood/cam/[token]/ "Join this camera"
        slug: 'a-friends-phone-as-a-camera',
        title: 'How does a friend’s phone become a camera?',
        body: 'Each camera has its own link and QR — send it to the person holding that camera. They sign in, tap Join this camera, and keep the screen open pointed where you want. Each camera reads Connected once it is on. Reissuing a camera’s link disconnects that phone and the old link stops working.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // studio/patiktok/page.tsx HowItWorks
        slug: 'what-is-patiktok',
        title: 'What is Patiktok?',
        body: 'Short dance reels of your guests. Whoever runs the booth picks a template for each guest, the phone records them following it, and every clip is put together into one vertical reel. Recording and watching are free; saving and sharing the reels comes with Patiktok.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // studio/patiktok/page.tsx "1 · Pick 2 templates", "Open booth dashboard"; booth/page.tsx "Primary template", "Backup template"
        slug: 'set-up-the-patiktok-booth',
        title: 'How do I set up the Patiktok booth?',
        body: 'Pick two templates — your main one and a backup — each with its own music. Then whoever runs the booth signs in to your event on a phone and opens the booth dashboard. Finished reels are under Your renders.',
        appBody: HELP_NOT_IN_THE_APP,
      },
    ],
  },
  {
    key: 'host-orders-and-payments',
    label: 'Orders and payments',
    roles: ['couple'],
    articles: [
      {
        // app/pay/[reference]/page.tsx "Pay this exact amount", "Send your proof", "the last 6 digits of your reference number"
        slug: 'how-the-payment-page-works',
        title: 'How do I pay for an order?',
        body: 'The payment page shows the exact amount and where to send it — choose GCash, bank transfer or a QR. Pay that exact amount, then send your proof: a screenshot and the last 6 digits of your reference number. Your order reference has a Copy button.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // orders/[orderId]/page.tsx "Verifying your payment", "Your service unlocks the moment it's confirmed"
        slug: 'after-sending-proof',
        title: 'What happens after I send my proof of payment?',
        body: 'Your order reads Verifying your payment while it is checked against the bank and GCash records — nothing more is needed from you. What you bought turns on the moment it is confirmed, and you get an email.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // lib/orders.ts ORDER_STATUS_LABEL
        slug: 'order-statuses',
        title: 'What do my order’s statuses mean?',
        body: 'Submitted and Awaiting payment — waiting for your payment. Paid — your payment is confirmed. Fulfilled — what you ordered is on. Lapsed — the order ran out before it was paid. Cancelled and Refunded mean what they say.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // orders/[orderId]/page.tsx "Please upload your payment again"
        slug: 'upload-payment-again',
        title: 'Why was I asked to upload my payment again?',
        body: 'The screenshot could not be read. Send a clearer one on the same order — you don’t need to make a new order.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // orders/[orderId]/page.tsx "Cancel order" (canCancel)
        slug: 'cancel-an-order',
        title: 'Can I cancel an order?',
        body: 'Yes, while it is still waiting for payment: open it and tap Cancel order. Once it is cancelled, don’t send anything for it.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // lib/payment-channels.ts PAYMENTS_PAUSED_MESSAGE
        slug: 'payments-are-paused',
        title: 'It says payments are paused — what does that mean?',
        body: 'Setnayan is switching the accounts it receives payments in. Try again shortly — nothing has been charged.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // lib/event-ultra.ts ultraUpgradeLine; front-door-landing-data.ts PLUS_MORE
        slug: 'upgrade-your-event-plan',
        title: 'Can I move from Event Plus or Event Pro to a bigger plan?',
        body: 'Yes, and you pay only the difference: what you paid for Event Plus counts toward Event Pro, and moving from Event Plus or Event Pro to Event Ultra counts what you already paid.',
        appBody: HELP_NOT_IN_THE_APP,
      },
    ],
  },
  {
    key: 'host-setnayan-ai',
    label: 'Setnayan AI',
    roles: ['couple'],
    articles: [
      {
        // studio/setnayan-ai/_components/setnayan-ai-value-copy.ts
        slug: 'what-setnayan-ai-does',
        title: 'What does Setnayan AI do day to day?',
        body: 'It tells you the one thing to do next and tracks every deadline. It flags a payment before it is due, warns you before you go over budget or when two things clash on the day, tells you when a supplier you are watching changes their price, is booked or frees up, and shows you who else is eyeing your date.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // launch/_components/plan-myself.tsx "Plan it myself", "The automatic help"
        slug: 'turn-off-setnayan-ai',
        title: 'Can I plan without Setnayan AI?',
        body: 'Yes. In Event Details › Your event › The automatic help, choose Plan it myself.',
        appBody: HELP_NOT_IN_THE_APP,
      },
    ],
  },
  {
    key: 'host-co-hosts',
    label: 'Co-hosts and helpers',
    roles: ['couple'],
    articles: [
      {
        // lib/guest-access.ts CARD_ACCESS_CHOICES, accessNote; hosts/actions.ts 'Co-hosts are chosen from your guest list.'
        slug: 'add-a-co-host',
        title: 'How do I add a co-host?',
        body: 'Co-hosts come from your guest list. Open the guest’s card and set Access to Co-host — it shows for a guest who has a Setnayan account. It starts once they say yes to the invitation and sign in. A co-host has the same access as you.',
      },
      {
        // lib/delegate-areas.ts DELEGATE_AREA_LABEL, areaChoices; details/_components/people-with-access.tsx
        slug: 'what-a-helper-can-open',
        title: 'How do I choose what a helper can open?',
        body: 'In Event Details › Event access — who can open your event and what each person can change. For each helper, set each part — the guest list, seat plan, the day, suppliers, the Event Hub, the Mood Board, budget and payments, photos — to what they may do with it, or Off.',
      },
      {
        // lib/guest-access.ts; guests/_components/guest-card-body.tsx
        slug: 'remove-a-co-host',
        title: 'How do I take someone’s access away?',
        body: 'Set their Access back to None on their guest card, or change it in Event access. The person who made the event stays its host. The couple themselves — or the celebrant — stay co-hosts and cannot be removed there; ask Setnayan support.',
      },
    ],
  },
  {
    key: 'host-after-the-event',
    label: 'After the event',
    roles: ['couple'],
    articles: [
      {
        // dashboard/[eventId]/_components/after/finished-event-summary.tsx "That's a wrap"
        slug: 'after-the-day',
        title: 'What changes after our event?',
        body: 'Your event opens on a wrap-up: the overview, your guests, your suppliers (where you can review each one), your services, Memories and your story. Every planning tool stays where it was.',
      },
      {
        // details/_components/put-away-card.tsx "Put this away"; archive-actions.ts ("the page stays up exactly as it was"); "Bring it back"
        slug: 'put-an-event-away',
        title: 'Can I put a finished event away?',
        body: 'Yes. Put this away — from the event’s ⋯ on your events or from Event Details — takes it off your list and stops its reminders. Nothing is deleted, and your guests’ Event Hub stays up as it was. The cameras go quiet, so no new photos come in until you tap Bring it back.',
      },
      {
        // (launcher)/_components/event-card-menu.tsx "Remove for good"; delete-actions.ts ("Type {name} exactly")
        slug: 'delete-an-event',
        title: 'How do I delete an event?',
        body: 'From the event’s ⋯, choose Remove for good and type the event’s name exactly to confirm — its photos and everything else go for good. Only the people organising the event can remove it.',
      },
      {
        // delete-actions.ts ("Ask them to agree", "Ask us to remove it", "Withdraw the request"); lib/event-deletion-reasons.ts
        slug: 'why-cant-i-delete',
        title: 'Why can’t I remove my event straight away?',
        body: 'If you paid a supplier on it, they are asked to agree first. If it holds something you paid Setnayan for, removing it ends that — tell us why and a person answers you. While a payment is still being checked, it waits. You can withdraw your request any time.',
      },
    ],
  },
  {
    key: 'host-paperwork',
    label: 'Paperwork and documents',
    roles: ['couple'],
    articles: [
      {
        // paperwork/page.tsx "Build my checklist"; lib/paperwork.ts DOCUMENTS_BY_CEREMONY_TYPE
        slug: 'wedding-paperwork-checklist',
        title: 'Can Setnayan track our wedding paperwork?',
        body: 'Yes, for a wedding. Choose your ceremony type and set your date, then tap Build my checklist: the documents follow your ceremony — your PSA birth certificates, CENOMAR, the marriage license, a pre-Cana seminar and others.',
      },
      {
        // lib/paperwork.ts STATUS_LABEL; paperwork/page.tsx "Mark as requested", "Mark as received", "Open PSA portal"; lib/preparation.ts
        slug: 'track-each-document',
        title: 'How do I track each document?',
        body: 'Mark each as requested, then received; it reads Not started, Requested, In processing, Received or Expired. Add a tracking reference and a scan, and open the PSA or CFO site from the item. Each document’s deadline shows in your schedule.',
      },
      {
        // documents/page.tsx groups; contracts/page.tsx "See all documents"
        slug: 'all-my-documents',
        title: 'Where are all my documents?',
        body: 'In your event’s documents: government paperwork, supplier contracts, what you made on Setnayan, and your order and transaction receipts. Open it from Supplier contracts › See all documents.',
      },
      {
        // nikah/page.tsx; _components/nikah-essentials-card.tsx
        slug: 'nikah-essentials',
        title: 'Is there a checklist for a nikah?',
        body: 'Yes, for a Muslim wedding: mutual consent, the wali, two witnesses, the mahr and the imam or qadi, plus whether seating is mixed or in separate spaces. Today shows how many are in place.',
      },
    ],
  },
  {
    key: 'host-groups',
    label: 'Groups',
    roles: ['couple'],
    articles: [
      {
        // app/(shell)/samahan/page.tsx; dashboard/(account)/samahan/page.tsx
        slug: 'what-is-a-group',
        title: 'What is a group?',
        body: 'One shared space in your Setnayan account for your barkada, parish or clan — find it in People › Groups. An organizer shares the invite link and can change it, which stops the old link at once. Organizers can add organizers, remove members and plan events together.',
      },
      {
        // app/(shell)/samahan/page.tsx "Usapan", "Play the day"
        slug: 'usapan-and-group-stories',
        title: 'What are Usapan and group stories?',
        body: 'Usapan is the group’s chat — your own messages are yours to take down. Group stories are shared moments that disappear after a day; Play the day plays them in order.',
      },
    ],
  },
];
