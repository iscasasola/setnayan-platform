/**
 * /dev/questions-lab — ❓ QUESTIONS FOR THE COUPLE, EVERY SUPPLIER (owner 2026-11-04, "Yes, every supplier"), on
 * fixture data: no sign-in, no database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL bodies the pages mount, fed fixtures instead of reads:
 *   ?m=author   the supplier writes their set — a caterer, its trade's starting suggestions (`QuestionsSectionBody`)
 *   ?m=couple   the couple answers one supplier in that supplier's room (`SupplierQuestionsBody`)
 *   ?m=answers  the supplier reads the answers on that customer's card (`TheyToldYou`)
 * The ＋ row and its panel are on `/dev/supplier-chat-lab` (tap ＋ → Questions for the couple).
 *
 * The forms post the REAL actions; pressing them here needs a session (the lab draws, it does not save).
 * Names are samples: nobody real.
 */
import { notFound } from 'next/navigation';
import { QuestionsSectionBody } from '@/app/vendor-dashboard/activities/questions-section';
import { SupplierQuestionsBody } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/supplier-questions-card';
import { TheyToldYou } from '@/app/vendor-dashboard/clients/[eventId]/_components/couple-answers';
import { buildQuestionnaire, startersForTiles, type VendorQuestion } from '@/lib/emcee-questions';

const LAB_EVENT = '00000000-0000-4000-8000-0000000000e1';
const LAB_EVENT_VENDOR = '00000000-0000-4000-8000-0000000000bb';
const LAB_SHOP = '00000000-0000-4000-8000-0000000000cc';

const CATERER: VendorQuestion[] = startersForTiles(['catering']).map((s, i) => ({
  question_id: `lab-q${i}`,
  vendor_profile_id: LAB_SHOP,
  prompt: s.prompt,
  hint: s.hint,
  is_asked: true,
  display_order: (i + 1) * 10,
}));

export default async function QuestionsLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'author';

  const answers = [
    { event_id: LAB_EVENT, question_id: 'lab-q0', answer: 'Halal for about 20 guests. Two with a peanut allergy.', updated_at: '2026-11-04T02:00:00Z' },
    { event_id: LAB_EVENT, question_id: 'lab-q1', answer: 'Lola Ising’s pancit — we can send the recipe.', updated_at: '2026-11-04T02:00:00Z' },
  ];
  const questionnaire = buildQuestionnaire(CATERER, answers);

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 bg-cream px-4 py-6">
      {m === 'author' ? (
        // A caterer who has added one starter; the rest of their trade's set is offered below.
        <QuestionsSectionBody measured all={CATERER.slice(0, 1)} starters={startersForTiles(['catering'])} />
      ) : m === 'couple' ? (
        <SupplierQuestionsBody
          eventId={LAB_EVENT}
          eventVendorId={LAB_EVENT_VENDOR}
          vendorProfileId={LAB_SHOP}
          shopName="Kusina ni Maria Catering"
          questionnaire={questionnaire}
        />
      ) : (
        <TheyToldYou coupleName="Ana & Miguel" unread={false} questionnaire={questionnaire} />
      )}
    </main>
  );
}
