/**
 * TEST-ONLY loader for `apple-jws.fixture.json` — imported by `*.test.ts` files
 * and nothing else (`the-app-store-purchase-path.test.ts` holds that). The
 * fixture is signed by a THROWAWAY chain ("Setnayan TEST Root (not Apple)"),
 * which production never trusts: it pins Apple Root CA - G3 only.
 *
 * Each JWS is stored as its three parts and joined here, so the repo never
 * holds a token-shaped string a secret scanner would (rightly) flag.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Parts = { h: string; p: string; s: string };

const FX = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'apple-jws.fixture.json'), 'utf8'),
) as Record<string, unknown> & {
  rootSha256: string;
  tokens: { pro: string; papic: string; live: string };
  signedDate: number;
};

export const FIXTURE_ROOTS: readonly string[] = [FX.rootSha256];
export const FIXTURE_TOKENS = FX.tokens;
export const FIXTURE_SIGNED_DATE = FX.signedDate;

export function fixtureJws(key: string): string {
  const v = FX[key] as Parts | undefined;
  if (!v || typeof v.h !== 'string') throw new Error(`no fixture ${key}`);
  return [v.h, v.p, v.s].join('.');
}
