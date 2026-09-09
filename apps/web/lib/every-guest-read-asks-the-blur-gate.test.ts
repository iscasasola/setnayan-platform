/**
 * lib/every-guest-read-asks-the-blur-gate.test.ts
 *
 * ONE QUESTION, ASKED IN ONE PLACE, BY EVERY READER THAT SERVES A GUEST A
 * PAPIC CAPTURE.
 *
 * ── THE DEFECT THIS EXISTS TO STOP COMING BACK ─────────────────────────────
 * Owner ruling 1 of 2026-08-17 was built three times — `wall_visible_photos`,
 * `guest_pool_gallery`, and the public recap's `publicKeyForCapture` — and the
 * 2026-08-24 decision row called the pool *"the last surface still vetoing."*
 * It was not. FOUR more readers hand a guest somebody else's face: the
 * per-guest gallery behind six surfaces, the ZIP of full-resolution originals,
 * the single-photo save, and the story maker that bakes a reel. Every one asked
 * `moderation_state = 'clean'` and `hidden_at IS NULL` and nothing else.
 *
 * 🔑 THE FILE SET IS DERIVED, NOT TYPED OUT. A hand-enumerated list is a list
 * of the readers somebody thought of — which is exactly how four were missed.
 * The scan below finds every file that reads `photo_tags` scoped by a guest AND
 * names a capture table, then insists each one is either GATED or carries a
 * written reason for not being. A NEW reader fails this test until it is
 * classified, and it cannot be classified as exempt without a sentence.
 *
 * 🪤 COMMENTS ARE STRIPPED BEFORE MATCHING, with a real state machine and not a
 * line-prefix filter (whose survivors are mostly block-comment continuation
 * lines). Every gated file carries a paragraph naming this module; a raw-source
 * match would count the prose and pass over a gutted call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'lib'];
const SKIP = new Set(['node_modules', '.next', '.turbo', 'dist', 'build']);

/**
 * The readers that MUST go through `lib/papic-guest-blur-gate.ts`, with the
 * floor of applications each one has. A floor, not an equality: adding a
 * gated read is fine, losing one is not.
 */
const GATED: Record<string, { load: number; apply: number; answersFailure: boolean }> = {
  'lib/guest-live-gallery.ts': { load: 1, apply: 1, answersFailure: true },
  'lib/guest-stories.ts': { load: 1, apply: 3, answersFailure: false },
  'app/papic/me/[token]/download/route.ts': { load: 1, apply: 1, answersFailure: true },
  'app/papic/me/[token]/photo/route.ts': { load: 1, apply: 1, answersFailure: true },
};

/**
 * Files the scan finds that legitimately do NOT need the gate. Each carries the
 * reason, because a bare allowlist is a bill nobody re-reads.
 */
const NOT_A_GUEST_READ: Record<string, string> = {
  'lib/papic-gallery.ts':
    "the COUPLE's own studio gallery — ruling 1 keeps the couple's album unblurred",
  'lib/life-story-moment-graph.ts':
    "own celebrations only (event_members.member_type = 'couple'); attended events are Phase 1.5",
  'lib/alaala-wall-data.ts':
    'OWNED media reads under the viewer\'s own RLS session; its ATTENDED half is getGuestLiveGallery, which IS gated',
  'app/dashboard/[eventId]/story/_lib/load-desk.ts':
    "the host's own story desk, reached only after hostUserId(eventId) is proved",
  'app/[slug]/_components/editorial/consent-veto.ts':
    'IS the public recap\'s own blur gate (publicKeyForCapture) — a gate, not a reader needing one',
  // ⚠ NAMED, NOT FIXED (2026-09-09). Every capture read here routes through
  // `publicKeyForCapture`, so the surface IS gated — but that gate implements
  // only the WITHDRAWN-CONSENT half of ruling 1 in TypeScript and has NO
  // FaceBlock arm at all, while `papic_capture_needs_blur` treats FaceBlock as
  // event-wide. So on an event with a FaceBlock guest the venue wall and the
  // shared pool blur every frame and the PUBLIC EVENT PAGE does not. Inert in
  // production today (0 FaceBlock guests, measured 2026-09-09) and a change to
  // a published recap in its own right — it is not smuggled into this PR.
  'app/[slug]/_components/editorial/data.ts':
    'the public recap; every capture it serves goes through publicKeyForCapture — see the FaceBlock gap noted above',
  'app/[slug]/actions.ts':
    'WRITES tag tombstones (untag me / ask for a takedown); serves no image key',
  'lib/face-match.ts': 'writes auto-face tags; serves no image key',
  'lib/guest-wall-unpost.ts':
    'answers "is this on the wall right now" — a state, never an object key',
};

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const full = join(dir, e);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}

