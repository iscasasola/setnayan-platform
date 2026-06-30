export const meta = {
  name: 'gen-refinement-photos',
  description: 'Generate on-brand 4:3 Recraft photos for every onboarding refinement leaf + its options',
  phases: [{ title: 'Generate', detail: 'one agent per refinement leaf — main + option photos' }],
};

// Absolute output base in the worktree's public assets (committed, CDN-served).
const OUT = '/Users/icecasasola/Setnayan/.claude/worktrees/onboarding-fixes-2026-06-08/apps/web/public/onboarding/refinements';

// Shared style appended to every prompt — keeps the whole set visually consistent
// (Clean Editorial palette · Filipino wedding · 4:3 editorial photography).
const BASE_STYLE =
  'realistic editorial wedding photography, Filipino wedding aesthetic, soft natural light, warm alabaster (#FBFBFA) and royal champagne-gold (#C5A059) tones with subtle deep-mulberry accents, shallow depth of field, elegant, premium, tasteful, clean composition, centered subject, no text, no watermark, no people-faces-in-focus';

// Every leaf gets a `_main` hero photo. `genOptions` = option labels that NEED a
// generated photo. Projectable leaves (ceremony / catering / photo_video) reuse the
// existing /onboarding/prefs/*.webp for their options, so they generate main-only
// (catering additionally needs the synthetic Halal option).
const LEAVES = [
  { key: 'ceremony', label: 'Ceremony venue', genOptions: [] },
  { key: 'catering', label: 'Catering', genOptions: ['Halal'] },
  { key: 'photo_video', label: 'Photo & Video', genOptions: [] },
  { key: 'coordinator', label: 'Coordinator / planner', genOptions: ['Day-of', 'Month-of', 'Partial', 'Full-service', 'Destination'] },
  { key: 'cake', label: 'Wedding cake', genOptions: ['Classic tiered', 'Naked / semi-naked', 'Floral', 'Modern minimalist', 'Themed'] },
  { key: 'florist', label: 'Florist / florals', genOptions: ['Lush & garden', 'Minimalist', 'Tropical', 'Dried / pampas', 'All-white'] },
  { key: 'hmua', label: 'Hair & Makeup', genOptions: ['Soft glam', 'Natural / no-makeup', 'Bold & editorial', 'Traditional', 'Airbrush'] },
  { key: 'live_band', label: 'Live Band', genOptions: ['Acoustic', 'Jazz / lounge', 'Pop / Top 40', 'OPM', 'Classical'] },
  { key: 'bride_attire', label: "Bride's Attire (wedding gown)", genOptions: ['Ball gown', 'A-line', 'Mermaid', 'Sheath', 'Filipiniana'] },
  { key: 'stylist', label: 'Stylist / Decorator (reception styling)', genOptions: ['Modern minimalist', 'Traditional classic', 'Rustic / industrial', 'Bohemian', 'Luxe glamour', 'Garden / organic', 'Themed'] },
  { key: 'stations', label: 'Food Stations', genOptions: ['Paella', 'Sushi', 'Ramen', 'Grill / BBQ', 'Pasta', 'Carving', 'Taco bar'] },
  { key: 'groom_attire', label: "Groom's Attire", genOptions: ['Classic suit', 'Slim-fit suit', 'Tuxedo', 'Three-piece', 'Barong (formal white)', 'Embroidered barong', 'Polo barong'] },
  { key: 'women_attire', label: "Women's entourage attire", genOptions: ['Long gown', 'Cocktail', 'Filipiniana', 'Mix & match', 'Coordinated set'] },
  { key: 'men_attire', label: "Men's entourage attire", genOptions: ['Matching suits', 'Barong set', 'Tux', 'Smart casual', 'Themed'] },
  { key: 'filipiniana', label: 'Filipiniana & Barongs', genOptions: ['Piña', 'Jusi', 'Calado embroidery', 'Modern couture', 'Regional weave'] },
  { key: 'grooming', label: 'Grooming', genOptions: ['Haircut & style', 'Beard grooming', 'Skincare / facial', 'Mani-pedi', 'Body treatments'] },
  { key: 'jewelry', label: 'Jewellery & Accessories', genOptions: ['Engagement ring', 'Wedding bands', 'Bridal jewellery', 'Veil', 'Headpiece', 'Garter'] },
  { key: 'dj', label: 'DJ', genOptions: ['Pop', 'Dance / EDM', 'Hip-hop', 'OPM', 'Classic rock', 'Throwback 80s/90s', 'K-pop'] },
  { key: 'wedding_singer', label: 'Wedding Singer', genOptions: ['OPM', 'Ballads', 'Pop', 'Jazz', 'Classical', 'Religious / liturgical', 'Broadway'] },
  { key: 'choir', label: 'Choir / Quartet', genOptions: ['Small choir', 'Large choir', 'String quartet', 'String trio', 'Chamber ensemble'] },
  { key: 'choreographer', label: 'Choreographer', genOptions: ['Traditional Filipino', 'Ballroom', 'Contemporary', 'Latin / salsa', 'K-pop', 'Broadway', 'Hip-hop'] },
  { key: 'performers', label: 'Performers', genOptions: ['Magician', 'Fire dancer', 'Comedy', 'Kulintang', 'Rondalla', 'Folk dancers'] },
  { key: 'livestream', label: 'Livestream', genOptions: ['1080p standard', '1080p premium', '4K'] },
  { key: 'mobile_bar', label: 'Mobile Bar', genOptions: ['Full cocktail', 'Beer & wine', 'Mocktail only', 'Coffee-focused', 'Whiskey & cigar', 'Themed'] },
  { key: 'coffee', label: 'Coffee / Espresso', genOptions: ['Espresso bar', 'Pour-over', 'Specialty beans', 'Tea bar', 'Both'] },
  { key: 'mocktail', label: 'Mocktail Bar', genOptions: ['Fruit', 'Herbal', 'Sparkling', 'Tea-based', 'Tropical', 'Dessert'] },
  { key: 'food_truck', label: 'Food Truck', genOptions: ['Burgers', 'Pizza', 'Tacos', 'Asian fusion', 'Filipino street food', 'Ice cream', 'Grilled skewers'] },
  { key: 'dessert', label: 'Dessert Station', genOptions: ['Pastries', 'Macarons', 'Cupcakes', 'Chocolate fountain', 'Candy buffet', 'Donut wall', 'Churros', 'Kakanin'] },
  { key: 'food_cart', label: 'Food Cart', genOptions: ['Halo-halo', 'Ice cream', 'Crepe / pancake', 'Cotton candy', 'Charcuterie', 'Mini lechon', 'Sorbetes'] },
  { key: 'photo_booth', label: 'Photo Booth', genOptions: ['Traditional', '360 booth', 'GIF', 'Polaroid / instax', 'Magic mirror', 'Patiktok'] },
  { key: 'henna', label: 'Henna / Tattoo', genOptions: ['Traditional Arabic', 'Modern minimalist', 'Elaborate bridal', 'Philippine Muslim'] },
  { key: 'printing', label: 'Printing & Invites', genOptions: ['Invitations', 'Save-the-date', 'Program', 'Place cards', 'Menu', 'Signage'] },
  { key: 'souvenirs', label: 'Souvenirs / Giveaways', genOptions: ['Edible', 'Practical / keychain', 'Decorative figurine', 'Native Filipino', 'Candle DIY', 'Succulent'] },
  { key: 'bridal_car', label: 'Bridal Car', genOptions: ['Luxury sedan', 'Limousine', 'Vintage / classic', 'SUV', 'Van / minivan', 'Carriage', 'Motorcycle escort'] },
  { key: 'guest_shuttle', label: 'Guest Shuttle', genOptions: ['12-pax van', '24-pax minibus', '48-pax bus', '56-pax coaster'] },
  { key: 'escort', label: 'Motorcycle Escort', genOptions: ['Parade', 'Escort', 'Police-style', 'Ceremonial diamond'] },
  { key: 'outdoor', label: 'Outdoor Rentals', genOptions: ['Tent', 'Generator', 'Mobile restroom', 'Cooling fans / misters', 'Outdoor sound', 'Outdoor lighting'] },
];

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['leaf', 'mainOk', 'options', 'failures'],
  properties: {
    leaf: { type: 'string' },
    mainOk: { type: 'boolean' },
    options: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'ok'],
        properties: { slug: { type: 'string' }, ok: { type: 'boolean' } },
      },
    },
    failures: { type: 'array', items: { type: 'string' } },
  },
};

