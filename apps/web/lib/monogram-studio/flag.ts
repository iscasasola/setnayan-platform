/**
 * lib/monogram-studio/flag.ts
 *
 * The `monogram_studio_v2` launch flag (Monogram Maker council verdict
 * 2026-07-17 §2 + §7): one flag gates the studio's replotted editor —
 * Letters · Frame · Reveal tabs, the reordered panel, the sticky mobile save,
 * the atelier reskin (PR-3), and the PR-4/5/6 surfaces that hang off the v2
 * markup (frame shelf · starting points · reveal tempo chips).
 *
 * NEXT_PUBLIC_ because the choice happens in the client hosts (studio.tsx +
 * public-monogram-studio.tsx pick which STUDIO_HTML/CSS variant to inject) —
 * the engine itself feature-detects the injected DOM and needs no flag.
 * Default OFF → both studios render the shipped v1 markup byte-identically.
 */
export function monogramStudioV2Enabled(): boolean {
  const v = process.env.NEXT_PUBLIC_MONOGRAM_STUDIO_V2;
  return v === '1' || v === 'true';
}
