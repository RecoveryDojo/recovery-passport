import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PeerPendingApproval from "./PeerPendingApproval";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("participant" | "peer_specialist" | "admin")[];
  skipProfileCheck?: boolean;
}

const ProtectedRoute = ({ children, allowedRoles, skipProfileCheck }: ProtectedRouteProps) => {
  const { user, role, approvalStatus, loading } = useAuth();
  const [profileCheck, setProfileCheck] = useState<"loading" | "incomplete" | "complete">(
    skipProfileCheck ? "complete" : "loading"
  );
  const [peerProfileCheck, setPeerProfileCheck] = useState<"loading" | "incomplete" | "complete">("loading");

  useEffect(() => {
    if (!user || !role) {
      return;
    }

    if (skipProfileCheck && role !== "peer_specialist") {
      setProfileCheck("complete");
      setPeerProfileCheck("complete");
      return;
    }

    if (role === "participant") {
      setProfileCheck("loading");
      setPeerProfileCheck("complete");
      supabase
        .from("participant_profiles")
        .select("first_name")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          setProfileCheck(!data || !data.first_name ? "incomplete" : "complete");
        });
    } else if (role === "peer_specialist") {
      setPeerProfileCheck("loading");
      setProfileCheck("complete");
      supabase
        .from("peer_specialist_profiles")
        .select("first_name, bio")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          setPeerProfileCheck(!data || !data.first_name || !data.bio ? "incomplete" : "complete");
        });
    } else {
      setProfileCheck("complete");
      setPeerProfileCheck("complete");
    }
  }, [user, role, skipProfileCheck]);

  if (loading || profileCheck === "loading" || peerProfileCheck === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!role) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!allowedRoles.includes(role)) {
    const home = role === "participant" ? "/card" : role === "peer_specialist" ? "/caseload" : "/admin";
    return <Navigate to={home} replace />;
  }

  // Peer specialist: profile incomplete → setup page
  if (!skipProfileCheck && role === "peer_specialist" && peerProfileCheck === "incomplete") {
    return <Navigate to="/peers/setup" replace />;
  }

  if (role === "peer_specialist" && approvalStatus !== "approved") {
    return <PeerPendingApproval />;
  }

  if (!skipProfileCheck && role === "participant" && profileCheck === "incomplete") {
    return <Navigate to="/profile/setup" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
