/**
 * Unit suite for the chibi procedural geometry (`lib/chibi-geometry.ts`) —
 * the two § 11 MERGE-GATE laws (Chibi_Rig_Production_Spec_2026-07-19,
 * owner-corrected 2026-07-21), mechanical:
 *
 *   • CLOSED-LATHE LAW: every lathe profile touches the axis at BOTH ends
 *     (watertight — the transparency bug class the owner already rejected
 *     once cannot recur).
 *   • NO-EXPOSED-CAP LAW (§ 11.2 — supersedes the RETIRED "overlap law"):
 *     no part terminates in a visible end-face outside its parent's surface.
 *     `chibiJunctionAudit` computes every structural junction's containment
 *     margin; this suite fails on any non-positive margin for ANY
 *     (bodyType × outfit), so a future proportion re-tune cannot silently
 *     re-open a seam.
 *   • HAIR-CAP PLACEMENT INVARIANT (2026-07-21 audit): crown ≤ 0.42,
 *     nape ≥ 0.70, lift ≥ 0.03 on every style — the "caps hiding eyes" V4
 *     bug class stays dead.
 *
 * Plus construction sanity (every catalog combination builds finite,
 * non-empty, normal-bearing geometry) and the shared-cache invariant the
 * renderer + future instanced crowd both rely on.
 *
 * Run via the repo's `test:unit` script (tsx --test "lib/**\/*.test.ts").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as THREE from 'three';

import {
  buildChibiGeometry,
  chibiJunctionAudit,
  chibiLatheProfiles,
  closedLatheProfile,
  hairCapParamsForStyle,
  clampHairCap,
  resolveChibiPaint,
  CHIBI_HEAD_R,
  CHIBI_HEAD_Y,
  CHIBI_HEIGHT_M,
  CHIBI_TRIM_PARTS,
  type ChibiPart,
} from './chibi-geometry';
import {
  CHIBI_BODY_TYPES,
  CHIBI_OUTFITS,
  CHIBI_HAIR_STYLES,
  CHIBI_EYES,
  CHIBI_MOUTHS,
  CHIBI_MARKS,
  CHIBI_ACCESSORIES,
  darkenHex,
  defaultChibiConfig,
  effectiveChibiColors,
  type ChibiAvatarConfig,
} from './chibi-config';

const cfgWith = (over: Partial<ChibiAvatarConfig>): ChibiAvatarConfig => ({
  ...defaultChibiConfig('geometry-test'),
  ...over,
});

function assertFiniteGeometry(part: ChibiPart) {
  const pos = part.geometry.getAttribute('position') as THREE.BufferAttribute;
  assert.ok(pos && pos.count > 0, `${part.name}: has vertices`);
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i++) {
    assert.ok(Number.isFinite(arr[i]), `${part.name}: position[${i}] finite`);
  }
  assert.ok(part.geometry.getAttribute('normal'), `${part.name}: has normals`);
}

// ── construction sanity ──────────────────────────────────────────────────────

test('every bodyType × outfit builds finite, non-empty part bundles', () => {
  for (const bodyType of CHIBI_BODY_TYPES) {
    for (const outfit of CHIBI_OUTFITS) {
      const bundle = buildChibiGeometry(cfgWith({ bodyType, outfit }));
      assert.ok(bundle.body.length >= 3, `${bodyType}/${outfit}: body parts`);
      assert.ok(bundle.head.length >= 2, `${bodyType}/${outfit}: head parts`);
      for (const part of [...bundle.body, ...bundle.head]) assertFiniteGeometry(part);
      // The § 11 colour-region contract: exactly one primary outfit buffer,
      // one skin buffer (hands ± legs), one shoes buffer.
      assert.equal(bundle.body.filter((p) => p.name.startsWith('body-')).length, 1);
      assert.equal(bundle.body.filter((p) => p.name.startsWith('skin-')).length, 1);
      assert.equal(bundle.body.filter((p) => p.name === 'shoes').length, 1);
    }
  }
});

test('every hair style builds; bald means no hair buffer (the clean dome)', () => {
  for (const hairStyle of CHIBI_HAIR_STYLES) {
    const bundle = buildChibiGeometry(cfgWith({ hairStyle }));
    const hair = bundle.head.filter((p) => p.name.startsWith('hair-'));
    if (hairStyle === 'bald') {
      assert.equal(hair.length, 0);
    } else {
      assert.equal(hair.length, 1, `${hairStyle}: one merged hair buffer`);
      assertFiniteGeometry(hair[0]!);
    }
  }
});

test('faces are IN: nose is ALWAYS present; ink varies; none/none/none still has the nose', () => {
  for (const eyes of CHIBI_EYES) {
    for (const mouth of CHIBI_MOUTHS) {
      for (const mark of CHIBI_MARKS) {
        const bundle = buildChibiGeometry(cfgWith({ eyes, mouth, mark }));
        // § 10: the nose is the front-facing cue — not a config field, never absent.
        assert.equal(bundle.head.filter((p) => p.name === 'nose').length, 1);
        const ink = bundle.head.filter((p) => p.name.startsWith('face-'));
        if (eyes === 'none' && mouth === 'none' && mark === 'none') {
          assert.equal(ink.length, 0);
        } else {
          assert.equal(ink.length, 1);
          assertFiniteGeometry(ink[0]!);
        }
      }
    }
  }
});

test('every accessory builds fixed-colour parts (none → nothing)', () => {
  for (const accessory of CHIBI_ACCESSORIES) {
    const bundle = buildChibiGeometry(cfgWith({ accessory }));
    const acc = bundle.head.filter((p) => p.name.startsWith('acc-'));
    if (accessory === 'none') {
      assert.equal(acc.length, 0);
    } else {
      assert.ok(acc.length >= 1, `${accessory}: has parts`);
      for (const part of acc) {
        assert.equal(part.paint.kind, 'fixed', `${accessory}: fixed colour`);
        assertFiniteGeometry(part);
      }
    }
  }
});

// ── closed-lathe law ─────────────────────────────────────────────────────────

test('closed-lathe law: every registered profile touches the axis at both ends', () => {
  for (const bodyType of CHIBI_BODY_TYPES) {
    for (const outfit of CHIBI_OUTFITS) {
      for (const profile of chibiLatheProfiles(bodyType, outfit)) {
        const closed = closedLatheProfile(profile);
        assert.ok(closed.length >= profile.length + 2);
        assert.ok(closed[0]!.x <= 0.0011, `${bodyType}/${outfit}: top touches axis`);
        assert.ok(closed[closed.length - 1]!.x <= 0.0011, `${bodyType}/${outfit}: bottom touches axis`);
        // No degenerate/negative radii anywhere in the closed profile.
        for (const p of closed) assert.ok(p.x >= 0.001 && Number.isFinite(p.y));
      }
    }
  }
});

// ── hair-cap placement invariant ─────────────────────────────────────────────

test('hair caps obey the 2026-07-21 placement clamp on every style', () => {
  for (const style of CHIBI_HAIR_STYLES) {
    const params = hairCapParamsForStyle(style);
    if (style === 'bald') {
      assert.equal(params, null);
      continue;
    }
    assert.ok(params, `${style}: has cap params`);
    assert.ok(params!.crown <= 0.42, `${style}: crown rim above the brow`);
    assert.ok(params!.nape >= 0.7, `${style}: nape past the occiput`);
    assert.ok(params!.nape <= 0.74, `${style}: nape short of the beard threshold`);
    assert.ok(params!.lift >= 0.03, `${style}: cap lift`);
  }
  // The clamp itself wins over out-of-range historic arguments.
  const clamped = clampHairCap(0.6, 0.5, 0);
  assert.equal(clamped.crown, 0.42);
  assert.equal(clamped.nape, 0.7);
  assert.equal(clamped.lift, 0.03);
});

// ── § 11.2 no-exposed-cap audit (THE merge gate) ─────────────────────────────

test('no-exposed-cap law: every structural junction is concealed for every bodyType × outfit', () => {
  for (const bodyType of CHIBI_BODY_TYPES) {
    for (const outfit of CHIBI_OUTFITS) {
      const audit = chibiJunctionAudit(bodyType, outfit);
      // The four junction families: body-top→head, arm-root→torso,
      // hand→sleeve, and (when skin shows) leg-stub→hem.
      assert.ok(audit.length >= 3, `${bodyType}/${outfit}: audit covers the junctions`);
      for (const j of audit) {
        assert.ok(
          j.contained && j.margin > 0.01,
          `${bodyType}/${outfit}: ${j.part} concealed by ${j.host} (margin ${j.margin.toFixed(4)})`,
        );
      }
    }
  }
});

test('trim exemptions are documented, not silent', () => {
  // The audit's honesty rider: every exemption carries a reason.
  assert.ok(CHIBI_TRIM_PARTS.length > 0);
  for (const t of CHIBI_TRIM_PARTS) {
    assert.ok(t.part.length > 0 && t.reason.length > 8);
  }
});

// ── shared-cache invariant ───────────────────────────────────────────────────

test('same config returns the SAME shared geometry objects (never dispose)', () => {
  const cfg = cfgWith({ outfit: 'filipiniana', hairStyle: 'buns', accessory: 'flower' });
  const a = buildChibiGeometry(cfg);
  const b = buildChibiGeometry(cfg);
  assert.equal(a.body.length, b.body.length);
  assert.equal(a.head.length, b.head.length);
  for (let i = 0; i < a.body.length; i++) {
    assert.equal(a.body[i]!.geometry, b.body[i]!.geometry, `${a.body[i]!.name}: shared buffer`);
  }
  for (let i = 0; i < a.head.length; i++) {
    assert.equal(a.head[i]!.geometry, b.head[i]!.geometry, `${a.head[i]!.name}: shared buffer`);
  }
});

// ── paint resolution (the crowd's instanceColor derivation) ──────────────────

test('resolveChibiPaint maps every descriptor kind through the shared colour derivations', () => {
  const cfg = cfgWith({ colorMode: 'custom' });
  const colors = effectiveChibiColors(cfg);
  assert.equal(resolveChibiPaint({ kind: 'skin' }, colors), cfg.skinTone);
  assert.equal(resolveChibiPaint({ kind: 'hair' }, colors), colors.hair);
  assert.equal(resolveChibiPaint({ kind: 'outfit' }, colors), colors.outfit);
  assert.equal(resolveChibiPaint({ kind: 'shoes' }, colors), colors.shoes);
  assert.equal(
    resolveChibiPaint({ kind: 'outfitDarkened', k: 0.72 }, colors),
    darkenHex(colors.outfit, 0.72),
  );
  // § 11.2 colour-junction rule: the nose derives from the SAME skin value
  // the head + hands tint with — never an independent constant.
  assert.equal(
    resolveChibiPaint({ kind: 'skinDarkened', k: 0.88 }, colors),
    darkenHex(cfg.skinTone, 0.88),
  );
  assert.equal(resolveChibiPaint({ kind: 'fixed', hex: '#123456' }, colors), '#123456');
  // Every paint descriptor actually used by the full catalog resolves to a
  // well-formed hex.
  for (const bodyType of CHIBI_BODY_TYPES) {
    for (const outfit of CHIBI_OUTFITS) {
      const bundle = buildChibiGeometry(cfgWith({ bodyType, outfit, accessory: 'flower' }));
      for (const part of [...bundle.body, ...bundle.head]) {
        assert.match(
          resolveChibiPaint(part.paint, colors),
          /^#[0-9a-f]{6}$/i,
          `${part.name}: resolvable paint`,
        );
      }
    }
  }
});

// ── proportions ──────────────────────────────────────────────────────────────

test('published proportion constants stay coherent', () => {
  assert.equal(CHIBI_HEAD_R, 0.34);
  assert.equal(CHIBI_HEAD_Y, 1.06);
  // ~1.38 m to the top of the head at scale 1 (§ 9.1 scale-vs-furniture is
  // an OPEN owner call — this pin surfaces any silent rescale).
  assert.ok(Math.abs(CHIBI_HEIGHT_M - (1.06 + 0.34 * 0.93)) < 1e-9);
});
