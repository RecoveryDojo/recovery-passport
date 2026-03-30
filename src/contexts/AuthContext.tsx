import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "participant" | "peer_specialist" | "admin";
type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  approvalStatus: ApprovalStatus | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  approvalStatus: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (data) {
      const userRole = data.role as UserRole;
      setRole(userRole);

      if (userRole === "peer_specialist") {
        const { data: peerData } = await supabase
          .from("peer_specialist_profiles")
          .select("approval_status")
          .eq("user_id", userId)
          .single();
        setApprovalStatus((peerData?.approval_status as ApprovalStatus) ?? "pending");
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer to avoid Supabase client deadlock
          setTimeout(() => fetchUserRole(newSession.user.id), 0);
        } else {
          setRole(null);
          setApprovalStatus(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchUserRole(currentSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setApprovalStatus(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, approvalStatus, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
