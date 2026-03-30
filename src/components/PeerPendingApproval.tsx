import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const PeerPendingApproval = () => {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-6">
          <div className="w-8 h-8 rounded-full bg-accent/30" />
        </div>
        <h1 className="text-xl font-semibold text-primary mb-3">Account Pending Approval</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Your account is pending approval from your supervisor. You'll receive a notification when you're approved.
        </p>
        <Button variant="outline" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default PeerPendingApproval;
