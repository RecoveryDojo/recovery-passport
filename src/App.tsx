import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingPage from "@/pages/LandingPage";
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
import AssessmentTakePage from "@/pages/AssessmentTakePage";
import PlanPage from "@/pages/PlanPage";
import PeerBrowsePage from "@/pages/PeerBrowsePage";
import {
  AdminParticipants, AdminContent,
} from "@/pages/placeholder-pages";
import IntakePage from "@/pages/IntakePage";
import AdminAuditPage from "@/pages/AdminAuditPage";
import AdminReportsPage from "@/pages/AdminReportsPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";

import ResourceDirectoryPage from "@/pages/ResourceDirectoryPage";
import ResourceDetailPage from "@/pages/ResourceDetailPage";
import AdminResourcesPage from "@/pages/AdminResourcesPage";
import CrpsPage from "@/pages/CrpsPage";
import SelfCarePage from "@/pages/SelfCarePage";
import PassportConfigPage from "@/pages/PassportConfigPage";
import ParticipantCheckInsPage from "@/pages/ParticipantCheckInsPage";
import AdminParticipantCheckInsPage from "@/pages/AdminParticipantCheckInsPage";
import AdminPeersPage from "@/pages/AdminPeersPage";
import AdminMilestonesPage from "@/pages/AdminMilestonesPage";
import AdminProgramsPage from "@/pages/AdminProgramsPage";
import CaseloadPage from "@/pages/CaseloadPage";
import PeerCheckInsPage from "@/pages/PeerCheckInsPage";
import ParticipantDetailPage from "@/pages/ParticipantDetailPage";
import CheckInFormPage from "@/pages/CheckInFormPage";
import AdminAssessmentDomainsPage from "@/pages/AdminAssessmentDomainsPage";
import AdminAgreementsPage from "@/pages/AdminAgreementsPage";
import AdminMiPromptsPage from "@/pages/AdminMiPromptsPage";
import AdminProtocolsPage from "@/pages/AdminProtocolsPage";
import AdminPlanTemplatesPage from "@/pages/AdminPlanTemplatesPage";
import ParticipantAgreementsPage from "@/pages/ParticipantAgreementsPage";
import AdminPaymentsPage from "@/pages/AdminPaymentsPage";
import ParticipantPaymentsPage from "@/pages/ParticipantPaymentsPage";
import AdminPeerReviewPage from "@/pages/AdminPeerReviewPage";
import AdminPeerDetailPage from "@/pages/AdminPeerDetailPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";
import PublicPassportPage from "@/pages/PublicPassportPage";
import AdminParticipantNotesPage from "@/pages/AdminParticipantNotesPage";
import AdminProfilePage from "@/pages/AdminProfilePage";
import AssessmentHistoryPage from "@/pages/AssessmentHistoryPage";
import NotificationsPage from "@/pages/NotificationsPage";
import OfflineBanner from "@/components/OfflineBanner";
import InstallPrompt from "@/components/InstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <InstallPrompt />
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
            <Route path="/passport/:token" element={<PublicPassportPage />} />
            <Route path="/notifications" element={<ProtectedRoute allowedRoles={["participant","peer_specialist","admin"]}><NotificationsPage /></ProtectedRoute>} />

            {/* Profile setup (participant only, before layout) */}
            <Route path="/profile/setup" element={<ProtectedRoute allowedRoles={["participant"]}><ProfileSetup /></ProtectedRoute>} />
            <Route path="/peers/setup" element={<ProtectedRoute allowedRoles={["peer_specialist"]}><PeerProfileSetup /></ProtectedRoute>} />

            {/* Role redirect */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/home" element={<LandingPage />} />

            {/* Participant */}
            <Route element={<ProtectedRoute allowedRoles={["participant"]}><ParticipantLayout /></ProtectedRoute>}>
              <Route path="/card" element={<CardPage />} />
              <Route path="/milestones" element={<ParticipantMilestonesPage />} />
              <Route path="/assessment/take" element={<AssessmentTakePage />} />
              <Route path="/assessment/history" element={<AssessmentHistoryPage />} />
              <Route path="/plan" element={<PlanPage />} />
              <Route path="/resources" element={<ResourceDirectoryPage />} />
              <Route path="/resources/:resourceId" element={<ResourceDetailPage />} />
              <Route path="/passport" element={<PassportConfigPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/peers/browse" element={<PeerBrowsePage />} />
              <Route path="/peer-browser" element={<Navigate to="/peers/browse" replace />} />
              <Route path="/checkins" element={<ParticipantCheckInsPage />} />
              <Route path="/agreements" element={<ParticipantAgreementsPage />} />
              <Route path="/payments" element={<ParticipantPaymentsPage />} />
            </Route>

            {/* Peer Specialist */}
            <Route element={<ProtectedRoute allowedRoles={["peer_specialist"]}><PeerLayout /></ProtectedRoute>}>
              <Route path="/caseload" element={<CaseloadPage />} />
              <Route path="/caseload/:participantId" element={<ParticipantDetailPage />} />
              <Route path="/caseload/:participantId/checkin" element={<CheckInFormPage />} />
              <Route path="/crps" element={<CrpsPage />} />
              <Route path="/crps/selfcare" element={<SelfCarePage />} />
              <Route path="/peers/profile" element={<PeerProfile />} />
              <Route path="/peer/checkins" element={<PeerCheckInsPage />} />
            </Route>

            {/* Admin */}
            <Route element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/participants" element={<AdminParticipants />} />
              <Route path="/admin/peers" element={<AdminPeersPage />} />
              <Route path="/admin/peers/review" element={<AdminPeerReviewPage />} />
              <Route path="/admin/peers/:peerId" element={<AdminPeerDetailPage />} />
              <Route path="/admin/content" element={<AdminContent />} />
              <Route path="/admin/content/programs" element={<AdminProgramsPage />} />
              <Route path="/admin/content/milestones" element={<AdminMilestonesPage />} />
              <Route path="/admin/content/assessment" element={<AdminAssessmentDomainsPage />} />
              <Route path="/admin/content/agreements" element={<AdminAgreementsPage />} />
              <Route path="/admin/content/resources" element={<AdminResourcesPage />} />
              <Route path="/admin/content/mi-prompts" element={<AdminMiPromptsPage />} />
              <Route path="/admin/content/protocols" element={<AdminProtocolsPage />} />
              <Route path="/admin/content/plan-templates" element={<AdminPlanTemplatesPage />} />
              <Route path="/admin/participants/:participantId/checkins" element={<AdminParticipantCheckInsPage />} />
              <Route path="/admin/participants/:participantId/payments" element={<AdminPaymentsPage />} />
              <Route path="/admin/participants/:participantId/notes" element={<AdminParticipantNotesPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/audit" element={<AdminAuditPage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
