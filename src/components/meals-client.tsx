"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ExternalLink, LoaderCircle, ShoppingBasket, Trash2 } from "lucide-react";
import {
  createRecipe,
  deleteItem,
  generateGroceryList,
  saveMealPlan,
} from "@/lib/actions";
import { addDays, dayNoon, formatDay } from "@/lib/dates";
import type { GroceryView, MealPlanView, RecipeView } from "@/lib/meals";
import { GroceryListClient } from "@/components/grocery-list-client";

function sortRecipes(recipes: RecipeView[]) {
  return [...recipes].sort((left, right) => left.title.localeCompare(right.title));
}

function formatWeekRange(weekStart: string) {
  const format = (key: string) =>
    dayNoon(key).toLocaleDateString("en-SG", {
      timeZone: "Asia/Singapore",
      day: "numeric",
      month: "short",
    });
  return `${format(weekStart)} – ${format(addDays(weekStart, 6))}`;
}

function mealPlanDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function MealsClient({
  weekStart,
  initialRecipes,
  initialPlan,
  initialGrocery,
}: {
  weekStart: string;
  initialRecipes: RecipeView[];
  initialPlan: MealPlanView | null;
  initialGrocery: GroceryView | null;
}) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [plan, setPlan] = useState(initialPlan);
  const [grocery, setGrocery] = useState(initialGrocery);
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const days = mealPlanDays(weekStart);
  const plannedMeals = Object.values(plan?.days ?? {}).filter((day) => day.dinner).length;
  const groceryDone = grocery?.items.filter((item) => item.done).length ?? 0;
  const groceryTotal = grocery?.items.length ?? 0;

  async function addRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addingRecipe) return;
    const form = event.currentTarget;
    setAddingRecipe(true);
    setMessage("");
    try {
      const created = await createRecipe(new FormData(form));
      if (!created) throw new Error("Recipe was not created");
      setRecipes((current) => sortRecipes([...current, created]));
      form.reset();
    } catch {
      setMessage("Couldn’t add the recipe. Check the fields and try again.");
    } finally {
      setAddingRecipe(false);
    }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPlan) return;
    setSavingPlan(true);
    setMessage("");
    try {
      const saved = await saveMealPlan(new FormData(event.currentTarget));
      if (!saved) throw new Error("Meal plan was not saved");
      setPlan(saved);
    } catch {
      setMessage("Couldn’t save the meal plan. Try again.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function generate() {
    if (generating) return;
    setGenerating(true);
    setMessage("");
    try {
      const generated = await generateGroceryList();
      if (!generated) throw new Error("Grocery list was not generated");
      setGrocery(generated);
    } catch {
      setMessage("Couldn’t generate the grocery list. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function removeRecipe(event: FormEvent<HTMLFormElement>, recipe: RecipeView) {
    event.preventDefault();
    if (deletingId) return;
    const previous = recipes;
    setDeletingId(recipe.itemId);
    setMessage("");
    setRecipes((current) => current.filter((candidate) => candidate.itemId !== recipe.itemId));
    try {
      await deleteItem(new FormData(event.currentTarget));
    } catch {
      setRecipes(previous);
      setMessage(`Couldn’t delete ${recipe.title}. Try again.`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
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
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              {generating ? <LoaderCircle size={16} className="animate-spin" /> : <ShoppingBasket size={16} />}
              Generate grocery list
            </button>
          )}
        </div>

        <form
          key={`${plan?.itemId ?? "new"}-${JSON.stringify(plan?.days ?? {})}-${recipes.map((recipe) => recipe.itemId).join("-")}`}
          onSubmit={savePlan}
          className="space-y-3"
        >
          <fieldset disabled={savingPlan} className="contents">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {days.map((day) => (
                <label key={day} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <span className="block text-xs font-semibold text-black/50 dark:text-white/50">
                    {formatDay(day)}
                  </span>
                  <select
                    name={`meal-${day}`}
                    defaultValue={plan?.days[day]?.dinner ?? ""}
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
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={recipes.length === 0 || savingPlan}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40 dark:bg-white dark:text-black"
              >
                {savingPlan ? "Saving…" : plan ? "Update week" : "Save week"}
              </button>
              {recipes.length === 0 && (
                <p className="text-xs text-black/45 dark:text-white/45">Add a recipe below to start planning.</p>
              )}
            </div>
          </fieldset>
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
                {groceryDone}/{groceryTotal} picked up{groceryDone === groceryTotal ? " · bag packed ✓" : ""}
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
          <GroceryListClient
            key={`${grocery.itemId}-${grocery.items.map((item) => Number(item.done)).join("")}`}
            itemId={grocery.itemId}
            initialItems={grocery.items}
            onItemsChange={(items) => setGrocery((current) => (current ? { ...current, items } : current))}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">Recipe box</h2>
        {recipes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {recipes.map((recipe) => (
              <article key={recipe.itemId} className="group rounded-xl border border-black/10 p-4 dark:border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">{recipe.title}</h3>
                    <p className="mt-1 text-sm text-black/50 dark:text-white/50">{recipe.ingredients.join(" · ")}</p>
                  </div>
                  <form onSubmit={(event) => removeRecipe(event, recipe)}>
                    <input type="hidden" name="itemId" value={recipe.itemId} />
                    <button
                      type="submit"
                      disabled={deletingId !== null}
                      aria-label={`Delete recipe ${recipe.title}`}
                      className="rounded p-1 text-black/30 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 focus:opacity-100 disabled:opacity-20 dark:text-white/30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
                {recipe.link && (
                  <Link href={recipe.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-black/50 underline-offset-2 hover:underline dark:text-white/50">
                    Open recipe <ExternalLink size={12} />
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}

        <form onSubmit={addRecipe} className="grid gap-3 rounded-xl border border-dashed border-black/15 p-4 sm:grid-cols-2 dark:border-white/15">
          <fieldset disabled={addingRecipe} className="contents">
            <label className="block">
              <span className="text-sm font-medium">Recipe name</span>
              <input name="title" required maxLength={120} placeholder="Ginger chicken rice" autoComplete="off" className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:focus:border-white/40" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Recipe link (optional)</span>
              <input name="link" type="url" placeholder="https://…" autoComplete="url" className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:focus:border-white/40" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Ingredients</span>
              <textarea name="ingredients" required rows={3} placeholder={"Chicken thighs\nRice\nGinger\nSpring onion"} className="mt-1 w-full rounded-lg border border-black/15 bg-transparent p-3 text-sm outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:focus:border-white/40" />
              <span className="mt-1 block text-xs text-black/40 dark:text-white/40">One per line or comma-separated. Duplicates are merged automatically.</span>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" disabled={addingRecipe} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40 dark:bg-white dark:text-black">
                {addingRecipe ? "Adding…" : "Add recipe"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      {message && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{message}</p>}
    </div>
  );
}
