// NOTE: deliberately NOT 'server-only'. `sharp` is loaded via a DYNAMIC import
// inside computePHash (so nothing server-only leaks into a client bundle), which
// also lets the Node test runner (`tsx --test`, `pnpm test:unit`) import the
// DCT + Hamming + serialization helpers directly — mirroring lib/face-match-core.ts,
// the PURE matcher core that is intentionally server-only-free for the same reason.
// In practice this module is only ever called from server code (the after() task
// + the admin actions).

/**
 * 64-bit DCT perceptual hash (pHash) for cross-vendor reverse-image repost
 * detection. Pure + deterministic; no new npm dependency — it builds on the
 * `sharp` decode pattern already used in lib/face-blur.ts.
 *
 * Pipeline (the standard DCT-pHash):
 *   1. sharp(bytes).rotate().resize(32,32,{fit:'fill'}).grayscale().raw()
 *      → a 32×32 luma array (one byte per pixel). `.rotate()` bakes EXIF
 *        orientation so a sideways phone photo hashes identically to its
 *        upright twin.
 *   2. 2-D DCT-II over the 32×32 luma block.
 *   3. Take the top-left 8×8 low-frequency block (excluding the DC term at
 *      [0,0], which only encodes overall brightness).
 *   4. Threshold each of the 63 remaining coefficients against their median →
 *      63 bits. Bit 64 is forced to 0 so the value is deterministic and the
 *      whole thing packs into a signed 64-bit BigInt for Postgres BIGINT.
 *
 * The match metric is Hamming distance (number of differing bits) — DCT-pHash
 * is robust to JPEG re-encode and light crops, which is the dominant theft
 * vector (right-click-save → re-upload). It is NOT a forensic watermark; a heavy
 * crop can slip past, which is why the feature is detect-and-flag only.
 *
 * The hash is stored as a Postgres BIGINT (signed 64-bit). We serialize the
 * BigInt to a decimal string at the DB boundary (`phashToDbString`) because the
 * supabase-js client can't bind a native BigInt directly.
 */

const DCT_SIZE = 32; // resize edge / DCT input dimension
const LOW_FREQ = 8; // top-left 8×8 low-frequency block (64 coeffs incl. DC)

/**
 * Precomputed DCT-II cosine basis for an N-point transform. cos[k][n] is the
 * coefficient for output bin k, input sample n. Computed once per N (memoized).
 */
const cosineCache = new Map<number, number[][]>();
function cosineBasis(n: number): number[][] {
  const cached = cosineCache.get(n);
  if (cached) return cached;
  const basis: number[][] = [];
  for (let k = 0; k < n; k++) {
    const row = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      row[i] = Math.cos(((2 * i + 1) * k * Math.PI) / (2 * n));
    }
    basis[k] = row;
  }
  cosineCache.set(n, basis);
  return basis;
}

/**
 * 1-D DCT-II of a single row/column. We only ever need the first `LOW_FREQ`
 * output bins, so the caller passes `kMax` to skip the high-frequency bins.
 */
function dct1d(input: number[], kMax: number): number[] {
  const n = input.length;
  const basis = cosineBasis(n);
  const out = new Array<number>(kMax);
  for (let k = 0; k < kMax; k++) {
    let sum = 0;
    const row = basis[k]!;
    for (let i = 0; i < n; i++) sum += input[i]! * row[i]!;
    out[k] = sum;
  }
  return out;
}

/**
 * 2-D DCT-II of an N×N grayscale block, returning only the top-left
 * `LOW_FREQ`×`LOW_FREQ` coefficients (the only ones the hash reads). Separable
 * transform: DCT each row (keeping the low bins), then DCT each resulting
 * column (keeping the low bins).
 */
