/**
 * CI GUARDRAIL — the face-mode gate at the client capture call sites.
 *
 * One-Pool spec §3.4: the on-device embedders (`embedFaces()`, its clip sibling
 * `embedClipFaces()`, and the single-face `embedSingleFace()` the RSVP/day-of
 * selfie uses) compute a 128-d biometric descriptor and transmit it to the
 * server. That must NEVER run for a Mode-B event (generic/shared QR, opt-outs,
 * minors, bystanders). The runtime defense is a `faceMode === 'mode_a'` gate
 * placed immediately before every embed call in the capture components. This
 * test FAILS THE BUILD if any of those files calls an embedder without a Mode-A
 * gate lexically guarding it — so a future edit (or a new capture surface copied
 * from these) can't silently re-open the leak.
 *
 * Heuristic honesty: this is a source scan, not a type/flow analysis. It proves
 * that (a) each file wires a `faceMode` prop, (b) a Mode-A gate exists, and (c)
 * every embedder CALL (`embed…Face…(`) has a Mode-A gate within GUARD_WINDOW
 * characters immediately before it. It cannot prove the gate dominates the call
 * on every control-flow path — but a completely ungated call, or an embed call
 * added before any gate, goes RED here. A separate discovery test below scans
 * ALL of app/ so no embedder call site can hide from this guardrail — every one
 * must be either a gated CAPTURE_FILE or an explicitly documented exemption.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const WEB = path.join(HERE, '..'); // apps/web

// The client capture call sites the spec names (§3.4) — every one binds a real
// event, so each MUST carry a `faceMode` prop + a Mode-A gate on its embedder
// call. If another capture surface is added, add it here — that is the point of
// the guardrail. (selfie-capture.tsx is the RSVP/day-of enroll selfie; it calls
// `embedSingleFace` and is gated on the server-resolved effective mode.)
const CAPTURE_FILES = [
  'app/papic/seat/[token]/_components/papic-seat-capture.tsx',
  'app/papic/guest/_components/papic-guest-capture.tsx',
  'app/dashboard/[eventId]/studio/patiktok/_components/booth-capture.tsx',
  'app/[slug]/_components/selfie-capture.tsx',
];

// EXPLICIT, DOCUMENTED exemptions — embedder call sites that are intentionally
// NOT event/mode-bound. The homepage Papic DEMO computes descriptors under
// per-session self-consent, relays them ONLY over an ephemeral demo Realtime
// channel, and NEVER persists them (the server records a shot COUNT and nothing
// else). It is bound to no event and writes no guest_face_enrollments row, so
// the papic_face_mode gate does not apply. Listed here so the discovery test is
// not blind to it — if this file EVER starts persisting a descriptor or binds an
// event, delete this entry and move it to CAPTURE_FILES (which forces a gate).
const EMBED_EXEMPT_FILES = [
  'app/papic/demo/[token]/_components/demo-join-flow.tsx',
];

// A Mode-A gate in either direction: `faceMode === 'mode_a'` (proceed-block) or
// `faceMode !== 'mode_a'` (early-return backstop).
const GATE_RE = /faceMode\s*(?:===|!==)\s*['"]mode_a['"]/g;
// A CALL to ANY embedder — embedFaces, embedClipFaces, embedSingleFace (not the
// destructuring import `const { embedFaces } =`, which has no `(` after it).
const EMBED_CALL_RE = /\bembed\w*Face\w*\s*\(/g;

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
      `${rel}: no embed…Face…() call found — if capture no longer embeds, remove this file from CAPTURE_FILES.`,
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

// Belt-and-suspenders: the server ENROLLMENT writes must resolve the mode AND
// route every descriptor through the write guard, so a crafted POST carrying a
// vector on a mode_b / forced-mode_b (christening/debut) event can never persist
// a biometric. Guards against silently deleting that server-side enforcement.
for (const rel of [
  'app/[slug]/actions.ts', // submitRsvp
  'app/papic/face-enroll-actions.ts', // enrollGuestFace
]) {
  test(`server enrollment write nulls the vector off mode_a in ${rel}`, () => {
    const src = fs.readFileSync(path.join(WEB, rel), 'utf8');
    assert.ok(
      src.includes('resolvePapicFaceMode'),
      `${rel}: enrollment write does not resolve papic_face_mode server-side.`,
    );
    assert.ok(
      src.includes('faceVectorForMode'),
      `${rel}: enrollment write does not route the descriptor through faceVectorForMode — a mode_b event could persist a POSTed vector.`,
    );
  });
}

// DISCOVERY: scan ALL of app/ so no embedder call site can hide from the
// guardrail. Every file that calls an embedder MUST be either a gated
// CAPTURE_FILE (forced to carry a Mode-A gate by the per-file test above) or an
// explicitly documented EMBED_EXEMPT_FILE — never silently unclassified. A new
// capture surface copied from these therefore goes RED until it is classified.
function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walkFiles(abs, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

test('every embedder call site in app/ is classified (gated or explicitly exempt)', () => {
  const classified = new Set([...CAPTURE_FILES, ...EMBED_EXEMPT_FILES]);
  const appDir = path.join(WEB, 'app');
  const callSites: string[] = [];
  for (const abs of walkFiles(appDir)) {
    const src = fs.readFileSync(abs, 'utf8');
    if (allIndices(src, EMBED_CALL_RE).length > 0) {
      callSites.push(path.relative(WEB, abs));
    }
  }
  // There must be at least one — otherwise the regex broke and the guardrail is
  // silently passing on nothing.
  assert.ok(callSites.length > 0, 'no embedder call sites found in app/ — EMBED_CALL_RE likely broke.');
  for (const rel of callSites) {
    assert.ok(
      classified.has(rel),
      `${rel} calls a face embedder but is neither a gated CAPTURE_FILE nor a documented EMBED_EXEMPT_FILE. Gate it on faceMode === 'mode_a' and add it to CAPTURE_FILES, or (if it never binds an event and never persists a descriptor) document it in EMBED_EXEMPT_FILES.`,
    );
  }
});

// Keep the classification lists honest: every declared file must exist AND still
// call an embedder, so stale entries (a renamed/removed call site) surface
// instead of masking a real gap.
test('CAPTURE_FILES + EMBED_EXEMPT_FILES entries exist and still embed', () => {
  for (const rel of [...CAPTURE_FILES, ...EMBED_EXEMPT_FILES]) {
    const abs = path.join(WEB, rel);
    assert.ok(fs.existsSync(abs), `${rel}: listed but missing — remove or fix the path.`);
    const src = fs.readFileSync(abs, 'utf8');
    assert.ok(
      allIndices(src, EMBED_CALL_RE).length > 0,
      `${rel}: listed as an embedder call site but no longer calls one — remove it from the list.`,
    );
  }
});
