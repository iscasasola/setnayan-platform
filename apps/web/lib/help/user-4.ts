/**
 * HELP SLOT H6 — host areas U31, U33–U35 and every guest area UG1–UG10.
 *
 * Owned by ONE answer-writing session (H6); no other session edits this file.
 * Covers: U31, U33–U35 per the coverage map · as a guest: the invite · RSVP · the Event Hub · the day itself · Papic as a guest · the live wall · the story · gifts · joining.
 * Where those live in the app: app/[slug] (invite, hub, welcome, find-my-table, seat, live-wall, recap, pabuya, request) · app/join.
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

/*
 * H6 · 2026-11-14 — every answer below was checked against origin/main; the code that proves it is named in the comment
 * above it (a greppable string, never a line number). Written for guests (UG1–UG10); U31, U33–U35 had no host-side
 * counterpart not already answered by H3/H4. Left out on purpose:
 *   Gifts (PABUYA_PUBLIC_ROUTE_ENABLED), guests buying camera credits (NEXT_PUBLIC_PAPIC_GUEST_BUY), the 3D avatar
 *   (NEXT_PUBLIC_FIGURE_CHIBI), getting a new QR yourself (GUEST_QR_SELF_ROTATE), automatic face matching
 *   (NEXT_PUBLIC_FACE_MODEL_URL — production has never tagged a face), the branded seat pass (paid).
 *   No time, length or count is typed.
 * Existing guest answers found stale (left untouched — topics-existing.ts is shared): papic-guest-camera (the event's
 * counter is no longer shown; a guest sees their own credits only under a per-guest cap), photo-wall ("Capture the
 * day" does not exist; "straight to their Memories" is false under After I check), rsvp-from-link (the reply-by date
 * closes nothing; the couple sets when replies close), photos-of-you ("about an hour before" — the day opens at 6am),
 * find-your-table (the block reads "Your table"), meal-preference ("Kids"), add-your-face and how-papic-tagging-works
 * (face matching is not running), and the Papic guest articles' appBody (the guest camera IS open in the iPhone app).
 */
