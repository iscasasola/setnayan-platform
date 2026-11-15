'use client';

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { ThumbDock } from '@/components/thumb-dock';
import { ThumbRow } from '@/components/thumb-row';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ARTICLES_LINK_REFUSED_LINE, findArticleLinks, refusedLinks } from '@/lib/articles-links';

/**
 * The Articles composers — "New topic" (prototype screen 2) and the reply box
 * (screen 3) — and the refused-link line (screen 4).
 *
 * 🔗 THE LINK RULE RUNS WHILE TYPING, and it is the SAME `refusedLinks` the
 * write route runs again before anything is stored (`lib/articles-links.ts`).
 * While a refused link is in the box, Send is locked and the line says why,
 * with "Remove the link" to take it out in one tap.
 *
 * Both post to the one write route, `POST /api/articles` — no server action.
 */

/** The reply box's own face — a chat composer, not a form row (see `ReplyComposer`). */
const REPLY_BOX =
  'w-full min-h-11 resize-none rounded-2xl bg-ink/[0.05] px-3 py-2.5 text-[15px] text-ink placeholder:text-ink/55 focus:outline-none focus:ring-2 focus:ring-terracotta/40';

const ERROR_WORDS: Record<string, string> = {
  sign_in: 'Sign in to post.',
  paused: 'Setnayan has paused your posting in Articles.',
  link_refused: ARTICLES_LINK_REFUSED_LINE,
  bad_title: 'Give your topic a title (3 to 120 characters).',
  bad_body: 'Say something (up to 4,000 characters).',
  bad_event: 'Pick an event from the list.',
  no_topic: 'This topic is no longer here.',
  topic_removed: 'This topic was removed, so it takes no more replies.',
  unavailable: 'That didn’t go through. Please try again.',
};

