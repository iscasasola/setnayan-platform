import type { FeaturePageEntry } from './types';

/** On the day + Keep the memories — Papic · Live Watch · Patiktok · Memories · Stories. */
export const DAY_MEMORIES_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'papic',
    group: 'day',
    icon: 'papic',
    name: { en: 'Papic', tl: 'Papic' },
    line: { en: 'Turns your guests into your photo crew.', tl: 'Ginagawang photo crew ang mga bisita mo.' },
    title: { en: 'Papic: Guest Photo Sharing for Events', tl: 'Papic: Photo Sharing ng Bisita sa Event' },
    description: {
      en: 'Guests shoot from their own phones with just a code, no app. Every photo finds its people and everyone goes home with theirs.',
      tl: 'Kukuha ang mga bisita gamit ang sarili nilang telepono, code lang, walang app. Napupunta ang bawat litrato sa mga nasa kuha.',
    },
    answer: {
      en: 'Papic turns your guests into your photo crew. Each guest shoots from their own phone with a code and a browser, with no app and no account. Photos sort into each person’s own gallery, and you receive all of them.',
      tl: 'Ginagawang photo crew ng Papic ang mga bisita mo. Kukuha ang bawat bisita gamit ang sarili nilang telepono, code at browser lang, walang app at account. Napupunta ang mga litrato sa gallery ng bawat tao, at matatanggap mo ang lahat.',
    },
    forWho: {
      en: 'Hosts who want the whole room’s view of the day, from the seats a photographer never sits in.',
      tl: 'Para sa mga host na gustong makita ang buong kuwarto, mula sa mga upuang hindi kailanman inuupuan ng photographer.',
    },
    steps: {
      en: ['Guests join with a code and shoot from their own phones.', 'Hold a guest’s place card or a table sign in frame and the photos sort into their own galleries.', 'Everyone goes home with theirs, and you get the whole set.'],
      tl: ['Sasali ang bisita gamit ang code at kukuha gamit ang sarili nilang telepono.', 'Hawakan sa frame ang place card ng bisita o table sign at mapupunta ang mga litrato sa kanya-kanyang gallery.', 'Uuwi ang lahat na may kopya nila, at makukuha mo ang buong set.'],
    },
    different: {
      en: ['No app and no account for guests.', 'You always receive all the photos, tagged or not.', 'Shooting still works with no signal and sends when it returns.', 'A guest who never adds a selfie is never face-matched, and anyone can ask not to be shown.'],
      tl: ['Walang app at account ang bisita.', 'Lagi mong matatanggap ang lahat ng litrato, naka-tag man o hindi.', 'Gumagana pa rin ang pagkuha kahit walang signal at ipinapadala kapag bumalik ito.', 'Ang bisitang hindi nagdagdag ng selfie ay hindi kailanman ife-face-match, at kahit sino ay puwedeng humiling na huwag ipakita.'],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'Guests and tables from your list sort the photos.', tl: 'Ang bisita at table mula sa listahan mo ang nag-aayos ng mga litrato.' } },
      { slug: 'patiktok', how: { en: 'Moments captured become short reels.', tl: 'Ang mga nakuhang sandali ay nagiging maiikling reel.' } },
      { slug: 'alaala', how: { en: 'Photos gather in your Memories after the day.', tl: 'Naiipon ang mga litrato sa Memories mo pagkatapos ng araw.' } },
    ],
    faq: {
      en: [
        { q: 'Do guests need an app?', a: 'No app and no account. A code and a browser is the whole thing.' },
        { q: 'Will we get all the photos?', a: 'Always, tagged or not, and whether or not the person in it asked to be hidden.' },
        { q: 'What if the venue has no signal?', a: 'Shooting still works. Photos are held on the phone and send themselves when the signal returns.' },
        { q: 'Will this upset our photographer?', a: 'It should not. Your photographer composes the shots that matter and Papic covers the rest of the room. Nobody is replaced.' },
      ],
      tl: [
        { q: 'Kailangan ba ng app ng mga bisita?', a: 'Walang app at walang account. Code at browser lang ang kailangan.' },
        { q: 'Makukuha ba namin ang lahat ng litrato?', a: 'Lagi, naka-tag man o hindi, at humiling man o hindi ang nasa litrato na itago.' },
        { q: 'Paano kung walang signal sa venue?', a: 'Gumagana pa rin ang pagkuha. Hawak ng telepono ang mga litrato at kusang ipapadala kapag bumalik ang signal.' },
        { q: 'Magagalit ba ang photographer namin?', a: 'Hindi dapat. Binubuo ng photographer ang mahahalagang kuha at sinasaklaw ng Papic ang natitirang bahagi ng kuwarto. Walang pinapalitan.' },
      ],
    },
    keywords: {
      en: ['guest photo sharing wedding', 'QR code photo sharing', 'guests take photos no app', 'event photo app Philippines'],
      tl: ['photo sharing ng bisita', 'QR code litrato', 'litrato ng bisita sa event'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['PAPIC_GUEST_100'] },
    tryHref: '/papic',
    moreHref: '/papic',
    evidence: ['app/(shell)/papic/page.tsx', 'lib/papic-guest.ts', 'lib/papic-gallery.ts'],
  },
  {
    slug: 'live-watch',
    group: 'day',
    icon: 'live',
    name: { en: 'Live Watch', tl: 'Live Watch' },
    line: { en: 'Brings the people who can’t be there into your day — live.', tl: 'Dinadala ang mga hindi makadalo sa araw mo — live.' },
    title: { en: 'Live Watch: Livestream Your Event', tl: 'Live Watch: I-livestream ang Event Mo' },
    description: {
      en: 'Stream your event live on your Event Hub so family overseas can watch with one tap. No app for viewers, and the recording stays.',
      tl: 'I-stream nang live ang event sa Event Hub mo para mapanood ng pamilyang nasa abroad sa isang tap. Walang app ang manonood, at nananatili ang recording.',
    },
    answer: {
      en: 'Setnayan Live Watch streams your event live on your own Event Hub, through an unlisted YouTube broadcast Setnayan sets up. Guests press play with no app and no account, from anywhere in the world.',
      tl: 'Ini-stream ng Setnayan Live Watch nang live ang event mo sa sarili mong Event Hub, sa pamamagitan ng unlisted na YouTube broadcast na isinasaayos ng Setnayan. Magpe-play ang bisita nang walang app at account, mula saanman sa mundo.',
    },
    forWho: {
      en: 'Hosts with family, friends or elders who cannot travel to be in the room.',
      tl: 'Para sa mga host na may pamilya, kaibigan o nakatatandang hindi makabiyahe para makapunta.',
    },
    steps: {
      en: ['Switch Live Watch on for your day. A broadcast appears on your Event Hub.', 'Share your Event Hub. Viewers press play on any phone, tablet or laptop.', 'After the day the broadcast stays and anyone can watch it back.'],
      tl: ['I-on ang Live Watch para sa araw mo. Lalabas ang broadcast sa Event Hub mo.', 'Ibahagi ang Event Hub. Magpe-play ang manonood sa kahit anong telepono, tablet o laptop.', 'Pagkatapos ng araw, mananatili ang broadcast at mapapanood ito ng kahit sino.'],
    },
    different: {
      en: ['Always unlisted: it never appears in YouTube search.', 'It handles ten viewers or ten thousand the same way.', 'Your videographer is not replaced. Live Watch is about presence in the moment.', 'You need one Windows or Mac laptop at the event running free streaming software; a phone alone cannot send it.'],
      tl: ['Laging unlisted: hindi ito lalabas sa YouTube search.', 'Pareho ang pagtrato nito sa sampung manonood o sampung libo.', 'Hindi pinapalitan ang videographer mo. Ang Live Watch ay para sa presensya sa mismong sandali.', 'Kailangan ng isang Windows o Mac na laptop sa event na may libreng streaming software; hindi ito kayang ipadala ng telepono lang.'],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'The broadcast plays right on your Event Hub.', tl: 'Nagpe-play ang broadcast mismo sa Event Hub mo.' } },
      { slug: 'papic', how: { en: 'Guests’ phones can be the cameras, joined by QR.', tl: 'Puwedeng camera ang telepono ng bisita, sasali gamit ang QR.' } },
    ],
    faq: {
      en: [
        { q: 'What do I need on the day?', a: 'Guest phones can be the cameras. You also need one Windows or Mac laptop at the event running free streaming software.' },
        { q: 'How do guests watch?', a: 'They open your Event Hub and press play. No app, no account.' },
        { q: 'Can we keep the recording?', a: 'Yes. The broadcast stays and the watch link stays on your Event Hub.' },
        { q: 'Does it replace our videographer?', a: 'No. Your videographer still makes the keepsake film.' },
      ],
      tl: [
        { q: 'Ano ang kailangan sa mismong araw?', a: 'Puwedeng camera ang telepono ng bisita. Kailangan din ng isang Windows o Mac na laptop sa event na may libreng streaming software.' },
        { q: 'Paano nanonood ang mga bisita?', a: 'Bubuksan nila ang Event Hub mo at magpe-play. Walang app, walang account.' },
        { q: 'Maitatago ba namin ang recording?', a: 'Oo. Mananatili ang broadcast at ang watch link sa Event Hub mo.' },
        { q: 'Pinapalitan ba nito ang videographer namin?', a: 'Hindi. Ang videographer pa rin ang gagawa ng keepsake film.' },
      ],
    },
    keywords: {
      en: ['livestream wedding Philippines', 'live stream for family abroad', 'event livestream'],
      tl: ['livestream ng kasal', 'live stream para sa pamilya sa abroad'],
    },
    shots: [],
    price: { kind: 'paid', catalogue: 'retail', codes: ['LIVE_STUDIO'] },
    tryHref: '/panood',
    moreHref: '/panood',
    evidence: ['app/(shell)/panood/page.tsx', 'lib/panood-broadcast.ts', 'lib/panood-youtube.ts'],
  },
  {
    slug: 'patiktok',
    group: 'day',
    icon: 'patiktok',
    name: { en: 'Patiktok', tl: 'Patiktok' },
    line: { en: 'Turns your moments into short, vertical highlight reels.', tl: 'Ginagawang maiikling vertical na highlight reel ang mga sandali mo.' },
    title: { en: 'Patiktok: Short Highlight Reels', tl: 'Patiktok: Maikling Highlight Reels' },
    description: {
      en: 'Pick the moments you love and a short, vertical reel composes itself with cleared music, ready to share the same night.',
      tl: 'Piliin ang mga sandaling gusto mo at bubuo ang maikli at vertical na reel na may cleared na musika, handang ibahagi sa parehong gabi.',
    },
    answer: {
      en: 'Patiktok turns the moments from your event into a short, vertical highlight reel, set to music and ready to share. You pick the moments you love and the reel composes itself, with no editing app.',
      tl: 'Ginagawang maikli at vertical na highlight reel ng Patiktok ang mga sandali ng event mo, may musika at handang ibahagi. Pipiliin mo ang mga sandaling gusto mo at bubuo ang reel nang mag-isa, walang editing app.',
    },
    forWho: {
      en: 'Hosts who want something shareable the same night while the big film takes its time.',
      tl: 'Para sa mga host na gustong may maibabahagi sa parehong gabi habang matagal pa ang malaking film.',
    },
    steps: {
      en: ['Photos and short clips from your event gather inside Setnayan.', 'Choose your moments, a style, a length and a song.', 'Share it to the group chat or your stories.'],
      tl: ['Naiipon sa Setnayan ang mga litrato at maiikling clip ng event mo.', 'Pumili ng mga sandali, style, haba at kanta.', 'Ibahagi sa group chat o sa stories mo.'],
    },
    different: {
      en: ['Every reel is set to music cleared for sharing.', 'No timeline and no editing skills.', 'It does not replace your wedding film; it is the fast, shareable version.'],
      tl: ['Bawat reel ay may musikang cleared para sa pagbabahagi.', 'Walang timeline at walang kailangang editing skills.', 'Hindi nito pinapalitan ang wedding film mo; ito ang mabilis at maibabahaging bersyon.'],
    },
    worksWith: [
      { slug: 'papic', how: { en: 'Moments your guests captured feed your reels.', tl: 'Ang mga sandaling nakuha ng bisita ang pinagkukunan ng reels mo.' } },
      { slug: 'music-maker', how: { en: 'Your own song can score your videos.', tl: 'Puwedeng musika ng videos mo ang sarili mong kanta.' } },
    ],
    faq: {
      en: [
        { q: 'What is a Patiktok reel?', a: 'A short, vertical highlight video of your event, set to music and ready to share.' },
        { q: 'Do I need to edit anything?', a: 'No. Pick the moments you love and the reel composes itself.' },
        { q: 'What about the music?', a: 'Every reel uses music cleared for sharing, so you can post it anywhere.' },
      ],
      tl: [
        { q: 'Ano ang Patiktok reel?', a: 'Maikli at vertical na highlight video ng event mo, may musika at handang ibahagi.' },
        { q: 'Kailangan ko bang mag-edit?', a: 'Hindi. Piliin ang mga sandaling gusto mo at bubuo ang reel nang mag-isa.' },
        { q: 'Paano ang musika?', a: 'Bawat reel ay may musikang cleared para sa pagbabahagi, kaya puwedeng i-post kahit saan.' },
      ],
    },
    keywords: {
      en: ['wedding highlight reel', 'vertical event video', 'short video from event photos'],
      tl: ['highlight reel ng kasal', 'vertical na video'],
    },
    shots: [],
    price: { kind: 'paid', catalogue: 'retail', codes: ['PATIKTOK_COMPILER'] },
    moreHref: '/patiktok',
    evidence: ['app/(shell)/patiktok/page.tsx', 'lib/patiktok.ts'],
  },
  {
    slug: 'alaala',
    group: 'memories',
    icon: 'galleries',
    name: { en: 'Memories', tl: 'Memories' },
    line: { en: 'Everything from your event, gathered into one living memory.', tl: 'Lahat mula sa event mo, iniipon sa isang buhay na Memories.' },
    title: { en: 'Memories: Keep Your Event in One Place', tl: 'Memories: Itago ang Event sa Isang Lugar' },
    description: {
      en: 'Your photos, live broadcast, event page, 3D plan and monogram gathered into one memory you can return to and share. Guests need no app.',
      tl: 'Ang mga litrato, live broadcast, event page, 3D plan at monogram mo ay iniipon sa isang alaalang puwedeng balikan at ibahagi. Walang app ang bisita.',
    },
    answer: {
      en: 'Setnayan Memories gathers everything you create for your event into one living memory: your candid photos (Papic), live broadcast (Live Watch), event page (Event Hub), 3D plan and monogram. You can return to it any time and share it.',
      tl: 'Iniipon ng Setnayan Memories ang lahat ng ginawa mo para sa event sa isang buhay na Memories: ang mga candid na litrato (Papic), live broadcast (Live Watch), event page (Event Hub), 3D plan at monogram. Puwede mo itong balikan anumang oras at ibahagi.',
    },
    forWho: {
      en: 'Hosts who want the day to stay somewhere better than a camera roll.',
      tl: 'Para sa mga host na gustong manatili ang araw sa lugar na mas maayos kaysa camera roll.',
    },
    steps: {
      en: ['Plan and celebrate as usual. Your Memories gather as you go.', 'Guests join from your event link to press play, open a photo or leave a message.', 'Return any time to relive and share it.'],
      tl: ['Magplano at magdiwang gaya ng dati. Naiipon ang Memories mo habang tumatakbo.', 'Sasali ang bisita mula sa event link para mag-play, magbukas ng litrato o mag-iwan ng mensahe.', 'Balikan anumang oras para balikan at ibahagi.'],
    },
    different: {
      en: ['Guests need no app and no account.', 'It adds to your photographer’s work rather than replacing it.', 'You always see what is free and what is an add-on before anything.'],
      tl: ['Walang app at account ang bisita.', 'Dinadagdagan nito ang gawa ng photographer mo, hindi pinapalitan.', 'Lagi mong makikita kung ano ang libre at ano ang add-on bago ang lahat.'],
    },
    worksWith: [
      { slug: 'papic', how: { en: 'Papic photos land in your Memories.', tl: 'Napupunta sa Memories mo ang mga litrato ng Papic.' } },
      { slug: 'live-watch', how: { en: 'The live broadcast stays with your memory.', tl: 'Nananatili sa Memories mo ang live broadcast.' } },
      { slug: 'event-hub', how: { en: 'Your Event Hub is part of the memory.', tl: 'Bahagi ng Memories ang Event Hub mo.' } },
    ],
    faq: {
      en: [
        { q: 'What is Memories?', a: 'Everything you create for your event in one place: Papic photos, Live Watch, Event Hub, 3D Plan and Logo Maker.' },
        { q: 'Is it free?', a: 'Your event is free to plan and Memories gather as you go. Some pieces are paid add-ons, and you see which before anything.' },
        { q: 'Do my guests need an app?', a: 'No. They join from your event link.' },
      ],
      tl: [
        { q: 'Ano ang Memories?', a: 'Lahat ng ginawa mo para sa event sa isang lugar: litrato ng Papic, Live Watch, Event Hub, 3D Plan at Logo Maker.' },
        { q: 'Libre ba ito?', a: 'Libreng planuhin ang event mo at naiipon ang Memories habang tumatakbo. May bayad na add-on ang ilang bahagi, at makikita mo kung alin bago ang lahat.' },
        { q: 'Kailangan ba ng app ng bisita?', a: 'Hindi. Sasali sila mula sa event link mo.' },
      ],
    },
    keywords: {
      en: ['event memories keepsake', 'wedding photo gallery', 'relive your event'],
      tl: ['memories ng event', 'gallery ng kasal'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/alaala',
    evidence: ['app/(shell)/alaala/page.tsx', 'lib/alaala-wall.ts', 'lib/alaala-chapters.ts'],
  },
  {
    slug: 'real-stories',
    group: 'memories',
    icon: 'editorial',
    name: { en: 'Stories', tl: 'Stories' },
    line: { en: 'Real events, told in full by the people who were there.', tl: 'Mga totoong event, ikinuwento ng mga nandoon.' },
    title: { en: 'Real Event Stories from the Philippines', tl: 'Totoong Kuwento ng mga Event sa Pilipinas' },
    description: {
      en: 'Editorial features and chapters from real Filipino weddings, debuts, anniversaries, graduations and reunions, told by the people who were there.',
      tl: 'Mga editorial feature at kabanata mula sa totoong Pinoy na kasal, debut, anibersaryo, graduation at reunion, ikinuwento ng mga nandoon.',
    },
    answer: {
      en: 'Setnayan Stories is where real events are told in full: editorial features written by Setnayan and chapters told by storytellers. They cover Filipino weddings, debuts, anniversaries, graduations, travels and reunions.',
      tl: 'Ang Setnayan Stories ang lugar kung saan ikinukuwento nang buo ang totoong mga event: mga editorial feature na isinulat ng Setnayan at mga kabanatang ikinuwento ng storytellers. Sakop ang Pinoy na kasal, debut, anibersaryo, graduation, biyahe at reunion.',
    },
    forWho: {
      en: 'Anyone who wants ideas from real events before planning their own.',
      tl: 'Para sa sinumang gustong kumuha ng ideya mula sa totoong event bago magplano ng sarili.',
    },
    steps: {
      en: ['Open Stories and browse features and chapters.', 'Read an event told in full by people who were there.', 'Take what inspires you into your own plan.'],
      tl: ['Buksan ang Stories at mag-browse ng features at kabanata.', 'Basahin ang event na ikinuwento nang buo ng mga nandoon.', 'Dalhin ang nakapagbigay-inspirasyon sa sarili mong plano.'],
    },
    different: {
      en: ['Told by the people who were there, not stock copy.', 'Covers more than weddings: debuts, anniversaries, graduations, travels and reunions.', 'Written as editorial features, not ads.'],
      tl: ['Ikinuwento ng mga nandoon, hindi stock na teksto.', 'Hindi lang kasal ang sakop: debut, anibersaryo, graduation, biyahe at reunion.', 'Isinulat bilang editorial feature, hindi patalastas.'],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Found a look you love? Find suppliers who can do it.', tl: 'May nagustuhang itsura? Maghanap ng supplier na kayang gawin ito.' } },
      { slug: 'mood-board', how: { en: 'Take what inspires you into your own mood board.', tl: 'Dalhin ang nagbigay-inspirasyon sa sarili mong mood board.' } },
    ],
    faq: {
      en: [
        { q: 'What are Setnayan Stories?', a: 'Real events told in full: editorial features written by Setnayan and chapters told by storytellers.' },
        { q: 'Which events are covered?', a: 'Filipino weddings, debuts, anniversaries, graduations, travels and reunions.' },
        { q: 'Who writes the stories?', a: 'Some are editorial features written by Setnayan. Others are chapters told by storytellers who were there.' },
      ],
      tl: [
        { q: 'Ano ang Setnayan Stories?', a: 'Mga totoong event na ikinuwento nang buo: editorial features na isinulat ng Setnayan at mga kabanatang ikinuwento ng storytellers.' },
        { q: 'Anong mga event ang sakop?', a: 'Pinoy na kasal, debut, anibersaryo, graduation, biyahe at reunion.' },
        { q: 'Sino ang sumusulat ng mga kuwento?', a: 'May editorial features na isinulat ng Setnayan. May mga kabanatang ikinuwento ng storytellers na nandoon.' },
      ],
    },
    keywords: {
      en: ['real Filipino wedding stories', 'event inspiration Philippines', 'debut stories'],
      tl: ['totoong kuwento ng kasal', 'inspirasyon sa event'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/realstories',
    evidence: ['app/(shell)/realstories/page.tsx'],
  },
];
