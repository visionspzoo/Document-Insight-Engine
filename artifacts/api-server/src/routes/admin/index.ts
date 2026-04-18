import { Router, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  rolesTable,
  userRolesTable,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
} from "@workspace/db";

const router: ReturnType<typeof Router> = Router();

const CLERK_API = "https://api.clerk.com/v1";

async function clerkFetch(path: string, init: RequestInit = {}) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY missing");
  return fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function getUserPermissions(clerkUserId: string): Promise<{ role: typeof rolesTable.$inferSelect | null; permissions: PermissionKey[] }> {
  const rows = await db
    .select()
    .from(userRolesTable)
    .leftJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.clerkUserId, clerkUserId))
    .limit(1);
  const row = rows[0];
  if (!row || !row.roles) return { role: null, permissions: [] };
  return { role: row.roles, permissions: row.roles.permissions };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Brak autoryzacji." });
  (req as Request & { clerkUserId: string }).clerkUserId = userId;
  next();
}

function requirePermission(perm: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as Request & { clerkUserId: string }).clerkUserId;
    const { permissions } = await getUserPermissions(userId);
    if (!permissions.includes(perm)) {
      return res.status(403).json({ error: "Brak uprawnień." });
    }
    next();
  };
}

router.get("/admin/me", requireAuth, async (req, res) => {
  const userId = (req as Request & { clerkUserId: string }).clerkUserId;
  const { role, permissions } = await getUserPermissions(userId);
  res.json({
    userId,
    role: role ? { id: role.id, name: role.name, description: role.description } : null,
    permissions,
  });
});

router.get("/admin/permissions", requireAuth, (_req, res) => {
  res.json(
    PERMISSION_KEYS.map((key) => ({ key, label: PERMISSION_LABELS[key] })),
  );
});

router.get("/admin/roles", requireAuth, requirePermission("roles.manage"), async (_req, res) => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.id);
  res.json(roles);
});

router.post("/admin/roles", requireAuth, requirePermission("roles.manage"), async (req, res) => {
  const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: PermissionKey[] };
  if (!name) return res.status(400).json({ error: "Nazwa roli jest wymagana." });
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

router.patch("/admin/roles/:id", requireAuth, requirePermission("roles.manage"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Nieprawidłowe ID." });
  const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Rola nie znaleziona." });
  const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: PermissionKey[] };
  if (existing.isSystem && (name !== undefined || permissions !== undefined)) {
    return res.status(400).json({ error: "Nie można zmieniać nazwy ani uprawnień roli systemowej." });
  }
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (permissions !== undefined) {
    update.permissions = permissions.filter((p): p is PermissionKey => (PERMISSION_KEYS as readonly string[]).includes(p));
  }
  const [updated] = await db.update(rolesTable).set(update).where(eq(rolesTable.id, id)).returning();
  res.json(updated);
});

router.delete("/admin/roles/:id", requireAuth, requirePermission("roles.manage"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Nieprawidłowe ID." });
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) return res.status(404).json({ error: "Rola nie znaleziona." });
  if (role.isSystem) return res.status(400).json({ error: "Nie można usunąć roli systemowej." });
  const usage = await db.select().from(userRolesTable).where(eq(userRolesTable.roleId, id)).limit(1);
  if (usage.length > 0) return res.status(400).json({ error: "Rola jest przypisana do użytkowników." });
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.status(204).end();
});

router.get("/admin/users", requireAuth, requirePermission("users.manage"), async (_req, res) => {
  const r = await clerkFetch("/users?limit=200&order_by=-created_at");
  if (!r.ok) return res.status(502).json({ error: "Nie udało się pobrać użytkowników." });
  const clerkUsers = (await r.json()) as Array<{
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    created_at: number;
  }>;
  const assignments = await db
    .select()
    .from(userRolesTable)
    .leftJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id));
  const map = new Map(assignments.map((a) => [a.user_roles.clerkUserId, a.roles]));
  res.json(
    clerkUsers.map((u) => ({
      id: u.id,
      email: u.email_addresses[0]?.email_address ?? "",
      firstName: u.first_name,
      lastName: u.last_name,
      createdAt: u.created_at,
      role: map.get(u.id) ? { id: map.get(u.id)!.id, name: map.get(u.id)!.name } : null,
    })),
  );
});

router.post("/admin/users", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const { email, password, firstName, lastName, roleId } = req.body as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    roleId?: number;
  };
  if (!email || !password) return res.status(400).json({ error: "Email i hasło są wymagane." });
  if (roleId !== undefined && roleId !== null) {
    const [exists] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    if (!exists) return res.status(400).json({ error: "Wybrana rola nie istnieje." });
  }
  const r = await clerkFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: firstName ?? undefined,
      last_name: lastName ?? undefined,
    }),
  });
  const data = (await r.json()) as { id?: string; errors?: Array<{ long_message?: string; message?: string }> };
  if (!r.ok || !data.id) {
    return res.status(r.status).json({ error: data.errors?.[0]?.long_message ?? "Nie udało się utworzyć użytkownika." });
  }
  if (roleId) {
    try {
      await db.insert(userRolesTable).values({ clerkUserId: data.id, roleId }).onConflictDoNothing();
    } catch (err) {
      await clerkFetch(`/users/${data.id}`, { method: "DELETE" });
      return res.status(400).json({ error: "Nie udało się przypisać roli — operacja wycofana." });
    }
  }
  res.status(201).json({ id: data.id });
});

router.patch("/admin/users/:id", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const id = req.params.id;
  const { firstName, lastName, password, roleId } = req.body as {
    firstName?: string;
    lastName?: string;
    password?: string;
    roleId?: number | null;
  };
  if (firstName !== undefined || lastName !== undefined || password !== undefined) {
    const body: Record<string, unknown> = {};
    if (firstName !== undefined) body.first_name = firstName;
    if (lastName !== undefined) body.last_name = lastName;
    if (password !== undefined && password) body.password = password;
    const r = await clerkFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!r.ok) {
      const data = (await r.json()) as { errors?: Array<{ long_message?: string }> };
      return res.status(r.status).json({ error: data.errors?.[0]?.long_message ?? "Aktualizacja nie powiodła się." });
    }
  }
  if (roleId !== undefined) {
    if (roleId !== null) {
      const [exists] = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
      if (!exists) return res.status(400).json({ error: "Wybrana rola nie istnieje." });
    }
    await db.delete(userRolesTable).where(eq(userRolesTable.clerkUserId, id));
    if (roleId !== null) {
      await db.insert(userRolesTable).values({ clerkUserId: id, roleId });
    }
  }
  res.json({ ok: true });
});

router.delete("/admin/users/:id", requireAuth, requirePermission("users.manage"), async (req, res) => {
  const id = req.params.id;
  const r = await clerkFetch(`/users/${id}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) {
    return res.status(r.status).json({ error: "Nie udało się usunąć użytkownika." });
  }
  await db.delete(userRolesTable).where(eq(userRolesTable.clerkUserId, id));
  res.status(204).end();
});

export default router;
