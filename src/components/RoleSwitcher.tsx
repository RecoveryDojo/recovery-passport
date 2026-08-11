import { useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { ChevronDown, Shield, User, HeartPulse } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const ROLE_META: Record<UserRole, { label: string; icon: React.ElementType; className: string }> = {
  admin: { label: "Admin", icon: Shield, className: "bg-primary text-primary-foreground border-transparent" },
  peer_specialist: { label: "Peer Specialist", icon: HeartPulse, className: "bg-accent text-accent-foreground border-transparent" },
  participant: { label: "Participant", icon: User, className: "bg-muted text-muted-foreground border-border" },
};

const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin",
  peer_specialist: "/caseload",
  participant: "/card",
};

interface RoleSwitcherProps {
  className?: string;
}

export const RoleSwitcher = ({ className }: RoleSwitcherProps) => {
  const { activeRole, roles, setActiveRole } = useAuth();
  const navigate = useNavigate();

  if (!activeRole || roles.length <= 1) return null;

  const meta = ROLE_META[activeRole];
  const Icon = meta.icon;

  const handleSwitch = (role: UserRole) => {
    if (role === activeRole) return;
    setActiveRole(role);
    navigate(ROLE_HOME[role], { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-colors",
          meta.className,
          className
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>Viewing as {meta.label}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {roles.map((role) => {
          const roleMeta = ROLE_META[role];
          const RoleIcon = roleMeta.icon;
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => handleSwitch(role)}
              className={cn(
                "flex items-center gap-2 text-sm cursor-pointer",
                role === activeRole && "font-semibold bg-muted"
              )}
            >
              <RoleIcon className={cn("h-4 w-4", role === activeRole ? "text-primary" : "text-muted-foreground")} />
              {roleMeta.label}
              {role === activeRole && <span className="ml-auto text-[10px] text-muted-foreground">Current</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RoleSwitcher;
