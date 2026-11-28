/**
 * 👗 gown/parts/illusion — the sheer illusion bodice, the illusion back and the boning you can see, held to prototype
 * v198's own numbers (`v199-illusion.fixture.json`), and its rules said word for word.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { sanitizeGownConfig, startingGownConfig, type GownConfig, type GownLook, type GownOffer } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownApplyLook, gownChoose, gownHiddenChoices } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { gownSurfaceShader, gownSurfaceUniforms } from '../fabric/surface';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { gownBackCapT } from '../dress/lines';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownIllu, gownBoneSet, gownIlluDressShader, gownIlluMetres, gownIlluSummary, gownIlluTulleLine, gownIlluTulleShader, gownIlluUniforms } from './illusion';
import { buildGownInside } from './inside';

type Lines = { lo: number[]; cupLo: number[]; cupHi: number[]; top: number[]; bind: number[] };
type Row = {
  name: string; look: Partial<GownLook> & { backT?: number }; hem: GownConfig['hem']; gown: Partial<GownConfig>; zoneOn: boolean; y: [number, number] | null; lines: Lines | null;
  bones: { n: number; angs: number[]; kind: string }; boneOn: number; boneN: number; boneW: number; boneLo: number[]; boneHi: number[]; top: number[]; metres: number; summary: string[];
};
const REF = JSON.parse(readFileSync(join(__dirname, 'v199-illusion.fixture.json'), 'utf8')) as { rows: Row[] };
const OFFER: GownOffer = { fabricTypes: ['satin', 'crepe', 'chiffon'], fabricRefs: [], laceRefs: [], lookRefs: [] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
function dressed(B: GownRig, g: GownConfig) {
  const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric), g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorOf(B));
  writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  return { T, D };
}
// As the prototype was captured: the look (no veil, sleeves or cut-outs), then what it left (the depth slider among them).
const designOf = (r: Row) => {
  const { backT: _b, ...look } = r.look;
  return { ...gownApplyLook(startingGownConfig(), { veil: 'none', sleeve: 'none', ...look }), ...r.gown, hem: r.hem, hemCm: 0 } as GownConfig;
};

test('the sheer zone, the bones and the tulle metres as v198 builds them, and the designer reads the same lines', async () => {
  const B = await body(), cmU = B.P.S * 100;
  for (const r of REF.rows) {
    const g = designOf(r), { T, D } = dressed(B, g), u = gownIlluUniforms(), I = buildGownIllu(B, T, D, g, u);
    assert.equal(I.zoneOn, r.zoneOn, `${r.name}: zone`);
    // The gown's top edge as cut (an illusion back closes it; straight-across cups on a sweetheart run straight).
    r.top.forEach((v, k) => assert.ok(Math.abs(T.top[k * 4]! - v) * cmU < 0.1, `${r.name}: top edge ${k * 4}`));
    assert.deepEqual({ n: I.bones!.n, kind: I.bones!.kind }, { n: r.bones.n, kind: r.bones.kind }, `${r.name}: bones`);
    I.bones!.angs.forEach((a, k) => assert.ok(Math.abs(a - r.bones.angs[k]!) < 1e-4, `${r.name}: bone ${k}`));
    assert.equal(u.ilBoneOn.value, r.boneOn, `${r.name}: bones shown`);
    if (r.boneOn) {
      assert.equal(u.ilBoneN.value, r.boneN);
      assert.equal(u.ilBoneW.value, r.boneW);
      for (let k = 0; k < r.boneN; k++) {
        assert.ok(Math.abs(u.ilBoneLo.value[k]! - r.boneLo[k]!) * cmU < 0.1 && Math.abs(u.ilBoneHi.value[k]! - r.boneHi[k]!) * cmU < 0.1, `${r.name}: bone ${k}'s channel`);
      }
    }
    assert.equal(gownIlluMetres(B, D, I), r.metres, `${r.name}: tulle metres`);
    assert.deepEqual(gownIlluSummary(B, D.L, g), r.summary, `${r.name}: the designer's lines`);
    if (!r.lines) continue;
    assert.ok(Math.abs(I.y0 - r.y![0]) * cmU < 0.1 && Math.abs(I.y1 - r.y![1]) * cmU < 0.1, `${r.name}: the map's range`);
    for (const k of ['lo', 'cupLo', 'cupHi', 'top'] as const) {
      r.lines[k].forEach((v, x) => {
        const ours = I.lines![k][x * 8]!;
        assert.ok(v > 1e8 ? ours > 1e8 : Math.abs(ours - v) * cmU < 0.1, `${r.name}: ${k} at column ${x * 8} (${ours} vs ${v})`);
      });
    }
    r.lines.bind.forEach((v, x) => assert.equal(I.lines!.bind[x * 8], v, `${r.name}: bound edge at column ${x * 8}`));
  }
});

test('one bone list: Inside, Boning draws the same bones the channels show', async () => {
  const B = await body();
  for (const boning of ['complement', 'corset'] as const) {
    const g = { ...gownApplyLook(startingGownConfig(), {}), boning } as GownConfig, { T, D } = dressed(B, g);
    const bones = buildGownInside(B, T, D, g, 0xffffff, 'Satin').find((p) => p.key === 'bone');
    const shown = gownBoneSet(B, D.L, boning).n;
    // The bone piece is one tube per bone, then the waist stay's.
    assert.ok(bones && bones.geos.length >= shown, `${boning}: ${bones?.geos.length} pieces for ${shown} bones`);
    assert.ok(shown >= 7 && shown <= 13);
  }
});

test('the shaders: the cloth is cut away in the zone (its lace stays), the tulle draws only inside it', () => {
  const u = gownIlluUniforms(), sh = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  gownSurfaceShader(gownSurfaceUniforms())(sh);
  gownIlluDressShader(u)(sh);
  assert.match(sh.fragmentShader, /if \(ilOn > 0\.5 && vCz > -50\.0\) \{ vec4 iz = ilZone\(vRest, vCz\);/);
  assert.ok(sh.fragmentShader.indexOf('ilOn > 0.5') < sh.fragmentShader.indexOf('if (cutOn > 0.5 && vCz > -50.0) {'), 'before the cut-outs');
  assert.equal(sh.uniforms.ilMap, u.ilMap);
  const t = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  gownIlluTulleShader(u)(t);
  assert.match(t.fragmentShader, /if \(vIlCz < -50\.0\) discard; vec4 iz = ilZone\(vIlR, vIlCz\); if \(iz\.r < 0\.5\) discard;/);
  assert.match(t.vertexShader, /vIlR = rest; vIlCz = gcz;/);
});

test('the v198 rules, word for word, and the server refuses what they rule out', async () => {
  const start = (o: Partial<GownConfig> = {}) => ({ ...startingGownConfig(), ...o }) as GownConfig;
  const a = gownChoose(start({ neck: 'sweetheart' }), { key: 'illu', value: 'neck' });
  assert.equal(a.config.neck, 'bateau');
  assert.deepEqual(a.notes, ['An illusion neckline needs a neckline above the cups, so the neckline is now bateau: sheer tulle from the cups up to it.']);
  assert.deepEqual(gownHiddenChoices(a.config).neck, ['sweetheart', 'straight', 'plungewaist']); // v199: nor a plunge to the waist
  const b = gownChoose(start({ neck: 'bateau', illu: 'neck' }), { key: 'neck', value: 'straight' });
  assert.equal(b.config.illu, 'none');
  assert.match(b.notes.join(' '), /A strapless neckline is the top of the cups/);
  const c = gownChoose(start({ boning: 'soft' }), { key: 'illu', value: 'corset' });
  assert.deepEqual([c.config.boning, c.notes], ['complement', ['A sheer corset is boned so it keeps its shape: boning is now Complement.']]);
  assert.deepEqual(gownChoose(start({ boning: 'soft' }), { key: 'boneShow', value: 'on' }).notes, ['Bones are added (Complement) so there is boning to show. Change them under Inside, Boning.']);
  const d = gownChoose(start({ boneShow: 'on' }), { key: 'boning', value: 'soft' });
  assert.deepEqual([d.config.boneShow, d.notes], ['off', ['Visible boning is off: a soft bodice has no bones.']]);
  assert.equal(gownChoose(start({ back: 'v', illuBack: 'on' }), { key: 'back', value: 'closed' }).config.illuBack, 'off');
  // Owner: a strapless low back needs straps or an illusion back; turning it off raises the back to the bra line.
  const B = await body(), g0 = start({ back: 'v', backT: 0.9, illuBack: 'on' }), { D } = dressed(B, g0), cap = gownBackCapT({ neck: 'sweetheart' }, D.L);
  assert.ok(cap < 0.9 && gownBackCapT(g0, D.L) === 1, 'an illusion back lifts the bra-line cap');
  const off = gownChoose(g0, { key: 'illuBack', value: 'off' }, { backCapT: cap });
  assert.equal(off.config.backT, Math.round(cap * 500) / 500);
  assert.deepEqual(off.notes, ['The back is raised to the bra line: a strapless bodice with no straps needs its back (or an illusion back) to stay up.']);
  const low = gownChoose(start({ back: 'scoop', backT: 0.9 }), { key: 'back', value: 'v' }, { backCapT: cap });
  assert.equal(low.config.illuBack, 'on');
  assert.match(low.notes.join(' '), /an illusion back is added/);
  assert.equal(gownChoose(start({ back: 'scoop', backT: 0.9, cape: 'side' }), { key: 'back', value: 'v' }, { backCapT: cap }).config.illuBack, 'off', "a cape's strap holds it");
  for (const bad of [{ illu: 'neck', neck: 'sweetheart' }, { illu: 'corset', boning: 'soft' }, { boneShow: 'on', boning: 'soft' }, { illuBack: 'on', back: 'closed' }] as Partial<GownConfig>[]) {
    assert.equal(sanitizeGownConfig(start(bad), OFFER).ok, false, JSON.stringify(bad));
  }
  assert.equal(sanitizeGownConfig(start({ illu: 'neck', neck: 'off' }), OFFER).ok, true, 'off-shoulder has its line above the cups');
});

test('the illusion tulle line, as v202 words it: only a bodice, a back or a plunge mesh buys tulle', () => {
  const base = { illu: 'none', illuCol: 'nude', back: 'scoop', illuBack: 'off', neck: 'sweetheart', plungeFill: 'mesh' } as const;
  assert.equal(gownIlluTulleLine(base), null);
  assert.equal(gownIlluTulleLine({ ...base, illuBack: 'on', back: 'closed' }), null); // a closed back has nothing to fill
  assert.equal(gownIlluTulleLine({ ...base, neck: 'plungewaist', plungeFill: 'open' }), null);
  assert.equal(gownIlluTulleLine({ ...base, neck: 'plungewaist' }), 'Illusion tulle, nude (plunge mesh)');
  assert.equal(gownIlluTulleLine({ ...base, illu: 'corset', illuCol: 'match', illuBack: 'on', back: 'v' }), 'Illusion tulle, gown colour (bodice and back)');
  assert.equal(gownIlluTulleLine({ ...base, illu: 'neck', illuCol: 'ivory', illuBack: 'on', neck: 'plungewaist' }), 'Illusion tulle, ivory (bodice and back and plunge mesh)');
});
