import type { FeaturePageEntry } from './types';

/**
 * Invite & gather — Event Hub · Dress code · Wedding March · E-Gifts · Prints ·
 * Logo Maker · Music Maker · Groups.
 *
 * Refreshed 2026-10-18 against `origin/main`:
 *   · Event Hub — five stages (`lib/public-site-stage-labels.ts`, the Maker's
 *     page list in `app/dashboard/[eventId]/launch/_components/maker-bar.ts`);
 *     drafts reach guests only at Apply (`lib/hub-draft.ts`); two hosts' saves
 *     merge (`lib/merge-from-base.ts`, `lib/hub-draft-authors.ts`); Pro ◆ is
 *     every Animate control, part style, accent and opening (#6623). The phone
 *     "Stages | Studio" frame is flag-gated, so nothing here depends on it.
 *   · Dress code · Wedding March · E-Gifts · Prints — NEW pages for shipped
 *     Studio tools that had none. E-Gifts' guest page is behind
 *     `PABUYA_PUBLIC_ROUTE_ENABLED`; it answered 200 in production on
 *     2026-10-18, so it is described as live.
 *   · Music Maker — "cleared for sharing" is NOT claimed: the licence is not
 *     something the code can show.
 *   · Logo Maker — the layered editor (`lib/logo-layers.ts`), not "describe the feel".
 */
