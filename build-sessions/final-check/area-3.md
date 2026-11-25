# Final check · Area 3 — Couple: Maker, Event Hub page, invitations, Papic, Memories

> Checker 3 of 8. REPORT ONLY. Pinned commit `fb3f72d` (main frozen). Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Phase A = code pass (`SOURCE: CODE`); phase B = browser walk on staging as `couple_maker` (`SOURCE: SEEN`).
> Seeded events for this area: **Carla & Miguel** (`stg-carla-miguel`, wedding, Event Plus PAID, public Event Hub),
> **Mika turns 7** (`stg-mika-turns-7`, birthday 30 days ago: Memories, recap), the demo event.
> Standards read: corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts D, E, F, I, K), `DARK_MODE_STANDARD_2026-11-20.md`,
> `MOTION_STANDARD_2026-11-18.md`, `docs/brand.md`.

## BLOCKERS

None found.

## Progress

Marks: **OFFLINE** NEEDED (where signal is lost) / READ-ONLY / NOT NEEDED · **SHAPE** today → should.

### Pages (59)

- [ ] /dashboard/[eventId]/alaala
- [ ] /dashboard/[eventId]/alaala/assignments
- [ ] /dashboard/[eventId]/apple-pro
- [ ] /dashboard/[eventId]/event-qr
- [ ] /dashboard/[eventId]/galleries
- [ ] /dashboard/[eventId]/guests/invite
- [ ] /dashboard/[eventId]/guests/send
- [ ] /dashboard/[eventId]/invitation
- [ ] /dashboard/[eventId]/invitation/print
- [ ] /dashboard/[eventId]/launch
- [ ] /dashboard/[eventId]/live
- [ ] /dashboard/[eventId]/memories
- [ ] /dashboard/[eventId]/memories/download-all
- [ ] /dashboard/[eventId]/memories/thank-you
- [ ] /dashboard/[eventId]/monogram
- [ ] /dashboard/[eventId]/pabuya
- [ ] /dashboard/[eventId]/prints
- [ ] /dashboard/[eventId]/story
- [ ] /dashboard/[eventId]/studio/about/[addon]
- [ ] /dashboard/[eventId]/studio/guest-columns
- [ ] /dashboard/[eventId]/studio/live-studio-control
- [ ] /dashboard/[eventId]/studio/live-studio-control/setup
- [ ] /dashboard/[eventId]/studio/mood-board
- [ ] /dashboard/[eventId]/studio/pakanta
- [ ] /dashboard/[eventId]/studio/panood
- [ ] /dashboard/[eventId]/studio/panood/broadcast
- [ ] /dashboard/[eventId]/studio/panood/cameras
- [ ] /dashboard/[eventId]/studio/panood/cameras/print
- [ ] /dashboard/[eventId]/studio/panood/setup
- [ ] /dashboard/[eventId]/studio/papic/challenges
- [ ] /dashboard/[eventId]/studio/papic/crew
- [ ] /dashboard/[eventId]/studio/papic/crew/poster
- [ ] /dashboard/[eventId]/studio/papic/moderation
- [ ] /dashboard/[eventId]/studio/papic/recap
- [ ] /dashboard/[eventId]/studio/papic/run-of-show
- [ ] /dashboard/[eventId]/studio/patiktok
- [ ] /dashboard/[eventId]/studio/patiktok/[templateId]
- [ ] /dashboard/[eventId]/studio/patiktok/booth
- [ ] /dashboard/[eventId]/studio/photo-delivery
- [ ] /dashboard/[eventId]/studio/playlist
- [ ] /dashboard/[eventId]/studio/save-the-date
- [ ] /dashboard/[eventId]/studio/save-the-date/stamp
- [ ] /dashboard/[eventId]/studio/setnayan-ai
- [ ] /dashboard/[eventId]/studio/website-pro
- [ ] /dashboard/[eventId]/website/editor
- [ ] /dashboard/[eventId]/website/hero-photo
- [ ] /dashboard/[eventId]/website/living-hero
- [ ] /dashboard/[eventId]/website/our-photos
- [ ] /dashboard/[eventId]/website/our-story
- [ ] /dashboard/[eventId]/website/photo-moments
- [ ] /dashboard/[eventId]/website/privacy
- [ ] /dashboard/[eventId]/website/site-chrome
- [ ] /dashboard/[eventId]/website/stories
- [ ] /dashboard/[eventId]/website/widgets
- [ ] /dashboard/creator
- [ ] /dashboard/library
- [ ] /dashboard/life-flash
- [ ] /panood/control/[eventId]
- [ ] /panood/program/[eventId]

### Forwards (13)

- [x] /dashboard/[eventId]/event-page → […] · lands on the guest Event Hub `/[slug]` for a couple (no slug → `/launch`); a coordinator or a failed read gets a 404 (F-01) · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/studio/[addon] → /dashboard/[…]/[…] · lands: `monogram-creator`→`/monogram`, `landing-page`→`/website`→`/launch` (2 hops), `music-creator`→`/studio/pakanta`, `orders`→`/orders`, `supplies-marketplace`→`/studio`→More menu (middleware, 2 hops), `rsvp`/`event`/`editorial`→`/website/editor`; any other value 404 · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/studio/indoor-blueprint → /dashboard/[…] · lands on `/guests?gview=seats&seat=map` (`guestsViewHref`), or `/dashboard/[eventId]` when the event type has no seating · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/studio/papic/crew/print → /dashboard/[…]/studio/papic/crew/poster · lands · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website → /dashboard/[…]/launch · lands · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/colors → /dashboard/[…]/website/editor?open=colors · lands (the `open` value is checked under the editor page) · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/editorial → /dashboard/[…]/story · lands · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/special-message → /dashboard/[…]/website/editor?open=special-message · lands (the `open` value is checked under the editor page) · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/what-to-bring → /dashboard/[…]/website/editor?open=what-to-bring · lands (the `open` value is checked under the editor page) · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId] → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId]/editorial → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId]/event → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId]/rsvp → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward

## Findings

_Format: kit § 6 plus `SOURCE`. Phase A findings are `SOURCE: CODE` until the browser pass confirms or strikes them._

### Forwards

#### F-01 · The "event page" forward gives a coordinator, and a failed read, a 404

```
PAGE      /dashboard/[eventId]/event-page   (event: stg-carla-miguel; sign in as coordinator for the 404)
BUTTON    the address itself (help-ask "invitations" place opens it: `help-ask-places.ts` `invitations: { path: 'event-page' }`)
STEPS     1. As a coordinator seated on the event (or a couple whose membership read fails), open /dashboard/[eventId]/event-page.
EXPECTED  The guest Event Hub `/[slug]` opens (it is public), or a failure says the read failed.
ACTUAL    `if (!membership || membership.member_type !== 'couple') notFound();` — a coordinator (`member_type 'coordinator'`)
          and any refused `event_members` read (logged `graceful_degrade`, then `membership` is null) both get a 404.
WHERE     apps/web/app/dashboard/[eventId]/event-page/page.tsx · `HostEventPageRedirect`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states: a failed read is not "not found") · kit §5.2 (no link to a 404)
SEVERITY  wrong
SOURCE    CODE
```
