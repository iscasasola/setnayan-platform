/**
 * CI GUARDRAIL — the face-mode gate at the client capture call sites.
 *
 * One-Pool spec §3.4: `embedFaces()` (and its clip sibling `embedClipFaces()`)
 * compute a 128-d biometric descriptor of EVERY face in frame and transmit it to
 * the server. That must NEVER run for a Mode-B event (generic/shared QR,
 * opt-outs, minors, bystanders). The runtime defense is a `faceMode === 'mode_a'`
 * gate placed immediately before every embed call in the three capture
 * components. This test FAILS THE BUILD if any of those files calls the embedder
 * without a Mode-A gate lexically guarding it — so a future edit (or a new
 * capture surface copied from these) can't silently re-open the leak.
 *
 * Heuristic honesty: this is a source scan, not a type/flow analysis. It proves
 * that (a) each file wires a `faceMode` prop, (b) a Mode-A gate exists, and (c)
 * every `embed(Faces|ClipFaces)(` CALL has a Mode-A gate within GUARD_WINDOW
 * characters immediately before it. It cannot prove the gate dominates the call
 * on every control-flow path — but a completely ungated call, or an embed call
 * added before any gate, goes RED here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const WEB = path.join(HERE, '..'); // apps/web

// The three client capture call sites the spec names (§3.4). If a fourth capture
// surface is added, add it here — that is the point of the guardrail.
const CAPTURE_FILES = [
  'app/papic/seat/[token]/_components/papic-seat-capture.tsx',
  'app/papic/guest/_components/papic-guest-capture.tsx',
  'app/dashboard/[eventId]/studio/patiktok/_components/booth-capture.tsx',
];

// A Mode-A gate in either direction: `faceMode === 'mode_a'` (proceed-block) or
// `faceMode !== 'mode_a'` (early-return backstop).
const GATE_RE = /faceMode\s*(?:===|!==)\s*['"]mode_a['"]/g;
// A CALL to the embedder (not the destructuring import `const { embedFaces } =`).
const EMBED_CALL_RE = /\bembed(?:Faces|ClipFaces)\s*\(/g;

// Max distance from a Mode-A gate down to the embed call it guards. Sized to the
// widest real gap (seat's autoTagFromBlob: guard → decode → embedFaces).
const GUARD_WINDOW = 800;

function allIndices(src: string, re: RegExp): number[] {
  const out: number[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m.index);
  return out;
}

function lineAt(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

for (const rel of CAPTURE_FILES) {
  test(`face-mode gate present in ${rel}`, () => {
    const abs = path.join(WEB, rel);
    assert.ok(fs.existsSync(abs), `capture file missing (moved?): ${rel} — update CAPTURE_FILES.`);
    const src = fs.readFileSync(abs, 'utf8');

    // (a) the file must wire a faceMode prop.
    assert.ok(src.includes('faceMode'), `${rel}: no \`faceMode\` prop — the mode gate is not wired.`);

    // (b) a Mode-A gate must exist.
    const gates = allIndices(src, GATE_RE);
    assert.ok(gates.length > 0, `${rel}: no \`faceMode === 'mode_a'\` gate found.`);

    // (c) every embed CALL must be guarded by a Mode-A gate within GUARD_WINDOW
    //     chars immediately above it.
    const calls = allIndices(src, EMBED_CALL_RE);
    assert.ok(
      calls.length > 0,
      `${rel}: no embed(Faces|ClipFaces) call found — if capture no longer embeds, remove this file from CAPTURE_FILES.`,
    );
    for (const callIdx of calls) {
      const gateBefore = gates.filter((g) => g < callIdx).pop();
      assert.ok(
        gateBefore !== undefined,
        `${rel}:${lineAt(src, callIdx)} — embedder called with NO Mode-A gate before it. In Mode B no face descriptor may be computed or transmitted.`,
      );
      assert.ok(
        callIdx - (gateBefore as number) <= GUARD_WINDOW,
        `${rel}:${lineAt(src, callIdx)} — nearest Mode-A gate is ${callIdx - (gateBefore as number)} chars away (> ${GUARD_WINDOW}); the embed call is not locally guarded.`,
      );
    }
  });
}

// Belt-and-suspenders: the server matcher must consult the DB privacy control
// AND the resolved mode. Guards the "admin control is a paper record" regression
// (spec §3.4 step 3) at both server matcher entry points.
for (const rel of [
  'lib/face-match.ts',
  'app/dashboard/[eventId]/studio/patiktok/actions.ts',
]) {
  test(`server matcher enforces the biometric gates in ${rel}`, () => {
    const src = fs.readFileSync(path.join(WEB, rel), 'utf8');
    assert.ok(
      src.includes("isDataPrivacyControlActive('face_enrollment')"),
      `${rel}: matcher does not check the 'face_enrollment' data-privacy control.`,
    );
    assert.ok(
      src.includes('resolvePapicFaceMode'),
      `${rel}: matcher does not resolve/enforce papic_face_mode.`,
    );
  });
}
