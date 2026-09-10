/**
 * lib/invite-ground-rule.ts — WHICH ground a Pro invite theme is painted on.
 *
 * The pure half of lib/invite-ground.ts: every decision, and no I/O. The
 * presign is passed in, so the rule is tested with a fake one and the server
 * wrapper supplies the real one (`displayUrlForStdBackground`, server-only).
 * See lib/invite-ground.ts for why an upload must be a genuine `r2://` object.
 */
import { realisticBgSrc, resolveStdBackground } from '@/lib/std-backgrounds';

export type InviteGround = {
  /** A URL to paint, or null when the theme's own ground should show. */
  photo: string | null;
  /** The couple's plain background colour, when that is what they chose. */
  color: string | null;
};

export async function groundFromBackground(
  raw: unknown,
  presignUpload: (r2Ref: string) => Promise<string | null>,
): Promise<InviteGround> {
  // Never chosen → the theme's own ground. `resolveStdBackground` would hand
  // back its DEFAULT plain colour here, and a theme must not read that as a
  // colour the couple picked.
  if (!raw || typeof raw !== 'object') return { photo: null, color: null };
  const bg = resolveStdBackground(raw);
  if (bg.kind === 'realistic') return { photo: realisticBgSrc(bg.value), color: null };
  if (bg.kind === 'upload') {
    if (!bg.value.startsWith('r2://')) return { photo: null, color: null };
    try {
      return { photo: await presignUpload(bg.value), color: null };
    } catch {
      // A failed presign costs the photo, never the door.
      return { photo: null, color: null };
    }
  }
  // Only a colour the couple actually CHOSE — a malformed row also resolves to
  // 'plain' (the default), and that must not read as their choice either.
  if (bg.kind === 'plain') {
    return { photo: null, color: (raw as { kind?: unknown }).kind === 'plain' ? bg.value : null };
  }
  return { photo: null, color: null };
}
