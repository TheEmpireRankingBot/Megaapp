import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Core primitives — every module is a view over these.
// See docs/PLAN.md §3/§4. Rule of thumb: modules start on items + entries;
// a dedicated table (tasks, habits, transactions) must earn its keep.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// The universal "thing": a task, a habit definition, a recipe, a person,
// a possession. Module-specific fields live in payload.
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(), // tasks | habits | journal | money | ...
    type: text("type").notNull(), // task | project | habit | note | recipe | ...
    title: text("title").notNull(),
    status: text("status").notNull().default("active"), // active | archived
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("items_user_module_idx").on(t.userId, t.module),
    index("items_user_module_type_status_idx").on(
      t.userId,
      t.module,
      t.type,
      t.status,
    ),
  ],
);

// The universal timestamped log record: a habit check-in, an expense,
// a weight entry, a journal entry, a mood log. Cross-module insights
// (Phase 5) query this one table.
export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    module: text("module").notNull(),
    type: text("type").notNull(), // checkin | expense | weight | journal | mood | ...
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    value: numeric("value"),
    note: text("note"),
    payload: jsonb("payload").notNull().default({}),
    itemId: uuid("item_id").references(() => items.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("entries_user_occurred_idx").on(t.userId, t.occurredAt),
    index("entries_user_module_type_occurred_idx").on(
      t.userId,
      t.module,
      t.type,
      t.occurredAt,
    ),
    index("entries_item_idx").on(t.itemId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => [unique("tags_user_name_uq").on(t.userId, t.name)],
);

export const itemTags = pgTable(
  "item_tags",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.tagId] })],
);

export const entryTags = pgTable(
  "entry_tags",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entryId, t.tagId] })],
);

// One scheduling system for every module: task due, habit nudge, birthday,
// subscription renewal, maintenance due.
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, {
      onDelete: "cascade",
    }),
    schedule: text("schedule").notNull(), // RRULE string or one-shot ISO date
    nextFireAt: timestamp("next_fire_at", { withTimezone: true }),
    channel: text("channel").notNull().default("app"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("reminders_next_fire_idx").on(t.nextFireAt)],
);

// Browser endpoints used by the Web Push delivery channel. A subscription is
// tied to one authenticated user and one browser profile/device.
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("push_subscriptions_endpoint_uq").on(t.endpoint),
    index("push_subscriptions_user_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Dedicated tables — structure that earns its keep (queries + integrity).
// Each extends an items/entries row 1:1.
// ---------------------------------------------------------------------------

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .unique()
      .references(() => items.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    recurrence: text("recurrence"), // RRULE string
    priority: integer("priority").notNull().default(0),
    projectId: uuid("project_id").references(() => items.id, {
      onDelete: "set null",
    }),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("tasks_due_idx").on(t.dueAt)],
);

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .unique()
    .references(() => items.id, { onDelete: "cascade" }),
  cadence: text("cadence").notNull().default("daily"), // daily | weekly | RRULE
  target: integer("target").notNull().default(1),
  streakCurrent: integer("streak_current").notNull().default(0),
  streakBest: integer("streak_best").notNull().default(0),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id")
    .notNull()
    .unique()
    .references(() => entries.id, { onDelete: "cascade" }),
  amount: numeric("amount").notNull(),
  currency: text("currency").notNull().default("SGD"),
  category: text("category"),
  account: text("account"),
  merchant: text("merchant"),
});
