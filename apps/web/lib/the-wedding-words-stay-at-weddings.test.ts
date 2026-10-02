/**
 * THE WEDDING'S WORDS STAY AT WEDDINGS (P6a, 2026-10-01; audit
 * EVENT_TYPE_RELIGION_AUDIT_2026-09-30 §1 footnotes 8, 9, 14, 17, 18).
 *
 * The owner's rule (DECISION_LOG 2026-09-30 "THE EVENT TYPE SHAPES
 * EVERYTHING"): a birthday, a wake, a corporate event never reads a wedding's
 * words or carries a wedding's parts. This pins the four places the audit found
 * still leaking after the words engine shipped:
 *
 *  1. The Maker: "Our Love Story" on Page ▾ (a `hasStory: true` constant) and
 *     an "Empty — add your story." scene, for every type. Now read from the
 *     profile's love_story part (`resolveWeddingOnlyParts`), EXECUTED here.
 *  2. The Maker's stage blurbs ("your monogram", "wedding-day surface").
 *  3. Your Team: five sentences that said "your wedding" to every type.
 *  4. Prints + emails: "Our Wedding" on a nameless seat-plan pack, a supplier
 *     invite that said "planning their wedding", a digest that said "your
 *     wedding", and "Real Wedding Story".
 *
 * Sabotage (2026-10-01): restoring `hasStory: true` in guestBarForStage, or
 * removing the love_story case in the scene list, turns test 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { makerGuestPages } from './maker-guest-pages';
import { makerStageList, type MakerStageInput } from './maker-scene-list';
import { PUBLIC_SITE_PAGES } from './public-site-pages';
import { untitledEventName } from '../app/[slug]/_lib/event-words';
import { buildEmceeScript } from './emcee-script';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = ['hero', 'greeting', 'qr_card', 'event_details', 'schedule', 'rsvp', 'venue_map', 'our_love_story'];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
// The trigger seeds `our_love_story` for EVERY event; nobody has written one.
const BASE: Omit<MakerStageInput, 'weddingOnlyParts'> = {
  stage: 'rsvp',
  widgets,
  openBrowse: false,
  content: { schedule: true, venue_map: true, our_love_story: false },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: false,
  storyRenders: false,
};

test('1 · a type with no two people has no love-story scene and no Our Love Story page in the Maker', () => {
  const birthday = makerStageList({ ...BASE, weddingOnlyParts: { love_story: false } });
  const wedding = makerStageList({ ...BASE, weddingOnlyParts: { love_story: true } });
  const keys = (l: typeof birthday) => [...l.shown.map((t) => t.key), ...l.folded.map((f) => f.key)];
  assert.ok(keys(wedding).includes('w:our_love_story'), 'the wedding lost its story scene');
  assert.ok(!keys(birthday).includes('w:our_love_story'), 'a birthday still lists "Our love story" (shown or folded)');
  assert.ok(!keys(birthday).includes('f:story'));

  const tiles = (l: typeof birthday) => l.shown.map((t) => t.key);
  const pagesOf = (hasStory: boolean, l: typeof birthday) => makerGuestPages('rsvp', tiles(l), hasStory).map((p) => p.label);
  console.log(`  wedding: ${pagesOf(true, wedding).join(' · ')}\n  birthday: ${pagesOf(false, birthday).join(' · ')}`);
  assert.ok(pagesOf(true, wedding).includes('Our Love Story'), 'the wedding lost its Story page');
  assert.ok(!pagesOf(false, birthday).includes('Our Love Story'), 'a birthday’s Page ▾ still offers Our Love Story');

  // The flag reaches the shell from the profile, never a constant.
  assert.doesNotMatch(read('lib/maker-guest-pages.ts'), /hasStory: true/);
  assert.match(
    read('app/dashboard/[eventId]/website/editor/_components/maker-navigator-data.ts'),
    /hasStory: input\.plan\.weddingOnlyParts\?\.love_story !== false/,
  );
  assert.match(
    read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'),
    /makerGuestPages\(stage, list\.shown\.map\(\(t\) => t\.key\), navigator\.hasStory\)/,
  );
  // …and the guest's own bar agrees (both site-body paths).
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /story: weddingOnly\.love_story && guestBodyRenders/);
  assert.match(body, /story:\s*weddingOnly\.love_story &&\s*bodyRenders/);
});

test('2 · the Maker’s stage blurbs name no monogram and no wedding day', () => {
  for (const p of PUBLIC_SITE_PAGES) {
    assert.doesNotMatch(p.blurb, /monogram|wedding/i, `${p.key}: "${p.blurb}"`);
  }
  assert.doesNotMatch(read('app/[slug]/_components/editorial/data.ts'), /\?\? 'The Wedding';/);
});

test('3 · Your Team never says "your wedding" to every type', () => {
  const files = [
    'app/dashboard/[eventId]/vendors/_components/accordion-lock.tsx',
    'app/dashboard/[eventId]/vendors/_components/cancel-booking-button.tsx',
    'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx',
    'app/dashboard/[eventId]/vendors/categories/page.tsx',
  ];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /your wedding|Your wedding|the whole wedding|for your wedding/, `${f} still speaks only to a couple`);
  }
});

test('4 · prints and emails name a wedding only for a wedding', () => {
  const print = read('app/dashboard/[eventId]/seating/print/route.ts');
  assert.doesNotMatch(print, /\|\| 'Our Wedding';/, 'the seat-plan pack still titles every nameless event "Our Wedding"');
  assert.match(print, /event_type/);
  const email = read('lib/email.ts');
  assert.doesNotMatch(email, /planning their wedding/);
  assert.match(email, /planning their \$\{eventWord\}/);
  assert.match(read('lib/vendor-invite-actions.ts'), /eventWord: \(await eventWordsForEvent\(parent\.event_id\)/);
  assert.doesNotMatch(read('lib/daily-email-jobs.ts'), /\?\? 'your wedding'/);
  assert.doesNotMatch(read('lib/vendor-email-triggers.ts'), /Real Wedding Stor/);
});

test('5 · (follow-up) the table sign, the album and the emcee script say the event\u2019s own word', () => {
  const sign = read('app/dashboard/[eventId]/seating/print/route.ts');
  assert.doesNotMatch(sign, /Scan to visit our wedding/, 'the table sign says "our wedding" to every type');
  // The line moved to ONE home (`seatingSignLine`, lib/print-seating-pack.ts) so
  // the HTML pack and the PDF pack can never say different things (P1b,
  // 2026-10-02: the PDF pack had hard-coded "Scan to visit our wedding").
  assert.match(sign, /const signSub = seatingSignLine\(eventWords\)/);
  assert.match(sign, /<p class="sign-sub">\$\{esc\(signSub\)\}<\/p>/);
  assert.match(sign, /layoutSeatingPack\(\{[^}]*signLine: signSub/);
  const pack = read('lib/print-seating-pack.ts');
  assert.doesNotMatch(pack, /Scan to visit our wedding/, 'the PDF pack\u2019s table sign says "our wedding" to every type');
  assert.match(pack, /Scan to visit our \$\{words\?\.eventWord \?\? 'event'\}/);
  assert.match(pack, /drawText\(ops, input\.signLine,/);

  assert.doesNotMatch(read('app/dashboard/[eventId]/studio/papic/magazine/route.ts'), /'The Wedding'/);
  assert.match(read('app/dashboard/[eventId]/studio/papic/magazine/route.ts'), /untitledEventName\(/);
  assert.doesNotMatch(read('lib/emcee-script.ts'), /'The Wedding'/);
  assert.match(read('app/dashboard/[eventId]/schedule/actions.ts'), /untitledName: untitledEventName\(eventWords\)/);

  // EXECUTED: a wedding is byte-identical; a birthday never says wedding; a wake says gathering.
  assert.equal(untitledEventName({ eventWord: 'wedding', occasion: 'celebration', solemn: false }), 'The Wedding');
  assert.equal(untitledEventName({ eventWord: 'birthday', occasion: 'celebration', solemn: false }), 'The Birthday');
  assert.equal(untitledEventName({ eventWord: 'wake', occasion: 'gathering', solemn: true }), 'The Gathering');
  assert.equal(untitledEventName(null), 'The Event');
  const script = (untitledName?: string) =>
    buildEmceeScript({ event: { displayName: null, untitledName, eventDate: null }, blocks: [], guests: [] });
  assert.match(script('The Birthday'), /EMCEE \/ HOST SCRIPT — The Birthday/);
  assert.doesNotMatch(script(), /Wedding/, 'a nameless script with no words still says "The Wedding"');
});
