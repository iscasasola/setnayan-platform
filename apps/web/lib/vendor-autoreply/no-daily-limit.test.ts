/**
 * 🚫 THE AUTO-REPLY HAS NO PER-DAY LIMIT — NOT SHOWN, NOT ENFORCED (owner 2026-10-23).
 *
 * Owner, verbatim, on the supplier's Auto-reply fold: *"why do we limit the auto reply? and too many
 * words. we agreed to place all info that is possible inside (i) and if you add description outside
 * should be at minimum"*. Same day's ruling on plans: nothing that brings bookings is limited.
 *
 * The fold used to carry a "Daily reply cap" (30) and a "Daily auto-accept cap" (10), each with its
 * own Save button, and the engine stopped answering — silently — once a shop hit either. Both are
 * gone. There is deliberately no hidden platform ceiling in their place: a reply is string
 * substitution over the shop's own rows (`phrasings.ts` forbids a model call per reply), so it costs
 * ₱0, and it cannot loop (only a COUPLE message triggers it; the bot posts as the supplier).
 *
 * What this file holds — four PROPERTIES, each of which a re-added cap would break:
 *   1. the gate answers a couple however busy the day was (no count is an input at all);
 *   2. no runtime file reads the two retired columns, or counts "today" (`created_at >=` a day start);
 *   3. the settings parser never writes either retired column, whatever a stale tab posts;
 *   4. the fold shows no number field and no daily wording, and each control is a title + at most
 *      ONE short line outside its ⓘ — everything else lives inside the InfoTip.
 *
 * The columns themselves stay in `vendor_bot_config` (DEFAULT 30 / 10, unread): dropping them is a
 * production migration that buys nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateAutoReplyGate } from './inbox-decision';
import { evaluateAutoAccept } from './auto-accept-decision';
import { parseAutoReplyConfigForm } from './config';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Code only: block and line comments removed, so a docblock that EXPLAINS the retirement never trips it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const RUNTIME_FILES = [
  ...readdirSync(HERE)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `lib/vendor-autoreply/${f}`),
  'app/vendor-dashboard/shop/autoreply-actions.ts',
  'app/vendor-dashboard/shop/_components/autoreply-section.tsx',
  'app/vendor-dashboard/shop/_components/autoreply-card.tsx',
];

test('1 · the gate answers a couple however busy the day was — no count is even an input', () => {
  const gate = evaluateAutoReplyGate({
    flagEnabled: true,
    senderRole: 'couple',
    addonActive: true,
    // A stale caller passing the retired fields must not be able to stop it.
    config: { enabled: true, dailyReplyCap: 0 } as unknown as { enabled: boolean },
    repliesToday: 10_000,
  } as unknown as Parameters<typeof evaluateAutoReplyGate>[0]);
  assert.deepEqual(gate, { run: true });

  const accept = evaluateAutoAccept({
    flagEnabled: true,
    config: { autoAcceptEnabled: true, threshold: 78, dailyCap: 0 } as unknown as {
      autoAcceptEnabled: boolean;
      threshold: number;
    },
    inquiryStatus: 'pending',
    compatScore: 90,
    trustFlagged: false,
    tierEligible: true,
    tokenAvailable: true,
    autoAcceptsToday: 10_000,
  } as unknown as Parameters<typeof evaluateAutoAccept>[0]);
  assert.deepEqual(accept, { accept: true });
});

test('2 · no runtime file reads the retired columns or counts "today"', () => {
  assert.ok(RUNTIME_FILES.length >= 10, `expected the whole engine in scope, got ${RUNTIME_FILES.length}`);
  const offenders: string[] = [];
  for (const rel of RUNTIME_FILES) {
    const src = code(read(rel));
    for (const [what, re] of [
      ['reads daily_reply_cap', /daily_reply_cap/],
      ['reads daily_auto_accept_cap', /daily_auto_accept_cap/],
      ['counts from the start of a day', /startOfManilaDay|\.gte\(\s*['"]created_at['"]/],
      ['compares against a per-day limit', /\b(?:dailyCap|dailyReplyCap|dailyAutoAcceptCap|repliesToday|acceptsToday|autoAcceptsToday)\b/],
    ] as const) {
      if (re.test(src)) offenders.push(`${rel}: ${what}`);
    }
  }
  assert.deepEqual(offenders, [], `a per-day limit is back:\n  ${offenders.join('\n  ')}`);
});

test('3 · the settings parser never writes either retired column, whatever is posted', () => {
  const fd = new FormData();
  fd.set('enabled', 'true');
  fd.set('daily_reply_cap', '0');
  fd.set('daily_auto_accept_cap', '0');
  const res = parseAutoReplyConfigForm(fd);
  assert.ok(res.ok);
  assert.deepEqual(Object.keys(res.patch).sort(), ['enabled']);
});

/** Each `data-autoreply-control` block of the card, with its InfoTip(s) cut out. */
function controlsOutsideTips(src: string): { name: string; outside: string }[] {
  const body = code(src);
  const marks = [...body.matchAll(/data-autoreply-control="([a-z-]+)"/g)];
  return marks.map((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < marks.length ? (marks[i + 1].index ?? body.length) : body.indexOf('function Switch', start);
    const block = body.slice(start, end < 0 ? body.length : end);
    return { name: m[1], outside: block.replace(/<InfoTip[\s\S]*?<\/InfoTip>/g, '') };
  });
}

test('4 · the fold shows no limit, and each control is a title + at most one short line outside ⓘ', () => {
  const card = read('app/vendor-dashboard/shop/_components/autoreply-card.tsx');
  const body = code(card);

  // No number field to type a limit into, and no daily wording anywhere a supplier can read it.
  assert.doesNotMatch(body, /type=["']number["']/, 'a number field is back on the fold');
  const strings = [...body.matchAll(/(['"`])((?:(?!\1).){3,})\1|>([^<>{}]{3,})</g)]
    .map((m) => (m[2] ?? m[3] ?? '').trim())
    .filter(Boolean);
  const daily = strings.filter((s) => /\b(?:cap|caps|daily|per day|a day|today)\b/i.test(s));
  assert.deepEqual(daily, [], `daily-limit wording on the fold: ${JSON.stringify(daily)}`);

  // Every control carries its ⓘ, and outside it at most ONE line of at most eight words.
  const controls = controlsOutsideTips(card);
  assert.deepEqual(
    controls.map((c) => c.name),
    ['assistant', 'auto-accept', 'threshold'],
    'the fold is three controls',
  );
  for (const c of controls) {
    const full = body.slice(body.indexOf(`data-autoreply-control="${c.name}"`));
    assert.match(full.slice(0, full.indexOf('</InfoTip>') + 1), /<InfoTip/, `${c.name} has no ⓘ`);
    assert.doesNotMatch(c.outside, /<(?:ul|ol|li)\b/, `${c.name} has a list outside its ⓘ`);
    const lines = [...c.outside.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
    assert.ok(lines.length <= 1, `${c.name} has ${lines.length} lines outside its ⓘ (max 1)`);
    for (const [, text] of lines) {
      // A line may be a ternary of two literals ({on ? '…' : '…'}) — each is one line, counted alone.
      const literals = [...text.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      const words = (literals.length > 0 ? literals : [text]).map(
        (t) => t.trim().split(/\s+/).filter(Boolean).length,
      );
      const longest = Math.max(...words);
      assert.ok(longest <= 8, `${c.name}'s line runs ${longest} words (max 8)`);
    }
  }
});
