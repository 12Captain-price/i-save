import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import type {
  CreateStaffOutput,
  CreateStaffResult,
} from "@/lib/staff-account-schema";

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class CreateStaffError extends Error {
  fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

/** Asks the Worker to create a staff account. The Worker and the database re-check who is asking. */
export async function createStaffAccount(
  input: CreateStaffOutput,
): Promise<CreateStaffResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CreateStaffError("Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${API_URL}/staff/create-staff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new CreateStaffError(
      "Could not reach the service. Check your connection and try again.",
    );
  }
  const out = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    fieldErrors?: Record<string, string>;
    result?: CreateStaffResult;
  } | null;
  if (!res.ok || !out?.ok || !out.result) {
    throw new CreateStaffError(
      out?.error ?? "Something went wrong. Please try again.",
      out?.fieldErrors ?? {},
    );
  }
  return out.result;
}

const RoleRow = z.object({
  user_id: z.string(),
  role: z.enum(["finance", "admin", "super_admin"]),
});
const ProfileRow = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
});

export type StaffAccount = {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roles: Array<"finance" | "admin" | "super_admin">;
};

async function fetchStaffAccounts(): Promise<StaffAccount[]> {
  const roles = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["finance", "admin", "super_admin"]);
  if (roles.error) throw roles.error;
  const rows = z.array(RoleRow).parse(roles.data);
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return [];

  const profiles = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", ids);
  if (profiles.error) throw profiles.error;
  const byId = new Map(
    z
      .array(ProfileRow)
      .parse(profiles.data)
      .map((p) => [p.id, p]),
  );
  return ids
    .map((id) => {
      const p = byId.get(id);
      return {
        userId: id,
        fullName: p?.full_name ?? "",
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        roles: rows.filter((r) => r.user_id === id).map((r) => r.role),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export const useStaffAccounts = () =>
  useQuery({ queryKey: ["staff", "accounts"], queryFn: fetchStaffAccounts });
