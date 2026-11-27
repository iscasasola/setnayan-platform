/**
 * 👗 gown/parts/heels — her wedding shoes (prototype v193 `buildHeels`, the shoe part): a pointed-toe stiletto pump
 * (model `public/gown/shoe-pump.json`, cadnav.com, credited) fitted under her own foot by three landmarks (heel, ball,
 * toes) and carried by two frames (the foot, the toes), so it lifts, points and bends with every pose and step. The heel
 * post always drops straight to the floor. The heel height itself is the body's (Elevation bends her foot, A3).
 *
 * The model is fetched lazily by the stage (`loadGownShoe`) and fitted once per body; posing is cheap. Women only.
 */
import * as THREE from 'three';
import { clamp, type GownRig } from '../body/rig';

/** The shoe model as stored: three parts (heel, insole, pump), landmarks, the post's vertices and the post's top. */
export type GownShoeModel = {
  src: string;
  parts: { v: number[]; t: number[] }[];
  H: [number, number, number];
  B: [number, number, number];
  T: [number, number, number];
  yP: number;
  post: [number, number][];
};

/** The shoe's three materials in part order (v193 `heelMat`, `insoleMat`, `shoeMat`: an ivory satin pump). */
export const GOWN_SHOE_LOOK = [
  { colour: 0xeee4d2, roughness: 0.3, metalness: 0.05 },
  { colour: 0xe6cfa9, roughness: 0.6 },
  { colour: 0xf1e8d8, roughness: 0.3, sheen: 1, clearcoat: 0.3 },
] as const;
/** The credit the maker shows (cadnav.com's terms). */
export const GOWN_SHOE_CREDIT = 'Shoe model: cadnav.com';

type Frame = { o: THREE.Vector3; e1: THREE.Vector3; e2: THREE.Vector3; e3: THREE.Vector3; s: number };
type Coord = [number, number, number];
type FittedPart = { g: THREE.BufferGeometry; cA: Coord[]; cT: Coord[]; cTop: (Coord | null)[]; wT: Float32Array; post: Float32Array };
export type GownShoes = Partial<Record<'L' | 'R', { frames: (A: ArrayLike<number>) => [Frame, Frame]; parts: FittedPart[] }>>;

/** Parse the model file (validated: three parts, landmarks, posts). */
export function parseGownShoe(json: unknown): GownShoeModel {
  const m = json as GownShoeModel;
  if (!m || !Array.isArray(m.parts) || m.parts.length !== 3 || !Array.isArray(m.post) || m.H?.length !== 3 || m.B?.length !== 3 || m.T?.length !== 3 || typeof m.yP !== 'number') {
    throw new Error('gown shoe model: not a shoe');
  }
  return m;
}

/** Fetch the shoe model (the stage calls this once, lazily, only when she wears heels). */
export async function loadGownShoe(url = '/gown/shoe-pump.json'): Promise<GownShoeModel> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`gown shoe model: ${r.status}`);
  return parseGownShoe(await r.json());
}

