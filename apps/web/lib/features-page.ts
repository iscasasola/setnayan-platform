/**
 * features-page.ts — EVERY ROW ON THE PUBLIC /features STORY, in ONE typed module (Build 6 Lane M part 3).
 *
 * Source: the owner-approved prototype v3 (DECISION_LOG 2026-11-11 "FEATURES PAGE v3 — APPROVED; BUILD THE LIVE
 * /features FROM IT"; spec corpus `prototypes/features_page_2026-11-11/v3_data.py`). Ported row for row: every
 * FEATURE_REGISTER.md row ✅ + 🔵 + 💡 for roles A–D (A 73 · B 16 · C 42 · D 6), plus the rows that come from a
 * dated ruling with no register id yet (`reg: []` + `plan`).
 *
 * 🔑 STATUS IS THE PROMISE. `live` = on main per the register; `coming` = planned (🔵 / 💡) or a queued ruling, and
 * the page draws the "Coming" chip for it and names the lane or ruling in its ⓘ. A row may only change status in a
 * commit that says what shipped — `features-page-rows-keep-their-status.test.ts` pins every row's status.
 *
 * ✍ `problem` · `solution` · `why` are DRAFT COPY (owner, 11 Nov: the final wording arrives separately). They live
 * here and nowhere else, so the rewrite is one file.
 *
 * Copy changed from v3, each forced by a house rule that v3's prototype did not run:
 *   · "celebration(s)" → "event(s)" (a06 · a01 · a08) — owner 2026-10-04, held by `features-page-says-what-ships`.
 *   · "website" / "site" are banned in the copy: c01 "No website" → "No page of your own"; a41 "Editing a site" →
 *     "Editing a page"; a49 "QR, site, video" → "QR, Event Hub, video".
 *   · v3_data.py defined an `aireply` row ("AI replies in the chat", Build 3 §5) that no chapter showed — its review
 *     notes merge it into C31 ("AI replies: the front desk", the same switch). It is not ported: a row nobody sees.
 *   · the owner's word rules (the `lib/*-is-*.test.ts` / `retired-names` guards): Kwento → Photo Notes · Samahan →
 *     Groups · "proposal" → quote / suggested times · "Payday" → Money in · "On the Day" → The Day · no "lock" for
 *     anything a couple reads (Free limits, explained · single-use QR · nothing is set in stone).
 *   · the RSVP moment's "Maybe" chip reads "Not yet" — guests cannot answer Maybe (`lib/rsvp-ask.ts`, owner 30 Sep).
 *
 * NO PESO IS TYPED HERE. A row's `price` is a KIND; the Plans compare reads the catalogue (`EVENT_PLANS` /
 * `SUPPLIER_PLANS` name the codes, `app/features/_sections/_Plans.tsx` reads them through `readFeatureCatalogue`).
 *
 * Pure data: no server-only import, so the page, the guards and `tsx --test` all read the same rows.
 */
import type { FeatureSlug } from '@/lib/feature-pages/types';

export type RowStatus = 'live' | 'coming';
export type RowPrice = 'free' | 'free-plus' | 'paid' | 'credits' | 'per-day';
export type RowIcon =
  | 'budget' | 'list' | 'seat' | 'cube' | 'cal' | 'palette' | 'grid' | 'store' | 'spark' | 'hub' | 'shirt' | 'gift'
  | 'print' | 'mono' | 'music' | 'crown' | 'camera' | 'live' | 'reel' | 'mem' | 'book' | 'qr' | 'reply' | 'wall'
  | 'shield' | 'wave' | 'pin' | 'chat' | 'quote' | 'clock' | 'coins' | 'chart' | 'star' | 'badge' | 'search' | 'link'
  | 'users' | 'door' | 'tag' | 'swap' | 'home' | 'check' | 'phone' | 'megaphone';

export type FeatureRow = Readonly<{
  icon: RowIcon;
  name: string;
  /** One line under the name. */
  line: string;
  price: RowPrice;
  status: RowStatus;
  /** FEATURE_REGISTER.md ids this row shows. Empty = a row from a dated plan or ruling (then `plan` says which). */
  reg: readonly string[];
  /** The build lane or ruling — for a coming row, what its ⓘ names; for a live row, the slice still to come. */
  plan?: string;
  problem: string;
  solution: string;
  why: string;
  /** The row's own feature page (`lib/feature-pages`), when it has one — the row's name links there. */
  page?: FeatureSlug;
}>;

const F = (r: FeatureRow): FeatureRow => r;

