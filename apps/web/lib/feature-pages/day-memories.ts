import type { FeaturePageEntry } from './types';

/**
 * On the day + Keep the memories — Papic · Live Watch · Patiktok · Memories · Stories.
 *
 * Refreshed 2026-10-18 against `origin/main`:
 *   · Papic — priced by the whole credit ladder (PAPIC_GUEST_100 → _100K), not
 *     one rung; cameras, galleries and keeping the photos are free
 *     (`app/(shell)/papic/_papic-sections.tsx`). Per-guest credit limits are not
 *     claimed: that page's own docblock says they may be claimed only once shipped.
 *   · Live Watch — LIVE_STUDIO is one unlock for the whole event (`one_time`).
 *   · Patiktok — "use free, pay to save and share": making and watching a reel
 *     is free, the download is ◆ (free-plus). "Cleared for sharing" is NOT
 *     claimed; the music is Setnayan-owned, which is what the code can show.
 *   · Memories — the event's Memories page gathers the keepsake tools; it does
 *     not take guest messages, so that line is gone.
 */
/**
 * Every rung of the Papic credit ladder in `platform_retail_catalog_v2` — the
 * page shows "From" the lowest active one. Built from the rung sizes so the
 * list reads as what it is (and does not look like a column of keys to a
 * secret scanner). Each resulting code must exist in a migration
 * (`features-page-says-what-ships.test.ts`).
 */
const PAPIC_CREDIT_LADDER: readonly string[] = [
  '100', '200', '300', '400', '500', '1K', '2K', '4K', '5K', '6K', '7K', '10K', '20K', '30K', '50K', '100K',
].map((rung) => `PAPIC_GUEST_${rung}`);

