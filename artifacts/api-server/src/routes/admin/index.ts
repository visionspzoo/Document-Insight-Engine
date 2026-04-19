import { Router, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  rolesTable,
  userRolesTable,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
} from "@workspace/db";
import { requireAuth, supabaseAdmin, type AuthedRequest } from "../../middlewares/supabaseAuthMiddleware";

const router: ReturnType<typeof Router> = Router();

async function getUserPermissions(userId: string): Promise<{ role: typeof rolesTable.$inferSelect | null; permissions: PermissionKey[] }> {
  const rows = await db
    .select()
    .from(userRolesTable)
    .leftJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.roles) return { role: null, permissions: [] };
  return { role: row.roles, permissions: row.roles.permissions };
}

function requirePermission(perm: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as AuthedRequest).supabaseUserId;
    const { permissions } = await getUserPermissions(userId);
    if (!permissions.includes(perm)) {
      res.status(403).json({ error: "Brak uprawnień." });
      return;
    }
    next();
  };
}

router.get("/admin/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).supabaseUserId;
  const { role, permissions } = await getUserPermissions(userId);
  res.json({
    userId,
    role: role ? { id: role.id, name: role.name, description: role.description } : null,
    permissions,
  });
});

router.get("/admin/permissions", requireAuth, (_req: Request, res: Response): void => {
  res.json(
    PERMISSION_KEYS.map((key) => ({ key, label: PERMISSION_LABELS[key] })),
  );
});

router.get("/admin/roles", requireAuth, requirePermission("roles.manage"), async (_req: Request, res: Response): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.id);
  res.json(roles);
});

router.post("/admin/roles", requireAuth, requirePermission("roles.manage"), async (req: Request, res: Response): Promise<void> => {
  const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: PermissionKey[] };
  if (!name) {
    res.status(400).json({ error: "Nazwa roli jest wymagana." });
    return;
  }
  const filtered = (permissions ?? []).filter((p): p is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(p));
  try {
    const [created] = await db
      .insert(rolesTable)
      .values({ name, description: description ?? null, permissions: filtered, isSystem: false })
      .returning();
    res.status(201).json(created);
  } catch {
    res.status(400).json({ error: "Rola o tej nazwie już istnieje." });
  }
});

router.patch("/admin/roles/:id", requireAuth, requirePermission("roles.manage"), async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Nieprawidłowe ID." });
    return;
  }
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Rola nie znaleziona." });
    return;
  }
  const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: PermissionKey[] };
  if (existing.isSystem && (name !== undefined || permissions !== undefined)) {
    res.status(400).json({ error: "Nie można zmieniać nazwy ani uprawnień roli systemowej." });
    return;
  }
  const update: Partial<{ name: string; description: string | null; permissions: PermissionKey[] }> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (permissions !== undefined) {
    update.permissions = permissions.filter((p): p is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(p));
  }
  const [updated] = await db.update(rolesTable).set(update).where(eq(rolesTable.id, id)).returning();
  res.json(updated);
});

router.delete("/admin/roles/:id", requireAuth, requirePermission("roles.manage"), async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Nieprawidłowe ID." });
    return;
  }
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) {
    res.status(404).json({ error: "Rola nie znaleziona." });
    return;
  }
  if (role.isSystem) {
    res.status(400).json({ error: "Nie można usunąć roli systemowej." });
    return;
  }
  const usage = await db.select().from(userRolesTable).where(eq(userRolesTable.roleId, id)).limit(1);
  if (usage.length > 0) {
    res.status(400).json({ error: "Rola jest przypisana do użytkowników." });
    return;
  }
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.status(204).end();
});

router.get("/admin/users", requireAuth, requirePermission("users.manage"), async (_req: Request, res: Response): Promise<void> => {
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    res.status(502).json({ error: "Nie udało się pobrać użytkowników." });
    return;
  }
  const assignments = await db
    .select()
    .from(userRolesTable)
    .leftJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id));
  const map = new Map(assignments.map((a) => [a.user_roles.userId, a.roles]));
  res.json(
    listData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      firstName: (u.user_metadata as Record<string, string> | undefined)?.first_name ?? null,
      lastName: (u.user_metadata as Record<string, string> | undefined)?.last_name ?? null,
      createdAt: new Date(u.created_at).getTime(),
      role: map.get(u.id) ? { id: map.get(u.id)!.id, name: map.get(u.id)!.name } : null,
    })),
  );
});

router.post("/admin/users", requireAuth, requirePermission("users.manage"), async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName, roleId } = req.body as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    roleId?: number;
  };
  if (!email || !password) {
    res.status(400).json({ error: "Email i hasło są wymagane." });
    return;
  }
  if (roleId !== undefined && roleId !== null) {
    const [exists] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    if (!exists) {
      res.status(400).json({ error: "Wybrana rola nie istnieje." });
      return;
    }
  }
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    },
  });
  if (createError || !createData.user) {
    res.status(400).json({ error: createError?.message ?? "Nie udało się utworzyć użytkownika." });
    return;
  }
  if (roleId) {
    try {
      await db.insert(userRolesTable).values({ userId: createData.user.id, roleId }).onConflictDoNothing();
    } catch {
      await supabaseAdmin.auth.admin.deleteUser(createData.user.id);
      res.status(400).json({ error: "Nie udało się przypisać roli — operacja wycofana." });
      return;
    }
  }
  res.status(201).json({ id: createData.user.id });
});

router.patch("/admin/users/:id", requireAuth, requirePermission("users.manage"), async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { firstName, lastName, password, roleId } = req.body as {
    firstName?: string;
    lastName?: string;
    password?: string;
    roleId?: number | null;
  };
  if (firstName !== undefined || lastName !== undefined || password !== undefined) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ...(password ? { password } : {}),
      user_metadata: {
        ...(firstName !== undefined ? { first_name: firstName } : {}),
        ...(lastName !== undefined ? { last_name: lastName } : {}),
      },
    });
    if (updateError) {
      res.status(400).json({ error: updateError.message ?? "Aktualizacja nie powiodła się." });
      return;
    }
  }
  if (roleId !== undefined) {
    if (roleId !== null) {
      const [exists] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
      if (!exists) {
        res.status(400).json({ error: "Wybrana rola nie istnieje." });
        return;
      }
    }
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, id));
    if (roleId !== null) {
      await db.insert(userRolesTable).values({ userId: id, roleId });
    }
  }
  res.json({ ok: true });
});

router.delete("/admin/users/:id", requireAuth, requirePermission("users.manage"), async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (deleteError) {
    res.status(400).json({ error: "Nie udało się usunąć użytkownika." });
    return;
  }
  await db.delete(userRolesTable).where(eq(userRolesTable.userId, id));
  res.status(204).end();
});

export default router;