export const FEATURE_ROWS = {
  // ───────── A · HOSTS ─────────
  a02: F({ icon: 'users', name: 'Create an event: who it is for (“Para kanino”)', line: 'Me, us, a child, a parent, someone who passed, a pet, the business.', price: 'free', status: 'live', reg: ['A02'], problem: 'Generic apps assume it is “your” wedding; the person paying is rarely the one celebrated.', solution: 'The first question is who the event is for; the plan sorts itself around that person.', why: 'Families plan the way they actually do.' }),
  a03: F({ icon: 'list', name: 'Onboarding on one template', line: 'Event name and every required part, asked once, on the house step frame.', price: 'free', status: 'live', reg: ['A03'], problem: 'The dashboard nagged for name, date and place the moment you arrived.', solution: 'Every onboarding step uses one template and asks the required parts, so the event is complete on first entry.', why: 'Nothing to fix before you can start.' }),
  a04: F({ icon: 'phone', name: 'Prefill from the account and phone autofill', line: '“Which one is you?” fills your side; the phone fills the rest.', price: 'free', status: 'live', reg: ['A04'], plan: 'Phone autofill tokens: Build 5 Lane P', problem: 'It asked who you are and did not fill it up.', solution: 'Your account name fills your side of the names and moves with the pick; every person field takes the phone’s autofill.', why: 'Less typing on a phone.' }),
  a14: F({ icon: 'spark', name: 'Today: the guide and the checklist', line: 'Setnayan AI’s next step, 9 steps free, the rest with Pro.', price: 'free-plus', status: 'live', reg: ['A14'], problem: 'First-time planners do not know what to do next.', solution: 'Today shows the one thing to do next and the checklist behind it; the top three live on Home.', why: 'You always know the next move.' }),
  a15: F({ icon: 'cal', name: 'Event details and the date finder', line: 'Set the date, or compare dates by who is free and long weekends.', price: 'free', status: 'live', reg: ['A15'], problem: 'A date is picked before anyone checks who is free.', solution: 'Compare dates by which saved suppliers are free and which fall on a long weekend; the details live in one place.', why: 'No double booking before the event even starts.' }),
  a25: F({ icon: 'budget', name: 'Budget', line: 'Target against committed, in pesos; suppliers and your own expenses in one list.', price: 'free', status: 'live', reg: ['A25'], page: 'budget', problem: 'Costs are scattered across chats and receipts; overspending is found too late.', solution: 'One money summary: target, agreed, paid and owed.', why: 'Families stay within what they can afford.' }),
  a50: F({ icon: 'palette', name: 'Mood Board', line: 'Pick the colours once; concept and print PDFs follow.', price: 'free', status: 'live', reg: ['A50'], page: 'mood-board', problem: 'Every supplier is told the colours separately and each hears something different.', solution: 'One board shared with every supplier, with a concept PDF and a print PDF.', why: 'The whole day matches.' }),
  a71: F({ icon: 'spark', name: 'Setnayan AI', line: 'Planner and supplier matching: your best-fit team, then the next step.', price: 'paid', status: 'live', reg: ['A71'], page: 'setnayan-ai', problem: 'Hosts do not know whom to book or what to do next.', solution: 'A step-by-step guide and a supplier shortlist that fits your style, budget and date.', why: 'First-time planners feel guided.' }),
  a28: F({ icon: 'book', name: 'Paperwork per religion', line: 'Church, civil, INC, Muslim: the steps and papers for yours.', price: 'free', status: 'live', reg: ['A28'], problem: 'Couples do not know the church, civil, INC or Nikah requirements until something is missing.', solution: 'The steps per faith, with what to bring and when.', why: 'No last-minute missing documents.' }),
  a72: F({ icon: 'crown', name: 'Event Plus and Event Pro', line: 'Buy, upgrade or try; one unlock covers everyone on the event.', price: 'paid', status: 'live', reg: ['A72'], problem: 'Free must be complete, but some want more.', solution: 'Plus is a nicer, bigger event; Pro is the full show. Upgrade pays the difference.', why: 'Pay only for what you want.' }),
  a16: F({ icon: 'list', name: 'Guest list', line: 'Quick add, paste, import, an invite link, groups, mind map, undo.', price: 'free', status: 'live', reg: ['A16'], page: 'guest-list', problem: 'RSVPs get lost in group chats; the door cannot count who came.', solution: 'Every guest in one list with reply, role, group, meal and table.', why: 'Right headcount, right food.' }),
  a17: F({ icon: 'qr', name: 'Guest detail and personal QR', line: 'Each guest’s own QR and the parts they are invited to.', price: 'free', status: 'live', reg: ['A17'], problem: 'Not everyone is invited to every part, and nobody can find a name at the door.', solution: 'A personal QR per guest for RSVP, seat, check-in and photos; “invited to” chips per part.', why: 'No overcrowded reception, no hurt feelings.' }),
  a19: F({ icon: 'reply', name: 'Send the invitations', line: 'Send, and watch the sent count.', price: 'free', status: 'live', reg: ['A19'], problem: 'Who has been invited lives in your memory.', solution: 'One send step; the list shows how many went out and how many to go.', why: 'Nobody is forgotten.' }),
  a20: F({ icon: 'print', name: 'Invitations and Save the Date', line: 'Design, print, send; the Save the Date first.', price: 'free-plus', status: 'live', reg: ['A20'], page: 'prints', problem: 'Invitations are designed elsewhere and re-typed from the guest list.', solution: 'Design and print from the same list, in your colours; the Save the Date goes out first.', why: 'The paper matches the plan.' }),
  a21: F({ icon: 'reply', name: 'RSVP on the Event Hub', line: 'Guests reply, pick a meal and name a plus-one, in a tap.', price: 'free', status: 'live', reg: ['A21'], problem: 'A reply typed into a group chat is never counted.', solution: 'Each guest’s link opens their own page; the reply lands in your list.', why: 'Counted, and fed.' }),
  a22: F({ icon: 'shirt', name: 'Sponsors and entourage', line: 'Ninong, ninang, roles, duties and the dress code per role.', price: 'free', status: 'live', reg: ['A22'], page: 'wedding-march', problem: 'Filipino roles are tracked in chats; foreign apps do not know them.', solution: 'Sponsors and entourage with roles, dress code and duties, and the Wedding March order.', why: 'Customs handled properly.' }),
  a23: F({ icon: 'users', name: 'Co-hosts and access requests', line: 'Plan together; a coordinator asks, you approve.', price: 'free', status: 'live', reg: ['A23'], problem: 'One login shared across the family.', solution: 'Several hosts on one event; coordinators ask for access and you decide.', why: 'Everyone works on the same plan.' }),
  a24: F({ icon: 'users', name: 'Who is here', line: 'Hosts, guests and suppliers in one view.', price: 'free', status: 'live', reg: ['A24'], problem: 'Who is on the event is spread across three lists.', solution: 'One view of everyone on the event and their role.', why: 'One answer to “who is coming?”' }),
  a27: F({ icon: 'seat', name: 'Seat Plan', line: 'Tables, meal counts, the 3D lab, an export for the caterer.', price: 'free', status: 'live', reg: ['A27'], page: 'seat-plan', problem: 'Tables planned on paper, changed ten times, meal counts wrong.', solution: 'Interactive tables with Auto Arrange and keep-apart rules; the caterer gets exact counts.', why: 'Guests find their seat.' }),
  a51: F({ icon: 'cube', name: '3D plan and walkthrough', line: 'Walk your reception before it is built.', price: 'free', status: 'live', reg: ['A51'], page: '3d-plan', problem: 'Tight aisles and blocked views are discovered on the day.', solution: 'Your Seat Plan becomes a 3D room you can walk in the browser; each guest’s path to their seat.', why: 'Fixed while it is still free to fix.' }),
  a49: F({ icon: 'mono', name: 'Event QR and Logo Maker', line: 'Your mark in layers; the animated logo deploys everywhere.', price: 'free-plus', status: 'live', reg: ['A49'], page: 'logo-maker', problem: 'The event has no mark of its own; the link opens to a plain page.', solution: 'Build the mark from text, image and frame layers. Free to design; the animated logo goes to QR, Event Hub, video and LED.', why: 'One mark everywhere, without a designer.' }),
  a39: F({ icon: 'hub', name: 'Event Hub', line: 'One public address, four stages, built for speed; RSVP shows when guests reply.', price: 'free-plus', status: 'live', reg: ['A39', 'A40'], page: 'event-hub', problem: 'A Filipino event runs on five to eight apps.', solution: 'One link: Save the Date → Invitation → The Day → After. The live stage follows the date; you can pin one.', why: 'Guests never hunt for the right page.' }),
  a41: F({ icon: 'hub', name: 'Event Hub Maker', line: 'Look, motion and your own content; Apply publishes.', price: 'free-plus', status: 'live', reg: ['A41'], problem: 'Editing a page on a phone is fiddly and publishes by accident.', solution: 'Full-width editing with a realtime preview; nothing goes live until Apply.', why: 'Calm editing, safe publishing.' }),
  a42: F({ icon: 'hub', name: 'Event Hub Maker scenes', line: 'Tap a scene to edit it; a history list; Studio pages live inside.', price: 'free-plus', status: 'coming', reg: ['A42'], plan: 'Build 6 · Lane F', problem: 'Logo, palette and love story were edited on separate pages away from the page they change.', solution: 'Tapping a scene rises it full screen with what to edit on that scene; ↺ becomes a history list.', why: 'You edit where you look.' }),
  a43: F({ icon: 'hub', name: 'Veil reveal', line: 'Tap or swipe to unveil; the music starts.', price: 'free', status: 'live', reg: ['A43'], problem: 'A link opens to a plain page; no moment.', solution: 'Nothing behind the veil plays until it opens; unveiling starts the music.', why: 'The invitation feels like an event.' }),
  a44: F({ icon: 'book', name: 'Wake: a quiet story', line: 'No countdown, no games: the family’s words, the nights, the mass.', price: 'free', status: 'live', reg: ['A44'], problem: 'Party apps feel wrong for grief.', solution: 'A quiet page for a wake or memorial.', why: 'Families served with care at the hardest time.' }),
  a48: F({ icon: 'phone', name: 'See what guests see', line: 'Your event page and its parts, as a guest opens them.', price: 'free', status: 'live', reg: ['A48'], problem: 'You never see your own page the way a guest does.', solution: 'Open the page as a guest would, part by part.', why: 'No surprises after sending.' }),
  a73: F({ icon: 'badge', name: 'Setnayan marks by plan', line: 'Free shows a watermark, Plus one small mark, Pro none.', price: 'free', status: 'coming', reg: ['A73'], plan: 'Build 6 · Lane L', problem: 'Every free page looks the same as a paid one, and nothing says which is which.', solution: 'A small mark on Free pages and prints; Pro pages carry none.', why: 'Clear, and fair to those who pay.' }),
  chats: F({ icon: 'chat', name: 'Event chats: General, per role, your own groups', line: 'Guests can write in their group; private messages in every chat.', price: 'free', status: 'coming', reg: [], plan: 'Queued after Build 6 (ruling 11 Nov)', problem: 'The event’s people talk in five Messenger groups the host never sees.', solution: 'One General chat for hosts and attending guests, a group per role, hosts make more; a private message in every chat.', why: 'Everyone on the event, in one place.' }),
  a31: F({ icon: 'store', name: 'Suppliers: Find, Booked, orders, checkout', line: 'Shortlist by need, build picks against your budget, book.', price: 'free', status: 'live', reg: ['A31'], page: 'suppliers', problem: 'Who is booked, who is paid and who is a maybe lives in five chats.', solution: 'One screen for every supplier at your event, with the money beside each.', why: 'Nothing slips between a quote and the day.' }),
  a32: F({ icon: 'chat', name: 'The supplier chat is the record', line: 'Cards, blockers, decisions and private messages, one chat per supplier.', price: 'free', status: 'live', reg: ['A32'], problem: 'What was agreed lives in screenshots across Messenger and Viber.', solution: 'Every quote, payment and change posts its card there; a blocker takes the screen until you answer.', why: 'Proof of what was agreed, by whom, when.' }),
  a33: F({ icon: 'cal', name: 'One date picker everywhere', line: 'Meetings show only the times both sides are free.', price: 'free', status: 'live', reg: ['A33'], page: 'date-picker', problem: 'Double bookings found a week before.', solution: 'One pop-up for every date; not-available days can never be picked.', why: 'No conflicts.' }),
  a34: F({ icon: 'door', name: 'A picked supplier’s workspace', line: 'Details · Chat · Schedule · Quotation · Payment · Forms, one record.', price: 'free', status: 'live', reg: ['A34'], problem: 'Supplier and host see different versions of the same booking.', solution: 'The same record, two views: the host opens the shape the supplier sees.', why: 'No “but my screen says…” arguments.' }),
  a35: F({ icon: 'quote', name: 'Quote and payment plan', line: 'Valid until a date; the plan always pays all.', price: 'free', status: 'live', reg: ['A35'], problem: 'Quotes expire silently; partial plans forget the balance.', solution: 'Every quotation has a valid-until date; the payment plan always totals; only the supplier edits, you ask for a change.', why: 'No surprise on the day.' }),
  a36: F({ icon: 'door', name: 'Access by part', line: 'Suppliers ask for named parts of your event; you decide.', price: 'free', status: 'coming', reg: ['A36'], plan: 'Build 4', problem: 'A supplier needs the schedule, not your budget.', solution: 'Suppliers ask for named parts; booked ones see schedule and head count without asking.', why: 'Privacy by default.' }),
  a37: F({ icon: 'shield', name: 'Report a problem', line: 'Goes to Setnayan; the other side is not told.', price: 'free', status: 'coming', reg: ['A37'], plan: 'Build 3 spec', problem: 'A problem with the other side has nowhere safe to go.', solution: 'The chat’s ⋯ menu sends it to Setnayan quietly.', why: 'Safety without confrontation.' }),
  a29: F({ icon: 'quote', name: 'Documents and contracts (e-sign)', line: 'Every contract on the event, signed in place.', price: 'free', status: 'live', reg: ['A29'], problem: 'Contracts are PDFs in an inbox.', solution: 'Documents and e-signed contracts live with the supplier they belong to.', why: 'Found when needed.' }),
  a30: F({ icon: 'shield', name: 'Disputes', line: 'A neutral Setnayan review when something goes wrong.', price: 'free', status: 'live', reg: ['A30'], problem: 'A dispute with a supplier is your word against theirs.', solution: 'Open a dispute; Setnayan reviews with the chat as the record.', why: 'Fair outcomes.' }),
  a26: F({ icon: 'cal', name: 'Schedule and chapters', line: 'The timeline, with times suppliers suggest; shift everything when late.', price: 'free', status: 'live', reg: ['A26'], page: 'schedule', problem: 'The timeline lives in the coordinator’s head.', solution: 'One shared timeline in chapters; suppliers confirm times and request changes on it.', why: 'Everyone in the right place on time.' }),
  a38: F({ icon: 'users', name: 'Manpower', line: 'Who is working the day, and when.', price: 'free', status: 'live', reg: ['A38'], problem: 'Crew call times are texted one by one.', solution: 'Manpower per event with call times.', why: 'The crew shows up together.' }),
  a18: F({ icon: 'qr', name: 'Check-in desk, souvenir desk, tea ceremony', line: 'Scan the guest’s QR; the headcount follows.', price: 'free', status: 'live', reg: ['A18'], problem: 'A clipboard and a highlighter at the door.', solution: 'Scan at the door; souvenir and tea-ceremony desks keep their own counts.', why: 'A door that moves.' }),
  a52: F({ icon: 'camera', name: 'Papic', line: 'Guest phones become the camera crew; pay only for credits.', price: 'credits', status: 'live', reg: ['A52'], page: 'papic', problem: 'The paid photographer misses the candid moments; guests’ photos never reach you.', solution: 'Guests shoot with just a code, no app. Every photo finds its people, and you keep them all.', why: '150 angles of the day.' }),
  a53: F({ icon: 'camera', name: 'Papic Crew and crew poster', line: 'Designated friends with unlimited shots.', price: 'credits', status: 'live', reg: ['A53'], problem: 'Your best photographer friend runs out of shots.', solution: 'Name a crew; they shoot without limits, and a poster tells guests how to join.', why: 'Coverage from the people who know you.' }),
  a54: F({ icon: 'camera', name: 'Papic moderation, challenges, run of show, recap', line: 'Keep the album clean; set challenges; recap at the end.', price: 'credits', status: 'live', reg: ['A54'], problem: 'An open album fills with blur and strangers.', solution: 'Moderate, run photo challenges on the schedule, and get a recap.', why: 'An album you are proud of.' }),
  a55: F({ icon: 'shield', name: 'FaceBlock', line: 'Opted-out guests are blurred everywhere. Always free.', price: 'free', status: 'live', reg: ['A55'], problem: 'Some guests do not want their face shared.', solution: 'One opt-out, applied to every photo, wall and reel.', why: 'Privacy respected; never sold.' }),
  a56: F({ icon: 'grid', name: 'Smart Photo Sorting', line: 'Each photo finds the guests in it.', price: 'free', status: 'live', reg: ['A56'], problem: 'A shared pile nobody can search.', solution: 'AI and QR route each photo to the people in it.', why: 'Everyone finds themselves.' }),
  a61: F({ icon: 'live', name: 'Live Watch', line: 'Livestream on the Event Hub, up to 12 cameras.', price: 'paid', status: 'live', reg: ['A61'], page: 'live-watch', problem: 'Relatives abroad hunt for a stream link.', solution: 'Stream on the event’s own page with multicam switching; guest phones are cameras.', why: 'Lolos and OFWs are part of the day.' }),
  a68: F({ icon: 'wall', name: 'Live Photo Wall (Salamisim)', line: 'Guests’ photos land on the venue screen as they shoot.', price: 'paid', status: 'live', reg: ['A68'], problem: 'Guests’ photos stay on their phones during the party.', solution: 'The wall shows the room to itself, live, from Papic.', why: 'More joy, more photos.' }),
  a62: F({ icon: 'reel', name: 'Patiktok (Reel Booth)', line: 'Short vertical reels, optional TikTok post.', price: 'per-day', status: 'live', reg: ['A62'], page: 'patiktok', problem: 'The best moments stay on phones; a highlight reel arrives weeks later.', solution: 'Pick the moments and a reel composes itself with music, in the browser.', why: 'The party sees itself the same night.' }),
  a63: F({ icon: 'music', name: 'Music Maker', line: 'An original song from your own story.', price: 'paid', status: 'live', reg: ['A63'], page: 'music-maker', problem: 'Every video is set to someone else’s song.', solution: 'An owned song made to order; the soundtrack of every video.', why: 'Yours to keep.' }),
  a64: F({ icon: 'music', name: 'Playlist', line: 'The day’s music, in order.', price: 'free', status: 'live', reg: ['A64'], problem: 'The DJ gets a screenshot of a Spotify list.', solution: 'One playlist on the event, shared with the people who play it.', why: 'The right song at the right moment.' }),
  a65: F({ icon: 'mem', name: 'Photo Delivery', line: 'The photographer delivers into your Memories.', price: 'paid', status: 'live', reg: ['A65'], problem: 'Final photos arrive on a USB months later.', solution: 'Delivery lands in your Memories, beside the guests’ photos.', why: 'One album, finished.' }),
  a57: F({ icon: 'mem', name: 'Memories', line: 'Everything from the day, download all, say thank you.', price: 'free', status: 'live', reg: ['A57'], page: 'alaala', problem: 'Photos scatter across 150 phones, get deleted, or cost money to keep.', solution: 'Guests’ photos, the broadcast and the page, in one place you can return to.', why: 'The memory outlives the day.' }),
  a58: F({ icon: 'reel', name: 'Thank-You Video', line: 'A longer produced film, after the day.', price: 'paid', status: 'live', reg: ['A58'], problem: 'The thank-you is a text message.', solution: 'A produced film from the day’s photos and clips.', why: 'A thank-you worth keeping.' }),
  a59: F({ icon: 'book', name: 'Photo Notes and the Photo Notes Magazine', line: 'Guests write on a photo; a storybook designs itself.', price: 'free-plus', status: 'live', reg: ['A59'], problem: 'The stories behind the photos are lost.', solution: 'Guests write a short story on a photo; the magazine gathers them. Free digital, print with Pro.', why: 'Words kept with the pictures.' }),
  a60: F({ icon: 'gift', name: 'Pabuya e-gifts', line: 'Straight to your own GCash, Maya, bank or PayPal.', price: 'free', status: 'live', reg: ['A60'], page: 'e-gifts', problem: 'Cash in envelopes gets lost; guests abroad cannot give.', solution: 'Gifts go straight to your account and follow your wish list. Setnayan never touches the money.', why: 'Safe, traceable, from anywhere.' }),
  a66: F({ icon: 'print', name: 'Photo prints', line: 'Guests order prints, no account needed.', price: 'paid', status: 'live', reg: ['A66'], problem: 'Nobody prints anything any more.', solution: 'Order prints from the album, without an account.', why: 'Something on the wall.' }),
  a45: F({ icon: 'book', name: 'The story, Love Story and Post Event', line: 'Five word-only stories free; the Post Event story writes itself.', price: 'free-plus', status: 'live', reg: ['A45'], problem: 'The invitation link goes dead after the day.', solution: 'The same page becomes the story of the day; Pro adds media and custom scenes.', why: 'One link, for life.' }),
  a46: F({ icon: 'book', name: 'Real Stories', line: 'Share your event as a story others can read.', price: 'free', status: 'live', reg: ['A46'], page: 'real-stories', problem: 'The next couple starts from zero, asking “who was your supplier?”.', solution: 'If you share it, your day becomes a Real Story with suppliers credited.', why: 'Your day helps the next family.' }),
  a47: F({ icon: 'book', name: 'Editorial and guest columns', line: 'A magazine story of the day, with guests’ columns.', price: 'paid', status: 'live', reg: ['A47'], problem: 'The story of the day is told in captions.', solution: 'An editorial written from the day, with guest columns.', why: 'Told properly.' }),
  a74: F({ icon: 'check', name: 'Clearance, launch, activity, progress, refer', line: 'Close out the day; see what happened; refer a couple.', price: 'free', status: 'live', reg: ['A74'], problem: 'The event never formally ends.', solution: 'Clearance closes the day; activity and progress show the record; refer a couple from the same place.', why: 'A clean ending.' }),
  a01: F({ icon: 'home', name: 'Home: all your events', line: 'Events · People · Shop · Memories · Discover, one bar.', price: 'free', status: 'live', reg: ['A01'], problem: 'A wedding app is used once and deleted.', solution: 'Every event you host or help with, in one list; create the next one from the same place.', why: 'One home for a family’s events.' }),
  a05: F({ icon: 'users', name: 'People, saved once', line: 'Family and friends, dependents, beloved: reused on every event.', price: 'free', status: 'live', reg: ['A05'], problem: 'Every event re-types the same family.', solution: 'Save your people once; the next event is pre-filled.', why: 'Each event easier than the last.' }),
  a06: F({ icon: 'link', name: 'Linked events', line: 'A wedding and its anniversaries, grouped.', price: 'free', status: 'live', reg: ['A06'], problem: 'Related events live as strangers.', solution: 'Related events are grouped; silver and golden follow the real date.', why: 'The thread across years.' }),
  a07: F({ icon: 'mem', name: 'Memories library', line: 'Memories across all your events.', price: 'free', status: 'live', reg: ['A07'], problem: 'Each event’s photos in a different app.', solution: 'One library across every event.', why: 'A family archive.' }),
  a08: F({ icon: 'mem', name: 'Life-Flash', line: 'A living memorial of every past event.', price: 'free', status: 'live', reg: ['A08'], problem: 'The story across generations is lost.', solution: 'A living memorial that grows with each event.', why: 'Nothing lost.' }),
  a10: F({ icon: 'book', name: 'Chapters and your public page', line: 'Your life in chapters, on your own page.', price: 'free', status: 'live', reg: ['A10'], problem: 'Your events have no place of their own.', solution: 'A public page with chapters you choose to show.', why: 'A life told in events.' }),
  a11: F({ icon: 'crown', name: 'Groups', line: 'Barkada, parish, clan: chat, stories, shared events.', price: 'free', status: 'live', reg: ['A11'], page: 'groups', problem: 'The clan plans in a chat that scrolls away.', solution: 'A shared space for a group, with the events you plan together.', why: 'The people stay.' }),
  a12: F({ icon: 'star', name: 'Creator programme', line: 'Earn by bringing events and suppliers.', price: 'free', status: 'live', reg: ['A12'], problem: 'Word of mouth earns nothing.', solution: 'Creators are credited for the events and shops they bring.', why: 'Rewarded for sharing.' }),
  a13: F({ icon: 'door', name: 'Profile, notifications, billing, search', line: 'Your account, your notices, your receipts.', price: 'free', status: 'live', reg: ['A13'], problem: 'Receipts and settings in different places.', solution: 'One account page for profile, notifications, billing and receipts, and search.', why: 'Found in one place.' }),
  a75: F({ icon: 'grid', name: 'Honest empty states', line: 'An empty part shows a greyed example of itself.', price: 'free', status: 'live', reg: ['A75'], problem: 'A new event looked broken: blank sections.', solution: 'Every section draws a greyed preview until there is real content.', why: 'You see what will be there.' }),
  a76: F({ icon: 'tag', name: 'Pricing page and plan tables', line: 'Free · Event Plus · Event Pro, every cell read from the code.', price: 'free', status: 'live', reg: ['A76'], problem: 'Plan tables drifted from what the app enforces.', solution: 'Every cell is read from the limits the app applies; prices from the catalogue.', why: 'The table tells the truth.' }),
  a77: F({ icon: 'door', name: 'Tour', line: 'A guided public tour of Setnayan.', price: 'free', status: 'live', reg: ['A77'], problem: 'New visitors do not know where to start.', solution: 'A guided tour of the main screens.', why: 'Oriented in minutes.' }),
  // ───────── B · GUESTS ─────────
  b01: F({ icon: 'phone', name: 'Open the Event Hub from a link or QR', line: 'No app, no account.', price: 'free', status: 'live', reg: ['B01'], problem: 'Guests are asked to install an app for one evening.', solution: 'The link opens your own page in the browser.', why: 'Everyone can come, including Lola.' }),
  b15: F({ icon: 'door', name: 'Join an event, set a password if you like', line: 'Join from an invite or a crew link.', price: 'free', status: 'live', reg: ['B15'], problem: 'Sign-up before you can even reply.', solution: 'Join from the link; a password is optional.', why: 'Fast in.' }),
  b12: F({ icon: 'swap', name: 'Not you? Switch', line: 'A shared phone switches guest in a tap.', price: 'free', status: 'live', reg: ['B12'], problem: 'One phone, three titas.', solution: '“Not you?” switches to the right guest.', why: 'The right reply from the right person.' }),
  b13: F({ icon: 'users', name: 'Guest avatar', line: 'Your face on your pass and your photos.', price: 'free', status: 'live', reg: ['B13'], problem: 'Photos cannot find you without a face.', solution: 'Set your avatar once; your photos find you.', why: 'You appear in your Memories.' }),
  b16: F({ icon: 'hub', name: 'Public sample event', line: 'See a full event before you host one.', price: 'free', status: 'live', reg: ['B16'], problem: 'You cannot picture what the Hub looks like filled.', solution: 'A public sample event with every part.', why: 'Seeing is deciding.' }),
  b02: F({ icon: 'qr', name: 'RSVP and your own QR pass', line: 'Seat, check-in and photos, on one pass.', price: 'free', status: 'live', reg: ['B02'], problem: 'A reply typed in a group chat is never counted; at the door nobody finds your name.', solution: 'Reply in a tap; one personal QR for the door, the table and your photos.', why: 'Walk in like you were expected.' }),
  b04: F({ icon: 'pin', name: 'Welcome, venue and announcements', line: 'Where, when and what changed.', price: 'free', status: 'live', reg: ['B04'], problem: 'The venue pin is a screenshot in a chat.', solution: 'Welcome, venue and announcements on your page.', why: 'You arrive informed.' }),
  b14: F({ icon: 'music', name: 'Guest requests', line: 'Request a song, leave a note.', price: 'free', status: 'live', reg: ['B14'], problem: 'Song requests shouted at the DJ.', solution: 'Request a song or leave a note from your page.', why: 'Heard without shouting.' }),
  gchat: F({ icon: 'chat', name: 'Write in your group chat', line: 'A chat per role and one General chat with the hosts.', price: 'free', status: 'coming', reg: [], plan: 'Queued after Build 6 (ruling 11 Nov)', problem: 'Guests coordinate in side chats the hosts never see.', solution: 'Guests write in their group and in General; private messages too.', why: 'One conversation per event.' }),
  b03: F({ icon: 'pin', name: 'Find my seat', line: 'Your table and the running schedule.', price: 'free', status: 'live', reg: ['B03'], problem: 'A printed seat plan at the door, forty people deep.', solution: 'Your table and the schedule on your own page.', why: 'No queue, no asking.' }),
  b05: F({ icon: 'camera', name: 'Papic camera and my photos', line: 'Shoot with your phone, just a code.', price: 'free', status: 'live', reg: ['B05'], problem: 'Your photos never reach the couple.', solution: 'Open the code, shoot; every photo finds its people; yours are kept for you.', why: 'You are part of the crew.' }),
  b06: F({ icon: 'mem', name: 'See everyone’s photos', line: 'The whole album as it fills.', price: 'free', status: 'live', reg: ['B06'], problem: 'You see only what is posted later.', solution: 'Everyone’s photos, live, on the event page.', why: 'The party sees itself.' }),
  b09: F({ icon: 'live', name: 'Watch from abroad (Live Watch)', line: 'The stream plays on the event’s own page.', price: 'free', status: 'live', reg: ['B09'], problem: 'A Facebook Live link forwarded five times.', solution: 'Open the Event Hub; the stream is there.', why: 'Family overseas in the room.' }),
  b10: F({ icon: 'book', name: 'Photo Notes and guest columns', line: 'Write a short story on a photo.', price: 'free', status: 'live', reg: ['B10'], problem: 'Your story about that photo is never told.', solution: 'Write it on the photo; it joins the magazine.', why: 'Words kept with the picture.' }),
  b07: F({ icon: 'gift', name: 'Send a gift (Pabuya)', line: 'Straight to the host, from anywhere.', price: 'free', status: 'live', reg: ['B07'], problem: 'No envelope from abroad.', solution: 'GCash, Maya, bank or PayPal, straight to the host; follow the wish list.', why: 'Traceable, from anywhere.' }),
  b08: F({ icon: 'print', name: 'Order prints without an account', line: 'Pick your photos; prints arrive.', price: 'paid', status: 'live', reg: ['B08'], problem: 'You never print the photos you were in.', solution: 'Order prints from the album, no account.', why: 'Something to keep.' }),
  b11: F({ icon: 'book', name: 'The recap after the day', line: 'The story of the day, with you in it.', price: 'free', status: 'live', reg: ['B11'], problem: 'The link goes dead after the party.', solution: 'The same page becomes the recap.', why: 'You can return to it.' }),
  // ───────── C · SUPPLIERS ─────────
  c01: F({ icon: 'store', name: 'Open a shop, claim a listing, join from an invite', line: 'Two steps; a couple’s invite pre-fills it.', price: 'free', status: 'live', reg: ['C01'], problem: 'No page of your own; inquiries arrive as “HM po?” on a Facebook page.', solution: 'Open in two steps or claim the listing a couple made for you; the plan never blocks the couple.', why: 'Found without an agent.' }),
  c02: F({ icon: 'badge', name: 'Verification and the Verified badge', line: 'Documents checked once by Setnayan’s team.', price: 'free', status: 'live', reg: ['C02'], problem: 'Hosts cannot tell a real business from a fresh page.', solution: 'Documents checked once; the badge on every card and the shop.', why: 'Trust before the first message.' }),
  c03: F({ icon: 'shield', name: 'Free limits, explained', line: 'Every limit shows Problem → Solution, never hides.', price: 'free', status: 'live', reg: ['C03'], plan: 'Full limits list: Build 5 Lane B', problem: 'A greyed button with no reason.', solution: 'A feature past your plan stays visible; tapping it explains the problem, the solution and one way to get it.', why: 'You always know why, and what to do.' }),
  c04: F({ icon: 'cal', name: 'Papers renewal, 31 March yearly', line: 'Reminders in January and March.', price: 'free', status: 'coming', reg: ['C04'], plan: 'Build 5 · Lane B', problem: 'A badge that never expires stops meaning anything.', solution: 'Papers renew every 31 March, with reminders; the badge comes off, the shop stays.', why: 'A badge that means something.' }),
  c05: F({ icon: 'tag', name: 'The plan sheet', line: 'Going past a limit asks to upgrade; Change plan shows what changes and what you pay.', price: 'free', status: 'live', reg: ['C05'], problem: 'Limits appear as errors; plan changes are a bare dropdown.', solution: 'One sheet: the lowest plan that allows it, what else unlocks, what you pay today.', why: 'Upgrade with your eyes open.' }),
  c06: F({ icon: 'crown', name: 'Supplier plans: Free · Verified · Solo · Pro · Ultra', line: 'Operate, grow, scale.', price: 'paid', status: 'live', reg: ['C06'], problem: 'Platforms charge listing fees up front.', solution: 'Free to join; paid plans add seats, reach and insights. Prices from the catalogue.', why: 'Start with nothing.' }),
  c11: F({ icon: 'store', name: 'My Shop', line: 'Profile, photos, cover and logo menu, share, QR, badges.', price: 'free', status: 'live', reg: ['C11'], problem: 'Your business lives on someone else’s page.', solution: 'Your shop with cover, logo, photos, QR codes and badges.', why: 'Your page.' }),
  c12: F({ icon: 'store', name: 'A public sample shop (SetnaProd)', line: 'See what a full shop looks like.', price: 'free', status: 'coming', reg: ['C12'], plan: 'Build 5 · Lane H', problem: 'A new shop cannot picture the finished look.', solution: 'A public sample shop filled with cards, photos and inspiration.', why: 'Seeing the goal.' }),
  c13: F({ icon: 'door', name: 'Your public shop page', line: 'Dates, booth, guest reviews; written for Google and AI.', price: 'free', status: 'live', reg: ['C13'], problem: 'Nobody finds you from search.', solution: 'A page with your services, dates and reviews that search engines understand.', why: 'Free customers from search.' }),
  c40: F({ icon: 'tag', name: 'The for-suppliers page and plan table', line: 'Free · Verified · Solo · Pro · Ultra, read from the limits.', price: 'free', status: 'live', reg: ['C40'], problem: 'The public table drifted from the app.', solution: 'Every cell read from the limits the app applies.', why: 'No surprises after signing up.' }),
  c41: F({ icon: 'grid', name: 'Your category comes from one list', line: 'Group › Category › Service › Part, one source.', price: 'free', status: 'live', reg: ['C41'], problem: 'Categories copied in many places drift apart.', solution: 'One taxonomy; your services, Find and the sheet all read it.', why: 'Couples find the right supplier.' }),
  c14: F({ icon: 'tag', name: 'Services, guided setup, packages', line: 'Attributes per service; packages on top.', price: 'free', status: 'live', reg: ['C14'], problem: 'A price list in a photo nobody can search.', solution: 'One card per service with attributes and packages.', why: 'Quoted right the first time.' }),
  c15: F({ icon: 'tag', name: 'Service card grown', line: 'Facts first, media last; section rows pin as you scroll.', price: 'free', status: 'live', reg: ['C15'], plan: 'Later slices: Build 5 Lane C', problem: 'A card showed a photo and a price and nothing else.', solution: 'The full card: inclusions, forms, record, reviews, events, photos; the same card couples see in Find.', why: 'The card sells by itself.' }),
  cardrow: F({ icon: 'swap', name: 'The service card row: Edit · Share · Online/Offline', line: 'Share posts the card into a client’s chat; open bookings keep a card on.', price: 'free', status: 'coming', reg: [], plan: 'Ruling 11 Nov; Build 6 Lane D', problem: 'Turning a card off while a couple is booked on it breaks their booking.', solution: 'Edit, Share and the Online switch under the card; a card with open bookings cannot be deleted or turned off; swipe left deletes with a warning.', why: 'Nothing breaks under a client.' }),
  c16: F({ icon: 'check', name: 'The booked price stays', line: 'Said on both sides when a price changes.', price: 'free', status: 'live', reg: ['C16'], problem: 'A price change scared couples who had already booked.', solution: 'Couples who booked keep their price; new bookings use the new one; the app says so on both sides.', why: 'Trust survives a price change.' }),
  c17: F({ icon: 'tag', name: 'Shop makers: Offer · Card · Bundle · Menu · Portfolio', line: 'Many offers on a card; only the best shows. Off-season lives in the Offer Maker.', price: 'free', status: 'coming', reg: ['C17'], plan: 'Build 6 · Lane D (Portfolio is on main)', problem: 'Discounts, bundles and menus were scattered or missing.', solution: 'One maker each: % or ₱ off, a lower first payment, a gift; bundles with a pinned price; menus; the best offer wins and never stacks.', why: 'Sell the way the business sells.' }),
  c18: F({ icon: 'mem', name: 'Portfolio', line: 'Collections like Apple Photos; views counted.', price: 'free', status: 'live', reg: ['C18'], problem: 'Your best work is in a Facebook album from 2019.', solution: 'Events, services and inspiration as collections; the next photo slides in; share into a chat.', why: 'Proof on your page.' }),
  c33: F({ icon: 'palette', name: 'Inspiration library', line: 'Your photos in couples’ mood boards, with your seal.', price: 'free', status: 'live', reg: ['C33'], problem: 'Your photos travel without your name.', solution: 'Inspiration photos carry your seal and link back to you.', why: 'Credit that brings clients.' }),
  c37: F({ icon: 'gift', name: 'Gift a product to a couple', line: 'Papic credits or a plan, at the gift price.', price: 'free', status: 'live', reg: ['C37'], problem: 'A discount is forgotten; a gift is remembered.', solution: 'Give a couple a Setnayan gift from your offer or quote.', why: 'A reason to book you.' }),
  c35: F({ icon: 'music', name: 'Repertoire, lines and program segments', line: 'For performers and hosts: songs, scripts, segments.', price: 'free', status: 'live', reg: ['C35'], problem: 'The emcee’s script is on paper.', solution: 'Repertoire, lines and segments on the event.', why: 'The show runs.' }),
  c43: F({ icon: 'wave', name: 'Specialized tools', line: 'Six free: Scanner + Headcount, Run of show, Emcee script, Song Desk, Floor Command + March, Live Watch. One unlock for the rest.', price: 'free-plus', status: 'coming', reg: ['C43'], plan: 'Build 4; Tools Maker after', problem: 'Day-of tools cost per tool, or do not exist.', solution: 'Six tools free for every supplier; one unlock opens Papic challenge, the 3D plan and every future tool.', why: 'Run the day from your phone.' }),
  c38: F({ icon: 'badge', name: 'Your seal on every upload', line: 'The approved seal-and-plate, old photos re-marked.', price: 'free', status: 'coming', reg: ['C38'], plan: 'Build 6 · Lane L', problem: 'Your photos are reposted without you.', solution: 'Every upload carries your mark.', why: 'Credit travels with the work.' }),
  c21: F({ icon: 'chat', name: 'Messages, like Messenger', line: 'One row per event, unread on top.', price: 'free', status: 'live', reg: ['C21'], problem: 'A supplier with many events cannot see who is waiting.', solution: 'One row per event, unread pinned, then most recent.', why: 'Nobody left on “seen”.' }),
  c10: F({ icon: 'door', name: 'The client card', line: 'Details · Chat · Schedule · Quotation · Payment · Forms · Files · Hub · Report; every row rises into it.', price: 'free', status: 'live', reg: ['C10'], problem: 'A client is a calendar entry, a chat and a quote in three places.', solution: 'One picked-client card with every tab; a new request opens the same card.', why: 'One place per client.' }),
  c19: F({ icon: 'quote', name: 'Quotes in the chat', line: 'Valid until a date; the fee and the couple’s gift shown.', price: 'free', status: 'live', reg: ['C19'], problem: 'Quotes in chat are messy; fees and perks unclear.', solution: 'A quotation card with a valid-until date, a payment plan that always pays all, and the gift shown.', why: 'Clear, professional.' }),
  c22: F({ icon: 'clock', name: 'Schedule requests', line: 'Confirm your times; receive and send changes; your part opens first.', price: 'free', status: 'live', reg: ['C22'], problem: 'Time changes get lost between host, coordinator and supplier.', solution: 'Your part of the day on the shared schedule; changes are requests both sides see.', why: 'Nobody at the wrong time.' }),
  c20: F({ icon: 'quote', name: 'Contracts', line: 'Your contract on the event, signed in place.', price: 'free', status: 'live', reg: ['C20'], problem: 'Contracts in an inbox.', solution: 'Contracts live with the client card.', why: 'Found when needed.' }),
  c31: F({ icon: 'spark', name: 'AI replies: the front desk', line: 'Answers price, dates and inclusions from your own cards, labelled AI; hands the rest to you.', price: 'paid', status: 'live', reg: ['C31'], problem: 'The same five questions, forty times a week.', solution: 'A front desk that answers only when sure, from your cards and dates, labelled AI.', why: 'Reply in seconds while you work.' }),
  theirevent: F({ icon: 'door', name: '“Their event”', line: 'Open the host’s own screen, cut to the parts you were granted.', price: 'free', status: 'coming', reg: [], plan: 'Queued after Build 6 (ruling 11 Nov)', problem: 'You see your tab, not their day.', solution: 'A “Their event” item in the client card opens the host’s real screen, cut down to the granted parts.', why: 'Context without oversharing.' }),
  c32: F({ icon: 'link', name: 'Demand, recommendations, partnerships, creators', line: 'Where the inquiries are; who to partner with.', price: 'free', status: 'live', reg: ['C32'], problem: 'You guess where demand is.', solution: 'Demand by month and city, recommended add-ons, partnerships and creators.', why: 'Decide with numbers.' }),
  c23: F({ icon: 'wave', name: 'The Day console', line: 'Live view and Papic live, for the crew.', price: 'free', status: 'live', reg: ['C23'], problem: 'On the day, the plan is on paper.', solution: 'One console for the live day and Papic.', why: 'Run it from a phone.' }),
  c24: F({ icon: 'users', name: 'Manpower, team and branches', line: 'Staff per service; branches by city.', price: 'free', status: 'live', reg: ['C24'], problem: 'The team is a group chat.', solution: 'Staff per service, team seats and branches.', why: 'The right crew on the right day.' }),
  c25: F({ icon: 'coins', name: 'Earnings, Money in, booking fees, payment options', line: 'What is paid, what is due; fees only on clients we bring.', price: 'free', status: 'live', reg: ['C25'], problem: 'Payments in a notebook; platforms take a cut of everything.', solution: 'Every payment card lands in your earnings; a fee only on clients Setnayan brings, the first one free.', why: 'Clean books; pay when we deliver.' }),
  c26: F({ icon: 'quote', name: 'Tax documents (BIR)', line: 'Your documents, ready for filing.', price: 'free', status: 'live', reg: ['C26'], problem: 'Tax season is a scramble.', solution: 'BIR documents from your earnings.', why: 'Filing without fear.' }),
  c34: F({ icon: 'shield', name: 'Disputes, single-use QR, Theft Watch', line: 'A neutral review; QRs that cannot be reused.', price: 'free', status: 'live', reg: ['C34'], problem: 'A dispute is your word against theirs; a QR gets copied.', solution: 'Setnayan reviews with the chat as the record; booking QRs work once; Theft Watch flags reuse.', why: 'Protected on both sides.' }),
  c42: F({ icon: 'shield', name: 'Your shop’s standing', line: 'Hidden, suspended or banned reads honestly; a lapsed plan lapses.', price: 'free', status: 'live', reg: ['C42'], problem: 'A shop did not know it was hidden.', solution: 'The booking gate says which it is; an ended plan never reads as current.', why: 'No silent states.' }),
  c07: F({ icon: 'home', name: 'Today: “Needs you today”', line: 'The pinned row is what needs you, not the greeting.', price: 'free', status: 'live', reg: ['C07'], problem: 'The day starts with a greeting, not the task.', solution: 'Needs you today pinned on top, the next thing to answer first.', why: 'Start with what matters.' }),
  c08: F({ icon: 'list', name: 'Today setup steps', line: 'Paper rows, shop QR, first-visit tour; events per day.', price: 'free', status: 'live', reg: ['C08'], plan: 'Step 7 (events per day): Build 6 Lane E', problem: 'Setup was a wall of fields.', solution: 'Steps on Today: papers, your QR, the tour, how many events a day.', why: 'Set up in order.' }),
  c09: F({ icon: 'phone', name: 'Rise full screen and Settings', line: 'Your details · Your page · Helpers · Plan · Settings rise from the row.', price: 'free', status: 'live', reg: ['C09'], problem: 'Settings jumped pages and opened popups.', solution: 'Every tapped row rises full screen, 0.7 s, and falls back where it came from.', why: 'Never lost.' }),
  c27: F({ icon: 'chart', name: 'My Performance', line: 'Capacity, conversion, benchmark, price position, ROI.', price: 'free', status: 'live', reg: ['C27'], problem: 'Numbers without a next step.', solution: 'Five cards that say how you are doing.', why: 'Know where you stand.' }),
  c28: F({ icon: 'chart', name: 'Analytics that help', line: 'Tap any graph: our recommendation. Five new graphs.', price: 'paid', status: 'live', reg: ['C28'], problem: 'Graphs that do not tell you what to do.', solution: 'Every graph rises larger with one recommendation in the Problem → Solution shape; dates you lost, which card sells, reply speed, slow months, quotes waiting.', why: 'Growth you can act on.' }),
  c29: F({ icon: 'star', name: 'Reviews, track record, Stories', line: 'Land 24 hours after the event; one public reply.', price: 'free', status: 'live', reg: ['C29'], problem: 'Screenshots of thank-you messages as proof.', solution: 'Reviews from completed events; your track record and recaps grow on their own.', why: 'Proof that cannot be faked.' }),
  c30: F({ icon: 'search', name: 'Deep Search', line: 'Find the couples whose plans match what you sell.', price: 'paid', status: 'live', reg: ['C30'], problem: 'You wait for inquiries.', solution: 'One search across events looking for your category, date and city.', why: 'Go to the client first.' }),
  c39: F({ icon: 'grid', name: 'Honest empty states', line: 'Today, Clients, Shop, Portfolio and the graphs show greyed examples.', price: 'free', status: 'coming', reg: ['C39'], plan: 'Build 5 · Lane H', problem: 'A new shop looks broken: blank sections.', solution: 'Every empty part draws a greyed preview until there is real content.', why: 'You see what will be there.' }),
  social: F({ icon: 'megaphone', name: 'Your badge gets posted', line: 'A new badge or verification posts to Setnayan’s page; you can opt out.', price: 'free', status: 'coming', reg: [], plan: 'Build 6 · Lane S', problem: 'Your milestones go unseen.', solution: 'When you earn a badge or get verified, Setnayan posts it, public shops only, opt-out any time.', why: 'Free reach.' }),
  // ───────── D · COORDINATORS ─────────
  d01: F({ icon: 'door', name: 'Ask for access; the host approves', line: 'Request the parts you run.', price: 'free', status: 'live', reg: ['D01'], problem: 'A planner cut out of the plan cannot run the day.', solution: 'Request access; the host approves; you work inside their event.', why: 'The full picture.' }),
  d02: F({ icon: 'chat', name: 'In every supplier chat, and you cannot be left out', line: 'Meeting and File from your (+); approvals land with you.', price: 'free', status: 'live', reg: ['D02'], problem: 'Decisions get buried under fifty messages.', solution: 'You are in every supplier chat; one running topic pinned on top; change approvals reach you.', why: 'Nothing important scrolls away.' }),
  d03: F({ icon: 'budget', name: 'The budget stays with the hosts', line: 'You see “hosts only” until they share it.', price: 'free', status: 'live', reg: ['D03'], problem: 'Not everyone should see the money.', solution: 'Coordinators see no amounts until the hosts set Budget to View.', why: 'Families choose who sees their money.' }),
  d04: F({ icon: 'wave', name: 'Run the day', line: 'Live Wall, the schedule, the day-of desks.', price: 'free', status: 'live', reg: ['D04'], problem: 'The run of show is a printout that is wrong by 3 pm.', solution: 'The schedule moves as the day moves; the wall and the desks from your phone.', why: 'One screen to run the room.' }),
  d05: F({ icon: 'tag', name: 'The for-coordinators page', line: 'The offer, in one page.', price: 'free', status: 'live', reg: ['D05'], problem: 'Coordinators did not know what Setnayan does for them.', solution: 'One page that says it.', why: 'A clear door.' }),
  d06: F({ icon: 'check', name: 'Front pages checked whole', line: 'Users, suppliers, coordinators and features say the same true things.', price: 'free', status: 'live', reg: ['D06'], problem: 'Front pages claimed things the app no longer did.', solution: 'Every claim checked against the rulings and the catalogue.', why: 'What you read is what you get.' }),
} as const satisfies Record<string, FeatureRow>;

