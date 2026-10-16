/**
 * ↺ EVERY HELD SAVE CAN BE UNDONE AT ONCE — OR SAYS WHY NOT (G6, plan `UNDO_PLAN_2026-10-13.md`).
 *
 * A held save (`makerSave(…, { held: true })`, `makerRedrawSave`) owes no Maker render — so its ↺ owes none either,
 * IF the save left its inverse in the ↺ journal (`undo:`, `lib/maker-drawn-undo.ts`). One that did not leaves a
 * barrier, and its ↺ takes the slow path: a whole-Maker render and a new canvas page, 6–10 s at production speed —
 * the very wait the owner ruled out ("a press answers at once"). So every held save in the app either hands its
 * inverse or is listed in `UNDO_NOT_DRAWN` with the reason — phase 2's work list, never a silent gap.
 *   · a held save with neither → red (add `undo:`, or list it with its reason);
 *   · a listed handler that no longer holds a save without `undo` → red (take it off the list);
 *   · a listed file that does not exist → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const WEB = path.resolve(__dirname, '..');

/** `file › handler` (the nearest named function around the save) → why its ↺ is the slow path for now. */
const PHASE_2 = 'phase 2 (UNDO_PLAN_2026-10-13 § 6 step 12): its ↺ takes the slow path until it hands `undo:`';
export const UNDO_NOT_DRAWN: Record<string, string> = {
  /* — not draft steps at all: live rows, which ↺ never takes back (the barrier is right) — */
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx › addWish': 'a LIVE wish row, not a draft step — ↺ does not take it back',
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx › keepWish': 'a LIVE wish row, not a draft step',
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx › gotWish': 'a LIVE wish row, not a draft step',
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx › removeWish': 'a LIVE wish row, not a draft step',
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx › finish': 'a LIVE wish order, not a draft step',
  'app/dashboard/[eventId]/launch/_components/studio-wish-list.tsx › changeGift': 'a LIVE gift record, not a draft step',
  /* — the bridge cannot draw these: the page is redrawn in place after the save (tier B) — */
  'app/dashboard/[eventId]/launch/_components/studio-info.tsx › studioDraftKeep': `Studio › Info / RSVP keep (redrawn in place) — ${PHASE_2}`,
  'app/dashboard/[eventId]/launch/_components/studio-info.tsx › studioPhotosHeadingKeep': `Studio › Info Photos heading keep (redrawn in place) — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/editor/_components/fonts-look-rows.tsx › commit': `fonts (redrawn in place) — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/editor/_components/use-scene-canvas.ts › useHeldEventsSave': `a scene's look held on the events row (redrawn in place) — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx › pickLook': `the main background's look — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx › save': `a scene background (Colour · Plain · a photo) — ${PHASE_2}`,
  /* 🖼 The Cover Scene's background (2026-10-15) — the same save shape as a scene's, redrawn in place. */
  'app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx › put': `the Cover Scene's background (the hero row's canvas.ground) — ${PHASE_2}`,
  /* — drawn by their own message, an inverse not yet handed — */
  'app/dashboard/[eventId]/website/editor/_components/music-button-row.tsx › commit': `the music button — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/editor/_components/buttons-look-row.tsx › commit': `Look › Buttons — ${PHASE_2}`,
  'app/dashboard/[eventId]/launch/_components/special-message-field.tsx › type': `the special message — ${PHASE_2}`,
  'app/dashboard/[eventId]/_components/guest-setup/reply-by.tsx › pick': `reply-by — ${PHASE_2}`,
  'app/dashboard/[eventId]/pabuya/_components/pabuya-message-editor.tsx › draft': `pabuya thanks — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/our-story/_components/love-story-live.tsx › editLoveStory': `love story / schedule moment — ${PHASE_2}`,
  'app/dashboard/[eventId]/website/editor/_components/details-bound-field.tsx › answer': `a Details-bound field typed on the canvas — ${PHASE_2}`,
  /* — the eye where the Maker's own door is not (the editor outside the Maker): a hide drawn, its ↺ the slow path — */
  'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx › gateWrite': `the event-wide eye / Auto · Hidden (outside the stage eye) — ${PHASE_2}`,
  /* (the names typed in place — \`part-words.ts\` / \`type-in-place.tsx\` — pass \`undo\` only for the fields with a Maker
     copy; the names' write passes none at run time, so its ↺ meets a barrier: the slow path, correct.) */
  /* — the work area's own: a step it DRAWS is noted at its press (`noteSceneStep`, `undo: 'noted'`) — */
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}
const parse = (full: string) => ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, full.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
function walk(node: ts.Node, fn: (n: ts.Node) => void) {
  fn(node);
  ts.forEachChild(node, (c) => walk(c, fn));
}
const calleeName = (c: ts.CallExpression) => (ts.isIdentifier(c.expression) ? c.expression.text : ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : null);
function handlerOf(node: ts.Node): string {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (!(ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p))) continue;
    const parent = p.parent;
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (parent && ts.isJsxExpression(parent)) return '<jsx handler>';
    if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
    if (parent && ts.isCallExpression(parent)) {
      const c = calleeName(parent);
      if (c === 'useEffect' || c === 'useLayoutEffect') return '<effect>';
      if (c === 'useCallback' && parent.parent && ts.isVariableDeclaration(parent.parent) && ts.isIdentifier(parent.parent.name)) return parent.parent.name.text;
    }
  }
  return '<top>';
}
/** `{ held: … }` that is not literally `false`. */
function holds(opts: ts.Expression | undefined): boolean {
  if (!opts || !ts.isObjectLiteralExpression(opts)) return false;
  return opts.properties.some((p) => {
    const name = p.name && ts.isIdentifier(p.name) ? p.name.text : null;
    if (name !== 'held') return false;
    if (ts.isShorthandPropertyAssignment(p)) return true;
    return ts.isPropertyAssignment(p) && p.initializer.kind !== ts.SyntaxKind.FalseKeyword;
  });
}
/** The options name an inverse (`undo:` — a value, `'noted'`, or spread in). */
const handsUndo = (opts: ts.Expression | undefined, sf: ts.SourceFile) => Boolean(opts && /\bundo\b/.test(opts.getText(sf)));

