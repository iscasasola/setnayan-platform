import type { FeaturePageEntry } from './types';

/**
 * For suppliers (1/2) — your page · chats and quotes · calendar and free dates.
 *
 * Written 2026-11-13 (truth sweep T4: "supplier feature pages are EMPTY; fill them from SHIPPED supplier features,
 * citing the code"). Every sentence is lifted from what the supplier app and /for-suppliers already do — the public
 * supplier page (`app/for-suppliers/_components/supplier-front-page.tsx`) is the shipped wording, and each entry's
 * `evidence` names the screen that makes it true. NO number is typed here: photo allowances, search reach and plan
 * caps live in `lib/vendor-tier-caps.ts` and are shown on /for-suppliers, read from code; prices are read from
 * `vendor_billing_catalog` by `price`.
 *
 * Deliberately NOT claimed (cannot be proven from code today): in-app voice or video calls (switched per thread by
 * `lib/thread-calls-gate.ts`), a video-call step in verification, any automatic renewal.
 */
export const SUPPLIERS_A_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'supplier-page',
    group: 'suppliers',
    icon: 'store',
    name: { en: 'Your supplier page', tl: 'Ang supplier page mo' },
    line: { en: 'A page that builds itself from what you add.', tl: 'Page na bumubuo sa sarili mula sa idinadagdag mo.' },
    title: { en: 'A Free Supplier Page for Your Event Business', tl: 'Libreng Supplier Page para sa Event Business Mo' },
    description: {
      en: 'Your services, prices, portfolio, reviews and badges on one Setnayan page that builds itself as you work. Free for every supplier.',
      tl: 'Ang services, presyo, portfolio, reviews at badges mo sa iisang Setnayan page na nabubuo habang nagtatrabaho ka. Libre sa bawat supplier.',
    },
    answer: {
      en: 'Every Setnayan supplier gets a public page: your service cards with their prices, your portfolio, your reviews and your badges, in one link. It builds itself from what you add in your shop, and it is free on every plan. Put the link on your posts, your booth and your table.',
      tl: 'Bawat supplier sa Setnayan ay may public page: ang service cards mo at ang presyo nila, portfolio, reviews at badges, sa iisang link. Nabubuo ito mula sa idinadagdag mo sa shop mo, at libre ito sa bawat plan. Ilagay ang link sa posts, booth at mesa mo.',
    },
    forWho: {
      en: 'Photographers, caterers, coordinators, stylists, bands and every other event supplier who wants one page that sells for them.',
      tl: 'Para sa photographer, caterer, coordinator, stylist, banda at bawat event supplier na gustong may iisang page na nagbebenta para sa kanila.',
    },
    steps: {
      en: ['Open your shop free and add your services, each as a card with its own price.', 'Add your portfolio photos; events you run here and couples’ shared photos add to it.', 'Share your page link or its QR code anywhere you meet clients.'],
      tl: ['Buksan ang shop mo nang libre at idagdag ang services mo, bawat isa ay card na may sariling presyo.', 'Idagdag ang portfolio photos mo; nadadagdagan ito ng mga event na ginagawa mo rito at ng photos na ibinabahagi ng couples.', 'Ibahagi ang link ng page mo o ang QR code nito kahit saan mo nakikilala ang kliyente.'],
    },
    different: {
      en: [
        'Your real business name is shown on every plan.',
        'Reviews carry a “Verified booking” mark, you can reply, and self-reviews are blocked.',
        'A couple can share one of their photos to your service card; it shows only after you approve it.',
        'Every event you finish here climbs a badge couples see on your page.',
      ],
      tl: [
        'Ipinapakita ang tunay na pangalan ng negosyo mo sa bawat plan.',
        'May markang “Verified booking” ang reviews, puwede kang sumagot, at bawal ang review sa sarili.',
        'Puwedeng ibahagi ng couple ang isa nilang photo sa service card mo; lalabas lang ito kapag in-approve mo.',
        'Bawat event na natapos mo rito ay nagpapaakyat ng badge na nakikita ng couples sa page mo.',
      ],
    },
    worksWith: [
      { slug: 'supplier-qr-codes', how: { en: 'Your “My page” QR opens this page.', tl: 'Binubuksan ng “My page” QR mo ang page na ito.' } },
      { slug: 'supplier-verified', how: { en: 'Once Verified, the page shows your Verified seal and appears in search.', tl: 'Kapag Verified na, may Verified seal ang page at lumalabas ito sa search.' } },
      { slug: 'marketplace', how: { en: 'Couples who find you in the Marketplace land on this page.', tl: 'Dito napupunta ang couples na nakahanap sa iyo sa Marketplace.' } },
    ],
    faq: {
      en: [
        { q: 'Is a Setnayan supplier page free?', a: 'Yes. Every supplier gets a public page on every plan, including Free.' },
        { q: 'What does my page show?', a: 'Your service cards and their prices, your portfolio, your reviews and your badges, with your real business name.' },
        { q: 'Can couples post photos to my page?', a: 'A couple can share one of their own photos to your service card. It appears only after you approve it.' },
        { q: 'Can I reply to reviews?', a: 'Yes. Each review carries a “Verified booking” mark, and you can reply to it.' },
      ],
      tl: [
        { q: 'Libre ba ang supplier page sa Setnayan?', a: 'Oo. Bawat supplier ay may public page sa bawat plan, kasama ang Free.' },
        { q: 'Ano ang makikita sa page ko?', a: 'Ang service cards mo at presyo nila, portfolio, reviews at badges, kasama ang tunay na pangalan ng negosyo mo.' },
        { q: 'Puwede bang mag-post ng photo ang couples sa page ko?', a: 'Puwedeng ibahagi ng couple ang isa nilang photo sa service card mo. Lalabas lang ito kapag in-approve mo.' },
        { q: 'Puwede ba akong sumagot sa reviews?', a: 'Oo. May markang “Verified booking” ang bawat review, at puwede kang sumagot.' },
      ],
    },
    keywords: {
      en: ['event supplier page', 'wedding supplier profile', 'supplier portfolio page', 'list my event business', 'Filipino event suppliers'],
      tl: ['supplier page', 'ilista ang event business', 'portfolio ng supplier'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/for-suppliers',
    evidence: [
      'app/v/[slug]/page.tsx',
      'app/vendor-dashboard/shop/page.tsx',
      'app/vendor-dashboard/reviews/page.tsx',
      'lib/couple-photo-share.ts',
      'lib/put-photo-on-my-page.ts',
      'app/for-suppliers/_components/supplier-front-page.tsx',
    ],
  },
  {
    slug: 'supplier-chat',
    group: 'suppliers',
    icon: 'inbox',
    name: { en: 'Chats and quotes', tl: 'Chats at quotes' },
    line: { en: 'One chat per client, with the quote and payments inside.', tl: 'Iisang chat bawat kliyente, kasama ang quote at bayad.' },
    title: { en: 'Supplier Inquiries, Quotes and Payments in One Chat', tl: 'Inquiries, Quotes at Bayad ng Supplier sa Iisang Chat' },
    description: {
      en: 'Each inquiry arrives with the date, place and headcount. Send a flat, per-guest or per-hour quote and confirm each payment in the same chat.',
      tl: 'Dumarating ang bawat inquiry kasama ang petsa, lugar at bilang ng bisita. Magpadala ng flat, per-guest o per-hour na quote at kumpirmahin ang bayad dito.',
    },
    answer: {
      en: 'Every client is one chat in your Setnayan inbox. An inquiry arrives with the event date, place and headcount attached. You send the quote from the chat — flat, per guest or per hour — and the couple accepts or counters. When they log a payment with its receipt, you confirm it there, and the chat keeps the record.',
      tl: 'Bawat kliyente ay iisang chat sa Setnayan inbox mo. Dumarating ang inquiry kasama ang petsa, lugar at bilang ng bisita. Ipapadala mo ang quote mula sa chat — flat, per guest o per hour — at tatanggapin o kokontrahin ito ng couple. Kapag nag-log sila ng bayad kasama ang resibo, kukumpirmahin mo ito roon, at nakatala ito sa chat.',
    },
    forWho: {
      en: 'Suppliers tired of quotes lost in group chats and payments nobody can find later.',
      tl: 'Para sa suppliers na pagod na sa quotes na nawawala sa group chat at sa bayad na hindi na mahanap.',
    },
    steps: {
      en: ['An inquiry arrives with the date, place and headcount. Nothing is booked yet.', 'Send a quote — flat, per guest or per hour, with line items and a payment schedule. The couple accepts or counters.', 'The couple logs each payment with its receipt; you confirm it and the record stays in the chat.'],
      tl: ['Dumarating ang inquiry kasama ang petsa, lugar at bilang ng bisita. Wala pang naka-book.', 'Magpadala ng quote — flat, per guest o per hour, may line items at payment schedule. Tatanggapin o kokontrahin ito ng couple.', 'Ila-log ng couple ang bawat bayad kasama ang resibo; kukumpirmahin mo ito at mananatili ang tala sa chat.'],
    },
    different: {
      en: [
        'Answering an inquiry is free on every plan — no per-lead fee.',
        'You see how many other couples are asking about the same date — a number, never who they are.',
        'A returning couple is marked as a returning client on their inquiry.',
      ],
      tl: [
        'Libre ang pagsagot sa inquiry sa bawat plan — walang per-lead fee.',
        'Makikita mo kung ilan pang couple ang nagtatanong sa parehong petsa — bilang lang, hindi kung sino sila.',
        'Minamarkahan bilang returning client ang couple na bumabalik sa inquiry nila.',
      ],
    },
    worksWith: [
      { slug: 'supplier-calendar', how: { en: 'A date asked from your calendar lands in the chat with the services attached.', tl: 'Napupunta sa chat ang petsang tinanong mula sa calendar mo, kasama ang services.' } },
      { slug: 'suppliers', how: { en: 'Once booked, you appear on the couple’s Suppliers page with your next payment.', tl: 'Kapag na-book, lalabas ka sa Suppliers page ng couple kasama ang susunod na bayad.' } },
    ],
    faq: {
      en: [
        { q: 'Do suppliers pay to answer inquiries?', a: 'No. Accepting and replying to an inquiry is free on every plan, with no per-lead fee.' },
        { q: 'What kinds of quotes can I send?', a: 'Flat, per guest or per hour, with line items, an optional discount with a reason, and a payment schedule.' },
        { q: 'How are payments recorded?', a: 'The couple logs a payment with its receipt in the chat, and you confirm it. Couples pay you directly; the money never passes through Setnayan.' },
        { q: 'Do I see the couple’s email?', a: 'No. You see the event’s display name and date in the chat.' },
      ],
      tl: [
        { q: 'Nagbabayad ba ang supplier para sumagot sa inquiry?', a: 'Hindi. Libre ang pagtanggap at pagsagot sa inquiry sa bawat plan, walang per-lead fee.' },
        { q: 'Anong klaseng quote ang puwede kong ipadala?', a: 'Flat, per guest o per hour, may line items, opsyonal na discount na may dahilan, at payment schedule.' },
        { q: 'Paano nakatala ang bayad?', a: 'Ila-log ng couple ang bayad kasama ang resibo sa chat, at kukumpirmahin mo ito. Direkta kang binabayaran ng couple; hindi dumadaan sa Setnayan ang pera.' },
        { q: 'Makikita ko ba ang email ng couple?', a: 'Hindi. Makikita mo sa chat ang display name at petsa ng event.' },
      ],
    },
    keywords: {
      en: ['supplier inquiry inbox', 'event quote builder', 'per pax quote', 'wedding supplier payments', 'booking chat'],
      tl: ['quote ng supplier', 'inquiry ng kliyente', 'bayad sa supplier'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/for-suppliers',
    evidence: [
      'app/vendor-dashboard/messages/page.tsx',
      'app/vendor-dashboard/messages/[threadId]/page.tsx',
      'lib/quote-from-service-card.ts',
      'app/_components/chat/cards/log-payment-card.tsx',
      'lib/vendor-date-demand.ts',
      'app/for-suppliers/_components/supplier-front-page.tsx',
    ],
  },
  {
    slug: 'supplier-calendar',
    group: 'suppliers',
    icon: 'calendar-check',
    name: { en: 'Calendar and free dates', tl: 'Calendar at bakanteng petsa' },
    line: { en: 'Couples check your free dates themselves.', tl: 'Sila na ang tumitingin ng bakante mong petsa.' },
    title: { en: 'Supplier Calendar: Let Couples Check Your Free Dates', tl: 'Calendar ng Supplier: Sila na ang Titingin ng Petsa Mo' },
    description: {
      en: 'Keep one calendar of your bookings and let couples see which dates are free — available or not bookable, never who booked. Free.',
      tl: 'Iisang calendar ng bookings mo, at makikita ng couples kung aling petsa ang bakante — available o hindi, hindi kung sino ang nag-book. Libre.',
    },
    answer: {
      en: 'Your Setnayan calendar holds your bookings and the days you block. Couples can check your dates themselves from your QR code, your page or your shop, and they see only two things: available, or not bookable — never who booked. They tap a day, and the question lands in your chat with the date and the services attached.',
      tl: 'Nasa Setnayan calendar mo ang bookings at ang mga araw na binlock mo. Puwedeng tingnan ng couples ang petsa mo mula sa QR code, page o shop mo, at dalawang bagay lang ang makikita nila: available, o hindi bookable — hindi kung sino ang nag-book. Pipili sila ng araw, at mapupunta ang tanong sa chat mo kasama ang petsa at services.',
    },
    forWho: {
      en: 'Suppliers who answer “are you free on…?” all day.',
      tl: 'Para sa suppliers na buong araw sumasagot ng “bakante ka ba sa…?”.',
    },
    steps: {
      en: ['Your bookings fill the calendar; block any day you are not taking work.', 'Share your “Check a date” QR or your page.', 'A couple taps a free day and the question arrives in your chat with the date attached.'],
      tl: ['Pinupuno ng bookings mo ang calendar; i-block ang araw na hindi ka tumatanggap.', 'Ibahagi ang “Check a date” QR o ang page mo.', 'Pipili ang couple ng bakanteng araw at darating ang tanong sa chat mo kasama ang petsa.'],
    },
    different: {
      en: [
        'Couples see available or not bookable — never who booked a date.',
        'How many bookings a day each service card can take, and the waiting list per date, follow your plan.',
        'Checking dates is free for couples and free for you.',
      ],
      tl: [
        'Available o hindi bookable lang ang nakikita ng couples — hindi kung sino ang nag-book.',
        'Sumusunod sa plan mo kung ilang booking sa isang araw ang kaya ng bawat service card, at ang waiting list bawat petsa.',
        'Libre ang pagtingin ng petsa para sa couples at para sa iyo.',
      ],
    },
    worksWith: [
      { slug: 'supplier-chat', how: { en: 'A date question opens in the client’s chat.', tl: 'Bumubukas sa chat ng kliyente ang tanong sa petsa.' } },
      { slug: 'supplier-qr-codes', how: { en: 'The “Check a date” QR opens your free dates.', tl: 'Binubuksan ng “Check a date” QR ang bakante mong petsa.' } },
      { slug: 'date-picker', how: { en: 'Couples choosing a date see which of their shortlisted suppliers are free.', tl: 'Nakikita ng couples na pumipili ng petsa kung sino sa shortlist nila ang bakante.' } },
    ],
    faq: {
      en: [
        { q: 'Can couples see who booked me on a date?', a: 'No. They see only available or not bookable.' },
        { q: 'How do couples check my dates?', a: 'From your “Check a date” QR code, your page or your shop.' },
        { q: 'Can I take more than one booking a day?', a: 'Yes, up to your plan’s bookings a day per service card. The plan table on For Suppliers lists each plan’s number.' },
      ],
      tl: [
        { q: 'Makikita ba ng couples kung sino ang nag-book sa akin sa isang petsa?', a: 'Hindi. Available o hindi bookable lang ang makikita nila.' },
        { q: 'Paano titingnan ng couples ang petsa ko?', a: 'Mula sa “Check a date” QR code, page o shop mo.' },
        { q: 'Puwede ba akong tumanggap ng higit sa isang booking sa isang araw?', a: 'Oo, hanggang sa bookings a day per service card ng plan mo. Nakalista sa plan table ng For Suppliers ang bilang ng bawat plan.' },
      ],
    },
    keywords: {
      en: ['supplier availability calendar', 'check supplier dates', 'event booking calendar', 'wedding supplier availability'],
      tl: ['bakanteng petsa ng supplier', 'calendar ng booking'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/for-suppliers',
    evidence: [
      'app/vendor-dashboard/calendar/page.tsx',
      'app/vendor-dashboard/invite/date-status-actions.ts',
      'lib/supplier-qr-codes.ts',
      'lib/vendor-tier-caps.ts',
      'app/for-suppliers/_components/supplier-front-client.tsx',
    ],
  },
];
