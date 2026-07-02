#!/usr/bin/env node
/**
 * lint-nested-forms.mjs
 *
 * Fails when a `<form>` element — or a `<ConfirmForm>`, which renders its own
 * `<form>` (see app/_components/confirm-form.tsx) — is nested inside another
 * form element in any .tsx under app/.
 *
 * WHY THIS GUARD EXISTS (2026-07-03 · real production bug):
 * Nested form tags are invalid HTML. The browser drops the inner form's start
 * tag and hoists its children — including the `$ACTION_ID_` hidden input React
 * emits for the inner server action — into the OUTER form. Next's no-JS/MPA
 * action decoder (react-server-dom-webpack `decodeAction`) takes the LAST
 * `$ACTION_ID_` in FormData order, so a JS-disabled or pre-hydration submit of
 * the outer form dispatches the INNER action. In services-manager.tsx that
 * meant a no-JS "Save changes" click DELETED the vendor's service card with no
 * confirmation (ConfirmForm's dialog is client-JS only) — plus a hydration
 * mismatch on every card. Fixed by un-nesting via ConfirmForm's `formId` prop
 * (external trigger: `<button type="submit" form={formId}>`); this guard stops
 * the idiom from creeping back.
 *
 * HOW IT CHECKS — a lexical, same-file scan:
 *   1. Strip comments + string/template-literal bodies (offset-preserving, so
 *      reported line numbers are true) — a `</form>` in a comment can't skew
 *      the depth count.
 *   2. Tokenize `<form …>` / `</form>` / `<ConfirmForm …>` / `</ConfirmForm>`.
 *      Tag-end detection is attribute-aware (quotes + `{…}` expressions, so an
 *      `onSubmit={(e) => …}` arrow can't fake the closing `>`); self-closing
 *      tags don't open depth.
 *   3. Any form-opening token while depth > 0 is a violation.
 *
 * Scope note (honest): JSX in one file is syntactically well-nested, so the
 * linear depth-track is sound per file — but nesting created ACROSS components
 * (a component that renders a form, mounted inside another file's form) is
 * invisible to a lexical scan. The 2026-07-03 repo-wide multi-agent audit
 * verified zero such sites; keep catching those in review. If a legitimate
 * false positive ever appears (none known), add the file to ALLOWLIST below
 * with a dated reason.
 *
 * Usage:
 *   node apps/web/scripts/lint-nested-forms.mjs [scanRootOverride]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const SCAN_ROOT = process.argv[2] ? resolve(process.argv[2]) : join(WEB_ROOT, 'app');

/** Files exempted from the check — add ONLY with a dated reason. */
const ALLOWLIST = new Set([
  // (none — the tree is clean at guard-landing; keep it that way)
]);

// ── offset-preserving comment/string stripper ────────────────────────────────
// Replaces the INTERIOR of comments and string/template literals with spaces
// (newlines kept) so `<form` can only match real JSX and line numbers stay
// true. Handles: // …, /* … */, '…', "…", `…` with ${ … } interpolation
// (interpolated code is preserved and scanned — it can contain JSX).
function stripNonCode(src) {
  const out = src.split('');
  // Modes: code | line | block | single | double | template
  const stack = ['code']; // template ${…} pushes 'code' back on
  let braceDepth = 0; // brace depth inside a template interpolation
  const braceStack = [];
  for (let i = 0; i < src.length; i++) {
    const mode = stack[stack.length - 1];
    const c = src[i];
    const next = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && next === '/') {
        stack.push('line');
        out[i] = ' ';
      } else if (c === '/' && next === '*') {
        stack.push('block');
        out[i] = ' ';
      } else if (c === "'") stack.push('single');
      else if (c === '"') stack.push('double');
      else if (c === '`') stack.push('template');
      else if (braceStack.length && c === '{') braceDepth++;
      else if (braceStack.length && c === '}') {
        if (braceDepth === 0) {
          // closing a template interpolation → back to template mode
          stack.pop(); // pop 'code'
          braceDepth = braceStack.pop();
        } else {
          braceDepth--;
        }
      }
    } else if (mode === 'line') {
      if (c === '\n') stack.pop();
      else out[i] = ' ';
    } else if (mode === 'block') {
      if (c === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i++;
        stack.pop();
      } else if (c !== '\n') out[i] = ' ';
    } else if (mode === 'single' || mode === 'double') {
      const quote = mode === 'single' ? "'" : '"';
      if (c === '\\') {
        out[i] = ' ';
        if (next !== undefined && next !== '\n') {
          out[i + 1] = ' ';
          i++;
        }
      } else if (c === quote) stack.pop();
      else if (c !== '\n') out[i] = ' ';
    } else if (mode === 'template') {
      if (c === '\\') {
        out[i] = ' ';
        if (next !== undefined && next !== '\n') {
          out[i + 1] = ' ';
          i++;
        }
      } else if (c === '`') stack.pop();
      else if (c === '$' && next === '{') {
        // enter interpolation: preserve + scan the code inside
        out[i] = ' ';
        i++; // keep the '{' visible? No — blank both markers, scan interior.
        out[i] = ' ';
        braceStack.push(braceDepth);
        braceDepth = 0;
        stack.push('code');
      } else if (c !== '\n') out[i] = ' ';
    }
  }
  return out.join('');
}

