/**
 * category-hints.ts — the ⓘ copy for the bench's folders and for the tiles that
 * no plan group claims.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `categoryHintForTile` (explore-info-copy.ts) resolves a tile's ⓘ from the
 * PLAN GROUP that claims it, and returns null for anything finer — the bench
 * then hides the button rather than inventing copy, which is the right refusal.
 * Measured 2026-09-06: of the 45 tiles reachable from the pick enum, **25 had
 * an ⓘ and 20 were silent**, several of them the ones a couple would most need
 * explained (`escort`, `referee_official`, `reveal_element`,
 * `personal_accident_insurance`). Its own docblock anticipated this: *"Tile-
 * level overrides arrive with the Taxonomy Studio."* This is that override map,
 * arriving early.
 *
 * FOLDERS had no ⓘ at all — no button, no copy, no mechanism. A collapsed
 * "Specialty" or "Dining extras" told a couple nothing until they expanded it.
 *
 * ── THE VOICE, AND THE ONE PLACE IT IS DELIBERATELY DROPPED ─────────────────
 * Every line: what it covers (concrete nouns) + a practical cue (timing or a
 * tip), under ~20 words, matching the 34 plan-group hints already shipping.
 *
 * ⚠ `farewell` is FUNERAL SERVICES. It carries no cue, no booking urgency and
 * no attempt to make anyone want to add it — someone reading it may have just
 * lost a person. The list of what is inside is the whole line. Do not "improve"
 * it into the house pattern.
 *
 * A tile-level entry WINS over the plan-group hint, so a tile whose group hint
 * is too generic can be sharpened here without touching PLAN_GROUPS.
 */

import type { WeddingFolder } from '@/lib/taxonomy';

/** ⓘ for a tile no plan group claims (or one whose group hint is too broad). */
export const TILE_HINTS: Readonly<Record<string, string>> = {
  choir:
    "Real voices rising as you walk in, and again as you walk out. Parish choirs follow the church calendar; ask early.",
  orchestra:
    "Strings swelling as the doors open — for the aisle, the first dance, or a gala. Send your song list 2 months out.",
  performers:
    "Band, acoustic duo, dancers, a cultural or fire show — the part guests film. Confirm set length and sound needs before you sign.",
  speaker_talent:
    "Host, emcee, keynote, or the celebrity guest people whisper about. Popular names hold dates first; book before the program is final.",
  kids_entertainer:
    "Magician, mascot, face painting, a games corner — the small guests stay delighted while the adults linger. Book 1-2 months out.",
  av_production:
    "Sound, lights, LED wall, mics — so every speech lands in the back row. Ask your venue what is in-house before you rent.",
  event_medic:
    "A nurse or paramedic quietly on standby at outdoor, sports, or large events. Many venues and tournaments require one.",
  tour_activity:
    "Island hopping, a city tour, team-building — the day your visiting guests talk about longest. Book once your headcount is firm.",
  tour_guide:
    "A local who knows the route, the stories behind it, and the shortcuts nobody posts. Book alongside your transport.",
  travel_insurance:
    "Cancelled flights, lost bags, medical care while away — handled, for you or a travelling group. Buy when you book flights.",
  restaurant_reservation:
    "A table waiting with your name on it — rehearsal dinner, intimate birthday, team lunch. Reserve 2-4 weeks out; longer on holidays.",
  brides_attire:
    "Gown, veil, shoes, and a second look for the dance floor. Designers need 4-6 months plus fittings.",
  grooms_attire:
    "Suit, barong, or tux, shoes, and the entourage matching you. Tailors need 2-3 months; ready-to-wear, less.",
  souvenir_giveaways:
    "What guests find in their bag next week — a token, a treat, a plant, corporate kits. Order 1-2 months out for personalisation.",
  // ── the six the owner defined on 2026-09-06 ──────────────────────────────
  escort:
    "A convoy clearing the way for the bridal car, VIP arrivals, or a group on the road. Confirm the route first.",
  reveal_element:
    "Cold sparks, confetti, smoke, a drone show, the gender-reveal burst — the gasp moment. Check the venue allows it before booking.",
  event_insurance:
    "Cancellation, postponement, venue damage — covered, so one bad week doesn't cost you twice. Arrange it once deposits go out.",
  personal_accident_insurance:
    "For the two of you, not your guests — medical costs looked after if something happens on the way or on the day.",
  referee_official:
    "Referees, umpires, scorers for tournaments; judges for contests and pageants — calls nobody argues with. Book accredited ones for anything with a prize.",
  // ── 2026-09-07 · the 30 tiles the first guard's universe never reached ────
  officiants: "The priest, pastor, or judge who says the words. Parish calendars fill fast — ask as soon as your date is close.",
  counseling_seminars: "The pre-Cana seminar most parishes require before they will marry you. Book early; slots are limited and the certificate is needed.",
  accommodation: "Rooms for you, the entourage, and guests travelling in. Hotels hold room blocks — ask before your date fills the city.",
  date_specialist: "Someone who reads the calendar for an auspicious date — feng shui or bazi. Consult before you commit to a day.",
  stations: "Lechon, pasta, carving, dessert — served from stations guests walk up to, instead of a plated course.",
  dance_floor: "The floor itself — LED, mirror, or classic parquet, laid over grass or tile so nobody dances on gravel.",
  outdoor: "Tents, canopies, cooling, ground cover, and wet-weather back-up. At a Philippine wedding this is the plan that saves the day.",
  fireworks: "Cold sparks, fountains, or a full sky display for the send-off. Check what your venue and the barangay allow first.",
  digital_services: "Your wedding website, e-invites, QR codes, and a digital guestbook — the paperless half of the invitation.",
  wedding_singer: "One voice, live — the aisle, the signing, the first dance. Send your song list once you have a date.",
  editorial: "A published feature of your wedding on a magazine or blog. Photographers usually submit; ask yours who they work with.",
  livestream: "A live broadcast for the people who cannot fly home. Confirm the venue's internet before anything else.",
  womens_attire: "Gowns for the entourage, mothers, and ninangs. Fittings and fabric take time, so start with the colour.",
  mens_attire: "Suits and coats for the groomsmen, fathers, and ninongs. Tailors need lead time; ready-to-wear needs less.",
  filipiniana_barongs: "Barong, Filipiniana, terno — piña, jusi, or cocoon. Hand-embroidery is slow, so order well before the fittings.",
  grooming: "Barber, skin, and nails for the groom's side. Book the trim close in; skin work months out.",
  coffee_espresso: "A barista pulling real espresso through cocktail hour and the after-party lull. Guests queue for this one.",
  mocktail: "Alcohol-free cocktails, properly made — for the drivers, the pregnant, the kids, and everyone else after midnight.",
  food_truck: "A truck parked at the reception, serving late. Check the venue allows one, and where it can stand.",
  dessert: "The table people drift back to — tarts, brazo, polvoron, gelato. Order alongside the cake, not instead of it.",
  food_cart: "Ice cream, fishball, taho, popcorn — the carts that turn cocktail hour into a fiesta. Priced per cart, per hour.",
  perfume_bar: "Guests blend a scent to take home. A giveaway and an activity in one — set it where people wait.",
  arcade_games: "Basketball, claw machines, retro cabinets — a corner for the people who do not dance.",
  henna_tattoo: "Henna or temporary ink applied on the spot. Popular with the entourage and every guest under twelve.",
  mini_nail_bar: "Quick manicures during the reception. A small, unhurried corner guests remember.",
  tarot_astrology_palmistry: "A reader at a small table — cards, stars, or palms. Queues form, so book by the hour.",
  caricature_calligraphy_painting: "An artist drawing guests, lettering names, or painting the scene live. They leave holding it.",
  engraving_embroidery: "Names and dates engraved or stitched onto giveaways, on the spot. Personalisation guests watch happen.",
  trophies_awards: "Medals, trophies, and plaques for tournaments and awards nights. Engraving needs the winners' names early.",
  transfers_rentals: "Airport pick-ups, guest vans, and the extras you hire rather than own — chairs, cars, coolers. Book once your headcount is firm.",
  massage_chair:
    "Machines for hire, or a therapist working the shoulders. Set them where guests wait: cocktail hour, tournament breaks.",
};

