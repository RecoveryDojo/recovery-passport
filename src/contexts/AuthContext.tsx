import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "participant" | "peer_specialist" | "admin";
type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

const ROLE_PRIORITY: UserRole[] = ["admin", "peer_specialist", "participant"];
const ROLE_HOME: Record<UserRole, string> = {
  participant: "/card",
  peer_specialist: "/caseload",
  admin: "/admin",
};
const ROLE_LABEL: Record<UserRole, string> = {
  participant: "Participant",
  peer_specialist: "Peer Specialist",
  admin: "Admin",
};
const ACTIVE_ROLE_KEY = "recovery_passport_active_role";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  // Single role alias: prefer activeRole for new code. Kept for backward compatibility.
  role: UserRole | null;
  roles: UserRole[];
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  approvalStatus: ApprovalStatus | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  roles: [],
  activeRole: null,
  setActiveRole: () => {},
  approvalStatus: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const getRoleHome = (role: UserRole) => ROLE_HOME[role];
export const getRoleLabel = (role: UserRole) => ROLE_LABEL[role];

const mostPrivilegedRole = (roles: UserRole[]): UserRole | null => {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveActiveRole = useCallback((newRoles: UserRole[]) => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_ROLE_KEY) : null;
    if (stored && newRoles.includes(stored as UserRole)) {
      return stored as UserRole;
    }
    return mostPrivilegedRole(newRoles);
  }, []);

  const setActiveRole = useCallback((role: UserRole) => {
    if (!ROLE_PRIORITY.includes(role)) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_ROLE_KEY, role);
    }
    setActiveRoleState(role);
  }, []);

  const fetchApprovalStatus = useCallback(async (userId: string, userRoles: UserRole[]) => {
    if (userRoles.includes("peer_specialist")) {
      const { data: peerData } = await supabase
        .from("peer_specialist_profiles")
        .select("approval_status")
        .eq("user_id", userId)
        .single();
      setApprovalStatus((peerData?.approval_status as ApprovalStatus) ?? "pending");
    } else {
      setApprovalStatus(null);
    }
  }, []);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      // Try the multi-role table first. If it doesn't exist yet, fall back to the single role column.
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!rolesError && userRoles && userRoles.length > 0) {
        const unique = [...new Set(userRoles.map((r) => r.role as UserRole))].filter((r) =>
          ROLE_PRIORITY.includes(r)
        );
        setRoles(unique);
        const nextActive = resolveActiveRole(unique);
        setActiveRoleState(nextActive);
        await fetchApprovalStatus(userId, unique);
        return;
      }
    } catch {
      // user_roles table may not exist yet; fall through.
    }

    // Fallback: single role from users table.
    try {
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      if (error || !data) {
        setRoles([]);
        setActiveRoleState(null);
        setApprovalStatus(null);
        return;
      }

      const userRole = data.role as UserRole;
      const unique = [userRole].filter((r) => ROLE_PRIORITY.includes(r));
      setRoles(unique);
      const nextActive = resolveActiveRole(unique);
      setActiveRoleState(nextActive);
      await fetchApprovalStatus(userId, unique);
    } catch (err) {
      console.error("Unexpected error fetching user roles:", err);
      setRoles([]);
      setActiveRoleState(null);
      setApprovalStatus(null);
    }
  }, [resolveActiveRole, fetchApprovalStatus]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        if (event === "SIGNED_IN") {
          setTimeout(() => {
            supabase
              .from("audit_log")
              .insert({
                user_id: newSession.user.id,
                action: "login",
              })
              .then(() => {});
          }, 0);
        }
        setTimeout(() => {
          fetchUserRoles(newSession.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setRoles([]);
        setActiveRoleState(null);
        setApprovalStatus(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchUserRoles(currentSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRoles]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setActiveRoleState(null);
    setApprovalStatus(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACTIVE_ROLE_KEY);
    }
  };

  const role = activeRole;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        roles,
        activeRole,
        setActiveRole,
        approvalStatus,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