export type RowId = keyof typeof FEATURE_ROWS;

/** The depicted app screen beside a chapter — drawn in CSS/SVG by `app/features/_story-sample-moments.tsx`. */
export type MomentKind =
  | 'palette' | 'rsvp' | 'chat' | 'hub' | 'memories' | 'family' | 'pass' | 'shop' | 'cardrow' | 'paid' | 'reviews' | 'coord';

/** A photo strip between chapters: a REAL file under `public/marketing/` (no base64), with what it shows. */
export type StoryPhoto = Readonly<{ src: `/marketing/${string}.webp`; alt: string }>;

export type Chapter = Readonly<{
  eye: string;
  title: string;
  line: string;
  moment: MomentKind;
  photo?: StoryPhoto;
  groups: readonly (readonly [name: string, rows: readonly RowId[]])[];
}>;

export type PersonaKey = 'hosts' | 'guests' | 'suppliers' | 'coordinators';
export type Persona = Readonly<{
  key: PersonaKey;
  label: string;
  heroTitle: string;
  heroLine: string;
  chapters: readonly Chapter[];
}>;

const P = {
  debut: { src: '/marketing/2026-11-04/hero-debut.webp', alt: 'A debut in Alabang: the entourage waits behind the doors, 240 guests seated' },
  caterer: { src: '/marketing/for-suppliers-2026-11-06/supplier-caterer-hero.webp', alt: 'A catering team plates a 200-guest banquet in Quezon City' },
  wall: { src: '/marketing/2026-11-04/problem-17-live-wall.webp', alt: 'Guests’ photos landing on the venue screen during the first dance' },
  christening: { src: '/marketing/2026-11-04/hero-christening.webp', alt: 'A christening lunch in Pampanga, three generations at one table' },
  phones: { src: '/marketing/2026-11-04/problem-02-phones.webp', alt: 'Guests shoot the first dance from their own phones' },
  photographer: { src: '/marketing/for-suppliers-2026-11-06/supplier-photographer-hero.webp', alt: 'A photographer on a 300-guest wedding in Tagaytay' },
  quotes: { src: '/marketing/for-suppliers-2026-11-06/supplier-03-quotes.webp', alt: 'A florist answers a quote request between deliveries' },
  reunion: { src: '/marketing/2026-11-04/hero-reunion.webp', alt: 'A reunion dinner in Cebu, 120 guests' },
  cue: { src: '/marketing/2026-11-04/coord-05-cue-the-show.webp', alt: 'A coordinator cues the entrance at a debut in Tagaytay' },
  coord: { src: '/marketing/2026-11-04/coord-hero.webp', alt: 'A coordinator with a headset at a 400-guest reception' },
} as const satisfies Record<string, StoryPhoto>;

