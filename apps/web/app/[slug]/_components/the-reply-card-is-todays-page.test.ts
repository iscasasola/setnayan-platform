/**
 * 🧾 NOTHING STORED = TODAY'S PAGE, BYTE FOR BYTE — the reply card.
 *
 * The Maker's RSVP stage lets a couple add a line to the reply card, put its lines in their own order and group
 * them (owner's ruling 2026-10-09, `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` §3). For that the
 * card is drawn from a LIST of its lines — real guest-page work. The condition it is done under: an event that
 * stored none of it serves the HTML it served before, to the byte.
 *
 * HOW THAT IS HELD. `the-reply-card-is-todays-page.golden.json` is the card AS IT STOOD BEFORE the work —
 * RECORDED from `RsvpWidget` at `origin/main` 64746f064, in a commit that changes NO page file (so the record can be
 * checked against that commit by anyone: the widget's own hash at recording is in the file). Every case is the
 * sha-256 and the length of the whole card's HTML; two are kept in full, so a person can read what "today" is.
 * This test renders the same cases from the widget as it is NOW and must get the same bytes.
 *
 * The cases: every style (the reply card · the question · the ticket) × celebratory / solemn × the Event Hub's sheet
 * / the invitation's Reply door × one scrolling page / one question at a time × a guest / the Maker's sample — and
 * the arms that change what the card holds: each stored answer, a closed guest list, the couple's own words, a
 * question switched off, the key gate's "only what is missing", a flash.
 *
 * TO RECORD AGAIN (only when the card is MEANT to change for everybody — say so in the commit):
 *   RECORD_REPLY_CARD=1 ../../node_modules/.bin/tsx --test "app/[[]slug[]]/_components/the-reply-card-is-todays-page.test.ts"
 *
 * 🪤 Same harness as the neighbouring render tests (`every-scene-style-draws.test.ts`): `globalThis.React` before
 * the DYNAMIC import, `server-only` stubbed so the real server-action import chain loads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderReplyCard, replyCardCases } from '@/lib/reply-card.fixture';

const GOLDEN = join(__dirname, 'the-reply-card-is-todays-page.golden.json');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** The cases kept in full in the record — small enough to read, and the two the work touches most. */
const IN_FULL = ['reply-card · celebratory · the Reply door · one page · a guest', 'reply-card · celebratory · the Reply door · one at a time · the Maker’s sample'];
/** Only the reply's own fieldset of a card — what a person reads in the record. */
const fieldsetOf = (html: string) => /<fieldset data-rsvp-step="true" class="space-y-2">[\s\S]*?<\/fieldset>/.exec(html)?.[0] ?? '';

type Golden = { _about: string; widgetSha256: string; cases: Record<string, { sha256: string; bytes: number }>; inFull: Record<string, string> };

test('the reply card serves the bytes it served before the lines became a list', async () => {
  const cases = replyCardCases();
  assert.equal(new Set(cases.map(([n]) => n)).size, cases.length, 'two cases share a name');
  const now: Golden['cases'] = {};
  const html: Record<string, string> = {};
  for (const [name, props] of cases) {
    const out = await renderReplyCard(props);
    html[name] = out;
    now[name] = { sha256: sha(out), bytes: Buffer.byteLength(out) };
  }
  if (process.env.RECORD_REPLY_CARD === '1') {
    const widget = readFileSync(join(__dirname, 'rsvp-widget.tsx'), 'utf8');
    const record: Golden = {
      _about:
        'RECORDED AGAIN 2026-10-13 (release batch 3 joining main: #6488 guest-leftovers-2 — the Terms line one shared piece and faint ink /45–/60 → /70, meant for every guest — together with main’s rd/reply-steps-one-look below; both sides had re-recorded, the join is recorded once). Before that 2026-10-13 (rd/reply-steps-one-look: the tagging question’s answers wear the card’s own answer — the style’s one class, the Look › Buttons hook and, on the reply card, the couple’s Yes / No look — meant for every guest asked it; only the three “the tagging question asked” cases move). Before that 2026-10-12 (rd/release-leftovers: the terms line’s two links pressable at 44px, its “Required” readable at 4.5:1 — meant for every guest). First recorded 2026-10-10 from RsvpWidget AS IT STOOD at origin/main 64746f064, BEFORE the reply card’s lines were drawn from a list (the RSVP stage’s ＋, drag and Group). Each case is the sha-256 and the byte length of the whole card’s HTML (react-dom/server renderToStaticMarkup); `inFull` keeps the reply’s own fieldset of two cases so a person can read it. `widgetSha256` is rsvp-widget.tsx at recording — compare with `git show 64746f064:"apps/web/app/[slug]/_components/rsvp-widget.tsx" | shasum -a 256`. Held by the-reply-card-is-todays-page.test.ts. Record again ONLY when the card is meant to change for every guest.',
      widgetSha256: sha(widget),
      cases: now,
      inFull: Object.fromEntries(IN_FULL.map((n) => [n, fieldsetOf(html[n]!)])),
    };
    writeFileSync(GOLDEN, `${JSON.stringify(record, null, 1)}\n`);
    console.log(`# recorded ${cases.length} cases`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Golden;
  assert.deepEqual(Object.keys(now), Object.keys(golden.cases), 'the cases are not the record’s cases');
  const off: string[] = [];
  for (const [name] of cases) {
    if (now[name]!.sha256 === golden.cases[name]!.sha256) continue;
    off.push(`${name} (${golden.cases[name]!.bytes} → ${now[name]!.bytes} bytes)`);
  }
  if (off.length > 0) {
    const dir = join(tmpdir(), 'reply-card-now');
    mkdirSync(dir, { recursive: true });
    for (const name of off) writeFileSync(join(dir, `${sha(name).slice(0, 12)}.html`), html[name.replace(/ \(\d+ → \d+ bytes\)$/, '')] ?? '');
    assert.fail(`the reply card no longer serves what it served (${off.length} of ${cases.length} cases; what it serves now is in ${dir}):\n  ${off.join('\n  ')}`);
  }
  for (const name of IN_FULL) assert.equal(fieldsetOf(html[name]!), golden.inFull[name], `${name}: the fieldset kept in full`);
  /* The record is of a card that HAS the two answers — a record of an empty string would hold nothing. */
  for (const name of IN_FULL) {
    assert.match(golden.inFull[name]!, /name="rsvp_status" value="attending"/);
    assert.match(golden.inFull[name]!, /name="rsvp_status" value="declined"/);
    assert.match(golden.inFull[name]!, /<legend class="mb-3"><span data-rsvp-line="eyebrow"/);
  }
});
