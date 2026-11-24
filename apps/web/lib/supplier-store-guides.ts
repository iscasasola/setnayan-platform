import type { SpecializedToolKey } from '@/lib/specialized-tools';
import type { GuideShot, GuideStep } from '@/lib/help/guides';

/**
 * 📘 HOW TO USE IT — one short guide per widget (owner 23 Nov 2026 via the controller: *"Yes, guides only"* — no trial,
 * no "Try it first"; every widget gets a how-to guide). Drawn by `store/_components/widget-guide.tsx` on the widget's
 * Toolkit page (`#guide`), and opened from its panel in Your widgets ("How to use it").
 *
 * SHAPE — the Guide & Help guide's own types (`lib/help/guides.ts`: `GuideStep` {title, body} and `GuideShot` {src, alt},
 * imported, never re-declared), with the picture on every step (the controller: "short steps, each with a picture of the
 * real screen"). Help's guides are page tours; a widget has no tour (supplier page tours were retired), so its steps
 * are written here, in the same shape, and drawn with Help's step look and `stepsLine`.
 *
 * ✍ EVERY STEP SAYS WHAT THE CODE DOES TODAY, in the screen's own words (each tool's anchor is in the comment above it).
 * No feature is promised. A widget with no screen of its own says so instead of inventing steps.
 *
 * 🖼 `shot: null` = no real capture yet: the view draws an empty frame, never a stand-in. A capture lands as a real
 * 375 px screen in `public/guides/widgets/<key>-<n>.jpg` and is named here.
 * 🔒 app/vendor-dashboard/shop/store/the-store-is-the-drawing.test.ts (8).
 */

export type WidgetGuideStep = GuideStep & { shot: GuideShot | null };
export type WidgetGuide = { key: SpecializedToolKey; title: string; steps: ReadonlyArray<WidgetGuideStep> };

const step = (title: string, body: string): WidgetGuideStep => ({ title, body, shot: null });

/** The on-the-day door every per-event widget shares (`ToolBody` per_event · `onTheDayHref` · the live page's date rule). */
const ON_THE_DAY = step(
  'Open it on the event day',
  'In Your widgets, tap it, then tap a booked event. Its screen opens on the day of that event, once the event is paid.',
);

