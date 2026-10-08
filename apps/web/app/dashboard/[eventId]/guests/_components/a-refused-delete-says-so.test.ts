/**
 * a-refused-delete-says-so.test.ts — A PRESS ENDS ITS OWN PENDING STATE, AND A REFUSAL IS SAID.
 *
 * Owner/controller, 2026-10-09, driving the lab: a refused delete (the server answered with an error) left the sheet on
 * "Deleting…", the dialog open, and no red toast. Rules held here:
 *   (1) `useGuestRemoval` ends "Deleting…" on EVERY path (`finally { setRemoving(false) }`), rolls the hide back on a
 *       refusal or a thrown call, and SAYS it in the red top toast (`guestToast.error`) and in the sheet — in the press;
 *   (2) the toast is DRAWN where the delete is: the real guests page and the card page mount the one host, and so does
 *       the lab — a toast with no host is a message nobody can read;
 *   (3) the heading keeps the name the sheet opened with (it read "Delete ?" once the row had left the list);
 *   (4) the lab can NEVER reach the database from this screen's delete/undo: its stand-ins are provided through
 *       `GuestRemovalActionsContext`, and the lab file imports no server action for it. Nothing else provides the context.
 *
 * SABOTAGE (each seen RED, then restored): drop the `finally` · drop the refusal's toast · take the host out of the lab ·
 * the held name reverted to the live prop · the lab's provider removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(join(...p), 'utf8'));
const DEL = read(HERE, 'guest-delete.tsx');
const hook = DEL.slice(DEL.indexOf('export function useGuestRemoval('), DEL.indexOf('export function DeleteGuestSheet('));

test('(1) the hook ends its pending state on every path, rolls the hide back, and says the refusal', () => {
  assert.match(hook, /setRemoving\(true\);[\s\S]*?try \{[\s\S]*\} finally \{\s*setRemoving\(false\);\s*\}\s*\}/, 'the pending state is not ended in a finally');
  assert.equal((hook.match(/setRemoving\(false\)/g) ?? []).length, 1, 'the pending state is ended in more than one place — one finally owns it');
  assert.match(hook, /if \(!result\.ok\) \{\s*guestOptimistic\.clear\(mutation\);[^}]*guestToast\.error\(result\.error\);\s*return result\.error;/, 'a refusal is not rolled back and said');
  assert.match(hook, /catch \{\s*guestOptimistic\.clear\(mutation\);[^}]*guestToast\.error\(said\);\s*return said;/, 'a thrown call is not rolled back and said');
  /* The sheet shows the refusal where it was pressed, and goes back to "Delete". */
  const screen = read(HERE, 'guests-screen.tsx');
  assert.match(screen, /const refused = await remove\(ids, \(\) => \{[\s\S]{0,160}\}\);\s*setRemoveError\(refused\);/, 'the screen drops the refusal');
  assert.match(DEL, /label=\{busy \? 'Deleting…' : 'Delete'\}/);
});

test('(2) the toast host is mounted where the delete is — the real pages and the lab', () => {
  assert.match(read(HERE, '..', 'page.tsx'), /<UndoToastHost \/>/, 'the guests page has no toast host');
  assert.match(read(HERE, '..', '[guestId]', 'page.tsx'), /<UndoToastHost \/>/, 'the card page has no toast host');
  assert.match(read(APP, 'dev', 'guests-lab', 'page.tsx'), /<UndoToastHost \/>/, 'the lab draws a toast nobody can see');
});

test('(3) the heading keeps the name the sheet opened with', () => {
  assert.match(DEL, /const \[held, setHeld\] = useState<readonly string\[\]>\(names\);/);
  assert.match(DEL, /if \(open !== wasOpen\) \{\s*setWasOpen\(open\);\s*if \(open\) setHeld\(names\);\s*\}/);
  assert.match(DEL, /const words = deleteWarningText\(open \? held : names\);/, 'the heading reads the live names again');
});

test('(4) the lab\'s delete and undo are stand-ins that never reach the database', () => {
  const lab = read(APP, 'dev', 'guests-lab', 'lab-guest-actions.tsx');
  assert.match(lab, /GuestRemovalActionsContext\.Provider value=\{stand\}/);
  assert.doesNotMatch(lab, /groups-actions|bulkSoftDeleteGuestsForUndo\(|restoreDeletedGuests\(/, 'the lab stand-in calls the real action');
  assert.match(read(APP, 'dev', 'guests-lab', 'page.tsx'), /<LabGuestActions refuse=\{sp\.refuse === '1'\}>[\s\S]*<GuestsScreen/, 'the lab screen is outside the stand-ins');
  /* The real app never provides the context — the default is the shipped actions. */
  assert.match(DEL, /useContext\(GuestRemovalActionsContext\) \?\? REAL_REMOVAL_ACTIONS/);
  assert.match(DEL, /\{ bulkSoftDeleteGuestsForUndo, restoreDeletedGuests \}/);
});
