/**
 * /dev/shop-back-lab — where a shop page's back door goes, per arrival and per plan (owner 2026-11-07: "back to
 * suppliers? it went to a wrong shell … please check the elements of the suppliers website for all plan styles").
 * No sign-in, no database. DEV-ONLY: production builds 404 this route first thing.
 *
 * The doors in, the arrival they stamp, and the door at the foot of Inquire are all decided by the REAL rule —
 * `lib/shop-back.ts` (`shopBackDoor`, `withShopArrival`) — and the Check a date door is the real `CheckADateLink`. The
 * shop body around them is a marked stand-in for the page's own markup (`app/v/[slug]/page.tsx`, the Inquire section).
 *
 *   (no params)                                  the doors in: Discover · Explore · search · an event's Suppliers · saved · shared link
 *   ?from=discover|explore|search|favorites|event|cold   the shop, as reached from there
 *   &plan=free|verified|solo|pro|ultra           the plan pill (the back door does not depend on the plan — this proves it)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Send } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { CheckADateLink } from '@/app/v/[slug]/_components/check-a-date-link';
import { SHOP_ARRIVAL_SRC, shopBackDoor, withShopArrival } from '@/lib/shop-back';

const NAME = 'SetnaProd (lab)';
const SLUG = 'setnaprod';
const LAB_EVENT = '00000000-0000-4000-8000-0000000000e1';
const PLANS = ['free', 'verified', 'solo', 'pro', 'ultra'] as const;
type Plan = (typeof PLANS)[number];

const FROM: Record<string, { label: string; src: string | null; eventId: string | null }> = {
  discover: { label: 'Discover › the first shops', src: SHOP_ARRIVAL_SRC.discover, eventId: null },
  explore: { label: 'Suppliers (/explore) › a card', src: SHOP_ARRIVAL_SRC.explore, eventId: null },
  search: { label: 'Discover › search results', src: SHOP_ARRIVAL_SRC.search, eventId: null },
  event: { label: "An event's Suppliers › a supplier", src: null, eventId: LAB_EVENT },
  favorites: { label: 'Memories › Saved suppliers › Contact', src: SHOP_ARRIVAL_SRC.favorites, eventId: null },
  cold: { label: 'A shared link (nothing behind it)', src: null, eventId: null },
};

export default async function ShopBackLabPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; plan?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const plan: Plan = (PLANS as readonly string[]).includes(sp.plan ?? '') ? (sp.plan as Plan) : 'solo';
  const from = sp.from && sp.from in FROM ? FROM[sp.from]! : null;

  if (!from) {
    return (
      <main className="min-h-dvh bg-cream px-4 py-8" data-shop-back-lab="doors">
        <h1 className="text-xl font-semibold text-ink">Open {NAME} from…</h1>
        <p className="mt-1 text-sm text-ink/60">Each row is a door into the shop page, stamping its arrival.</p>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {Object.entries(FROM).map(([key, f]) => (
            <li key={key}>
              <Link
                href={`/dev/shop-back-lab?from=${key}&plan=${plan}`}
                className="flex min-h-11 items-center py-3 text-[15px] font-medium text-ink"
                data-lab-door={key}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink/60">
          Plan:{' '}
          {PLANS.map((p) => (
            <Link key={p} href={`/dev/shop-back-lab?plan=${p}`} className={`mr-3 ${p === plan ? 'font-semibold text-ink' : ''}`}>
              {p}
            </Link>
          ))}
        </p>
      </main>
    );
  }

  const arrival = { src: from.src, eventId: from.eventId };
  const back = shopBackDoor(arrival);
  return (
    <main className="min-h-dvh bg-cream" data-shop-back-lab="shop" data-from={sp.from}>
      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
        </div>
      </header>
      <article className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Stand-in shop · plan <span data-lab-plan={plan}>{plan}</span> · arrived from {from.label}
        </p>
        <h1 className="mt-2 font-serif text-3xl italic text-ink">{NAME}</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="#get-in-touch" className="button-primary inline-flex items-center gap-2">
            <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Inquire
          </a>
          <CheckADateLink
            href={withShopArrival(`/v/${SLUG}/dates`, arrival)}
            className="button-secondary inline-flex items-center gap-2"
          />
        </div>
        <div className="h-[60vh]" aria-hidden />
        <section id="get-in-touch" className="scroll-mt-24 space-y-4 py-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Inquire</h2>
          <p className="max-w-2xl text-sm text-ink/65">
            <span className="font-medium text-ink">{NAME}</span> hasn&rsquo;t listed a service you can ask about yet.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="button-primary">
              Plan with Setnayan
            </Link>
            <Link href={back.href} className="button-secondary" data-shop-back={back.back ? 'back' : 'cold'}>
              {back.label}
            </Link>
          </div>
          <p className="font-mono text-[11px] text-ink/50" data-lab-back-href="">
            → {back.href}
          </p>
        </section>
      </article>
    </main>
  );
}
