import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PeerPendingApproval from "./PeerPendingApproval";
import { getRoleHome } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("participant" | "peer_specialist" | "admin")[];
  skipProfileCheck?: boolean;
}

const ProtectedRoute = ({ children, allowedRoles, skipProfileCheck }: ProtectedRouteProps) => {
  const { user, activeRole, roles, approvalStatus, loading } = useAuth();
  const location = useLocation();
  const [profileCheck, setProfileCheck] = useState<"loading" | "incomplete" | "complete">("loading");
  const [peerProfileCheck, setPeerProfileCheck] = useState<"loading" | "incomplete" | "complete">("loading");

  useEffect(() => {
    if (!user || !activeRole) {
      return;
    }

    if (skipProfileCheck && activeRole === "peer_specialist") {
      setProfileCheck("complete");
      setPeerProfileCheck("complete");
      return;
    }

    if (activeRole === "participant") {
      setProfileCheck("loading");
      setPeerProfileCheck("complete");
      supabase
        .from("participant_profiles")
        .select("first_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            setProfileCheck("incomplete");
            return;
          }
          setProfileCheck(!data || !data.first_name ? "incomplete" : "complete");
        });
    } else if (activeRole === "peer_specialist") {
      setPeerProfileCheck("loading");
      setProfileCheck("complete");
      supabase
        .from("peer_specialist_profiles")
        .select("first_name, bio")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            setPeerProfileCheck("incomplete");
            return;
          }
          setPeerProfileCheck(!data || !data.first_name || !data.bio ? "incomplete" : "complete");
        });
    } else {
      setProfileCheck("complete");
      setPeerProfileCheck("complete");
    }
  }, [user, activeRole, skipProfileCheck]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!activeRole) return <Navigate to="/login" replace />;

  if (profileCheck === "loading" || peerProfileCheck === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowedRoles.includes(activeRole)) {
    const home = getRoleHome(activeRole);
    return <Navigate to={home} replace />;
  }

  // Peer specialist: profile incomplete → setup page (unless already there)
  if (activeRole === "peer_specialist" && peerProfileCheck === "incomplete") {
    if (location.pathname !== "/peers/setup") {
      return <Navigate to="/peers/setup" replace />;
    }
    // Already on setup page — allow through
  }

  // Peer specialist: profile complete but not approved → pending/rejected/suspended screen
  if (activeRole === "peer_specialist" && peerProfileCheck === "complete" && approvalStatus !== "approved") {
    return <PeerPendingApproval />;
  }

  if (activeRole === "participant") {
    if (profileCheck === "incomplete" && location.pathname !== "/profile/setup") {
      return <Navigate to="/profile/setup" replace />;
    }

    if (profileCheck === "complete" && location.pathname === "/profile/setup") {
      return <Navigate to="/card" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
