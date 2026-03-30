import { Outlet, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { LayoutGrid, Users, UserCheck, BookOpen, BarChart2, Clock, Menu } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutGrid },
  { to: "/admin/participants", label: "Participants", icon: Users },
  { to: "/admin/peers", label: "Peer Specialists", icon: UserCheck },
  { to: "/admin/content", label: "Content", icon: BookOpen },
  { to: "/admin/reports", label: "Reports", icon: BarChart2 },
  { to: "/admin/audit", label: "Audit Log", icon: Clock },
];

const AdminSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-4">
        {!collapsed && (
          <div className="px-4 pb-4 mb-2 border-b border-sidebar-border">
            <h2 className="text-sm font-bold tracking-wide text-sidebar-foreground">Recovery Passport</h2>
            <p className="text-xs text-sidebar-foreground/60">Admin</p>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = item.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={item.to} end={item.to === "/admin"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary">
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

const AdminLayout = () => {
  const isMobile = useIsMobile();
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {!isMobile && <AdminSidebar />}
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card">
            {!isMobile && <SidebarTrigger className="mr-3" />}
            <span className="text-sm font-medium text-primary">Admin</span>
          </header>
          <main className={`flex-1 ${isMobile ? "pb-20" : ""}`}>
            <Outlet />
          </main>
          {isMobile && (
            <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
              <div className="flex justify-around items-center h-16">
                {navItems.slice(0, 5).map((item) => {
                  const active = item.to === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/admin"}
                      className={`flex flex-col items-center gap-1 px-2 py-2 text-[10px] transition-colors ${active ? "text-accent" : "text-muted-foreground"}`}
                      activeClassName="text-accent"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
