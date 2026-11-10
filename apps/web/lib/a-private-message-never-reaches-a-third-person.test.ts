/**
 * A PRIVATE MESSAGE NEVER REACHES A THIRD PERSON — the code half.
 * Supplier Build 3 · lane B · migration 20271329968207.
 *
 * ⚖ DECISION_LOG 🔒 2026-11-09 — a chat_messages row with recipient_user_id is
 *   read by its sender and its recipient only; only the recipient is notified.
 *
 * The database half (tests/db/a-private-message-never-reaches-a-third-person.db.test.ts)
 * runs the four paths against the real policy. What a database cannot see is
 * what the APP does with a row once it holds one with the service role, so this
 * file pins the three places where that could go wrong:
 *
 *   1 · NOTICES — every notice the app sends about a chat line comes from
 *       `notifyOtherParty` (lib/chat-actions.ts), and it FANS OUT: a host's line
 *       notifies the shop; a supplier's notifies EVERY host on the event, body
 *       included. Build 3 lane A's private composer is the first server path to
 *       write a recipient (`sendChatMessageCore`, lib/chat-send.ts), so the
 *       tripwire now PROVES that path instead of forbidding it: the recipient
 *       rides the row only beside a words-only refusal, the AI is never woken,
 *       and `notifyOtherParty` tells the RECIPIENT ONLY and returns before the
 *       fan-out. Any OTHER code that names the column still fails here.
 *   2 · DIGEST — no digest module, nor anything it imports, reads chat_messages
 *       or the unread RPCs. Walked, not listed by hand.
 *   3 · SEARCH — the inbox search runs over the rows on screen; the preview is
 *       the only message-shaped thing in a row. Every read that feeds a preview
 *       must be the viewer's own session (RLS), never the service role — the
 *       restrictive policy can only protect a read it sees.
 *
 * Export is pinned per chain by lib/export-reads-are-subject-scoped.test.ts
 * (`chat_messages: eqUid('sender_user_id')`) and run through both doors in the
 * db test, so it is not repeated here.
 *
 * Run (from apps/web): tsx --test lib/a-private-message-never-reaches-a-third-person.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const WEB = path.resolve(HERE, '..');
const REPO = path.resolve(WEB, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (f: string) => path.relative(WEB, f);

// ── 1 · notices ─────────────────────────────────────────────────────────────

/**
 * Files that name the column only as DATA about the schema (a map, a register),
 * never as a value written into or filtered out of a chat row. Each reasoned.
 */
const NAMES_THE_COLUMN_AS_METADATA: Record<string, string> = {
  'lib/ugat/graph.ts': 'the Ugat map’s FK + claim strings for the column',
  'lib/erasure/coverage.ts': 'the DPO question about private lines addressed TO an erased subject',
  // A READ FILTER, not a writer: the auto-reply's service-role reads ask for shared lines only (`.is(…, null)`),
  // held by lib/the-ai-never-reads-a-private-message.test.ts.
  'lib/vendor-autoreply/inbox-hook.ts': 'filters private lines OUT of the AI’s read of the latest host line',
  'lib/vendor-autoreply/voice-learning.ts': 'filters private lines OUT of the AI’s voice sample',
  // A READ FILTER, not a writer (Build 3 lane B round 3, RA 10173 access right): the export reads the private lines
  // sent TO its subject — `.eq('recipient_user_id', user.id)`, so the admin's service-role door is bounded by it;
  // run as written by tests/db/a-private-message-never-reaches-a-third-person.db.test.ts (export).
  'lib/personal-data-export.ts': 'the subject’s own received private lines, filtered recipient_user_id = the subject',
  // Build 3 integration (lanes A × B): the composer's private line.
  'lib/chat-private.ts': 'the ONE place the column’s name is written (CHAT_PRIVATE_RECIPIENT_COLUMN) — a constant, no I/O',
  'lib/chat.ts': 'fetchMessages SELECTS the column on the caller’s client so a bubble can be drawn private; the session callers are bound by the restrictive policy, the one service-role caller filters (test below)',
  'app/dev/_components/lab-picked-chat.tsx': 'a dev-lab fixture row (no database; production 404s /dev)',
  // A READ FILTER, not a writer: the admin replies as a demo shop through the service role, so it keeps only the shop's
  // own view — proved by 'a service-role read of a thread keeps only what its viewer may read' below.
  'app/admin/demo-vendors/inquiries/[threadId]/page.tsx': 'filters a service-role thread read down to the shop’s own view',
};

/**
 * Files that WRITE a private line, each with its proof in this file. A writer is
 * never metadata: its notice and its AI wake-up are pinned by the test below.
 */
const WRITES_A_PRIVATE_LINE: Record<string, string> = {
  'lib/chat-send.ts': 'sendChatMessageCore — words only, no AI, notice to the recipient only (proved below)',
};

