#!/usr/bin/env node
/**
 * lint-admin-chat-guard.mjs
 *
 * PRIVACY INVARIANT (owner-locked admin account-access model, 2026-06-22 —
 * see Admin_Account_Access_Model_2026-06-22.md + DECISION_LOG 2026-06-22):
 * Setnayan admins/staff CANNOT read couple↔vendor chat message bodies, thread
 * file attachments, or raw face-recognition vectors — not even inside an
 * account takeover. This is the guard behind the published trust promise
 * ("Setnayan staff read your messages only with your consent or a logged,
 * notified takeover").
 *
 * WHY A LINT GUARD (not RLS): chat row-level security is ALREADY participant-
 * only — there is no admin grant on chat_messages to tighten (verified
 * 2026-06-22). So the only way admin code could read chat content is the
 * service-role client (`createAdminClient()` bypasses RLS). This guard fails
 * the build if any file under `app/admin/**` (the admin surface) reads chat
 * content or face vectors, so a future admin page can't quietly add one.
 *
 * SCOPE: `apps/web/app/admin/**` only. The chat FEATURE itself (`lib/chat.ts`,
 * the couple/vendor message UI) legitimately reads bodies for thread
 * PARTICIPANTS and is out of scope — this guard is specifically about the admin
 * surface reading other people's conversations.
 *
 * FORBIDDEN in app/admin/** (outside the allow-list):
 *   - `fetchMessages`            (the @/lib/chat message-body reader)
 *   - `chat_messages`            (direct table read)
 *   - `chat_attachments`         (thread file bytes)
 *   - `face_enrollments` / `vector_blob`   (raw face vectors)
 *
 * ALLOW-LIST:
 *   1. `app/admin/demo-vendors/**` — the sole sanctioned reader, hard-gated to
 *      `vendor.is_demo` (test records, never a real couple's chat).
 *   2. A line carrying the marker `// chat-guard-allow: <reason>` ON a forbidden
 *      token — a DELIBERATE, reviewable exception (e.g. the RA 10173
 *      right-to-erasure DELETE of a leaving user's own authored messages). The
 *      marker shows up in the diff, so a new exception can never be added
 *      silently. **On a CHAT/ATTACHMENT token the marker is WRITE/DELETE-only**
 *      (hardened 2026-07-11): the guard scans the marked statement (that line →
 *      its terminating `;`) and FAILS if it contains a READ verb (`.select(` /
 *      `.single(` / `.limit(` / `fetchMessages`) or lacks a mutation verb
 *      (`.delete(` / `.update(` / `.insert(`). So a future edit that flips a
 *      marked `.delete()` to `.select('body,…')` can NOT ride the same marker
 *      into a silent read — the marker only ever sanctions writes/deletes, never
 *      reads. A sanctioned admin READ of chat content (should one ever be
 *      approved) must go through consent, not this marker. (A FACE token keeps
 *      the whole-line exception: its sanctioned uses are `count:'exact',
 *      head:true` NPC tallies that read ZERO vectors.)
 *
 * Pure Node, no install (mirrors the sibling lint-*.mjs guards).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = process.cwd().endsWith('/apps/web')
  ? join(process.cwd(), '..', '..')
  : process.cwd();
const ADMIN_DIR = join(REPO_ROOT, 'apps/web/app/admin');

// Directory (relative to app/admin) that is allowed to read chat content.
const ALLOWED_SUBDIR = 'demo-vendors';

// Per-line marker that whitelists a deliberate, reviewed exception.
const ALLOW_MARKER = 'chat-guard-allow';

// `kind` splits the forbidden tokens into two exception regimes:
//   • 'chat' (message bodies + thread attachments) — a marker is honoured ONLY
//     for a write/delete statement (verb-aware; see evaluateMarkedStatement).
//     There is no legitimate admin-surface READ of couple↔vendor content.
//   • 'face' (raw recognition vectors) — a marker whitelists the whole line, as
//     before, because the sanctioned uses are `count: 'exact', head: true`
//     tallies (NPC compliance counts) that read ZERO vectors. Hardening these to
//     write-only is out of scope for the chat-body split-chain fix.
const FORBIDDEN = [
  { re: /\bfetchMessages\b/, kind: 'chat', what: 'reads chat message bodies via @/lib/chat fetchMessages()' },
  { re: /chat_messages/, kind: 'chat', what: "queries the chat_messages table" },
  { re: /chat_attachments/, kind: 'chat', what: 'reads thread file attachments (chat_attachments)' },
  { re: /face_enrollments|vector_blob/, kind: 'face', what: 'reads raw face-recognition vectors' },
];

// Verb-awareness for marked exceptions. A `// chat-guard-allow` marker is only
// honoured for WRITE/DELETE statements — it can never whitelist a READ of chat
// content. READ verbs pull rows out; MUTATION verbs push changes in.
const READ_VERBS = [
  /\.select\s*\(/,
  /\.single\s*\(/,
  /\.maybeSingle\s*\(/,
  /\.limit\s*\(/,
  /\bfetchMessages\b/,
];
const MUTATION_VERBS = [/\.delete\s*\(/, /\.update\s*\(/, /\.insert\s*\(/, /\.upsert\s*\(/];

/**
 * Given the source `lines` and the 0-based index of a line that carries BOTH a
 * forbidden chat/attachment token AND the allow-marker, decide whether the
 * marked exception is a permitted WRITE/DELETE-only path.
 *
 * WHY: the Supabase builder splits a statement across lines —
 *   `.from('chat_messages') // chat-guard-allow: …`   ← marked (forbidden token)
 *   `.delete()`                                        ← the operation verb
 *   `.eq('sender_user_id', targetUserId);`             ← terminates the stmt
 * The old guard whitelisted the whole marked LINE and never looked at the verb,
 * so flipping `.delete()` to `.select('body,…')` would slip past. This scans the
 * statement window (marked line → terminating `;`) and proves it's a mutation.
 *
 * Returns { ok: true } for a write/delete-only exception, or
 * { ok: false, reason } when the marked statement reads (or can't be proven a
 * write).
 */
