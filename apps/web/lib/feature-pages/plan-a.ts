import type { FeaturePageEntry } from './types';

/**
 * Plan it (1/2) — budget · guest list · seat plan · 3D Plan · schedule.
 * Facts reused from the already-traced product pages under app/(shell)/<x>/page.tsx.
 */
export const PLAN_A_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'budget',
    group: 'plan',
    icon: 'budget',
    name: { en: 'Budget', tl: 'Budget' },
    line: { en: 'Planned, agreed, paid and owed — in pesos.', tl: 'Planned, agreed, bayad at utang — sa piso.' },
    title: { en: 'Free Event Budget Planner in Pesos', tl: 'Libreng Budget Planner sa Piso' },
    description: {
      en: 'Set your event budget in pesos, log every supplier payment, and see what is agreed, paid and still owed. Free with every Setnayan account.',
      tl: 'I-set ang budget ng event mo sa piso, i-log ang bawat bayad sa supplier, at makita ang agreed, bayad at utang pa. Libre sa bawat Setnayan account.',
    },
    answer: {
      en: 'Setnayan Budget is a free budget planner in Philippine pesos for any event. You set your total, then watch what is agreed, paid and still owed — for the whole event and category by category. Only suppliers you have actually booked count.',
      tl: 'Ang Setnayan Budget ay libreng budget planner sa piso para sa kahit anong event. I-set ang total mo, tapos bantayan ang agreed, bayad at utang pa — para sa buong event at bawat category. Ang mga na-book mo lang na supplier ang binibilang.',
    },
    forWho: {
      en: 'Anyone planning a wedding, debut, birthday or other celebration who wants one honest number instead of a spreadsheet only they update.',
      tl: 'Para sa sinumang nagpaplano ng kasal, debut, birthday o ibang handaan na gusto ng iisang tapat na numero imbes na spreadsheet na ikaw lang ang nag-a-update.',
    },
    steps: {
      en: [
        'Type your total budget in pesos and take a suggested split across categories. Change any amount, anytime.',
        'Book a supplier and their line items appear. Log each payment as the money moves; add costs with no supplier too.',
        'See target, agreed, paid and owed, with next payments and due dates listed and overdue ones called out.',
      ],
      tl: [
        'I-type ang total budget mo sa piso at kunin ang suggested split sa bawat category. Palitan ang kahit anong halaga, kahit kailan.',
        'Mag-book ng supplier at lalabas ang line items nila. I-log ang bawat bayad habang gumagalaw ang pera; puwede ring magdagdag ng gastos na walang supplier.',
        'Makikita ang target, agreed, bayad at utang pa, kasama ang susunod na bayarin at due dates — may tawag-pansin ang overdue.',
      ],
    },
    different: {
      en: [
        'Only finalized bookings count, so a quote you are still weighing is never counted as spent.',
        'The suggested split starts from typical Filipino event costs and says plainly when a figure is a rough estimate.',
        'Setnayan records your budget only. You pay suppliers directly; it never holds or moves your money.',
        'A supplier can see a rounded range for their own category only if you allow it. It is off by default.',
      ],
      tl: [
        'Ang finalized bookings lang ang binibilang, kaya ang quote na pinag-iisipan mo pa ay hindi kailanman ituturing na gastos.',
        'Ang suggested split ay galing sa karaniwang gastos sa mga Pinoy na event, at sinasabi kung tantiya lang ang isang halaga.',
        'Ire-record lang ng Setnayan ang budget mo. Direkta kang magbabayad sa supplier; hindi nito hinahawakan o ginagalaw ang pera mo.',
        'Makikita ng supplier ang rounded range ng sarili nilang category kung papayagan mo lang. Naka-off ito bilang default.',
      ],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Book a supplier you found and their line items land in your budget.', tl: 'I-book ang supplier na nahanap mo at mapupunta sa budget mo ang line items nila.' } },
      { slug: 'guest-list', how: { en: 'Guest numbers sit beside your costs, so catering is planned on the same count.', tl: 'Magkatabi ang bilang ng bisita at gastos, kaya iisang bilang ang gamit sa catering.' } },
      { slug: 'setnayan-ai', how: { en: 'Setnayan AI watches your budget and flags what needs you.', tl: 'Binabantayan ng Setnayan AI ang budget mo at sinasabi kung ano ang kailangan ng atensyon.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free event budget planner in the Philippines?', a: 'Yes. Setnayan Budget is included with every account. Set your total in pesos, take a suggested split, and log payments. Nothing to buy and nothing that expires.' },
        { q: 'Where do the suggested amounts come from?', a: 'From typical Filipino event costs, as a starting point. Each category shows a suggested amount and a typical range. Choose Save, Standard or Splurge, or type your own.' },
        { q: 'Does a supplier quote show up in my budget?', a: 'Not until you book them. The budget shows finalized money only. Suppliers you are still comparing stay in the Marketplace.' },
        { q: 'Does Setnayan handle my payments?', a: 'No. You pay suppliers directly and log each payment here. Setnayan records your budget and never holds or moves your money.' },
      ],
      tl: [
        { q: 'May libreng budget planner ba sa Pilipinas para sa event?', a: 'Meron. Kasama ang Setnayan Budget sa bawat account. I-set ang total sa piso, kumuha ng suggested split, at i-log ang mga bayad. Walang bibilhin at walang expiry.' },
        { q: 'Saan galing ang suggested amounts?', a: 'Galing sa karaniwang gastos sa mga Pinoy na event, bilang panimula. May suggested amount at typical range ang bawat category. Pumili ng Save, Standard o Splurge, o mag-type ng sarili mo.' },
        { q: 'Lalabas ba sa budget ang quote ng supplier?', a: 'Hindi hangga’t hindi mo sila na-bo-book. Finalized na pera lang ang ipinapakita. Ang mga pinag-iisipan pa ay nasa Marketplace.' },
        { q: 'Hinahawakan ba ng Setnayan ang bayad ko?', a: 'Hindi. Direkta kang nagbabayad sa supplier at nila-log mo dito. Nire-record lang ng Setnayan ang budget mo at hindi hinahawakan o ginagalaw ang pera.' },
      ],
    },
    keywords: {
      en: ['event budget planner Philippines', 'wedding budget in pesos', 'free budget planner', 'track supplier payments', 'debut budget'],
      tl: ['budget planner para sa event', 'budget ng kasal sa piso', 'libreng budget planner', 'bayad sa supplier'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/budget',
    evidence: ['app/(shell)/budget/page.tsx', 'lib/budget.ts', 'lib/budget-ledger.ts', 'app/dashboard/[eventId]/budget/page.tsx'],
  },
  {
    slug: 'guest-list',
    group: 'plan',
    icon: 'guests',
    name: { en: 'Guest list', tl: 'Guest list' },
    line: { en: 'Every guest, one row — RSVP, plus-one, role, table and QR.', tl: 'Bawat bisita, isang row — RSVP, plus-one, role, table at QR.' },
    title: { en: 'Free Guest List and RSVP Tracker', tl: 'Libreng Guest List at RSVP Tracker' },
    description: {
      en: 'Keep every guest in one list with RSVP, plus-one, meal, role and table. Each guest gets a personal link and QR. Free with every Setnayan account.',
      tl: 'Isang listahan ang lahat ng bisita, may RSVP, plus-one, pagkain, role at table. May personal link at QR ang bawat bisita. Libre sa bawat Setnayan account.',
    },
    answer: {
      en: 'Setnayan Guest list is a free guest list and RSVP tracker for any event. Each guest is one row with their RSVP, plus-one, meal, role and table, and a personal link and QR code. Guests reply in a tap and your list updates live.',
      tl: 'Ang Setnayan Guest list ay libreng guest list at RSVP tracker para sa kahit anong event. Isang row ang bawat bisita, may RSVP, plus-one, pagkain, role at table, at personal na link at QR code. Sumasagot ang bisita sa isang tap at live ang update ng listahan.',
    },
    forWho: {
      en: 'Hosts tired of a spreadsheet, a notes app and a group chat all holding different versions of who is coming.',
      tl: 'Para sa mga host na pagod na sa spreadsheet, notes app at group chat na magkakaiba ang bersyon kung sino ang darating.',
    },
    steps: {
      en: [
        'Type a name and press Enter, paste your spreadsheet, or pick from people already in your account. Give each guest a side, role and group.',
        'Share each guest’s personal link or QR, or one join link for everyone. Guests tap Yes, No or Maybe and pick a meal.',
        'Give each guest a table, and on the day check in who actually came. The list stays open afterwards for thank-yous.',
      ],
      tl: [
        'Mag-type ng pangalan at pindutin ang Enter, i-paste ang spreadsheet, o pumili sa mga tao sa account mo. Bigyan ang bawat bisita ng side, role at group.',
        'Ibahagi ang personal link o QR ng bawat bisita, o isang join link para sa lahat. Magta-tap ang bisita ng Yes, No o Maybe at pipili ng pagkain.',
        'Bigyan ng table ang bawat bisita, at sa mismong araw i-check in kung sino ang dumating. Bukas pa rin ang listahan pagkatapos para sa thank-yous.',
      ],
    },
    different: {
      en: [
        'Guests need no app and no account. A personal link or a QR is enough to reply.',
        'Filipino roles are built in: principal sponsors, ninong, ninang, bearers, maid of honor, best man and more.',
        'Tick “Allow plus-one” and a linked second row appears with its own QR.',
        'The same list feeds your seat plan, your Event Hub and the door, so nothing is typed twice.',
      ],
      tl: [
        'Hindi kailangan ng app o account ng bisita. Sapat na ang personal link o QR para sumagot.',
        'Kasama na ang mga Pinoy na role: principal sponsors, ninong, ninang, bearers, maid of honor, best man at iba pa.',
        'I-tick ang “Allow plus-one” at may lalabas na ikalawang row na may sariling QR.',
        'Iisang listahan ang pinagkukunan ng seat plan, Event Hub at pinto, kaya walang inuulit na pag-type.',
      ],
    },
    worksWith: [
      { slug: 'seat-plan', how: { en: 'Every guest on the list is ready to drag into a seat.', tl: 'Handa nang i-drag sa upuan ang bawat bisita sa listahan.' } },
      { slug: 'event-hub', how: { en: 'Guests RSVP on your Event Hub and your list updates.', tl: 'Sumasagot ang bisita sa Event Hub mo at nag-a-update ang listahan.' } },
      { slug: 'budget', how: { en: 'Your headcount sits beside your costs.', tl: 'Magkatabi ang bilang ng bisita at ang gastos.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free guest list app in the Philippines?', a: 'Yes. Setnayan Guest list is free with every account. It tracks RSVP, plus-ones, meals, roles and tables for any event, with nothing to buy.' },
        { q: 'How do guests RSVP?', a: 'Each guest opens their personal link or scans their QR, then taps Yes, No or Maybe. If you ask about meals they pick theirs there too, with a note for allergies.' },
        { q: 'Can I import my existing list?', a: 'Yes. Tap + and choose Import a file, or type a name and press Enter. You can also pick from people already in your account.' },
        { q: 'Does it know Filipino wedding roles?', a: 'Yes. Principal sponsors, candle, veil and cord sponsors, ninong, ninang, bearers, flower girl, maid of honor, best man and more are ready to assign.' },
      ],
      tl: [
        { q: 'May libreng guest list app ba sa Pilipinas?', a: 'Meron. Libre ang Setnayan Guest list sa bawat account. Sinusubaybayan nito ang RSVP, plus-one, pagkain, role at table para sa kahit anong event, at walang bibilhin.' },
        { q: 'Paano sumasagot ang mga bisita?', a: 'Bubuksan ng bisita ang personal link o i-scan ang QR, tapos mag-tap ng Yes, No o Maybe. Kung nagtatanong ka tungkol sa pagkain, doon na rin sila pipili, may note para sa allergy.' },
        { q: 'Puwede ko bang i-import ang kasalukuyang listahan ko?', a: 'Puwede. I-tap ang + at piliin ang Import a file, o mag-type ng pangalan at pindutin ang Enter. Puwede ring pumili sa mga tao sa account mo.' },
        { q: 'Alam ba nito ang mga Pinoy na role sa kasal?', a: 'Oo. Principal sponsors, candle, veil at cord sponsors, ninong, ninang, bearers, flower girl, maid of honor, best man at iba pa ay handang i-assign.' },
      ],
    },
    keywords: {
      en: ['free guest list app Philippines', 'RSVP tracker', 'wedding guest list', 'debut guest list', 'ninong ninang list'],
      tl: ['libreng guest list', 'RSVP tracker', 'listahan ng bisita', 'guest list ng kasal'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/guest-list',
    evidence: ['app/(shell)/guest-list/page.tsx', 'lib/guests.ts', 'lib/guest-parse.ts', 'app/dashboard/[eventId]/guests/page.tsx'],
  },
  {
    slug: 'seat-plan',
    group: 'plan',
    icon: 'seat',
    name: { en: 'Seat plan', tl: 'Seat plan' },
    line: { en: 'Lay out your tables and seat every guest — free.', tl: 'I-layout ang mga table at paupuin ang bawat bisita — libre.' },
    title: { en: 'Free Seating Chart Maker', tl: 'Libreng Seating Chart Maker' },
    description: {
      en: 'Draw your room, drag guests into chairs or let Auto Arrange seat them, keep people apart, and print table signs and place cards. Free.',
      tl: 'Iguhit ang venue, i-drag ang bisita sa upuan o hayaang i-seat ng Auto Arrange, paghiwalayin ang dapat, at i-print ang table signs at place cards. Libre.',
    },
    answer: {
      en: 'Setnayan Seat plan is a free seating chart maker. You draw your tables, stage, entrance and dance floor, then drag each guest into a chair or let Auto Arrange seat everyone who has not declined.',
      tl: 'Ang Setnayan Seat plan ay libreng seating chart maker. Iguguhit mo ang mga table, stage, entrance at dance floor, tapos i-drag ang bawat bisita sa upuan o hayaang i-seat ng Auto Arrange ang lahat ng hindi tumanggi.',
    },
    forWho: {
      en: 'Hosts and coordinators who need every guest in a chair they can see, and a chart that survives late confirmations.',
      tl: 'Para sa mga host at coordinator na kailangang makita ang bawat bisita sa upuan, at chart na hindi masisira ng late na kumpirmasyon.',
    },
    steps: {
      en: [
        'Pick a room size, or take the one your booked venue gave, then add tables, the stage, the entrance and the dance floor.',
        'Drag a guest onto a table, or let Auto Arrange do it. Keep some guests apart, keep groups together, and choose who sits nearest the stage.',
        'Print the chart as a PDF with table signs and place cards, and hand your caterer the meal counts.',
      ],
      tl: [
        'Pumili ng laki ng kuwarto, o gamitin ang bigay ng na-book mong venue, tapos idagdag ang mga table, stage, entrance at dance floor.',
        'I-drag ang bisita sa table, o hayaang gawin ng Auto Arrange. Paghiwalayin ang dapat, pagsamahin ang mga grupo, at piliin kung sino ang pinakamalapit sa stage.',
        'I-print ang chart bilang PDF na may table signs at place cards, at ibigay sa caterer ang meal counts.',
      ],
    },
    different: {
      en: [
        'It is complete and free. You can run your whole event on it.',
        'A keep-apart rule is only visible to you and is honored, including for whole groups.',
        'New guests get a provisional seat as they confirm, so the chart is not redrawn by hand.',
        'Your coordinator can re-arrange right up until the day, one editor at a time.',
      ],
      tl: [
        'Kumpleto at libre ito. Puwede mong patakbuhin ang buong event dito.',
        'Ang keep-apart rule ay ikaw lang ang nakakakita at sinusunod, pati ng buong grupo.',
        'May pansamantalang upuan ang bagong confirm na bisita, kaya hindi mo na guguhitin ulit ang chart.',
        'Puwedeng mag-ayos ang coordinator mo hanggang mismong araw, isang editor kada oras.',
      ],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'It seats the guests already on your list, with their roles and groups.', tl: 'Pinauupo nito ang mga bisitang nasa listahan mo, kasama ang role at group nila.' } },
      { slug: '3d-plan', how: { en: 'Your seat plan stands up into a 3D room you can walk.', tl: 'Ang seat plan mo ay nagiging 3D na kuwartong malalakad mo.' } },
      { slug: 'schedule', how: { en: 'The same event, planned as a floor and as a timeline.', tl: 'Iisang event, planado bilang floor at bilang timeline.' } },
    ],
    faq: {
      en: [
        { q: 'Is there a free seating chart maker?', a: 'Yes. Setnayan Seat plan is included with every account. It is free and complete, with no seat limit that blocks you.' },
        { q: 'Do I have to seat everyone by hand?', a: 'No. Build a seating draft to lay out the floor in one tap, then Auto Arrange seats everyone who has not declined. Drag anyone you want to move.' },
        { q: 'How do I keep two people apart?', a: 'Tell the plan to keep two guests apart and it seats them, and their whole groups, at different tables. Only you see that rule.' },
        { q: 'What can I print?', a: 'A PDF of the floor and tables, printable table signs and place cards, and a meal count per table for your caterer with dietary notes.' },
      ],
      tl: [
        { q: 'May libreng seating chart maker ba?', a: 'Meron. Kasama ang Setnayan Seat plan sa bawat account. Libre at kumpleto ito, walang limitasyon sa upuan na hahadlang sa iyo.' },
        { q: 'Kailangan ko bang i-seat nang mano-mano ang lahat?', a: 'Hindi. Gumawa ng seating draft para ma-layout ang floor sa isang tap, tapos i-seat ng Auto Arrange ang lahat ng hindi tumanggi. I-drag ang gusto mong ilipat.' },
        { q: 'Paano ko paghihiwalayin ang dalawang tao?', a: 'Sabihin sa plan na paghiwalayin ang dalawang bisita at ilalagay sila, pati ang buong grupo nila, sa magkaibang table. Ikaw lang ang nakakakita ng rule na iyon.' },
        { q: 'Ano ang puwede kong i-print?', a: 'PDF ng floor at mga table, printable na table signs at place cards, at meal count kada table para sa caterer na may dietary notes.' },
      ],
    },
    keywords: {
      en: ['free seating chart maker', 'wedding seating plan', 'table assignment', 'reception seating Philippines', 'place cards'],
      tl: ['libreng seating chart', 'seat plan ng kasal', 'upuan ng bisita', 'table assignment'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/seat-plan',
    evidence: ['app/(shell)/seat-plan/page.tsx', 'lib/seating.ts', 'lib/seating-pdf.ts', 'lib/seat-suggest.ts'],
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
      en: ['Lay out your tables in the free seat plan.', 'Switch to the 3D view and your flat plan stands up into a room you can walk.', 'Fix the tight aisle or blocked view while there is still time, and show others the exact room.'],
      tl: ['I-layout ang mga table sa libreng seat plan.', 'Lumipat sa 3D view at ang flat plan mo ay tatayo bilang kuwartong malalakad.', 'Ayusin ang masikip na aisle o nakaharang na view habang may oras pa, at ipakita sa iba ang eksaktong kuwarto.'],
    },
    different: {
      en: ['It builds on your seat plan, so there is no room to rebuild from scratch.', 'It runs in the browser with nothing to install.', 'You can walk your coordinator, family or stylist through the exact room.'],
      tl: ['Nakabase ito sa seat plan mo, kaya hindi mo kailangang buuin ang kuwarto mula sa simula.', 'Tumatakbo ito sa browser at walang ii-install.', 'Maaari mong ilibot ang coordinator, pamilya o stylist sa eksaktong kuwarto.'],
    },
    worksWith: [
      { slug: 'seat-plan', how: { en: 'It reads your tables and dance floor straight from the seat plan.', tl: 'Binabasa nito ang mga table at dance floor mula mismo sa seat plan.' } },
      { slug: 'mood-board', how: { en: 'People in the room wear the colors you set for their role.', tl: 'Ang mga tao sa kuwarto ay suot ang kulay na itinakda mo para sa role nila.' } },
    ],
    faq: {
      en: [
        { q: 'Do I build the 3D room from scratch?', a: 'No. It builds on the seat plan you already make. Switch to the 3D view and your plan stands up into a room.' },
        { q: 'Is 3D Plan free?', a: 'Yes. The seat plan and 3D Plan are both free.' },
        { q: 'What can I catch with it?', a: 'What a flat chart hides: a view blocked by a pillar, a path too tight for a gown, a head table that looks smaller than you pictured.' },
        { q: 'Does it need a special device?', a: 'No. It runs in the browser on the phone or laptop you already use.' },
      ],
      tl: [
        { q: 'Kailangan ko bang buuin ang 3D na kuwarto mula sa simula?', a: 'Hindi. Nakabase ito sa seat plan na ginagawa mo na. Lumipat sa 3D view at tatayo ang plan mo bilang kuwarto.' },
        { q: 'Libre ba ang 3D Plan?', a: 'Oo. Libre ang seat plan at ang 3D Plan.' },
        { q: 'Ano ang makikita ko dito?', a: 'Ang itinatago ng flat na chart: view na nakaharang ang haligi, daanang masikip para sa gown, head table na mukhang mas maliit kaysa inakala mo.' },
        { q: 'Kailangan ba ng espesyal na device?', a: 'Hindi. Tumatakbo ito sa browser ng telepono o laptop na gamit mo na.' },
      ],
    },
    keywords: {
      en: ['3D venue layout', 'virtual reception layout', 'wedding 3D seating plan', 'walkthrough your venue'],
      tl: ['3D na layout ng venue', '3D seat plan', 'libreng 3D plan'],
    },
    shots: [],
    price: { kind: 'free' },
    tryHref: '/pa3d/try',
    moreHref: '/pa3d',
    evidence: ['app/(shell)/pa3d/page.tsx', 'app/(shell)/pa3d/try/page.tsx', 'lib/seating-3d.ts'],
  },
  {
    slug: 'schedule',
    group: 'plan',
    icon: 'schedule',
    name: { en: 'Schedule', tl: 'Schedule' },
    line: { en: 'Your day, block by block, live for guests and suppliers.', tl: 'Ang araw mo, block por block, live para sa bisita at supplier.' },
    title: { en: 'Event Day Schedule and Run-of-Show', tl: 'Schedule at Run-of-Show ng Event' },
    description: {
      en: 'Build your day-of timeline with times, places and who is responsible. Show blocks to guests, shift everything when you run late. Free.',
      tl: 'Buuin ang timeline ng araw mo na may oras, lugar at responsable. Ipakita ang blocks sa bisita, at ilipat lahat kapag na-late. Libre.',
    },
    answer: {
      en: 'Setnayan Schedule is the run-of-show for your event, free with every account. You add blocks like ceremony, cocktails and dinner, each with a time, a place and who is responsible. Blocks you choose show on your guests’ invitation site with a live “happening now”.',
      tl: 'Ang Setnayan Schedule ang run-of-show ng event mo, libre sa bawat account. Nagdadagdag ka ng blocks gaya ng ceremony, cocktails at dinner, bawat isa may oras, lugar at responsable. Ang blocks na pipiliin mo ay lalabas sa invitation site ng bisita na may live na “happening now”.',
    },
    forWho: {
      en: 'Hosts and coordinators who want one timeline that guests, suppliers and the emcee all read from.',
      tl: 'Para sa mga host at coordinator na gustong iisang timeline ang binabasa ng bisita, supplier at emcee.',
    },
    steps: {
      en: ['Add blocks, or load a run-of-show template. Give each a time, place and notes.', 'Name who is responsible and tag booked suppliers. Switch on Show to guests for blocks that belong on the invitation site.', 'On the day, start the next block. Running late? Shift a block and everything after it, durations kept.'],
      tl: ['Magdagdag ng blocks, o mag-load ng run-of-show template. Bigyan ang bawat isa ng oras, lugar at notes.', 'Ilagay kung sino ang responsable at i-tag ang na-book na supplier. I-on ang Show to guests para sa blocks na dapat nasa invitation site.', 'Sa mismong araw, simulan ang susunod na block. Na-late? Ilipat ang isang block at lahat ng kasunod, buo ang haba.'],
    },
    different: {
      en: ['Guests see only the blocks you choose to show, with a live “happening now” highlight.', 'Shift one block and everything after it moves, with every duration kept.', 'Suppliers can suggest changes but never edit your timeline; you accept or decline.', 'The same program compiles into a ready-to-read emcee script.'],
      tl: ['Ang bisita ay makikita lang ang blocks na pinili mong ipakita, na may live na “happening now”.', 'Ilipat ang isang block at gumagalaw ang lahat ng kasunod, buo ang bawat haba.', 'Puwedeng magmungkahi ang supplier pero hindi nila mababago ang timeline mo; ikaw ang tatanggap o tatanggi.', 'Ang parehong programa ay nagiging handang basahing script para sa emcee.'],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'Public blocks appear on your Event Hub.', tl: 'Lumalabas sa Event Hub mo ang public na blocks.' } },
      { slug: 'marketplace', how: { en: 'Tag a booked supplier on a block and it shows in their own run-of-show.', tl: 'I-tag ang na-book na supplier sa block at lalabas ito sa sarili nilang run-of-show.' } },
      { slug: 'seat-plan', how: { en: 'The floor and the timeline describe the same event.', tl: 'Iisang event ang inilalarawan ng floor at ng timeline.' } },
    ],
    faq: {
      en: [
        { q: 'What is a run-of-show?', a: 'It is the day-of timeline. Setnayan Schedule lets you build it block by block with times, places and who is responsible.' },
        { q: 'Is the schedule free?', a: 'Yes. It is included with every Setnayan account.' },
        { q: 'Who can see my schedule?', a: 'Only what you choose. Each block has a Show to guests switch. Hidden blocks stay private.' },
        { q: 'What if the day runs late?', a: 'Shift a block and everything after it moves by the same amount with durations kept. The header shows whether you are ahead, behind or on time.' },
      ],
      tl: [
        { q: 'Ano ang run-of-show?', a: 'Ito ang timeline ng mismong araw. Sa Setnayan Schedule, bubuuin mo ito block por block na may oras, lugar at responsable.' },
        { q: 'Libre ba ang schedule?', a: 'Oo. Kasama ito sa bawat Setnayan account.' },
        { q: 'Sino ang nakakakita ng schedule ko?', a: 'Ang pinili mo lang. May Show to guests na switch ang bawat block. Pribado ang mga nakatagong block.' },
        { q: 'Paano kung ma-late ang araw?', a: 'Ilipat ang isang block at lahat ng kasunod ay susunod sa parehong dami, buo ang haba. Ipinapakita ng header kung advance, late o on time ka.' },
      ],
    },
    keywords: {
      en: ['run of show template', 'wedding day timeline', 'event schedule maker', 'program of events Philippines'],
      tl: ['run of show', 'timeline ng kasal', 'schedule ng event'],
    },
    shots: [{ src: '/demo/maria-jose/ceremony.webp', alt: { en: 'A bride and groom kneeling before the altar of a candlelit stone church', tl: 'Ikinasal na magkasintahang nakaluhod sa harap ng altar ng kandilang-ilaw na batong simbahan' } }],
    price: { kind: 'free' },
    moreHref: '/schedule',
    evidence: ['app/(shell)/schedule/page.tsx', 'lib/schedule.ts', 'lib/schedule-run-of-show.ts', 'app/dashboard/[eventId]/schedule/page.tsx'],
  },
];
