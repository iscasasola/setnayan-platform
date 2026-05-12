import Link from 'next/link';

export const metadata = { title: 'In-App Services' };

// Service launcher manifest. Each card registers here. When a new iteration
// ships, it adds one entry. Wallet card REMOVED per the 2026-05-11 token-wallet
// retirement; "Orders" links to the apply-then-pay surface from iteration 0034.
const SERVICES = [
  {
    key: 'orders',
    label: 'Orders',
    emoji: '🧾',
    iteration: '0034',
    blurb: 'View your in-app purchases · reference codes · payment status',
    cta: 'View orders',
  },
  {
    key: 'mood-board',
    label: 'Mood Board',
    emoji: '🎨',
    iteration: '0010',
    blurb: 'Per-role palettes · Setnayan Guide rule engine · 20 themes',
    cta: 'Open',
  },
  {
    key: 'papic',
    label: 'Papic',
    emoji: '📸',
    iteration: '0012',
    blurb: 'Candid capture · gesture shutter · QR tagging · personal reels',
    cta: 'Set up',
  },
  {
    key: 'panood',
    label: 'Panood',
    emoji: '📺',
    iteration: '0011',
    blurb: 'Live stream · YouTube delivery · AI Highlights · Same-Day Edit',
    cta: 'Set up',
  },
  {
    key: 'photo-delivery',
    label: 'Photo Delivery',
    emoji: '☁️',
    iteration: '0009',
    blurb: 'Google Drive integration for full-resolution photo handoff',
    cta: 'Connect',
  },
  {
    key: 'led',
    label: 'LED Background',
    emoji: '🌟',
    iteration: '0005',
    blurb: '8K template render · Photo Pool blend · USB delivery',
    cta: 'Choose template',
  },
] as const;

type Props = { params: Promise<{ eventId: string }> };

export default async function ServicesPage({ params }: Props) {
  const { eventId } = await params;

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          In-App Services
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What would you like to set up?
        </h1>
        <p className="max-w-prose text-base text-ink/60">
          Each Setnayan feature lives here. Cards light up as the iterations behind them ship.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((service) => (
          <li key={service.key}>
            <Link
              href={`/dashboard/${eventId}/services/${service.key}`}
              className="group flex h-full flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5 transition-colors hover:border-terracotta/50 hover:bg-terracotta/5"
            >
              <div className="flex items-start justify-between">
                <span aria-hidden className="text-3xl">
                  {service.emoji}
                </span>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  {service.iteration}
                </span>
              </div>
              <h2 className="text-lg font-semibold tracking-tight">{service.label}</h2>
              <p className="text-sm text-ink/60">{service.blurb}</p>
              <p className="mt-auto text-sm font-medium text-terracotta">
                {service.cta} <span aria-hidden>›</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
