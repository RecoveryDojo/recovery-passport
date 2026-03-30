import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEV_EMAIL = "scotticainc+1@gmail.com";

const roles = [
  { value: "participant" as const, label: "Participant", emoji: "🎴" },
  { value: "peer_specialist" as const, label: "Peer", emoji: "🤝" },
  { value: "admin" as const, label: "Admin", emoji: "🛡️" },
];

const DevRoleSwitcher = () => {
  const { user, role } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  // Only show in dev and for the test account
  const isDev = import.meta.env.DEV;
  if (!isDev || !user || user.email?.toLowerCase() !== DEV_EMAIL) return null;

  const ensureProfile = async (newRole: "participant" | "peer_specialist" | "admin") => {
    if (newRole === "participant") {
      const { data } = await supabase
        .from("participant_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!data) {
        await supabase
          .from("participant_profiles")
          .insert({ user_id: user!.id, first_name: "Test", last_name: "User" });
      }
    } else if (newRole === "peer_specialist") {
      const { data } = await supabase
        .from("peer_specialist_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!data) {
        await supabase
          .from("peer_specialist_profiles")
          .insert({ user_id: user!.id, first_name: "Test", last_name: "User" });
      }
    }
  };

  const switchRole = async (newRole: "participant" | "peer_specialist" | "admin") => {
    if (newRole === role || switching) return;
    setSwitching(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", user.id);
      if (error) throw error;
      await ensureProfile(newRole);
      toast.success(`Switched to ${newRole}. Reloading…`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      toast.error(e.message || "Failed to switch role");
      setSwitching(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {open && (
        <div className="mb-2 bg-card border border-border rounded-lg shadow-lg p-2 space-y-1 min-w-[140px]">
          {roles.map((r) => (
            <button
              key={r.value}
              onClick={() => switchRole(r.value)}
              disabled={switching || r.value === role}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors
                ${r.value === role
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-foreground"
                } disabled:opacity-50`}
            >
              <span>{r.emoji}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="h-10 w-10 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center text-lg hover:scale-110 transition-transform"
        title="Dev Role Switcher"
      >
        🔧
      </button>
    </div>
  );
};

export default DevRoleSwitcher;