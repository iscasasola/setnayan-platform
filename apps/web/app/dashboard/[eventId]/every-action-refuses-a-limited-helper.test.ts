/**
 * EVERY SERVER ACTION UNDER THE EVENT DASHBOARD ASKS THE LIMITED-HELPER GATE.
 *
 * Owner ruling 2026-09-28: a Limited helper *"may view but may not edit"*. Live
 * report 2026-10-25: a helper on his own event *"can change table, delete
 * guests, and more"*. The database refused those writes — and a refused UPDATE
 * under RLS is an EMPTY SUCCESS (the edge log shows `PATCH /guests` → 200, zero
 * rows), so each action returned normally and the screen showed the change.
 * Actions that write with the service-role client are not fenced by RLS at all.
 * `lib/limited-helper-gate.ts` has the full account.
 *
 * Owner, 2026-10-26: *"Limited helpers can view but not change anything.
 * limited helpers capabilities depend on the settings on their event
 * details"* — so the gate names the AREA each action changes, and a helper the
 * host set to Edit on that area (Event Details › Event access) passes.
 *
 * ── THE PROPERTY ──────────────────────────────────────────────────────────
 * Every exported function of every `'use server'` file under
 * `app/dashboard/[eventId]` either
 *   · CALLS `refuseLimitedHelper(eventId, area)` (throws the refusal), or
 *   · assigns `limitedHelperRefusal(eventId, area)` and RETURNS on it,
 * both imported from `@/lib/host-gate`, with `area` EXACTLY the one
 * `AREA_RULES` below gives that action — or it is listed in `NO_EVENT_WRITE`
 * with the reason it changes nothing on the event. `AREA_RULES` IS the map of
 * every write path to its area; change an action's area here, not at the call.
 *
 * ── WHY IT IS BUILT THIS WAY (hub-a-guard-can-face-the-wrong-thing) ───────
 *   · The file set is DERIVED from the tree and FLOORED — a sweep that stops
 *     seeing files fails instead of passing.
 *   · Anchored PER FUNCTION, through the TypeScript AST: a gate in one action
 *     cannot vouch for its neighbour, and a gate named in a comment or a string
 *     is not a call expression, so it cannot satisfy this.
 *   · "Does this function write?" is NOT asked — a write is usually a call into
 *     `lib/`, which no source scan can follow. The safe question is the other
 *     one: every action is gated unless a person wrote down why it is not.
 *   · An allowlisted name that disappears, or that starts calling the gate,
 *     fails too — the list cannot rot into cover for something else.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import type { DelegateArea } from '@/lib/delegate-areas';

const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * Actions that change nothing on the event — a read, a search, a preview, or a
 * write to the CALLER'S OWN record — or that are refused for a helper by a
 * couple-only check the helper cannot pass. Key: path under
 * app/dashboard/[eventId] + '#' + export name.
 */
