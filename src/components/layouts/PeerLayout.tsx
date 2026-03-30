import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Users, CheckCircle, BarChart3, UserCircle, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { to: "/caseload", label: "Caseload", icon: Users },
  { to: "/checkins", label: "Check-Ins", icon: CheckCircle },
  { to: "/crps", label: "My Progress", icon: BarChart3 },
  { to: "/peers/profile", label: "Profile", icon: UserCircle },
];

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  is_read: boolean;
  link: string | null;
};

const PeerLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const { data: unreadCount = 0, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);

      return count ?? 0;
    },
    enabled: !!user,
  });

  const {
    data: notifications = [],
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useQuery<NotificationItem[]>({
    queryKey: ["peer-notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, is_read, link")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && isNotificationsOpen,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`peer-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetchUnreadCount();
          if (isNotificationsOpen) refetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchUnreadCount, refetchNotifications, isNotificationsOpen]);

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Recovery Passport</h1>

        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen((open) => !open)}
            className="relative rounded-full p-2 transition-colors hover:bg-muted"
            aria-label="Notifications"
            aria-expanded={isNotificationsOpen}
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full px-1 text-[10px] flex items-center justify-center bg-accent text-accent-foreground border-0">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Notifications</p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notificationsLoading ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">Loading notifications…</p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">No notifications yet.</p>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} className="border-b border-border/60 px-4 py-3 last:border-b-0">
                      <div className="flex items-start gap-3">
                        {!notification.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{notification.title}</p>
                          {notification.body ? (
                            <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${active ? "text-accent" : "text-muted-foreground"}`}
                activeClassName="text-accent"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default PeerLayout;
