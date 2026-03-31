import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Bell, Trophy, Star, UserCheck, UserX, FileText, CheckCircle, ClipboardCheck, AlertTriangle, ArrowRightLeft, MessageSquare, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ["notifications-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, type, created_at, is_read, link")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Notification[];
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (n: Notification) => {
    if (!n.is_read) {
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", n.id);
      refetch();
      qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    }
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .eq("is_read", false);
    refetch();
    qc.invalidateQueries({ queryKey: ["unread-notifications"] });
  };

  return (
    <div className="space-y-4 pb-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Notifications</h1>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = typeIcon[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  n.is_read
                    ? "bg-muted/30 border-border/50"
                    : "bg-card border-border shadow-sm"
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 rounded-full p-2 ${
                    n.is_read ? "bg-muted" : "bg-primary/10"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      n.is_read ? "text-muted-foreground" : "text-primary"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      n.is_read
                        ? "text-muted-foreground"
                        : "font-semibold text-foreground"
                    }`}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
