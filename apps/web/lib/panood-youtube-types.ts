/**
 * apps/web/lib/panood-youtube-types.ts
 *
 * TYPES ONLY — no runtime, no imports, and deliberately NO `server-only`.
 *
 * WHY IT EXISTS. `lib/panood-youtube.ts` carries `import 'server-only'`, so any
 * module that reaches for one of its shapes would drag the whole thing into its
 * graph — which, as `lib/live-studio-roam-provision.ts` documents at its top,
 * makes the importer unrunnable under `tsx --test` (the repo's unit runner does
 * not resolve `server-only`). The Live Studio libs work around that for VALUES by
 * importing dynamically inside the function that needs them; a type cannot be
 * imported dynamically, so it lives here instead and `panood-youtube.ts`
 * re-exports it. One definition, importable from a pure module.
 */

/**
 * An archived broadcast as YouTube's `videos.list` reports it after a stream ends.
 * See `fetchYoutubeVideoArchives` in `lib/panood-youtube.ts`.
 */
export type YoutubeVideoArchive = {
  videoId: string;
  title: string;
  /** Null while YouTube is still processing the archive (it reports `PT0S`). */
  durationSeconds: number | null;
  /** YouTube's own privacy value — expected 'unlisted' for our broadcasts. */
  privacyStatus: string | null;
  /** True once YouTube has finished processing (`uploadStatus === 'processed'`). */
  processed: boolean;
};
