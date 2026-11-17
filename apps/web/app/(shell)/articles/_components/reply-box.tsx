'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { normalizePostingName } from '@/lib/article-links';
import { FormRows, TypedRow } from '@/app/_components/form-row';

/**
 * Write a reply (drawing v15 "An article" · Replies). ONE level deep — there is nothing to reply TO but the
 * article (the table has no parent column).
 *
 * 🔑 NO NEW SERVER ACTION AND NO NEW ROUTE. The reply is inserted through the visitor's own session into
 * `creator_chapter_replies`, whose RLS admits a signed-in author on a live article and whose trigger stamps the
 * shop the author speaks for — the database is the control, so the browser cannot choose any of it. The new
 * reply is appended in place (no page refresh); a refusal is said on screen, never swallowed.
 *
 * The first time a person with no shop replies, they choose the name they post under ("Your name on every post
 * and reply"). A shop never sees this — it always replies as the shop.
 */
export type NewReply = { replyId: string; body: string; createdAt: string; name: string; asShop: boolean };

export function ReplyBox({
  chapterId,
  signedIn,
  shopName,
  postingName,
  loginHref,
  onPosted,
}: {
  chapterId: string;
  signedIn: boolean;
  shopName: string | null;
  postingName: string | null;
  loginHref: string;
  onPosted?: (r: NewReply) => void;
}) {
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<NewReply[]>([]);
  const [pending, start] = useTransition();
  const [myName, setMyName] = useState(postingName);

  if (!signedIn) {
    return (
      <p className="text-sm text-ink/75">
        <Link href={loginHref} className="font-semibold text-link underline underline-offset-2">
          Sign in to reply
        </Link>
      </p>
    );
  }

  const needsName = !shopName && !myName;

  function submit() {
    const text = body.trim();
    if (!text) return setError('Write something first.');
    let chosen: string | null = null;
    if (needsName) {
      chosen = normalizePostingName(name);
      if (!chosen) return setError('Pick a name of 3–30 letters, numbers, dots or underscores.');
    }
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return setError('Your session ended — sign in again to reply.');
      if (chosen) {
        const { error: nameError } = await supabase.from('users').update({ posting_name: chosen }).eq('user_id', uid);
        if (nameError) {
          return setError(/duplicate|unique/i.test(nameError.message) ? 'That name is taken — try another.' : 'We couldn’t save your name. Please try again.');
        }
        setMyName(chosen);
      }
      const { data, error: insertError } = await supabase
        .from('creator_chapter_replies')
        .insert({ chapter_id: chapterId, user_id: uid, body: text })
        .select('reply_id, created_at, posted_as_vendor_id')
        .single();
      if (insertError || !data) return setError('That didn’t post. Please try again.');
      const reply: NewReply = {
        replyId: data.reply_id as string,
        body: text,
        createdAt: data.created_at as string,
        name: shopName ?? chosen ?? myName ?? 'You',
        asShop: Boolean(data.posted_as_vendor_id),
      };
      setPosted((p) => [...p, reply]);
      onPosted?.(reply);
      setBody('');
    });
  }

  return (
    <div className="space-y-3">
      {posted.map((r) => (
        <div key={r.replyId} className="rounded-xl bg-ink/[0.03] px-3 py-2" data-new-reply>
          <p className="text-[13px] text-ink/70">
            <span className="font-medium text-ink">{r.name}</span>
            {r.asShop ? <span className="ml-1 text-[11px] font-semibold text-ink/80">Supplier</span> : null} · now
          </p>
          <p className="whitespace-pre-line text-sm text-ink/90">{r.body}</p>
        </div>
      ))}
      {needsName ? (
        <FormRows width="wide" data="reply-post-as">
          <TypedRow
            name="Post as"
            value={name}
            boxed
            maxLength={30}
            placeholder="tagaytaybride"
            autoComplete="nickname"
            onType={setName}
            onKeep={(t) => {
              setName(t);
            }}
            note="Your name on every post and reply. Your account stays behind it, so Report still works."
          />
        </FormRows>
      ) : (
        <p className="text-xs text-ink/70">
          Replying as <span className="font-medium text-ink">{shopName ?? myName}</span>
          {shopName ? ' — your shop, with the Supplier mark' : ''}
        </p>
      )}
      <label className="block">
        <span className="sr-only">Write a reply</span>
        <textarea // field-ok: a reply composer — the chat composer's template (type, send), not a form row
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Write a reply"
          className="input-field"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={submit} disabled={pending} className="ab ab-brand ab-main inline-flex min-h-11 items-center">
        {pending ? 'Posting…' : 'Reply'}
      </button>
    </div>
  );
}
