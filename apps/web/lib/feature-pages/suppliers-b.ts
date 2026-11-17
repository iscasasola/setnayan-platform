import type { FeaturePageEntry } from './types';

/**
 * For suppliers (2/2) — QR codes · getting Verified · supplier plans.
 *
 * Written 2026-11-13 (truth sweep T4), from shipped code only — see the note in `./suppliers-a.ts`. Plan NAMES are the
 * ones `TIER_LABEL` (lib/vendor-tier-caps.ts) shows; plan PRICES are never typed — `price` reads the three monthly
 * rows of `vendor_billing_catalog`. The booking-fee rate is never written here either: it is admin-edited
 * (`platform_settings`) and shown live on /for-suppliers. The launch offer is not named on this static page because
 * it is open only while `launchOfferIsOpen` says so; /llms.txt names it while it runs.
 */
export const SUPPLIERS_B_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'supplier-qr-codes',
    group: 'suppliers',
    icon: 'checkin',
    name: { en: 'Supplier QR codes', tl: 'QR codes ng supplier' },
    line: { en: 'One QR for every moment — pick the moment, not the code.', tl: 'Isang QR sa bawat sandali — piliin ang sandali, hindi ang code.' },
    title: { en: 'QR Codes for Event Suppliers: Leads, Dates and Reviews', tl: 'QR Codes ng Supplier: Leads, Petsa at Reviews' },
    description: {
      en: 'Free QR codes for your card, booth and table: a shortlist code, a date checker, your page, reviews, a one-use booking code and a crew code.',
      tl: 'Libreng QR codes para sa card, booth at mesa mo: shortlist, pagtingin ng petsa, page mo, reviews, isang-gamit na booking code at crew code.',
    },
    answer: {
      en: 'Setnayan gives every supplier a set of free QR codes, each for one moment. Shortlist puts you on a new couple’s event when they sign up. Check a date shows your free days. My page opens your page, and Reviews asks guests for a review at the table. Booked is a one-use code for one client, and Crew lets your own crew join an event.',
      tl: 'Binibigyan ng Setnayan ang bawat supplier ng libreng QR codes, bawat isa para sa isang sandali. Inilalagay ka ng Shortlist sa event ng bagong couple pag nag-sign up sila. Ipinapakita ng Check a date ang bakante mong araw. Binubuksan ng My page ang page mo, at humihingi ng review ang Reviews sa mesa. Ang Booked ay isang-gamit na code para sa isang kliyente, at pinapasali ng Crew ang team mo sa event.',
    },
    forWho: {
      en: 'Suppliers who meet clients at bazaars, expos, their studio and on the event day.',
      tl: 'Para sa suppliers na nakakakilala ng kliyente sa bazaar, expo, studio at sa mismong araw ng event.',
    },
    steps: {
      en: ['Pick the moment: find, book, check a date, review or crew.', 'Download, share or copy the code as a link from your QR codes screen.', 'Print it on your card, standee, backdrop or table tent, or show it on your phone.'],
      tl: ['Piliin ang sandali: hanapin, i-book, tingnan ang petsa, review o crew.', 'I-download, ibahagi o kopyahin bilang link ang code mula sa QR codes screen mo.', 'I-print sa card, standee, backdrop o table tent mo, o ipakita sa phone mo.'],
    },
    different: {
      en: [
        'A couple who comes through your one-use Booked code is your own client, and never carries a booking fee.',
        'The Booked code creates the client’s event with you already booked on it, and works once.',
        'Your crew joins an event only after you tap Allow, and the code ends when the event ends.',
        'Every code is free on every plan.',
      ],
      tl: [
        'Ang couple na dumaan sa isang-gamit na Booked code mo ay sarili mong kliyente, at hindi kailanman may booking fee.',
        'Ginagawa ng Booked code ang event ng kliyente na naka-book ka na, at isang beses lang gumagana.',
        'Makakasali lang ang crew mo sa event kapag pinindot mo ang Allow, at natatapos ang code pag tapos na ang event.',
        'Libre ang bawat code sa bawat plan.',
      ],
    },
    worksWith: [
      { slug: 'supplier-calendar', how: { en: 'Check a date opens your free days.', tl: 'Binubuksan ng Check a date ang bakante mong araw.' } },
      { slug: 'supplier-page', how: { en: 'My page opens your supplier page.', tl: 'Binubuksan ng My page ang supplier page mo.' } },
      { slug: 'supplier-plans', how: { en: 'Clients you bring with your own codes stay free of the booking fee on every plan.', tl: 'Walang booking fee ang kliyenteng dala mo gamit ang sarili mong code, sa bawat plan.' } },
    ],
    faq: {
      en: [
        { q: 'Are supplier QR codes free?', a: 'Yes. Every code is free on every plan.' },
        { q: 'Does a client from my own QR code pay a booking fee?', a: 'No. A couple you bring through your own invite, your Booked code or your own link is your own client, and the booking fee never applies.' },
        { q: 'Where do I find my codes?', a: 'Shortlist, Check a date, My page and Reviews are in Shop › Promote. Booked and Crew are in Customers › QR codes.' },
      ],
      tl: [
        { q: 'Libre ba ang QR codes ng supplier?', a: 'Oo. Libre ang bawat code sa bawat plan.' },
        { q: 'May booking fee ba ang kliyenteng galing sa sarili kong QR code?', a: 'Wala. Ang couple na dala mo sa sarili mong invite, Booked code o link ay sarili mong kliyente, at hindi kailanman may booking fee.' },
        { q: 'Saan ko makikita ang mga code ko?', a: 'Nasa Shop › Promote ang Shortlist, Check a date, My page at Reviews. Nasa Customers › QR codes ang Booked at Crew.' },
      ],
    },
    keywords: {
      en: ['supplier QR code', 'QR code for events business', 'booking QR code', 'review QR code', 'event supplier marketing'],
      tl: ['QR code ng supplier', 'QR para sa review'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/for-suppliers',
    evidence: [
      'lib/supplier-qr-codes.ts',
      'app/vendor-dashboard/shop/promote/page.tsx',
      'app/vendor-dashboard/invite/page.tsx',
      'app/vendor-dashboard/locked-qr/page.tsx',
      'lib/booking-fee-gate.ts',
    ],
  },
  {
    slug: 'supplier-verified',
    group: 'suppliers',
    icon: 'verified',
    name: { en: 'Get Verified', tl: 'Magpa-Verified' },
    line: { en: 'Free, for good — and couples find you in search.', tl: 'Libre, habambuhay — at mahahanap ka sa search.' },
    title: { en: 'Get Verified as an Event Supplier, Free', tl: 'Magpa-Verified bilang Event Supplier, Libre' },
    description: {
      en: 'Send three papers: DTI or SEC, BIR 2303 and your Mayor’s or Business Permit. A Setnayan admin checks them, and Verified puts your shop in search. Free.',
      tl: 'Ipadala ang tatlong papeles: DTI o SEC, BIR 2303 at Mayor’s o Business Permit. Susuriin ng Setnayan admin, at ilalagay ng Verified ang shop mo sa search. Libre.',
    },
    answer: {
      en: 'Verified is free, for good. You send your business papers — DTI or SEC registration, BIR 2303 and a Mayor’s or Business Permit — and prove your email is yours. A Setnayan admin reviews them and contacts you for a final confirmation. A Verified shop shows the Verified seal and appears in search around you.',
      tl: 'Libre ang Verified, habambuhay. Ipapadala mo ang papeles ng negosyo — DTI o SEC registration, BIR 2303 at Mayor’s o Business Permit — at patutunayan mong iyo ang email mo. Susuriin ito ng Setnayan admin at kokontakin ka para sa huling kumpirmasyon. May Verified seal ang Verified na shop at lumalabas ito sa search sa paligid mo.',
    },
    forWho: {
      en: 'Every supplier who wants couples to trust them, and to be found in Setnayan search.',
      tl: 'Para sa bawat supplier na gustong pagkatiwalaan ng couples at mahanap sa Setnayan search.',
    },
    steps: {
      en: ['Finish your business details in your shop.', 'Send your papers and prove your email.', 'A Setnayan admin reviews them and contacts you for your final confirmation.'],
      tl: ['Kumpletuhin ang detalye ng negosyo sa shop mo.', 'Ipadala ang papeles at patunayan ang email mo.', 'Susuriin ito ng Setnayan admin at kokontakin ka para sa huling kumpirmasyon.'],
    },
    different: {
      en: [
        'Verification costs nothing, now or later.',
        'A Verified shop appears in Marketplace search around you, as far as your plan reaches.',
        'Your registration number ties the shop to one registered business.',
      ],
      tl: [
        'Walang bayad ang verification, ngayon o mamaya.',
        'Lumalabas sa Marketplace search ang Verified na shop sa paligid mo, hanggang sa abot ng plan mo.',
        'Itinatali ng registration number ang shop sa iisang rehistradong negosyo.',
      ],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Verified shops are the ones couples find in the Marketplace.', tl: 'Ang Verified na shops ang nahahanap ng couples sa Marketplace.' } },
      { slug: 'supplier-plans', how: { en: 'Verified is free; Supplier Plus, Supplier Pro and Supplier Ultra add reach on top.', tl: 'Libre ang Verified; nagdadagdag ng abot ang Supplier Plus, Supplier Pro at Supplier Ultra.' } },
      { slug: 'supplier-page', how: { en: 'Your page shows the Verified seal.', tl: 'May Verified seal ang page mo.' } },
    ],
    faq: {
      en: [
        { q: 'How much does it cost to get Verified?', a: 'Nothing. Verified is free, for good.' },
        { q: 'What papers do I need?', a: 'Three: DTI or SEC registration, BIR 2303, and a Mayor’s or Business Permit.' },
        { q: 'What does Verified give me?', a: 'The Verified seal on your page, and a place in Marketplace search around you, as far as your plan reaches.' },
      ],
      tl: [
        { q: 'Magkano ang magpa-Verified?', a: 'Wala. Libre ang Verified, habambuhay.' },
        { q: 'Anong papeles ang kailangan?', a: 'Tatlo: DTI o SEC registration, BIR 2303, at Mayor’s o Business Permit.' },
        { q: 'Ano ang makukuha ko sa Verified?', a: 'Ang Verified seal sa page mo, at puwesto sa Marketplace search sa paligid mo, hanggang sa abot ng plan mo.' },
      ],
    },
    keywords: {
      en: ['verified event supplier', 'supplier verification Philippines', 'DTI BIR 2303 supplier', 'get verified supplier'],
      tl: ['verified na supplier', 'magpa-verify ng negosyo'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/for-suppliers',
    evidence: [
      'app/vendor-dashboard/shop/_components/verify-section.tsx',
      'app/vendor-dashboard/shop/_components/paper-upload-place.tsx',
      'app/vendor-dashboard/verify/page.tsx',
      'lib/vendor-tier-caps.ts',
    ],
  },
  {
    slug: 'supplier-plans',
    group: 'suppliers',
    icon: 'subscription',
    name: { en: 'Supplier plans', tl: 'Supplier plans' },
    line: { en: 'Free, Verified, then Supplier Plus, Pro and Ultra for more reach.', tl: 'Free, Verified, tapos Supplier Plus, Pro at Ultra para sa mas malawak na abot.' },
    title: { en: 'Supplier Plans: Free, Verified, Plus, Pro and Ultra', tl: 'Supplier Plans: Free, Verified, Plus, Pro at Ultra' },
    description: {
      en: 'Run your bookings free. Supplier Plus, Supplier Pro and Supplier Ultra add reach, categories, team seats and branches. Nothing renews by itself.',
      tl: 'Libre ang pagpapatakbo ng bookings. Nagdadagdag ng abot, categories, team seats at branches ang Supplier Plus, Pro at Ultra. Walang kusang nagre-renew.',
    },
    answer: {
      en: 'Setnayan has five supplier plans: Free, Verified, Supplier Plus, Supplier Pro and Supplier Ultra. Free and Verified cost nothing, for good, and include the full dashboard. The paid plans buy reach — service area, categories, service cards, team seats and branches — never the right to take bookings. Paid plans are prepaid blocks of four weeks or a year, and nothing renews by itself.',
      tl: 'Lima ang supplier plans ng Setnayan: Free, Verified, Supplier Plus, Supplier Pro at Supplier Ultra. Libre ang Free at Verified, habambuhay, at kasama ang buong dashboard. Abot ang binibili ng paid plans — service area, categories, service cards, team seats at branches — hindi ang karapatang tumanggap ng booking. Prepaid ang paid plans, apat na linggo o isang taon, at walang kusang nagre-renew.',
    },
    forWho: {
      en: 'Suppliers deciding how far they want to be found, and how big a team they run.',
      tl: 'Para sa suppliers na nagpapasya kung gaano kalayo sila gustong mahanap, at gaano kalaki ang team nila.',
    },
    steps: {
      en: ['Start on Free the moment you open your shop.', 'Get Verified, free, to appear in search.', 'Move up to Supplier Plus, Supplier Pro or Supplier Ultra when you need more reach, categories or seats.'],
      tl: ['Magsimula sa Free pagbukas mo ng shop.', 'Magpa-Verified, libre, para lumabas sa search.', 'Umakyat sa Supplier Plus, Supplier Pro o Supplier Ultra kapag kailangan mo ng mas malawak na abot, categories o seats.'],
    },
    different: {
      en: [
        'Couples pay you directly to your GCash or bank; Setnayan never takes a cut of the deal.',
        'The booking fee applies only to couples Setnayan brings you, and your first booking from Setnayan is on us.',
        'Your own clients — the ones you bring or import — never carry a fee.',
        'Nothing renews by itself: skip a payment and you are back on Free.',
      ],
      tl: [
        'Direkta kang binabayaran ng couples sa GCash o bank mo; hindi kumukuha ang Setnayan ng parte sa deal.',
        'Sa couples lang na dinala ng Setnayan may booking fee, at libre ang una mong booking mula sa Setnayan.',
        'Ang sarili mong kliyente — dala mo o in-import mo — ay hindi kailanman may fee.',
        'Walang kusang nagre-renew: lumaktaw ng bayad at babalik ka sa Free.',
      ],
    },
    worksWith: [
      { slug: 'supplier-verified', how: { en: 'Verified is the free step that puts you in search.', tl: 'Ang Verified ang libreng hakbang na naglalagay sa iyo sa search.' } },
      { slug: 'supplier-qr-codes', how: { en: 'Clients you bring with your own codes stay free of the fee.', tl: 'Walang fee ang kliyenteng dala mo gamit ang sarili mong code.' } },
      { slug: 'supplier-calendar', how: { en: 'Your plan sets bookings a day per service card and the waiting list per date.', tl: 'Itinatakda ng plan mo ang bookings sa isang araw bawat service card at ang waiting list bawat petsa.' } },
    ],
    faq: {
      en: [
        { q: 'Is Setnayan free for suppliers?', a: 'Yes. Free and Verified cost nothing, for good, and include the full dashboard: calendar, inquiries, quotes, bookings, payments on record, contracts and your public page.' },
        { q: 'Does Setnayan take a commission?', a: 'Setnayan never takes a cut of the deal. It bills a booking fee only on couples it brings you; your first booking from Setnayan is on us, and your own clients never carry a fee. The current rate is on the For Suppliers page.' },
        { q: 'Do paid plans renew automatically?', a: 'No. Supplier Plus, Supplier Pro and Supplier Ultra are prepaid blocks of four weeks or a year. Skip the next payment and you are on Free.' },
        { q: 'What do the paid plans add?', a: 'Reach: a wider service area, more categories and service cards, team seats and branches, and your own web address.' },
      ],
      tl: [
        { q: 'Libre ba ang Setnayan para sa suppliers?', a: 'Oo. Libre ang Free at Verified, habambuhay, at kasama ang buong dashboard: calendar, inquiries, quotes, bookings, tala ng bayad, contracts at public page mo.' },
        { q: 'Kumukuha ba ng commission ang Setnayan?', a: 'Hindi kumukuha ang Setnayan ng parte sa deal. May booking fee lang sa couples na dinala nito sa iyo; libre ang una mong booking mula sa Setnayan, at walang fee ang sarili mong kliyente. Nasa For Suppliers page ang kasalukuyang rate.' },
        { q: 'Kusa bang nagre-renew ang paid plans?', a: 'Hindi. Prepaid ang Supplier Plus, Supplier Pro at Supplier Ultra, apat na linggo o isang taon. Lumaktaw ng susunod na bayad at nasa Free ka na.' },
        { q: 'Ano ang idinadagdag ng paid plans?', a: 'Abot: mas malawak na service area, mas maraming categories at service cards, team seats at branches, at sariling web address.' },
      ],
    },
    keywords: {
      en: ['supplier plans', 'event supplier subscription', 'wedding supplier pricing', 'booking fee for suppliers', 'Supplier Pro'],
      tl: ['presyo ng supplier plan', 'booking fee ng supplier'],
    },
    shots: [],
    price: {
      kind: 'free-plus',
      catalogue: 'supplier',
      codes: ['solo_vendor_monthly', 'pro_vendor_monthly', 'enterprise_vendor_monthly'],
    },
    moreHref: '/for-suppliers',
    evidence: [
      'lib/vendor-tier-caps.ts',
      'lib/vendor-plan-rows.ts',
      'app/vendor-dashboard/subscription/page.tsx',
      'lib/booking-fee-gate.ts',
      'lib/booking-fee-lock.ts',
      'lib/commission-promise.ts',
    ],
  },
];
