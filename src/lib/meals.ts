import { and, asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDays, todayKey } from "@/lib/dates";
import { weekStartKey } from "@/lib/review";

export type RecipePayload = {
  ingredients: string[];
  link?: string;
};

export type MealPlanDays = Record<string, { dinner?: string }>;
export type MealPlanPayload = { days: MealPlanDays };
export type GroceryItem = { name: string; done: boolean };
export type GroceryPayload = { items: GroceryItem[] };

export type RecipeView = RecipePayload & { itemId: string; title: string };
export type MealPlanView = MealPlanPayload & {
  itemId: string;
  weekStart: string;
};
export type GroceryView = GroceryPayload & { itemId: string };

function recipePayload(value: unknown): RecipePayload {
  const payload = (value ?? {}) as Partial<RecipePayload>;
  return {
    ingredients: Array.isArray(payload.ingredients)
      ? payload.ingredients.filter((v): v is string => typeof v === "string")
      : [],
    ...(typeof payload.link === "string" && payload.link
      ? { link: payload.link }
      : {}),
  };
}

function mealPlanPayload(value: unknown): MealPlanPayload {
  const payload = (value ?? {}) as Partial<MealPlanPayload>;
  return {
    days:
      payload.days && typeof payload.days === "object" && !Array.isArray(payload.days)
        ? payload.days
        : {},
  };
}

function groceryPayload(value: unknown): GroceryPayload {
  const payload = (value ?? {}) as Partial<GroceryPayload>;
  return {
    items: Array.isArray(payload.items)
      ? payload.items.filter(
          (v): v is GroceryItem =>
            Boolean(v) &&
            typeof v === "object" &&
            typeof (v as GroceryItem).name === "string" &&
            typeof (v as GroceryItem).done === "boolean",
        )
      : [],
  };
}

export function mealPlanDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export async function getMealsData(userId: string) {
  const db = await getDb();
  const weekStart = weekStartKey(todayKey());
  const [recipeRows, planRows, groceryRows] = await Promise.all([
    db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.module, "meals"),
          eq(schema.items.type, "recipe"),
          eq(schema.items.status, "active"),
        ),
      )
      .orderBy(asc(schema.items.title)),
    db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.module, "meals"),
          eq(schema.items.type, "plan"),
          eq(schema.items.title, weekStart),
          eq(schema.items.status, "active"),
        ),
      )
      .limit(1),
    db
      .select()
      .from(schema.items)
      .where(
        and(
          eq(schema.items.userId, userId),
          eq(schema.items.module, "meals"),
          eq(schema.items.type, "grocery"),
          eq(schema.items.status, "active"),
        ),
      )
      .orderBy(desc(schema.items.updatedAt))
      .limit(1),
  ]);

  const recipes: RecipeView[] = recipeRows.map((row) => ({
    itemId: row.id,
    title: row.title,
    ...recipePayload(row.payload),
  }));
  const plan: MealPlanView | null = planRows[0]
    ? {
        itemId: planRows[0].id,
        weekStart,
        ...mealPlanPayload(planRows[0].payload),
      }
    : null;
  const grocery: GroceryView | null = groceryRows[0]
    ? { itemId: groceryRows[0].id, ...groceryPayload(groceryRows[0].payload) }
    : null;

  return { weekStart, recipes, plan, grocery };
}

export async function getMealPlanForWeek(userId: string, weekStart: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "meals"),
        eq(schema.items.type, "plan"),
        eq(schema.items.title, weekStart),
        eq(schema.items.status, "active"),
      ),
    )
    .limit(1);
  return row ? { itemId: row.id, weekStart, ...mealPlanPayload(row.payload) } : null;
}

export async function getActiveGroceryList(userId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.items)
    .where(
      and(
        eq(schema.items.userId, userId),
        eq(schema.items.module, "meals"),
        eq(schema.items.type, "grocery"),
        eq(schema.items.status, "active"),
      ),
    )
    .orderBy(desc(schema.items.updatedAt))
    .limit(1);
  return row ? { itemId: row.id, ...groceryPayload(row.payload) } : null;
}
