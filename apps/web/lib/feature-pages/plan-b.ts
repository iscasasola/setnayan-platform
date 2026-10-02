import type { FeaturePageEntry } from './types';

/** Plan it (2/2) — mood board · marketplace · compare · Setnayan AI. */
export const PLAN_B_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'mood-board',
    group: 'plan',
    icon: 'mood-board',
    name: { en: 'Mood Board', tl: 'Mood Board' },
    line: { en: 'Pick your colors once — every piece dresses to match.', tl: 'Piliin ang kulay nang isang beses — susunod ang lahat.' },
    title: { en: 'Free Event Mood Board and Color Palette', tl: 'Libreng Mood Board at Color Palette' },
    description: {
      en: 'Pick your event colors once, set a dress code per role, and share one board with suppliers. Everything Setnayan makes matches. Free.',
      tl: 'Piliin ang kulay ng event nang isang beses, magtakda ng dress code kada role, at ibahagi ang iisang board sa suppliers. Libre.',
    },
    answer: {
      en: 'Setnayan Mood Board is where your event decides how it looks. You pick your colors, gather the rooms and details you love, and set a dress code for each role. It is free, and one board gives suppliers a single answer to “what is your motif?”.',
      tl: 'Ang Setnayan Mood Board ang lugar kung saan nagpapasya ang event mo kung ano ang itsura nito. Pipili ka ng kulay, mag-iipon ng mga kuwarto at detalyeng gusto mo, at magtatakda ng dress code kada role. Libre ito, at iisang board ang sagot sa “ano ang motif n’yo?”.',
    },
    forWho: {
      en: 'Hosts who want a clear look for the day without being a designer, and who are tired of explaining it to every supplier.',
      tl: 'Para sa mga host na gusto ng malinaw na itsura ng araw kahit hindi designer, at pagod nang ipaliwanag ito sa bawat supplier.',
    },
    steps: {
      en: ['Start from a curated theme or build your own palette, with a dress code per role.', 'Gather the rooms, flowers and details you love, including the reception ceiling, backdrop and stage.', 'Everything else dresses to match, and booked suppliers read the same board.'],
      tl: ['Magsimula sa curated na theme o buuin ang sariling palette, may dress code kada role.', 'Mag-ipon ng mga kuwarto, bulaklak at detalyeng gusto mo, kasama ang kisame, backdrop at stage ng reception.', 'Susunod ang lahat ng iba pa, at iisang board ang binabasa ng na-book na suppliers.'],
    },
    different: {
      en: ['Your save-the-date, Event Hub, monogram and QR codes dress to match.', 'People in your 3D Plan wear the colors you set for their role.', 'Booked suppliers open a read-only copy, and there is a one-page printable for everyone else.', 'Nothing is locked. Change your mind and everything picks up the change.'],
      tl: ['Susunod ang save-the-date, Event Hub, monogram at QR codes mo.', 'Ang mga tao sa 3D Plan ay suot ang kulay na itinakda mo para sa role nila.', 'Makakabukas ng read-only na kopya ang na-book na supplier, at may one-page printable para sa iba.', 'Walang naka-lock. Magbago ng isip at susunod ang lahat.'],
    },
    worksWith: [
      { slug: '3d-plan', how: { en: 'People in the 3D room wear the role colors you set.', tl: 'Ang mga tao sa 3D room ay suot ang role colors na itinakda mo.' } },
      { slug: 'event-hub', how: { en: 'Your Event Hub dresses in your palette.', tl: 'Nagsusuot ng palette mo ang Event Hub.' } },
      { slug: 'logo-maker', how: { en: 'Your monogram is drawn in your colors.', tl: 'Iginuguhit ang monogram mo sa mga kulay mo.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free mood board maker for events?', a: 'Yes. Setnayan Mood Board is included with every account. Nothing to buy and nothing that expires.' },
        { q: 'Do I need design skills?', a: 'No. Start from a curated theme and it fills your palette. Change anything you do not like.' },
        { q: 'Where do my colors show up?', a: 'On what Setnayan makes for you: your save-the-date, Event Hub, monogram and QR codes, and the people in your 3D Plan.' },
        { q: 'Can my suppliers see it?', a: 'Suppliers you booked through Setnayan can open a read-only copy, and there is a one-page printable for anyone else.' },
      ],
      tl: [
        { q: 'May libreng mood board maker ba para sa event?', a: 'Meron. Kasama ang Setnayan Mood Board sa bawat account. Walang bibilhin at walang expiry.' },
        { q: 'Kailangan ba ng design skills?', a: 'Hindi. Magsimula sa curated na theme at mapupuno ang palette mo. Palitan ang ayaw mo.' },
        { q: 'Saan lumalabas ang mga kulay ko?', a: 'Sa mga ginagawa ng Setnayan para sa iyo: save-the-date, Event Hub, monogram at QR codes, at mga tao sa 3D Plan.' },
        { q: 'Makikita ba ito ng mga supplier ko?', a: 'Ang mga supplier na na-book mo sa Setnayan ay makakabukas ng read-only na kopya, at may one-page printable para sa iba.' },
      ],
    },
    keywords: {
      en: ['event mood board', 'wedding color palette', 'motif and colors', 'dress code per role', 'free mood board maker'],
      tl: ['mood board ng event', 'kulay at motif', 'libreng mood board'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/mood-board',
    evidence: ['app/(shell)/mood-board/page.tsx', 'lib/mood-board.ts', 'lib/moodboard-printable.ts'],
  },
  {
    slug: 'marketplace',
    group: 'plan',
    icon: 'suite',
    name: { en: 'Marketplace', tl: 'Marketplace' },
    line: { en: 'Browse verified Filipino suppliers free, and compare two.', tl: 'Mag-browse ng verified na Pinoy suppliers nang libre, at ikumpara ang dalawa.' },
    title: { en: 'Find Verified Filipino Event Suppliers', tl: 'Maghanap ng Verified na Pinoy Suppliers' },
    description: {
      en: 'Search verified Filipino suppliers — photographers, caterers, coordinators and more — by category and city. Browsing is free.',
      tl: 'Maghanap ng verified na Pinoy suppliers — photographer, caterer, coordinator at iba pa — ayon sa category at lungsod. Libre ang pag-browse.',
    },
    answer: {
      en: 'The Setnayan Marketplace is where you find suppliers for your event. Search verified Filipino photographers, videographers, caterers, coordinators, hair and makeup and more, by category and city. Browsing is free and open to anyone.',
      tl: 'Ang Setnayan Marketplace ang lugar kung saan ka maghahanap ng suppliers para sa event mo. Maghanap ng verified na Pinoy photographer, videographer, caterer, coordinator, hair at makeup at iba pa, ayon sa category at lungsod. Libre at bukas sa lahat ang pag-browse.',
    },
    forWho: {
      en: 'Anyone hiring suppliers for a wedding, debut, birthday or other celebration, who wants to know the business is real.',
      tl: 'Para sa sinumang kumukuha ng suppliers para sa kasal, debut, birthday o ibang handaan na gustong matiyak na totoo ang negosyo.',
    },
    steps: {
      en: ['Type what you need or open a category and browse by city.', 'Save the ones you like. Once you have an event, see a preview of how well each fits it.', 'Put two side by side, choose, and message them. They move into your event’s supplier ledger.'],
      tl: ['I-type ang kailangan mo o buksan ang category at mag-browse ayon sa lungsod.', 'I-save ang mga gusto mo. Kapag may event ka na, makikita ang preview kung gaano sila kabagay.', 'Ilagay ang dalawa nang magkatabi, pumili, at i-message sila. Mapupunta sila sa supplier ledger ng event mo.'],
    },
    different: {
      en: ['Every supplier passed a business-legitimacy check and a short video call with a Setnayan admin.', 'Real business names are shown from the first day.', 'You can message a supplier free. They see your event’s display name and date, never your email.', 'The fit preview never hides anyone.'],
      tl: ['Bawat supplier ay pumasa sa business-legitimacy check at maikling video call sa isang Setnayan admin.', 'Ipinapakita ang tunay na pangalan ng negosyo mula unang araw.', 'Libre kang makapag-message sa supplier. Makikita nila ang display name at petsa ng event mo, hindi ang email mo.', 'Hindi nagtatago ng kahit sino ang fit preview.'],
    },
    worksWith: [
      { slug: 'compare', how: { en: 'Open any two saved suppliers in one view.', tl: 'Buksan ang kahit dalawang na-save na supplier sa isang view.' } },
      { slug: 'budget', how: { en: 'Book a supplier and their lines land in your budget.', tl: 'Mag-book ng supplier at mapupunta ang lines nila sa budget mo.' } },
      { slug: 'setnayan-ai', how: { en: 'Setnayan AI ranks suppliers by fit for your event.', tl: 'Nire-rank ng Setnayan AI ang suppliers ayon sa bagay sa event mo.' } },
    ],
    faq: {
      en: [
        { q: 'How do I find verified suppliers in the Philippines?', a: 'Search the Setnayan Marketplace or browse a category and city. Every supplier completed a legitimacy check and a video call with an admin.' },
        { q: 'Is the Marketplace free?', a: 'Browsing is free and open to anyone. Saving and comparing are tied to your event, which is free to start.' },
        { q: 'What does verified mean?', a: 'A business-legitimacy check and a short video call with a Setnayan admin. Their real business name is shown.' },
        { q: 'Does Setnayan take my payment to the supplier?', a: 'No. You pay the supplier directly; Setnayan never touches that money.' },
      ],
      tl: [
        { q: 'Paano makahanap ng verified na supplier sa Pilipinas?', a: 'Maghanap sa Setnayan Marketplace o mag-browse ng category at lungsod. Bawat supplier ay pumasa sa legitimacy check at video call sa admin.' },
        { q: 'Libre ba ang Marketplace?', a: 'Libre at bukas sa lahat ang pag-browse. Ang pag-save at pagkumpara ay nakatali sa event mo, na libreng simulan.' },
        { q: 'Ano ang ibig sabihin ng verified?', a: 'Business-legitimacy check at maikling video call sa isang Setnayan admin. Ipinapakita ang tunay na pangalan ng negosyo.' },
        { q: 'Kinukuha ba ng Setnayan ang bayad ko sa supplier?', a: 'Hindi. Direkta kang magbabayad sa supplier; hindi ginagalaw ng Setnayan ang perang iyon.' },
      ],
    },
    keywords: {
      en: ['verified wedding suppliers Philippines', 'find photographer Philippines', 'event suppliers directory', 'caterer near me'],
      tl: ['verified na supplier', 'hanap photographer', 'suppliers ng event'],
    },
    shots: [],
    price: { kind: 'free' },
    tryHref: '/explore',
    moreHref: '/marketplace',
    evidence: ['app/(shell)/marketplace/page.tsx', 'app/(shell)/explore/page.tsx', 'lib/marketplace-service-cards.ts'],
  },
  {
    slug: 'compare',
    group: 'plan',
    icon: 'suite',
    name: { en: 'Compare', tl: 'Compare' },
    line: { en: 'Put two suppliers side by side, then decide.', tl: 'Ilagay ang dalawang supplier nang magkatabi, tapos magpasya.' },
    title: { en: 'Compare Two Event Suppliers Side by Side', tl: 'Ikumpara ang Dalawang Supplier' },
    description: {
      en: 'Compare two saved suppliers side by side: location, rating, services, faith fit and distance from your venue. Free.',
      tl: 'Ikumpara ang dalawang na-save na supplier: lokasyon, rating, serbisyo, faith fit at layo sa venue mo. Libre.',
    },
    answer: {
      en: 'Setnayan Compare lays two saved suppliers side by side: location, rating, services, faith fit, and distance from your reception venue if you have set one. It is two at a time on purpose, so you reach a decision.',
      tl: 'Inilalagay ng Setnayan Compare nang magkatabi ang dalawang na-save na supplier: lokasyon, rating, serbisyo, faith fit, at layo sa reception venue mo kung na-set mo na. Dalawa lang sa isang beses para makapagpasya ka.',
    },
    forWho: {
      en: 'Hosts down to two photographers, two caterers or two venues who need to choose.',
      tl: 'Para sa mga host na dalawa na lang ang pinagpipilian, photographer man, caterer o venue.',
    },
    steps: {
      en: ['Save two suppliers from the Marketplace.', 'Open the comparison to see them side by side.', 'Choose one and message them.'],
      tl: ['I-save ang dalawang supplier mula sa Marketplace.', 'Buksan ang comparison para makita silang magkatabi.', 'Pumili ng isa at i-message siya.'],
    },
    different: {
      en: ['It is an A-or-B view, not a wide table that leads to more browsing.', 'Distance is measured from your reception venue when you have set one.', 'Faith fit is shown beside rating and services.'],
      tl: ['A-o-B na view ito, hindi malawak na table na magdadala sa mas maraming pag-browse.', 'Sinusukat ang layo mula sa reception venue mo kapag na-set mo na ito.', 'Ipinapakita ang faith fit katabi ng rating at serbisyo.'],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Compare the suppliers you saved while browsing.', tl: 'Ikumpara ang mga supplier na na-save mo habang nagba-browse.' } },
      { slug: 'budget', how: { en: 'The one you pick moves into your budget when booked.', tl: 'Ang pipiliin mo ay mapupunta sa budget mo kapag na-book.' } },
    ],
    faq: {
      en: [
        { q: 'How do I compare two suppliers?', a: 'Save two suppliers from the Marketplace, then open the comparison. Location, rating, services and faith fit appear side by side.' },
        { q: 'Why only two at a time?', a: 'An A-or-B view leads to a decision. A wide table leads to more browsing.' },
        { q: 'Does it use my venue?', a: 'If you set a reception venue, the comparison shows each supplier’s distance from it.' },
      ],
      tl: [
        { q: 'Paano ko ikukumpara ang dalawang supplier?', a: 'I-save ang dalawang supplier mula sa Marketplace, tapos buksan ang comparison. Magkatabing lalabas ang lokasyon, rating, serbisyo at faith fit.' },
        { q: 'Bakit dalawa lang sa isang beses?', a: 'Ang A-o-B na view ay humahantong sa desisyon. Ang malawak na table ay humahantong sa mas maraming pag-browse.' },
        { q: 'Ginagamit ba nito ang venue ko?', a: 'Kung nag-set ka ng reception venue, ipinapakita ng comparison ang layo ng bawat supplier mula rito.' },
      ],
    },
    keywords: {
      en: ['compare wedding suppliers', 'compare photographers', 'supplier comparison'],
      tl: ['ikumpara ang supplier', 'compare photographer'],
    },
    shots: [],
    price: { kind: 'free' },
    tryHref: '/explore/compare',
    evidence: ['app/(shell)/explore/compare/page.tsx', 'lib/compare-anchored-date.ts'],
  },
  {
    slug: 'setnayan-ai',
    group: 'plan',
    icon: 'ai',
    name: { en: 'Setnayan AI', tl: 'Setnayan AI' },
    line: { en: 'Finds your best-fit suppliers, then watches your plan.', tl: 'Hinahanap ang bagay na suppliers, tapos binabantayan ang plano.' },
    title: { en: 'Setnayan AI Event Planner', tl: 'Setnayan AI: Event Planner na Nagbabantay' },
    description: {
      en: 'Setnayan AI ranks verified suppliers by fit, then watches your prices, dates and deadlines and taps you only when something needs you.',
      tl: 'Nire-rank ng Setnayan AI ang verified na suppliers ayon sa bagay, tapos binabantayan ang presyo, petsa at deadlines at kakatok lang kapag kailangan.',
    },
    answer: {
      en: 'Setnayan AI is a paid planner, not a chatbot. It ranks verified suppliers by how well they fit your event, then watches your suppliers, budget and deadlines in the background and taps you only when something needs you.',
      tl: 'Ang Setnayan AI ay bayad na planner, hindi chatbot. Nire-rank nito ang verified na suppliers ayon sa bagay sa event mo, tapos binabantayan ang suppliers, budget at deadlines sa background at kakatok lang kapag may kailangan ka.',
    },
    forWho: {
      en: 'Busy hosts who would rather be told than check, and who want a shortlist picked by fit, never cheapest first.',
      tl: 'Para sa mga abalang host na mas gustong sabihan kaysa mag-check, at gustong shortlist na pinili ayon sa bagay, hindi ayon sa pinakamura.',
    },
    steps: {
      en: ['Tell it about your event once: style, budget, date, guest count and place.', 'It ranks a shortlist of verified suppliers that fit, then keeps watching them and your dates.', 'It taps you before something slips: a payment due, a price that moved, a clashing date.'],
      tl: ['Sabihin sa kanya ang tungkol sa event mo nang isang beses: style, budget, petsa, bilang ng bisita at lugar.', 'Magra-rank ito ng shortlist ng verified na suppliers na bagay, tapos babantayan sila at ang mga petsa mo.', 'Kakatok ito bago may madulas: due na deposito, gumalaw na presyo, nagbabanggaang petsa.'],
    },
    different: {
      en: ['It watches in the background instead of waiting for your questions.', 'Most weeks it stays quiet and gathers what matters into one calm weekly digest.', 'Your suggested team is picked by best fit, never cheapest first.', 'Your details are used to find your fit, never sold.'],
      tl: ['Nagbabantay ito sa background imbes na maghintay ng tanong mo.', 'Madalas na tahimik ito at iniipon ang mahalaga sa isang mahinahong lingguhang digest.', 'Ang iminumungkahing team mo ay pinili ayon sa pinakabagay, hindi pinakamura.', 'Ginagamit ang detalye mo para hanapin ang bagay sa iyo at hindi ibinebenta.'],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'It ranks the verified suppliers in the Marketplace.', tl: 'Nire-rank nito ang verified na suppliers sa Marketplace.' } },
      { slug: 'budget', how: { en: 'It watches your budget and flags what needs you.', tl: 'Binabantayan nito ang budget mo at sinasabi kung ano ang kailangan.' } },
      { slug: 'schedule', how: { en: 'It keeps an eye on your dates and deadlines.', tl: 'Binabantayan nito ang mga petsa at deadlines mo.' } },
    ],
    faq: {
      en: [
        { q: 'Is Setnayan AI a chatbot?', a: 'No. A chatbot waits for you to ask. Setnayan AI watches your suppliers and dates in the background and taps you only when something needs you.' },
        { q: 'Do I have to use it?', a: 'Never. The planning tools stay free and work on their own. Setnayan AI is the paid upgrade that does the finding and watching.' },
        { q: 'Will it spam me?', a: 'No. Most weeks it is quiet and sends one calm weekly digest. It speaks up only when something cannot wait.' },
        { q: 'Is my information private?', a: 'Yes. Your details are used to find your fit and are never sold, under the Philippine Data Privacy Act.' },
      ],
      tl: [
        { q: 'Chatbot ba ang Setnayan AI?', a: 'Hindi. Naghihintay ang chatbot ng tanong mo. Ang Setnayan AI ay nagbabantay sa suppliers at petsa mo sa background at kakatok lang kapag may kailangan.' },
        { q: 'Kailangan ko ba itong gamitin?', a: 'Hindi kailanman. Libre pa rin ang mga planning tool at gumagana nang mag-isa. Ang Setnayan AI ang bayad na upgrade na naghahanap at nagbabantay.' },
        { q: 'Susulatan ba ako nito nang sobra?', a: 'Hindi. Madalas na tahimik ito at isang mahinahong lingguhang digest lang. Magsasalita lang ito kapag hindi na makapaghihintay.' },
        { q: 'Pribado ba ang impormasyon ko?', a: 'Oo. Ginagamit ang detalye mo para hanapin ang bagay sa iyo at hindi ibinebenta, alinsunod sa Data Privacy Act ng Pilipinas.' },
      ],
    },
    keywords: {
      en: ['AI event planner Philippines', 'AI wedding planner', 'supplier recommendations', 'event planning assistant'],
      tl: ['AI event planner', 'AI planner ng kasal', 'rekomendasyon ng supplier'],
    },
    shots: [],
    price: { kind: 'paid', catalogue: 'retail', codes: ['SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D'], inactiveRowsArePrices: true },
    moreHref: '/setnayan-ai',
    evidence: ['app/(shell)/setnayan-ai/page.tsx', 'lib/setnayan-ai-type-pricing.ts', 'lib/studio-apps.ts'],
  },
];
