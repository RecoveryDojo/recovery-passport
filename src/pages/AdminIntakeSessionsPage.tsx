import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, FileText, Search } from "lucide-react";

type Row = {
  id: string;
  status: string;
  current_step: number | null;
  started_at: string | null;
  completed_at: string | null;
  participantName: string;
  programName: string | null;
  peerName: string | null;
};

export default function AdminIntakeSessionsPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-intake-sessions"],
    queryFn: async (): Promise<Row[]> => {
      const { data: sessions, error } = await supabase
        .from("intake_sessions")
        .select("id, status, current_step, started_at, completed_at, participant_id, program_id, started_by")
        .order("started_at", { ascending: false });
      if (error) throw error;
      if (!sessions?.length) return [];

      const participantIds = sessions.map((s) => s.participant_id).filter(Boolean) as string[];
      const programIds = sessions.map((s) => s.program_id).filter(Boolean) as string[];
      const peerIds = sessions.map((s) => s.started_by).filter(Boolean) as string[];

      const [profilesRes, programsRes, peersRes] = await Promise.all([
        participantIds.length
          ? supabase
              .from("participant_profiles")
              .select("id, first_name, last_name")
              .in("id", participantIds)
          : Promise.resolve({ data: [] as any[] }),
        programIds.length
          ? supabase.from("programs").select("id, name").in("id", programIds)
          : Promise.resolve({ data: [] as any[] }),
        peerIds.length
          ? supabase
              .from("peer_specialist_profiles")
              .select("user_id, first_name, last_name")
              .in("user_id", peerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profiles = new Map(
        (profilesRes.data ?? []).map((p: any) => [
          p.id,
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        ]),
      );
      const programs = new Map((programsRes.data ?? []).map((p: any) => [p.id, p.name]));
      const peers = new Map(
        (peersRes.data ?? []).map((p: any) => [
          p.user_id,
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        ]),
      );

      return sessions.map((s) => ({
        id: s.id,
        status: String(s.status),
        current_step: s.current_step,
        started_at: s.started_at,
        completed_at: s.completed_at,
        participantName:
          (s.participant_id ? profiles.get(s.participant_id) : "") || "Unnamed participant",
        programName: s.program_id ? (programs.get(s.program_id) ?? null) : null,
        peerName: s.started_by ? (peers.get(s.started_by) ?? null) : null,
      }));
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q && !r.participantName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, status, search]);

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-primary">Intake Packets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every intake session, with the full signed packet available for review.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search participant"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No intake sessions match this filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} to={`/admin/intake-sessions/${r.id}`}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {r.participantName}
                      </span>
                      <Badge
                        variant={r.status === "completed" ? "default" : "secondary"}
                        className="capitalize text-xs"
                      >
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {[
                        r.programName,
                        r.peerName ? `Run by ${r.peerName}` : null,
                        r.completed_at
                          ? `Completed ${format(parseISO(r.completed_at), "MMM d, yyyy")}`
                          : r.started_at
                            ? `Started ${format(parseISO(r.started_at), "MMM d, yyyy")} · step ${r.current_step ?? 1}/16`
                            : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
