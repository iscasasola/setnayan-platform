import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { postArticleReply, postArticleTopic, type ArticleWriteResult } from '@/lib/articles.server';

/**
 * POST /api/articles — the ONE write path for Articles (a new topic, a reply).
 *
 * A route, not a server action, on purpose: the build carries a ceiling on
 * exported server actions (`scripts/lint-server-action-budget.mjs`) and the
 * Articles build was given ZERO new ones. One route with an `op` serves both
 * writes.
 *
 *   { op: 'topic', title, body, eventType }  → { ok, publicId }
 *   { op: 'reply', topic, body }             → { ok, publicId, post }
 *
 * Every rule is enforced in `lib/articles.server.ts`, behind this door:
 *   · signed in (401 here — reading a topic signed out is fine, posting is not)
 *   · links only to setnayan.com — the SAME `refusedLinks` the composer runs
 *     while typing, run again here before any row is written (422)
 *   · a paused account cannot post (403)
 *   · posts go live at once (owner ruling 1, 16 Nov)
 *
 * JSON only: a cross-site <form> cannot send `application/json` without a
 * preflight, so a cookie-carrying forged post from another site never lands.
 */

export const runtime = 'nodejs';

const STATUS: Record<string, number> = {
  paused: 403,
  link_refused: 422,
  bad_title: 400,
  bad_body: 400,
  bad_event: 400,
  no_topic: 404,
  topic_removed: 409,
  unavailable: 503,
};

function reply(res: ArticleWriteResult): NextResponse {
  if (res.ok) return NextResponse.json(res, { status: 200 });
  return NextResponse.json(res, { status: STATUS[res.error] ?? 400 });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 415 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'sign_in' }, { status: 401 });

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  const str = (k: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : '');

  if (raw.op === 'topic') {
    return reply(
      await postArticleTopic(user.id, {
        title: str('title'),
        body: str('body'),
        eventType: str('eventType') || null,
        code: str('code') || null,
      }),
    );
  }
  if (raw.op === 'reply') {
    return reply(await postArticleReply(user.id, { topicPublicId: str('topic'), body: str('body') }));
  }
  return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
}
