import type { FeaturePageEntry } from './types';

/**
 * Plan it (1/2) — budget · guest list · seat plan · 3D Plan · schedule.
 *
 * Refreshed 2026-10-18 against the shipped screens (not the product pages,
 * which still carry some of the October copy):
 *   · Budget — the B0–B2 redo (`app/dashboard/[eventId]/budget/_components/budget-screen.tsx`):
 *     Target · Agreed · Paid · Owed, one Next line, three groups. The suggested
 *     split, the three spending levels, the typical range and an overdue
 *     call-out are NOT on the page any more (the split planner was removed in B2).
 *   · Guest list — replies are Attending / Not coming (the third answer was
 *     switched off 2026-09-30, `lib/rsvp-ask.ts`); plus-ones are a +1/+2 pick,
 *     not a tick-box; import is a CSV file; Setup decides how guests get in.
 */
export const PLAN_A_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'budget',
    group: 'plan',
    icon: 'budget',
    name: { en: 'Budget', tl: 'Budget' },
    line: { en: 'Target, agreed, paid and owed — in pesos, on one screen.', tl: 'Target, agreed, bayad at utang — sa piso, sa isang screen.' },
    title: { en: 'Free Event Budget Tracker in Pesos', tl: 'Libreng Budget Tracker sa Piso' },
    description: {
      en: 'Set your event budget in pesos and see what is agreed, paid and still owed. Booked suppliers and your own expenses, in one list. Free.',
      tl: 'I-set ang budget ng event mo sa piso at makita ang agreed, bayad at utang pa. Ang na-book na supplier at sarili mong gastos, sa iisang listahan. Libre.',
    },
    answer: {
      en: 'Setnayan Budget is a free budget tracker in Philippine pesos for any event. Type your target, and four numbers stay current: Target, Agreed, Paid and Owed. Your booked suppliers, what you bought on Setnayan and your own expenses sit in one list, with the next payment always on top.',
      tl: 'Ang Setnayan Budget ay libreng budget tracker sa piso para sa kahit anong event. I-type ang target mo, at laging tama ang apat na numero: Target, Agreed, Paid at Owed. Nasa iisang listahan ang na-book mong supplier, ang binili mo sa Setnayan at ang sarili mong gastos, at laging nasa taas ang susunod na bayarin.',
    },
    forWho: {
      en: 'Anyone planning a wedding, debut, birthday or any other event who wants one honest number instead of a spreadsheet only they update.',
      tl: 'Para sa sinumang nagpaplano ng kasal, debut, birthday o kahit anong event na gusto ng iisang tapat na numero imbes na spreadsheet na ikaw lang ang nag-a-update.',
    },
    steps: {
      en: [
        'Type your target in pesos. A meter shows paid and agreed against it, and how much is left.',
        'Book a supplier and they join the list. Record each payment with the amount, date and how you paid; add expenses with no supplier too.',
        'The Next line names the next payment and its date, with Pay beside it. Filter to what is owing or paid, search, and download or print the budget.',
      ],
      tl: [
        'I-type ang target mo sa piso. Ipinapakita ng meter ang bayad at agreed laban dito, at kung magkano pa ang natitira.',
        'Mag-book ng supplier at papasok sila sa listahan. I-record ang bawat bayad kasama ang halaga, petsa at paraan; puwede ring magdagdag ng gastos na walang supplier.',
        'Sinasabi ng Next line ang susunod na bayarin at petsa nito, may Pay sa tabi. I-filter ang may utang pa o bayad na, maghanap, at i-download o i-print ang budget.',
      ],
    },
    different: {
      en: [
        'Only suppliers you have booked count, so a quote you are still weighing is never counted as spent.',
        'A figure that could not be read shows a dash, never a false zero.',
        'You pay suppliers directly. Setnayan records your budget and never holds or moves that money.',
        'Suppliers you talk to can see a range for their own category only if you switch it on. It is off by default.',
        'Muslim and Chinese weddings get their own notes: the mahr, and ang pao with a lauriat table count.',
      ],
      tl: [
        'Ang mga supplier lang na na-book mo ang binibilang, kaya ang quote na pinag-iisipan mo pa ay hindi kailanman ituturing na gastos.',
        'Ang numerong hindi mabasa ay lumalabas na guhit, hindi kailanman maling zero.',
        'Direkta kang magbabayad sa supplier. Nire-record lang ng Setnayan ang budget mo at hindi nito hinahawakan o ginagalaw ang perang iyon.',
        'Makikita ng supplier na kausap mo ang range ng sarili nilang category kung bubuksan mo lang ito. Naka-off ito bilang default.',
        'May sariling notes ang kasal na Muslim at Chinese: ang mahr, at ang ang pao kasama ang bilang ng lauriat tables.',
      ],
    },
    worksWith: [
      { slug: 'suppliers', how: { en: 'Book a supplier on your Suppliers page and they appear in your budget.', tl: 'Mag-book ng supplier sa Suppliers page mo at lalabas sila sa budget mo.' } },
      { slug: 'guest-list', how: { en: 'Your headcount sits beside your costs.', tl: 'Magkatabi ang bilang ng bisita at ang gastos.' } },
      { slug: 'setnayan-ai', how: { en: 'Setnayan AI flags a payment before it is due and warns you before you go over.', tl: 'Sinasabi ng Setnayan AI ang bayarin bago ito ma-due at nagbababala bago ka lumampas.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free event budget tracker in the Philippines?', a: 'Yes. Setnayan Budget is included with every account. Set your target in pesos and record payments. Nothing to buy and nothing that expires.' },
        { q: 'Does a supplier quote show up in my budget?', a: 'Not until you book them. The budget counts booked suppliers, what you bought on Setnayan and the expenses you add yourself.' },
        { q: 'Does Setnayan handle my payments?', a: 'No. You pay suppliers directly and record each payment here. Setnayan never holds or moves that money.' },
        { q: 'Can I export it?', a: 'Yes. Download the budget as a spreadsheet, print it, or download your upcoming payment dates as a calendar file to import.' },
        { q: 'Can my coordinator see it?', a: 'Only if you allow it. Budget access is off for a coordinator by default, and you can give view access from Event access.' },
      ],
      tl: [
        { q: 'May libreng budget tracker ba sa Pilipinas para sa event?', a: 'Meron. Kasama ang Setnayan Budget sa bawat account. I-set ang target mo sa piso at i-record ang mga bayad. Walang bibilhin at walang expiry.' },
        { q: 'Lalabas ba sa budget ang quote ng supplier?', a: 'Hindi hangga’t hindi mo sila na-bo-book. Binibilang ng budget ang na-book na supplier, ang binili mo sa Setnayan at ang mga gastos na idinagdag mo.' },
        { q: 'Hinahawakan ba ng Setnayan ang bayad ko?', a: 'Hindi. Direkta kang nagbabayad sa supplier at nire-record mo dito ang bawat bayad. Hindi hinahawakan o ginagalaw ng Setnayan ang perang iyon.' },
        { q: 'Puwede ko ba itong i-export?', a: 'Puwede. I-download ang budget bilang spreadsheet, i-print, o i-download ang mga susunod na petsa ng bayarin bilang calendar file na ii-import.' },
        { q: 'Makikita ba ito ng coordinator ko?', a: 'Kung papayagan mo lang. Naka-off ang budget para sa coordinator bilang default, at puwede mo silang bigyan ng view access mula sa Event access.' },
      ],
    },
    keywords: {
      en: ['event budget tracker Philippines', 'wedding budget in pesos', 'free budget tracker', 'track supplier payments', 'debut budget'],
      tl: ['budget tracker para sa event', 'budget ng kasal sa piso', 'libreng budget tracker', 'bayad sa supplier'],
    },
    shots: [
      {
        src: '/feature-shots/budget-0.jpg',
        alt: {
          en: 'The Budget screen on a phone: Target, Agreed, Paid and Owed, a meter, the next payment, booked suppliers, your own expenses, and Add expense with the All filter and search',
          tl: 'Ang Budget screen sa telepono: Target, Agreed, Paid at Owed, isang meter, ang susunod na bayarin, ang na-book na supplier, sariling gastos, at Add expense kasama ang All filter at search',
        },
      },
    ],
    price: { kind: 'free' },
    moreHref: '/budget',
    evidence: [
      'app/(shell)/budget/page.tsx',
      'app/dashboard/[eventId]/budget/page.tsx',
      'app/dashboard/[eventId]/budget/_components/budget-screen.tsx',
      'lib/budget-page-view.ts',
      'lib/budget-ledger.ts',
    ],
  },
  {
    slug: 'guest-list',
    group: 'plan',
    icon: 'guests',
    name: { en: 'Guest list', tl: 'Guest list' },
    line: { en: 'Every guest, one row — reply, role, table and ticket.', tl: 'Bawat bisita, isang row — sagot, role, table at ticket.' },
    title: { en: 'Free Guest List and RSVP Tracker', tl: 'Libreng Guest List at RSVP Tracker' },
    description: {
      en: 'Keep every guest in one list with their reply, role, group, meal and table. Each guest gets a ticket with a QR. Free with every Setnayan account.',
      tl: 'Isang listahan ang lahat ng bisita, may sagot, role, group, pagkain at table. May ticket na may QR ang bawat bisita. Libre sa bawat Setnayan account.',
    },
    answer: {
      en: 'Setnayan Guest list is a free guest list and RSVP tracker for any event. Each guest is one row with their reply, role, group, meal and table, and their own ticket with a QR code. You choose how guests get in, and replies land in the list as they arrive.',
      tl: 'Ang Setnayan Guest list ay libreng guest list at RSVP tracker para sa kahit anong event. Isang row ang bawat bisita, may sagot, role, group, pagkain at table, at sariling ticket na may QR code. Ikaw ang pipili kung paano papasok ang bisita, at pumapasok sa listahan ang mga sagot habang dumarating.',
    },
    forWho: {
      en: 'Hosts tired of a spreadsheet, a notes app and a group chat all holding different versions of who is coming.',
      tl: 'Para sa mga host na pagod na sa spreadsheet, notes app at group chat na magkakaiba ang bersyon kung sino ang darating.',
    },
    steps: {
      en: [
        'Type a name and press Enter, import a CSV file, or pick from people already in your account. Give each guest a role and a group.',
        'In Setup, choose how guests get in: only your list, your list plus requests, or anyone with your one link. Pick what to ask and a reply-by date.',
        'Send each guest their ticket, watch replies arrive, then finalize the list. On the day, the check-in desk scans each QR.',
      ],
      tl: [
        'Mag-type ng pangalan at pindutin ang Enter, mag-import ng CSV file, o pumili sa mga tao sa account mo. Bigyan ang bawat bisita ng role at group.',
        'Sa Setup, piliin kung paano papasok ang bisita: ang listahan mo lang, listahan mo kasama ang requests, o kahit sinong may iisang link mo. Piliin ang itatanong at ang reply-by date.',
        'Ipadala sa bawat bisita ang ticket nila, panoorin ang pagdating ng sagot, tapos i-finalize ang listahan. Sa mismong araw, ini-scan ng check-in desk ang bawat QR.',
      ],
    },
    different: {
      en: [
        'Guests need no app and no account. Their ticket or your link is enough to reply.',
        'Filipino roles are built in: principal sponsors, ninong, ninang, candle, veil, cord and coin sponsors, bearers, flower girl, maid of honor, best man and more.',
        'Plus-ones are a +1 or +2 pick, and each extra seat gets its own row and QR.',
        'People who open your link can ask to join, and you keep them or match them to a name you already have.',
        'The same list feeds your seat plan, your Event Hub and the door, so nothing is typed twice.',
      ],
      tl: [
        'Hindi kailangan ng app o account ng bisita. Sapat na ang ticket nila o ang link mo para sumagot.',
        'Kasama na ang mga Pinoy na role: principal sponsors, ninong, ninang, candle, veil, cord at coin sponsors, bearers, flower girl, maid of honor, best man at iba pa.',
        'Ang plus-one ay pinipili bilang +1 o +2, at may sariling row at QR ang bawat dagdag na upuan.',
        'Ang mga nagbukas ng link mo ay puwedeng humiling na sumali, at ikaw ang magpapasya kung itatabi sila o itutugma sa pangalang nasa listahan na.',
        'Iisang listahan ang pinagkukunan ng seat plan, Event Hub at pinto, kaya walang inuulit na pag-type.',
      ],
    },
    worksWith: [
      { slug: 'seat-plan', how: { en: 'Every guest on the list is ready to seat.', tl: 'Handa nang paupuin ang bawat bisita sa listahan.' } },
      { slug: 'event-hub', how: { en: 'Guests reply on your Event Hub and your list updates.', tl: 'Sumasagot ang bisita sa Event Hub mo at nag-a-update ang listahan.' } },
      { slug: 'dress-code', how: { en: 'Each guest’s role tells them what to wear and when to arrive.', tl: 'Sinasabi ng role ng bawat bisita kung ano ang isusuot at kailan darating.' } },
      { slug: 'budget', how: { en: 'Your headcount sits beside your costs.', tl: 'Magkatabi ang bilang ng bisita at ang gastos.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free guest list app in the Philippines?', a: 'Yes. Setnayan Guest list is free with every account. It tracks replies, plus-ones, meals, roles and tables for any event, with nothing to buy.' },
        { q: 'How do guests reply?', a: 'They open their ticket or your event link and answer yes or no. If you ask about meals, dietary needs, a song request or a note, they answer those there too.' },
        { q: 'Can I import my existing list?', a: 'Yes. Save your spreadsheet as a CSV file and import it; you see a preview before anything is added. You can also download your list as an Excel file.' },
        { q: 'Can I stop replies after a date?', a: 'Yes. Set when replies open and close, and finalize the guest list when you are ready. You can reopen it any time.' },
      ],
      tl: [
        { q: 'May libreng guest list app ba sa Pilipinas?', a: 'Meron. Libre ang Setnayan Guest list sa bawat account. Sinusubaybayan nito ang sagot, plus-one, pagkain, role at table para sa kahit anong event, at walang bibilhin.' },
        { q: 'Paano sumasagot ang mga bisita?', a: 'Bubuksan nila ang ticket nila o ang event link mo at sasagot ng oo o hindi. Kung nagtatanong ka tungkol sa pagkain, dietary needs, song request o note, doon na rin nila sasagutin.' },
        { q: 'Puwede ko bang i-import ang kasalukuyang listahan ko?', a: 'Puwede. I-save ang spreadsheet mo bilang CSV file at i-import ito; may preview bago may maidagdag. Puwede mo ring i-download ang listahan bilang Excel file.' },
        { q: 'Puwede ko bang ihinto ang pagsagot pagkatapos ng isang petsa?', a: 'Puwede. Itakda kung kailan bubukas at magsasara ang pagsagot, at i-finalize ang guest list kapag handa ka na. Puwede mo itong buksan ulit kahit kailan.' },
      ],
    },
    keywords: {
      en: ['free guest list app Philippines', 'RSVP tracker', 'wedding guest list', 'debut guest list', 'ninong ninang list'],
      tl: ['libreng guest list', 'RSVP tracker', 'listahan ng bisita', 'guest list ng kasal'],
    },
    shots: [
      {
        src: '/feature-shots/guest-list-0.jpg',
        alt: {
          en: 'The Guest list on a phone: List, Map and Setup, the reply counts, requests to join, and guests grouped by role',
          tl: 'Ang Guest list sa telepono: List, Map at Setup, ang bilang ng sagot, mga humihiling sumali, at mga bisitang naka-grupo ayon sa role',
        },
      },
    ],
    price: { kind: 'free' },
    moreHref: '/guest-list',
    evidence: [
      'app/(shell)/guest-list/page.tsx',
      'lib/guests.ts',
      'lib/rsvp-ask.ts',
      'lib/who-can-reply.ts',
      'lib/reply-window.ts',
      'lib/extra-seats-sync.ts',
      'app/dashboard/[eventId]/guests/page.tsx',
      'app/dashboard/[eventId]/guests/export/route.ts',
    ],
  },
  {
    slug: 'seat-plan',
    group: 'plan',
    icon: 'seat',
    name: { en: 'Seat plan', tl: 'Seat plan' },
    line: { en: 'Lay out your tables and seat every guest — free.', tl: 'I-layout ang mga table at paupuin ang bawat bisita — libre.' },
    title: { en: 'Free Seating Chart Maker', tl: 'Libreng Seating Chart Maker' },
    description: {
      en: 'Draw your room, drag guests into seats or let Auto Arrange seat them, keep people apart, and print table signs and place cards. Free.',
      tl: 'Iguhit ang venue, i-drag ang bisita sa upuan o hayaang i-seat ng Auto Arrange, paghiwalayin ang dapat, at i-print ang table signs at place cards. Libre.',
    },
    answer: {
      en: 'Setnayan Seat plan is a free seating chart maker. You lay out your tables, entrance and dance floor, then drag each guest into a seat or let Auto Arrange seat everyone who has not declined, with the people who matter most nearest the stage.',
      tl: 'Ang Setnayan Seat plan ay libreng seating chart maker. Ilalatag mo ang mga table, entrance at dance floor, tapos i-drag ang bawat bisita sa upuan o hayaang i-seat ng Auto Arrange ang lahat ng hindi tumanggi, at ang pinakamahalaga ay pinakamalapit sa stage.',
    },
    forWho: {
      en: 'Hosts and coordinators who need every guest in a seat they can see, and a chart that survives late replies.',
      tl: 'Para sa mga host at coordinator na kailangang makita ang bawat bisita sa upuan, at chart na hindi masisira ng late na sagot.',
    },
    steps: {
      en: [
        'Set the room size, or start from the size your booked venue gave. Build a seating draft in one tap, or add tables, the entrance and the dance floor yourself.',
        'Drag a guest onto a table, or let Auto Arrange do it. Keep some guests apart, keep groups together, and choose who sits nearest the stage.',
        'Print table signs with a QR and place cards as a PDF, and give your caterer the meal counts per table.',
      ],
      tl: [
        'I-set ang laki ng kuwarto, o magsimula sa laking bigay ng na-book mong venue. Gumawa ng seating draft sa isang tap, o idagdag mo mismo ang mga table, entrance at dance floor.',
        'I-drag ang bisita sa table, o hayaang gawin ng Auto Arrange. Paghiwalayin ang dapat, pagsamahin ang mga grupo, at piliin kung sino ang pinakamalapit sa stage.',
        'I-print bilang PDF ang table signs na may QR at ang place cards, at ibigay sa caterer ang meal counts kada table.',
      ],
    },
    different: {
      en: [
        'It is complete and free. You can run your whole event on it.',
        'A keep-apart rule is visible only to you and is honored for whole groups too.',
        'New guests get a provisional seat, so the chart is not redrawn by hand.',
        'One person edits at a time, so two people never undo each other’s work. Your coordinator can arrange it; publishing stays with you.',
      ],
      tl: [
        'Kumpleto at libre ito. Puwede mong patakbuhin ang buong event dito.',
        'Ang keep-apart rule ay ikaw lang ang nakakakita at sinusunod pati ng buong grupo.',
        'May pansamantalang upuan ang bagong bisita, kaya hindi mo na guguhitin ulit ang chart.',
        'Isang tao lang ang nag-e-edit sa isang pagkakataon, kaya hindi nabubura ng isa ang gawa ng iba. Puwedeng mag-ayos ang coordinator mo; ikaw pa rin ang magpa-publish.',
      ],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'It seats the guests already on your list, with their roles and groups.', tl: 'Pinauupo nito ang mga bisitang nasa listahan mo, kasama ang role at group nila.' } },
      { slug: '3d-plan', how: { en: 'Your seat plan stands up into a 3D room you can walk.', tl: 'Ang seat plan mo ay nagiging 3D na kuwartong malalakad mo.' } },
      { slug: 'prints', how: { en: 'The seat plan, entrance chart and place cards are among your prints.', tl: 'Kasama sa prints mo ang seat plan, entrance chart at place cards.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free seating chart maker?', a: 'Yes. Setnayan Seat plan is included with every account, free and complete.' },
        { q: 'Do I have to seat everyone by hand?', a: 'No. Auto Arrange seats everyone who has not declined, by priority, and leaves anyone you placed yourself where they are. Drag anyone you want to move.' },
        { q: 'How do I keep two people apart?', a: 'Tell the plan to keep two guests apart and Auto Arrange seats them, and their whole groups, at different tables. Only you see that rule.' },
        { q: 'What can I print?', a: 'Table signs with a QR, place cards eight to a page, and a meal count per table with dietary notes for your caterer, as a print or a CSV file.' },
      ],
      tl: [
        { q: 'May libreng seating chart maker ba?', a: 'Meron. Kasama ang Setnayan Seat plan sa bawat account, libre at kumpleto.' },
        { q: 'Kailangan ko bang i-seat nang mano-mano ang lahat?', a: 'Hindi. Ini-seat ng Auto Arrange ang lahat ng hindi tumanggi, ayon sa priority, at hindi ginagalaw ang mga ikaw mismo ang naglagay. I-drag ang gusto mong ilipat.' },
        { q: 'Paano ko paghihiwalayin ang dalawang tao?', a: 'Sabihin sa plan na paghiwalayin ang dalawang bisita at ilalagay sila ng Auto Arrange, pati ang buong grupo nila, sa magkaibang table. Ikaw lang ang nakakakita ng rule na iyon.' },
        { q: 'Ano ang puwede kong i-print?', a: 'Table signs na may QR, place cards na walo bawat pahina, at meal count kada table na may dietary notes para sa caterer, bilang print o CSV file.' },
      ],
    },
    keywords: {
      en: ['free seating chart maker', 'wedding seating plan', 'table assignment', 'reception seating Philippines', 'place cards'],
      tl: ['libreng seating chart', 'seat plan ng kasal', 'upuan ng bisita', 'table assignment'],
    },
    shots: [
      {
        src: '/feature-shots/seat-plan-0.jpg',
        alt: {
          en: 'A table in the Seat plan on a phone: Table 10 with six of eight seats taken, and its name, shape and seat count',
          tl: 'Isang table sa Seat plan sa telepono: Table 10 na anim sa walong upuan ang may nakaupo, kasama ang pangalan, hugis at bilang ng upuan',
        },
      },
    ],
    price: { kind: 'free' },
    moreHref: '/seat-plan',
    evidence: ['app/(shell)/seat-plan/page.tsx', 'lib/seating.ts', 'lib/seating-pdf.ts', 'lib/seat-suggest.ts', 'lib/print-seating-pack.ts'],
  },
  {
    slug: '3d-plan',
    group: 'plan',
    icon: 'plan3d',
    name: { en: '3D Plan', tl: '3D Plan' },
    line: { en: 'Stand in your reception before it’s built.', tl: 'Tumayo sa reception mo bago pa ito itayo.' },
    title: { en: '3D Venue Plan from Your Seat Plan', tl: '3D Venue Plan mula sa Seat Plan' },
    description: {
      en: 'Turn your seating plan into a 3D room you can walk in your browser. Catch tight aisles and blocked views before the day. Free.',
      tl: 'Gawing 3D na kuwartong malalakad sa browser ang seat plan mo. Makita ang masikip na aisle at nakaharang na view bago ang araw. Libre.',
    },
    answer: {
      en: 'Setnayan 3D Plan turns the seating plan you already made into a 3D room you can walk through in your browser. It is free, and it helps you spot a blocked view or a tight aisle while it is still a plan.',
      tl: 'Ginagawang 3D na kuwartong malalakad sa browser ng Setnayan 3D Plan ang seat plan na ginawa mo na. Libre ito, at nakakatulong makita ang nakaharang na view o masikip na aisle habang plano pa lang.',
    },
    forWho: {
      en: 'Hosts, coordinators and stylists who want everyone to picture the same room before it exists.',
      tl: 'Para sa mga host, coordinator at stylist na gustong iisa ang larawan ng lahat sa kuwarto bago pa ito umiral.',
    },
    steps: {
      en: ['Lay out your tables in the free seat plan.', 'Open the 3D view and your flat plan stands up into a room you can walk. Changes to the plan flow straight in.', 'Fix the tight aisle or blocked view while there is still time, and show others the exact room.'],
      tl: ['I-layout ang mga table sa libreng seat plan.', 'Buksan ang 3D view at ang flat plan mo ay tatayo bilang kuwartong malalakad. Pumapasok agad ang mga pagbabago sa plan.', 'Ayusin ang masikip na aisle o nakaharang na view habang may oras pa, at ipakita sa iba ang eksaktong kuwarto.'],
    },
    different: {
      en: ['It builds on your seat plan, so there is no room to rebuild from scratch.', 'It runs in the browser with nothing to install.', 'The wedding party wears the colours you set for their role on your Mood Board.'],
      tl: ['Nakabase ito sa seat plan mo, kaya hindi mo kailangang buuin ang kuwarto mula sa simula.', 'Tumatakbo ito sa browser at walang ii-install.', 'Suot ng wedding party ang kulay na itinakda mo para sa role nila sa Mood Board mo.'],
    },
    worksWith: [
      { slug: 'seat-plan', how: { en: 'It reads your tables and dance floor straight from the seat plan.', tl: 'Binabasa nito ang mga table at dance floor mula mismo sa seat plan.' } },
      { slug: 'mood-board', how: { en: 'The wedding party wears the role colours you set.', tl: 'Suot ng wedding party ang role colors na itinakda mo.' } },
    ],
    faq: {
      en: [
        { q: 'Do I build the 3D room from scratch?', a: 'No. It builds on the seat plan you already make. Open the 3D view and your plan stands up into a room.' },
        { q: 'Is 3D Plan free?', a: 'Yes. The seat plan and 3D Plan are both free.' },
        { q: 'What can I catch with it?', a: 'What a flat chart hides: a view blocked by a pillar, a path too tight for a gown, a head table that looks smaller than you pictured.' },
        { q: 'Does it need a special device?', a: 'No. It runs in the browser on the phone or laptop you already use.' },
      ],
      tl: [
        { q: 'Kailangan ko bang buuin ang 3D na kuwarto mula sa simula?', a: 'Hindi. Nakabase ito sa seat plan na ginagawa mo na. Buksan ang 3D view at tatayo ang plan mo bilang kuwarto.' },
        { q: 'Libre ba ang 3D Plan?', a: 'Oo. Libre ang seat plan at ang 3D Plan.' },
        { q: 'Ano ang makikita ko dito?', a: 'Ang itinatago ng flat na chart: view na nakaharang ang haligi, daanang masikip para sa gown, head table na mukhang mas maliit kaysa inakala mo.' },
        { q: 'Kailangan ba ng espesyal na device?', a: 'Hindi. Tumatakbo ito sa browser ng telepono o laptop na gamit mo na.' },
      ],
    },
    keywords: {
      en: ['3D venue layout', 'virtual reception layout', 'wedding 3D seating plan', 'walkthrough your venue'],
      tl: ['3D na layout ng venue', '3D seat plan', 'libreng 3D plan'],
    },
    shots: [
      {
        src: '/feature-shots/3d-plan-0.jpg',
        alt: {
          en: 'The 3D Plan on a phone: a sample reception seen from above — round tables with seated guests, the stage and the dance floor — with Walk around and the role colours switched on',
          tl: 'Ang 3D Plan sa telepono: isang sample na reception na tanaw mula sa itaas — mga bilog na table na may nakaupong bisita, ang stage at ang dance floor — kasama ang Walk around at nakabukas ang role colors',
        },
      },
    ],
    price: { kind: 'free' },
    tryHref: '/pa3d/try',
    moreHref: '/pa3d',
    evidence: ['app/(shell)/pa3d/page.tsx', 'app/(shell)/pa3d/try/page.tsx', 'lib/seating-3d.ts', 'app/dashboard/[eventId]/plan3d/page.tsx'],
  },
  {
    slug: 'schedule',
    group: 'plan',
    icon: 'schedule',
    name: { en: 'Schedule', tl: 'Schedule' },
    line: { en: 'Your day, moment by moment, live for guests and suppliers.', tl: 'Ang araw mo, bawat sandali, live para sa bisita at supplier.' },
    title: { en: 'Event Day Schedule and Run-of-Show', tl: 'Schedule at Run-of-Show ng Event' },
    description: {
      en: 'Build your day-of timeline with times, places and who is responsible. Show moments to guests, shift everything when you run late. Free.',
      tl: 'Buuin ang timeline ng araw mo na may oras, lugar at responsable. Ipakita ang mga sandali sa bisita, at ilipat lahat kapag na-late. Libre.',
    },
    answer: {
      en: 'Setnayan Schedule is the run-of-show for your event, free with every account. You add moments like the ceremony, cocktails and dinner, each with a start, an end, a place and who is responsible. Moments you make visible show on your Event Hub with a live “happening now” on the day.',
      tl: 'Ang Setnayan Schedule ang run-of-show ng event mo, libre sa bawat account. Nagdadagdag ka ng mga sandali gaya ng ceremony, cocktails at dinner, bawat isa may simula, tapos, lugar at responsable. Ang mga sandaling gagawin mong visible ay lalabas sa Event Hub mo na may live na “happening now” sa mismong araw.',
    },
    forWho: {
      en: 'Hosts and coordinators who want one timeline that guests, suppliers and the emcee all read from.',
      tl: 'Para sa mga host at coordinator na gustong iisang timeline ang binabasa ng bisita, supplier at emcee.',
    },
    steps: {
      en: ['Add moments, or start from a template such as a classic wedding day or a reception program. Give each a time, a place and notes.', 'Tag the supplier responsible, and mark which moments are visible to guests.', 'On the day, start the next moment. Running late? Shift everything after it and every length is kept.'],
      tl: ['Magdagdag ng mga sandali, o magsimula sa template gaya ng classic wedding day o reception program. Bigyan ang bawat isa ng oras, lugar at notes.', 'I-tag ang supplier na responsable, at markahan kung aling mga sandali ang visible sa bisita.', 'Sa mismong araw, simulan ang susunod na sandali. Na-late? Ilipat ang lahat ng kasunod at buo ang bawat haba.'],
    },
    different: {
      en: ['Guests see only the moments you make visible, with a live “happening now” on the day.', 'Shift one moment and everything after it moves, with every length kept. The header says how far ahead or behind you are.', 'Suppliers can ask to change, add or remove a moment but never edit your timeline; you approve or decline.', 'The same program becomes an emcee script you can download.'],
      tl: ['Ang bisita ay makikita lang ang mga sandaling ginawa mong visible, na may live na “happening now” sa mismong araw.', 'Ilipat ang isang sandali at gumagalaw ang lahat ng kasunod, buo ang bawat haba. Sinasabi ng header kung gaano ka kaaga o ka-late.', 'Puwedeng humiling ang supplier na baguhin, idagdag o tanggalin ang isang sandali pero hindi nila mababago ang timeline mo; ikaw ang mag-a-approve o tatanggi.', 'Ang parehong programa ay nagiging emcee script na puwedeng i-download.'],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'Visible moments appear on your Event Hub.', tl: 'Lumalabas sa Event Hub mo ang mga visible na sandali.' } },
      { slug: 'suppliers', how: { en: 'Tag a booked supplier on a moment and it shows in their own run-of-show.', tl: 'I-tag ang na-book na supplier sa isang sandali at lalabas ito sa sarili nilang run-of-show.' } },
      { slug: 'dress-code', how: { en: 'Call times tell each role when to arrive.', tl: 'Sinasabi ng call time sa bawat role kung kailan darating.' } },
    ],
    faq: {
      en: [
        { q: 'What is a run-of-show?', a: 'It is the day-of timeline. Setnayan Schedule lets you build it moment by moment with times, places and who is responsible.' },
        { q: 'Is the schedule free?', a: 'Yes. It is included with every Setnayan account.' },
        { q: 'Who can see my schedule?', a: 'Only what you choose. Each moment can be made visible to guests; hidden moments stay private.' },
        { q: 'What if the day runs late?', a: 'Shift a moment and everything after it moves by the same amount with lengths kept. The header shows whether you are ahead, behind or on time.' },
      ],
      tl: [
        { q: 'Ano ang run-of-show?', a: 'Ito ang timeline ng mismong araw. Sa Setnayan Schedule, bubuuin mo ito bawat sandali na may oras, lugar at responsable.' },
        { q: 'Libre ba ang schedule?', a: 'Oo. Kasama ito sa bawat Setnayan account.' },
        { q: 'Sino ang nakakakita ng schedule ko?', a: 'Ang pinili mo lang. Puwedeng gawing visible sa bisita ang bawat sandali; pribado ang mga nakatago.' },
        { q: 'Paano kung ma-late ang araw?', a: 'Ilipat ang isang sandali at lahat ng kasunod ay susunod sa parehong dami, buo ang haba. Ipinapakita ng header kung advance, late o on time ka.' },
      ],
    },
    keywords: {
      en: ['run of show template', 'wedding day timeline', 'event schedule maker', 'program of events Philippines'],
      tl: ['run of show', 'timeline ng kasal', 'schedule ng event'],
    },
    shots: [
      { src: '/demo/maria-jose/ceremony.webp', alt: { en: 'A bride and groom kneeling before the altar of a candlelit stone church', tl: 'Ikinasal na magkasintahang nakaluhod sa harap ng altar ng kandilang-ilaw na batong simbahan' } },
      {
        src: '/feature-shots/schedule-0.jpg',
        alt: {
          en: 'The Schedule on a phone: the day’s moments on a timeline, which ones guests see, and two supplier requests waiting',
          tl: 'Ang Schedule sa telepono: ang mga sandali ng araw sa isang timeline, alin ang nakikita ng bisita, at dalawang request ng supplier na naghihintay',
        },
      },
    ],
    price: { kind: 'free' },
    moreHref: '/schedule',
    evidence: ['app/(shell)/schedule/page.tsx', 'lib/schedule.ts', 'lib/schedule-run-of-show.ts', 'lib/schedule-ros.ts', 'app/dashboard/[eventId]/schedule/page.tsx'],
  },
];
