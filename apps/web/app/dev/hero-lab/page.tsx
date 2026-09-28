/**
 * /dev/hero-lab — the hero's four designs on fixture words, with no sign-in
 * and no database (hero designs 2–4, 2026-09-28). DEV-ONLY: production builds
 * 404 this route, the same kill-switch as `/dev/booth-lab`. NODE_ENV is
 * inlined at build time, so the guard is free and the lab never ships.
 *
 * Why it exists: a design is layout — long names wrapping on a 375px phone, a
 * ring around a real logo, words anchored low — and no unit test lays out. This
 * page draws the REAL `PahinaMasthead` (the one every guest surface mounts)
 * for all four designs, in a chosen theme, with the prototype's own monogram
 * and the longest names the brief asks for, so a session — or the owner on a
 * phone pointed at a dev server — can check every design before a PR.
 *
 *   ?theme=galeriya|velvet|…   the theme (default: house, i.e. Classic)
 *   ?photo=1                   the plain masthead with a cover plate (a hero photo)
 *   ?onday=1                   the Happening-now pill
 *   ?names=short               "Indalecio & Claire" instead of the long pair
 *   ?link=See+you+there        the couple's own words on the link down (the `link` part)
 *   ?maker=1                   stamp the parts as the Maker canvas does (`data-el`)
 */
import { notFound } from 'next/navigation';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { siteSkin } from '@/app/[slug]/_components/skins/site-skin';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { invitationCard, mastheadEyebrow } from '@/app/[slug]/_lib/invitation-card';
import { BespokeMonogramMark } from '@/app/_components/bespoke-monogram-mark';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { sanitizeHubElements } from '@/lib/element-style';
import { HERO_DESIGNS, heroDesignLabel } from '@/lib/hero-design';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { LAB_MARK_SVG } from './mark';

const LONG = 'Maria Clara Concepcion & Juan Miguel de los Santos';
const SHORT = 'Indalecio & Claire';

export default async function HeroLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const theme = normalizeThemeId(one('theme')) ?? 'house';
  const photo = one('photo') === '1';
  const onday = one('onday') === '1';
  const displayName = one('names') === 'short' ? SHORT : LONG;
  const elements = sanitizeHubElements({ link: { word: one('link') } });
  const maker = one('maker') === '1';
  /* ?only=marquee — one design alone, for a screenshot of exactly one hero. */
  const only = HERO_DESIGNS.find((d) => d === one('only')) ?? null;
  const shown = only ? [only] : HERO_DESIGNS;
  const words = eventWordsFromProfile(WEDDING_PROFILE);
  const card = photo ? null : invitationCard({ words, firstStartAt: '2026-12-18T13:30:00+08:00' });
  const skin = theme === 'house' ? undefined : siteSkin(theme, { accent: INVITE_THEMES[theme].palette.accent });
  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const all = { theme, photo: photo ? '1' : null, onday: onday ? '1' : null, names: displayName === SHORT ? 'short' : null, ...patch };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const s = p.toString();
    return `/dev/hero-lab${s ? `?${s}` : ''}`;
  };
  const badge = onday ? (
    <p className="inline-flex items-center gap-2 rounded-full border border-terracotta px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
      Happening now
    </p>
  ) : null;

  return (
    <div className="min-h-dvh text-ink">
      <nav className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/10 bg-cream/95 px-4 py-2 text-xs backdrop-blur" data-app-chrome="">
        <span className="font-semibold">Hero lab</span>
        {Object.values(INVITE_THEMES).map((t) => (
          <a key={t.id} href={qs({ theme: t.id })} className={t.id === theme ? 'font-semibold underline' : 'text-ink/70'}>
            {t.name}
          </a>
        ))}
        <span className="text-ink/30">·</span>
        <a href={qs({ photo: photo ? null : '1' })}>{photo ? 'card' : 'photo'}</a>
        <a href={qs({ onday: onday ? null : '1' })}>{onday ? 'not the day' : 'on the day'}</a>
        <a href={qs({ names: displayName === SHORT ? null : 'short' })}>{displayName === SHORT ? 'long names' : 'short names'}</a>
      </nav>
      <div
        className={`sn-editorial min-h-dvh bg-cream text-ink ${skin?.className ?? ''}`.trim()}
        data-hub-theme={theme === 'house' ? undefined : theme}
        data-guest-look=""
        style={skin?.style as React.CSSProperties | undefined}
      >
        {shown.map((design) => (
          <section key={design} data-lab-design={design} className="border-b border-ink/10 pb-10">
            <p className="px-4 pt-6 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/55">{heroDesignLabel(design)}</p>
            <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10 xl:max-w-5xl 2xl:max-w-[76rem] xl:px-8">
              <div className="space-y-6 text-center">
                <PahinaMasthead
                  design={design}
                  elements={elements}
                  stampElements={maker}
                  eyebrow={mastheadEyebrow(words)}
                  displayName={displayName}
                  twoPeople={words.twoPeople}
                  eventDate="2026-12-18"
                  venueName="San Agustin Church, Intramuros"
                  card={card ?? undefined}
                  badgeSlot={badge}
                  monogramSlot={<BespokeMonogramMark svg={LAB_MARK_SVG} size="md" />}
                  {...(photo
                    ? {
                        mediaSlot: <div className="absolute inset-0 bg-[linear-gradient(135deg,#8b5333,#2b1d10)]" />,
                        mediaCaption: 'San Agustin Church, Intramuros',
                      }
                    : {})}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