export const PERSONAS: readonly Persona[] = [
  {
    key: 'hosts',
    label: 'Hosts and couples',
    heroTitle: 'Every Filipino event, from the first idea to the memories.',
    heroLine: 'Setnayan plans it, invites them, books your suppliers in writing, runs the day and keeps every photo. Free to start.',
    chapters: [
      { eye: 'Months before', title: 'It starts with who it is for, a date and a feeling.', line: 'Say who the event is for, pick a date your suppliers are free for, set what you can spend, choose the colours once. Everything after dresses to match.', moment: 'palette',
        groups: [['Start', ['a02', 'a03', 'a04', 'a15']], ['Plan', ['a14', 'a25', 'a50', 'a28', 'a71', 'a72']]] },
      { eye: 'Invitations and replies', title: 'One link. Every guest answers in a tap.', line: 'Your Event Hub is the save-the-date, the invitation and the RSVP. Each guest gets their own QR; the seats and the meal counts follow on their own.', moment: 'rsvp', photo: P.debut,
        groups: [['Guests', ['a16', 'a17', 'a19', 'a20', 'a21', 'a22', 'a23', 'a24', 'chats']], ['Seats and the look', ['a27', 'a51', 'a49']], ['The Event Hub', ['a39', 'a41', 'a42', 'a43', 'a44', 'a48', 'a73']]] },
      { eye: 'Suppliers', title: 'Find them, compare them, agree in writing.', line: 'Verified shops by city, side by side. The quote, the payment plan and every change land as cards in one chat, so what was agreed is never a screenshot.', moment: 'chat', photo: P.caterer,
        groups: [['Find and book', ['a31', 'a32', 'a33', 'a34', 'a35']], ['Keep it straight', ['a36', 'a37', 'a29', 'a30', 'a26', 'a38']]] },
      { eye: 'The day', title: 'The Hub turns live. Your guests become the crew.', line: 'From the morning of, the Event Hub switches to the day: the schedule, the tables, the stream for family abroad, and every phone shooting into one album.', moment: 'hub', photo: P.wall,
        groups: [['The door', ['a18']], ['Papic', ['a52', 'a53', 'a54', 'a55', 'a56']], ['The show', ['a61', 'a68', 'a62', 'a63', 'a64', 'a65']]] },
      { eye: 'After', title: 'The day ends. The page doesn’t.', line: 'The same link becomes the story of the day: your guests’ photos sorted by face, the family’s words, the thank-yous, and gifts that went straight to you.', moment: 'memories',
        groups: [['Keep', ['a57', 'a58', 'a59', 'a60', 'a66']], ['Tell', ['a45', 'a46', 'a47', 'a74']]] },
      { eye: 'Every event after this one', title: 'A wedding is the way in. The family is why you stay.', line: 'Your people are saved once. The christening, the debut, the 60th and the golden anniversary each start pre-filled, and every memory stays in one library.', moment: 'family', photo: P.christening,
        groups: [['Your account', ['a01', 'a05', 'a06', 'a07', 'a08', 'a10', 'a11', 'a12', 'a13']], ['The house', ['a75', 'a76', 'a77']]] },
    ],
  },
  {
    key: 'guests',
    label: 'Guests',
    heroTitle: 'You’re invited. No app, no account.',
    heroLine: 'Your link is your page: reply in a tap, find your table, shoot with your phone, go home with your own photos.',
    chapters: [
      { eye: 'The link arrives', title: 'Open it. That’s the whole setup.', line: 'A host sends you a link or a QR. It opens your own page in the browser, with your name on it.', moment: 'pass', groups: [['In', ['b01', 'b15', 'b12', 'b13', 'b16']]] },
      { eye: 'Before the day', title: 'Your reply is counted the moment you tap it.', line: 'Reply, meal and plus-one land in the host’s list. The venue, the dress code and the announcements are on your page, not in a group chat.', moment: 'rsvp', photo: P.debut, groups: [['Reply', ['b02', 'b04', 'b14', 'gchat']]] },
      { eye: 'The Day', title: 'Your phone is part of the crew.', line: 'Find your table, and shoot: every photo you take finds the people in it. Family abroad watch on the same page.', moment: 'hub', photo: P.phones, groups: [['There', ['b03', 'b05', 'b06', 'b09', 'b10']]] },
      { eye: 'After', title: 'You go home with something.', line: 'Your own photos, sorted by your face. Prints without an account. A gift that reaches the host from anywhere.', moment: 'memories', groups: [['Keep', ['b07', 'b08', 'b11']]] },
    ],
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    heroTitle: 'Open your shop. Get booked in writing. Get paid.',
    heroLine: 'Free to join, full dashboard free. A fee only on clients Setnayan brings you, and the first one is free.',
    chapters: [
      { eye: 'Open', title: 'A shop page Google can read, in two steps.', line: 'Your services, photos and reviews on a page written for search engines and AI. Verified once by Setnayan’s team; every limit explains itself.', moment: 'shop',
        groups: [['Open and verify', ['c01', 'c02', 'c03', 'c04']], ['Your plan', ['c05', 'c06', 'c40']], ['Your page', ['c11', 'c13', 'c12', 'c41']]] },
      { eye: 'Your cards', title: 'Cards that sell by themselves.', line: 'One card per service, facts first, media last, the same card couples see in Find. Offers, bundles and menus from their own makers; the best offer shows.', moment: 'cardrow', photo: P.photographer,
        groups: [['Cards', ['c14', 'c15', 'cardrow', 'c16', 'c17']], ['Your work', ['c18', 'c33', 'c37', 'c35']], ['Tools', ['c43', 'c38']]] },
      { eye: 'Inquiries', title: 'The chat is the record.', line: 'One chat per event. Your quote, the payment plan and every change post as cards both sides can read, with a valid-until date you set.', moment: 'chat', photo: P.quotes,
        groups: [['Clients', ['c21', 'c10', 'c19', 'c22', 'c20', 'theirevent']], ['Answer faster', ['c31', 'c32']]] },
      { eye: 'Booked and paid', title: 'Every payment lands where you can see it.', line: 'The plan always pays all. Each payment card posts to the chat and to your earnings. Clients you brought yourself pay nothing.', moment: 'paid',
        groups: [['The day', ['c23', 'c24']], ['Money', ['c25', 'c26']], ['Protected', ['c34', 'c42']]] },
      { eye: 'Grow', title: 'Proof that cannot be faked.', line: 'Reviews land 24 hours after the event. Your track record grows on its own; every graph taps to our recommendation.', moment: 'reviews', photo: P.reunion,
        groups: [['Every day', ['c07', 'c08', 'c09', 'c39']], ['Grow', ['c27', 'c28', 'c29', 'c30', 'social']]] },
    ],
  },
  {
    key: 'coordinators',
    label: 'Coordinators',
    heroTitle: 'You run the day. Now the whole day runs on one screen.',
    heroLine: 'Ask the host for access; every supplier chat, the whole schedule and the door are yours.',
    chapters: [
      { eye: 'Access', title: 'In every chat that matters.', line: 'Request the parts you run. Once approved, you are in every supplier conversation and cannot be left out of one. The money stays with the hosts until they share it.', moment: 'chat', groups: [['Access', ['d01', 'd02', 'd03']]] },
      { eye: 'The schedule', title: 'Move the day; everything moves with it.', line: 'Every supplier’s moments on one timeline. Real events run late, so nothing is set in stone, and the one date picker keeps meetings to times both sides are free.', moment: 'coord', photo: P.cue, groups: [['The day plan', ['a26', 'c22', 'a33']]] },
      { eye: 'The room', title: 'One screen to run the room.', line: 'Scan guests in at the door, call cues from the run of show, watch the headcount and the wall from your phone. Six tools are free; one unlock opens the rest.', moment: 'hub', photo: P.coord, groups: [['Run it', ['d04', 'a18', 'a68', 'c43']]] },
      { eye: 'The week', title: 'Five events, one account.', line: 'Every event you were given access to, side by side, with what needs you today on top. Your shop and your plan work the same as any supplier’s.', moment: 'family', groups: [['Across events', ['c10', 'c07', 'd05', 'd06']]] },
    ],
  },
];

