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
import PeerProfileSetup from "@/pages/PeerProfileSetup";
import PeerProfile from "@/pages/PeerProfile";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import CardPage from "@/pages/CardPage";
import ParticipantMilestonesPage from "@/pages/ParticipantMilestonesPage";
import PlanPage from "@/pages/PlanPage";
import PeerBrowsePage from "@/pages/PeerBrowsePage";
import {
  ResourcesPage, PassportPage,
  CheckInsPage, CrpsPage,
  AdminDashboard, AdminParticipants, AdminContent, AdminReports, AdminAudit,
  IntakePage,
} from "@/pages/placeholder-pages";
import AdminPeersPage from "@/pages/AdminPeersPage";
import AdminMilestonesPage from "@/pages/AdminMilestonesPage";
import AdminProgramsPage from "@/pages/AdminProgramsPage";
import CaseloadPage from "@/pages/CaseloadPage";
import ParticipantDetailPage from "@/pages/ParticipantDetailPage";
import AdminAssessmentDomainsPage from "@/pages/AdminAssessmentDomainsPage";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DevRoleSwitcher />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<UpdatePassword />} />
            <Route path="/intake" element={<IntakePage />} />

            {/* Profile setup (participant only, before layout) */}
            <Route path="/profile/setup" element={<ProtectedRoute allowedRoles={["participant"]}><ProfileSetup /></ProtectedRoute>} />
            <Route path="/peers/setup" element={<ProtectedRoute allowedRoles={["peer_specialist"]}><PeerProfileSetup /></ProtectedRoute>} />

            {/* Role redirect */}
            <Route path="/" element={<RoleRedirect />} />

            {/* Participant */}
            <Route element={<ProtectedRoute allowedRoles={["participant"]}><ParticipantLayout /></ProtectedRoute>}>
              <Route path="/card" element={<CardPage />} />
              <Route path="/milestones" element={<ParticipantMilestonesPage />} />
              <Route path="/assessment/take" element={<AssessmentTakePage />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/passport" element={<PassportPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/peers/browse" element={<PeerBrowsePage />} />
            </Route>

            {/* Peer Specialist */}
            <Route element={<ProtectedRoute allowedRoles={["peer_specialist"]}><PeerLayout /></ProtectedRoute>}>
              <Route path="/caseload" element={<CaseloadPage />} />
              <Route path="/caseload/:participantId" element={<ParticipantDetailPage />} />
              <Route path="/checkins" element={<CheckInsPage />} />
              <Route path="/crps" element={<CrpsPage />} />
              <Route path="/peers/profile" element={<PeerProfile />} />
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/participants" element={<AdminParticipants />} />
              <Route path="/admin/peers" element={<AdminPeersPage />} />
              <Route path="/admin/content" element={<AdminContent />} />
              <Route path="/admin/content/programs" element={<AdminProgramsPage />} />
              <Route path="/admin/content/milestones" element={<AdminMilestonesPage />} />
              <Route path="/admin/content/assessment" element={<AdminAssessmentDomainsPage />} />
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