const NO_EVENT_WRITE: Record<string, string> = {
  'delete-actions.ts#getEventDeletionImpact': 'read: counts what a delete would remove',
  'actions.ts#previewPersonalizationConflicts': 'read: a preview, writes nothing',
  'studio/patiktok/actions.ts#matchPatiktokFace': 'read: face lookup, returns a guest',
  'studio/mood-board/actions.ts#readMoodboardThemeDescription': 'read: parses text',
  'studio/mood-board/actions.ts#fetchThemeTemplates': 'read: template catalogue',
  'studio/mood-board/actions.ts#fetchGalleryAssets': 'read: gallery catalogue',
  'vendors/requirements-actions.ts#loadCategoryRequirements': 'read',
  'vendors/build-3state-fallback-actions.ts#findBuildFallbackSuggestions': 'read: suggestions',
  'vendors/actions.ts#listLockTimeSlots': 'read: a supplier’s free slots',
  'vendors/actions.ts#searchMarketplaceVendorsByName': 'read: marketplace search',
  'vendors/actions.ts#locateAddressPin': 'read: geocodes an address',
  'vendors/actions.ts#loadCoverCatalog': 'read',
  'vendors/actions.ts#loadSelfAddedSupplier': 'read',
  'vendors/actions.ts#readSupplierInvite': 'read: the pending invite link + QR',
  'vendors/actions.ts#withdrawVendorLockRequest':
    'couple-only at the database: cancel_vendor_lock_request raises not_your_event for anyone outside current_couple_event_ids(), and a helper is a coordinator',
  'vendors/_actions/reuse-actions.ts#listReusableBookings': 'read',
  'vendors/_actions/reuse-actions.ts#acceptVendorReuseForm':
    'couple-only: acts only on events in coupleEventIds() (member_type couple); a helper is a coordinator',
  'vendors/_actions/reuse-actions.ts#cancelVendorReuseForm':
    'couple-only: acts only on events in coupleEventIds() (member_type couple); a helper is a coordinator',
  'vendors/_actions/pay-sheet.ts#loadPaySheet': 'read',
  'vendors/_actions/bench-marketplace-search.ts#searchMarketplaceForBench': 'read: marketplace search',
  'vendors/_actions/fact-sheet.ts#openFactSheet': 'read: opens a sheet',
  'vendors/_actions/inline-more-row.ts#fetchInlineMoreRow': 'read',
  'schedule/actions.ts#generateEmceeScript': 'read: composes a script from the schedule, saves nothing',
  '_components/home-cards/hub-pick-actions.ts#readHomeHubPick': 'read',
  'seating/actions.ts#getReceptionDecorLayerCatalog': 'read: catalogue',
  'guests/checkin/actions.ts#checkTicketLive': 'read: a ticket verdict at the door',
  'guests/people-add-actions.ts#listPeopleYouCanInvite': 'read',
  'guests/open-guest-card.tsx#openGuestCard': 'read: renders the guest card',
  '_components/open-event-settings.tsx#openEventSettings': 'read: renders Home’s Event Settings rows (couple only) — its editors write through their own gated doors',
  'studio/papic/actions.ts#papicBuySizes': 'read: price rungs',
  'checkout/actions.ts#applyVoucherAction': 'read: prices a voucher code, records nothing',
  'studio/live-studio-control/actions.ts#setYoutubeLiveReadyAck': 'writes only the caller’s own users row',
  '_actions/share-consent.ts#revokeShareConsent': 'acts on the caller’s own consent row by id (RLS-scoped), not on the event',
};


/**
 * WHICH AREA EACH ACTION CHANGES — the areas of Event Details › Event access
 * (`lib/delegate-areas.ts`). First match wins; a key with '#' names one export.
 * null = no area: the hosts' alone (event details, the hub's settings, hosts and
 * access, purchases, Live/Panood, deletion…), so a helper is always refused.
 * Today a host can set only Guest list · Seat plan · The Day · Suppliers to Edit
 * (`areaChoices`); the other areas are mapped anyway so the day a dropdown
 * grows an Edit, the gate already asks the right question.
 */
const AREA_RULES: ReadonlyArray<readonly [string, DelegateArea | null]> = [
  // Granting co-host / helper access is the hosts' — never the guest-list area.
  ['guests/[guestId]/access-actions.ts', null],
  // "Arrange tables and seats. Publishing the plan stays with you." (DELEGATE_AREA_DOES.seat_plan)
  ['seating/actions.ts#publishSeating', null],
  ['seating/actions.ts#unpublishSeating', null],
  // Unlocking a category is a purchase, not a supplier edit.
  ['vendors/_actions/unlock-category.ts', null],
  // The couple's own review of a supplier.
  ['vendors/[vendorId]/review/', null],
  ['guests/', 'guest_list'],
  ['seating/', 'seat_plan'],
  ['studio/indoor-blueprint/', 'seat_plan'],
  ['schedule/', 'schedule'],
  ['studio/playlist/', 'schedule'],
  ['_actions/day-of-broadcast.ts', 'schedule'],
  ['vendors/', 'vendors'],
  ['manpower/', 'vendors'],
  ['messages/', 'vendors'],
  ['progress/_actions/free-venue-shortlist.ts', 'vendors'],
  ['budget/', 'budget'],
  ['studio/mood-board/', 'mood_board'],
  ['website/', 'invitations'],
  ['invitation/', 'invitations'],
  ['studio/save-the-date/', 'invitations'],
  ['launch/', 'invitations'],
  ['event-qr/', 'invitations'],
  ['monogram/', 'invitations'],
  ['studio/papic/', 'photos'],
  ['studio/patiktok/', 'photos'],
  ['studio/photo-delivery/', 'photos'],
  ['alaala/', 'photos'],
];

