import 'server-only';

/**
 * apps/web/lib/love-story-screen.ts
 *
 * THE LOVE STORY'S PHOTO SCREEN — the `updateOurPhotos` rule, fail-closed: any
 * ref whose bytes cannot be read or classified is BLOCKED, never passed.
 *
 * `events.love_story` has no moderation state, so a ref in its moments IS on
 * the public page. Two callers ask the same question, so it lives here once:
 *   · `loveStoryMomentAction` — before a new photo is written (live or draft);
 *   · `hubDraftAction` Apply — before a DRAFTED story reaches the live column,
 *     because a draft `save` is a public POST like any other and may carry a
 *     ref the moment action never saw.
 *
 * Moved verbatim from `website/our-story/actions.ts` (2026-09-25).
 */
export async function screenNewPhotoRefs(refs: readonly string[]): Promise<string[]> {
  const [{ classifyImageBytes, decideNsfw, parseR2Ref }, { readR2Object }, { R2_BUCKETS }] = await Promise.all([
    import('@/lib/nsfw-screen'),
    import('@/lib/drive-upload'),
    import('@/lib/r2'),
  ]);
  const blocked: string[] = [];
  for (const ref of refs) {
    try {
      const { bucket, key } = parseR2Ref(ref);
      const bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);
      if (decideNsfw(await classifyImageBytes(bytes)) === 'nsfw_blocked') blocked.push(ref);
    } catch {
      blocked.push(ref);
    }
  }
  return blocked;
}
