/**
 * HELP SLOT H4 — host areas U12–U18 and U21–U24.
 *
 * Owned by ONE answer-writing session (H4); no other session edits this file.
 * Covers: seat plan and 3D · mood board · the Event Hub Maker · Details · invitations · prints · Papic · Music Maker · Memories · Story · E-Gifts.
 * Where those live in the app: app/dashboard/[eventId] (seating, plan3d, invitation, website, details, prints, memories, galleries, story, pabuya) · studio (papic, pakanta, mood-board).
 *
 * Rules every answer here obeys (each is held by a guard that reads this file):
 * - say what ships on main today, in the app's own words — no future, no typed
 *   price, credit count or tier boundary (read prices from the catalogue; point
 *   at setnayan.com/pricing or the supplier billing hub);
 * - "supplier", never "vendor"; plans are Event Plus · Event Pro · Event Ultra
 *   and Supplier Plus · Supplier Pro · Supplier Ultra;
 * - every slug is globally unique across lib/help/ and lib/help-admin/
 *   (lib/help-slugs-are-unique.test.ts);
 * - give an `appBody` where the web answer points at buying, Android or desktop
 *   (lib/help-in-the-app-sells-nothing.test.ts).
 *
 * lib/help.ts appends this file's topics after topics-existing.ts, in slot order.
 */
import type { HelpTopic } from '@/lib/help';
import { HELP_NOT_IN_THE_APP } from './not-in-the-app';

/*
 * H4 · 2026-11-14 — every answer below was checked against origin/main; the code that proves it is named in the comment
 * above it (a greppable string, never a line number). Left out on purpose:
 *   U24 E-Gifts — the guest gift page needs PABUYA_PUBLIC_ROUTE_ENABLED (lib/egift.ts isPabuyaPublicRouteEnabled); the
 *     manager itself says the guest page is not switched on yet, so Help does not describe giving.
 *   Printing every place card in one file — the seat plan's Publish & print and the Prints page's Event Pro note
 *     disagree (seating/print/route.ts vs lib/studio-prints-six.ts PLACE_CARDS_PRO_NOTE); owner ruling needed.
 *   The Thank-You Video (free by FREE_FOR_ALL_SKUS but refused in the iPhone app), supplier booths in 3D
 *     (NEXT_PUBLIC_PLAN3D_BOOTH_ADS), Share all memories (NEXT_PUBLIC_PAPIC_POOL_GALLERY), Google Drive (Coming soon).
 *   No credit count, size cap, day count or hour is typed.
 * Existing answers found false (left untouched — topics-existing.ts is shared): theme ("Hub › Look › Theme" — there is
 * no theme picker since 2026-10-05), turn-on-papic and papic-giving-a-camera-its-own-shots (per-person cameras were
 * removed — one shared code + each guest's invite QR), event-hub-pro-parts ("try any theme"), what-is-papic (crew of
 * friends, Drive). See the PR body.
 */
