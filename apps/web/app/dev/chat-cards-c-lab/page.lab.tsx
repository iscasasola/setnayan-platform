/**
 * /dev/chat-cards-c-lab — DEV-ONLY: production builds 404 this route. The lab itself is `./lab.tsx`.
 *
 * 📦 A LAB THAT 404s ADDS NOTHING TO PRODUCTION. Its code is imported only inside the branch a production build folds
 * away (`process.env.NODE_ENV` is a build-time constant, so webpack never walks that `import()`), and none of the lab's
 * parts enter the production module graph. Imported statically, a lab's parts become split chunks of their own — and
 * every chunk is one more entry in the webpack runtime that loads on EVERY page, under the 202.3 KB shared-bundle lock
 * (Supplier Build 3 integration, #7416: the lab-only chunks were what pushed the bundle over).
 */
import { notFound } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LaneCLabPage(props: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { default: Lab } = await import('./lab');
    return <Lab {...props} />;
  }
}
