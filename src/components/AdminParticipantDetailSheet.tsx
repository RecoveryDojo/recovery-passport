import { useQuery } from "@tanstack/react-query";
import { differenceInDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { UserCheck, UserX, Mail, Calendar, Heart } from "lucide-react";

interface DetailParticipant {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  recovery_start_date: string | null;
  assigned_peer_id: string | null;
  peer?: { user_id: string; first_name: string; last_name: string } | null;
}

interface Props {
  participant: DetailParticipant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MOOD_LABELS: Record<number, { label: string; dot: string }> = {
  1: { label: "Struggling", dot: "bg-red-500" },
  2: { label: "Low", dot: "bg-orange-500" },
  3: { label: "Okay", dot: "bg-amber-500" },
  4: { label: "Good", dot: "bg-primary" },
  5: { label: "Thriving", dot: "bg-green-600" },
};

const CONTACT_MODE_LABELS: Record<string, string> = {
  in_person: "In person",
  phone: "Phone",
  text: "Text",
  app_message: "App message",
  no_contact: "No contact",
};

const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "—" : "—";

const AdminParticipantDetailSheet = ({ participant, open, onOpenChange }: Props) => {
  const profileId = participant?.id ?? null;

  // Profile extras (pathway, substances)
  const { data: profileExtras } = useQuery({
    queryKey: ["admin-participant-extras", profileId],
    enabled: !!profileId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("pathway, substances")
        .eq("id", profileId!)
        .maybeSingle();
      return data;
    },
  });

  // Assignment date from peer_requests
  const { data: assignmentDate } = useQuery({
    queryKey: ["admin-participant-assignment-date", profileId, participant?.assigned_peer_id],
    enabled: !!profileId && !!participant?.assigned_peer_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("peer_requests")
        .select("responded_at")
        .eq("participant_id", profileId!)
        .eq("peer_specialist_id", participant!.assigned_peer_id!)
        .eq("status", "approved")
        .order("responded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.responded_at ?? null;
    },
  });

  // Last 10 check-ins + peer names
  const { data: checkins, isLoading: loadingCheckins } = useQuery({
    queryKey: ["admin-participant-checkins", profileId],
    enabled: !!profileId && open,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("weekly_checkins")
        .select("id, checkin_date, mood_status, contact_mode, peer_specialist_id")
        .eq("participant_id", profileId!)
        .order("checkin_date", { ascending: false })
        .limit(10);
      const list = rows ?? [];
      if (list.length === 0) return [];

      const peerIds = [...new Set(list.map((c) => c.peer_specialist_id).filter(Boolean))];
      const { data: peers } = peerIds.length
        ? await supabase
            .from("peer_specialist_profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", peerIds)
        : { data: [] as { user_id: string; first_name: string; last_name: string }[] };
      const peerMap = Object.fromEntries((peers ?? []).map((p) => [p.user_id, p]));
      return list.map((c) => ({ ...c, peer: peerMap[c.peer_specialist_id] ?? null }));
    },
  });

  if (!participant) return null;

  const name = fullName(participant);
  const days =
    participant.recovery_start_date != null
      ? differenceInDays(new Date(), new Date(participant.recovery_start_date))
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg">{name}</SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs">
            <Mail className="h-3 w-3" />
            {participant.email}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* OVERVIEW */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Overview
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">
                  {days !== null
                    ? `${days} day${days === 1 ? "" : "s"} in recovery`
                    : "Recovery start date not set"}
                </span>
              </div>
              {profileExtras?.pathway && (
                <div className="flex items-center gap-2 text-sm">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground capitalize">
                    Pathway: {profileExtras.pathway.replace(/_/g, " ")}
                  </span>
                </div>
              )}
              {profileExtras?.substances && profileExtras.substances.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profileExtras.substances.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs capitalize">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* PEER ASSIGNMENT */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Peer Assignment
              </p>
              {participant.assigned_peer_id && participant.peer ? (
                <>
                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                    <UserCheck className="h-3 w-3 mr-1" />
                    {fullName(participant.peer)}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {assignmentDate
                      ? `Assigned ${format(new Date(assignmentDate), "MMM d, yyyy")}`
                      : "Assignment date not recorded"}
                  </p>
                </>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                  <UserX className="h-3 w-3 mr-1" />
                  Unassigned
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* CHECK-IN HISTORY */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recent Check-ins (last 10)
              </p>
              {loadingCheckins ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              ) : !checkins || checkins.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No check-ins recorded yet
                </p>
              ) : (
                <div className="space-y-2">
                  {checkins.map((c) => {
                    const mood = MOOD_LABELS[c.mood_status] ?? {
                      label: `${c.mood_status}/5`,
                      dot: "bg-muted",
                    };
                    return (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-3 p-2.5 rounded-md border border-border bg-background"
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span
                            className={cn("h-3 w-3 rounded-full mt-1 shrink-0", mood.dot)}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {format(new Date(c.checkin_date), "MMM d, yyyy")}
                              <span className="text-muted-foreground font-normal">
                                {" · "}
                                {mood.label}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.contact_mode
                                ? CONTACT_MODE_LABELS[c.contact_mode] ?? c.contact_mode
                                : "Contact mode not recorded"}
                              {c.peer ? ` · ${fullName(c.peer)}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminParticipantDetailSheet;
