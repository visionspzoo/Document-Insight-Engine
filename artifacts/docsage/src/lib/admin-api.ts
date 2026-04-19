import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type PermissionKey =
  | "users.manage"
  | "roles.manage"
  | "jobs.manage"
  | "prompts.manage"
  | "exports.access";

export interface MeResponse {
  userId: string;
  role: { id: number; name: string; description: string | null } | null;
  permissions: PermissionKey[];
}

export interface AdminRole {
  id: number;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
  isSystem: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: number;
  role: { id: number; name: string } | null;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeader();
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders, ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Błąd ${res.status}`);
  }
  return data as T;
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["admin", "me"],
    queryFn: () => apiFetch<MeResponse>("/api/admin/me"),
    staleTime: 60_000,
  });
}

export function hasPermission(me: MeResponse | undefined, perm: PermissionKey): boolean {
  return !!me?.permissions.includes(perm);
}
