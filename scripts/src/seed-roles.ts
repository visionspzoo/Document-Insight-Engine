import { eq } from "drizzle-orm";
import { db, rolesTable, userRolesTable, PERMISSION_KEYS } from "@workspace/db";

async function main() {
  let adminRole = (await db.select().from(rolesTable).where(eq(rolesTable.name, "Administrator")).limit(1))[0];
  if (!adminRole) {
    [adminRole] = await db
      .insert(rolesTable)
      .values({
        name: "Administrator",
        description: "Pełny dostęp do systemu, włącznie z zarządzaniem użytkownikami i rolami.",
        permissions: [...PERMISSION_KEYS],
        isSystem: true,
      })
      .returning();
    console.log("Utworzono rolę Administrator");
  } else {
    [adminRole] = await db
      .update(rolesTable)
      .set({ permissions: [...PERMISSION_KEYS], isSystem: true })
      .where(eq(rolesTable.id, adminRole.id))
      .returning();
    console.log("Zaktualizowano uprawnienia roli Administrator");
  }

  const viewerRole = (await db.select().from(rolesTable).where(eq(rolesTable.name, "Operator")).limit(1))[0];
  if (!viewerRole) {
    await db.insert(rolesTable).values({
      name: "Operator",
      description: "Może zarządzać zadaniami, szablonami i eksportami, bez dostępu do administracji.",
      permissions: ["jobs.manage", "prompts.manage", "exports.access"],
      isSystem: false,
    });
    console.log("Utworzono rolę Operator");
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("Brak CLERK_SECRET_KEY — pomijam przypisanie admina.");
    return;
  }
  const r = await fetch("https://api.clerk.com/v1/users?email_address=admin@docsage.pl", {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const users = (await r.json()) as Array<{ id: string }>;
  if (Array.isArray(users) && users[0]) {
    const userId = users[0].id;
    const existing = await db.select().from(userRolesTable).where(eq(userRolesTable.clerkUserId, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(userRolesTable).values({ clerkUserId: userId, roleId: adminRole.id });
      console.log(`Przypisano rolę Administrator do ${userId}`);
    } else {
      await db.update(userRolesTable).set({ roleId: adminRole.id }).where(eq(userRolesTable.clerkUserId, userId));
      console.log(`Zaktualizowano rolę dla ${userId} na Administrator`);
    }
  } else {
    console.warn("Nie znaleziono użytkownika admin@docsage.pl w Clerk.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
