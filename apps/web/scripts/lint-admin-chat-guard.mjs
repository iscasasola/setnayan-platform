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
 *   2. Any line carrying the marker `// chat-guard-allow: <reason>` — a
 *      DELIBERATE, reviewable exception (e.g. the future force-majeure
 *      last-10-message snippet RPC, which is itself two-admin-gated + logged +
 *      user-notified per 0023 §3.6b). The marker shows up in the diff, so a new
 *      exception can never be added silently.
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

const FORBIDDEN = [
  { re: /\bfetchMessages\b/, what: 'reads chat message bodies via @/lib/chat fetchMessages()' },
  { re: /chat_messages/, what: "queries the chat_messages table" },
  { re: /chat_attachments/, what: 'reads thread file attachments (chat_attachments)' },
  { re: /face_enrollments|vector_blob/, what: 'reads raw face-recognition vectors' },
];

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

const violations = [];

for (const file of walk(ADMIN_DIR)) {
  const relFromAdmin = relative(ADMIN_DIR, file);
  // Skip the sanctioned demo-only reader.
  if (relFromAdmin.split('/')[0] === ALLOWED_SUBDIR) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return; // deliberate, reviewed exception
    for (const { re, what } of FORBIDDEN) {
      if (re.test(line)) {
        violations.push({
          file: relative(REPO_ROOT, file),
          line: i + 1,
          what,
          snippet: line.trim().slice(0, 120),
        });
        break; // one finding per line is enough
      }
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
