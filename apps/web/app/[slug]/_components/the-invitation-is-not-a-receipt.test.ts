/**
 * the-invitation-is-not-a-receipt.test.ts — AP-3.
 *
 * WHAT WAS WRONG. The labels a guest reads on an invitation were set in DM Mono
 * — a monospaced DATA face. Measured on two live guest pages 2026-08-24, these
 * are the mono words a real guest actually meets.
 *
 * 🔒 THE SCOPE IS EXACTLY H-2'S, APPLIED WHERE IT IS NOT GATED. Size, tracking,
 * uppercase and tone all stay; ONLY THE FACE CHANGES, to the editorial sans.
 * Delegated call #5 of 2026-08-23 already settled the direction ("sans not DM
 * Mono"). A small tracked label is a normal editorial device — the typewriter
 * face is what made it a receipt. This file asserts the restraint as hard as it
 * asserts the change: a mutation that ALSO drops the size, the tracking or the
 * case goes red.
 *
 * 🔢 MONO KEEPS DIGITS AND LOSES WORDS — D-8's rule, guest-side. The moment's
 * time label is a VALUE and deliberately stays in mono.
 *
 * ⛔ AND THREE THINGS ARE PROTECTED, EACH PINNED BELOW, because the whole risk
 * of an item like this is that it creeps into a decision somebody already made:
 *   · the 0.66rem gild section eyebrows (explicitly protected)
 *   · the film's small announcements + its "press and hold" pill — that is H-2,
 *     OWNER-GATED, the cinematic look is approved and paid for
 *   · the "Created at Setnayan" watermark
 *
 * ⚠ AP-3 IS NOT A WHOLE-TREE SWEEP, AND THAT IS A MEASUREMENT NOT A SHORTCUT.
 * `font-mono` appears 153 times across 42 files in the guest tree once the film,
 * the reveal and the gild eyebrows are excluded. Three of those files were open
 * in another session's pull request while this was written. What ships here is
 * the set a guest demonstrably reads on a live invitation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const GUEST = join(WEB, 'app', '[slug]');

const IN_SCOPE = ['countdown.tsx', 'tier-comparison-widget.tsx', 'photo-moments-widget.tsx'];

/** Comments here name the defect and the old face; a raw grep would match the
 *  explanation and report the bug it just fixed. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const scoped = (f: string) => code(join(HERE, f));

test('🔴 the invitation’s own labels are off the data face', () => {
  for (const f of IN_SCOPE) {
    const src = scoped(f);
    const mono = src.match(/font-mono/g) ?? [];
    // Exactly one may remain, and only in the file that renders a time VALUE.
    const allowed = f === 'photo-moments-widget.tsx' ? 1 : 0;
    assert.equal(
      mono.length,
      allowed,
      `${f} still sets ${mono.length} label(s) in the monospaced data face ` +
        `(allowed here: ${allowed})`,
    );
  }
});

test('🔢 the one mono that stays is a VALUE, not a word', () => {
  const src = scoped('photo-moments-widget.tsx');
  // Mono keeps digits. If this ever stops being the time label, the exception
  // has been reused for a word and the rule has quietly gone.
  const line = src.split('\n').find((l) => l.includes('font-mono'));
  assert.notEqual(line, undefined, 'the data-label exception disappeared entirely');
  const idx = src.split('\n').findIndex((l) => l.includes('font-mono'));
  const window = src.split('\n').slice(idx, idx + 3).join('\n');
  assert.match(
    window,
    /\{m\.time_label\}/,
    'the surviving font-mono is no longer the moment’s time value — mono keeps ' +
      'digits and loses words, so a word wearing it means the exception was reused',
  );
});

test('🔒 ONLY the face changed — size, tracking, case and tone all stayed', () => {
  // The restraint is the point. A "tidy-up" that also flattened these would be
  // a different, unrequested design change riding along.
  const countdown = scoped('countdown.tsx');
  assert.match(countdown, /font-sans text-xs uppercase tracking-\[0\.2em\] text-terracotta/,
    'the countdown heading lost its size, case, tracking or tone — only the face may change');
  assert.match(countdown, /font-sans text-xs uppercase tracking-\[0\.15em\] text-ink\/50/,
    'the countdown unit labels lost their size, case, tracking or tone');
  const tier = scoped('tier-comparison-widget.tsx');
  assert.match(tier, /font-sans text-xs uppercase tracking-\[0\.2em\] text-ink\/55/,
    'the access heading lost its size, case, tracking or tone');
  const moments = scoped('photo-moments-widget.tsx');
  assert.match(moments, /font-sans text-xs uppercase tracking-\[0\.2em\] text-ink\/55/,
    'the moments heading lost its size, case, tracking or tone');
});

test('the countdown’s digits were never mono and still are not', () => {
  // The tell that mono was doing no work here: the NUMBERS already used the
  // display face with tabular figures. Mono carried only the words.
  assert.match(
    scoped('countdown.tsx'),
    /font-pahina[^"]*tabular-nums/,
    'the countdown digits lost their tabular display face — they will jitter as ' +
      'the seconds tick',
  );
});

test('⛔ the PROTECTED 0.66rem gild eyebrows are untouched across the guest tree', () => {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p);
    }
  })(GUEST);
  const gild = files.reduce(
    (n, f) => n + (readFileSync(f, 'utf8').match(/font-mono text-\[0\.66rem\]/g) ?? []).length,
    0,
  );
  assert.equal(
    gild,
    19,
    `the guest tree carries ${gild} of the 0.66rem gild section eyebrows; it ` +
      `carried 19 when AP-3 shipped. They are an explicitly PROTECTED design ` +
      `decision — AP-3 must not have crept into them. If a legitimate change ` +
      `moves this number, change it here deliberately and say why.`,
  );
});

test('⛔ the OWNER-GATED film face and its pill are untouched', () => {
  const themes = readFileSync(join(WEB, 'lib', 'std-themes.ts'), 'utf8');
  assert.match(
    /labelCls: '([^']*)'/.exec(themes)?.[1] ?? '',
    /^font-mono /,
    'lib/std-themes.ts labelCls left DM Mono — that is H-2, it is OWNER-GATED, ' +
      'and it must not ride along with AP-3',
  );
  const film = readFileSync(join(HERE, 'save-the-date-film.tsx'), 'utf8');
  assert.match(
    film,
    /font-mono text-sm uppercase tracking-\[0\.16em\] text-cream\/90/,
    'the film’s "press and hold to pause" pill left the mono face — that is ' +
      'named in H-2’s scope and is OWNER-GATED',
  );
  assert.match(
    film,
    /font-mono text-\[9px\] uppercase tracking-\[0\.3em\]/,
    'the "Created at Setnayan" watermark left the mono face — explicitly protected',
  );
});