/**
 * Every code mention (comments stripped) of the private-message column — its
 * name, or the constant that carries it (a writer that spreads
 * `[CHAT_PRIVATE_RECIPIENT_COLUMN]` never spells the name).
 */
function mentionsOfRecipient(code: string): number {
  return [...stripComments(code).matchAll(/\brecipient_user_id\b|\bCHAT_PRIVATE_RECIPIENT_COLUMN\b/g)].length;
}

test('the scanner sees a written recipient and ignores prose about one (sabotage)', () => {
  assert.equal(mentionsOfRecipient(`// recipient_user_id is set by the browser\n/* recipient_user_id */ const a = 1;`), 0);
  assert.equal(
    mentionsOfRecipient(`await supabase.from('chat_messages').insert({ thread_id, body, recipient_user_id: to });`),
    1,
  );
  assert.equal(mentionsOfRecipient(`q.is('recipient_user_id', null)`), 1);
  // The constant counts too — a writer that never spells the name is still seen.
  assert.equal(mentionsOfRecipient(`insert({ body, ...(to ? { [CHAT_PRIVATE_RECIPIENT_COLUMN]: to } : {}) })`), 1);
  // On a REAL module that writes chat lines but no recipient (the change-approval card), in memory: adding one is caught.
  const realFile = fs.existsSync(path.join(HERE, 'chat-actions.ts')) ? path.join(HERE, 'chat-actions.ts') : '';
  assert.ok(realFile, 'chat-actions.ts moved — re-point this sabotage');
  const real = fs.readFileSync(realFile, 'utf8');
  assert.equal(mentionsOfRecipient(real), 0, 'chat-actions.ts names the column — judge it above');
  const sabotaged = real.replace('const preview = args.body.slice(0, 140);', "const preview = args.body.slice(0, 140); const r = 'recipient_user_id';");
  assert.notEqual(sabotaged, real, 'sabotage anchor moved');
  assert.equal(mentionsOfRecipient(sabotaged), 1);
});

test('notices: only the proven writer names the column, so the fan-out never carries a private line', () => {
  const roots = ['app', 'lib', 'components', 'hooks'].map((d) => path.join(WEB, d)).concat(path.join(REPO, 'apps', 'mobile'));
  const files = roots.flatMap((r) => walk(r));
  assert.ok(files.length > 1000, `only ${files.length} files walked — the scanner stopped seeing the app`);
  const hits = files
    .map((f) => ({ f: path.relative(WEB, f), n: mentionsOfRecipient(fs.readFileSync(f, 'utf8')) }))
    .filter((x) => x.n > 0);
  console.log(`recipient_user_id mentions in app code: ${JSON.stringify(hits)}`);
  const unjudged = hits.filter((x) => !(x.f in NAMES_THE_COLUMN_AS_METADATA) && !(x.f in WRITES_A_PRIVATE_LINE)).map((x) => x.f);
  assert.deepEqual(
    unjudged,
    [],
    'This code now names chat_messages.recipient_user_id. If it WRITES a private line, its notice must go to the ' +
      'recipient ONLY — never through notifyOtherParty (lib/chat-actions.ts), which notifies the whole shop or ' +
      'every host on the event with the body as the preview — and the AI (lib/vendor-autoreply/*) must not read it. ' +
      'If it READS with the service role, it must filter recipient_user_id itself. Decide, then add the file ' +
      'to NAMES_THE_COLUMN_AS_METADATA only if it is metadata, or extend this test with the new path’s proof.',
  );
  // Every allowlisted file is still a hit — a stale entry would let a writer hide there.
  const seen = new Set(hits.map((x) => x.f));
  assert.deepEqual(
    [...Object.keys(NAMES_THE_COLUMN_AS_METADATA), ...Object.keys(WRITES_A_PRIVATE_LINE)].filter((f) => !seen.has(f)),
    [],
    'stale entries',
  );
});

