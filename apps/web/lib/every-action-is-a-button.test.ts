/**
 * every-action-is-a-button.test.ts — THE MAKER SWEEP of the button rule
 * (owner 2026-10-07, corpus `BUTTON_RULE_2026-10-07_fable.md`).
 *
 * The components are held by `action-button-is-icon-and-word.test.ts` and
 * `count-animates-only-on-change.test.ts`; this file holds the CALL SITES: in
 * every swept file, no bare `<button`, no `›` inside a control's text, no raw
 * red/emerald/amber/green/rose utility on a control. The detector runs over
 * fixtures first, so an empty or narrow scope cannot pass by catching nothing.
 *
 * Lives in `lib/` (not `tests/`) because `test:unit` globs `lib/**` and
 * `app/**` only — a file in `apps/web/tests/` would never run in CI.
 *
 * SABOTAGE, each seen red before this shipped (PR body has the run):
 *   fixtures: switch off the `›` rule
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './security/shadowed-export-scan';

/* ═══ T5 · THE SOURCE SWEEP ════════════════════════════════════════════════ */

/**
 * The Maker files swept so far. GROWS with each sweep; never shrinks.
 * Phase 1 (this PR's first push) ships the components and the detector;
 * Phase 2 (after the Studio redraw merges) adds the Maker paths.
 */
const SWEPT_PATHS: string[] = [];

type Finding = { line: number; what: string; text: string };

/** Lines that hold an action control but do not go through ActionButton. */
function scanForBareActions(source: string): Finding[] {
  const out: Finding[] = [];
  const lines = source.split('\n');
  lines.forEach((text, i) => {
    const line = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // comments explain, they do not render
    if (/<button(\s|>|$)/.test(text)) out.push({ line, what: 'bare <button> (use ActionButton)', text });
    if (/<(a|button|Link)\b[^>]*>[^<]*›/.test(text) || /^[^<>]*›\s*<\/(a|button|Link)>/.test(text))
      out.push({ line, what: '› inside a control (a button is a pill, not a text link)', text });
    if (/className=["'{`][^"'`]*\b(text|bg|border)-(red|emerald|amber|green|rose)-\d{2,3}/.test(text))
      out.push({ line, what: 'raw red/emerald/amber utility (use a tone)', text });
  });
  return out;
}

test('T5 · the detector catches every bare shape and passes the rule-shaped ones (fixtures)', () => {
  const bad = [
    '<button onClick={go}>Add</button>',
    '<button\n',
    '<Link href="/x">See all ›</Link>',
    '<a href="/y" className="text-sm">More ›</a>',
    '<span className="text-red-600 font-medium">Delete</span>',
    '<div className="bg-emerald-50">',
  ];
  for (const b of bad) assert.ok(scanForBareActions(b).length > 0, `catches: ${b}`);
  const good = [
    '<ActionButton tone="brand" icon={Plus} label="Add a part" main onClick={add} />',
    "  // a comment may say <button> or 'text-red-600' and is not a control",
    '<ActionButton tone="neutral" icon={ChevronRight} label="See all" href="/x" />',
    '<span className="text-ink/60">Nothing yet</span>',
  ];
  for (const g of good) assert.deepEqual(scanForBareActions(g), [], `passes: ${g}`);
});

test('T5 · every swept Maker file has no bare action', () => {
  for (const rel of SWEPT_PATHS) {
    const abs = path.join(APP_ROOT, rel);
    assert.ok(fs.existsSync(abs), `swept path exists: ${rel} (a moved file must move here too)`);
    const findings = scanForBareActions(fs.readFileSync(abs, 'utf8'));
    assert.deepEqual(
      findings.map((f) => `${rel}:${f.line} ${f.what} — ${f.text.trim()}`),
      [],
    );
  }
});
