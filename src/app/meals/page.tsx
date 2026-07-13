import Link from "next/link";
import { Check, ExternalLink, ShoppingBasket, Trash2 } from "lucide-react";
import { getCurrentUser } from "@/lib/user";
import { formatDay } from "@/lib/dates";
import { formatWeekRange } from "@/lib/review";
import { getMealsData, mealPlanDays } from "@/lib/meals";
import {
  createRecipe,
  deleteItem,
  generateGroceryList,
  saveMealPlan,
  toggleGroceryItem,
} from "@/lib/actions";

export const metadata = { title: "Meals & groceries" };
export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const user = await getCurrentUser();
  const { weekStart, recipes, plan, grocery } = await getMealsData(user.id);
  const days = mealPlanDays(weekStart);
  const plannedMeals = Object.values(plan?.days ?? {}).filter(
    (day) => day.dinner,
  ).length;
  const groceryDone = grocery?.items.filter((item) => item.done).length ?? 0;
  const groceryTotal = grocery?.items.length ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meals & groceries</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Plan dinner once. Shop from one list. Stop deciding at 6 pm.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              This week
            </h2>
            <p className="text-xs text-black/45 dark:text-white/45">
              {formatWeekRange(weekStart)} · {plannedMeals}/7 dinners planned
            </p>
          </div>
          {plannedMeals > 0 && (
            <form action={generateGroceryList}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                <ShoppingBasket size={16} /> Generate grocery list
              </button>
            </form>
          )}
        </div>

        <form
          key={`${plan?.itemId ?? "new"}-${JSON.stringify(plan?.days ?? {})}`}
          action={saveMealPlan}
          className="space-y-3"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((day) => {
              const dinner = plan?.days[day]?.dinner;
              return (
                <label
                  key={day}
                  className="rounded-xl border border-black/10 p-3 dark:border-white/10"
                >
                  <span className="block text-xs font-semibold text-black/50 dark:text-white/50">
                    {formatDay(day)}
                  </span>
                  <select
                    name={`meal-${day}`}
                    defaultValue={dinner ?? ""}
                    disabled={recipes.length === 0}
                    aria-label={`Dinner for ${formatDay(day)}`}
                    className="mt-2 w-full min-w-0 rounded-lg border border-black/15 bg-transparent px-2 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-black dark:focus:border-white/40"
                  >
                    <option value="">No plan</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.itemId} value={recipe.itemId}>
                        {recipe.title}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={recipes.length === 0}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40 dark:bg-white dark:text-black"
            >
              {plan ? "Update week" : "Save week"}
            </button>
            {recipes.length === 0 && (
              <p className="text-xs text-black/45 dark:text-white/45">
                Add a recipe below to start planning.
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              Grocery list
            </h2>
            {groceryTotal > 0 && (
              <p className="text-xs text-black/45 dark:text-white/45">
                {groceryDone}/{groceryTotal} picked up
                {groceryDone === groceryTotal ? " · bag packed ✓" : ""}
              </p>
            )}
          </div>
          <span className="text-xs text-black/45 dark:text-white/45">
            Quick add: <span className="font-mono">buy milk</span>
          </span>
        </div>

        {!grocery || grocery.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            Plan a few dinners, then generate the week&apos;s shopping list.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
            {grocery.items.map((item, index) => (
              <form
                key={`${item.name}-${index}`}
                action={toggleGroceryItem}
                className="border-b border-black/5 last:border-b-0 dark:border-white/5"
              >
                <input type="hidden" name="itemId" value={grocery.itemId} />
                <input type="hidden" name="index" value={index} />
                <button
                  type="submit"
                  aria-label={`${item.done ? "Uncheck" : "Check"} ${item.name}`}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      item.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-black/20 dark:border-white/25"
                    }`}
                  >
                    {item.done && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span
                    className={
                      item.done
                        ? "text-black/40 line-through dark:text-white/40"
                        : "text-sm"
                    }
                  >
                    {item.name}
                  </span>
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Recipe box
        </h2>

        {recipes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {recipes.map((recipe) => (
              <article
                key={recipe.itemId}
                className="group rounded-xl border border-black/10 p-4 dark:border-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">{recipe.title}</h3>
                    <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                      {recipe.ingredients.join(" · ")}
                    </p>
                  </div>
                  <form action={deleteItem}>
                    <input type="hidden" name="itemId" value={recipe.itemId} />
                    <button
                      type="submit"
                      aria-label={`Delete recipe ${recipe.title}`}
                      className="rounded p-1 text-black/30 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus:opacity-100 dark:text-white/30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
                {recipe.link && (
                  <Link
                    href={recipe.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-black/50 underline-offset-2 hover:underline dark:text-white/50"
                  >
                    Open recipe <ExternalLink size={12} />
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}

        <form
          key={recipes.map((recipe) => recipe.itemId).join("-")}
          action={createRecipe}
          className="grid gap-3 rounded-xl border border-dashed border-black/15 p-4 sm:grid-cols-2 dark:border-white/15"
        >
          <label className="block">
            <span className="text-sm font-medium">Recipe name</span>
            <input
              name="title"
              required
              maxLength={120}
              placeholder="Ginger chicken rice"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Recipe link (optional)</span>
            <input
              name="link"
              type="url"
              placeholder="https://…"
              autoComplete="url"
              className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Ingredients</span>
            <textarea
              name="ingredients"
              required
              rows={3}
              placeholder={"Chicken thighs\nRice\nGinger\nSpring onion"}
              className="mt-1 w-full rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
            />
            <span className="mt-1 block text-xs text-black/40 dark:text-white/40">
              One per line or comma-separated. Duplicates are merged automatically.
            </span>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 dark:bg-white dark:text-black"
            >
              Add recipe
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