function areaOf(key: string): DelegateArea | null {
  for (const [p, a] of AREA_RULES) {
    if (p.includes('#') ? key === p : key.startsWith(p)) return a;
  }
  return null;
}

const GATES = new Set(['refuseLimitedHelper', 'limitedHelperRefusal']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.harness\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

type Finding = { key: string; problem: string };

/** Is `name` imported from '@/lib/host-gate' in this file (and not shadowed by a local declaration)? */
function gateImports(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    if (!ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== '@/lib/host-gate') continue;
    const nb = st.importClause?.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        const imported = (el.propertyName ?? el.name).text;
        if (GATES.has(imported) && el.name.text === imported) names.add(imported);
      }
    }
  }
  return names;
}

/** Calls in THIS function's own body — nested functions are other code and do not count. */
function ownCalls(body: ts.Block): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (n: ts.Node) => {
    if (n !== body && (ts.isFunctionLike(n) || ts.isClassLike(n))) return;
    if (ts.isCallExpression(n)) calls.push(n);
    ts.forEachChild(n, visit);
  };
  visit(body);
  return calls;
}

function check(file: string, src: string): { actions: string[]; findings: Finding[] } {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = relative(ROOT, file).split('\\').join('/');
  const imported = gateImports(sf);
  const actions: string[] = [];
  const findings: Finding[] = [];
  for (const st of sf.statements) {
    if (!ts.isFunctionDeclaration(st) || !st.name || !st.body) continue;
    if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    const key = `${rel}#${st.name.text}`;
    actions.push(key);
    const calls = ownCalls(st.body).filter(
      (c) => ts.isIdentifier(c.expression) && GATES.has(c.expression.text) && imported.has(c.expression.text),
    );
    const allowed = Object.prototype.hasOwnProperty.call(NO_EVENT_WRITE, key);
    if (calls.length === 0) {
      if (!allowed) findings.push({ key, problem: 'writes without the limited-helper gate (call refuseLimitedHelper(eventId, area) first)' });
      continue;
    }
    if (allowed) findings.push({ key, problem: 'is gated AND allowlisted — drop it from NO_EVENT_WRITE' });
    for (const c of calls) {
      const arg = c.arguments[0];
      if (!arg || ts.isStringLiteralLike(arg) || arg.kind === ts.SyntaxKind.NullKeyword) {
        findings.push({ key, problem: 'calls the gate without the event it writes to' });
      }
      const areaArg = c.arguments[1];
      const want = areaOf(key);
      const got =
        areaArg && areaArg.kind === ts.SyntaxKind.NullKeyword
          ? null
          : areaArg && ts.isStringLiteralLike(areaArg)
            ? areaArg.text
            : undefined;
      if (got === undefined) findings.push({ key, problem: `names no area — pass ${want === null ? 'null' : `'${want}'`} (AREA_RULES)` });
      else if (got !== want) findings.push({ key, problem: `names area ${String(got)} but AREA_RULES gives ${String(want)}` });
      if (!ts.isAwaitExpression(c.parent)) findings.push({ key, problem: 'calls the gate without awaiting it — the write runs before the answer' });
      if ((c.expression as ts.Identifier).text === 'limitedHelperRefusal') {
        // const X = await limitedHelperRefusal(…); if (X) return …
        const decl = c.parent.parent;
        const name = ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) ? decl.name.text : null;
        const declStmt = name ? decl.parent?.parent : null;
        const block = declStmt?.parent;
        const idx = block && ts.isBlock(block) ? block.statements.indexOf(declStmt as ts.Statement) : -1;
        const next = idx >= 0 ? (block as ts.Block).statements[idx + 1] : undefined;
        const returnsOnIt =
          !!next &&
          ts.isIfStatement(next) &&
          ts.isIdentifier(next.expression) &&
          next.expression.text === name &&
          (ts.isReturnStatement(next.thenStatement) ||
            (ts.isBlock(next.thenStatement) && next.thenStatement.statements.some(ts.isReturnStatement)));
        if (!returnsOnIt) findings.push({ key, problem: 'asks limitedHelperRefusal but does not return on its answer' });
      }
    }
  }
  return { actions, findings };
}