/**
 * ⓘ for a folder — shorter than a tile's, roughly 10-14 words. It ORIENTS; the
 * categories inside do the explaining.
 */
export const FOLDER_HINTS: Readonly<Record<WeddingFolder, string>> = {
  venue: "Churches, gardens, hotels, halls. Where the ceremony and the party happen, together or apart.",
  planning: "Coordinators, planners, day-of teams. They hold the clipboard; you hold the moment.",
  feast: "Caterers, cake makers, dessert tables. The meal guests still mention, and the sweet after.",
  design: "Florists, stylists, lights, drapes. The gasp when guests first walk in.",
  program: "Hosts, emcees, bands, DJs, sound systems. Everything through the mic that moves the room.",
  documentary:
    "Photographers, videographers, drone crews, same-day edit. How you'll relive it in twenty years.",
  look: "Gowns, suits, barong, hair, make-up. What you wear, and the hands that get you ready.",
  booths: "Photo booths, food carts, coffee and cocktail bars. Where guests drift, between courses and conversations.",
  prints: "Invitations, signage, menus, giveaways. What guests hold, read, and keep in a drawer.",
  transport: "Bridal cars, shuttles, vans, coaches. Everyone arrives on time and gets home safely.",
  experience:
    "Performers, games, activity corners, special effects. The parts guests join in, not just watch.",
  dining: "Lechon, grazing tables, dessert stations, drinks. Add-ons that turn the caterer's meal into a feast.",
  logistics_safety:
    "Security, escorts, medics, marshals, generators, portalets. Nobody notices them; that means they worked.",
  insurance: "Event cover and personal accident cover. A bad surprise stays a story, not a bill.",
  specialty: "Officials, tour guides, and the one-off asks. The unusual request that fits nowhere else.",
  // ⚠ No cue, no urgency, no selling. See the docblock.
  farewell: "Funeral homes, memorial chapels, hearse, interment. The services that carry a family through the week.",
};

/** The ⓘ text for a folder. Total — every folder has one, and a guard holds that. */
export function folderHintFor(folder: WeddingFolder): string {
  return FOLDER_HINTS[folder];
}

/** aria-label for the folder ⓘ toggle, mirroring the per-category one. */
export function folderHintButtonLabel(label: string): string {
  return `What does ${label} cover?`;
}
