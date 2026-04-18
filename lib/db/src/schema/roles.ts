import { pgTable, text, serial, timestamp, boolean, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const PERMISSION_KEYS = [
  "users.manage",
  "roles.manage",
  "jobs.manage",
  "prompts.manage",
  "exports.access",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "users.manage": "Zarządzanie użytkownikami",
  "roles.manage": "Zarządzanie rolami",
  "jobs.manage": "Zarządzanie zadaniami",
  "prompts.manage": "Zarządzanie szablonami",
  "exports.access": "Eksport wyników",
};

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: jsonb("permissions").$type<PermissionKey[]>().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_roles_clerk_user_id_unique").on(t.clerkUserId)],
);

export type Role = typeof rolesTable.$inferSelect;
export type UserRole = typeof userRolesTable.$inferSelect;