export const PERSONA_KEYS: readonly PersonaKey[] = PERSONAS.map((p) => p.key);

/** Which register letter each persona answers for (the completeness guard counts against it). */
export const ROLE_OF: Readonly<Record<PersonaKey, 'A' | 'B' | 'C' | 'D'>> = { hosts: 'A', guests: 'B', suppliers: 'C', coordinators: 'D' };

/** Register rows deliberately NOT on the page, with the reason (v3 review notes). */
export const EXCLUDED: readonly (readonly [row: string, why: string])[] = [
  ['A09', 'Your Year — retired as a page (2026-08-21)'],
  ['A67', 'Camera Bridge — shelved 2026-07-17, no catalogue row'],
  ['A69', 'Pailaw — retired 2026-08-11'],
  ['A70', 'Pabati — retired (migration retire_pabati)'],
  ['C36', 'Storage packs, 3D booth, photo challenge, tokens — off sale in the catalogue (read 10 Nov)'],
];

/** The words under a row's name for each price kind. Never a figure: the figures are in the Plans compare. */
export const PRICE_WORDS: Readonly<Record<RowPrice, string>> = {
  free: 'Free',
  'free-plus': 'Free · more with a plan',
  paid: 'Paid · see the plans',
  credits: 'Free · Papic credits to add',
  'per-day': 'Paid per day',
};