export const DAY_MEMORIES_FEATURES: readonly FeaturePageEntry[] = [
  {
    slug: 'papic',
    group: 'day',
    icon: 'papic',
    name: { en: 'Papic', tl: 'Papic' },
    line: { en: 'Turns your guests into your photo crew.', tl: 'Ginagawang photo crew ang mga bisita mo.' },
    title: { en: 'Papic: Guest Photo Sharing for Events', tl: 'Papic: Photo Sharing ng Bisita sa Event' },
    description: {
      en: 'Guests shoot from their own phones with just a code, no app. Every photo finds its people, and you keep them all. Pay only for credits.',
      tl: 'Kukuha ang mga bisita gamit ang sarili nilang telepono, code lang, walang app. Napupunta ang bawat litrato sa mga nasa kuha. Credits lang ang babayaran.',
    },
    answer: {
      en: 'Papic turns your guests into your photo crew. Each guest shoots from their own phone with a code and a browser, with no app and no account. Photos sort into each person’s own gallery, and you receive all of them. The cameras and galleries are free; you pay only for credits, one per photo.',
      tl: 'Ginagawang photo crew ng Papic ang mga bisita mo. Kukuha ang bawat bisita gamit ang sarili nilang telepono, code at browser lang, walang app at account. Napupunta ang mga litrato sa gallery ng bawat tao, at matatanggap mo ang lahat. Libre ang cameras at galleries; credits lang ang babayaran mo, isa bawat litrato.',
    },
    forWho: {
      en: 'Hosts who want the whole room’s view of the day, from the seats a photographer never sits in.',
      tl: 'Para sa mga host na gustong makita ang buong kuwarto, mula sa mga upuang hindi kailanman inuupuan ng photographer.',
    },
    steps: {
      en: ['Guests join with a code and shoot photos, or ten-second Snippets, from their own phones.', 'Hold a guest’s place card in frame, or a table sign for the whole table, and the photos sort into their galleries.', 'Everyone goes home with theirs, and you get the whole set — with a keepsake magazine to print, free.'],
      tl: ['Sasali ang bisita gamit ang code at kukuha ng litrato, o sampung segundong Snippets, gamit ang sarili nilang telepono.', 'Hawakan sa frame ang place card ng bisita, o table sign para sa buong table, at mapupunta ang mga litrato sa gallery nila.', 'Uuwi ang lahat na may kopya nila, at makukuha mo ang buong set — kasama ang keepsake magazine na ipi-print, libre.'],
    },
    different: {
      en: ['No app and no account for guests.', 'You always receive all the photos, tagged or not.', 'Shooting still works with no signal and sends when it returns.', 'A guest who never adds a selfie is never face-matched, and anyone can ask to be blurred.', 'Credits never expire and there is no subscription. Photo challenges, video greetings and the keepsake magazine come with them.'],
      tl: ['Walang app at account ang bisita.', 'Lagi mong matatanggap ang lahat ng litrato, naka-tag man o hindi.', 'Gumagana pa rin ang pagkuha kahit walang signal at ipinapadala kapag bumalik ito.', 'Ang bisitang hindi nagdagdag ng selfie ay hindi kailanman ife-face-match, at kahit sino ay puwedeng humiling na i-blur.', 'Hindi nag-e-expire ang credits at walang subscription. Kasama nito ang photo challenges, video greetings at keepsake magazine.'],
    },
    worksWith: [
      { slug: 'guest-list', how: { en: 'Guests and tables from your list sort the photos.', tl: 'Ang bisita at table mula sa listahan mo ang nag-aayos ng mga litrato.' } },
      { slug: 'patiktok', how: { en: 'Moments captured become short reels.', tl: 'Ang mga nakuhang sandali ay nagiging maiikling reel.' } },
      { slug: 'live-watch', how: { en: 'Guest phones can also be the cameras for your live stream.', tl: 'Puwede ring camera ng live stream mo ang telepono ng bisita.' } },
      { slug: 'alaala', how: { en: 'Your photos are part of your event’s Memories.', tl: 'Bahagi ng Memories ng event mo ang mga litrato.' } },
    ],
    faq: {
      en: [
        { q: 'Do guests need an app?', a: 'No app and no account. A code and a browser is the whole thing.' },
        { q: 'Will we get all the photos?', a: 'Always, tagged or not, and whether or not the person in it asked to be blurred.' },
        { q: 'What do we pay for?', a: 'Only credits — one per photo, a little more for a video. Cameras, galleries and keeping your photos are free, credits never expire, and the price is read from our live catalogue.' },
        { q: 'What if the venue has no signal?', a: 'Shooting still works. Photos are held on the phone and send themselves when the signal returns.' },
        { q: 'Will this upset our photographer?', a: 'It should not. Your photographer composes the shots that matter and Papic covers the rest of the room. Nobody is replaced.' },
      ],
      tl: [
        { q: 'Kailangan ba ng app ng mga bisita?', a: 'Walang app at walang account. Code at browser lang ang kailangan.' },
        { q: 'Makukuha ba namin ang lahat ng litrato?', a: 'Lagi, naka-tag man o hindi, at humiling man o hindi ang nasa litrato na i-blur.' },
        { q: 'Ano ang babayaran namin?', a: 'Credits lang — isa bawat litrato, medyo higit para sa video. Libre ang cameras, galleries at pagtatago ng litrato, hindi nag-e-expire ang credits, at binabasa ang presyo mula sa live catalogue namin.' },
        { q: 'Paano kung walang signal sa venue?', a: 'Gumagana pa rin ang pagkuha. Hawak ng telepono ang mga litrato at kusang ipapadala kapag bumalik ang signal.' },
        { q: 'Magagalit ba ang photographer namin?', a: 'Hindi dapat. Binubuo ng photographer ang mahahalagang kuha at sinasaklaw ng Papic ang natitirang bahagi ng kuwarto. Walang pinapalitan.' },
      ],
    },
    keywords: {
      en: ['guest photo sharing wedding', 'QR code photo sharing', 'guests take photos no app', 'event photo app Philippines'],
      tl: ['photo sharing ng bisita', 'QR code litrato', 'litrato ng bisita sa event'],
    },
    shots: [
      {
        src: '/feature-shots/papic-0.jpg',
        alt: {
          en: 'A guest’s own Papic photos on the Event Hub on a phone: Your shots, with Camera and Gallery in the menu below',
          tl: 'Ang sariling mga litrato ng bisita sa Papic sa Event Hub sa telepono: Your shots, kasama ang Camera at Gallery sa menu sa ibaba',
        },
      },
    ],
    price: {
      kind: 'free-plus',
      catalogue: 'retail',
      codes: PAPIC_CREDIT_LADDER,
    },
    tryHref: '/papic',
    moreHref: '/papic',
    evidence: ['app/(shell)/papic/page.tsx', 'app/(shell)/papic/_papic-sections.tsx', 'lib/papic-guest.ts', 'lib/papic-gallery.ts', 'lib/papic-cameras-pure.ts'],
  },
  {
    slug: 'live-watch',
    group: 'day',
    icon: 'live',
    name: { en: 'Live Watch', tl: 'Live Watch' },
    line: { en: 'Brings the people who can’t be there into your day — live.', tl: 'Dinadala ang mga hindi makadalo sa araw mo — live.' },
    title: { en: 'Live Watch: Livestream Your Event', tl: 'Live Watch: I-livestream ang Event Mo' },
    description: {
      en: 'Stream your event live on your Event Hub so family overseas can watch with one tap. Guest phones are the cameras. One unlock covers the event.',
      tl: 'I-stream nang live ang event sa Event Hub mo para mapanood ng pamilyang nasa abroad sa isang tap. Telepono ng bisita ang camera. Isang unlock para sa event.',
    },
    answer: {
      en: 'Setnayan Live Watch streams your event live on your own Event Hub, through an unlisted YouTube broadcast. Guests’ phones join as cameras by scanning your event QR, and you cut between them. Viewers press play with no app and no account, from anywhere in the world.',
      tl: 'Ini-stream ng Setnayan Live Watch nang live ang event mo sa sarili mong Event Hub, sa pamamagitan ng unlisted na YouTube broadcast. Sumasali bilang camera ang telepono ng bisita sa pag-scan ng event QR mo, at ikaw ang lilipat sa pagitan nila. Magpe-play ang manonood nang walang app at account, mula saanman sa mundo.',
    },
    forWho: {
      en: 'Hosts with family, friends or elders who cannot travel to be in the room.',
      tl: 'Para sa mga host na may pamilya, kaibigan o nakatatandang hindi makabiyahe para makapunta.',
    },
    steps: {
      en: ['Unlock Live Watch for your event and link your YouTube channel.', 'On the day, guest phones join as cameras by QR, and one laptop sends the Main Stage you cut between them.', 'Viewers press play on your Event Hub. After the day the broadcast stays and anyone can watch it back.'],
      tl: ['I-unlock ang Live Watch para sa event mo at i-link ang YouTube channel mo.', 'Sa mismong araw, sumasali bilang camera ang telepono ng bisita gamit ang QR, at isang laptop ang nagpapadala ng Main Stage na nililipat-lipat mo.', 'Magpe-play ang manonood sa Event Hub mo. Pagkatapos ng araw, mananatili ang broadcast at mapapanood ito ulit ng kahit sino.'],
    },
    different: {
      en: ['Always unlisted: it never appears in YouTube search.', 'One unlock covers the whole event, with no day limit.', 'Cameras are guests’ phones, with nothing to install.', 'You need one Windows or Mac laptop at the event running free streaming software; a phone alone cannot send it.'],
      tl: ['Laging unlisted: hindi ito lalabas sa YouTube search.', 'Isang unlock para sa buong event, walang limitasyon sa araw.', 'Telepono ng bisita ang mga camera, walang ii-install.', 'Kailangan ng isang Windows o Mac na laptop sa event na may libreng streaming software; hindi ito kayang ipadala ng telepono lang.'],
    },
    worksWith: [
      { slug: 'event-hub', how: { en: 'The broadcast plays right on your Event Hub.', tl: 'Nagpe-play ang broadcast mismo sa Event Hub mo.' } },
      { slug: 'papic', how: { en: 'Guests’ phones can be the cameras, joined by QR.', tl: 'Puwedeng camera ang telepono ng bisita, sasali gamit ang QR.' } },
    ],
    faq: {
      en: [
        { q: 'What do I need on the day?', a: 'Guest phones can be the cameras. You also need one Windows or Mac laptop at the event running free streaming software.' },
        { q: 'How do guests watch?', a: 'They open your Event Hub and press play. No app, no account.' },
        { q: 'Is it per day?', a: 'No. One unlock covers your whole event. If you would rather not use your own YouTube channel, Setnayan can supply one for a daily fee.' },
        { q: 'Does it replace our videographer?', a: 'No. Your videographer still makes the keepsake film.' },
      ],
      tl: [
        { q: 'Ano ang kailangan sa mismong araw?', a: 'Puwedeng camera ang telepono ng bisita. Kailangan din ng isang Windows o Mac na laptop sa event na may libreng streaming software.' },
        { q: 'Paano nanonood ang mga bisita?', a: 'Bubuksan nila ang Event Hub mo at magpe-play. Walang app, walang account.' },
        { q: 'Per day ba ito?', a: 'Hindi. Isang unlock para sa buong event mo. Kung ayaw mong gamitin ang sarili mong YouTube channel, puwedeng magbigay ang Setnayan ng isa sa bayad kada araw.' },
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
      en: 'Pick the moments you love and a short, vertical reel composes itself with music, right in your browser. Make it free; pay to save and share.',
      tl: 'Piliin ang mga sandaling gusto mo at bubuo ang maikli at vertical na reel na may musika, sa browser mo mismo. Libreng gawin; may bayad i-save at ibahagi.',
    },
    answer: {
      en: 'Patiktok turns the moments from your event into a short, vertical highlight reel, set to music. You pick the moments, the length and a song, and the reel renders right in your browser with no editing app. Making and watching it is free; saving and sharing it is the upgrade.',
      tl: 'Ginagawang maikli at vertical na highlight reel ng Patiktok ang mga sandali ng event mo, may musika. Pipiliin mo ang mga sandali, haba at kanta, at mabubuo ang reel sa browser mo nang walang editing app. Libreng gawin at panoorin; ang pag-save at pagbabahagi ang upgrade.',
    },
    forWho: {
      en: 'Hosts who want something shareable the same night while the big film takes its time.',
      tl: 'Para sa mga host na gustong may maibabahagi sa parehong gabi habang matagal pa ang malaking film.',
    },
    steps: {
      en: ['Photos and short clips from your event gather inside Setnayan.', 'Choose your moments, a length and a song.', 'Watch it free; unlock the download to save and share it.'],
      tl: ['Naiipon sa Setnayan ang mga litrato at maiikling clip ng event mo.', 'Pumili ng mga sandali, haba at kanta.', 'Panoorin nang libre; i-unlock ang download para i-save at ibahagi.'],
    },
    different: {
      en: ['The reel renders in your browser — no editing app and no waiting overnight.', 'Every reel uses music Setnayan owns.', 'It does not replace your event film; it is the fast, shareable version.'],
      tl: ['Nabubuo ang reel sa browser mo — walang editing app at walang paghihintay magdamag.', 'Musikang pag-aari ng Setnayan ang gamit ng bawat reel.', 'Hindi nito pinapalitan ang event film mo; ito ang mabilis at maibabahaging bersyon.'],
    },
    worksWith: [
      { slug: 'papic', how: { en: 'Moments your guests captured feed your reels.', tl: 'Ang mga sandaling nakuha ng bisita ang pinagkukunan ng reels mo.' } },
      { slug: 'music-maker', how: { en: 'Your own song, once delivered, backs your reels.', tl: 'Ang sarili mong kanta, kapag naihatid na, ang musika ng reels mo.' } },
    ],
    faq: {
      en: [
        { q: 'What is a Patiktok reel?', a: 'A short, vertical highlight video of your event, set to music.' },
        { q: 'Do I need to edit anything?', a: 'No. Pick the moments, length and song, and the reel renders in your browser.' },
        { q: 'What is free?', a: 'Making and watching a reel. Saving and sharing it is the ◆ upgrade, priced in the live catalogue.' },
      ],
      tl: [
        { q: 'Ano ang Patiktok reel?', a: 'Maikli at vertical na highlight video ng event mo, may musika.' },
        { q: 'Kailangan ko bang mag-edit?', a: 'Hindi. Piliin ang mga sandali, haba at kanta, at mabubuo ang reel sa browser mo.' },
        { q: 'Ano ang libre?', a: 'Ang paggawa at panonood ng reel. Ang pag-save at pagbabahagi ang ◆ upgrade, nasa live catalogue ang presyo.' },
      ],
    },
    keywords: {
      en: ['wedding highlight reel', 'vertical event video', 'short video from event photos'],
      tl: ['highlight reel ng kasal', 'vertical na video'],
    },
    shots: [],
    price: { kind: 'free-plus', catalogue: 'retail', codes: ['PATIKTOK_COMPILER'] },
    moreHref: '/patiktok',
    evidence: ['app/(shell)/patiktok/page.tsx', 'lib/patiktok.ts', 'app/dashboard/[eventId]/studio/patiktok/page.tsx'],
  },
  {
    slug: 'alaala',
    group: 'memories',
    icon: 'galleries',
    name: { en: 'Memories', tl: 'Memories' },
    line: { en: 'Your event’s keepsakes, gathered in one place.', tl: 'Ang mga keepsake ng event mo, iniipon sa isang lugar.' },
    title: { en: 'Memories: Keep Your Event in One Place', tl: 'Memories: Itago ang Event sa Isang Lugar' },
    description: {
      en: 'Your guests’ photos, your live broadcast, your Event Hub, your 3D plan and your logo, gathered in one place you can return to and share.',
      tl: 'Ang mga litrato ng bisita, live broadcast, Event Hub, 3D plan at logo mo, iniipon sa isang lugar na puwedeng balikan at ibahagi.',
    },
    answer: {
      en: 'Setnayan Memories is where your event’s keepsakes meet: the photos from Papic, the Live Watch broadcast, your Event Hub, your 3D Plan and your logo. Each stands on its own; together they are the memory of the day, one tap away whenever you return.',
      tl: 'Ang Setnayan Memories ang tagpuan ng mga keepsake ng event mo: ang mga litrato mula sa Papic, ang Live Watch broadcast, ang Event Hub, ang 3D Plan at ang logo mo. Bawat isa ay nakatayo nang mag-isa; magkakasama, sila ang kuwento ng araw, isang tap lang kapag babalikan mo.',
    },
    forWho: {
      en: 'Hosts who want the day to stay somewhere better than a camera roll.',
      tl: 'Para sa mga host na gustong manatili ang araw sa lugar na mas maayos kaysa camera roll.',
    },
    steps: {
      en: ['Plan and hold your event as usual, using the pieces you want.', 'Each one you use — photos, broadcast, Event Hub, 3D Plan, logo — is reachable from Memories.', 'Return any time to relive it, and share it with the people who were there.'],
      tl: ['Magplano at idaos ang event gaya ng dati, gamit ang mga bahaging gusto mo.', 'Ang bawat ginamit mo — litrato, broadcast, Event Hub, 3D Plan, logo — ay maaabot mula sa Memories.', 'Balikan anumang oras, at ibahagi sa mga taong nandoon.'],
    },
    different: {
      en: ['Guests need no app and no account to see what you share.', 'It adds to your photographer’s work rather than replacing it.', 'You always see what is free and what is an add-on before you choose.'],
      tl: ['Walang app at account na kailangan ang bisita para makita ang ibinabahagi mo.', 'Dinadagdagan nito ang gawa ng photographer mo, hindi pinapalitan.', 'Lagi mong makikita kung ano ang libre at ano ang add-on bago ka pumili.'],
    },
    worksWith: [
      { slug: 'papic', how: { en: 'Papic photos are the heart of your Memories.', tl: 'Ang mga litrato ng Papic ang puso ng Memories mo.' } },
      { slug: 'live-watch', how: { en: 'The live broadcast stays to watch again.', tl: 'Nananatili ang live broadcast para mapanood ulit.' } },
      { slug: 'event-hub', how: { en: 'Your Event Hub carries the story after the day.', tl: 'Dala ng Event Hub mo ang kuwento pagkatapos ng araw.' } },
    ],
    faq: {
      en: [
        { q: 'What is Memories?', a: 'The place your event’s keepsakes meet: Papic photos, Live Watch, your Event Hub, 3D Plan and Logo Maker.' },
        { q: 'Is it free?', a: 'Planning your event is free. Some pieces are paid add-ons, and you see which before you choose.' },
        { q: 'Do my guests need an app?', a: 'No. They open what you share from your event link.' },
      ],
      tl: [
        { q: 'Ano ang Memories?', a: 'Ang tagpuan ng mga keepsake ng event mo: litrato ng Papic, Live Watch, Event Hub, 3D Plan at Logo Maker.' },
        { q: 'Libre ba ito?', a: 'Libreng planuhin ang event mo. May bayad na add-on ang ilang bahagi, at makikita mo kung alin bago ka pumili.' },
        { q: 'Kailangan ba ng app ng bisita?', a: 'Hindi. Binubuksan nila ang ibinabahagi mo mula sa event link mo.' },
      ],
    },
    keywords: {
      en: ['event memories keepsake', 'wedding photo gallery', 'relive your event'],
      tl: ['memories ng event', 'gallery ng kasal'],
    },
    shots: [],
    price: { kind: 'free' },
    moreHref: '/alaala',
    evidence: ['app/(shell)/alaala/page.tsx', 'app/dashboard/[eventId]/alaala/page.tsx', 'lib/alaala-wall.ts', 'lib/alaala-chapters.ts'],
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
      en: 'Setnayan Stories is where real events are told in full: editorial features written by Setnayan, with the hosts’ consent, and chapters told by storytellers. They cover Filipino weddings, debuts, anniversaries, graduations, travels and reunions.',
      tl: 'Ang Setnayan Stories ang lugar kung saan ikinukuwento nang buo ang totoong mga event: mga editorial feature na isinulat ng Setnayan, may pahintulot ng mga host, at mga kabanatang ikinuwento ng storytellers. Sakop ang Pinoy na kasal, debut, anibersaryo, graduation, biyahe at reunion.',
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
      en: ['Told by the people who were there, not stock copy.', 'An editorial is published only with the hosts’ consent.', 'Written as editorial features, not ads.'],
      tl: ['Ikinuwento ng mga nandoon, hindi stock na teksto.', 'Inilalathala lang ang editorial kapag may pahintulot ng mga host.', 'Isinulat bilang editorial feature, hindi patalastas.'],
    },
    worksWith: [
      { slug: 'marketplace', how: { en: 'Found a look you love? Find suppliers who can do it.', tl: 'May nagustuhang itsura? Maghanap ng supplier na kayang gawin ito.' } },
      { slug: 'mood-board', how: { en: 'Take what inspires you into your own mood board.', tl: 'Dalhin ang nagbigay-inspirasyon sa sarili mong mood board.' } },
    ],
    faq: {
      en: [
        { q: 'What are Setnayan Stories?', a: 'Real events told in full: editorial features written by Setnayan and chapters told by storytellers.' },
        { q: 'Which events are covered?', a: 'Filipino weddings, debuts, anniversaries, graduations, travels and reunions.' },
        { q: 'Who writes the stories?', a: 'Some are editorial features written by Setnayan with the hosts’ consent. Others are chapters told by storytellers who were there.' },
      ],
      tl: [
        { q: 'Ano ang Setnayan Stories?', a: 'Mga totoong event na ikinuwento nang buo: editorial features na isinulat ng Setnayan at mga kabanatang ikinuwento ng storytellers.' },
        { q: 'Anong mga event ang sakop?', a: 'Pinoy na kasal, debut, anibersaryo, graduation, biyahe at reunion.' },
        { q: 'Sino ang sumusulat ng mga kuwento?', a: 'May editorial features na isinulat ng Setnayan nang may pahintulot ng mga host. May mga kabanatang ikinuwento ng storytellers na nandoon.' },
      ],
    },
    keywords: {
      en: ['real Filipino wedding stories', 'event inspiration Philippines', 'debut stories'],
      tl: ['totoong kuwento ng kasal', 'inspirasyon sa event'],
    },
    shots: [
      {
        src: '/feature-shots/real-stories-0.jpg',
        alt: {
          en: 'A Stories editorial on a phone: a sample wedding story, clearly marked as a sample, with Relive it, share links and the cover photo',
          tl: 'Isang editorial ng Stories sa telepono: isang sample na kuwento ng kasal, malinaw na may markang sample, kasama ang Relive it, share links at ang cover photo',
        },
      },
    ],
    price: { kind: 'free' },
    moreHref: '/realstories',
    evidence: ['app/(shell)/realstories/page.tsx'],
  },
];
