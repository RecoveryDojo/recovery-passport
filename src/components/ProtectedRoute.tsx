import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PeerPendingApproval from "./PeerPendingApproval";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ("participant" | "peer_specialist" | "admin")[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, approvalStatus, loading } = useAuth();

  if (loading) {
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

  if (role === "peer_specialist" && approvalStatus !== "approved") {
    return <PeerPendingApproval />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