function evaluateMarkedStatement(lines, idx) {
  const parts = [];
  for (let j = idx; j < lines.length && j - idx < 25; j++) {
    parts.push(lines[j]);
    // Strip a trailing line-comment so the marker comment on the first line
    // doesn't mask the `;` that really terminates the statement.
    const code = lines[j].replace(/\/\/.*$/, '').trimEnd();
    if (code.endsWith(';')) break;
  }
  const stmt = parts.join('\n');
  if (READ_VERBS.some((re) => re.test(stmt))) {
    return {
      ok: false,
      reason:
        'the marked statement contains a READ verb (.select/.single/.limit/fetchMessages) — the chat-guard marker only sanctions write/delete-only paths, never reads',
    };
  }
  if (!MUTATION_VERBS.some((re) => re.test(stmt))) {
    return {
      ok: false,
      reason:
        'the marked statement has no mutation verb (.delete/.update/.insert) so it cannot be proven write/delete-only — the chat-guard marker only sanctions writes/deletes',
    };
  }
  return { ok: true };
}

/**
 * Inline self-test — runs on every invocation so a regression in the verb-aware
 * logic is caught the moment this guard runs (there is no separate test file).
 * Throws (→ non-zero exit) if the decision function drifts.
 */
function selfTest() {
  const cases = [
    {
      name: 'RA 10173 erasure DELETE (the real admin/users/actions.ts pattern) PASSES',
      lines: [
        '  const { error } = await admin',
        "    .from('chat_messages') // chat-guard-allow: RA 10173 right-to-erasure",
        '    .delete()',
        "    .eq('sender_user_id', targetUserId);",
      ],
      markedIdx: 1,
      expectOk: true,
    },
    {
      name: 'hypothetical marked .select on chat_messages FAILS',
      lines: [
        '  const { data } = await admin',
        "    .from('chat_messages') // chat-guard-allow: RA 10173 right-to-erasure",
        "    .select('body, sender_user_id')",
        "    .eq('sender_user_id', targetUserId);",
      ],
      markedIdx: 1,
      expectOk: false,
    },
    {
      name: 'single-line marked delete PASSES',
      lines: [
        "await admin.from('chat_messages').delete().eq('sender_user_id', id); // chat-guard-allow: erasure",
      ],
      markedIdx: 0,
      expectOk: true,
    },
    {
      name: 'marked read-only chain with no mutation verb FAILS',
      lines: [
        '  const { data } = await admin',
        "    .from('chat_messages') // chat-guard-allow: bogus",
        "    .limit(10);",
      ],
      markedIdx: 1,
      expectOk: false,
    },
  ];
  for (const c of cases) {
    const got = evaluateMarkedStatement(c.lines, c.markedIdx).ok;
    if (got !== c.expectOk) {
      throw new Error(
        `chat-guard self-test FAILED: "${c.name}" — expected ok=${c.expectOk}, got ok=${got}`,
      );
    }
  }
}

/** Recursively collect .ts/.tsx files under a directory. */
function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // dir absent → nothing to scan
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out = out.concat(walk(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// Prove the verb-aware decision logic before scanning any file.
selfTest();

const violations = [];

for (const file of walk(ADMIN_DIR)) {
  const relFromAdmin = relative(ADMIN_DIR, file);
  // Skip the sanctioned demo-only reader.
  if (relFromAdmin.split('/')[0] === ALLOWED_SUBDIR) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const forbidden = FORBIDDEN.find(({ re }) => re.test(line));

    if (line.includes(ALLOW_MARKER)) {
      // For a CHAT/ATTACHMENT token, the marker whitelists the line ONLY for a
      // write/delete statement — prove the surrounding statement is a mutation,
      // not a read (so a future `.delete()` → `.select('body,…')` edit can't
      // ride the same marker). A FACE token keeps the whole-line exception (its
      // sanctioned uses are head:true count tallies that read zero vectors).
      if (forbidden && forbidden.kind === 'chat') {
        const verdict = evaluateMarkedStatement(lines, i);
        if (!verdict.ok) {
          violations.push({
            file: relative(REPO_ROOT, file),
            line: i + 1,
            what: `${forbidden.what} — but ${verdict.reason}`,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
      return; // marked line handled (allowed exception, or flagged above)
    }

    if (forbidden) {
      violations.push({
        file: relative(REPO_ROOT, file),
        line: i + 1,
        what: forbidden.what,
        snippet: line.trim().slice(0, 120),
      });
    }
  });
}

if (violations.length > 0) {
  console.error('\n✗ admin chat-guard FAILED — admin code must not read chat content or face vectors.\n');
  console.error('  Privacy invariant (Admin_Account_Access_Model_2026-06-22.md): an admin/staff');
  console.error('  surface may NEVER read couple↔vendor message bodies, thread attachments, or raw');
  console.error('  face vectors. Chat RLS is participant-only; the service-role admin client bypasses');
  console.error('  it, so this is enforced here.\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}\n      ${v.what}\n      → ${v.snippet}`);
  }
  console.error('\n  If this is a DELIBERATE, sanctioned path (e.g. the force-majeure snippet RPC,');
  console.error(`  two-admin-gated + logged + notified), add \`// ${ALLOW_MARKER}: <reason>\` on the line.`);
  console.error('  Otherwise route the need through consent or remove the read.\n');
  process.exit(1);
}

console.log('✓ admin chat-guard clean — no admin-surface reads of chat content or face vectors (demo-vendors allow-listed).');