const files = walk(ROOT).filter((f) => /^\s*['"]use server['"]/m.test(readFileSync(f, 'utf8').slice(0, 400)));

test('every dashboard server action asks the limited-helper gate (or says why it changes nothing)', () => {
  const all: string[] = [];
  const findings: Finding[] = [];
  for (const f of files) {
    const r = check(f, readFileSync(f, 'utf8'));
    all.push(...r.actions);
    findings.push(...r.findings);
  }
  // FLOORS — measured 2026-10-25: 131 'use server' files, 432 exported actions.
  assert.ok(files.length >= 120, `scan floor: only ${files.length} 'use server' files found`);
  assert.ok(all.length >= 400, `scan floor: only ${all.length} exported actions found`);
  const stale = Object.keys(NO_EVENT_WRITE).filter((k) => !all.includes(k));
  assert.deepEqual(stale, [], 'NO_EVENT_WRITE names an action that no longer exists — remove it');
  assert.deepEqual(
    findings.map((x) => `${x.key} — ${x.problem}`),
    [],
    'A limited helper views, and changes only the areas the host set to Edit (owner 2026-09-28 · 2026-10-26). Gate the ' +
      "action with `await refuseLimitedHelper(eventId, <its AREA_RULES area>)` from '@/lib/host-gate' as its first line, or — " +
      'when its screen prints `{ ok: false, error }` — `const helperRefusal = await limitedHelperRefusal(eventId, area); ' +
      'if (helperRefusal) return { ok: false, error: helperRefusal };`. Only a READ (or a write to the caller’s own row) goes in NO_EVENT_WRITE.',
  );
});

test('the checker convicts an ungated action, a comment-only gate and a gate in a nested function', () => {
  const file = join(ROOT, 'guests', 'probe-actions.ts');
  const head = `'use server';\nimport { refuseLimitedHelper, limitedHelperRefusal } from '@/lib/host-gate';\n`;
  const cases: Array<[string, RegExp]> = [
    [`export async function a(eventId: string) { await db.from('guests').update({}); }`, /without the limited-helper gate/],
    [`export async function a(eventId: string) { /* refuseLimitedHelper(eventId) */ await db.delete(); }`, /without the limited-helper gate/],
    [`export async function a(eventId: string) { const f = async () => { await refuseLimitedHelper(eventId, 'guest_list'); }; await db.delete(); }`, /without the limited-helper gate/],
    [`export async function a(eventId: string) { refuseLimitedHelper(eventId, 'guest_list'); await db.delete(); }`, /without awaiting/],
    [`export async function a(eventId: string) { await refuseLimitedHelper(); }`, /without the event/],
    [`export async function a(eventId: string) { await refuseLimitedHelper(eventId); }`, /names no area/],
    [`export async function a(eventId: string) { await refuseLimitedHelper(eventId, 'seat_plan'); }`, /names area seat_plan but AREA_RULES gives guest_list/],
    [`export async function a(eventId: string) { await refuseLimitedHelper(eventId, null); }`, /names area null but AREA_RULES gives guest_list/],
    [`export async function a(eventId: string) { const r = await limitedHelperRefusal(eventId, 'guest_list'); await db.delete(); }`, /does not return on its answer/],
  ];
  for (const [body, want] of cases) {
    const r = check(file, head + body);
    assert.equal(r.findings.length > 0, true, `not convicted: ${body}`);
    assert.match(r.findings.map((x) => x.problem).join(' | '), want, body);
  }
  // A gate imported from anywhere else is not the gate.
  const local = check(file, `'use server';\nasync function refuseLimitedHelper(_: unknown) {}\nexport async function a(eventId: string) { await refuseLimitedHelper(eventId, 'guest_list'); }`);
  assert.equal(local.findings.length, 1, 'a local look-alike passed for the gate');
  // And the two honest shapes pass.
  assert.deepEqual(check(file, head + `export async function a(eventId: string) { await refuseLimitedHelper(eventId, 'guest_list'); await db.delete(); }`).findings, []);
  assert.deepEqual(
    check(file, head + `export async function a(eventId: string) { const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');\n if (helperRefusal) return { ok: false, error: helperRefusal }; return { ok: true }; }`).findings,
    [],
  );
});