export const WIDGET_GUIDES: Record<SpecializedToolKey, WidgetGuide> = {
  // ToolBody scanner · service-scanner-pick.tsx (SCAN_MODES) · supplier-scan/* · scanNumberLabel
  scanner: {
    key: 'scanner',
    title: 'Scanner',
    steps: [
      step('Pick a scanner for each service', 'Tap Scanner in Your widgets. Each service has its own Scanner list: Off, Once, Ordered → Received, Unlimited, Group session or Roaming. It saves as you pick.'),
      step('Start scanning on the day', 'On the event screen, open Scanner, choose which service you are scanning for, then tap Start scanning or Read a tag.'),
      step('Call the numbers', 'Your numbers lists every scan. Tap Ready when an order is done. The guest sees the same number on their phone.'),
    ],
  },
  // ToolBody cake_tool · cake-maker-panel.tsx · cake-plus.tsx · cake-invite-card.tsx
  cake_tool: {
    key: 'cake_tool',
    title: 'Cake Maker',
    steps: [
      step('Choose what you offer', 'Tap Cake Maker in Your widgets. Open each part — Tiers, Flavour, Shapes and heights, Finish, Colours, Accents, Monogram, Topper, Cupcakes, Message — and tick what you make, with your own extra price.'),
      step('Check what couples see', 'The preview under What couples see shows the designer as a couple will meet it.'),
      step('Turn it on', 'Tap Turn on Cake Maker. After that, Save changes keeps each edit.'),
      step('Let couples design in your chat', 'Couples find Design a cake under ＋ in your chat. You can also send Ask for a cake design from ＋ in the chat.'),
    ],
  },
  // repertoire-view.tsx · repertoire-tools.tsx · app/v/[slug] performance_url · isMusicVendor
  song_bank: {
    key: 'song_bank',
    title: 'Song bank',
    steps: [
      step('Open your Song bank', 'Tap Song bank in Your widgets, then Open Song bank. It is for music services.'),
      step('Add the songs you play', 'Search the song library and add each song. A song that is not there: Add your own, then Add to my set list.'),
      step('Show a video', 'On a song, Link a video of you playing it, then Save. Couples see your songs and videos on your shop page.'),
    ],
  },
  // song-desk/song-desk.tsx · requests-inbox.tsx · sets-panel.tsx · app/api/song-requests
  song_desk: {
    key: 'song_desk',
    title: 'Song Desk',
    steps: [
      ON_THE_DAY,
      step('Answer requests', 'Requests from the room come in from guests. Tap We’ll play it or Decline. Pause requests stops new ones; Resume requests opens them again.'),
      step('Build your sets', 'Name a set, choose which moment it covers, tap Add set, then add songs to it. It shows which requests you already play.'),
    ],
  },
  // stage-script/stage-script.tsx (read-only)
  emcee_script: {
    key: 'emcee_script',
    title: 'Emcee script',
    steps: [
      ON_THE_DAY,
      step('Read along', 'It shows Your segments, what is On now, the Running script and the Announcements from the couple’s program. There is nothing to press.'),
      step('Mind the private notes', 'A note marked Not for the mic is for you only — do not read it out.'),
    ],
  },
  // floor-command/*.tsx · march-read.tsx · supplierSeesMarch
  floor_command: {
    key: 'floor_command',
    title: 'Floor Command + March',
    steps: [
      ON_THE_DAY,
      step('Call each part', 'Tap Start on the next part, then Finish when it ends. The next part follows.'),
      step('Move or skip a part', 'Change the schedule: pick a part, move it by some minutes, or Skip this part. Some changes ask the hosts first.'),
      step('Find a guest’s seat', 'Tap Scan a guest’s card to see where they are seated.'),
      step('Follow the march', 'Wedding March shows the order the couple set. Only they can change it.'),
    ],
  },
  // day-run-of-show.tsx (read-only) · fetchRunOfShowBlocks
  run_of_show: {
    key: 'run_of_show',
    title: 'Run of show',
    steps: [
      ON_THE_DAY,
      step('Watch Now and Up next', 'It shows what is happening now, what is up next and when it starts, from the couple’s program. There is nothing to press.'),
    ],
  },
  // event-day-body.tsx headcount row (read-only)
  headcount: {
    key: 'headcount',
    title: 'Headcount',
    steps: [
      ON_THE_DAY,
      step('Read the count', 'It shows how many are attending out of how many were invited, pulled live from the couple’s RSVPs. There is nothing to press.'),
    ],
  },
  // live_watch has no screen on the event page today (nothing under on-the-day/live draws it) — no steps are invented.
  live_watch: {
    key: 'live_watch',
    title: 'Live Watch',
    steps: [],
  },
  // vendor-challenge-section.tsx · vendor-challenges-approval.tsx (the couple's side)
  papic_challenge: {
    key: 'papic_challenge',
    title: 'Papic challenge',
    steps: [
      step('Open a booked event', 'From Clients, open the event you are booked on.'),
      step('Write a mission', 'Write the photo game for the guests, then tap Submit for the couple’s okay.'),
      step('Wait for the couple', 'It shows Awaiting couple until they say yes. Then it goes Live and guests can play.'),
      step('See the photos', 'Tap View shared photos to see what the guests sent.'),
    ],
  },
  // booth-poster-card.tsx · booth-studio-card.tsx
  plan_3d: {
    key: 'plan_3d',
    title: '3D plan',
    steps: [
      step('Open a booked event', 'From Clients, open the event you are booked on.'),
      step('Put up your poster', 'In Your booth poster, tap Upload poster. Replace poster changes it.'),
      step('Write on your booth', 'In Words on your booth, fill in the headline and your offer, then tap Save to my booth.'),
      step('See it in their plan', 'Your booth shows in the couple’s 3D plan, in their colours, with your logo.'),
    ],
  },
  // on-the-day/page.tsx ShotListSection · shot-list.tsx · shot-list-actions.ts
  shot_list: {
    key: 'shot_list',
    title: 'Shot list',
    steps: [
      step('Open On the day', 'In Your widgets, tap Shot list, then open On the day. Pick the booked event.'),
      step('Add your must-get shots', 'Type a shot in Add a shot… and tap Add. The list is saved for that event.'),
      step('Tick them off as you shoot', 'Tap a shot to mark it captured; tap again to undo. Reset puts back the starting list.'),
    ],
  },
  // on-the-day/_components/issues-log.tsx
  issues_log: {
    key: 'issues_log',
    title: 'Issues log',
    steps: [
      step('Open On the day', 'In Your widgets, tap Issues log, then open On the day. It sits with each booked event for coordinators.'),
      step('Log what comes up', 'Type it in Log an issue… and tap Log. It is private to you, on this device.'),
    ],
  },
  // clients/[eventId]/production-sheet · add-rule-sheet.tsx · rule-rows.tsx · production-sheet-body.tsx
  production_sheet: {
    key: 'production_sheet',
    title: 'Production sheet',
    steps: [
      step('Open a booked client', 'In Your widgets, tap Production sheet, then pick a booked event. It is for food services.'),
      step('Add your portion rules', 'Tap Add a portion rule: what you serve per guest and who counts. Save rule.'),
      step('Read the totals', 'Ingredient totals come from your rules × the couple’s confirmed guests. Print production sheet when you need paper.'),
    ],
  },
  // on-the-day/live/[eventId] LiveReviews
  live_reviews: {
    key: 'live_reviews',
    title: 'Live reviews',
    steps: [ON_THE_DAY, step('Read them as they land', 'Reviews, as they land shows each new review — private to you and read-only.')],
  },
  // clients/[eventId] "Your handovers" (vendorPostHandover) · chat handover-card.tsx
  handover: {
    key: 'handover',
    title: 'Hand over to the couple',
    steps: [
      step('Open a booked client', 'In Your widgets, tap Hand over to the couple, then pick a booked event.'),
      step('Post what you hand over', 'Under Your handovers, post an Album link, a Sample / proof, a Note, or All delivered.'),
      step('The couple confirms', 'The couple sees it in your chat and taps I received it.'),
    ],
  },
  // clients/[eventId]/seat-plan/seat-plan-body.tsx (get_vendor_seat_plan)
  seat_plan: {
    key: 'seat_plan',
    title: 'Seat plan',
    steps: [
      step('Open a booked client', 'In Your widgets, tap Seat plan, then pick a booked event.'),
      step('Read the floor', 'Once the couple publishes their plan, you see the stage, the dance floor, the entrances and each table with its seated count — never guest names. Your spot shows where you are.'),
    ],
  },
  // on-the-day/live/[eventId]/papic (counsel-gated: vendor-dayof-flags.ts)
  papic_camera: {
    key: 'papic_camera',
    title: 'Papic camera',
    steps: [ON_THE_DAY, step('Shoot the event', 'Take photos and clips of the event you are working. It spends your Papic credits for that event.')],
  },
};