/* ─── THE PLANS COMPARE ───────────────────────────────────────────────────────────────────────────────────────── */

/** A plan's price: free, or the catalogue rows that charge it. Read through `readFeatureCatalogue` — never typed. */
export type PlanPrice =
  | { kind: 'free' }
  | { kind: 'paid'; catalogue: 'retail' | 'supplier'; codes: readonly string[] };

export type PlanColumn = Readonly<{ name: string; tag: string; price: PlanPrice; lines: readonly string[] }>;

export const EVENT_PLANS: readonly PlanColumn[] = [
  { name: 'Free', tag: 'Plan and invite, complete.', price: { kind: 'free' }, lines: ['Guest list, Seat Plan, Budget, Schedule, Mood Board', 'Event Hub: Classic theme, your words, guests’ photos', 'The Post Event story, automatically', 'FaceBlock, always'] },
  { name: 'Event Plus', tag: 'A nicer, bigger event.', price: { kind: 'paid', catalogue: 'retail', codes: ['EVENT_PLUS'] }, lines: ['Everything in Free', 'Papic credits included', 'Bigger uploads', 'One unlock covers everyone on the event'] },
  { name: 'Event Pro', tag: 'The full show.', price: { kind: 'paid', catalogue: 'retail', codes: ['COUPLE_WEBSITE_PRO'] }, lines: ['Everything in Plus, more Papic credits', 'Nine themes, every reveal and scene animation', 'Your own photos, videos and music; custom scenes', 'Print-ready invitations, tickets, posters', 'Setnayan AI'] },
  // 💎 Event Ultra (owner 2026-11-13) — only what a paid Ultra order unlocks today; canvas prints join when the Our Day
  // poster ships (see ULTRA_PEEK in app/_components/frontdoor/front-door-landing-data.ts).
  { name: 'Event Ultra', tag: 'Shared live, kept longer.', price: { kind: 'paid', catalogue: 'retail', codes: ['EVENT_ULTRA'] }, lines: ['Everything in Pro, the most Papic credits', 'Live Watch for one day', 'Full-size photos kept 12 months', 'Patiktok'] },
];

