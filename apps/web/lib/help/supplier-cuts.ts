/**
 * HELP SLOT · SUPPLIER CUTS 5–7 (owner-approved 2026-11-14 — DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED";
 * prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` §§ 5–7). The answers that ship with those
 * three cuts: your own times before the program · Post an update (and what the couple sees) · Make a quote in the chat.
 *
 * Its own file so it never edits another session's slot. The rules every slot obeys apply here too: what ships on main
 * today in the app's own words, no typed price, "supplier" never "vendor", globally unique slugs.
 * lib/help.ts appends this file's topics after the H-slots.
 */
import type { HelpTopic } from '@/lib/help';

export const SUPPLIER_CUTS_TOPICS: ReadonlyArray<HelpTopic> = [
  {
    key: 'supplier-working-an-event',
    label: 'Suppliers: working an event',
    roles: ['vendor'],
    articles: [
      {
        // 🕕 Your times before the program exists (cut 5, 2026-11-14).
        slug: 'set-your-times',
        title: 'Set your call time before the hosts build their program',
        body: 'Open the event and go to Schedule. Before the hosts build their program, it shows Your times: your call time (when your crew meets), when you arrive at the venue and when you’re done. Each saves as you set it. Once the hosts build their program, your arrival and finish slot in as moments in it — they OK them, as with any of your times — and the chat’s “Set your call time” turns done.',
      },
      {
        slug: 'post-an-update',
        title: 'Post an update for an event',
        body: 'Open the event in your Hub and tap Post an update at the top. Pick On site, Setup done, Ready to start, Packed up, Running late or Need help, add a note if you like, and tap Post. The couple sees it on their Home on the day; Running late and Need help also go to their coordinator as something to act on. What you posted shows under the button.',
      },
      {
        // 🧾 Make a quote in the chat (cut 7, 2026-11-14).
        slug: 'make-a-quote-in-chat',
        title: 'Make a quote from the chat',
        body: 'In a chat with no quote yet, tap ＋ and Make a quote. Pick your cards, check Your offer, and look at Good until — it is filled in for 14 days (or the event day, if that comes first) and you can change it. Add a note if you like and tap Send quote; it lands in the chat as your quote. For discounts, a payment schedule, travel or crew meals, tap Full quotation.',
      },
    ],
  },
  {
    key: 'couple-supplier-updates',
    label: 'Your suppliers on the day',
    roles: ['couple'],
    articles: [
      {
        // 📣 Supplier updates on the day (cut 6, 2026-11-14).
        slug: 'supplier-updates-on-the-day',
        title: 'See what your suppliers post on the day',
        body: 'On your event’s day, Home shows a From your suppliers card. Your booked suppliers post there when they arrive, finish setting up, are ready to start or have packed up, with a note if they add one. Running late and Need help also go to your coordinator.',
      },
    ],
  },
];
