import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const ProfileRow = z.object({
  id: z.string(),
  full_name: z.string(),
  member_number: z.string(),
  status: z.enum(["pending", "active", "suspended", "closed"]),
});
const RoleRow = z.object({
  role: z.enum(["member", "finance", "admin", "super_admin"]),
});

export type MemberStatus = z.infer<typeof ProfileRow>["status"];
export type AppRole = z.infer<typeof RoleRow>["role"];
export type Profile = {
  id: string;
  fullName: string;
  memberNumber: string;
  status: MemberStatus;
};

type Me = { profile: Profile | null; roles: AppRole[] };

async function fetchMe(userId: string): Promise<Me> {
  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, member_number, status")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (rolesResult.error) throw rolesResult.error;

  const parsedProfile = profileResult.data
    ? ProfileRow.safeParse(profileResult.data)
    : null;
  const profile =
    parsedProfile && parsedProfile.success
      ? {
          id: parsedProfile.data.id,
          fullName: parsedProfile.data.full_name,
          memberNumber: parsedProfile.data.member_number,
          status: parsedProfile.data.status,
        }
      : null;
  const roles = (rolesResult.data ?? []).flatMap((row) => {
    const parsed = RoleRow.safeParse(row);
    return parsed.success ? [parsed.data.role] : [];
  });
  return { profile, roles };
}

type AuthState = {
  /** True until we know whether someone is signed in and, if so, who they are. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    // Keep this callback synchronous: calling Supabase from inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  const me = useQuery({
    queryKey: ["me", userId],
    queryFn: () => fetchMe(userId as string),
    enabled: Boolean(userId),
  });

  const value: AuthState = {
    loading: sessionLoading || (Boolean(userId) && me.isPending),
    session,
    profile: me.data?.profile ?? null,
    roles: me.data?.roles ?? [],
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.removeQueries({ queryKey: ["me"] });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
