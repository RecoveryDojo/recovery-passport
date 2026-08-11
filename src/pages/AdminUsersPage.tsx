import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Shield } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

const ALL_ROLES: UserRole[] = ["participant", "peer_specialist", "admin"];

const roleBadgeVariant = (role: UserRole) => {
  switch (role) {
    case "admin": return "destructive" as const;
    case "peer_specialist": return "default" as const;
    default: return "secondary" as const;
  }
};

const roleLabel = (role: UserRole) => {
  switch (role) {
    case "admin": return "Admin";
    case "peer_specialist": return "Peer Specialist";
    case "participant": return "Participant";
  }
};

interface PendingChange {
  userId: string;
  email: string;
  role: UserRole;
  grant: boolean;
}

const AdminUsersPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const { data: ownerId } = useQuery({
    queryKey: ["owner-user-id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "owner_user_id")
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? null;
    },
  });

  const rolesFor = (userId: string): UserRole[] =>
    userRoles.filter((r) => r.user_id === userId).map((r) => r.role as UserRole);

  const changeRole = useMutation({
    mutationFn: async ({ userId, role, grant }: PendingChange) => {
      if (grant) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role, granted_by: user?.id ?? null });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: vars.grant ? "Role granted" : "Role removed",
        description: `${roleLabel(vars.role)} ${vars.grant ? "added to" : "removed from"} ${vars.email}.`,
      });
      setPendingChange(null);
    },
    onError: (err: Error) => {
      toast({ title: "Could not update roles", description: err.message, variant: "destructive" });
      setPendingChange(null);
    },
  });

  const filtered = users.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase());
    const assigned = rolesFor(u.id);
    const matchesRole =
      roleFilter === "all" ||
      assigned.includes(roleFilter as UserRole) ||
      (assigned.length === 0 && u.role === roleFilter);
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">User Management</h1>
        <Badge variant="outline" className="ml-auto">{users.length} users</Badge>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="participant">Participant</SelectItem>
            <SelectItem value="peer_specialist">Peer Specialist</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading users...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[300px]">Assign Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = u.id === user?.id;
                const assigned = rolesFor(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(assigned.length ? assigned : [u.role]).map((r) => (
                          <Badge key={r} variant={roleBadgeVariant(r)}>{roleLabel(r)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <span className="text-xs text-muted-foreground italic">You</span>
                      ) : (
                        <div className="flex flex-wrap gap-3">
                          {ALL_ROLES.map((r) => {
                            const checked = assigned.includes(r);
                            const isLastRole = checked && assigned.length <= 1;
                            return (
                              <label key={r} className="flex items-center gap-1.5 text-xs">
                                <Checkbox
                                  checked={checked}
                                  disabled={isLastRole || changeRole.isPending}
                                  onCheckedChange={() =>
                                    setPendingChange({
                                      userId: u.id,
                                      email: u.email,
                                      role: r,
                                      grant: !checked,
                                    })
                                  }
                                />
                                {roleLabel(r)}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!pendingChange} onOpenChange={(open) => !open && setPendingChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingChange?.grant ? "Grant role?" : "Remove role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.grant ? "Give " : "Remove "}
              <strong>{pendingChange?.email}</strong>
              {pendingChange?.grant ? " the " : " the "}
              <strong>{pendingChange ? roleLabel(pendingChange.role) : ""}</strong> role
              {pendingChange?.grant ? "" : ""}? This takes effect immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingChange && changeRole.mutate(pendingChange)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
