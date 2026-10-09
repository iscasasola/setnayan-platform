/**
 * photos-two-ways.test.ts — A MOMENT'S PHOTOS, TWO WAYS: UPLOAD, OR PICK FROM THEIR OTHER EVENTS.
 *
 * Owner, 2026-10-08: *"love story they can add manually or add from their stories"* → *"add from their stories.
 * their collection of photos from other events, they can add them as well."* · *"they can always edit it if manual,
 * but if added via their memories, cannot edit."*
 *
 * Studio › Love Story's photo slots offer both ways. The second is the SHIPPED "Pick from our events" ability
 * (`our-events-read.ts` + the moment action's `intent=pick`), drawn inside the slots' own sheet.
 *
 *   (1) REQUESTS — opening Love Story in the Studio no longer reads the pair's other events (it paid 2–3 reads on
 *       every open, picked from or not — counted here on the real read with a stand-in client). They are asked for
 *       ONCE, by the first "Pick from our events" opened, through the moment action's `intent=offer` — which
 *       answers before it reads the story and writes nothing.
 *   (2) THE ASK — one form; the answer is the events, or null (said with Try again) — never "none" for a refusal.
 *   (3) A PICK IS THE SHIPPED PICK — `intent=pick` with THIS moment's id, into the DRAFT, landing where the couple
 *       already is; it always goes to the server; something not yet kept in the slots is kept FIRST, never raced.
 *   (4) ROOM — a pick fills only the room the moment has; a tick never passes it.
 *   (5) PAINTED — both ways are in the slots; loading, none and "could not look" never look alike; an event that is
 *       someone else's or shows no photos is listed and cannot be opened; with no other event the choice stays,
 *       quiet, and says why; the slots are three across on every width.
 *   (6) WHERE A PHOTO CAME FROM — read off its own ref (no new storage); its square says so in words; it can be
 *       removed and nothing else. The Studio reads the event's NAME only when the story holds such a photo.
 *   (7) THE LAB has two other events — one that lends photos, one that does not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_DRAFT_FIELD } from './hub-draft';
import { resolveReturnTo } from './editor-return';
import { MAKER_STAY_FIELD } from './maker-stay';
import { momentNeedsServer } from './love-story-moment-intent';
import type { LoveStoryMoment } from './love-story-moments';
import { readOurEvents } from '../app/dashboard/[eventId]/website/our-story/_components/our-events-read';
import { eventOfPhotoRef, photosFromOtherEvents } from '../app/dashboard/[eventId]/website/our-story/_components/our-events-rule';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const STORY = 'app/dashboard/[eventId]/website/our-story';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const cards = () => read(`${STORY}/_components/moment-order-cards.tsx`);
const load = () => import(`../${STORY}/_components/moment-order-cards`);

const THIS = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '11111111-1111-4111-8111-1111111111bb';
const OWN = `r2://setnayan-media/events/${THIS}/love-story/9f-own.jpg`;
const LENT = `r2://setnayan-media/events/${OTHER}/our-photos/3c-lent.jpg`;
const HERO = `r2://setnayan-media/events/${OTHER}/landing-page-hero/aa-hero.jpg`;

/** A PostgREST stand-in that COUNTS every read it is asked for. */
function countingAdmin(tables: Record<string, Record<string, unknown>[]>) {
  const asked: string[] = [];
  const client = {
    from(table: string) {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const q = {
        select: () => q,
        eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), q),
        in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), q),
        limit: () => q,
        then(resolve: (v: unknown) => void) {
          asked.push(table);
          resolve({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null });
        },
      };
      return q;
    },
  };
  return { client: client as never, asked };
}
const member = (event_id: string, user_id: string, member_type: string) => ({ event_id, user_id, member_type, hidden_at: null });

