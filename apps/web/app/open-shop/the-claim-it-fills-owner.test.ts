/**
 * 🔘 THE OPEN-SHOP NOTES OF 10 NOV — Claim it fills Owner · uniform ActionButtons at equal widths · the per-event
 * services hide behind "Customize".
 *
 * DECISION_LOG 2026-11-10 "CLAIM DOOR AND 'EVENTS YOU SERVE': UNIFORM ACTIONBUTTONS, CLAIM IT PREFILLS OWNER, THE
 * PER-EVENT LIST HIDES BEHIND 'CUSTOMIZE'". Owner, verbatim:
 *   (1) "Button designs"
 *   (2) "In the beginning there is a part when i want to claim i am the owner, there was a button. If that is
 *       pressed, this should be owner."
 *   (3) "The more comprehensive per part can hide. Only optional if they wish to customize each event to know what
 *       service they can provide."
 * Approved: prototype `onboarding_every_step_2026-11-10` (Claim · 1 of 6, 2 of 5 · page 2, Claim · 6 of 6).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const DOOR = readFileSync(join(web, 'app/open-shop/_components/claim-door.tsx'), 'utf8');
const WIZ = readFileSync(join(web, 'app/open-shop/_components/open-shop-wizard.tsx'), 'utf8');

test('(2) pressing Accept (was Claim it, 19 Nov) fills "Your role at the shop" with Owner — never over a typed role — and says why', () => {
  assert.match(DOOR, /export const CLAIM_OWNER_ROLE = 'Owner';/);
  const invite = DOOR.slice(DOOR.indexOf('label: ACCEPT_LABEL,'), DOOR.indexOf("} else if (view === 'details')"));
  assert.ok(invite.length > 40, 'the Accept press could not be found');
  assert.match(invite, /if \(!d\.role\.trim\(\)\) set\(\{ role: CLAIM_OWNER_ROLE, roleFromClaim: true \}\);\s*next\(\);/);
  // The draft (localStorage, `claimDraftKey`) is the whole `d`, so the role rides through Google / Apple sign-in.
  assert.match(DOOR, /localStorage\.setItem\(claimDraftKey\(record\.token\), JSON\.stringify\(d\)\)/);
  // 🚪 19 Nov: the role sits in the Contact person sheet of Check your shop (`roleBox`), no longer on the account screen.
  const account = DOOR.slice(DOOR.indexOf('const roleHint ='));
  assert.match(DOOR, /if \(k === 'who'\)[\s\S]{0,300}\{roleBox\}/, 'the role is not in the Contact person sheet');
  assert.match(account, /d\.roleFromClaim && d\.role\.trim\(\) === CLAIM_OWNER_ROLE/, 'the hint shows only for the untouched Owner');
  assert.match(account, /You pressed Accept, so you run this business\./);
  assert.match(account, /onChange=\{\(e\) => set\(\{ role: e\.target\.value, roleFromClaim: false \}\)\}/, 'still editable; typing makes it theirs');
  // The same column as before — nothing new in the schema.
  assert.match(DOOR, /role: d\.role\.trim\(\),/);
});

test('(1) the claim door’s two quiet choices sit in ONE row under Accept (P1, owner 19 Nov: "the two grey pills → two quiet links")', () => {
  const row = DOOR.slice(DOOR.indexOf('data-claim-door-choices'), DOOR.indexOf('label: ACCEPT_LABEL,'));
  assert.match(DOOR, /<div ref=\{inviteRowRef\} className="flex flex-wrap items-center gap-2" data-claim-door-choices="">/);
  assert.match(row, /<ActionButton tone="neutral" quiet icon=\{LogIn\} label="I have an account" href=\{signInHref\} \/>/);
  assert.match(row, /label=\{NOT_MY_BUSINESS\}/);
  assert.doesNotMatch(row, /tone="neutral" icon=/, 'neither is a grey pill any more — both are quiet');
});

test('(1) Events you serve: the label above, then Select all · Clear as one equal-width row', () => {
  const at = WIZ.indexOf('id="open-shop-events-label"');
  const bulk = WIZ.indexOf('data-open-shop-events-bulk=""');
  assert.ok(at > 0 && bulk > at, 'the label comes first, the row under it');
  assert.match(WIZ, /<span className="grid grid-cols-2 gap-2 \[&>\.ab\]:w-full \[&>\.ab\]:justify-center" data-open-shop-events-bulk="">/);
  assert.match(WIZ, /useFitRow\(eventsBulkRef\);/);
});

test('(3) the per-event services hide behind one quiet row, and open by themselves when a service is on for no event', () => {
  const fold = WIZ.slice(WIZ.indexOf('<Fold\n                  title="Different services for some events?"'), WIZ.indexOf('</Fold>'));
  assert.ok(fold.length > 0, 'the Customize fold exists');
  assert.match(fold, /open=\{customizeOpen \|\| serviceOnNoEvent\}/, 'a refusal is never behind a closed fold');
  assert.match(fold, /summary=\{customizeOpen \|\| serviceOnNoEvent \? 'Hide' : 'Customize'\}/);
  assert.match(fold, /<ServicesAtEvents\b/, 'the shipped per-event list, inside');
  assert.match(WIZ, /const \[customizeOpen, setCustomizeOpen\] = useState\(false\);/, 'shut by default');
});