/** Strip // and /* *\/ comments without eating string or template contents. */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code';
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && n === '*') {
        mode = 'block';
        i += 2;
        continue;
      }
      if (c === "'") mode = 'sq';
      else if (c === '"') mode = 'dq';
      else if (c === '`') mode = 'tpl';
      out += c;
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code';
        out += c;
      }
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code';
        i += 2;
      } else {
        if (c === '\n') out += c;
        i += 1;
      }
      continue;
    }
    // inside a string / template
    if (c === '\\') {
      out += c + (n ?? '');
      i += 2;
      continue;
    }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) {
      mode = 'code';
    }
    out += c;
    i += 1;
  }
  return out;
}

function count(hay: string, needle: string): number {
  let n = 0;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at === -1) return n;
    n += 1;
    from = at + needle.length;
  }
}

/** Every file that reads guest-scoped photo tags AND names a capture table. */
function guestScopedCaptureReaders(): string[] {
  const hits: string[] = [];
  for (const d of SCAN_DIRS) {
    for (const full of walk(join(WEB, d))) {
      const raw = readFileSync(full, 'utf8');
      const src = stripComments(raw);
      if (!src.includes("from('photo_tags')")) continue;
      if (!src.includes("guest_id'")) continue;
      if (!/'papic_photos'|'papic_guest_captures'/.test(src)) continue;
      hits.push(relative(WEB, full));
    }
  }
  return hits.sort();
}

test('every guest-scoped capture reader is classified — gated, or exempt WITH A REASON', () => {
  const found = guestScopedCaptureReaders();
  assert.ok(found.length > 0, 'the scan matched nothing — it can no longer fail');

  const classified = new Set([...Object.keys(GATED), ...Object.keys(NOT_A_GUEST_READ)]);
  const unclassified = found.filter((f) => !classified.has(f));
  assert.deepEqual(
    unclassified,
    [],
    `a new reader of a guest's tagged Papic captures appeared and nothing says whether it must blur:\n  ${unclassified.join('\n  ')}\nAdd it to GATED (and wire lib/papic-guest-blur-gate.ts) or to NOT_A_GUEST_READ with the reason.`,
  );

  // The bill must not rot: every listed file still has to exist and still match.
  const stale = [...classified].filter((f) => !found.includes(f));
  assert.deepEqual(stale, [], `these are listed but the scan no longer finds them: ${stale.join(', ')}`);
});

test('each gated reader loads the gate AND applies its answer', () => {
  for (const [file, floor] of Object.entries(GATED)) {
    const src = stripComments(readFileSync(join(WEB, file), 'utf8'));
    assert.ok(
      /from '@\/lib\/papic-guest-blur-gate'/.test(src),
      `${file} does not import the blur gate`,
    );
    const loads = count(src, 'loadGuestBlurGate(');
    const applies = count(src, 'guestSafeKeyForCapture(');
    assert.ok(
      loads >= floor.load,
      `${file}: loadGuestBlurGate( ${loads} < floor ${floor.load} — the gate is imported but never asked`,
    );
    assert.ok(
      applies >= floor.apply,
      `${file}: guestSafeKeyForCapture( ${applies} < floor ${floor.apply} — the gate is asked but its answer is not applied to every key served`,
    );
  }
});

test('a reader with its own words for a failed read says so, rather than printing "none"', () => {
  for (const [file, floor] of Object.entries(GATED)) {
    if (!floor.answersFailure) continue;
    const src = stripComments(readFileSync(join(WEB, file), 'utf8'));
    assert.ok(
      /blurGate\.failed/.test(src),
      `${file} must branch on blurGate.failed — an unanswerable privacy question is a FAILED read, not an empty one`,
    );
  }
});

test('the gate itself never invents a second copy of the rule', () => {
  const gate = stripComments(readFileSync(join(WEB, 'lib', 'papic-guest-blur-gate.ts'), 'utf8'));
  assert.ok(
    gate.includes("'papic_captures_needing_blur'"),
    'the gate must ask the SQL predicate production already holds',
  );
  // A TypeScript re-implementation of the two clauses is the failure mode: the
  // public recap re-implemented the withdrawal half and has no FaceBlock arm.
  assert.ok(
    !/faceblock_enabled/.test(gate),
    'the gate re-implements the FaceBlock clause instead of asking the shared predicate',
  );
  assert.ok(
    !/photo_consent/.test(gate),
    'the gate re-implements the withdrawn-consent clause instead of asking the shared predicate',
  );
});

test('the comment stripper survives the shapes this repo actually writes', () => {
  assert.equal(stripComments("const a = 1; // guestSafeKeyForCapture(\n"), 'const a = 1; \n');
  assert.equal(stripComments('/* guestSafeKeyForCapture( */ const b = 2;'), ' const b = 2;');
  assert.equal(stripComments("const c = '// not a comment';"), "const c = '// not a comment';");
  assert.equal(stripComments('const d = `a /* b */ c`;'), 'const d = `a /* b */ c`;');
  // The trap a line-prefix filter falls into: a continuation line inside a block.
  assert.equal(stripComments('/*\n * guestSafeKeyForCapture(\n */\nx();'), '\n\n\nx();');
});
