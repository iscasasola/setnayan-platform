/**
 * consent-is-affirmative.test.ts — no door may consent on the couple's behalf.
 *
 * WHAT WENT WRONG. `users.public_summary_consent_at` is what publishes a real
 * wedding on setnayan.com/realstories, 30 days after the day itself. The owner
 * ruled on how it is collected (commit 7f933ece1, 2026-07-12): the box "starts
 * UNTICKED — affirmative consent, not pre-selected". `/signup` has honoured
 * that since it was built, as a checkbox beside a sentence explaining what it
 * does.
 *
 * The wedding onboarding door did not. It posted
 * `<input type="hidden" name="public_summary_consent" value="yes" />` — no
 * checkbox, no sentence, no way to decline and nothing on screen to decline.
 * Every couple who created their account there was opted in, and nobody could
 * have known. Nothing failed: FormData carries whatever is posted, and a
 * hidden field typechecks, lints and renders exactly like a correct one.
 *
 * 🔑 ONE DOOR MISSED AN EXISTING RULING, WHICH IS WHY THIS GUARD IS APP-WIDE
 * AND NOT A LINE ABOUT ONE FILE. The rule was already written down and already
 * obeyed in one place; what was missing was anything that noticed the second
 * place. The next door to collect this field will be the third.
 *
 * 🛡 COMMENTS ARE STRIPPED BEFORE MATCHING. Every file corrected here carries a
 * note naming the string it removed, so a raw-source scan finds the defect it
 * just fixed and reports it forever. Stripped source is the true count.
 *
 * ⚠ NOT A BAN ON COLLECTING CONSENT — it is a ban on collecting it silently.
 * A new door may absolutely ask; it must ask with a checkbox the person has to
 * tick themselves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');

const FIELD = 'public_summary_consent';

/** Every .tsx under app/, minus tests. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/** Strip block + line comments, so a fix's own explanation is not the finding. */
function stripped(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The files that still render this field at all, after stripping comments. */
function collectors(): { file: string; code: string }[] {
  return sources(APP_ROOT)
    .map((file) => ({ file, code: stripped(file) }))
    .filter(({ code }) => code.includes(`name="${FIELD}"`));
}

test('the showcase-consent field is only ever collected, never pre-set', () => {
  const found = collectors();

  // A guard that sweeps nothing passes. If the field is renamed, this fails
  // loudly here rather than going quietly green across the whole app.
  assert.ok(
    found.length > 0,
    `No file renders name="${FIELD}". Either the field was renamed — in which ` +
      'case rename it here too — or the last place that asks the couple for ' +
      'showcase consent was deleted. Both need a person, not a green tick.',
  );

  const offenders: string[] = [];
  for (const { file, code } of found) {
    // The whole tag around each occurrence of the field.
    for (const m of code.matchAll(/<input\b[^>]*\bname="public_summary_consent"[^>]*>/g)) {
      const tag = m[0];
      const where = relative(APP_ROOT, file);
      if (!/\btype="checkbox"/.test(tag)) {
        offenders.push(
          `${where}: posts ${FIELD} from something that is not a checkbox — ` +
            `a person cannot decline it. Tag: ${tag.trim()}`,
        );
      }
      if (/\b(defaultChecked|checked)\b/.test(tag)) {
        offenders.push(
          `${where}: pre-ticks ${FIELD}. Owner ruling 2026-07-12 — it starts ` +
            'UNTICKED; affirmative consent, not pre-selected.',
        );
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'A door consents on the couple\'s behalf to publishing their wedding.\n' +
      offenders.join('\n'),
  );
});
