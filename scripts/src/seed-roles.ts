import { eq } from "drizzle-orm";
import { db, rolesTable, userRolesTable, PERMISSION_KEYS } from "@workspace/db";
import { createClient } from "@supabase/supabase-js";

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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Brak VITE_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY — pomijam przypisanie admina.");
    return;
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (listError || !listData) {
    console.error("Nie udało się pobrać użytkowników z Supabase.");
    return;
  }
  const adminUser = listData.users.find((u: { email?: string }) => u.email === "admin@docsage.pl");
  if (adminUser) {
    const userId = adminUser.id;
    const existing = await db.select().from(userRolesTable).where(eq(userRolesTable.userId, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(userRolesTable).values({ userId, roleId: adminRole.id });
      console.log(`Przypisano rolę Administrator do ${userId}`);
    } else {
      await db.update(userRolesTable).set({ roleId: adminRole.id }).where(eq(userRolesTable.userId, userId));
      console.log(`Zaktualizowano rolę dla ${userId} na Administrator`);
    }
  } else {
    console.warn("Nie znaleziono użytkownika admin@docsage.pl w Supabase.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
