'use client';

import { useMemo, useState } from 'react';
import { findPostLinks, normalizePostingName, normalizeTags } from '@/lib/article-links';
import { CHAPTER_BODY_MAX, PUBLIC_POSTS_ARE_FINDABLE } from '@/lib/creator-chapters';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { createChapter } from '@/app/dashboard/(account)/creator/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import Link from 'next/link';
import { X } from 'lucide-react';

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
  const keep = () => undefined;

  return (
    <StayForm door="accCreator.createChapter" action={createChapter} className="space-y-4" data-write-sheet>
      <input type="hidden" name="surface" value="articles" />
      {/* The sheet's head, as drawn: ✕ · the title · Post — Post sits where the thumb finishes, not under the form. */}
      <div className="flex items-center gap-2">
        <Link href="/articles" aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/[0.06]">
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-lg font-semibold text-ink">Write a post</h1>
        <SubmitButton className="ab ab-brand ab-main inline-flex min-h-11 items-center justify-center" pendingLabel="Posting…">
          Post
        </SubmitButton>
      </div>
      <p className="text-sm text-ink/75">Text and links. No photos or videos.</p>

      {!askName ? (
        <p className="text-xs text-ink/70">
          Posting as <span className="font-medium text-ink">{shopName ?? postingName}</span>
          {shopName ? ' — your shop, with the Supplier mark' : ''}
        </p>
      ) : null}

      <FormRows width="wide" data="write-a-post">
        {askName ? (
          <TypedRow
            name="Post as"
            value=""
            fieldName="posting_name"
            boxed
            required
            maxLength={30}
            placeholder="tagaytaybride"
            autoComplete="nickname"
            check={(t) => (t.trim() && !normalizePostingName(t) ? '3–30 letters, numbers, dots or underscores' : null)}
            note="Your name on every post and reply. Your account stays behind it, so Report still works. Suppliers always post as their shop and skip this."
            onKeep={keep}
          />
        ) : null}
        <TypedRow
          name="Title"
          value=""
          fieldName="title"
          boxed
          required
          maxLength={160}
          placeholder="Garden or church in Tagaytay for 150 guests?"
          onKeep={keep}
        />
        <TypedRow
          name="Tags · up to 3"
          value=""
          fieldName="tags"
          boxed
          maxLength={100}
          placeholder="venues, Tagaytay"
          onType={setTagText}
          onKeep={(t) => {
            setTagText(t);
          }}
          below={
            tags.length > 0 ? (
              <span className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span key={t} className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-medium text-ink/80">
                    {t}
                  </span>
                ))}
              </span>
            ) : null
          }
        />
        <TypedRow
          name="Your post"
          value=""
          fieldName="body"
          long
          boxed
          required
          maxLength={CHAPTER_BODY_MAX}
          placeholder="We’re torn between these two. Has anyone booked them? Paste a link as it is."
          onType={setBody}
          onKeep={(t) => {
            setBody(t);
          }}
        />
      </FormRows>

      {links.length > 0 ? (
        <div className="space-y-2" data-your-links>
          <p className="text-xs font-medium text-ink">Your links</p>
          {links.map((l) =>
            l.kind === 'setnayan' ? (
              <p key={l.text} className="sn-frame px-3 py-2 text-sm text-ink">
                <span className="block text-[12px] text-ink/70">setnayan.com · shows as a card</span>
                {l.text}
              </p>
            ) : (
              <p key={l.text} className="px-1 text-sm">
                <span className="block break-all text-link underline decoration-ink/25 underline-offset-2">{l.text}</span>
                <span className="block text-[12px] text-ink/70">Outside link · a link only, no card</span>
              </p>
            ),
          )}
          <p className="text-[12px] text-ink/70">
            The card is read from Setnayan’s own data for that page. Nothing is fetched from outside sites.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}

      <p className="text-[12px] text-ink/70">{PUBLIC_POSTS_ARE_FINDABLE}</p>
    </StayForm>
  );
}
