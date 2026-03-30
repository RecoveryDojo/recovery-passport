import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRedirect from "@/components/RoleRedirect";
import ParticipantLayout from "@/components/layouts/ParticipantLayout";
import PeerLayout from "@/components/layouts/PeerLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import UpdatePassword from "@/pages/UpdatePassword";
import ProfileSetup from "@/pages/ProfileSetup";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import {
  CardPage, PlanPage, ResourcesPage, PassportPage,
  CaseloadPage, CheckInsPage, CrpsPage,
  AdminDashboard, AdminParticipants, AdminPeers, AdminContent, AdminReports, AdminAudit,
  IntakePage,
} from "@/pages/placeholder-pages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<UpdatePassword />} />
            <Route path="/intake" element={<IntakePage />} />

            {/* Profile setup (participant only, before layout) */}
            <Route path="/profile/setup" element={<ProtectedRoute allowedRoles={["participant"]}><ProfileSetup /></ProtectedRoute>} />

            {/* Role redirect */}
            <Route path="/" element={<RoleRedirect />} />

            {/* Participant */}
            <Route element={<ProtectedRoute allowedRoles={["participant"]}><ParticipantLayout /></ProtectedRoute>}>
              <Route path="/card" element={<CardPage />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/passport" element={<PassportPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Peer Specialist */}
            <Route element={<ProtectedRoute allowedRoles={["peer_specialist"]}><PeerLayout /></ProtectedRoute>}>
              <Route path="/caseload" element={<CaseloadPage />} />
              <Route path="/checkins" element={<CheckInsPage />} />
              <Route path="/crps" element={<CrpsPage />} />
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/participants" element={<AdminParticipants />} />
              <Route path="/admin/peers" element={<AdminPeers />} />
              <Route path="/admin/content" element={<AdminContent />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/audit" element={<AdminAudit />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
