import { NextResponse } from 'next/server';
import { resolveDesktopRelease } from '@/lib/desktop-release-server';

// /api/download/mac -> 302 to the current macOS .dmg on R2 (setnayan-media,
// desktop/latest/). Apple Silicon only for now (M1-M4). Intel-Mac users fall
// back to web. `DESKTOP_RELEASE.mac.aarch64.url` used to be a relative
// `/downloads/<file>.dmg` path resolved against `request.url`; now that R2
// serves an already-absolute URL, `new URL(url, request.url)` still works
// (an absolute `url` argument ignores the base), so callers of this route
// don't need to change.
export async function GET(request: Request) {
  const release = await resolveDesktopRelease();
  if (!release) {
    return NextResponse.json(
      { error: 'No macOS build is published right now. Try again shortly, or see /download.' },
      { status: 503 },
    );
  }
  const target = new URL(release.mac.aarch64.url, request.url);
  return NextResponse.redirect(target, 302);
}