test('(1) requests: the Studio’s open no longer pays 2–3 reads for other events — they are asked for once, on demand, by an action that reads nothing else', async () => {
  // WHAT EVERY OPEN PAID BEFORE — the real read, counted: 3 requests for a pair with another event, 2 with none.
  const withOne = countingAdmin({
    event_members: [member(THIS, 'a', 'couple'), member(THIS, 'b', 'couple'), member(OTHER, 'a', 'couple'), member(OTHER, 'b', 'guest')],
    events: [{ event_id: OTHER, display_name: 'The engagement', event_date: '2025-06-21', our_photos: [LENT], landing_page_hero_image_url: HERO }],
  });
  const offered = await readOurEvents({ userId: 'a', eventId: THIS, adminClient: withOne.client });
  assert.deepEqual(withOne.asked, ['event_members', 'event_members', 'events'], 'the read is not the three requests this test says the open used to pay');
  assert.deepEqual(offered?.map((e) => [e.name, e.hosted, e.refs]), [['The engagement', true, [HERO, LENT]]]);
  const withNone = countingAdmin({ event_members: [member(THIS, 'a', 'couple'), member(THIS, 'b', 'couple')] });
  assert.deepEqual(await readOurEvents({ userId: 'a', eventId: THIS, adminClient: withNone.client }), []);
  assert.equal(withNone.asked.length, 2);

  // NOW: the page does not read them for the Studio — the launch page says "this is the Studio", the page skips.
  const page = read(`${STORY}/page.tsx`);
  assert.match(page, /const inStudio = inMaker && search\.studio === '1';/);
  assert.match(page, /inStudio \? Promise\.resolve<OtherEvent\[\] \| null>\(null\) : readOurEventsOffer\(user\.id, eventId\),/, 'the Studio’s open reads the pair’s other events again');
  assert.equal((page.match(/readOurEventsOffer\(|readOurEvents\(/g) ?? []).length, 1, 'the page reads other events in a second place');
  assert.match(page, /const pickSlot = inStudio \? null : \(\s*<PickFromOurEvents/, 'the Studio is handed a block it never draws');
  assert.match(read('app/dashboard/[eventId]/launch/page.tsx'), /<OurStoryEditorPage[\s\S]{0,200}?maker: '1',\s*studio: stagesStudio \? '1' : undefined,/, 'the Maker’s page no longer tells the Love Story page it is the Studio');
  // Outside the Studio the shipped block is drawn exactly as before (the offer is read with the page).
  assert.match(page, /<PickFromOurEvents\s+events=\{otherEvents\}/);

  // ON DEMAND: `intent=offer` is answered right after "who is asking" and "is this an intent" — BEFORE the story,
  // the draft or anything else is read, and it writes, revalidates and redirects nothing.
  const actions = read(`${STORY}/actions.ts`);
  const fn = actions.slice(actions.indexOf('export async function loveStoryMomentAction'));
  const offer = fn.indexOf("if (intent === 'offer') return { offer: await readOurEventsOffer(user.id, eventId) }");
  assert.ok(offer > -1, 'the action does not answer the offer');
  const before = fn.slice(0, offer);
  assert.match(before, /const user = await getCurrentUser\(\);\s*if \(!user\) redirect\('\/login'\);/);
  assert.doesNotMatch(before, /createClient\(|\.from\(|draftedEventColumn|readHubDraft|requireHostMembership|saveHubDraft|revalidatePath|\.update\(/, 'the offer waits on a read it does not need, or writes');
  assert.match(actions, /const MOMENT_INTENTS = \['add', 'edit', 'delete', 'arrange', 'order', 'pick', 'offer'\] as const;/);
  // +0 exported server actions: the offer rides the one that was there.
  assert.equal((actions.match(/^export async function /gm) ?? []).length, 2);

  // ONCE PER VISIT: the first opening asks; a second tap, another moment's slots, or a re-draw do not ask again.
  const s = cards();
  assert.match(s, /const askOffer = \(\) => \{\s*if \(asking\.current \|\| offer\.state === 'have'\) return;\s*asking\.current = true;\s*setOffer\(\{ state: 'asking' \}\);\s*void askOurEvents\(action\)\.then\(/);
  assert.equal((s.match(/askOurEvents\(/g) ?? []).length, 2, 'the events are asked for from a second place'); // its definition + the one call
  assert.match(s, /onClick=\{\(\) => \{\s*onAskOffer\?\.\(\);\s*setPicking\(true\);\s*\}\}/, 'the events are asked for before "Pick from our events" is tapped');
  assert.doesNotMatch(s, /useEffect\(\(\) => \{[^}]*ask(?:Offer|OurEvents)/, 'the events are asked for when the page is drawn');
  assert.doesNotMatch(s, /setInterval|router\.refresh|useRouter/);
});

test('(2) the ask: ONE form; the answer is the events, or null — a refusal is never "no other events"', async () => {
  const { askOurEvents } = await load();
  const sent: FormData[] = [];
  const events = [{ eventId: OTHER, name: 'The engagement', date: '2025-06-21', hosted: true, photos: [{ ref: LENT, url: '/lent.webp' }] }];
  const got = await askOurEvents(async (fd: FormData) => {
    sent.push(fd);
    return { offer: events } as never;
  });
  assert.deepEqual(got, events);
  assert.equal(sent.length, 1, 'opening the picker costs more than one request');
  assert.deepEqual([...sent[0]!.entries()], [['intent', 'offer']], 'the ask carries more than the question');
  assert.deepEqual(await askOurEvents(async () => ({ offer: [] }) as never), [], 'a pair with no other event is not told so');
  // Refused, unanswered, or thrown: NULL — the screen says it could not look, with Try again.
  assert.equal(await askOurEvents(async () => ({ offer: null }) as never), null);
  assert.equal(await askOurEvents(async () => undefined), null, 'an action that answered nothing reads as "no other events"');
  assert.equal(
    await askOurEvents(async () => {
      throw new Error('offline');
    }),
    null,
  );
});

test('(3) a pick is the SHIPPED pick: intent=pick with this moment’s id, into the draft, landing where the couple is — and what is not yet kept goes first', async () => {
  const { momentPickForm, draftInPlace } = await load();
  const fd = draftInPlace(momentPickForm('ls-trip', [LENT, HERO]), '/dashboard/ev-1/launch?side=studio');
  assert.equal(fd.get('intent'), 'pick');
  assert.equal(fd.get('id'), 'ls-trip');
  assert.deepEqual(fd.getAll('media'), [LENT, HERO]);
  // Into the DRAFT (guests see it after ✓ Apply — today's behaviour, kept)…
  assert.equal(fd.get(HUB_DRAFT_FIELD), '1');
  // …and landing on the address the couple is ALREADY on: the server's own resolver hands it back verbatim, so the
  // Maker is re-drawn in place — never moved to another address (which remounts it).
  assert.equal(fd.get(MAKER_STAY_FIELD), '1');
  assert.equal(resolveReturnTo(fd, '/dashboard/ev-1/website/our-story?saved=1', '?saved=1'), '/dashboard/ev-1/launch?side=studio');
  // Outside the Maker there is no address to hold: the action's own landing.
  const bare = draftInPlace(momentPickForm('m', [LENT]), null);
  assert.equal(bare.get('return_to'), null);
  assert.equal(bare.get(MAKER_STAY_FIELD), null);
  assert.equal(bare.get(HUB_DRAFT_FIELD), '1');
  // A pick is ALWAYS the server's to decide (which photos are theirs) — never applied at the tap.
  const held: LoveStoryMoment = { id: 'ls-trip', date: { y: 2021 }, line: 'Baguio.', media: [LENT], canvas: {} };
  assert.equal(momentNeedsServer([held], momentPickForm('ls-trip', [LENT])), true, 'a pick of a photo the story already holds skips the server’s check');

  const s = cards();
  const pick = s.slice(s.indexOf('const pickFrom = (refs: readonly string[]) => {'), s.indexOf('const move = (by: 1 | -1) => {'));
  assert.ok(pick.length > 200, 'anti-vacuity: the row’s pick was not found');
  // Whatever the slots hold unkept is taken out of the closing's hands FIRST (so closing cannot also save it)…
  assert.match(pick, /^const pickFrom = \(refs: readonly string\[\]\) => \{\s*const pending = picked\.current;\s*picked\.current = null;\s*if \(refs\.length === 0\) return;/);
  // …kept by its own save, awaited — a refused one stops the pick — and then the ONE pick form.
  assert.match(pick, /if \(pending && !sameList\(pending, media\) && \(await send\(photosForm\(pending\)\)\) === false\) return;\s*await send\(draftInPlace\(momentPickForm\(m\.id, refs\), maker \? `\$\{window\.location\.pathname\}\$\{window\.location\.search\}` : null\)\);/);
  assert.equal((s.match(/momentPickForm\(m\.id/g) ?? []).length, 1);
  assert.match(pick, /setKeeping\(true\);[\s\S]*\.finally\(\(\) => setKeeping\(false\)\);/, 'the row does not say it is keeping the photos');
  // The slots hand the pick to the row and close — the row says "Keeping your photos…", then shows them or says why not.
  assert.match(s, /onPick=\{\(refs\) => \{\s*pickFrom\(refs\);\s*close\(\);\s*\}\}/);
  // The server's pick is untouched: the same allow-list, the same moment by id.
  const actions = read(`${STORY}/actions.ts`);
  assert.match(actions, /if \(!prior\) return fail\('Choose the moment to add these to\.'\);\s*const mine = await ourEventPhotoRefs\(user\.id, eventId\);\s*const allowed = readMomentMedia\(formData\.getAll\('media'\)\)\.filter\(\(ref\) => mine\.has\(ref\)\);/);
});

test('(4) room: a pick fills only the room the moment has, and a tick never passes it', async () => {
  const { momentPhotoRoom, tickedPhotos } = await load();
  assert.deepEqual([[0, 0], [1, 1], [2, 2], [3, 3]].map(([h, n]) => momentPhotoRoom(h!, n!)), [3, 2, 1, 0]);
  assert.equal(momentPhotoRoom(4, 4), 0, 'a moment that holds four is offered a fifth');
  assert.equal(momentPhotoRoom(4, 3), 1, 'a moment that held four and lost one cannot have it back');
  assert.equal(momentPhotoRoom(1, 3), 0, 'photos added in the slots but not kept yet do not count against the room');
  assert.equal(momentPhotoRoom(2, 0), 3);
  let t: readonly string[] = [];
  t = tickedPhotos(t, 'a', 2);
  t = tickedPhotos(t, 'b', 2);
  assert.deepEqual(t, ['a', 'b']);
  assert.deepEqual(tickedPhotos(t, 'c', 2), ['a', 'b'], 'a third was ticked into room for two');
  assert.deepEqual(tickedPhotos(t, 'a', 2), ['b'], 'a tick cannot be taken back');
  assert.deepEqual(tickedPhotos([], 'a', 0), []);
  const s = cards();
  assert.match(s, /const room = momentPhotoRoom\(media\.length, now\.length\);/);
  assert.match(s, /disabled=\{held \|\| \(!on && ticked\.length >= room\)\}/, 'a photo past the room, or one already here, can be ticked');
  assert.match(s, /onClick=\{\(\) => setTicked\(\(t\) => tickedPhotos\(t, ph\.ref, room\)\)\}/);
  assert.match(s, /data-moment-pick-add=""\s*disabled=\{ticked\.length === 0\}\s*onClick=\{\(\) => onAdd\(ticked\)\}/);
});

test('(5) painted: both ways are in the slots; loading, none and "could not look" never look alike; a closed event cannot be opened; three across', async () => {
  const { MomentPhotos, PickFromEvents } = await load();
  const { renderToStaticMarkup } = await import('react-dom/server');
  const moment = (media: string[]): LoveStoryMoment => ({ id: 'ls-trip', date: { y: 2021 }, title: 'Our first trip', line: 'Baguio.', ...(media.length ? { media } : {}), canvas: {} });
  const sheet = { action: async () => {}, moments: [], partners: [], ownsPro: true, storeShell: false, proHref: '/pro', proPrice: null, eventId: 'ev-1', mediaUrls: {} };
  const slots = (over: Record<string, unknown> = {}, media: string[] = []) =>
    renderToStaticMarkup(React.createElement(MomentPhotos, { m: moment(media), sheet, mediaUrls: {}, onChange: () => {}, onDone: () => {}, onPick: () => {}, onAskOffer: () => {}, ...over }));

  // BOTH WAYS, in the one sheet: the upload, and the second choice under it — a button with its words and an arrow.
  const open = slots();
  assert.match(open, /type="file"/, 'the upload is gone from the slots');
  assert.match(open, /<button type="button" data-moment-photos-pick=""[^>]*>Pick from our events<svg/);
  assert.doesNotMatch(open, /<button[^>]*data-moment-photos-pick=""[^>]*\sdisabled=""/, 'the choice is dead before anybody asked');
  assert.doesNotMatch(open, /data-moment-photos-pick-why/);
  assert.doesNotMatch(open, /data-moment-pick=/, 'the picker is open before it was tapped');
  // Three across on every width.
  assert.match(open, /<div data-moment-photos-tiles="" class="\[&amp;_ul\]:!grid-cols-3">/);
  // NO OTHER EVENT (they were asked): the choice stays, quiet, and says why.
  const none = slots({ offer: { state: 'have', events: [] } });
  assert.match(none, /<button type="button" data-moment-photos-pick="" disabled=""/);
  assert.match(none, /<p data-moment-photos-pick-why=""[^>]*>You have no other events yet\.<\/p>/);
  // FULL: the choice says so — it does not open a picker that can add nothing.
  const full = slots({}, [OWN, LENT, HERO]);
  assert.match(full, /<button type="button" data-moment-photos-pick="" disabled=""/);
  assert.match(full, /data-moment-photos-pick-why=""[^>]*>This moment is full\. Remove a photo to add another\.</);
  // A couple without Pro meets the one Pro line: neither way is offered.
  const free = renderToStaticMarkup(React.createElement(MomentPhotos, { m: moment([]), sheet: { ...sheet, ownsPro: false }, mediaUrls: {}, onChange: () => {}, onDone: () => {}, onPick: () => {} }));
  assert.doesNotMatch(free, /data-moment-photos-pick|type="file"/);
  assert.match(free, /data-love-story-pro-line/);

  // THE PICKER'S STATES never look alike.
  const picker = (offer: unknown) => renderToStaticMarkup(React.createElement(PickFromEvents, { offer, onAsk: () => {}, room: 2, here: [], onBack: () => {}, onAdd: () => {} }));
  const events = [
    { eventId: OTHER, name: 'The engagement', date: '2025-06-21', hosted: true, photos: [{ ref: LENT, url: '/lent.webp' }, { ref: HERO, url: '/hero.webp' }] },
    { eventId: 'e-theirs', name: 'Ana & Luis', date: '2024-02-10', hosted: false, photos: [] },
    { eventId: 'e-bare', name: 'Housewarming', date: null, hosted: true, photos: [] },
  ];
  const loading = picker({ state: 'asking' });
  const failed = picker({ state: 'failed' });
  const empty = picker({ state: 'have', events: [] });
  const list = picker({ state: 'have', events });
  assert.match(loading, /role="status" aria-busy="true" aria-label="Looking up your other events" data-moment-pick-loading=""/);
  assert.equal(picker({ state: 'idle' }), loading, 'before the answer the picker shows something other than loading');
  assert.match(failed, /<div role="alert" data-moment-pick-failed=""[^>]*><p[^>]*>We could not look up your other events\.<\/p><button type="button" data-moment-pick-retry=""[^>]*>Try again<\/button>/);
  assert.match(empty, /<p data-moment-pick-none=""[^>]*>You have no other events yet\.<\/p>/);
  for (const [name, html] of [['loading', loading], ['failed', failed]] as const) {
    assert.doesNotMatch(html, /no other events yet|data-moment-pick-list|data-moment-pick-none/, `${name} reads as "none" or as a list`);
  }
  assert.doesNotMatch(loading, /role="alert"|Try again/);
  assert.doesNotMatch(empty, /role="alert"|aria-busy|Try again/);
  assert.doesNotMatch(list, /role="alert"|aria-busy|no other events yet/);
  for (const html of [loading, failed, empty, list]) assert.match(html, /<button type="button" data-moment-pick-back=""[^>]*>.*?Photos<\/button>/, 'there is no way back to the slots');
  // THE LIST: an event that lends photos is a row to open — name, its day, how many; the others are listed and closed.
  assert.match(text(list), /<button type="button" data-moment-pick-event="[^"]*"[^>]*><span[^>]*><span[^>]*>The engagement<\/span><span[^>]*>June 21, 2025 · 2 photos<\/span><\/span><svg/);
  assert.match(text(list), /<div data-moment-pick-event-closed="e-theirs"[^>]*><span[^>]*><span[^>]*>Ana & Luis<\/span><span[^>]*>February 10, 2024 · Someone else’s event<\/span><\/span><\/div>/);
  assert.match(text(list), /<div data-moment-pick-event-closed="e-bare"[^>]*><span[^>]*><span[^>]*>Housewarming<\/span><span[^>]*>No photos yet<\/span><\/span><\/div>/);
  assert.equal((list.match(/data-moment-pick-event="/g) ?? []).length, 1, 'an event with nothing to lend can be opened');
  // The photos of an opened event are fixed squares to tick, as many as there is room for — then ONE button.
  const s = cards();
  assert.match(s, /aria-pressed=\{on\}/);
  assert.match(s, /className=\{`sn-press relative block aspect-square w-full overflow-hidden rounded-xl[^`]*\$\{on \? 'ring-2 ring-sn-accent[^']*' : ''\}`\}/);
  // The uploader stays mounted behind the picker (what it holds unkept is not lost by looking at the events).
  assert.match(s, /<div hidden=\{picking\}>/);
  assert.doesNotMatch(s, /\{picking \? null : \(\s*<FileUpload|!picking && \(?\s*<FileUpload/);
});
const text = (html: string) => html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'");

test('(6) where a photo came from is read off its own ref; its square says so in words; the Studio reads a name only when there is one to read', async () => {
  // THE SOURCE IS THE REF: every photo an event shows is stored under that event's own folder, and a pick stores the
  // same ref — so nothing else records it, and nothing new is stored.
  assert.equal(eventOfPhotoRef(LENT), OTHER);
  assert.equal(eventOfPhotoRef(HERO), OTHER);
  assert.equal(eventOfPhotoRef(OWN), THIS);
  assert.equal(eventOfPhotoRef(LENT.toUpperCase().replace('R2://SETNAYAN-MEDIA/EVENTS', 'r2://setnayan-media/events')), OTHER, 'an id in capitals is another event');
  for (const unknown of ['https://cdn.example/legacy.jpg', 'r2://setnayan-media/events/lab/love-story/a.jpg', 'r2://setnayan-media/pabuya-qr/x.png', `r2://setnayan-media/vendors/${OTHER}/a.jpg`, '']) {
    assert.equal(eventOfPhotoRef(unknown), null, `${unknown} was given a source`);
  }
  const from = photosFromOtherEvents([OWN, LENT, HERO, 'https://cdn.example/legacy.jpg'], THIS);
  assert.deepEqual([...from], [[LENT, OTHER], [HERO, OTHER]], 'the moment’s own photo, or one of unknown source, is marked as borrowed');
  assert.deepEqual([...photosFromOtherEvents([OWN], THIS.toUpperCase())], []);

  // WHAT ITS SQUARE SAYS — the event's name; plainly "another of your events" when the name could not be read.
  const { photoFromWords } = await load();
  assert.equal(photoFromWords({ [LENT]: 'The engagement' }, LENT), 'From The engagement');
  assert.equal(photoFromWords({ [LENT]: '' }, LENT), 'From another of your events', 'an unread name is drawn as an empty mark, or guessed');
  assert.equal(photoFromWords({ [LENT]: 'The engagement' }, OWN), null, 'the moment’s own photo is marked');
  assert.equal(photoFromWords(undefined, LENT), null);
  // The slots hand it to the uploader's tile; the tile draws WORDS along its foot (also what a screen reader says),
  // and still carries its ✕ — a borrowed photo can be removed, and there is no other control on a tile.
  assert.match(cards(), /tileNote=\{\(ref\) => photoFromWords\(photoFrom, ref\)\}/);
  const up = read('app/_components/file-upload.tsx');
  const gallery = up.indexOf('{(isGallery && (inFlight.length > 0 || items.length > 0)) || failed.length > 0 ? (');
  assert.ok(gallery > -1, 'anti-vacuity: the gallery branch was not found');
  const kept = up.slice(up.indexOf('{items.map((item) => (', gallery), up.indexOf('{inFlight.map((item) => (', gallery));
  assert.match(kept, /\{tileNote\?\.\(item\.r2Ref\) \? \(\s*<span data-upload-tile-note=""[^>]*>\s*\{tileNote\(item\.r2Ref\)\}\s*<\/span>\s*\) : null\}/);
  assert.match(kept, /onClick=\{\(\) => removeItem\(item\.id\)\}/);
  assert.equal((kept.match(/<button\b/g) ?? []).length, 1, 'a kept tile has a second control');

  // THE PAGE works the source out from the story's own refs; the NAME comes from the offer when this render has it,
  // and in the Studio from ONE read of those events' names — made only when the story holds such a photo.
  const page = read(`${STORY}/page.tsx`);
  assert.match(page, /const borrowed = photosFromOtherEvents\(refs, eventId\);/);
  assert.match(page, /if \(inStudio && borrowed\.size > 0\) \{\s*const \{ data: named, error: namedError \} = await supabase\s*\.from\('events'\)\s*\.select\('event_id, display_name'\)\s*\.in\('event_id', \[\.\.\.new Set\(borrowed\.values\(\)\)\]\);/, 'the Studio reads names on every open, or never');
  assert.match(page, /for \(const \[ref, from\] of borrowed\) photoFrom\[ref\] = eventNames\.get\(from\) \?\? '';/, 'a name that could not be read is guessed');
  assert.match(page, /mediaUrls,\s*photoFrom,\s*action,/);
  assert.match(read(`${STORY}/_components/love-story-book.tsx`), /mediaUrls=\{p\.mediaUrls\}\s*photoFrom=\{p\.photoFrom\}/);
  // No new storage: no migration, no column, no key on the moment.
  assert.doesNotMatch(read('lib/love-story-moments.ts'), /picked_from|from_event|source_event/);
});

test('(7) the lab has two other events — one that lends photos, one that does not — and decides a pick as the action does', () => {
  const lab = read('app/dev/details-lab/studio-lab-fixtures.tsx');
  const block = lab.slice(lab.indexOf('const LAB_OTHER_EVENTS: OtherEvent[] = ['), lab.indexOf('const LAB_OFFERED'));
  assert.equal((block.match(/eventId:/g) ?? []).length, 2);
  assert.match(block, /hosted: true,\s*photos: \[2, 3, 4, 5\]\.map\(\(n\) => \(\{ ref: `r2:\/\/setnayan-media\/events\/\$\{ENGAGEMENT\}\/our-photos\/wall-\$\{n\}\.webp`/, 'the lending event’s photos do not sit under its own folder — their source could not be read off the ref');
  assert.match(block, /hosted: false, photos: \[\] \}/);
  const id = /const ENGAGEMENT = '([^']+)';/.exec(lab)?.[1] ?? '';
  assert.equal(eventOfPhotoRef(`r2://setnayan-media/events/${id}/our-photos/wall-2.webp`), id, 'the lab’s event id is not one a ref’s source is read from');
  assert.match(lab, /if \(intent === 'offer'\) \{[\s\S]{0,120}?return \{ offer: LAB_OTHER_EVENTS \} as unknown as void;/);
  assert.match(lab, /const allowed = readMomentMedia\(fd\.getAll\('media'\)\)\.filter\(\(ref\) => LAB_OFFERED\.some\(\(ph\) => ph\.ref === ref\)\);\s*const media = readMomentMedia\(\[\.\.\.\(prior\.media \?\? \[\]\), \.\.\.allowed\]\);/);
  assert.match(lab, /photoFrom=\{LAB_PHOTO_FROM\}/);
});