export const INVITE_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'event-hub',
    group: 'invite',
    icon: 'hub',
    name: { en: 'Event Hub', tl: 'Event Hub' },
    line: { en: 'One link that changes with your event — from save-the-date to after.', tl: 'Isang link na sumasabay sa event mo — mula save-the-date hanggang pagkatapos.' },
    title: { en: 'Event Hub: One Link for Your Event', tl: 'Event Hub: Isang Link para sa Event Mo' },
    description: {
      en: 'One address for your save-the-date, RSVP, invitation, the day itself and after. Guests reply in a tap. Free to start, with an optional Pro.',
      tl: 'Isang address para sa save-the-date, RSVP, imbitasyon, mismong araw at pagkatapos. Isang tap ang sagot ng bisita. Libreng simulan, may optional na Pro.',
    },
    answer: {
      en: 'Setnayan Event Hub is one link for your whole event. It moves through five stages — Save the Date, RSVP, Invitation, The Day and Post Event — so guests always see what matters now. You shape each stage in the Event Hub Maker, and nothing reaches guests until you press Apply.',
      tl: 'Ang Setnayan Event Hub ay isang link para sa buong event mo. Dumadaan ito sa limang stage — Save the Date, RSVP, Invitation, The Day at Post Event — kaya laging nakikita ng bisita ang mahalaga ngayon. Hinuhubog mo ang bawat stage sa Event Hub Maker, at walang makakarating sa bisita hangga’t hindi mo pinipindot ang Apply.',
    },
    forWho: {
      en: 'Hosts who want one beautiful address instead of a string of messages, and who do not want to design or code anything.',
      tl: 'Para sa mga host na gustong isang magandang address imbes na sunod-sunod na mensahe, at ayaw mag-design o mag-code.',
    },
    steps: {
      en: [
        'Add your names, date and venues, and pick a theme. Your Event Hub composes itself from what you already entered.',
        'Open any stage in the Maker and change its words, look and parts: schedule, dress code, entourage, love story, E-Gifts, find your seat and more. Preview, then Apply.',
        'Share one address. Guests reply, find their seat, and on the day watch the live stream and photos from the same link.',
      ],
      tl: [
        'Idagdag ang pangalan, petsa at venues ninyo, at pumili ng theme. Bubuo nang mag-isa ang Event Hub mula sa mga nailagay mo na.',
        'Buksan ang kahit anong stage sa Maker at baguhin ang salita, itsura at mga bahagi nito: schedule, dress code, entourage, love story, E-Gifts, find your seat at iba pa. I-preview, tapos Apply.',
        'Magbahagi ng isang address. Sumasagot ang bisita, hinahanap ang upuan nila, at sa mismong araw ay nanonood ng live stream at mga litrato mula sa parehong link.',
      ],
    },
    different: {
      en: [
        'Each stage shows what guests need at that moment, from the save-the-date film to the story after the day.',
        'Nothing is half-published: edits stay a draft until you Apply, and Undo takes back your own steps.',
        'Two hosts can edit at once. Saves merge instead of wiping each other, and a note names who changed what.',
        'Guests need no app and no account.',
        'Free covers the words, colours, three themes and RSVP. ◆ Pro adds animation, openings such as the sheer veil, photo and video backgrounds, music and seven more themes — for everyone on your event.',
      ],
      tl: [
        'Ipinapakita ng bawat stage ang kailangan ng bisita sa sandaling iyon, mula sa save-the-date film hanggang sa kuwento pagkatapos ng araw.',
        'Walang kalahating naka-publish: nananatiling draft ang mga edit hangga’t hindi ka nag-a-Apply, at binabawi ng Undo ang sarili mong mga hakbang.',
        'Puwedeng sabay mag-edit ang dalawang host. Pinagsasama ang mga save imbes na mabura ang isa, at may note na nagsasabi kung sino ang nagbago.',
        'Hindi kailangan ng app o account ng bisita.',
        'Kasama sa libre ang salita, kulay, tatlong theme at RSVP. Idinadagdag ng ◆ Pro ang animation, mga opening gaya ng sheer veil, photo at video backgrounds, musika at pito pang theme — para sa lahat ng nasa event mo.',
      ],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'Replies on your Event Hub land in your guest list.', tl: 'Ang sagot sa Event Hub ay napupunta sa guest list mo.' } },
      { slug: 'schedule', how: { en: 'Visible moments show here with a live “happening now”.', tl: 'Lumalabas dito ang mga visible na sandali na may live na “happening now”.' } },
      { slug: 'dress-code', how: { en: 'Each guest with a role sees what to wear and when to arrive.', tl: 'Nakikita ng bawat bisitang may role kung ano ang isusuot at kailan darating.' } },
      { slug: 'e-gifts', how: { en: 'Your E-Gifts and wish list open from the same link.', tl: 'Bumubukas sa parehong link ang E-Gifts at wish list mo.' } },
      { slug: 'live-watch', how: { en: 'Guests watch your live stream right on it.', tl: 'Mapapanood ng bisita ang live stream mismo dito.' } },
    ],
    faq: {
      en: [
        { q: 'What are the five stages?', a: 'Save the Date, RSVP, Invitation, The Day and Post Event. Each one shows guests what matters at that time, from one address.' },
        { q: 'Do I need to design or code anything?', a: 'No. Fill in your details and it composes itself. Change anything in the Maker, preview it, and press Apply.' },
        { q: 'Can my partner and I edit at the same time?', a: 'Yes. Your saves merge, a note tells you when the other host changed something, and Undo only takes back your own steps.' },
        { q: 'Is it free?', a: 'You can start free with three themes, your words, colours and RSVP. The optional ◆ Pro upgrade is priced in the live catalogue and covers everyone on your event.' },
      ],
      tl: [
        { q: 'Ano ang limang stage?', a: 'Save the Date, RSVP, Invitation, The Day at Post Event. Ipinapakita ng bawat isa ang mahalaga sa bisita sa panahong iyon, mula sa iisang address.' },
        { q: 'Kailangan ko bang mag-design o mag-code?', a: 'Hindi. Punan ang detalye at bubuo ito nang mag-isa. Baguhin ang kahit ano sa Maker, i-preview, at pindutin ang Apply.' },
        { q: 'Puwede ba kaming sabay mag-edit ng partner ko?', a: 'Puwede. Pinagsasama ang mga save ninyo, may note kapag may binago ang isa pang host, at ang sarili mo lang na hakbang ang binabawi ng Undo.' },
        { q: 'Libre ba ito?', a: 'Puwedeng magsimula nang libre na may tatlong theme, sariling salita, kulay at RSVP. Ang optional na ◆ Pro upgrade ay nasa live catalogue ang presyo at para sa lahat ng nasa event mo.' },
      ],
    },
    keywords: {
      en: ['online invitation Philippines', 'event page with RSVP', 'digital wedding invitation', 'save the date page'],
      tl: ['event page ng kasal', 'online na imbitasyon', 'RSVP page'],
    },
    shots: [
      {
        src: '/feature-shots/event-hub-0.jpg',
        alt: {
          en: 'The Event Hub Maker on a phone: the Invitation stage’s Home with the couple’s names and date, and the parts of the page below',
          tl: 'Ang Event Hub Maker sa telepono: ang Home ng Invitation stage na may pangalan at petsa ng magkasintahan, at ang mga bahagi ng page sa ibaba',
        },
      },
    ],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['COUPLE_WEBSITE_PRO'] },
    tryHref: '/pawebsite',
    moreHref: '/pawebsite',
    evidence: [
      'app/(shell)/pawebsite/page.tsx',
      'app/dashboard/[eventId]/launch/_components/maker-bar.ts',
      'lib/public-site-stage-labels.ts',
      'lib/hub-draft.ts',
      'lib/merge-from-base.ts',
      'lib/hub-draft-authors.ts',
      'lib/website-pro-items.ts',
      'lib/hub-veil.ts',
      'lib/studio-apps.ts',
    ],
  },
  {
    slug: 'dress-code',
    group: 'invite',
    icon: 'shirt',
    name: { en: 'Dress code', tl: 'Dress code' },
    line: { en: 'What each role wears, and when they arrive.', tl: 'Ano ang suot ng bawat role, at kailan sila darating.' },
    title: { en: 'Dress Code and Call Times for Each Role', tl: 'Dress Code at Call Time ng Bawat Role' },
    description: {
      en: 'Set a style, colours and a call time for each role — barong, filipiniana, long gown and more — and every guest sees their own. Free.',
      tl: 'Magtakda ng style, kulay at call time sa bawat role — barong, filipiniana, long gown at iba pa — at makikita ng bawat bisita ang sa kanila. Libre.',
    },
    answer: {
      en: 'Setnayan Dress code lets you give each role or group a style, its colours and a call time. Every guest then sees their own: their role, what to wear and when to arrive. It is free and lives with your Mood Board.',
      tl: 'Sa Setnayan Dress code, mabibigyan mo ang bawat role o group ng style, kulay at call time. Makikita ng bawat bisita ang sa kanila: ang role nila, ano ang isusuot at kailan darating. Libre ito at kasama ng Mood Board mo.',
    },
    forWho: {
      en: 'Hosts with an entourage, sponsors and family who all need different instructions, and who are tired of repeating them in group chats.',
      tl: 'Para sa mga host na may entourage, sponsors at pamilyang iba-iba ang kailangang bilin, at pagod nang ulit-ulitin ito sa group chats.',
    },
    steps: {
      en: [
        'Open Mood Board & Dress Code. Each role or group is a row.',
        'Pick a style — long gown, cocktail dress, filipiniana, barong tagalog, suit, formal or smart casual — its colours, and a call time.',
        'Guests open your Event Hub and see their role, what to wear and when to arrive. Nothing shows for a detail you left unset.',
      ],
      tl: [
        'Buksan ang Mood Board & Dress Code. Isang row ang bawat role o group.',
        'Pumili ng style — long gown, cocktail dress, filipiniana, barong tagalog, suit, formal o smart casual — ang kulay nito, at call time.',
        'Bubuksan ng bisita ang Event Hub mo at makikita ang role nila, ano ang isusuot at kailan darating. Walang lalabas sa detalyeng hindi mo pa itinakda.',
      ],
    },
    different: {
      en: [
        'Each guest sees only their own instructions, not a long list for everyone.',
        'Filipino attire is built in: barong tagalog and filipiniana sit beside gowns and suits.',
        'In the last month, a guest’s own checklist reminds them what to wear and when to arrive.',
        'The dress code is printed on each guest’s pass.',
      ],
      tl: [
        'Ang sarili lang niyang bilin ang nakikita ng bawat bisita, hindi mahabang listahan para sa lahat.',
        'Kasama na ang Pinoy na kasuotan: katabi ng gowns at suits ang barong tagalog at filipiniana.',
        'Sa huling buwan, ipinapaalala ng sariling checklist ng bisita kung ano ang isusuot at kailan darating.',
        'Nakaprint ang dress code sa pass ng bawat bisita.',
      ],
    },
    worksWith: [
      { slug: 'mood-board', how: { en: 'Role colours come straight from your palette.', tl: 'Galing mismo sa palette mo ang kulay ng bawat role.' } },
      { slug: 'guest-list', how: { en: 'A guest’s role on the list decides what they are told.', tl: 'Ang role ng bisita sa listahan ang nagpapasya kung ano ang sasabihin sa kanila.' } },
      { slug: 'event-hub', how: { en: 'Guests read their own dress code on your Event Hub.', tl: 'Binabasa ng bisita ang sarili nilang dress code sa Event Hub mo.' } },
      { slug: 'prints', how: { en: 'It is printed on each guest’s pass.', tl: 'Nakaprint ito sa pass ng bawat bisita.' } },
    ],
    faq: {
      en: [
        { q: 'Can sponsors and the entourage get different instructions?', a: 'Yes. Each role or group has its own style, colours and call time, and each guest sees only theirs.' },
        { q: 'What styles can I choose?', a: 'Long gown, cocktail dress, filipiniana, barong tagalog, suit, formal and smart casual.' },
        { q: 'Is it free?', a: 'Yes. The dress code and call times are free with every event.' },
      ],
      tl: [
        { q: 'Puwede bang magkaiba ang bilin sa sponsors at entourage?', a: 'Puwede. May sariling style, kulay at call time ang bawat role o group, at ang sa kanila lang ang nakikita ng bawat bisita.' },
        { q: 'Anong mga style ang puwede kong piliin?', a: 'Long gown, cocktail dress, filipiniana, barong tagalog, suit, formal at smart casual.' },
        { q: 'Libre ba ito?', a: 'Oo. Libre ang dress code at call times sa bawat event.' },
      ],
    },
    keywords: {
      en: ['wedding dress code Philippines', 'entourage attire', 'call time for entourage', 'barong and filipiniana dress code'],
      tl: ['dress code ng kasal', 'kasuotan ng entourage', 'call time ng entourage'],
    },
    shots: [],
    price: { kind: 'free' },
    evidence: ['lib/role-dress-code.ts', 'app/[slug]/_components/dress-code-widget.tsx', 'lib/guest-checklist.ts', 'lib/print-layout.ts'],
  },
  {
    slug: 'wedding-march',
    group: 'invite',
    icon: 'march',
    name: { en: 'Wedding March', tl: 'Wedding March' },
    line: { en: 'Arrange who walks, with whom, in what order.', tl: 'Ayusin kung sino ang lalakad, kasama sino, at sa anong ayos.' },
    title: { en: 'Wedding March and Entourage Order Maker', tl: 'Wedding March at Ayos ng Entourage' },
    description: {
      en: 'Drag names into pairs and walks for your processional. Guests see the entourage on your Event Hub, and you can print it. Free.',
      tl: 'I-drag ang mga pangalan sa pares at lakad para sa processional. Makikita ng bisita ang entourage sa Event Hub mo, at puwede itong i-print. Libre.',
    },
    answer: {
      en: 'Setnayan Wedding March is where you set the processional: who walks, beside whom, and in what order. You drag names from your guest list into two columns, walk by walk, and the same order becomes the entourage your guests see and the card you print.',
      tl: 'Sa Setnayan Wedding March mo itinatakda ang processional: sino ang lalakad, katabi ng sino, at sa anong ayos. I-drag ang mga pangalan mula sa guest list papunta sa dalawang column, lakad por lakad, at ang parehong ayos ang nagiging entourage na nakikita ng bisita at card na ipi-print mo.',
    },
    forWho: {
      en: 'Couples and coordinators lining up parents, sponsors, bearers and the wedding party, who want one order everyone reads.',
      tl: 'Para sa mga magkasintahan at coordinator na nag-aayos ng magulang, sponsors, bearers at wedding party, at gustong iisang ayos ang binabasa ng lahat.',
    },
    steps: {
      en: [
        'Open Wedding March. Your entourage is already there from your guest list, grouped into sections such as the groom and his parents.',
        'Drag names between the left and right columns and from walk to walk. Someone can walk alone, or wait in Not walking.',
        'Preview, then Apply. Guests see the entourage on your Event Hub, and The Entourage card is ready to print.',
      ],
      tl: [
        'Buksan ang Wedding March. Nandoon na ang entourage mo mula sa guest list, naka-grupo sa mga seksyon gaya ng groom at mga magulang niya.',
        'I-drag ang mga pangalan sa kaliwa at kanang column at mula sa isang lakad papunta sa iba. Puwedeng lumakad nang mag-isa ang isang tao, o maghintay sa Not walking.',
        'I-preview, tapos Apply. Makikita ng bisita ang entourage sa Event Hub mo, at handang i-print ang The Entourage card.',
      ],
    },
    different: {
      en: [
        'It reads your guest list and roles, so nobody is typed twice.',
        'Moves stay a draft until you Apply, and Undo takes back a wrong drag.',
        'Tap any name to open that person’s guest card.',
        'One order feeds the Event Hub’s entourage and the printed card.',
      ],
      tl: [
        'Binabasa nito ang guest list at mga role mo, kaya walang tina-type nang dalawang beses.',
        'Nananatiling draft ang mga galaw hangga’t hindi ka nag-a-Apply, at binabawi ng Undo ang maling drag.',
        'I-tap ang kahit anong pangalan para buksan ang guest card ng taong iyon.',
        'Iisang ayos ang pinagkukunan ng entourage sa Event Hub at ng naka-print na card.',
      ],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'Your entourage comes from the roles on your guest list.', tl: 'Galing sa mga role sa guest list mo ang entourage.' } },
      { slug: 'event-hub', how: { en: 'Guests see the entourage on your Event Hub.', tl: 'Makikita ng bisita ang entourage sa Event Hub mo.' } },
      { slug: 'prints', how: { en: 'The Entourage card is one of your prints.', tl: 'Isa sa mga prints mo ang The Entourage card.' } },
    ],
    faq: {
      en: [
        { q: 'Do I type the entourage again?', a: 'No. It comes from the roles on your guest list. You only arrange who walks with whom.' },
        { q: 'Can someone walk alone?', a: 'Yes. Leave the other side empty and they walk alone, or move them to Not walking.' },
        { q: 'Can I print it?', a: 'Yes. The Entourage card is part of your invitation set.' },
      ],
      tl: [
        { q: 'Ita-type ko ba ulit ang entourage?', a: 'Hindi. Galing ito sa mga role sa guest list mo. Ang aayusin mo lang ay kung sino ang kasabay ng sino.' },
        { q: 'Puwede bang lumakad nang mag-isa ang isang tao?', a: 'Puwede. Iwanang bakante ang kabilang side at lalakad siyang mag-isa, o ilipat siya sa Not walking.' },
        { q: 'Puwede ko ba itong i-print?', a: 'Puwede. Bahagi ng invitation set mo ang The Entourage card.' },
      ],
    },
    keywords: {
      en: ['wedding march order', 'entourage list maker', 'processional order Philippines', 'wedding entourage card'],
      tl: ['ayos ng wedding march', 'listahan ng entourage', 'processional ng kasal'],
    },
    shots: [
      {
        src: '/feature-shots/wedding-march-0.jpg',
        alt: {
          en: 'The Wedding March on a phone: walks in two columns, the groom and his parents first, and the Not walking tray',
          tl: 'Ang Wedding March sa telepono: mga lakad sa dalawang column, una ang groom at mga magulang niya, at ang Not walking tray',
        },
      },
    ],
    price: { kind: 'free' },
    evidence: [
      'app/dashboard/[eventId]/launch/_components/details-march.tsx',
      'app/dashboard/[eventId]/launch/_components/details-march-tray.tsx',
      'lib/march-draft.ts',
      'lib/entourage.ts',
      'lib/print-pieces.ts',
    ],
  },
  {
    slug: 'e-gifts',
    group: 'invite',
    icon: 'refer',
    name: { en: 'E-Gifts', tl: 'E-Gifts' },
    line: { en: 'Gifts go straight to you — with a wish list guests can follow.', tl: 'Diretso sa iyo ang regalo — may wish list na masusundan ng bisita.' },
    title: { en: 'E-Gifts and Wish List for Your Event', tl: 'E-Gifts at Wish List para sa Event Mo' },
    description: {
      en: 'Guests send gifts straight to your own GCash, Maya, bank or PayPal, and follow your wish list. Setnayan never touches the money. Free.',
      tl: 'Diretsong nagpapadala ang bisita sa sarili mong GCash, Maya, bangko o PayPal, at sinusundan ang wish list mo. Hindi ginagalaw ng Setnayan ang pera. Libre.',
    },
    answer: {
      en: 'Setnayan E-Gifts shows guests how to give: your own GCash, Maya, bank or PayPal details with your QR, an optional registry link, and a wish list. Guests send the gift themselves, straight to you, and can show you what they sent. Setnayan never touches the money.',
      tl: 'Ipinapakita ng Setnayan E-Gifts sa bisita kung paano magbigay: ang sarili mong GCash, Maya, bangko o PayPal kasama ang QR mo, optional na registry link, at wish list. Ang bisita mismo ang magpapadala, diretso sa iyo, at puwede nilang ipakita sa iyo ang ipinadala nila. Hindi ginagalaw ng Setnayan ang pera.',
    },
    forWho: {
      en: 'Hosts who would rather receive gifts directly than collect envelopes, and guests who want to give something you actually want.',
      tl: 'Para sa mga host na mas gustong tumanggap ng regalo nang diretso kaysa mangolekta ng sobre, at sa mga bisitang gustong magbigay ng talagang gusto mo.',
    },
    steps: {
      en: [
        'Switch on gifts and add the ways to give — GCash, Maya, bank, PayPal or other — each with your QR.',
        'Add wishes with a name, price, photo, link and note, plus a thank-you message.',
        'Guests open E-Gifts from your Event Hub, send the gift themselves, and can show you a screenshot, the amount and a message.',
      ],
      tl: [
        'I-on ang gifts at idagdag ang mga paraan ng pagbibigay — GCash, Maya, bangko, PayPal o iba pa — bawat isa may QR mo.',
        'Magdagdag ng wishes na may pangalan, presyo, litrato, link at note, kasama ang thank-you message.',
        'Bubuksan ng bisita ang E-Gifts mula sa Event Hub mo, sila mismo ang magpapadala, at puwede nilang ipakita sa iyo ang screenshot, halaga at mensahe.',
      ],
    },
    different: {
      en: [
        'The money goes straight to your own accounts. Setnayan never holds it.',
        'A wish marks itself got once gifts sent for it reach its price, or you mark it yourself.',
        'Guests see only a running total per wish, never who gave what.',
        'What a guest shows you is recorded as sent — you are the one who knows it arrived.',
      ],
      tl: [
        'Diretso sa sarili mong account ang pera. Hindi ito hinahawakan ng Setnayan.',
        'Kusang namamarkahang nakuha na ang isang wish kapag umabot sa presyo nito ang mga ipinadala, o ikaw mismo ang magmamarka.',
        'Running total lang kada wish ang nakikita ng bisita, hindi kung sino ang nagbigay ng ano.',
        'Ang ipinapakita ng bisita ay nire-record bilang sent — ikaw ang nakakaalam kung dumating ito.',
      ],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'E-Gifts opens from your Event Hub.', tl: 'Bumubukas ang E-Gifts mula sa Event Hub mo.' } },
      { slug: 'guest-list', how: { en: 'You know which guest showed you a gift.', tl: 'Alam mo kung aling bisita ang nagpakita ng regalo.' } },
    ],
    faq: {
      en: [
        { q: 'Does Setnayan collect the money?', a: 'No. Guests send gifts straight to your own GCash, Maya, bank or PayPal. Setnayan never touches the money.' },
        { q: 'Can I add a registry from a store?', a: 'Yes. Paste the link to your registry and guests can open it from E-Gifts.' },
        { q: 'Can other guests see what someone gave?', a: 'No. Guests see only how close each wish is to its price, never who gave what.' },
        { q: 'Is it free?', a: 'Yes. E-Gifts and the wish list are free.' },
      ],
      tl: [
        { q: 'Kinokolekta ba ng Setnayan ang pera?', a: 'Hindi. Diretsong nagpapadala ang bisita sa sarili mong GCash, Maya, bangko o PayPal. Hindi ginagalaw ng Setnayan ang pera.' },
        { q: 'Puwede ba akong magdagdag ng registry mula sa isang tindahan?', a: 'Puwede. I-paste ang link ng registry mo at mabubuksan ito ng bisita mula sa E-Gifts.' },
        { q: 'Makikita ba ng ibang bisita ang ibinigay ng iba?', a: 'Hindi. Gaano na kalapit sa presyo ang bawat wish lang ang nakikita, hindi kung sino ang nagbigay ng ano.' },
        { q: 'Libre ba ito?', a: 'Oo. Libre ang E-Gifts at wish list.' },
      ],
    },
    keywords: {
      en: ['wedding cash gift GCash', 'wedding wish list Philippines', 'online gift registry', 'e-gift for debut'],
      tl: ['regalo sa kasal sa GCash', 'wish list ng kasal', 'e-gift'],
    },
    shots: [],
    price: { kind: 'free' },
    evidence: ['lib/egift.ts', 'lib/egift-kinds.ts', 'lib/wish-list.ts', 'lib/gift-record.ts', 'app/[slug]/pabuya/page.tsx'],
  },
  {
    slug: 'prints',
    group: 'invite',
    icon: 'printer',
    name: { en: 'Prints', tl: 'Prints' },
    line: { en: 'Your invitation set and day-of signs, ready to print.', tl: 'Ang invitation set at mga karatula sa araw, handang i-print.' },
    title: { en: 'Printable Invitations, Signs and Place Cards', tl: 'Printable na Imbitasyon, Karatula at Place Cards' },
    description: {
      en: 'Download your invitation set, guest passes, table signs, place cards, seat plan and QR sheets as print-ready files in your colours.',
      tl: 'I-download ang invitation set, guest pass, table signs, place cards, seat plan at QR sheets bilang print-ready na files sa kulay mo.',
    },
    answer: {
      en: 'Setnayan Prints turns what you already entered into files ready for your printer: an invitation set in your theme, and the signs and sheets for the day. Every piece downloads on its own for free, and the print-ready set is free in three themes.',
      tl: 'Ginagawang files na handa para sa printer mo ng Setnayan Prints ang mga nailagay mo na: invitation set sa theme mo, at mga karatula at sheets para sa araw. Libreng mada-download ang bawat piraso, at libre ang print-ready na set sa tatlong theme.',
    },
    forWho: {
      en: 'Hosts who want matching printed pieces without hiring a designer for each one.',
      tl: 'Para sa mga host na gustong magkakatugma ang mga naka-print nang hindi kumukuha ng designer sa bawat isa.',
    },
    steps: {
      en: [
        'Open Prints. The Invitation set holds the invitation, the entourage, the finer details with your program, the menu, each guest’s pass, posters and an event card.',
        'For the day: the guest list, guest QR codes twelve to a page, the seat plan, table signs and place cards, the entrance seating chart, the caterer’s meal counts and your event QR.',
        'Download a piece, or the whole set, and print it yourself or with your printer.',
      ],
      tl: [
        'Buksan ang Prints. Nasa Invitation set ang imbitasyon, ang entourage, ang finer details kasama ang programa, ang menu, ang pass ng bawat bisita, posters at event card.',
        'Para sa araw: ang guest list, guest QR codes na labindalawa bawat pahina, ang seat plan, table signs at place cards, ang entrance seating chart, ang meal counts ng caterer at ang event QR mo.',
        'I-download ang isang piraso, o ang buong set, at i-print mo mismo o sa printer mo.',
      ],
    },
    different: {
      en: [
        'Nothing is typed again: names, dates, roles, seats and QR codes come from your event.',
        'Each pass can be a calling card, a train ticket, a boarding pass or a phone card.',
        'Any single piece is free to download. ◆ Pro adds the Download all bundles and the print-ready set in the Pro themes.',
        'Setnayan makes the files; you choose where to print them.',
      ],
      tl: [
        'Walang tina-type ulit: galing sa event mo ang pangalan, petsa, role, upuan at QR codes.',
        'Ang bawat pass ay puwedeng calling card, train ticket, boarding pass o phone card.',
        'Libreng i-download ang kahit anong isang piraso. Idinadagdag ng ◆ Pro ang Download all bundles at ang print-ready na set sa mga Pro theme.',
        'Ang Setnayan ang gumagawa ng files; ikaw ang pipili kung saan ipi-print.',
      ],
    },
    worksWith: [
      { slug: 'seat-plan', how: { en: 'The seat plan, table signs and place cards print from it.', tl: 'Dito nagmumula ang naka-print na seat plan, table signs at place cards.' } },
      { slug: 'wedding-march', how: { en: 'The Entourage card prints your march.', tl: 'Ini-print ng The Entourage card ang march mo.' } },
      { slug: 'dress-code', how: { en: 'Each guest’s pass carries their dress code.', tl: 'Dala ng pass ng bawat bisita ang dress code nila.' } },
      { slug: 'event-hub', how: { en: 'Prints wear your Event Hub theme.', tl: 'Suot ng prints ang theme ng Event Hub mo.' } },
    ],
    faq: {
      en: [
        { q: 'Does Setnayan print and deliver?', a: 'No. Setnayan makes print-ready files; you print them yourself or with the printer you choose.' },
        { q: 'What is free?', a: 'Every single piece downloads free, and the print-ready set is free in the Classic, Modern and Cyber Neon themes. ◆ Pro adds the Download all bundles and the other themes.' },
        { q: 'Do the prints have QR codes?', a: 'Yes. Guest passes, table signs and the guest QR sheets carry each guest’s or table’s own code.' },
      ],
      tl: [
        { q: 'Nagpi-print at nagde-deliver ba ang Setnayan?', a: 'Hindi. Gumagawa ang Setnayan ng print-ready na files; ikaw ang magpi-print o ang printer na pipiliin mo.' },
        { q: 'Ano ang libre?', a: 'Libreng mada-download ang bawat isang piraso, at libre ang print-ready na set sa Classic, Modern at Cyber Neon na theme. Idinadagdag ng ◆ Pro ang Download all bundles at ang iba pang theme.' },
        { q: 'May QR codes ba ang prints?', a: 'Oo. May sariling code ng bisita o table ang guest pass, table signs at guest QR sheets.' },
      ],
    },
    keywords: {
      en: ['printable wedding invitation', 'table signs and place cards', 'wedding invitation set Philippines', 'guest QR code cards'],
      tl: ['printable na imbitasyon', 'table signs at place cards', 'invitation set ng kasal'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['COUPLE_WEBSITE_PRO'] },
    evidence: ['lib/print-pieces.ts', 'lib/free-prints.ts', 'lib/studio-prints-six.ts', 'app/api/hub-print/[piece]/route.ts'],
  },
  {
    slug: 'logo-maker',
    group: 'invite',
    icon: 'logo',
    name: { en: 'Logo Maker', tl: 'Logo Maker' },
    line: { en: 'Your own event logo, in layers you can move and animate.', tl: 'Sariling logo ng event, sa mga layer na puwedeng igalaw at i-animate.' },
    title: { en: 'Wedding Monogram and Logo Maker', tl: 'Monogram at Logo Maker sa Kasal' },
    description: {
      en: 'Build your event logo from text, image and frame layers, then let each layer draw on, rise or fade. The animated logo is an upgrade.',
      tl: 'Buuin ang logo ng event mula sa text, image at frame layers, tapos hayaang mag-draw on, umangat o mag-fade ang bawat layer. Upgrade ang animated na logo.',
    },
    answer: {
      en: 'Setnayan Logo Maker builds your event logo from layers: text in the studio’s typefaces, an image, and a frame. Each layer can move — draw on, rise or fade in, then stay still or drift. The logo signs your Event Hub, and the animated version is an upgrade.',
      tl: 'Binubuo ng Setnayan Logo Maker ang logo ng event mo mula sa mga layer: text sa mga typeface ng studio, isang image, at frame. Puwedeng gumalaw ang bawat layer — mag-draw on, umangat o mag-fade in, tapos manatili o dahan-dahang gumalaw. Lumalagda ang logo sa Event Hub mo, at upgrade ang animated na bersyon.',
    },
    forWho: {
      en: 'Hosts who want one mark across their Event Hub, QR codes and screens, with no design skills.',
      tl: 'Para sa mga host na gusto ng iisang tatak sa Event Hub, QR codes at screens, walang kailangang design skills.',
    },
    steps: {
      en: ['Add a text layer with your initials or names, then an image or one of seven frames.', 'Give each layer its motion: draw on, rise or fade in, then still or drift. “Show how it’s written” draws letters in their stroke order.', 'Apply, and the logo appears on your Event Hub in your colours.'],
      tl: ['Magdagdag ng text layer na may initials o pangalan ninyo, tapos isang image o isa sa pitong frame.', 'Bigyan ng galaw ang bawat layer: draw on, rise o fade in, tapos still o drift. Iginuguhit ng “Show how it’s written” ang mga letra ayon sa pagkakasulat nito.', 'I-Apply, at lalabas ang logo sa Event Hub mo sa mga kulay mo.'],
    },
    different: {
      en: ['Layers, not a fixed template: text, image and frame, each moved on its own.', 'An image layer can drop its white background.', 'The animated logo is included in Event Hub Pro, or can be unlocked on its own.'],
      tl: ['Mga layer, hindi nakapirming template: text, image at frame, bawat isa ay hiwalay na gumagalaw.', 'Puwedeng tanggalin ng image layer ang puting background nito.', 'Kasama ang animated na logo sa Event Hub Pro, o puwede itong i-unlock nang mag-isa.'],
    },
    worksWith: [
      { slug: 'mood-board', how: { en: 'Your logo is drawn in your palette.', tl: 'Iginuguhit ang logo sa palette mo.' } },
      { slug: 'event-hub', how: { en: 'It signs your Event Hub.', tl: 'Lumalagda ito sa Event Hub mo.' } },
    ],
    faq: {
      en: [
        { q: 'What can I build?', a: 'A logo from text, image and frame layers, in the studio’s typefaces and your colours.' },
        { q: 'What does the upgrade add?', a: 'The animation: each layer drawing on, rising or fading in on your Event Hub. It is included in Event Hub Pro or sold on its own, priced in the live catalogue.' },
        { q: 'Do I need design skills?', a: 'No. Type your initials, pick a frame, and choose how each layer moves.' },
      ],
      tl: [
        { q: 'Ano ang puwede kong buuin?', a: 'Logo mula sa text, image at frame layers, sa mga typeface ng studio at sa kulay mo.' },
        { q: 'Ano ang idinadagdag ng upgrade?', a: 'Ang animation: ang pag-draw on, pag-angat o pag-fade in ng bawat layer sa Event Hub mo. Kasama ito sa Event Hub Pro o mabibili nang mag-isa, nasa live catalogue ang presyo.' },
        { q: 'Kailangan ba ng design skills?', a: 'Hindi. I-type ang initials, pumili ng frame, at piliin kung paano gagalaw ang bawat layer.' },
      ],
    },
    keywords: {
      en: ['wedding monogram maker', 'animated wedding logo', 'wedding logo Philippines'],
      tl: ['monogram ng kasal', 'animated na logo ng kasal'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['ANIMATED_MONOGRAM'] },
    moreHref: '/palogo',
    evidence: ['app/(shell)/palogo/page.tsx', 'lib/monogram.ts', 'lib/logo-layers.ts', 'app/dashboard/[eventId]/monogram/page.tsx'],
  },
  {
    slug: 'music-maker',
    group: 'invite',
    icon: 'pakanta',
    name: { en: 'Music Maker', tl: 'Music Maker' },
    line: { en: 'An original song written from your own story.', tl: 'Orihinal na kantang isinulat mula sa sarili mong kuwento.' },
    title: { en: 'Custom Wedding Song from Your Love Story', tl: 'Custom na Kanta mula sa Love Story Mo' },
    description: {
      en: 'An original song made to order, with words drawn from your own love story. Delivered inside Setnayan, yours to keep.',
      tl: 'Orihinal na kantang ginawa para sa inyo, na ang mga salita ay galing sa sarili mong love story. Ihahatid sa loob ng Setnayan, sa inyo habambuhay.',
    },
    answer: {
      en: 'Setnayan Music Maker makes an original song for your event, with words drawn from the love story you already told us. It is made to order, delivered inside Setnayan, and yours to keep.',
      tl: 'Gumagawa ang Setnayan Music Maker ng orihinal na kanta para sa event mo, na ang mga salita ay galing sa love story na naikuwento mo na. Ginagawa ito para sa inyo, inihahatid sa loob ng Setnayan, at sa inyo habambuhay.',
    },
    forWho: {
      en: 'Couples who want music that sounds like them, without writing anything.',
      tl: 'Para sa mga magkasintahang gusto ng musikang kamukha nila, nang hindi nagsusulat.',
    },
    steps: {
      en: ['Your love story is already there. We ask a few short things it does not carry.', 'It becomes lyrics and a finished, original track in music you both like.', 'It is delivered inside Setnayan, and your Music Maker page shows where it is until then.'],
      tl: ['Nandiyan na ang love story mo. Magtatanong kami ng ilang maikling bagay na wala roon.', 'Nagiging lyrics at tapos na orihinal na track sa musikang gusto n’yong dalawa.', 'Ihahatid ito sa loob ng Setnayan, at ipinapakita ng Music Maker page mo kung nasaan na ito hanggang doon.'],
    },
    different: {
      en: ['Written from your story, not a template with names dropped in.', 'Made to order for you, not picked from a library.', 'It is yours to keep, with nothing to renew.'],
      tl: ['Isinulat mula sa kuwento mo, hindi template na nilagyan lang ng pangalan.', 'Ginawa para sa inyo, hindi pinili mula sa isang library.', 'Sa iyo ito habambuhay, walang ire-renew.'],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'Your love story on the Event Hub is where the song begins.', tl: 'Sa love story mo sa Event Hub nagsisimula ang kanta.' } },
      { slug: 'patiktok', how: { en: 'Once delivered, your song backs the reels made at your event.', tl: 'Kapag naihatid na, ang kanta mo ang musika ng mga reel na ginawa sa event mo.' } },
      { slug: 'papic', how: { en: 'Guests making their own photo reels see your song first.', tl: 'Unang makikita ng mga bisitang gumagawa ng sariling photo reel ang kanta mo.' } },
    ],
    faq: {
      en: [
        { q: 'Do I have to write anything?', a: 'No. The song is built from the love story you already told us, plus a few short questions.' },
        { q: 'Is the song really ours?', a: 'Yes. It is made for you and yours to keep, with nothing to renew.' },
        { q: 'When do we get it?', a: 'After you order, it is written and produced, then delivered inside Setnayan. Your Music Maker page shows its status.' },
      ],
      tl: [
        { q: 'Kailangan ba akong magsulat?', a: 'Hindi. Binubuo ang kanta mula sa love story na naikuwento mo na, kasama ang ilang maikling tanong.' },
        { q: 'Totoo bang atin ang kanta?', a: 'Oo. Ginawa ito para sa inyo at sa inyo habambuhay, walang ire-renew.' },
        { q: 'Kailan namin ito makukuha?', a: 'Pagkatapos ng order, isusulat at ipo-produce ito, tapos ihahatid sa loob ng Setnayan. Makikita mo ang status sa Music Maker page mo.' },
      ],
    },
    keywords: {
      en: ['custom wedding song Philippines', 'original song from love story', 'personalized song'],
      tl: ['custom na kanta sa kasal', 'orihinal na kanta'],
    },
    shots: [],
    price: { kind: 'paid', catalogue: 'retail', codes: ['PAKANTA'] },
    moreHref: '/pakanta',
    evidence: ['app/(shell)/pakanta/page.tsx', 'lib/pakanta-brief.ts', 'app/dashboard/[eventId]/pakanta-actions.ts', 'lib/guest-stories.ts'],
  },
  {
    slug: 'groups',
    group: 'invite',
    icon: 'hosts',
    name: { en: 'Groups', tl: 'Groups' },
    line: { en: 'Your barkada, ninongs, family — chat, stories, reunions.', tl: 'Barkada, ninong, pamilya — chat, stories, reunion.' },
    title: { en: 'Groups for Barkada, Family and Clubs', tl: 'Groups para sa Barkada, Pamilya at Klub' },
    description: {
      en: 'One shared space for your barkada, parish or clan: a chat, short stories and the events you plan together. Free to create.',
      tl: 'Isang shared na espasyo para sa barkada, parokya o angkan: chat, maiikling stories at mga event na pinaplano n’yo. Libreng gumawa.',
    },
    answer: {
      en: 'A Setnayan Group is one shared space for your barkada, parish or clan. It has a name and photo, a chat called Usapan, a strip of short stories and the events an organizer plans for it. Creating one is free.',
      tl: 'Ang Setnayan Group ay isang shared na espasyo para sa barkada, parokya o angkan. May pangalan at larawan, chat na tinatawag na Usapan, strip ng maiikling stories at mga event na pinaplano ng organizer. Libreng gumawa.',
    },
    forWho: {
      en: 'Friends, families and clubs that keep planning reunions, outings and tournaments together.',
      tl: 'Para sa mga kaibigan, pamilya at klub na patuloy na nagpaplano ng reunion, outing at tournament.',
    },
    steps: {
      en: ['Name your group. You start as organizer and an invite link is ready.', 'Share the link. People sign in, see the group name and member count, and tap Join.', 'Chat in Usapan, post stories and plan events from the Events tab.'],
      tl: ['Pangalanan ang group. Organizer ka at handa na ang invite link.', 'Ibahagi ang link. Magsa-sign in ang tao, makikita ang pangalan at bilang ng miyembro, at mag-tap ng Join.', 'Mag-chat sa Usapan, mag-post ng stories at magplano ng event sa Events tab.'],
    },
    different: {
      en: ['Stories disappear after 24 hours, and you can take yours down sooner.', 'Rotate the invite link and the old one stops working immediately.', 'Usapan tells the group once in their bell, however busy the chat gets.'],
      tl: ['Nawawala ang stories pagkalipas ng 24 oras, at maaari mong tanggalin nang mas maaga.', 'I-rotate ang invite link at titigil agad ang luma.', 'Isang beses lang sinasabihan ang group sa bell nila ng Usapan, gaano man kaabala ang chat.'],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'An event a group plans is a Setnayan event with its own guest list.', tl: 'Ang event na pinaplano ng group ay Setnayan event na may sariling guest list.' } },
      { slug: 'event-hub', how: { en: 'That event can have its own Event Hub for everyone to open.', tl: 'Puwedeng magkaroon ng sariling Event Hub ang event na iyon para mabuksan ng lahat.' } },
    ],
    faq: {
      en: [
        { q: 'What is a group?', a: 'A shared space for your barkada, parish or clan with a chat, short stories and events.' },
        { q: 'How does someone join?', a: 'An organizer shares the invite link. The person signs in or creates a free account and taps Join.' },
        { q: 'What is Usapan?', a: 'The group chat. The group is told once in their Setnayan bell.' },
      ],
      tl: [
        { q: 'Ano ang group?', a: 'Shared na espasyo para sa barkada, parokya o angkan na may chat, maiikling stories at event.' },
        { q: 'Paano sumali ang isang tao?', a: 'Magbabahagi ng invite link ang organizer. Magsa-sign in o gagawa ng libreng account ang tao at mag-tap ng Join.' },
        { q: 'Ano ang Usapan?', a: 'Ang group chat. Isang beses lang sinasabihan ang group sa Setnayan bell nila.' },
      ],
    },
    keywords: {
      en: ['barkada group app', 'family reunion planning', 'group chat for clan'],
      tl: ['group ng barkada', 'reunion ng pamilya'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/samahan',
    evidence: ['app/(shell)/samahan/page.tsx', 'lib/samahan-notify.ts', 'lib/samahan-stories.ts'],
  },
];
