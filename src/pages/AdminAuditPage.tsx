import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_OPTIONS = [
  "login",
  "view_profile",
  "unlock_milestone",
  "submit_assessment",
  "confirm_assessment",
  "submit_checkin",
  "submit_note",
  "generate_passport_link",
  "view_passport",
  "revoke_passport_link",
  "export_report",
  "approve_peer",
  "reject_peer",
  "suspend_peer",
  "edit_plan_step",
];

const ACTION_LABELS: Record<string, string> = {
  login: "Login",
  view_profile: "View Profile",
  unlock_milestone: "Unlock Milestone",
  submit_assessment: "Submit Assessment",
  confirm_assessment: "Confirm Assessment",
  submit_checkin: "Submit Check-In",
  submit_note: "Submit Note",
  generate_passport_link: "Generate Passport Link",
  view_passport: "View Passport (Public)",
  revoke_passport_link: "Revoke Passport Link",
  export_report: "Export Report",
  approve_peer: "Approve Peer",
  reject_peer: "Reject Peer",
  suspend_peer: "Suspend Peer",
  edit_plan_step: "Edit Plan Step",
};

const AdminAuditPage = () => {
  const { user } = useAuth();
  const [userSearch, setUserSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Fetch audit log entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ["audit-log", actionFilter, startDate, endDate],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (actionFilter && actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch user names for display
  const userIds = [...new Set((entries ?? []).map((e) => e.user_id).filter(Boolean))];
  const { data: usersMap } = useQuery({
    queryKey: ["audit-users", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const map: Record<string, { name: string; role: string }> = {};

      // Get from users table
      const { data: users } = await supabase
        .from("users")
        .select("id, email, role")
        .in("id", userIds);

      const peerIds: string[] = [];
      const participantIds: string[] = [];

      for (const u of users ?? []) {
        map[u.id] = { name: u.email, role: u.role };
        if (u.role === "peer_specialist") peerIds.push(u.id);
        if (u.role === "participant") participantIds.push(u.id);
      }

      // Get peer names
      if (peerIds.length > 0) {
        const { data: peers } = await supabase
          .from("peer_specialist_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", peerIds);
        for (const p of peers ?? []) {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
          if (name) map[p.user_id] = { ...map[p.user_id], name };
        }
      }

      // Get participant names
      if (participantIds.length > 0) {
        const { data: parts } = await supabase
          .from("participant_profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", participantIds);
        for (const p of parts ?? []) {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
          if (name) map[p.user_id] = { ...map[p.user_id], name };
        }
      }

      return map;
    },
  });

  // Client-side user name filter
  const filteredEntries = (entries ?? []).filter((e) => {
    if (!userSearch.trim()) return true;
    const search = userSearch.toLowerCase();
    const info = e.user_id ? usersMap?.[e.user_id] : null;
    if (!info) return e.user_id === null && search === "system";
    return info.name.toLowerCase().includes(search) || info.role.toLowerCase().includes(search);
  });

  const getUserDisplay = (userId: string | null) => {
    if (!userId) return { name: "System", role: "—" };
    const info = usersMap?.[userId];
    return info ?? { name: userId.slice(0, 8), role: "unknown" };
  };

  const roleBadgeVariant = (role: string) => {
    if (role === "admin") return "bg-purple-100 text-purple-700";
    if (role === "peer_specialist") return "bg-blue-100 text-blue-700";
    if (role === "participant") return "bg-green-100 text-green-700";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="px-4 pt-4 pb-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Search user</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name or role…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Action</label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {ACTION_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_LABELS[a] || a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Start date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-36 justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM d, yyyy") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">End date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-36 justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "MMM d, yyyy") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
            </PopoverContent>
          </Popover>
        </div>

        {(startDate || endDate || actionFilter !== "all" || userSearch) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate(undefined);
              setEndDate(undefined);
              setActionFilter("all");
              setUserSearch("");
            }}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredEntries.length} entries
      </p>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No entries found
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => {
                const userInfo = getUserDisplay(entry.user_id);
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>{format(new Date(entry.created_at), "MMM d, yyyy")}</div>
                      <div className="text-muted-foreground">
                        {format(new Date(entry.created_at), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{userInfo.name}</div>
                      <Badge className={cn("text-[10px] mt-0.5", roleBadgeVariant(userInfo.role))}>
                        {userInfo.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.target_type && (
                        <span>{entry.target_type}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                      {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 60) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit Entry Details</SheetTitle>
          </SheetHeader>
          {selectedEntry && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Timestamp</p>
                <p className="text-sm font-medium">
                  {format(new Date(selectedEntry.created_at), "MMMM d, yyyy 'at' h:mm:ss a")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(selectedEntry.created_at), { addSuffix: true })}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">User</p>
                {selectedEntry.user_id ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{getUserDisplay(selectedEntry.user_id).name}</p>
                    <Badge className={cn("text-[10px]", roleBadgeVariant(getUserDisplay(selectedEntry.user_id).role))}>
                      {getUserDisplay(selectedEntry.user_id).role}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">System / Anonymous</p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Action</p>
                <Badge variant="outline">{ACTION_LABELS[selectedEntry.action] || selectedEntry.action}</Badge>
              </div>

              {selectedEntry.target_type && (
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="text-sm">
                    <span className="font-medium">{selectedEntry.target_type}</span>
                    {selectedEntry.target_id && (
                      <span className="text-muted-foreground ml-2 text-xs font-mono">
                        {selectedEntry.target_id}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {selectedEntry.ip_address && (
                <div>
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedEntry.ip_address}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Metadata</p>
                {selectedEntry.metadata ? (
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap mt-1">
                    {JSON.stringify(selectedEntry.metadata, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No metadata</p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Entry ID</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedEntry.id}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminAuditPage;
