import { Outlet, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Home, ClipboardList, MapPin, QrCode, UserCircle } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { to: "/card", label: "My Card", icon: Home },
  { to: "/plan", label: "My Plan", icon: ClipboardList },
  { to: "/resources", label: "Resources", icon: MapPin },
  { to: "/passport", label: "Passport", icon: QrCode },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

const ParticipantLayout = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Recovery Passport</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
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

export default ParticipantLayout;
