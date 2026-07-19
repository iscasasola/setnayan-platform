import { redirect } from 'next/navigation';

/**
 * Legacy /admin/moodboard-library → Studio Studio redirect (Studio Studio
 * slice 2).
 *
 * The Moodboard Library now lives at /admin/studio?tab=moodboard-library; its
 * body was re-homed byte-identical into
 * app/admin/studio/_surfaces/moodboard-library-surface.tsx. The legacy route
 * had no search params, so this stub forwards straight to the studio tab.
 *
 * NOTE: _components/ (LibraryEditor + color-range-manipulator) is intentionally
 * NOT moved — the re-homed surface imports them from here.
 */
export const dynamic = 'force-dynamic';

export default function AdminMoodboardLibraryRedirect() {
  redirect('/admin/studio?tab=moodboard-library');
}
