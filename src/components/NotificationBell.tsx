import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: unreadCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-bell-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        refetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetchCount]);

  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative rounded-full p-2 transition-colors hover:bg-muted"
      aria-label="Notifications"
    >
      <Bell className="h-5 w-5 text-muted-foreground" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-0">
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </button>
  );
};

export default NotificationBell;
