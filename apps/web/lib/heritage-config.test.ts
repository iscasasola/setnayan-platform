import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HERITAGE_OUTFITS, HERITAGE_SKIN_TONES, HERITAGE_HAIR_STYLES, HERITAGE_HAIR_COLORS, HERITAGE_OUTFIT_COLORS,
  defaultHeritageConfig, validateHeritageConfig, resolveHeritageConfig, heritageFigureSpec, isHeritageStored,
} from './heritage-config';
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLE_COUNT } from './figure-rig';
import { CHIBI_OUTFIT_COLORS } from './chibi-config';

test('the catalogs ARE the rig\'s dormant look system — nothing invented here', () => {
  assert.deepEqual([...HERITAGE_SKIN_TONES], [...SKIN_TONES]);
  assert.deepEqual([...HERITAGE_HAIR_COLORS], [...HAIR_COLORS]);
  assert.equal(HERITAGE_HAIR_STYLES.length, HAIR_STYLE_COUNT);
  assert.deepEqual(HERITAGE_OUTFIT_COLORS, CHIBI_OUTFIT_COLORS, 'one outfit palette across both styles');
  assert.deepEqual([...HERITAGE_OUTFITS], ['gown', 'suit', 'barong', 'filipiniana', 'neutral']);
});

test('defaults are hash-stable per id and always valid', () => {
  const a = defaultHeritageConfig('guest-a');
  assert.deepEqual(defaultHeritageConfig('guest-a'), a);
  assert.deepEqual(validateHeritageConfig(a), []);
  assert.equal(a.style, 'heritage');
});

test('validate is strict: unknown key, wrong style, off-catalog values', () => {
  const ok = defaultHeritageConfig('x');
  assert.deepEqual(validateHeritageConfig(ok), []);
  assert.ok(validateHeritageConfig({ ...ok, extra: 1 }).some((e) => e.includes('unknown key')));
  assert.ok(validateHeritageConfig({ ...ok, style: 'chibi' }).length > 0);
  assert.deepEqual(validateHeritageConfig({ ...ok, style: 'blocky' }), [], 'blocky shares the schema');
  assert.ok(validateHeritageConfig({ ...ok, hairStyle: 99 }).some((e) => e.includes('hairStyle')));
  assert.ok(validateHeritageConfig({ ...ok, outfitColor: '#123456' }).some((e) => e.includes('outfitColor')));
  assert.ok(validateHeritageConfig({ ...ok, outfit: 'chef_whites' }).some((e) => e.includes('outfit')), 'staff garments are not guest outfits');
  assert.ok(validateHeritageConfig(null).length > 0);
});

test('resolve never throws and repairs field-by-field to the id\'s defaults', () => {
  const d = defaultHeritageConfig('r');
  const r = resolveHeritageConfig('r', { style: 'heritage', hairStyle: 42, outfit: 'gown', junk: true });
  assert.equal(r.outfit, 'gown', 'a valid field survives');
  assert.equal(r.hairStyle, d.hairStyle, 'an invalid one repairs to the default');
  assert.equal(r.style, 'heritage');
  assert.deepEqual(resolveHeritageConfig('r', 'junk'), d);
});

test('isHeritageStored is the dispatch key, nothing more', () => {
  assert.equal(isHeritageStored({ style: 'heritage' }), true);
  assert.equal(isHeritageStored({ v: 1, bodyType: 'female' }), false, 'a chibi row has no style key');
  assert.equal(isHeritageStored(null), false);
  assert.equal(isHeritageStored(['heritage']), false);
});

test('the figure spec carries the look the rig now honours', () => {
  const c = defaultHeritageConfig('s');
  const spec = heritageFigureSpec('s', c, '#abc');
  assert.equal(spec.skinTone, c.skinTone);
  assert.equal(spec.hairStyle, c.hairStyle);
  assert.equal(spec.hairColor, c.hairColor);
  assert.equal(spec.outfit, c.outfit);
  assert.equal(spec.outfitColor, c.outfitColor);
  assert.equal(spec.statusColor, '#abc');
});