export const SUPPLIER_PLANS: readonly PlanColumn[] = [
  { name: 'Free', tag: 'Open and sell.', price: { kind: 'free' }, lines: ['Shop page, cards, bundles', 'Chat, quotes, payment plans', 'Full basic dashboard'] },
  { name: 'Verified', tag: 'Trusted.', price: { kind: 'free' }, lines: ['The badge on every card', 'Unlimited live cards', 'Everything in Free'] },
  { name: 'Solo', tag: 'One person, no friction.', price: { kind: 'paid', catalogue: 'supplier', codes: ['solo_vendor_monthly'] }, lines: ['Everything in Verified', 'Operate the business alone, smoothly'] },
  { name: 'Pro', tag: 'Grow.', price: { kind: 'paid', catalogue: 'supplier', codes: ['pro_vendor_monthly'] }, lines: ['Team seats', 'Performance insights, more reach', 'Specialized tools unlock included'] },
  { name: 'Ultra', tag: 'Scale.', price: { kind: 'paid', catalogue: 'supplier', codes: ['enterprise_vendor_monthly'] }, lines: ['Branches and a bigger team', 'Everything in Pro', 'Specialized tools unlock included'] },
];

/** A planned row — it wears the "Coming" chip and its ⓘ names the lane or ruling. */
export function isComing(row: FeatureRow): boolean {
  return row.status === 'coming';
}

/** Every row on a persona's story, in page order (a row may sit in more than one persona's story). */
export function rowsOf(persona: Persona): RowId[] {
  return persona.chapters.flatMap((c) => c.groups.flatMap(([, ids]) => [...ids]));
}
