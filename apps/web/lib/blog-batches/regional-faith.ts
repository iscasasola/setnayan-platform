import type { BlogArticle } from '@/lib/blog';

// Regional + faith editorial batch (H2 2026). Ten culture/vendor explainers for
// couples planning weddings rooted in a region (Visayan/Cebuano, Ilocano) or a
// faith/community (Muslim/Moro, Chinese-Filipino, Iglesia ni Cristo, born-again,
// Aglipayan), plus mixed-faith, destination and venue-type guides. Written as a
// respectful, informed outsider-guide: traditions described in general,
// well-established terms; variation attributed to community/family/officiant.
// No invented doctrine, liturgy or fees. Benefits-only Setnayan facts, sparingly.

const REGIONAL_ALT =
  'A Filipino wedding celebration with traditional touches — family, flowers and warm light';
const CEREMONY_ALT = 'A couple at the altar in a sunlit church';

export const ARTICLES_REGIONAL: BlogArticle[] = [
  {
    slug: 'visayan-cebuano-wedding-traditions',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'Visayan and Cebuano wedding traditions',
    excerpt:
      'From the pamalaye to the lechon-laden feast, the Visayan and Cebuano wedding customs couples love to keep.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-07-03',
    blocks: [
      {
        type: 'p',
        text: 'A wedding in the Visayas carries a particular warmth. From Cebu to Bohol, Iloilo to Bacolod, the day is built on family, food and a generosity of spirit that fills every room. If you grew up in the region — or you are marrying into it — you will recognise the rhythm: the families meet first, the church or the beach hosts the vows, and then the celebration spills well into the night. Here are the traditions Visayan and Cebuano couples most often choose to honour, described in general terms. The exact form always varies by family, town and province, so treat your elders as the final word on what your own celebration should hold.',
      },
      {
        type: 'h2',
        text: 'The families meet first',
      },
      {
        type: 'p',
        text: 'Long before the gown is chosen, the two families come together. The pamalaye — the formal visit of the groom’s family to the bride’s home to ask for her hand and set the plans in motion — is one of the most cherished moments in a Visayan wedding. It is part proposal, part negotiation, part feast, and it sets the tone of mutual respect that the rest of the planning depends on. Many families still treat this gathering as the true beginning of the wedding, more so than any deposit paid or date booked.',
      },
      {
        type: 'p',
        text: 'It is also a practical meeting. Over a shared meal, the elders sort out the things that are awkward to raise later: how the costs will be divided, which family hosts which part of the day, and who will stand as principal sponsors. Getting these settled early, with everyone in the same room, prevents the quiet tensions that can otherwise surface in the final weeks.',
      },
      {
        type: 'ul',
        items: [
          'The groom’s family brings food, and sometimes a gift, as a gesture of goodwill.',
          'Both sides discuss the date, the budget split, and who is responsible for what.',
          'Ninong and ninang (sponsors) are often raised here — see our entourage guide for who they are and what they do.',
          'The conversation sets a tone of respect that carries through the whole engagement.',
        ],
      },
      {
        type: 'h2',
        text: 'The ceremony and the symbols',
      },
      {
        type: 'p',
        text: 'Most Visayan couples marry in a Catholic church, so the familiar Filipino sacramental symbols appear: the veil draped over the couple to signify being clothed as one, the cord (yugal) looped in a figure-eight for lifelong unity, and the thirteen arrhae (coins) entrusted to the couple as a promise of provision. These are shared across the Philippines rather than uniquely Visayan, but the region brings its own touches — candle-lighting, the releasing of doves, and music sung in Cebuano or Hiligaynon that makes the moment unmistakably home. Some couples weave in a beloved local hymn or a song from their hometown to ground the ceremony in the place they come from.',
      },
      {
        type: 'quote',
        text: 'In the Visayas, the wedding is never just the couple’s — it belongs to two families who have already feasted together to make it happen.',
      },
      {
        type: 'h2',
        text: 'The feast is the heart of it',
      },
      {
        type: 'p',
        text: 'No Visayan celebration is complete without a generous table, and the lechon — Cebu’s is famous nationwide — is often the centrepiece. Expect roast pig, native delicacies, and a spread that no one is meant to finish. Hospitality here is measured in abundance: a host would rather over-cater than risk a guest leaving hungry. Budget accordingly, and lean on a caterer who knows regional favourites and can balance the showpiece lechon with the lighter dishes guests reach for once the feasting slows. A few customs you may still see at the reception: the money dance, where guests pin bills to the couple to help them start their life together; long, heartfelt toasts from family and ninong; and dancing that keeps going long after the formal programme ends. None of it is obligatory — the joy of a regional wedding is choosing the pieces that mean something to you and your families, and letting the rest go.',
      },
      {
        type: 'p',
        text: 'However you blend the old and the new, a clear plan keeps the day calm. A free planning workspace lets you track the pamalaye, the church, the caterer and the guest list in one place — and a free wedding website makes it easy to share details with relatives spread across the islands and abroad, so no one is left guessing about the date or the dress code.',
      },
      {
        type: 'cta',
        text: 'Ready to map out your own Visayan celebration, from the family meeting to the feast?',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'ilocano-wedding-traditions',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'Ilocano wedding traditions, explained',
    excerpt:
      'Thrift, family and the famous bitor — a warm look at the Ilocano wedding customs that endure across the North.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-07-22',
    blocks: [
      {
        type: 'p',
        text: 'Ilocano weddings carry the temperament of the North: practical, deeply rooted in family, and quietly generous. The region is known for valuing thrift and hard work, and you can feel it in how a wedding is planned — every peso considered, every relative involved, nothing wasted. But do not mistake thrift for restraint. An Ilocano celebration is full of heart, and the customs around it have endured for generations. Here is a respectful overview; as always, the exact practices vary by family and town, so let your elders guide the details that matter most to you.',
      },
      {
        type: 'h2',
        text: 'Family at the centre',
      },
      {
        type: 'p',
        text: 'As across much of the Philippines, the two families meet formally before the wedding to ask for the bride’s hand and agree on the plans. In Ilocano households this gathering is taken seriously: it is where responsibilities are divided, the date is set, and the sponsors are named. Respect for elders runs through everything, and their counsel often shapes the biggest decisions — from the choice of date to the size of the celebration. A couple who brings the elders along early tends to have a much smoother road to the altar. There is a quiet practicality at work too: by settling money and roles around a table, with food shared and elders present, an Ilocano family avoids the awkward late conversations that strain so many weddings. What looks like ceremony is also good planning — the kind that keeps a celebration affordable and a family at peace.',
      },
      {
        type: 'h2',
        text: 'The bitor — a tradition of shared support',
      },
      {
        type: 'p',
        text: 'Perhaps the most well-known Ilocano wedding custom is the bitor: a gift-giving or money-pinning tradition where guests, family and friends contribute to help the newlyweds begin married life. In some celebrations it takes the form of the familiar money dance, with bills pinned to the couple as they dance; in others it is a more formal offering received and recorded by a relative. Whatever the form, the spirit is the same — the community pools its resources so the couple does not start out alone, and the gesture is remembered for years.',
      },
      {
        type: 'ul',
        items: [
          'It reflects the Ilocano value of bayanihan — neighbours helping neighbours.',
          'Contributions are sometimes recorded so the couple can return the kindness at future weddings.',
          'It eases the financial weight on the couple and their parents.',
          'It turns the reception into a genuine act of community, not just a party.',
        ],
      },
      {
        type: 'quote',
        text: 'The bitor says something gentle about the North: no couple should have to begin their married life carrying the whole cost alone.',
      },
      {
        type: 'h2',
        text: 'The ceremony and the table',
      },
      {
        type: 'p',
        text: 'Most Ilocano couples marry in a Catholic church, sharing the veil, cord and arrhae symbols common across the country. The reception that follows is hearty and unpretentious. Ilocano cuisine is famous for its bold, frugal genius — pinakbet, bagnet, dinardaraan, longganisa — and a wedding table is a wonderful chance to show it off. Expect food that is rich in flavour and rooted in the land, served generously to a room full of relatives who travelled in from across the region.',
      },
      {
        type: 'p',
        text: 'The thrift the region is known for is a planning asset, not a limit. Careful budgeting and a clear timeline let an Ilocano couple host a celebration that feels abundant without overspending — choosing where to be generous (the food, the people) and where to keep things simple (the extras that few guests will remember). Many of the tools that help you plan this way are free, which keeps the spirit of the bitor alive in the planning itself.',
      },
      {
        type: 'p',
        text: 'A free planning workspace keeps the guest list, the budget and the vendor short-list in one place, and a free wedding website helps relatives in Manila or abroad follow along. If you are just starting out, our printable checklist is a calm, practical first step.',
      },
      {
        type: 'cta',
        text: 'Plan your Northern celebration with a free, deadline-aware checklist.',
        href: '/blog/free-printable-wedding-checklist-philippines',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'muslim-moro-wedding-philippines',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'The Muslim (Moro) wedding in the Philippines',
    excerpt:
      'A respectful overview of the Muslim Filipino wedding — the nikah, the mahr, and the role of family and the imam.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-08-10',
    blocks: [
      {
        type: 'p',
        text: 'A Muslim Filipino wedding is, at its heart, a solemn covenant and a joyful coming-together of two families. Among the Moro peoples of Mindanao — the Maranao, Maguindanao, Tausug and others — the celebration can be richly cultural, layered with music, attire and feasting that vary beautifully from community to community. This overview is written respectfully by an informed outsider; it describes the marriage in general, well-established terms only. For the specifics that matter to your union, the right guides are your imam and your families, and the governing law is the Code of Muslim Personal Laws of the Philippines.',
      },
      {
        type: 'h2',
        text: 'The nikah — the marriage contract',
      },
      {
        type: 'p',
        text: 'The central act of an Islamic marriage is the nikah, the marriage contract solemnised in the presence of witnesses and officiated by an imam or other qualified person. It is built on consent, on the agreement of the parties, and on the involvement of family. The exact form — the words, the setting, the order of the day — varies by community and officiant, so confirm everything with yours. What is constant is the seriousness of the commitment and the witnessing of it by family and community.',
      },
      {
        type: 'h2',
        text: 'The mahr (dowry) and the families',
      },
      {
        type: 'p',
        text: 'A defining feature of the Islamic marriage is the mahr — a gift or dowry given by the groom to the bride as her own. It is a mark of honour and commitment, and the details are agreed between the families. Among Moro communities the family plays a central, respected role throughout: in the courtship, in the negotiations, and in the celebration that follows. The wali (guardian) of the bride is part of this process. None of these elements is decorative; each carries meaning, and each is best understood through your own family and officiant rather than a general guide.',
      },
      {
        type: 'ul',
        items: [
          'The marriage rests on the consent of the parties and the involvement of family.',
          'The mahr is the bride’s own; its nature and amount are agreed between the families.',
          'Witnesses and a qualified officiant are part of a valid nikah.',
          'Cultural practices — attire, music, the kanduli feast — differ across Maranao, Maguindanao, Tausug and other communities.',
        ],
      },
      {
        type: 'quote',
        text: 'A Moro wedding is a covenant witnessed by community: two people consenting, two families joining, an entire kin-network celebrating as one.',
      },
      {
        type: 'h2',
        text: 'The celebration',
      },
      {
        type: 'p',
        text: 'Beyond the contract, the festivities can be magnificent. The kanduli — the communal feast — gathers the wider family and community. Traditional dress, the okir art motifs of Maranao culture, kulintang gong-and-drum ensembles, and dances passed down through generations can all feature, depending on the family and locality. Halal catering is essential, and many couples plan the day around prayer times and the comfort of elders. The richness of the celebration is a point of pride, and it differs from one community to the next — there is no single template for a Moro wedding.',
      },
      {
        type: 'h2',
        text: 'The legal layer',
      },
      {
        type: 'p',
        text: 'Muslim marriages in the Philippines are governed by the Code of Muslim Personal Laws (Presidential Decree 1083). Requirements, registration and the role of the Shari’ah authorities are best confirmed with your imam and your local Shari’ah Circuit Court office, because details and procedures vary by place and situation. We describe customs here in general terms only and do not give legal or religious rulings — defer to your officiant and your community on anything that affects the validity or registration of your marriage. For the universal parts — the guest list, the budget, the suppliers and the timeline — a free planning workspace can help keep everything in one calm place while your family and imam carry the religious and legal heart of the day, and a free wedding website makes it easy to share details with relatives near and far.',
      },
      {
        type: 'cta',
        text: 'Organise the everyday logistics in one calm place, and leave the sacred parts to your family and imam.',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'chinese-filipino-wedding-tea-ceremony',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'Chinese-Filipino weddings and the tea ceremony',
    excerpt:
      'The tea ceremony, the colour red and ang pao — how Chinese-Filipino couples honour elders and family on the big day.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-08-28',
    blocks: [
      {
        type: 'p',
        text: 'For many Chinese-Filipino couples, a wedding is where two heritages meet gracefully. The church or civil ceremony may follow a familiar Filipino form, but woven around it are customs carried from Chinese tradition — and the most beloved of all is the tea ceremony. It is an intimate, deeply moving moment of respect for parents and elders, and for many families it is the emotional centre of the entire day. Practices differ from family to family and from one generation to the next, so treat this as a warm general guide and let your elders lead on the particulars.',
      },
      {
        type: 'h2',
        text: 'The tea ceremony — respect, served in a cup',
      },
      {
        type: 'p',
        text: 'In the tea ceremony, the couple serves tea to their parents, grandparents and elder relatives as a gesture of gratitude and respect. The elders, in turn, offer their blessings and formally welcome the new son or daughter into the family. It is usually a private, family-focused ritual held at home or before the reception, and it often moves everyone present to tears. Unlike the public spectacle of the reception, this is a quiet, almost sacred exchange between generations.',
      },
      {
        type: 'p',
        text: 'There is a gentle order to it. The couple usually serves the most senior relatives first and works outward through the family, addressing each elder by their proper title — a small detail that carries real weight, because using the correct family term is itself a sign of respect. An older relative or a hired coordinator who knows the family tree often helps the couple get the sequence and the titles right.',
      },
      {
        type: 'ul',
        items: [
          'The couple kneels or bows and offers tea to each elder, often in a set order of seniority.',
          'Elders sip the tea, then give their blessing — and frequently a red envelope (ang pao) or a piece of gold jewellery.',
          'Addressing each elder by their proper family title is part of the respect being shown.',
          'It is usually held privately, away from the larger crowd, which keeps the moment tender.',
        ],
      },
      {
        type: 'quote',
        text: 'A single cup of tea, offered with both hands, says what a thousand words cannot: thank you, and please bless us.',
      },
      {
        type: 'h2',
        text: 'Red, gold and ang pao',
      },
      {
        type: 'p',
        text: 'Red is the colour of joy and good fortune, and it appears throughout — in décor, in attire (a bride may change into a red qipao or cheongsam for part of the day), and in the ang pao, the red envelopes of money given as blessings. Gold, doubled symbols and other auspicious details often feature too. Many families also consult a trusted elder or almanac when choosing the wedding date, favouring a day considered fortunate. None of this is superstition for its own sake; it is a way of wrapping the marriage in good wishes from the very start.',
      },
      {
        type: 'h2',
        text: 'Blending two traditions in one day',
      },
      {
        type: 'p',
        text: 'Most Chinese-Filipino couples comfortably hold both worlds: a Catholic, Christian or civil ceremony for the legal and religious union, and the tea ceremony plus other Chinese customs for the family honours. The key to a smooth day is sequencing — deciding what happens when, and making sure elders on both sides understand the flow. A morning tea ceremony, an afternoon church wedding and an evening banquet is one common shape, but yours can be whatever lets both heritages breathe.',
      },
      {
        type: 'p',
        text: 'Running two traditions in a single day takes a clear timeline. A free planning workspace lets you lay out the church, the tea ceremony and the reception side by side, and a free wedding website helps relatives — including those overseas — follow the same schedule without a dozen group chats.',
      },
      {
        type: 'cta',
        text: 'Sequence your tea ceremony and reception together in one simple plan.',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'iglesia-ni-cristo-wedding-overview',
    cover: '/blog/ceremony.webp',
    coverAlt: CEREMONY_ALT,
    title: 'An overview of an Iglesia ni Cristo wedding',
    excerpt:
      'A respectful overview of an Iglesia ni Cristo wedding — held in the chapel, led by a minister, by the church’s rules.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-09-16',
    blocks: [
      {
        type: 'p',
        text: 'A wedding within the Iglesia ni Cristo is a solemn, faith-centred occasion held within the life of the church. It is conducted in the congregation’s own chapel, officiated by a minister of the church, and follows the church’s own order and requirements. Because the ceremony is governed entirely by the congregation, the most important guidance for any couple comes from their own minister. This article offers only a respectful, general sense of what to expect, and defers to the church on every specific — there is no substitute for speaking directly with your congregation.',
      },
      {
        type: 'h2',
        text: 'Held within the congregation',
      },
      {
        type: 'p',
        text: 'Unlike a venue you book on the open market, the ceremony takes place in the Iglesia ni Cristo chapel and is led by a minister of the church. The form, the words and the conduct of the wedding follow the church’s established practice. Couples who are members are guided through the process directly by their local congregation, and that guidance — not any outside source, and certainly not a wedding blog — is the authority on what is required and how the day unfolds. The respectful thing to do is to let the church lead and to plan everything else around it.',
      },
      {
        type: 'p',
        text: 'For couples, this can actually be a relief. The most spiritually significant part of the day is held and shaped by people who know exactly how it should be done, which removes a whole category of decisions and worries. Your role is to follow the congregation’s guidance faithfully, to keep your minister informed of your plans, and to prepare yourselves for marriage in the way the church asks of you.',
      },
      {
        type: 'h2',
        text: 'What this means for your planning',
      },
      {
        type: 'p',
        text: 'Because the ceremony itself is arranged within the church, a couple’s outside planning energy goes mostly into the reception and the surrounding logistics, plus the civil legal requirements that apply to every Philippine marriage. The reception — the venue, the caterer, the photographer, the guest list — is yours to plan in the usual way, and it is where most of your supplier decisions will be made. Treat it as you would any celebration: set a budget, build a guest list, and choose suppliers you trust.',
      },
      {
        type: 'ul',
        items: [
          'The ceremony and its requirements are set by your congregation — speak with your minister early.',
          'Plan the reception, suppliers and guest list as you would for any celebration.',
          'The civil legal requirements (the marriage licence) still apply — see our guide to those.',
          'Confirm anything you are unsure of directly with the church, not from outside sources.',
        ],
      },
      {
        type: 'quote',
        text: 'For the sacred parts of the day, there is one right source: your own congregation and its minister.',
      },
      {
        type: 'h2',
        text: 'The legal layer applies to everyone',
      },
      {
        type: 'p',
        text: 'Whatever the religious form of a wedding, every marriage in the Philippines needs to meet the civil requirements — chiefly the marriage licence. That part is the same across faiths, and it is worth handling early because the timeline does not bend for anyone. Our explainer on marriage-licence requirements walks through the documents, the waiting period and where to file, so the paperwork never becomes a last-minute scramble.',
      },
      {
        type: 'p',
        text: 'For everything outside the ceremony, a free planning workspace keeps the reception, budget, suppliers and guest list organised, and a free wedding website makes sharing the details easy with family near and far. We keep the religious specifics general here out of respect — your congregation is the one to ask, and the only one with the answers that count. Treat anything you read elsewhere as background, and let your minister have the final word.',
      },
      {
        type: 'cta',
        text: 'Handle the civil paperwork on time — here is exactly what a marriage licence requires.',
        href: '/blog/marriage-license-requirements-philippines',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'born-again-christian-wedding-philippines',
    cover: '/blog/ceremony.webp',
    coverAlt: CEREMONY_ALT,
    title: 'The born-again Christian wedding in the Philippines',
    excerpt:
      'Scripture, worship and a pastor-led ceremony — a warm look at how born-again Christian couples in the Philippines marry.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-10-05',
    blocks: [
      {
        type: 'p',
        text: 'A born-again Christian wedding centres the couple’s faith in Christ and the Word of God. Held in the couple’s own church and led by their pastor, the ceremony tends to be warm, worshipful and personal — rich in scripture, prayer and praise music, and often shaped to reflect the couple’s own testimony. Practices and requirements differ from one congregation and denomination to another, so the surest guide is always your own pastor and church. What follows is a respectful, general overview, not a rulebook, and it should never stand in place of the counsel your own church gives you.',
      },
      {
        type: 'h2',
        text: 'A ceremony built on Scripture and worship',
      },
      {
        type: 'p',
        text: 'Where a Catholic wedding follows a fixed liturgy, a born-again ceremony is usually led by the pastor with more flexibility in its shape. Expect worship songs, a message or short sermon from the Word, heartfelt prayers over the couple, and vows that many couples choose to personalise. The tone is celebratory and devotional at once — a congregation rejoicing with the couple before God. For many couples, the chance to make the ceremony a genuine expression of their own walk of faith is the whole point.',
      },
      {
        type: 'p',
        text: 'That openness also means the ceremony often reflects the couple themselves. A song that mattered during the courtship, a friend who shares a short testimony, a particular passage of scripture that has carried the relationship — these personal touches are welcomed in a way a more fixed rite may not allow. The result is a wedding that feels intimate and unmistakably the couple’s own, even as it follows the church’s lead.',
      },
      {
        type: 'ul',
        items: [
          'The pastor of the couple’s church typically officiates.',
          'Scripture readings, a message, prayer and praise-and-worship music are common elements.',
          'Many couples write personal vows grounded in their faith and testimony.',
          'Pre-marriage counselling with the pastor is often part of the path to the wedding.',
        ],
      },
      {
        type: 'quote',
        text: 'For many born-again couples, the wedding is less a performance and more a worship service with two people at the centre of God’s blessing.',
      },
      {
        type: 'h2',
        text: 'Ask your church first',
      },
      {
        type: 'p',
        text: 'Requirements vary widely across independent and denominational churches — some ask for membership, a season of counselling, or specific documents before they will hold a wedding. Because there is no single national standard for born-again ceremonies, your own congregation is the authority on what it asks of you. Begin that conversation with your pastor early, well before you lock in a date, so the church’s requirements and your preferred timeline have room to meet in the middle rather than collide.',
      },
      {
        type: 'h2',
        text: 'The reception and the legal side',
      },
      {
        type: 'p',
        text: 'Outside the ceremony, planning looks much like any Filipino wedding: a venue, a caterer, photo and video, and a guest list. And as with every marriage in the country, the civil requirement — the marriage licence — still applies, so handle it early. If you are weighing a church ceremony against a purely civil one, our civil-versus-church explainer lays out the differences plainly, which can be a helpful conversation to have with your partner before you commit. Many born-again couples also build a simple programme that includes worship, so guests of every background can follow along and feel part of the celebration.',
      },
      {
        type: 'p',
        text: 'A free planning workspace keeps the reception, budget, suppliers and guests in one place while your church carries the spiritual heart of the day — and a free wedding website helps you share the details with everyone you love, in any city or province. With the practical side organised, you are free to focus your energy where it belongs: on the worship, the vows, and the people gathered to celebrate with you.',
      },
      {
        type: 'cta',
        text: 'Weighing church versus civil? Here is a clear, side-by-side comparison.',
        href: '/blog/civil-vs-church-wedding-philippines',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'aglipayan-wedding-overview',
    cover: '/blog/ceremony.webp',
    coverAlt: CEREMONY_ALT,
    title: 'The Aglipayan (Philippine Independent Church) wedding',
    excerpt:
      'Close in form to a Catholic rite but proudly Filipino — a respectful overview of the Aglipayan church wedding.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-10-23',
    blocks: [
      {
        type: 'p',
        text: 'The Aglipayan wedding belongs to the Iglesia Filipina Independiente — the Philippine Independent Church — a homegrown church born of the Filipino spirit at the turn of the twentieth century. For couples unfamiliar with it, the ceremony will feel close in form to a Catholic or Anglican rite: a liturgical church wedding led by a priest, rich in sacramental symbol. Many guests will not even notice a difference, while members feel the quiet pride of marrying within a uniquely Filipino faith. What follows is a respectful, general overview. The exact requirements and order of service are set by the parish, so let your own priest be your guide on the particulars.',
      },
      {
        type: 'h2',
        text: 'A familiar liturgical form',
      },
      {
        type: 'p',
        text: 'Because the Iglesia Filipina Independiente shares much of its liturgical heritage with the Catholic and Anglican traditions, an Aglipayan wedding will be recognisable to most Filipino guests. It is a solemn church ceremony, officiated by a priest, with the rhythm and dignity of a liturgical celebration. Couples often see the same beloved Filipino sacramental symbols woven in, which means guests of many backgrounds tend to feel immediately at home in the pews.',
      },
      {
        type: 'p',
        text: 'For couples drawn to the gravity and beauty of a traditional church wedding — but with roots in this distinctly Filipino faith — the Aglipayan ceremony offers both. It carries the weight of a sacramental rite while belonging fully to a church founded on Filipino soil, by Filipinos, for a Filipino congregation. That heritage is a source of real pride for many families, and it gives the day an added layer of meaning.',
      },
      {
        type: 'ul',
        items: [
          'A priest of the Iglesia Filipina Independiente officiates in the church.',
          'The veil, cord (yugal) and arrhae (thirteen coins) commonly appear, as in many Filipino church weddings.',
          'Sponsors — ninong and ninang — are part of the entourage, as in the wider tradition.',
          'The overall feel is close to a Catholic or Anglican rite, with a proudly Filipino character.',
        ],
      },
      {
        type: 'quote',
        text: 'The Aglipayan church is a distinctly Filipino institution — its weddings carry both the dignity of the old rite and the pride of a homegrown faith.',
      },
      {
        type: 'h2',
        text: 'Confirming the requirements',
      },
      {
        type: 'p',
        text: 'As with any church wedding, the parish sets its own requirements — documents, schedules, and any preparation it asks of the couple. These can differ from parish to parish, so the right move is to visit your local Aglipayan church early and ask directly. We keep specifics general here precisely because your parish, not an article, is the authority. An early visit also lets you build a warm relationship with the priest who will marry you, which makes the whole experience more personal. Bring your questions, take notes, and let the parish set the pace for the religious preparation.',
      },
      {
        type: 'h2',
        text: 'The shared Filipino layer',
      },
      {
        type: 'p',
        text: 'Around the ceremony, the planning mirrors any Filipino wedding: the entourage and sponsors, the reception, the caterer and the photographer. The civil requirement — the marriage licence — applies to every marriage in the country and should be handled early, because the legal timeline does not bend regardless of which church marries you. If the sacramental symbols are new to you, our explainer on Filipino wedding traditions unpacks the veil, the cord and the thirteen coins so guests and couple alike understand what each one means.',
      },
      {
        type: 'p',
        text: 'A free planning workspace keeps the reception, budget, suppliers and guest list organised while your parish guides the rite — and a free wedding website makes it easy to share the day with family near and far. With the practical details in hand, you can give the ceremony itself the attention it deserves, and lean on your priest for everything that touches the rite.',
      },
      {
        type: 'cta',
        text: 'Curious about the veil, cord and coins? Here is what each one means.',
        href: '/blog/filipino-wedding-traditions-explained',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'mixed-faith-wedding-philippines',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'Planning a mixed-faith wedding in the Philippines',
    excerpt:
      'Marrying across two faiths or two provinces? Here is how Filipino couples honour both families with grace and care.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-11-11',
    blocks: [
      {
        type: 'p',
        text: 'Love rarely checks which church, mosque or province you come from. Across the Philippines, couples marry across faiths and traditions all the time — Catholic and born-again, Christian and Muslim, Chinese heritage and Filipino custom, North and South. A mixed-faith wedding is not a problem to solve so much as two beautiful inheritances to honour at once. With early conversations and a little planning, both families can feel fully seen on the day. Here is how thoughtful couples approach it, in general terms — the specifics always belong to your families and your officiants.',
      },
      {
        type: 'h2',
        text: 'Start with the conversations, not the venue',
      },
      {
        type: 'p',
        text: 'The most important planning for a mixed-faith wedding happens in living rooms, not vendor showrooms. Talk early — with each other first, then with both sets of parents, then with the officiants of each faith. Understand what each tradition asks, what is non-negotiable for each family, and where there is room to blend. Many tensions dissolve simply because the conversation happened months ahead instead of the week before, when emotions and deadlines are both running high.',
      },
      {
        type: 'ul',
        items: [
          'Ask each officiant what their faith requires — and whether they will co-officiate or hold separate rites.',
          'Identify the one or two elements each family considers essential, and protect those.',
          'Decide the order of the day so neither tradition feels like an afterthought.',
          'Agree on language, music and attire that let everyone feel at home.',
        ],
      },
      {
        type: 'h2',
        text: 'Common ways couples blend two traditions',
      },
      {
        type: 'p',
        text: 'There is no single right format. Some couples hold one religious ceremony and weave symbols of the other tradition into the reception. Some hold two ceremonies — for instance, a religious rite and a separate cultural one such as a tea ceremony. Some marry civilly to satisfy the law, then celebrate each faith in its own moment, on its own day. Each faith sets its own rules about interfaith marriage, so confirm what is possible with your officiants rather than assuming; what one tradition permits, another may approach differently.',
      },
      {
        type: 'p',
        text: 'Small gestures of inclusion go a long way. Printing the order of service so guests can follow an unfamiliar rite, choosing readings or songs that speak to both sides, seating the two families thoughtfully, and briefing your entourage on what to expect — these quiet courtesies are what make every guest feel like a participant rather than a spectator. The goal is not to merge two faiths into one, but to let each be honoured fully and graciously.',
      },
      {
        type: 'quote',
        text: 'A mixed-faith wedding done well leaves no one feeling like a guest at someone else’s ceremony — both families recognise their own love in it.',
      },
      {
        type: 'h2',
        text: 'Keep the legal layer simple',
      },
      {
        type: 'p',
        text: 'Whatever the religious arrangement, every marriage in the Philippines needs to meet the civil requirements — the marriage licence above all. Sorting this early removes one variable from an already layered plan. Note too that Muslim marriages are governed by their own code; if one partner is Muslim, confirm the legal path with the appropriate authorities and your imam, rather than assuming the standard civil route applies in the same way.',
      },
      {
        type: 'p',
        text: 'When two traditions share a day, sequencing and communication are everything — and that is exactly where a calm plan helps. A free planning workspace lets you lay out both ceremonies, the reception and every supplier side by side, and a free wedding website helps both families, in any region or abroad, follow the same schedule so no one feels left out. Above all, remember that the effort you put into honouring both heritages is itself a love letter to your families — and a beautiful way to begin a marriage that already bridges two worlds.',
      },
      {
        type: 'cta',
        text: 'Bring both families’ traditions into one clear, shared plan.',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'destination-wedding-philippines-guide',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'A guide to a destination wedding in the Philippines',
    excerpt:
      'Plan a Philippine destination wedding — Boracay, Palawan or Tagaytay — without the logistics overwhelming the love.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-11-30',
    blocks: [
      {
        type: 'p',
        text: 'With more than seven thousand islands, the Philippines is one of the world’s great destination-wedding settings. A vow exchanged with Boracay’s white sand underfoot, Palawan’s lagoons behind you, Tagaytay’s ridge in the cool air, or a heritage church in Bohol — the country offers a backdrop for every kind of couple. A destination wedding takes more coordination than a hometown one, but with the right approach the logistics never overshadow the celebration. Here is how to plan one with a clear head and a generous heart.',
      },
      {
        type: 'h2',
        text: 'Choosing your destination',
      },
      {
        type: 'p',
        text: 'Different islands offer different experiences. Match the place to the wedding you imagine and to how easily your guests can reach it — a stunning location that half your guests cannot afford to travel to may not be the right one. Here is a quick orientation to the most popular settings.',
      },
      {
        type: 'ul',
        items: [
          'Boracay and Palawan — iconic beaches; stunning, but a longer trip and a higher travel cost for guests.',
          'Tagaytay — cool weather and lake views, an easy drive from Metro Manila, very guest-friendly.',
          'Bohol, Cebu and Siargao — beaches, heritage churches and surf, with growing supplier scenes.',
          'Batangas and Laguna — beaches, lakeside resorts and private estates within a short drive of the capital.',
        ],
      },
      {
        type: 'h2',
        text: 'The logistics that make or break the day',
      },
      {
        type: 'p',
        text: 'The hardest part of a destination wedding is everything around the ceremony. Plan for travel and accommodation — for you, your suppliers and your guests. Decide early whether you will fly in trusted suppliers from the city or hire local ones who know the venue, the light and the weather. Build in a day or two of buffer for travel and setup, and always have a wet-weather plan, especially for an outdoor or beach ceremony during the rainy season. The couples who enjoy their own destination wedding are the ones who over-prepared the logistics so the day itself could feel effortless.',
      },
      {
        type: 'p',
        text: 'A few details quietly make or break the guest experience. Confirm how guests will actually get from the airport or pier to the venue, block-book a hotel so everyone stays in one place, and think about transport between the ceremony and reception if they are apart. A welcome message with directions, a recommended packing note (think sunblock and comfortable shoes for sand), and clear timings save your guests stress — and save you a hundred last-minute questions.',
      },
      {
        type: 'quote',
        text: 'A destination wedding is really two events to plan — the celebration itself, and the journey that gets everyone there. Respect both.',
      },
      {
        type: 'h2',
        text: 'Budget realities',
      },
      {
        type: 'p',
        text: 'A destination wedding shifts costs in ways a local one does not. You may save on certain things and spend more on others — supplier travel and lodging, guest logistics, and venue packages at resorts. Many island venues sell all-in packages; read what is and is not included very carefully, because the gaps (corkage, overtime, supplier rooms) are where budgets quietly blow out. Give guests plenty of notice so they can budget their own flights and rooms, and consider a smaller, more intimate guest list to keep everyone’s costs sane. For general supplier price ranges to anchor your planning, our cost guide is a useful starting point.',
      },
      {
        type: 'p',
        text: 'Coordinating people, places and dates across islands is exactly the kind of thing a single calm plan makes manageable. A free planning workspace keeps your venue, travelling suppliers, budget and guest list in one view, and a free wedding website is invaluable for a destination wedding — one link with travel directions, accommodation tips and your schedule, shared with every guest at once instead of repeated across endless messages. Get the logistics right, and the islands will take care of the rest.',
      },
      {
        type: 'cta',
        text: 'Get a feel for supplier costs before you commit to an island.',
        href: '/blog/how-much-do-wedding-suppliers-cost-philippines',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'garden-vs-ballroom-vs-beach-wedding',
    cover: '/blog/regional.webp',
    coverAlt: REGIONAL_ALT,
    title: 'Garden, ballroom, or beach: choosing your venue type',
    excerpt:
      'Garden, ballroom or beach? A clear-eyed look at the trade-offs so you can pick the venue type that fits your wedding.',
    category: 'vendors',
    author: 'Setnayan Editorial',
    publishedAt: '2026-12-16',
    blocks: [
      {
        type: 'p',
        text: 'Before you fall in love with a particular venue, it helps to choose the kind of venue you want. Garden, ballroom and beach each create a completely different wedding — in mood, in cost, and in how much the weather gets a vote. There is no best choice, only the best fit for your guest list, your season and your style. Here is an honest comparison of the three most popular venue types in the Philippines, with the trade-offs laid out plainly so you can decide with your eyes open.',
      },
      {
        type: 'h2',
        text: 'The garden wedding',
      },
      {
        type: 'p',
        text: 'A garden wedding is romantic and natural, with greenery and open sky doing much of the styling for you — which can also keep décor costs down. It photographs beautifully in soft afternoon light and tends to feel relaxed and intimate. The catch is the weather: an outdoor garden needs a credible wet-weather backup, whether a tent or an indoor hall on standby, and the heat of midday can be punishing, so timing and shade matter a great deal. A late-afternoon ceremony that flows into a cooler evening reception is a tried-and-true way to get the best of the setting without melting your guests. In short, it is best for couples who want a natural, romantic, relaxed feel — just watch out for rain, heat and bugs at dusk, and always have a covered Plan B.',
      },
      {
        type: 'h2',
        text: 'The ballroom wedding',
      },
      {
        type: 'p',
        text: 'A hotel or events-place ballroom is the most controlled, predictable choice. The air-conditioning is reliable, the rain is irrelevant, and the in-house team often handles catering, tables and coordination as a package, which takes a real load off the couple. It suits larger guest counts and formal celebrations. The trade-off is that you are working within a fixed space and house rules, sometimes with a required in-house caterer, and a fully styled ballroom can carry a higher all-in cost than its sticker price suggests.',
      },
      {
        type: 'ul',
        items: [
          'Best for: larger or formal weddings, and couples who value certainty and convenience.',
          'Watch out for: less flexibility on suppliers and styling; read the package inclusions closely.',
        ],
      },
      {
        type: 'h2',
        text: 'The beach wedding',
      },
      {
        type: 'p',
        text: 'A beach wedding is the dream backdrop — sand, sea and a sunset ceremony. It is unbeatable for atmosphere and photos. But it is also the least controlled: wind, tide, heat and the rainy season all have opinions, many beach venues sit in destination locations far from the city, and barefoot-on-sand logistics (sound, seating, power, guest comfort) need careful handling. Plan it like the destination wedding it usually is, with travel and accommodation built into the budget from the start.',
      },
      {
        type: 'quote',
        text: 'Choose your venue type the way you would pick a road: not by the prettiest view, but by where it actually takes your guests, your budget and your season.',
      },
      {
        type: 'h2',
        text: 'How to decide',
      },
      {
        type: 'p',
        text: 'Weigh four things together: your guest count, your season and weather risk, your budget, and the feeling you want. A large formal wedding in the rainy months leans ballroom; an intimate, natural celebration in fair weather suits a garden; a couple chasing a sunset-and-sand dream — and willing to manage the logistics — heads to the beach. Once you have settled the type, choosing the actual venue gets far easier, because you are comparing like with like. Our venue-selection guide walks through the exact questions to ask each one before you sign. And whatever type you land on, a free planning workspace helps you compare venues and suppliers side by side at 0% commission — you deal with vendors directly — so you can see the real trade-offs before you commit. Visit a shortlist in person if you can, at the time of day your wedding will happen, and you will know very quickly which kind of venue feels like yours.',
      },
      {
        type: 'cta',
        text: 'Compare real venues and suppliers side by side, commission-free.',
        href: '/explore',
        label: 'Browse the vendor marketplace',
      },
    ],
  },
];

export const HOOKS_REGIONAL: Record<string, string> = {
  'visayan-cebuano-wedding-traditions':
    'It starts long before the gown — when the groom’s family brings food to the bride’s home and two families feast together. Here’s the Visayan wedding, from the pamalaye to the lechon. 🐷',
  'ilocano-wedding-traditions':
    'In the North, no couple begins married life carrying the whole cost alone. The gentle tradition behind that — and the customs that endure across Ilocandia — explained with warmth.',
  'muslim-moro-wedding-philippines':
    'A covenant witnessed by community, a gift that becomes the bride’s own, two families joined as one. A respectful look at the Muslim Filipino wedding — the nikah, the mahr and the family’s role. 🤍',
  'chinese-filipino-wedding-tea-ceremony':
    'A single cup of tea, offered with both hands, can move an entire family to tears. Here’s why it sits at the heart of so many Chinese-Filipino weddings — and how couples honour two heritages in one day.',
  'iglesia-ni-cristo-wedding-overview':
    'Some parts of a wedding have exactly one right source of guidance. A respectful overview of the Iglesia ni Cristo ceremony — and everything couples thoughtfully plan around it.',
  'born-again-christian-wedding-philippines':
    'Less a performance, more a worship service with two people at the centre of God’s blessing. A warm look at how born-again Christian couples in the Philippines say I do. 🙏',
  'aglipayan-wedding-overview':
    'A church born of the Filipino spirit, with weddings that carry both the dignity of the old rite and the pride of a homegrown faith. The Aglipayan wedding, explained gently and respectfully.',
  'mixed-faith-wedding-philippines':
    'Marrying across two faiths or two provinces? The secret isn’t the venue — it’s the conversations that happen months ahead. Here’s how Filipino couples honour both families with grace.',
  'destination-wedding-philippines-guide':
    'A destination wedding is really two events — the celebration, and the journey that gets everyone there. Here’s how to plan one across our islands without the logistics overwhelming the love. 🏝️',
  'garden-vs-ballroom-vs-beach-wedding':
    'The prettiest view isn’t always the right one. Garden, ballroom or beach — here’s the honest trade-off behind each, so your venue fits your guests, your season and your budget.',
};