export const USER_4_TOPICS: HelpTopic[] = [
  {
    key: 'guest-your-invite',
    label: 'Guest: your invitation',
    roles: ['guest'],
    articles: [
      {
        // lib/invite-destination.ts personalLinkLandingPath; app/[slug]/redeem/route.ts
        slug: 'guest-open-your-invite',
        title: 'Guest: what happens when I open my invitation link?',
        body: 'It opens your own invitation — your name, your role, what to wear and when to arrive. If the couple is still at the Save the Date, it opens that first and asks nothing of you yet.',
      },
      {
        // app/[slug]/_components/reveal/* ("Drag the seal away to open the invitation", "Tap or swipe up to unveil")
        slug: 'guest-seal-or-veil',
        title: 'Guest: there is a seal or a veil on the page — how do I open it?',
        body: 'Drag the seal away, or tap or swipe up to lift the veil — the invitation opens underneath.',
      },
      {
        // app/[slug]/_components/door-choice-words.ts STRANGER_DOOR_WORDS, DOOR_CHOICES
        slug: 'guest-general-link',
        title: 'Guest: I opened the event’s general link and see one button — what now?',
        body: 'Tap Open your invitation, then scan your QR, upload a photo of it, or — if you lost it — log in to the account you saved it to.',
      },
      {
        // app/[slug]/_components/save-to-account.tsx ("Your QR and link keep working without it")
        slug: 'guest-need-an-account',
        title: 'Guest: do I need a Setnayan account?',
        body: 'No. Your link or QR is your key. Save to my account is up to you — it makes a free account with nothing to type, and your QR and link keep working either way.',
      },
      {
        // lib/guest-landing.ts LANDING_WORDS.inAppSafari / inAppChrome
        slug: 'guest-open-in-browser',
        title: 'Guest: the link opened inside Messenger and I can’t save my ticket',
        body: 'Some apps open links in their own small browser, where a ticket cannot be saved. Tap the bar that says Open in Safari (or Chrome) to save your ticket.',
      },
      {
        // app/[slug]/invite/_components/shortcut-line.tsx; app/[slug]/manifest.webmanifest/route.ts
        slug: 'guest-home-screen',
        title: 'Guest: can I put the event on my home screen?',
        body: 'Yes — use Add to Home Screen. The shortcut carries the event’s own icon and opens straight to your invitation.',
      },
      {
        // lib/invite-arrival.ts INVITATION_ONLY_LINE; lib/rsvp-ask.ts WHO_CAN_RSVP_DEFAULT
        slug: 'guest-invitation-only',
        title: 'Guest: it says the event is by invitation only',
        body: 'The couple chose to let in only the guests on their list. Ask them for your own link.',
      },
    ],
  },
  {
    key: 'guest-your-reply',
    label: 'Guest: your reply',
    roles: ['guest'],
    articles: [
      {
        // lib/rsvp-form-words.ts; rsvp-widget.tsx
        slug: 'guest-what-the-reply-asks',
        title: 'Guest: what does the reply ask me?',
        body: 'Whether you will be there — the two answers are worded by the couple, such as Joyfully accepts or Regretfully declines. After a yes it may also ask for your plus-ones, meal, dietary needs, a song, a note to the couple and your mobile, depending on what the couple asks.',
      },
      {
        // rsvp-seats.tsx; rsvp-name-correction.tsx "Wrong name? Tell the couple"
        slug: 'guest-seats-reserved',
        title: 'Guest: what does “we reserved seats for you” mean?',
        body: 'After a yes, your invitation shows how many seats are yours and the name the couple has for you. If your name is wrong, tap Wrong name? Tell the couple — it sends them a note.',
      },
      {
        // rsvp-plus-ones.tsx; add-name-in-place.tsx ("They get their own link and QR the moment you save.")
        slug: 'guest-name-plus-ones',
        title: 'Guest: how do I name my plus-ones?',
        body: 'Each extra seat gets its own line: add their name and their meal or dietary needs if asked. Each person you name gets their own link and QR as soon as you save.',
      },
      {
        // rsvp-widget.tsx askSong; song-request-card.tsx "Ask the band for a song"
        slug: 'guest-song-request',
        title: 'Guest: can I request a song?',
        body: 'If the couple asks, your reply has A song to get you dancing — the song and who sings it. On the day there may also be Ask the band for a song.',
      },
      {
        // lib/mobile-number.ts MOBILE_NEEDED
        slug: 'guest-mobile-required',
        title: 'Guest: why does my reply need my mobile number?',
        body: 'When the couple asks for it, your mobile is needed with a yes so they can reach you — your reply is not saved until it is in. No email is asked for.',
      },
      {
        // lib/guest-landing.ts changeReplyWords; lib/reply-window.ts replyWindowWords
        slug: 'guest-change-your-reply',
        title: 'Guest: how do I change my reply?',
        body: 'Tap Change my reply (or Changed your plans?) at the foot of your invitation. The couple decides when replies close; once they have, the page says so — message the couple if you need a change.',
      },
      {
        // app/[slug]/_components/you-will-be-at.tsx "Which part can't you make?"
        slug: 'guest-cant-make-one-part',
        title: 'Guest: I can only make part of the event',
        body: 'When the invitation has several parts, your reply asks which part you can’t make, then shows the parts you will be at.',
      },
    ],
  },
  {
    key: 'guest-event-hub',
    label: 'Guest: the Event Hub',
    roles: ['guest'],
    articles: [
      {
        // app/[slug]/_lib/site-nav.ts resolveSiteNav; _lib/hub-tabs.ts
        slug: 'guest-event-hub-tabs',
        title: 'Guest: what are the tabs on the Event Hub?',
        body: 'Before the day: Home, Details, Story and Me. On the day: Live, Home, Camera and Memories (when the couple turned the cameras on) and Me. After the day, the recap.',
      },
      {
        // lib/guest-your-schedule.ts; your-schedule-card.tsx "Your schedule", "Estimated call time"
        slug: 'guest-your-schedule',
        title: 'Guest: where is my schedule and my call time?',
        body: 'On Me, under Your schedule: the parts you are invited to and when to arrive — or, if you have a role, your estimated call time. If the couple shares the full schedule, you see your own exact call time there.',
      },
      {
        // dress-code-widget.tsx; guest-me-parts.tsx "See the full dress code"
        slug: 'guest-what-my-role-wears',
        title: 'Guest: what should I wear?',
        body: 'The dress code shows your role, your colours and when to arrive. See the full dress code shows what everyone wears.',
      },
      {
        // app/[slug]/find-seat/page.tsx; find-seat/_components/name-search.tsx "Type your full name", "Find my table"
        slug: 'guest-find-seat-by-name',
        title: 'Guest: can I find my seat without my invitation?',
        body: 'Yes. Open Find your seat, type your full name and tap Find my table — it shows your table and room, never other guests’ names. Seats show on the day, unless the couple shares them earlier.',
      },
      {
        // find-my-table/page.tsx; venue/page.tsx; site-body.tsx venueWalk "Walk the room in 3D"
        slug: 'guest-table-on-a-map',
        title: 'Guest: can I see my table on a floor plan or in 3D?',
        body: 'Yes. Your table is marked on the floor plan with the way from the door, and Walk the room in 3D lets you explore the venue once the couple has shared the seat plan.',
      },
      {
        // lib/guest-landing.ts howToUseLines; LANDING_WORDS.ticketUpdated
        slug: 'guest-ticket-how-to-use',
        title: 'Guest: how do I use my ticket?',
        body: 'Save it to your photos and show it at the door; on the day it also shows your table. If the couple changes something on it, the new ticket pops up once so you can save it again.',
      },
    ],
  },
  {
    key: 'guest-the-day',
    label: 'Guest: on the day',
    roles: ['guest'],
    articles: [
      {
        // arrival-greeting.tsx; app/dashboard/[eventId]/guests/checkin/page.tsx
        slug: 'guest-check-in',
        title: 'Guest: how do I check in?',
        body: 'Show your ticket’s QR at the door. Once you are scanned, your invitation greets you as checked in and shows your table.',
      },
      {
        // lib/reply-window.ts (the_day); guest-ticket.tsx "Show your ticket"
        slug: 'guest-what-changes-on-the-day',
        title: 'Guest: what changes on the day?',
        body: 'Your reply button becomes Show your ticket, Live shows what is happening now and next, and your ticket shows your table.',
      },
      {
        // chapter-notices.tsx; day-of-announcement.tsx "From the coordinator"
        slug: 'guest-announcements',
        title: 'Guest: where do announcements show?',
        body: 'On your invitation — as New on your invitation, or as an announcement from the couple or their coordinator.',
      },
      {
        // app/[slug]/welcome/page.tsx "Not now — just show my pass"
        slug: 'guest-plus-one-welcome',
        title: 'Guest: I am someone’s plus-one — what is my page?',
        body: 'Your own welcome page, which says whose guest you are and asks only for what is missing. Not now — just show my pass skips to your pass.',
      },
    ],
  },
  {
    key: 'guest-photos',
    label: 'Guest: photos and Memory lane',
    roles: ['guest'],
    articles: [
      {
        // papic-guest-capture.tsx "The host hasn't opened your camera yet"
        slug: 'guest-camera-not-open',
        title: 'Guest: my camera says the host hasn’t opened it yet',
        body: 'Guest cameras open on the day of the event, and the couple can open them earlier. After the event they close.',
      },
      {
        // papic-guest-capture.tsx "Tap for a photo. Press and hold to record a snippet"
        slug: 'guest-photo-or-snippet',
        title: 'Guest: how do I take a photo or a short video?',
        body: 'Tap for a photo; press and hold to record a short video.',
      },
      {
        // photos-of-you-gallery.tsx; actions.ts removeMyTag, askToTakeMyPhotoDown
        slug: 'guest-not-me-or-take-down',
        title: 'Guest: a photo isn’t me, or I want it taken down',
        body: 'Open the photo. Not me removes your tag from it. Take it down asks for it to be removed, and a person reviews the request.',
      },
      {
        // live-wall-block.tsx "Memory lane is warming up"; lib/live-wall.ts guestWallMirrorActive
        slug: 'guest-memory-lane',
        title: 'Guest: what is Memory lane?',
        body: 'The photos from the guest cameras, showing as they are taken — when the couple shows it on guests’ phones. You don’t post to it directly: it fills from the cameras.',
      },
      {
        // photos-of-you-gallery.tsx "Take it off Memory lane"
        slug: 'guest-off-memory-lane',
        title: 'Guest: can I take my photo off Memory lane?',
        body: 'Yes. Open it and tap Take it off Memory lane — or put it back later.',
      },
      {
        // app/[slug]/recap/page.tsx; lib/who-can-see-your-story.ts STORY_AUDIENCE_LABEL; story/were-you-there.tsx
        slug: 'guest-the-recap',
        title: 'Guest: where is the recap of the event?',
        body: 'On the event’s page, as the couple’s story — if they share it with the people of the event or with everyone. Were you there? helps you find your moments, and Save all keeps the photos.',
      },
    ],
  },
  {
    key: 'guest-joining',
    label: 'Guest: joining and signing out',
    roles: ['guest'],
    articles: [
      {
        // app/join/[eventId]/_components/join-flow.tsx; lib/request-key.ts REQUEST_WORDS
        slug: 'guest-not-on-the-list',
        title: 'Guest: I’m not on the guest list — can I still join?',
        body: 'Only if the couple lets people ask. Find your invitation by name; if you are not there, ask to join. Your request waits for the couple — it is not valid at the door until they confirm you, and you are told either way.',
      },
      {
        // sign-out-of-invitation.tsx; app/[slug]/sign-out/route.ts; copy-my-link.tsx "Copy my link"
        slug: 'guest-sign-out',
        title: 'Guest: what does signing out of an invitation do?',
        body: 'It removes your pass from this browser and erases any selfie you gave for tagging. You need your invitation link or QR to get back in — Copy my link first if you might need it.',
      },
    ],
  },
];
