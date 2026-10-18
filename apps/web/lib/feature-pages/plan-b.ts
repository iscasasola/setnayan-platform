import type { FeaturePageEntry } from './types';

/**
 * Plan it (2/2) — mood board · marketplace · compare · Suppliers · Setnayan AI.
 *
 * Refreshed 2026-10-18:
 *   · Suppliers (NEW) — the event's one Suppliers screen, Find · Build · Booked
 *     (`app/dashboard/[eventId]/vendors/_components/services-takeover.tsx`,
 *     `lib/suppliers-shell.ts`). The booking HANDSHAKE (the supplier agrees
 *     before it counts) is behind `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` and is
 *     NOT promised here — "Book" is described without saying who confirms.
 *   · Setnayan AI — paid (`platform_settings.setnayan_ai_paywall_enabled` read
 *     TRUE on 2026-10-18). Its old "weekly digest" line is gone: the digest
 *     assembler has no caller. The "% match" is free for everyone.
 *   · Mood Board — free to use; photoreal renders spend credits bought as
 *     MOODBOARD_RENDER_PACK. Rooms, ceiling and stage are now designed with the
 *     Seat plan, so they are no longer claimed here. Dress code has its own page.
 */
export const PLAN_B_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'mood-board',
    group: 'plan',
    icon: 'mood-board',
    name: { en: 'Mood Board', tl: 'Mood Board' },
    line: { en: 'Pick your colours once — your event dresses to match.', tl: 'Piliin ang kulay nang isang beses — susunod ang event mo.' },
    title: { en: 'Event Mood Board and Color Palette', tl: 'Mood Board at Color Palette ng Event' },
    description: {
      en: 'Pick your event colours once, set each role’s look, and share one board with your suppliers. Free to use, with optional photoreal renders.',
      tl: 'Piliin ang kulay ng event nang isang beses, itakda ang itsura ng bawat role, at ibahagi ang iisang board sa suppliers. Libreng gamitin, may optional na renders.',
    },
    answer: {
      en: 'Setnayan Mood Board is where your event decides how it looks. You start from a curated theme or your own palette, set colours for each role, and gather the details you love. It is free to use, and one board gives suppliers a single answer to “what is your motif?”.',
      tl: 'Ang Setnayan Mood Board ang lugar kung saan nagpapasya ang event mo kung ano ang itsura nito. Magsisimula ka sa curated na theme o sariling palette, magtatakda ng kulay sa bawat role, at mag-iipon ng mga detalyeng gusto mo. Libre itong gamitin, at iisang board ang sagot sa supplier sa “ano ang motif n’yo?”.',
    },
    forWho: {
      en: 'Hosts who want a clear look for the day without being a designer, and who are tired of explaining it to every supplier.',
      tl: 'Para sa mga host na gusto ng malinaw na itsura ng araw kahit hindi designer, at pagod nang ipaliwanag ito sa bawat supplier.',
    },
    steps: {
      en: ['Start from a curated theme or build your own palette.', 'Give each role its colours, add your own roles, and gather the details you love.', 'Share it: booked suppliers open a read-only copy, and a one-page printable covers everyone else.'],
      tl: ['Magsimula sa curated na theme o buuin ang sariling palette.', 'Bigyan ng kulay ang bawat role, magdagdag ng sariling role, at mag-ipon ng mga detalyeng gusto mo.', 'Ibahagi ito: makakabukas ng read-only na kopya ang na-book na supplier, at may one-page printable para sa iba.'],
    },
    different: {
      en: ['Your Event Hub, logo and QR codes take your colours.', 'The wedding party in your 3D Plan wears the colours you set for their role.', 'Booked suppliers open a read-only copy, and there is a one-page printable for everyone else.', 'Swatch previews are free. A photoreal “Make it real” render spends a credit, and a failed render gives it back.'],
      tl: ['Sinusunod ng Event Hub, logo at QR codes mo ang mga kulay mo.', 'Ang wedding party sa 3D Plan ay suot ang kulay na itinakda mo para sa role nila.', 'Makakabukas ng read-only na kopya ang na-book na supplier, at may one-page printable para sa iba.', 'Libre ang swatch previews. Gumagamit ng isang credit ang photoreal na “Make it real” render, at ibinabalik ito kapag pumalya ang render.'],
    },
    worksWith: [
      { slug: 'dress-code', how: { en: 'Each role’s colours become what guests are told to wear.', tl: 'Ang kulay ng bawat role ang sinasabi sa bisita kung ano ang isusuot.' } },
      { slug: '3d-plan', how: { en: 'The wedding party in the 3D room wears the role colours you set.', tl: 'Suot ng wedding party sa 3D room ang role colors na itinakda mo.' } },
      { slug: 'event-hub', how: { en: 'Your Event Hub dresses in your palette.', tl: 'Nagsusuot ng palette mo ang Event Hub.' } },
      { slug: 'logo-maker', how: { en: 'Your logo is drawn in your colours.', tl: 'Iginuguhit ang logo mo sa mga kulay mo.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free mood board maker for events?', a: 'Yes. The Setnayan Mood Board is free to use with every account. Only the optional photoreal renders cost credits.' },
        { q: 'Do I need design skills?', a: 'No. Start from a curated theme and it fills your palette. Change anything you do not like.' },
        { q: 'Where do my colours show up?', a: 'On what Setnayan makes for you: your Event Hub, logo and QR codes, the dress code your guests read, and the wedding party in your 3D Plan.' },
        { q: 'Can my suppliers see it?', a: 'Suppliers you booked through Setnayan can open a read-only copy, and there is a one-page printable for anyone else.' },
      ],
      tl: [
        { q: 'May libreng mood board maker ba para sa event?', a: 'Meron. Libreng gamitin ang Setnayan Mood Board sa bawat account. Ang optional na photoreal renders lang ang gumagamit ng credits.' },
        { q: 'Kailangan ba ng design skills?', a: 'Hindi. Magsimula sa curated na theme at mapupuno ang palette mo. Palitan ang ayaw mo.' },
        { q: 'Saan lumalabas ang mga kulay ko?', a: 'Sa mga ginagawa ng Setnayan para sa iyo: Event Hub, logo at QR codes, ang dress code na binabasa ng bisita, at ang wedding party sa 3D Plan.' },
        { q: 'Makikita ba ito ng mga supplier ko?', a: 'Ang mga supplier na na-book mo sa Setnayan ay makakabukas ng read-only na kopya, at may one-page printable para sa iba.' },
      ],
    },
    keywords: {
      en: ['event mood board', 'wedding color palette', 'motif and colors', 'entourage colors', 'mood board maker'],
      tl: ['mood board ng event', 'kulay at motif', 'kulay ng entourage'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['MOODBOARD_RENDER_PACK'] },
    moreHref: '/mood-board',
    evidence: ['app/(shell)/mood-board/page.tsx', 'lib/mood-board.ts', 'lib/moodboard-printable.ts', 'lib/moodboard-render-credits.ts', 'lib/room-palette.ts'],
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
      en: 'The Setnayan Marketplace is where you find suppliers for your event. Search verified Filipino photographers, videographers, caterers, coordinators, hair and makeup and more, by category and city. Browsing is free and open to anyone, and every supplier shows how well they fit your event.',
      tl: 'Ang Setnayan Marketplace ang lugar kung saan ka maghahanap ng suppliers para sa event mo. Maghanap ng verified na Pinoy photographer, videographer, caterer, coordinator, hair at makeup at iba pa, ayon sa category at lungsod. Libre at bukas sa lahat ang pag-browse, at ipinapakita ng bawat supplier kung gaano sila kabagay sa event mo.',
    },
    forWho: {
      en: 'Anyone hiring suppliers for a wedding, debut, birthday or any other event, who wants to know the business is real.',
      tl: 'Para sa sinumang kumukuha ng suppliers para sa kasal, debut, birthday o kahit anong event na gustong matiyak na totoo ang negosyo.',
    },
    steps: {
      en: ['Type what you need or open a category and browse by city.', 'Save the ones you like. Each shows a % match for your event: budget, distance, reviews, your date and faith fit.', 'Put two side by side, then ask about your date. The ones you keep live on your event’s Suppliers page.'],
      tl: ['I-type ang kailangan mo o buksan ang category at mag-browse ayon sa lungsod.', 'I-save ang mga gusto mo. May % match ang bawat isa para sa event mo: budget, layo, reviews, petsa mo at faith fit.', 'Ilagay ang dalawa nang magkatabi, tapos magtanong tungkol sa petsa mo. Nasa Suppliers page ng event mo ang mga itatabi mo.'],
    },
    different: {
      en: ['Only verified suppliers appear. Each one submits business papers — DTI or SEC registration, BIR 2303, a Mayor’s Permit and bank proof — for a Setnayan admin to check.', 'Real business names are shown from the first day.', 'You can message a supplier free. They see your event’s display name and date, never your email.', 'The % match is free for everyone and never hides a supplier.'],
      tl: ['Verified na supplier lang ang lumalabas. Nagsusumite ang bawat isa ng papeles ng negosyo — DTI o SEC registration, BIR 2303, Mayor’s Permit at bank proof — para suriin ng isang Setnayan admin.', 'Ipinapakita ang tunay na pangalan ng negosyo mula unang araw.', 'Libre kang makapag-message sa supplier. Makikita nila ang display name at petsa ng event mo, hindi ang email mo.', 'Libre para sa lahat ang % match at hindi ito nagtatago ng kahit sinong supplier.'],
    },
    worksWith: [
      { slug: 'compare', how: { en: 'Open any two saved suppliers in one view.', tl: 'Buksan ang kahit dalawang na-save na supplier sa isang view.' } },
      { slug: 'suppliers', how: { en: 'Saved suppliers wait on your event’s Suppliers page, ready to build and book.', tl: 'Naghihintay ang mga na-save na supplier sa Suppliers page ng event mo, handang i-build at i-book.' } },
      { slug: 'setnayan-ai', how: { en: 'Setnayan AI suggests a team by best fit, not cheapest.', tl: 'Nagmumungkahi ang Setnayan AI ng team ayon sa pinakabagay, hindi pinakamura.' } },
    ],
    faq: {
      en: [
        { q: 'How do I find verified suppliers in the Philippines?', a: 'Search the Setnayan Marketplace or browse a category and city. Only suppliers whose business papers a Setnayan admin has checked appear.' },
        { q: 'Is the Marketplace free?', a: 'Browsing is free and open to anyone. Saving and comparing are tied to your event, which is free to start.' },
        { q: 'What does the % match mean?', a: 'How well a supplier fits your event: your budget, the distance to your venue, their reviews, your date and faith fit. It ranks; it never hides anyone.' },
        { q: 'Does Setnayan take my payment to the supplier?', a: 'No. You pay the supplier directly; Setnayan never touches that money.' },
      ],
      tl: [
        { q: 'Paano makahanap ng verified na supplier sa Pilipinas?', a: 'Maghanap sa Setnayan Marketplace o mag-browse ng category at lungsod. Ang mga supplier lang na sinuri ng Setnayan admin ang papeles ang lumalabas.' },
        { q: 'Libre ba ang Marketplace?', a: 'Libre at bukas sa lahat ang pag-browse. Ang pag-save at pagkumpara ay nakatali sa event mo, na libreng simulan.' },
        { q: 'Ano ang ibig sabihin ng % match?', a: 'Kung gaano kabagay ang supplier sa event mo: budget mo, layo sa venue mo, reviews nila, petsa mo at faith fit. Nagra-rank ito; hindi ito nagtatago ng kahit sino.' },
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
    evidence: ['app/(shell)/marketplace/page.tsx', 'app/(shell)/explore/page.tsx', 'lib/marketplace-service-cards.ts', 'lib/compat-score.ts', 'lib/vendor-verification.ts'],
  },
  {
    slug: 'compare',
    group: 'plan',
    icon: 'suite',
    name: { en: 'Compare', tl: 'Compare' },
    line: { en: 'Put two suppliers side by side, then decide.', tl: 'Ilagay ang dalawang supplier nang magkatabi, tapos magpasya.' },
    title: { en: 'Compare Two Event Suppliers Side by Side', tl: 'Ikumpara ang Dalawang Supplier' },
    description: {
      en: 'Compare two saved suppliers side by side: location, distance from your venue, rating, starting price, services and faith fit. Free.',
      tl: 'Ikumpara ang dalawang na-save na supplier: lokasyon, layo sa venue mo, rating, panimulang presyo, serbisyo at faith fit. Libre.',
    },
    answer: {
      en: 'Setnayan Compare lays two saved suppliers side by side: location, distance from your venue, rating, where their prices start, what is included, services and faith fit. It is two at a time on purpose, so you reach a decision.',
      tl: 'Inilalagay ng Setnayan Compare nang magkatabi ang dalawang na-save na supplier: lokasyon, layo sa venue mo, rating, kung saan nagsisimula ang presyo nila, ano ang kasama, serbisyo at faith fit. Dalawa lang sa isang beses para makapagpasya ka.',
    },
    forWho: {
      en: 'Hosts down to two photographers, two caterers or two venues who need to choose.',
      tl: 'Para sa mga host na dalawa na lang ang pinagpipilian, photographer man, caterer o venue.',
    },
    steps: {
      en: ['Save two suppliers from the Marketplace.', 'Open the comparison to see them side by side.', 'Choose one and ask about your date.'],
      tl: ['I-save ang dalawang supplier mula sa Marketplace.', 'Buksan ang comparison para makita silang magkatabi.', 'Pumili ng isa at magtanong tungkol sa petsa mo.'],
    },
    different: {
      en: ['It is an A-or-B view, not a wide table that leads to more browsing.', 'Distance is measured from your venue once you have set one.', 'Faith fit and verification are shown beside rating and price.'],
      tl: ['A-o-B na view ito, hindi malawak na table na magdadala sa mas maraming pag-browse.', 'Sinusukat ang layo mula sa venue mo kapag na-set mo na ito.', 'Ipinapakita ang faith fit at verification katabi ng rating at presyo.'],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Compare the suppliers you saved while browsing.', tl: 'Ikumpara ang mga supplier na na-save mo habang nagba-browse.' } },
      { slug: 'suppliers', how: { en: 'The one you pick goes into your build on the Suppliers page.', tl: 'Ang pipiliin mo ay papasok sa build mo sa Suppliers page.' } },
    ],
    faq: {
      en: [
        { q: 'How do I compare two suppliers?', a: 'Save two suppliers from the Marketplace, then open the comparison. Location, distance, rating, starting price, services and faith fit appear side by side.' },
        { q: 'Why only two at a time?', a: 'An A-or-B view leads to a decision. A wide table leads to more browsing.' },
        { q: 'Does it use my venue?', a: 'Yes. Once you set your venue, the comparison shows each supplier’s distance from it.' },
      ],
      tl: [
        { q: 'Paano ko ikukumpara ang dalawang supplier?', a: 'I-save ang dalawang supplier mula sa Marketplace, tapos buksan ang comparison. Magkatabing lalabas ang lokasyon, layo, rating, panimulang presyo, serbisyo at faith fit.' },
        { q: 'Bakit dalawa lang sa isang beses?', a: 'Ang A-o-B na view ay humahantong sa desisyon. Ang malawak na table ay humahantong sa mas maraming pag-browse.' },
        { q: 'Ginagamit ba nito ang venue ko?', a: 'Oo. Kapag na-set mo na ang venue, ipinapakita ng comparison ang layo ng bawat supplier mula rito.' },
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
    slug: 'suppliers',
    group: 'plan',
    icon: 'team',
    name: { en: 'Suppliers', tl: 'Suppliers' },
    line: { en: 'Find, build and book every supplier on one screen.', tl: 'Hanapin, buuin at i-book ang bawat supplier sa isang screen.' },
    title: { en: 'Your Event’s Suppliers: Find, Build, Booked', tl: 'Suppliers ng Event Mo: Find, Build, Booked' },
    description: {
      en: 'One screen for every supplier at your event: shortlist by category, build your picks against your budget, then book and track each payment.',
      tl: 'Iisang screen para sa bawat supplier ng event mo: mag-shortlist ayon sa category, buuin ang mga pili laban sa budget, tapos i-book at bantayan ang bawat bayad.',
    },
    answer: {
      en: 'Your event’s Suppliers page holds every supplier in three parts: Find, Build and Booked. Find is your shortlist by category. Build is one pick per category, totalled against your budget. Booked is everyone you hired, with their next payment and where to pay them. Your date and venue sit at the top.',
      tl: 'Nasa Suppliers page ng event mo ang bawat supplier sa tatlong bahagi: Find, Build at Booked. Ang Find ay ang shortlist mo ayon sa category. Ang Build ay isang pili sa bawat category, kinuwenta laban sa budget mo. Ang Booked ay ang lahat ng kinuha mo, may susunod na bayarin at kung saan sila babayaran. Nasa taas ang petsa at venue mo.',
    },
    forWho: {
      en: 'Hosts juggling many suppliers who want one place that says who is still being considered, who is chosen and who is paid.',
      tl: 'Para sa mga host na maraming hinahawakang supplier at gusto ng iisang lugar na nagsasabi kung sino ang pinag-iisipan pa, sino ang napili at sino ang bayad na.',
    },
    steps: {
      en: [
        'Find: search the Marketplace, save suppliers into each category, or add a supplier you already know. Ask for a quote or about another day right from the card.',
        'Build: pick one supplier per category from your shortlist and see the total against your budget. Save builds and compare them.',
        'Book this build, or one supplier at a time. Booked then shows each one’s payment plan, where to pay them, and your proof of payment.',
      ],
      tl: [
        'Find: maghanap sa Marketplace, i-save ang mga supplier sa bawat category, o magdagdag ng supplier na kilala mo na. Humingi ng quote o magtanong tungkol sa ibang araw mula mismo sa card.',
        'Build: pumili ng isang supplier sa bawat category mula sa shortlist mo at makita ang total laban sa budget. I-save ang mga build at ikumpara ang mga ito.',
        'I-book ang build na ito, o isa-isang supplier. Ipinapakita na ng Booked ang payment plan ng bawat isa, kung saan sila babayaran, at ang patunay ng bayad mo.',
      ],
    },
    different: {
      en: [
        'Shortlisting, comparing and asking are free. Nothing is committed until you book.',
        'Each category says where you stand, and the next one to decide is marked.',
        'Book a whole build in one go, after one confirm.',
        'A supplier you found yourself, outside Setnayan, can join the same list.',
        'You pay suppliers directly; Setnayan never holds that money.',
      ],
      tl: [
        'Libre ang pag-shortlist, pagkumpara at pagtatanong. Walang nakatali hangga’t hindi ka nagbo-book.',
        'Sinasabi ng bawat category kung nasaan ka na, at minamarkahan ang susunod na pagpapasyahan.',
        'I-book ang buong build nang sabay-sabay, sa isang kumpirmasyon.',
        'Puwedeng isama sa parehong listahan ang supplier na ikaw mismo ang nakahanap, kahit wala sa Setnayan.',
        'Direkta kang magbabayad sa supplier; hindi hinahawakan ng Setnayan ang perang iyon.',
      ],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Find opens the Marketplace and saves what you like into your categories.', tl: 'Binubuksan ng Find ang Marketplace at sine-save ang gusto mo sa mga category.' } },
      { slug: 'budget', how: { en: 'Everyone you book joins your budget with their payments.', tl: 'Ang bawat ma-book mo ay papasok sa budget mo kasama ang mga bayad.' } },
      { slug: 'schedule', how: { en: 'Booked suppliers can be tagged on the moments they run.', tl: 'Puwedeng i-tag ang na-book na supplier sa mga sandaling hawak nila.' } },
      { slug: 'setnayan-ai', how: { en: 'Setnayan AI watches whether your build fits your date, budget and venue.', tl: 'Binabantayan ng Setnayan AI kung bagay ang build mo sa petsa, budget at venue mo.' } },
    ],
    faq: {
      en: [
        { q: 'What is a build?', a: 'One supplier per category, picked from your shortlist, with the total shown against your budget. You can save several builds and compare them.' },
        { q: 'Is it free?', a: 'Yes. Shortlisting, comparing, asking and booking through your Suppliers page cost you nothing on Setnayan. You pay each supplier directly.' },
        { q: 'Can I add a supplier who is not on Setnayan?', a: 'Yes. Add your own supplier and they sit in the same list, with their payments in your budget.' },
        { q: 'Where do I pay a booked supplier?', a: 'Open them under Booked and press Pay. You see their payment plan and where to pay, and you record the payment with your proof.' },
      ],
      tl: [
        { q: 'Ano ang build?', a: 'Isang supplier sa bawat category, pinili mula sa shortlist mo, at ipinapakita ang total laban sa budget mo. Puwede kang mag-save ng ilang build at ikumpara ang mga ito.' },
        { q: 'Libre ba ito?', a: 'Oo. Walang bayad sa Setnayan ang pag-shortlist, pagkumpara, pagtatanong at pag-book sa Suppliers page mo. Direkta kang magbabayad sa bawat supplier.' },
        { q: 'Puwede ba akong magdagdag ng supplier na wala sa Setnayan?', a: 'Puwede. Idagdag ang sarili mong supplier at nasa parehong listahan sila, kasama ang bayad nila sa budget mo.' },
        { q: 'Saan ko babayaran ang na-book na supplier?', a: 'Buksan sila sa Booked at pindutin ang Pay. Makikita mo ang payment plan nila at kung saan magbabayad, at ire-record mo ang bayad kasama ang patunay.' },
      ],
    },
    keywords: {
      en: ['book event suppliers', 'wedding supplier checklist', 'compare supplier packages', 'track supplier payments Philippines'],
      tl: ['i-book ang supplier', 'listahan ng supplier sa kasal', 'bayad sa supplier'],
    },
    shots: [
      {
        src: '/feature-shots/suppliers-0.jpg',
        alt: {
          en: 'The Suppliers page on a phone, on Find: the event’s date and venue, Find · Build · Booked, and the shortlist by category',
          tl: 'Ang Suppliers page sa telepono, nasa Find: ang petsa at venue ng event, Find · Build · Booked, at ang shortlist ayon sa category',
        },
      },
      {
        src: '/feature-shots/suppliers-1.jpg',
        alt: {
          en: 'Build: one supplier per category with its price, the build’s total, and Book this build',
          tl: 'Build: isang supplier sa bawat category kasama ang presyo, ang total ng build, at Book this build',
        },
      },
      {
        src: '/feature-shots/suppliers-2.jpg',
        alt: {
          en: 'Booked: each booked supplier with the next payment and Pay, Chat and Your record',
          tl: 'Booked: bawat na-book na supplier kasama ang susunod na bayarin at Pay, Chat at Your record',
        },
      },
    ],
    price: { kind: 'free' },
    evidence: [
      'app/dashboard/[eventId]/vendors/page.tsx',
      'app/dashboard/[eventId]/vendors/_components/services-takeover.tsx',
      'app/dashboard/[eventId]/vendors/_components/build-body.tsx',
      'app/dashboard/[eventId]/vendors/_components/book-this-build.tsx',
      'app/dashboard/[eventId]/vendors/_components/pay-sheet.tsx',
      'lib/suppliers-shell.ts',
      'lib/booked-rows.ts',
      'lib/supplier-card-verbs.ts',
    ],
  },
  {
    slug: 'setnayan-ai',
    group: 'plan',
    icon: 'ai',
    name: { en: 'Setnayan AI', tl: 'Setnayan AI' },
    line: { en: 'Suggests your best-fit team, then watches your plan.', tl: 'Nagmumungkahi ng bagay na team, tapos binabantayan ang plano.' },
    title: { en: 'Setnayan AI Event Planner', tl: 'Setnayan AI: Event Planner na Nagbabantay' },
    description: {
      en: 'Setnayan AI suggests a supplier team by best fit, then tracks your deadlines, payments, budget and dates and tells you the one thing to do next.',
      tl: 'Nagmumungkahi ang Setnayan AI ng supplier team ayon sa pinakabagay, tapos binabantayan ang deadlines, bayarin, budget at petsa, at sinasabi ang susunod.',
    },
    answer: {
      en: 'Setnayan AI is a paid planner, not a chatbot. It suggests a team of verified suppliers by how well they fit your event, then tracks your deadlines, payments, budget and dates and tells you the one thing to do next. One unlock covers your event.',
      tl: 'Ang Setnayan AI ay bayad na planner, hindi chatbot. Nagmumungkahi ito ng team ng verified na suppliers ayon sa bagay sa event mo, tapos binabantayan ang deadlines, bayarin, budget at petsa mo at sinasabi ang susunod na dapat gawin. Isang unlock para sa buong event mo.',
    },
    forWho: {
      en: 'Busy hosts who would rather be told than check, and who want a team picked by fit, never cheapest first.',
      tl: 'Para sa mga abalang host na mas gustong sabihan kaysa mag-check, at gustong team na pinili ayon sa bagay, hindi ayon sa pinakamura.',
    },
    steps: {
      en: ['Unlock it for your event. It reads what you already entered: type, date, budget, guests and place.', 'It suggests a supplier team by best fit, then keeps watching your suppliers, budget and dates.', 'It flags a payment before it is due, warns you before you go over budget, and warns you when two things clash on the day.'],
      tl: ['I-unlock ito para sa event mo. Binabasa nito ang mga nailagay mo na: uri, petsa, budget, bisita at lugar.', 'Nagmumungkahi ito ng supplier team ayon sa pinakabagay, tapos patuloy na binabantayan ang suppliers, budget at petsa mo.', 'Sinasabi nito ang bayarin bago ma-due, nagbababala bago ka lumampas sa budget, at nagbababala kapag may nagbabanggaan sa mismong araw.'],
    },
    different: {
      en: ['It watches in the background instead of waiting for your questions.', 'It tells you the one thing to do next, not a long list.', 'Your suggested team is picked by best fit, never cheapest first.', 'The % match on every supplier stays free for everyone; Setnayan AI adds the watching.'],
      tl: ['Nagbabantay ito sa background imbes na maghintay ng tanong mo.', 'Sinasabi nito ang iisang susunod na gagawin, hindi mahabang listahan.', 'Ang iminumungkahing team mo ay pinili ayon sa pinakabagay, hindi pinakamura.', 'Libre pa rin para sa lahat ang % match ng bawat supplier; ang pagbabantay ang idinadagdag ng Setnayan AI.'],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'It suggests verified suppliers from the Marketplace.', tl: 'Nagmumungkahi ito ng verified na suppliers mula sa Marketplace.' } },
      { slug: 'suppliers', how: { en: 'It watches whether your build fits your date, budget and venue.', tl: 'Binabantayan nito kung bagay ang build mo sa petsa, budget at venue mo.' } },
      { slug: 'budget', how: { en: 'It flags payments before they are due and warns before you go over.', tl: 'Sinasabi nito ang bayarin bago ma-due at nagbababala bago ka lumampas.' } },
      { slug: 'schedule', how: { en: 'It warns you when two things clash on the day.', tl: 'Nagbababala ito kapag may nagbabanggaan sa mismong araw.' } },
    ],
    faq: {
      en: [
        { q: 'Is Setnayan AI a chatbot?', a: 'No. A chatbot waits for you to ask. Setnayan AI watches your suppliers, budget and dates in the background and tells you what needs you.' },
        { q: 'Do I have to use it?', a: 'Never. The planning tools stay free and work on their own. Setnayan AI is the paid upgrade that does the suggesting and watching.' },
        { q: 'How is it priced?', a: 'One unlock covers your event, and the price depends on the type of event. The current price is read from our live catalogue and shown on this page.' },
      ],
      tl: [
        { q: 'Chatbot ba ang Setnayan AI?', a: 'Hindi. Naghihintay ang chatbot ng tanong mo. Ang Setnayan AI ay nagbabantay sa suppliers, budget at petsa mo sa background at sinasabi kung ano ang kailangan mo.' },
        { q: 'Kailangan ko ba itong gamitin?', a: 'Hindi kailanman. Libre pa rin ang mga planning tool at gumagana nang mag-isa. Ang Setnayan AI ang bayad na upgrade na nagmumungkahi at nagbabantay.' },
        { q: 'Paano ang presyo?', a: 'Isang unlock para sa buong event mo, at nakadepende ang presyo sa uri ng event. Binabasa ang kasalukuyang presyo mula sa live catalogue namin at ipinapakita sa page na ito.' },
      ],
    },
    keywords: {
      en: ['AI event planner Philippines', 'AI wedding planner', 'supplier recommendations', 'event planning assistant'],
      tl: ['AI event planner', 'AI planner ng kasal', 'rekomendasyon ng supplier'],
    },
    shots: [],
    price: { kind: 'paid', catalogue: 'retail', codes: ['SETNAYAN_AI', 'SETNAYAN_AI_B', 'SETNAYAN_AI_C', 'SETNAYAN_AI_D'], inactiveRowsArePrices: true },
    moreHref: '/setnayan-ai',
    evidence: [
      'app/(shell)/setnayan-ai/page.tsx',
      'lib/setnayan-ai-type-pricing.ts',
      'lib/setnayan-ai.ts',
      'app/dashboard/[eventId]/studio/setnayan-ai/_components/setnayan-ai-value-copy.ts',
      'lib/studio-apps.ts',
    ],
  },
];