// ── tag scanning ─────────────────────────────────────────────────────────────
/** Find the index just past a tag's true closing `>`, respecting quoted
 *  attribute values and `{…}` JSX expressions. Returns {end, selfClosing}. */
function tagEnd(code, from) {
  let brace = 0;
  let quote = null;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') brace++;
    else if (c === '}') brace--;
    else if (c === '>' && brace <= 0) {
      return { end: i + 1, selfClosing: code[i - 1] === '/' };
    }
  }
  return { end: code.length, selfClosing: false };
}

const OPEN_RE = /<(form|ConfirmForm)(?=[\s/>])/g;
const CLOSE_RE = /<\/(form|ConfirmForm)\s*>/g;

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx; i++) if (src[i] === '\n') line++;
  return line;
}

function scanFile(abs, rel) {
  const src = readFileSync(abs, 'utf8');
  if (!/<(form|ConfirmForm)[\s/>]/.test(src)) return [];
  const code = stripNonCode(src);

  // Collect open/close events in document order.
  const events = [];
  for (const m of code.matchAll(OPEN_RE)) {
    const { end, selfClosing } = tagEnd(code, m.index + m[0].length);
    events.push({ idx: m.index, kind: 'open', tag: m[1], selfClosing, end });
  }
  for (const m of code.matchAll(CLOSE_RE)) {
    events.push({ idx: m.index, kind: 'close', tag: m[1] });
  }
  events.sort((a, b) => a.idx - b.idx);

  const violations = [];
  let depth = 0;
  for (const e of events) {
    if (e.kind === 'open') {
      if (depth > 0) {
        violations.push({
          file: rel,
          line: lineOf(code, e.idx),
          tag: e.tag,
        });
      }
      if (!e.selfClosing) depth++;
    } else {
      depth = Math.max(0, depth - 1);
    }
  }
  return violations;
}

// ── walk + report ────────────────────────────────────────────────────────────
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = walk(SCAN_ROOT);
const allViolations = [];
for (const abs of files) {
  const rel = relative(WEB_ROOT, abs);
  if (ALLOWLIST.has(rel)) continue;
  allViolations.push(...scanFile(abs, rel));
}

if (allViolations.length) {
  console.error(`✗ lint-nested-forms: ${allViolations.length} nested form element(s) found:\n`);
  for (const v of allViolations) {
    console.error(
      `  ${v.file}:${v.line} — <${v.tag}> opens inside another <form>/<ConfirmForm>.`,
    );
  }
  console.error(
    `\nNested form tags are invalid HTML: the browser hoists the inner form's\n` +
      `$ACTION_ID_ input into the outer form, so a no-JS / pre-hydration submit\n` +
      `of the outer form dispatches the INNER action (this deleted a vendor's\n` +
      `service from a "Save" click once — see changelog.d/fix-nested-delete-form.md).\n` +
      `Fix: render the inner form as a SIBLING and trigger it via\n` +
      `<button type="submit" form={id}> — ConfirmForm supports this via its\n` +
      `formId prop. See app/_components/confirm-form.tsx.`,
  );
  process.exit(1);
}

console.log(`✓ lint-nested-forms: ${files.length} .tsx files scanned, no nested form elements.`);