export const USER_2_TOPICS: HelpTopic[] = [
  {
    key: 'host-seat-plan',
    label: 'Seat plan and 3D',
    roles: ['couple'],
    articles: [
      {
        // seating/_components/seating-frame.tsx List · 2D · 3D; plan3d/page.tsx redirect
        slug: 'where-is-the-seat-plan',
        title: 'Where is my seat plan?',
        body: 'In Guests › Seats. It shows your tables as a list, as a 2D floor plan, or as the 3D room your guests walk.',
      },
      {
        // lib/seating.ts TABLE_TYPE_CATALOG; seating-editor.tsx "Add a table or element", "New table…", 'Make it a VIP table'
        slug: 'seat-plan-tables',
        title: 'What kinds of tables can I add?',
        body: 'From ⋯ › Add a table or element › New table…: round, long banquet, a family head table, a sweetheart table for two, or a serpentine. Any table can be made a VIP table from its menu, and a small VIP mark shows on it in every view.',
      },
      {
        // seating-editor.tsx MenuRow label="Dance floor", "Room size & scale…"
        slug: 'seat-plan-room-elements',
        title: 'How do I add the dance floor, stage, entrance or signs?',
        body: 'The same Add a table or element menu adds an entrance, a service door, a dance floor, a cocktail area (a second room with booths only), signs, and booths for your booked suppliers. Room size & scale sets the room in metres.',
      },
      {
        // seating-editor.tsx "Pick a guest in the panel above, then tap Seat here"
        slug: 'seat-a-guest',
        title: 'How do I seat my guests?',
        body: 'Pick a guest, then tap Seat here on a table. Tap a seated guest to move them, or the chair beside a group to seat the whole group together.',
      },
      {
        // seating-editor.tsx 'Auto arrange', "Build my seating draft", "Clear all seats"; "Seating Priority & Guide"
        slug: 'auto-arrange-seats',
        title: 'Can Setnayan seat everyone for me?',
        body: 'Yes. Auto arrange seats everyone by your seating rules, and you can undo it. Build my seating draft lays out the whole floor first. Seating Priority & Guide sets who sits nearest the stage, who sits together and who sits apart.',
      },
      {
        // seating-editor.tsx "Tap Edit first — only one person arranges at a time"; use-seating-lock.ts
        slug: 'two-people-editing-seats',
        title: 'Can two of us arrange seats at the same time?',
        body: 'One person arranges at a time — tap Edit first. If the other person has left the plan open and walked away, you can take over.',
      },
      {
        // seating-editor.tsx name="Show guests their seats early"; lib/guest-seat-view.ts GUEST_SEAT_VIEW_LABEL
        slug: 'when-guests-see-seats',
        title: 'When do guests see their seat?',
        body: 'On the day. To show them sooner, turn on Show guests their seats early. How guests see their seat lets you choose a 2D map, a 3D walk, or both with the map first. Printing table signs does not show seats early.',
      },
      {
        // seat-plan-facts.tsx; lib/entitlements.ts FREE_FOR_ALL_SKUS (SEATING_3D); seating-editor.tsx "Guest photos in the 3D walk"
        slug: 'the-3d-room',
        title: 'What is the 3D room?',
        body: 'The room your guests walk, built from your seat plan, your guest list and your mood board — change any of them, even on the day, and the room follows. It is free. Guest photos in the 3D walk sets whose photos show: each guest’s own table, all guests, or none.',
      },
      {
        // seating/walkthrough/_components/walkthrough-manager.tsx
        slug: 'walkthrough-videos',
        title: 'Can I add walkthrough videos of the venue?',
        body: 'Yes. In ⋯ › Walkthrough videos, name the parts of the venue, then record or upload a walk for each. A video stays hidden until you show it to guests.',
      },
      {
        // seating-editor.tsx shareMenuBody ("Share & print", "Caterer meal counts", "Entrance seating chart")
        slug: 'print-the-seat-plan',
        title: 'How do I print or share my seat plan?',
        body: 'From ⋯ › Share & print: the seat plan in your colours or as a blueprint, meal counts for your caterer (to print or as a spreadsheet), and an entrance chart listed by table or A to Z.',
      },
      {
        // seating/_components/day-of-editing-banner.tsx "Live — guests are seeing this now"
        slug: 'change-seats-on-the-day',
        title: 'Can I change seats on the day?',
        body: 'Yes — on the day the plan says Live: guests are seeing it as you change it. Anything already printed stays as it was printed.',
      },
    ],
  },
  {
    key: 'host-mood-board',
    label: 'Mood Board',
    roles: ['couple'],
    articles: [
      {
        // lib/maker-parts.ts mood: 'Palette + Dress Code'; mood-board-editor.tsx section labels
        slug: 'start-a-mood-board',
        title: 'How do I start my Mood Board?',
        body: 'In the Event Hub Maker, tap Dress code to open Palette + Dress Code. Start from a designed look or a blank board, then fill in your inspiration, palette, do’s and don’ts, and what each role wears. It is free.',
      },
      {
        // mood-board-editor.tsx ">Call time"
        slug: 'call-time-per-role',
        title: 'Can I tell each role when to be ready?',
        body: 'Yes. Each role can have a Call time — when they should be dressed and ready.',
      },
      {
        // share-with-vendors-button.tsx "Share with your suppliers"; printable-pdf-button.tsx; concept-pdf-button.tsx
        slug: 'share-mood-board-with-suppliers',
        title: 'How do I share my Mood Board with my suppliers?',
        body: 'Share with your suppliers lets every booked supplier open your board at any time. Download printable (PDF) or the concept book (PDF) saves a copy to send or print.',
      },
    ],
  },
  {
    key: 'host-event-hub-maker',
    label: 'Event Hub Maker',
    roles: ['couple'],
    articles: [
      {
        // lib/public-site-stage-labels.ts; lib/which-version-guests-see.ts
        slug: 'event-hub-stages',
        title: 'What are the stages of my Event Hub?',
        body: 'Save the Date, Invitation, The Day and Post Event. Your Event Hub moves through them by your date on its own, or you can choose the one guests see under Which version guests see.',
      },
      {
        // launch/_components/studio-tools.tsx STUDIO_LIVE_LINE
        slug: 'why-guests-dont-see-changes',
        title: 'Why don’t guests see my changes yet?',
        body: 'Changes wait in your draft until you tap ✓ Apply. A few settings change at once: the address, Go live, who can view, which version guests see, and the Event Bar.',
      },
      {
        // website/_components/hub-history-sheet.tsx; launch/_components/maker-shell.tsx 'Restore what guests see'
        slug: 'undo-in-the-maker',
        title: 'How do I undo in the Maker?',
        body: 'Tap ↺ to open History, then tap a row to return to that point — Redo brings it back. Restore what guests see drops your whole draft.',
      },
      {
        // website/_components/apply-pro-sheet.tsx "Unlock Pro and Apply", "Apply without the Pro effects"
        slug: 'apply-with-pro-effects',
        title: 'What happens when I Apply with ◆ effects in my draft?',
        body: 'The Apply sheet lists each ◆ effect. Unlock Pro and Apply puts everything live with Event Pro; Apply without the Pro effects puts the rest live and keeps the ◆ effects waiting in your draft.',
        appBody: 'The Apply sheet lists each ◆ effect. You can put the rest live and keep the ◆ effects waiting in your draft.',
      },
      {
        // launch/_components/hub-settings.tsx LOOK_SECTION_LINE; main-background-panel.tsx
        slug: 'event-hub-look',
        title: 'How do I change how my Event Hub looks?',
        body: 'In Look: Background (behind every scene, and the page colour), Elements (colours, font and buttons) and Music. A plain colour is free; moving backgrounds, your own photo or video, and effects are marked ◆.',
        appBody: 'In Look: Background (behind every scene, and the page colour), Elements (colours, font and buttons) and Music.',
      },
      {
        // launch/_components/hub-go-live-row.tsx "Make your Event Hub public now?"; lib/event-visibility.ts WHO_CAN_VIEW
        slug: 'go-live',
        title: 'How do I make my Event Hub public?',
        body: 'Open ⚙ › Go live and choose Yes, launch, Schedule for later (Manila time) or Not yet. A live Event Hub has no off switch; to close it, set Who can view to Private (or Unlisted).',
      },
      {
        // lib/guests-see-table.ts GUESTS_SEE_WORDS
        slug: 'what-shows-at-each-stage',
        title: 'Can I choose what shows at each stage?',
        body: 'Yes. ⚙ › What guests see › What shows at each stage starts from our suggestions, and you change any of them.',
      },
      {
        // studio-tools.tsx name="Event Hub address"
        slug: 'change-event-hub-address',
        title: 'Can I change my Event Hub’s address?',
        body: 'Yes, in Event Hub address. Changing it changes your link, and the old link still brings guests to the new one.',
      },
    ],
  },
  {
    key: 'host-details-and-prints',
    label: 'Event Details and prints',
    roles: ['couple'],
    articles: [
      {
        // lib/event-details-record.ts RECORD_GROUPS; details/page.tsx "Not set yet", "Waiting for Apply"
        slug: 'what-is-on-event-details',
        title: 'What is on Event Details?',
        body: 'Everything about your event in one place, in five groups: how it looks, how it works, your event, guests and money, and event access. It holds your names, date, venues, love story, dress code, gifts, your Event Hub address and more. A row with nothing yet says Not set yet; a change still waiting for Apply says so.',
      },
      {
        // _components/details-guide-home-card.tsx; lib/details-guided-flow.ts
        slug: 'finish-your-event-hub-guide',
        title: 'Is there a guide to fill in my details?',
        body: 'Yes. While anything is left, Finish your Event Hub shows on Event Details and on Today with how many steps are done, and you can take the steps in any order.',
      },
      {
        // lib/print-pieces.ts PRINT_PIECES; lib/free-prints.ts
        slug: 'what-can-i-print',
        title: 'What can I print?',
        body: 'The invitation set — the invitation, the entourage, the finer details, the menu, an event pass, a welcome poster, an Our Story poster and an event card — and, for the day, the guest list, guest QR codes, the 2D seat plan, table signs and place cards, the entrance chart, meal counts and an Event QR that opens your Event Hub.',
      },
      {
        // lib/studio-prints-settings.ts "Print settings"; prints/page.tsx "Changed since you printed"
        slug: 'print-settings',
        title: 'Where are the print settings?',
        body: 'In Prints › ⚙ Print settings: the QR, the NFC spot, the words on the cards, the passes and the seat plan. If something changes after you print, the piece says Changed since you printed.',
      },
    ],
  },
  {
    key: 'host-papic-and-memories',
    label: 'Photos, music and Memories',
    roles: ['couple'],
    articles: [
      {
        // studio/papic/_components/one-code.tsx "One code for everyone"; crew/page.tsx
        slug: 'how-guests-get-a-papic-camera',
        title: 'How do my guests get a Papic camera?',
        body: 'Each guest’s invite QR is already their camera. For everyone else, there is one shared code for the whole event.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // couple-challenges-manager.tsx "Pick your challenges"; lib/papic-photo-styles.ts
        slug: 'papic-challenges-and-filters',
        title: 'Can I give guests photo challenges or filters?',
        body: 'Yes. Pick your challenges gives guests shots to hunt for, and each camera has filters such as Retro alongside the original.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // studio/pakanta/_components/pakanta-music-form.tsx; use-song-button.tsx "Use on my Event Hub"
        slug: 'what-music-maker-asks',
        title: 'What does Music Maker ask me?',
        body: 'What you call each other, each of your favourite singers, the kind of music, a moment you would love in the song, and anything else. Your story comes from your Love Story. When your song is ready, Use on my Event Hub plays it there.',
        appBody: HELP_NOT_IN_THE_APP,
      },
      {
        // memories/page.tsx; lib/memories-keepsakes.ts ("Photo Notes Magazine", "This day, as a flash")
        slug: 'whats-in-event-memories',
        title: 'What is in my event’s Memories?',
        body: 'Albums — Papic, Challenges, Event Hub, Suppliers and your own uploads, with + Add photos — and your keepsakes: the magazine, the recap, the flash and the thank-you. A keepsake opens once the first photo is in.',
        appBody: 'Albums — from your guests’ cameras, the Event Hub, your suppliers and your own uploads, with + Add photos — and your keepsakes. A keepsake opens once the first photo is in.',
      },
      {
        // memories/_components/memories-settings.tsx "Download all"; live-wall-card.tsx "Memory lane"
        slug: 'download-all-memories',
        title: 'How do I download everything?',
        body: 'In Memories › ⚙ › Download all, which zips your photos by chapter and shows each size first. Memory lane, the photo wall, is free.',
      },
      {
        // story/page.tsx title 'Story Maker'; story/_components/editorial-editor.tsx railSteps
        slug: 'story-maker',
        title: 'What is the Story Maker?',
        body: 'Your after-event story, made in steps: the desk, the story, the look, the cover, what is next, and publish. You choose who reads it — keep it a draft, show it to your guests only, or publish it. Sharing it on Real Stories is up to you.',
      },
    ],
  },
];
