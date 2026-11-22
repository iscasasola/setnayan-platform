/**
 * the-v4-polish-holds.test.ts — the second pass over the built Guests page against the approved drawing
 * (`prototypes/guests_redesign_2026-11-20/guests_redesign_2026-11-20_fable.html`), after a Fable design review of the
 * built screens (22 Nov 2026). One test per fix that a person would notice if it slipped back:
 *
 *   1 · The summary's words ADD UP to "N guests": a Maybe kept from before Maybe was retired is named ("· 2 maybe"),
 *       counted by the same filter its tap opens. It used to read "32 guests · 13 coming · 4 can't come · 13 no reply".
 *   2 · March captions each walker with their role (§ 7: "Groom", "Maid of honor", "Best man") — never what the heading
 *       already says — and only in Guests: the printed march (`marchSections`) is untouched.
 *   3 · March (Guests): one frame for every name — no gold border on the groom alone; headings bold in the accent word.
 *   4 · The guest card: no row that holds nothing but "✓ Saved" (it moves to the About line); a FAILED read wears the
 *       warn colour; the group labels and chevrons are grey (house standard: gold never on small text).
 *   5 · The List: the page's title group costs no gap on a phone (it held only an sr-only h1, yet pushed the summary
 *       24 px down under the pinned row).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { rosterStats } from '@/lib/guest-roster-view';
import { marchCaption } from '@/lib/march-sections';
import type { GuestRow } from '@/lib/guests';

const WEB = process.cwd();
const HERE = join(WEB, 'app', 'dashboard', '[eventId]', 'guests', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const raw = (p: string) => readFileSync(p, 'utf8');

const g = (rsvp: GuestRow['rsvp_status'], extra: Partial<GuestRow> = {}) =>
  ({ guest_id: `g-${Math.random()}`, role: 'guest', rsvp_status: rsvp, entry_source: null, passed_away: false, invitation_sent_at: '2026-11-01', ...extra }) as unknown as GuestRow;

test('1 · the summary words add up to the total — a kept Maybe is named, not lost', () => {
  const roster = [
    g('attending', { role: 'bride' }),
    g('attending', { role: 'groom' }),
    g('attending'),
    g('declined'),
    g('pending'),
    g('maybe'),
    g('maybe'),
  ];
  const s = rosterStats(roster);
  assert.equal(s.maybe, 2);
  assert.equal(s.yes + s.no + s.none + s.maybe, s.total, 'the summary’s words no longer add up to "N guests"');
  const SCREEN = read(join(HERE, 'guests-screen.tsx'));
  assert.match(SCREEN, /\{stats\.maybe > 0 \? \(\s*<>\s*<span aria-hidden> · <\/span>\s*\{wordDoor\('maybe', stats\.maybe, 'gs-maybe'/, 'the Maybe word is gone from the summary');
  assert.match(read(join(WEB, 'lib', 'guests-filter.ts')), /'toinvite', 'maybe'\]/, 'a Maybe tap cannot survive a reload (?show=maybe)');
});

test('2 · March captions: everyone’s role, never the heading twice, never on the print', () => {
  assert.equal(marchCaption({ role: 'groom', tag: 'Groom' }, 'The Groom & his parents'), 'Groom');
  assert.equal(marchCaption({ role: 'maid_of_honor' }, 'Maid of Honor & Best Man'), 'Maid of honor');
  assert.equal(marchCaption({ role: 'best_man' }, 'Maid of Honor & Best Man'), 'Best man');
  assert.equal(marchCaption({ role: 'principal_sponsor_ninong' }, 'Principal Sponsors'), null);
  assert.equal(marchCaption({ role: 'groomsman' }, 'Groomsmen'), null);
  assert.equal(marchCaption({ role: 'bride_immediate_family' }, 'Immediate Family'), null);
  assert.equal(marchCaption({ role: 'guest' }, 'Guests'), null);
  // The couple's own word is kept as they typed it.
  assert.equal(marchCaption({ role: 'maid_of_honor' }, 'Maid of Honor & Best Man', { maid_of_honor: { one: 'Matron of Honor' } } as never), 'Matron of Honor');
  const MARCH = read(join(WEB, 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'));
  assert.match(MARCH, /const caption = guests \? marchCaption\(p, sec\.label, roleNames\) : \(p\.tag \?\? null\);/, 'the Maker’s march no longer keeps its own tag-only caption');
  // The print's sections keep their one role line: the couple's tag.
  assert.match(read(join(WEB, 'lib', 'march-sections.ts')), /tag: p\.role === 'groom' \|\| p\.role === 'bride' \? guestRoleLabel\(p\.role, names\) : null,/);
});

test('3 · March (Guests): one frame for every name; headings bold, in the accent word', () => {
  const MARCH = read(join(WEB, 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'));
  assert.match(MARCH, /guests\s*\?\s*'border-ink\/10 bg-surface'\s*:\s*p\.tag/, 'the groom wears his own frame again in Guests');
  assert.match(MARCH, /: guests\s*\?\s*'text-mulberry'\s*:\s*'text-ink\/70'/, 'March’s headings are grey again in Guests');
  assert.doesNotMatch(MARCH, /underline decoration-ink\/25 underline-offset-4/, '"not walking" is underlined like a web link again');
});

test('4 · the guest card: no Saved-only row, a failed read in the warn colour, grey labels and chevrons', () => {
  const BODY = read(join(HERE, 'guest-card-body.tsx'));
  assert.match(BODY, /const identityShown = !headerShown \|\| isCouple \|\| \(seats > 0 && !isCouple\) \|\| Boolean\(standingInFor\);/);
  assert.match(BODY, /\{identityShown \? null : <span id=\{`\$\{formId\}-saved`\}/, '"✓ Saved" has no home when the identity row is not drawn');
  assert.equal((BODY.match(/id=\{`\$\{formId\}-saved`\}/g) ?? []).length, 2, 'the save slot is drawn in a third place');
  assert.match(BODY, /<K\.Fold summary="Seat" handle="Seat Plan" value=\{seatSummary\} unread=\{seatUnread === true\}>/);
  assert.match(read(join(HERE, 'guest-card-rows.tsx')), /data-card-row-unread=\{unread \? '' : undefined\}/);
  const CSS = raw(join(HERE, 'guest-card.css'));
  assert.match(CSS, /\[data-card-row-unread\][^{]*\{\s*color: rgb\(var\(--color-warn\)\);/, 'a failed read looks like a value again');
  assert.match(CSS, /\[data-card-group\] \{ color: color-mix\(in srgb, var\(--sn-ink-900\) 55%, transparent\); \}/, 'the card’s group labels are gold again');
  assert.match(CSS, /\[data-card-row\] \[data-fold-chevron\] \{ color:/, 'the card’s chevrons are the accent again');
});

test('5 · the List: the title group costs no gap under the pinned row', () => {
  for (const f of [
    join(WEB, 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'),
    join(HERE, 'guests-last-copy.tsx'),
    join(WEB, 'app', 'dev', 'guests-lab', 'page.lab.tsx'),
  ]) {
    const src = read(f);
    assert.match(src, /<div className="contents" data-guests-title-group="">/, `${f}: the title group is a flex item again (a 24 px band)`);
  }
});