/** Fit the model to this body, once (v193: landmarks found on her bind pose; the other foot mirrored). */
export function fitGownShoes(B: GownRig, HM: GownShoeModel): GownShoes {
  const out: GownShoes = {}, P0 = B.pos0;
  const mean = (A: ArrayLike<number>, ids: number[]) => { const v = new THREE.Vector3(); for (const i of ids) { v.x += A[i * 3]!; v.y += A[i * 3 + 1]!; v.z += A[i * 3 + 2]!; } return v.multiplyScalar(1 / ids.length); };
  for (const sd of ['L', 'R'] as const) {
    const fv: number[] = [], tv: number[] = [];
    for (let i = 0; i < B.n; i++) {
      let bw = 0, bi = 0;
      for (let c = 0; c < 4; c++) if (B.SW[i * 4 + c]! > bw) { bw = B.SW[i * 4 + c]!; bi = B.SI[i * 4 + c]!; }
      const nm = (B.name[bi] || '').replace('.', '');
      if (!nm.endsWith(sd)) continue;
      if (/^foot/i.test(nm)) fv.push(i); else if (/^toe/i.test(nm)) tv.push(i);
    }
    if (!fv.length || !tv.length) continue;
    let y0 = 1e9, z0 = 1e9, z1 = -1e9;
    for (const i of fv.concat(tv)) { y0 = Math.min(y0, P0[i * 3 + 1]!); z0 = Math.min(z0, P0[i * 3 + 2]!); z1 = Math.max(z1, P0[i * 3 + 2]!); }
    const L = z1 - z0, low = (ids: number[], h: number) => ids.filter((i) => P0[i * 3 + 1]! < y0 + h * L);
    const Hs = low(fv.filter((i) => P0[i * 3 + 2]! < z0 + 0.1 * L), 0.05);
    const Bs = low(fv.filter((i) => Math.abs(P0[i * 3 + 2]! - (z0 + 0.72 * L)) < 0.06 * L), 0.06);
    const Ts = low(tv.filter((i) => P0[i * 3 + 2]! > z0 + 0.86 * L), 0.07);
    const ball = fv.filter((i) => Math.abs(P0[i * 3 + 2]! - (z0 + 0.7 * L)) < 0.06 * L);
    if (!Hs.length || !Bs.length || !Ts.length || !ball.length) continue;
    const bX = ball.reduce((b, i) => (P0[i * 3]! > P0[b * 3]! ? i : b), ball[0]!), bN = ball.reduce((b, i) => (P0[i * 3]! < P0[b * 3]! ? i : b), ball[0]!);
    const frames = (A: ArrayLike<number>): [Frame, Frame] => {
      const h = mean(A, Hs), b = mean(A, Bs), t = mean(A, Ts), w = new THREE.Vector3(A[bX * 3]! - A[bN * 3]!, A[bX * 3 + 1]! - A[bN * 3 + 1]!, A[bX * 3 + 2]! - A[bN * 3 + 2]!);
      const f = (o: THREE.Vector3, a: THREE.Vector3): Frame => { const e1 = a.clone().sub(o), s = e1.length(); e1.normalize(); const e2 = w.clone().addScaledVector(e1, -w.dot(e1)).normalize(); return { o, e1, e2, e3: new THREE.Vector3().crossVectors(e1, e2), s }; };
      return [f(h, b), f(b, t)];
    };
    // The model's frames: its up stays up (a right-handed match to her foot).
    const mf = (o: Coord, a: Coord): Frame => {
      const O = new THREE.Vector3(...o), e1 = new THREE.Vector3(...a).sub(O), s = e1.length();
      e1.normalize();
      const e2 = new THREE.Vector3(0, 0, -1);
      e2.addScaledVector(e1, -e2.dot(e1)).normalize();
      return { o: O, e1, e2, e3: new THREE.Vector3().crossVectors(e1, e2), s };
    };
    // The other foot: the same shoe, mirrored side to side.
    const mir = sd === 'L' ? -1 : 1, MA = mf(HM.H, HM.B), MT = mf(HM.B, HM.T);
    const loc = (F: Frame, p: THREE.Vector3): Coord => { const d = p.clone().sub(F.o); return [d.dot(F.e1) / F.s, (mir * d.dot(F.e2)) / F.s, d.dot(F.e3) / F.s]; };
    const parts = HM.parts.map((pt, pi): FittedPart => {
      const n = pt.v.length / 3, cA: Coord[] = [], cT: Coord[] = [], cTop: (Coord | null)[] = [], wT = new Float32Array(n), post = new Float32Array(n).fill(-1), q = new THREE.Vector3();
      if (pi === 0) for (const [i, s] of HM.post) post[i] = s;
      for (let i = 0; i < n; i++) {
        q.set(pt.v[i * 3]!, pt.v[i * 3 + 1]!, pt.v[i * 3 + 2]!);
        cA.push(loc(MA, q));
        cT.push(loc(MT, q));
        const u = clamp((q.x - HM.B[0] + 0.25 * (HM.B[0] - HM.H[0])) / (0.5 * (HM.B[0] - HM.H[0])), 0, 1);
        wT[i] = u * u * (3 - 2 * u);
        cTop.push(post[i]! >= 0 ? loc(MA, q.clone().setY(HM.yP)) : null);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setIndex(mir > 0 ? pt.t : pt.t.map((_, k) => pt.t[k - (k % 3) + [0, 2, 1][k % 3]!]!));
      return { g, cA, cT, cTop, wT, post };
    });
    out[sd] = { frames, parts };
  }
  return out;
}

/** Put the shoes on her posed feet (v193): the stiletto straight down to the floor. */
export function poseGownShoes(B: GownRig, shoes: GownShoes, floorY: number): void {
  const put = (F: Frame, c: Coord, o: THREE.Vector3) => o.copy(F.o).addScaledVector(F.e1, c[0] * F.s).addScaledVector(F.e2, c[1] * F.s).addScaledVector(F.e3, c[2] * F.s);
  const q = new THREE.Vector3(), r = new THREE.Vector3();
  for (const sd of ['L', 'R'] as const) {
    const S = shoes[sd];
    if (!S) continue;
    const [FA, FT] = S.frames(B.V);
    for (const pt of S.parts) {
      const P = (pt.g.attributes.position as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < pt.cA.length; i++) {
        if (pt.post[i]! >= 0) { put(FA, pt.cTop[i]!, q); q.y = floorY + pt.post[i]! * (q.y - floorY); }
        else { put(FA, pt.cA[i]!, q); put(FT, pt.cT[i]!, r); q.lerp(r, pt.wT[i]!); }
        P[i * 3] = q.x; P[i * 3 + 1] = q.y; P[i * 3 + 2] = q.z;
      }
      (pt.g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      pt.g.computeVertexNormals();
      pt.g.computeBoundingSphere();
    }
  }
}
