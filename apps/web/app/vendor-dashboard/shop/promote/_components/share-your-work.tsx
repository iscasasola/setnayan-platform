import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { TemplateEmpty } from '@/app/_components/template-rows';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';
import { SaveStoryCardButton } from '@/app/[slug]/recap/_components/save-story-card-button';
import { formatCount } from '@/lib/format-number';
import type { ShareYourWorkData } from './share-your-work-data';

/**
 * 📣 SHARE YOUR WORK — Shop › Promote, row 4 (owner 2026-11-06, verbatim: *"Use fable to decide. Find the best location
 * for each. Make the pages live there and not jump to another menu."* — DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL":
 * real stories + recaps with their Facebook / Pinterest / share / copy / story-card buttons; `/real-stories` and
 * `/recaps` forward to `/shop/promote#share`; out of Settings › More tools).
 *
 * The two retired pages' lists, the SAME buttons, the SAME addresses — reused, never redrawn:
 *   · Stories — a couple you worked with published their event to Stories (`loadVendorFeaturedStories`); the share
 *     carries the editorial's preview (`/api/og/realstory-slug/<slug>`), the story card is its 9:16 (`?format=story`).
 *   · Recaps  — a couple published their recap (`loadVendorRecaps`); same pair of buttons on `/<slug>/recap`.
 * Title + one short line; the why is behind the ⓘ. A refused read says so — never "none". Nothing here can be removed
 * (each row is the couple's, not the shop's), so the rows carry no swipe.
 */

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

type Row = { eventId: string; slug: string; hostNames: string; city: string | null; dateLabel: string | null };

function countLine(rows: Row[] | null, noun: string): string {
  if (rows === null) return 'Couldn’t load — reload to try again';
  if (rows.length === 0) return 'None yet';
  return `${formatCount(rows.length)} ${noun}`;
}

function ShareRow({
  row,
  kicker,
  viewHref,
  viewWord,
  pageUrl,
  ogImage,
  filenameBase,
  data,
}: {
  row: Row;
  kicker: string;
  viewHref: string;
  viewWord: string;
  pageUrl: string;
  ogImage: string;
  filenameBase: string;
  data: string;
}) {
  const meta = [row.city, row.dateLabel].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-col gap-2 border-b border-[color:var(--m-line)] py-3 last:border-b-0" data-share-row={data}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">{kicker}</p>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">{row.hostNames}</p>
        {meta ? <p className="mt-0.5 text-[13px] text-[color:var(--m-slate-2)]">{meta}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ShareButtons url={pageUrl} title={`${row.hostNames} — a day we helped create, on Setnayan`} image={ogImage} />
        {/* IG feed / Stories / TikTok take a file, not a link — the couple's Setnayan-rendered 9:16 card. */}
        <SaveStoryCardButton storyCardUrl={`${ogImage}?format=story`} filenameBase={filenameBase} />
        <Link href={viewHref} target="_blank" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-mulberry underline-offset-4 hover:underline">
          {viewWord}
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </div>
    </li>
  );
}

export function ShareYourWork({ data }: { data: ShareYourWorkData }) {
  const { stories, recaps, recapsGated } = data;
  return (
    <section id="share" className="mt-8 scroll-mt-24" data-share-your-work="" aria-labelledby="share-your-work-title">
      <InfoTip label="Share your work" labelAs="h2" labelClassName="sn-sec" labelId="share-your-work-title" align="start">
        When a couple you worked with publishes their event to Stories, or publishes their recap, it shows here with your
        shop credited. Share it to your Facebook Page or Pinterest, copy the link, or save the story card for Instagram and
        TikTok — real proof of your work, with a preview that leads straight back to their page.
      </InfoTip>

      <div className="mt-2 border-t border-[color:var(--m-line)]">
        <Fold title="Stories" line={countLine(stories, stories?.length === 1 ? 'story' : 'stories')} data="share-stories">
          <div className="pb-3">
            {stories === null ? (
              <p role="alert" className="flex min-h-11 items-center py-2 text-[14px] text-[rgb(var(--color-warn))]" data-share-unread="stories">
                We couldn&rsquo;t load your featured events — not the same as none. Reload to try again.
              </p>
            ) : stories.length === 0 ? (
              <div data-share-empty="stories">
                <TemplateEmpty>
                  <InfoTip label="Your featured events will appear here." align="start">
                    When a couple you worked with publishes their event to Stories, it shows here — ready to share.
                  </InfoTip>
                </TemplateEmpty>
              </div>
            ) : (
              <ul>
                {stories.map((s) => {
                  const ogImage = `${SITE_URL}/api/og/realstory-slug/${s.slug}`;
                  return (
                    <ShareRow
                      key={s.eventId}
                      row={s}
                      kicker="Featured in Stories"
                      viewHref={`/${s.slug}`}
                      viewWord="View the story"
                      pageUrl={`${SITE_URL}/${s.slug}`}
                      ogImage={ogImage}
                      filenameBase={`${s.slug}-story`}
                      data="story"
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </Fold>

        <div className="border-t border-[color:var(--m-line)]">
          <Fold
            title="Recaps"
            line={recapsGated ? 'Starts with Supplier Plus' : countLine(recaps, recaps?.length === 1 ? 'recap' : 'recaps')}
            data="share-recaps"
          >
            <div className="pb-3">
              {recapsGated ? (
                <p className="py-2 text-[13.5px] text-[color:var(--m-slate-2)]" data-share-gated="recaps">
                  One-tap sharing of every recap you helped create is a Supplier Plus feature.
                </p>
              ) : recaps === null ? (
                <p role="alert" className="flex min-h-11 items-center py-2 text-[14px] text-[rgb(var(--color-warn))]" data-share-unread="recaps">
                  We couldn&rsquo;t load your couples&rsquo; recaps — not the same as none. Reload to try again.
                </p>
              ) : recaps.length === 0 ? (
                <div data-share-empty="recaps">
                  <TemplateEmpty>
                    <InfoTip label="Your couples&rsquo; recaps will appear here." align="start">
                      Once someone you helped publishes their recap, you&rsquo;ll find it here — ready to share.
                    </InfoTip>
                  </TemplateEmpty>
                </div>
              ) : (
                <ul>
                  {recaps.map((r) => {
                    const ogImage = `${SITE_URL}/api/og/recap/${r.slug}`;
                    return (
                      <ShareRow
                        key={r.eventId}
                        row={r}
                        kicker="Published recap"
                        viewHref={`/${r.slug}/recap`}
                        viewWord="View the recap"
                        pageUrl={`${SITE_URL}/${r.slug}/recap`}
                        ogImage={ogImage}
                        filenameBase={`${r.slug}-recap`}
                        data="recap"
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </Fold>
        </div>
      </div>
    </section>
  );
}