async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string; publicId?: string }> {
  try {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok: boolean; error?: string; publicId?: string };
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

function removeRefused(text: string): string {
  let out = text;
  for (const l of findArticleLinks(text).filter((x) => !x.allowed).reverse()) {
    out = out.slice(0, l.index) + out.slice(l.index + l.raw.length);
  }
  return out.replace(/[ \t]{2,}/g, ' ');
}

/** The refused-link line (screen 4). Rendered only while a refused link is in the box. */
export function LinkRefusedLine({ text, onRemove }: { text: string; onRemove: () => void }) {
  const refused = useMemo(() => refusedLinks(text), [text]);
  if (refused.length === 0) return null;
  return (
    <div role="alert" data-article-link-refused="" className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta-800">
      <p>{ARTICLES_LINK_REFUSED_LINE}</p>
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
      >
        Remove the link
      </button>
    </div>
  );
}

export type EventChoice = { key: string; label: string };

/** "New topic" in the thumb zone, and the full-screen form it opens. */
export function NewTopic({
  postAs,
  events,
  paused,
}: {
  /** "Guest · 3F" — a fresh code for this new topic (nobody else is in it yet). */
  postAs: string;
  events: readonly EventChoice[];
  paused: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    if (!pending) setOpen(false);
  }, [pending]);
  useModalA11y({ open, onClose: close, containerRef: ref });

  const blocked = refusedLinks(`${title}\n${body}`).length > 0;
  const code = postAs.split(' · ')[1] ?? '';

  function send() {
    setError(null);
    start(async () => {
      const res = await post({ op: 'topic', title, body, eventType, code });
      if (res.ok && res.publicId) {
        setOpen(false);
        router.push(`/articles/${res.publicId}`);
      } else setError(ERROR_WORDS[res.error ?? 'unavailable'] ?? ERROR_WORDS.unavailable!);
    });
  }

  return (
    <>
      <ThumbDock>
        <ThumbRow
          name="articles"
          action={{ icon: Plus, label: 'New topic', onClick: () => setOpen(true), testId: 'articles-new-topic' }}
        />
      </ThumbDock>
      {open &&
        createPortal(
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-topic-title"
          className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-cream"
        >
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-6 pt-3">
            <div className="flex items-center justify-between">
              <h2 id="new-topic-title" className="text-lg font-semibold text-ink">
                New topic
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/75 hover:bg-ink/[0.06]"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            {paused ? (
              <p className="rounded-xl bg-ink/[0.04] px-3 py-3 text-sm text-ink/80">{ERROR_WORDS.paused}</p>
            ) : (
              <>
                <div className="rounded-xl bg-ink/[0.04] px-3 py-3 text-sm text-ink/80">
                  <p className="font-semibold text-ink">You post as “{postAs}”</p>
                  <p>Readers never see your name. Setnayan knows it is you, so it can act on reports.</p>
                </div>
                <FormRows width="wide">
                  <TypedRow
                    name="Title"
                    boxed
                    value={title}
                    empty="Is a first look worth it?"
                    placeholder="Is a first look worth it?"
                    maxLength={120}
                    required
                    check={(t) => (refusedLinks(t).length ? ARTICLES_LINK_REFUSED_LINE : null)}
                    onType={setTitle}
                    onKeep={(t) => setTitle(t)}
                    data="article-title"
                  />
                  <TypedRow
                    name="Say more"
                    boxed
                    long
                    value={body}
                    empty="Say more"
                    placeholder="We’re split. Did a first look change your day, or take something away?"
                    maxLength={4000}
                    check={(t) => (refusedLinks(t).length ? ARTICLES_LINK_REFUSED_LINE : null)}
                    onType={setBody}
                    onKeep={(t) => setBody(t)}
                    data="article-body"
                  />
                </FormRows>
                <div className="space-y-1">
                  <span className="block text-sm font-medium text-ink">Event</span>
                  <PickMenu
                    label="Event"
                    value={eventType}
                    options={[{ key: '', label: 'Any event' }, ...events]}
                    onPick={setEventType}
                    dataAttr="data-article-event"
                    className="w-full !min-h-11"
                  />
                </div>
                <LinkRefusedLine
                  text={`${title}\n${body}`}
                  onRemove={() => {
                    setTitle((t) => removeRefused(t));
                    setBody((b) => removeRefused(b));
                  }}
                />
                <p className="text-xs text-ink/70">
                  Links can point only to setnayan.com — a shop, a story, an event page. Be kind; no names of real people.
                </p>
                {error && <p className="text-sm font-medium text-terracotta-700">{error}</p>}
                <div className="mt-auto pt-2">
                  <button
                    type="button"
                    onClick={send}
                    disabled={pending || blocked || title.trim().length < 3}
                    className="min-h-11 w-full rounded-xl bg-terracotta-700 px-4 text-sm font-semibold text-cream hover:bg-terracotta-800 disabled:opacity-50"
                  >
                    {pending ? 'Posting…' : 'Post'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

/** The reply box under a thread (screen 3). Enter sends · Shift+Enter makes a new line. */
export function ReplyComposer({ topic, postAs }: { topic: string; postAs: string | null }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const blocked = refusedLinks(body).length > 0;
  const empty = body.trim().length === 0;

  function send() {
    if (blocked || empty || pending) return;
    setError(null);
    start(async () => {
      const res = await post({ op: 'reply', topic, body });
      if (res.ok) {
        setBody('');
        // one-render: keep (fetch) — it follows a `fetch()` to the Articles API route; no server action answered with a render.
        router.refresh();
      } else setError(ERROR_WORDS[res.error ?? 'unavailable'] ?? ERROR_WORDS.unavailable!);
    });
  }

  return (
    <div className="space-y-2" data-article-reply-composer="">
      <LinkRefusedLine text={body} onRemove={() => setBody((b) => removeRefused(b))} />
      {error && <p className="text-sm font-medium text-terracotta-700">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea // field-ok: a chat composer (Enter sends · Shift+Enter makes a new line — prototype screen 3)
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Reply…"
          aria-label="Reply"
          className={REPLY_BOX}
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || blocked || empty}
          className="min-h-11 shrink-0 rounded-xl bg-terracotta-700 px-4 text-sm font-semibold text-cream hover:bg-terracotta-800 disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p className="text-xs text-ink/70">
        Enter sends · Shift+Enter makes a new line.{' '}
        {postAs ? `You post here as “${postAs}”.` : 'You get one code in this topic.'}
      </p>
    </div>
  );
}
