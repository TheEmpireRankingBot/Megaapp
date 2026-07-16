import { MealsClient } from "@/components/meals-client";
import { getMealsData } from "@/lib/meals";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Meals & groceries" };
export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const user = await getCurrentUser();
  const { weekStart, recipes, plan, grocery } = await getMealsData(user.id);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meals & groceries</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Plan dinner once. Shop from one list. Stop deciding at 6 pm.
        </p>
      </header>
      <MealsClient
        weekStart={weekStart}
        initialRecipes={recipes}
        initialPlan={plan}
        initialGrocery={grocery}
      />
    </div>
  );
}
