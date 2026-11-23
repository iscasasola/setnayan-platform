'use client';

/**
 * 🎬 `/dev/budget-lab?state=film` — the REAL `BudgetScreen` for the front page's Budget clip. It draws the ledger
 * BEFORE the clip's one "Add expense" until the lab hears `LAB_BUDGET_FILM_ADDED` (the film script sends it when the
 * sheet's save answers), then the ledger AFTER — what the real page shows once its save revalidates. Nothing is written:
 * the sheet's own save still goes to the server action, which refuses without a session.
 */
import { useEffect, useState, type ComponentProps } from 'react';
import { BudgetScreen } from '@/app/dashboard/[eventId]/budget/_components/budget-screen';

export const LAB_BUDGET_FILM_ADDED = 'lab-budget-film-added';

type ScreenProps = ComponentProps<typeof BudgetScreen>;

export function LabBudgetFilm({ before, after }: { before: ScreenProps; after: ScreenProps }) {
  const [added, setAdded] = useState(false);
  useEffect(() => {
    const on = () => setAdded(true);
    window.addEventListener(LAB_BUDGET_FILM_ADDED, on);
    return () => window.removeEventListener(LAB_BUDGET_FILM_ADDED, on);
  }, []);
  return <BudgetScreen {...(added ? after : before)} />;
}