function dct2dLowFreq(luma: number[][], n: number): number[][] {
  // Pass 1 — DCT every row, keep the first LOW_FREQ bins. → n × LOW_FREQ.
  const rowDct: number[][] = new Array(n);
  for (let y = 0; y < n; y++) rowDct[y] = dct1d(luma[y]!, LOW_FREQ);

  // Pass 2 — DCT every column of the row-transformed matrix, keep LOW_FREQ
  // bins. → LOW_FREQ × LOW_FREQ.
  const out: number[][] = [];
  for (let u = 0; u < LOW_FREQ; u++) out[u] = new Array(LOW_FREQ);
  for (let x = 0; x < LOW_FREQ; x++) {
    const column = new Array<number>(n);
    for (let y = 0; y < n; y++) column[y] = rowDct[y]![x]!;
    const colDct = dct1d(column, LOW_FREQ);
    for (let u = 0; u < LOW_FREQ; u++) out[u]![x] = colDct[u]!;
  }
  return out;
}

/**
 * Compute the 64-bit DCT pHash of an encoded image. Returns a signed 64-bit
 * BigInt (ready for `BigInt.asIntN(64, …)`-style Postgres BIGINT storage), or
 * null if the bytes can't be decoded as an image (caller skips it — no row, no
 * crash).
 */
export async function computePHash(bytes: Uint8Array): Promise<bigint | null> {
  let raw: Buffer;
  try {
    const { default: sharp } = await import('sharp');
    raw = await sharp(Buffer.from(bytes))
      .rotate() // bake EXIF orientation BEFORE the square resize
      .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
      .grayscale()
      .removeAlpha()
      .raw()
      .toBuffer();
  } catch {
    return null;
  }
  if (raw.length < DCT_SIZE * DCT_SIZE) return null;

  // raw is one byte per pixel (grayscale), row-major. Reshape to 32×32.
  const luma: number[][] = [];
  for (let y = 0; y < DCT_SIZE; y++) {
    const row = new Array<number>(DCT_SIZE);
    for (let x = 0; x < DCT_SIZE; x++) row[x] = raw[y * DCT_SIZE + x]!;
    luma[y] = row;
  }

  const coeffs = dct2dLowFreq(luma, DCT_SIZE);

  // Collect the 63 low-frequency coefficients (exclude DC at [0,0]).
  const flat: number[] = [];
  for (let u = 0; u < LOW_FREQ; u++) {
    for (let v = 0; v < LOW_FREQ; v++) {
      if (u === 0 && v === 0) continue;
      flat.push(coeffs[u]![v]!);
    }
  }

  const median = medianOf(flat);

  // Build the 64-bit hash. Bit position i (MSB-first) is set when the i-th
  // coefficient exceeds the median. The 64th bit (the skipped DC slot) stays 0.
  let hash = 0n;
  for (let i = 0; i < 63; i++) {
    hash <<= 1n;
    if (flat[i]! > median) hash |= 1n;
  }
  hash <<= 1n; // 64th bit = 0 (the DC placeholder)

  // Pack into a SIGNED 64-bit range so it round-trips through Postgres BIGINT.
  return BigInt.asIntN(64, hash);
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Hamming distance (number of differing bits) between two 64-bit pHashes.
 * Mirrors the SQL `public.hamming_distance(bigint, bigint)` so client-side /
 * test reasoning matches the DB match. Brian-Kernighan popcount over the XOR.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  // Work in the unsigned 64-bit domain so the XOR/shift never sees a sign bit.
  let x = BigInt.asUintN(64, a) ^ BigInt.asUintN(64, b);
  let count = 0;
  while (x !== 0n) {
    x &= x - 1n; // clear the lowest set bit
    count++;
  }
  return count;
}

/**
 * Serialize a pHash BigInt to the decimal string the supabase-js client binds
 * into a Postgres BIGINT column (the client can't bind a native BigInt). The
 * value is the signed 64-bit form produced by computePHash.
 */
export function phashToDbString(phash: bigint): string {
  return BigInt.asIntN(64, phash).toString(10);
}

/**
 * Parse a Postgres BIGINT (returned by supabase-js as a string or number) back
 * into the signed 64-bit BigInt the hamming helpers expect.
 */
export function phashFromDb(value: string | number | bigint): bigint {
  return BigInt.asIntN(64, BigInt(value));
}
