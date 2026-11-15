/**
 * /dev/offer-card-lab — DEV-ONLY: production builds 404 this route. The lab itself is `./lab.tsx`.
 *
 * 📦 A LAB THAT 404s ADDS NOTHING TO PRODUCTION — the same dynamic-import shape as /dev/chat-cards-c-lab (its parts
 * never enter the production module graph, so no chunk is added under the 202.3 KB shared-bundle lock).
 */
import { notFound } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OfferCardLabPage(props: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { default: Lab } = await import('./lab');
    return <Lab {...props} />;
  }
}
