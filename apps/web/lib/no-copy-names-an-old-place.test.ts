/**
 * no-copy-names-an-old-place.test.ts — 📝 THE SWEEP AFTER THE MOVES: NO WORDS SEND A COUPLE TO A PLACE THAT LEFT.
 *
 * Owner 2026-10-28 (DECISION_LOG "EACH REORG MOVE UPDATES ITS OWN ⓘ, TOURS AND 'WHERE TO FIND IT' — ONE SWEEP AFTER THE
 * LAST MOVE"): *"Should we update them after all the move?"* → after the last move, one machine sweep of every ⓘ, tour and
 * help string for retired names. This file IS that sweep, kept: it reads every page and module the couple meets (comments
 * stripped; tests, labs and admin aside) for a name of a place that moved —
 *
 *   · "Studio › Info"            — Info split: the event's facts are Home ⚙ Event settings (2026-10-27 "INFO SPLITS …");
 *   · "Studio › Papic"           — the Papic page is gone; its card is on Home (2026-10-26);
 *   · "Studio › RSVP · Seat plan · Wedding March · Prints · Thank-You" — R1 · R4 · R8 · R3 moved them out of Studio;
 *   · "Mood Board & Dress Code"  — the tile is "Palette + Dress Code" (2026-10-28 "DRESS CODE STAYS IN STUDIO, WITH THE PALETTE");
 *   · "Booked › Schedule / Budget" — Booked is just the team; both are Home's pages (2026-11-02);
 *   · "Four places …"             — the bar has five tabs since Memories (2026-10-23).
 *
 *   · ANY Event Hub "Studio › <page>" or "Studio ▾" — STUDIO IS GONE (Build 6 Lane F, owner 2026-11-10: *"Studio
 *     technically is gone since the pages there will be inside the different scenes it covers"*): Logo, Palette + Dress
 *     Code, Love Story, Schedule, E-Gifts, Info and Look are their scenes' editors, Prints is a row of the Hub's ⚙. The
 *     Maker's part doors say "Open <page>" (`makerSceneDoorWords`). The More menu's products (Papic, Live Studio, the
 *     Event Hub Pro page) are another "Studio" and are not named here.
 *
 * Sabotage (2026-11-06, each seen red, then restored): `OUTFIT_SET_IN` back to "Mood Board & Dress Code" → red · the
 * venue-pin answer back to "Studio › Info › Venues" → red · the menu tour back to "Four places" → red.
 *
 * Run: cd apps/web && node --import tsx --test lib/no-copy-names-an-old-place.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const OLD_PLACES =
  /Studio › (?:Info|Papic|RSVP|Seat plan|Seating|Wedding March|March|Prints|Thank|Logo|Palette|Love Story|Schedule|E-Gifts|Look)|Studio ▾|Open in Studio|Mood Board & Dress Code|Booked › (?:Schedule|Budget)|Four places for your whole event/;
/** Files allowed to keep a match, each with why. */
const ALLOWED: Readonly<Record<string, string>> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, abs));
  }
  return out;
}

test('no page or module the couple meets names a place that moved', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].filter(
    (f) => !f.startsWith('app/dev/') && !f.startsWith('app/admin/') && !f.startsWith('lib/ugat/'),
  );
  assert.ok(files.length > 1000, `anti-vacuity: only ${files.length} files read`);
  const hits: string[] = [];
  for (const f of files) {
    if (f in ALLOWED) continue;
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    src.split('\n').forEach((line, i) => {
      const m = line.match(OLD_PLACES);
      if (m) hits.push(`${f}:${i + 1} — "${m[0]}"`);
    });
  }
  assert.deepEqual(hits, [], `copy still names an old place:\n${hits.join('\n')}`);
});

test('the swept words say where things live now', async () => {
  const { OUTFIT_SET_IN } = await import('./guest-outfit');
  // 🔁 UPDATED ON PURPOSE 2026-11-11 (Build 6 Lane F): Studio is gone — the Dress code scene opens Palette + Dress Code.
  assert.equal(OUTFIT_SET_IN, 'Set it in Event Hub › Dress code');
  const tours = stripComments(readFileSync(join(WEB, 'lib/tours.ts'), 'utf8'));
  assert.match(tours, /title: 'Five places for your whole event'/);
  // 🔁 UPDATED ON PURPOSE 2026-11-08 (THE ONE BUILD, v113): Home is Today, Memories before Hub; Papic is in Memories.
  assert.match(tours, /Today, Guests, Suppliers, Memories and Hub\./);
  const help = stripComments(readFileSync(join(WEB, 'lib/help.ts'), 'utf8'));
  assert.match(help, /On Suppliers, tap your place in the date and place line at the top\./);
  assert.match(help, /add credits to the pot from the Papic card in Memories/);
});
