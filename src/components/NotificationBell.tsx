import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell, Trophy, CheckCircle, UserCheck, UserX, FileText, ArrowRightLeft,
  Star, Unlock, ClipboardCheck, AlertTriangle, MessageSquare, Heart, Award,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  created_at: string;
  is_read: boolean;
  link: string | null;
};

const typeIcon: Record<string, React.ElementType> = {
  milestone_unlocked: Trophy,
  level_up: Star,
  peer_request_received: UserCheck,
  peer_request_approved: UserCheck,
  peer_request_declined: UserX,
  peer_application_submitted: FileText,
  peer_application_approved: UserCheck,
  peer_application_rejected: UserX,
  peer_edits_pending_review: FileText,
  peer_edits_approved: CheckCircle,
  checkin_reminder: ClipboardCheck,
  checkin_overdue: AlertTriangle,
  assessment_ready_for_review: ClipboardCheck,
  plan_updated: FileText,
  agreement_updated: FileText,
  referral_received: ArrowRightLeft,
  supervisor_feedback: MessageSquare,
  crps_eligible: Award,
  new_participant: UserCheck,
  general: Bell,
};

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

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

  const { data: notifications = [], refetch: refetchList } = useQuery<Notification[]>({
    queryKey: ["notifications-list", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at, is_read, link")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Notification[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-bell-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        refetchCount();
        if (open) refetchList();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, open, refetchCount, refetchList]);

  // Close on navigate
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const markRead = async (id: string, link: string | null) => {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    refetchCount();
    refetchList();
    if (link) { setOpen(false); navigate(link); }
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user!.id).eq("is_read", false);
    refetchCount();
    refetchList();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="relative rounded-full p-2 transition-colors hover:bg-muted" aria-label="Notifications">
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground border-0">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg z-50">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={markAllRead}>Mark all read</Button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">No notifications yet.</p>
              ) : (
                notifications.map(n => {
                  const Icon = typeIcon[n.type] ?? Bell;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${n.is_read ? "bg-muted/20" : "bg-card"}`}
                      onClick={() => markRead(n.id, n.link)}
                    >
                      <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${n.is_read ? "bg-muted" : "bg-primary/10"}`}>
                        <Icon className={`h-3.5 w-3.5 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${n.is_read ? "text-muted-foreground" : "font-medium text-foreground"}`}>{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