phase('Generate');

const results = await parallel(
  LEAVES.map((leaf) => () => {
    const dir = `${OUT}/${leaf.key}`;
    const images = [{ slug: '_main', subjectHint: `a beautiful hero scene representing ${leaf.label}` }].concat(
      leaf.genOptions.map((o) => ({ slug: slug(o), subjectHint: `${o} — ${leaf.label}` })),
    );
    const list = images.map((im) => `- ${im.slug}  (subject: ${im.subjectHint})`).join('\n');
    return agent(
      `You generate on-brand wedding photos with the Recraft HTTP API and save them as files. Work entirely with the Bash tool.

OUTPUT DIR (create it first): ${dir}
Run once: \`mkdir -p ${dir}\`

Generate ${images.length} image(s) for the refinement "${leaf.label}". Each saves to ${dir}/<slug>.webp:
${list}

For EACH image:
1. Write a vivid but compact Recraft prompt: start with a concrete, photographable subject for the listed item (e.g. for "Classic tiered — Wedding cake" → "an elegant classic three-tier white wedding cake on a draped table"), then append exactly this style string:
   "${BASE_STYLE}"
   Keep the whole prompt under 950 characters. The subject must be a TASTEFUL, literal depiction of THAT specific option (the differences between options must be visually obvious). Avoid faces in sharp focus.
2. POST it to Recraft. Write the JSON body to a temp file to avoid quoting issues:
   \`printf '%s' "$JSON" > /tmp/rc_${leaf.key}_<slug>.json\` where JSON is {"prompt":"...","model":"recraftv3","style":"realistic_image","size":"1365x1024"}
   Build it safely with a heredoc or python3 json.dumps. Then:
   \`curl -s --max-time 120 -X POST https://external.api.recraft.ai/v1/images/generations -H "Authorization: Bearer $RECRAFT_API_KEY" -H "Content-Type: application/json" -d @/tmp/rc_${leaf.key}_<slug>.json\`
3. Parse the response JSON; take .data[0].url. If there is no url (error / 429 throttle / 5xx), wait 8 seconds and RETRY (up to 3 attempts total).
4. Download the webp: \`curl -s --max-time 90 "<url>" -o ${dir}/<slug>.webp\` and verify it is non-trivial: \`test $(stat -f%z ${dir}/<slug>.webp) -gt 8000\` (a valid Recraft webp is ~100KB–2MB). If too small / missing, retry the whole image up to 3 attempts.

Do them sequentially (don't overwhelm the API). Verify each saved file exists and is >8KB with \`ls -la ${dir}\` at the end.

Return the structured result: leaf="${leaf.key}", mainOk = whether _main.webp saved (>8KB), options = one {slug, ok} per non-main image, failures = slugs that failed after retries. Do NOT fabricate success — only report ok:true for files that actually exist and are >8KB.`,
      { label: `gen:${leaf.key}`, phase: 'Generate', schema: SCHEMA },
    );
  }),
);

const clean = results.filter(Boolean);
const totalLeaves = clean.length;
const mainOk = clean.filter((r) => r.mainOk).length;
const optsOk = clean.reduce((n, r) => n + (r.options || []).filter((o) => o.ok).length, 0);
const optsTotal = clean.reduce((n, r) => n + (r.options || []).length, 0);
const failures = clean.flatMap((r) => (r.failures || []).map((f) => `${r.leaf}/${f}`));
log(`Generated: ${mainOk}/${totalLeaves} mains · ${optsOk}/${optsTotal} option photos · ${failures.length} failures`);

return { totalLeaves, mainOk, optsOk, optsTotal, failures, perLeaf: clean };
