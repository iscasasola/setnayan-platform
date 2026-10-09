/**
 * the-studio-lab-cannot-reach-the-database.test.ts — A LAB PRESS ON A STUDIO PAGE NEVER REACHES THE DATABASE (controller, 2026-10-09; the
 * pattern is `app/dev/guests-lab/the-lab-cannot-reach-the-database.test.ts`).
 *
 * The owner presses things on `/dev/maker-lab?studio=1` and `/dev/details-lab`, which draw the REAL Studio pages on fixtures. Every write
 * those pages' controls reach goes through `StudioActionsContext` (`launch/_components/studio-actions-context.tsx`), which the lab fills with
 * local stand-ins. THE CLAIM, four ways: (1) every name the context carries has a stand-in AND a refusal (none is left real); (2) the call
 * sites take their writes from the context and import no action module of their own for them; (3) nothing but the lab provides the context,
 * and both lab entries are drawn inside it; (4) the stand-ins answer the way the real ones do, `?refuse=1` refuses in the DATABASE'S words —
 * which the page turns into one plain sentence of its own. Behaviour (the rows' saved state, zero real calls) was driven in Chromium.
 *
 * Pages on it so far: E-Gifts. EVERY STUDIO PAGE CONVERTED LATER ADDS ITS WRITES to the context, to LAB_STUDIO_ACTIONS and to
 * LAB_STUDIO_REFUSALS, and its call sites to (2) — in its own commit.
 *
 * NOT stubbed (listed, not hidden): the other Studio pages' own writes (they join as they are converted: Info rides `setStudioDraftDoor`,
 * Love Story / Schedule / RSVP their own fixtures); the QR upload's `FileUpload` bytes ARE stood in (`send`) but the real uploader's
 * presign/PUT path was not exercised by the browser run (the harness replaced the whole uploader).
 *
 * SABOTAGE (each seen RED, then restored): a stand-in deleted from the lab · a refusal deleted · a call site importing its action directly
 * again · a provider put in the app · a lab entry drawn outside the provider · the QR upload without the context's `send`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { LAB_STUDIO_ACTIONS, LAB_STUDIO_REFUSALS } from './lab-studio-stand-ins';
import { isPlainSentence, plainRefusal } from '@/app/dashboard/[eventId]/guests/_components/plain-refusal';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const D = join(APP, 'dashboard', '[eventId]');
const LAUNCH = join(D, 'launch', '_components');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('(1) every write the context carries has a lab stand-in and a refusal — none is left real', () => {
  const ctx = read(join(LAUNCH, 'studio-actions-context.tsx'));
  const real = [...ctx.slice(ctx.indexOf('export const REAL_STUDIO_ACTIONS')).matchAll(/^\s{2}(\w+)(?::|,)/gm)].map((m) => m[1]!).slice(0, 5);
  assert.deepEqual([...real].sort(), ['hubDraftAction', 'qrUploadSend', 'saveEgiftMethod', 'savePabuyaMessage', 'setEgiftMethodEnabled'], 'the context’s names could not be read (or changed — add the new page’s writes here)');
  const writes = real.filter((n) => n !== 'qrUploadSend');
  assert.deepEqual(Object.keys(LAB_STUDIO_ACTIONS).sort(), [...writes].sort(), 'a lab press can reach a real action');
  assert.deepEqual(Object.keys(LAB_STUDIO_REFUSALS).sort(), [...writes].sort(), 'a write has no refusal for ?refuse=1');
  for (const f of ['lab-studio-stand-ins.ts', 'lab-studio-actions.tsx']) {
    assert.doesNotMatch(read(join(HERE, f)), /from '[^']*(?:-actions|\/actions)'|pabuya\/actions|hub-draft-actions/, `${f} imports a real action module`);
  }
  assert.match(read(join(HERE, 'lab-studio-actions.tsx')), /qrUploadSend/, 'the lab gives the QR upload no storage stand-in');
});

test('(2) the E-Gifts call sites take their writes from the context and import no action module of their own for them', () => {
  const tools = read(join(LAUNCH, 'studio-tools.tsx'));
  const gifts = tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts'));
  assert.match(gifts, /const \{ saveEgiftMethod, savePabuyaMessage, setEgiftMethodEnabled, qrUploadSend \} = useStudioActions\(\);/, 'E-Gifts no longer takes its writes from the context');
  assert.doesNotMatch(tools, /from '\.\.\/\.\.\/pabuya\/actions'/, 'studio-tools imports the E-Gifts actions again');
  assert.match(gifts, /<FileUpload[\s\S]{0,600}?send=\{qrUploadSend\}/, 'the QR upload does not take its storage from the context');
  const editor = read(join(D, 'pabuya', '_components', 'pabuya-message-editor.tsx'));
  assert.equal((editor.match(/const \{ savePabuyaMessage \} = useStudioActions\(\);/g) ?? []).length, 2, 'the thank-you editors (Studio and shipped) do not both take the write from the context');
  assert.doesNotMatch(editor.replace(/import type [^;]*;/g, ''), /from '\.\.\/actions'/, 'the thank-you editor imports the action again');
  const answers = read(join(LAUNCH, 'details-answers.tsx'));
  assert.match(answers, /const \{ hubDraftAction \} = useStudioActions\(\);/, '“Accept gifts?” no longer takes the draft door from the context');
  assert.doesNotMatch(answers, /from '\.\.\/\.\.\/website\/hub-draft-actions'/, 'the answers import the draft door again');
});

test('(3) nothing but the lab provides the context — and both lab entries are drawn inside it', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /StudioActionsProvider|StudioActionsContext\.Provider/.test(read(p))) found.push(p.slice(APP.length + 1));
    }
  };
  walk(APP);
  assert.deepEqual(found.sort(), ['dashboard/[eventId]/launch/_components/studio-actions-context.tsx', 'dev/details-lab/lab-studio-actions.tsx'], 'the app provides stand-ins');
  assert.match(read(join(HERE, 'page.tsx')), /<LabStudioActions>\s*<LookLab>[\s\S]*<\/LookLab>\s*<\/LabStudioActions>/, 'the details lab is drawn outside the stand-ins');
  assert.match(read(join(APP, 'dev', 'maker-lab', 'maker-lab-shell.tsx')), /<LabStudioActions draft=\{labDraft as never\}>\s*<MakerShell[\s\S]*<\/MakerShell>\s*<\/LabStudioActions>/, 'the Maker lab is drawn outside the stand-ins');
  /* The real default: the shipped actions, and NO storage stand-in. */
  const ctx = read(join(LAUNCH, 'studio-actions-context.tsx'));
  assert.match(ctx, /qrUploadSend: undefined,/, 'the app’s QR upload has a stand-in storage by default');
  /* …and the lab routes still 404 in production. */
  assert.match(read(join(HERE, 'page.tsx')), /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('(4) the stand-ins answer like the real ones, locally — and ?refuse=1 refuses in database words the page never prints', async () => {
  const a = LAB_STUDIO_ACTIONS;
  assert.deepEqual(await a.setEgiftMethodEnabled!(new FormData()), { ok: true });
  assert.deepEqual(await a.saveEgiftMethod!(new FormData()), { ok: true });
  assert.deepEqual(await a.savePabuyaMessage!(new FormData()), { ok: true });
  const drafted = await a.hubDraftAction!('e', new FormData());
  assert.ok(drafted.ok && drafted.intent === 'save');
  const r = LAB_STUDIO_REFUSALS;
  const refused = [
    await r.setEgiftMethodEnabled!(new FormData()),
    await r.saveEgiftMethod!(new FormData()),
    await r.savePabuyaMessage!(new FormData()),
    await r.hubDraftAction!('e', new FormData()),
  ];
  for (const res of refused) {
    assert.ok(!res.ok && 'error' in res && typeof res.error === 'string', 'a refusal does not refuse');
    const words = (res as { error: string }).error;
    assert.ok(!isPlainSentence(words), `the lab’s refusal reads as a sentence, so it can prove nothing: ${words}`);
    assert.equal(plainRefusal(words, 'Please try again.'), 'Please try again.', 'the page would print the database’s words');
  }
});
