/** The feed streams its own content; the shell's bars stay mounted (2026-08-15). It sits in the (list) group so
 *  this boundary does NOT wrap /articles/[slug], whose notFound() must answer a real 404, never a streamed 200. */
export default function ArticlesLoading() {
  return null;
}
