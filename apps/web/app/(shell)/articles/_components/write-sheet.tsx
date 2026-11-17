'use client';

import { useMemo, useState } from 'react';
import { findPostLinks, normalizeTags } from '@/lib/article-links';
import { PUBLIC_POSTS_ARE_FINDABLE } from '@/lib/creator-chapters';
import { createChapter } from '@/app/dashboard/(account)/creator/actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * Write a post (drawing v15 "Write a post", approved 17 Nov · rises full screen). Text and links. No photos or
 * videos. It posts through the shipped `createChapter` (`surface=articles`) — no new server action.
 *
 *   · Post as {name} — the FIRST post only. Suppliers always post as their shop and skip it.
 *   · Title · Tags (up to 3) · Your post
 *   · Your links — each link the writer typed, as it will show: a setnayan.com link gets a card (read later from
 *     our own data); an outside link is "shown as text". Nothing is fetched while typing.
 *   · ⓘ "Public posts can appear on Google and in AI answers."
 */
export function WriteSheet({
  shopName,
  postingName,
  error,
}: {
  shopName: string | null;
  postingName: string | null;
  error: string | null;
}) {
  const [body, setBody] = useState('');
  const [tagText, setTagText] = useState('');
  const links = useMemo(() => findPostLinks(body), [body]);
  const tags = normalizeTags(tagText);
  const askName = !shopName && !postingName;

  return (
    <form action={createChapter} className="space-y-4" data-write-sheet>
      <input type="hidden" name="surface" value="articles" />
      <p className="text-sm text-ink/75">Text and links. No photos or videos.</p>

      {askName ? (
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-ink">Post as</span>
          <input name="posting_name" required maxLength={30} placeholder="tagaytaybride" className="input-field" autoComplete="nickname" />
          <span className="block text-xs text-ink/70">
            Your name on every post and reply. Your account stays behind it, so Report still works. Suppliers always
            post as their shop and skip this.
          </span>
        </label>
      ) : (
        <p className="text-xs text-ink/70">
          Posting as <span className="font-medium text-ink">{shopName ?? postingName}</span>
          {shopName ? ' — your shop, with the Supplier mark' : ''}
        </p>
      )}

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Title</span>
        <input name="title" required maxLength={160} placeholder="Garden or church in Tagaytay for 150 guests?" className="input-field" />
      </label>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Tags · up to 3</span>
        <input
          name="tags"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          placeholder="venues, Tagaytay"
          className="input-field"
        />
        {tags.length > 0 ? (
          <span className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-medium text-ink/80">
                {t}
              </span>
            ))}
          </span>
        ) : null}
      </label>

      <label className="block space-y-1">
        <span className="block text-xs font-medium text-ink">Your post</span>
        <textarea
          name="body"
          required
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'We’re torn between these two. Has anyone booked them?\n\nPaste a link as it is.'}
          className="input-field"
        />
      </label>

      {links.length > 0 ? (
        <div className="space-y-2" data-your-links>
          <p className="text-xs font-medium text-ink">Your links</p>
          {links.map((l) =>
            l.kind === 'setnayan' ? (
              <p key={l.text} className="rounded-xl border border-ink/12 bg-white px-3 py-2 text-sm text-ink">
                <span className="block text-[12px] text-ink/70">setnayan.com · shows as a card</span>
                {l.text}
              </p>
            ) : (
              <p key={l.text} className="rounded-xl bg-ink/[0.03] px-3 py-2 text-sm text-ink/80">
                <span className="block break-all">{l.text}</span>
                <span className="block text-[12px] text-ink/70">Outside link · shown as text</span>
              </p>
            ),
          )}
          <p className="text-[12px] text-ink/70">
            ⓘ The card is read from Setnayan’s own data for that page. Nothing is fetched from outside sites.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}

      <p className="text-[12px] text-ink/70">ⓘ {PUBLIC_POSTS_ARE_FINDABLE}</p>
      <SubmitButton className="ab ab-brand ab-main inline-flex min-h-11 items-center justify-center" pendingLabel="Posting…">
        Post
      </SubmitButton>
    </form>
  );
}
