/**
 * Admin Participant Detail Sheet (Phase 4) — sticky header + 5 tabs.
 *
 * Mirrors the Peer caseload detail page (Phase 3) and shares the SAME
 * `useParticipantClinicalSummary` hook so admins and peers see one source
 * of truth, kept fresh by the same realtime channels.
 *
 * Tabs: Overview · Journey · Engagement · Care Team · Notes
 */
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Mail,
  Calendar,
  Heart,
  Award,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Users,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useParticipantClinicalSummary } from "@/hooks/use-participant-clinical-summary";
import type { Database } from "@/integrations/supabase/types";

type CardLevel = Database["public"]["Enums"]["card_level"];

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

const LEVEL_LABELS: Record<CardLevel, string> = {
  rookie: "ROOKIE",
  starter: "STARTER",
  veteran: "VETERAN",
  all_star: "ALL-STAR",
};
const LEVEL_STYLES: Record<CardLevel, string> = {
  rookie: "bg-[hsl(0,0%,63%)] text-white",
  starter: "bg-[hsl(217,91%,60%)] text-white",
  veteran: "bg-primary text-primary-foreground",
  all_star: "bg-accent text-accent-foreground",
};
const MOOD_DOTS: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-amber-500",
  4: "bg-primary",
  5: "bg-green-600",
};
const MOOD_LABELS: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Thriving",
};
const PHASE_LABELS: Record<string, string> = {
  thirty_day: "30-Day",
  sixty_day: "60-Day",
  ninety_day: "90-Day",
  six_month: "6-Month",
};

const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "—" : "—";