type Hit = { key: string; line: number };
function scan(): { blind: Hit[]; listed: Set<string>; held: number; drawn: number } {
  const blind: Hit[] = [];
  const listed = new Set<string>();
  let held = 0;
  let drawn = 0;
  for (const full of [...sourceFiles(path.join(WEB, 'app')), ...sourceFiles(path.join(WEB, 'lib'))]) {
    if (full.endsWith(path.join('lib', 'maker-refresh.ts'))) continue; // the door itself
    const text = fs.readFileSync(full, 'utf8');
    if (!/makerSave\(|makerRedrawSave\(/.test(text)) continue;
    const sf = parse(full);
    walk(sf, (n) => {
      if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) return;
      const name = n.expression.text;
      if (name !== 'makerSave' && name !== 'makerRedrawSave') return;
      const opts = n.arguments[2];
      const isHeld = name === 'makerRedrawSave' || holds(opts);
      if (!isHeld) return;
      held += 1;
      /* (2026-10-15, rd/maker-fast-edits) `makerRedrawSave` carries an inverse too (`{ undo }`, `lib/maker-scene-look.ts`). */
      if (handsUndo(opts, sf) && (name === 'makerSave' || (opts !== undefined && ts.isObjectLiteralExpression(opts)))) {
        drawn += 1;
        return;
      }
      const key = `${path.relative(WEB, full)} › ${handlerOf(n)}`;
      if (key in UNDO_NOT_DRAWN) listed.add(key);
      else blind.push({ key, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    });
  }
  return { blind, listed, held, drawn };
}

test('G6 every held save hands its ↺ inverse (`undo:`) — or is listed with the reason its ↺ is slow', () => {
  const { blind, held, drawn } = scan();
  console.log(`[every-held-save-can-be-undone] held saves: ${held} · drawn back at once: ${drawn} · listed: ${held - drawn - blind.length}`);
  assert.ok(held >= 25, `only ${held} held saves found — the scan is not reading the Maker`);
  assert.ok(drawn >= 8, `only ${drawn} held saves hand an inverse — phase 1 drew at least 8 kinds`);
  assert.deepEqual(
    blind,
    [],
    `These held saves leave no inverse in the ↺ journal, so their Undo waits for a whole Maker render. Hand \`undo:\` ` +
      `(\`lib/maker-drawn-undo.ts\`; a canvas pick: \`lib/canvas-pick-undo.ts\`) or list the handler in UNDO_NOT_DRAWN with why:\n` +
      blind.map((b) => `  ${b.key} (line ${b.line})`).join('\n'),
  );
});

test('G6 the list is true: every entry still holds a save with no inverse, and every file exists', () => {
  const { listed } = scan();
  for (const key of Object.keys(UNDO_NOT_DRAWN)) assert.ok(fs.existsSync(path.join(WEB, key.split(' › ')[0]!)), `a stale entry (no such file): ${key}`);
  assert.deepEqual(Object.keys(UNDO_NOT_DRAWN).filter((k) => !listed.has(k)), [], 'UNDO_NOT_DRAWN lists handlers that now hand `undo:` (or hold no save) — take them off');
});

test('G6 the phase-1 kinds hand their inverse (each named, so dropping one is red even if listed)', () => {
  const must: Array<[string, RegExp]> = [
    ['app/dashboard/[eventId]/launch/_components/stage-panel/part-look.ts', /undo: canvasPickUndo\(/],
    ['app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx', /undo: canvasPickUndo\(/],
    ['app/dashboard/[eventId]/website/editor/_components/type-in-place.tsx', /canvasPickUndo\('hero', before, next, heroCanvas/],
    ['app/dashboard/[eventId]/launch/_components/stage-panel/part-words.ts', /undo: partWordsUndo\(/],
    ['app/dashboard/[eventId]/launch/_components/maker-rsvp-ask.tsx', /r\.ok === true, undo \}/],
    ['app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx', /noteSceneStep\(\{ kind: 'move'/],
    ['app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx', /noteSceneStep\(\{ kind: 'remove'/],
    ['app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx', /noteSceneStep\(added, addSaved\)/],
    /* 🎨 (2026-10-15) a style pick and every redraw pick: the BEFORE picture laid back (`lib/maker-scene-look.ts`) —
       the 8.7 s slow ↺ measured on the production build. `styleTap` is the one door both style rows use. */
    ['lib/maker-scene-look.ts', /undo: scenePictureUndo\(at\.canvasKey, before, at\.canvas, at\.onUndone\)/],
    ['app/dashboard/[eventId]/website/editor/_components/fixed-scene-style-row.tsx', /styleTap\(\{[\s\S]*?save: makerRedrawSave,/],
    ['app/dashboard/[eventId]/website/editor/_components/use-scene-canvas.ts', /await styleTap\(\{[^}]*save: makerRedrawSave \}\)/],
    ['app/dashboard/[eventId]/website/editor/_components/use-scene-canvas.ts', /makerRedrawSave\(send, refresh, \{ undo: scenePictureUndo\(/],
    /* 👗🎨 the Mood Board's attire and palette picks (held since 2026-10-15) */
    ['app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx', /\{ undo: boardUndo\(\(undone\) => put\(undone \? was : wrote\)\) \}/],
    ['app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx', /\{ undo: boardUndo\(\(undone\) => put\(undone \? before : \(next as typeof dress\)\)\) \}/],
  ];
  for (const [f, re] of must) assert.match(fs.readFileSync(path.join(WEB, f), 'utf8'), re, `${f}: its ↺ is no longer drawn at once`);
  for (const k of Object.keys(UNDO_NOT_DRAWN)) assert.ok(!/part-look\.ts|element-sheet\.tsx|maker-rsvp-ask\.tsx/.test(k), `a phase-1 kind was listed as slow: ${k}`);
});
