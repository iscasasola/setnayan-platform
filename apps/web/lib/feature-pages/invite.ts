import type { FeaturePageEntry } from './types';

/** Invite & gather — Event Hub · Logo Maker · Music Maker · Groups. */
export const INVITE_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'event-hub',
    group: 'invite',
    icon: 'hub',
    name: { en: 'Event Hub', tl: 'Event Hub' },
    line: { en: 'One link for your save-the-date, RSVP, details and story.', tl: 'Isang link para sa save-the-date, RSVP, detalye at kuwento.' },
    title: { en: 'Event Hub: One Link for Your Event', tl: 'Event Hub: Isang Link para sa Event Mo' },
    description: {
      en: 'One address for your save-the-date, RSVP, event details and love story. Guests reply in a tap. Free to start, with an optional Pro.',
      tl: 'Isang address para sa save-the-date, RSVP, detalye ng event at love story. Isang tap ang sagot ng bisita. Libreng simulan, may optional na Pro.',
    },
    answer: {
      en: 'Setnayan Event Hub is one link for your whole event. It holds your save-the-date, RSVP, event details such as when, where and dress code, and your love story. You share one address once and guests reply in a tap.',
      tl: 'Ang Setnayan Event Hub ay isang link para sa buong event mo. Nandoon ang save-the-date, RSVP, detalye ng event gaya ng kailan, saan at dress code, at love story mo. Isang address lang ang ibabahagi at isang tap ang sagot ng bisita.',
    },
    forWho: {
      en: 'Hosts who want one beautiful address instead of a string of messages, and who do not want to design or code anything.',
      tl: 'Para sa mga host na gustong isang magandang address imbes na sunod-sunod na mensahe, at ayaw mag-design o mag-code.',
    },
    steps: {
      en: ['Add your details and story: date, venue, what to wear. Your Event Hub composes itself.', 'Share one address. Your save-the-date, RSVP, details and story all live there.', 'Watch replies arrive in real time, beside your guest list and seating.'],
      tl: ['Idagdag ang detalye at kuwento mo: petsa, venue, ano ang isusuot. Bubuo ito nang mag-isa.', 'Magbahagi ng isang address. Nandoon ang save-the-date, RSVP, detalye at kuwento.', 'Panoorin ang pagdating ng sagot nang real time, katabi ng guest list at seating.'],
    },
    different: {
      en: ['Your story is laid out like a magazine feature, not a form with a photo on top.', 'Guests need no app and no account.', 'The same address later carries your live stream and guest gallery.', 'It reads well on any phone or laptop without touching a setting.'],
      tl: ['Ang kuwento mo ay nakalatag na parang magazine feature, hindi form na may litrato sa taas.', 'Hindi kailangan ng app o account ng bisita.', 'Ang parehong address ay magdadala rin ng live stream at guest gallery.', 'Maganda ito sa kahit anong telepono o laptop nang walang ginagalaw na setting.'],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'RSVPs from your Event Hub land in your guest list.', tl: 'Ang RSVP mula sa Event Hub ay napupunta sa guest list mo.' } },
      { slug: 'mood-board', how: { en: 'It dresses in the palette you chose.', tl: 'Isinusuot nito ang palette na pinili mo.' } },
      { slug: 'live-watch', how: { en: 'Guests watch your live stream right on it.', tl: 'Mapapanood ng bisita ang live stream mismo dito.' } },
      { slug: 'schedule', how: { en: 'Public schedule blocks show here with a live “happening now”.', tl: 'Lumalabas dito ang public na schedule blocks na may live na “happening now”.' } },
    ],
    faq: {
      en: [
        { q: 'What is on my Event Hub?', a: 'Your save-the-date, RSVP, event details (when, where, dress code, directions) and your love story, at one address.' },
        { q: 'Do I need to design or code anything?', a: 'No. Fill in your details and it composes itself.' },
        { q: 'How does the RSVP work?', a: 'Guests tap a button and are counted. You see who is coming in real time beside your guest list.' },
        { q: 'Is it free?', a: 'You can start free. There is an optional ◆ Pro upgrade, priced in the live catalogue.' },
      ],
      tl: [
        { q: 'Ano ang nasa Event Hub ko?', a: 'Ang save-the-date, RSVP, detalye ng event (kailan, saan, dress code, direksyon) at love story mo, sa iisang address.' },
        { q: 'Kailangan ko bang mag-design o mag-code?', a: 'Hindi. Punan ang detalye at bubuo ito nang mag-isa.' },
        { q: 'Paano gumagana ang RSVP?', a: 'Magta-tap ng button ang bisita at mabibilang sila. Makikita mo nang real time kung sino ang darating, katabi ng guest list.' },
        { q: 'Libre ba ito?', a: 'Puwedeng magsimula nang libre. May optional na ◆ Pro upgrade, na nasa live catalogue ang presyo.' },
      ],
    },
    keywords: {
      en: ['online invitation Philippines', 'event page with RSVP', 'online invitation', 'save the date page'],
      tl: ['event page ng kasal', 'online na imbitasyon', 'RSVP page'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['COUPLE_WEBSITE_PRO'] },
    tryHref: '/pawebsite',
    moreHref: '/pawebsite',
    evidence: ['app/(shell)/pawebsite/page.tsx', 'app/dashboard/[eventId]/event-page/page.tsx', 'lib/studio-apps.ts'],
  },
  {
    slug: 'logo-maker',
    group: 'invite',
    icon: 'logo',
    name: { en: 'Logo Maker', tl: 'Logo Maker' },
    line: { en: 'One monogram of your own, carried across your whole day.', tl: 'Isang monogram na sarili mo, dala sa buong araw.' },
    title: { en: 'Wedding Monogram and Logo Maker', tl: 'Monogram at Logo Maker sa Kasal' },
    description: {
      en: 'Make a monogram from your initials, then carry it across your save-the-date, Event Hub and videos. Preview free; animated version is an upgrade.',
      tl: 'Gumawa ng monogram mula sa initials mo, at dalhin ito sa save-the-date, Event Hub at videos. Libre ang preview; upgrade ang animated na bersyon.',
    },
    answer: {
      en: 'Setnayan Logo Maker draws your initials into a single monogram, with a short animation that brings it to life. It becomes the signature of your wedding. You can preview one free, with no sign-up.',
      tl: 'Iginuguhit ng Setnayan Logo Maker ang initials mo sa iisang monogram, may maikling animation na bumubuhay rito. Nagiging lagda ito ng kasal mo. Puwedeng mag-preview nang libre, walang sign-up.',
    },
    forWho: {
      en: 'Couples who want one mark across their save-the-date, Event Hub, signage and videos, with no design skills.',
      tl: 'Para sa mga magkasintahang gusto ng iisang tatak sa save-the-date, Event Hub, signage at videos, walang kailangang design skills.',
    },
    steps: {
      en: ['Tell Setnayan your initials and the feel you want.', 'Refine the look until it is yours.', 'It follows you: it opens your save-the-date, signs your Event Hub and closes your videos.'],
      tl: ['Sabihin sa Setnayan ang initials mo at ang gustong dating.', 'Ayusin ang itsura hanggang maging sa iyo.', 'Sumusunod ito: bumubukas ng save-the-date, lumalagda sa Event Hub at nagtatapos ng videos.'],
    },
    different: {
      en: ['You get a still mark for print and a living version for screens.', 'It is shaped around your initials, your colors and your mood.', 'You can preview a monogram free before you decide.'],
      tl: ['May still na tatak para sa print at buhay na bersyon para sa screen.', 'Hinubog ito sa initials, kulay at mood mo.', 'Puwedeng mag-preview ng monogram nang libre bago magpasya.'],
    },
    worksWith: [
      { slug: 'mood-board', how: { en: 'Your monogram is drawn in your palette.', tl: 'Iginuguhit ang monogram sa palette mo.' } },
      { slug: 'event-hub', how: { en: 'It signs your Event Hub.', tl: 'Lumalagda ito sa Event Hub mo.' } },
    ],
    faq: {
      en: [
        { q: 'What do I get?', a: 'A monogram of your initials as a still mark, plus an animated version for screens, your Event Hub and videos.' },
        { q: 'Can I try one first?', a: 'Yes. Preview a monogram for your initials free, with no sign-up. The animated version is the upgrade.' },
        { q: 'Do I need design skills?', a: 'No. Describe the feel and refine it until it is right.' },
      ],
      tl: [
        { q: 'Ano ang makukuha ko?', a: 'Monogram ng initials mo bilang still na tatak, at animated na bersyon para sa screen, Event Hub at videos.' },
        { q: 'Puwede ba akong sumubok muna?', a: 'Oo. Mag-preview ng monogram ng initials mo nang libre, walang sign-up. Ang animated na bersyon ang upgrade.' },
        { q: 'Kailangan ba ng design skills?', a: 'Hindi. Ilarawan ang dating at ayusin hanggang tama.' },
      ],
    },
    keywords: {
      en: ['wedding monogram maker', 'animated monogram', 'wedding logo Philippines'],
      tl: ['monogram ng kasal', 'animated na monogram'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['ANIMATED_MONOGRAM'] },
    moreHref: '/palogo',
    evidence: ['app/(shell)/palogo/page.tsx', 'lib/monogram.ts', 'app/dashboard/[eventId]/monogram/page.tsx'],
  },
  {
    slug: 'music-maker',
    group: 'invite',
    icon: 'pakanta',
    name: { en: 'Music Maker', tl: 'Music Maker' },
    line: { en: 'An original song written from your own story.', tl: 'Orihinal na kantang isinulat mula sa sarili mong kuwento.' },
    title: { en: 'Custom Wedding Song from Your Love Story', tl: 'Custom na Kanta mula sa Love Story Mo' },
    description: {
      en: 'An original song with words drawn from your own story. Play it at the reception, keep it, and use it behind your videos.',
      tl: 'Orihinal na kanta na ang mga salita ay galing sa sarili mong kuwento. Patugtugin sa reception, itago, at gamitin sa videos.',
    },
    answer: {
      en: 'Setnayan Music Maker writes an original song for your wedding, with words drawn from the love story you already told us. It is finished music you can play at the reception, keep afterwards and use behind your videos.',
      tl: 'Sumusulat ang Setnayan Music Maker ng orihinal na kanta para sa kasal mo, na ang mga salita ay galing sa love story na naikuwento mo na. Tapos na musika ito na puwedeng patugtugin sa reception, itago at gamitin sa videos.',
    },
    forWho: {
      en: 'Couples who want music that sounds like them, without writing anything.',
      tl: 'Para sa mga magkasintahang gusto ng musikang kamukha nila, nang hindi nagsusulat.',
    },
    steps: {
      en: ['Your love story is already there. We ask a few short things it does not carry.', 'It becomes lyrics and a finished, original track in music you both like.', 'It is delivered inside Setnayan and plays on your Event Hub and behind your videos.'],
      tl: ['Nandiyan na ang love story mo. Magtatanong kami ng ilang maikling bagay na wala roon.', 'Nagiging lyrics at tapos na orihinal na track sa musikang gusto n’yong dalawa.', 'Ihahatid ito sa loob ng Setnayan at tutugtog sa Event Hub at sa likod ng videos mo.'],
    },
    different: {
      en: ['Written from your story, not a template with names dropped in.', 'It is yours to keep, with nothing to renew.', 'It is cleared for sharing, so a video scored with it can go anywhere without a takedown.'],
      tl: ['Isinulat mula sa kuwento mo, hindi template na nilagyan lang ng pangalan.', 'Sa iyo ito habambuhay, walang ire-renew.', 'Cleared ito para sa pagbabahagi, kaya puwedeng i-post kahit saan ang video na may kantang ito.'],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'The song can play on your Event Hub.', tl: 'Puwedeng tumugtog ang kanta sa Event Hub mo.' } },
      { slug: 'patiktok', how: { en: 'It scores the videos Setnayan makes from your day.', tl: 'Ito ang musika ng mga video na gawa ng Setnayan mula sa araw mo.' } },
    ],
    faq: {
      en: [
        { q: 'Do I have to write anything?', a: 'No. The song is built from the love story you already told us.' },
        { q: 'Is the song really ours?', a: 'Yes. It is written for you and yours to keep, with nothing to renew.' },
        { q: 'Can we post it online?', a: 'Yes. It is cleared for sharing.' },
        { q: 'When do we get it?', a: 'After you order it is written and produced, then delivered inside Setnayan. You see its status on your Music Maker page.' },
      ],
      tl: [
        { q: 'Kailangan ba akong magsulat?', a: 'Hindi. Binubuo ang kanta mula sa love story na naikuwento mo na.' },
        { q: 'Totoo bang atin ang kanta?', a: 'Oo. Isinulat ito para sa inyo at sa inyo habambuhay, walang ire-renew.' },
        { q: 'Puwede ba itong i-post online?', a: 'Puwede. Cleared ito para sa pagbabahagi.' },
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
    evidence: ['app/(shell)/pakanta/page.tsx', 'lib/pakanta-brief.ts', 'app/dashboard/[eventId]/pakanta-actions.ts'],
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