const AdminParticipantDetailSheet = ({ participant, open, onOpenChange }: Props) => {
  const profileId = participant?.id ?? null;
  const { data, isLoading } = useParticipantClinicalSummary(open ? profileId : null);

  if (!participant) return null;

  const profile = data?.profile;
  const name = fullName(participant);
  const initials = (participant.first_name?.[0] ?? "") + (participant.last_name?.[0] ?? "");
  const days = participant.recovery_start_date != null
    ? differenceInDays(new Date(), new Date(participant.recovery_start_date))
    : null;
  const level = (profile?.card_level ?? "rookie") as CardLevel;
  const lastCheckin = data?.recentCheckins[0];
  const isCrisis = lastCheckin && lastCheckin.mood_status <= 2;
  const planStepsCompleted = data?.planSteps.filter((s) => s.is_completed).length ?? 0;
  const planStepsTotal = data?.planSteps.length ?? 0;
  const completedPct = planStepsTotal > 0
    ? Math.round((planStepsCompleted / planStepsTotal) * 100)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {profile?.photo_url ? <AvatarImage src={profile.photo_url} alt={name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground truncate">{name}</h2>
                <Badge className={cn("text-[10px] px-2", LEVEL_STYLES[level])}>
                  {LEVEL_LABELS[level]}
                </Badge>
                {isCrisis && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Crisis
                  </Badge>
                )}
                {data?.activePhase && (
                  <Badge variant="outline" className="text-[10px]">
                    {PHASE_LABELS[data.activePhase.phase] ?? data.activePhase.phase}
                  </Badge>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                {participant.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
            {days !== null && <span>{days} days in recovery</span>}
            {data && (
              <span>
                {data.earnedMilestones.length} / {data.totalMilestoneCount} milestones
              </span>
            )}
            {participant.assigned_peer_id && participant.peer ? (
              <span className="text-primary">Peer: {fullName(participant.peer)}</span>
            ) : (
              <span className="text-amber-600">Unassigned</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 py-4">
          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="journey" className="text-xs">Journey</TabsTrigger>
                <TabsTrigger value="engagement" className="text-xs">Engage</TabsTrigger>
                <TabsTrigger value="care-team" className="text-xs">Care</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview" className="space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Snapshot
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Started</p>
                          <p className="text-foreground font-medium">
                            {profile?.recovery_start_date
                              ? format(new Date(profile.recovery_start_date), "MMM d, yyyy")
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Heart className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Pathway</p>
                          <p className="text-foreground font-medium capitalize">
                            {profile?.pathway?.replace(/_/g, " ") ?? "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {profile?.program && (
                      <p className="text-xs text-muted-foreground">
                        Program: <span className="text-foreground">{profile.program.name}</span>
                      </p>
                    )}
                    {profile?.substances && profile.substances.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Substances</p>
                        <div className="flex flex-wrap gap-1.5">
                          {profile.substances.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs capitalize">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Mood (last {Math.min(data.recentCheckins.length, 8)})
                    </p>
                    {data.recentCheckins.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No check-ins recorded.</p>
                    ) : (
                      <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
                        {[...data.recentCheckins].reverse().map((c) => (
                          <div key={c.id} className="flex flex-col items-center gap-1 min-w-[36px]">
                            <span
                              className={cn(
                                "h-4 w-4 rounded-full",
                                MOOD_DOTS[c.mood_status] ?? "bg-muted"
                              )}
                              title={`${MOOD_LABELS[c.mood_status]} on ${format(
                                new Date(c.checkin_date),
                                "MMM d"
                              )}`}
                            />
                            <span className="text-[9px] text-muted-foreground">
                              {format(new Date(c.checkin_date), "M/d")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* JOURNEY */}
              <TabsContent value="journey" className="space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Active Plan Phase
                    </p>
                    {data.activePhase ? (
                      <>
                        <div>
                          <p className="text-sm font-bold text-foreground">{data.activePhase.title}</p>
                          {data.activePhase.focus_description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {data.activePhase.focus_description}
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>{planStepsCompleted} / {planStepsTotal} steps complete</span>
                            <span>{completedPct}%</span>
                          </div>
                          <Progress value={completedPct} className="h-2" />
                        </div>
                        <ul className="space-y-1.5 pt-1">
                          {data.planSteps.map((s) => (
                            <li key={s.id} className="flex items-start gap-2 text-sm">
                              <CheckCircle2
                                className={cn(
                                  "h-4 w-4 mt-0.5 shrink-0",
                                  s.is_completed ? "text-primary" : "text-muted-foreground/40"
                                )}
                              />
                              <span
                                className={cn(
                                  s.is_completed
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                )}
                              >
                                {s.description}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active phase yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Earned Milestones ({data.earnedMilestones.length} / {data.totalMilestoneCount})
                    </p>
                    {data.earnedMilestones.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.earnedMilestones.slice(0, 6).map((m) => (
                          <li key={m.id} className="flex items-center gap-2 text-sm">
                            <Award className="h-4 w-4 text-accent" />
                            <span className="text-foreground flex-1">
                              {m.milestone?.name ?? "Milestone"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(m.unlocked_at), { addSuffix: true })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Recent Assessments
                    </p>
                    {data.recentAssessments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No assessments yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.recentAssessments.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0"
                          >
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              <span className="text-foreground">
                                {a.overall_score?.toFixed(1) ?? "—"}
                              </span>
                              {!a.confirmed_by && (
                                <Badge variant="outline" className="text-[9px]">unconfirmed</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(a.completed_at), "MMM d, yyyy")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ENGAGEMENT */}
              <TabsContent value="engagement" className="space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Recent Check-ins (last 8 weeks)
                    </p>
                    {data.recentCheckins.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No check-ins yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.recentCheckins.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-background"
                          >
                            <span
                              className={cn(
                                "h-3 w-3 rounded-full mt-1.5 shrink-0",
                                MOOD_DOTS[c.mood_status] ?? "bg-muted"
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {format(new Date(c.checkin_date), "MMM d, yyyy")}
                                <span className="text-muted-foreground font-normal">
                                  {" · "}{MOOD_LABELS[c.mood_status]}
                                </span>
                              </p>
                              {c.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {c.summary}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CARE TEAM */}
              <TabsContent value="care-team" className="space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Assigned Peer Specialist
                    </p>
                    {data.assignedPeer ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          {data.assignedPeer.photo_url ? (
                            <AvatarImage src={data.assignedPeer.photo_url} alt="" />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {(data.assignedPeer.first_name?.[0] ?? "") +
                              (data.assignedPeer.last_name?.[0] ?? "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground">
                            {data.assignedPeer.first_name} {data.assignedPeer.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Caseload: {data.assignedPeer.caseload_size} participant
                            {data.assignedPeer.caseload_size === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No peer specialist assigned yet.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {data.supervisorFeedback.length > 0 && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Supervisor Feedback
                      </p>
                      <ul className="space-y-2">
                        {data.supervisorFeedback.map((f) => (
                          <li
                            key={f.id}
                            className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                          >
                            <p className="text-foreground">{f.feedback}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(f.created_at), "MMM d, yyyy")} ·{" "}
                              <span className="capitalize">{f.target_type.replace(/_/g, " ")}</span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* NOTES */}
              <TabsContent value="notes" className="space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Recent Notes
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        {data.consentCount} consents
                      </Badge>
                    </div>
                    {data.recentNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No notes yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.recentNotes.map((n) => (
                          <li
                            key={n.id}
                            className="rounded-md border border-border bg-background p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {n.note_type}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {format(new Date(n.created_at), "MMM d, yyyy")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground line-clamp-3">{n.content}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-2">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{data.agreementCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Agreements</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{data.consentCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Consents</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{data.sharedLinkCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Links</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminParticipantDetailSheet;
