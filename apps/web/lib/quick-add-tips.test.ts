import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuestInput } from './guest-parse';
import { quickAddTips } from './quick-add-tips';
import { WEDDING_ROLE_SET, resolveRoleSet } from './role-sets';

const WORDS = /(?:^|\s)(\+\d|#\w+|bride|groom|both|vip|ninong|ninang)(?=\s|$)/g;

test('the example line is read by the real parser exactly as the tips say', () => {
  const { example } = quickAddTips({ hasSides: true, offeredRoles: WEDDING_ROLE_SET.offeredRoles });
  const typed = example.replace(/^e\.g\. /, '');
  const d = parseGuestInput(typed);
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.lastName, 'Cruz', 'a word in the example is not a token the parser reads — it became part of the name');
  assert.equal(d.plusOnes, 1);
  assert.deepEqual(d.groups, ['Barkada']);
  assert.equal(d.side, 'groom');
});

test('a side word only where the event has sides; a role word only where the event offers it', () => {
  const none = quickAddTips({ hasSides: false, offeredRoles: [] });
  assert.doesNotMatch(none.example, /\b(bride|groom|both|ninang|ninong|vip)\b/, 'the example promises a word this event cannot use');
  assert.ok(!none.tips.some((t) => /side|role/.test(t)), 'a side or role tip on an event without them');
  const wedding = quickAddTips({ hasSides: true, offeredRoles: WEDDING_ROLE_SET.offeredRoles });
  assert.ok(wedding.tips.includes('bride / groom / both sets the side'));
  const generic = quickAddTips({ hasSides: false, offeredRoles: resolveRoleSet(null).offeredRoles });
  assert.doesNotMatch(generic.tips.join(' ') + generic.example, /\bsides?\b.*bride|groom/);
});

test('every token a tip names is one the parser consumes (never part of a name)', () => {
  const { tips, example } = quickAddTips({ hasSides: true, offeredRoles: WEDDING_ROLE_SET.offeredRoles });
  const tokens = new Set<string>();
  for (const line of [...tips, example]) {
    for (const m of line.replace(/#Name/g, '#Group').matchAll(WORDS)) tokens.add(m[1] ?? '');
    for (const w of line.split(/[\s/]+/)) if (/^(vip|ninong|ninang|bride|groom|both)$/.test(w)) tokens.add(w);
  }
  assert.ok(tokens.size >= 5, `too few tokens found (${[...tokens]}) — re-aim this guard`);
  for (const t of tokens) {
    const d = parseGuestInput(`Ana Cruz ${t === '+2' ? '+2' : t}`);
    assert.equal(`${d.firstName} ${d.lastName}`, 'Ana Cruz', `"${t}" is named in a tip but the parser keeps it as part of the name`);
  }
});

test('each "a / b sets the …" tip lists only words the parser consumes', () => {
  // Catches an invented word ("maid sets the role") that the named-token scan above would not know to look for.
  const { tips } = quickAddTips({ hasSides: true, offeredRoles: WEDDING_ROLE_SET.offeredRoles });
  const setters = tips.filter((t) => / sets the /.test(t));
  assert.ok(setters.length >= 2, 'no "sets the" tips found — re-aim this guard');
  for (const t of setters) {
    for (const w of t.split(' sets the ')[0]!.split(' / ')) {
      const d = parseGuestInput(`Ana Cruz ${w}`);
      assert.equal(`${d.firstName} ${d.lastName}`, 'Ana Cruz', `"${w}" (from "${t}") is not a word the parser reads`);
    }
  }
});