test('notices: the fan-out notifies every host, and a private line leaves before it (recipient only)', () => {
  const src = stripComments(fs.readFileSync(path.join(HERE, 'chat-actions.ts'), 'utf8'));
  const fn = src.slice(src.indexOf('export async function notifyOtherParty'), src.indexOf('async function findPriorLockedEventName'));
  assert.ok(fn.length > 200, 'notifyOtherParty moved — re-point this test');
  // 👥 Since 20271330575424 a host reads a supplier chat only as its MEMBER, so the shop's message tells the hosts IN
  // this thread (`readThreadHostPeople`) — no longer every host of the event, who would get a preview of a conversation
  // they are not in, or left (chat gaps, 8 Nov 2026).
  assert.match(
    fn,
    /readThreadHostPeople\(admin, \{ threadId: args\.threadId, eventId: args\.eventId \}\)[\s\S]*?for \(const userId of told\.hostsAsBefore\)/,
    'the supplier side notifies every host in this thread',
  );
  assert.match(fn, /const preview = args\.body\.slice\(0, 140\)/, 'the notice carries the body');
  // The private branch: ONE notice, to args.privateTo, then return — before ANY fan-out.
  const branch = /if \(args\.privateTo\) \{([\s\S]*?)\n  \}\n/.exec(fn);
  assert.ok(branch, 'notifyOtherParty has no private branch — a private line would ride the fan-out');
  const body = branch[1]!;
  assert.equal([...body.matchAll(/emitNotification\(/g)].length, 1, 'the private branch notifies more than one person');
  assert.match(body, /userId: args\.privateTo,/, 'the private notice is not addressed to the recipient');
  assert.match(body, /\n    return;\s*$/, 'the private branch does not return — it falls through to the fan-out');
  const at = fn.indexOf(branch[0]);
  assert.ok(at < fn.indexOf('readThreadHostPeople('), 'the private branch runs AFTER the hosts are read');
  assert.ok(at < fn.indexOf("if (args.senderRole === 'couple')"), 'the private branch runs after the shop fan-out begins');
  // …and the send core: the recipient rides the row only as the gated spread, never with a file, never to the AI,
  // and the same `privateTo` is what the notice gets.
  const send = stripComments(fs.readFileSync(path.join(HERE, 'chat-send.ts'), 'utf8'));
  const insert = /\.from\('chat_messages'\)\.insert\(\{([\s\S]*?)\}\);/.exec(send)?.[1] ?? '';
  assert.deepEqual(
    insert.split(/,\n/).map((s) => s.trim().replace(/,$/, '')).filter(Boolean),
    [
      'thread_id: thread.thread_id',
      'event_id: thread.event_id',
      'vendor_profile_id: thread.vendor_profile_id',
      'body: trimmed',
      '...(attachment ?? {})',
      '...(privateTo ? { [CHAT_PRIVATE_RECIPIENT_COLUMN]: privateTo } : {})',
    ],
    'sendChatMessageCore’s row changed — re-prove where a recipient can come from',
  );
  assert.match(send, /if \(privateTo\) \{\s*if \(hasAttachment \|\| storedRef\) \{\s*return \{ ok: false, code: 'private_words_only'/, 'a private line may carry a file');
  assert.match(send, /if \(senderRole === 'couple' && !privateTo && vendorAutoReplyEnabled\(\)\)/, 'a private line wakes the AI');
  assert.match(send, /await notifyOtherParty\(\{[\s\S]*?\n    privateTo,\n  \}\);/, 'the notice is not told the line is private');
});

test('a service-role read of a thread keeps only what its viewer may read', () => {
  // The admin replies AS a demo shop through the service role — the policy cannot bind it, so the page filters.
  const f = 'app/admin/demo-vendors/inquiries/[threadId]/page.tsx';
  const code = stripComments(fs.readFileSync(path.join(WEB, f), 'utf8'));
  assert.match(code, /fetchMessages\(admin, threadId\)\)\.filter\(/, `${f}: the service-role read is not filtered`);
  assert.match(code, /!m\.recipient_user_id \|\|/, `${f}: shared lines are not the base of the filter`);
  assert.match(code, /m\.recipient_user_id === shopUserId \|\| m\.sender_user_id === shopUserId/, `${f}: keeps private lines the shop is not party to`);
  // No OTHER service-role caller of fetchMessages exists.
  const callers = ['app', 'lib'].flatMap((d) => walk(path.join(WEB, d)))
    .filter((p) => /fetchMessages\(\s*(admin|adminClient|service)\b/.test(stripComments(fs.readFileSync(p, 'utf8'))))
    .map(rel);
  assert.deepEqual(callers, [f], 'a new service-role fetchMessages caller — filter it like the demo inquiry page, then list it here');
});

// ── 2 · digest ──────────────────────────────────────────────────────────────

/** Every module a digest entry reaches through value imports (`@/` and relative). */
function importClosure(entries: string[]): string[] {
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? path.join(WEB, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
    if (!base) return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
  };
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const code = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of code.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const r = resolve(f, (m[1] ?? m[2])!);
      if (r) queue.push(r);
    }
  }
  return [...seen];
}

/** A read of a chat line, or of a count built from them. */
function chatReads(code: string): string[] {
  return [
    ...stripComments(code).matchAll(
      /\.from\(\s*['"]chat_messages['"]\s*\)|\.rpc\(\s*['"](count_unread_message_threads|unread_message_threads_by_(event|vendor))['"]/g,
    ),
  ].map((m) => m[0]);
}

const DIGESTS: Record<string, { entry: string; floor: number }> = {
  'the admin morning digest (email)': { entry: 'lib/admin/digest-flush.ts', floor: 10 },
  'the daily email jobs (anniversary digest and friends)': { entry: 'lib/daily-email-jobs.ts', floor: 100 },
  'the account’s weekly AI digest': { entry: 'lib/setnayan-ai-snapshot.ts', floor: 10 },
};

test('the digest scanner sees a chat read (sabotage)', () => {
  assert.deepEqual(chatReads(`const x = await admin.from('chat_messages').select('body');`), [".from('chat_messages')"]);
  assert.equal(chatReads(`await admin.rpc('count_unread_message_threads')`).length, 1);
  assert.equal(chatReads(`// .from('chat_messages') in prose`).length, 0);
  // …and the walker really follows imports (digest-flush → queue-counts).
  const closure = importClosure([path.join(HERE, 'admin/digest-flush.ts')]).map(rel);
  assert.ok(closure.includes('lib/admin/queue-counts.ts'), 'the walker lost digest-flush → queue-counts');
});

test('digest: no digest module, nor anything it imports, reads a chat line or an unread count', () => {
  for (const [name, { entry, floor }] of Object.entries(DIGESTS)) {
    const files = importClosure([path.join(WEB, entry)]);
    assert.ok(files.length >= floor, `${name}: only ${files.length} modules walked from ${entry}`);
    const hits = files.flatMap((f) => chatReads(fs.readFileSync(f, 'utf8')).map((h) => `${rel(f)} · ${h}`));
    console.log(`${name}: ${files.length} modules, chat reads: ${JSON.stringify(hits)}`);
    assert.deepEqual(
      hits,
      [],
      `${name} now reads chat lines. A digest is built with the service role, so a private line would be counted or ` +
        'quoted for people it was not written to: filter recipient_user_id (shared OR to the digest’s reader), then prove it.',
    );
  }
});

// ── 3 · search ──────────────────────────────────────────────────────────────

/**
 * The reads whose rows become an inbox preview — the text `matchesSearch`
 * (supplier column, couple column) searches. The couple's full inbox searches
 * names only (lib/chat-inbox-search.ts; held by the-chat-inbox-is-one-search.test.ts).
 */
const PREVIEW_READS = [
  'lib/vendor-conversation-inputs.server.ts',
  'app/dashboard/[eventId]/messages/page.tsx',
  'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
];

/** The receiver of every `.from('chat_messages')` in `code` — the identifier the chain hangs off. */
function chatMessageReceivers(code: string): string[] {
  const src = stripComments(code);
  return [...src.matchAll(/([A-Za-z_$][\w$]*)\s*\.from\(\s*'chat_messages'\s*\)/g)].map((m) => m[1]!);
}

test('the receiver scanner names the client a chain hangs off (sabotage)', () => {
  assert.deepEqual(chatMessageReceivers(`supabase\n  .from('chat_messages')`), ['supabase']);
  assert.deepEqual(chatMessageReceivers(`await admin.from('chat_messages').select('*')`), ['admin']);
  // On the REAL supplier preview read, in memory: moving it to the service role is caught.
  const real = fs.readFileSync(path.join(WEB, 'lib/vendor-conversation-inputs.server.ts'), 'utf8');
  const sabotaged = real.replace(/supabase(\s*\.from\('chat_messages'\))/, 'adminClient$1');
  assert.notEqual(sabotaged, real, 'sabotage anchor moved');
  assert.deepEqual(chatMessageReceivers(sabotaged), ['adminClient']);
});

test('search: every read that feeds a searchable preview is the viewer’s own session', () => {
  for (const f of PREVIEW_READS) {
    const code = fs.readFileSync(path.join(WEB, f), 'utf8');
    const receivers = chatMessageReceivers(code);
    assert.ok(receivers.length >= 1, `${f}: no chat_messages read found — re-point PREVIEW_READS`);
    assert.deepEqual(
      receivers.filter((r) => r !== 'supabase'),
      [],
      `${f}: a preview read runs on "${receivers.join(', ')}". The restrictive policy that keeps a private line ` +
        'between two people only binds the viewer’s session; a service-role preview is searchable by anyone in the list.',
    );
    if (f.startsWith('app/')) {
      assert.match(stripComments(code), /const supabase = await createClient\(\);/, `${f}: \`supabase\` is not the session client`);
    }
  }
  // The supplier-side reader is handed `supabase` by both callers — the session client in each.
  for (const caller of ['app/vendor-dashboard/messages/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    const code = stripComments(fs.readFileSync(path.join(WEB, caller), 'utf8'));
    assert.match(code, /readVendorConversationInputs\(\{\s*supabase,/, `${caller}: passes something else as \`supabase\``);
    assert.match(code, /const supabase = await createClient\(\);/, `${caller}: \`supabase\` is not the session client`);
  }
});
